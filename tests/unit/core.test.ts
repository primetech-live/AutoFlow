import path from 'path';
import fs from 'fs';
import os from 'os';
import { encryptWithPassword, decryptWithPassword } from '../../src/core/vault';
import { isPathInWorkspace, loadProjectConfig } from '../../src/core/config';
import * as configModule from '../../src/core/config';
import deploy from '../../src/commands/deploy/index';

// Mock deploy dependencies to avoid SSH/git network calls
jest.mock('../../src/commands/deploy/ci');
jest.mock('../../src/commands/deploy/gitService');
jest.mock('../../src/commands/deploy/sshService');
jest.mock('../../src/commands/deploy/configService');
jest.mock('../../src/commands/deploy/remoteGitService');
jest.mock('../../src/commands/deploy/dockerBuildService');
jest.mock('../../src/commands/deploy/containerService');
jest.mock('../../src/commands/deploy/rollback');
jest.mock('../../src/commands/deploy/portService');
jest.mock('../../src/commands/deploy/ufwService');

describe('AutoFlow Core Unit Tests', () => {
    const tempDir = path.join(os.tmpdir(), `autoflow-tests-${Date.now()}`);

    beforeAll(() => {
        if (!fs.existsSync(tempDir)) {
            fs.mkdirSync(tempDir, { recursive: true });
        }
    });

    afterAll(() => {
        try {
            fs.rmSync(tempDir, { recursive: true, force: true });
        } catch {}
    });

    describe('Encryption and Decryption', () => {
        it('should correctly encrypt and decrypt a payload using a password', () => {
            const secret = 'military-grade-secret-123';
            const password = 'securepassword';
            const encrypted = encryptWithPassword(secret, password);
            expect(encrypted).toContain(':');
            const decrypted = decryptWithPassword(encrypted, password);
            expect(decrypted).toBe(secret);
        });

        it('should fail decryption when using the wrong password', () => {
            const secret = 'secret-data';
            const password = 'right-password';
            const wrongPassword = 'wrong-password';
            const encrypted = encryptWithPassword(secret, password);
            expect(() => decryptWithPassword(encrypted, wrongPassword)).toThrow();
        });
    });

    describe('JSON Corruption Backup', () => {
        it('should throw an error and create a .corrupted backup file on malformed JSON', () => {
            const badFilePath = path.join(tempDir, 'autoflow.config.json');
            fs.writeFileSync(badFilePath, '{ malformed: json ', 'utf-8');

            expect(() => loadProjectConfig(tempDir)).toThrow();

            const files = fs.readdirSync(tempDir);
            const backupFile = files.find(f => f.startsWith('autoflow.config.json.corrupted.'));
            expect(backupFile).toBeDefined();

            // Clean up the backup file
            if (backupFile) {
                fs.unlinkSync(path.join(tempDir, backupFile));
            }
            try { fs.unlinkSync(badFilePath); } catch {}
        });
    });

    describe('IPC Path Validation', () => {
        const mockWorkspace = path.join(tempDir, 'workspace');
        const GLOBAL_CONFIG_DIR = path.join(os.homedir(), '.autoflow');
        const GLOBAL_CONFIG_PATH = path.join(GLOBAL_CONFIG_DIR, 'config.json');
        let originalConfigContent: string | null = null;

        beforeAll(() => {
            if (!fs.existsSync(mockWorkspace)) {
                fs.mkdirSync(mockWorkspace, { recursive: true });
            }
            if (fs.existsSync(GLOBAL_CONFIG_PATH)) {
                originalConfigContent = fs.readFileSync(GLOBAL_CONFIG_PATH, 'utf-8');
            }
            fs.mkdirSync(GLOBAL_CONFIG_DIR, { recursive: true });
            fs.writeFileSync(GLOBAL_CONFIG_PATH, JSON.stringify({
                serverIp: '127.0.0.1',
                sshUser: 'ubuntu',
                sshPort: '22',
                sshKeyPath: 'key.pem',
                workspacePath: mockWorkspace
            }), 'utf-8');
        });

        afterAll(() => {
            if (originalConfigContent !== null) {
                fs.writeFileSync(GLOBAL_CONFIG_PATH, originalConfigContent, 'utf-8');
            } else {
                try { fs.unlinkSync(GLOBAL_CONFIG_PATH); } catch {}
            }
        });

        it('should accept resolved paths inside the workspace', () => {
            const projectPath = path.join(mockWorkspace, 'my-project');
            expect(isPathInWorkspace(projectPath)).toBe(true);
        });

        it('should reject resolved paths outside the workspace', () => {
            const outsidePath = path.join(tempDir, 'outside-project');
            expect(isPathInWorkspace(outsidePath)).toBe(false);
        });

        it('should accept the workspace path itself', () => {
            expect(isPathInWorkspace(mockWorkspace)).toBe(true);
        });
    });

    describe('Deploy Lock File Behavior', () => {
        const LOCK_FILE = path.join(os.homedir(), '.autoflow', 'jobs', 'deploy.lock');
        let originalLockContent: string | null = null;

        beforeAll(() => {
            if (fs.existsSync(LOCK_FILE)) {
                originalLockContent = fs.readFileSync(LOCK_FILE, 'utf-8');
                fs.unlinkSync(LOCK_FILE);
            }
        });

        afterAll(() => {
            if (fs.existsSync(LOCK_FILE)) {
                fs.unlinkSync(LOCK_FILE);
            }
            if (originalLockContent !== null) {
                fs.mkdirSync(path.dirname(LOCK_FILE), { recursive: true });
                fs.writeFileSync(LOCK_FILE, originalLockContent, 'utf-8');
            }
        });

        beforeEach(() => {
            if (fs.existsSync(LOCK_FILE)) {
                fs.unlinkSync(LOCK_FILE);
            }
        });

        it('should clear a stale lock with a dead PID and proceed', async () => {
            // Write a dead/non-existent PID (999999) to lock file
            fs.mkdirSync(path.dirname(LOCK_FILE), { recursive: true });
            fs.writeFileSync(LOCK_FILE, '999999', 'utf-8');

            const configService = require('../../src/commands/deploy/configService');
            configService.loadConfig.mockReturnValue({
                projectName: 'test-project',
                sshUser: 'user',
                serverIp: '1.2.3.4',
                appType: 'node',
                strictCI: false,
                gitRepo: 'https://github.com/user/test.git',
                branch: 'main',
                domain: ''
            });

            const sshService = require('../../src/commands/deploy/sshService');
            const mockSsh = {
                execCommand: jest.fn().mockResolvedValue({ code: 0, stdout: '', stderr: '' }),
                dispose: jest.fn()
            };
            sshService.connectSSH.mockResolvedValue(mockSsh);

            const result = deploy(false, tempDir);
            await expect(result).resolves.not.toThrow();

            // Lock file should be cleaned up by deploy finalizer
            expect(fs.existsSync(LOCK_FILE)).toBe(false);
        });

        it('should reject deployment and respect a live lock with an active PID', async () => {
            // Write current PID to lock file to simulate an active deployment
            fs.mkdirSync(path.dirname(LOCK_FILE), { recursive: true });
            fs.writeFileSync(LOCK_FILE, process.pid.toString(), 'utf-8');

            const result = deploy(false, tempDir);
            await expect(result).rejects.toThrow('Another deployment is already in progress.');

            // Lock file should still exist on disk
            expect(fs.existsSync(LOCK_FILE)).toBe(true);
        });
    });

    describe('execWithTimeout', () => {
        it('should dispose SSH session and reject on timeout', async () => {
            const mockSsh = {
                execCommand: jest.fn().mockImplementation(() => new Promise((resolve) => setTimeout(resolve, 500))),
                dispose: jest.fn()
            } as any;

            const { execWithTimeout } = require('../../src/commands/deploy/errors');
            const promise = execWithTimeout(mockSsh, 'sleep 10', 100);
            await expect(promise).rejects.toThrow('Command timed out');
            expect(mockSsh.dispose).toHaveBeenCalled();
        });
    });

    describe('verifyContainerHealth', () => {
        it('should retry checking docker ps and succeed if Up is found', async () => {
            let callCount = 0;
            const mockSsh = {
                execCommand: jest.fn().mockImplementation(() => {
                    callCount++;
                    if (callCount < 3) {
                        return Promise.resolve({ code: 0, stdout: 'Created', stderr: '' });
                    }
                    return Promise.resolve({ code: 0, stdout: 'Up 2 seconds', stderr: '' });
                })
            } as any;

            const { verifyContainerHealth } = jest.requireActual('../../src/commands/deploy/containerService');
            await expect(verifyContainerHealth(mockSsh, 'test-container')).resolves.toBeUndefined();
            expect(callCount).toBe(3);
        }, 15000);

        it('should fail after maximum retries if container does not start', async () => {
            const mockSsh = {
                execCommand: jest.fn().mockResolvedValue({ code: 0, stdout: 'Exited (1) 5 seconds ago', stderr: '' })
            } as any;

            const { verifyContainerHealth } = jest.requireActual('../../src/commands/deploy/containerService');
            await expect(verifyContainerHealth(mockSsh, 'test-container')).rejects.toThrow('failed to start or exited immediately');
        }, 15000);
    });

    describe('ProjectScanner async scan', () => {
        it('should scan a mock directory structure asynchronously and find projects', async () => {
            const scanDir = path.join(tempDir, 'scanner-test');
            const projDir = path.join(scanDir, 'my-project');
            fs.mkdirSync(projDir, { recursive: true });
            fs.writeFileSync(path.join(projDir, 'package.json'), JSON.stringify({ name: 'my-project' }), 'utf-8');

            const { ProjectScanner } = require('../../src/core/scanner');
            const scanner = new ProjectScanner();
            const found: any[] = [];
            const progress = jest.fn();
            const onFound = jest.fn().mockImplementation((p) => found.push(p));

            await scanner.scan(scanDir, onFound, progress, 2);

            expect(onFound).toHaveBeenCalled();
            expect(found[0].projectName).toBe('my-project');
            expect(found[0].appType).toBe('node');
        });
    });

    describe('Project Smart Detection & Initialization', () => {
        let testProjectPath: string;

        beforeEach(() => {
            testProjectPath = path.join(tempDir, `detect-project-${Date.now()}`);
            fs.mkdirSync(testProjectPath, { recursive: true });
        });

        afterEach(() => {
            try {
                fs.rmSync(testProjectPath, { recursive: true, force: true });
            } catch {}
        });

        it('should correctly detect a Go project and write appropriate Dockerfile', async () => {
            fs.writeFileSync(path.join(testProjectPath, 'go.mod'), 'module testapp\ngo 1.22', 'utf-8');
            fs.writeFileSync(path.join(testProjectPath, 'go.sum'), '', 'utf-8');

            const { initProjectCore } = require('../../src/core/initializer');
            await initProjectCore(testProjectPath, {
                projectName: 'my-go-app',
                gitRepo: 'https://github.com/user/go-app.git',
                domain: '',
                strictCI: false
            });

            const configPath = path.join(testProjectPath, 'autoflow.config.json');
            expect(fs.existsSync(configPath)).toBe(true);
            const config = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
            expect(config.appType).toBe('go');

            const dockerfilePath = path.join(testProjectPath, 'Dockerfile');
            expect(fs.existsSync(dockerfilePath)).toBe(true);
            const dockerfile = fs.readFileSync(dockerfilePath, 'utf-8');
            expect(dockerfile).toContain('FROM golang:');
        });

        it('should correctly detect a PHP project and write appropriate Dockerfile', async () => {
            fs.writeFileSync(path.join(testProjectPath, 'index.php'), '<?php echo "hello";', 'utf-8');

            const { initProjectCore } = require('../../src/core/initializer');
            await initProjectCore(testProjectPath, {
                projectName: 'my-php-app',
                gitRepo: 'https://github.com/user/php-app.git',
                domain: 'php.test',
                strictCI: true
            });

            const configPath = path.join(testProjectPath, 'autoflow.config.json');
            const config = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
            expect(config.appType).toBe('php');
            expect(config.mode).toBe('domain');
            expect(config.domain).toBe('php.test');

            const dockerfilePath = path.join(testProjectPath, 'Dockerfile');
            expect(fs.existsSync(dockerfilePath)).toBe(true);
            const dockerfile = fs.readFileSync(dockerfilePath, 'utf-8');
            expect(dockerfile).toContain('FROM php:');
        });

        it('should correctly detect a Laravel project and generate defensive entrypoint & public DocumentRoot Dockerfile', async () => {
            fs.writeFileSync(path.join(testProjectPath, 'artisan'), '#!/usr/bin/env php', 'utf-8');
            fs.writeFileSync(path.join(testProjectPath, 'composer.json'), JSON.stringify({ require: { 'laravel/framework': '^10.0' } }), 'utf-8');
            fs.mkdirSync(path.join(testProjectPath, 'app/Providers'), { recursive: true });
            fs.writeFileSync(path.join(testProjectPath, 'app/Providers/AppServiceProvider.php'), '<?php class AppServiceProvider { public function boot(): void {} }', 'utf-8');

            const { initProjectCore } = require('../../src/core/initializer');
            await initProjectCore(testProjectPath, {
                projectName: 'my-laravel-app',
                gitRepo: 'https://github.com/user/laravel-app.git',
                domain: 'laravel.test',
                strictCI: false,
                useVolumes: true
            });

            const configPath = path.join(testProjectPath, 'autoflow.config.json');
            const config = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
            expect(config.appType).toBe('laravel');

            const dockerfilePath = path.join(testProjectPath, 'Dockerfile');
            expect(fs.existsSync(dockerfilePath)).toBe(true);
            const dockerfile = fs.readFileSync(dockerfilePath, 'utf-8');
            expect(dockerfile).toContain('DocumentRoot /var/www/html/public');

            const entrypointPath = path.join(testProjectPath, 'docker-entrypoint.sh');
            expect(fs.existsSync(entrypointPath)).toBe(true);
            const entrypoint = fs.readFileSync(entrypointPath, 'utf-8');
            expect(entrypoint).toContain('php artisan config:clear || true');

            const providerContent = fs.readFileSync(path.join(testProjectPath, 'app/Providers/AppServiceProvider.php'), 'utf-8');
            expect(providerContent).toContain('forceScheme');
        });

        it('should fall back to plain PHP if artisan is present but laravel/framework is missing', async () => {
            fs.writeFileSync(path.join(testProjectPath, 'artisan'), '#!/usr/bin/env php', 'utf-8');
            fs.writeFileSync(path.join(testProjectPath, 'composer.json'), JSON.stringify({ require: { 'guzzlehttp/guzzle': '^7.0' } }), 'utf-8');

            const { initProjectCore } = require('../../src/core/initializer');
            await initProjectCore(testProjectPath, {
                projectName: 'stale-artisan-app',
                gitRepo: 'https://github.com/user/stale-artisan.git',
                domain: '',
                strictCI: false
            });

            const configPath = path.join(testProjectPath, 'autoflow.config.json');
            const config = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
            expect(config.appType).toBe('php');
        });
    });
});

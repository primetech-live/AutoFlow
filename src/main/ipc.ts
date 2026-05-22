import { ipcMain, dialog, BrowserWindow } from 'electron';
import fs from 'fs';
import path from 'path';
import os from 'os';
import speakeasy from 'speakeasy';
import { execSync } from 'child_process';

import {
    globalConfigExists,
    loadGlobalConfig,
    saveGlobalConfig,
    clearGlobalConfig,
    loadSavedProjects,
    addProjectToSaved,
    removeProjectFromSaved,
    loadProjectConfig,
    saveProjectConfig,
    projectConfigExists
} from '../core/config';

import { vaultEngine } from '../core/vault';
import { projectScanner } from '../core/scanner';
import { deployerEngine } from '../core/deployer';
import { monitorEngine } from '../core/monitor';

export function registerIpcHandlers(mainWindow: BrowserWindow) {
    // Window Controls
    ipcMain.on('window:minimize', () => {
        mainWindow.minimize();
    });

    ipcMain.on('window:maximize', () => {
        if (mainWindow.isMaximized()) {
            mainWindow.unmaximize();
        } else {
            mainWindow.maximize();
        }
    });

    ipcMain.on('window:close', () => {
        mainWindow.close();
    });

    // Global Config & Onboarding
    ipcMain.handle('config:global-exists', () => {
        return globalConfigExists();
    });

    ipcMain.handle('config:load-global', () => {
        try {
            return loadGlobalConfig();
        } catch {
            return null;
        }
    });

    ipcMain.handle('config:save-global', (_, config) => {
        return saveGlobalConfig(config);
    });

    ipcMain.handle('config:clear-global', () => {
        return clearGlobalConfig();
    });

    ipcMain.handle('config:reset-all', () => {
        clearGlobalConfig();
        vaultEngine.deleteVault();
        const projectsPath = path.join(os.homedir(), '.autoflow', 'projects.json');
        if (fs.existsSync(projectsPath)) {
            try {
                fs.unlinkSync(projectsPath);
            } catch {}
        }
        return { success: true };
    });

    ipcMain.handle('vault:generate-totp-secret', () => {
        const secret = speakeasy.generateSecret({ name: 'Autoflow vNext' });
        return {
            secret: secret.base32,
            otpauthUrl: secret.otpauth_url || ''
        };
    });

    // Vault Security
    ipcMain.handle('vault:exists', () => {
        const vaultPath = path.join(os.homedir(), '.autoflow', 'vault.json');
        return fs.existsSync(vaultPath);
    });

    ipcMain.handle('vault:setup', (_, password, totpSecret) => {
        return vaultEngine.setupVault(password, totpSecret);
    });

    ipcMain.handle('vault:unlock', (_, password, otpToken) => {
        return vaultEngine.unlock(password, otpToken);
    });

    ipcMain.handle('vault:lock', () => {
        return vaultEngine.lock();
    });

    ipcMain.handle('vault:is-unlocked', () => {
        return vaultEngine.isUnlocked();
    });

    // File Dialog Browser
    ipcMain.handle('dialog:browse', async () => {
        const result = await dialog.showOpenDialog(mainWindow, {
            properties: ['openDirectory']
        });
        return result.filePaths[0];
    });

    ipcMain.handle('dialog:browse-file', async () => {
        const result = await dialog.showOpenDialog(mainWindow, {
            properties: ['openFile'],
            filters: [
                { name: 'All Files', extensions: ['*'] },
                { name: 'Keys', extensions: ['pem', 'key', 'pub', 'rsa'] }
            ]
        });
        return result.filePaths[0];
    });

    // Project Scanner
    ipcMain.handle('scanner:start', async (event, rootDir) => {
        try {
            const projects = await projectScanner.scan(
                rootDir,
                (project) => {
                    mainWindow.webContents.send('scanner:project-found', project);
                },
                (count, dir) => {
                    mainWindow.webContents.send('scanner:progress', { count, dir });
                }
            );
            mainWindow.webContents.send('scanner:finished', projects);
        } catch (err: any) {
            mainWindow.webContents.send('scanner:finished', []);
        }
    });

    ipcMain.handle('scanner:abort', () => {
        projectScanner.abort();
    });

    ipcMain.handle('scanner:start-global', async () => {
        try {
            await projectScanner.scanGlobal((project) => {
                mainWindow.webContents.send('scanner:global-project-found', project);
            });
            mainWindow.webContents.send('scanner:global-finished');
        } catch (err) {
            mainWindow.webContents.send('scanner:global-finished');
        }
    });

    // Project Config and Saved list
    ipcMain.handle('projects:get-saved', async () => {
        const paths = loadSavedProjects();
        const projectsMetadata = [];

        for (const p of paths) {
            if (fs.existsSync(p)) {
                try {
                    const hasConfig = projectConfigExists(p);
                    let projectName = path.basename(p);
                    let appType = 'node';
                    let gitRepo = '';

                    if (hasConfig) {
                        const config = loadProjectConfig(p);
                        projectName = config.projectName || projectName;
                        appType = config.appType || appType;
                        gitRepo = config.gitRepo || '';
                    } else {
                        const pkgPath = path.join(p, 'package.json');
                        if (fs.existsSync(pkgPath)) {
                            const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf-8'));
                            projectName = pkg.name || projectName;
                        }
                    }

                    projectsMetadata.push({
                        projectName,
                        projectPath: p,
                        hasConfig,
                        appType,
                        gitRepo
                    });
                } catch {
                    // Ignore errors in reading configurations
                }
            } else {
                // Auto prune invalid directory paths
                removeProjectFromSaved(p);
            }
        }
        return projectsMetadata;
    });

    ipcMain.handle('projects:add', (_, projectPath) => {
        addProjectToSaved(projectPath);
    });

    ipcMain.handle('projects:remove', (_, projectPath) => {
        removeProjectFromSaved(projectPath);
    });

    ipcMain.handle('projects:load-config', (_, projectPath) => {
        return loadProjectConfig(projectPath);
    });

    ipcMain.handle('projects:save-config', (_, projectPath, config) => {
        return saveProjectConfig(config, projectPath);
    });

    ipcMain.handle('projects:config-exists', (_, projectPath) => {
        return projectConfigExists(projectPath);
    });

    // Deploy actions
    ipcMain.handle('deploy:run', async (_, projectPath) => {
        // Runs asynchronously in background; errors are handled via events
        deployerEngine.deploy(projectPath).catch(() => {});
        return { success: true };
    });

    ipcMain.handle('deploy:get-history', (_, projectName) => {
        return deployerEngine.getHistory(projectName);
    });

    ipcMain.handle('deploy:rollback', async (_, projectPath, commitSha) => {
        let originalBranch = 'main';
        try {
            originalBranch = execSync('git symbolic-ref --short HEAD', { cwd: projectPath }).toString().trim();
        } catch {
            try {
                originalBranch = execSync('git rev-parse --abbrev-ref HEAD', { cwd: projectPath }).toString().trim();
            } catch {}
        }

        // Run git checkout & deployment in background so UI doesn't hang
        (async () => {
            try {
                execSync(`git checkout ${commitSha}`, { cwd: projectPath });
                await deployerEngine.deploy(projectPath);
            } catch (err: any) {
                console.error('[Rollback] Failed to deploy rollback commit:', err);
            } finally {
                try {
                    execSync(`git checkout ${originalBranch}`, { cwd: projectPath });
                } catch {}
            }
        })();

        return { success: true };
    });

    ipcMain.handle('deploy:check-interrupted', () => {
        return deployerEngine.checkInterruptedJob();
    });

    ipcMain.handle('deploy:clear-interrupted', () => {
        return deployerEngine.clearActiveJob();
    });

    ipcMain.handle('projects:load-env', async (_, projectPath) => {
        const envPath = path.join(projectPath, '.env');
        if (!fs.existsSync(envPath)) return {};
        try {
            const content = fs.readFileSync(envPath, 'utf-8');
            const env: Record<string, string> = {};
            content.split('\n').forEach(line => {
                const trimmed = line.trim();
                if (trimmed && !trimmed.startsWith('#') && trimmed.includes('=')) {
                    const idx = trimmed.indexOf('=');
                    const key = trimmed.slice(0, idx).trim();
                    const val = trimmed.slice(idx + 1).trim().replace(/^"|"$/g, '');
                    env[key] = val;
                }
            });
            return env;
        } catch {
            return {};
        }
    });

    ipcMain.handle('projects:save-env', async (_, projectPath, env) => {
        const envPath = path.join(projectPath, '.env');
        try {
            const lines = Object.entries(env).map(([k, v]) => `${k}=${v}`);
            fs.writeFileSync(envPath, lines.join('\n'), 'utf-8');
            return { success: true };
        } catch (err: any) {
            return { success: false, error: err.message };
        }
    });

    // Server Stats Monitor
    ipcMain.handle('server:fetch-stats', async () => {
        try {
            const config = loadGlobalConfig();
            return await monitorEngine.fetchStats(config);
        } catch (err: any) {
            throw new Error(err.message || 'Failed to fetch server statistics.');
        }
    });

    ipcMain.handle('server:fetch-remote-logs', async (_, name) => {
        try {
            const config = loadGlobalConfig();
            return await monitorEngine.fetchRemoteLogs(config, name);
        } catch (err: any) {
            return `Failed to fetch remote logs: ${err.message}`;
        }
    });

    // Listen to Core Engines & Emit to Renderer
    deployerEngine.on('deploy:started', (data) => {
        if (!mainWindow.isDestroyed()) mainWindow.webContents.send('deploy:started', data);
    });

    deployerEngine.on('deploy:log', (data) => {
        if (!mainWindow.isDestroyed()) mainWindow.webContents.send('deploy:log', data);
    });

    deployerEngine.on('deploy:success', (data) => {
        if (!mainWindow.isDestroyed()) mainWindow.webContents.send('deploy:success', data);
    });

    deployerEngine.on('deploy:failed', (data) => {
        if (!mainWindow.isDestroyed()) mainWindow.webContents.send('deploy:failed', data);
    });

    vaultEngine.on('lock-state-change', (locked) => {
        if (!mainWindow.isDestroyed()) mainWindow.webContents.send('vault:locked-state-change', locked);
    });
}

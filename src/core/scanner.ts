import fs from 'fs';
import path from 'path';
import { ProjectConfig } from './config';

export interface ScannedProject {
    projectName: string;
    projectPath: string;
    hasConfig: boolean;
    appType: string;
    gitRepo: string;
}

const EXCLUDE_DIRS = new Set([
    'node_modules',
    '.git',
    '.github',
    'dist',
    'build',
    'release',
    'out',
    'temp',
    'tmp',
    '.next',
    'bower_components',
    'coverage'
]);

/**
 * Recursively scans a directory for Node.js or Autoflow projects in a non-blocking, incremental way.
 * Exposes a progress callback to stream project findings in real-time.
 */
export class ProjectScanner {
    private isScanning = false;
    private shouldAbort = false;

    public abort() {
        if (this.isScanning) {
            this.shouldAbort = true;
        }
    }

    public async scan(
        rootDir: string,
        onProjectFound: (project: ScannedProject) => void,
        onProgress: (scannedCount: number, currentDir: string) => void,
        maxDepth = 3
    ): Promise<ScannedProject[]> {
        this.isScanning = true;
        this.shouldAbort = false;

        const foundProjects: ScannedProject[] = [];
        let scannedCount = 0;

        const queue: Array<{ dirPath: string; depth: number }> = [{ dirPath: rootDir, depth: 0 }];

        while (queue.length > 0 && !this.shouldAbort) {
            const current = queue.shift();
            if (!current) continue;

            const { dirPath, depth } = current;
            scannedCount++;

            // Periodically yield control to the event loop to keep the UI responsive
            if (scannedCount % 50 === 0) {
                onProgress(scannedCount, dirPath);
                await new Promise(resolve => setImmediate(resolve));
            }

            try {
                const stats = await fs.promises.stat(dirPath);
                if (!stats.isDirectory()) continue;

                // Read files and subdirectories in this directory asynchronously
                const files = await fs.promises.readdir(dirPath, { withFileTypes: true });
                const fileNames = new Set(files.filter(f => f.isFile()).map(f => f.name));
                const dirNames = new Set(files.filter(f => f.isDirectory()).map(f => f.name));

                // Check if this directory is a project using async checks/Sets
                const hasConfig = fileNames.has('autoflow.config.json');
                const hasPackageJson = fileNames.has('package.json');
                const hasIndexHtml = fileNames.has('index.html');
                
                let hasIndexPhp = fileNames.has('index.php');
                if (!hasIndexPhp && dirNames.has('public')) {
                    try {
                        await fs.promises.access(path.join(dirPath, 'public', 'index.php'), fs.constants.F_OK);
                        hasIndexPhp = true;
                    } catch {}
                }

                const hasGoMod = fileNames.has('go.mod');
                const hasRequirements = fileNames.has('requirements.txt');
                const hasGemfile = fileNames.has('Gemfile');
                const hasPom = fileNames.has('pom.xml');

                if (hasConfig || hasPackageJson || hasIndexHtml || hasIndexPhp || hasGoMod || hasRequirements || hasGemfile || hasPom) {
                    let projectName = path.basename(dirPath);
                    let appType = 'node';
                    let gitRepo = '';

                    if (hasConfig) {
                        try {
                            const configContent = await fs.promises.readFile(path.join(dirPath, 'autoflow.config.json'), 'utf-8');
                            const config = JSON.parse(configContent);
                            projectName = config.projectName || projectName;
                            appType = config.appType || appType;
                            gitRepo = config.gitRepo || '';
                        } catch {
                            // fall back to default
                        }
                    } else if (hasGoMod) {
                        appType = 'go';
                    } else if (hasPom) {
                        appType = 'java';
                    } else if (hasGemfile) {
                        try {
                            const gemfileContent = await fs.promises.readFile(path.join(dirPath, 'Gemfile'), 'utf-8');
                            appType = gemfileContent.includes('rails') ? 'rails' : 'ruby';
                        } catch {
                            appType = 'ruby';
                        }
                    } else if (hasRequirements) {
                        try {
                            const req = (await fs.promises.readFile(path.join(dirPath, 'requirements.txt'), 'utf-8')).toLowerCase();
                            if (fileNames.has('manage.py') && req.includes('django')) {
                                appType = 'django';
                            } else if (req.includes('flask')) {
                                appType = 'flask';
                            } else {
                                appType = 'python';
                            }
                        } catch {
                            appType = 'python';
                        }
                    } else if (hasIndexPhp) {
                        appType = 'php';
                    } else if (hasPackageJson) {
                        try {
                            const pkg = JSON.parse(await fs.promises.readFile(path.join(dirPath, 'package.json'), 'utf-8'));
                            projectName = pkg.name || projectName;
                            const deps = { ...pkg.dependencies, ...pkg.devDependencies };
                            if (deps.next) appType = 'next';
                            else if (deps.nuxt) appType = 'nuxt';
                            else if (deps.vue) appType = 'vue';
                            else if (deps.vite) appType = 'vite';
                            else if (deps['react-scripts']) appType = 'react';
                            else if (deps['@angular/cli']) appType = 'angular';
                            else appType = 'node';
                        } catch {
                            appType = 'node';
                        }
                    } else if (hasIndexHtml) {
                        appType = 'static';
                    }

                    // Try to extract git remote URL from .git/config if not defined in config
                    if (!gitRepo) {
                        try {
                            const gitConfigPath = path.join(dirPath, '.git', 'config');
                            let hasGitConfig = false;
                            try {
                                await fs.promises.access(gitConfigPath, fs.constants.F_OK);
                                hasGitConfig = true;
                            } catch {}

                            if (hasGitConfig) {
                                const gitConfig = await fs.promises.readFile(gitConfigPath, 'utf-8');
                                const match = gitConfig.match(/url\s*=\s*(.+)/);
                                if (match && match[1]) {
                                    gitRepo = match[1].trim();
                                }
                            }
                        } catch {
                            // ignore config read errors
                        }
                    }

                    const scanned: ScannedProject = {
                        projectName,
                        projectPath: dirPath,
                        hasConfig,
                        appType,
                        gitRepo
                    };

                    foundProjects.push(scanned);
                    onProjectFound(scanned);

                    // If it's a project, we don't necessarily need to scan deeper,
                    // but we can search other sibling directories.
                    continue;
                }

                // If not at max depth, enqueue subdirectories
                if (depth < maxDepth) {
                    for (const file of files) {
                        if (file.isDirectory() && !EXCLUDE_DIRS.has(file.name) && !file.name.startsWith('.')) {
                            queue.push({
                                dirPath: path.join(dirPath, file.name),
                                depth: depth + 1
                            });
                        }
                    }
                }
            } catch (err) {
                // Ignore errors reading specific directory (e.g. permission issues)
            }
        }

        this.isScanning = false;
        return foundProjects;
    }

    public async scanGlobal(
        onProjectFound: (project: ScannedProject) => void
    ): Promise<ScannedProject[]> {
        const found: ScannedProject[] = [];
        const roots: string[] = [];

        // Add user home
        const os = require('os');
        const home = os.homedir();
        roots.push(home);

        // Find drive roots on Windows
        if (process.platform === 'win32') {
            const drives = ['D:\\', 'E:\\', 'F:\\', 'C:\\'];
            for (const drive of drives) {
                if (drive !== 'C:\\') {
                    try {
                        await fs.promises.access(drive, fs.constants.F_OK);
                        roots.push(drive);
                    } catch {}
                }
            }
        }

        let dirsChecked = 0;
        const queue: Array<{ dirPath: string; depth: number }> = roots.map(r => ({ dirPath: r, depth: 0 }));

        const EXCLUDE_GLOBAL_DIRS = new Set([
            'node_modules', '.git', '.github', 'dist', 'build', 'release', 'out', 'temp', 'tmp',
            'appdata', 'application data', 'local settings', 'microsoft', 'onedrive', 'searches',
            'saved games', 'contacts', 'links', 'music', 'pictures', 'videos', 'downloads',
            'recycle.bin', 'system volume information', 'windows', 'program files', 'program files (x86)',
            'programdata', 'contents', 'library', 'cached', 'caches', 'node'
        ]);

        while (queue.length > 0) {
            const current = queue.shift();
            if (!current) continue;

            const { dirPath, depth } = current;
            dirsChecked++;

            if (dirsChecked % 150 === 0) {
                await new Promise(resolve => setImmediate(resolve));
            }

            try {
                const configPath = path.join(dirPath, 'autoflow.config.json');
                let hasConfig = false;
                try {
                    await fs.promises.access(configPath, fs.constants.F_OK);
                    hasConfig = true;
                } catch {}

                if (hasConfig) {
                    try {
                        const content = JSON.parse(await fs.promises.readFile(configPath, 'utf-8'));
                        if (content.projectName) {
                            const proj: ScannedProject = {
                                projectName: content.projectName,
                                projectPath: dirPath,
                                hasConfig: true,
                                appType: content.appType || 'node',
                                gitRepo: content.gitRepo || ''
                            };
                            found.push(proj);
                            onProjectFound(proj);
                            continue; // Skip scanning subfolders inside a project to save time
                        }
                    } catch {
                        // ignore error
                    }
                }

                if (depth < 4) {
                    const files = await fs.promises.readdir(dirPath, { withFileTypes: true });
                    for (const file of files) {
                        if (file.isDirectory()) {
                            const nameLower = file.name.toLowerCase();
                            if (!EXCLUDE_GLOBAL_DIRS.has(nameLower) && !file.name.startsWith('.')) {
                                queue.push({
                                    dirPath: path.join(dirPath, file.name),
                                    depth: depth + 1
                                });
                            }
                        }
                    }
                }
            } catch {
                // skip read/permission error
            }
        }
        return found;
    }
}

export const projectScanner = new ProjectScanner();

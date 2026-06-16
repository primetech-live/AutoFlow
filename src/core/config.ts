import fs from 'fs';
import path from 'path';
import os from 'os';

export interface GlobalConfig {
    serverIp: string;
    sshUser: string;
    sshPort: string;
    sshKeyPath: string;
}

export interface ProjectConfig {
    projectName: string;
    gitRepo: string;
    domain?: string;
    appType: string;
    deploymentType: string;
    mode: 'domain' | 'port';
    strictCI?: boolean;
    volumes?: string[];
}

export type MergedConfig = GlobalConfig & ProjectConfig;

const GLOBAL_CONFIG_DIR = path.join(os.homedir(), '.autoflow');
const GLOBAL_CONFIG_PATH = path.join(GLOBAL_CONFIG_DIR, 'config.json');

export function globalConfigExists(): boolean {
    return fs.existsSync(GLOBAL_CONFIG_PATH);
}

export function loadGlobalConfig(): GlobalConfig {
    if (!fs.existsSync(GLOBAL_CONFIG_PATH)) {
        throw new Error('Global configuration missing! Run onboarding setup.');
    }
    return JSON.parse(fs.readFileSync(GLOBAL_CONFIG_PATH, 'utf-8')) as GlobalConfig;
}

export function saveGlobalConfig(config: GlobalConfig): void {
    if (!fs.existsSync(GLOBAL_CONFIG_DIR)) {
        fs.mkdirSync(GLOBAL_CONFIG_DIR, { recursive: true });
    }
    fs.writeFileSync(GLOBAL_CONFIG_PATH, JSON.stringify(config, null, 2), { mode: 0o600 });
}

export function projectConfigExists(projectPath: string = process.cwd()): boolean {
    return fs.existsSync(path.join(projectPath, 'autoflow.config.json'));
}

export function loadProjectConfig(projectPath: string = process.cwd()): ProjectConfig {
    const configPath = path.join(projectPath, 'autoflow.config.json');
    if (!fs.existsSync(configPath)) {
        throw new Error('Project config missing! Initialize project first.');
    }
    return JSON.parse(fs.readFileSync(configPath, 'utf-8')) as ProjectConfig;
}

export function saveProjectConfig(config: Partial<ProjectConfig>, projectPath: string = process.cwd()): void {
    const configPath = path.join(projectPath, 'autoflow.config.json');
    let current: Partial<ProjectConfig> = {};
    if (fs.existsSync(configPath)) {
        try {
            current = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
        } catch { /* ignore invalid json */ }
    }
    const updated = { ...current, ...config };
    fs.writeFileSync(configPath, JSON.stringify(updated, null, 2), 'utf-8');
}

export function clearGlobalConfig(): void {
    if (fs.existsSync(GLOBAL_CONFIG_PATH)) {
        fs.unlinkSync(GLOBAL_CONFIG_PATH);
    }
}

const PROJECTS_LIST_PATH = path.join(GLOBAL_CONFIG_DIR, 'projects.json');

export interface SavedProjectEntry {
    path: string;
    serverIp: string;
    migrated?: boolean;
}

export function loadSavedProjectsWithMetadata(): SavedProjectEntry[] {
    if (!fs.existsSync(PROJECTS_LIST_PATH)) return [];
    try {
        const raw = JSON.parse(fs.readFileSync(PROJECTS_LIST_PATH, 'utf-8'));
        if (Array.isArray(raw)) {
            let needsSave = false;
            let currentServerIp = 'unknown';
            try {
                const globalConfig = loadGlobalConfig();
                currentServerIp = globalConfig.serverIp || 'unknown';
            } catch {}

            // Map and mark legacy string paths as migrated
            let list: SavedProjectEntry[] = raw.map(item => {
                if (typeof item === 'string') {
                    needsSave = true;
                    return { path: item, serverIp: currentServerIp, migrated: true };
                }
                return {
                    path: item.path || '',
                    serverIp: item.serverIp || 'unknown',
                    migrated: item.migrated || false
                };
            }).filter(item => item.path);

            // Mark duplicate paths across server IPs as migrated for self-healing
            const pathCounts: Record<string, number> = {};
            list.forEach(p => {
                pathCounts[p.path] = (pathCounts[p.path] || 0) + 1;
            });

            list = list.map(p => {
                if (pathCounts[p.path] > 1 && !p.migrated) {
                    needsSave = true;
                    return { ...p, migrated: true };
                }
                return p;
            });

            if (needsSave) {
                saveProjectsListWithMetadata(list);
            }
            return list;
        }
        return [];
    } catch {
        return [];
    }
}

export function saveProjectsListWithMetadata(projects: SavedProjectEntry[]): void {
    if (!fs.existsSync(GLOBAL_CONFIG_DIR)) {
        fs.mkdirSync(GLOBAL_CONFIG_DIR, { recursive: true });
    }
    fs.writeFileSync(PROJECTS_LIST_PATH, JSON.stringify(projects, null, 2), 'utf-8');
}

export function loadSavedProjects(): string[] {
    let serverIp = 'unknown';
    try {
        const globalConfig = loadGlobalConfig();
        serverIp = globalConfig.serverIp || 'unknown';
    } catch {}

    const list = loadSavedProjectsWithMetadata();
    return list.filter(p => p.serverIp === serverIp).map(p => p.path);
}

export function saveProjectsList(projects: string[]): void {
    let serverIp = 'unknown';
    try {
        const globalConfig = loadGlobalConfig();
        serverIp = globalConfig.serverIp || 'unknown';
    } catch {}

    // We merge with non-active server projects so we don't overwrite them
    const allList = loadSavedProjectsWithMetadata();
    const otherServersList = allList.filter(p => p.serverIp !== serverIp);
    const activeList = projects.map(p => ({ path: p, serverIp, migrated: false }));
    
    saveProjectsListWithMetadata([...otherServersList, ...activeList]);
}

export function addProjectToSaved(projectPath: string): void {
    let serverIp = 'unknown';
    try {
        const globalConfig = loadGlobalConfig();
        serverIp = globalConfig.serverIp || 'unknown';
    } catch {}

    const list = loadSavedProjectsWithMetadata();
    
    // Prune any duplicate migrated entries on other server IPs for this same path
    const cleanedList = list.filter(p => !(p.path === projectPath && p.serverIp !== serverIp && p.migrated));

    if (!cleanedList.some(p => p.path === projectPath && p.serverIp === serverIp)) {
        cleanedList.push({ path: projectPath, serverIp, migrated: false });
    } else {
        const idx = cleanedList.findIndex(p => p.path === projectPath && p.serverIp === serverIp);
        if (idx !== -1) {
            cleanedList[idx].migrated = false;
        }
    }
    saveProjectsListWithMetadata(cleanedList);
}

export function removeProjectFromSaved(projectPath: string): void {
    let serverIp = 'unknown';
    try {
        const globalConfig = loadGlobalConfig();
        serverIp = globalConfig.serverIp || 'unknown';
    } catch {}

    const list = loadSavedProjectsWithMetadata();
    const index = list.findIndex(p => p.path === projectPath && p.serverIp === serverIp);
    if (index !== -1) {
        list.splice(index, 1);
        saveProjectsListWithMetadata(list);
    }
}

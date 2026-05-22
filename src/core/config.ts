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

export function loadSavedProjects(): string[] {
    if (!fs.existsSync(PROJECTS_LIST_PATH)) return [];
    try {
        return JSON.parse(fs.readFileSync(PROJECTS_LIST_PATH, 'utf-8'));
    } catch {
        return [];
    }
}

export function saveProjectsList(projects: string[]): void {
    if (!fs.existsSync(GLOBAL_CONFIG_DIR)) {
        fs.mkdirSync(GLOBAL_CONFIG_DIR, { recursive: true });
    }
    fs.writeFileSync(PROJECTS_LIST_PATH, JSON.stringify(projects, null, 2), 'utf-8');
}

export function addProjectToSaved(projectPath: string): void {
    const list = loadSavedProjects();
    if (!list.includes(projectPath)) {
        list.push(projectPath);
        saveProjectsList(list);
    }
}

export function removeProjectFromSaved(projectPath: string): void {
    const list = loadSavedProjects();
    const index = list.indexOf(projectPath);
    if (index !== -1) {
        list.splice(index, 1);
        saveProjectsList(list);
    }
}

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
    branch?: string;
    strictCI?: boolean;
    volumes?: string[];
}

export type MergedConfig = GlobalConfig & ProjectConfig;

export function loadGlobalConfig(): GlobalConfig {
    const globalConfigPath = path.join(os.homedir(), '.autoflow', 'config.json');
    if (!fs.existsSync(globalConfigPath)) {
        throw new Error('Global configuration missing! Run "autoflow setup" first.');
    }
    return JSON.parse(fs.readFileSync(globalConfigPath, 'utf-8')) as GlobalConfig;
}

export function loadProjectConfig(projectDir: string = process.cwd()): ProjectConfig {
    const configPath = path.join(projectDir, 'autoflow.config.json');
    if (!fs.existsSync(configPath)) {
        throw new Error('Project config missing! Run "autoflow init" first.');
    }
    return JSON.parse(fs.readFileSync(configPath, 'utf-8')) as ProjectConfig;
}

export function saveProjectConfig(config: Partial<ProjectConfig>, projectDir: string = process.cwd()): void {
    fs.writeFileSync(path.join(projectDir, 'autoflow.config.json'), JSON.stringify(config, null, 2));
}

export function saveGlobalConfig(config: GlobalConfig): void {
    const configDir = path.join(os.homedir(), '.autoflow');
    const configPath = path.join(configDir, 'config.json');
    if (!fs.existsSync(configDir)) {
        fs.mkdirSync(configDir, { recursive: true });
    }
    fs.writeFileSync(configPath, JSON.stringify(config, null, 2), { mode: 0o600 });
}

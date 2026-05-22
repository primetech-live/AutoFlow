import { contextBridge, ipcRenderer } from 'electron';

export interface AutoflowApi {
    // Window Controls
    minimize: () => void;
    maximize: () => void;
    close: () => void;

    // Onboarding & Global Config
    globalConfigExists: () => Promise<boolean>;
    loadGlobalConfig: () => Promise<any>;
    saveGlobalConfig: (config: any) => Promise<void>;
    clearGlobalConfig: () => Promise<void>;
    resetAllConfig: () => Promise<{ success: boolean }>;
    generateTOTPSecret: () => Promise<{ secret: string; otpauthUrl: string }>;

    // Vault Security
    isVaultSetup: () => Promise<boolean>;
    setupVault: (password: string, totpSecret: string) => Promise<void>;
    unlockVault: (password: string, otpToken: string) => Promise<boolean>;
    lockVault: () => Promise<void>;
    isVaultUnlocked: () => Promise<boolean>;
    onVaultLockedStateChange: (callback: (locked: boolean) => void) => void;

    // Project Scanner
    browseFolder: () => Promise<string | undefined>;
    browseFile: () => Promise<string | undefined>;
    scanDirectory: (rootDir: string) => Promise<void>;
    abortScan: () => Promise<void>;
    onScanProjectFound: (callback: (project: any) => void) => void;
    onScanProgress: (callback: (data: { count: number; dir: string }) => void) => void;
    onScanFinished: (callback: (projects: any[]) => void) => void;
    scanGlobal: () => Promise<void>;
    onScanGlobalProjectFound: (callback: (project: any) => void) => void;
    onScanGlobalFinished: (callback: () => void) => void;

    // Project Config
    getSavedProjects: () => Promise<any[]>;
    addProject: (projectPath: string) => Promise<void>;
    removeProject: (projectPath: string) => Promise<void>;
    loadProjectConfig: (projectPath: string) => Promise<any>;
    saveProjectConfig: (projectPath: string, config: any) => Promise<void>;
    projectConfigExists: (projectPath: string) => Promise<boolean>;
    loadEnv: (projectPath: string) => Promise<Record<string, string>>;
    saveEnv: (projectPath: string, env: Record<string, string>) => Promise<any>;

    // Deployment
    deploy: (projectPath: string) => Promise<void>;
    getHistory: (projectName: string) => Promise<any[]>;
    rollbackToDeploy: (projectPath: string, commitSha: string) => Promise<void>;
    checkInterruptedJob: () => Promise<any>;
    clearInterruptedJob: () => Promise<void>;
    
    // Deployment Listeners
    onDeployStarted: (callback: (data: { projectName: string; startTime: number }) => void) => void;
    onDeployLog: (callback: (data: { projectName: string; timestamp: number; type: string; message: string; step: string }) => void) => void;
    onDeploySuccess: (callback: (data: { projectName: string }) => void) => void;
    onDeployFailed: (callback: (data: { projectName: string; error: string }) => void) => void;

    // System Monitor
    fetchServerStats: () => Promise<any>;
    fetchRemoteLogs: (name: string) => Promise<string>;
}

const api: AutoflowApi = {
    // Window Controls
    minimize: () => ipcRenderer.send('window:minimize'),
    maximize: () => ipcRenderer.send('window:maximize'),
    close: () => ipcRenderer.send('window:close'),

    // Onboarding & Global Config
    globalConfigExists: () => ipcRenderer.invoke('config:global-exists'),
    loadGlobalConfig: () => ipcRenderer.invoke('config:load-global'),
    saveGlobalConfig: (config) => ipcRenderer.invoke('config:save-global', config),
    clearGlobalConfig: () => ipcRenderer.invoke('config:clear-global'),
    resetAllConfig: () => ipcRenderer.invoke('config:reset-all'),
    generateTOTPSecret: () => ipcRenderer.invoke('vault:generate-totp-secret'),

    // Vault Security
    isVaultSetup: () => ipcRenderer.invoke('vault:exists'),
    setupVault: (password, totpSecret) => ipcRenderer.invoke('vault:setup', password, totpSecret),
    unlockVault: (password, otpToken) => ipcRenderer.invoke('vault:unlock', password, otpToken),
    lockVault: () => ipcRenderer.invoke('vault:lock'),
    isVaultUnlocked: () => ipcRenderer.invoke('vault:is-unlocked'),
    onVaultLockedStateChange: (callback) => {
        ipcRenderer.on('vault:locked-state-change', (_, locked) => callback(locked));
    },

    // Project Scanner
    browseFolder: () => ipcRenderer.invoke('dialog:browse'),
    browseFile: () => ipcRenderer.invoke('dialog:browse-file'),
    scanDirectory: (rootDir) => ipcRenderer.invoke('scanner:start', rootDir),
    abortScan: () => ipcRenderer.invoke('scanner:abort'),
    onScanProjectFound: (callback) => {
        ipcRenderer.on('scanner:project-found', (_, project) => callback(project));
    },
    onScanProgress: (callback) => {
        ipcRenderer.on('scanner:progress', (_, data) => callback(data));
    },
    onScanFinished: (callback) => {
        ipcRenderer.on('scanner:finished', (_, projects) => callback(projects));
    },
    scanGlobal: () => ipcRenderer.invoke('scanner:start-global'),
    onScanGlobalProjectFound: (callback) => {
        ipcRenderer.on('scanner:global-project-found', (_, project) => callback(project));
    },
    onScanGlobalFinished: (callback) => {
        ipcRenderer.on('scanner:global-finished', () => callback());
    },

    // Project Config
    getSavedProjects: () => ipcRenderer.invoke('projects:get-saved'),
    addProject: (projectPath) => ipcRenderer.invoke('projects:add', projectPath),
    removeProject: (projectPath) => ipcRenderer.invoke('projects:remove', projectPath),
    loadProjectConfig: (projectPath) => ipcRenderer.invoke('projects:load-config', projectPath),
    saveProjectConfig: (projectPath, config) => ipcRenderer.invoke('projects:save-config', projectPath, config),
    projectConfigExists: (projectPath) => ipcRenderer.invoke('projects:config-exists', projectPath),
    loadEnv: (projectPath) => ipcRenderer.invoke('projects:load-env', projectPath),
    saveEnv: (projectPath, env) => ipcRenderer.invoke('projects:save-env', projectPath, env),

    // Deployment
    deploy: (projectPath) => ipcRenderer.invoke('deploy:run', projectPath),
    getHistory: (projectName) => ipcRenderer.invoke('deploy:get-history', projectName),
    rollbackToDeploy: (projectPath, commitSha) => ipcRenderer.invoke('deploy:rollback', projectPath, commitSha),
    checkInterruptedJob: () => ipcRenderer.invoke('deploy:check-interrupted'),
    clearInterruptedJob: () => ipcRenderer.invoke('deploy:clear-interrupted'),

    // Deployment Listeners
    onDeployStarted: (callback) => {
        ipcRenderer.on('deploy:started', (_, data) => callback(data));
    },
    onDeployLog: (callback) => {
        ipcRenderer.on('deploy:log', (_, data) => callback(data));
    },
    onDeploySuccess: (callback) => {
        ipcRenderer.on('deploy:success', (_, data) => callback(data));
    },
    onDeployFailed: (callback) => {
        ipcRenderer.on('deploy:failed', (_, data) => callback(data));
    },

    // System Monitor
    fetchServerStats: () => ipcRenderer.invoke('server:fetch-stats'),
    fetchRemoteLogs: (name) => ipcRenderer.invoke('server:fetch-remote-logs', name)
};

contextBridge.exposeInMainWorld('autoflow', api);
declare global {
    interface Window {
        autoflow: AutoflowApi;
    }
}

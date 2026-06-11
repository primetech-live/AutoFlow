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
    initProject: (projectPath: string, options: any) => Promise<{ success: boolean }>;
    loadEnv: (projectPath: string) => Promise<Record<string, string>>;
    saveEnv: (projectPath: string, env: Record<string, string>) => Promise<any>;

    onInitStarted: (callback: (data: any) => void) => void;
    onInitLog: (callback: (data: any) => void) => void;
    onInitSuccess: (callback: (data: any) => void) => void;
    onInitFailed: (callback: (data: any) => void) => void;

    // Deployment
    deploy: (projectPath: string) => Promise<any>;
    getHistory: (projectName: string) => Promise<any[]>;
    rollbackToDeploy: (projectPath: string, commitSha: string) => Promise<void>;
    checkInterruptedJob: () => Promise<any>;
    clearInterruptedJob: () => Promise<void>;
    
    // Deployment Listeners
    onDeployStarted: (callback: (data: { projectName: string; startTime: number }) => void) => void;
    onDeployLog: (callback: (data: { type: string; message: string }) => void) => (() => void);
    onDeploySuccess: (callback: (data: any) => void) => (() => void);
    onDeployFailed: (callback: (data: { error: string }) => void) => (() => void);

    // System Monitor & Container Controls
    fetchServerStats: () => Promise<any>;
    fetchRemoteLogs: (name: string) => Promise<string>;
    stopContainer: (name: string) => Promise<boolean>;
    restartContainer: (name: string) => Promise<boolean>;
    deleteContainer: (name: string) => Promise<boolean>;

    // Connection Manager
    getConnectionState: () => Promise<string>;
    connectToServer: () => Promise<{ success: boolean; error?: string }>;
    disconnectFromServer: () => Promise<{ success: boolean }>;
    onConnectionStateChanged: (callback: (state: string) => void) => void;

    // Dependency Installer
    checkDependencies: () => Promise<{ pkgManager: string; deps: any[] }>;
    installDependencies: (depsToInstall: string[], pkgManager: string) => Promise<{ success: boolean }>;
    onInstallerLog: (callback: (log: string) => void) => void;

    // CLI Integration
    installCli: () => Promise<{ success: boolean; message?: string; error?: string }>;
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
    initProject: (projectPath, options) => ipcRenderer.invoke('projects:init', projectPath, options),
    loadEnv: (projectPath) => ipcRenderer.invoke('projects:load-env', projectPath),
    saveEnv: (projectPath, env) => ipcRenderer.invoke('projects:save-env', projectPath, env),

    onInitStarted: (callback) => ipcRenderer.on('init:started', (_, data) => callback(data)),
    onInitLog: (callback) => ipcRenderer.on('init:log', (_, data) => callback(data)),
    onInitSuccess: (callback) => ipcRenderer.on('init:success', (_, data) => callback(data)),
    onInitFailed: (callback) => ipcRenderer.on('init:failed', (_, data) => callback(data)),

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
        const handler = (_: any, data: any) => callback(data);
        ipcRenderer.on('deploy:log', handler);
        return () => ipcRenderer.removeListener('deploy:log', handler);
    },
    onDeploySuccess: (callback) => {
        const handler = (_: any, data: any) => callback(data);
        ipcRenderer.on('deploy:success', handler);
        return () => ipcRenderer.removeListener('deploy:success', handler);
    },
    onDeployFailed: (callback) => {
        const handler = (_: any, data: any) => callback(data);
        ipcRenderer.on('deploy:failed', handler);
        return () => ipcRenderer.removeListener('deploy:failed', handler);
    },

    // System Monitor & Container Controls
    fetchServerStats: () => ipcRenderer.invoke('server:fetch-stats'),
    fetchRemoteLogs: (name) => ipcRenderer.invoke('server:fetch-remote-logs', name),
    stopContainer: (name) => ipcRenderer.invoke('monitor:stop-container', name),
    restartContainer: (name) => ipcRenderer.invoke('monitor:restart-container', name),
    deleteContainer: (name) => ipcRenderer.invoke('monitor:delete-container', name),

    // Connection Manager
    getConnectionState: () => ipcRenderer.invoke('connection:get-state'),
    connectToServer: () => ipcRenderer.invoke('connection:connect'),
    disconnectFromServer: () => ipcRenderer.invoke('connection:disconnect'),
    onConnectionStateChanged: (callback) => {
        ipcRenderer.on('connection:state-changed', (_, state) => callback(state));
    },

    // Dependency Installer
    checkDependencies: () => ipcRenderer.invoke('installer:check-dependencies'),
    installDependencies: (deps, pkgManager) => ipcRenderer.invoke('installer:install-dependencies', deps, pkgManager),
    onInstallerLog: (callback) => {
        ipcRenderer.on('installer:log', (_, log) => callback(log));
    },

    // CLI Integration
    installCli: () => ipcRenderer.invoke('install-cli')
};

contextBridge.exposeInMainWorld('autoflow', api);
declare global {
    interface Window {
        autoflow: AutoflowApi;
    }
}

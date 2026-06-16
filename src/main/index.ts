import { app, BrowserWindow, dialog, shell } from 'electron';
import path from 'path';
import fs from 'fs';
import os from 'os';
import { registerIpcHandlers } from './ipc';
import { deployerEngine } from '../core/deployer';
import { connectionManager } from '../core/connection';
import { globalConfigExists, loadGlobalConfig } from '../core/config';

let mainWindow: BrowserWindow | null = null;
const isDev = process.env.NODE_ENV === 'development' || !app.isPackaged;

function createWindow() {
    mainWindow = new BrowserWindow({
        width: 1200,
        height: 800,
        minWidth: 950,
        minHeight: 650,
        frame: false,
        backgroundColor: '#141416',
        show: false,
        webPreferences: {
            preload: path.join(__dirname, '../preload/index.js'),
            nodeIntegration: false,
            contextIsolation: true,
            sandbox: true
        }
    });

    // Register IPC channels
    registerIpcHandlers(mainWindow);

    // Prevent manual reloads in production to maintain session sync
    if (!isDev) {
        mainWindow.webContents.on('before-input-event', (event, input) => {
            const isControlOrMeta = input.control || input.meta;
            const isR = input.key.toLowerCase() === 'r';
            const isF5 = input.key === 'F5';
            if ((isControlOrMeta && isR) || isF5) {
                event.preventDefault();
            }
        });
    }

    if (isDev) {
        mainWindow.loadURL('http://localhost:5173');
        // Open DevTools in dev mode
        mainWindow.webContents.openDevTools();
    } else {
        mainWindow.loadFile(path.join(__dirname, '../../renderer/index.html'));
    }

    mainWindow.once('ready-to-show', () => {
        mainWindow?.show();
    });

    // Intercept external links and open them in the default browser
    mainWindow.webContents.setWindowOpenHandler((details) => {
        shell.openExternal(details.url);
        return { action: 'deny' };
    });

    // Intercept close event to check for active deployments
    mainWindow.on('close', (e) => {
        if (deployerEngine.hasActiveDeployments()) {
            e.preventDefault();
            const choice = dialog.showMessageBoxSync(mainWindow!, {
                type: 'warning',
                buttons: ['Cancel', 'Exit Anyway'],
                title: 'Active Deployment Running',
                message: 'A project deployment is currently running in the background.',
                detail: 'If you exit now, the logging stream will be disconnected and the deployment may remain in an unverified state on the server. Are you sure you want to exit?',
                defaultId: 0,
                cancelId: 0
            });

            if (choice === 1) {
                // Remove listener so it closes cleanly
                mainWindow?.removeAllListeners('close');
                mainWindow?.close();
            }
        }
    });

    mainWindow.on('closed', () => {
        mainWindow = null;
    });
}

app.whenReady().then(async () => {
    createWindow();

    app.on('activate', () => {
        if (BrowserWindow.getAllWindows().length === 0) {
            createWindow();
        }
    });

    // Auto-connect to server if onboarding is complete and key auth can be used directly
    if (globalConfigExists()) {
        try {
            const config = loadGlobalConfig();
            let privateKeyPath = config.sshKeyPath ? config.sshKeyPath.replace(/^"|"$/g, '') : '';
            if (privateKeyPath.startsWith('~')) {
                privateKeyPath = privateKeyPath.replace('~', os.homedir());
            }
            const usePassword = !privateKeyPath || !fs.existsSync(privateKeyPath);
            if (!usePassword) {
                await connectionManager.connect(config);
            }
        } catch (err) {
            console.error('[Main] Auto-connect failed:', err);
        }
    }
});

app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
        app.quit();
    }
});

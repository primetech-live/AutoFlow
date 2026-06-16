import { NodeSSH } from 'node-ssh';
import { GlobalConfig } from './config';
import EventEmitter from 'events';
import fs from 'fs';
import { loadVaultConfig } from '../utils/vaultService';
import { vaultEngine } from './vault';

export type ConnectionState = 'Disconnected' | 'Connecting' | 'Connected' | 'Reconnecting';

// Exponential backoff: 2s, 4s, 8s, 16s, 30s (capped)
const BACKOFF_DELAYS = [2000, 4000, 8000, 16000, 30000];

class ConnectionManager extends EventEmitter {
    private ssh: NodeSSH | null = null;
    private state: ConnectionState = 'Disconnected';
    private config: GlobalConfig | null = null;
    private reconnectTimer: NodeJS.Timeout | null = null;
    private reconnectAttempts = 0;

    // Keepalive: send a no-op command every 60s to prevent server-side idle timeout
    private keepaliveTimer: NodeJS.Timeout | null = null;
    private readonly KEEPALIVE_INTERVAL_MS = 60_000;

    constructor() {
        super();
    }

    public getState(): ConnectionState {
        return this.state;
    }

    public getSsh(): NodeSSH | null {
        return this.ssh;
    }

    private setState(newState: ConnectionState) {
        if (this.state !== newState) {
            this.state = newState;
            this.emit('state-changed', this.state);
        }
    }

    public async connect(config: GlobalConfig): Promise<void> {
        const configChanged = !this.config || 
            this.config.serverIp !== config.serverIp ||
            this.config.sshUser !== config.sshUser ||
            this.config.sshPort !== config.sshPort ||
            this.config.sshKeyPath !== config.sshKeyPath;

        if (this.state === 'Connected' && this.ssh && !configChanged) {
            return; // Already connected to the same server — reuse the session
        }

        if (configChanged && this.state !== 'Disconnected') {
            await this.disconnect();
        }

        this.config = config;
        this.reconnectAttempts = 0;
        this.setState('Connecting');

        try {
            await this._establishConnection();
            this.setState('Connected');
            this._startKeepalive();
        } catch (error: any) {
            this.setState('Disconnected');
            console.error('[ConnectionManager] Initial connection failed:', error.message);
            throw error;
        }
    }

    private async _establishConnection(): Promise<void> {
        if (!this.config) throw new Error('Cannot connect without config');

        // Dispose any stale instance
        if (this.ssh) {
            try { this.ssh.dispose(); } catch {}
            this.ssh = null;
        }

        this.ssh = new NodeSSH();
        let privateKeyPath = this.config.sshKeyPath.trim().replace(/^"|"$/g, '');
        if (privateKeyPath.startsWith('~')) {
            const os = require('os');
            privateKeyPath = privateKeyPath.replace('~', os.homedir());
        }

        const connectOptions: any = {
            host: this.config.serverIp.trim(),
            username: this.config.sshUser.trim(),
            port: Number(this.config.sshPort),
            readyTimeout: 15000,
            keepaliveInterval: 30000,
            keepaliveCountMax: 5,
        };

        let usePassword = false;
        let sshPassword = '';
        const vault = loadVaultConfig();

        if (privateKeyPath) {
            if (!fs.existsSync(privateKeyPath)) {
                usePassword = true;
                if (!(vault && vault.sshPassword && vaultEngine.isUnlocked())) {
                    throw new Error(`SSH Key file not found at path: "${privateKeyPath}". Please verify that the file exists and the path is correct.`);
                }
            } else {
                connectOptions.privateKeyPath = privateKeyPath;
            }
        } else {
            usePassword = true;
        }

        try {
            if (usePassword && !connectOptions.privateKeyPath) {
                throw new Error('Key file missing');
            }
            await this.ssh.connect(connectOptions);
        } catch (initialErr: any) {
            console.warn('[ConnectionManager] SSH Key auth failed or key missing. Falling back to password authentication.');
            
            if (vault && vault.sshPassword && vaultEngine.isUnlocked()) {
                sshPassword = vaultEngine.decrypt(vault.sshPassword);
                delete connectOptions.privateKeyPath;
                connectOptions.password = sshPassword;
                await this.ssh.connect(connectOptions);
            } else {
                throw new Error(initialErr.message === 'Key file missing' ? 
                    'SSH Key failed: Key file not found and Vault is locked or missing password. Cannot authenticate.' :
                    `SSH Key failed: ${initialErr.message || 'Authentication failed'}. Vault is locked or missing password.`);
            }
        }

        // Wire up disconnect handlers
        this.ssh.connection?.on('error', (err: any) => {
            console.warn('[ConnectionManager] SSH error:', err.message);
            this._handleUnexpectedDisconnect();
        });
        this.ssh.connection?.on('end', () => {
            console.warn('[ConnectionManager] SSH connection ended');
            this._handleUnexpectedDisconnect();
        });
        this.ssh.connection?.on('close', () => {
            console.warn('[ConnectionManager] SSH connection closed');
            this._handleUnexpectedDisconnect();
        });
    }

    /**
     * Called only on unexpected drops — NOT on intentional disconnect.
     * Implements exponential backoff reconnect.
     */
    private _handleUnexpectedDisconnect() {
        if (this.state !== 'Connected') return; // Only reconnect if we were actively connected

        this._stopKeepalive();
        this.setState('Reconnecting');

        if (this.ssh) {
            try { this.ssh.dispose(); } catch {}
            this.ssh = null;
        }

        this._scheduleReconnect();
    }

    private _scheduleReconnect() {
        if (this.reconnectTimer) clearTimeout(this.reconnectTimer);

        const delay = BACKOFF_DELAYS[Math.min(this.reconnectAttempts, BACKOFF_DELAYS.length - 1)];
        this.reconnectAttempts++;

        console.log(`[ConnectionManager] Reconnecting in ${delay / 1000}s (attempt ${this.reconnectAttempts})...`);

        this.reconnectTimer = setTimeout(async () => {
            if (!this.config) return; // Config was cleared — intentional disconnect

            try {
                await this._establishConnection();
                this.reconnectAttempts = 0;
                this.setState('Connected');
                this._startKeepalive();
                console.log('[ConnectionManager] Reconnected successfully.');
            } catch (err: any) {
                console.warn('[ConnectionManager] Reconnect attempt failed:', err.message);
                this._scheduleReconnect(); // Try again with next backoff step
            }
        }, delay);
    }

    /**
     * Intentional disconnect — only called on vault lock / factory reset / settings change.
     * Clears config so auto-reconnect does NOT trigger.
     */
    public async disconnect(): Promise<void> {
        this._stopKeepalive();
        this.config = null; // Prevents auto-reconnect
        this.reconnectAttempts = 0;

        if (this.reconnectTimer) {
            clearTimeout(this.reconnectTimer);
            this.reconnectTimer = null;
        }

        if (this.ssh) {
            try { this.ssh.dispose(); } catch {}
            this.ssh = null;
        }

        this.setState('Disconnected');
    }

    private _startKeepalive() {
        this._stopKeepalive();
        this.keepaliveTimer = setInterval(async () => {
            if (this.state !== 'Connected' || !this.ssh) return;
            try {
                // Lightweight no-op to keep the channel alive
                await this.ssh.execCommand('true');
            } catch {
                // If this fails the connection error handler will trigger reconnect
            }
        }, this.KEEPALIVE_INTERVAL_MS);
    }

    private _stopKeepalive() {
        if (this.keepaliveTimer) {
            clearInterval(this.keepaliveTimer);
            this.keepaliveTimer = null;
        }
    }

    public async execCommand(command: string): Promise<{ stdout: string; stderr: string; code: number | null }> {
        if (!this.ssh || this.state !== 'Connected') {
            throw new Error('SSH is not connected');
        }
        return this.ssh.execCommand(command);
    }

    public async safeRun(command: string): Promise<string | null> {
        try {
            const result = await this.execCommand(command);
            if (result.code === 0) return result.stdout;
            return null;
        } catch {
            return null;
        }
    }
}

export const connectionManager = new ConnectionManager();

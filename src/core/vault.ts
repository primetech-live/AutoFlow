import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import os from 'os';
import speakeasy from 'speakeasy';
import { EventEmitter } from 'events';

const VAULT_PATH = path.join(os.homedir(), '.autoflow', 'vault.json');
const ALGORITHM = 'aes-256-gcm';
const IDLE_TIMEOUT_MS = 15 * 60 * 1000; // 15 minutes

export interface VaultConfig {
    passwordHash: string;
    totpSecret: string;
    salt: string;
}

export class VaultEngine extends EventEmitter {
    private sessionPassword: string | null = null;
    private lastActivityTimestamp: number = 0;
    private idleTimer: NodeJS.Timeout | null = null;

    constructor() {
        super();
        this.resetActivity();
    }

    /**
     * Resets the idle timeout activity timer
     */
    public resetActivity() {
        this.lastActivityTimestamp = Date.now();
        if (this.idleTimer) {
            clearTimeout(this.idleTimer);
        }
        
        // Only set timer if session is unlocked
        if (this.sessionPassword) {
            this.idleTimer = setTimeout(() => {
                this.lock();
            }, IDLE_TIMEOUT_MS);
        }
    }

    /**
     * Locks the vault immediately, clearing session secrets
     */
    public lock() {
        this.sessionPassword = null;
        if (this.idleTimer) {
            clearTimeout(this.idleTimer);
            this.idleTimer = null;
        }
        console.log('[Vault] Vault session locked due to manual trigger or idle timeout.');
        this.emit('lock-state-change', true);
    }

    /**
     * Checks if the session is currently unlocked
     */
    public isUnlocked(): boolean {
        if (!this.sessionPassword) return false;
        
        // Backup validation for idle timeout check
        if (Date.now() - this.lastActivityTimestamp > IDLE_TIMEOUT_MS) {
            this.lock();
            return false;
        }
        return true;
    }

    /**
     * Returns the active session password if unlocked
     */
    public getSessionPassword(): string | null {
        if (!this.isUnlocked()) return null;
        return this.sessionPassword;
    }

    /**
     * Attempts to unlock the vault session
     */
    public unlock(password: string, otpToken: string): boolean {
        const vault = this.loadVaultConfig();
        if (!vault) {
            throw new Error('Vault has not been set up yet. Run onboarding first.');
        }

        // Verify password
        const hashed = this.hashPassword(password, vault.salt);
        if (hashed !== vault.passwordHash) {
            return false;
        }

        // Verify OTP
        const verified = speakeasy.totp.verify({
            secret: vault.totpSecret,
            encoding: 'base32',
            token: otpToken,
            window: 1 // 30s clock drift tolerance
        });

        if (verified) {
            this.sessionPassword = password;
            this.resetActivity();
            this.emit('lock-state-change', false);
            return true;
        }

        return false;
    }

    /**
     * Sets up a new vault configuration
     */
    public setupVault(password: string, totpSecret: string): void {
        const salt = crypto.randomBytes(16).toString('hex');
        const passwordHash = this.hashPassword(password, salt);

        const config: VaultConfig = {
            passwordHash,
            totpSecret,
            salt
        };

        const dir = path.dirname(VAULT_PATH);
        if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true });
        }

        fs.writeFileSync(VAULT_PATH, JSON.stringify(config), { mode: 0o600 });
        this.sessionPassword = password;
        this.resetActivity();
        this.emit('lock-state-change', false);
    }

    /**
     * Encrypts text using the session password
     */
    public encrypt(text: string): string {
        this.resetActivity();
        if (!this.sessionPassword) {
            throw new Error('Vault is locked. Unlock session first.');
        }

        const vault = this.loadVaultConfig();
        if (!vault) throw new Error('Vault configuration missing.');

        const key = crypto.scryptSync(this.sessionPassword, vault.salt, 32);
        const iv = crypto.randomBytes(16);
        const cipher = crypto.createCipheriv(ALGORITHM, key, iv);

        let encrypted = cipher.update(text, 'utf8', 'hex');
        encrypted += cipher.final('hex');
        const authTag = cipher.getAuthTag().toString('hex');

        return `${iv.toString('hex')}:${authTag}:${encrypted}`;
    }

    /**
     * Decrypts text using the session password
     */
    public decrypt(encryptedData: string): string {
        this.resetActivity();
        if (!this.sessionPassword) {
            throw new Error('Vault is locked. Unlock session first.');
        }

        const vault = this.loadVaultConfig();
        if (!vault) throw new Error('Vault configuration missing.');

        const [ivHex, authTagHex, encryptedText] = encryptedData.split(':');
        const key = crypto.scryptSync(this.sessionPassword, vault.salt, 32);
        const iv = Buffer.from(ivHex, 'hex');
        const authTag = Buffer.from(authTagHex, 'hex');
        const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);

        decipher.setAuthTag(authTag);
        let decrypted = decipher.update(encryptedText, 'hex', 'utf8');
        decrypted += decipher.final('utf8');

        return decrypted;
    }

    public deleteVault(): void {
        this.lock();
        if (fs.existsSync(VAULT_PATH)) {
            fs.unlinkSync(VAULT_PATH);
        }
    }

    private loadVaultConfig(): VaultConfig | null {
        if (!fs.existsSync(VAULT_PATH)) return null;
        return JSON.parse(fs.readFileSync(VAULT_PATH, 'utf-8'));
    }

    private hashPassword(password: string, salt: string): string {
        return crypto.pbkdf2Sync(password, salt, 100000, 64, 'sha512').toString('hex');
    }
}

// Export single shared instance for main process lifecycle
export const vaultEngine = new VaultEngine();

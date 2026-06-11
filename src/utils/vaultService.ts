import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import os from 'os';
import speakeasy from 'speakeasy';

const VAULT_PATH = path.join(os.homedir(), '.autoflow', 'vault.json');
const ALGORITHM = 'aes-256-gcm';

export interface VaultConfig {
    passwordHash: string;
    totpSecret: string;
    salt: string;
    sshPassword?: string;
    projectTokens?: Record<string, string>;
}

/**
 * Saves vault configuration securely
 */
export function saveVaultConfig(config: VaultConfig): void {
    const dir = path.dirname(VAULT_PATH);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(VAULT_PATH, JSON.stringify(config), { mode: 0o600 });
}

/**
 * Loads vault configuration
 */
export function loadVaultConfig(): VaultConfig | null {
    if (!fs.existsSync(VAULT_PATH)) return null;
    return JSON.parse(fs.readFileSync(VAULT_PATH, 'utf-8'));
}

/**
 * Hashes password using PBKDF2
 */
export function hashPassword(password: string, salt: string): string {
    return crypto.pbkdf2Sync(password, salt, 100000, 64, 'sha512').toString('hex');
}

/**
 * Verifies TOTP code
 */
export function verifyOTP(token: string, secret: string): boolean {
    return speakeasy.totp.verify({
        secret,
        encoding: 'base32',
        token,
        window: 1 // Allow 30s clock drift
    });
}

/**
 * Encrypts a string (e.g., .env content) using AES-256-GCM
 */
export function encrypt(text: string, password: string, salt: string): string {
    const key = crypto.scryptSync(password, salt, 32);
    const iv = crypto.randomBytes(16);
    const cipher = crypto.createCipheriv(ALGORITHM, key, iv);

    let encrypted = cipher.update(text, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    const authTag = cipher.getAuthTag().toString('hex');

    // Return IV + AuthTag + EncryptedData
    return `${iv.toString('hex')}:${authTag}:${encrypted}`;
}

/**
 * Decrypts a string using AES-256-GCM
 */
export function decrypt(encryptedData: string, password: string, salt: string): string {
    const [ivHex, authTagHex, encryptedText] = encryptedData.split(':');
    const key = crypto.scryptSync(password, salt, 32);
    const iv = Buffer.from(ivHex, 'hex');
    const authTag = Buffer.from(authTagHex, 'hex');
    const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);

    decipher.setAuthTag(authTag);
    let decrypted = decipher.update(encryptedText, 'hex', 'utf8');
    decrypted += decipher.final('utf8');

    return decrypted;
}

/**
 * Deletes the vault configuration (Reset)
 */
export function deleteVault(): void {
    if (fs.existsSync(VAULT_PATH)) {
        fs.unlinkSync(VAULT_PATH);
    }
}


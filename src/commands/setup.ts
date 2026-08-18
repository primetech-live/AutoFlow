import fs from 'fs';
import os from 'os';
import path from 'path';
import crypto from 'crypto';
import speakeasy from 'speakeasy';
import qrcode from 'qrcode-terminal';
import log from '../utils/logger';
import { saveGlobalConfig, GlobalConfig } from '../core/config';
import { saveVaultConfig, hashPassword, loadVaultConfig, encryptWithPassword, decryptWithPassword, deleteVault, verifyOTP } from '../core/vault';
import { promptConsole } from '../utils/console';

async function setup(): Promise<void> {
    log.header('AUTOFLOW GLOBAL CONFIGURATION');

    const configDir = path.join(os.homedir(), '.autoflow');
    const configPath = path.join(configDir, 'config.json');

    let existingConfig: Partial<GlobalConfig> = {};
    if (fs.existsSync(configPath)) {
        try {
            existingConfig = JSON.parse(fs.readFileSync(configPath, 'utf-8')) as GlobalConfig;
            log.info('Existing configuration found. Press Enter to keep current values.');
        } catch {
            // ignore parse errors
        }
    }

    const serverIpInput = await promptConsole(`? Server Public IP${existingConfig.serverIp ? ` (${existingConfig.serverIp})` : ''}: `);
    const serverIp = serverIpInput || existingConfig.serverIp || '';

    const sshUserInput = await promptConsole(`? SSH Username (${existingConfig.sshUser || 'ubuntu'}): `);
    const sshUser = sshUserInput || existingConfig.sshUser || 'ubuntu';

    const sshPortInput = await promptConsole(`? SSH Port (${existingConfig.sshPort || '22'}): `);
    const sshPort = sshPortInput || existingConfig.sshPort || '22';

    const defaultKeyPath = existingConfig.sshKeyPath || path.join(os.homedir(), '.ssh', 'id_rsa');
    const sshKeyPathInput = await promptConsole(`? Absolute Path to Private SSH Key (${defaultKeyPath}): `);
    const sshKeyPath = sshKeyPathInput || defaultKeyPath;

    const defaultWorkspace = existingConfig.workspacePath || path.resolve(process.cwd(), '..');
    const workspacePathInput = await promptConsole(`? Workspace Directory Path (${defaultWorkspace}): `);
    const workspacePath = workspacePathInput || defaultWorkspace;

    const answers: GlobalConfig = {
        serverIp,
        sshUser,
        sshPort,
        sshKeyPath,
        workspacePath
    };

    saveGlobalConfig(answers);

    log.success('Global configuration saved securely 🔒');

    // ── Z+ Security Vault Setup (Part of Global Setup) ─────────────────
    log.header('Z+ SECURITY VAULT SETUP');
    const existingVault = loadVaultConfig();

    if (existingVault) {
        const actionInput = await promptConsole('? Z+ Security Vault exists. [K]eep, [C]hange Password, [R]eset: ');
        const choice = actionInput.toLowerCase();

        if (choice.startsWith('c')) {
            const currentPassword = await promptConsole('? Enter Current Master Password: ', true);
            const token = await promptConsole('? Confirm identity with 6-digit OTP: ');

            let decryptedSecret = '';
            try {
                decryptedSecret = decryptWithPassword(existingVault.totpSecret, currentPassword);
                const verified = verifyOTP(token, decryptedSecret);
                if (!verified) throw new Error('Invalid OTP');
            } catch (err) {
                log.error('✘ Verification failed. Invalid password or OTP.');
                return;
            }

            const newPassword = await promptConsole('? Enter New Master Password: ', true);

            const salt = crypto.randomBytes(16).toString('hex');
            const encryptedSecret = encryptWithPassword(decryptedSecret, newPassword);
            saveVaultConfig({
                ...existingVault,
                passwordHash: hashPassword(newPassword, salt),
                totpSecret: encryptedSecret,
                salt: salt
            });
            log.success('✔ Master password updated successfully!');
            return;
        }

        if (choice.startsWith('r')) {
            const confirmInput = await promptConsole('? Are you sure? This will delete master password and OTP secret (y/N): ');
            if (confirmInput.toLowerCase().startsWith('y')) {
                deleteVault();
                log.info('Vault deleted. Starting fresh setup...');
            } else {
                return;
            }
        }
    }

    const setupVaultInput = await promptConsole('? Enable Z+ Security (Military-Grade Encryption + OTP)? (Y/n): ');
    const setupVault = !setupVaultInput || setupVaultInput.toLowerCase().startsWith('y');

    if (setupVault) {
        const password = await promptConsole('? Set a Master Deployment Password: ', true);

        log.info('Generating TOTP Secret...');
        const secret = speakeasy.generateSecret({
            name: `AutoFlow (${os.hostname()})`
        });

        log.info('\nScan this QR code with Google Authenticator or Authy:\n');
        qrcode.generate(secret.otpauth_url || '', { small: true });

        const token = await promptConsole('? Enter the 6-digit code to verify: ');

        const verified = speakeasy.totp.verify({
            secret: secret.base32,
            encoding: 'base32',
            token
        });

        if (verified) {
            const salt = crypto.randomBytes(16).toString('hex');
            const encryptedSecret = encryptWithPassword(secret.base32, password);
            saveVaultConfig({
                passwordHash: hashPassword(password, salt),
                totpSecret: encryptedSecret,
                salt: salt
            });
            log.success('✔ Z+ Security Vault established!');
        } else {
            log.error('✘ Verification failed. You can re-run "setup" to try again.');
        }
    }

    log.info(`\nLocation: ${configPath}`);
    log.info('You can now run "autoflow init" in any project.');
}

export default setup;

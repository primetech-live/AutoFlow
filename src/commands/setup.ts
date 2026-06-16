import inquirer from 'inquirer';
import fs from 'fs';
import os from 'os';
import path from 'path';
import crypto from 'crypto';
import speakeasy from 'speakeasy';
import qrcode from 'qrcode-terminal';
import log from '../utils/logger';
import { saveGlobalConfig, GlobalConfig } from '../core/config';
import { saveVaultConfig, hashPassword, loadVaultConfig, encryptWithPassword, decryptWithPassword, deleteVault, verifyOTP } from '../core/vault';

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

    const answers = await inquirer.prompt<GlobalConfig>([
        {
            type: 'input',
            name: 'serverIp',
            message: 'Server Public IP:',
            default: existingConfig.serverIp,
            validate: (val: string) => val ? true : 'Server IP is required',
        },
        {
            type: 'input',
            name: 'sshUser',
            message: 'SSH Username:',
            default: existingConfig.sshUser || 'ubuntu',
        },
        {
            type: 'input',
            name: 'sshPort',
            message: 'SSH Port:',
            default: existingConfig.sshPort || '22',
        },
        {
            type: 'input',
            name: 'sshKeyPath',
            message: 'Absolute Path to Private SSH Key:',
            default: existingConfig.sshKeyPath || path.join(os.homedir(), '.ssh', 'id_rsa'),
            validate: (val: string) =>
                fs.existsSync(val) ? true : `File not found at: ${val}`,
        },
        {
            type: 'input',
            name: 'workspacePath',
            message: 'Workspace Directory Path:',
            default: existingConfig.workspacePath || path.resolve(process.cwd(), '..'),
        },
    ]);

    saveGlobalConfig(answers);

    log.success('Global configuration saved securely 🔒');

    // ── Z+ Security Vault Setup (Part of Global Setup) ─────────────────
    log.header('Z+ SECURITY VAULT SETUP');
    const existingVault = loadVaultConfig();

    if (existingVault) {
        const { vaultAction } = await inquirer.prompt([{
            type: 'list',
            name: 'vaultAction',
            message: 'Z+ Security Vault already exists. What would you like to do?',
            choices: [
                { name: 'Keep current vault settings', value: 'keep' },
                { name: 'Change Master Password (requires current OTP)', value: 'change_password' },
                { name: 'Full Reset (Destructive - deletes everything)', value: 'reset' }
            ]
        }]);

        if (vaultAction === 'keep') {
            log.info('✔ Vault kept as is.');
            log.info(`\nLocation: ${configPath}`);
            log.info('You can now run "autoflow init" in any project.');
            return;
        }

        if (vaultAction === 'change_password') {
            const { currentPassword } = await inquirer.prompt([{
                type: 'password',
                name: 'currentPassword',
                message: 'Enter Current Master Password:',
                mask: '*'
            }]);

            const { token } = await inquirer.prompt([{
                type: 'input',
                name: 'token',
                message: 'Confirm identity with 6-digit OTP:',
            }]);

            let decryptedSecret = '';
            try {
                decryptedSecret = decryptWithPassword(existingVault.totpSecret, currentPassword);
                const verified = verifyOTP(token, decryptedSecret);
                if (!verified) throw new Error('Invalid OTP');
            } catch (err) {
                log.error('✘ Verification failed. Invalid password or OTP.');
                return;
            }

            const { newPassword } = await inquirer.prompt([{
                type: 'password',
                name: 'newPassword',
                message: 'Enter New Master Password:',
                mask: '*'
            }]);

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

        if (vaultAction === 'reset') {
            const { confirmReset } = await inquirer.prompt([{
                type: 'confirm',
                name: 'confirmReset',
                message: 'Are you sure? This will delete your master password and OTP secret.',
                default: false
            }]);
            if (confirmReset) {
                // deleteVault is already imported from ../core/vault
                deleteVault();
                log.info('Vault deleted. Starting fresh setup...');
            } else {
                return;
            }
        }
    }

    const { setupVault } = await inquirer.prompt([{
        type: 'confirm',
        name: 'setupVault',
        message: 'Enable Z+ Security (Military-Grade Encryption + OTP)?',
        default: true
    }]);

    if (setupVault) {
        const { password } = await inquirer.prompt([{
            type: 'password',
            name: 'password',
            message: 'Set a Master Deployment Password:',
            mask: '*'
        }]);

        log.info('Generating TOTP Secret...');
        const secret = speakeasy.generateSecret({
            name: `AutoFlow (${os.hostname()})`
        });

        log.info('\nScan this QR code with Google Authenticator or Authy:\n');
        qrcode.generate(secret.otpauth_url || '', { small: true });

        const { token } = await inquirer.prompt([{
            type: 'input',
            name: 'token',
            message: 'Enter the 6-digit code to verify:',
        }]);

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

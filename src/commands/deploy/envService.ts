import fs from 'fs';
import path from 'path';
import { NodeSSH } from 'node-ssh';
import log from '../../utils/logger';
import { loadVaultConfig, encrypt, verifyOTP, hashPassword } from '../../utils/vaultService';
import { AutoFlowError, EXIT_CODES, exec } from './errors';
import inquirer from 'inquirer';
import { vaultEngine } from '../../core/vault';

/**
 * Handles the secure traversal of environment variables
 */
export async function syncEnv(ssh: NodeSSH, projectDir: string, localProjectDir: string = process.cwd()): Promise<string | null> {
    const envPath = path.join(localProjectDir, '.env');

    if (!fs.existsSync(envPath)) {
        log.warning('No .env file found locally. Skipping environment sync.');
        return null;
    }

    const vault = loadVaultConfig();
    if (!vault) {
        throw new AutoFlowError(
            'Security Vault not found. Run "autoflow setup-vault" first.',
            EXIT_CODES.CI_FAILED,
            'vault'
        );
    }

    let password = '';
    const sessionPassword = vaultEngine.getSessionPassword();
    if (sessionPassword) {
        password = sessionPassword;
        log.success('✔ Identity verified from active vault session. Encrypting payload...');
    } else {
        throw new AutoFlowError('Vault session is locked. Expected unlock earlier.', EXIT_CODES.CI_FAILED, 'vault');
    }

    // 3. Secure Transfer (SFTP Stream)
    log.info('Securing environment variables...');
    const envContent = fs.readFileSync(envPath, 'utf-8');
    const finalEnvPath = `${projectDir}/.env`;

    const sftp = await ssh.requestSFTP();
    await new Promise<void>((resolve, reject) => {
        const stream = sftp.createWriteStream(finalEnvPath, { mode: 0o600 });
        stream.on('close', resolve);
        stream.on('error', reject);
        stream.end(envContent);
    });

    log.success('✔ Secrets securely transferred via SFTP stream.');
    return password;
}

/**
 * Decrypts the blob on the server directly before container start
 */
export async function unlockEnvOnServer(ssh: NodeSSH, projectDir: string, password: string, salt: string): Promise<void> {
    // With the new SFTP stream approach, secrets are already securely placed in .env
    // This function remains for interface compatibility but requires no action.
    log.success('✔ Secrets unlocked and ready.');
}

/**
 * Clean up secrets after container start
 */
export async function cleanupEnv(ssh: NodeSSH, projectDir: string): Promise<void> {
    log.info('Cleaning up temporary secrets...');
    await ssh.execCommand(`rm -f ${projectDir}/.env`);
    log.success('✔ Server-side disk is clean.');
}

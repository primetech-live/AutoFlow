import { NodeSSH } from 'node-ssh';
import log from '../../utils/logger';
import { GlobalConfig } from '../../utils/config';
import { AutoFlowError, EXIT_CODES, registerCleanupHandlers } from './errors';

import { connectionManager } from '../../core/connection';
import fs from 'fs';
import os from 'os';
import inquirer from 'inquirer';
import { loadVaultConfig, saveVaultConfig } from '../../utils/vaultService';
import { vaultEngine } from '../../core/vault';

export async function connectSSH(config: GlobalConfig, isDesktop: boolean = false): Promise<NodeSSH> {
    if (isDesktop) {
        log.info(`Using persistent connection to ${config.serverIp}...`);
        await connectionManager.connect(config);
        const ssh = connectionManager.getSsh();
        if (!ssh) throw new Error('Persistent SSH connection could not be retrieved');
        return ssh;
    }

    const ssh = new NodeSSH();

    log.info(`Connecting to ${config.serverIp} via SSH...`);

    try {
        let privateKeyPath = config.sshKeyPath.replace(/^"|"$/g, '');
        if (privateKeyPath.startsWith('~')) {
            privateKeyPath = privateKeyPath.replace('~', os.homedir());
        }

        const connectOptions: any = {
            host: config.serverIp,
            username: config.sshUser,
            port: Number(config.sshPort),
        };

        let usePassword = false;
        let sshPassword = '';
        const vault = loadVaultConfig();

        if (!fs.existsSync(privateKeyPath)) {
            usePassword = true;
        } else {
            connectOptions.privateKeyPath = privateKeyPath;
        }

        // Attempt connection with Key first, fallback to Password
        try {
            if (usePassword) throw new Error('Key not found');
            await ssh.connect(connectOptions);
        } catch (initialErr) {
            log.warning(`SSH Key auth failed or key missing. Falling back to password authentication.`);
            
            if (vault && vault.sshPassword && vaultEngine.isUnlocked()) {
                sshPassword = vaultEngine.decrypt(vault.sshPassword);
            } else if (!isDesktop) {
                const { sshPwd } = await inquirer.prompt([{
                    type: 'password',
                    name: 'sshPwd',
                    message: `Enter SSH Password for ${config.sshUser}@${config.serverIp}:`,
                    mask: '*'
                }]);
                sshPassword = sshPwd;

                if (vault && vaultEngine.isUnlocked()) {
                    vault.sshPassword = vaultEngine.encrypt(sshPassword);
                    saveVaultConfig(vault);
                }
            } else {
                throw new AutoFlowError('SSH Key failed and Vault is locked. Cannot authenticate.', EXIT_CODES.SSH_CONNECT_FAILED, 'sshService');
            }

            delete connectOptions.privateKeyPath;
            connectOptions.password = sshPassword;
            await ssh.connect(connectOptions);
        }

        log.success('SSH connected ✔');

        // Register Ctrl+C / SIGTERM cleanup so terminal is never left hanging
        registerCleanupHandlers(ssh);

        return ssh;
    } catch (err: unknown) {
        const message = err instanceof Error ? err.message : String(err);
        throw new AutoFlowError(
            `SSH connection failed: ${message}`,
            EXIT_CODES.SSH_CONNECT_FAILED,
            'sshService'
        );
    }
}

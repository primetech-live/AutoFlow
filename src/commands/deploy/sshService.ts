import { NodeSSH } from 'node-ssh';
import log from '../../utils/logger';
import { GlobalConfig } from '../../utils/config';
import { AutoFlowError, EXIT_CODES, registerCleanupHandlers } from './errors';

import { connectionManager } from '../../core/connection';

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
        await ssh.connect({
            host: config.serverIp,
            username: config.sshUser,
            port: Number(config.sshPort),
            privateKeyPath: config.sshKeyPath.replace(/^"|"$/g, ''),
        });

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

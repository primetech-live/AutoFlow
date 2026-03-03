import { NodeSSH } from 'node-ssh';
import log from '../../utils/logger';
import { AutoFlowError, EXIT_CODES } from './errors';

const ROLLBACK_SUFFIX = '_rollback';

export async function backupContainer(ssh: NodeSSH, containerName: string): Promise<void> {
    log.info(`Creating rollback snapshot of "${containerName}"...`);

    const checkRunning = await ssh.execCommand(
        `docker ps --filter "name=^/${containerName}$" --format "{{.Names}}"`
    );

    if (!checkRunning.stdout.trim()) {
        log.info('No running container to backup. Fresh deploy.');
        return;
    }

    const rollbackName = `${containerName}${ROLLBACK_SUFFIX}`;

    // Remove any old rollback container first
    await ssh.execCommand(`docker rm -f ${rollbackName} || true`);

    // Rename current container to the rollback slot
    await ssh.execCommand(`docker rename ${containerName} ${rollbackName}`);
    await ssh.execCommand(`docker stop ${rollbackName} || true`);

    log.success(`Rollback snapshot ready: "${rollbackName}" ✔`);
}

export async function confirmDeploy(ssh: NodeSSH, containerName: string): Promise<void> {
    log.info('Confirming deployment success...');

    const rollbackName = `${containerName}${ROLLBACK_SUFFIX}`;

    // Remove the rollback container — deployment was successful
    await ssh.execCommand(`docker rm -f ${rollbackName} || true`);
    log.success('Rollback snapshot removed. Deployment confirmed ✔');
}

export async function triggerRollback(ssh: NodeSSH, containerName: string): Promise<void> {
    const rollbackName = `${containerName}${ROLLBACK_SUFFIX}`;

    log.warning('⚠️  Deployment failed. Initiating rollback...');

    // Check if we have a rollback to restore
    const hasRollback = await ssh.execCommand(
        `docker ps -a --filter "name=^/${rollbackName}$" --format "{{.Names}}"`
    );

    if (!hasRollback.stdout.trim()) {
        throw new AutoFlowError(
            'No rollback snapshot available. Manual intervention required.',
            EXIT_CODES.ROLLBACK_FAILED,
            'rollbackService'
        );
    }

    // Stop and remove new (broken) container
    await ssh.execCommand(`docker rm -f ${containerName} || true`);

    // Rename rollback to the original name and restart it
    await ssh.execCommand(`docker rename ${rollbackName} ${containerName}`);
    await ssh.execCommand(`docker start ${containerName}`);

    // Verify rollback container is running
    await new Promise((resolve) => setTimeout(resolve, 3000));
    const ps = await ssh.execCommand(
        `docker ps --filter "name=^/${containerName}$" --format "{{.Status}}"`
    );

    if (ps.stdout.includes('Up')) {
        log.success(`Rollback complete! Previous version of "${containerName}" is live ✔`);
    } else {
        throw new AutoFlowError(
            `Rollback started but "${containerName}" is still not running. Manual intervention required.`,
            EXIT_CODES.ROLLBACK_FAILED,
            'rollbackService'
        );
    }
}

import { NodeSSH } from 'node-ssh';
import chalk from 'chalk';
import log from '../../utils/logger';
import { exec, AutoFlowError, EXIT_CODES } from './errors';

export async function startContainer(
    ssh: NodeSSH,
    containerName: string,
    imageName: string,
    hostPort: string,
    containerPort: number,
    useDomain: boolean
): Promise<void> {
    // Stop and remove old container if running
    await ssh.execCommand(`docker rm -f ${containerName} || true`);

    const portBinding = useDomain
        ? `-p 127.0.0.1:${hostPort}:${containerPort}`
        : `-p ${hostPort}:${containerPort}`;

    log.info(`Port mapping: Host:${hostPort} → Container:${containerPort}`);
    log.info('Starting container...');

    await exec(ssh, `
docker run -d \\
  --restart unless-stopped \\
  ${portBinding} \\
  --name ${containerName} \\
  ${imageName}
`);
}

export async function verifyContainerHealth(
    ssh: NodeSSH,
    containerName: string
): Promise<void> {
    log.info('Verifying container health...');

    // Wait a moment for the container to initialize
    await new Promise((resolve) => setTimeout(resolve, 3000));

    const ps = await ssh.execCommand(
        `docker ps --filter "name=${containerName}" --format "{{.Status}}"`
    );

    if (!ps.stdout || !ps.stdout.includes('Up')) {
        const logs = await ssh.execCommand(`docker logs --tail 25 ${containerName}`);
        console.log(chalk.red('\n=== CONTAINER LOGS (last 25 lines) ==='));
        console.log(chalk.red(logs.stdout || logs.stderr));
        console.log(chalk.red('======================================\n'));

        throw new AutoFlowError(
            `Container "${containerName}" failed to start or exited immediately.`,
            EXIT_CODES.CONTAINER_FAILED,
            'containerService'
        );
    }

    log.success(`Container "${containerName}" is running ✔`);
}

import { NodeSSH } from 'node-ssh';
import chalk from 'chalk';
import log from '../../utils/logger';
import { exec, AutoFlowError, EXIT_CODES } from './errors';

export async function startContainer(
    ssh: NodeSSH,
    projectDir: string,
    containerName: string,
    imageName: string,
    hostPort: string,
    containerPort: number,
    useDomain: boolean,
    hasEnv: boolean = false,
    volumes: string[] = []
): Promise<void> {
    // Stop and remove old container if running
    await ssh.execCommand(`docker rm -f ${containerName} || true`);

    const portBinding = useDomain
        ? `-p 127.0.0.1:${hostPort}:${containerPort}`
        : `-p ${hostPort}:${containerPort}`;

    const envLine = hasEnv ? '--env-file .env' : '';

    // Prepare volume bindings
    let volumeBinding = '';
    if (volumes && volumes.length > 0) {
        log.info('Preparing persistent volumes...');
        for (const vol of volumes) {
            // vol format expected: "hostPath:containerPath" or just "containerPath"
            // If just containerPath, we map it to projectDir/data/containerPath
            let [host, container] = vol.includes(':') ? vol.split(':') : [null, vol];
            
            if (!host) {
                // Default to a 'data' directory in project root if not specified
                const safeDir = container.replace(/^\//, '').replace(/\//g, '_');
                host = `${projectDir}/data/${safeDir}`;
            }

            // Ensure host directory exists
            await ssh.execCommand(`mkdir -p ${host}`);
            volumeBinding += `-v ${host}:${container} `;
        }
    }

    log.info(`Port mapping: Host:${hostPort} → Container:${containerPort}`);
    if (hasEnv) {
        log.info('Starting container with Z+ environment injection...');
    } else {
        log.info('Starting container...');
    }

    const runCmd = [
        'docker run -d',
        '--restart unless-stopped',
        portBinding,
        volumeBinding.trim(),
        `--name ${containerName}`,
        envLine,
        imageName
    ].filter(Boolean).join(' ');

    await exec(ssh, `cd ${projectDir} && ${runCmd}`);
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

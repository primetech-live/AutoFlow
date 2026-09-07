import { NodeSSH } from 'node-ssh';
import chalk from 'chalk';
import log from '../../utils/logger';
import { exec, AutoFlowError, EXIT_CODES } from './errors';
import { escapeShellArg } from '../../utils/shell';

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
    await ssh.execCommand(`docker rm -f ${escapeShellArg(containerName)} || true`);

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
            await ssh.execCommand(`mkdir -p ${escapeShellArg(host)}`);
            volumeBinding += `-v ${escapeShellArg(host)}:${escapeShellArg(container)} `;
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
        `--name ${escapeShellArg(containerName)}`,
        envLine,
        escapeShellArg(imageName)
    ].filter(Boolean).join(' ');

    await exec(ssh, `cd ${escapeShellArg(projectDir)} && ${runCmd}`);
}

/**
 * Probes container HTTP response on localhost mapped port.
 * Ponytail: reuses curl probe pattern from status.ts:74-78.
 * Rejects 5xx and 000/empty (unreachable); allows 2xx, 3xx, 401, 403, 404 to avoid false rollbacks.
 */
export async function probeContainerHttp(
    ssh: NodeSSH,
    containerName: string,
    hostPort?: string
): Promise<{ healthy: boolean; code: string }> {
    let mappedPort = hostPort || '';
    if (!mappedPort) {
        const safeContainer = escapeShellArg(containerName);
        const portCmd = await ssh.execCommand(`docker port ${safeContainer}`);
        if (portCmd.stdout) {
            const match = portCmd.stdout.match(/0\.0\.0\.0:(\d+)/) || portCmd.stdout.match(/127\.0\.0\.1:(\d+)/);
            if (match && match[1]) {
                mappedPort = match[1];
            }
        }
    }

    if (!mappedPort) {
        // If container exposes no host port (e.g. pure worker, domain-free, or test mock), fallback to docker status
        return { healthy: true, code: 'N/A' };
    }

    const health = await ssh.execCommand(
        `curl -I -s -o /dev/null -w "%{http_code}" --connect-timeout 3 http://127.0.0.1:${mappedPort} || true`
    );
    const httpCode = (health.stdout || '').trim();

    // 000 = curl failed to connect, 5xx = server error
    if (!httpCode || httpCode === '000' || httpCode.startsWith('5')) {
        return { healthy: false, code: httpCode || '000' };
    }

    return { healthy: true, code: httpCode };
}

export async function verifyContainerHealth(
    ssh: NodeSSH,
    containerName: string,
    hostPort?: string
): Promise<void> {
    log.info('Verifying container health...');

    let isHealthy = false;
    let attempts = 0;
    const maxAttempts = 5;
    const intervalMs = 2000;
    let lastProbeResult = { healthy: false, code: '' };

    while (attempts < maxAttempts) {
        attempts++;
        const ps = await ssh.execCommand(
            `docker ps --filter ${escapeShellArg(`name=^/${containerName}$`)} --format "{{.Status}}"`
        );

        // Must be Up and not reported as (unhealthy) by Docker's internal HEALTHCHECK
        const status = ps.stdout || '';
        if (status.includes('Up') && !status.includes('(unhealthy)')) {
            // Ponytail: Run HTTP check if port is available
            if (hostPort) {
                const probe = await probeContainerHttp(ssh, containerName, hostPort);
                lastProbeResult = probe;
                if (probe.healthy) {
                    isHealthy = true;
                    break;
                }
            } else {
                isHealthy = true;
                break;
            }
        }

        if (attempts < maxAttempts) {
            log.info(`  ... Container initializing (HTTP ${lastProbeResult.code || 'waiting'}), retrying (${attempts}/${maxAttempts})...`);
            await new Promise((resolve) => setTimeout(resolve, intervalMs));
        }
    }

    if (!isHealthy) {
        const logs = await ssh.execCommand(`docker logs --tail 25 ${escapeShellArg(containerName)}`);
        log.error('\n=== CONTAINER LOGS (last 25 lines) ===');
        log.error(logs.stdout || logs.stderr);
        log.error('======================================\n');

        throw new AutoFlowError(
            `Container "${containerName}" failed to start or exited immediately (health check failed, HTTP status: ${lastProbeResult.code || 'Down'}).`,
            EXIT_CODES.CONTAINER_FAILED,
            'containerService'
        );
    }

    log.success(`Container "${containerName}" is healthy (HTTP ${lastProbeResult.code}) ✔`);
}

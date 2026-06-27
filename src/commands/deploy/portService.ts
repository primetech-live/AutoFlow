import { NodeSSH } from 'node-ssh';
import log from '../../utils/logger';
import { AutoFlowError, EXIT_CODES } from './errors';
import { escapeShellArg } from '../../utils/shell';

export async function allocatePort(ssh: NodeSSH, containerName: string): Promise<string> {

    // 1. Try to reuse existing port if container is already running (creates downtime)
    const currentMapping = await ssh.execCommand(
        `docker ps --filter ${escapeShellArg(`name=^/${containerName}$`)} --format "{{.Ports}}"`
    );

    if (currentMapping.stdout) {
        const match = currentMapping.stdout.match(/:(\d+)->/);
        if (match && match[1]) {
            log.info(`Reusing existing port: ${match[1]} (causes brief downtime)`);
            return match[1];
        }
    }

    // 2. Find a new free port in range 3000–4000
    log.info('Finding available port on server (3000–4000)...');
    const portFinder = await ssh.execCommand(`
MIN_PORT=3000
MAX_PORT=4000
CHECK_CMD="sudo ss -tuln 2>/dev/null || sudo netstat -tuln 2>/dev/null"

for port in $(seq $MIN_PORT $MAX_PORT); do
    if ! eval "$CHECK_CMD" | grep -E -q ":$port\\b"; then
        echo $port
        break
    fi
done
`);

    const freePort = portFinder.stdout.trim();
    if (!freePort) {
        throw new AutoFlowError(
            'No free ports available in range 3000–4000.',
            EXIT_CODES.CONTAINER_FAILED,
            'portService'
        );
    }

    log.success(`Allocated new port: ${freePort}`);
    return freePort;
}

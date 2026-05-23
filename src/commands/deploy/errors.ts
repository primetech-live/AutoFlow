import { NodeSSH } from 'node-ssh';
import log from '../../utils/logger';

// Custom typed error class for AutoFlow failures
export class AutoFlowError extends Error {
    public exitCode: number;
    public context: string;

    constructor(message: string, exitCode: number = 1, context: string = '') {
        super(message);
        this.name = 'AutoFlowError';
        this.exitCode = exitCode;
        this.context = context;
    }
}

// Exit codes for known failure types
export const EXIT_CODES = {
    SUCCESS: 0,
    CI_FAILED: 10,
    GIT_FAILED: 20,
    SSH_CONNECT_FAILED: 30,
    SSH_TIMEOUT: 31,
    SSH_DISCONNECTED: 32,
    INSTALL_FAILED: 40,
    BUILD_FAILED: 50,
    CONTAINER_FAILED: 60,
    ROLLBACK_FAILED: 70,
    NGINX_FAILED: 80,
    SSL_FAILED: 90,
    UNKNOWN: 99,
};

// Wraps execCommand with a configurable timeout (default: 5 minutes)
export async function execWithTimeout(
    ssh: NodeSSH,
    command: string,
    timeoutMs: number = 300_000,
    streamLogs: boolean = false
): Promise<{ stdout: string; stderr: string; code: number | null }> {
    return new Promise((resolve, reject) => {
        const timer = setTimeout(() => {
            reject(new AutoFlowError(
                `Command timed out after ${timeoutMs / 1000}s: ${command.trim().slice(0, 80)}`,
                EXIT_CODES.SSH_TIMEOUT,
                'execWithTimeout'
            ));
        }, timeoutMs);

        const options: any = {};
        if (streamLogs) {
            options.onStdout = (chunk: Buffer) => log.stream(chunk.toString('utf8'));
            options.onStderr = (chunk: Buffer) => log.stream(chunk.toString('utf8'));
        }

        ssh.execCommand(command, options)
            .then((result) => {
                clearTimeout(timer);
                resolve(result);
            })
            .catch((err: unknown) => {
                clearTimeout(timer);
                reject(err);
            });
    });
}

// Typed exec helper — throws AutoFlowError on non-zero exit
export async function exec(
    ssh: NodeSSH,
    command: string,
    timeoutMs?: number,
    streamLogs: boolean = false
): Promise<{ stdout: string; stderr: string; code: number | null }> {
    const result = await execWithTimeout(ssh, command, timeoutMs, streamLogs);
    if (result.code !== 0) {
        const errorOutput = result.stderr || result.stdout;
        log.error(`Command failed: ${command.trim().slice(0, 120)}`);
        if (errorOutput) console.error(errorOutput);
        throw new AutoFlowError(`Remote command failed`, EXIT_CODES.UNKNOWN, command);
    }
    return result;
}

// Registers process signal handlers — ensures SSH is always cleaned up
export function registerCleanupHandlers(ssh: NodeSSH): void {
    const cleanup = (signal: string) => {
        log.warning(`\n⚡ Received ${signal}. Cleaning up SSH connection...`);
        try {
            ssh.dispose();
        } catch (_) {
            // ignore
        }
        log.warning('AutoFlow exited. Your server may be in a partial state. Run "autoflow status" to check.');
        process.exit(EXIT_CODES.UNKNOWN);
    };

    process.once('SIGINT', () => cleanup('SIGINT (Ctrl+C)'));
    process.once('SIGTERM', () => cleanup('SIGTERM'));
}

// Handles and formats top-level errors uniformly
export function handleFatalError(err: unknown): never {
    if (err instanceof AutoFlowError) {
        log.error(`[${err.context || 'AutoFlow'}] ${err.message}`);
        process.exit(err.exitCode);
    }
    if (err instanceof Error) {
        log.error(`Unexpected error: ${err.message}`);
    } else {
        log.error('An unknown error occurred.');
        console.error(err);
    }
    process.exit(EXIT_CODES.UNKNOWN);
}

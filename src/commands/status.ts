import { NodeSSH } from 'node-ssh';
import chalk from 'chalk';
import log from '../utils/logger';
import { loadGlobalConfig, loadProjectConfig } from '../utils/config';

async function status(): Promise<void> {
    const projectConfig = loadProjectConfig();
    const globalConfig = loadGlobalConfig();
    const config = { ...globalConfig, ...projectConfig };

    log.header(`PROJECT STATUS: ${config.projectName.toUpperCase()}`);
    log.info(`Connecting to ${config.serverIp}...`);

    const ssh = new NodeSSH();

    try {
        await ssh.connect({
            host: config.serverIp,
            username: config.sshUser,
            port: Number(config.sshPort),
            privateKeyPath: config.sshKeyPath.replace(/^"|"$/g, ''),
        });

        const container = config.projectName;

        // 1. Container inspect
        const inspect = await ssh.execCommand(
            `docker inspect --format '{{.State.Status}}|{{.State.Running}}|{{.State.StartedAt}}' ${container}`
        );
        const [containerStatus, running, startedAt] = inspect.stdout.trim().split('|');

        if (!containerStatus) {
            console.log(chalk.red('\n❌ APP STATUS: NOT RUNNING (Container not found)'));
            return;
        }

        const isRunning = running === 'true';
        const statusColor = isRunning ? chalk.green : chalk.red;

        console.log(`\n${chalk.bold('APP STATUS:')}   ${statusColor(containerStatus.toUpperCase())} ${isRunning ? '✅' : '❌'}`);
        if (isRunning) {
            console.log(`${chalk.bold('STARTED:')}      ${new Date(startedAt).toLocaleString()}`);
        }

        const liveUrl = config.domain
            ? `https://${config.domain}`
            : `http://${config.serverIp}`;
        console.log(`${chalk.bold('LIVE URL:')}     ${liveUrl}`);

        if (isRunning) {
            // 2. Resource metrics
            const stats = await ssh.execCommand(
                `docker stats --no-stream --format "{{.CPUPerc}}|{{.MemUsage}}" ${container}`
            );
            const [cpu, mem] = stats.stdout.trim().split('|');

            console.log(chalk.gray('--------------------------------------------------'));
            console.log(chalk.bold('METRICS:'));
            console.log(`  CPU: ${chalk.cyan(cpu)}`);
            console.log(`  RAM: ${chalk.cyan(mem)}`);

            // 3. Internal health check
            const health = await ssh.execCommand(
                `curl -I -s -o /dev/null -w "%{http_code}" http://127.0.0.1:3000`
            );
            const httpCode = health.stdout.trim();
            const healthColor = httpCode === '200' ? chalk.green : chalk.yellow;
            console.log(`  Health: ${healthColor(httpCode + ' ')}(Internal Check)`);
            console.log(chalk.gray('--------------------------------------------------'));

            // 4. Recent logs
            const logs = await ssh.execCommand(`docker logs --tail 5 ${container}`);
            console.log(chalk.bold('RECENT LOGS:'));
            console.log(chalk.gray(logs.stdout || logs.stderr));
        }

    } catch (err) {
        log.error('Failed to fetch status.');
        console.error(err);
    } finally {
        ssh.dispose();
    }
}

export default status;

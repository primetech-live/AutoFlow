import { NodeSSH } from 'node-ssh';
import chalk from 'chalk';
import log from '../utils/logger';
import { loadGlobalConfig, loadProjectConfig } from '../core/config';
import { escapeShellArg } from '../utils/shell';

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
        const safeContainer = escapeShellArg(container);

        // 1. Container inspect
        const inspect = await ssh.execCommand(
            `docker inspect --format '{{.State.Status}}|{{.State.Running}}|{{.State.StartedAt}}' ${safeContainer}`
        );
        const [containerStatus, running, startedAt] = inspect.stdout.trim().split('|');

        if (!containerStatus) {
            console.log(chalk.red('\n❌ APP STATUS: NOT RUNNING (Container not found)'));

            // Ponytail / F11: Check if a rollback container exists from an interrupted or failed deploy
            const rollbackInspect = await ssh.execCommand(
                `docker inspect --format '{{.State.Status}}' ${escapeShellArg(container + '_rollback')}`
            );
            const rbStatus = rollbackInspect.stdout.trim();
            if (rbStatus) {
                console.log(chalk.yellow(`\n⚠️  Rollback snapshot found: "${container}_rollback" (Status: ${rbStatus})`));
                console.log(chalk.cyan('To restore the previous working version manually, run on server:'));
                console.log(chalk.gray(`  docker rm -f ${safeContainer}`));
                console.log(chalk.gray(`  docker rename ${safeContainer}_rollback ${safeContainer}`));
                console.log(chalk.gray(`  docker start ${safeContainer}\n`));
            }
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
                `docker stats --no-stream --format "{{.CPUPerc}}|{{.MemUsage}}" ${safeContainer}`
            );
            const [cpu, mem] = stats.stdout.trim().split('|');

            console.log(chalk.gray('--------------------------------------------------'));
            console.log(chalk.bold('METRICS:'));
            console.log(`  CPU: ${chalk.cyan(cpu)}`);
            console.log(`  RAM: ${chalk.cyan(mem)}`);

            // 3. Internal health check
            const portCmd = await ssh.execCommand(`docker port ${safeContainer}`);
            let mappedPort = '3000';
            if (portCmd.stdout) {
                const match = portCmd.stdout.match(/0\.0\.0\.0:(\d+)/) || portCmd.stdout.match(/127\.0\.0\.1:(\d+)/);
                if (match && match[1]) {
                    mappedPort = match[1];
                }
            }

            const health = await ssh.execCommand(
                `curl -I -s -o /dev/null -w "%{http_code}" http://127.0.0.1:${mappedPort}`
            );
            const httpCode = health.stdout.trim();
            const healthColor = httpCode === '200' ? chalk.green : chalk.yellow;
            console.log(`  Health: ${healthColor(httpCode + ' ')}(Internal Check)`);
            console.log(chalk.gray('--------------------------------------------------'));

            // 4. Recent logs
            const logs = await ssh.execCommand(`docker logs --tail 5 ${safeContainer}`);
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

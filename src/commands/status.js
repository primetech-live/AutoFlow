const log = require('../utils/logger');
const { NodeSSH } = require('node-ssh');
const fs = require('fs');
const path = require('path');
const chalk = require('chalk');

const os = require('os');

async function status(cmdObj) {
    const configPath = path.join(process.cwd(), 'autoflow.config.json');
    const globalConfigPath = path.join(os.homedir(), '.autoflow', 'config.json');

    if (!fs.existsSync(configPath)) {
        log.error('Run "autoflow init" first.');
        return;
    }

    if (!fs.existsSync(globalConfigPath)) {
        log.error('Global configuration missing! Run "autoflow setup" first.');
        return;
    }

    const projectConfig = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
    const globalConfig = JSON.parse(fs.readFileSync(globalConfigPath, 'utf-8'));
    const config = { ...globalConfig, ...projectConfig };

    const ssh = new NodeSSH();

    log.header(`PROJECT STATUS: ${config.projectName.toUpperCase()}`);
    log.info(`Connecting to ${config.serverIp}...`);

    try {
        await ssh.connect({
            host: config.serverIp,
            username: config.sshUser,
            port: Number(config.sshPort),
            privateKeyPath: config.sshKeyPath.replace(/^"|"$/g, '')
        });

        const container = config.projectName;

        // 1. Check Container Health
        const inspect = await ssh.execCommand(`docker inspect --format '{{.State.Status}}|{{.State.Running}}|{{.State.StartedAt}}' ${container}`);
        const [status, running, startedAt] = inspect.stdout.trim().split('|');

        if (!status) {
            console.log(chalk.red('\n❌ APP STATUS: NOT RUNNING (Container not found)'));
            ssh.dispose();
            return;
        }

        const isRunning = running === 'true';
        const statusColor = isRunning ? chalk.green : chalk.red;

        console.log(`\n${chalk.bold('APP STATUS:')}   ${statusColor(status.toUpperCase())} ${isRunning ? '✅' : '❌'}`);
        if (isRunning) {
            console.log(`${chalk.bold('STARTED:')}      ${new Date(startedAt).toLocaleString()}`);
        }
        console.log(`${chalk.bold('LIVE URL:')}     https://${config.domain || config.serverIp + ':' + config.appPort}`);

        if (isRunning) {
            // 2. Resource Usage
            const stats = await ssh.execCommand(`docker stats --no-stream --format "{{.CPUPerc}}|{{.MemUsage}}" ${container}`);
            const [cpu, mem] = stats.stdout.trim().split('|');

            console.log(chalk.gray('--------------------------------------------------'));
            console.log(chalk.bold('METRICS:'));
            console.log(`  cpu: ${chalk.cyan(cpu)}`);
            console.log(`  ram: ${chalk.cyan(mem)}`);

            // 3. Internal Health Check
            const checkPort = config.deploymentType === 'static' ? 80 : config.appPort;
            const health = await ssh.execCommand(`curl -I -s -o /dev/null -w "%{http_code}" http://127.0.0.1:${checkPort}`);
            const httpCode = health.stdout.trim();
            const healthColor = httpCode === '200' ? chalk.green : chalk.yellow;

            console.log(`  health: ${healthColor(httpCode + ' OK')} (Internal Check)`);
            console.log(chalk.gray('--------------------------------------------------'));

            // 4. Recent Logs
            const logs = await ssh.execCommand(`docker logs --tail 5 ${container}`);
            console.log(chalk.bold('RECENT LOGS:'));
            console.log(chalk.gray(logs.stdout || logs.stderr));
        }

        ssh.dispose();

    } catch (err) {
        log.error('Failed to fetch status');
        console.error(err);
        ssh.dispose();
    }
}

module.exports = status;

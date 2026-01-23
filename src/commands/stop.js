const log = require('../utils/logger');
const { NodeSSH } = require('node-ssh');
const fs = require('fs');
const path = require('path');
const chalk = require('chalk');

async function exec(ssh, command, log) {
    const result = await ssh.execCommand(command);
    if (result.code !== 0) {
        log.error(`Command failed: ${command}`);
        console.log(chalk.red(result.stderr || result.stdout));
        // We don't throw error here to try completing other cleanup steps
    }
    return result;
}

const os = require('os');

async function stop(cmdObj) {
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

    log.header(`STOPPING SERVICE: ${config.projectName.toUpperCase()}`);
    log.info(`Connecting to ${config.serverIp}...`);

    try {
        await ssh.connect({
            host: config.serverIp,
            username: config.sshUser,
            port: Number(config.sshPort),
            privateKeyPath: config.sshKeyPath.replace(/^"|"$/g, '')
        });

        const container = config.projectName;

        // 1. Stop & Remove Container
        log.info('Stopping container...');
        await exec(ssh, `docker stop ${container}`, log);

        log.info('Removing container...');
        await exec(ssh, `docker rm ${container}`, log);

        // Cleanup unused resources
        log.info('Pruning unused Docker resources...');
        await exec(ssh, `sudo docker system prune -f`, log);

        // 2. Remove Nginx Config (Disable Site)
        log.info('Disabling Nginx config...');
        await exec(ssh, `sudo rm -f /etc/nginx/sites-enabled/${config.projectName}`, log);

        // 3. Reload Nginx
        log.info('Reloading Nginx...');
        await exec(ssh, `sudo nginx -s reload`, log);

        // 4. Remove Project Files
        const projectDir = `/home/${config.sshUser}/apps/${config.projectName}`;
        log.info(`Removing project files (${projectDir})...`);
        await exec(ssh, `rm -rf ${projectDir}`, log);

        log.success('Service stopped and verified offline ✅');
        log.info('To start it again, run: autoflow deploy');

        ssh.dispose();

    } catch (err) {
        log.error('Failed to stop service');
        console.error(err);
        ssh.dispose();
    }
}

module.exports = stop;

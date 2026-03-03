import { NodeSSH } from 'node-ssh';
import chalk from 'chalk';
import log from '../utils/logger';
import { loadGlobalConfig, loadProjectConfig } from '../utils/config';

async function execSafe(ssh: NodeSSH, command: string): Promise<void> {
    const result = await ssh.execCommand(command);
    if (result.code !== 0) {
        log.warning(`Command returned non-zero: ${command.slice(0, 80)}`);
        if (result.stderr) console.log(chalk.yellow(result.stderr));
        // Non-throwing: we want to complete all cleanup steps even if one fails
    }
}

async function stop(): Promise<void> {
    const projectConfig = loadProjectConfig();
    const globalConfig = loadGlobalConfig();
    const config = { ...globalConfig, ...projectConfig };

    log.header(`STOPPING SERVICE: ${config.projectName.toUpperCase()}`);
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
        const projectDir = `/home/${config.sshUser}/apps/${config.projectName}`;

        // 1. Stop & remove container
        log.info('Stopping container...');
        await execSafe(ssh, `docker stop ${container}`);

        log.info('Removing container...');
        await execSafe(ssh, `docker rm ${container}`);

        // Also clean up the rollback snapshot if it exists
        await execSafe(ssh, `docker rm -f ${container}_rollback || true`);

        // 2. Prune unused Docker resources
        log.info('Pruning unused Docker resources...');
        await execSafe(ssh, 'sudo docker system prune -f');

        // 3. Remove Nginx config
        log.info('Disabling Nginx config...');
        await execSafe(ssh, `sudo rm -f /etc/nginx/sites-enabled/${config.projectName}`);

        // 4. Reload Nginx
        log.info('Reloading Nginx...');
        await execSafe(ssh, 'sudo nginx -s reload');

        // 5. Remove project files
        log.info(`Removing project files at ${projectDir}...`);
        await execSafe(ssh, `rm -rf ${projectDir}`);

        log.success('Service stopped and cleaned up ✅');
        log.info('To redeploy, run: autoflow deploy');

    } catch (err) {
        log.error('Failed to stop service.');
        console.error(err);
    } finally {
        ssh.dispose();
    }
}

export default stop;

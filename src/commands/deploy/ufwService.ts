import { NodeSSH } from 'node-ssh';
import log from '../../utils/logger';
import { exec } from './errors';
import { escapeShellArg } from '../../utils/shell';

export async function configureUFW(ssh: NodeSSH, port: string | number, isDomainMode: boolean, sshPort: string | number = 22): Promise<void> {
    log.info('Configuring UFW firewall...');
    
    // Check if UFW is installed
    const { stdout, code, stderr } = await ssh.execCommand('sudo ufw status');
    if (code !== 0 && stderr.includes('not found')) {
        log.info('UFW is not installed. Skipping firewall configuration.');
        return;
    }

    if (stdout.includes('inactive')) {
        log.info('UFW is installed but inactive. Enabling it now...');
        // CRITICAL: Always allow SSH port before enabling firewall to prevent lockout!
        await exec(ssh, `sudo ufw allow ${escapeShellArg(String(sshPort))}/tcp`);
        await exec(ssh, 'sudo ufw --force enable');
        log.success('✔ UFW enabled and SSH port secured.');
    }

    if (isDomainMode) {
        // Nginx mode: allow HTTP/HTTPS, block direct port
        await exec(ssh, 'sudo ufw allow 80/tcp');
        await exec(ssh, 'sudo ufw allow 443/tcp');
        await exec(ssh, `sudo ufw deny ${escapeShellArg(String(port))}/tcp`); // Secure the backend
        log.success('✔ UFW configured for Nginx (80/443 open, backend secured).');
    } else {
        // Direct IP mode: allow the specific allocated port
        await exec(ssh, `sudo ufw allow ${escapeShellArg(String(port))}/tcp`);
        log.success(`✔ UFW configured for direct access (Port ${port} open).`);
    }
}

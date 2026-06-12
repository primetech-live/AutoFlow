import { NodeSSH } from 'node-ssh';
import path from 'path';
import log from '../../utils/logger';
import { exec, AutoFlowError, EXIT_CODES } from './errors';
import { escapeShellArg } from '../../utils/shell';

export async function configureNginx(
    ssh: NodeSSH,
    domain: string,
    projectName: string,
    sshUser: string,
    hostPort: string
): Promise<void> {
    log.info(`Configuring Nginx for domain: ${domain}`);

    const nginxConf = `
server {
    listen 80;
    server_name ${domain};

    location / {
        proxy_pass http://127.0.0.1:${hostPort};
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Forwarded-Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_cache_bypass $http_upgrade;
    }
}
`;

    const safeProjectName = path.posix.basename(projectName);
    const confPath = `/etc/nginx/sites-available/${safeProjectName}`;

    // ── Conflict resolution ──────────────────────────────────────────────────
    log.info('Scanning for conflicting Nginx configs...');
    const safeDomain = escapeShellArg(domain);
    const conflictCheck = await ssh.execCommand(
        `grep -Rl ${safeDomain} /etc/nginx/sites-enabled/ 2>/dev/null || true`
    );

    if (conflictCheck.stdout.trim()) {
        const conflicts = conflictCheck.stdout.trim().split('\n');

        for (const conflict of conflicts) {
            const conflictName = path.basename(conflict);

            // Skip our own project or certbot-generated variants of it
            if (
                conflictName === safeProjectName ||
                conflictName.startsWith(`${safeProjectName}-`)
            ) continue;

            // Read file and verify it's actually serving this exact domain
            const contentCmd = await ssh.execCommand(`cat "${conflict}"`);
            const clean = (contentCmd.stdout || '').replace(/#.*/g, '');
            const serverNameMatches = clean.match(/server_name\s+([^;]+);/g);

            let isConflict = false;
            if (serverNameMatches) {
                for (const m of serverNameMatches) {
                    const args = m.replace('server_name', '').replace(';', '').trim().split(/\s+/);
                    if (args.includes(domain)) { isConflict = true; break; }
                }
            }

            if (isConflict) {
                log.warning(`Found conflicting config: ${conflictName}. Backing up and removing...`);
                await exec(ssh, `sudo cp ${conflict} /home/${sshUser}/backup-${conflictName}.conf || true`);
                await exec(ssh, `sudo rm -f ${conflict}`);
                await exec(ssh, `sudo rm -f /etc/nginx/sites-available/${conflictName}`);
                log.success(`Removed conflict: ${conflictName} (backup kept)`);
            } else {
                log.info(`Ignoring false positive: ${conflictName}`);
            }
        }
    }

    await exec(ssh, `cat <<'NGINX_EOF' | sudo tee ${confPath} > /dev/null
${nginxConf}
NGINX_EOF`);
    await exec(ssh, `sudo ln -sf ${confPath} /etc/nginx/sites-enabled/${safeProjectName}`);

    // Update port in case SSL config already exists
    await exec(
        ssh,
        `sudo sed -i 's|proxy_pass http://127.0.0.1:[0-9]*;|proxy_pass http://127.0.0.1:${hostPort};|g' /etc/nginx/sites-enabled/${safeProjectName}* 2>/dev/null || true`
    );

    // Test config
    const test = await ssh.execCommand('sudo nginx -t 2>&1');
    if (test.code !== 0) {
        throw new AutoFlowError(
            `Nginx config test failed:\n${test.stdout}\n${test.stderr}`,
            EXIT_CODES.NGINX_FAILED,
            'nginxService'
        );
    }

    await exec(ssh, 'sudo systemctl reload nginx');

    // SELinux fix (for RHEL/CentOS servers)
    await ssh.execCommand('sudo setsebool -P httpd_can_network_connect 1 2>/dev/null || true');

    log.success('Nginx configured and reloaded ✔');
}

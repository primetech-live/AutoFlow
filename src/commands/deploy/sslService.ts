import { NodeSSH } from 'node-ssh';
import chalk from 'chalk';
import log from '../../utils/logger';
import { escapeShellArg } from '../../utils/shell';

export async function provisionSSL(
    ssh: NodeSSH,
    domain: string
): Promise<void> {
    log.info('Ensuring SSL certificate...');

    // Check certbot is installed
    const certbotCheck = await ssh.execCommand('which certbot');
    if (!certbotCheck.stdout.trim()) {
        log.warning('⚠️  Certbot not found. Skipping SSL setup.');
        log.info('Install certbot on your server to enable HTTPS automatically:');
        console.log(chalk.yellow('  sudo apt install certbot python3-certbot-nginx -y'));
        return;
    }

    const safeDomain = escapeShellArg(domain);

    // DNS pre-validation
    log.info(`Verifying DNS resolution for ${domain}...`);
    const dnsCheck = await ssh.execCommand(`ping -c 1 ${safeDomain}`);
    if (dnsCheck.code !== 0) {
        log.warning(`⚠️  DNS resolution failed for ${domain}. Skipping SSL setup to prevent Let's Encrypt rate limits.`);
        return;
    }

    const certPath = `/etc/letsencrypt/live/${domain}/fullchain.pem`;

    // Pre-check: does cert already exist?
    const preCheck = await ssh.execCommand(`sudo test -f ${certPath} && echo "EXISTS" || echo "MISSING"`);
    if (preCheck.stdout.trim() === 'MISSING') {
        log.info(`No existing certificate found for ${domain}. Generating new one...`);
    } else {
        log.info(`Existing certificate found for ${domain}. Renewing if needed...`);
    }

    const rootDomain = domain.split('.').slice(-2).join('.');
    const safeRootDomain = escapeShellArg(`admin@${rootDomain}`);
    const certResult = await ssh.execCommand(`
sudo certbot --nginx -d ${safeDomain} \\
  --non-interactive --agree-tos --redirect \\
  -m ${safeRootDomain}
`, { execOptions: { pty: false } } as object);

    if (certResult.code !== 0) {
        log.warning('⚠️  SSL provisioning failed. Details:');
        console.log(chalk.red(certResult.stderr || certResult.stdout));
    }

    // Post-check: verify cert file exists
    const postCheck = await ssh.execCommand(`sudo test -f ${certPath} && echo "EXISTS" || echo "MISSING"`);

    if (postCheck.stdout.trim() === 'EXISTS') {
        log.success('SSL certificate active ✔');
        log.success(`Live at: https://${domain}`);
    } else {
        log.error('SSL certificate missing! Site is running on HTTP only.');
        log.info('To fix manually, run on the server:');
        console.log(chalk.yellow(`  sudo certbot --nginx -d ${domain}`));
        log.info(`Live at: http://${domain} (Not Secure)`);
    }
}

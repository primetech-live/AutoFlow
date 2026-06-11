import { NodeSSH } from 'node-ssh';
import log from '../../utils/logger';
import { exec } from './errors';

export async function ensureSwap(ssh: NodeSSH): Promise<void> {
    log.info('Checking server swap memory...');

    try {
        const check = await ssh.execCommand('free -m');
        const lines = check.stdout.split('\n');
        const swapLine = lines.find((l) => l.includes('Swap:'));

        if (swapLine) {
            const parts = swapLine.split(/\s+/);
            const swapTotal = parseInt(parts[1], 10);

            if (swapTotal === 0) {
                log.warning('⚠️  No Swap detected. Creating 1GB Swap to prevent OOM build crashes...');

                await exec(ssh, `
sudo fallocate -l 1G /swapfile || sudo dd if=/dev/zero of=/swapfile bs=1M count=1024
sudo chmod 600 /swapfile
sudo mkswap /swapfile
sudo swapon /swapfile
grep -q '/swapfile' /etc/fstab || echo '/swapfile none swap sw 0 0' | sudo tee -a /etc/fstab
`);
                log.success('Swap (1GB) created and activated ✔');
            } else {
                log.success(`Swap OK: ${swapTotal}MB available`);
            }
        } else {
            log.warning('Could not read swap info (non-critical). Continuing...');
        }
    } catch {
        log.warning('Failed to check/create swap (non-critical). Continuing...');
    }
}

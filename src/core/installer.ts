import { connectionManager } from './connection';

export interface DependencyStatus {
    name: string;
    installed: boolean;
    category: 'Required' | 'Recommended';
    description: string;
}

export type PackageManager = 'apt' | 'yum' | 'apk' | 'unknown';

export class InstallerEngine {
    private dependencies: Omit<DependencyStatus, 'installed'>[] = [
        { name: 'Git', category: 'Required', description: 'Version control system to fetch your code' },
        { name: 'Docker', category: 'Required', description: 'Container runtime for building and isolating apps' },
        { name: 'Nginx', category: 'Required', description: 'Reverse proxy server to route traffic and handle SSL' },
        { name: 'Certbot', category: 'Required', description: 'Let\'s Encrypt client for automatic SSL certificates' },
        { name: 'Docker Compose', category: 'Recommended', description: 'Tool for defining multi-container Docker apps' },
        { name: 'PM2', category: 'Recommended', description: 'Production process manager for Node.js apps' },
        { name: 'Fail2Ban', category: 'Recommended', description: 'Ban IPs that show malicious signs to prevent attacks' },
        { name: 'UFW', category: 'Recommended', description: 'Uncomplicated Firewall to manage network access' }
    ];

    public async detectPackageManager(): Promise<PackageManager> {
        if (await connectionManager.safeRun('which apt')) return 'apt';
        if (await connectionManager.safeRun('which yum')) return 'yum';
        if (await connectionManager.safeRun('which dnf')) return 'yum';
        if (await connectionManager.safeRun('which apk')) return 'apk';
        return 'unknown';
    }

    public async checkDependencies(): Promise<DependencyStatus[]> {
        const results: DependencyStatus[] = [];
        
        for (const dep of this.dependencies) {
            let isInstalled = false;
            switch (dep.name) {
                case 'Git': isInstalled = !!(await connectionManager.safeRun('which git')); break;
                case 'Docker': isInstalled = !!(await connectionManager.safeRun('which docker')); break;
                case 'Nginx': isInstalled = !!(await connectionManager.safeRun('which nginx')); break;
                case 'Certbot': isInstalled = !!(await connectionManager.safeRun('which certbot')); break;
                case 'Docker Compose': 
                    isInstalled = !!(await connectionManager.safeRun('which docker-compose')) || 
                                  !!(await connectionManager.safeRun('docker compose version')); 
                    break;
                case 'PM2': isInstalled = !!(await connectionManager.safeRun('which pm2')); break;
                case 'Fail2Ban': isInstalled = !!(await connectionManager.safeRun('which fail2ban-client')); break;
                case 'UFW': isInstalled = !!(await connectionManager.safeRun('which ufw')); break;
            }
            results.push({ ...dep, installed: isInstalled });
        }
        return results;
    }

    public async installMissing(depsToInstall: string[], pkgManager: PackageManager, onProgress: (log: string) => void): Promise<void> {
        if (pkgManager === 'unknown') {
            throw new Error('Unsupported OS or package manager not found.');
        }

        const installCmds: Record<string, string> = {
            'Git': pkgManager === 'apt' ? 'sudo apt-get install -y git' : pkgManager === 'yum' ? 'sudo yum install -y git' : 'sudo apk add git',
            'Nginx': pkgManager === 'apt' ? 'sudo apt-get install -y nginx' : pkgManager === 'yum' ? 'sudo yum install -y nginx' : 'sudo apk add nginx',
            'Certbot': pkgManager === 'apt' ? 'sudo apt-get install -y certbot python3-certbot-nginx' : pkgManager === 'yum' ? 'sudo yum install -y certbot python3-certbot-nginx' : 'sudo apk add certbot',
            'Fail2Ban': pkgManager === 'apt' ? 'sudo apt-get install -y fail2ban' : pkgManager === 'yum' ? 'sudo yum install -y fail2ban' : 'sudo apk add fail2ban',
            'UFW': pkgManager === 'apt' ? 'sudo apt-get install -y ufw' : pkgManager === 'yum' ? 'sudo yum install -y ufw' : 'sudo apk add ufw',
        };

        // Special cases
        if (depsToInstall.includes('Docker')) {
            onProgress('Installing Docker...');
            if (pkgManager === 'apt' || pkgManager === 'yum') {
                await connectionManager.execCommand('curl -fsSL https://get.docker.com -o get-docker.sh && sudo sh get-docker.sh');
            } else if (pkgManager === 'apk') {
                await connectionManager.execCommand('sudo apk add docker && sudo rc-update add docker boot && sudo service docker start');
            }
        }

        if (depsToInstall.includes('Docker Compose')) {
            onProgress('Installing Docker Compose...');
            if (pkgManager === 'apt') {
                await connectionManager.execCommand('sudo apt-get install -y docker-compose-plugin');
            } else {
                await connectionManager.execCommand('sudo curl -L "https://github.com/docker/compose/releases/download/v2.24.5/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose && sudo chmod +x /usr/local/bin/docker-compose');
            }
        }

        if (depsToInstall.includes('PM2')) {
            onProgress('Installing PM2...');
            // PM2 requires Node.js/npm. If missing, fail gracefully or assume user installs Node via apt.
            await connectionManager.execCommand('sudo npm install -g pm2 || sudo apt-get install -y nodejs npm && sudo npm install -g pm2');
        }

        for (const dep of depsToInstall) {
            if (installCmds[dep]) {
                onProgress(`Installing ${dep}...`);
                await connectionManager.execCommand(installCmds[dep]);
            }
        }

        onProgress('Installation complete.');
    }
}

export const installerEngine = new InstallerEngine();

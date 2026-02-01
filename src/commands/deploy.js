const log = require('../utils/logger');
const chalk = require('chalk');
const fs = require('fs');
const path = require('path');
const { NodeSSH } = require('node-ssh');
const simpleGit = require('simple-git');

// Helper to execute command and check for errors
async function exec(ssh, command, log) {
    const result = await ssh.execCommand(command);
    if (result.code !== 0) {
        log.error(`Command failed: ${command}`);
        console.log(chalk.red(result.stdout)); // Docker build errors often go to stdout
        console.log(chalk.red(result.stderr));
        throw new Error('Remote command failed');
    }
    return result;
}

// Helper to ensure server has Swap space (prevents OOM builds)
async function ensureSwap(ssh, log) {
    try {
        const check = await ssh.execCommand('free -m');
        const lines = check.stdout.split('\n');
        const swapLine = lines.find(l => l.includes('Swap:'));

        if (swapLine) {
            const parts = swapLine.split(/\s+/);
            const swapTotal = parseInt(parts[1], 10);

            if (swapTotal === 0) {
                log.warning('⚠️ No Swap detected. Creating 1GB Swap file to prevent build crashes...');
                await exec(ssh, `
sudo fallocate -l 1G /swapfile || sudo dd if=/dev/zero of=/swapfile bs=1M count=1024
sudo chmod 600 /swapfile
sudo mkswap /swapfile
sudo swapon /swapfile
echo '/swapfile none swap sw 0 0' | sudo tee -a /etc/fstab
`, log);
                log.success('Swap created successfully ✅');
            } else {
                log.info(`Swap check passed: ${swapTotal}MB available`);
            }
        }
    } catch (e) {
        log.warning('Failed to check/create swap (non-critical)');
    }
}

const os = require('os');

async function deploy() {
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

    // Merge configs: Project takes precedence for project-specifics (like appPort), Global for server access
    const config = { ...globalConfig, ...projectConfig };

    const ssh = new NodeSSH();
    const git = simpleGit();

    log.header(`DEPLOYING ${config.projectName.toUpperCase()}`);

    try {
        /* =====================================================
           LOCAL GIT SYNC
        ===================================================== */
        log.info('Syncing local code...');
        const status = await git.status();
        if (!status.isClean()) {
            await git.add('.');
            await git.commit('Auto deploy via AutoFlow');
        }
        await git.push();
        log.success('Code pushed');

        /* =====================================================
           SSH CONNECT
        ===================================================== */
        await ssh.connect({
            host: config.serverIp,
            username: config.sshUser,
            port: Number(config.sshPort),
            privateKeyPath: config.sshKeyPath.replace(/^"|"$/g, '')
        });
        log.success('SSH connected');

        // Ensure Swap for small servers
        await ensureSwap(ssh, log);

        const projectDir = `/home/${config.sshUser}/apps/${config.projectName}`;
        const image = `${config.projectName}:latest`;
        const container = config.projectName;

        /* =====================================================
           PORT ALLOCATION (AUTO)
        ===================================================== */
        const containerPort = config.appType === 'static' ? 80 : 3000;
        let hostPort = null;

        // 1. Try to reuse existing port if app is running
        const currentMapping = await ssh.execCommand(`docker ps --filter "name=${container}" --format "{{.Ports}}"`);
        if (currentMapping.stdout) {
            // Regex to match "0.0.0.0:3005->..." or ":::3005->..."
            const match = currentMapping.stdout.match(/:(\d+)->/);
            if (match && match[1]) {
                hostPort = match[1];
                log.info(`Reusing existing port: ${hostPort}`);
            }
        }

        // 2. If not found, find a new free port (3000-4000)
        if (!hostPort) {
            log.info('Finding available port on server...');
            const portFinder = await ssh.execCommand(`
                MIN_PORT=3000
                MAX_PORT=4000
                # Use ss (Socket Stats) as primary, netstat as fallback
                CHECK_CMD="sudo ss -tuln 2>/dev/null || sudo netstat -tuln 2>/dev/null"
                
                for port in $(seq $MIN_PORT $MAX_PORT); do
                    # Check if port is in use (grep returns 0 if found)
                    if ! eval "$CHECK_CMD" | grep -E -q ":$port\\b"; then
                        echo $port
                        break
                    fi
                done
            `);
            const freePort = portFinder.stdout.trim();
            if (!freePort) {
                throw new Error('No free ports available in range 3000-4000');
            }
            hostPort = freePort;
            log.success(`Allocated new port: ${hostPort}`);
        }

        /* =====================================================
           SYNC SERVER CODE
        ===================================================== */
        await exec(ssh, `
mkdir -p ${projectDir} &&
cd ${projectDir} &&
git init &&
git remote remove origin || true &&
git remote add origin ${config.gitRepo} &&
git fetch origin &&
git reset --hard origin/main &&
git clean -fd
`, log);

        /* =====================================================
           BUILD IMAGE
        ===================================================== */
        log.info('Building Docker image...');
        await exec(ssh, `
cd ${projectDir} &&
docker build --no-cache --progress=plain -t ${image} .
`, log);

        /* =====================================================
           RUN CONTAINER (STRICT MODE)
        ===================================================== */
        await ssh.execCommand(`docker rm -f ${container} || true`);

        log.info(`Mapping: Host:${hostPort} -> Container:${containerPort}`);

        const portBinding = config.domain
            ? `-p 127.0.0.1:${hostPort}:${containerPort}`
            : `-p ${hostPort}:${containerPort}`;

        log.info('Starting container...');
        await exec(ssh, `
docker run -d \
--restart unless-stopped \
${portBinding} \
--name ${container} \
${image}
`, log);

        // Verify container is running
        const ps = await ssh.execCommand(`docker ps --filter "name=${container}" --format "{{.Status}}"`);
        if (!ps.stdout || !ps.stdout.includes('Up')) {
            log.error('Container failed to start. Fetching logs...');
            const logs = await ssh.execCommand(`docker logs --tail 20 ${container}`);
            console.log(chalk.red('=== CONTAINER LOGS ==='));
            console.log(chalk.red(logs.stdout || logs.stderr));
            console.log(chalk.red('======================'));
            throw new Error('Container exited immediately.');
        }

        /* =====================================================
           DOMAIN MODE: NGINX + SSL
        ===================================================== */
        if (config.domain) {
            log.info(`Configuring nginx for ${config.domain}`);

            const nginxConf = `
server {
    listen 80;
    server_name ${config.domain};

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

            const confPath = `/etc/nginx/sites-available/${config.projectName}`;

            // Remove conflicting configs
            log.info('Checking for conflicting Nginx configs...');
            // Find ANY file in sites-enabled that contains the domain name
            const conflictCheck = await ssh.execCommand(`grep -Rl "${config.domain}" /etc/nginx/sites-enabled/`);

            if (conflictCheck.stdout) {
                const conflicts = conflictCheck.stdout.trim().split('\n');
                for (const conflict of conflicts) {
                    const conflictName = path.basename(conflict);

                    // Skip if it's the current project or a certbot generated file for the current project
                    if (conflictName === config.projectName || conflictName.startsWith(`${config.projectName}-`)) {
                        continue;
                    }

                    log.warning(`⚠️  Found conflicting config: ${conflictName}`);
                    log.info(`   Removing ${conflict} to prevent conflicts...`);

                    // Backup before delete (just in case)
                    await exec(ssh, `sudo cp ${conflict} /home/${config.sshUser}/backup-${conflictName}.conf || true`, log);

                    // Nuke it
                    await exec(ssh, `sudo rm -f ${conflict}`, log);

                    // Also try to remove from sites-available if it exists there to be clean
                    await exec(ssh, `sudo rm -f /etc/nginx/sites-available/${conflictName}`, log);
                }
            }

            // Write new config
            await exec(ssh, `
echo '${nginxConf.replace(/'/g, `'\\''`)}' | sudo tee ${confPath} > /dev/null
sudo ln -sf ${confPath} /etc/nginx/sites-enabled/${config.projectName}
# Fix: Ensure port is updated in potentially existing Certbot SSL config
sudo sed -i 's|proxy_pass http://127.0.0.1:[0-9]*;|proxy_pass http://127.0.0.1:${hostPort};|g' /etc/nginx/sites-enabled/${config.projectName}*
sudo nginx -t
`, log);

            await exec(ssh, `sudo systemctl reload nginx`, log);

            // Fix: Allow Nginx to connect to upstream (SELinux fix)
            await exec(ssh, `sudo setsebool -P httpd_can_network_connect 1 2>/dev/null || true`, log);

            /* =====================================================
               AUTO SSL (SAFE)
            ===================================================== */
            log.info('Ensuring SSL...');
            try {
                // Check if certbot is installed first
                const checkCertbot = await ssh.execCommand('which certbot');
                if (!checkCertbot.stdout.trim()) {
                    log.warning('⚠️ Certbot not found. Skipping SSL setup.');
                    log.info('Install certbot on your server to enable HTTPS automatically.');
                } else {
                    // Try to generate certificate
                    const certResult = await ssh.execCommand(`
sudo certbot --nginx -d ${config.domain} \
--non-interactive --agree-tos -m admin@${config.domain.split('.').slice(-2).join('.')}
`);
                    if (certResult.code !== 0) {
                        log.warning('⚠️ SSL Generation failed. Site will run on HTTP only.');
                        console.log(chalk.red('--- Certbot Error Output ---'));
                        console.log(chalk.red(certResult.stderr || certResult.stdout));
                        console.log(chalk.red('----------------------------'));
                    } else {
                        log.success(`SSL Configured successfully ✅`);
                    }
                }
            } catch (sslError) {
                log.warning('Unexpected error during SSL setup');
                console.log(sslError);
            }

            log.success(`Live at: https://${config.domain}`);
        } else {
            log.success(`Live at: http://${config.serverIp}:${hostPort}`);
        }

        /* =====================================================
           DEPLOYMENT SUCCESS
        ===================================================== */
        log.success('DEPLOYMENT COMPLETE 🚀');
        ssh.dispose();

    } catch (err) {
        log.error('DEPLOY FAILED ❌');
        console.error(err);
        ssh.dispose();
    }
}

module.exports = deploy;

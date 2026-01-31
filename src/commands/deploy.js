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
           PORT CHECK (ONLY FOR PORT MODE)
        ===================================================== */
        if (!config.domain) {
            const portCheck = await ssh.execCommand(`
docker ps --format "{{.Ports}}" | grep -w "${config.appPort}->" || true
`);
            if (portCheck.stdout.trim()) {
                log.error(`Port ${config.appPort} already in use ❌`);
                ssh.dispose();
                return;
            }
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

        const containerPort = config.appType === 'static' ? 80 : config.appPort;
        log.info(`Mapping: Host:${config.appPort} -> Container:${containerPort}`);

        const portBinding = config.domain
            ? `-p 127.0.0.1:${config.appPort}:${containerPort}`
            : `-p ${config.appPort}:${containerPort}`;

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
        proxy_pass http://127.0.0.1:${config.appPort};
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    }
}
`;

            const confPath = `/etc/nginx/sites-available/${config.projectName}`;

            // Remove conflicting configs
            log.info('Checking for conflicting Nginx configs...');
            // Search for "server_name example.com;" specifically to avoid partial matches
            // We use grep -r to find files containing the exact server_name directive
            const conflictCheck = await ssh.execCommand(`grep -l "server_name ${config.domain};" /etc/nginx/sites-enabled/*`);
            
            if (conflictCheck.stdout) {
                const conflicts = conflictCheck.stdout.trim().split('\n');
                for (const conflict of conflicts) {
                    const conflictName = path.basename(conflict);
                    // Only remove if it's NOT the current project
                    if (conflictName !== config.projectName) {
                        log.warning(`Removing conflicting config: ${conflictName}`);
                        await exec(ssh, `sudo rm -f ${conflict}`, log);
                        await exec(ssh, `sudo rm -f /etc/nginx/sites-available/${conflictName}`, log);
                    }
                }
            }

            await exec(ssh, `
echo '${nginxConf.replace(/'/g, `'\\''`)}' | sudo tee ${confPath} > /dev/null
sudo ln -sf ${confPath} /etc/nginx/sites-enabled/${config.projectName}
sudo nginx -t
`, log);

            // Reload only if test passed
            await exec(ssh, `sudo systemctl reload nginx`, log);

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
            log.success(`Live at: http://${config.serverIp}:${config.appPort}`);
        }

        /* =====================================================
           DIAGNOSTICS (DEBUGGING 502)
        ===================================================== */
        log.info('Running post-deploy diagnostics...');
        try {
            const diagInfo = await ssh.execCommand(`
echo "=== DOCKER PS ==="
docker ps --filter "name=${container}"
echo "\n=== PORT LISTEN CHECK ==="
sudo netstat -tuln | grep :${config.appPort} || echo "Port ${config.appPort} not listening"
echo "\n=== INTERNAL CURL TEST ==="
curl -v http://127.0.0.1:${config.appPort} --max-time 2 2>&1 || echo "Curl failed"
echo "\n=== NGINX ERROR LOGS ==="
sudo tail -n 20 /var/log/nginx/error.log
`);
            if (diagInfo.stdout.includes('Refused') || diagInfo.stdout.includes('Curl failed')) {
                log.warning('⚠️ INTERNAL CONNECTIVITY CHECK FAILED. Fetching container logs...');
                console.log(chalk.gray(diagInfo.stdout)); // Show diagnostics only on failure
                const logs = await ssh.execCommand(`docker logs --tail 20 ${container}`);
                console.log(chalk.red(logs.stdout || logs.stderr));
            } else {
                log.success('Internal connectivity test passed ✅');
            }
        } catch (e) {
            log.warning('Diagnostics failed to run');
        }

        log.success('DEPLOYMENT COMPLETE 🚀');
        ssh.dispose();

    } catch (err) {
        log.error('DEPLOY FAILED ❌');
        console.error(err);
        ssh.dispose();
    }
}

module.exports = deploy;

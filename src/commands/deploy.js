const log = require('../utils/logger');
const fs = require('fs');
const path = require('path');
const { NodeSSH } = require('node-ssh');
const simpleGit = require('simple-git');

async function deploy() {
    const configPath = path.join(process.cwd(), 'autoflow.config.json');

    if (!fs.existsSync(configPath)) {
        log.error('Run "autoflow init" first.');
        return;
    }

    const config = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
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

        /* =====================================================
           HARD PORT CHECK
        ===================================================== */
        const portCheck = await ssh.execCommand(`
      docker ps --format "{{.Ports}}" | grep -w "${config.appPort}->" || true
    `);

        if (portCheck.stdout.trim()) {
            log.error(`Port ${config.appPort} already in use ❌`);
            ssh.dispose();
            return;
        }

        const projectDir = `/home/${config.sshUser}/apps/${config.projectName}`;
        const image = `${config.projectName}:latest`;
        const container = config.projectName;

        /* =====================================================
           SYNC SERVER CODE
        ===================================================== */
        await ssh.execCommand(`
      mkdir -p ${projectDir} &&
      cd ${projectDir} &&
      git init &&
      git remote remove origin || true &&
      git remote add origin ${config.gitRepo} &&
      git fetch origin &&
      git reset --hard origin/main &&
      git clean -fd
    `);

        /* =====================================================
           BUILD IMAGE
        ===================================================== */
        await ssh.execCommand(`
      cd ${projectDir} &&
      docker build --no-cache -t ${image} .
    `);

        /* =====================================================
           RUN CONTAINER
        ===================================================== */
        await ssh.execCommand(`docker rm -f ${container} || true`);

        await ssh.execCommand(`
      docker run -d \
      --restart unless-stopped \
      -p ${config.appPort}:80 \
      --name ${container} \
      ${image}
    `);

        /* =====================================================
           AUTO NGINX DOMAIN SETUP
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

            await ssh.execCommand(`
        echo '${nginxConf.replace(/'/g, `'\\''`)}' | sudo tee ${confPath} > /dev/null
      `);

            await ssh.execCommand(`
        sudo ln -sf ${confPath} /etc/nginx/sites-enabled/${config.projectName}
      `);

            await ssh.execCommand(`sudo nginx -t && sudo systemctl reload nginx`);

            log.success(`Domain ${config.domain} is live 🚀`);
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

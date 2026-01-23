const log = require('../utils/logger');
const inquirer = require('inquirer');
const fs = require('fs');
const path = require('path');
const { NodeSSH } = require('node-ssh');

async function init() {
    log.header('AUTOFLOW INITIALIZATION');

    const questions = [
        // Type is now auto-detected, but we keep this as a confirmed variable internally
        {
            type: 'input',
            name: 'projectName',
            message: 'Project name:',
            default: path.basename(process.cwd()).toLowerCase()
        },
        {
            type: 'input',
            name: 'gitRepo',
            message: 'GitHub repository URL:'
        },
        {
            type: 'input',
            name: 'domain',
            message: 'Domain / Subdomain (leave empty for IP:PORT mode):'
        },
        {
            type: 'input',
            name: 'serverIp',
            message: 'Server IP:'
        },
        {
            type: 'input',
            name: 'sshUser',
            message: 'SSH user:',
            default: 'ubuntu'
        },
        {
            type: 'input',
            name: 'sshPort',
            message: 'SSH port:',
            default: '22'
        },
        {
            type: 'input',
            name: 'sshKeyPath',
            message: 'SSH private key path:'
        },
        {
            type: 'input',
            name: 'appPort',
            message: 'App port (used only if no domain):',
            default: '3000',
            validate: (v) =>
                Number(v) >= 1024 ? true : 'Port must be >= 1024'
        }
    ];

    const answers = await inquirer.prompt(questions);

    // Auto-Detect Project Type & Scripts
    let detectedType = 'node';
    let startCommand = 'npm start';
    let buildCommand = '';
    let baseImage = 'node:18-slim';

    if (fs.existsSync('package.json')) {
        const pkg = JSON.parse(fs.readFileSync('package.json', 'utf-8'));
        const deps = { ...pkg.dependencies, ...pkg.devDependencies };

        if (deps.vite) {
            detectedType = 'vite';
            log.info('✨ Detected Vite/React App');
            buildCommand = 'npm run build';
            startCommand = 'npm run preview -- --host 0.0.0.0 --port 3000';
            answers.appPort = '3000'; // Vite preview default
        } else if (deps.next) {
            detectedType = 'next';
            log.info('✨ Detected Next.js App');
            buildCommand = 'npm run build';
            startCommand = 'npm start';
            answers.appPort = '3000'; // Next default
        } else {
            // Standard Node.js
            log.info('✨ Detected Standard Node.js App');
            if (pkg.scripts && pkg.scripts.start) {
                startCommand = 'npm start';
            } else if (pkg.main) {
                startCommand = `node ${pkg.main}`;
            } else if (fs.existsSync('index.js')) {
                startCommand = 'node index.js';
            } else {
                startCommand = 'node app.js';
            }
        }
    } else if (fs.existsSync('index.html')) {
        detectedType = 'static';
        log.info('✨ Detected Static Website');
    }

    // Set config type correctly so deploy.js knows internal port (80 vs 3000)
    answers.deploymentType = detectedType === 'static' ? 'static' : 'docker';
    answers.mode = answers.domain ? 'domain' : 'port';

    const ssh = new NodeSSH();

    /* =====================================================
       AUTO PORT ALLOCATION (DOMAIN MODE)
    ===================================================== */
    if (answers.mode === 'domain') {
        log.info('Domain mode detected → auto-assigning internal port');

        try {
            await ssh.connect({
                host: answers.serverIp,
                username: answers.sshUser,
                port: Number(answers.sshPort),
                privateKeyPath: answers.sshKeyPath.replace(/^"|"$/g, '')
            });

            let selectedPort = null;

            for (let port = 3000; port <= 3010; port++) {
                const check = await ssh.execCommand(`
ss -tuln | grep -w ":${port} " || true
`);
                if (!check.stdout.trim()) {
                    selectedPort = port;
                    break;
                }
            }


            if (!selectedPort) {
                log.error('No free port found between 3000–3010 ❌');
                ssh.dispose();
                process.exit(1);
            }

            answers.appPort = String(selectedPort);
            log.success(`Auto-assigned internal port: ${selectedPort} ✅`);
            ssh.dispose();

        } catch {
            log.error('Failed to auto-assign port (SSH issue)');
            process.exit(1);
        }

    } else {
        /* =====================================================
           PORT CHECK (PORT MODE)
        ===================================================== */
        log.info(`Checking port ${answers.appPort} availability...`);

        try {
            await ssh.connect({
                host: answers.serverIp,
                username: answers.sshUser,
                port: Number(answers.sshPort),
                privateKeyPath: answers.sshKeyPath.replace(/^"|"$/g, '')
            });

            const check = await ssh.execCommand(`
docker ps --format "{{.Ports}}" | grep -w "${answers.appPort}->" || true
`);

            if (check.stdout.trim()) {
                log.error(`Port ${answers.appPort} already in use ❌`);
                ssh.dispose();
                process.exit(1);
            }

            log.success(`Port ${answers.appPort} is free ✅`);
            ssh.dispose();
        } catch {
            log.warning('Port check skipped (server unreachable)');
        }
    }

    /* =====================================================
       SAVE CONFIG
    ===================================================== */
    fs.writeFileSync(
        'autoflow.config.json',
        JSON.stringify(answers, null, 2)
    );
    log.success('autoflow.config.json created');

    /* =====================================================
       DOCKERFILE GENERATION
    ===================================================== */
    if (!fs.existsSync('Dockerfile')) {
        let dockerfile = '';

        if (detectedType === 'static') {
            dockerfile = `
FROM nginx:alpine
RUN rm -rf /usr/share/nginx/html/*
COPY . /usr/share/nginx/html
CMD ["nginx", "-g", "daemon off;"]
`;
        } else {
            // Universal Node.js Dockerfile (Smart)
            dockerfile = `
FROM ${baseImage}

WORKDIR /app

COPY package*.json ./
RUN npm install

COPY . .

${buildCommand ? `RUN ${buildCommand}` : '# No build step detected'}

EXPOSE ${answers.appPort}

CMD ${JSON.stringify(startCommand.split(' '))}
`;
        }

        if (answers.deploymentType !== 'docker') {
            fs.writeFileSync('Dockerfile', dockerfile.trim());
            log.success('Dockerfile generated');
        }
    }

    /* =====================================================
       .dockerignore
    ===================================================== */
    if (!fs.existsSync('.dockerignore')) {
        fs.writeFileSync(
            '.dockerignore',
            `node_modules
.git
.env
autoflow.config.json`
        );
        log.success('.dockerignore created');
    }

    log.success(`Initialization complete 🎉 (${answers.mode.toUpperCase()} MODE)`);
}

module.exports = init;

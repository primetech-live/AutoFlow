const log = require('../utils/logger');
const inquirer = require('inquirer');
const fs = require('fs');
const path = require('path');
const { NodeSSH } = require('node-ssh');

async function init() {
    log.header('AUTOFLOW INITIALIZATION');

    const questions = [
        {
            type: 'list',
            name: 'deploymentType',
            message: 'Project type?',
            choices: [
                { name: 'Static Website (HTML/CSS/JS)', value: 'static' },
                { name: 'Node.js App', value: 'node' },
                { name: 'Dockerized App', value: 'docker' }
            ]
        },
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
            message: 'Domain / Subdomain (leave empty if none):'
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
            message: 'App port:',
            default: '3000',
            validate: (v) => Number(v) >= 1024 ? true : 'Port must be >= 1024'
        }
    ];

    const answers = await inquirer.prompt(questions);

    /* =====================================================
       PORT CHECK (INIT LEVEL)
    ===================================================== */
    log.info(`Checking port ${answers.appPort} availability...`);
    const ssh = new NodeSSH();

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

        if (answers.deploymentType === 'static') {
            dockerfile = `
FROM nginx:alpine
RUN rm -rf /usr/share/nginx/html/*
COPY . /usr/share/nginx/html
CMD ["nginx", "-g", "daemon off;"]
`;
        }

        if (answers.deploymentType === 'node') {
            dockerfile = `
FROM node:18-alpine
WORKDIR /app
COPY package*.json ./
RUN npm install
COPY . .
EXPOSE ${answers.appPort}
CMD ["npm", "start"]
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

    log.success('Initialization complete 🎉');
}

module.exports = init;

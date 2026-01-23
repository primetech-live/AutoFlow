const log = require('../utils/logger');
const inquirer = require('inquirer');
const fs = require('fs');
const path = require('path');
const { NodeSSH } = require('node-ssh');
const os = require('os');

async function init() {
    log.header('AUTOFLOW INITIALIZATION');

    const globalConfigPath = path.join(os.homedir(), '.autoflow', 'config.json');
    if (!fs.existsSync(globalConfigPath)) {
        log.error('Global configuration missing!');
        log.warning('Run "autoflow setup" first.');
        return;
    }

    const globalConfig = JSON.parse(fs.readFileSync(globalConfigPath, 'utf-8'));

    const questions = [
        {
            type: 'input',
            name: 'projectName',
            message: 'Project name:',
            default: path.basename(process.cwd()).toLowerCase().replace(/\s+/g, '-')
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
            name: 'appPort',
            message: 'App port (used only if no domain):',
            default: '3000',
            validate: v => Number(v) >= 1024 ? true : 'Port must be >= 1024'
        }
    ];

    const answers = await inquirer.prompt(questions);

    /* =====================================================
       PROJECT TYPE DETECTION
    ===================================================== */
    let appType = 'node';
    let buildCommand = '';
    let startCommand = 'npm start';

    if (fs.existsSync('package.json')) {
        const pkg = JSON.parse(fs.readFileSync('package.json', 'utf-8'));
        const deps = { ...pkg.dependencies, ...pkg.devDependencies };

        if (deps?.vite) {
            appType = 'vite';
            buildCommand = 'npm run build';
            startCommand = 'npm run preview -- --host 0.0.0.0 --port 3000';
            answers.appPort = '3000';
            log.info('✨ Detected Vite App');
        } else if (deps?.next) {
            appType = 'next';
            buildCommand = 'npm run build';
            startCommand = 'npm start';
            answers.appPort = '3000';
            log.info('✨ Detected Next.js App');
        } else {
            appType = 'node';
            if (pkg.scripts?.start) startCommand = 'npm start';
            else if (pkg.main) startCommand = `node ${pkg.main}`;
            else startCommand = 'node index.js';
            log.info('✨ Detected Node.js App');
        }
    } else if (fs.existsSync('index.html')) {
        appType = 'static';
        log.info('✨ Detected Static Website');
    }

    answers.appType = appType;
    answers.deploymentType = 'docker';
    answers.mode = answers.domain ? 'domain' : 'port';

    /* =====================================================
       SAVE CONFIG
    ===================================================== */
    fs.writeFileSync(
        'autoflow.config.json',
        JSON.stringify(answers, null, 2)
    );
    log.success('autoflow.config.json created');

    /* =====================================================
       DOCKERFILE (ALWAYS)
    ===================================================== */
    let dockerfile = '';

    if (appType === 'static') {
        dockerfile = `
FROM nginx:alpine
RUN rm -rf /usr/share/nginx/html/*
COPY . /usr/share/nginx/html
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
`;
    } else {
        dockerfile = `
FROM node:20-alpine
WORKDIR /app
COPY package*.json ./
RUN npm install
COPY . .
${buildCommand ? `RUN ${buildCommand}` : ''}
EXPOSE ${answers.appPort}
CMD ${JSON.stringify(startCommand.split(' '))}
`;
    }

    fs.writeFileSync('Dockerfile', dockerfile.trim());
    log.success('Dockerfile generated');

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

    log.success(`Initialization complete 🎉 (${appType.toUpperCase()})`);
}

module.exports = init;

const log = require('../utils/logger');
const inquirer = require('inquirer');
const fs = require('fs');
const path = require('path');
const { NodeSSH } = require('node-ssh');
const os = require('os');

async function init() {
    log.header('AUTOFLOW INITIALIZATION (PRO)');

    const globalConfigPath = path.join(os.homedir(), '.autoflow', 'config.json');
    if (!fs.existsSync(globalConfigPath)) {
        log.error('Global configuration missing!');
        log.warning('Run "autoflow setup" first.');
        return;
    }

    // 1. Project Info
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
        }
    ];

    const answers = await inquirer.prompt(questions);

    /* =====================================================
       SMART DETECTION ENGINE
    ===================================================== */
    let appType = 'node';
    let buildCommand = null; // null means no build needed
    let startCommand = 'npm start';
    let packageManager = 'npm';
    let installCmd = 'npm install';
    let runCmd = 'npm run';

    // A. Detect Package Manager
    if (fs.existsSync('pnpm-lock.yaml')) {
        packageManager = 'pnpm';
        installCmd = 'pnpm install';
        runCmd = 'pnpm run';
        log.info('📦 Detected Package Manager: pnpm');
    } else if (fs.existsSync('yarn.lock')) {
        packageManager = 'yarn';
        installCmd = 'yarn install';
        runCmd = 'yarn run';
        log.info('📦 Detected Package Manager: yarn');
    } else {
        log.info('📦 Detected Package Manager: npm');
    }

    // B. Detect Framework & Config
    if (fs.existsSync('package.json')) {
        const pkg = JSON.parse(fs.readFileSync('package.json', 'utf-8'));
        const deps = { ...pkg.dependencies, ...pkg.devDependencies };
        const scripts = pkg.scripts || {};

        if (deps.next) {
            appType = 'next';
            buildCommand = `${runCmd} build`;
            startCommand = `${runCmd} start`;
            log.info('✨ Detected Framework: Next.js (Production Mode)');
        }
        else if (deps.vite) {
            appType = 'vite';
            buildCommand = `${runCmd} build`;
            // USE "serve" INSTEAD OF PREVIEW. Force bind to 0.0.0.0
            startCommand = 'npx -y serve -s dist -l tcp://0.0.0.0:3000';
            log.info('✨ Detected Framework: Vite (Using "serve" for Production)');
        }
        else if (deps['react-scripts']) {
            appType = 'react';
            buildCommand = `${runCmd} build`;
            startCommand = 'npx -y serve -s build -l tcp://0.0.0.0:3000';
            log.info('✨ Detected Framework: Create React App (Using "serve" for Production)');
        }
        else if (deps['@angular/cli']) {
            appType = 'angular';
            buildCommand = `${runCmd} build`;
            startCommand = 'npx -y serve -s dist/browser -l 3000'; // Adjust common output
            log.info('✨ Detected Framework: Angular');
        }
        else {
            // Generic Node.js Detection
            appType = 'node';
            log.info('✨ Detected Framework: Node.js / Express');

            if (scripts.build) {
                buildCommand = `${runCmd} build`;
                log.info('   Note: Build script detected and will be run.');
            }

            if (scripts.start) {
                startCommand = `${runCmd} start`;
            } else if (pkg.main) {
                startCommand = `node ${pkg.main}`;
            } else {
                startCommand = 'node index.js';
            }
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
       DOCKERFILE GENERATION (The "Perfect" Dockerfile)
    ===================================================== */
    let dockerfile = '';

    if (appType === 'static') {
        dockerfile = `
# Production Nginx for Static Site
FROM nginx:alpine
RUN rm -rf /usr/share/nginx/html/*
COPY . /usr/share/nginx/html
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
`;
    } else {
        // Dynamic Dockerfile based on Package Manager
        let installStep = 'RUN npm install';
        let setupPM = '';

        if (packageManager === 'pnpm') {
            setupPM = 'RUN npm install -g pnpm';
            installStep = 'RUN pnpm install';
        } else if (packageManager === 'yarn') {
            installStep = 'RUN yarn install';
        }

        dockerfile = `
FROM node:20-alpine

WORKDIR /app

# Install Package Manager if needed
${setupPM}

# Copy dependency definitions
COPY package*.json ${packageManager === 'pnpm' ? 'pnpm-lock.yaml ' : ''}${packageManager === 'yarn' ? 'yarn.lock ' : ''}./

# Install dependencies
${installStep}

# Copy Source
COPY . .

# Build (if needed)
${buildCommand ? `RUN ${buildCommand}` : '# No build step required'}

# Expose Port
EXPOSE 3000

# Start Command
CMD ${JSON.stringify(startCommand.split(' '))}
`;
    }

    fs.writeFileSync('Dockerfile', dockerfile.trim());
    log.success('Dockerfile generated (Optimized for Production 🚀)');

    /* =====================================================
       .dockerignore
    ===================================================== */
    if (!fs.existsSync('.dockerignore')) {
        fs.writeFileSync(
            '.dockerignore',
            `node_modules
.git
.env
dist
build
autoflow.config.json`
        );
        log.success('.dockerignore created');
    }

    log.success(`\nInitialization complete! 🎉`);
    log.info(`Ready to deploy ${answers.projectName} as a ${appType.toUpperCase()} app.`);
}

module.exports = init;

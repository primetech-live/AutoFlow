import inquirer from 'inquirer';
import fs from 'fs';
import log from '../utils/logger';
import { saveProjectConfig, loadGlobalConfig } from '../utils/config';
import path from 'path';

async function init(): Promise<void> {
    log.header('AUTOFLOW INITIALIZATION');

    // Require global config first
    try { loadGlobalConfig(); } catch {
        log.error('Global configuration missing!');
        log.warning('Run "autoflow setup" first.');
        return;
    }

    const answers = await inquirer.prompt<{
        projectName: string;
        gitRepo: string;
        domain: string;
    }>([
        {
            type: 'input',
            name: 'projectName',
            message: 'Project name:',
            default: path.basename(process.cwd()).toLowerCase().replace(/\s+/g, '-'),
        },
        { type: 'input', name: 'gitRepo', message: 'GitHub repository URL:' },
        { type: 'input', name: 'domain', message: 'Domain / Subdomain (leave empty for IP:PORT mode):' },
    ]);

    /* ── Smart Detection Engine ─────────────────────────────────────── */
    let appType = 'node';
    let buildCommand: string | null = null;
    let startCommand = 'npm start';
    let packageManager = 'npm';
    let installCmd = 'npm install';
    let runCmd = 'npm run';

    if (fs.existsSync('pnpm-lock.yaml')) {
        packageManager = 'pnpm'; installCmd = 'pnpm install'; runCmd = 'pnpm run';
        log.info('📦 Detected: pnpm');
    } else if (fs.existsSync('yarn.lock')) {
        packageManager = 'yarn'; installCmd = 'yarn install'; runCmd = 'yarn run';
        log.info('📦 Detected: yarn');
    } else {
        log.info('📦 Detected: npm');
    }

    if (fs.existsSync('package.json')) {
        const pkg = JSON.parse(fs.readFileSync('package.json', 'utf-8')) as {
            dependencies?: Record<string, string>;
            devDependencies?: Record<string, string>;
            scripts?: Record<string, string>;
            main?: string;
        };
        const deps = { ...pkg.dependencies, ...pkg.devDependencies };
        const scripts = pkg.scripts || {};

        if (deps.next) {
            appType = 'next'; buildCommand = `${runCmd} build`; startCommand = `${runCmd} start`;
            log.info('✨ Detected: Next.js');
        } else if (deps.vite) {
            appType = 'vite'; buildCommand = `${runCmd} build`; startCommand = 'npx -y serve -s dist -l tcp://0.0.0.0:3000';
            log.info('✨ Detected: Vite');
        } else if (deps['react-scripts']) {
            appType = 'react'; buildCommand = `${runCmd} build`; startCommand = 'npx -y serve -s build -l tcp://0.0.0.0:3000';
            log.info('✨ Detected: Create React App');
        } else if (deps['@angular/cli']) {
            appType = 'angular'; buildCommand = `${runCmd} build`; startCommand = 'npx -y serve -s dist/browser -l 3000';
            log.info('✨ Detected: Angular');
        } else {
            appType = 'node';
            log.info('✨ Detected: Node.js / Express');
            if (scripts.build) { buildCommand = `${runCmd} build`; }
            startCommand = scripts.start ? `${runCmd} start` : pkg.main ? `node ${pkg.main}` : 'node index.js';
        }
    } else if (fs.existsSync('index.html')) {
        appType = 'static'; log.info('✨ Detected: Static Website');
    }

    /* ── Save config ─────────────────────────────────────────────────── */
    saveProjectConfig({
        projectName: answers.projectName,
        gitRepo: answers.gitRepo,
        domain: answers.domain || undefined,
        appType,
        deploymentType: 'docker',
        mode: answers.domain ? 'domain' : 'port',
    });
    log.success('autoflow.config.json created ✔');

    /* ── Dockerfile generation ───────────────────────────────────────── */
    let dockerfile = '';

    if (appType === 'static') {
        dockerfile = `FROM nginx:alpine\nRUN rm -rf /usr/share/nginx/html/*\nCOPY . /usr/share/nginx/html\nEXPOSE 80\nCMD ["nginx", "-g", "daemon off;"]`;
    } else {
        let setupPM = '';
        if (packageManager === 'pnpm') { setupPM = 'RUN npm install -g pnpm'; installCmd = 'RUN pnpm install'; }
        else if (packageManager === 'yarn') { installCmd = 'RUN yarn install'; }
        else { installCmd = 'RUN npm install'; }

        const lockFile = packageManager === 'pnpm' ? 'pnpm-lock.yaml ' : packageManager === 'yarn' ? 'yarn.lock ' : '';

        dockerfile = `FROM node:20-alpine
WORKDIR /app
${setupPM}
COPY package*.json ${lockFile}./
${installCmd}
COPY . .
${buildCommand ? `RUN ${buildCommand}` : '# No build step required'}
EXPOSE 3000
CMD ${JSON.stringify(startCommand.split(' '))}`;
    }

    fs.writeFileSync('Dockerfile', dockerfile.trim());
    log.success('Dockerfile generated (Production-ready 🚀)');

    if (!fs.existsSync('.dockerignore')) {
        fs.writeFileSync('.dockerignore', `node_modules\n.git\n.env\ndist\nbuild\nautoflow.config.json`);
        log.success('.dockerignore created ✔');
    }

    log.success(`\nInitialization complete! 🎉 Ready to deploy "${answers.projectName}".`);
}

export default init;

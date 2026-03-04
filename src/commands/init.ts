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
    strictCI: boolean;
  }>([
    {
      type: 'input',
      name: 'projectName',
      message: 'Project name:',
      default: path.basename(process.cwd()).toLowerCase().replace(/\s+/g, '-'),
    },
    { type: 'input', name: 'gitRepo', message: 'GitHub repository URL:' },
    { type: 'input', name: 'domain', message: 'Domain / Subdomain (leave empty for IP:PORT mode):' },
    {
      type: 'confirm',
      name: 'strictCI',
      message: 'Enable Strict CI? (Fails deployment if tests are missing or placeholders)',
      default: true,
    },
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
    strictCI: answers.strictCI,
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

  // Ensure .env is in .gitignore
  if (fs.existsSync('.gitignore')) {
    const gitignore = fs.readFileSync('.gitignore', 'utf-8');
    if (!gitignore.includes('.env')) {
      fs.appendFileSync('.gitignore', '\n# AutoFlow Secrets\n.env\nautoflow.config.json\n');
      log.success('.env added to .gitignore ✔');
    }
  } else {
    fs.writeFileSync('.gitignore', 'node_modules\n.env\nautoflow.config.json\n.DS_Store\n');
    log.success('.gitignore created ✔');
  }

  // Generate .autoflow.yml for static projects (required by CI checks)
  if (appType === 'static' && !fs.existsSync('.autoflow.yml') && !fs.existsSync('.autoflow.yaml')) {
    const autoflowYml = [
      `project: ${answers.projectName}`,
      `type: static`,
      ``,
      `# AutoFlow static project config`,
      `# Generated by "autoflow init"`,
    ].join('\n');
    fs.writeFileSync('.autoflow.yml', autoflowYml);
    log.success('.autoflow.yml created ✔');
  }

  // .nojekyll — prevents GitHub Pages from running Jekyll on raw HTML sites
  // Without this, GitHub Pages fails on sites that use underscored dirs, etc.
  if (appType === 'static' && !fs.existsSync('.nojekyll')) {
    fs.writeFileSync('.nojekyll', '');
    log.success('.nojekyll created ✔');
  }

  log.success(`\nInitialization complete! 🎉 Ready to deploy "${answers.projectName}".`);

  /* ── GitHub Actions CI workflow ───────────────────────────────────── */
  const workflowDir = '.github/workflows';
  const workflowPath = `${workflowDir}/ci.yml`;

  if (!fs.existsSync(workflowPath)) {
    fs.mkdirSync(workflowDir, { recursive: true });

    let ciWorkflow: string;

    if (appType === 'static') {
      ciWorkflow = `name: CI

on:
  push:
    branches: [ main, master ]
  pull_request:
    branches: [ main, master ]

jobs:
  validate:
    name: Validate Static Project
    runs-on: ubuntu-latest

    steps:
      - name: Checkout code
        uses: actions/checkout@v4

      - name: Check required files exist
        run: |
          echo "Checking required files..."
          [ -f "index.html" ]       || { echo "❌ index.html missing";       exit 1; }
          [ -f "Dockerfile" ]       || { echo "❌ Dockerfile missing";       exit 1; }
          [ -f ".autoflow.yml" ] || [ -f ".autoflow.yaml" ] || { echo "❌ .autoflow.yml missing"; exit 1; }
          echo "✅ All required files present."

      - name: Count HTML files
        run: |
          count=$(find . -name "*.html" -not -path "./.git/*" | wc -l)
          echo "✅ Found $count HTML file(s). Static validation passed."
`;

      // Also generate a workflow to suppress the GitHub Pages deployment
      // (GitHub auto-triggers 'pages build and deployment' when Pages is enabled;
      //  this site is served via AutoFlow on a private server — Pages is not needed)
      const disablePagesWorkflow = `name: Disable GitHub Pages

# This workflow cancels the auto-triggered "pages build and deployment" job.
# This project is deployed via AutoFlow to a private server — GitHub Pages is not used.

on:
  workflow_run:
    workflows: ["pages build and deployment"]
    types: [requested]

jobs:
  cancel-pages:
    runs-on: ubuntu-latest
    steps:
      - name: Cancel GitHub Pages deployment
        uses: styfle/cancel-workflow-action@0.12.1
        with:
          workflow_id: \${{ github.event.workflow_run.id }}
          access_token: \${{ github.token }}
`;
      fs.writeFileSync(`${workflowDir}/disable-pages.yml`, disablePagesWorkflow);
      log.success('.github/workflows/disable-pages.yml created ✔');
    } else {
      const pmInstall = packageManager === 'pnpm'
        ? 'run: npm install -g pnpm && pnpm install'
        : packageManager === 'yarn'
          ? 'run: yarn install'
          : 'run: npm install';

      const pmInstallYaml = packageManager === 'pnpm'
        ? `      - name: Install dependencies\n        run: npm install -g pnpm && pnpm install`
        : packageManager === 'yarn'
          ? `      - name: Install dependencies\n        run: yarn install`
          : `      - name: Install dependencies\n        run: npm install`;

      const buildStep = buildCommand
        ? `\n      - name: Build\n        run: ${buildCommand}`
        : '';

      const testStep = `\n      - name: Run tests\n        run: ${packageManager === 'pnpm' ? 'pnpm test' : packageManager === 'yarn' ? 'yarn test' : 'npm test'}\n        continue-on-error: false`;

      ciWorkflow = `name: CI

on:
  push:
    branches: [ main, master ]
  pull_request:
    branches: [ main, master ]

jobs:
  ci:
    name: Build & Test
    runs-on: ubuntu-latest

    steps:
      - name: Checkout code
        uses: actions/checkout@v4

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: '${packageManager === 'pnpm' ? 'npm' : packageManager}'
${pmInstallYaml}${buildStep}${testStep}
`;
    }

    fs.writeFileSync(workflowPath, ciWorkflow);
    log.success('.github/workflows/ci.yml created ✔');
  }
}

export default init;

import fs from 'fs';
import path from 'path';
import { saveProjectConfig } from './config';
import log from '../utils/logger';
import { execSync } from 'child_process';

export interface InitOptions {
    projectName: string;
    gitRepo: string;
    domain: string;
    strictCI: boolean;
    useVolumes?: boolean;
}

export async function initProjectCore(projectPath: string, options: InitOptions): Promise<void> {
    const { projectName, gitRepo, domain, strictCI, useVolumes } = options;

    if (!/^[a-z0-9-]+$/i.test(projectName)) {
        throw new Error('Project name can only contain alphanumeric characters and dashes.');
    }

    log.header('AUTOFLOW INITIALIZATION');

    try {
        execSync(`git ls-remote ${gitRepo}`, { stdio: 'ignore' });
    } catch (e) {
        log.warning('Private repository detected (authentication required).');
        log.warning('Please configure a Git Token in the Vault Settings before deploying.');
    }

    /* ── Smart Detection Engine ─────────────────────────────────────── */
    let appType = 'node';
    let buildCommand: string | null = null;
    let startCommand = 'npm start';
    let packageManager = 'npm';
    let installCmd = 'npm install';
    let runCmd = 'npm run';

    const p = (filename: string) => path.join(projectPath, filename);

    // ── Go ──────────────────────────────────────────────────────────────
    if (fs.existsSync(p('go.mod'))) {
        appType = 'go';
    }
    // ── Java / Spring ───────────────────────────────────────────────────
    else if (fs.existsSync(p('pom.xml'))) {
        appType = 'java';
    }
    // ── Ruby on Rails ───────────────────────────────────────────────────
    else if (fs.existsSync(p('Gemfile'))) {
        const gemfileContent = fs.readFileSync(p('Gemfile'), 'utf-8');
        if (gemfileContent.includes('rails')) {
            appType = 'rails';
        } else {
            appType = 'ruby';
        }
    }
    // ── Python: Django or Flask ─────────────────────────────────────────
    else if (fs.existsSync(p('requirements.txt'))) {
        const req = fs.readFileSync(p('requirements.txt'), 'utf-8').toLowerCase();
        if (fs.existsSync(p('manage.py')) && req.includes('django')) {
            appType = 'django';
        } else if (req.includes('flask')) {
            appType = 'flask';
        } else {
            appType = 'python';
        }
    }
    // ── PHP (plain) ─────────────────────────────────────────────────────
    else if (fs.existsSync(p('index.php')) || fs.existsSync(p('public/index.php'))) {
        appType = 'php';
    }
    // ── Node.js / JS Frameworks ─────────────────────────────────────────
    else if (fs.existsSync(p('package.json'))) {
        if (fs.existsSync(p('pnpm-lock.yaml'))) {
            packageManager = 'pnpm'; installCmd = 'pnpm install'; runCmd = 'pnpm run';
        } else if (fs.existsSync(p('yarn.lock'))) {
            packageManager = 'yarn'; installCmd = 'yarn install'; runCmd = 'yarn run';
        }

        const pkg = JSON.parse(fs.readFileSync(p('package.json'), 'utf-8')) as any;
        const deps = { ...pkg.dependencies, ...pkg.devDependencies };
        const scripts = pkg.scripts || {};

        if (deps.next) {
            appType = 'next'; buildCommand = `${runCmd} build`; startCommand = `${runCmd} start`;
        } else if (deps.vite) {
            appType = 'vite'; buildCommand = `${runCmd} build`; startCommand = 'npx -y serve -s dist -l tcp://0.0.0.0:3000';
        } else if (deps['react-scripts']) {
            appType = 'react'; buildCommand = `${runCmd} build`; startCommand = 'npx -y serve -s build -l tcp://0.0.0.0:3000';
        } else if (deps['@angular/cli']) {
            appType = 'angular'; buildCommand = `${runCmd} build`; startCommand = 'npx -y serve -s dist/browser -l 3000';
        } else if (deps.nuxt) {
            appType = 'nuxt'; buildCommand = `${runCmd} build`; startCommand = 'node .output/server/index.mjs';
        } else if (deps.vue) {
            appType = 'vue'; buildCommand = `${runCmd} build`; startCommand = 'npx -y serve -s dist -l tcp://0.0.0.0:3000';
        } else {
            appType = 'node';
            if (scripts.build) { buildCommand = `${runCmd} build`; }
            startCommand = scripts.start ? `${runCmd} start` : pkg.main ? `node ${pkg.main}` : 'node index.js';
        }
    }
    // ── Static HTML ─────────────────────────────────────────────────────
    else if (fs.existsSync(p('index.html'))) {
        appType = 'static';
    }

    /* ── Volume Detection (Persistence) ────────────────────────────── */
    let volumes: string[] = [];
    if (useVolumes) {
        const suggestedVolumes: string[] = [];
        const commonDataPaths = ['data', 'database', 'storage', 'uploads'];
        for (const dataPath of commonDataPaths) {
            if (fs.existsSync(p(dataPath))) suggestedVolumes.push(`/${dataPath}`);
        }
        try {
            const files = fs.readdirSync(projectPath);
            for (const f of files) {
                if (f.endsWith('.sqlite') || f.endsWith('.db')) {
                    suggestedVolumes.push(`/${f}`);
                }
            }
        } catch { /* ignore */ }
        volumes = suggestedVolumes;
    }

    /* ── Save config ─────────────────────────────────────────────────── */
    saveProjectConfig({
        projectName,
        gitRepo,
        domain: domain || undefined,
        appType,
        deploymentType: 'docker',
        mode: domain ? 'domain' : 'port',
        strictCI,
        volumes: volumes.length > 0 ? volumes : undefined,
    }, projectPath);
    
    log.info(`✨ Detected: ${appType === 'static' ? 'Static Website' : appType === 'node' ? 'Node.js App' : appType}`);
    log.success('autoflow.config.json created');

    /* ── Dockerfile generation ───────────────────────────────────────── */
    let dockerfile = '';
    let dockerignoreExtras = '';

    // ─── PHP (plain) ────────────────────────────────────────────────────
    if (appType === 'php') {
        dockerfile = `FROM php:8.2-apache\n\nRUN a2enmod rewrite\nRUN docker-php-ext-install mysqli pdo pdo_mysql\nRUN sed -i 's/Listen 80/Listen 3000/' /etc/apache2/ports.conf && \\\n    sed -i 's/<VirtualHost \\*:80>/<VirtualHost *:3000>/' /etc/apache2/sites-enabled/000-default.conf && \\\n    echo "UseCanonicalName Off" >> /etc/apache2/apache2.conf && \\\n    echo "UseCanonicalPhysicalPort Off" >> /etc/apache2/apache2.conf\n\nWORKDIR /var/www/html\nCOPY . .\nRUN chown -R www-data:www-data /var/www/html\nEXPOSE 3000\nCMD ["apache2-foreground"]`;
        dockerignoreExtras = '\n# PHP\n.env\nvendor/\n*.log';
    }
    // ─── Python / Django ────────────────────────────────────────────────
    else if (appType === 'django') {
        dockerfile = `FROM python:3.12-slim\nWORKDIR /app\nCOPY requirements.txt .\nRUN pip install --no-cache-dir -r requirements.txt\nCOPY . .\nEXPOSE 8000\nCMD ["gunicorn", "--bind", "0.0.0.0:8000", "--workers", "3", "wsgi:application"]`;
        dockerignoreExtras = '\n# Python\n__pycache__/\n*.pyc\n*.pyo\n.venv/\nvenv/\n.env';
    }
    // ─── Python / Flask ─────────────────────────────────────────────────
    else if (appType === 'flask' || appType === 'python') {
        dockerfile = `FROM python:3.12-slim\nWORKDIR /app\nCOPY requirements.txt .\nRUN pip install --no-cache-dir -r requirements.txt\nCOPY . .\nEXPOSE 5000\nCMD ["gunicorn", "--bind", "0.0.0.0:5000", "--workers", "3", "app:app"]`;
        dockerignoreExtras = '\n# Python\n__pycache__/\n*.pyc\n*.pyo\n.venv/\nvenv/\n.env';
    }
    // ─── Ruby on Rails ──────────────────────────────────────────────────
    else if (appType === 'rails' || appType === 'ruby') {
        dockerfile = `FROM ruby:3.3-slim\nRUN apt-get update -qq && apt-get install -y build-essential libpq-dev nodejs\nWORKDIR /app\nCOPY Gemfile Gemfile.lock ./\nRUN bundle install --without development test\nCOPY . .\nEXPOSE 3000\nCMD ["bundle", "exec", "rails", "server", "-b", "0.0.0.0", "-p", "3000"]`;
        dockerignoreExtras = '\n# Ruby\ntmp/\nlog/\n.env\nstorage/\n*.log';
    }
    // ─── Go ─────────────────────────────────────────────────────────────
    else if (appType === 'go') {
        let moduleName = 'app';
        try {
            const gomod = fs.readFileSync(p('go.mod'), 'utf-8');
            const match = gomod.match(/^module\s+(\S+)/m);
            if (match) moduleName = path.basename(match[1]);
        } catch { /* use default */ }
        dockerfile = `# ── Stage 1: Build ─────────────────────────────────────────────────\nFROM golang:1.22-alpine AS builder\nWORKDIR /build\nCOPY go.mod go.sum ./\nRUN go mod download\nCOPY . .\nRUN CGO_ENABLED=0 GOOS=linux go build -o ${moduleName} .\n\n# ── Stage 2: Run ───────────────────────────────────────────────────\nFROM alpine:latest\nRUN apk --no-cache add ca-certificates\nWORKDIR /app\nCOPY --from=builder /build/${moduleName} .\nEXPOSE 8080\nCMD ["./${moduleName}"]`;
        dockerignoreExtras = '\n# Go\nbin/\n*.exe\n.env';
    }
    // ─── Java / Spring Boot ─────────────────────────────────────────────
    else if (appType === 'java') {
        dockerfile = `# ── Stage 1: Build ─────────────────────────────────────────────────\nFROM eclipse-temurin:21-jdk AS builder\nWORKDIR /build\nCOPY pom.xml .\nCOPY src ./src\nRUN apt-get update && apt-get install -y maven\nRUN mvn clean package -DskipTests\n\n# ── Stage 2: Run ───────────────────────────────────────────────────\nFROM eclipse-temurin:21-jre\nWORKDIR /app\nCOPY --from=builder /build/target/*.jar app.jar\nEXPOSE 8080\nCMD ["java", "-jar", "app.jar"]`;
        dockerignoreExtras = '\n# Java / Maven\ntarget/\n*.class\n.env';
    }
    // ─── Static HTML ────────────────────────────────────────────────────
    else if (appType === 'static') {
        dockerfile = `FROM nginx:alpine\nRUN rm -rf /usr/share/nginx/html/*\nCOPY . /usr/share/nginx/html\nEXPOSE 80\nCMD ["nginx", "-g", "daemon off;"]`;
    }
    // ─── Node.js / JS Frameworks ────────────────────────────────────────
    else {
        let setupPM = '';
        let dockerInstallCmd = 'RUN npm install';
        if (packageManager === 'pnpm') {
            setupPM = 'RUN npm install -g pnpm';
            dockerInstallCmd = 'RUN pnpm install';
        } else if (packageManager === 'yarn') {
            dockerInstallCmd = 'RUN yarn install';
        }
        const lockFile = packageManager === 'pnpm' ? 'pnpm-lock.yaml ' : packageManager === 'yarn' ? 'yarn.lock ' : '';
        dockerfile = `FROM node:20-alpine\nWORKDIR /app\n${setupPM}\nCOPY package*.json ${lockFile}./\n${dockerInstallCmd}\nCOPY . .\n${buildCommand ? `RUN ${buildCommand}` : '# No build step required'}\nEXPOSE 3000\nCMD ${JSON.stringify(startCommand.split(' '))}`;
    }

    fs.writeFileSync(p('Dockerfile'), dockerfile.trim());
    log.success('Dockerfile generated (Production-ready 🚀)');

    /* ── .dockerignore ───────────────────────────────────────────────── */
    if (!fs.existsSync(p('.dockerignore'))) {
        const baseIgnore = `.git\n.env\nautoflow.config.json${dockerignoreExtras}`;
        const nodeIgnore = ['node', 'next', 'nuxt', 'vue', 'vite', 'react', 'angular'].includes(appType)
            ? '\nnode_modules\ndist\nbuild'
            : '';
        fs.writeFileSync(p('.dockerignore'), baseIgnore + nodeIgnore);
        log.success('.dockerignore created');
    }

    /* ── .gitignore ──────────────────────────────────────────────────── */
    if (fs.existsSync(p('.gitignore'))) {
        const gitignore = fs.readFileSync(p('.gitignore'), 'utf-8');
        const additions: string[] = [];
        if (!gitignore.includes('.env')) additions.push('.env');
        if (!gitignore.includes('autoflow.config.json')) additions.push('autoflow.config.json');
        if (additions.length > 0) {
            fs.appendFileSync(p('.gitignore'), `\n# AutoFlow Secrets\n${additions.join('\n')}\n`);
        }
    } else {
        const baseGitignore = `# AutoFlow\n.env\nautoflow.config.json\n.DS_Store\nThumbs.db\n`;
        fs.writeFileSync(p('.gitignore'), baseGitignore);
    }

    /* ── Static-only extras ──────────────────────────────────────────── */
    if (appType === 'static') {
        if (!fs.existsSync(p('.autoflow.yml')) && !fs.existsSync(p('.autoflow.yaml'))) {
            fs.writeFileSync(p('.autoflow.yml'), [
                `project: ${projectName}`,
                `type: static`,
                ``,
                `# AutoFlow static project config`,
                `# Generated by "autoflow init"`,
            ].join('\n'));
            log.success('.autoflow.yml created');
        }
        if (!fs.existsSync(p('.nojekyll'))) {
            fs.writeFileSync(p('.nojekyll'), '');
            log.success('.nojekyll created');
        }
    }

    /* ── GitHub Actions CI workflow ───────────────────────────────────── */
    const workflowDir = p('.github/workflows');
    const workflowPath = p('.github/workflows/ci.yml');

    if (!fs.existsSync(workflowPath)) {
        fs.mkdirSync(workflowDir, { recursive: true });

        let ciWorkflow = '';
        const ciHeader = `name: CI\n\non:\n  push:\n    branches: [ main, master ]\n  pull_request:\n    branches: [ main, master ]\n\njobs:\n`;

        // ── PHP CI ──────────────────────────────────────────────────────
        if (appType === 'php') {
            const composerStep = fs.existsSync(p('composer.json'))
                ? `\n      - name: Install Composer dependencies\n        run: composer install --no-progress --prefer-dist --optimize-autoloader`
                : '';
            ciWorkflow = `${ciHeader}  ci:\n    name: PHP Syntax Check\n    runs-on: ubuntu-latest\n\n    steps:\n      - name: Checkout code\n        uses: actions/checkout@v4\n\n      - name: Setup PHP\n        uses: shivammathur/setup-php@v2\n        with:\n          php-version: '8.2'\n          extensions: mysqli, pdo, pdo_mysql\n${composerStep}\n      - name: PHP syntax check (lint all .php files)\n        run: find . -name "*.php" -not -path "./.git/*" -not -path "./vendor/*" | xargs -I{} php -l {}\n\n      - name: Check Dockerfile exists\n        run: |\n          [ -f "Dockerfile" ] || { echo "❌ Dockerfile missing"; exit 1; }\n          echo "✅ Dockerfile present"\n`;
        }
        // ── Django CI ───────────────────────────────────────────────────
        else if (appType === 'django') {
            ciWorkflow = `${ciHeader}  ci:\n    name: Django CI\n    runs-on: ubuntu-latest\n\n    steps:\n      - name: Checkout code\n        uses: actions/checkout@v4\n\n      - name: Setup Python\n        uses: actions/setup-python@v5\n        with:\n          python-version: '3.12'\n\n      - name: Install dependencies\n        run: pip install -r requirements.txt\n\n      - name: Django system check\n        run: python manage.py check --deploy --settings=\${{ env.DJANGO_SETTINGS_MODULE || 'settings' }}\n        continue-on-error: true\n\n      - name: Run tests\n        run: python manage.py test\n        continue-on-error: false\n`;
        }
        // ── Flask / Python CI ────────────────────────────────────────────
        else if (appType === 'flask' || appType === 'python') {
            ciWorkflow = `${ciHeader}  ci:\n    name: Python / Flask CI\n    runs-on: ubuntu-latest\n\n    steps:\n      - name: Checkout code\n        uses: actions/checkout@v4\n\n      - name: Setup Python\n        uses: actions/setup-python@v5\n        with:\n          python-version: '3.12'\n\n      - name: Install dependencies\n        run: pip install -r requirements.txt\n\n      - name: Run tests\n        run: |\n          if command -v pytest &> /dev/null; then\n            pytest\n          else\n            python -m unittest discover\n          fi\n        continue-on-error: false\n`;
        }
        // ── Rails / Ruby CI ──────────────────────────────────────────────
        else if (appType === 'rails' || appType === 'ruby') {
            ciWorkflow = `${ciHeader}  ci:\n    name: Ruby on Rails CI\n    runs-on: ubuntu-latest\n\n    steps:\n      - name: Checkout code\n        uses: actions/checkout@v4\n\n      - name: Setup Ruby\n        uses: ruby/setup-ruby@v1\n        with:\n          ruby-version: '3.3'\n          bundler-cache: true\n\n      - name: Run tests\n        run: |\n          if bundle exec rake --tasks | grep -q "spec"; then\n            bundle exec rspec\n          else\n            bundle exec rails test\n          fi\n`;
        }
        // ── Go CI ────────────────────────────────────────────────────────
        else if (appType === 'go') {
            ciWorkflow = `${ciHeader}  ci:\n    name: Go CI\n    runs-on: ubuntu-latest\n\n    steps:\n      - name: Checkout code\n        uses: actions/checkout@v4\n\n      - name: Setup Go\n        uses: actions/setup-go@v5\n        with:\n          go-version: '1.22'\n\n      - name: Download modules\n        run: go mod download\n\n      - name: Build\n        run: go build ./...\n\n      - name: Run tests\n        run: go test ./... -v\n`;
        }
        // ── Java / Spring CI ─────────────────────────────────────────────
        else if (appType === 'java') {
            ciWorkflow = `${ciHeader}  ci:\n    name: Java / Maven CI\n    runs-on: ubuntu-latest\n\n    steps:\n      - name: Checkout code\n        uses: actions/checkout@v4\n\n      - name: Setup Java\n        uses: actions/setup-java@v4\n        with:\n          distribution: 'temurin'\n          java-version: '21'\n          cache: 'maven'\n\n      - name: Build and test\n        run: mvn --batch-mode clean test\n\n      - name: Package (verify JAR builds)\n        run: mvn --batch-mode package -DskipTests\n`;
        }
        // ── Static CI ────────────────────────────────────────────────────
        else if (appType === 'static') {
            ciWorkflow = `${ciHeader}  validate:\n    name: Validate Static Project\n    runs-on: ubuntu-latest\n\n    steps:\n      - name: Checkout code\n        uses: actions/checkout@v4\n\n      - name: Check required files exist\n        run: |\n          echo "Checking required files..."\n          [ -f "index.html" ]       || { echo "❌ index.html missing";       exit 1; }\n          [ -f "Dockerfile" ]       || { echo "❌ Dockerfile missing";       exit 1; }\n          [ -f ".autoflow.yml" ] || [ -f ".autoflow.yaml" ] || { echo "❌ .autoflow.yml missing"; exit 1; }\n          echo "✅ All required files present."\n\n      - name: Count HTML files\n        run: |\n          count=$(find . -name "*.html" -not -path "./.git/*" | wc -l)\n          echo "✅ Found $count HTML file(s). Static validation passed."\n`;
            
            const disablePagesWorkflow = `name: Disable GitHub Pages\n\n# This workflow cancels the auto-triggered "pages build and deployment" job.\n# This project is deployed via AutoFlow to a private server — GitHub Pages is not used.\n\non:\n  workflow_run:\n    workflows: ["pages build and deployment"]\n    types: [requested]\n\njobs:\n  cancel-pages:\n    runs-on: ubuntu-latest\n    steps:\n      - name: Cancel GitHub Pages deployment\n        uses: styfle/cancel-workflow-action@0.12.1\n        with:\n          workflow_id: \${{ github.event.workflow_run.id }}\n          access_token: \${{ github.token }}\n`;
            fs.writeFileSync(p('.github/workflows/disable-pages.yml'), disablePagesWorkflow);
        }
        // ── Node.js / JS Frameworks CI ───────────────────────────────────
        else {
            const pmInstallYaml = packageManager === 'pnpm'
                ? `      - name: Install dependencies\n        run: npm install -g pnpm && pnpm install`
                : packageManager === 'yarn'
                    ? `      - name: Install dependencies\n        run: yarn install`
                    : `      - name: Install dependencies\n        run: npm install`;
            const buildStep = buildCommand
                ? `\n      - name: Build\n        run: ${buildCommand}`
                : '';
            const testStep = `\n      - name: Run tests\n        run: ${packageManager === 'pnpm' ? 'pnpm test' : packageManager === 'yarn' ? 'yarn test' : 'npm test'}\n        continue-on-error: false`;

            ciWorkflow = `${ciHeader}  ci:\n    name: Build & Test\n    runs-on: ubuntu-latest\n\n    steps:\n      - name: Checkout code\n        uses: actions/checkout@v4\n\n      - name: Setup Node.js\n        uses: actions/setup-node@v4\n        with:\n          node-version: '20'\n          cache: '${packageManager === 'pnpm' ? 'npm' : packageManager}'\n${pmInstallYaml}${buildStep}${testStep}\n`;
        }

        if (ciWorkflow) {
            fs.writeFileSync(workflowPath, ciWorkflow);
            log.success('.github/workflows/ci.yml created');
        }
    }
    
    log.info(`Initialization complete! 🎉 Ready to deploy "${projectName}".\n`);
}

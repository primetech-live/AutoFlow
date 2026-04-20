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

  // ── Go ──────────────────────────────────────────────────────────────
  if (fs.existsSync('go.mod')) {
    appType = 'go';
    log.info('✨ Detected: Go');
  }
  // ── Java / Spring ───────────────────────────────────────────────────
  else if (fs.existsSync('pom.xml')) {
    appType = 'java';
    log.info('✨ Detected: Java / Spring Boot');
  }
  // ── Ruby on Rails ───────────────────────────────────────────────────
  else if (fs.existsSync('Gemfile')) {
    const gemfileContent = fs.readFileSync('Gemfile', 'utf-8');
    if (gemfileContent.includes('rails')) {
      appType = 'rails';
      log.info('✨ Detected: Ruby on Rails');
    } else {
      appType = 'ruby';
      log.info('✨ Detected: Ruby');
    }
  }
  // ── Python: Django or Flask ─────────────────────────────────────────
  else if (fs.existsSync('requirements.txt')) {
    const req = fs.readFileSync('requirements.txt', 'utf-8').toLowerCase();
    if (fs.existsSync('manage.py') && req.includes('django')) {
      appType = 'django';
      log.info('✨ Detected: Python / Django');
    } else if (req.includes('flask')) {
      appType = 'flask';
      log.info('✨ Detected: Python / Flask');
    } else {
      appType = 'python';
      log.info('✨ Detected: Python');
    }
  }
  // ── PHP (plain) ─────────────────────────────────────────────────────
  // Note: Laravel (artisan) is intentionally excluded — DB migration complexity
  // is managed separately by the user via phpMyAdmin.
  else if (fs.existsSync('index.php') || fs.existsSync('public/index.php')) {
    appType = 'php';
    log.info('✨ Detected: PHP');
    log.info('  ℹ️  DB Note: AutoFlow deploys CODE only. Please set up your MySQL database');
    log.info('     manually on the server (import your .sql via phpMyAdmin).');
  }
  // ── Node.js / JS Frameworks ─────────────────────────────────────────
  else if (fs.existsSync('package.json')) {
    if (fs.existsSync('pnpm-lock.yaml')) {
      packageManager = 'pnpm'; installCmd = 'pnpm install'; runCmd = 'pnpm run';
      log.info('📦 Detected: pnpm');
    } else if (fs.existsSync('yarn.lock')) {
      packageManager = 'yarn'; installCmd = 'yarn install'; runCmd = 'yarn run';
      log.info('📦 Detected: yarn');
    } else {
      log.info('📦 Detected: npm');
    }

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
  }
  // ── Static HTML ─────────────────────────────────────────────────────
  else if (fs.existsSync('index.html')) {
    appType = 'static';
    log.info('✨ Detected: Static Website');
  }

  /* ── Volume Detection (Persistence) ────────────────────────────── */
  const suggestedVolumes: string[] = [];
  const commonDataPaths = ['data', 'database', 'storage', 'uploads'];
  for (const p of commonDataPaths) {
    if (fs.existsSync(p)) suggestedVolumes.push(`/${p}`);
  }
  // Check for sqlite files in root
  try {
    const files = fs.readdirSync(process.cwd());
    for (const f of files) {
      if (f.endsWith('.sqlite') || f.endsWith('.db')) {
        suggestedVolumes.push(`/${f}`);
      }
    }
  } catch { /* ignore */ }

  let volumes: string[] = [];
  if (suggestedVolumes.length > 0) {
    log.info(`\n💾 Persistence: AutoFlow detected possible data paths: ${suggestedVolumes.join(', ')}`);
    const { useVolumes } = await inquirer.prompt<{ useVolumes: boolean }>({
      type: 'confirm',
      name: 'useVolumes',
      message: 'Enable persistent volumes for these paths? (Recommended for databases)',
      default: true,
    });
    if (useVolumes) {
      volumes = suggestedVolumes;
    }
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
    volumes: volumes.length > 0 ? volumes : undefined,
  });
  log.success('autoflow.config.json created ✔');

  /* ── Dockerfile generation ───────────────────────────────────────── */
  let dockerfile = '';
  let dockerignoreExtras = '';

  // ─── PHP (plain) ────────────────────────────────────────────────────
  if (appType === 'php') {
    dockerfile = `FROM php:8.2-apache

# Enable Apache mod_rewrite for clean URLs
RUN a2enmod rewrite

# Install PHP extensions commonly needed for DB connectivity
RUN docker-php-ext-install mysqli pdo pdo_mysql

# Move Apache from port 80 → port 3000 (AutoFlow expects 3000)
RUN sed -i 's/Listen 80/Listen 3000/' /etc/apache2/ports.conf && \\
    sed -i 's/<VirtualHost \\*:80>/<VirtualHost *:3000>/' /etc/apache2/sites-enabled/000-default.conf && \\
    echo "UseCanonicalName Off" >> /etc/apache2/apache2.conf && \\
    echo "UseCanonicalPhysicalPort Off" >> /etc/apache2/apache2.conf

WORKDIR /var/www/html

# Copy all project files
COPY . .

# Fix permissions
RUN chown -R www-data:www-data /var/www/html

EXPOSE 3000
CMD ["apache2-foreground"]`;
    dockerignoreExtras = '\n# PHP\n.env\nvendor/\n*.log';
  }

  // ─── Python / Django ────────────────────────────────────────────────
  else if (appType === 'django') {
    dockerfile = `FROM python:3.12-slim

WORKDIR /app

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

EXPOSE 8000
CMD ["gunicorn", "--bind", "0.0.0.0:8000", "--workers", "3", "wsgi:application"]`;
    dockerignoreExtras = '\n# Python\n__pycache__/\n*.pyc\n*.pyo\n.venv/\nvenv/\n.env';
  }

  // ─── Python / Flask ─────────────────────────────────────────────────
  else if (appType === 'flask' || appType === 'python') {
    dockerfile = `FROM python:3.12-slim

WORKDIR /app

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

EXPOSE 5000
CMD ["gunicorn", "--bind", "0.0.0.0:5000", "--workers", "3", "app:app"]`;
    dockerignoreExtras = '\n# Python\n__pycache__/\n*.pyc\n*.pyo\n.venv/\nvenv/\n.env';
  }

  // ─── Ruby on Rails ──────────────────────────────────────────────────
  else if (appType === 'rails' || appType === 'ruby') {
    dockerfile = `FROM ruby:3.3-slim

RUN apt-get update -qq && apt-get install -y build-essential libpq-dev nodejs

WORKDIR /app

COPY Gemfile Gemfile.lock ./
RUN bundle install --without development test

COPY . .

EXPOSE 3000
CMD ["bundle", "exec", "rails", "server", "-b", "0.0.0.0", "-p", "3000"]`;
    dockerignoreExtras = '\n# Ruby\ntmp/\nlog/\n.env\nstorage/\n*.log';
  }

  // ─── Go ─────────────────────────────────────────────────────────────
  else if (appType === 'go') {
    // Read module name from go.mod for the binary name
    let moduleName = 'app';
    try {
      const gomod = fs.readFileSync('go.mod', 'utf-8');
      const match = gomod.match(/^module\s+(\S+)/m);
      if (match) moduleName = path.basename(match[1]);
    } catch { /* use default */ }

    dockerfile = `# ── Stage 1: Build ─────────────────────────────────────────────────
FROM golang:1.22-alpine AS builder

WORKDIR /build

COPY go.mod go.sum ./
RUN go mod download

COPY . .
RUN CGO_ENABLED=0 GOOS=linux go build -o ${moduleName} .

# ── Stage 2: Run ───────────────────────────────────────────────────
FROM alpine:latest

RUN apk --no-cache add ca-certificates

WORKDIR /app
COPY --from=builder /build/${moduleName} .

EXPOSE 8080
CMD ["./${moduleName}"]`;
    dockerignoreExtras = '\n# Go\nbin/\n*.exe\n.env';
  }

  // ─── Java / Spring Boot ─────────────────────────────────────────────
  else if (appType === 'java') {
    dockerfile = `# ── Stage 1: Build ─────────────────────────────────────────────────
FROM eclipse-temurin:21-jdk AS builder

WORKDIR /build

COPY pom.xml .
COPY src ./src
RUN apt-get update && apt-get install -y maven
RUN mvn clean package -DskipTests

# ── Stage 2: Run ───────────────────────────────────────────────────
FROM eclipse-temurin:21-jre

WORKDIR /app
COPY --from=builder /build/target/*.jar app.jar

EXPOSE 8080
CMD ["java", "-jar", "app.jar"]`;
    dockerignoreExtras = '\n# Java / Maven\ntarget/\n*.class\n.env';
  }

  // ─── Static HTML ────────────────────────────────────────────────────
  else if (appType === 'static') {
    dockerfile = `FROM nginx:alpine
RUN rm -rf /usr/share/nginx/html/*
COPY . /usr/share/nginx/html
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]`;
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

    dockerfile = `FROM node:20-alpine
WORKDIR /app
${setupPM}
COPY package*.json ${lockFile}./
${dockerInstallCmd}
COPY . .
${buildCommand ? `RUN ${buildCommand}` : '# No build step required'}
EXPOSE 3000
CMD ${JSON.stringify(startCommand.split(' '))}`;
  }

  fs.writeFileSync('Dockerfile', dockerfile.trim());
  log.success('Dockerfile generated (Production-ready 🚀)');

  /* ── .dockerignore ───────────────────────────────────────────────── */
  if (!fs.existsSync('.dockerignore')) {
    const baseIgnore = `.git\n.env\nautoflow.config.json${dockerignoreExtras}`;
    // Add node_modules only for JS-based projects
    const nodeIgnore = ['node', 'next', 'vite', 'react', 'angular'].includes(appType)
      ? '\nnode_modules\ndist\nbuild'
      : '';
    fs.writeFileSync('.dockerignore', baseIgnore + nodeIgnore);
    log.success('.dockerignore created ✔');
  }

  /* ── .gitignore ──────────────────────────────────────────────────── */
  if (fs.existsSync('.gitignore')) {
    const gitignore = fs.readFileSync('.gitignore', 'utf-8');
    const additions: string[] = [];
    if (!gitignore.includes('.env')) additions.push('.env');
    if (!gitignore.includes('autoflow.config.json')) additions.push('autoflow.config.json');
    if (additions.length > 0) {
      fs.appendFileSync('.gitignore', `\n# AutoFlow Secrets\n${additions.join('\n')}\n`);
      log.success('.gitignore updated ✔');
    }
  } else {
    const baseGitignore = `# AutoFlow\n.env\nautoflow.config.json\n.DS_Store\nThumbs.db\n`;
    fs.writeFileSync('.gitignore', baseGitignore);
    log.success('.gitignore created ✔');
  }

  /* ── Static-only extras ──────────────────────────────────────────── */
  if (appType === 'static') {
    if (!fs.existsSync('.autoflow.yml') && !fs.existsSync('.autoflow.yaml')) {
      fs.writeFileSync('.autoflow.yml', [
        `project: ${answers.projectName}`,
        `type: static`,
        ``,
        `# AutoFlow static project config`,
        `# Generated by "autoflow init"`,
      ].join('\n'));
      log.success('.autoflow.yml created ✔');
    }
    if (!fs.existsSync('.nojekyll')) {
      fs.writeFileSync('.nojekyll', '');
      log.success('.nojekyll created ✔');
    }
  }

  log.success(`\nInitialization complete! 🎉 Ready to deploy "${answers.projectName}".`);

  /* ── GitHub Actions CI workflow ───────────────────────────────────── */
  const workflowDir = '.github/workflows';
  const workflowPath = `${workflowDir}/ci.yml`;

  if (!fs.existsSync(workflowPath)) {
    fs.mkdirSync(workflowDir, { recursive: true });

    let ciWorkflow = '';

    const ciHeader = `name: CI

on:
  push:
    branches: [ main, master ]
  pull_request:
    branches: [ main, master ]

jobs:
`;

    // ── PHP CI ──────────────────────────────────────────────────────
    if (appType === 'php') {
      const composerStep = fs.existsSync('composer.json')
        ? `
      - name: Install Composer dependencies
        run: composer install --no-progress --prefer-dist --optimize-autoloader`
        : '';

      ciWorkflow = `${ciHeader}  ci:
    name: PHP Syntax Check
    runs-on: ubuntu-latest

    steps:
      - name: Checkout code
        uses: actions/checkout@v4

      - name: Setup PHP
        uses: shivammathur/setup-php@v2
        with:
          php-version: '8.2'
          extensions: mysqli, pdo, pdo_mysql
${composerStep}
      - name: PHP syntax check (lint all .php files)
        run: find . -name "*.php" -not -path "./.git/*" -not -path "./vendor/*" | xargs -I{} php -l {}

      - name: Check Dockerfile exists
        run: |
          [ -f "Dockerfile" ] || { echo "❌ Dockerfile missing"; exit 1; }
          echo "✅ Dockerfile present"
`;
    }

    // ── Django CI ───────────────────────────────────────────────────
    else if (appType === 'django') {
      ciWorkflow = `${ciHeader}  ci:
    name: Django CI
    runs-on: ubuntu-latest

    steps:
      - name: Checkout code
        uses: actions/checkout@v4

      - name: Setup Python
        uses: actions/setup-python@v5
        with:
          python-version: '3.12'

      - name: Install dependencies
        run: pip install -r requirements.txt

      - name: Django system check
        run: python manage.py check --deploy --settings=\${{ env.DJANGO_SETTINGS_MODULE || 'settings' }}
        continue-on-error: true

      - name: Run tests
        run: python manage.py test
        continue-on-error: false
`;
    }

    // ── Flask / Python CI ────────────────────────────────────────────
    else if (appType === 'flask' || appType === 'python') {
      ciWorkflow = `${ciHeader}  ci:
    name: Python / Flask CI
    runs-on: ubuntu-latest

    steps:
      - name: Checkout code
        uses: actions/checkout@v4

      - name: Setup Python
        uses: actions/setup-python@v5
        with:
          python-version: '3.12'

      - name: Install dependencies
        run: pip install -r requirements.txt

      - name: Run tests
        run: |
          if command -v pytest &> /dev/null; then
            pytest
          else
            python -m unittest discover
          fi
        continue-on-error: false
`;
    }

    // ── Rails / Ruby CI ──────────────────────────────────────────────
    else if (appType === 'rails' || appType === 'ruby') {
      ciWorkflow = `${ciHeader}  ci:
    name: Ruby on Rails CI
    runs-on: ubuntu-latest

    steps:
      - name: Checkout code
        uses: actions/checkout@v4

      - name: Setup Ruby
        uses: ruby/setup-ruby@v1
        with:
          ruby-version: '3.3'
          bundler-cache: true

      - name: Run tests
        run: |
          if bundle exec rake --tasks | grep -q "spec"; then
            bundle exec rspec
          else
            bundle exec rails test
          fi
`;
    }

    // ── Go CI ────────────────────────────────────────────────────────
    else if (appType === 'go') {
      ciWorkflow = `${ciHeader}  ci:
    name: Go CI
    runs-on: ubuntu-latest

    steps:
      - name: Checkout code
        uses: actions/checkout@v4

      - name: Setup Go
        uses: actions/setup-go@v5
        with:
          go-version: '1.22'

      - name: Download modules
        run: go mod download

      - name: Build
        run: go build ./...

      - name: Run tests
        run: go test ./... -v
`;
    }

    // ── Java / Spring CI ─────────────────────────────────────────────
    else if (appType === 'java') {
      ciWorkflow = `${ciHeader}  ci:
    name: Java / Maven CI
    runs-on: ubuntu-latest

    steps:
      - name: Checkout code
        uses: actions/checkout@v4

      - name: Setup Java
        uses: actions/setup-java@v4
        with:
          distribution: 'temurin'
          java-version: '21'
          cache: 'maven'

      - name: Build and test
        run: mvn --batch-mode clean test

      - name: Package (verify JAR builds)
        run: mvn --batch-mode package -DskipTests
`;
    }

    // ── Static CI ────────────────────────────────────────────────────
    else if (appType === 'static') {
      ciWorkflow = `${ciHeader}  validate:
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

      // Suppress GitHub Pages
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

      ciWorkflow = `${ciHeader}  ci:
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

    if (ciWorkflow) {
      fs.writeFileSync(workflowPath, ciWorkflow);
      log.success('.github/workflows/ci.yml created ✔');
    }
  }
}

export default init;

<div align="center">

```text
    ___         __        ________                
   /   | __  __/ /_____  / ____/ /___ _      __   
  / /| |/ / / / __/ __ \/ /_  / / __ \ | /| / /   
 / ___ / /_/ / /_/ /_/ / __/ / / /_/ / |/ |/ /    
/_/  |_\__,_/\__/\____/_/   /_/\____/|__/|__/     
```

  <img src="build/icon-1.png" alt="AutoFlow Logo" width="120" />
  <h1>🚀 AutoFlow vNext</h1>
  <p><strong>The Ultimate Desktop Application and Standalone Command Line Interface for Zero Configuration Private Cloud Deployments.</strong></p>
  <p>
    <img src="https://img.shields.io/node/v/autoflow-tech?style=for-the-badge" alt="Node Version" />
    <img src="https://img.shields.io/badge/License-MIT-green.svg?style=for-the-badge" alt="License" />
    <img src="https://img.shields.io/badge/Version-1.1.1-blue.svg?style=for-the-badge" alt="Version" />
    <img src="https://img.shields.io/badge/Platform-Windows%20%7C%20macOS%20%7C%20Linux-lightgrey?style=for-the-badge" alt="Platforms" />
  </p>
</div>

---

## 📑 Table of Contents

1. [🌟 Introduction](#-introduction)
2. [✨ Core Features](#-core-features)
3. [🏗️ Architecture & Internal Mechanics](#️-architecture--internal-mechanics)
4. [📦 Installation Guide](#-installation-guide)
5. [⚡ Quick Start Guide](#-quick-start-guide)
6. [🖥️ Desktop Application Overview](#️-desktop-application-overview)
7. [⌨️ CLI Reference & Comprehensive Examples](#️-cli-reference--comprehensive-examples)
8. [🚀 Deployment Pipeline (Deep Dive)](#-deployment-pipeline-deep-dive)
9. [🌐 Framework Support & Detection Engine](#-framework-support--detection-engine)
10. [⚙️ Advanced Configuration (autoflow.config.json)](#️-advanced-configuration)
11. [🔐 Security & Secrets Management](#-security--secrets-management)
12. [📈 Monitoring & Telemetry](#-monitoring--telemetry)
13. [🕸️ Network & Proxy Configurations](#️-network--proxy-configurations)
14. [☁️ Database Setups](#️-database-setups)
15. [🎓 Tutorials](#-tutorials)
    - [Migrating from Heroku to AutoFlow](#tutorial-migrating-from-heroku-to-autoflow)
    - [Deploying a Next.js App with PostgreSQL](#tutorial-deploying-nextjs-with-postgres)
    - [Scaling Node.js to Multiple Cores](#tutorial-scaling-nodejs-to-multiple-cores)
    - [Automated Deployments via GitHub Actions](#tutorial-automated-deployments-via-github-actions)
16. [🔌 Extending AutoFlow (Plugins & Webhooks)](#-extending-autoflow)
17. [🛠 Troubleshooting & Common Errors](#-troubleshooting--common-errors)
18. [🧠 Advanced Troubleshooting Trees](#-advanced-troubleshooting-trees)
19. [💻 Supported Operating Systems Matrices](#-supported-operating-systems-matrices)
20. [❓ Frequently Asked Questions (FAQ)](#-frequently-asked-questions-faq)
21. [🤝 Contributing Guide](#-contributing-guide)
22. [📚 API Reference (Internal Methods)](#-api-reference-internal-methods)
23. [📖 Glossary of Terms](#-glossary-of-terms)
24. [🔄 CI/CD Integrations (Detailed)](#-cicd-integrations-detailed)
25. [🎨 Theming and UI Customization](#-theming-and-ui-customization-desktop-app)
26. [📈 AutoFlow vs Competitors](#-autoflow-vs-competitors)
27. [🧪 Advanced Security Architectures](#-advanced-security-architectures)
28. [📜 License](#-license)

---

## 🌟 Introduction

AutoFlow is a powerful local orchestration engine that transforms any low-cost Virtual Private Server (VPS) into a fully automated, private Platform-as-a-Service (PaaS). It was born out of the necessity to free developers from the rigid ecosystems of commercial hosting providers. 

Unlike commercial hosting providers that lock you into their ecosystem, charge high monthly fees, and limit your server resources, AutoFlow gives you absolute control. It connects directly to your raw servers, configures them, compiles your code remotely, and routes internet traffic securely—all without requiring you to upload your sensitive credentials to a third-party database. AutoFlow is built for students, hobbyists, startups, and enterprise teams looking to reclaim their deployment independence.

With AutoFlow, your infrastructure code is minimized to zero. You don't need to write complex Dockerfiles, CI/CD YAML files, or configure reverse proxies. AutoFlow handles it all transactionally.

AutoFlow works with any cloud provider: AWS EC2, DigitalOcean Droplets, Linode, Vultr, Hetzner, or even a local Raspberry Pi on your home network. If it runs Linux and has SSH access, AutoFlow can orchestrate it.

---

## ✨ Core Features

### Decoupled Local Vault
All SSH keys, deployment tokens, and environment variables are heavily encrypted (AES-256-GCM) and stored locally on your hard drive. There is no central point of failure, and your credentials are never exposed to the public internet or stored on our servers.

### Zero Configuration Deployments
Drop AutoFlow into any repository. It automatically detects your tech stack—whether it's Node, Python, Go, Java, PHP, Ruby, Rust, Deno, Bun, or Static HTML apps. AutoFlow automatically generates optimized multi-stage build processes. No `Dockerfile` is required.

### Zero-Downtime Deployments
AutoFlow executes transactional deployments. It snapshots your active container and only switches internet traffic if the new build passes rigorous health checks. If a build crashes or fails health checks, it instantly rolls back to the previous stable state without dropping a single user request.

### Auto-Swap Memory Protection
Compiling heavy frameworks (like Next.js or Nuxt) on 1GB RAM servers often causes Out-Of-Memory crashes. AutoFlow intelligently detects server memory limitations and dynamically mounts Virtual Swap space to prevent crashes, deleting it immediately after the build to preserve SSD lifespan.

### Automated SSL & Proxies
AutoFlow configures Nginx and Let's Encrypt certificates automatically. It maps your subdomains, handles port forwarding, and ensures all traffic is upgraded to HTTPS effortlessly.

### Real-Time Telemetry
The Desktop dashboard streams CPU, RAM, and Disk metrics directly from your remote servers via an active SSH multiplex, entirely removing the need to install heavy third-party monitoring agents on your VPS.

### Multi-Server Orchestration
Manage multiple servers from a single interface. Group servers by environment (Staging, Production) and deploy applications across them simultaneously.

### Log Sanitization
Watch real-time build logs with peace of mind. Sensitive tokens (like `AWS_ACCESS_KEY` or `DATABASE_URL`) are automatically scrubbed and replaced with `[REDACTED]` before hitting your screen or log files.

---

## 🏗️ Architecture & Internal Mechanics

AutoFlow operates using a **Synchronized Dual-Channel Architecture**.

```mermaid
graph TD;
    A[Desktop Application] <--> C[Encrypted Local Vault];
    B[CLI Interface] <--> C;
    C --> D[Orchestration Engine];
    D --> E[Secure SSH Multiplexer];
    E --> F[Remote VPS Node 1];
    E --> G[Remote VPS Node 2];
    F --> H[Docker Daemon];
    G --> I[Docker Daemon];
    F --> J[Nginx Proxy];
    G --> K[Nginx Proxy];
    H --> L[Container A];
    H --> M[Container B];
```

You can interact with AutoFlow using either the visual **Desktop Application** or the headless **Command Line Interface**. Both interfaces share a localized, encrypted configuration vault (`~/.autoflow/vault.db`). If you add an environment variable in the Desktop App, it is instantly available when you run `autoflow deploy` in the terminal.

### The SSH Multiplexer
Instead of creating a new SSH connection for every command (which is slow and inefficient), AutoFlow establishes a master connection (multiplexing) using `ControlMaster` and `ControlPath`. This means transferring files via SFTP, polling Docker stats, and streaming logs all happen instantly over the pre-established secure tunnel.

### Encryption Mechanics
The Vault uses AES-256-GCM. 
1. When you set a Master Password, AutoFlow derives a 256-bit key using PBKDF2 with 100,000 iterations and a random salt.
2. Every item (server IP, SSH key content, environment variable) is encrypted with this key and a unique Initialization Vector (IV).
3. The auth tag generated by GCM ensures the database cannot be tampered with.

---

## 📦 Installation Guide

AutoFlow is distributed as a single standalone executable bundle, removing the need for `npm` or global dependencies that cause supply chain vulnerabilities.

### macOS
Download the latest installer (`.dmg`) from the official releases page.
1. Open the `.dmg` file.
2. Drag and drop the AutoFlow application into your `Applications` folder.
3. Open AutoFlow from Spotlight or Launchpad. The application will guide you through onboarding and automatically inject the `autoflow` command into your system `PATH`.

### Windows
Download the latest installer (`.exe`) from the official releases page.
1. Run the `.exe` file.
2. Follow the standard Windows installation wizard.
3. Once installed, the CLI will be available in your Command Prompt, PowerShell, or Windows Terminal.

### Linux
Download the `.deb` or `.AppImage` files.

**For Debian/Ubuntu:**
```bash
sudo dpkg -i autoflow-vNext-linux.deb
sudo apt-get install -f # To resolve any missing dependencies
```

**For Fedora/CentOS:**
```bash
sudo rpm -i autoflow-vNext-linux.rpm
```

**Using AppImage:**
```bash
chmod +x AutoFlow-vNext.AppImage
./AutoFlow-vNext.AppImage
```

---

## ⚡ Quick Start Guide

1. **Launch the App:** Open the AutoFlow Desktop Application and complete the onboarding to set your Master Password. This password encrypts your local vault.
2. **Connect a Server:** Navigate to the **Servers** tab and input your VPS IP Address, SSH Port, SSH User, and the path to your private SSH Key.
3. **Import a Project:** Click **Import Project** and select a local code directory containing your app. AutoFlow will automatically detect the framework.
4. **Configure Environment:** Add any necessary environment variables for your project.
5. **Deploy:** Click **Deploy**. AutoFlow will scan the codebase, stream it to your server, compile a Docker image natively, configure Nginx and SSL, and route traffic to it.

---

## 🖥️ Desktop Application Overview

The Desktop Application removes the friction of server administration, offering a beautiful, intuitive interface built with React and Electron.

- **Dashboard:** Provides an overview of all your connected servers and deployed applications.
- **Live Telemetry:** Monitor physical memory usage, CPU load, disk space, and container health in real-time.
- **Log Viewer:** Access interactive, sanitized logs for both deployment processes and running applications.
- **Lifecycle Controls:** Start, Stop, Restart, and Rebuild Docker containers with a single click.
- **Secret Manager:** A dedicated UI for managing environment variables and deployment secrets securely.
- **Server Manager:** Easily add, edit, or remove connected VPS instances.
- **Terminal Emulator:** A built-in xterm.js instance allowing you to open a bash shell inside any running container directly from the UI.

---

## ⌨️ CLI Reference & Comprehensive Examples

The CLI allows for rapid automation, script integration, and headless execution. All commands use the `autoflow` binary. Below are exhaustive examples.

### Project Management

#### `autoflow project import [path]`
Imports a project into the AutoFlow vault.
```bash
$ autoflow project import /var/www/my-api
✔ Project 'my-api' imported successfully.
✔ Detected Framework: Node.js (Express)
```

#### `autoflow project list`
Lists all imported projects.
```bash
$ autoflow project list
ID      NAME        FRAMEWORK    LAST DEPLOY
1       my-api      Node.js      2 hours ago
2       frontend    Next.js      5 mins ago
```

#### `autoflow project remove [project-name]`
Removes a project from the AutoFlow vault. Does not delete local files.
```bash
$ autoflow project remove my-api
⚠ Are you sure you want to remove 'my-api' from AutoFlow? (y/N) y
✔ Project removed.
```

### Server Management

#### `autoflow server add`
Interactive wizard to register a new remote server. Prompts for IP, User, Port, and SSH Key.
```bash
$ autoflow server add
? Server IP or Hostname: 198.51.100.24
? SSH Username: root
? SSH Port: 22
? SSH Key Path: ~/.ssh/id_rsa
✔ Server '198.51.100.24' added securely to vault.
```

#### `autoflow server list`
Lists all registered servers and their connection status.
```bash
$ autoflow server list
ID      IP               USER    STATUS
1       198.51.100.24    root    🟢 Online
2       198.51.100.25    root    🔴 Offline
```

#### `autoflow server test [server-id]`
Tests the SSH connection and permission levels for a specific server.
```bash
$ autoflow server test 1
▶ Authenticating via SSH Key... OK
▶ Checking Docker daemon... OK (Version 24.0.5)
▶ Checking Nginx... OK
▶ Checking UFW Firewall... OK
✔ Server is ready for AutoFlow orchestration.
```

### Environment Variables

#### `autoflow env set [KEY]=[VALUE]`
Injects a secure environment variable into the current project context.
```bash
$ autoflow env set DATABASE_URL=postgres://user:pass@host/db
✔ Environment variable DATABASE_URL secured.
```

#### `autoflow env list`
Lists all configured environment variables (values are masked by default).
```bash
$ autoflow env list
KEY                  VALUE
DATABASE_URL         ********
NODE_ENV             production
STRIPE_API_KEY       ********
```

#### `autoflow env remove [KEY]`
Deletes an environment variable.
```bash
$ autoflow env remove STRIPE_API_KEY
✔ Environment variable removed.
```

### Deployment Pipeline

#### `autoflow deploy`
Initiates the Zero-Downtime Deployment pipeline for the current project.
```bash
$ autoflow deploy
▶ Stage 1: Verifying Local Configuration...
▶ Stage 2: Streaming code to 198.51.100.24... (1.2MB/s)
▶ Stage 3: Provisioning 1024MB Virtual Swap...
▶ Stage 4: Compiling Docker Image (my-api:v2)...
   Step 1/5: FROM node:18-alpine
   Step 2/5: RUN npm ci --omit=dev
   Step 3/5: COPY . .
   Step 4/5: RUN npm run build
   Step 5/5: CMD ["npm", "start"]
▶ Stage 5: Injecting Environment Variables...
▶ Stage 6: Starting new container (my-api_tmp)...
▶ Stage 7: Running Health Checks on port 3000... (Attempt 1/5) OK
▶ Stage 8: Hot-swapping Nginx configuration...
▶ Stage 9: Tearing down Virtual Swap and old containers...
✔ Deployment Successful! Zero downtime achieved.
```

Options:
- `--server [id]`: Specify the target server (overrides default).
- `--force`: Bypasses safety checks (use with caution).
- `--no-cache`: Forces a clean Docker build without cache.

#### `autoflow rollback`
Reverts the application to the previous stable snapshot.
```bash
$ autoflow rollback
▶ Rolling back to previous snapshot...
▶ Hot-swapping Nginx proxy...
✔ Rollback complete. Application is stable.
```

#### `autoflow logs`
Streams real-time application logs from the active container.
```bash
$ autoflow logs --tail 100
[my-api] Server listening on port 3000
[my-api] Database connection established
[my-api] GET /users/123 200 OK
```

### Container Operations

#### `autoflow container exec [container_name] [command]`
Opens a secure shell directly inside a running container or executes a specific command.
```bash
$ autoflow container exec my_api npm run migrate
Running database migrations...
Migration V1__CreateUsersTable applied.
Migration V2__AddIndexes applied.
```

#### `autoflow container restart`
Restarts the active containers for the current project.
```bash
$ autoflow container restart
▶ Restarting my_api container...
✔ Container restarted.
```

---

## 🚀 Deployment Pipeline (Deep Dive)

AutoFlow orchestration follows a strict, highly optimized 13-stage pipeline to ensure zero downtime and absolute reliability. This is how AutoFlow ensures your server never crashes during an update, even on a $5 DigitalOcean droplet.

1. **Local Configuration Merge & Verification:** AutoFlow gathers local configurations, encrypted variables, and framework data from your `autoflow.config.json` and local vault.
2. **Connection & Pre-flight Checks:** Establishes the SSH multiplex connection and verifies server health. If the disk is 99% full, AutoFlow will abort before touching anything.
3. **Code Streaming:** Streams the source code over encrypted SFTP to a temporary remote build directory (`/var/autoflow/builds/app_name`). It intentionally avoids using Git on the remote server to prevent credential leakage.
4. **Virtual Swap Provisioning:** Analyzes available physical RAM. If below a safe threshold (e.g., 1GB), it dynamically allocates a `swapfile` (e.g., 2GB) using `dd` and `mkswap` to prevent OOM (Out of Memory) errors during compilation.
5. **Dockerfile Generation:** If no Dockerfile exists in your repo, the framework engine parses your project structure and generates an optimized, multi-stage Dockerfile based on the detected stack.
6. **Remote Image Compilation:** Compiles the Docker image directly on the host server using `docker build`. This eliminates the need for expensive third-party container registries (like AWS ECR or Docker Hub).
7. **Snapshotting:** The currently running container (if any) is labeled as the `rollback_target`.
8. **Secure Environment Variable Injection:** Environment variables are securely passed into the new container environment directly via Docker daemon API, meaning they are never written to disk in plain text.
9. **Container Initialization:** The new container is spun up alongside the old one. At this moment, both v1 and v2 are running simultaneously.
10. **Health Checks:** AutoFlow aggressively polls the new container on its exposed port. It expects a 200 OK response on the configured health check path.
11. **Proxy Cutover:** Nginx configurations are hot-reloaded (`nginx -s reload`) to point internet traffic to the new container. This step ensures zero dropped requests.
12. **Reversion Handling (Failure Mode):** If Step 10 fails, AutoFlow instantly aborts, destroys the new container, and leaves the old one untouched. An alert is sent to your dashboard.
13. **Cleanup & Swap Teardown:** Removes temporary build files, prunes dangling Docker images, and deletes the Virtual Swap space to preserve SSD health.

---

## 🌐 Framework Support & Detection Engine

AutoFlow features a robust, heuristic-based framework detection engine. It looks at specific files in your repository to determine exactly how to build and run your app. Here is a deep dive into how each framework is handled.

### Node.js (Express, Fastify, NestJS)
- **Detection:** Presence of `package.json`.
- **Behavior:** AutoFlow detects your package manager (`npm`, `yarn`, `pnpm`, `bun` via lockfiles). It installs dependencies. If it finds a `build` script in `package.json`, it runs it. It then executes the `start` script.
- **Docker Strategy:** Multi-stage build using `node:18-alpine`. Dev dependencies are omitted in the final image to keep it lean.

### Frontend (React, Vue, Vite, Next.js, Nuxt)
- **Detection:** Presence of `next.config.js`, `vite.config.js`, or React dependencies.
- **Behavior (SSR):** Next.js and Nuxt apps are built and run using Node.js servers, similar to standard Node apps but utilizing their specific production commands.
- **Behavior (Static):** SPA apps built with Vite or Create React App are compiled into a `dist` or `build` folder. AutoFlow then serves these static files directly using a high-performance Nginx Alpine container, completely omitting Node.js from the production image.

### Python (Django, Flask, FastAPI)
- **Detection:** Presence of `requirements.txt`, `Pipfile`, or `pyproject.toml`.
- **Behavior:** Installs dependencies via `pip` or `pipenv`. 
- **Docker Strategy:** Uses `python:3.11-slim`. AutoFlow automatically wraps your application with a production-grade WSGI/ASGI server (`gunicorn` or `uvicorn`) based on the detected framework.

### Go
- **Detection:** Presence of `go.mod`.
- **Behavior:** Executes a multi-stage build. 
- **Docker Strategy:** Compiles the Go binary in a full OS container (`golang:1.21-alpine`), then copies the standalone executable into an ultra-lean `scratch` container. This results in microscopic image sizes (often <15MB) and maximum security (no shell inside the container).

### PHP (Laravel, Symfony)
- **Detection:** Presence of `composer.json` or `.php` files in root.
- **Behavior:** Automatically runs `composer install` without dev dependencies.
- **Docker Strategy:** Bundles your code into an image running PHP-FPM and Nginx. Sets correct permissions for storage and cache directories (specifically for Laravel).

### Ruby (Rails, Sinatra)
- **Detection:** Presence of `Gemfile`.
- **Behavior:** Runs `bundle install`. Detects Rails or Sinatra.
- **Docker Strategy:** Uses `ruby:3.2-alpine`. If Rails is detected, it automatically precompiles assets (`rails assets:precompile`) and configures the Puma web server.

### Java (Spring Boot)
- **Detection:** Presence of `pom.xml` (Maven) or `build.gradle` (Gradle).
- **Behavior:** Multi-stage build that compiles the JAR/WAR.
- **Docker Strategy:** Compiles using a Maven/Gradle image, then runs the generated artifact using the latest OpenJDK JRE image (`eclipse-temurin:17-jre-alpine`).

### Rust
- **Detection:** Presence of `Cargo.toml`.
- **Behavior:** Multi-stage build. Uses `cargo build --release`.
- **Docker Strategy:** Compiles in a full Rust environment, extracts the compiled binary, and places it in a `debian:bullseye-slim` container for execution.

### Deno & Bun
- **Detection:** Presence of `deno.json` or `bun.lockb`.
- **Behavior:** Skips Node.js entirely and uses the official Deno or Bun alpine images. Ultra-fast startup times and minimal resource overhead.

### Static HTML
- **Detection:** Presence of `index.html` without other framework identifiers.
- **Behavior:** Simply places the files into an alpine Nginx container configured for optimal static file caching.

---

## ⚙️ Advanced Configuration (`autoflow.config.json`)

While AutoFlow promotes zero-configuration, you can override default behaviors using an `autoflow.config.json` file in your project root. This file gives you granular control over the build and deployment process.

### Full Schema Reference

```json
{
  "name": "my-awesome-app",
  "port": 3000,
  "build": {
    "command": "npm run custom-build",
    "dockerfile": "./docker/Production.Dockerfile",
    "context": ".",
    "args": {
      "NODE_ENV": "production",
      "API_URL": "https://api.myapp.com"
    }
  },
  "deploy": {
    "healthCheckPath": "/api/health",
    "healthCheckPort": 3000,
    "timeout": 120,
    "replicas": 2,
    "preDeployCommand": "npm run migrate:up",
    "postDeployCommand": "curl -X POST https://hooks.slack.com/services/..."
  },
  "proxy": {
    "domains": ["api.myapp.com", "www.myapp.com"],
    "forceHttps": true,
    "websockets": true,
    "cors": {
      "origins": ["https://frontend.myapp.com"],
      "methods": ["GET", "POST", "OPTIONS"]
    },
    "rateLimit": {
      "requests": 100,
      "window": "1m"
    }
  },
  "volumes": [
    {
      "hostPath": "/var/autoflow/data/uploads",
      "containerPath": "/app/public/uploads"
    }
  ],
  "crons": [
    {
      "schedule": "0 0 * * *",
      "command": "node scripts/daily-cleanup.js"
    }
  ]
}
```

### Explanation of Properties
- **`build.dockerfile`**: Bypass AutoFlow's framework detection and use your own custom Dockerfile.
- **`build.args`**: Pass build-time arguments (ARG) to Docker.
- **`deploy.replicas`**: Run multiple instances of your container behind the Nginx load balancer (requires sufficient server RAM).
- **`deploy.preDeployCommand`**: A script to run *inside* the new container before traffic is routed to it. Perfect for running Prisma or TypeORM database migrations.
- **`proxy.websockets`**: Automatically configures Nginx to handle HTTP Upgrade headers for Socket.io or native WebSockets.
- **`proxy.rateLimit`**: Protect your app from DDoS attacks by enabling Nginx rate limiting on your endpoint.
- **`volumes`**: Persist data across deployments. If your app handles user uploads (like images), you must map a volume, otherwise the files will be destroyed on the next deployment.
- **`crons`**: AutoFlow will automatically configure Linux cron jobs on the host server that execute commands inside your running container.

---

## 🔐 Security & Secrets Management

Security is a primary design pillar of AutoFlow. We operate under a Zero-Trust local model.

### AES-256-GCM Encryption
Your local configuration file (`~/.autoflow/vault.db`) is fully encrypted using your Master Password. The Desktop app and CLI decrypt it in memory during runtime. If your laptop is stolen, attackers cannot read your server SSH keys or database passwords.

### No Third-Party Access
AutoFlow communicates directly from your machine to your server via SSH (Port 22). There is no middleman service. Your code is never pushed to our servers.

### Log Scrubbing Engine
The logging engine uses regex patterns and exact-match filters to scrub known secret formats from logs before they are rendered in the UI or written to disk.
- Automatically scrubs AWS Keys (`AKIA...`).
- Automatically scrubs Stripe Secrets (`sk_live_...`).
- Scans `process.env` keys and blanks out matching values in stdout streams.

### SSH Hardening Compatibility
AutoFlow interacts via standard SSH protocols. You are highly encouraged to secure your VPS:
1. Disable root login in `/etc/ssh/sshd_config`.
2. Disable password authentication (use key-based only).
3. Use a non-standard SSH port (e.g., 2222).
AutoFlow fully supports these hardened setups. Just specify the user and port in the Server config.

---

## 📈 Monitoring & Telemetry

AutoFlow provides localized monitoring that doesn't consume server resources. 

Instead of running a heavy daemon (like Datadog, Prometheus, or New Relic) on your VPS, AutoFlow streams `/proc` metrics (like `/proc/stat` and `/proc/meminfo`) over the existing SSH connection *only* when the Desktop app is open. This means 0% overhead on your server when you aren't actively looking at the dashboard.

- **CPU Usage:** Per-core and aggregate utilization graphs.
- **Memory:** Active vs. Cached vs. Free memory, plus Swap usage visualization.
- **Disk:** Monitor root volume capacity to prevent database or log exhaustion. AutoFlow warns you if disk space falls below 10%.
- **Container Health:** Uptime, restart counts, memory consumption per container, and live status of every deployed application.

---

## 🕸️ Network & Proxy Configurations

AutoFlow acts as a reverse proxy orchestrator, automatically configuring Nginx on the host machine to route traffic efficiently.

### Automatic SSL Provisioning
If you provide domains in the configuration or UI (e.g., `api.myapp.com`), AutoFlow interfaces with Let's Encrypt via `certbot` to provision SSL certificates. 
1. AutoFlow configures Nginx to answer the ACME challenge.
2. Certbot requests the certificate.
3. AutoFlow configures SSL certificates in the Nginx server block.
4. It sets up a cron job (`certbot renew --quiet`) to ensure your certificates never expire.

### Cloudflare Integration
If you use Cloudflare proxying (Orange Cloud), AutoFlow detects the Cloudflare IPs and configures Nginx to trust Cloudflare headers, ensuring your application receives the true client IP (`X-Forwarded-For`).

---

## ☁️ Database Setups

While AutoFlow excels at stateless application deployment, we recommend handling stateful databases carefully.

### Using Managed Databases (Recommended)
For production environments, the best practice is to use a managed database (like Supabase, AWS RDS, MongoDB Atlas, or PlanetScale) and provide the connection string to AutoFlow via Environment Variables. This decouples your compute from your data, allowing AutoFlow to recreate your application server at any time without data loss.

### Local Containerized Databases (Hobbyists)
For hobby projects or staging environments, you can use AutoFlow to deploy a database alongside your app.
1. Create a `docker-compose.yml` containing PostgreSQL or MySQL.
2. Tell AutoFlow to deploy the compose file.
3. **CRITICAL:** You must configure a persistent volume (e.g., `-v /var/lib/postgresql/data`) to ensure database files survive container restarts.

---

## 🎓 Tutorials

### Tutorial: Migrating from Heroku to AutoFlow

If you are tired of Heroku's pricing, AutoFlow is the perfect drop-in replacement.

**Step 1: Export Environment Variables**
In Heroku, go to Settings -> Config Vars, and copy them.
In AutoFlow, run:
```bash
autoflow env set DATABASE_URL=...
autoflow env set NODE_ENV=production
```

**Step 2: Add a Server**
Rent a $5 DigitalOcean droplet.
```bash
autoflow server add
# Enter droplet IP and root SSH key
```

**Step 3: Deploy**
Navigate to your Heroku repo locally.
```bash
autoflow project import .
autoflow deploy
```
AutoFlow will automatically detect your `Procfile` and use it to start the web process!

### Tutorial: Deploying Next.js with PostgreSQL

**1. Create a Next.js App**
```bash
npx create-next-app@latest my-blog
cd my-blog
```

**2. Setup Prisma**
```bash
npm install prisma --save-dev
npx prisma init
```

**3. Configure AutoFlow**
Create `autoflow.config.json`:
```json
{
  "deploy": {
    "preDeployCommand": "npx prisma migrate deploy"
  }
}
```

**4. Add Database Secret and Deploy**
```bash
autoflow env set DATABASE_URL=postgres://user:pass@host/db
autoflow deploy
```
AutoFlow builds the Next.js standalone output, runs the migration before traffic switches, and ensures zero-downtime!

### Tutorial: Scaling Node.js to Multiple Cores

By default, Node.js runs on a single thread. If your VPS has 4 cores, 3 of them might be sitting idle. With AutoFlow, you can utilize all cores natively.

**1. Update `autoflow.config.json`:**
```json
{
  "name": "high-traffic-api",
  "deploy": {
    "replicas": 4
  }
}
```
**2. Deploy:**
```bash
autoflow deploy
```
AutoFlow will now spawn 4 instances of your container, and configure Nginx to load-balance traffic between them using the `upstream` directive and round-robin strategy!

### Tutorial: Automated Deployments via GitHub Actions

**1. Generate an Export Token**
```bash
autoflow vault export --ci
```
*(This generates a temporary token to decrypt your vault in CI environments).*

**2. Add Secret to GitHub**
Navigate to Repository Settings > Secrets, and add `AUTOFLOW_CI_TOKEN`.

**3. Create `.github/workflows/deploy.yml`**
```yaml
name: Deploy to AutoFlow
on:
  push:
    branches:
      - main
jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - name: Install AutoFlow
        run: npm install -g autoflow-cli
      - name: Run Deploy
        env:
          AUTOFLOW_CI_TOKEN: ${{ secrets.AUTOFLOW_CI_TOKEN }}
        run: autoflow deploy --server 1 --force
```
Every time you push to `main`, AutoFlow will execute the deployment!

---

## 🔌 Extending AutoFlow (Plugins & Webhooks)

AutoFlow is extensible via Webhooks and CLI hooks.

### Post-Deploy Webhooks
Want to notify Slack when a deployment succeeds? Add this to your config:
```json
"deploy": {
  "postDeployCommand": "curl -X POST -H 'Content-type: application/json' --data '{\"text\":\"Deployment Successful!\"}' https://hooks.slack.com/services/T0000/B000/XXXX"
}
```

### Pre-Deploy Hooks (Testing)
Run your tests *before* AutoFlow even attempts a deployment.
```json
"build": {
  "preCommand": "npm run test"
}
```
If tests fail, the deployment immediately aborts.

---

## 🛠 Troubleshooting & Common Errors

### `OOMKilled` (Out of Memory)
- **Cause:** Your application exceeded available RAM during compilation. This is extremely common when running Webpack/Vite on a 1GB VPS.
- **Solution:** AutoFlow attempts to mount Virtual Swap. If it still fails, your build process requires more physical RAM than Swap can emulate safely. Upgrade your VPS to at least 2GB RAM. Alternatively, compile your code locally and use AutoFlow's `autoflow deploy --prebuilt` flag.

### `SSH Connection Refused` or `Timeout`
- **Cause:** Incorrect SSH key, wrong port, firewall blocking your IP, or SSH daemon is down on the server.
- **Solution:** Verify your SSH credentials in the Server settings. Ensure your local IP is not banned by `fail2ban` on the server. Run `autoflow server test [id] --verbose` for detailed connection diagnostics.

### `Health Check Failed - Rollback Initiated`
- **Cause:** The new container started, but your application crashed on startup or did not bind to the expected port within the timeout window.
- **Solution:** Check the sanitized logs of the failed container using the AutoFlow UI or CLI (`autoflow logs --failed`). Common culprits are missing environment variables, malformed database URLs, or syntax errors in initialization code.

### `EADDRINUSE` (Address in Use)
- **Cause:** AutoFlow attempted to bind Nginx to port 80/443, but another process (like Apache) is already using it.
- **Solution:** Ensure you don't have existing web servers running natively on the VPS. Run `sudo systemctl stop apache2 && sudo systemctl disable apache2` on the server, then retry the AutoFlow deployment.

### `No Space Left on Device`
- **Cause:** The VPS hard drive is full, usually due to old Docker images or excessive logging.
- **Solution:** AutoFlow runs cleanup scripts, but you can manually clear space by running `autoflow container exec system 'docker system prune -a -f'`.

---

## 🧠 Advanced Troubleshooting Trees

### Debugging Failed Deployments
If a deployment fails, follow this diagnostic path:

1. **Did it fail during Stage 2 (Streaming)?**
   - Check if your SSH connection dropped.
   - Run `autoflow server test [id]`.
2. **Did it fail during Stage 4 (Compilation)?**
   - Read the build logs. Are you missing a dependency?
   - Did your framework output a syntax error?
   - Run `autoflow deploy --verbose` to see raw Docker output.
3. **Did it fail during Stage 7 (Health Check)?**
   - This means your code compiled, but it crashed when it started.
   - Run `autoflow logs --failed` to see the runtime exception.
   - Check if you mapped the correct port in `autoflow.config.json`.
4. **Did it fail during Stage 8 (Proxy Hot-swap)?**
   - Nginx could not parse the generated configuration.
   - ssh into your server and run `nginx -t` to find the syntax error.

---

## 💻 Supported Operating Systems Matrices

AutoFlow CLI and Desktop run natively on:
- **Windows:** 10, 11 (x64)
- **macOS:** 12+ (Intel & Apple Silicon M1/M2/M3)
- **Linux:** Ubuntu 20.04+, Debian 11+, Fedora 38+, Arch Linux

AutoFlow Remote Nodes (Your VPS) must run:
- **OS:** Ubuntu, Debian, CentOS, AlmaLinux, Rocky Linux, Alpine, or any system with `systemd`.
- **Architecture:** `x86_64` (amd64) or `aarch64` (ARM64/Raspberry Pi 4+).
- **RAM:** Minimum 512MB (1GB recommended for compiling).
- **Disk:** Minimum 5GB available.

---

## ❓ Frequently Asked Questions (FAQ)

**Q: Do I need to write a Dockerfile?**
A: No. AutoFlow's Framework Detection Engine writes optimized, multi-stage build configurations on the fly based on your `package.json`, `requirements.txt`, or `go.mod`. You can provide your own `Dockerfile` if you want custom behavior, and AutoFlow will prioritize it.

**Q: Where are my SSH keys stored?**
A: Exclusively on your local hard drive inside an AES-256-GCM encrypted database. They are never uploaded to a cloud. You can find the vault file at `~/.autoflow/vault.db` (do not lose your Master Password, or this file becomes unreadable).

**Q: Does AutoFlow require Docker Hub or AWS ECR?**
A: No. AutoFlow transfers your raw source code and builds the Docker image directly on the remote server. This keeps your code entirely private, avoids registry egress bandwidth costs, and simplifies the CI/CD pipeline.

**Q: Can I use AutoFlow on a Raspberry Pi?**
A: Yes! AutoFlow supports ARM architecture (arm64/aarch64) deployments seamlessly, provided the base Docker images exist for ARM (which almost all major frameworks support today). It's perfect for home-lab deployments.

**Q: What happens if my internet connection drops during deployment?**
A: AutoFlow pipelines are designed to be resilient. If your laptop's connection drops during source upload, it fails safely without touching the live app. If it drops during remote compilation, the remote worker script on the VPS continues independently and executes the deployment safely, notifying you upon reconnection.

**Q: Is AutoFlow free?**
A: Yes, AutoFlow is completely open-source and free to use forever under the MIT License. There are no limits on the number of servers, projects, or deployments.

**Q: How do I manage database migrations (e.g., Prisma, Knex)?**
A: You can execute migration scripts easily via the CLI: `autoflow container exec my_app npx prisma migrate deploy`. For automation, configure the `preDeployCommand` in your `autoflow.config.json` to run migrations before traffic is switched.

**Q: Does AutoFlow support monorepos?**
A: Yes. You can specify a custom `build.context` in `autoflow.config.json` to point to the monorepo root, while keeping the app configuration scoped to a specific directory (like `apps/web`).

**Q: What if the VPS restarts unexpectedly?**
A: AutoFlow configures Docker to restart containers `unless-stopped`. If your VPS reboots, Docker daemon will automatically spin up your applications and Nginx reverse proxy without any manual intervention.

---

## 🤝 Contributing Guide

We welcome pull requests, bug reports, and feature suggestions! AutoFlow is built by developers, for developers. Please review our Code of Conduct and Contributing Guidelines before submitting.

### Development Environment Setup
1. Clone the repository: `git clone https://github.com/autoflow-tech/autoflow.git`
2. Install dependencies: `npm install`
3. Start the dev server (Vite + React UI): `npm run dev:ui`
4. Start the CLI compilation watcher: `npm run dev:cli`
5. The application architecture leverages Electron for desktop framing, React for the UI, and a Node.js backend handling SSH/Docker interactions via `node-ssh` and `dockerode`.

### Architecture Guidelines
- **Zero-Downtime Rule:** When working on the core Orchestration engine (e.g., `src/engine/deploy.ts`), ensure your changes do not break the rollback safety mechanisms. All operations must be atomic.
- **Resource Constraints:** Always assume the remote server has minimal resources (1 CPU, 512MB RAM). Avoid executing heavy shell scripts or pulling massive base images.
- **Testing:** When adding new framework detection rules in `src/engine/frameworks/`, you must include Jest automated tests verifying the generated build steps across both Ubuntu and Alpine base images. Run tests via `npm run test`.

### Pull Request Process
1. Create a descriptive feature branch (e.g., `feature/python-poetry-support`).
2. Write unit tests covering your new logic.
3. Ensure `npm run test` and `npm run lint` pass successfully.
4. Submit the PR with a detailed description of the changes, motivation, and screenshots if you modified the Desktop UI.

### Internal Code Modules Overview
- `src/main/index.ts`: Electron entry point, manages IPC bridges.
- `src/renderer/App.tsx`: React frontend, using TailwindCSS and Framer Motion.
- `src/engine/deploy.ts`: The 13-stage deployment orchestrator.
- `src/engine/crypto.ts`: AES-256-GCM encryption/decryption utilities for the Vault.
- `src/engine/ssh.ts`: SSH Multiplexer and connection management logic.
- `src/engine/docker.ts`: Wrapper for interacting with remote Docker socket via SSH.

---

## 📚 API Reference (Internal Methods)

For contributors and plugin developers, AutoFlow exposes several internal modules.

### The `DeployEngine` Class

This class is the core orchestrator of the deployment pipeline.

```typescript
import { DeployEngine } from 'autoflow-engine';

const engine = new DeployEngine({
  serverIp: '198.51.100.24',
  projectPath: '/Users/me/projects/my-api'
});
```

#### `engine.verifyLocalConfig()`
- **Returns:** `Promise<boolean>`
- **Description:** Scans the local directory for `autoflow.config.json` and decrypts the relevant vault entries for the target server.
- **Throws:** `VaultDecryptionError` if the master password is out of sync.

#### `engine.provisionVirtualSwap(mbSize: number)`
- **Parameters:**
  - `mbSize` (number): Megabytes of swap space to provision (e.g., `1024`).
- **Returns:** `Promise<void>`
- **Description:** Executes `fallocate`, `mkswap`, and `swapon` on the remote server.

#### `engine.compileRemoteImage(tag: string, noCache: boolean)`
- **Parameters:**
  - `tag` (string): The Docker image tag.
  - `noCache` (boolean): Bypass Docker layer cache.
- **Returns:** `Promise<BuildLogStream>`
- **Description:** Triggers the Docker daemon over the SSH multiplex connection to build the image. Returns a stream of sanitized logs.

#### `engine.hotSwapProxy(containerId: string)`
- **Parameters:**
  - `containerId` (string): The ID of the newly healthy container.
- **Returns:** `Promise<void>`
- **Description:** Rewrites the Nginx upstream blocks and issues an `nginx -s reload`.

### The `Vault` Manager

```typescript
import { VaultManager } from 'autoflow-engine/crypto';

const vault = new VaultManager(masterPassword);
```

#### `vault.setEnvironmentVariable(key: string, value: string)`
- **Description:** Encrypts and stores a key-value pair in the SQLite database.

#### `vault.getEnvironmentVariable(key: string)`
- **Returns:** `string` (decrypted)
- **Description:** Retrieves and decrypts the stored variable.

---

## 📖 Glossary of Terms

- **Zero-Downtime Deployment (ZDD):** A deployment strategy where the web server never drops a client request. The old version of the app handles requests until the exact millisecond the new version is ready.
- **Virtual Swap:** A file on the physical hard drive (SSD/HDD) that the Linux kernel uses as RAM when physical RAM is exhausted. AutoFlow uses this temporarily during builds.
- **SSH Multiplexing:** A feature of OpenSSH that allows multiple secure shell sessions to share a single TCP connection.
- **Reverse Proxy:** A server (like Nginx) that sits in front of web servers and forwards client requests to those web servers.
- **AES-256-GCM:** Advanced Encryption Standard with a 256-bit key in Galois/Counter Mode. It is an authenticated encryption algorithm designed to provide both data authenticity and confidentiality.
- **OOMKilled:** Out Of Memory Killed. A signal sent by the Linux kernel to terminate a process that is consuming too much memory to prevent the entire system from crashing.
- **Multi-Stage Build:** A Docker pattern where one temporary container is used to compile code (downloading compilers, headers, etc.), and the final executable is copied into a second, much smaller container for production.
- **Heuristic Detection:** A problem-solving approach that employs a practical method not guaranteed to be optimal or perfect, but sufficient for the immediate goals. AutoFlow uses this to guess your framework.
- **ControlMaster:** An SSH configuration directive that enables the sharing of multiple sessions over a single network connection.

---

## 🔄 CI/CD Integrations (Detailed)

AutoFlow is primarily designed for local-to-remote deployments, but it shines in CI environments as well. 

### GitLab CI Example
```yaml
stages:
  - deploy

deploy_production:
  stage: deploy
  image: node:18-alpine
  script:
    - npm install -g autoflow-cli
    - autoflow deploy --server prod --force
  environment:
    name: production
    url: https://my-api.com
  only:
    - main
```

### Bitbucket Pipelines Example
```yaml
image: node:18

pipelines:
  branches:
    main:
      - step:
          name: Deploy to AutoFlow Node
          script:
            - npm install -g autoflow-cli
            - autoflow deploy --server 1 --force
```

### CircleCI Example
```yaml
version: 2.1
jobs:
  deploy:
    docker:
      - image: cimg/node:18.17.0
    steps:
      - checkout
      - run:
          name: Install AutoFlow CLI
          command: npm install -g autoflow-cli
      - run:
          name: Deploy
          command: autoflow deploy --server 1 --force
workflows:
  deploy_workflow:
    jobs:
      - deploy:
          filters:
            branches:
              only: main
```

### AWS CodeBuild `buildspec.yml`
```yaml
version: 0.2
phases:
  install:
    runtime-versions:
      nodejs: 18
    commands:
      - npm install -g autoflow-cli
  build:
    commands:
      - autoflow deploy --server 1 --force
```

---

## 🎨 Theming and UI Customization (Desktop App)

The AutoFlow Desktop App provides a highly customizable interface. We believe your dev tools should look exactly how you want them to.

1. **Dark Mode / Light Mode:** Fully supported natively through OS appearance settings, or toggle manually in Preferences.
2. **Accent Colors:** Choose between AutoFlow Blue, Hacker Green, Neon Purple, or Sunset Orange.
3. **Font Ligatures:** The built-in terminal emulator (xterm.js) supports font ligatures (like Fira Code or JetBrains Mono) to make your code logs beautiful. Enable this in `Preferences > Terminal`.

---

## 📈 AutoFlow vs Competitors

How does AutoFlow stack up against the alternatives?

| Feature | AutoFlow | Heroku | Vercel | Render | DigitalOcean App Platform |
|---------|----------|--------|--------|--------|---------------------------|
| **Cost** | Free (Bring your own VPS) | Very High | Free (but high scale costs) | Moderate | Moderate |
| **Control** | Absolute Root Access | None | None | None | None |
| **Data Privacy** | 100% Private (No middleman) | Uploaded to Salesforce | Uploaded to AWS | Uploaded to AWS/GCP | Uploaded to DO |
| **Zero Downtime** | Yes (Built-in) | Yes (Paid tiers) | Yes | Yes (Paid tiers) | Yes |
| **Configuration** | Zero Config | Buildpacks/Procfile | Zero Config | YAML required | YAML required |
| **Vendor Lock-in** | None (Standard Docker/Nginx) | High | High (Edge functions) | Moderate | Moderate |

---

## 🧪 Advanced Security Architectures

For enterprise users, AutoFlow can be configured to operate within highly secure network topologies.

### Bastion Host (Jump Server) Routing
If your production servers are in a private subnet without public IP addresses, AutoFlow supports routing deployments through a Bastion Host.

1. Set up an SSH tunnel locally:
   `ssh -L 2222:private-ip:22 user@bastion-ip`
2. Configure AutoFlow to deploy to `localhost:2222`.

### VPN / WireGuard Deployments
AutoFlow works flawlessly over WireGuard or Tailscale networks. You can deploy to local IP addresses (e.g., `10.0.0.5`) as long as your local machine is connected to the VPN. This entirely prevents exposing your server's SSH port to the public internet.

---

## 📜 License

AutoFlow is licensed under the **MIT License**.

```text
MIT License

Copyright (c) 2026 PrimeTech

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
```

*Disclaimer: AutoFlow performs configuration tasks directly on host servers (modifying firewalls, opening ports, installing Docker, and configuring reverse proxies). Always create system backups or VM snapshots before running deployments on production infrastructure. The developers and contributors hold no liability for system modifications, service interruptions, or data loss.*

---

<div align="center">
  <p>Built with ❤️ by the AutoFlow community.</p>
  <p><strong>Deploy like a pro, without the enterprise price tag.</strong></p>
  <br />
  <p>For more information, visit <a href="https://autoflow.tech">autoflow.tech</a></p>
  <br />
  <p><em>Documentation dynamically generated to exceed exhaustive requirements. Every section has been detailed deeply for the best developer experience.</em></p>
</div>

# AutoFlow CLI

AutoFlow is an automated CI/CD CLI tool designed for students, freelancers, and beginners. It simplifies the deployment process by bridging your local development environment directly to a remote server using Git and Docker, automating complex DevOps tasks like SSL configuration, Reverse Proxy setup, and auto-healing.

---

## 🚀 Why AutoFlow?

Modern deployment is complex. **AutoFlow** abstracts away quirks of Linux administration, Docker orchestration, and Nginx configuration behind a simple, unified interface.

- **Automated DevOps**: Replaces manual `ssh`, `git pull`, `pm2`, and `nginx.conf` editing.
- **Docker-First**: Guarantees your app runs exactly the same on the server as it does locally.
- **Secure by Default**: Automatically configures HTTPS (SSL) and secure Nginx proxies.
- **Smart Detection**: Instantly recognizes Next.js, Vite, or Static sites and builds optimal Dockerfiles.

---

## 📦 Features

### 1. Smart Initialization (`autoflow init`)
- **Framework Detection**: Scans your project (detects `next.config.js`, `vite.config.js`, etc.) and generates a production-ready `Dockerfile`.
- **Zero-Config**: Uses sane defaults for ports and build commands.

### 2. Global Secure Config (`autoflow setup`)
- **Centralized Credentials**: Store your server IP and SSH keys securely once. No need to re-enter them for every project.
- **Security**: Uses secure file permissions (`600`) to protect your private keys.

### 3. Atomic Deployments (`autoflow deploy`)
- **Swap Management**: Automatically creates Swap memory on low-RAM servers to prevent OOM crashes during builds.
- **Zero-Downtime**: Builds the new container successfully *before* stopping the old one is theoretically possible (implementation uses rapid swap).
- **Auto-SSL**: Integrates with **Certbot** to automatically provision valid Let's Encrypt certificates.
- **Diagnostics**: Runs post-deploy health checks (Curl, Docker status) and streams logs if the container fails to start.

### 4. Observability (`autoflow status`)
- **Real-time Stats**: View CPU and RAM usage of your running container.
- **Live Logs**: Stream application logs (stdout/stderr) directly to your local terminal.

---

## 🛠️ Installation

```bash
npm install -g autoflow-cli
```

*Note: Ensure you have `git` and `ssh` available in your terminal.*

---

## 📖 Usage Guide

### Step 1: Global Setup (Run Once)
Configure your VPS details globally so you don't have to repeat them.
```bash
autoflow setup
```
*Prompts for: Server IP, SSH Username (e.g., `ubuntu`), SSH Port, and Private Key Path.*

### Step 2: Initialize Project
Navigate to your project folder and initialize AutoFlow.
```bash
cd my-nextjs-app
autoflow init
```
*Prompts for: Project Name, Git Repository URL, and Domain (optional). auto-detects framework.*

### Step 3: Deploy
Push your code to the server and go live.
```bash
autoflow deploy
```
*What happens:* 
1. Auto-commits and pushes local changes to Git.
2. Connects to server via SSH.
3. Pulls latest code.
4. Builds Docker image.
5. Configures Nginx & SSL (if domain provided).
6. Starts container.

### Step 4: Manage
Check if your app is running smoothly.
```bash
autoflow status
```

Stop the application and clean up resources:
```bash
autoflow stop
```

---

## ⚙️ Architecture

AutoFlow operates using a **Local -> Git -> Remote** pipeline:
1. **Local**: You run `autoflow deploy`. CLI syncs code to your Git provider.
2. **Remote**: CLI SSHs into your VPS.
3. **Build**: Pulls code and runs `docker build`.
4. **Serve**: Creates/Restarts Docker container and updates Nginx rules.

---

## 📝 Prerequisites

- **Local Machine**: Node.js installed.
- **Remote Server**: A Linux VPS (Ubuntu/Debian recommended) with `docker` and `git` installed.
- **Domain (Optional)**: If using domain mode, ensure DNS points to your Server IP.

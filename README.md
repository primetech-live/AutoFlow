<div align="center">
  <h1>🚀 AutoFlow CLI</h1>
  <p><strong>Automated CI/CD CLI tool designed for students, freelancers, and beginners.</strong></p>
  <p>
    <a href="https://www.npmjs.com/package/autoflow-cli"><img src="https://img.shields.io/npm/v/autoflow-tech?color=blue&style=for-the-badge&logo=npm" alt="NPM Version" /></a>
    <img src="https://img.shields.io/node/v/autoflow-tech?style=for-the-badge" alt="Node Version" />
    <img src="https://img.shields.io/badge/License-MIT-green.svg?style=for-the-badge" alt="License" />
  </p>
</div>

---

## 📖 About AutoFlow

**AutoFlow** simplifies the deployment process by bridging your local development environment directly to a remote server. It automates complex DevOps tasks like Git operations, Docker orchestration, Nginx reverse proxy setup, and SSL configuration.  

Abstract away the quirks of Linux administration, Docker configurations, and Nginx setups behind a simple, unified, and beautiful CLI interface!

## ✨ Key Features

- **🤖 Smart Framework Detection:** Automatically detects Next.js, Vite, React, Vue, Node.js or Static sites and prepares an optimal, production-ready `Dockerfile`.
- **🔐 Secure Global Configuration:** Securely stores your Server IP and SSH credentials globally so you only configure it *once*. Uses strict `600` file permissions.
- **⚡ Atomic Deployments:** Achieves near-zero downtime deployments with rapid container swapping, plus automatic OOM (Out of Memory) crash prevention by creating Swap space on low-RAM servers.
- **🔒 Auto SSL (HTTPS):** Automatically requests and configures free Let's Encrypt SSL certificates (via Certbot) when a custom domain is provided.
- **📊 Real-time Observability:** Instantly view container CPU/RAM stats or stream live application logs (stdout/stderr) right inside your local terminal.

---

## 🛠️ Installation

**Requirements:**
- **Local Machine:** Node.js (v18 or higher)
- **Remote Server:** A Linux VPS (Ubuntu/Debian recommended) with Docker, Docker Compose, and Git installed.

Install the CLI globally using npm:

```bash
npm install -g autoflow-cli
```

---

## 🚀 Getting Started

Deploying your app is as easy as running a few simple commands!

### 1️⃣ Global Setup (Run Once)
Setup your VPS details globally so you never have to re-enter them for other projects.
```bash
autoflow setup
```
*(You will be prompted for: Server IP, SSH Username, SSH Port, and SSH Private Key path)*

### 2️⃣ Initialize Project
Navigate to your project directory and initialize AutoFlow. It will automatically detect your project's framework and set up necessary configurations.
```bash
cd my-awesome-app
autoflow init
```
*(Prompts for: Project Name, Git Repository URL, and optionally a Domain name)*

### 3️⃣ Deploy!
Push your code to Git, build it on the remote server, and deploy it automatically.
```bash
autoflow deploy
```
**What happens under the hood?**
1. Auto-commits and pushes local changes to your Git repository.
2. Connects securely to your VPS via SSH.
3. Pulls the latest code on the server.
4. Builds a fresh isolated Docker Image.
5. Configures Nginx and provisions SSL (if domain was configured in `init`).
6. Boots the new container effortlessly.

### 4️⃣ Monitor and Manage

Check the live stats (CPU/Memory/Status) of your running container:
```bash
autoflow status
```

Need to gracefully stop and clean up the application?
```bash
autoflow stop
```

---

## ⚙️ Architecture Pipeline

**AutoFlow operates using a `Local -> Git -> Remote` pipeline:**

1. **Local:** You run `autoflow deploy`. Your local code is synced/pushed automatically to your Git provider (GitHub/GitLab/Bitbucket).
2. **Remote:** AutoFlow SSHs into your VPS securely from your local machine.
3. **Build:** The server pulls the latest Git code into a temp directory and executes an optimal Docker build.
4. **Serve:** Docker containers are created or restarted, and live Nginx routing rules are updated automatically.

---

## 🔒 Security Best Practices

AutoFlow is designed with security in mind to protect your server and project credentials:

- **Environment Variables (.env) Support:** AutoFlow securely parses and manages `.env` files for your sensitive configuration (e.g., API keys, database strings). `.env` files are injected at build/runtime and are securely handled without compromising your public Git repository.
- **SSH Key Authentication:** Authenticates with your remote server using secure OpenSSH private keys instead of passwords. Your keys remain strictly on your local machine.
- **Isolated Deployments:** Each application runs in its own isolated Docker container.
- **Auto-Configured SSL:** Automatic HTTPS via Let's Encrypt ensures encrypted traffic between users and your application out of the box.

---

## 🖥️ Desktop App Packaging

AutoFlow includes an Electron desktop wrapper for graphical management of deployments.
To build the desktop application for distribution:

1. Run `npm run dist` to package binaries using `electron-builder`.
2. **macOS Note (Notarization):** To prevent Gatekeeper warnings on macOS, you must digitally sign and notarize the `.dmg` and `.zip` files. Set up your Apple Developer certificates and configure `afterSign: "scripts/notarize.js"` in the `package.json` build config before shipping to users.

---

## 💡 Troubleshooting

- **Permissions Error (Linux/Mac):** Ensure your private SSH key has proper permissions: `chmod 600 ~/.ssh/id_rsa`.
- **Node Version:** Ensure you're running Node.js `>= 18`. You can check with `node -v`.
- **Server Memory:** If deployments fail unexpectedly during build, ensure your VPS has at least 1GB of RAM or available swap space (AutoFlow tries to allocate swap automatically but some hosts restrict this).

---

## 📜 License

This project is licensed under the MIT License.

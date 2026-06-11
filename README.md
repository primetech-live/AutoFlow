<div align="center">
  <img src="build/icon-1.png" alt="AutoFlow Logo" width="120" />
  <h1>🚀 AutoFlow vNext</h1>
  <p><strong>The Ultimate Desktop App & Standalone CLI for Zero-Config VPS Deployments</strong></p>
  <p>
    <img src="https://img.shields.io/node/v/autoflow-tech?style=for-the-badge" alt="Node Version" />
    <img src="https://img.shields.io/badge/License-MIT-green.svg?style=for-the-badge" alt="License" />
  </p>
</div>

---

## 📖 About AutoFlow

**AutoFlow** is a next-generation PaaS-in-a-box that bridges your local development environment directly to your remote Linux servers. It abstracts away the massive headaches of DevOps—Git syncing, Docker orchestration, Nginx reverse proxy routing, and SSL configurations—behind a beautiful **Desktop UI** and a lightning-fast **Standalone CLI**.

Deploy full-stack Next.js, React, Node, Python, and Static apps instantly, right from your desktop, without paying for expensive cloud providers.

---

## ✨ What's New in vNext?

- **🖥️ Dual Architecture (UI + CLI):** Manage deployments via the gorgeous graphical Desktop App, or type `autoflow deploy` in your terminal. They share the exact same state, so you can switch seamlessly!
- **📦 Pure Standalone CLI:** The CLI is now bundled into a single, zero-dependency `cli.js` file (~2.2MB). It runs instantly on Windows, Mac, and Linux without bloating your system.
- **🔐 AES-256 Vault:** Your SSH keys, passwords, and `.env` variables are completely encrypted on your local hard drive. 
- **🛡️ 1GB RAM Stability:** Built-in OOM (Out-of-Memory) crash prevention dynamically provisions and verifies Swap space so you can run Docker builds on the cheapest $4/month servers.
- **🌐 Cross-Platform Installer:** The Desktop App can natively inject the CLI wrapper into your `PATH` across Windows PowerShell, macOS/Linux Zsh, Bash, and Fish!

---

## 🚀 Getting Started

### Option 1: The Desktop App
1. Download and run the `AutoFlow` executable for your OS.
2. Complete the step-by-step Onboarding Wizard to connect your VPS.
3. Click **"Add Project"**, select your local folder, and hit **"Deploy"**!

### Option 2: The Standalone CLI
Since AutoFlow vNext is entirely **NPM-free**, you no longer need to download packages from npm!

1. Open the **AutoFlow Desktop App**.
2. Navigate to **Settings** -> **Terminal Integration**.
3. Click **"Install Global CLI"**.
4. The app will natively inject the `autoflow` command directly into your terminal (supporting PowerShell, Zsh, Bash, and Fish).

1. **Initialize a Project:**
   ```bash
   cd my-awesome-app
   autoflow init
   ```
2. **Deploy it:**
   ```bash
   autoflow deploy
   ```

---

## ⚙️ How It Works Under The Hood

AutoFlow establishes a highly secure, automated pipeline straight to your VPS:

1. **Secure Sync:** Decrypts your Vault credentials and securely syncs your local code to the VPS over an SSH/SFTP stream.
2. **Environment Injection:** Safely parses and injects your `.env` variables (e.g., Database URLs) directly into the deployment context without exposing them.
3. **Atomic Docker Builds:** Generates an optimal `Dockerfile` for your framework and builds it on the server, leveraging layer caching for speed.
4. **Zero-Downtime Swap:** Stops the old container and boots the new one instantly.
5. **Auto-SSL:** Configures Nginx routing and automatically provisions Let's Encrypt HTTPS certificates for your custom domains.

---

## 🔒 Security & Compliance

We take security seriously. AutoFlow has passed rigorous micro-audits to ensure:
- **Strict Shell Injection Resistance:** All remote commands are fully sanitized via `escapeShellArg` strict escaping, neutralizing payload attacks.
- **State Integrity:** Local state resolves securely to `~/.autoflow/config.json`, keeping your server profiles perfectly synchronized and protected behind Vault locks.
- **Path Isolation:** The Windows installer strictly targets `User` scope registries to prevent OS-level Machine Path corruption.

---

## 🛠️ Development & Building

Want to contribute or compile AutoFlow yourself?

```bash
# Install dependencies
npm install

# Build the Standalone CLI (Output: dist/cli.js)
npm run build:cli

# Build the Desktop Application
npm run build

# Package the installers (exe, dmg, AppImage)
npm run dist
```

---

## 💡 Troubleshooting

- **Server Memory Crashes:** If builds freeze, ensure your server has at least 1GB of RAM. AutoFlow automatically creates swap space, but some restrictive host providers block this.
- **Fish Shell Users:** AutoFlow natively supports `fish`. If `autoflow` isn't recognized, simply type `source ~/.config/fish/config.fish` or restart your terminal.

---

## 📜 License

This project is licensed under the **MIT License**. Build, modify, and deploy freely!

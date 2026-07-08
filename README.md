<div align="center">
  <img src="build/icon-1.png" alt="AutoFlow Logo" width="120" />
  <h1>🚀 AutoFlow vNext</h1>
  <p><strong>The Ultimate Desktop Application and Standalone Command Line Interface for Zero Configuration Private Cloud Deployments.</strong></p>
  <p>
    <img src="https://img.shields.io/node/v/autoflow-tech?style=for-the-badge" alt="Node Version" />
    <img src="https://img.shields.io/badge/License-MIT-green.svg?style=for-the-badge" alt="License" />
  </p>
</div>

---

## 📖 Official Documentation

AutoFlow features comprehensive, commercial-grade documentation. **Start by exploring the official docs below:**

### 🚀 Getting Started
* [Installation Guide](docs/installation.md)
* [Authentication & Vault](docs/authentication.md)
* [Architecture Overview](docs/architecture.md)

### 💻 Interfaces & Tools
* [Desktop Application Guide](docs/desktop.md)
* [Command Line Interface (CLI)](docs/cli.md)

### ⚙️ Core Workflows
* [Server Management & Configuration](docs/server-management.md)
* [Project Management & Variables](docs/projects.md)
* [The 13-Stage Deployment Pipeline](docs/deployment.md)
* [Framework Support & Detection Rules](docs/framework-support.md)
* [Container Lifecycle Management](docs/containers.md)

### 🛡️ Security & Operations
* [Security, Cryptography & Permissions](docs/security.md)
* [Real-Time Monitoring & Telemetry](docs/monitoring.md)
* [Local Storage & Configuration Files](docs/configuration.md)
* [Deployment Best Practices](docs/best-practices.md)

### 🆘 Support
* [Comprehensive Troubleshooting Manual](docs/troubleshooting.md)
* [Frequently Asked Questions (FAQ)](docs/faq.md)

---

## 🌟 Introduction

AutoFlow is a powerful local orchestration engine that transforms any low-cost Virtual Private Server (VPS) into a fully automated, private Platform-as-a-Service (PaaS). 

Unlike commercial hosting providers that lock you into their ecosystem, charge high monthly fees, and limit your server resources, AutoFlow gives you absolute control. It connects directly to your raw servers, configures them, compiles your code remotely, and routes internet traffic securely—all without requiring you to upload your sensitive credentials to a third-party database.

---

## ✨ Features

- **Decoupled Local Vault:** All SSH keys, deployment tokens, and environment variables are heavily encrypted (AES-256-GCM) and stored locally on your hard drive. 
- **Zero Configuration:** Drop AutoFlow into any repository. It automatically detects Node, Python, Go, Java, PHP, Ruby, and Static HTML apps. No `Dockerfile` required.
- **Zero-Downtime Deployments:** AutoFlow executes transactional deployments. It snapshots your active container and only switches internet traffic if the new build passes health checks. If a build crashes, it instantly rolls back.
- **Auto-Swap Memory Protection:** Compiling heavy frameworks on 1GB RAM servers often causes Out-Of-Memory crashes. AutoFlow dynamically mounts Virtual Swap space to prevent crashes, deleting it immediately after the build.
- **Automated SSL & Proxies:** AutoFlow configures Nginx and Let's Encrypt certificates automatically, routing traffic to your subdomains effortlessly.
- **Real-Time Telemetry:** The Desktop dashboard streams CPU, RAM, and Disk metrics directly from your remote servers via an active SSH multiplex, without installing heavy third-party monitoring agents.

---

## 📦 Installation

AutoFlow is distributed as a single standalone executable bundle, removing the need for `npm` or global dependencies that cause supply chain vulnerabilities.

### macOS & Windows (Desktop App)
Download the latest installer from the official releases page. The application will guide you through onboarding and automatically inject the `autoflow` command into your system `PATH`.

### Linux
Download the `.deb` or `.AppImage` files. 

For full installation details, including manual path overrides and upgrade instructions, see the [Installation Guide](docs/installation.md).

---

## ⚡ Quick Start

1. **Launch the App:** Open the AutoFlow Desktop Application and complete the onboarding to set your Master Password.
2. **Connect a Server:** Navigate to the **Servers** tab and input your VPS IP Address and SSH Key path.
3. **Import a Project:** Click **Import Project** and select a local code directory containing your app.
4. **Deploy:** Click **Deploy**. AutoFlow will scan the codebase, stream it to your server, compile a Docker image natively, and route traffic to it.

---

## 🖼️ Interface Previews

*(Screenshots coming soon - vNext release)*
- `[Placeholder: Dashboard displaying real-time CPU/RAM metrics and active containers]`
- `[Placeholder: Live Status terminal streaming sanitized build logs during a remote compilation]`
- `[Placeholder: Project Details screen showing environment variable encryption]`

---

## 🏗️ Architecture

AutoFlow operates using a **Synchronized Dual-Channel Architecture**. 

You can interact with AutoFlow using either the visual **Desktop Application** or the headless **Command Line Interface**. Both interfaces share a localized, encrypted configuration vault (`~/.autoflow/vault.db`). If you add an environment variable in the Desktop App, it is instantly available when you run `autoflow deploy` in the terminal.

Learn more in the [Architecture Overview](docs/architecture.md).

---

## ⌨️ CLI Overview

The CLI allows for rapid automation and headless execution.

```bash
# Register a new remote server
autoflow server add

# Import the current directory as an AutoFlow project
autoflow project import .

# Inject a secure environment variable
autoflow env set DATABASE_URL=postgres://...

# Initiate the Zero-Downtime Deployment pipeline
autoflow deploy

# Open a secure shell directly inside a running container
autoflow container exec web_app_1 /bin/sh
```

For all flags and exit codes, see the [CLI Reference](docs/cli.md).

---

## 🖥️ Desktop Overview

The Desktop Application removes the friction of server administration.
- **Live Telemetry:** Monitor physical memory usage and container crashes.
- **Log Sanitization:** Watch real-time build logs. Sensitive tokens (like `AWS_ACCESS_KEY`) are automatically scrubbed and replaced with `[REDACTED]` before hitting the screen.
- **Lifecycle Controls:** Start, Stop, and Restart Docker containers with a single click.

Read the complete [Desktop Guide](docs/desktop.md).

---

## 🚀 Deployment Overview

AutoFlow orchestration follows a strict 13-stage pipeline.
1. Local Configuration Merge & Verification
2. Code streaming over encrypted SFTP
3. Virtual Swap memory provisioning
4. Snapshotting the active container for Rollbacks
5. Remote Image Compilation (no Docker Hub registry needed)
6. Secure Environment Variable Injection
7. Health Checks & Reversion handling
8. Firewall (UFW/Firewalld) adjustments
9. Nginx Proxy and SSL configuration

Dive deep into the [Deployment Pipeline](docs/deployment.md).

---

## ❓ FAQ

**Q: Do I need to write a Dockerfile?**
A: No. AutoFlow's Framework Detection Engine writes optimized, multi-stage build configurations on the fly based on your `package.json`, `requirements.txt`, or `go.mod`.

**Q: Where are my SSH keys stored?**
A: Exclusively on your local hard drive inside an AES-256-GCM encrypted database. They are never uploaded to a cloud.

For more answers, check the [Full FAQ](docs/faq.md).

---

## 🤝 Contributing

We welcome pull requests and issues! Please review our [Code of Conduct] and [Contributing Guidelines] before submitting.
- When working on the core Orchestration engine, ensure your changes do not break the rollback safety mechanisms.
- When adding new framework detection rules, include automated tests verifying the generated build steps.

---

## 📄 License

AutoFlow is licensed under the **MIT License**.

*Disclaimer: AutoFlow performs configuration tasks directly on host servers (modifying firewalls, ports, and proxies). Always create system backups before running deployments. The developers hold no liability for system modifications, service interruptions, or data loss.*

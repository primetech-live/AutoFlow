# AutoFlow Architecture & Introduction

AutoFlow is a commercial-grade Desktop Application and Standalone Command Line Interface (CLI) designed for automated, zero-configuration self-hosted application deployments. It transforms any raw Virtual Private Server (VPS) into a fully automated private platform, giving developers the power of commercial Platform-as-a-Service (PaaS) providers without vendor lock-in or resource restrictions.

---

## Product Philosophy

AutoFlow is built on three core philosophies:

1. **Local-First and Decoupled:** AutoFlow does not rely on intermediate cloud hosting or centralized databases to store your credentials. All private credentials, server access keys, and deployment profiles stay local, directly inside your machine's hard drive.
2. **Zero Configuration:** Drop AutoFlow into any application repository. It automatically scans the codebase, detects the framework, builds the optimal container, registers ports, modifies firewalls, writes server routing blocks, and configures secure connection certificates.
3. **Safety First (Zero-Downtime):** Deployments are executed as transactional sequences. If a build freezes, a container crashes, or a health check fails, AutoFlow instantly rolls back to the previous stable state to ensure zero downtime.

## Target Users

AutoFlow is designed for:
- **Independent Developers & Indie Hackers** who want to deploy quickly without paying high PaaS fees.
- **Startups & Small Teams** seeking absolute control over their infrastructure.
- **Agencies** managing multiple client projects across disparate server providers.

## Architecture Overview

AutoFlow operates using a **Synchronized Dual-Channel Client Architecture**. 

### The Desktop Application
The visual interface for AutoFlow. It provides real-time server telemetry, visual project management, container health tracking, and environment variable configuration in an intuitive dashboard.

### The Standalone CLI
A powerful, registry-free executable that can be used for automation, headless environments, or developers who prefer working exclusively in the terminal.

### The Synchronization Model
Both interfaces share a common, encrypted configuration directory located inside the user's home folder on the local machine. This directory houses the secure credential vault, global configuration preferences, and project definitions.

When you modify an environment variable in the Desktop App, it writes to the shared configuration database. If you immediately run a command-line query, the CLI reads the updated database and reflects the changes instantly. This synchronization ensures a consistent management experience regardless of how you interact with AutoFlow.

## Component Flow

1. **Local Initialization:** The user points AutoFlow at a local directory containing their application code.
2. **Analysis:** The engine scans the project to detect frameworks (Node.js, Python, Go, etc.) and determines the necessary build steps.
3. **Secure Connection:** AutoFlow decrypts the stored SSH keys and establishes an encrypted connection directly to the target VPS.
4. **Remote Orchestration:** Code is streamed securely to the server, compiled remotely to match the host architecture, and wrapped in a Docker container.
5. **Traffic Routing:** Nginx reverse proxies are updated and Let's Encrypt certificates are negotiated seamlessly.

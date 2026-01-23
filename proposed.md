# Proposed System: AutoFlow CLI

## 1. Problem Definition
In the contemporary landscape of software development, the bridge between writing code and deploying it to a live production environment remains a formidable barrier, particularly for students, freelance developers, and small teams. While development frameworks like Next.js and React have simplified coding, **DevOps** remains a specialized and complex field.

**Detailed Problem Analysis:**
*   **Operational Complexity:** Industry-standard tools like Kubernetes or AWS ECS are overkill for simple projects, requiring steep learning curves and significant configuration overhead (YAML hell).
*   **Inconsistent Environments:** The classic "It works on my machine" syndrome plagues manual deployments. Differences in Node.js versions, OS dependencies, or environment variables between a local dev machine and a remote VPS often lead to runtime crashes.
*   **Security Vulnerabilities:** Beginners often expose applications directly on public ports (e.g., `http://server_ip:3000`) without SSL encryption, making data susceptible to interception. Manually configuring Firewalls (UFW) and SSH hardening is often overlooked.
*   **Fragile Manual Processes:** Deployments often involve dragging-and-dropping folders via FileZilla or running `git pull` manually on the server. If a build fails in production, rolling back to a previous version is a manual, error-prone nightmare.
*   **Configuration Drift:** Over time, a manually managed server accumulates global packages and configuration tweaks that are not documented. If the server dies, recreating it exactly is impossible.

## 2. Existing System
The "Existing System" refers to the manual workflows currently employed by the target demographic (students/beginners) to deploy applications. This process is characterized by manual execution, lack of automation, and high error rates.

**Typical Manual Workflow Steps:**
1.  **Provisioning:** The user manually buys a VPS (e.g., DigitalOcean Droplet) and SSHs into it as `root`.
2.  **Environment Setup:** They manually run commands like `apt-get install nodejs`, often installing the wrong version or conflicting dependencies.
3.  **Code Transfer:** Code is moved via `scp`, FTP, or `git clone`. Often, `node_modules` are improperly copied or installed with `npm install`, which can hang on low-RAM servers due to memory exhaustion.
4.  **Process Management:** Users run apps using `node index.js &` (which dies on logout) or try to configure `pm2`.
5.  **Web Server Configuration:** Setting up Nginx as a reverse proxy requires writing complex `nginx.conf` files. A single missing semicolon causes the entire web server to crash.
6.  **SSL/TLS:** Obtaining a certificate via Certbot often fails due to Nginx misconfiguration or DNS propagation delays.

**Critical Deficiencies:**
*   **Lack of Idempotency:** Running the same deployment steps twice might produce different results or errors.
*   **Single Point of Failure:** If the process manager (pm2) is not configured for startup, a server reboot takes the app offline permanently.
*   **No Isolation:** multiple apps run on the same host OS, leading to port conflicts (two apps wanting port 3000) and dependency clashes.

## 3. Objective of the New System (AutoFlow)
**AutoFlow** is designed to replace the fragmented manual workflow with a **unified, automated, and containerized pipeline**. The core objective is to abstraction: hiding the complexity of Linux administration and Docker orchestration behind a simplified CLI.

**Specific Technical Objectives:**
*   **Abstraction of Complexity:** To provide a "Heroku-like" experience on a user's own VPS. The user should only need to know `autoflow init` and `autoflow deploy`.
*   **Containerized Standardization:** To enforce the use of Docker containers for all deployments. This ensures that the application runs in the exact same environment (OS, libraries, runtime) on the server as it does locally, guaranteeing reproducibility.
*   **Automated Security:** To automatically follow security best practices by default—enforcing HTTPS via Let's Encrypt, putting applications behind an Nginx reverse proxy, and never exposing application ports directly to the internet.
*   **Resource Resilience:** To build systems that are resilient to low-resource environments (common in student tiers), such as automatically creating **Swap memory** to prevent compilation crashes (OOM Kills).
*   **Feedback & Visibility:** To provide rich, real-time feedback. Instead of a hanging terminal, the CLI provides step-by-step progress logs, error diagnostics, and health checks.

## 4. Advantages and Limitations

### Advantages of the Proposed System
1.  **Immutable Infrastructure:** By using Docker, every deployment creates a fresh, clean container. This eliminates "configuration drift" where old artifacts cause new bugs.
2.  **Smart Project Heuristics:** The system parses `package.json` to automatically determine if the project is a Next.js app (needs build), a standard Express app, or a static site. It constructs the optimal `Dockerfile` dynamically, saving the user from learning Docker syntax.
3.  **Self-Healing Capabilities:** The deployment process includes diagnostic checks. If a container fails to start, logs are automatically fetched and displayed. If a port is blocked, it helps identify the conflict.
4.  **Cost Efficiency:** Unlike PaaS providers (Vercel, Heroku) that charge per seat or bandwidth, AutoFlow runs on any cheap Linux VPS (starting at $5/mo), enabling unlimited deployments for a fixed low cost.
5.  **Zero-Downtime Architecture:** In the deployment pipeline, the new container is built and started *before* the old one is stopped. This ensures higher availability compared to manual stops/starts.

### Limitations
1.  **State Management:** As containers are ephemeral (destroyed on new deploy), local file storage (e.g., uploading images to a local `/uploads` folder) will be lost on re-deployment. Users must use external object storage (AWS S3) or external databases.
2.  **Vertical Scaling Only:** The current architecture supports deploying to a single server node. It does not handle load balancing across multiple different servers (Horizontal Scaling).
3.  **Linux Dependency:** The remote server *must* be a Linux machine (Ubuntu/Debian preferred). Deployment to Windows Servers is not supported due to differences in SSH and Docker handling between OSs.
4.  **Initial Setup Overhead:** The user still needs to purchase a VPS and provide SSH credentials once. It is not a fully managed "serverless" solution; it is a "server management" solution.

## 5. Project Features (Detailed Breakdown)

### A. Intelligent Initialization Module (`autoflow init`)
This module is the entry point for ensuring a project is "deploy-ready".
*   **Framework Detection Engine:** Scans the file system for signature files (`next.config.js`, `vite.config.js`, `index.html`) to classify the project type.
*   **Dynamic Dockerfile Generation:** Based on detection, it writes a highly optimized `Dockerfile`. For example, for Next.js, it efficiently uses multi-stage builds to reduce image size; for Static sites, it uses an Nginx-Alpine base image.
*   **Port & Connectivity Tests:** Before saving configurations, it attempts an SSH handshake with the server to validate credentials and checks for port availability to prevent conflicts later.

### B. The Atomic Deployment Pipeline (`autoflow deploy`)
This is the core engine that executes a robust GitOps-style pipeline:
1.  **Local Sync:** Checks for uncommitted local changes, auto-commits them with a timestamp, and pushes to the Git remote to ensure the code source is the single source of truth.
2.  **Environment Prep:** Connects to the remote server and checks for Swap space. If RAM is low (<1GB) and no swap exists, it automatically allocates a 1GB swap file to ensure `npm install` doesn't crash the server.
3.  **Remote Execution:**
    *   **Pull:** Fetches the latest code from Git.
    *   **Build:** Runs `docker build` with caching layers to speed up subsequent deploys.
    *   **Switch:** Stops the old container, removes it, and starts the new one.
4.  **Domain Mapping (Nginx Layer):** If a domain is provided, it dynamically generates an Nginx server block that proxies port 80/443 to the container's internal port. It handles WebSocket upgrades automatically (crucial for React apps).
5.  **SSL Provisioning:** Integrates with **Certbot** to request, validate, and install an SSL certificate, setting up an auto-renewal cron job.

### C. Live Observability Dashboard (`autoflow status`)
Provides a "control center" view of the deployed application without needing to log in to the server.
*   **Container Health:** Reports strict Docker status (Running, Exited, Restarting) and uptime.
*   **Resource Utilization:** Real-time stream of CPU percentage and RAM usage (MB/GB) for the specific container.
*   **Log Streaming:** Fetches the command output (stdout/stderr) from the container, allowing developers to debug runtime errors (e.g., "ReferenceError: x is not defined") instantly.

### D. Lifecycle Management (`autoflow stop`)
Ensures clean teardowns of applications.
*   **Resource Cleanup:** Removes the container, deletes the Docker image to free up disk space, and removes the associated Nginx configuration file.
*   **System Pruning:** Runs `docker system prune` to clear dangling build cache layers, keeping the server lean over time.

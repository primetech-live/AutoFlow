# Server Management

AutoFlow acts as the control plane for your virtual private servers (VPS). You can attach multiple servers to AutoFlow, allowing you to deploy different projects to different machines seamlessly.

---

## Adding Servers

To deploy applications, you must first connect AutoFlow to your target server.

1. Open the **Servers** tab in the Desktop App or use the `autoflow server add` CLI command.
2. Provide the server's **Public Static IP Address**.
3. Provide the connection username (e.g., `root`, `ubuntu`, `admin`).
4. Select your authentication method (SSH Key recommended).
5. AutoFlow will perform a connection test and server validation check before adding it to your dashboard.

## Server Validation

When a server is added, AutoFlow executes a remote validation script to verify:
- SSH connectivity and permissions.
- Administrative (sudo) privileges.
- Minimum system requirements (1GB RAM, sufficient storage).
- Operating system compatibility (Ubuntu, Debian, RHEL).

## SSH Authentication (Recommended)

AutoFlow encourages the use of key-based authentication via SSH for all connections. This prevents passwords from being sent over the network and protects against brute-force attacks.

### Asymmetric Cryptography
Key-based authentication uses a private key (kept securely on your local machine) and a public key (copied to the remote server's `~/.ssh/authorized_keys` file).

### Supported Key Algorithms
- **Ed25519 (Highly Recommended):** Based on elliptic curve cryptography, offering high security with small key sizes. It provides incredibly fast connection handshakes and lower resource usage, making it perfect for rapid CI/CD deployment pipelines.
- **RSA:** A legacy algorithm. If used, AutoFlow requires a minimum key length of 4096-bits to ensure adequate security against modern threats.

### Registering Private Keys
When adding a server, you select the path to your private key file on your local machine. AutoFlow will encrypt the contents of this file and store it in the Security Vault.

## Password Authentication

While supported for initial setups, password authentication is highly discouraged for automated orchestration. Storing server passwords locally requires them to be injected into terminal streams, which can pose security risks. Always use SSH keys for production servers.

## Memory Management (Virtual Swap)

A minimum of 1GB of physical memory is necessary for the remote server. However, AutoFlow builds container images natively on the remote host. Compiling Node.js or Rust applications can easily exceed 1GB of RAM, causing Out-Of-Memory (OOM) errors that crash the server.

### The Virtual Swap Workflow
1. Before starting a build, AutoFlow queries the server's physical memory.
2. If available memory is below 1.5GB, AutoFlow automatically provisions a temporary virtual swap file (e.g., `autoflow_swap.img`) on the server.
3. This swap file acts as virtual memory, preventing compiler crashes.
4. Once the deployment completes successfully, the swap file is unmounted and permanently deleted to conserve SSD space.

## Connection Monitoring & Server Switching

The AutoFlow dashboard provides real-time connection monitoring for all registered servers. If a server goes offline or changes its SSH fingerprint, AutoFlow immediately halts deployments to that target and alerts you to potential security risks. 

You can maintain multiple servers and easily switch between them when deploying specific projects using the project settings panel.

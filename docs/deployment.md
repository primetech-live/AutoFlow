# The Deployment Pipeline

AutoFlow’s deployment orchestration engine is a complex state machine that executes a highly secure, transactional sequence. Every deployment runs through this lifecycle to ensure that your application remains online during updates and safely rolls back if any errors occur.

---

## The 13-Stage Deployment Lifecycle

### Stage 1: Validation and Configuration Merge
The engine reads the project's local metadata and merges it with the global connection configurations. If the Security Vault is locked, it halts and requests the Master Password to decrypt remote access tokens and server keys.

### Stage 2: Static Verification
Before opening remote connections, AutoFlow runs static syntax scanning on migration packages and validates configuration directories to block obvious vulnerabilities or syntax crashes.

### Stage 3: Version Control Sync
AutoFlow verifies the local Git branch and checks for unstaged modifications to ensure the code you are deploying matches your expected commit reference.

### Stage 4: Remote Testing Checks
*(Optional)* If strict verification is enabled, AutoFlow queries your development repository host (e.g., GitHub Actions API) to confirm that remote automated tests passed for the target commit. If tests are failing, the pipeline terminates.

### Stage 5: Virtual Swap Provisioning
AutoFlow connects to the server and evaluates hardware memory. If memory limits are restricted (under 1.5GB available), it automatically configures and mounts a temporary virtual swap file. This prevents heavy compilers from crashing the server due to Out-Of-Memory (OOM) errors.

### Stage 6: Port Scanning
To achieve Zero-Downtime, the active container must continue routing public traffic while the new container is built. AutoFlow scans loopback interface ports to find a random, unused port to assign to the incoming build.

### Stage 7: Secure Code Streaming
AutoFlow creates a temporary directory on the remote server and streams your local code files over an encrypted SSH channel. No code is pushed to third-party registries.

### Stage 8: Container Snapshotting (Rollback Prep)
Before replacing the old build, AutoFlow snapshots the active running container and renames it with a rollback suffix. It remains active and routing traffic.

### Stage 9: Remote Image Compilation
AutoFlow triggers the remote Docker daemon to build the image using the framework-specific configuration. The raw shell outputs are captured and piped back over SSH to your local Desktop interface for real-time build monitoring.

### Stage 10: Environment Variable Injection
Local environment variables are securely transferred to the remote host, mounted directly into the new container’s runtime, and then immediately deleted from the host disk.

### Stage 11: Container Creation & Health Checks
The new container is started. AutoFlow pings the new container's internal port. 
- **Deployment Success:** If it returns a valid HTTP response, the deployment is successful. The rollback backup is deleted, and traffic is routed to the new container.
- **Deployment Failure / Recovery:** If the container crashes or returns an error code, the pipeline triggers a Rollback. The failed container is destroyed, and the snapshot container is immediately reinstated.

### Stage 12: Firewall Modification
AutoFlow modifies `ufw` or `firewalld` rules on the server, blocking direct external connection attempts to your raw container ports, enforcing that all traffic passes through the reverse proxy.

### Stage 13: Reverse Proxy & SSL (Cleanup)
AutoFlow writes the final Nginx configuration block, tests the syntax, reloads the web server, and runs Let's Encrypt `certbot` to provision or renew SSL certificates. Temporary build directories and the virtual swap file are deleted to free up resources.

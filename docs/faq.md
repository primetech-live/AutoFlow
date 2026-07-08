# Frequently Asked Questions (FAQ)

### What happens to my servers if my local computer dies?
Because AutoFlow does not store your server keys in the cloud, a hardware failure on your local machine means you lose access to the local Security Vault. However, your servers will continue running perfectly. 
To regain management access:
1. Install AutoFlow on a new machine.
2. Re-import your server using the original SSH private key (which you should have backed up).
3. Re-import your project folder. AutoFlow will instantly detect the existing containers on the server and resume management without interrupting your active applications.

### Why doesn't AutoFlow use a centralized Docker Registry?
Traditional CI/CD pipelines build a Docker image locally, push it to a registry (like Docker Hub or AWS ECR), and then SSH into the server to pull it. This requires paying for registry storage and wastes bandwidth. 
AutoFlow streams your raw code over SSH and compiles the image natively on the target server. This completely bypasses the need for a registry, saving time, money, and securing your proprietary code.

### Can I use Cloudflare with AutoFlow?
Yes, but with one strict requirement during setup:
When AutoFlow negotiates an SSL certificate via Let's Encrypt, the certificate authority must be able to ping your server's true IP address. If Cloudflare Proxy (the orange cloud) is enabled, this validation request is intercepted, and SSL generation fails. 
**Solution:** Disable the Cloudflare Proxy (set it to DNS-Only) before clicking Deploy. Once AutoFlow successfully provisions the certificate, you can safely re-enable the proxy.

### Does AutoFlow cause downtime during deployments?
No. AutoFlow implements a strict Zero-Downtime orchestration pipeline. 
When a new deployment starts, the old container remains active and continues to route traffic. The new container is built and started on a random, unused port. AutoFlow pings the new container to verify its health. Only after the new container passes health checks does AutoFlow modify the reverse proxy to point to the new container and safely destroy the old one.

### Why does AutoFlow create a Swap file on my server?
Heavy compilation tasks (like building a Next.js or Rust application) can easily consume over 1GB of RAM. If you are deploying to a low-cost, 1GB RAM VPS, the Linux kernel will kill the compiler process (OOM Killer), causing the deployment to freeze or fail.
AutoFlow automatically detects low-memory environments and provisions a temporary Virtual Swap file (e.g., 1.5GB) on your server's SSD. This acts as overflow RAM, ensuring the build completes successfully. The swap file is deleted immediately after the deployment to save disk space.

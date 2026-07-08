# Best Practices

Follow these guidelines to ensure maximum stability, security, and performance when deploying applications with AutoFlow.

---

## Security Best Practices

1. **Use Ed25519 SSH Keys:** Never use password authentication for automated deployments. Generate Ed25519 keys, as they are faster to authenticate and virtually immune to brute-force attacks compared to legacy RSA keys.
2. **Restrict Key Permissions:** On Linux/macOS, ensure your private keys are set to `chmod 600`. On Windows, remove all inherited permissions and grant exclusive read access to your user account. AutoFlow will actively block deployments if key permissions are too broad.
3. **Never Commit Secrets:** AutoFlow stores environment variables in its encrypted local vault. Do not hardcode API keys or database passwords into your application source code or `Dockerfile`.

## Server Management Best Practices

1. **Use Dedicated Deployment Users:** Instead of connecting to your VPS as the `root` user, create a dedicated user (e.g., `autoflow_deployer`) with restricted `sudo` privileges. This limits the blast radius if your server is compromised.
2. **Enable Uncomplicated Firewall (UFW):** Ensure your server runs a strict firewall. Allow only ports `22` (SSH), `80` (HTTP), and `443` (HTTPS). AutoFlow will automatically route traffic from port 80/443 to your internal containers.
3. **Monitor Disk Space:** Container builds cache intermediate image layers. While AutoFlow attempts to prune unused images automatically, a 20GB VPS can fill up quickly. Regularly check the Disk widget on the AutoFlow dashboard.

## Project Organization

1. **Keep Repositories Focused:** AutoFlow works best with single-application repositories or standard monorepos. Avoid placing multiple disparate backend services in the exact same root directory, as the Framework Detection Engine might misidentify the primary build target.
2. **Use Lockfiles:** Always commit your `package-lock.json`, `yarn.lock`, or `Pipfile.lock`. AutoFlow relies on these files to ensure deterministic builds on the remote server. Without a lockfile, the server might install a newer, breaking dependency version during deployment.

## Performance Best Practices

1. **Utilize Multi-Stage Builds (Go/Rust/Java):** AutoFlow handles this automatically for supported compiled languages, but if you write custom deployment configurations, always compile in a heavy container and copy the binary to a scratch container to keep image sizes under 50MB.
2. **Leverage Virtual Swap Sparingly:** AutoFlow automatically mounts virtual swap on low-memory servers (1GB RAM). However, swap memory uses the SSD, which is significantly slower than physical RAM. If your application consistently triggers swap usage during builds, consider upgrading your VPS to 2GB or 4GB of RAM to dramatically reduce deployment times.

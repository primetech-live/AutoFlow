# Troubleshooting & Diagnostics

This manual provides detailed commands and workflows to resolve common deployment, connection, and operating system issues.

---

## Windows Operating System Diagnostics

### 1. PowerShell Script Execution Blocked
- **Symptom:** Executing `autoflow` throws: `cannot be loaded because running scripts is disabled on this system.`
- **Cause:** PowerShell restricts unsigned scripts.
- **Fix:** Open PowerShell as Administrator and run:
  ```powershell
  Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope CurrentUser -Force
  ```

### 2. SSH Key Permissions Too Open
- **Symptom:** SSH connections crash with `WARNING: UNPROTECTED PRIVATE KEY FILE!`.
- **Cause:** Windows access control lists (ACL) grant read access to groups like `SYSTEM` by default. SSH requires exclusive owner access.
- **Fix:** Run these commands to strip inherited permissions and grant explicit access:
  ```powershell
  icacls.exe "C:\path\to\id_ed25519" /inheritance:r /c
  icacls.exe "C:\path\to\id_ed25519" /grant:r "$($env:USERNAME):R" /c
  ```

### 3. CRLF Line Ending Errors in Containers
- **Symptom:** Container crashes on boot with `exec user process caused: no such file or directory`.
- **Cause:** Windows Git clients often save files with CRLF (Carriage Return + Line Feed). Linux containers cannot interpret the Carriage Return.
- **Fix:** Force your Git client to use standard Linux `LF`:
  ```bash
  git config --global core.autocrlf false
  git config --global core.eol lf
  git rm --cached -r .
  git reset --hard
  ```

---

## macOS & Linux Operating System Diagnostics

### 1. macOS Sandbox File Permissions
- **Symptom:** Selecting SSH keys or projects silently fails.
- **Cause:** macOS restricts apps from reading `Desktop`, `Documents`, or `Downloads` without explicit permission.
- **Fix:** Move your projects to a developer folder (e.g., `~/Developer`) and grant AutoFlow `Full Disk Access` in `System Settings -> Privacy & Security`.

### 2. Apple Silicon (ARM64) Architecture Mismatch
- **Symptom:** Container fails on the VPS with `WARNING: The requested image's platform (linux/arm64) does not match the detected host platform (linux/amd64)`.
- **Cause:** Compiling Docker images locally on an M1/M2/M3 Mac targets ARM processors, which fail on standard Intel cloud servers.
- **Fix:** AutoFlow defaults to remote-build mode to prevent this, but if you forced local compilation, revert your configuration to build directly on the remote server.

### 3. Missing Shell Profile Path
- **Symptom:** `autoflow: command not found` after installing the CLI.
- **Fix:** Append the local bin pathway to your shell profile:
  ```bash
  echo 'export PATH="$HOME/.local/bin:$PATH"' >> ~/.zshrc
  source ~/.zshrc
  ```

### 4. SELinux Proxy Connection Blocks (RHEL / Rocky Linux)
- **Symptom:** The deployed site returns a 502 Bad Gateway. Nginx logs show `Permission denied while connecting to upstream`.
- **Cause:** Security-Enhanced Linux (SELinux) blocks Nginx from connecting to internal Docker sockets.
- **Fix:** Allow web servers to initiate network connections:
  ```bash
  sudo setsebool -P httpd_can_network_connect 1
  ```

---

## General Server Diagnostics

### 1. Port Conflicts
- **Symptom:** Deployment fails at the container creation stage: `Bind for 0.0.0.0:3000 failed: port is already allocated.`
- **Cause:** Another process on the server is already using that port.
- **Fix:** SSH into the server, find the rogue process, and kill it:
  ```bash
  sudo lsof -i :3000
  sudo kill -9 <process-id>
  ```
  Alternatively, override the port in AutoFlow's Project Details screen.

### 2. SSL / Certbot Refused
- **Symptom:** AutoFlow fails to generate an SSL certificate during the final deployment stage.
- **Cause:** Either DNS hasn't propagated, Cloudflare Proxy is active, or server firewalls are blocking port 80.
- **Fix:**
  - Temporarily disable Cloudflare Proxy (set to DNS-Only).
  - Open server ports: `sudo ufw allow 80/tcp && sudo ufw allow 443/tcp`.

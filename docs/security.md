# Security & Cryptography

Security is the foundational layer of AutoFlow. Because AutoFlow manages remote servers and handles sensitive environment variables, it employs strict cryptographic standards and access protocols.

---

## Credential Storage

Unlike commercial PaaS platforms that require you to upload your server credentials to their databases, AutoFlow employs a "Local-First" storage model.
- All remote access tokens, SSH private keys, and environment variables are stored on your local hard drive.
- No third-party database ever receives your server access keys.

### Encryption Standard
- **Algorithm:** Secrets are encrypted using the Advanced Encryption Standard in Galois/Counter Mode (AES-256-GCM).
- **Integrity Check:** GCM provides authenticated encryption. It generates an authentication tag that verifies the file has not been tampered with. If a malicious program modifies your encrypted configuration files, AutoFlow detects the signature mismatch and locks down.
- **Key Derivation:** Encryption keys are derived from your Master Password combined with a cryptographic salt, processed through 100,000 hashing iterations.

## Token & SSH Key Handling

- **Volatile Memory:** When you unlock AutoFlow, decrypted keys are loaded directly into volatile RAM. They are never written to disk in plain text.
- **Idle Timeout:** An automated security monitor clears all decrypted credentials from memory after 15 minutes of inactivity.
- **SSH Key Recommendations:** AutoFlow strongly recommends Ed25519 keys due to their resistance to side-channel attacks and signature manipulation. RSA (minimum 4096-bit) is supported as a fallback. Password-based SSH authentication is explicitly discouraged for production environments.

## Remote Secrets & Temporary Files

During a deployment, AutoFlow must securely transmit local configuration files and environment variables to the remote host.
1. AutoFlow establishes an encrypted SFTP channel.
2. It writes environment variables into temporary files inside a restricted, hidden directory (`.autoflow_tmp`) on the remote server.
3. Once the Docker container is constructed and the variables are successfully mounted into the container's isolated memory space, AutoFlow triggers a cleanup routine.
4. **Cleanup:** The temporary files on the remote disk are immediately deleted. This prevents secrets from persisting on the host file system, protecting against potential data leakage if the server is later compromised.

## Permissions

AutoFlow enforces strict permission checks on both local and remote files.
- **Local Keys:** If your private SSH key file permissions are too open (e.g., readable by other users on your Windows/macOS machine), AutoFlow will reject the connection to prevent unauthorized access.
- **Remote Execution:** AutoFlow restricts its remote build processes. It executes deployments using the connection user's permissions, modifying `ufw`/`firewalld` settings to ensure Docker ports are never exposed publicly, forcing all traffic through the secure reverse proxy.

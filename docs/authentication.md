# Authentication & Security Vault

AutoFlow is built with a "Local-First" security model. Rather than storing your sensitive server credentials on third-party cloud platforms, AutoFlow keeps them heavily encrypted on your local machine.

---

## The Security Vault

The Security Vault is the core cryptographic storage engine within AutoFlow, designed to shield your SSH keys, repository tokens, and server passwords.

### Encryption Architecture
When you set up AutoFlow, you create a Master Password. 
- AutoFlow combines your master password with a unique cryptographic salt.
- This combination is processed through 100,000 hashing iterations using a secure key derivation function.
- The resulting strong encryption key is used to encrypt your secrets using the **Advanced Encryption Standard in Galois/Counter Mode (AES-256-GCM)**.

AES-256-GCM provides authenticated encryption. This means it generates an authentication tag that verifies both the confidentiality and integrity of the encrypted data. If an encrypted configuration file is tampered with on your disk by malicious software, the decryption process will detect the change and reject the data.

### Volatile Memory Lifecycles
AutoFlow strictly limits how long decrypted keys live in system memory to protect against memory dump attacks:
- Keys are decrypted only when an orchestration task begins.
- Decrypted keys are kept in volatile RAM.
- An automated idle timer clears all decrypted credentials from memory after 15 minutes of inactivity. After this timeout, you must re-enter your Master Password to unlock the vault.

---

## Session Management

### Google Login & Supabase Integration
AutoFlow integrates with Supabase to provide authentication for user profiles and billing.
- You can authenticate into the AutoFlow platform using Google OAuth or email/password.
- This cloud authentication manages your **User Profile**, **Subscription Tier**, and **Available Credits**.
- **Important:** Your Supabase cloud session is completely decoupled from your Local Security Vault. The cloud database *never* receives your server SSH keys or deployment tokens.

### The Authentication Handshake
When you launch AutoFlow:
1. The app verifies your active cloud session with Supabase to load your profile and credits.
2. You are presented with a local Lock Screen.
3. You must enter your local Master Password (and an optional 6-digit Authenticator code if MFA is enabled locally) to unlock the Security Vault.
4. Only when both conditions are met can you initiate deployments.

---

## Local Storage

All project metadata, server connection details (encrypted), and deployment histories are stored in a hidden configuration directory in your home folder. 
Because this data is local, you can easily back it up or sync it across devices using secure file synchronization tools, provided you remember your Master Password to decrypt it on the new machine.

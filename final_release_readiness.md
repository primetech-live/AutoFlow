# AutoFlow Release Readiness & Commercial Scopes

This document provides a technical and architectural breakdown of the current state of **AutoFlow vNext** and designs the implementation paths for the 5 pending commercial release features.

---

## 🖥️ Current Product Stage (Architectural Breakdown)

AutoFlow vNext is a local-first deployment coordinator structured as a **Dual UI + CLI** application sharing a unified configuration engine.

```
       ┌───────────────────────────────┐
       │   AutoFlow Desktop App (UI)   │
       └───────────────┬───────────────┘
                       │ (IPC Channel)
                       ▼
       ┌───────────────────────────────┐
       │      Electron Main Process    │◄─── (Stores encrypted credentials)
       └───────────────┬───────────────┘
                       │ (Embedded Node)
                       ▼
       ┌───────────────────────────────┐
       │     Zero-Dependency CLI       │◄─── (Bundled dist/cli.js, NPM-free)
       └───────────────┬───────────────┘
                       │ (SSH / SFTP)
                       ▼
       ┌───────────────────────────────┐
       │       Target VPS Server       │◄─── (Docker / Nginx / Certbot / Swap)
       └───────────────────────────────┘
```

### 1. The NPM-Free CLI Model
- **Vite Bundling (`vite.cli.config.ts`):** Rollup packages all production dependencies (`node-ssh`, `inquirer`, `speakeasy`, `chalk`, `simple-git`, `commander`, etc.) into a single executable `cli.js` file (~2.2MB).
- **Desktop Installation Hook (`src/main/cliInstaller.ts`):**
  - **Windows:** Copies `cli.js` to `%LOCALAPPDATA%/Autoflow` and writes a wrapper `autoflow.cmd` (`@echo off\nnode "%~dp0cli.js" %*\n`). It appends this path to the user's registry `PATH` variable using a non-admin PowerShell command.
  - **macOS / Linux:** Copies `cli.js` to `~/.local/bin/autoflow-cli.js` and writes a shell wrapper `autoflow` calling `node`. It appends the path to shell configuration profiles (`.zshrc`, `.bashrc`, or `config.fish`).
  - **No Global Registry Dependency:** End-users do not run `npm install -g`. The binary runs standalone using their local Node.js environment.

### 2. State & Security Engine
- **Z+ Cryptographic Vault (`src/core/vault.ts`):** Uses `PBKDF2` (100k rounds, custom salt) to hash the master password. Project tokens and credentials are encrypted using `AES-256-GCM` with a key generated via `scrypt` and validated through `speakeasy` TOTP.
- **Sanitized Execution Pipeline (`src/utils/shell.ts`):** Escapes all remote command parameters using `escapeShellArg` to prevent shell injection vectors.
- **Credential Protection (`src/commands/deploy/errors.ts`):** Intercepts raw SSH / git stdout/stderr logs and filters out access tokens or passwords prior to file logging or console writing.

---

## 📋 The 5 Commercial Launch Scopes

To safely commercialize the platform under **PrimeTech**, the following 5 scopes must be integrated:

```
                  ┌────────────────────────────────────────┐
                  │          Supabase Database             │
                  └──────────▲──────────────────▲──────────┘
                             │ (OAuth Session)  │ (User Plan Updates)
                             │                  │
   ┌─────────────────────────┴──┐            ┌──┴─────────────────────────┐
   │ AutoFlow Electron App      │            │  Lemon Squeezy / Stripe    │
   │ (Deep Link: autoflow://)   │            │  (Payment Webhooks)        │
   └────────────────────────────┘            └────────────────────────────┘
```

### 1. Authentication (Cloud Identity)
To sync project limits, license statuses, and user accounts, AutoFlow will use **Supabase Auth** with GitHub and Google OAuth.
- **Implementation Strategy:**
  1. The Desktop App opens the user's web browser to the Supabase OAuth sign-in page.
  2. The Electron Main Process registers a custom protocol handler (`app.setAsDefaultProtocolClient('autoflow')`) to listen for deep links in `src/main/index.ts`.
  3. Upon successful sign-in, the Supabase authentication page redirects the browser to `autoflow://auth-callback?access_token=...&refresh_token=...`.
  4. The main process captures the deep link event (`open-url` on macOS/Linux or process argument scanning on Windows), extracts the authentication payload, and writes the active session token to the encrypted local Vault.
  5. The main process notifies the React renderer process to update the application UI to an authenticated state.

### 2. Monetization (Plan Limits)
AutoFlow will implement a freemium limit model targeting project slots and deployments.
- **Limits Structure:**
  - **Free Tier:** Limited to **1 active project** and **3 deployments** in total.
  - **Premium Tier:** Unlimited projects and deployments.
- **Implementation Strategy:**
  - A global toggle `ENABLE_COMMERCIAL_MODE` (default `false`) controls enforcement.
  - When active, `src/main/ipc.ts` intercepts the following calls:
    - **`projects:add`:** Before saving a new project path, checks the user's plan state and length of saved projects. If the plan is Free and `getSavedProjects().length >= 1`, rejects the addition and throws an error asking the user to upgrade.
    - **`deploy:run`:** Before initiating the 13-step deployment engine, checks the deployment history length for the project. If the user is on the Free tier and has completed 3 deployments, prevents the build and instructs the user to upgrade.

### 3. Licensing (Checkout & Stripe Webhooks)
- **Implementation Strategy:**
  1. Integrates Stripe or Lemon Squeezy overlay links inside the Desktop App's subscription panel.
  2. Upon checkout, a payment provider webhook fires to a serverless backend function (Supabase Edge Function).
  3. The Edge Function maps the payment provider event (`subscription.created`, `subscription.updated`, or `subscription.cancelled`) to the Supabase user profile table by updating the user's `is_premium` status, `subscription_id`, and `expiration_date`.
  4. The Electron client requests user plan updates on startup or before a deployment cycle, caching the plan status locally in the Vault with a 24-hour expiration token to support offline checks.

### 4. Terms and Conditions (Liability Waiver)
A legal agreement must be acknowledged during user onboarding:
- **Core Clauses:**
  - **Self-Hosted Server Indemnification:** AutoFlow operates strictly as a deployment coordinator that runs commands directly on the user's hardware. PrimeTech is not liable for data loss, server failures, out-of-memory crashes, or configurations that result in target server down-time.
  - **No Hosting Liability:** AutoFlow does not provide the server resources. The user is solely responsible for maintaining backups, server firewalls, system packages, and domain registrar configurations.

### 5. Privacy Policy (Local-First Promise)
A clear statement detailing credentials isolation:
- **Core Commitments:**
  - **Local Credentials Policy:** SSH Private Keys, SSH Passwords, and Git Personal Access Tokens (PATs) are never uploaded to Supabase or PrimeTech servers.
  - **Encryption at Rest:** All credentials remain encrypted on the local device using AES-256-GCM.
  - **Analytics Policy:** No telemetry or source code parsing data is collected or sent to external servers.

---

## 🛠️ Verification & Compilation Pipeline

To run the pipeline and compile the NPM-free packages:

```bash
# 1. Install dependencies
npm install

# 2. Compile standalone CLI engine (dist/cli.js)
npm run build:cli

# 3. Build UI bundle & compile TypeScript files
npm run build

# 4. Run tests
npm test

# 5. Package application installers in release/
npm run dist
```

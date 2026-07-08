# AutoFlow — Core Reference for AI Agents

This document is the single-source-of-truth briefing for any AI system working on,
reasoning about, or generating code for the AutoFlow project. Read this file in full
before making any architectural decisions, writing new modules, or answering questions
about how the product works.

---

## 1. What AutoFlow Is

AutoFlow (`autoflow-tech`, version 1.1.1 at time of writing) is a commercial-grade
deployment orchestration tool. It has two delivery surfaces:

1. **A Desktop Application** — an Electron app (main process + Vite/React renderer).
2. **A Standalone CLI** — a compiled Node.js binary shipped inside the Electron
   installer and also usable independently via `npx` or direct execution.

Both surfaces share the same core TypeScript engine. The Desktop app wraps it with
IPC handlers (`src/main/ipc.ts`); the CLI wraps it with interactive prompts
(`src/commands/`). The shared engine lives in `src/core/`.

AutoFlow's job: take a developer's local source code directory, connect to their
remote Linux VPS over SSH, and fully automate the build → containerise → proxy →
SSL pipeline so the application is live on the internet. No Docker registry, no
CI/CD vendor, no cloud credentials leaving the local machine.

---

## 2. Repository Layout

```
AUTOFLOW/
├── bin/                    # CLI entry point (index.ts)
├── build/                  # Electron-builder assets (icons, NSIS sidebar, license)
├── docs/                   # Official user-facing documentation (16 markdown files)
├── scripts/                # Build-time helpers (copy-assets, postinstall)
├── src/
│   ├── commands/           # CLI command implementations
│   │   ├── init.ts         # `autoflow init` — interactive project initialiser
│   │   ├── setup.ts        # `autoflow setup` — server bootstrapping
│   │   ├── status.ts       # `autoflow status` — container / server health
│   │   ├── stop.ts         # `autoflow stop` — container lifecycle
│   │   └── deploy/         # The deployment pipeline (16 service modules)
│   │       ├── index.ts    # Pipeline orchestrator (calls services in order)
│   │       ├── ci.ts       # Remote CI verification checks
│   │       ├── sshService.ts
│   │       ├── swapService.ts
│   │       ├── portService.ts
│   │       ├── gitService.ts
│   │       ├── remoteGitService.ts
│   │       ├── dockerBuildService.ts
│   │       ├── containerService.ts
│   │       ├── envService.ts
│   │       ├── rollback.ts
│   │       ├── nginxService.ts
│   │       ├── sslService.ts
│   │       ├── ufwService.ts
│   │       ├── configService.ts
│   │       └── errors.ts
│   ├── core/               # Shared business-logic modules
│   │   ├── config.ts       # Read/write project & global JSON configs
│   │   ├── connection.ts   # SSH2 connection manager (key auth, password auth)
│   │   ├── deployer.ts     # DeployerEngine class (job tracking, history)
│   │   ├── initializer.ts  # Smart Detection Engine + project scaffolding
│   │   ├── installer.ts    # Remote server dependency installer
│   │   ├── monitor.ts      # Real-time telemetry (CPU, RAM, disk, containers)
│   │   ├── scanner.ts      # ProjectScanner — recursive directory scanner
│   │   └── vault.ts        # AES-256-GCM encrypted credential vault
│   ├── main/               # Electron main process
│   │   ├── index.ts        # BrowserWindow creation, app lifecycle
│   │   ├── ipc.ts          # IPC bridge (renderer ↔ core engine)
│   │   ├── supabase.ts     # Supabase client for cloud auth
│   │   └── cliInstaller.ts # Copies CLI binary + injects PATH
│   ├── preload/            # Electron preload (contextBridge)
│   │   └── index.ts
│   ├── renderer/src/       # React frontend (Vite)
│   │   ├── App.tsx         # Root component, routing, global state
│   │   ├── main.tsx        # ReactDOM entry
│   │   ├── index.css       # Global stylesheet
│   │   ├── pages/
│   │   │   ├── Dashboard.tsx
│   │   │   ├── LiveStatus.tsx
│   │   │   ├── LockScreen.tsx
│   │   │   ├── Onboarding.tsx
│   │   │   ├── ProjectDetails.tsx
│   │   │   └── Settings.tsx
│   │   ├── components/     # Reusable UI components (Titlebar, etc.)
│   │   ├── contexts/       # React contexts
│   │   ├── core/           # Renderer-side helpers (AuthProvider, supabase client)
│   │   └── stores/         # State management
│   └── utils/              # Shared utilities (logger, etc.)
├── package.json            # appId: com.autoflow.vnext
├── vite.cli.config.ts      # Vite config for CLI bundle
├── tsconfig.json
└── README.md / NEW_README.md
```

---

## 3. The Three Pillars

Every design decision in AutoFlow traces back to three invariants:

### 3a. Local-First
No server credentials leave the user's machine. The vault file lives at
`~/.autoflow/vault.json`, encrypted with AES-256-GCM. The encryption key is
derived from the user's master password + a random salt through 100,000 PBKDF2
iterations. An idle timer (`IDLE_TIMEOUT_MS = 15 * 60 * 1000`) wipes decrypted
material from memory after 15 minutes.

### 3b. Zero-Config
The Smart Detection Engine (`src/core/initializer.ts`) reads marker files in the
project root and sets `appType` automatically:
- `go.mod` → `"go"`
- `pom.xml` → `"java"`
- `Gemfile` with `rails` → `"rails"`, else `"ruby"`
- `requirements.txt` with `django` → `"django"`, with `flask`/`fastapi` → `"flask"`
- `package.json` with `next` → `"next"`, with `vite`/`react-scripts` → `"static"`,
  else `"node"`
- `index.php` → `"php"`
- `index.html` without package.json → `"static-html"`

Each `appType` maps to a Dockerfile template generated at deploy time by
`dockerBuildService.ts`. The user never writes a Dockerfile.

### 3c. Zero-Downtime (Transactional Deploys)
The old container stays live while the new one builds on a random free port
(found by `portService.ts`). Only after a successful health check does the Nginx
config swap. If the health check fails, `rollback.ts` restores the snapshotted
container. The sequence is atomic from the user's perspective.

---

## 4. The Deployment Pipeline (13 Stages)

Orchestrated by `src/commands/deploy/index.ts`. Each stage is a discrete service:

| # | Stage | Service File | What It Does |
|---|-------|-------------|--------------|
| 1 | Config merge | `configService.ts` | Loads project config, merges with global config, decrypts vault |
| 2 | Static checks | `ci.ts` | Validates migration syntax, blocks SQL injection patterns |
| 3 | Git sync | `gitService.ts` | Verifies branch, commit SHA, checks for unstaged changes |
| 4 | Remote CI | `ci.ts` | (Optional) Queries GitHub Actions API for passing checks |
| 5 | Swap provision | `swapService.ts` | If RAM < 1.5GB, creates + mounts temporary swapfile |
| 6 | Port scan | `portService.ts` | Finds unused port on server loopback interface |
| 7 | Code stream | `sshService.ts` + `remoteGitService.ts` | SFTP upload or remote `git pull` with temp credential helper |
| 8 | Snapshot | `rollback.ts` | Renames active container with `_rollback` suffix |
| 9 | Docker build | `dockerBuildService.ts` | Runs `docker build` on server, streams stdout back to client |
| 10 | Env inject | `envService.ts` | SFTPs `.env` to tmp path, mounts into container, deletes file |
| 11 | Health check | `containerService.ts` | HTTP pings new container; on fail → triggers rollback |
| 12 | Firewall | `ufwService.ts` | Blocks direct port access, allows only 80/443 through proxy |
| 13 | Nginx + SSL | `nginxService.ts` + `sslService.ts` | Writes Nginx server block, runs certbot for Let's Encrypt |

If any stage throws, the pipeline catches it in `errors.ts`, triggers `rollback.ts`,
cleans up swap/tmp files, and marks the deployment as `"Failed"` or `"Rolled Back"`
in the history store (`~/.autoflow/history/`).

---

## 5. The Vault (`src/core/vault.ts`)

- **Path:** `~/.autoflow/vault.json`
- **Algorithm:** `aes-256-gcm`
- **Key derivation:** Master password + salt → 100K iterations → 256-bit key
- **Stored fields:** `passwordHash`, `totpSecret` (encrypted), `salt`,
  optional `sshPassword`, optional `projectTokens` map
- **TOTP:** Uses `speakeasy` library for time-based one-time passwords
- **Data integrity:** On JSON parse failure, the vault creates a timestamped
  `.corrupted` backup before throwing, so the user never silently loses data
- **File permissions:** Written with mode `0o600` (owner read/write only)

---

## 6. The Connection Layer (`src/core/connection.ts`)

Wraps the `ssh2` library. Supports:
- Ed25519 key auth (recommended)
- RSA key auth (minimum 4096-bit enforced at documentation level)
- Password auth (supported but discouraged)

The connection manager multiplexes a single SSH session for:
- Shell command execution (deployer steps)
- SFTP file transfers (code streaming, env injection)
- Telemetry polling (monitor queries)

---

## 7. Real-Time Monitoring (`src/core/monitor.ts`)

The monitor runs as a background polling loop over the active SSH session.
It executes low-level Linux commands to retrieve:
- CPU utilization (parsed from `/proc/stat` or `top`)
- Memory / swap usage (from `free -m`)
- Disk allocation (from `df -h`)
- Active Docker containers and their resource consumption

Results are emitted as events and consumed by the Dashboard renderer
(`src/renderer/src/pages/Dashboard.tsx`, which is 43K+ bytes of React code
handling real-time widget updates).

---

## 8. The Desktop App (Electron)

### Process Architecture
- **Main process** (`src/main/index.ts`): Creates the BrowserWindow, registers
  IPC handlers, manages app lifecycle (single-instance lock, auto-updater).
- **Preload** (`src/preload/index.ts`): Exposes a safe `contextBridge` API.
- **Renderer** (`src/renderer/`): Vite-bundled React app.

### IPC Bridge (`src/main/ipc.ts`, 23KB)
This is the nervous system of the Desktop app. It maps every renderer action
(deploy, stop, add server, scan projects, etc.) to calls into `src/core/`.
All deployment log streaming happens through IPC event channels.

### Pages
| Page | File | Purpose |
|------|------|---------|
| Lock Screen | `LockScreen.tsx` | Master password + TOTP entry |
| Onboarding | `Onboarding.tsx` | First-run setup wizard (server, vault, MFA) |
| Dashboard | `Dashboard.tsx` | Server telemetry, container list, project grid |
| Project Details | `ProjectDetails.tsx` | Env vars, domain config, deploy history, deploy button |
| Live Status | `LiveStatus.tsx` | Real-time build log terminal (virtualized rendering) |
| Settings | `Settings.tsx` | Profile, theme, CLI install, factory reset |

### Authentication
The renderer uses a Supabase client (`src/renderer/src/core/supabase.ts` and
`AuthProvider.tsx`) for cloud authentication (Google OAuth). This manages user
profiles, subscription tiers, and credits. It is completely decoupled from the
local vault — Supabase never receives SSH keys or server passwords.

---

## 9. The CLI

Entry point: `bin/index.ts` → compiles to `dist/bin/index.js`.
Declared in `package.json` as `"bin": { "autoflow": "./dist/bin/index.js" }`.

### Key Commands
- `autoflow init` → `src/commands/init.ts` (interactive project setup, 28KB)
- `autoflow setup` → `src/commands/setup.ts` (server bootstrapping)
- `autoflow deploy` → `src/commands/deploy/index.ts` (the 13-stage pipeline)
- `autoflow status` → `src/commands/status.ts` (container health)
- `autoflow stop` → `src/commands/stop.ts` (container lifecycle)

The CLI reads the same `~/.autoflow/` config directory as the Desktop app,
so actions in one interface are immediately visible in the other.

---

## 10. Build & Distribution

- **Build:** `npm run build` chains CLI build (Vite), UI build (Vite), TypeScript
  compilation, and asset copying.
- **Package:** `npm run dist` invokes `electron-builder`.
- **Windows:** NSIS installer (multi-step wizard with custom sidebar branding).
- **macOS:** DMG + ZIP (hardened runtime, entitlements for camera/mic/screen).
- **Linux:** AppImage + DEB + RPM.
- **Auto-update:** Electron-builder's built-in `electron-updater` (NSIS target).

The CLI binary is bundled inside the Electron installer. During onboarding,
`src/main/cliInstaller.ts` copies it to a local directory and injects that
directory into the user's system PATH.

---

## 11. Key Dependencies

| Dependency | Purpose |
|------------|---------|
| `electron` | Desktop shell |
| `electron-builder` | Packaging and distribution |
| `ssh2` | SSH/SFTP connections to remote servers |
| `speakeasy` | TOTP (Time-based One-Time Password) generation |
| `@supabase/supabase-js` | Cloud authentication and user profiles |
| `vite` | Frontend and CLI bundling |
| `react` + `react-dom` | Renderer UI |

---

## 12. Data Storage Locations

| Data | Path | Format |
|------|------|--------|
| Encrypted vault | `~/.autoflow/vault.json` | AES-256-GCM encrypted JSON |
| Global config | `~/.autoflow/config.json` | Plain JSON (no secrets) |
| Project configs | `<project>/.autoflow/` | Plain JSON (server target, domain, port) |
| Active job marker | `~/.autoflow/jobs/active.json` | Tracks in-progress deploys for crash recovery |
| Deploy history | `~/.autoflow/history/<project>.json` | Timestamped deployment records |
| CLI logs | `~/.autoflow/cli.log` | Plain text |

---

## 13. Important Behavioural Notes for AI Agents

1. **Never suggest uploading keys to a cloud service.** AutoFlow's entire value
   proposition is that credentials stay local. Any suggestion to store SSH keys
   in Supabase, S3, or a CI/CD vault violates the product's core philosophy.

2. **The Supabase integration is for auth and billing only.** It manages Google
   OAuth sessions, subscription tiers, and credit balances. It does not store
   server configurations, SSH keys, or deployment metadata.

3. **Dockerfiles are generated, not user-written.** The framework detection engine
   produces Dockerfiles at deploy time. If a user asks "where is the Dockerfile",
   it does not exist on disk — it is streamed to the remote server during stage 9.

4. **The deploy pipeline is transactional.** If you modify any deploy service,
   ensure the rollback path in `rollback.ts` still works. Breaking rollback means
   breaking the zero-downtime guarantee.

5. **The vault is the single point of failure.** If `vault.json` is corrupted and
   no `.corrupted` backup exists, the user loses all stored credentials. The
   `handleCorruptedJson` function in `vault.ts` exists specifically to prevent
   silent data loss — do not bypass it.

6. **IPC is the bridge.** Every Desktop feature flows through `src/main/ipc.ts`.
   If you are adding a new feature to the renderer, you must add the corresponding
   IPC handler in this file. There is no direct `require()` from renderer to core.

7. **Both interfaces share state.** The CLI and Desktop app read/write the same
   `~/.autoflow/` directory. Never create interface-specific config files that
   would cause state divergence.

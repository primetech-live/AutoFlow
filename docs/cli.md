# Command Line Interface (CLI) Guide

The AutoFlow CLI is a standalone, compiled executable packaged with the Desktop Application. It provides headless management of your infrastructure, making it perfect for power users and automation scripts.

Because both the Desktop App and CLI share the same local database, commands executed in the CLI are instantly reflected in the graphical interface.

---

## Global Commands

### `autoflow server add`
Registers a new remote Virtual Private Server.
- **Arguments:** None. The command triggers an interactive prompt.
- **Interactive Prompts:** IP Address, Username, Path to SSH Key.
- **Exit Codes:** `0` (Success), `1` (Validation Failed/Connection Refused).

### `autoflow server list`
Outputs a formatted table of all connected servers and their health status.
- **Options:** 
  - `--json`: Outputs the list in raw JSON format for scripting.

### `autoflow project import [path]`
Registers a local directory as an AutoFlow project.
- **Arguments:** `path` (Optional, defaults to current directory `.`).
- **Workflow:** Generates the hidden `.autoflow` metadata folder in the target directory and runs initial framework detection.

### `autoflow env set [KEY=VALUE]`
Injects environment variables into the project vault. Must be run inside an imported project directory.
- **Examples:**
  ```bash
  autoflow env set DATABASE_URL=postgres://user:pass@host/db
  autoflow env set NODE_ENV=production
  ```
- **Security:** Values are encrypted immediately and never stored in plain text.

### `autoflow deploy`
Initiates the 13-stage orchestration pipeline. Must be run inside an imported project directory.
- **Options:**
  - `--server [IP]`: Override the default server target for this deployment.
  - `--skip-tests`: Bypasses remote testing verification checks.
  - `--force`: Ignore static syntax scanning warnings and force the build.
- **Output:** Streams sanitized, real-time build logs directly to your terminal.
- **Exit Codes:** 
  - `0`: Deployment Successful.
  - `1`: Deployment Failed (Rollback triggered).
  - `2`: Authentication Error (Vault Locked).

### `autoflow container list`
Lists all active containers on the current target server.
- **Options:**
  - `--all`, `-a`: Show stopped and dead containers in addition to running ones.

### `autoflow container exec [container-id] [command]`
Opens a remote shell or executes a command inside a running container.
- **Arguments:**
  - `container-id`: The ID or name of the container.
  - `command`: The command to run (e.g., `/bin/sh`).
- **Examples:**
  ```bash
  autoflow container exec web_app_1 /bin/sh
  autoflow container exec db_1 pg_dump > backup.sql
  ```

---

## CLI Exit Codes Reference

| Code | Meaning | Description |
|---|---|---|
| `0` | Success | The command completed successfully. |
| `1` | General Error | A standard failure (e.g., bad connection, failed build). |
| `2` | Auth Error | Security Vault is locked or Master Password required. |
| `126` | Permission Denied | Missing executable permissions on SSH keys or scripts. |
| `130` | Terminated | Command aborted by user (`Ctrl+C`). |

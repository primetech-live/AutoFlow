# Configuration & Local Storage

AutoFlow manages state and settings using a series of hidden configuration files stored directly on your local machine and your project directories.

---

## Global Configuration Directory

AutoFlow stores global settings and the encrypted Security Vault in a hidden directory located in your operating system's home folder.
- **Windows:** `C:\Users\Username\.autoflow`
- **macOS/Linux:** `~/.autoflow`

### Directory Structure
- `~/.autoflow/vault.db`: The encrypted AES-256-GCM database containing your server profiles and connection keys.
- `~/.autoflow/settings.json`: User interface preferences, telemetry toggles, and theme settings.
- `~/.autoflow/cli.log`: Output logs for the Standalone CLI commands.

**Warning:** Do not modify these files manually. Tampering with `vault.db` will break the encryption signature and permanently lock your credentials, requiring a factory reset.

## Project Configuration

When you import a project, AutoFlow creates a `.autoflow` folder in the root of the repository. This folder tracks project-specific deployment targets and overrides.

### `.autoflow/project.json`
This file contains the metadata linking your local directory to a specific server target.
```json
{
  "project_id": "prj_8f72c1",
  "name": "api-backend",
  "server_target": "srv_39a2b",
  "domain": "api.example.com",
  "framework_override": null,
  "port_override": 8080,
  "volumes": [
    "/var/lib/mysql:/var/lib/mysql"
  ]
}
```

### Environment Variables
Environment variables are **not** stored in plain text within the project folder. They are encrypted and stored in the global `vault.db` linked to the `project_id`. This ensures that if you accidentally commit the `.autoflow` folder to a public GitHub repository, your production secrets remain safe.

## .gitignore Best Practices
AutoFlow automatically attempts to append `.autoflow/` to your project's `.gitignore` file. It is safe to commit the `project.json` file if you are working with a team, as it only contains UUIDs and basic routing rules, but ignoring the entire `.autoflow` directory prevents configuration clutter in your Git history.

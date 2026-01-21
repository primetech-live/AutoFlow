# AutoFlow CLI

AutoFlow is an automated CI/CD CLI tool designed for students and beginners. It simplifies the deployment process by bridging your local development environment directly to a remote server using Git and Docker.

---

## 1. Codebase Analysis & Structure

The project starts at `bin/index.js`, which serves as the entry point using `commander` for argument parsing. It delegates commands to the `src/commands/` directory.

### Key Files
- **`bin/index.js`**: Registers commands (`init`, `deploy`, `status`, `stop`) and displays the CLI banner.
- **`src/commands/init.js`**: Handles project setup.
- **`src/commands/deploy.js`**: Manages the deployment pipeline.
- **`src/utils/logger.js`**: comprehensive logging utility using `chalk` for colored output.

---

## 2. Workflow & Logic Analysis

### Initialization Flow (`autoflow init`)
1.  **User Prompts**: Uses `inquirer` to collect project details (Project Name, Git URL, Server IP, SSH credentials, Port).
2.  **Config Generation**: Saves these details to `autoflow.config.json` in the project root.
3.  **Docker Scaffolding**:
    -   Checks for an existing `Dockerfile`.
    -   If missing, generates a default `node:18-alpine` Dockerfile.
    -   Creates a `.dockerignore` file to exclude `node_modules` and secrets.

### Deployment Flow (`autoflow deploy`)
1.  **Validation**: Checks for `autoflow.config.json`.
2.  **Local Git Sync**:
    -   Checks if local git status is clean.
    -   If not, automatically adds and commits changes with a default message.
    -   Pushes code to the remote Git repository.
3.  **SSH Connection**: Connects to the remote server using `node-ssh` with the provided private key.
4.  **Remote Execution**:
    -   **Cloning/Pulling**: Checks if the project folder exists on the server. If not, it clones the repo; otherwise, it pulls the latest changes.
    -   **Building**: Runs `docker build -t <project_name> .`.
    -   **Restarting**: Stops and removes the existing container, then starts a new one mapping the specified ports.

---

## 3. Future Environment (Roadmap)
To evolve AutoFlow into a robust tool, the following features are planned:

-   **Multi-Environment Support**: Support for `staging` vs `production` configurations.
-   **Database Provisioning**: Automated setup of MongoDB/Postgres containers alongside the app.
-   **SSL Integration**: Automatic Nginx reverse proxy setup with Let's Encrypt.
-   **CI/CD Hooks**: GitHub Actions or GitLab CI integration to trigger deployments on push automatically.

---

## 4. Improvements Required (Critical Analysis)
Based on code analysis, the following areas require immediate improvement:

### Security
-   **Sensitive Data**: `autoflow.config.json` stores the SSH private key path and username. This file should be added to `.gitignore` by default to prevent accidental commits.
-   **SSH Handling**: Using an SSH agent or prompting for a passphrase would be more secure than static paths.

### Reliability (Zero-Downtime)
-   **Current Downtime**: The `deploy` command stops the old container *before* starting the new one.
-   **Improvement**: Implement a blue-green deployment strategy or use Traefik/Nginx to swap containers seamlessly without dropping connections.

### Error Handling
-   **Git Conflicts**: The implementation assumes `git pull` will always succeed. Conflicts on the server will break the deployment.
-   **Rollbacks**: There is currently no mechanism to revert to the previous Docker image if the new build fails to start.

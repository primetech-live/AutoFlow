# Project Management

AutoFlow is designed around local repositories. Instead of connecting to GitHub or GitLab and granting Oauth access, AutoFlow deploys code directly from your local hard drive.

---

## Import Projects

To begin managing an application, you must import it into AutoFlow.
1. Click **Import Project** in the Desktop Application, or use `autoflow project import /path/to/project`.
2. AutoFlow will read the directory and establish a local metadata profile.
3. The codebase itself is *not* moved. AutoFlow simply registers the directory path.

## Project Metadata

When a project is imported, AutoFlow generates a hidden `.autoflow` folder within the project directory. This folder contains:
- Selected target server bindings.
- Custom domain names associated with the project.
- Custom build commands (if overriding framework defaults).

## Framework Detection

During the import phase, AutoFlow scans the root directory to identify the project's tech stack (e.g., looking for `package.json`, `requirements.txt`, or `go.mod`). 
This automated framework detection allows AutoFlow to configure the build and proxy steps without requiring you to write a `Dockerfile` or `docker-compose.yml`.

*(For a detailed breakdown of how each framework is handled, refer to the [Framework Support](framework-support.md) documentation).*

## Environment Variables

Secure management of environment variables is critical for deployment.

### Injecting Variables
You can manage environment variables directly within the AutoFlow Desktop App under the **Project Details** screen, or via the CLI using `autoflow env set KEY=VALUE`.

### Security and Transport
1. Variables are stored locally in the encrypted Security Vault.
2. During deployment, AutoFlow streams these variables over a secure file transfer protocol to a secure, temporary path on the remote server.
3. They are injected directly into the runtime container configuration.
4. AutoFlow immediately deletes the temporary environment files from the remote server disk to prevent leakage or exposure to other users on the host machine.

## Project Configuration

You can override AutoFlow's default behaviors by modifying the project settings.
- **Port Overrides:** Change the internal container port if your application does not use standard ports (e.g., overriding Port 3000 to Port 8080).
- **Build Commands:** Define custom compilation steps (e.g., `npm run build:staging` instead of `npm run build`).
- **Persistent Volumes:** Map remote host directories into the container for database persistence or media uploads.

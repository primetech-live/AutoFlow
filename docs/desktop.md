# Desktop Application Guide

The AutoFlow Desktop Application provides a comprehensive visual interface for managing your server infrastructure and deployment pipelines. This document details every screen, button, and workflow within the application.

---

## The Lock Screen

Because AutoFlow stores highly sensitive server keys locally, the application locks itself when not in use.

- **Master Password Input:** The primary text field requires the password you created during onboarding. This decrypts your local Security Vault.
- **MFA Verification Code (Optional):** If you enabled Multi-Factor Authentication, you must enter the 6-digit code from your authenticator app.
- **Unlock Button:** Triggers the decryption sequence. If successful, you are routed to the Dashboard.
- **Forgot Password Workflow:** AutoFlow does not have a traditional "Forgot Password" reset because it does not store your keys on a server. If you lose your password, you must Factory Reset the app, which deletes the local vault, requiring you to re-add your servers.

## The Onboarding Screen

Shown only during initial installation or after a factory reset.

- **Connect First Server:** Prompts you for your VPS IP address, Username, and SSH Key file.
- **Set Master Password:** Requires a strong password to generate your AES-256-GCM encryption key.
- **MFA Setup:** Displays a QR code for Google Authenticator/Authy.
- **Finish Button:** Initializes the local database and takes you to the Dashboard.

## The Dashboard Screen

The central control panel for your active server.

- **Server Selector (Top Menu):** A dropdown to switch between multiple connected servers.
- **System Telemetry Widgets:**
  - **CPU Usage:** Live percentage graph of processor load.
  - **Memory & Swap:** Visualizes physical RAM usage and active Virtual Swap allocations.
  - **Disk Space:** Warning indicator if your SSD drops below 20% free space.
- **Active Containers List:** A table showing running containers.
  - **Start/Stop/Restart Buttons:** Quick actions for container lifecycle management.
  - **Open Terminal Button:** Launches an interactive SSH shell into the selected container.
- **Add Project Button:** Opens a file dialog to select a local directory to import.

## Project Details Screen

Access this by clicking on any imported project in the sidebar or dashboard.

- **Deploy Button (Primary):** Initiates the 13-stage deployment pipeline.
- **Framework Badge:** Displays the auto-detected framework (e.g., Node.js, Python).
- **Domain Configuration:**
  - **Add Domain Button:** Input your custom domain (e.g., `api.example.com`). AutoFlow will automatically attempt to provision an SSL certificate for this domain during the next deployment.
- **Environment Variables Tab:**
  - **Key/Value Editor:** A secure grid to input secrets. Values are masked by default.
  - **Save Variables:** Encrypts the variables and stores them in the local vault.
- **Deployment History Table:**
  - Lists past deployments, timestamps, and status (Success/Failed/Rollback).
  - **View Logs Button:** Opens historical build logs.
- **Advanced Settings:**
  - **Port Override:** Force the container to expose a specific internal port.
  - **Persistent Volumes:** Map host directories to container paths (e.g., `/var/lib/mysql:/var/lib/mysql`).

## Live Status Screen

This screen overtakes the UI when you click **Deploy**.

- **Pipeline Progress Tracker:** A visual step-by-step indicator highlighting which of the 13 deployment stages is currently executing.
- **Virtual Terminal Layout:** A high-performance text view streaming the raw stdout/stderr from the remote server. 
  - *Note:* Sensitive keys and tokens in this view are automatically scrubbed and replaced with `[REDACTED]`.
- **Cancel Deployment Button:** Aborts the current action. If aborted during a build, AutoFlow cleans up temporary files and maintains the previous active container.

## Settings Screen

- **Account Profile:** View your Supabase authenticated email, subscription tier, and remaining credits.
- **Theme Selector:** Toggle between Dark, Light, and System Default modes.
- **CLI Integration:**
  - **Install CLI globally Button:** Re-runs the path injection scripts if your terminal cannot find the `autoflow` command.
- **Danger Zone:**
  - **Factory Reset:** Irreversibly deletes your local `.autoflow` configuration directory, erasing all stored keys and project metadata.

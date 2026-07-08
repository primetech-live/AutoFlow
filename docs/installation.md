# Installation Guide

AutoFlow provides a standalone distribution model, ensuring you don't need to struggle with global dependencies, complex package managers, or supply chain security risks.

---

## Desktop Installation

The AutoFlow Desktop App is the easiest way to get started. It includes the graphical interface and automatically configures your system for the CLI.

### Windows
1. Download the latest `.exe` installer from the official releases page.
2. Run the installer. It will guide you through the setup process.
3. Once installed, launch AutoFlow from the Start Menu.
4. The Desktop app will automatically handle initial system path bindings for the CLI during onboarding.

### macOS
1. Download the `.dmg` file for your architecture (Apple Silicon `arm64` or Intel `x64`).
2. Open the `.dmg` and drag the AutoFlow app into your `Applications` folder.
3. Launch the application. You may need to grant Full Disk Access in macOS Settings (`System Settings -> Privacy & Security -> Full Disk Access`) so AutoFlow can read project files and connection keys.

### Linux
AutoFlow supports `.AppImage` and `.deb` distributions.
1. For Debian/Ubuntu, download the `.deb` file and install via `sudo apt install ./autoflow_version.deb`.
2. Launch AutoFlow from your application launcher.

---

## CLI Installation (Standalone)

Traditional developer tools distribute via `npm` or other registries, leading to dependency conflicts. AutoFlow circumvents this by packaging the CLI directly inside the Desktop Application installer as a single, compiled executable.

### Automatic Configuration
During Desktop onboarding, the application copies the executable script to a local folder and adds this folder to the system `PATH` environment variables.

### Manual Configuration
If the global command `autoflow` is not recognized, you can manually inject the path.

**Windows (PowerShell):**
```powershell
$UserPath = [Environment]::GetEnvironmentVariable("Path", "User")
$NewFolder = "C:\Users\$env:USERNAME\AppData\Local\Autoflow\bin"
if ($UserPath -notlike "*$NewFolder*") {
    $UpdatedPath = $UserPath + ";" + $NewFolder
    [Environment]::SetEnvironmentVariable("Path", $UpdatedPath, "User")
}
```

**macOS/Linux (Zsh/Bash):**
```bash
# For Zsh
echo 'export PATH="$HOME/.local/bin:$PATH"' >> ~/.zshrc
source ~/.zshrc

# For Bash
echo 'export PATH="$HOME/.local/bin:$PATH"' >> ~/.bash_profile
source ~/.bash_profile
```

---

## Supported Platforms (Host Server Requirements)

The target remote server (VPS) where AutoFlow will deploy your applications must meet the following criteria:

### Operating Systems
- **Ubuntu LTS:** 22.04 & 20.04 (Highly Recommended)
- **Debian:** 11 & 12
- **RHEL Derivatives:** Red Hat 8/9, Rocky Linux, AlmaLinux (AutoFlow automatically adjusts strict SELinux rules for these OSs).

### Minimum Hardware
- **Processor:** 1 vCPU (2+ recommended for heavy compilations).
- **Memory:** 1GB RAM (AutoFlow handles virtual swap provisioning automatically to prevent crashes).
- **Storage:** 20GB SSD minimum.
- **Network:** Public Static IPv4 Address required. Dynamic IPs will break domain resolutions and SSL generation.

---

## Upgrade Guide

AutoFlow includes an automated, built-in updater. 

1. When a new version is released, the Desktop App will silently download the delta update in the background.
2. A notification will appear prompting you to restart the application.
3. Upon restart, the Desktop App and the underlying CLI executable will be updated simultaneously.
4. Your configurations, servers, and projects will remain securely stored in your local vault during the upgrade process.

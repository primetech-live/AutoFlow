import fs from 'fs';
import path from 'path';
import os from 'os';
import { execSync } from 'child_process';
import { app } from 'electron';

export function installGlobalCli(): string {
    const isWindows = process.platform === 'win32';
    
    // Path to the installed application directory (where Autoflow-vNext.exe / binary resides)
    const appDir = app.isPackaged 
        ? path.dirname(app.getPath('exe'))
        : path.resolve(__dirname, '../../');

    const appExeName = isWindows ? 'Autoflow-vNext.exe' : 'Autoflow-vNext';
    const appExePath = path.join(appDir, appExeName);

    if (isWindows) {
        // --- WINDOWS LOGIC ---
        // Clean legacy LocalAppData copy if it exists to avoid old node wrappers remaining
        const localAppData = process.env.LOCALAPPDATA || path.join(os.homedir(), 'AppData', 'Local');
        const legacyTargetDir = path.join(localAppData, 'Autoflow');
        if (fs.existsSync(legacyTargetDir)) {
            try {
                fs.rmSync(legacyTargetDir, { recursive: true, force: true });
            } catch { /* ignore */ }
        }

        // Add application directory ($INSTDIR) to User PATH permanently via PowerShell
        const checkPathCmd = `[Environment]::GetEnvironmentVariable('Path', 'User')`;
        const currentPath = execSync(`powershell -NoProfile -Command "${checkPathCmd}"`).toString();
        
        if (!currentPath.includes(appDir)) {
            const addPathCmd = `[Environment]::SetEnvironmentVariable('Path', [Environment]::GetEnvironmentVariable('Path', 'User') + ';${appDir}', 'User')`;
            execSync(`powershell -NoProfile -Command "${addPathCmd}"`);
        }

        return `CLI integrated successfully! App directory added to PATH (${appDir}). Please open a NEW terminal window and type 'autoflow'.`;
    } else {
        // --- MACOS & LINUX LOGIC ---
        const localBinDir = path.join(os.homedir(), '.local', 'bin');
        const wrapperPath = path.join(localBinDir, 'autoflow');

        fs.mkdirSync(localBinDir, { recursive: true });

        // Create Bash wrapper shim invoking the application binary as Node
        const asarCliPath = path.join(appDir, 'resources', 'app.asar', 'dist', 'cli.js');
        const shContent = `#!/usr/bin/env bash\nexport FORCE_COLOR=1\nexport ELECTRON_RUN_AS_NODE=1\nexport AUTOFLOW_PACKAGED=true\nexec "${appExePath}" "${asarCliPath}" "$@"\n`;
        fs.writeFileSync(wrapperPath, shContent, { mode: 0o755 });

        // Shell detection and PATH injection
        const shellPath = process.env.SHELL || '';
        let profileFile = '';
        let isFish = false;
        
        if (shellPath.includes('zsh')) profileFile = path.join(os.homedir(), '.zshrc');
        else if (shellPath.includes('bash')) profileFile = path.join(os.homedir(), '.bashrc');
        else if (shellPath.includes('fish')) {
            profileFile = path.join(os.homedir(), '.config', 'fish', 'config.fish');
            isFish = true;
        }
        else profileFile = path.join(os.homedir(), '.profile');

        const exportCmd = isFish 
            ? `\n# Autoflow CLI\nset -gx PATH $HOME/.local/bin $PATH\n` 
            : `\n# Autoflow CLI\nexport PATH="$HOME/.local/bin:$PATH"\n`;

        if (fs.existsSync(profileFile)) {
            const profileContent = fs.readFileSync(profileFile, 'utf-8');
            if (!profileContent.includes('.local/bin')) {
                fs.appendFileSync(profileFile, exportCmd);
            }
        } else {
            if (isFish) fs.mkdirSync(path.dirname(profileFile), { recursive: true });
            fs.writeFileSync(profileFile, exportCmd);
        }

        return `CLI installed successfully. Restart your terminal or run 'source ${profileFile}' and type 'autoflow'.`;
    }
}

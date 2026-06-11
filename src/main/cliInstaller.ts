import fs from 'fs';
import path from 'path';
import os from 'os';
import { execSync } from 'child_process';
import { app } from 'electron';

export function installGlobalCli(): string {
    const isWindows = process.platform === 'win32';
    // Locate the bundled cli.js depending on dev/prod environment
    const cliSourcePath = app.isPackaged 
        ? path.join(process.resourcesPath, 'app.asar', 'dist', 'cli.js')
        : path.join(__dirname, '../../dist/cli.js');

    if (!fs.existsSync(cliSourcePath)) {
        throw new Error(`Standalone CLI bundle not found at ${cliSourcePath}. Please rebuild or reinstall the application.`);
    }

    if (isWindows) {
        // --- WINDOWS LOGIC ---
        const localAppData = process.env.LOCALAPPDATA || path.join(os.homedir(), 'AppData', 'Local');
        const targetDir = path.join(localAppData, 'Autoflow');
        const cliDestPath = path.join(targetDir, 'cli.js');
        const cmdWrapperPath = path.join(targetDir, 'autoflow.cmd');

        fs.mkdirSync(targetDir, { recursive: true });
        fs.copyFileSync(cliSourcePath, cliDestPath);

        const cmdContent = `@echo off\nnode "%~dp0cli.js" %*\n`;
        fs.writeFileSync(cmdWrapperPath, cmdContent, 'utf-8');

        // Append to User PATH via PowerShell (safe, no admin required)
        const checkPathCmd = `[Environment]::GetEnvironmentVariable("Path", "User")`;
        const currentPath = execSync(`powershell -NoProfile -Command "${checkPathCmd}"`).toString();
        
        if (!currentPath.includes(targetDir)) {
            const addPathCmd = `[Environment]::SetEnvironmentVariable("Path", [Environment]::GetEnvironmentVariable("Path", "User") + ";${targetDir}", "User")`;
            execSync(`powershell -NoProfile -Command "${addPathCmd}"`);
        }

        return `CLI installed successfully to ${targetDir}. Please open a NEW terminal window and type 'autoflow'.`;
    } else {
        // --- MACOS & LINUX LOGIC ---
        const localBinDir = path.join(os.homedir(), '.local', 'bin');
        const wrapperPath = path.join(localBinDir, 'autoflow');
        const cliDestPath = path.join(localBinDir, 'autoflow-cli.js');

        fs.mkdirSync(localBinDir, { recursive: true });
        fs.copyFileSync(cliSourcePath, cliDestPath);

        const shContent = `#!/usr/bin/env bash\nnode "${cliDestPath}" "$@"\n`;
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
        else profileFile = path.join(os.homedir(), '.profile'); // Fallback

        const exportCmd = isFish 
            ? `\\n# Autoflow CLI\\nset -gx PATH $HOME/.local/bin $PATH\\n` 
            : `\\n# Autoflow CLI\\nexport PATH="$HOME/.local/bin:$PATH"\\n`;

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

#!/usr/bin/env node

/**
 * AutoFlow Postinstall Script
 * 
 * Runs automatically after: npm install -g autoflow-cli
 * 
 * On Windows: Ensures the npm global bin directory is permanently added
 * to the user's PATH so the "autoflow" command is recognized immediately.
 * 
 * On Linux/macOS: Does nothing (npm handles PATH correctly on Unix).
 */

'use strict';

const { execSync } = require('child_process');
const os = require('os');
const path = require('path');

function getNpmGlobalBin() {
    try {
        return execSync('npm config get prefix', { encoding: 'utf-8' }).trim();
    } catch {
        return null;
    }
}

function isInPath(dir) {
    const pathDirs = (process.env.PATH || '').split(path.delimiter);
    return pathDirs.some((p) => p.toLowerCase() === dir.toLowerCase());
}

function addToWindowsPath(dir) {
    try {
        // Read current user PATH from registry
        const current = execSync(
            `powershell -NoProfile -Command "[System.Environment]::GetEnvironmentVariable('PATH', 'User')"`,
            { encoding: 'utf-8' }
        ).trim();

        // Do nothing if it's already there
        if (current.toLowerCase().includes(dir.toLowerCase())) {
            console.log('\x1b[34mℹ\x1b[0m AutoFlow: npm global bin already in PATH. No changes needed.');
            return;
        }

        const updated = current ? `${current};${dir}` : dir;

        execSync(
            `powershell -NoProfile -Command "[System.Environment]::SetEnvironmentVariable('PATH', '${updated}', 'User')"`,
            { encoding: 'utf-8' }
        );

        console.log('\x1b[32m✔\x1b[0m AutoFlow: npm global bin added to your PATH permanently.');
        console.log(`  Location: ${dir}`);
        console.log('\x1b[33m⚠\x1b[0m  Please restart your terminal (or open a new one) for changes to take effect.\n');
    } catch (err) {
        // Non-fatal: warn but don't break the install
        console.warn('\x1b[33m⚠\x1b[0m  AutoFlow: Could not auto-update PATH. If "autoflow" is not recognized,');
        console.warn(`   manually add this to your PATH: ${dir}\n`);
    }
}

// ── Main ──────────────────────────────────────────────────────────────────────

const fs = require('fs');

// Patch qrcode-terminal to fix Vite strict mode bundling issues
const qrcodePath = path.join(__dirname, '..', 'node_modules', 'qrcode-terminal', 'lib', 'main.js');
if (fs.existsSync(qrcodePath)) {
    let content = fs.readFileSync(qrcodePath, 'utf8');
    if (content.includes('\\033')) {
        content = content.replace(/\\033/g, '\\x1B');
        fs.writeFileSync(qrcodePath, content);
        console.log('\\x1b[32m✔\\x1b[0m AutoFlow: Patched qrcode-terminal for Vite strict mode compatibility.');
    }
}

if (os.platform() === 'win32') {
    const npmBin = getNpmGlobalBin();
    if (npmBin) {
        addToWindowsPath(npmBin);
    }
}
// On Linux/macOS: npm already handles PATH correctly — nothing to do.

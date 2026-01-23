const log = require('../utils/logger');
const inquirer = require('inquirer');
const fs = require('fs');
const path = require('path');
const os = require('os');

async function setup() {
    log.header('AUTOFLOW GLOBAL CONFIGURATION');

    const configDir = path.join(os.homedir(), '.autoflow');
    const configPath = path.join(configDir, 'config.json');

    if (!fs.existsSync(configDir)) {
        fs.mkdirSync(configDir, { recursive: true });
    }

    // Load existing if available to show as default
    let existingSafe = {};
    if (fs.existsSync(configPath)) {
        try {
            existingSafe = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
            log.info('Existing configuration found. Press Enter to keep current values.');
        } catch (e) {
            // ignore
        }
    }

    const questions = [
        {
            type: 'input',
            name: 'serverIp',
            message: 'Server Public IP:',
            default: existingSafe.serverIp || undefined,
            validate: (val) => val ? true : 'Server IP is required'
        },
        {
            type: 'input',
            name: 'sshUser',
            message: 'SSH Username:',
            default: existingSafe.sshUser || 'ubuntu'
        },
        {
            type: 'input',
            name: 'sshPort',
            message: 'SSH Port:',
            default: existingSafe.sshPort || '22'
        },
        {
            type: 'input',
            name: 'sshKeyPath',
            message: 'Absolute Path to Private SSH Key:',
            default: existingSafe.sshKeyPath || path.join(os.homedir(), '.ssh', 'id_rsa'),
            validate: (val) => fs.existsSync(val) ? true : `File not found at: ${val}`
        }
    ];

    const answers = await inquirer.prompt(questions);

    // Save globally
    fs.writeFileSync(configPath, JSON.stringify(answers, null, 2), { mode: 0o600 }); // Secure permissions

    log.success('Configuration saved securely successfully! 🔒');
    log.info(`Location: ${configPath}`);
    log.info('You can now run "autoflow init" without entering server details.');
}

module.exports = setup;

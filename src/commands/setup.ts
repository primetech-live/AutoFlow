import inquirer from 'inquirer';
import fs from 'fs';
import os from 'os';
import path from 'path';
import log from '../utils/logger';
import { saveGlobalConfig, GlobalConfig } from '../utils/config';

async function setup(): Promise<void> {
    log.header('AUTOFLOW GLOBAL CONFIGURATION');

    const configDir = path.join(os.homedir(), '.autoflow');
    const configPath = path.join(configDir, 'config.json');

    let existingConfig: Partial<GlobalConfig> = {};
    if (fs.existsSync(configPath)) {
        try {
            existingConfig = JSON.parse(fs.readFileSync(configPath, 'utf-8')) as GlobalConfig;
            log.info('Existing configuration found. Press Enter to keep current values.');
        } catch {
            // ignore parse errors
        }
    }

    const answers = await inquirer.prompt<GlobalConfig>([
        {
            type: 'input',
            name: 'serverIp',
            message: 'Server Public IP:',
            default: existingConfig.serverIp,
            validate: (val: string) => val ? true : 'Server IP is required',
        },
        {
            type: 'input',
            name: 'sshUser',
            message: 'SSH Username:',
            default: existingConfig.sshUser || 'ubuntu',
        },
        {
            type: 'input',
            name: 'sshPort',
            message: 'SSH Port:',
            default: existingConfig.sshPort || '22',
        },
        {
            type: 'input',
            name: 'sshKeyPath',
            message: 'Absolute Path to Private SSH Key:',
            default: existingConfig.sshKeyPath || path.join(os.homedir(), '.ssh', 'id_rsa'),
            validate: (val: string) =>
                fs.existsSync(val) ? true : `File not found at: ${val}`,
        },
    ]);

    saveGlobalConfig(answers);

    log.success('Global configuration saved securely 🔒');
    log.info(`Location: ${configPath}`);
    log.info('You can now run "autoflow init" in any project.');
}

export default setup;

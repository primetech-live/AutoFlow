const log = require('../utils/logger');
const fs = require('fs');
const path = require('path');
const { NodeSSH } = require('node-ssh');
const simpleGit = require('simple-git');

async function deploy(cmdObj) {
    const configPath = path.join(process.cwd(), 'autoflow.config.json');

    if (!fs.existsSync(configPath)) {
        log.error('Config file not found! Run "autoflow init" first.');
        return;
    }

    const config = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
    const ssh = new NodeSSH();
    const git = simpleGit();

    log.header(`DEPLOYING ${config.projectName.toUpperCase()}`);

    try {
        // --- STEP 1: LOCAL GIT SYNC ---
        log.info('Step 1: Syncing with Git...');

        // check status
        const status = await git.status();
        if (!status.isClean()) {
            log.info('Changes detected. Committing...');
            await git.add('.');
            await git.commit('Auto-deploy via Autoflow');
        }

        log.info('Pushing to remote...');
        await git.push();
        log.success('Code pushed to Git successfully.');


        // --- STEP 2: SSH CONNECTION ---
        log.info('Step 2: Connecting to Remote Server...');

        await ssh.connect({
            host: config.serverIp,
            username: config.sshUser,
            port: parseInt(config.sshPort),
            privateKey: config.sshKeyPath
        });
        log.success('Connected to server via SSH.');


        // --- STEP 3: REMOTE DEPLOYMENT ---
        log.info('Step 3: Executing Remote Commands...');

        const projectDir = `/home/${config.sshUser}/${config.projectName}`;

        // Check if project dir exists
        const checkDirObj = await ssh.execCommand(`[ -d "${projectDir}" ] && echo "exists" || echo "missing"`);
        const dirExists = checkDirObj.stdout.trim() === 'exists';

        if (!dirExists) {
            log.warning(`Project directory missing. Cloning ${config.gitRepo}...`);
            await ssh.execCommand(`git clone ${config.gitRepo} ${projectDir}`);
        } else {
            log.info('Pulling latest changes...');
            await ssh.execCommand(`cd ${projectDir} && git pull`);
        }

        log.info('Building Docker Image (this may take a while)...');

        // Commands to run systematically
        const commands = [
            `cd ${projectDir} && docker build -t ${config.projectName} .`,
            `docker stop ${config.projectName} || true`,
            `docker rm ${config.projectName} || true`,
            `docker run -d --name ${config.projectName} -p ${config.appPort}:${config.appPort} ${config.projectName}`
        ];

        for (const cmd of commands) {
            log.info(`Running: ${cmd}`);
            const result = await ssh.execCommand(cmd);
            if (result.stderr && !result.stderr.includes('No such container')) {
                // Log warning but don't crash
                // log.warning(result.stderr); 
            }
            if (result.stdout) console.log(result.stdout);
        }

        log.success('DEPLOYMENT COMPLETE!');
        log.info(`App should be running at: http://${config.serverIp}:${config.appPort}`);

        ssh.dispose();

    } catch (error) {
        log.error('Deployment Failed:');
        console.error(error);
        if (ssh) ssh.dispose();
    }
}

module.exports = deploy;

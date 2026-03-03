import { NodeSSH } from 'node-ssh';
import log from '../../utils/logger';
import { exec } from './errors';

export async function pullCodeOnServer(
    ssh: NodeSSH,
    projectDir: string,
    gitRepo: string
): Promise<void> {
    log.info('Syncing code on server...');

    await exec(ssh, `
mkdir -p ${projectDir} &&
cd ${projectDir} &&
git init &&
git remote remove origin || true &&
git remote add origin ${gitRepo} &&
git fetch origin &&
git reset --hard origin/main &&
git clean -fd
`);

    log.success('Server code synced ✔');
}

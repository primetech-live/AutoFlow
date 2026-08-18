import { NodeSSH } from 'node-ssh';
import log from '../../utils/logger';
import { exec } from './errors';
import { escapeShellArg } from '../../utils/shell';

export async function pullCodeOnServer(
    ssh: NodeSSH,
    projectDir: string,
    gitRepo: string,
    branch: string = 'main',
    pat?: string
): Promise<void> {
    log.info('Syncing code on server...');

    let authSetup = '';
    let authCleanup = '';

    if (pat) {
        authSetup = `
cat << 'EOF' > askpass.sh
#!/bin/sh
echo "$GIT_TOKEN"
EOF
chmod 700 askpass.sh
export GIT_ASKPASS=$(pwd)/askpass.sh
export GIT_TOKEN='${pat.replace(/'/g, "'\\''")}'
`;
        authCleanup = `
rm -f askpass.sh
unset GIT_ASKPASS
unset GIT_TOKEN
`;
    }

    await exec(ssh, `
mkdir -p ${escapeShellArg(projectDir)} &&
cd ${escapeShellArg(projectDir)} &&
${authSetup}
git init &&
git remote remove origin || true &&
git remote add origin ${escapeShellArg(gitRepo)} &&
git fetch origin &&
git reset --hard origin/${escapeShellArg(branch)}
${authCleanup}
`);

    log.success('Server code synced ✔');
}

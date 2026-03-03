import log from '../../utils/logger';
import { handleFatalError } from './errors';
import { loadConfig } from './configService';
import { runCIChecks } from './ci';
import { syncLocalGit } from './gitService';
import { connectSSH } from './sshService';
import { ensureSwap } from './swapService';
import { allocatePort } from './portService';
import { pullCodeOnServer } from './remoteGitService';
import { buildDockerImage } from './dockerBuildService';
import { startContainer, verifyContainerHealth } from './containerService';
import { backupContainer, confirmDeploy, triggerRollback } from './rollback';
import { configureNginx } from './nginxService';
import { provisionSSL } from './sslService';

async function deploy(): Promise<void> {
    // Top-level catch — ensures NO raw stack traces ever reach the user
    try {
        // ── Step 1: Load config ──────────────────────────────────────────────
        log.header('AUTOFLOW DEPLOY');
        const config = loadConfig();

        const projectDir = `/home/${config.sshUser}/apps/${config.projectName}`;
        const image = `${config.projectName}:latest`;
        const container = config.projectName;
        const containerPort = config.appType === 'static' ? 80 : 3000;

        // ── Step 2: CI Checks (local, pre-push) ─────────────────────────────
        await runCIChecks();

        // ── Step 3: Git sync (local → remote repo) ───────────────────────────
        await syncLocalGit();

        // ── Step 4: SSH Connect ──────────────────────────────────────────────
        const ssh = await connectSSH(config);

        try {
            // ── Step 5: Swap memory ──────────────────────────────────────────
            await ensureSwap(ssh);

            // ── Step 6: Port allocation ──────────────────────────────────────
            const hostPort = await allocatePort(ssh, container);

            // ── Step 7: Pull code on server ──────────────────────────────────
            await pullCodeOnServer(ssh, projectDir, config.gitRepo);

            // ── Step 8: Rollback — backup current container ──────────────────
            await backupContainer(ssh, container);

            // ── Step 9: Build Docker image ───────────────────────────────────
            await buildDockerImage(ssh, projectDir, image);

            // ── Step 10: Start new container ─────────────────────────────────
            await startContainer(ssh, container, image, hostPort, containerPort, !!config.domain);

            // ── Step 11: Health check → confirm or rollback ──────────────────
            try {
                await verifyContainerHealth(ssh, container);
                await confirmDeploy(ssh, container);
            } catch (healthErr) {
                await triggerRollback(ssh, container);
                throw healthErr;
            }

            // ── Step 12 & 13: Nginx + SSL (domain mode only) ─────────────────
            if (config.domain) {
                await configureNginx(ssh, config.domain, config.projectName, config.sshUser, hostPort);
                await provisionSSL(ssh, config.domain);
            } else {
                log.success(`Live at: http://${config.serverIp}:${hostPort}`);
            }

            log.header('DEPLOYMENT COMPLETE 🚀');

        } finally {
            // SSH is ALWAYS cleaned up, whether success or failure
            ssh.dispose();
        }

    } catch (err: unknown) {
        // Single unified error handler — formats every error cleanly, no stack traces
        handleFatalError(err);
    }
}

export default deploy;

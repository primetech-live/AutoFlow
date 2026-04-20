import log from '../../utils/logger';
import { handleFatalError } from './errors';
import { loadConfig } from './configService';
import { runCIChecks, waitForRemoteCI } from './ci';
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
import { syncEnv, unlockEnvOnServer, cleanupEnv } from './envService';
import { loadVaultConfig } from '../../utils/vaultService';
import inquirer from 'inquirer';

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

        // ── Step 2: Local CI Checks (pre-push) ────────────────────────────────
        await runCIChecks(config.appType, config.strictCI);

        // ── Step 3: Git sync (local → remote repo) ───────────────────────────
        const sha = await syncLocalGit();

        // ── Step 4: Remote CI Checks (GitHub Actions) ───────────────────────
        await waitForRemoteCI(config.gitRepo, sha, config.strictCI);

        // ── Step 5: SSH Connect ──────────────────────────────────────────────
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

            // ── Step 9.5: Environment Sync & Unlock (Z+ Security) ────────────
            const vault = loadVaultConfig();
            let envUnlocked = false;

            if (vault) {
                // This will prompt for Password + OTP
                const password = await syncEnv(ssh, projectDir);

                if (password) {
                    await unlockEnvOnServer(ssh, projectDir, password, vault.salt);
                    envUnlocked = true;
                }
            }

            // ── Step 10: Start new container ─────────────────────────────────
            await startContainer(ssh, projectDir, container, image, hostPort, containerPort, !!config.domain, envUnlocked);

            // ── Step 10.5: Cleanup ───────────────────────────────────────────
            if (envUnlocked) {
                await cleanupEnv(ssh, projectDir);
            }

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

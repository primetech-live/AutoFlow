import { NodeSSH } from 'node-ssh';
import log from '../../utils/logger';
import { exec, AutoFlowError, EXIT_CODES } from './errors';

export async function buildDockerImage(
    ssh: NodeSSH,
    projectDir: string,
    imageName: string
): Promise<void> {
    log.info(`Building Docker image: ${imageName} ...`);
    log.info('This may take a few minutes on first build.');

    try {
        await exec(ssh, `
cd ${projectDir} &&
docker build --no-cache --progress=plain -t ${imageName} .
`, 600_000, true); // 10-minute timeout for large builds, with streaming logs

        log.success(`Docker image built: ${imageName} ✔`);
    } catch (err) {
        throw new AutoFlowError(
            `Docker build failed for image "${imageName}". Check logs above.`,
            EXIT_CODES.BUILD_FAILED,
            'dockerBuildService'
        );
    }
}

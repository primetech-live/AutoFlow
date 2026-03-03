import simpleGit from 'simple-git';
import log from '../../utils/logger';
import { AutoFlowError, EXIT_CODES } from './errors';

export async function syncLocalGit(): Promise<void> {
    const git = simpleGit();

    log.info('Checking local git status...');
    try {
        const status = await git.status();

        if (!status.isClean()) {
            log.info('Uncommitted changes detected. Auto-committing...');
            await git.add('.');
            await git.commit('chore: auto deploy via AutoFlow');
            log.success('Changes committed.');
        } else {
            log.info('Working directory is clean.');
        }

        log.info('Pushing to remote...');
        await git.push();
        log.success('Code pushed to remote successfully ✔');
    } catch (err: unknown) {
        const message = err instanceof Error ? err.message : String(err);
        throw new AutoFlowError(
            `Git sync failed: ${message}`,
            EXIT_CODES.GIT_FAILED,
            'gitService'
        );
    }
}

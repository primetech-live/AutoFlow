import deploy from '../../src/commands/deploy/index';
import * as sshService from '../../src/commands/deploy/sshService';
import * as ciService from '../../src/commands/deploy/ci';
import * as gitService from '../../src/commands/deploy/gitService';
import * as configService from '../../src/commands/deploy/configService';
import * as remoteGitService from '../../src/commands/deploy/remoteGitService';
import * as dockerBuildService from '../../src/commands/deploy/dockerBuildService';
import * as containerService from '../../src/commands/deploy/containerService';
import * as rollbackService from '../../src/commands/deploy/rollback';
import * as portService from '../../src/commands/deploy/portService';

// Mock all external dependencies
jest.mock('../../src/commands/deploy/sshService');
jest.mock('../../src/commands/deploy/ci');
jest.mock('../../src/commands/deploy/gitService');
jest.mock('../../src/commands/deploy/configService');
jest.mock('../../src/commands/deploy/remoteGitService');
jest.mock('../../src/commands/deploy/dockerBuildService');
jest.mock('../../src/commands/deploy/containerService');
jest.mock('../../src/commands/deploy/rollback');
jest.mock('../../src/commands/deploy/portService');
jest.mock('../../src/commands/deploy/ufwService');
jest.mock('../../src/utils/vaultService');

describe('Deploy Integration', () => {
    it('should run the full happy path successfully', async () => {
        // Setup mocks
        const mockSsh: any = {
            execCommand: jest.fn().mockResolvedValue({ code: 0, stdout: '', stderr: '' }),
            dispose: jest.fn()
        };
        (sshService.connectSSH as jest.Mock).mockResolvedValue(mockSsh);
        
        (configService.loadConfig as jest.Mock).mockReturnValue({
            projectName: 'test-project',
            sshUser: 'user',
            serverIp: '1.2.3.4',
            appType: 'node',
            strictCI: false,
            gitRepo: 'https://github.com/user/test.git',
            branch: 'main',
            domain: ''
        });

        (gitService.syncLocalGit as jest.Mock).mockResolvedValue('fake-sha');
        (portService.allocatePort as jest.Mock).mockResolvedValue(8001);

        // Execute
        await expect(deploy(false, process.cwd())).resolves.not.toThrow();

        // Verify sequence
        expect(configService.loadConfig).toHaveBeenCalled();
        expect(ciService.runCIChecks).toHaveBeenCalled();
        expect(gitService.syncLocalGit).toHaveBeenCalled();
        expect(ciService.waitForRemoteCI).toHaveBeenCalled();
        expect(sshService.connectSSH).toHaveBeenCalled();
        expect(remoteGitService.pullCodeOnServer).toHaveBeenCalled();
        expect(rollbackService.backupContainer).toHaveBeenCalled();
        expect(dockerBuildService.buildDockerImage).toHaveBeenCalled();
        expect(containerService.startContainer).toHaveBeenCalled();
        expect(containerService.verifyContainerHealth).toHaveBeenCalled();
        expect(rollbackService.confirmDeploy).toHaveBeenCalled();
    });
});

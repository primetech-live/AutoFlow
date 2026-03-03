import { loadGlobalConfig, loadProjectConfig, MergedConfig } from '../../utils/config';
import log from '../../utils/logger';

export function loadConfig(): MergedConfig {
    const globalConfig = loadGlobalConfig();
    const projectConfig = loadProjectConfig();

    // Project config takes precedence over global config
    const merged: MergedConfig = { ...globalConfig, ...projectConfig };

    log.info(`Project  : ${merged.projectName}`);
    log.info(`Server   : ${merged.serverIp}`);
    log.info(`SSH User : ${merged.sshUser}`);
    log.info(`App Type : ${merged.appType.toUpperCase()}`);
    log.info(`Mode     : ${merged.mode.toUpperCase()} ${merged.domain ? `(${merged.domain})` : ''}`);

    return merged;
}

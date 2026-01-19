const log = require('../utils/logger');

async function stop(cmdObj) {
    log.header('STOPPING SERVICE');
    log.warning('Stopping container...');
    log.success('Service stopped. (Mock)');
}

module.exports = stop;

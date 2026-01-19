const log = require('../utils/logger');

async function status(cmdObj) {
    log.header('PROJECT STATUS');
    log.info('Checking remote status...');
    log.success('Service is RUNNING (Mock)');
}

module.exports = status;

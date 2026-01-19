const chalk = require('chalk');

const log = {
    info: (msg) => console.log(chalk.blue('ℹ') + ' ' + msg),
    success: (msg) => console.log(chalk.green('✔') + ' ' + msg),
    warning: (msg) => console.log(chalk.yellow('⚠') + ' ' + msg),
    error: (msg) => console.log(chalk.red('✖') + ' ' + msg),
    header: (msg) => console.log(chalk.bold.cyan('\n' + msg + '\n'))
};

module.exports = log;

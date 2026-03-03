import chalk from 'chalk';

const log = {
    info: (msg: string): void => { console.log(chalk.blue('ℹ') + ' ' + msg); },
    success: (msg: string): void => { console.log(chalk.green('✔') + ' ' + msg); },
    warning: (msg: string): void => { console.log(chalk.yellow('⚠') + ' ' + msg); },
    error: (msg: string): void => { console.log(chalk.red('✖') + ' ' + msg); },
    header: (msg: string): void => { console.log(chalk.bold.cyan('\n' + msg + '\n')); }
};

export default log;

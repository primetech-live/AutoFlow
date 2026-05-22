import chalk from 'chalk';

export type LogType = 'info' | 'success' | 'warning' | 'error' | 'header';
type LogListener = (type: LogType, message: string) => void;

const listeners = new Set<LogListener>();

export function addLogListener(listener: LogListener) {
    listeners.add(listener);
}

export function removeLogListener(listener: LogListener) {
    listeners.delete(listener);
}

function broadcast(type: LogType, msg: string) {
    listeners.forEach(l => {
        try { l(type, msg); } catch { /* ignore */ }
    });
}

const log = {
    info: (msg: string): void => {
        console.log(chalk.blue('ℹ') + ' ' + msg);
        broadcast('info', msg);
    },
    success: (msg: string): void => {
        console.log(chalk.green('✔') + ' ' + msg);
        broadcast('success', msg);
    },
    warning: (msg: string): void => {
        console.log(chalk.yellow('⚠') + ' ' + msg);
        broadcast('warning', msg);
    },
    error: (msg: string): void => {
        console.log(chalk.red('✖') + ' ' + msg);
        broadcast('error', msg);
    },
    header: (msg: string): void => {
        console.log(chalk.bold.cyan('\n' + msg + '\n'));
        broadcast('header', msg);
    }
};

export default log;


#!/usr/bin/env node

const { Command } = require('commander');
const chalk = require('chalk');
const figlet = require('figlet');

// Import commands
const init = require('../src/commands/init');
const deploy = require('../src/commands/deploy');
const status = require('../src/commands/status');
const stop = require('../src/commands/stop');

const program = new Command();

// Banner
console.log(
    chalk.cyan(
        figlet.textSync('AUTOFLOW', { horizontalLayout: 'full' })
    )
);

program
    .name('autoflow')
    .description('Automated CI/CD CLI tool for students')
    .version('1.0.0');

// Command: init
program
    .command('init')
    .description('Initialize a new deployment configuration')
    .action(init);

// Command: deploy
program
    .command('deploy')
    .description('Deploy the current project to the remote server')
    .action(deploy);

// Command: status
program
    .command('status')
    .description('Check the status of the deployed application')
    .action(status);

// Command: stop
program
    .command('stop')
    .description('Stop the running application on the server')
    .action(stop);

// Parse arguments
program.parse(process.argv);

// Show help if no args
if (!process.argv.slice(2).length) {
    program.outputHelp();
}

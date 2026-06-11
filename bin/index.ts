#!/usr/bin/env node

import { Command } from 'commander';
import chalk from 'chalk';

import init from '../src/commands/init';
import deploy from '../src/commands/deploy/index';
import status from '../src/commands/status';
import stop from '../src/commands/stop';
import setup from '../src/commands/setup';

const program = new Command();

const BANNER = `
    ___   __  __________  ________    ____ _       __
   /   | / / / /_  __/ / / / ____/   / __ \\ |     / /
  / /| |/ / / / / / / / / / /_      / / / / | /| / / 
 / ___ / /_/ / / / / /_/ / __/     / /_/ /| |/ |/ /  
/_/  |_\\____/ /_/  \\____/_/        \\____/ |__/|__/   
`;

// Banner
console.log(chalk.cyan(BANNER));

program
    .name('autoflow')
    .description('Automated CI/CD CLI tool for students and beginners')
    .version('1.0.1');

program
    .command('setup')
    .description('Configure global server details and security vault')
    .action(setup);

program
    .command('init')
    .description('Initialize a new deployment configuration')
    .action(init);

program
    .command('deploy')
    .description('Deploy the current project to the remote server')
    .action(deploy);

program
    .command('status')
    .description('Check the status of the deployed application')
    .action(status);

program
    .command('stop')
    .description('Stop the running application on the server')
    .action(stop);

program.parse(process.argv);

// Show help if no args given
if (!process.argv.slice(2).length) {
    program.outputHelp();
}

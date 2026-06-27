#!/usr/bin/env node

import { Command } from 'commander';
import chalk from 'chalk';

import init from '../src/commands/init';
import deploy from '../src/commands/deploy/index';
import status from '../src/commands/status';
import stop from '../src/commands/stop';
import setup from '../src/commands/setup';

const program = new Command();

const bannerLines = [
    " █████╗ ██╗   ██╗████████╗██████╗ ███████╗██╗      ██████╗ ██╗    ██╗",
    "██╔══██╗██║   ██║╚══██╔══╝██╔══██╗██╔════╝██║     ██╔═══██╗██║    ██║",
    "███████║██║   ██║   ██║   ██║  ██║█████╗  ██║     ██║   ██║██║ █╗ ██║",
    "██╔══██║██║   ██║   ██║   ██║  ██║██╔══╝  ██║     ██║   ██║██║███╗██║",
    "██║  ██║╚██████╔╝   ██║   ██████╔╝██║     ███████╗╚██████╔╝╚███╔███╔╝",
    "╚═╝  ╚═╝ ╚═════╝    ╚═╝   ╚═════╝ ╚═╝     ╚══════╝ ╚═════╝  ╚══╝╚══╝"
];

// Beautiful cyan-to-blue gradient
const colors = ['#7dd3fc', '#38bdf8', '#0ea5e9', '#0284c7', '#0369a1', '#075985'];

console.log(''); // Spacing
bannerLines.forEach((line, i) => {
    console.log(chalk.hex(colors[i])(line));
});

const printStaticMascot = () => {
    console.log(chalk.yellow(`   (\\_/)`));
    console.log(chalk.yellow(`   ( •_•)  `) + chalk.gray(`AutoFlow Core v1.0.1`));
    console.log(chalk.yellow(`   / >🚀   `) + chalk.magenta(`Ready to deploy your apps!`));
    console.log('');
};

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
    .action(() => deploy(false));

program
    .command('status')
    .description('Check the status of the deployed application')
    .action(status);

program
    .command('stop')
    .description('Stop the running application on the server')
    .action(stop);

const isBareCommand = !process.argv.slice(2).length;

if (isBareCommand) {
    printStaticMascot();
    
    let frame = 0;
    const frames = ["( •_•)", "( -_-)", "( ^_^)", "( •_•)"];
    
    const interval = setInterval(() => {
        frame++;
        if (frame >= frames.length) {
            clearInterval(interval);
            program.outputHelp();
            return;
        }
        process.stdout.write('\x1B[4A'); // Move cursor up 4 lines
        console.log(chalk.yellow(`   (\\_/)`));
        console.log(chalk.yellow(`   ${frames[frame]}  `) + chalk.gray(`AutoFlow Core v1.0.1`));
        console.log(chalk.yellow(`   / >🚀   `) + chalk.magenta(`Ready to deploy your apps!`));
        console.log('');
    }, 400);
} else {
    printStaticMascot();
    program.parse(process.argv);
}

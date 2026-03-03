import { execSync } from 'child_process';
import fs from 'fs';
import log from '../../utils/logger';
import { AutoFlowError, EXIT_CODES } from './errors';

// Default placeholder npm sets when no test is configured — not a real test suite
const DEFAULT_NPM_TEST_SCRIPTS = [
    'echo "Error: no test specified" && exit 1',
    "echo \"Error: no test specified\" && exit 1",
];

export async function runCIChecks(): Promise<void> {
    log.header('CI CHECKS');

    const pkgPath = `${process.cwd()}/package.json`;
    if (!fs.existsSync(pkgPath)) {
        log.info('No package.json found. Skipping CI checks.');
        return;
    }

    const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf-8')) as {
        scripts?: Record<string, string>;
    };
    const testScript = pkg.scripts?.['test'];

    // No test script at all
    if (!testScript) {
        log.warning('⚠️  No "test" script found in package.json.');
        log.info('    Tip: Add a "test" script to enable CI before deployment.');
        log.info('    Skipping CI checks and proceeding...\n');
        return;
    }

    // Default placeholder — not a real test suite, skip gracefully
    if (DEFAULT_NPM_TEST_SCRIPTS.includes(testScript.trim())) {
        log.warning('⚠️  CI skipped: No real test suite configured.');
        log.info('    The "test" script is still the default npm placeholder.');
        log.info('    To enable CI: replace it with jest, vitest, mocha, etc.');
        log.info('    Proceeding with deployment...\n');
        return;
    }

    // Detect package manager
    let testCmd = 'npm test';
    if (fs.existsSync('pnpm-lock.yaml')) testCmd = 'pnpm test';
    else if (fs.existsSync('yarn.lock')) testCmd = 'yarn test';

    log.info(`Running tests: ${testCmd}`);
    log.info('All tests must pass before deployment proceeds...\n');

    try {
        execSync(testCmd, { stdio: 'inherit', cwd: process.cwd() });
        log.success('✔ All CI checks passed! Proceeding to deployment...\n');
    } catch {
        throw new AutoFlowError(
            [
                '',
                '  ╔══════════════════════════════════════════╗',
                '  ║         CI CHECKS FAILED — ABORTED       ║',
                '  ╚══════════════════════════════════════════╝',
                '',
                '  One or more tests failed. Deployment has been ABORTED.',
                '  Fix the failing tests and run "autoflow deploy" again.',
                '',
                `  Command used: ${testCmd}`,
                '',
            ].join('\n'),
            EXIT_CODES.CI_FAILED,
            'CI'
        );
    }
}

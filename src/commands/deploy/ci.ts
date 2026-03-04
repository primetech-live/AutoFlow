import { execSync } from 'child_process';
import fs from 'fs';
import https from 'https';
import log from '../../utils/logger';
import { AutoFlowError, EXIT_CODES } from './errors';

// Default placeholder npm sets when no test is configured — not a real test suite
const DEFAULT_NPM_TEST_SCRIPTS = [
    'echo "Error: no test specified" && exit 1',
    "echo \"Error: no test specified\" && exit 1",
    'echo "No tests yet" && exit 0',
    "echo \"No tests yet\" && exit 0",
];

const FAKE_TEST_REGEX = /echo\s+["'](Error: no test specified|No tests yet)["']\s+&&\s+exit\s+[01]/i;

// ── Static project checks ────────────────────────────────────────────────────
function runStaticChecks(): void {
    log.info('Static project detected. Running static CI checks...\n');

    const checks: { label: string; pass: boolean; tip?: string }[] = [];

    // 1. index.html must exist
    const hasIndex = fs.existsSync(`${process.cwd()}/index.html`);
    checks.push({
        label: 'index.html exists',
        pass: hasIndex,
        tip: 'Static projects must have an index.html at the root.',
    });

    // 2. Dockerfile must exist (autoflow needs it to containerise the site)
    const hasDockerfile = fs.existsSync(`${process.cwd()}/Dockerfile`);
    checks.push({
        label: 'Dockerfile exists',
        pass: hasDockerfile,
        tip: 'A Dockerfile is required to serve the static site via nginx in a container.',
    });

    // 3. .autoflow.yml / .autoflow.yaml must exist
    const hasConfig =
        fs.existsSync(`${process.cwd()}/.autoflow.yml`) ||
        fs.existsSync(`${process.cwd()}/.autoflow.yaml`);
    checks.push({
        label: '.autoflow.yml config exists',
        pass: hasConfig,
        tip: 'Run "autoflow init" to create the project config.',
    });

    // 4. Warn about large/dirty assets (files > 50 MB in public/ or assets/)
    const bigFileDirs = ['public', 'assets', '.'];
    let bigFiles: string[] = [];
    for (const dir of bigFileDirs) {
        const dirPath = `${process.cwd()}/${dir === '.' ? '' : dir}`;
        if (!fs.existsSync(dirPath)) continue;
        try {
            const entries = fs.readdirSync(dirPath, { withFileTypes: true });
            for (const entry of entries) {
                if (!entry.isFile()) continue;
                const filePath = `${dirPath}/${entry.name}`;
                const { size } = fs.statSync(filePath);
                if (size > 50 * 1024 * 1024) {
                    bigFiles.push(
                        `${dir === '.' ? '' : dir + '/'}${entry.name} (${(size / 1024 / 1024).toFixed(1)} MB)`
                    );
                }
            }
        } catch {
            // ignore unreadable dirs
        }
    }

    // Print results
    let failed = false;
    for (const check of checks) {
        if (check.pass) {
            log.success(`  ✔ ${check.label}`);
        } else {
            log.error(`  ✘ ${check.label}`);
            if (check.tip) log.info(`    Tip: ${check.tip}`);
            failed = true;
        }
    }

    if (bigFiles.length > 0) {
        log.warning('\n  ⚠️  Large files detected (>50 MB):');
        bigFiles.forEach(f => log.info(`    - ${f}`));
        log.info('    Consider using a CDN or Git LFS for large assets.\n');
    }

    if (failed) {
        throw new AutoFlowError(
            [
                '',
                '  ╔══════════════════════════════════════════╗',
                '  ║     STATIC CI CHECKS FAILED — ABORTED    ║',
                '  ╚══════════════════════════════════════════╝',
                '',
                '  One or more required files are missing.',
                '  Fix the issues above and run "autoflow deploy" again.',
                '',
            ].join('\n'),
            EXIT_CODES.CI_FAILED,
            'CI'
        );
    }

    log.success('✔ All static CI checks passed! Proceeding to deployment...\n');
}

// ── Node / npm project checks ────────────────────────────────────────────────
async function runNodeChecks(strictCI?: boolean): Promise<void> {
    const pkgPath = `${process.cwd()}/package.json`;

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

    // Default placeholder or "echo" bypass — skip or fail based on strictness
    const trimmedTest = testScript.trim();
    if (DEFAULT_NPM_TEST_SCRIPTS.includes(trimmedTest) || FAKE_TEST_REGEX.test(trimmedTest)) {
        if (strictCI) {
            throw new AutoFlowError(
                `Strict CI is enabled, but the test script is a placeholder or bypass: "${trimmedTest}". Please add real tests.`,
                EXIT_CODES.CI_FAILED,
                'CI'
            );
        }
        log.warning('⚠️  CI skipped: No real test suite configured.');
        log.info('    The "test" script appears to be a placeholder or bypass.');
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

// ── Remote CI (GitHub Actions) ──────────────────────────────────────────────

interface GitHubCheckRun {
    name: string;
    status: 'queued' | 'in_progress' | 'completed';
    conclusion: 'success' | 'failure' | 'neutral' | 'cancelled' | 'skipped' | 'timed_out' | 'action_required' | null;
    html_url: string;
}

/**
 * Parses GitHub owner and repo from URL
 */
function parseGitHubRepo(url: string): { owner: string; repo: string } | null {
    const cleanUrl = url.replace(/\.git$/, '');
    const httpsMatch = cleanUrl.match(/github\.com\/([^/]+)\/([^/]+)/);
    if (httpsMatch) return { owner: httpsMatch[1], repo: httpsMatch[2] };
    const sshMatch = cleanUrl.match(/github\.com:([^/]+)\/([^/]+)/);
    if (sshMatch) return { owner: sshMatch[1], repo: sshMatch[2] };
    return null;
}

export async function waitForRemoteCI(gitRepo: string, sha: string, strictCI?: boolean): Promise<void> {
    const repoInfo = parseGitHubRepo(gitRepo);
    if (!repoInfo) {
        log.info('Non-GitHub or unparseable repo URL found. Skipping remote CI checks.');
        return;
    }

    log.header('REMOTE CI (GITHUB ACTIONS)');
    log.info(`Checking GitHub Actions for commit: ${sha.substring(0, 7)}`);
    log.info('Waiting for all remote checks to pass...\n');

    const timeout = 5 * 60 * 1000;
    const interval = 8 * 1000;
    const startTime = Date.now();
    let hasStarted = false;

    while (Date.now() - startTime < timeout) {
        try {
            const checks = await getGitHubCheckRuns(repoInfo.owner, repoInfo.repo, sha);

            if (checks.length > 0) {
                hasStarted = true;
                const total = checks.length;
                const completed = checks.filter(c => c.status === 'completed');
                const failed = completed.filter(c => ['failure', 'timed_out', 'action_required'].includes(c.conclusion!));

                // In strict mode, skipped/cancelled are also failures
                const strictFailed = strictCI
                    ? completed.filter(c => ['skipped', 'cancelled'].includes(c.conclusion!))
                    : [];

                const combinedFailed = [...failed, ...strictFailed];
                const successful = completed.filter(c => {
                    const ok = ['success', 'neutral'].includes(c.conclusion!);
                    if (!strictCI) return ok || ['skipped', 'cancelled'].includes(c.conclusion!);
                    return ok;
                });

                // Abort if any check failed
                if (combinedFailed.length > 0) {
                    const failList = combinedFailed.map(c => `  - ${c.name} (${c.conclusion}): ${c.html_url}`).join('\n');
                    throw new AutoFlowError(
                        [
                            '',
                            '  ╔══════════════════════════════════════════╗',
                            '  ║      REMOTE CI FAILED ON GITHUB          ║',
                            '  ╚══════════════════════════════════════════╝',
                            '',
                            '  One or more GitHub Actions have FAILED:',
                            failList,
                            '',
                            '  Fix the errors on GitHub before deploying again.',
                            '',
                        ].join('\n'),
                        EXIT_CODES.CI_FAILED,
                        'RemoteCI'
                    );
                }

                // Proceed if all checks are done and successful
                if (successful.length === total) {
                    log.success(`✔ All ${total} remote checks reached a final state successfully.`);
                    log.info(`  (${strictCI ? 'Success/Neutral' : 'Success/Neutral/Skipped/Cancelled'})`);
                    log.success('✔ Proceeding to server deployment...\n');
                    return;
                }

                // Still running
                const running = checks.filter(c => c.status !== 'completed').map(c => c.name).join(', ');
                const elapsed = Math.round((Date.now() - startTime) / 1000);
                log.info(`... Waiting for: ${running} (${elapsed}s elapsed)`);

            } else {
                const elapsed = Math.round((Date.now() - startTime) / 1000);
                if (elapsed > 30 && !hasStarted) {
                    if (strictCI) {
                        throw new AutoFlowError(
                            'Strict CI is enabled, but no GitHub Actions were found for this commit after 30s. ABORTED.',
                            EXIT_CODES.CI_FAILED,
                            'RemoteCI'
                        );
                    }
                    log.warning('⚠️  No GitHub Actions found for this commit after 30s.');
                    log.info('    Either no CI is configured or GitHub is delayed.');
                    log.info('    Proceeding anyway to be safe...\n');
                    return;
                }
                log.info('... Waiting for GitHub to register the push and start Actions...');
            }
        } catch (err) {
            if (err instanceof AutoFlowError) throw err;
            log.warning(`Warning: GitHub API poll failed: ${err instanceof Error ? err.message : String(err)}. Retrying...`);
        }

        await new Promise(r => setTimeout(r, interval));
    }

    throw new AutoFlowError(
        'Remote CI timed out after 5 minutes. Deployment ABORTED.',
        EXIT_CODES.CI_FAILED,
        'RemoteCI'
    );
}

function getGitHubCheckRuns(owner: string, repo: string, sha: string): Promise<GitHubCheckRun[]> {
    return new Promise((resolve, reject) => {
        const options = {
            hostname: 'api.github.com',
            path: `/repos/${owner}/${repo}/commits/${sha}/check-runs`,
            headers: {
                'User-Agent': 'AutoFlow-CLI',
                'Accept': 'application/vnd.github.v3+json',
                ...(process.env.GITHUB_TOKEN ? { 'Authorization': `token ${process.env.GITHUB_TOKEN}` } : {})
            }
        };

        https.get(options, (res) => {
            let data = '';
            res.on('data', (chunk) => data += chunk);
            res.on('end', () => {
                if (res.statusCode === 200) {
                    const json = JSON.parse(data);
                    const runs = json.check_runs.map((r: any) => ({
                        name: r.name,
                        status: r.status,
                        conclusion: r.conclusion,
                        html_url: r.html_url
                    }));
                    resolve(runs);
                } else if (res.statusCode === 404 || res.statusCode === 403) {
                    // 404: Not found (likely hidden private repo or missing SHA)
                    // 403: Rate limit or unauthorized
                    resolve([]);
                } else {
                    reject(new Error(`GitHub API HTTP ${res.statusCode}`));
                }
            });
        }).on('error', reject);
    });
}


// ── Public entry point ───────────────────────────────────────────────────────
export async function runCIChecks(appType: string, strictCI?: boolean): Promise<void> {
    log.header('LOCAL CI CHECKS');

    if (appType === 'static') {
        runStaticChecks();
        return;
    }

    // Node/npm project
    const pkgPath = `${process.cwd()}/package.json`;
    if (!fs.existsSync(pkgPath)) {
        if (strictCI) {
            throw new AutoFlowError(
                'Strict CI is enabled, but no package.json was found. Cannot run node checks.',
                EXIT_CODES.CI_FAILED,
                'CI'
            );
        }
        log.info('No package.json found. Skipping local CI checks.');
        return;
    }

    // Pass strictCI down
    await runNodeChecks(strictCI);
}

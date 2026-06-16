import { exec, execSync, execFile } from 'child_process';
import fs from 'fs';
import https from 'https';
import path from 'path';
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
function runStaticChecks(projectDir: string): void {
    log.info('Static project detected. Running static CI checks...\n');

    const checks: { label: string; pass: boolean; tip?: string }[] = [];

    // 1. index.html must exist
    const hasIndex = fs.existsSync(`${projectDir}/index.html`);
    checks.push({
        label: 'index.html exists',
        pass: hasIndex,
        tip: 'Static projects must have an index.html at the root.',
    });

    // 2. Dockerfile must exist (autoflow needs it to containerise the site)
    const hasDockerfile = fs.existsSync(`${projectDir}/Dockerfile`);
    checks.push({
        label: 'Dockerfile exists',
        pass: hasDockerfile,
        tip: 'A Dockerfile is required to serve the static site via nginx in a container.',
    });

    // 3. .autoflow.yml / .autoflow.yaml must exist
    const hasConfig =
        fs.existsSync(`${projectDir}/.autoflow.yml`) ||
        fs.existsSync(`${projectDir}/.autoflow.yaml`);
    checks.push({
        label: '.autoflow.yml config exists',
        pass: hasConfig,
        tip: 'Run "autoflow init" to create the project config.',
    });

    // 4. Warn about large/dirty assets (files > 50 MB in public/ or assets/)
    const bigFileDirs = ['public', 'assets', '.'];
    let bigFiles: string[] = [];
    for (const dir of bigFileDirs) {
        const dirPath = `${projectDir}/${dir === '.' ? '' : dir}`;
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
async function runNodeChecks(projectDir: string, strictCI?: boolean): Promise<void> {
    const pkgPath = `${projectDir}/package.json`;

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
        execSync(testCmd, { stdio: 'inherit', cwd: projectDir });
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


async function runWithLimit<T>(tasks: (() => Promise<T>)[], limit: number): Promise<T[]> {
    const results: T[] = new Array(tasks.length);
    let index = 0;
    async function runWorker() {
        while (index < tasks.length) {
            const currentIndex = index++;
            results[currentIndex] = await tasks[currentIndex]();
        }
    }
    const workers = Array.from({ length: Math.min(limit, tasks.length) }, runWorker);
    await Promise.all(workers);
    return results;
}

// ── PHP checks ───────────────────────────────────────────────────────────────
async function runPhpChecks(projectDir: string): Promise<void> {
    log.info('PHP project detected. Running PHP CI checks...\n');

    const cwd = projectDir;
    const checks: { label: string; pass: boolean; tip?: string }[] = [];

    // 1. index.php or public/index.php must exist
    const hasIndex = fs.existsSync(`${cwd}/index.php`) || fs.existsSync(`${cwd}/public/index.php`);
    checks.push({ label: 'index.php exists', pass: hasIndex, tip: 'PHP projects must have an index.php entry point.' });

    // 2. Dockerfile must exist
    const hasDockerfile = fs.existsSync(`${cwd}/Dockerfile`);
    checks.push({ label: 'Dockerfile exists', pass: hasDockerfile, tip: 'Run "autoflow init" to generate a Dockerfile.' });

    let failed = false;
    for (const check of checks) {
        if (check.pass) { log.success(`  ✔ ${check.label}`); }
        else { log.error(`  ✘ ${check.label}`); if (check.tip) log.info(`    Tip: ${check.tip}`); failed = true; }
    }

    // 3. PHP lint (syntax check) — cross-platform, runs only if php is available locally
    let phpAvailable = false;
    try {
        execSync('php -v', { stdio: 'ignore' });
        phpAvailable = true;
    } catch {
        log.warning('  ⚠️  php not found locally — skipping syntax check (it will run on GitHub Actions).');
    }

    if (phpAvailable) {
        const phpFiles: string[] = [];
        const walk = (dir: string) => {
            for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
                const full = path.join(dir, entry.name);
                const rel = path.relative(cwd, full);
                if (entry.isDirectory()) {
                    if (['.git', 'vendor', 'node_modules'].includes(entry.name)) continue;
                    walk(full);
                } else if (entry.isFile() && entry.name.endsWith('.php')) {
                    phpFiles.push(rel);
                }
            }
        };
        try {
            walk(cwd);
        } catch (walkErr) {
            log.error(`Failed to walk directories for PHP files: ${walkErr instanceof Error ? walkErr.message : String(walkErr)}`);
            failed = true;
        }

        if (phpFiles.length > 0 && !failed) {
            const lintTasks = phpFiles.map(file => {
                return async (): Promise<boolean> => {
                    return new Promise((resolve) => {
                        execFile('php', ['-l', file], { cwd }, (error) => {
                            if (error) {
                                log.error(`  ✘ PHP syntax error in: ${file}`);
                                resolve(false);
                            } else {
                                resolve(true);
                            }
                        });
                    });
                };
            });

            const results = await runWithLimit(lintTasks, 4);
            const lintFailed = results.some(passed => !passed);
            if (!lintFailed) {
                log.success(`  ✔ PHP syntax check passed (${phpFiles.length} file(s))`);
            } else {
                failed = true;
            }
        }
    }

    if (failed) {
        throw new AutoFlowError(
            'PHP CI checks failed. Fix the issues above and try again.',
            EXIT_CODES.CI_FAILED, 'CI'
        );
    }
    log.success('✔ All PHP CI checks passed! Proceeding to deployment...\n');
}

// ── Python / Django / Flask checks ───────────────────────────────────────────
function runPythonChecks(projectDir: string): void {
    log.info('Python project detected. Running Python CI checks...\n');
    const cwd = projectDir;
    const checks: { label: string; pass: boolean; tip?: string }[] = [
        { label: 'requirements.txt exists', pass: fs.existsSync(`${cwd}/requirements.txt`), tip: 'Create a requirements.txt with your dependencies.' },
        { label: 'Dockerfile exists', pass: fs.existsSync(`${cwd}/Dockerfile`), tip: 'Run "autoflow init" to generate a Dockerfile.' },
    ];
    let failed = false;
    for (const check of checks) {
        if (check.pass) { log.success(`  ✔ ${check.label}`); }
        else { log.error(`  ✘ ${check.label}`); if (check.tip) log.info(`    Tip: ${check.tip}`); failed = true; }
    }
    if (failed) throw new AutoFlowError('Python CI checks failed.', EXIT_CODES.CI_FAILED, 'CI');
    log.success('✔ All Python CI checks passed! Proceeding to deployment...\n');
}

// ── Ruby / Rails checks ───────────────────────────────────────────────────────
function runRailsChecks(projectDir: string): void {
    log.info('Ruby project detected. Running Ruby CI checks...\n');
    const cwd = projectDir;
    const checks: { label: string; pass: boolean; tip?: string }[] = [
        { label: 'Gemfile exists', pass: fs.existsSync(`${cwd}/Gemfile`), tip: 'A Gemfile is required for Ruby projects.' },
        { label: 'Gemfile.lock exists', pass: fs.existsSync(`${cwd}/Gemfile.lock`), tip: 'Run "bundle install" locally first to generate Gemfile.lock.' },
        { label: 'Dockerfile exists', pass: fs.existsSync(`${cwd}/Dockerfile`), tip: 'Run "autoflow init" to generate a Dockerfile.' },
    ];
    let failed = false;
    for (const check of checks) {
        if (check.pass) { log.success(`  ✔ ${check.label}`); }
        else { log.error(`  ✘ ${check.label}`); if (check.tip) log.info(`    Tip: ${check.tip}`); failed = true; }
    }
    if (failed) throw new AutoFlowError('Ruby CI checks failed.', EXIT_CODES.CI_FAILED, 'CI');
    log.success('✔ All Ruby CI checks passed! Proceeding to deployment...\n');
}

// ── Go checks ─────────────────────────────────────────────────────────────────
function runGoChecks(projectDir: string): void {
    log.info('Go project detected. Running Go CI checks...\n');
    const cwd = projectDir;
    const checks: { label: string; pass: boolean; tip?: string }[] = [
        { label: 'go.mod exists', pass: fs.existsSync(`${cwd}/go.mod`), tip: 'Run "go mod init" to initialise the Go module.' },
        { label: 'go.sum exists', pass: fs.existsSync(`${cwd}/go.sum`), tip: 'Run "go mod tidy" to generate go.sum.' },
        { label: 'Dockerfile exists', pass: fs.existsSync(`${cwd}/Dockerfile`), tip: 'Run "autoflow init" to generate a Dockerfile.' },
    ];
    let failed = false;
    for (const check of checks) {
        if (check.pass) { log.success(`  ✔ ${check.label}`); }
        else { log.error(`  ✘ ${check.label}`); if (check.tip) log.info(`    Tip: ${check.tip}`); failed = true; }
    }
    if (failed) throw new AutoFlowError('Go CI checks failed.', EXIT_CODES.CI_FAILED, 'CI');
    log.success('✔ All Go CI checks passed! Proceeding to deployment...\n');
}

// ── Java / Maven checks ───────────────────────────────────────────────────────
function runJavaChecks(projectDir: string): void {
    log.info('Java project detected. Running Java CI checks...\n');
    const cwd = projectDir;
    const checks: { label: string; pass: boolean; tip?: string }[] = [
        { label: 'pom.xml exists', pass: fs.existsSync(`${cwd}/pom.xml`), tip: 'A pom.xml is required for Maven projects.' },
        { label: 'Dockerfile exists', pass: fs.existsSync(`${cwd}/Dockerfile`), tip: 'Run "autoflow init" to generate a Dockerfile.' },
    ];
    let failed = false;
    for (const check of checks) {
        if (check.pass) { log.success(`  ✔ ${check.label}`); }
        else { log.error(`  ✘ ${check.label}`); if (check.tip) log.info(`    Tip: ${check.tip}`); failed = true; }
    }
    if (failed) throw new AutoFlowError('Java CI checks failed.', EXIT_CODES.CI_FAILED, 'CI');
    log.success('✔ All Java CI checks passed! Proceeding to deployment...\n');
}

// ── Migration Safety Checks ──────────────────────────────────────────────────
function checkMigrationSafety(projectDir: string): void {
    const migrationDirs = ['migrations', 'db/migrations', 'database/migrations', 'prisma/migrations'];
    const destructiveKeywords = [/DROP\s+TABLE/i, /TRUNCATE\s+TABLE/i, /DATABASE\s+RESET/i];
    
    log.info('Scanning for destructive database operations in migrations...');
    
    let findings: string[] = [];
    
    for (const dir of migrationDirs) {
        const dirPath = path.join(projectDir, dir);
        if (!fs.existsSync(dirPath)) continue;
        
        try {
            const files = fs.readdirSync(dirPath);
            for (const file of files) {
                if (file.endsWith('.sql') || file.endsWith('.js') || file.endsWith('.ts')) {
                    const content = fs.readFileSync(path.join(dirPath, file), 'utf-8');
                    for (const kw of destructiveKeywords) {
                        if (kw.test(content)) {
                            findings.push(`${dir}/${file} (matches ${kw.source})`);
                        }
                    }
                }
            }
        } catch { /* ignore */ }
    }
    
    if (findings.length > 0) {
        log.warning('\n⚠️  POTENTIALLY DESTRUCTIVE MIGRATIONS DETECTED:');
        findings.forEach(f => log.info(`  - ${f}`));
        log.info('   Please ensure these are intentional and won\'t wipe production data.\n');
    } else {
        log.success('✔ No obviously destructive migrations found.');
    }
}

// ── Public entry point ───────────────────────────────────────────────────────
export async function runCIChecks(projectDir: string, appType: string, strictCI?: boolean): Promise<void> {
    log.header('LOCAL CI CHECKS');

    // Run migration safety check for all non-static apps
    if (appType !== 'static') {
        checkMigrationSafety(projectDir);
    }

    switch (appType) {
        case 'static':
            runStaticChecks(projectDir);
            return;

        case 'php':
            await runPhpChecks(projectDir);
            return;

        case 'django':
        case 'flask':
        case 'python':
            runPythonChecks(projectDir);
            return;

        case 'rails':
        case 'ruby':
            runRailsChecks(projectDir);
            return;

        case 'go':
            runGoChecks(projectDir);
            return;

        case 'java':
            runJavaChecks(projectDir);
            return;

        case 'vue':
        case 'nuxt':
        default:
            // Node.js / JS frameworks
            break;
    }

    // Node/npm project
    const pkgPath = `${projectDir}/package.json`;
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

    await runNodeChecks(projectDir, strictCI);
}

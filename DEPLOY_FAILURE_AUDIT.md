# Autoflow — Deploy Pipeline Failure-Path Audit

**Audited:** `D:\AUTOFLOW\src\commands\deploy\` (all 13 services) + `src\commands\status.ts`, `src\utils\shell.ts`
**Date:** 2026-08-27 · **Version audited:** 1.0.0 · **Method:** read-only static trace
**Question asked of every step:** *if this throws, what state is the server left in, and can the user get back?*

---

## Context

Autoflow is a local-first deployment orchestrator (SSH → Docker → Nginx → Let's Encrypt) currently running 25+ projects across 3–5 EC2 servers. It advertises **zero-downtime transactional deploys with automatic rollback**.

While tracing the deploy path we found that `triggerRollback()` has exactly **one** call site — the catch around the health check — which contradicts the working assumption that rollback fires on build failure. That prompted this audit.

The conclusion up front: **the rollback machinery is correctly implemented. The orchestration around it is not.** `backupContainer` / `triggerRollback` / `confirmDeploy` form a correct three-state machine; the defects are all in *when* they're called, *what* they're wrapped in, and *whether their results are verified*. That distinction matters — the fix is a reorder plus a few guards, not a rewrite.

Error paths are the least-exercised code in any codebase, and Autoflow's own pre-flight gates (`runCIChecks`, GitHub Actions) plus `ensureSwap` have been suppressing the conditions that would expose these. 25 successful deploys give near-zero information about them.

---

## Verdict summary

| Severity | Count | IDs |
|---|---|---|
| Critical | 3 | F1, F2, F3 |
| High | 2 | F4, F5 |
| Medium | 4 | F6, F7, F8, F9 |
| Low | 4 | F10, F11, F12, F13 |

**Two claims in the README are not currently true:**
1. *"Zero-downtime … without dropping a single user request"* — every deploy has downtime equal to the **full Docker build duration** (up to the 10-minute timeout), because the live container is stopped before the build starts.
2. *"Rigorous health checks"* — the health check makes no HTTP request. It runs `docker ps | grep Up`.

---

## The state model (what actually exists)

The deploy holds server-side state across three named Docker objects:

```
<project>            the live container
<project>_rollback   the previous container, renamed + stopped  (rollback.ts:6, 20)
<project>:latest     the image
```

The intended transaction is:

```
backupContainer()   live → _rollback (stopped)      ── snapshot taken
   ...build + start new <project>...
verifyContainerHealth()
   ├── pass → confirmDeploy()    → delete _rollback  ── commit
   └── fail → triggerRollback()  → _rollback → live  ── abort
```

**This design is correct.** Every defect below is a deviation between it and `index.ts`.

---

## Per-step failure matrix

`index.ts` line refs. "Rollback?" = does a failure here reach `triggerRollback()`.

| # | Step | Throws? | Server state if it throws | Rollback? | Recoverable? |
|---|---|---|---|---|---|
| 1 | `loadConfig` :76 | yes | untouched (no SSH yet) | n/a | ✅ |
| 1.5 | Vault unlock :97 | yes | untouched | n/a | ✅ |
| 2 | `runCIChecks` :109 | yes | untouched | n/a | ✅ |
| 3 | `syncLocalGit` :112 | yes | untouched — but local auto-commit already made | n/a | ✅ |
| 4 | `waitForRemoteCI` :115 | yes | untouched | n/a | ✅ |
| 5 | `connectSSH` :118 | yes | untouched | n/a | ✅ |
| 5b | `ensureSwap` :122 | **no** (swallows all) | swapfile may be half-created | n/a | ✅ |
| 6 | `allocatePort` :125 | yes | untouched, **app still live** | n/a | ✅ |
| 7 | `pullCodeOnServer` :128 | yes | repo dir partially reset, **app still live** | n/a | ✅ |
| 8 | **`backupContainer`** :131 | rarely (see F3) | **live container renamed + STOPPED → SITE DOWN** | ❌ | manual only |
| 9 | **`buildDockerImage`** :134 | yes — OOM, bad Dockerfile, 10-min timeout | **site down for the entire build, no new container** | ❌ | manual only |
| 9.5 | `syncEnv` :140 | yes | site down **+ plaintext `.env` on disk** | ❌ | manual |
| 10 | `startContainer` :150 | yes | **site down + plaintext `.env` left on disk** | ❌ | manual |
| 10.5 | `cleanupEnv` :154 | yes | new container up, `.env` may remain | ❌ | mostly fine |
| 11a | `verifyContainerHealth` :159 | yes | → **rollback fires** | ✅ | automatic |
| 11b | `confirmDeploy` :160 | ~never (`\|\| true`) | snapshot may remain | ✅ | ✅ |
| 12 | `configureUFW` :179 | yes | app live & healthy; firewall partial; **snapshot already deleted** | ❌ | ✅ (app runs) |
| 13a | `configureNginx` :182 | yes (`NGINX_FAILED`) | app live; **broken config left symlinked** → blocks all future deploys on that server | ❌ | manual |
| 13b | `provisionSSL` :183 | **no** (warns only) | HTTP only | n/a | ✅ |

**Read the ❌ column.** Rollback covers exactly one of the eight steps that can strand the server.

---

## Findings

### F1 — CRITICAL · The live container is stopped *before* the new image is built

`backupContainer` renames the running container and then stops it:

```ts
// rollback.ts:26,29
await ssh.execCommand(`docker rename ${containerName} ${rollbackName}`);
await ssh.execCommand(`docker stop ${rollbackName}`);   // ← live app dies here
```

It runs at **Step 8** (`index.ts:131`). `buildDockerImage` runs at **Step 9** (`index.ts:134`) with a **600 000 ms timeout** (`dockerBuildService.ts:19`).

**Consequence A —** downtime per deploy = build duration + container start, not "container swap." This is the zero-downtime claim, broken.
**Consequence B —** a build failure leaves the old container stopped, no new container, and (per F2) no rollback. Site down until someone SSHes in.

**Fix:** move `backupContainer` to *after* `buildDockerImage`. Verified safe:
- The build doesn't need the port. `allocatePort` only reuses the port for the eventual `docker run` (`portService.ts:8-19`, which already logs *"causes brief downtime"*), and the bind happens in `startContainer` (`containerService.ts:55-65`).
- Image retention is unaffected. `docker image prune -f` runs in the same command as the build (`dockerBuildService.ts:18`); at that moment the old container still references the old image (running, under its original name), so prune cannot remove it. After the rename+stop, a *stopped* container still holds the reference. The rollback image survives in both orderings.

---

### F2 — CRITICAL · Rollback wraps only the health check, not the steps that strand the server

```ts
// index.ts:158
try {
    await verifyContainerHealth(ssh, container);
    await confirmDeploy(ssh, container);
} catch (healthErr) {
    ...
    await triggerRollback(rollbackSsh, container);   // ← the ONLY call site, line 171
    throw healthErr;
}
```

Steps 8 → 10.5 sit **outside** this block. A throw in `buildDockerImage`, `syncEnv`, `unlockEnvOnServer`, `startContainer`, or `cleanupEnv` goes straight to:
- the `finally` at `index.ts:190` — **SSH dispose only**, no rollback
- the outer `catch` at `index.ts:202` — records `fatalErr`
- `handleFatalError` → `process.exit(err.exitCode)` (`errors.ts:128-140`)

This is the direct answer to *"rollback always triggers on build failure."* It does not. It cannot — there is no code path from a build failure to `triggerRollback`.

**Fix:** widen the try to open immediately after `backupContainer` (post-F1 reorder) and close after nginx/UFW succeed (see F6).

---

### F3 — CRITICAL · `backupContainer` never verifies the snapshot was actually created

Every command in `backupContainer` uses raw `ssh.execCommand` — **not** the `exec()` helper that throws on non-zero exit (`errors.ts:72-87`):

```ts
// rollback.ts:23,26,29 — none of these check .code
await ssh.execCommand(`docker rm -f ${rollbackName} || true`);
await ssh.execCommand(`docker rename ${containerName} ${rollbackName}`);
await ssh.execCommand(`docker stop ${rollbackName}`);
log.success(`Rollback snapshot ready (stopped): "${rollbackName}" ✔`);   // unconditional
```

If `docker rename` fails (name collision, daemon hiccup), the function **logs success anyway**. Then `startContainer` executes `docker rm -f <containerName> || true` (`containerService.ts:19`) and **destroys the live container with no snapshot in existence**. A later health failure hits `triggerRollback`'s guard and throws *"No rollback snapshot available. Manual intervention required."*

This is the single defect that most justifies calling rollback unreliable: it can silently disable the entire guarantee while printing a green checkmark.

Note the contrast — `triggerRollback` *does* verify itself (`rollback.ts:70-83`), which is why the restore path is trustworthy and the backup path isn't.

**Fix:** use `exec()` for the rename, or re-verify with `docker ps -a --filter name=^/<rollbackName>$` before logging success.

---

### F4 — HIGH · The health check never checks health

```ts
// containerService.ts:81-88
const ps = await ssh.execCommand(`docker ps --filter name=^/${containerName}$ --format "{{.Status}}"`);
if (ps.stdout && ps.stdout.includes('Up')) { isHealthy = true; break; }
```

No HTTP request is ever made. A container that boots successfully and returns 500 on every route **passes**, gets `confirmDeploy()` (snapshot deleted), and receives production traffic at Step 12.

Secondary bug: `includes('Up')` matches `Up 30 seconds (unhealthy)` — Docker's own failing `HEALTHCHECK` verdict is ignored. Scoped honestly: Autoflow doesn't generate `HEALTHCHECK`, so this only affects user-authored Dockerfiles.

**Reuse, don't invent.** `status.ts:65-79` already implements exactly the right probe, including port discovery:

```ts
const portCmd = await ssh.execCommand(`docker port ${safeContainer}`);
const match = portCmd.stdout.match(/0\.0\.0\.0:(\d+)/) || portCmd.stdout.match(/127\.0\.0\.1:(\d+)/);
const health = await ssh.execCommand(
    `curl -I -s -o /dev/null -w "%{http_code}" http://127.0.0.1:${mappedPort}`
);
```

`curl` is guaranteed present — `core/installer.ts:72` uses it to install Docker.

**Fix conservatively:** fail **only** on 5xx or an empty/`000` response. Let 2xx, 3xx, 401, 403 and 404 all pass. A stricter rule (e.g. "must be 200") would false-positive on apps whose `/` legitimately redirects to a login or 404s, and a false rollback is worse than no rollback.

---

### F5 — HIGH · A broken Nginx config is left enabled when `nginx -t` fails

`configureNginx` writes the config, symlinks it into `sites-enabled`, seds it, **then** tests:

```
nginxService.ts:84   write  /etc/nginx/sites-available/<project>
nginxService.ts:87   ln -sf → /etc/nginx/sites-enabled/<project>
nginxService.ts:90   sed -i  (port rewrite)
nginxService.ts:96   nginx -t
nginxService.ts:98   throw NGINX_FAILED     ← bad symlink still in place
```

Running Nginx is unaffected (the reload at line 105 never happens), but the **on-disk state is now unreloadable**:
- a reboot or any `systemctl reload nginx` fails
- **every future `autoflow deploy` for every project on that server** fails at its own `nginx -t`, because the broken config is still enabled

One project's bad config wedges the whole box.

**Trigger:** `domain` is interpolated raw at `nginxService.ts:21` — `server_name ${domain};`. A malformed `.autoflow.yml` value (space, `;`, stray newline) is sufficient. Self-inflicted, but a config typo should not be able to do this.

**Fix:** stage the config, test with the candidate enabled, unlink and restore on failure *before* throwing. Plus validate `domain` against a hostname pattern in `configService.ts`.

---

### F6 — MEDIUM · The snapshot is deleted before the last two steps that can throw

`confirmDeploy` (`index.ts:160`) deletes `_rollback`. `configureUFW` (:179) and `configureNginx` (:182) run **after** it and both throw via `exec()`.

Bounded severity: at that point the new container is running and passed the health check, so this is a routing failure, not a dead app. And `provisionSSL` is **not** in scope — it warns and returns on every failure path and never throws (`sslService.ts:49-65`), which is good design worth preserving.

**Fix:** move `confirmDeploy` to after nginx + UFW succeed, inside the widened try from F2.

---

### F7 — MEDIUM · A crashed container gets no rollback protection, then gets destroyed

`backupContainer` gates on `docker ps` — **running containers only**:

```ts
// rollback.ts:11-18
const checkRunning = await ssh.execCommand(`docker ps --filter name=^/${containerName}$ ...`);
if (!checkRunning.stdout.trim()) { log.info('No running container to backup. Fresh deploy.'); return; }
```

If the previous container crashed and is sitting `Exited`, this reports "Fresh deploy" and takes no snapshot. `startContainer` then runs `docker rm -f <name> || true` (`containerService.ts:19`) and **destroys it**. A subsequent health failure finds nothing to restore — `triggerRollback` searches with `docker ps -a` (`rollback.ts:50-52`), so it would have accepted a stopped container; the snapshot simply was never made.

So the scenario where rollback matters most — redeploying to fix an already-broken app — is the one scenario with no safety net.

**Fix:** use `docker ps -a` in `backupContainer` and snapshot regardless of run state.

---

### F8 — MEDIUM · Plaintext `.env` is left on the server if the container fails to start

`syncEnv` SFTPs the decrypted `.env` to the remote project dir at mode 0600 (`envService.ts:43-49`, Step 9.5). `cleanupEnv` runs at Step 10.5 — **only after `startContainer` succeeds** (`index.ts:153-155`).

If `startContainer` throws (bad `docker run`, port conflict, missing image), `cleanupEnv` never runs and plaintext secrets persist on disk until the next deploy overwrites them. This directly contradicts the success message *"✔ Server-side disk is clean."*

**Fix:** wrap Steps 9.5–10.5 so `cleanupEnv` runs in a `finally`.

---

### F9 — MEDIUM · Ctrl+C mid-deploy leaves the site down with no rollback

`SshCleanupManager`'s signal handler disposes SSH connections and exits (`errors.ts:97-108`). No rollback attempt.

```ts
log.warning('AutoFlow exited. Your server may be in a partial state. Run "autoflow status" to check.');
process.exit(EXIT_CODES.UNKNOWN);
```

The warning is honest and `autoflow status` does exist (`src/commands/status.ts`) — but `status` inspects only `<projectName>` and never mentions `_rollback` (see F11), so it points the user at a tool that won't reveal the recovery path.

Today the dangerous window spans the entire build. **After the F1 reorder it shrinks to a few seconds**, which is most of the fix.

---

### F10 — LOW · `triggerRollback`'s own success check reuses the shallow `Up` test

```ts
// rollback.ts:70-83
await new Promise((resolve) => setTimeout(resolve, 3000));
const ps = await ssh.execCommand(`docker ps --filter ... --format "{{.Status}}"`);
if (ps.stdout.includes('Up')) { log.success('Rollback complete! ...'); }
```

Same bug class as F4, in the path where a wrong answer is worst: reporting *"Rollback complete!"* for a container that is up but serving errors. **Fix:** reuse the shared probe helper from F4.

---

### F11 — LOW · `status` can't see the state a failed deploy leaves behind

`status.ts:29-37` inspects only `<projectName>`. In the F1/F2 stranded state that container doesn't exist, so the user sees:

```
❌ APP STATUS: NOT RUNNING (Container not found)
```

…with no indication that `<projectName>_rollback` exists on the server and holds their last working version. **Fix:** also inspect `_rollback` and, when present, print the two commands that restore it.

---

### F12 — LOW · `setupGlobalDefaultServer` deletes `sites-enabled/default` with no backup and no restore

`nginxService.ts:157-159` removes it, guarded only by a phpMyAdmin substring check. If the modern catch-all then fails `nginx -t` **and** the fallback also fails, line 183 removes the catch-all but never restores `default` — the server ends with neither.

Compounding: the early-return at line 116 keys on the *file* existing in `sites-available`, not the symlink. After that failure path the file exists, so the function returns early forever and the catch-all is never re-enabled.

**Fix:** `cp` a backup before removing — the same pattern already used for conflicts at line 74 — and gate the early return on the symlink.

---

### F13 — LOW (hardening) · Unquoted remote-derived paths in the Nginx conflict handler

`nginxService.ts:60, 74-76` interpolate `conflict` / `conflictName` (from `grep -Rl` output) into `cat "..."`, `sudo cp`, `sudo rm -f` without `escapeShellArg`. Exploiting it requires root on the box already, and a path with a space merely breaks rather than escalates — but the codebase has the right helper and uses it 40+ times elsewhere, so this is an inconsistency rather than a decision.

Same class, non-blocking: `remoteGitService.ts:26` hand-rolls `escapeShellArg`'s exact logic inline (`pat.replace(/'/g, "'\\''")`) instead of calling it.

---

## What is already right (do not touch)

Calibration matters as much as the findings:

- **`escapeShellArg`** (`utils/shell.ts`) is the correct POSIX idiom and is applied consistently across 40+ call sites in 9 files. No shell-injection vulnerability was found in the deploy path.
- **SSH reconnect before rollback** (`index.ts:163-169`) — detects a dead connection and reconnects *specifically in order to roll back*. Most production tooling doesn't do this.
- **`triggerRollback` verifies its own result** and raises a dedicated `ROLLBACK_FAILED` exit code. The restore path is trustworthy.
- **UFW opens SSH before enabling the firewall** (`ufwService.ts:18-21`) — avoids the classic self-lockout.
- **`provisionSSL` never throws**, and DNS-prevalidates to avoid Let's Encrypt rate limits (`sslService.ts:25-29`).
- **Deploy lock with stale-PID detection** (`index.ts:32-68`) — handles the SIGKILL'd-previous-run case correctly.
- **Secrets travel by SFTP stream at mode 0600** (`envService.ts:43-49`), never through a shell command — no exposure via process list or shell history.
- **Nginx catch-all returns 444** for unmatched domains — blocks random-domain hijacking of the default vhost.
- **Structured exit codes** (`errors.ts:18-32`) and build-log streaming with a timeout.

---

## Remediation plan

### Phase 1 — Stop the bleeding (~15 lines, `index.ts` + `rollback.ts`)

Fixes **F1, F2, F3**. Every deploy benefits; unrecoverable states become impossible.

1. `index.ts` — move `backupContainer(ssh, container)` from before `buildDockerImage` to after it.
2. `index.ts` — open the `try` immediately after `backupContainer`; keep `triggerRollback` in its `catch`, including the existing SSH-reconnect logic unchanged.
3. `rollback.ts` — in `backupContainer`, switch the `docker rename` to `exec()` (from `./errors`) so a failed rename throws instead of logging success.

Resulting order:

```
Step 7   pullCodeOnServer
Step 8   buildDockerImage          ← old container still LIVE throughout
Step 9   backupContainer           ← snapshot; downtime starts here
   ┌─ try
Step 10    syncEnv / startContainer / cleanupEnv
Step 11    verifyContainerHealth → confirmDeploy
   └─ catch → triggerRollback
```

Downtime drops from *build duration* to *container swap*. A build failure never touches the live container, so that failure mode ceases to exist rather than being handled.

### Phase 2 — Make the gate real

Fixes **F4, F10**. Extract a shared helper (suggested: `containerService.ts` → `probeContainerHttp(ssh, containerName)`) lifted from the existing `status.ts:65-79` implementation. Call it from `verifyContainerHealth` and from `triggerRollback`'s verification. Fail only on 5xx or no response.

### Phase 3 — Close the remaining state gaps

Fixes **F5, F6, F7, F8**. F5 first — it's the only finding that can affect *other* projects on the same server.

### Phase 4 — Recovery UX and hardening

Fixes **F9, F11, F12, F13**. Mostly `status.ts` surfacing `_rollback` plus the exact recovery commands.

### Also

Reword the two README claims to match behaviour. After Phase 1 + 2 both become true, so this can be a single edit at the end of Phase 2 rather than a retraction now.

---

## Verification

There are **no first-party tests** — every `*.test.ts` match is inside `node_modules`. But `jest` + `ts-jest` are already devDependencies and `npm test` is wired to `jest` (`package.json:21`), so the harness exists and is simply unused.

**Unit (no server needed).** Add `src/commands/deploy/__tests__/deploy-order.test.ts` with a mocked `NodeSSH` that records commands in order, and assert:
- `docker build` is recorded **before** `docker rename … _rollback`
- a `startContainer` rejection results in `docker rename <name>_rollback <name>` being issued (rollback reached)
- a failed `docker rename` in `backupContainer` causes a throw, not a success log
- `cleanupEnv`'s `rm -f …/.env` is issued even when `startContainer` rejects

**Integration — on a scratch EC2 instance, never on a box carrying the 25 live projects.** Inject each fault and assert the recovery:

| Fault to inject | Expected after fix |
|---|---|
| `RUN exit 1` appended to Dockerfile | old container **still running**; site never went down |
| `CMD ["false"]` — container exits immediately | rollback fires, previous version live |
| App that returns 500 on every route | Phase 2 probe catches it → rollback (this **passes** today) |
| `domain: "bad;name"` in `.autoflow.yml` | `sites-enabled` clean after failure; a second project's deploy still succeeds |
| Ctrl+C during the build | site stays up (window is now post-build) |
| Occupy the host port so `docker run` fails | `.env` gone from the server; rollback fired |
| Pre-crashed container (`docker stop` it first, then deploy) | snapshot still taken; rollback available |

**Manual check on a real server before/after Phase 1:** time the outage with
`while true; do curl -s -o /dev/null -w "%{http_code} " https://<domain>; sleep 0.5; done`
during a deploy. Expect the run of non-200s to shrink from build-duration to a few seconds.

---

## Suggested commit sequence

One phase per PR, Phase 1 alone first. It touches the deploy path for servers running 25+ real projects, so the diff wants careful review and a scratch-instance run before it goes near production.

```
fix(deploy): build image before taking rollback snapshot   # F1, F2, F3
feat(deploy): verify container health over HTTP            # F4, F10
fix(nginx): stage config and revert on failed nginx -t     # F5
fix(deploy): snapshot stopped containers; always clean env  # F6, F7, F8
feat(status): surface rollback snapshot and recovery steps  # F9, F11, F12, F13
```

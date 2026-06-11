import { EventEmitter } from 'events';
import { connectionManager } from './connection';
import { deployerEngine } from './deployer';
import { GlobalConfig } from './config';

export interface ServerStats {
    cpu: string;       // e.g., "12.4%"
    ram: string;       // e.g., "482 MB / 1024 MB"
    ramPercent: number;// e.g., 47
    disk: string;      // e.g., "12 GB / 40 GB"
    diskPercent: number;// e.g., 30
    uptime: string;    // e.g., "14 days, 3 hours"
    latency: string;   // e.g., "45 ms"
    containers: Array<{
        name: string;
        cpu: string;
        mem: string;
        status: string;
    }>;
}

export class MonitorEngine {
    /**
     * Fetches stats dynamically using the persistent connection
     */
    public async fetchStats(): Promise<ServerStats> {
        if (connectionManager.getState() !== 'Connected') {
            throw new Error('Not connected to server');
        }

        const startTime = Date.now();

        try {
            const latency = `${Date.now() - startTime} ms`;

            // Run status collection commands in parallel
            const [cpuRaw, ramRaw, diskRaw, uptimeRaw, dockerRaw] = await Promise.all([
                connectionManager.safeRun("top -bn1 | grep 'Cpu(s)' | sed 's/.*, *\\([0-9.]*\\)%* id.*/\\1/' | awk '{print 100 - $1}'"),
                connectionManager.safeRun("free -m"),
                connectionManager.safeRun("df -h / | tail -n 1 | awk '{print $3 \" / \" $2 \",\" $5}'"),
                connectionManager.safeRun("uptime -p"),
                connectionManager.safeRun("docker ps -a --format '{{.Names}},{{.Status}}'"),
            ]);

            // 1. Process CPU
            let cpu = '0.0%';
            if (cpuRaw) {
                cpu = `${parseFloat(cpuRaw.trim()).toFixed(1)}%`;
            }

            // 2. Process RAM
            let ram = 'N/A';
            let ramPercent = 0;
            if (ramRaw) {
                const lines = ramRaw.split('\n');
                const memLine = lines.find(l => l.includes('Mem:'));
                if (memLine) {
                    const parts = memLine.split(/\s+/).filter(Boolean);
                    const total = parseInt(parts[1], 10);
                    const used = parseInt(parts[2], 10);
                    if (total > 0) {
                        ram = `${used} MB / ${total} MB`;
                        ramPercent = Math.round((used / total) * 100);
                    }
                }
            }

            // 3. Process Disk
            let disk = 'N/A';
            let diskPercent = 0;
            if (diskRaw) {
                const [usage, pctStr] = diskRaw.trim().split(',');
                disk = usage || 'N/A';
                diskPercent = parseInt(pctStr, 10) || 0;
            }

            // 4. Process Uptime
            const uptime = uptimeRaw ? uptimeRaw.trim().replace(/^up /, '') : 'Unknown';

            // 5. Process Docker containers or PM2 / Systemd fallbacks
            const containers: ServerStats['containers'] = [];
            if (dockerRaw) {
                const rows = dockerRaw.trim().split('\n').filter(Boolean);
                const names = rows.map(r => r.split(',')[0]).filter(Boolean);

                // Fetch all container stats in a single docker stats call (fast)
                let statsMap: Record<string, { cpu: string; mem: string }> = {};
                if (names.length > 0) {
                    const allStatsRaw = await connectionManager.safeRun(
                        `docker stats ${names.join(' ')} --no-stream --format "{{.Name}},{{.CPUPerc}},{{.MemUsage}}"`
                    );
                    if (allStatsRaw) {
                        for (const line of allStatsRaw.trim().split('\n').filter(Boolean)) {
                            const parts = line.split(',');
                            if (parts.length >= 3) {
                                statsMap[parts[0]] = {
                                    cpu: parts[1] || '0%',
                                    mem: parts[2] ? parts[2].split(' / ')[0] : '0MB'
                                };
                            }
                        }
                    }
                }

                for (const row of rows) {
                    const [name, status] = row.split(',');
                    const s = statsMap[name] || { cpu: '0%', mem: '0MB' };
                    containers.push({
                        name: name || 'unknown',
                        status: status || 'stopped',
                        cpu: s.cpu,
                        mem: s.mem,
                    });
                }
            } else {
                // Fallback 1: PM2 process monitoring
                const pm2Raw = await connectionManager.safeRun("pm2 jlist");
                if (pm2Raw) {
                    try {
                        const apps = JSON.parse(pm2Raw.trim());
                        if (Array.isArray(apps) && apps.length > 0) {
                            for (const app of apps) {
                                const name = app.name || 'PM2 App';
                                const status = app.pm2_env?.status || 'unknown';
                                const cpu = app.monit?.cpu !== undefined ? `${app.monit.cpu}%` : '0%';
                                const memBytes = app.monit?.memory || 0;
                                const mem = memBytes > 0 ? `${(memBytes / (1024 * 1024)).toFixed(1)} MB` : '0 MB';
                                containers.push({
                                    name: `[pm2] ${name}`,
                                    status,
                                    cpu,
                                    mem
                                });
                            }
                        }
                    } catch {
                        // ignore JSON parser error
                    }
                }

                // Fallback 2: Systemd active services list
                if (containers.length === 0) {
                    const systemdRaw = await connectionManager.safeRun("systemctl list-units --type=service --state=running --no-legend --no-pager | head -n 10");
                    if (systemdRaw) {
                        const rows = systemdRaw.trim().split('\n').filter(Boolean);
                        for (const row of rows) {
                            const parts = row.split(/\s+/).filter(Boolean);
                            if (parts.length >= 4) {
                                const name = parts[0];
                                const activeState = parts[3]; // e.g. running
                                containers.push({
                                    name: `[systemd] ${name}`,
                                    status: activeState,
                                    cpu: 'N/A',
                                    mem: 'N/A'
                                });
                            }
                        }
                    }
                }
            }

            return {
                cpu,
                ram,
                ramPercent,
                disk,
                diskPercent,
                uptime,
                latency,
                containers,
            };

        } catch (err: any) {
            console.error('[MonitorEngine] Failed to gather stats:', err.message);
            throw err;
        }
    }

    public async fetchRemoteLogs(name: string): Promise<string> {
        if (connectionManager.getState() !== 'Connected') {
            throw new Error('Not connected to server');
        }

        try {
            this.sanitizeContainerName(name);
            let cmd = `docker logs --tail 150 ${name}`;
            if (name.startsWith('[pm2] ')) {
                const pm2Name = name.replace('[pm2] ', '');
                cmd = `pm2 logs "${pm2Name}" --raw --lines 150`;
            } else if (name.startsWith('[systemd] ')) {
                const systemdName = name.replace('[systemd] ', '');
                cmd = `journalctl -u "${systemdName}" -n 150 --no-pager`;
            }

            const result = await connectionManager.execCommand(cmd);
            return result.stdout || result.stderr || 'No logs found.';
        } catch (err: any) {
            return `Failed to fetch remote logs: ${err.message}`;
        }
    }

    private cleanName(name: string): string {
        if (name.startsWith('[pm2] ')) return name.replace('[pm2] ', '');
        if (name.startsWith('[systemd] ')) return name.replace('[systemd] ', '');
        return name;
    }

    private sanitizeContainerName(name: string): string {
        const clean = this.cleanName(name);
        if (!/^[a-zA-Z0-9_.-]+$/.test(clean)) {
            throw new Error(`Invalid container name: ${clean}`);
        }
        return name;
    }

    // --- Container Controls ---
    public async stopContainer(name: string): Promise<boolean> {
        this.sanitizeContainerName(name);
        let success = false;
        if (name.startsWith('[pm2] ')) success = (await connectionManager.safeRun(`pm2 stop "${name.replace('[pm2] ', '')}"`)) !== null;
        else if (name.startsWith('[systemd] ')) success = (await connectionManager.safeRun(`sudo systemctl stop "${name.replace('[systemd] ', '')}"`)) !== null;
        else success = (await connectionManager.safeRun(`docker stop ${name}`)) !== null;
        
        // Only log Docker container actions to history to avoid dashboard glitches
        if (success && !name.startsWith('[')) deployerEngine.logContainerAction(this.cleanName(name), 'Stopped');
        return success;
    }

    public async restartContainer(name: string): Promise<boolean> {
        this.sanitizeContainerName(name);
        let success = false;
        if (name.startsWith('[pm2] ')) success = (await connectionManager.safeRun(`pm2 restart "${name.replace('[pm2] ', '')}"`)) !== null;
        else if (name.startsWith('[systemd] ')) success = (await connectionManager.safeRun(`sudo systemctl restart "${name.replace('[systemd] ', '')}"`)) !== null;
        else success = (await connectionManager.safeRun(`docker restart ${name}`)) !== null;

        if (success && !name.startsWith('[')) deployerEngine.logContainerAction(this.cleanName(name), 'Restarted');
        return success;
    }

    public async deleteContainer(name: string): Promise<boolean> {
        this.sanitizeContainerName(name);
        let success = false;
        if (name.startsWith('[pm2] ')) success = (await connectionManager.safeRun(`pm2 delete "${name.replace('[pm2] ', '')}"`)) !== null;
        else if (name.startsWith('[systemd] ')) success = false; // Not safe to delete systemd unit blindly
        else success = (await connectionManager.safeRun(`docker rm -f ${name}`)) !== null;

        if (success && !name.startsWith('[')) deployerEngine.logContainerAction(this.cleanName(name), 'Deleted');
        return success;
    }
}

export const monitorEngine = new MonitorEngine();

import { NodeSSH } from 'node-ssh';
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
     * Connects to SSH and fetches stats dynamically
     */
    public async fetchStats(config: GlobalConfig): Promise<ServerStats> {
        const ssh = new NodeSSH();
        const startTime = Date.now();

        try {
            await ssh.connect({
                host: config.serverIp,
                username: config.sshUser,
                port: Number(config.sshPort),
                privateKeyPath: config.sshKeyPath.replace(/^"|"$/g, ''),
            });

            const latency = `${Date.now() - startTime} ms`;

            // Run status collection commands in parallel
            const [cpuRaw, ramRaw, diskRaw, uptimeRaw, dockerRaw] = await Promise.all([
                this.safeRun(ssh, "top -bn1 | grep 'Cpu(s)' | sed 's/.*, *\\([0-9.]*\\)%* id.*/\\1/' | awk '{print 100 - $1}'"),
                this.safeRun(ssh, "free -m"),
                this.safeRun(ssh, "df -h / | tail -n 1 | awk '{print $3 \" / \" $2 \",\" $5}'"),
                this.safeRun(ssh, "uptime -p"),
                this.safeRun(ssh, "docker ps --format '{{.Names}},{{.Status}}'"),
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
                // free -m columns: total used free shared buff/cache available
                // Line 2: Mem: total used ...
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
                for (const row of rows) {
                    const [name, status] = row.split(',');
                    // Fetch CPU/Mem for this specific container
                    let containerCpu = '0%';
                    let containerMem = '0MB';
                    
                    if (name) {
                        const statsLine = await this.safeRun(ssh, `docker stats ${name} --no-stream --format "{{.CPUPerc}},{{.MemUsage}}"`);
                        if (statsLine) {
                            const [c, m] = statsLine.trim().split(',');
                            containerCpu = c || '0%';
                            containerMem = m ? m.split(' / ')[0] : '0MB';
                        }
                    }

                    containers.push({
                        name: name || 'unknown',
                        status: status || 'stopped',
                        cpu: containerCpu,
                        mem: containerMem,
                    });
                }
            } else {
                // Fallback 1: PM2 process monitoring
                const pm2Raw = await this.safeRun(ssh, "pm2 jlist");
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
                    const systemdRaw = await this.safeRun(ssh, "systemctl list-units --type=service --state=running --no-legend --no-pager | head -n 10");
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
        } finally {
            ssh.dispose();
        }
    }

    public async fetchRemoteLogs(config: GlobalConfig, name: string): Promise<string> {
        const ssh = new NodeSSH();
        try {
            await ssh.connect({
                host: config.serverIp,
                username: config.sshUser,
                port: Number(config.sshPort),
                privateKeyPath: config.sshKeyPath.replace(/^"|"$/g, ''),
            });

            let cmd = `docker logs --tail 150 ${name}`;
            if (name.startsWith('[pm2] ')) {
                const pm2Name = name.replace('[pm2] ', '');
                cmd = `pm2 logs "${pm2Name}" --raw --lines 150`;
            } else if (name.startsWith('[systemd] ')) {
                const systemdName = name.replace('[systemd] ', '');
                cmd = `journalctl -u "${systemdName}" -n 150 --no-pager`;
            }

            const result = await ssh.execCommand(cmd);
            return result.stdout || result.stderr || 'No logs found.';
        } catch (err: any) {
            return `Failed to fetch remote logs: ${err.message}`;
        } finally {
            ssh.dispose();
        }
    }

    private async safeRun(ssh: NodeSSH, cmd: string): Promise<string | null> {
        try {
            const result = await ssh.execCommand(cmd);
            if (result.code === 0) return result.stdout;
            return null;
        } catch {
            return null;
        }
    }
}

export const monitorEngine = new MonitorEngine();


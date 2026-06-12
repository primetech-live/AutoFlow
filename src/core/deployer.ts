import fs from 'fs';
import path from 'path';
import os from 'os';
import { EventEmitter } from 'events';
import { loadGlobalConfig, loadProjectConfig } from './config';
import { initProjectCore } from './initializer';
import { addLogListener, removeLogListener, LogType } from '../utils/logger';

export interface DeploymentHistoryItem {
    id: string;
    sequence: number;
    timestamp: number;
    duration: number; // in seconds
    status: 'Live' | 'Failed' | 'Rolled Back' | 'Interrupted' | 'Stopped' | 'Deleted' | 'Restarted';
    notes: string;
    commitSha: string;
}

const JOBS_DIR = path.join(os.homedir(), '.autoflow', 'jobs');
const ACTIVE_JOB_FILE = path.join(JOBS_DIR, 'active.json');
const HISTORY_DIR = path.join(os.homedir(), '.autoflow', 'history');

export class DeployerEngine extends EventEmitter {
    private activeDeployments = new Map<string, {
        startTime: number;
        step: string;
        logs: Array<{ timestamp: number; type: LogType; message: string }>;
    }>();

    constructor() {
        super();
        this.ensureDirectories();
    }

    private ensureDirectories() {
        if (!fs.existsSync(JOBS_DIR)) fs.mkdirSync(JOBS_DIR, { recursive: true });
        if (!fs.existsSync(HISTORY_DIR)) fs.mkdirSync(HISTORY_DIR, { recursive: true });
    }

    /**
     * Checks if there are any currently running deployments
     */
    public hasActiveDeployments(): boolean {
        return this.activeDeployments.size > 0;
    }

    /**
     * Checks if there was a previous interrupted deploy job due to app crash/exit
     */
    public checkInterruptedJob(): { projectPath: string; projectName: string } | null {
        if (fs.existsSync(ACTIVE_JOB_FILE)) {
            try {
                const data = JSON.parse(fs.readFileSync(ACTIVE_JOB_FILE, 'utf-8'));
                return data;
            } catch {
                return null;
            }
        }
        return null;
    }

    /**
     * Wipes any active job flags
     */
    public clearActiveJob() {
        if (fs.existsSync(ACTIVE_JOB_FILE)) {
            fs.unlinkSync(ACTIVE_JOB_FILE);
        }
    }

    /**
     * Records an active deployment job to restore state on reopen
     */
    private markJobActive(projectPath: string, projectName: string) {
        fs.writeFileSync(ACTIVE_JOB_FILE, JSON.stringify({ projectPath, projectName }), 'utf-8');
    }

    /**
     * Adds log to history log record
     */
    public getHistory(projectName: string): DeploymentHistoryItem[] {
        const historyFile = path.join(HISTORY_DIR, `${projectName}.json`);
        if (!fs.existsSync(historyFile)) return [];
        try {
            return JSON.parse(fs.readFileSync(historyFile, 'utf-8'));
        } catch {
            return [];
        }
    }

    /**
     * Appends a new item to project deployment history
     */
    public saveHistoryItem(projectName: string, item: DeploymentHistoryItem) {
        if (!fs.existsSync(HISTORY_DIR)) {
            fs.mkdirSync(HISTORY_DIR, { recursive: true });
        }
        const historyFile = path.join(HISTORY_DIR, `${projectName}.json`);
        const list = this.getHistory(projectName);
        list.unshift(item); // Add to beginning (newest first)
        fs.writeFileSync(historyFile, JSON.stringify(list, null, 2), 'utf-8');
    }

    /**
     * Logs manual container lifecycle actions
     */
    public logContainerAction(projectName: string, action: 'Stopped' | 'Deleted' | 'Restarted') {
        const item: DeploymentHistoryItem = {
            id: `action-${Date.now()}`,
            sequence: this.getHistory(projectName).length + 1,
            timestamp: Date.now(),
            duration: 0,
            status: action,
            notes: `Container manually ${action.toLowerCase()} via UI`,
            commitSha: 'N/A'
        };
        this.saveHistoryItem(projectName, item);
    }

    /**
     * Launches background deployment for a project path
     */
    public async deploy(projectPath: string): Promise<void> {
        let projectName = 'Unknown';
        const startTime = Date.now();
        const logs: Array<{ timestamp: number; type: LogType; message: string }> = [];

        try {
            const projectConfig = loadProjectConfig(projectPath);
            projectName = projectConfig.projectName || path.basename(projectPath);

            if (this.activeDeployments.has(projectName)) {
                throw new Error(`Deployment already running for project: ${projectName}`);
            }

            this.activeDeployments.set(projectName, {
                startTime,
                step: 'Prepare',
                logs
            });

            this.markJobActive(projectPath, projectName);
            this.emit('deploy:started', { projectName, startTime });

            const DEBUG_LOG = path.join(process.cwd(), 'debug-deploy.txt');
            const dlog = (msg: string) => {
                try { fs.appendFileSync(DEBUG_LOG, `[${new Date().toISOString()}] ${msg}\n`); } catch {}
            };

            dlog(`Deploying project: ${projectName}`);

            const { default: deployProjectCore } = require('../commands/deploy/index');
            const { addLogListener, removeLogListener } = require('../utils/logger');

            const active = this.activeDeployments.get(projectName);
            if (!active) return;

            const logListener = (type: string, message: string) => {
                const text = message.trim();
                if (!text) return;

                dlog(`LOG [${type}]: ${text}`);
                
                let currentStep = active.step || 'Prepare';
                if (text.includes('CI CHECKS') || text.includes('Checking GitHub')) currentStep = 'Prepare';
                else if (text.includes('Pushing to remote') || text.includes('Uploading')) currentStep = 'Upload';
                else if (text.includes('Building Docker')) currentStep = 'Build';
                else if (text.includes('Health check')) currentStep = 'Verify';
                else if (text.includes('SUCCESS') || text.includes('is LIVE')) currentStep = 'Live';

                active.step = currentStep;
                active.logs.push({ timestamp: Date.now(), type: type as any, message: text });
                this.emit('deploy:log', { projectName, timestamp: Date.now(), type, message: text, step: currentStep });
            };

            addLogListener(logListener);

            try {
                // Execute directly in main process (100% reliable, zero ASAR spawn bugs)
                await deployProjectCore(true, projectPath); // true = isDesktop
            } catch (err: any) {
                removeLogListener(logListener);
                throw err;
            } finally {
                removeLogListener(logListener);
            }

            dlog(`Process completed successfully.`);
            
            let commitSha = 'Unknown';
            try {
                const { execSync } = require('child_process');
                commitSha = execSync('git rev-parse --short HEAD', { cwd: projectPath, encoding: 'utf8' }).trim();
            } catch {
                try {
                    const gitFile = path.join(projectPath, '.git', 'refs', 'heads', 'main');
                    if (fs.existsSync(gitFile)) {
                        commitSha = fs.readFileSync(gitFile, 'utf-8').trim().substring(0, 7);
                    }
                } catch {}
            }

            const duration = Math.round((Date.now() - startTime) / 1000);
            this.saveHistoryItem(projectName, {
                id: `dep-${Date.now()}`,
                sequence: this.getHistory(projectName).length + 1,
                timestamp: Date.now(),
                duration,
                status: 'Live',
                notes: 'Successful deployment',
                commitSha
            });

            this.emit('deploy:success', { projectName });

        } catch (error: any) {
            console.error('[Deployer] Deployment failed:', error);
            
            const active = this.activeDeployments.get(projectName);
            if (active) {
                active.logs.push({ timestamp: Date.now(), type: 'error', message: error.message });
                active.step = 'Failed';
            }
            
            this.saveHistoryItem(projectName, {
                id: `dep-${Date.now()}`,
                sequence: this.getHistory(projectName).length + 1,
                timestamp: Date.now(),
                duration: Math.round((Date.now() - startTime) / 1000),
                status: 'Failed',
                notes: error.message,
                commitSha: 'N/A'
            });

            this.emit('deploy:failed', { projectName, error: error.message });
        } finally {
            this.activeDeployments.delete(projectName);
            this.clearActiveJob();
        }
    }
}

export const deployerEngine = new DeployerEngine();

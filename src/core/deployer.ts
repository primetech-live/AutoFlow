import fs from 'fs';
import path from 'path';
import os from 'os';
import { EventEmitter } from 'events';
import { loadGlobalConfig, loadProjectConfig } from './config';
import deployProjectCore from '../commands/deploy/index';
import { addLogListener, removeLogListener, LogType } from '../utils/logger';

export interface DeploymentHistoryItem {
    id: string;
    sequence: number;
    timestamp: number;
    duration: number; // in seconds
    status: 'Live' | 'Failed' | 'Rolled Back' | 'Interrupted';
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
        const historyFile = path.join(HISTORY_DIR, `${projectName}.json`);
        const list = this.getHistory(projectName);
        list.unshift(item); // Add to beginning (newest first)
        fs.writeFileSync(historyFile, JSON.stringify(list, null, 2), 'utf-8');
    }

    /**
     * Launches background deployment for a project path
     */
    public async deploy(projectPath: string): Promise<void> {
        const projectConfig = loadProjectConfig(projectPath);
        const projectName = projectConfig.projectName;

        if (this.activeDeployments.has(projectName)) {
            throw new Error(`Deployment already running for project: ${projectName}`);
        }

        const startTime = Date.now();
        const logs: Array<{ timestamp: number; type: LogType; message: string }> = [];
        
        this.activeDeployments.set(projectName, {
            startTime,
            step: 'Prepare',
            logs
        });

        this.markJobActive(projectPath, projectName);
        this.emit('deploy:started', { projectName, startTime });

        // Connect the logger listener
        const logListener = (type: LogType, message: string) => {
            const timestamp = Date.now();
            logs.push({ timestamp, type, message });
            
            // Map console outputs to deploy pipeline steps
            let currentStep = 'Prepare';
            if (message.includes('SSH connected')) currentStep = 'Upload';
            else if (message.includes('Docker image')) currentStep = 'Build';
            else if (message.includes('container health')) currentStep = 'Verify';
            else if (message.includes('COMPLETE')) currentStep = 'Live';

            const active = this.activeDeployments.get(projectName);
            if (active) {
                active.step = currentStep;
            }

            this.emit('deploy:log', { projectName, timestamp, type, message, step: currentStep });
        };

        addLogListener(logListener);

        try {
            // Modify process working directory temporarily
            const originalCwd = process.cwd();
            process.chdir(projectPath);

            // Execute CLI deploy index core logic
            await deployProjectCore();

            process.chdir(originalCwd);

            // Fetch current git revision
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

            // Save success record
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
        } catch (err: any) {
            const duration = Math.round((Date.now() - startTime) / 1000);
            this.saveHistoryItem(projectName, {
                id: `dep-${Date.now()}`,
                sequence: this.getHistory(projectName).length + 1,
                timestamp: Date.now(),
                duration,
                status: 'Failed',
                notes: err.message || 'Deployment error',
                commitSha: 'N/A'
            });

            this.emit('deploy:failed', { projectName, error: err.message });
            throw err;
        } finally {
            removeLogListener(logListener);
            this.activeDeployments.delete(projectName);
            this.clearActiveJob();
        }
    }
}

export const deployerEngine = new DeployerEngine();

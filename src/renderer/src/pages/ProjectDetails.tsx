import React, { useState, useEffect, useRef } from 'react';
import { ScannedProject } from './Dashboard';
import { LoggerConsole, LogLine } from '../components/LoggerConsole';
import {
    DeployIcon,
    RollbackIcon,
    LogsIcon,
    LiveStatusIcon,
    WarningIcon,
    SuccessIcon,
    LockIcon,
    UnlockIcon,
    ServerIcon,
    InfoIcon,
    SyncIcon,
    SettingsIcon,
    CopyIcon
} from '../components/Icons';
import { PasswordInput } from '../components/PasswordInput';

interface ProjectDetailsProps {
    project: ScannedProject;
    initialTab?: 'overview' | 'env' | 'history' | 'logs' | 'monitor';
    onBack: () => void;
    onTriggerDeploy: (path: string, projectName: string) => void;
    activeDeploy: { projectName: string; status: string; step: string; logs: LogLine[] } | null;
    onClearLogs: () => void;
    onRefreshProjects: () => void;
    showConfirm: (opts: { title: string; message: string; confirmLabel?: string; danger?: boolean; onConfirm: () => void }) => void;
}

export const ProjectDetails: React.FC<ProjectDetailsProps> = ({
    project,
    initialTab,
    onBack,
    onTriggerDeploy,
    activeDeploy,
    onClearLogs,
    onRefreshProjects,
    showConfirm
}) => {
    const [activeSubTab, setActiveSubTab] = useState<'overview' | 'env' | 'history' | 'logs' | 'monitor'>('overview');

    // Sync sub tab with initialTab
    useEffect(() => {
        if (initialTab) {
            setActiveSubTab(initialTab);
        } else if (project.isExternal) {
            setActiveSubTab('monitor');
        } else {
            setActiveSubTab('overview');
        }
    }, [initialTab, project.projectName, project.isExternal]);

    // Remote Diagnostics Stats states
    const [remoteStats, setRemoteStats] = useState<any>(null);
    const [hostStats, setHostStats] = useState<any>(null);
    const [monitorLoading, setMonitorLoading] = useState(false);
    const [monitorError, setMonitorError] = useState('');

    // Remote Logs states
    const [remoteLogs, setRemoteLogs] = useState<string>('');
    const [logsLoading, setLogsLoading] = useState(false);
    const [logsError, setLogsError] = useState('');
    const logsContainerRef = useRef<HTMLDivElement>(null);
    const isScrolledToBottom = useRef(true);

    const fetchDiagnostics = async () => {
        setMonitorLoading(true);
        setMonitorError('');
        try {
            const stats = await window.autoflow.fetchServerStats();
            if (stats) {
                setHostStats({
                    cpu: stats.cpu,
                    ram: stats.ram,
                    ramPercent: stats.ramPercent,
                    disk: stats.disk,
                    diskPercent: stats.diskPercent,
                    uptime: stats.uptime,
                    latency: stats.latency
                });
                const containerName = project.containerRawName || project.projectName;
                const cleanName = (n: string) => {
                    if (n.startsWith('[pm2] ')) return n.replace('[pm2] ', '');
                    if (n.startsWith('[systemd] ')) return n.replace('[systemd] ', '').replace('.service', '');
                    return n;
                };
                const container = stats.containers.find((c: any) =>
                    c.name === containerName || cleanName(c.name) === project.projectName
                );
                if (container) {
                    setRemoteStats(container);
                } else {
                    setRemoteStats({
                        name: containerName,
                        status: 'Not Found',
                        cpu: '0%',
                        mem: '0MB'
                    });
                }
            }
        } catch (err: any) {
            setMonitorError(err.message || 'Failed to gather metrics from remote host.');
        } finally {
            setMonitorLoading(false);
        }
    };

    const fetchLiveLogs = async (isBackground = false) => {
        if (!isBackground) setLogsLoading(true);
        if (!isBackground) setLogsError('');
        try {
            const containerName = project.containerRawName || project.projectName;
            const logs = await window.autoflow.fetchRemoteLogs(containerName);
            setRemoteLogs(logs);
        } catch (err: any) {
            if (!isBackground) setLogsError(err.message || 'Failed to fetch container logs.');
        } finally {
            if (!isBackground) setLogsLoading(false);
        }
    };

    useEffect(() => {
        if (activeSubTab === 'monitor') {
            fetchDiagnostics();
        }
    }, [activeSubTab, project.projectName]);

    useEffect(() => {
        if (activeSubTab === 'logs') {
            fetchLiveLogs();
            const interval = setInterval(() => {
                fetchLiveLogs(true);
            }, 3000);
            return () => clearInterval(interval);
        }
    }, [activeSubTab, project.projectName, project.containerRawName]);

    // Auto-scroll logs when new logs arrive
    useEffect(() => {
        if (logsContainerRef.current && isScrolledToBottom.current) {
            logsContainerRef.current.scrollTop = logsContainerRef.current.scrollHeight;
        }
    }, [remoteLogs]);

    // Overview config states
    const [projectName, setProjectName] = useState(project.projectName);
    const [gitRepo, setGitRepo] = useState(project.gitRepo);
    const [branch, setBranch] = useState((project as any).branch || 'main');
    const [domain, setDomain] = useState('');
    const [appType, setAppType] = useState(project.appType || 'node');
    const [strictCI, setStrictCI] = useState(false);

    // Env vars states
    const [envVars, setEnvVars] = useState<Array<{ key: string; value: string; masked: boolean }>>([]);
    const [newKey, setNewKey] = useState('');
    const [newValue, setNewValue] = useState('');
    const [gitPat, setGitPat] = useState('');

    // History state
    const [history, setHistory] = useState<any[]>([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [successMsg, setSuccessMsg] = useState('');
    const [triggeringDeploy, setTriggeringDeploy] = useState(false);

    const isDeployingThis = activeDeploy && activeDeploy.projectName === project.projectName && activeDeploy.status === 'running';

    // Load project configuration details & .env variables
    useEffect(() => {
        if (project.isExternal) return;
        const loadConfig = async () => {
            setError('');
            try {
                const exists = await window.autoflow.projectConfigExists(project.projectPath);
                if (exists) {
                    const config = await window.autoflow.loadProjectConfig(project.projectPath);
                    setProjectName(config.projectName || project.projectName);
                    setGitRepo(config.gitRepo || project.gitRepo);
                    setBranch(config.branch || 'main');
                    setDomain(config.domain || '');
                    setAppType(config.appType || 'node');
                    setStrictCI(!!config.strictCI);
                }
            } catch (err: any) {
                console.error('Failed to load project configuration:', err);
            }
        };

        const loadEnv = async () => {
            try {
                const env = await window.autoflow.loadEnv(project.projectPath);
                const list = Object.entries(env).map(([key, value]) => ({
                    key,
                    value: value as string,
                    masked: true
                }));
                setEnvVars(list);
            } catch (err) {
                console.error('Failed to load .env variables:', err);
            }
        };

        const fetchHistory = async () => {
            try {
                const hist = await window.autoflow.getHistory(project.projectName);
                setHistory(hist);
            } catch (err) {
                console.error('Failed to fetch deployment history:', err);
            }
        };

        loadConfig();
        loadEnv();
        fetchHistory();
    }, [project]);

    const handleSaveConfig = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');
        setSuccessMsg('');
        setLoading(true);

        try {
            if (!project.hasConfig) {
                await window.autoflow.initProject(project.projectPath, {
                    projectName,
                    gitRepo,
                    branch,
                    domain: domain || undefined,
                    strictCI
                });
                setSuccessMsg('Project initialized and configuration saved successfully. You can now deploy!');
            } else {
                await window.autoflow.saveProjectConfig(project.projectPath, {
                    projectName,
                    gitRepo,
                    branch,
                    domain: domain || undefined,
                    appType,
                    deploymentType: appType === 'static' ? 'static' : 'docker',
                    mode: domain ? 'domain' : 'port',
                    strictCI
                });

                if (gitPat.trim()) {
                    await window.autoflow.saveGitPat(projectName, gitPat.trim());
                    setGitPat(''); // clear field after save
                }

                setSuccessMsg('Project configuration saved successfully.');
            }
            onRefreshProjects();
        } catch (err: any) {
            setError(err.message || 'Failed to save project configuration.');
        } finally {
            setLoading(false);
        }
    };

    const handleAddEnv = () => {
        if (!newKey) return;
        setEnvVars(prev => [...prev, { key: newKey.toUpperCase(), value: newValue, masked: true }]);
        setNewKey('');
        setNewValue('');
    };

    const handleRemoveEnv = (key: string) => {
        setEnvVars(prev => prev.filter(item => item.key !== key));
    };

    const handleToggleMask = (key: string) => {
        setEnvVars(prev => prev.map(item => item.key === key ? { ...item, masked: !item.masked } : item));
    };

    const handleSaveEnv = async () => {
        setError('');
        setSuccessMsg('');
        setLoading(true);

        try {
            const envMap: Record<string, string> = {};
            envVars.forEach(item => {
                if (item.key.trim()) {
                    envMap[item.key.trim().toUpperCase()] = item.value;
                }
            });

            const res = await window.autoflow.saveEnv(project.projectPath, envMap);
            if (res.success) {
                setSuccessMsg('Secrets & environment variables saved locally.');
            } else {
                setError(res.error || 'Failed to save environment variables.');
            }
        } catch (err: any) {
            setError(err.message || 'Failed to save environment variables.');
        } finally {
            setLoading(false);
        }
    };

    const handleRollback = (commitSha: string) => {
        showConfirm({
            title: 'Rollback Deployment',
            message: `Roll back to commit ${commitSha}? This will re-deploy that version to your server.`,
            confirmLabel: 'Rollback',
            danger: true,
            onConfirm: async () => {
                try {
                    await window.autoflow.rollbackToDeploy(project.projectPath, commitSha);
                    setSuccessMsg('Rollback triggered. Check the deploy terminal for progress.');
                } catch (err: any) {
                    setError(`Rollback failed: ${err.message}`);
                }
            }
        });
    };

    const handleStopContainer = () => {
        const name = project.containerRawName || project.projectName;
        showConfirm({
            title: 'Stop Container',
            message: `Stop container "${name}"? The service will go offline.`,
            confirmLabel: 'Stop',
            danger: true,
            onConfirm: async () => {
                await window.autoflow.stopContainer(name);
                onRefreshProjects();
            }
        });
    };

    const handleRestartContainer = () => {
        const name = project.containerRawName || project.projectName;
        showConfirm({
            title: 'Restart Container',
            message: `Restart container "${name}"? There will be brief downtime.`,
            confirmLabel: 'Restart',
            onConfirm: async () => {
                await window.autoflow.restartContainer(name);
                onRefreshProjects();
            }
        });
    };

    const handleDeleteContainer = () => {
        const name = project.containerRawName || project.projectName;
        showConfirm({
            title: 'Delete Container',
            message: `Permanently delete container "${name}"? This cannot be undone and will cause downtime.`,
            confirmLabel: 'Delete',
            danger: true,
            onConfirm: async () => {
                await window.autoflow.deleteContainer(name);
                onRefreshProjects();
                onBack(); // Go back to dashboard if deleted
            }
        });
    };

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', flex: 1, overflowY: 'auto' }}>

            {/* Header section */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--border-color)', paddingBottom: '16px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                    <button onClick={onBack} className="btn btn-secondary" style={{ padding: '6px 12px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                        ← Back
                    </button>
                    <div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <h1 className="h1" style={{ margin: 0 }}>{project.projectName}</h1>
                            {project.isExternal && (
                                <span style={{
                                    fontSize: '10px',
                                    fontWeight: 700,
                                    letterSpacing: '0.05em',
                                    textTransform: 'uppercase',
                                    background: 'rgba(59, 130, 246, 0.1)',
                                    padding: '3px 8px',
                                    borderRadius: '4px',
                                    color: '#3b82f6'
                                }}>
                                    VPS Live-only
                                </span>
                            )}
                        </div>
                        <span className="text-secondary" style={{ fontSize: '12px' }}>
                            {project.isExternal ? `Remote Container: ${project.containerRawName || project.projectName}` : `Path: ${project.projectPath}`}
                        </span>
                    </div>
                </div>

                <div style={{ display: 'flex', gap: '10px' }}>
                    {(project.status === 'Live' || project.status === 'Stopped') && (
                        <>
                            {project.status === 'Stopped' ? (
                                <button
                                    onClick={handleRestartContainer}
                                    className="btn btn-secondary"
                                    style={{ padding: '10px 16px', display: 'flex', alignItems: 'center', gap: '6px', color: 'var(--accent)', borderColor: 'var(--accent)' }}
                                >
                                    Start
                                </button>
                            ) : (
                                <button
                                    onClick={handleStopContainer}
                                    className="btn btn-secondary"
                                    style={{ padding: '10px 16px', display: 'flex', alignItems: 'center', gap: '6px' }}
                                >
                                    Stop
                                </button>
                            )}

                            <button
                                onClick={handleRestartContainer}
                                className="btn btn-secondary"
                                style={{ padding: '10px 16px', display: 'flex', alignItems: 'center', gap: '6px' }}
                            >
                                Restart
                            </button>

                            <button
                                onClick={handleDeleteContainer}
                                className="btn btn-danger"
                                style={{ padding: '10px 16px', display: 'flex', alignItems: 'center', gap: '6px' }}
                            >
                                Delete
                            </button>
                        </>
                    )}

                    {!project.isExternal && (
                        <button
                            onClick={async () => {
                                setTriggeringDeploy(true);
                                try {
                                    await onTriggerDeploy(project.projectPath, project.projectName);
                                } finally {
                                    setTriggeringDeploy(false);
                                }
                            }}
                            disabled={isDeployingThis || triggeringDeploy || !project.hasConfig}
                            className={`btn ${!project.hasConfig ? 'btn-secondary' : 'btn-primary'}`}
                            style={{ padding: '10px 20px', display: 'flex', alignItems: 'center', gap: '6px' }}
                        >
                            {(isDeployingThis || triggeringDeploy) ? (
                                <div style={{
                                    width: '14px', height: '14px',
                                    border: '2px solid rgba(255,255,255,0.3)',
                                    borderTop: '2px solid white',
                                    borderRadius: '50%',
                                    animation: 'spin 1s linear infinite'
                                }} />
                            ) : (
                                <DeployIcon size={14} />
                            )}
                            {!project.hasConfig
                                ? 'Initialize Project First'
                                : (isDeployingThis || triggeringDeploy) ? 'Deploying...' : 'Deploy Now'}
                        </button>
                    )}
                </div>
            </div>

            {error && (
                <div style={{ background: 'var(--error-glow)', border: '1px solid rgba(239, 68, 68, 0.2)', color: 'var(--error)', padding: '10px 14px', borderRadius: '6px', fontSize: '13px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <WarningIcon size={14} /> {error}
                </div>
            )}

            {successMsg && (
                <div style={{ background: 'var(--accent-glow)', border: '1px solid rgba(16, 185, 129, 0.2)', color: 'var(--accent)', padding: '10px 14px', borderRadius: '6px', fontSize: '13px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <SuccessIcon size={14} /> {successMsg}
                </div>
            )}

            {/* Sub Tabs Toggle */}
            <div style={{ display: 'flex', borderBottom: '1px solid var(--border-color)', gap: '4px' }}>
                {!project.isExternal && (
                    <>
                        <button
                            onClick={() => { setActiveSubTab('overview'); setError(''); setSuccessMsg(''); }}
                            className={`btn ${activeSubTab === 'overview' ? 'btn-primary' : 'btn-secondary'}`}
                            style={{ borderRadius: '6px 6px 0 0', borderBottom: 'none', padding: '10px 20px', display: 'flex', alignItems: 'center', gap: '6px' }}
                        >
                            <SettingsIcon size={14} /> Overview Config
                        </button>

                        <button
                            onClick={() => { setActiveSubTab('env'); setError(''); setSuccessMsg(''); }}
                            className={`btn ${activeSubTab === 'env' ? 'btn-primary' : 'btn-secondary'}`}
                            style={{ borderRadius: '6px 6px 0 0', borderBottom: 'none', padding: '10px 20px', display: 'flex', alignItems: 'center', gap: '6px' }}
                        >
                            <LockIcon size={14} /> Environment Secrets
                        </button>

                        <button
                            onClick={() => { setActiveSubTab('history'); setError(''); setSuccessMsg(''); }}
                            className={`btn ${activeSubTab === 'history' ? 'btn-primary' : 'btn-secondary'}`}
                            style={{ borderRadius: '6px 6px 0 0', borderBottom: 'none', padding: '10px 20px', display: 'flex', alignItems: 'center', gap: '6px' }}
                        >
                            <RollbackIcon size={14} /> Deploy Timeline
                        </button>
                    </>
                )}

                <button
                    onClick={() => { setActiveSubTab('logs'); setError(''); setSuccessMsg(''); }}
                    className={`btn ${activeSubTab === 'logs' ? 'btn-primary' : 'btn-secondary'}`}
                    style={{ borderRadius: '6px 6px 0 0', borderBottom: 'none', padding: '10px 20px', display: 'flex', alignItems: 'center', gap: '6px' }}
                >
                    <LogsIcon size={14} /> Live Logs
                </button>

                <button
                    onClick={() => { setActiveSubTab('monitor'); setError(''); setSuccessMsg(''); }}
                    className={`btn ${activeSubTab === 'monitor' ? 'btn-primary' : 'btn-secondary'}`}
                    style={{ borderRadius: '6px 6px 0 0', borderBottom: 'none', padding: '10px 20px', display: 'flex', alignItems: 'center', gap: '6px' }}
                >
                    <LiveStatusIcon size={14} /> Diagnostics
                </button>
            </div>

            {/* Sub Tab contents */}
            <div style={{ flex: 1, minHeight: '300px' }}>

                {/* 1. Overview config */}
                {activeSubTab === 'overview' && !project.isExternal && (
                    <div style={{ display: 'flex', gap: '24px', alignItems: 'flex-start' }}>
                        <form onSubmit={handleSaveConfig} style={{
                            background: 'var(--bg-panel)',
                            border: '1px solid var(--border-color)',
                            borderRadius: '8px',
                            padding: '24px',
                            width: '650px',
                            flexShrink: 0,
                            display: 'flex',
                            flexDirection: 'column',
                            gap: '16px'
                        }}>
                            <h3 className="h2" style={{ fontSize: '15px' }}>Project Settings</h3>

                            <div className="form-group">
                                <label className="form-label">Project Name</label>
                                <input
                                    type="text"
                                    required
                                    className="input"
                                    value={projectName}
                                    onChange={(e) => setProjectName(e.target.value)}
                                />
                            </div>

                            <div className="form-group">
                                <label className="form-label">Git Remote URL</label>
                                <input
                                    type="text"
                                    required
                                    placeholder="git@github.com:username/repo.git"
                                    className="input"
                                    value={gitRepo}
                                    onChange={(e) => setGitRepo(e.target.value)}
                                />
                            </div>

                            <div className="form-group">
                                <label className="form-label">Git Branch</label>
                                <input
                                    type="text"
                                    required
                                    placeholder="main"
                                    className="input"
                                    value={branch}
                                    onChange={(e) => setBranch(e.target.value)}
                                />
                            </div>

                            {gitRepo && (
                                <div className="form-group">
                                    <label className="form-label">Git Token (PAT - For Private Repos)</label>
                                    <PasswordInput
                                        placeholder="Leave empty to keep existing token"
                                        value={gitPat}
                                        onChange={(e) => setGitPat(e.target.value)}
                                    />
                                </div>
                            )}

                            <div className="form-group">
                                <label className="form-label">Domain configuration (Nginx Reverse Proxy)</label>
                                <input
                                    type="text"
                                    placeholder="my-app.example.com (leave blank for Host Port access)"
                                    className="input"
                                    value={domain}
                                    onChange={(e) => setDomain(e.target.value)}
                                />
                            </div>

                            <div style={{ display: 'flex', gap: '20px' }}>
                                <div className="form-group" style={{ flex: 1 }}>
                                    <label className="form-label">App Stack Type</label>
                                    <select
                                        className="input"
                                        value={appType}
                                        onChange={(e) => setAppType(e.target.value)}
                                    >
                                        <option value="node">Node.js App (Next.js, Express)</option>
                                        <option value="static">Static Frontend (HTML, React Build)</option>
                                        <option value="python">Python API (FastAPI)</option>
                                        <option value="django">Python Django</option>
                                        <option value="flask">Python Flask</option>
                                        <option value="go">Go Executable</option>
                                        <option value="java">Java / Spring Boot</option>
                                        <option value="rails">Ruby on Rails</option>
                                        <option value="ruby">Ruby App</option>
                                        <option value="php">PHP App (Pure PHP, Laravel)</option>
                                        <option value="vue">Vue.js</option>
                                        <option value="nuxt">Nuxt.js</option>
                                        <option value="react">React.js</option>
                                        <option value="angular">Angular</option>
                                    </select>
                                </div>

                                <div className="form-group" style={{ flex: 1, justifyContent: 'center' }}>
                                    <label className="form-label" style={{ display: 'flex', alignItems: 'center', gap: '10px', marginTop: '20px', cursor: 'pointer' }}>
                                        <input
                                            type="checkbox"
                                            checked={strictCI}
                                            onChange={(e) => setStrictCI(e.target.checked)}
                                            style={{ width: '16px', height: '16px', accentColor: 'var(--accent)' }}
                                        />
                                        <span>Enable Strict CI checks</span>
                                    </label>
                                </div>
                            </div>

                            <button
                                type="submit"
                                disabled={loading}
                                className="btn btn-primary"
                                style={{ alignSelf: 'flex-start', marginTop: '10px', padding: '10px 24px' }}
                            >
                                {loading ? 'Saving config...' : 'Save Configuration'}
                            </button>
                        </form>

                        {/* Live Preview Side Panel */}
                        {domain && (
                            <div style={{
                                flex: 1,
                                background: 'var(--bg-panel)',
                                border: '1px solid var(--border-color)',
                                borderRadius: '8px',
                                overflow: 'hidden',
                                display: 'flex',
                                flexDirection: 'column',
                                minHeight: '400px',
                                height: '100%',
                                alignSelf: 'stretch'
                            }}>
                                <div style={{
                                    padding: '12px 16px',
                                    borderBottom: '1px solid var(--border-color)',
                                    display: 'flex',
                                    justifyContent: 'space-between',
                                    alignItems: 'center',
                                    background: 'rgba(0,0,0,0.2)'
                                }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                        <span style={{ width: 8, height: 8, borderRadius: '50%', background: project.status === 'Live' ? 'var(--accent)' : 'var(--text-muted)' }} />
                                        <span style={{ fontSize: '13px', fontWeight: 600 }}>Live Preview</span>
                                    </div>
                                    <a href={`http://${domain}`} target="_blank" rel="noreferrer" style={{ fontSize: '11px', color: 'var(--accent)', textDecoration: 'none' }}>Open in Browser ↗</a>
                                </div>
                                <div style={{ flex: 1, background: '#fff', position: 'relative', overflow: 'hidden' }}>
                                    {project.status === 'Live' ? (
                                        <iframe
                                            src={`http://${domain}`}
                                            title="Live Preview"
                                        style={{
                                                width: '275%',
                                                height: '275%',
                                                border: 'none',
                                                position: 'absolute',
                                                top: 0,
                                                left: 0,
                                                transform: 'scale(0.3636)',
                                                transformOrigin: '0 0'
                                            }}
                                        />
                                    ) : (
                                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: '#666', flexDirection: 'column', gap: '10px' }}>
                                            <div style={{ fontSize: '24px' }}>🛑</div>
                                            <div style={{ fontSize: '13px' }}>Container is offline. Deploy or Start to see preview.</div>
                                        </div>
                                    )}
                                </div>
                            </div>
                        )}
                    </div>
                )}

                {/* 2. Environment Secrets */}
                {activeSubTab === 'env' && !project.isExternal && (
                    <div style={{
                        background: 'var(--bg-panel)',
                        border: '1px solid var(--border-color)',
                        borderRadius: '8px',
                        padding: '24px',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '20px'
                    }}>
                        <div>
                            <h3 className="h2" style={{ fontSize: '15px', marginBottom: '4px' }}>Secrets Grid</h3>
                            <span className="text-secondary" style={{ fontSize: '12px' }}>
                                Encrypted .env credentials, synced securely to VPS container memory during deployments.
                            </span>
                        </div>

                        {/* Env Grid Table */}
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', maxHeight: '350px', overflowY: 'auto' }}>
                            {envVars.length === 0 ? (
                                <div className="text-muted" style={{ padding: '20px', textAlign: 'center', border: '1px dashed var(--border-color)', borderRadius: '6px', fontSize: '12.5px' }}>
                                    No environment variables defined yet. Add keys below.
                                </div>
                            ) : (
                                envVars.map((item, idx) => (
                                    <div key={idx} style={{
                                        display: 'flex',
                                        gap: '12px',
                                        alignItems: 'center',
                                        background: 'var(--bg-main)',
                                        padding: '8px 12px',
                                        borderRadius: '6px',
                                        border: '1px solid var(--border-color)'
                                    }}>
                                        <span style={{ fontFamily: 'monospace', fontWeight: 600, color: 'var(--accent)', minWidth: '180px' }}>
                                            {item.key}
                                        </span>

                                        <input
                                            type={item.masked ? 'password' : 'text'}
                                            className="input"
                                            value={item.value}
                                            onChange={(e) => {
                                                const val = e.target.value;
                                                setEnvVars(prev => prev.map(ev => ev.key === item.key ? { ...ev, value: val } : ev));
                                            }}
                                            style={{ flex: 1, padding: '4px 10px', fontSize: '12.5px', background: 'transparent', border: 'none', color: 'var(--text-primary)' }}
                                        />

                                        <button
                                            type="button"
                                            onClick={() => handleToggleMask(item.key)}
                                            className="btn btn-secondary"
                                            style={{ padding: '4px 8px', fontSize: '11px', display: 'flex', alignItems: 'center', gap: '4px' }}
                                        >
                                            {item.masked ? <UnlockIcon size={10} /> : <LockIcon size={10} />}
                                            {item.masked ? 'Show' : 'Hide'}
                                        </button>

                                        <button
                                            type="button"
                                            onClick={() => {
                                                navigator.clipboard.writeText(item.value);
                                                setSuccessMsg('Secret copied to clipboard');
                                                setTimeout(() => setSuccessMsg(''), 3000);
                                            }}
                                            className="btn btn-secondary"
                                            style={{ padding: '4px 8px', fontSize: '11px', display: 'flex', alignItems: 'center', gap: '4px' }}
                                        >
                                            <CopyIcon size={10} /> Copy
                                        </button>

                                        <button
                                            type="button"
                                            onClick={() => handleRemoveEnv(item.key)}
                                            className="btn btn-secondary"
                                            style={{ padding: '4px 8px', fontSize: '11px', color: 'var(--error)', borderColor: 'rgba(239,68,68,0.2)' }}
                                        >
                                            Remove
                                        </button>
                                    </div>
                                ))
                            )}
                        </div>

                        {/* Add Row Form */}
                        <div style={{
                            display: 'flex',
                            gap: '12px',
                            background: 'var(--bg-main)',
                            padding: '16px',
                            borderRadius: '8px',
                            border: '1px solid var(--border-color)',
                            alignItems: 'flex-end',
                            marginTop: '12px'
                        }}>
                            <div className="form-group" style={{ flex: 1, marginBottom: 0 }}>
                                <label className="form-label">New Secret Key</label>
                                <input
                                    type="text"
                                    placeholder="DATABASE_URL"
                                    className="input"
                                    value={newKey}
                                    onChange={(e) => setNewKey(e.target.value)}
                                    style={{ padding: '6px 12px', fontSize: '13px' }}
                                />
                            </div>

                            <div className="form-group" style={{ flex: 2, marginBottom: 0 }}>
                                <label className="form-label">Secret Value</label>
                                <input
                                    type="text"
                                    placeholder="postgresql://root:secret@127.0.0.1:5432/db"
                                    className="input"
                                    value={newValue}
                                    onChange={(e) => setNewValue(e.target.value)}
                                    style={{ padding: '6px 12px', fontSize: '13px' }}
                                />
                            </div>

                            <button
                                type="button"
                                onClick={handleAddEnv}
                                className="btn btn-secondary"
                                style={{ padding: '8px 16px' }}
                            >
                                + Add Secret
                            </button>
                        </div>

                        <button
                            type="button"
                            disabled={loading}
                            onClick={handleSaveEnv}
                            className="btn btn-primary"
                            style={{ alignSelf: 'flex-start', marginTop: '10px', padding: '10px 24px' }}
                        >
                            {loading ? 'Encrypting & Saving...' : 'Save Secrets File'}
                        </button>
                    </div>
                )}

                {/* 3. Deploy History / Timeline */}
                {activeSubTab === 'history' && !project.isExternal && (
                    <div style={{
                        background: 'var(--bg-panel)',
                        border: '1px solid var(--border-color)',
                        borderRadius: '8px',
                        padding: '24px',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '20px'
                    }}>
                        <h3 className="h2" style={{ fontSize: '15px' }}>Git-Graph Deployment Pipeline</h3>

                        {history.length === 0 ? (
                            <div className="text-muted" style={{ padding: '24px', textAlign: 'center', border: '1px dashed var(--border-color)', borderRadius: '6px' }}>
                                No history records found for this project. Trigger a deploy to record logs.
                            </div>
                        ) : (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '2px', position: 'relative', paddingLeft: '24px' }}>
                                {/* Timeline vertical line */}
                                <div style={{
                                    position: 'absolute',
                                    left: '9px',
                                    top: '12px',
                                    bottom: '12px',
                                    width: '2px',
                                    background: 'var(--border-color)'
                                }} />

                                {history.map((item, idx) => {
                                    // Restorable only if it's Live status AND in the last 3 deployments
                                    const successfulDeploys = history.filter(h => h.status === 'Live');
                                    const rollbackIndex = successfulDeploys.findIndex(d => d.id === item.id);
                                    const canRollback = item.status === 'Live' && rollbackIndex >= 0 && rollbackIndex < 3 && item.commitSha !== 'Unknown';

                                    return (
                                        <div key={item.id} style={{
                                            position: 'relative',
                                            marginBottom: '16px',
                                            display: 'flex',
                                            justifyContent: 'space-between',
                                            alignItems: 'center',
                                            padding: '12px 16px',
                                            background: 'var(--bg-main)',
                                            border: '1px solid var(--border-color)',
                                            borderRadius: '6px'
                                        }}>
                                            {/* Node dot */}
                                            <div style={{
                                                position: 'absolute',
                                                left: '-20px',
                                                top: '50%',
                                                transform: 'translateY(-50%)',
                                                width: '10px',
                                                height: '10px',
                                                borderRadius: '50%',
                                                background: item.status === 'Live' ? 'var(--accent)' : 'var(--error)',
                                                border: '2px solid var(--bg-panel)'
                                            }} />

                                            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                                                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                                    <span style={{ fontWeight: 700, fontSize: '13.5px', color: 'var(--text-primary)' }}>
                                                        Deploy #{item.sequence}
                                                    </span>
                                                    <span style={{
                                                        fontSize: '9px',
                                                        fontWeight: 700,
                                                        background: item.status === 'Live' ? 'rgba(16, 185, 129, 0.1)' : 'rgba(239, 68, 68, 0.1)',
                                                        color: item.status === 'Live' ? 'var(--accent)' : 'var(--error)',
                                                        padding: '1px 6px',
                                                        borderRadius: '3px',
                                                        textTransform: 'uppercase'
                                                    }}>{item.status}</span>

                                                    {item.commitSha && item.commitSha !== 'Unknown' && (
                                                        <span style={{ fontFamily: 'monospace', fontSize: '11px', color: 'var(--text-secondary)' }}>
                                                            ({item.commitSha})
                                                        </span>
                                                    )}
                                                </div>

                                                <div className="text-secondary" style={{ fontSize: '11.5px' }}>
                                                    {item.notes || 'No description'}
                                                </div>

                                                <div className="text-muted" style={{ fontSize: '10.5px' }}>
                                                    {new Date(item.timestamp).toLocaleString()} • Duration: {item.duration}s
                                                </div>
                                            </div>

                                            {canRollback && (
                                                <button
                                                    onClick={() => handleRollback(item.commitSha)}
                                                    className="btn btn-secondary"
                                                    style={{ padding: '4px 10px', fontSize: '11px', border: '1px solid rgba(16, 185, 129, 0.3)', color: 'var(--accent)' }}
                                                >
                                                    ↩ Rollback & Restore
                                                </button>
                                            )}
                                        </div>
                                    );
                                })}
                            </div>
                        )}
                    </div>
                )}

                {/* 4. Live Logs */}
                {activeSubTab === 'logs' && (
                    <div style={{
                        background: 'var(--bg-panel)',
                        border: '1px solid var(--border-color)',
                        borderRadius: '8px',
                        padding: '24px',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '20px'
                    }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <div>
                                <h3 className="h2" style={{ fontSize: '15px', marginBottom: '4px' }}>Remote Container Logs</h3>
                                <span className="text-secondary" style={{ fontSize: '12px' }}>
                                    Showing last 100 stdout/stderr streams from remote VPS container.
                                </span>
                            </div>
                            <button
                                type="button"
                                onClick={() => fetchLiveLogs(false)}
                                disabled={logsLoading}
                                className="btn btn-secondary"
                                style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '6px 12px', fontSize: '12px' }}
                            >
                                <SyncIcon size={12} /> {logsLoading ? 'Fetching...' : 'Refresh Logs'}
                            </button>
                        </div>

                        {logsError && (
                            <div style={{ background: 'var(--error-glow)', border: '1px solid rgba(239, 68, 68, 0.2)', color: 'var(--error)', padding: '10px 14px', borderRadius: '6px', fontSize: '13px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                                <WarningIcon size={14} /> {logsError}
                            </div>
                        )}

                        <div 
                            ref={logsContainerRef}
                            onScroll={(e) => {
                                const target = e.target as HTMLDivElement;
                                isScrolledToBottom.current = Math.abs(target.scrollHeight - target.scrollTop - target.clientHeight) < 10;
                            }}
                            style={{
                            background: '#0B0B0D',
                            border: '1px solid var(--border-color)',
                            borderRadius: '6px',
                            padding: '16px',
                            minHeight: '280px',
                            maxHeight: '450px',
                            overflowY: 'auto',
                            fontFamily: 'monospace',
                            fontSize: '12px',
                            lineHeight: '1.5',
                            color: '#e2e8f0',
                            whiteSpace: 'pre-wrap',
                            wordBreak: 'break-all'
                        }}>
                            {logsLoading && !remoteLogs ? (
                                <div style={{ display: 'flex', height: '100%', alignItems: 'center', justifyContent: 'center', color: 'var(--text-secondary)' }}>
                                    Loading logs from SSH host...
                                </div>
                            ) : remoteLogs ? (
                                remoteLogs
                            ) : (
                                <div style={{ display: 'flex', height: '100%', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)' }}>
                                    No container logs found or container is not running.
                                </div>
                            )}
                        </div>
                    </div>
                )}

                {/* 5. Diagnostics / Monitor */}
                {activeSubTab === 'monitor' && (
                    <div style={{
                        background: 'var(--bg-panel)',
                        border: '1px solid var(--border-color)',
                        borderRadius: '8px',
                        padding: '24px',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '20px'
                    }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <div>
                                <h3 className="h2" style={{ fontSize: '15px', marginBottom: '4px' }}>Remote Host & Process Diagnostics</h3>
                                <span className="text-secondary" style={{ fontSize: '12px' }}>
                                    Polled live resource utilization statistics via SSH.
                                </span>
                            </div>
                            <button
                                type="button"
                                onClick={fetchDiagnostics}
                                disabled={monitorLoading}
                                className="btn btn-secondary"
                                style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '6px 12px', fontSize: '12px' }}
                            >
                                <SyncIcon size={12} /> {monitorLoading ? 'Polled...' : 'Refresh Metrics'}
                            </button>
                        </div>

                        {monitorError && (
                            <div style={{ background: 'var(--error-glow)', border: '1px solid rgba(239, 68, 68, 0.2)', color: 'var(--error)', padding: '10px 14px', borderRadius: '6px', fontSize: '13px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                                <WarningIcon size={14} /> {monitorError}
                            </div>
                        )}

                        {monitorLoading && !hostStats ? (
                            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '40px', gap: '12px', border: '1px dashed var(--border-color)', borderRadius: '6px' }}>
                                <div style={{
                                    border: '2px solid var(--border-color)',
                                    borderTop: '2px solid var(--accent)',
                                    borderRadius: '50%',
                                    width: '24px',
                                    height: '24px',
                                    animation: 'spin 1s linear infinite'
                                }} />
                                <span className="text-secondary" style={{ fontSize: '12.5px' }}>Fetching remote status...</span>
                            </div>
                        ) : (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
                                {hostStats && (
                                    <div>
                                        <h4 style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '12px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Host System Stats</h4>
                                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '16px' }}>
                                            <div className="card" style={{ background: 'var(--bg-main)', padding: '12px 16px' }}>
                                                <span className="text-secondary" style={{ fontSize: '10px', textTransform: 'uppercase' }}>CPU Load</span>
                                                <div style={{ fontSize: '20px', fontWeight: 700, margin: '6px 0', color: 'var(--text-primary)' }}>{hostStats.cpu}</div>
                                                <div style={{ height: '4px', background: 'var(--border-color)', borderRadius: '2px', overflow: 'hidden' }}>
                                                    <div style={{ height: '100%', width: hostStats.cpu, background: 'var(--accent)' }} />
                                                </div>
                                            </div>
                                            <div className="card" style={{ background: 'var(--bg-main)', padding: '12px 16px' }}>
                                                <span className="text-secondary" style={{ fontSize: '10px', textTransform: 'uppercase' }}>RAM Usage</span>
                                                <div style={{ fontSize: '20px', fontWeight: 700, margin: '6px 0', color: 'var(--text-primary)' }}>{hostStats.ram}</div>
                                                <div style={{ height: '4px', background: 'var(--border-color)', borderRadius: '2px', overflow: 'hidden' }}>
                                                    <div style={{ height: '100%', width: `${hostStats.ramPercent}%`, background: 'var(--accent)' }} />
                                                </div>
                                            </div>
                                            <div className="card" style={{ background: 'var(--bg-main)', padding: '12px 16px' }}>
                                                <span className="text-secondary" style={{ fontSize: '10px', textTransform: 'uppercase' }}>Disk Space</span>
                                                <div style={{ fontSize: '20px', fontWeight: 700, margin: '6px 0', color: 'var(--text-primary)' }}>{hostStats.disk}</div>
                                                <div style={{ height: '4px', background: 'var(--border-color)', borderRadius: '2px', overflow: 'hidden' }}>
                                                    <div style={{ height: '100%', width: `${hostStats.diskPercent}%`, background: 'var(--accent)' }} />
                                                </div>
                                            </div>
                                            <div className="card" style={{ background: 'var(--bg-main)', padding: '12px 16px' }}>
                                                <span className="text-secondary" style={{ fontSize: '10px', textTransform: 'uppercase' }}>Ping Latency</span>
                                                <div style={{ fontSize: '20px', fontWeight: 700, margin: '6px 0', color: 'var(--info)' }}>{hostStats.latency}</div>
                                                <span style={{ fontSize: '10px', color: 'var(--text-muted)' }}>Uptime: {hostStats.uptime}</span>
                                            </div>
                                        </div>
                                    </div>
                                )}

                                {remoteStats && (
                                    <div>
                                        <h4 style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '12px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Process Container Diagnostics</h4>
                                        <div style={{
                                            background: 'var(--bg-main)',
                                            border: '1px solid var(--border-color)',
                                            borderRadius: '6px',
                                            padding: '16px',
                                            display: 'flex',
                                            flexDirection: 'column',
                                            gap: '12px'
                                        }}>
                                            <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid var(--border-color)', paddingBottom: '8px' }}>
                                                <span style={{ fontWeight: 600, color: 'var(--text-primary)', fontFamily: 'monospace' }}>{remoteStats.name}</span>
                                                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                                    <span style={{
                                                        width: '8px',
                                                        height: '8px',
                                                        borderRadius: '50%',
                                                        background: remoteStats.status.toLowerCase().includes('up') || remoteStats.status.toLowerCase() === 'online' || remoteStats.status.toLowerCase() === 'running' ? 'var(--accent)' : 'var(--error)'
                                                    }} />
                                                    <span style={{ fontSize: '12px', fontWeight: 600 }}>{remoteStats.status}</span>
                                                </div>
                                            </div>
                                            <div style={{ display: 'flex', gap: '40px' }}>
                                                <div>
                                                    <span className="text-muted" style={{ fontSize: '11px' }}>CONTAINER CPU</span>
                                                    <div style={{ fontSize: '16px', fontWeight: 700, fontFamily: 'monospace', color: 'var(--text-primary)' }}>{remoteStats.cpu}</div>
                                                </div>
                                                <div>
                                                    <span className="text-muted" style={{ fontSize: '11px' }}>CONTAINER RAM</span>
                                                    <div style={{ fontSize: '16px', fontWeight: 700, fontFamily: 'monospace', color: 'var(--text-primary)' }}>{remoteStats.mem}</div>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                )}

            </div>

            {/* Logger Display Console bottom section */}
            {isDeployingThis && activeDeploy && (
                <div style={{ marginTop: '12px' }}>
                    <LoggerConsole
                        logs={activeDeploy.logs}
                        onClear={onClearLogs}
                        projectName={project.projectName}
                    />
                </div>
            )}

        </div>
    );
};

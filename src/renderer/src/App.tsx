import React, { useState, useEffect, useMemo } from 'react';
import { Titlebar } from './components/Titlebar';
import { DeployProgressModal } from './components/DeployProgressModal';
import { ConfirmModal } from './components/ConfirmModal';
import { Onboarding } from './pages/Onboarding';
import { LockScreen } from './pages/LockScreen';
import { Dashboard, ScannedProject } from './pages/Dashboard';
import { ProjectDetails } from './pages/ProjectDetails';
import { LiveStatus } from './pages/LiveStatus';
import { Settings } from './pages/Settings';
import { LogLine } from './components/LoggerConsole';
import { DashboardIcon, LiveStatusIcon, SettingsIcon, WarningIcon } from './components/Icons';
import { InitProjectModal } from './components/InitProjectModal';

declare global {
    interface Window {
        autoflow: any;
    }
}

interface ActiveDeploy {
    projectName: string;
    status: 'running' | 'success' | 'failed';
    step: string;
    logs: LogLine[];
}

const App: React.FC = () => {
    const [isConfigured, setIsConfigured] = useState<boolean | null>(null);
    const [isVaultCreated, setIsVaultCreated] = useState<boolean | null>(null);
    const [isUnlocked, setIsUnlocked] = useState<boolean>(false);
    
    // Page state
    const [activePage, setActivePage] = useState<'dashboard' | 'livestatus' | 'settings' | 'project-details'>('dashboard');
    const [connectionState, setConnectionState] = useState<string>('Disconnected');
    const [selectedProject, setSelectedProject] = useState<ScannedProject | null>(null);
    const [detailTab, setDetailTab] = useState<'overview' | 'env' | 'history' | 'logs' | 'monitor'>('overview');
    
    const [projects, setProjects] = useState<ScannedProject[]>([]);
    const [vpsContainers, setVpsContainers] = useState<any[]>([]);
    const [vpsLoading, setVpsLoading] = useState<boolean>(false);
    
    // Global Server Stats
    const [serverStats, setServerStats] = useState<any>(null);
    const [statsLoading, setStatsLoading] = useState<boolean>(true);
    const [statsError, setStatsError] = useState<string>('');

    const cleanContainerName = (name: string): string => {
        if (name.startsWith('[pm2] ')) return name.replace('[pm2] ', '');
        if (name.startsWith('[systemd] ')) return name.replace('[systemd] ', '').replace('.service', '');
        return name;
    };
    
    // Active deployment tracker
    const [activeDeploy, setActiveDeploy] = useState<ActiveDeploy | null>(null);
    
    // Interrupted job recovery state
    const [interruptedJob, setInterruptedJob] = useState<any | null>(null);
    
    // Application Loading
    const [appLoading, setAppLoading] = useState(true);

    // Project Initialization Modal State
    const [showInitModal, setShowInitModal] = useState<boolean>(false);
    const [initProjectPath, setInitProjectPath] = useState<string>('');

    // Custom confirm modal state
    const [confirmModal, setConfirmModal] = useState<{
        title: string;
        message: string;
        confirmLabel?: string;
        danger?: boolean;
        onConfirm: () => void;
    } | null>(null);

    const showConfirm = (opts: typeof confirmModal) => setConfirmModal(opts);
    const checkState = async () => {
        try {
            const hasConfig = await window.autoflow.globalConfigExists();
            const hasVault = await window.autoflow.isVaultSetup();
            const unlocked = await window.autoflow.isVaultUnlocked();

            setIsConfigured(hasConfig);
            setIsVaultCreated(hasVault);
            setIsUnlocked(unlocked);

            if (hasConfig && hasVault && unlocked) {
                await loadProjects();
                const crashed = await window.autoflow.checkInterruptedJob();
                if (crashed) {
                    setInterruptedJob(crashed);
                }
            }
        } catch (err) {
            console.error('Failed to initialize state:', err);
        } finally {
            setAppLoading(false);
        }
    };

    const loadProjects = async () => {
        try {
            const list = await window.autoflow.getSavedProjects();
            setProjects(list.map((p: any) => ({ ...p, status: p.status || 'Idle' })));
        } catch (err) {
            console.error('Failed to load projects:', err);
        }
    };

    const fetchGlobalStats = async (isBackground = false) => {
        if (!isBackground) setStatsLoading(true);
        if (!isBackground) setStatsError('');
        try {
            const stats = await window.autoflow.fetchServerStats();
            if (stats && stats.containers) {
                setServerStats(stats);
                setVpsContainers(stats.containers);
                
                window.autoflow.getSavedProjects().then((list: any[]) => {
                    setProjects(list.map((p: any) => {
                        const match = stats.containers.find((c: any) => cleanContainerName(c.name) === p.projectName);
                        let newStatus = 'Idle';
                        if (match) {
                            if (match.status.toLowerCase().includes('exited') || match.status.toLowerCase().includes('created')) {
                                newStatus = 'Stopped';
                            } else {
                                newStatus = 'Live';
                            }
                            // Auto-verify and prune duplicates from other server IPs in background
                            if (p.migrated) {
                                window.autoflow.addProject(p.projectPath).then(() => {
                                    loadProjects();
                                });
                            }
                        }
                        return {
                            ...p,
                            status: newStatus,
                            containerRawName: match ? match.name : p.projectName
                        };
                    }));
                    
                    const unmatchedLiveNames = stats.containers
                        .map((c: any) => cleanContainerName(c.name))
                        .filter((name: string) => !list.some((p: any) => p.projectName === name));

                    if (unmatchedLiveNames.length > 0) {
                        window.autoflow.scanGlobal();
                    }
                });
            }
        } catch (err: any) {
            if (!isBackground) {
                setStatsError(err.message || 'Failed to gather remote server statistics. Ensure server config is valid and online.');
            }
        } finally {
            if (!isBackground) setStatsLoading(false);
            setVpsLoading(false);
        }
    };

    // Compute live-only/external projects dynamically
    const liveOnlyProjects = useMemo(() => {
        return vpsContainers
            .filter(c => {
                // Hide system OS and PM2 services from Dashboard project cards to avoid visual glitch
                if (c.name.startsWith('[systemd] ') || c.name.startsWith('[pm2] ')) return false;

                const cleanName = cleanContainerName(c.name);
                return !projects.some(p => p.projectName === cleanName);
            })
            .map(c => {
                const isStopped = c.status.toLowerCase().includes('exited') || c.status.toLowerCase().includes('created');
                return {
                    projectName: cleanContainerName(c.name),
                    projectPath: 'VPS Live-only',
                    hasConfig: false,
                    appType: c.name.startsWith('[pm2] ') ? 'node' : (c.name.startsWith('[systemd] ') ? 'systemd' : 'docker'),
                    gitRepo: '',
                    status: (isStopped ? 'Stopped' : 'Live') as 'Live' | 'Stopped',
                    isExternal: true,
                    containerRawName: c.name
                };
            });
    }, [vpsContainers, projects]);

    // Filter out migrated projects that are idle/unverified in the current server scope to prevent cross-server UI pollution
    const displayProjects = useMemo(() => {
        return projects.filter(p => !(p.migrated && p.status === 'Idle'));
    }, [projects]);

    // Initialize state on mount
    useEffect(() => {
        checkState();

        // Listen for vault lock event changes (timeout/manual trigger)
        window.autoflow.onVaultLockedStateChange((locked: boolean) => {
            setIsUnlocked(!locked);
            if (locked) {
                setSelectedProject(null);
            }
        });

        // Listen for connection state changes
        window.autoflow.getConnectionState().then((state: string) => {
            setConnectionState(state);
            if (state === 'Connected') {
                fetchGlobalStats(false);
            } else {
                setServerStats(null);
                setVpsContainers([]);
            }
        });
        window.autoflow.onConnectionStateChanged((state: string) => {
            setConnectionState(state);
            if (state === 'Connected') {
                fetchGlobalStats(false);
            } else {
                setServerStats(null);
                setVpsContainers([]);
            }
        });

        // Listen to global background scanner
        window.autoflow.onScanGlobalProjectFound(async (project: any) => {
            setVpsContainers(currentContainers => {
                const liveNames = currentContainers.map((c: any) => cleanContainerName(c.name));
                const isMatchedWithVPS = liveNames.includes(project.projectName);
                if (isMatchedWithVPS) {
                    window.autoflow.getSavedProjects().then(async (saved: any[]) => {
                        if (!saved.some((p: any) => p.projectPath === project.projectPath)) {
                            await window.autoflow.addProject(project.projectPath);
                            loadProjects();
                        }
                    });
                }
                return currentContainers;
            });
        });

        // Background polling — always attempt; IPC handler returns gracefully if not connected
        const interval = setInterval(() => {
            fetchGlobalStats(true);
        }, 5000);

        return () => clearInterval(interval);
    }, []);

    const handleUnlockSuccess = async () => {
        setIsUnlocked(true);
        await loadProjects();
        const crashed = await window.autoflow.checkInterruptedJob();
        if (crashed) {
            setInterruptedJob(crashed);
        }
    };

    const handleOnboardingComplete = async () => {
        setIsConfigured(true);
        setIsVaultCreated(true);
        setIsUnlocked(true);
        setActivePage('dashboard');
        await loadProjects();
    };

    const handleLockVault = async () => {
        await window.autoflow.lockVault();
    };

    const handleSelectProject = (project: ScannedProject, tab: 'overview' | 'env' | 'history' | 'logs' | 'monitor' = 'overview') => {
        setSelectedProject(project);
        setDetailTab(tab);
        setActivePage('project-details');
    };

    const handleImportProject = async (projectPath: string) => {
        await window.autoflow.addProject(projectPath);
        
        // Auto-initialize if it has no config
        const hasConfig = await window.autoflow.projectConfigExists(projectPath);
        if (!hasConfig) {
            setInitProjectPath(projectPath);
            setShowInitModal(true);
        } else {
            await loadProjects();
        }
    };

    const handleInitConfirm = async (options: { projectName: string; gitRepo: string; domain: string; strictCI: boolean; useVolumes: boolean }) => {
        setShowInitModal(false);
        if (initProjectPath) {
            await window.autoflow.initProject(initProjectPath, options);
            await loadProjects();
        }
    };

    const handleInitCancel = async () => {
        setShowInitModal(false);
        await loadProjects();
    };

    const handleRemoveProject = async (projectPath: string) => {
        await window.autoflow.removeProject(projectPath);
        await loadProjects();
        if (selectedProject?.projectPath === projectPath) {
            setSelectedProject(null);
            setActivePage('dashboard');
        }
    };

    const handleTriggerDeploy = async (projectPath: string, projectName: string) => {
        // Open the modal immediately
        setActiveDeploy({
            projectName,
            status: 'running',
            step: 'Starting',
            logs: [{ timestamp: Date.now(), type: 'stream', step: 'Prepare', message: `PS ${projectPath}> autoflow deploy\n\n` }]
        });

        // Listen for streamed log lines from the main process
        const unsubLog = window.autoflow.onDeployLog((data: any) => {
            setActiveDeploy(prev => prev ? {
                ...prev,
                logs: [...prev.logs, {
                    timestamp: Date.now(),
                    type: data.type as any,
                    step: 'Running',
                    message: data.message
                }]
            } : null);
        });

        const unsubSuccess = window.autoflow.onDeploySuccess((_data: any) => {
            setActiveDeploy(prev => prev ? {
                ...prev,
                status: 'success',
                step: 'Completed',
                logs: [...prev.logs, {
                    timestamp: Date.now(),
                    type: 'success',
                    step: 'Finished',
                    message: '\nDeployment completed successfully! 🚀\n'
                }]
            } : null);
            loadProjects();
            fetchGlobalStats(false); // Immediately refresh live status after deploy
            unsubLog?.();
            unsubSuccess?.();
            unsubFailed?.();
        });

        const unsubFailed = window.autoflow.onDeployFailed((data: any) => {
            setActiveDeploy(prev => prev ? {
                ...prev,
                status: 'failed',
                step: 'Failed',
                logs: [...prev.logs, {
                    timestamp: Date.now(),
                    type: 'error',
                    step: 'Failed',
                    message: `\nDeployment failed: ${data.error}\n`
                }]
            } : null);
            unsubLog?.();
            unsubSuccess?.();
            unsubFailed?.();
        });

        // Kick off the deployment in the main process
        try {
            await window.autoflow.deploy(projectPath);
        } catch (err: any) {
            setActiveDeploy(prev => prev ? {
                ...prev,
                status: 'failed',
                step: 'Failed',
                logs: [...prev.logs, {
                    timestamp: Date.now(),
                    type: 'error',
                    step: 'Error',
                    message: `Failed to start deployment: ${err.message}\n`
                }]
            } : null);
            unsubLog?.();
            unsubSuccess?.();
            unsubFailed?.();
        }
    };

    const handleReRunOnboarding = async () => {
        setConfirmModal(null);
        await window.autoflow.clearGlobalConfig();
        setIsConfigured(false);
        setActivePage('dashboard');
    };

    const handleResetAll = async () => {
        setConfirmModal(null);
        await window.autoflow.resetAllConfig();
        setIsConfigured(false);
        setIsVaultCreated(false);
        setIsUnlocked(false);
        setProjects([]);
        setSelectedProject(null);
        setActivePage('dashboard');
    };

    const handleResumeProject = async (containerName: string) => {
        try {
            await window.autoflow.restartContainer(containerName);
            fetchGlobalStats(true); // Refresh in background so UI updates immediately
        } catch (e) {
            console.error('Failed to resume container', e);
        }
    };
    const handleAcknowledgeRecovery = async () => {
        await window.autoflow.clearInterruptedJob();
        setInterruptedJob(null);
    };

    // Render loading screen while app states are read
    if (appLoading) {
        return (
            <div className="app-container" style={{ justifyContent: 'center', alignItems: 'center', background: 'var(--bg-main)' }}>
                <div style={{ color: 'var(--accent)', fontSize: '16px', fontWeight: 600 }}>Loading Autoflow...</div>
            </div>
        );
    }

    // Vault exists but session is locked
    if (isVaultCreated && !isUnlocked) {
        return (
            <div className="app-container">
                <Titlebar isUnlocked={isUnlocked} />
                <LockScreen 
                    onUnlockSuccess={handleUnlockSuccess} 
                    onResetRequest={() => {
                        showConfirm({
                            title: 'Factory Reset',
                            message: 'Are you sure you want to completely wipe all Autoflow settings, keys, and vaults? This will reset the application to its fresh install state and cannot be undone.',
                            confirmLabel: 'Reset Everything',
                            danger: true,
                            onConfirm: handleResetAll
                        });
                    }}
                />
                {confirmModal && (
                    <ConfirmModal
                        title={confirmModal.title}
                        message={confirmModal.message}
                        confirmLabel={confirmModal.confirmLabel}
                        danger={confirmModal.danger}
                        onConfirm={confirmModal.onConfirm}
                        onCancel={() => setConfirmModal(null)}
                    />
                )}
            </div>
        );
    }

    // Unconfigured connection or vault does not exist (New Setup)
    if (!isVaultCreated || !isConfigured) {
        return (
            <div className="app-container">
                <Titlebar isUnlocked={false} />
                <Onboarding onComplete={handleOnboardingComplete} />
            </div>
        );
    }

    return (
        <div className="app-container">
            <Titlebar isUnlocked={true} onLockClick={handleLockVault} />

            {activeDeploy && (
                <DeployProgressModal 
                    activeDeploy={activeDeploy} 
                    onClose={() => {
                        if (activeDeploy.status !== 'running') {
                            setActiveDeploy(null);
                        }
                    }} 
                />
            )}

            {confirmModal && (
                <ConfirmModal
                    title={confirmModal.title}
                    message={confirmModal.message}
                    confirmLabel={confirmModal.confirmLabel}
                    danger={confirmModal.danger}
                    onConfirm={confirmModal.onConfirm}
                    onCancel={() => setConfirmModal(null)}
                />
            )}

            {showInitModal && initProjectPath && (
                <InitProjectModal 
                    projectPath={initProjectPath}
                    onConfirm={handleInitConfirm}
                    onCancel={handleInitCancel}
                />
            )}

            <div className="workspace-layout">
                {/* Left navigation sidebar */}
                <div className="sidebar">
                    <div className="sidebar-nav">
                        <div className="nav-section-title">PLATFORM</div>
                        <button
                            onClick={() => { setActivePage('dashboard'); setSelectedProject(null); }}
                            className={`nav-item ${activePage === 'dashboard' ? 'active' : ''}`}
                        >
                            <DashboardIcon size={14} style={{ marginRight: '8px' }} /> Dashboard
                        </button>
                        
                        <button
                            onClick={() => { setActivePage('livestatus'); setSelectedProject(null); }}
                            className={`nav-item ${activePage === 'livestatus' ? 'active' : ''}`}
                        >
                            <LiveStatusIcon size={14} style={{ marginRight: '8px' }} /> Live Status
                        </button>

                        <button
                            onClick={() => { setActivePage('settings'); setSelectedProject(null); }}
                            className={`nav-item ${activePage === 'settings' ? 'active' : ''}`}
                        >
                            <SettingsIcon size={14} style={{ marginRight: '8px' }} /> Settings
                        </button>
                    </div>

                    <div className="sidebar-projects-list">
                        <div className="nav-section-title">CONNECTED PROJECTS ({displayProjects.length})</div>
                        {displayProjects.map((proj) => {
                            const isSelected = selectedProject?.projectPath === proj.projectPath && !selectedProject?.isExternal;
                            const isDeploying = activeDeploy && activeDeploy.projectName === proj.projectName && activeDeploy.status === 'running';

                            return (
                                <div
                                    key={proj.projectPath}
                                    onClick={() => handleSelectProject(proj, 'overview')}
                                    className={`project-item ${isSelected ? 'active' : ''}`}
                                >
                                    <div style={{ display: 'flex', alignItems: 'center', overflow: 'hidden' }}>
                                        <span className={`project-status-dot ${isDeploying ? 'live' : (proj.status === 'Live' ? 'live' : proj.status === 'Failed' ? 'failed' : 'idle')}`} />
                                        <span style={{
                                            textOverflow: 'ellipsis',
                                            overflow: 'hidden',
                                            whiteSpace: 'nowrap',
                                            fontWeight: isSelected ? 600 : 500
                                        }}>
                                            {proj.projectName}
                                        </span>
                                    </div>
                                    <button
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            showConfirm({
                                                title: 'Remove Project',
                                                message: `Remove "${proj.projectName}" from Autoflow? This only removes it from the list — your local files are not deleted.`,
                                                confirmLabel: 'Remove',
                                                danger: true,
                                                onConfirm: () => {
                                                    setConfirmModal(null);
                                                    handleRemoveProject(proj.projectPath);
                                                }
                                            });
                                        }}
                                        style={{
                                            background: 'transparent',
                                            border: 'none',
                                            color: 'var(--text-muted)',
                                            fontSize: '11px',
                                            cursor: 'pointer',
                                            padding: '2px 6px'
                                        }}
                                        title="Remove project"
                                    >
                                        ✕
                                    </button>
                                </div>
                            );
                        })}
                    </div>

                    {liveOnlyProjects.length > 0 && (
                        <div className="sidebar-projects-list" style={{ marginTop: '16px' }}>
                            <div className="nav-section-title">EXTERNAL PROJECTS ({liveOnlyProjects.length})</div>
                            {liveOnlyProjects.map((proj) => {
                                const isSelected = selectedProject?.projectName === proj.projectName && selectedProject?.isExternal;

                                return (
                                    <div
                                        key={proj.projectName}
                                        onClick={() => handleSelectProject(proj, 'monitor')}
                                        className={`project-item ${isSelected ? 'active' : ''}`}
                                    >
                                        <div style={{ display: 'flex', alignItems: 'center', overflow: 'hidden' }}>
                                            <span className="project-status-dot live" />
                                            <span style={{
                                                textOverflow: 'ellipsis',
                                                overflow: 'hidden',
                                                whiteSpace: 'nowrap',
                                                fontWeight: isSelected ? 600 : 500
                                            }}>
                                                {proj.projectName}
                                            </span>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    )}

                    <div style={{ padding: '16px', marginTop: 'auto', borderTop: '1px solid var(--border-color)', fontSize: '11px', display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--text-secondary)' }}>
                        <span style={{
                            width: '8px', height: '8px', borderRadius: '50%',
                            background: connectionState === 'Connected' ? 'var(--accent)' : connectionState === 'Connecting' || connectionState === 'Reconnecting' ? 'var(--warning)' : 'var(--error)'
                        }}></span>
                        <span style={{ fontWeight: 600 }}>{connectionState}</span>
                    </div>
                </div>

                {/* Main page content container */}
                <div className="main-content">
                    {activePage === 'dashboard' && (
                        <Dashboard
                            projects={displayProjects}
                            externalProjects={liveOnlyProjects}
                            onSelectProject={handleSelectProject}
                            onImportProject={handleImportProject}
                            onRemoveProject={handleRemoveProject}
                            onTriggerDeploy={handleTriggerDeploy}
                            onResumeProject={handleResumeProject}
                            showConfirm={showConfirm}
                            activeDeploy={activeDeploy}
                            isLoading={connectionState === 'Connecting' || connectionState === 'Reconnecting' || statsLoading}
                        />
                    )}

                    {activePage === 'livestatus' && (
                        <LiveStatus 
                            stats={serverStats}
                            loading={statsLoading}
                            error={statsError}
                            onRefresh={() => fetchGlobalStats(false)}
                            onAction={() => fetchGlobalStats(true)}
                            showConfirm={showConfirm}
                        />
                    )}

                    {activePage === 'settings' && (
                        <Settings
                            onReRunOnboarding={handleReRunOnboarding}
                            onResetConfig={handleResetAll}
                            showConfirm={showConfirm}
                            onSaveSuccess={() => setActivePage('dashboard')}
                        />
                    )}

                    {activePage === 'project-details' && selectedProject && (
                        <ProjectDetails
                            key={selectedProject.projectPath || selectedProject.projectName}
                            project={projects.find(p => p.projectName === selectedProject.projectName) || selectedProject}
                            initialTab={detailTab}
                            onBack={() => { setActivePage('dashboard'); setSelectedProject(null); }}
                            onTriggerDeploy={handleTriggerDeploy}
                            activeDeploy={activeDeploy && activeDeploy.projectName === selectedProject.projectName ? activeDeploy : null}
                            onClearLogs={() => setActiveDeploy(null)}
                            onRefreshProjects={loadProjects}
                            showConfirm={showConfirm}
                        />
                    )}
                </div>
            </div>

            {/* Recovery Modal for interrupted background deployments */}
            {interruptedJob && (
                <div className="modal-overlay">
                    <div className="modal-content" style={{ width: '480px' }}>
                        <div className="modal-header" style={{ borderBottomColor: 'rgba(239, 68, 68, 0.2)' }}>
                            <h3 className="h2" style={{ color: 'var(--error)', display: 'flex', alignItems: 'center', gap: '8px' }}>
                                <WarningIcon color="var(--error)" size={20} /> Interrupted Deployment Recovered
                            </h3>
                        </div>
                        <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: '14px', fontSize: '13px', lineHeight: '1.5' }}>
                            <p>
                                Autoflow vNext detected a deployment that was interrupted because the application closed unexpectedly.
                            </p>
                            <div style={{
                                background: 'var(--bg-main)',
                                border: '1px solid var(--border-color)',
                                padding: '12px',
                                borderRadius: '6px',
                                fontFamily: 'monospace',
                                fontSize: '12px'
                            }}>
                                <div><strong>Project:</strong> {interruptedJob.projectName}</div>
                                <div><strong>Timestamp:</strong> {new Date(interruptedJob.startTime).toLocaleString()}</div>
                            </div>
                            <p className="text-secondary">
                                The remote deployment container build may have succeeded on the target server. 
                                We suggest visiting your server console or triggering a new deployment to ensure synchronization.
                            </p>
                        </div>
                        <div className="modal-footer" style={{ borderTop: 'none' }}>
                            <button onClick={handleAcknowledgeRecovery} className="btn btn-primary" style={{ padding: '8px 20px' }}>
                                Acknowledge & Clear
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default App;

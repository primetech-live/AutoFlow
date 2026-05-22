import React, { useState, useEffect, useMemo } from 'react';
import { Titlebar } from './components/Titlebar';
import { Onboarding } from './pages/Onboarding';
import { LockScreen } from './pages/LockScreen';
import { Dashboard, ScannedProject } from './pages/Dashboard';
import { ProjectDetails } from './pages/ProjectDetails';
import { LiveStatus } from './pages/LiveStatus';
import { Settings } from './pages/Settings';
import { LogLine } from './components/LoggerConsole';
import { DashboardIcon, LiveStatusIcon, SettingsIcon, FolderIcon, LockIcon, WarningIcon, ServerIcon, SuccessIcon } from './components/Icons';

interface ActiveDeploy {
    projectName: string;
    status: 'running' | 'success' | 'failed' | 'idle';
    step: string;
    logs: LogLine[];
}

const App: React.FC = () => {
    const [isConfigured, setIsConfigured] = useState<boolean | null>(null);
    const [isVaultCreated, setIsVaultCreated] = useState<boolean | null>(null);
    const [isUnlocked, setIsUnlocked] = useState<boolean>(false);
    
    // Page state
    const [activePage, setActivePage] = useState<'dashboard' | 'livestatus' | 'settings' | 'project-details'>('dashboard');
    const [selectedProject, setSelectedProject] = useState<ScannedProject | null>(null);
    const [detailTab, setDetailTab] = useState<'overview' | 'env' | 'history' | 'logs' | 'monitor'>('overview');
    
    // Data list
    const [projects, setProjects] = useState<ScannedProject[]>([]);
    const [vpsContainers, setVpsContainers] = useState<any[]>([]);
    const [vpsLoading, setVpsLoading] = useState<boolean>(false);

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
            setProjects(list.map(p => ({ ...p, status: p.status || 'Idle' })));

            // Fetch VPS containers asynchronously to avoid blocking app load
            setVpsLoading(true);
            window.autoflow.fetchServerStats().then((stats) => {
                if (stats && stats.containers) {
                    setVpsContainers(stats.containers);
                    
                    // Match and update statuses
                    setProjects(prev => {
                        return prev.map(p => {
                            const match = stats.containers.find(c => cleanContainerName(c.name) === p.projectName);
                            return {
                                ...p,
                                status: match ? 'Live' : 'Idle',
                                containerRawName: match ? match.name : p.projectName
                            };
                        });
                    });

                    // Search globally on local PC in background for unmatched projects
                    const unmatchedLiveNames = stats.containers
                        .map(c => cleanContainerName(c.name))
                        .filter(name => !list.some(p => p.projectName === name));

                    if (unmatchedLiveNames.length > 0) {
                        window.autoflow.scanGlobal();
                    }
                }
            }).catch((err) => {
                console.error('Failed to fetch stats:', err);
            }).finally(() => {
                setVpsLoading(false);
            });
        } catch (err) {
            console.error('Failed to load projects:', err);
        }
    };

    // Compute live-only/external projects dynamically
    const liveOnlyProjects = useMemo(() => {
        return vpsContainers
            .filter(c => {
                const cleanName = cleanContainerName(c.name);
                return !projects.some(p => p.projectName === cleanName);
            })
            .map(c => ({
                projectName: cleanContainerName(c.name),
                projectPath: 'VPS Live-only',
                hasConfig: false,
                appType: c.name.startsWith('[pm2] ') ? 'node' : (c.name.startsWith('[systemd] ') ? 'systemd' : 'docker'),
                gitRepo: '',
                status: 'Live' as const,
                isExternal: true,
                containerRawName: c.name
            }));
    }, [vpsContainers, projects]);

    // Initialize state on mount
    useEffect(() => {
        checkState();

        // Listen for vault lock event changes (timeout/manual trigger)
        window.autoflow.onVaultLockedStateChange((locked) => {
            setIsUnlocked(!locked);
            if (locked) {
                setSelectedProject(null);
            }
        });

        // Listen to global background scanner
        window.autoflow.onScanGlobalProjectFound(async (project) => {
            setVpsContainers(currentContainers => {
                const liveNames = currentContainers.map(c => cleanContainerName(c.name));
                const isMatchedWithVPS = liveNames.includes(project.projectName);
                
                if (isMatchedWithVPS) {
                    window.autoflow.getSavedProjects().then(async (saved) => {
                        if (!saved.some(p => p.projectPath === project.projectPath)) {
                            // Automatically add to saved projects
                            await window.autoflow.addProject(project.projectPath);
                            // Reload projects
                            loadProjects();
                        }
                    });
                }
                return currentContainers;
            });
        });

        // Set up background deployment listeners
        window.autoflow.onDeployStarted((data) => {
            setActiveDeploy({
                projectName: data.projectName,
                status: 'running',
                step: 'Initializing connection',
                logs: [{ timestamp: Date.now(), type: 'info', step: 'init', message: `Deployment started for ${data.projectName}...` }]
            });
        });

        window.autoflow.onDeployLog((data) => {
            setActiveDeploy(prev => {
                if (!prev || prev.projectName !== data.projectName) return prev;
                return {
                    ...prev,
                    step: data.step,
                    logs: [...prev.logs, {
                        timestamp: data.timestamp,
                        type: data.type as any,
                        step: data.step,
                        message: data.message
                    }]
                };
            });
        });

        window.autoflow.onDeploySuccess((data) => {
            setActiveDeploy(prev => {
                if (!prev || prev.projectName !== data.projectName) return prev;
                return {
                    ...prev,
                    status: 'success',
                    step: 'Completed',
                    logs: [...prev.logs, { timestamp: Date.now(), type: 'info', step: 'finished', message: 'Deployment completed successfully!' }]
                };
            });
            loadProjects();
        });

        window.autoflow.onDeployFailed((data) => {
            setActiveDeploy(prev => {
                if (!prev || prev.projectName !== data.projectName) return prev;
                return {
                    ...prev,
                    status: 'failed',
                    step: 'Failed',
                    logs: [...prev.logs, { timestamp: Date.now(), type: 'error', step: 'failed', message: `Deployment failed: ${data.error}` }]
                };
            });
            loadProjects();
        });
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

    const handleTriggerDeploy = async (projectPath: string) => {
        try {
            await window.autoflow.deploy(projectPath);
        } catch (err: any) {
            alert(`Failed to trigger deploy: ${err.message}`);
        }
    };

    const handleReRunOnboarding = async () => {
        await window.autoflow.clearGlobalConfig();
        setIsConfigured(false);
        setActivePage('dashboard');
    };

    const handleResetAll = async () => {
        await window.autoflow.resetAllConfig();
        setIsConfigured(false);
        setIsVaultCreated(false);
        setIsUnlocked(false);
        setProjects([]);
        setSelectedProject(null);
        setActivePage('dashboard');
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
                <Titlebar isUnlocked={false} />
                <LockScreen onUnlockSuccess={handleUnlockSuccess} />
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
                        <div className="nav-section-title">CONNECTED PROJECTS ({projects.length})</div>
                        {projects.map((proj) => {
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
                                            if (confirm(`Remove project ${proj.projectName} from Autoflow?`)) {
                                                handleRemoveProject(proj.projectPath);
                                            }
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
                </div>

                {/* Main page content container */}
                <div className="main-content">
                    {activePage === 'dashboard' && (
                        <Dashboard
                            projects={projects}
                            externalProjects={liveOnlyProjects}
                            onSelectProject={handleSelectProject}
                            onImportProject={handleImportProject}
                            onRemoveProject={handleRemoveProject}
                            onTriggerDeploy={handleTriggerDeploy}
                            activeDeploy={activeDeploy}
                        />
                    )}

                    {activePage === 'livestatus' && (
                        <LiveStatus />
                    )}

                    {activePage === 'settings' && (
                        <Settings
                            onReRunOnboarding={handleReRunOnboarding}
                            onResetConfig={handleResetAll}
                        />
                    )}

                    {activePage === 'project-details' && selectedProject && (
                        <ProjectDetails
                            project={selectedProject}
                            initialTab={detailTab}
                            onBack={() => { setActivePage('dashboard'); setSelectedProject(null); }}
                            onTriggerDeploy={handleTriggerDeploy}
                            activeDeploy={activeDeploy && activeDeploy.projectName === selectedProject.projectName ? activeDeploy : null}
                            onClearLogs={() => setActiveDeploy(null)}
                            onRefreshProjects={loadProjects}
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

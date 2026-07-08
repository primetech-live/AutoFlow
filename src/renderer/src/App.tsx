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
import { useAuth } from './core/AuthProvider';
import { supabase } from './core/supabase';
import { useTheme } from './contexts/ThemeContext';
import darkBg from '../assets/dark_google_login_bg.png';
import lightBg from '../assets/light_google_login_bg.png';
import appIcon from '../assets/icon-1.png';

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
    
    const { user, isLoading: authLoading, signInWithGoogle, signOut } = useAuth();
    const [termsAccepted, setTermsAccepted] = useState(false);
    const { resolvedTheme } = useTheme();

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

        // Background polling — recursive setTimeout ensures we never stack/flood the SSH pool
        let isMounted = true;
        let timeoutId: NodeJS.Timeout;

        const pollGlobalStats = async () => {
            if (!isMounted) return;
            await fetchGlobalStats(true);
            if (isMounted) {
                timeoutId = setTimeout(pollGlobalStats, 5000);
            }
        };

        timeoutId = setTimeout(pollGlobalStats, 5000);

        // Uninstall/Fresh install logout check
        const hasRun = localStorage.getItem('autoflow_has_run');
        if (!hasRun) {
            signOut();
            localStorage.setItem('autoflow_has_run', 'true');
        }

        return () => {
            isMounted = false;
            clearTimeout(timeoutId);
        };
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

    // Save consent on successful login
    useEffect(() => {
        if (user && termsAccepted) {
            supabase.from('user_consents').insert({ user_id: user.id }).then(() => {
                setTermsAccepted(false); // Reset so it doesn't trigger again
            });
        }
    }, [user, termsAccepted]);

    // Render loading screen while app states are read
    if (appLoading || authLoading) {
        return (
            <div className="app-container" style={{ justifyContent: 'center', alignItems: 'center', background: 'var(--bg-main)' }}>
                <div style={{ color: 'var(--accent)', fontSize: '16px', fontWeight: 600 }}>Loading Autoflow...</div>
            </div>
        );
    }

    if (!user) {
        return (
            <div className="app-container">
                <Titlebar isUnlocked={false} />
                <div style={{ 
                    flex: 1, 
                    display: 'flex', 
                    flexDirection: 'column', 
                    alignItems: 'center', 
                    justifyContent: 'center', 
                    background: 'var(--bg-main)',
                    backgroundImage: `url(${resolvedTheme === 'dark' ? darkBg : lightBg})`,
                    backgroundSize: 'cover',
                    backgroundPosition: 'center',
                    backgroundRepeat: 'no-repeat'
                }}>
                    <div style={{
                        background: resolvedTheme === 'dark' ? 'rgba(15, 15, 20, 0.4)' : 'rgba(255, 255, 255, 0.6)',
                        backdropFilter: 'blur(24px)',
                        WebkitBackdropFilter: 'blur(24px)',
                        border: '1px solid',
                        borderColor: resolvedTheme === 'dark' ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.1)',
                        borderTop: resolvedTheme === 'dark' ? '1px solid rgba(6, 182, 212, 0.5)' : '1px solid var(--accent)',
                        borderLeft: resolvedTheme === 'dark' ? '1px solid rgba(6, 182, 212, 0.3)' : '1px solid rgba(2, 132, 199, 0.3)',
                        borderRadius: '24px',
                        padding: '48px 40px',
                        width: '420px',
                        maxWidth: '90%',
                        boxShadow: '0 24px 48px rgba(0,0,0,0.2)',
                        textAlign: 'center',
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center'
                    }}>
                        {/* Logo */}
                        <img src={appIcon} alt="AutoFlow Logo" style={{ width: '80px', height: '80px', marginBottom: '24px' }} />
                        
                        {/* Title */}
                        <h1 className="h1" style={{ fontSize: '28px', marginBottom: '8px', letterSpacing: '-0.5px' }}>
                            Welcome to <span style={{ color: 'var(--accent)' }}>AutoFlow</span>
                        </h1>
                        <span className="text-secondary" style={{ fontSize: '15px', display: 'block', marginBottom: '8px' }}>
                            Deploy. Automate. Scale.
                        </span>
                        
                        {/* Divider */}
                        <div style={{ width: '100%', height: '1px', background: resolvedTheme === 'dark' ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)', margin: '28px 0', position: 'relative', display: 'flex', justifyContent: 'center' }}>
                            <div style={{ width: '48px', height: '3px', background: 'var(--accent)', borderRadius: '2px', position: 'absolute', top: '-1px' }}></div>
                        </div>
                        
                        {/* Subtitle */}
                        <h2 className="h2" style={{ fontSize: '18px', marginBottom: '12px' }}>Sign in to continue</h2>
                        <span className="text-secondary" style={{ fontSize: '13px', lineHeight: '1.5', display: 'block', marginBottom: '32px' }}>
                            Authenticate to sync your account, unlock cloud features, and manage your commercial plan.
                        </span>

                        {/* Terms */}
                        <div style={{
                            marginBottom: '24px',
                            display: 'flex',
                            alignItems: 'flex-start',
                            gap: '10px',
                            textAlign: 'left',
                            width: '100%'
                        }}>
                            <input 
                                type="checkbox" 
                                id="loginTermsCheckbox" 
                                checked={termsAccepted} 
                                onChange={(e) => setTermsAccepted(e.target.checked)} 
                                style={{ width: '16px', height: '16px', marginTop: '2px', cursor: 'pointer', flexShrink: 0, accentColor: 'var(--accent)', borderRadius: '4px' }}
                            />
                            <label htmlFor="loginTermsCheckbox" style={{ fontSize: '12.5px', color: 'var(--text-secondary)', cursor: 'pointer', lineHeight: '1.5' }}>
                                (Optional) I agree to the <a href="https://example.com/terms" target="_blank" rel="noreferrer" style={{ color: 'var(--accent)', textDecoration: 'none', fontWeight: 500 }}>Terms of Service</a> and Liability Disclaimer.
                            </label>
                        </div>

                        {/* Google Button */}
                        <button 
                            style={{ 
                                width: '100%', 
                                padding: '14px', 
                                fontSize: '14.5px', 
                                display: 'flex', 
                                justifyContent: 'center', 
                                alignItems: 'center', 
                                gap: '12px', 
                                fontWeight: 600, 
                                borderRadius: '12px',
                                background: resolvedTheme === 'dark' ? 'rgba(255,255,255,0.03)' : 'rgba(255,255,255,0.8)',
                                border: resolvedTheme === 'dark' ? '1px solid rgba(255,255,255,0.1)' : '1px solid rgba(0,0,0,0.1)',
                                color: 'var(--text-primary)',
                                cursor: 'pointer',
                                transition: 'all 0.2s'
                            }}
                            onMouseOver={(e) => e.currentTarget.style.background = resolvedTheme === 'dark' ? 'rgba(255,255,255,0.08)' : '#fff'}
                            onMouseOut={(e) => e.currentTarget.style.background = resolvedTheme === 'dark' ? 'rgba(255,255,255,0.03)' : 'rgba(255,255,255,0.8)'}
                            onClick={signInWithGoogle}
                        >
                            <svg viewBox="0 0 24 24" width="20" height="20" xmlns="http://www.w3.org/2000/svg">
                                <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
                                <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                                <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
                                <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
                                <path d="M1 1h22v22H1z" fill="none"/>
                            </svg>
                            Continue with Google
                        </button>
                    </div>
                </div>
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

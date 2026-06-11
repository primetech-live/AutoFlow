import React, { useState, useEffect, useMemo } from 'react';
import { 
    FolderIcon, 
    GitIcon, 
    DeployIcon, 
    RollbackIcon, 
    LogsIcon, 
    LiveStatusIcon,
    SearchIcon,
    FilterIcon,
    TrashIcon,
    InfoIcon,
    WarningIcon,
    SuccessIcon,
    CloseIcon,
    ServerIcon
} from '../components/Icons';

declare global {
    interface Window {
        autoflow: any;
    }
}

export interface ScannedProject {
    projectName: string;
    projectPath: string;
    hasConfig: boolean;
    appType: string;
    gitRepo: string;
    status?: 'Live' | 'Failed' | 'Idle' | 'Deploying' | 'Stopped';
    isExternal?: boolean;
    containerRawName?: string;
}

interface DashboardProps {
    projects: ScannedProject[];
    externalProjects?: ScannedProject[];
    onSelectProject: (project: ScannedProject, tab?: 'overview' | 'env' | 'history' | 'logs' | 'monitor') => void;
    onImportProject: (path: string) => void;
    onRemoveProject: (path: string) => void;
    onTriggerDeploy: (path: string, projectName: string) => void;
    onResumeProject?: (containerName: string) => void;
    showConfirm: (opts: { title: string; message: string; confirmLabel?: string; danger?: boolean; onConfirm: () => void }) => void;
    activeDeploy: { projectName: string; status: string; step: string } | null;
}

export const Dashboard: React.FC<DashboardProps> = ({
    projects,
    externalProjects = [],
    onSelectProject,
    onImportProject,
    onRemoveProject,
    onTriggerDeploy,
    onResumeProject,
    showConfirm,
    activeDeploy
}) => {
    const [searchQuery, setSearchQuery] = useState('');
    const [typeFilter, setTypeFilter] = useState('All');
    const [statusFilter, setStatusFilter] = useState('All');

    // Scanning modal state
    const [showScanModal, setShowScanModal] = useState(false);
    const [scanRootPath, setScanRootPath] = useState('');
    const [scanning, setScanning] = useState(false);
    const [scanProgress, setScanProgress] = useState({ count: 0, dir: '' });
    const [scannedProjects, setScannedProjects] = useState<ScannedProject[]>([]);
    
    // Recent activity list
    const [recentActivity, setRecentActivity] = useState<any[]>([]);

    // Fetch deployment history logs to compile recent activities
    useEffect(() => {
        const fetchHistory = async () => {
            const list: any[] = [];
            const allProjects = [...projects, ...externalProjects];
            for (const p of allProjects) {
                try {
                    const hist = await window.autoflow.getHistory(p.projectName);
                    hist.forEach((h: any) => {
                        list.push({
                            ...h,
                            projectName: p.projectName,
                            projectPath: p.projectPath
                        });
                    });
                } catch {
                    // Ignore errors
                }
            }
            // Sort by timestamp desc and take last 5
            list.sort((a, b) => b.timestamp - a.timestamp);
            setRecentActivity(list.slice(0, 5));
        };
        if (projects.length > 0 || externalProjects.length > 0) {
            fetchHistory();
        }
    }, [projects, externalProjects, activeDeploy]);

    const handleBrowseFolder = async () => {
        const folder = await window.autoflow.browseFolder();
        if (folder) {
            setScanRootPath(folder);
        }
    };

    const handleStartScan = async () => {
        if (!scanRootPath) return;
        setScanning(true);
        setScannedProjects([]);
        setScanProgress({ count: 0, dir: '' });

        // Set up scanner listeners
        window.autoflow.onScanProjectFound((project: any) => {
            setScannedProjects(prev => {
                if (prev.some(p => p.projectPath === project.projectPath)) return prev;
                return [...prev, project];
            });
        });

        window.autoflow.onScanProgress((progress: any) => {
            setScanProgress({ count: progress.count, dir: progress.dir });
        });

        window.autoflow.onScanFinished((allFound: any) => {
            setScanning(false);
        });

        // Trigger scan
        await window.autoflow.scanDirectory(scanRootPath);
    };

    const handleAbortScan = async () => {
        await window.autoflow.abortScan();
        setScanning(false);
    };

    const handleImportScanned = (project: ScannedProject) => {
        onImportProject(project.projectPath);
        setScannedProjects(prev => prev.filter(p => p.projectPath !== project.projectPath));
        setShowScanModal(false);
    };

    // Filter projects
    const filteredProjects = useMemo(() => {
        return projects.filter(p => {
            const matchesSearch = p.projectName.toLowerCase().includes(searchQuery.toLowerCase()) ||
                p.projectPath.toLowerCase().includes(searchQuery.toLowerCase());
            const matchesType = typeFilter === 'All' || p.appType.toLowerCase() === typeFilter.toLowerCase();
            const isDeploying = activeDeploy && activeDeploy.projectName === p.projectName && activeDeploy.status === 'running';
            const currentStatus = isDeploying ? 'Deploying' : (p.status || 'Idle');
            const matchesStatus = statusFilter === 'All' || currentStatus.toLowerCase() === statusFilter.toLowerCase();
            return matchesSearch && matchesType && matchesStatus;
        });
    }, [projects, searchQuery, typeFilter, statusFilter, activeDeploy]);

    const filteredExternalProjects = useMemo(() => {
        return externalProjects.filter(p => {
            const matchesSearch = p.projectName.toLowerCase().includes(searchQuery.toLowerCase());
            const matchesType = typeFilter === 'All' || p.appType.toLowerCase() === typeFilter.toLowerCase();
            return matchesSearch && matchesType;
        });
    }, [externalProjects, searchQuery, typeFilter]);

    return (
        <div style={{ display: 'flex', gap: '28px', flex: 1, overflow: 'hidden', height: '100%' }}>
            
            {/* Left Panel: Projects Grid */}
            <div style={{ flex: 3, display: 'flex', flexDirection: 'column', gap: '20px', overflowY: 'auto', paddingRight: '6px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div>
                        <h1 className="h1">Dashboard</h1>
                        <span className="text-secondary" style={{ fontSize: '13px' }}>Manage and trigger your project deployments</span>
                    </div>
                    <button onClick={() => setShowScanModal(true)} className="btn btn-primary" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <FolderIcon size={14} /> Import Project
                    </button>
                </div>

                {/* Filters Row */}
                <div style={{
                    display: 'flex',
                    gap: '12px',
                    background: 'var(--bg-panel)',
                    padding: '12px 16px',
                    borderRadius: '8px',
                    border: '1px solid var(--border-color)',
                    alignItems: 'center'
                }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flex: 1, background: 'var(--bg-main)', border: '1px solid var(--border-color)', borderRadius: '6px', padding: '0 12px' }}>
                        <SearchIcon size={14} color="var(--text-secondary)" />
                        <input
                            type="text"
                            placeholder="Search by name or path..."
                            className="input"
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            style={{ flex: 1, padding: '8px 0', fontSize: '13px', border: 'none', background: 'transparent', outline: 'none', color: 'var(--text-primary)' }}
                        />
                    </div>
                    
                    <select
                        className="input"
                        value={typeFilter}
                        onChange={(e) => setTypeFilter(e.target.value)}
                        style={{ width: '130px', padding: '8px 12px', fontSize: '13px' }}
                    >
                        <option value="All">All Types</option>
                        <option value="node">Node.js</option>
                        <option value="static">Static Web</option>
                        <option value="docker">Docker</option>
                        <option value="vue">Vue.js</option>
                        <option value="nuxt">Nuxt.js</option>
                    </select>

                    <select
                        className="input"
                        value={statusFilter}
                        onChange={(e) => setStatusFilter(e.target.value)}
                        style={{ width: '130px', padding: '8px 12px', fontSize: '13px' }}
                    >
                        <option value="All">All Statuses</option>
                        <option value="Live">Live</option>
                        <option value="Failed">Failed</option>
                        <option value="Deploying">Deploying</option>
                        <option value="Idle">Idle</option>
                    </select>
                </div>

                {/* Connected Projects Section */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                    <h2 className="h2" style={{ fontSize: '14px', letterSpacing: '0.05em', color: 'var(--text-secondary)', textTransform: 'uppercase' }}>
                        Connected Projects ({filteredProjects.length})
                    </h2>
                    
                    {filteredProjects.length === 0 ? (
                        <div style={{
                            background: 'var(--bg-panel)',
                            border: '1px dashed var(--border-color)',
                            borderRadius: '12px',
                            padding: '36px',
                            textAlign: 'center',
                            color: 'var(--text-secondary)',
                            fontSize: '13px'
                        }}>
                            No local/connected projects matching search parameters.
                        </div>
                    ) : (
                        <div className="card-grid">
                            {filteredProjects.map((p) => {
                                const isDeploying = p.status === 'Deploying';
                                
                                return (
                                    <div key={p.projectPath} className="card card-hoverable" style={{ display: 'flex', flexDirection: 'column', justifyContent: 'space-between', minHeight: '210px' }}>
                                        <div>
                                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '10px' }}>
                                                <span style={{
                                                    fontSize: '10px',
                                                    fontWeight: 700,
                                                    letterSpacing: '0.05em',
                                                    textTransform: 'uppercase',
                                                    background: 'var(--border-color)',
                                                    padding: '2px 8px',
                                                    borderRadius: '4px',
                                                    color: 'var(--text-secondary)'
                                                }}>
                                                    {p.appType || 'node'}
                                                </span>
                                                
                                                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                                    <span className={`project-status-dot ${isDeploying ? 'live' : (p.status === 'Live' ? 'live' : p.status === 'Failed' ? 'failed' : p.status === 'Stopped' ? 'failed' : 'idle')}`} style={{ background: p.status === 'Stopped' ? 'var(--warning)' : undefined }} />
                                                    <span style={{ fontSize: '12px', fontWeight: 600, color: isDeploying ? 'var(--warning)' : (p.status === 'Live' ? 'var(--accent)' : p.status === 'Stopped' ? 'var(--warning)' : 'var(--text-secondary)') }}>
                                                        {isDeploying ? 'Deploying...' : (p.status === 'Live' ? 'Connected' : p.status === 'Failed' ? 'Failed' : p.status === 'Stopped' ? 'Stopped' : 'Ready To Deploy')}
                                                    </span>
                                                </div>
                                            </div>

                                            <h3 className="h2" style={{ fontSize: '16px', marginBottom: '4px', textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap' }}>
                                                {p.projectName}
                                            </h3>
                                            <span className="text-muted" style={{ fontSize: '11px', wordBreak: 'break-all' }}>
                                                {p.projectPath}
                                            </span>

                                            {p.gitRepo && (
                                                <div style={{ fontSize: '11px', marginTop: '12px', color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                                                    <GitIcon size={12} color="var(--text-secondary)" /> <span style={{ textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap' }}>{p.gitRepo}</span>
                                                </div>
                                            )}
                                        </div>

                                        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginTop: '20px' }}>
                                            <div style={{ display: 'flex', gap: '8px' }}>
                                                <button
                                                    onClick={() => onSelectProject(p, 'overview')}
                                                    className="btn btn-secondary"
                                                    style={{ flex: 1, padding: '6px 12px', fontSize: '12px' }}
                                                >
                                                    View Details
                                                </button>
                                                
                                                <button
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        if (p.status === 'Stopped' && onResumeProject) {
                                                            showConfirm({
                                                                title: 'Resume Container',
                                                                message: `Start container "${p.projectName}"?`,
                                                                confirmLabel: 'Start',
                                                                onConfirm: () => onResumeProject(p.containerRawName || p.projectName)
                                                            });
                                                        } else {
                                                            onTriggerDeploy(p.projectPath, p.projectName);
                                                        }
                                                    }}
                                                    disabled={isDeploying || !p.hasConfig}
                                                    className={p.status === 'Stopped' ? 'btn btn-secondary' : 'btn btn-primary'}
                                                    style={{ flex: 1, padding: '6px 12px', fontSize: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '4px' }}
                                                >
                                                    <DeployIcon size={12} />
                                                    {isDeploying ? 'Deploying...' : (p.status === 'Stopped' ? 'Resume' : 'Deploy')}
                                                </button>
                                            </div>

                                            <div style={{
                                                display: 'flex',
                                                justifyContent: 'space-between',
                                                alignItems: 'center',
                                                borderTop: '1px solid var(--border-color)',
                                                paddingTop: '8px',
                                                fontSize: '11px',
                                                color: 'var(--text-secondary)'
                                            }}>
                                                <span>Quick Actions:</span>
                                                <div style={{ display: 'flex', gap: '4px' }}>
                                                    <button
                                                        onClick={() => onSelectProject(p, 'logs')}
                                                        className="btn btn-secondary"
                                                        style={{ padding: '4px 6px', fontSize: '10px', display: 'flex', alignItems: 'center', gap: '3px' }}
                                                        title="View Live Logs"
                                                    >
                                                        <LogsIcon size={10} /> Logs
                                                    </button>
                                                    <button
                                                        onClick={() => onSelectProject(p, 'history')}
                                                        className="btn btn-secondary"
                                                        style={{ padding: '4px 6px', fontSize: '10px', display: 'flex', alignItems: 'center', gap: '3px' }}
                                                        title="Rollback History"
                                                    >
                                                        <RollbackIcon size={10} /> Rollback
                                                    </button>
                                                    <button
                                                        onClick={() => onSelectProject(p, 'monitor')}
                                                        className="btn btn-secondary"
                                                        style={{ padding: '4px 6px', fontSize: '10px', display: 'flex', alignItems: 'center', gap: '3px' }}
                                                        title="Monitor Status"
                                                    >
                                                        <LiveStatusIcon size={10} /> Status
                                                    </button>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>

                {/* External / Live-only Projects Section */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginTop: '16px' }}>
                    <h2 className="h2" style={{ fontSize: '14px', letterSpacing: '0.05em', color: 'var(--text-secondary)', textTransform: 'uppercase' }}>
                        External / Live-only Projects ({filteredExternalProjects.length})
                    </h2>

                    {filteredExternalProjects.length === 0 ? (
                        <div style={{
                            background: 'var(--bg-panel)',
                            border: '1px dashed var(--border-color)',
                            borderRadius: '12px',
                            padding: '36px',
                            textAlign: 'center',
                            color: 'var(--text-secondary)',
                            fontSize: '13px'
                        }}>
                            No external live-only projects running on VPS.
                        </div>
                    ) : (
                        <div className="card-grid">
                            {filteredExternalProjects.map((p) => {
                                return (
                                    <div key={p.projectName} className="card card-hoverable" style={{ display: 'flex', flexDirection: 'column', justifyContent: 'space-between', minHeight: '210px' }}>
                                        <div>
                                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '10px' }}>
                                                <span style={{
                                                    fontSize: '10px',
                                                    fontWeight: 700,
                                                    letterSpacing: '0.05em',
                                                    textTransform: 'uppercase',
                                                    background: 'rgba(59, 130, 246, 0.1)',
                                                    padding: '2px 8px',
                                                    borderRadius: '4px',
                                                    color: '#3b82f6'
                                                }}>
                                                    {p.appType || 'docker'}
                                                </span>
                                                
                                                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                                    <span className="project-status-dot live" />
                                                    <span style={{ fontSize: '12px', fontWeight: 600, color: 'var(--info)' }}>
                                                        Live Only
                                                    </span>
                                                </div>
                                            </div>

                                            <h3 className="h2" style={{ fontSize: '16px', marginBottom: '4px', textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap' }}>
                                                {p.projectName}
                                            </h3>
                                            <span className="text-secondary" style={{ fontSize: '11px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                                                <ServerIcon size={12} color="var(--text-secondary)" /> VPS Live-only
                                            </span>
                                        </div>

                                        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginTop: '20px' }}>
                                            <div style={{ display: 'flex', gap: '8px' }}>
                                                <button
                                                    onClick={() => onSelectProject(p, 'monitor')}
                                                    className="btn btn-secondary"
                                                    style={{ flex: 1, padding: '6px 12px', fontSize: '12px' }}
                                                >
                                                    View Details
                                                </button>
                                                
                                                <button
                                                    disabled
                                                    className="btn btn-primary"
                                                    style={{ flex: 1, padding: '6px 12px', fontSize: '12px', opacity: 0.4, cursor: 'not-allowed' }}
                                                    title="Deploy is disabled for external projects"
                                                >
                                                    Deploy
                                                </button>
                                            </div>

                                            <div style={{
                                                display: 'flex',
                                                justifyContent: 'space-between',
                                                alignItems: 'center',
                                                borderTop: '1px solid var(--border-color)',
                                                paddingTop: '8px',
                                                fontSize: '11px',
                                                color: 'var(--text-secondary)'
                                            }}>
                                                <span>Quick Actions:</span>
                                                <div style={{ display: 'flex', gap: '4px' }}>
                                                    <button
                                                        onClick={() => onSelectProject(p, 'logs')}
                                                        className="btn btn-secondary"
                                                        style={{ padding: '4px 6px', fontSize: '10px', display: 'flex', alignItems: 'center', gap: '3px' }}
                                                        title="View Container Logs"
                                                    >
                                                        <LogsIcon size={10} /> Logs
                                                    </button>
                                                    <button
                                                        disabled
                                                        className="btn btn-secondary"
                                                        style={{ padding: '4px 6px', fontSize: '10px', opacity: 0.4, cursor: 'not-allowed', display: 'flex', alignItems: 'center', gap: '3px' }}
                                                        title="Rollback is disabled for external projects"
                                                    >
                                                        <RollbackIcon size={10} /> Rollback
                                                    </button>
                                                    <button
                                                        onClick={() => onSelectProject(p, 'monitor')}
                                                        className="btn btn-secondary"
                                                        style={{ padding: '4px 6px', fontSize: '10px', display: 'flex', alignItems: 'center', gap: '3px' }}
                                                        title="Monitor Status"
                                                    >
                                                        <LiveStatusIcon size={10} /> Status
                                                    </button>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>
            </div>

            {/* Right Panel: Recent Activity Feed */}
            <div style={{
                flex: 1,
                background: 'var(--bg-panel)',
                border: '1px solid var(--border-color)',
                borderRadius: '8px',
                padding: '20px',
                display: 'flex',
                flexDirection: 'column',
                gap: '16px',
                maxHeight: '100%',
                overflowY: 'auto'
            }}>
                <h3 className="h2" style={{ fontSize: '15px' }}>Recent Activity</h3>
                
                {recentActivity.length === 0 ? (
                    <span className="text-muted" style={{ fontSize: '12px', padding: '12px 0' }}>
                        No deployments recorded yet.
                    </span>
                ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                        {recentActivity.map((activity, idx) => (
                            <div key={idx} style={{
                                padding: '10px 12px',
                                background: 'var(--bg-main)',
                                border: '1px solid var(--border-color)',
                                borderRadius: '6px',
                                fontSize: '12px'
                            }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                                    <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{activity.projectName}</span>
                                    <span style={{
                                        color: activity.status === 'Live' || activity.status === 'Restarted' ? 'var(--accent)' :
                                               activity.status === 'Stopped' ? 'var(--warning)' : 
                                               'var(--error)',
                                        fontWeight: 700,
                                        fontSize: '11px'
                                    }}>
                                        {activity.status}
                                    </span>
                                </div>
                                <div className="text-muted" style={{ fontSize: '11px', display: 'flex', justifyContent: 'space-between' }}>
                                    <span>Duration: {activity.duration}s</span>
                                    <span>{new Date(activity.timestamp).toLocaleDateString()}</span>
                                </div>
                                {activity.commitSha && activity.commitSha !== 'Unknown' && (
                                    <div className="text-muted" style={{ fontSize: '10px', marginTop: '4px', fontFamily: 'monospace' }}>
                                        SHA: {activity.commitSha}
                                    </div>
                                )}
                            </div>
                        ))}
                    </div>
                )}
            </div>

            {/* Scan Modal */}
            {showScanModal && (
                <div className="modal-overlay">
                    <div className="modal-content" style={{ width: '560px' }}>
                        <div className="modal-header">
                            <h3 className="h2" style={{ fontSize: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                                <FolderIcon size={18} /> Import Projects
                            </h3>
                            <button onClick={() => setShowScanModal(false)} className="btn btn-secondary" style={{ padding: '4px', borderRadius: '4px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                <CloseIcon size={14} />
                            </button>
                        </div>
                        
                        <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                            <div className="form-group">
                                <label className="form-label">Scan Root Folder Path</label>
                                <div style={{ display: 'flex', gap: '8px' }}>
                                    <input
                                        type="text"
                                        placeholder="C:\projects"
                                        className="input"
                                        value={scanRootPath}
                                        onChange={(e) => setScanRootPath(e.target.value)}
                                        style={{ flex: 1 }}
                                    />
                                    <button onClick={handleBrowseFolder} className="btn btn-secondary">Browse</button>
                                </div>
                            </div>

                            {scanning && (
                                <div style={{
                                    background: 'var(--bg-main)',
                                    border: '1px solid var(--border-color)',
                                    padding: '12px',
                                    borderRadius: '6px',
                                    fontSize: '12px'
                                }}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
                                        <span style={{ fontWeight: 600, color: 'var(--accent)' }}>Scanning in progress...</span>
                                        <span>Files Checked: {scanProgress.count}</span>
                                    </div>
                                    <div className="text-muted" style={{
                                        textOverflow: 'ellipsis',
                                        overflow: 'hidden',
                                        whiteSpace: 'nowrap'
                                    }}>
                                        Active Dir: {scanProgress.dir}
                                    </div>
                                </div>
                            )}

                            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                <span style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)' }}>
                                    Discovered Projects ({scannedProjects.length})
                                </span>
                                
                                <div style={{
                                    maxHeight: '200px',
                                    overflowY: 'auto',
                                    background: 'var(--bg-main)',
                                    border: '1px solid var(--border-color)',
                                    borderRadius: '6px'
                                }}>
                                    {scannedProjects.length === 0 ? (
                                        <div style={{ padding: '20px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '12px' }}>
                                            No project directories scanned yet. Specify root folder and start scan.
                                        </div>
                                    ) : (
                                        scannedProjects.map(proj => (
                                            <div key={proj.projectPath} style={{
                                                display: 'flex',
                                                justifyContent: 'space-between',
                                                alignItems: 'center',
                                                padding: '8px 12px',
                                                borderBottom: '1px solid var(--border-color)',
                                                fontSize: '12.5px'
                                            }}>
                                                <div style={{ overflow: 'hidden', flex: 1, marginRight: '16px' }}>
                                                    <div style={{ fontWeight: 600 }}>{proj.projectName}</div>
                                                    <div className="text-muted" style={{ textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap', fontSize: '11px' }}>
                                                        {proj.projectPath}
                                                    </div>
                                                </div>
                                                <button
                                                    onClick={() => handleImportScanned(proj)}
                                                    className="btn btn-primary"
                                                    style={{ padding: '4px 10px', fontSize: '11px' }}
                                                >
                                                    Import
                                                </button>
                                            </div>
                                        ))
                                    )}
                                </div>
                            </div>
                        </div>

                        <div className="modal-footer">
                            {scanning ? (
                                <button onClick={handleAbortScan} className="btn btn-danger" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                    <CloseIcon size={14} /> Cancel Scan
                                </button>
                            ) : (
                                <button onClick={handleStartScan} disabled={!scanRootPath} className="btn btn-primary" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                    <SearchIcon size={14} /> Start Scan
                                </button>
                            )}
                            <button onClick={() => setShowScanModal(false)} className="btn btn-secondary">Close</button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

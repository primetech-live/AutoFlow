import React, { useState, useEffect } from 'react';
import { SyncIcon, WarningIcon } from '../components/Icons';

interface ContainerInfo {
    name: string;
    cpu: string;
    mem: string;
    status: string;
}

interface ServerStats {
    cpu: string;
    ram: string;
    ramPercent: number;
    disk: string;
    diskPercent: number;
    uptime: string;
    latency: string;
    containers: ContainerInfo[];
}

export const LiveStatus: React.FC = () => {
    const [stats, setStats] = useState<ServerStats | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

    const fetchStats = async () => {
        setError('');
        try {
            const data = await window.autoflow.fetchServerStats();
            setStats(data);
            setLastUpdated(new Date());
        } catch (err: any) {
            setError(err.message || 'Failed to gather remote server statistics. Ensure server config is valid and online.');
        } finally {
            setLoading(false);
        }
    };

    // Poll every 8 seconds
    useEffect(() => {
        fetchStats();
        const interval = setInterval(fetchStats, 8000);
        return () => clearInterval(interval);
    }, []);

    const getBarColor = (pct: number) => {
        if (pct > 85) return 'var(--error)';
        if (pct > 65) return 'var(--warning)';
        return 'var(--accent)';
    };

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px', flex: 1, overflowY: 'auto' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--border-color)', paddingBottom: '16px' }}>
                <div>
                    <h1 className="h1">Server Monitor</h1>
                    <span className="text-secondary" style={{ fontSize: '13px' }}>
                        Live diagnostics & container parameters (SSH polled)
                    </span>
                </div>
                
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    {lastUpdated && (
                        <span className="text-muted" style={{ fontSize: '11px' }}>
                            Last update: {lastUpdated.toLocaleTimeString()}
                        </span>
                    )}
                    <button 
                        onClick={() => { setLoading(true); fetchStats(); }}
                        disabled={loading}
                        className="btn btn-secondary"
                        style={{ padding: '6px 12px', fontSize: '12px', display: 'flex', alignItems: 'center', gap: '6px' }}
                    >
                        <SyncIcon size={12} /> {loading ? 'Refreshing...' : 'Refresh Now'}
                    </button>
                </div>
            </div>

            {error && (
                <div style={{ background: 'var(--error-glow)', border: '1px solid rgba(239, 68, 68, 0.2)', color: 'var(--error)', padding: '10px 14px', borderRadius: '6px', fontSize: '13px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <WarningIcon size={14} /> {error}
                </div>
            )}

            {loading && !stats ? (
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '48px', gap: '12px', background: 'var(--bg-panel)', borderRadius: '12px', border: '1px solid var(--border-color)' }}>
                    <div style={{
                        border: '3px solid var(--border-color)',
                        borderTop: '3px solid var(--accent)',
                        borderRadius: '50%',
                        width: '32px',
                        height: '32px',
                        animation: 'spin 1s linear infinite'
                    }} />
                    <span className="text-secondary" style={{ fontSize: '13px' }}>Establishing SSH connection & parsing metrics...</span>
                    
                    <style>{`
                        @keyframes spin {
                            0% { transform: rotate(0deg); }
                            100% { transform: rotate(360deg); }
                        }
                    `}</style>
                </div>
            ) : stats ? (
                <>
                    {/* Top Stats Cards Grid */}
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '20px' }}>
                        
                        {/* CPU usage card */}
                        <div className="card">
                            <span className="form-label" style={{ fontSize: '10px', textTransform: 'uppercase' }}>CPU Load</span>
                            <div style={{ fontSize: '24px', fontWeight: 700, margin: '8px 0', color: 'var(--text-primary)' }}>
                                {stats.cpu}
                            </div>
                            {/* progress bar */}
                            <div style={{ height: '4px', background: 'var(--bg-main)', borderRadius: '2px', overflow: 'hidden' }}>
                                <div style={{
                                    height: '100%',
                                    width: stats.cpu,
                                    background: getBarColor(parseFloat(stats.cpu)),
                                    transition: 'width 0.5s ease'
                                }} />
                            </div>
                        </div>

                        {/* RAM usage card */}
                        <div className="card">
                            <span className="form-label" style={{ fontSize: '10px', textTransform: 'uppercase' }}>RAM Usage</span>
                            <div style={{ fontSize: '24px', fontWeight: 700, margin: '8px 0', color: 'var(--text-primary)' }}>
                                {stats.ram}
                            </div>
                            <div style={{ height: '4px', background: 'var(--bg-main)', borderRadius: '2px', overflow: 'hidden' }}>
                                <div style={{
                                    height: '100%',
                                    width: `${stats.ramPercent}%`,
                                    background: getBarColor(stats.ramPercent),
                                    transition: 'width 0.5s ease'
                                }} />
                            </div>
                        </div>

                        {/* Disk usage card */}
                        <div className="card">
                            <span className="form-label" style={{ fontSize: '10px', textTransform: 'uppercase' }}>Disk Space</span>
                            <div style={{ fontSize: '24px', fontWeight: 700, margin: '8px 0', color: 'var(--text-primary)' }}>
                                {stats.disk}
                            </div>
                            <div style={{ height: '4px', background: 'var(--bg-main)', borderRadius: '2px', overflow: 'hidden' }}>
                                <div style={{
                                    height: '100%',
                                    width: `${stats.diskPercent}%`,
                                    background: getBarColor(stats.diskPercent),
                                    transition: 'width 0.5s ease'
                                }} />
                            </div>
                        </div>

                        {/* Network latency card */}
                        <div className="card">
                            <span className="form-label" style={{ fontSize: '10px', textTransform: 'uppercase' }}>SSH Latency</span>
                            <div style={{ fontSize: '24px', fontWeight: 700, margin: '8px 0', color: 'var(--info)' }}>
                                {stats.latency}
                            </div>
                            <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                                Uptime: {stats.uptime}
                            </div>
                        </div>

                    </div>

                    {/* Containers Table Section */}
                    <div style={{
                        background: 'var(--bg-panel)',
                        border: '1px solid var(--border-color)',
                        borderRadius: '8px',
                        padding: '20px',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '16px'
                    }}>
                        <h3 className="h2" style={{ fontSize: '15px' }}>Running Containers ({stats.containers.length})</h3>
                        
                        <div style={{ overflowX: 'auto' }}>
                            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '13px' }}>
                                <thead>
                                    <tr style={{ borderBottom: '1px solid var(--border-color)', color: 'var(--text-secondary)' }}>
                                        <th style={{ padding: '12px 16px', fontWeight: 600 }}>Container Name</th>
                                        <th style={{ padding: '12px 16px', fontWeight: 600 }}>Status</th>
                                        <th style={{ padding: '12px 16px', fontWeight: 600 }}>CPU %</th>
                                        <th style={{ padding: '12px 16px', fontWeight: 600 }}>Memory Usage</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {stats.containers.length === 0 ? (
                                        <tr>
                                            <td colSpan={4} style={{ padding: '24px', textAlign: 'center', color: 'var(--text-muted)' }}>
                                                No active Docker containers running on the remote host.
                                            </td>
                                        </tr>
                                    ) : (
                                        stats.containers.map((container, idx) => {
                                            const isUp = container.status.toLowerCase().includes('up');
                                            
                                            return (
                                                <tr key={idx} style={{ borderBottom: '1px solid var(--border-color)', background: idx % 2 === 0 ? 'rgba(255,255,255,0.01)' : 'transparent' }}>
                                                    <td style={{ padding: '12px 16px', fontWeight: 600, color: 'var(--text-primary)', fontFamily: 'monospace' }}>
                                                        {container.name}
                                                    </td>
                                                    <td style={{ padding: '12px 16px' }}>
                                                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                                            <span style={{
                                                                width: '6px',
                                                                height: '6px',
                                                                borderRadius: '50%',
                                                                background: isUp ? 'var(--accent)' : 'var(--error)'
                                                            }} />
                                                            <span style={{ color: isUp ? 'var(--text-primary)' : 'var(--text-secondary)' }}>
                                                                {container.status}
                                                            </span>
                                                        </div>
                                                    </td>
                                                    <td style={{ padding: '12px 16px', fontFamily: 'monospace', color: 'var(--text-secondary)' }}>
                                                        {container.cpu}
                                                    </td>
                                                    <td style={{ padding: '12px 16px', fontFamily: 'monospace', color: 'var(--text-secondary)' }}>
                                                        {container.mem}
                                                    </td>
                                                </tr>
                                            );
                                        })
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </>
            ) : null}
        </div>
    );
};

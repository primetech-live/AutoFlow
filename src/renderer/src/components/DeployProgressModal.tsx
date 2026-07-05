import React, { useEffect, useRef, useState } from 'react';
import { CloseIcon, SuccessIcon, WarningIcon } from './Icons';

interface DeployLog {
    timestamp: number;
    type: 'info' | 'success' | 'error' | 'warning' | 'header' | 'stream';
    message: string;
    step?: string;
}

interface DeployProgressModalProps {
    activeDeploy: {
        projectName: string;
        status: 'running' | 'success' | 'failed';
        step?: string;
        logs: DeployLog[];
    };
    onClose: () => void;
}

export const DeployProgressModal: React.FC<DeployProgressModalProps> = ({ activeDeploy, onClose }) => {
    const terminalRef = useRef<HTMLDivElement>(null);
    const xtermRef = useRef<any>(null);
    const lastLogCountRef = useRef(0);
    const [copied, setCopied] = useState(false);

    // Reset log counter whenever a new deployment starts (logs array resets to 1 item)
    useEffect(() => {
        if (activeDeploy.logs.length <= 1) {
            lastLogCountRef.current = 0;
        }
    }, [activeDeploy.projectName]);

    // Initialize xterm.js
    useEffect(() => {
        if (!terminalRef.current) return;
        
        const Terminal = (window as any).Terminal;
        const FitAddon = (window as any).FitAddon?.FitAddon;
        
        if (!Terminal) {
            console.error('xterm.js not loaded from CDN');
            return;
        }

        const term = new Terminal({
            theme: {
                background: '#0E0E10',
                foreground: '#F0F0F2',
                cursor: '#06B6D4',
                black: '#0E0E10',
                red: '#EF4444',
                green: '#10B981',
                yellow: '#F59E0B',
                blue: '#3B82F6',
                magenta: '#8B5CF6',
                cyan: '#06B6D4',
                white: '#F0F0F2',
            },
            fontFamily: '"JetBrains Mono", monospace',
            fontSize: 12,
            cursorBlink: true,
            disableStdin: true
        });

        let fitAddon: any;
        if (FitAddon) {
            fitAddon = new FitAddon();
            term.loadAddon(fitAddon);
        }

        term.open(terminalRef.current);
        if (fitAddon) fitAddon.fit();
        xtermRef.current = term;

        // Resize observer
        const ro = new ResizeObserver(() => {
            if (fitAddon) fitAddon.fit();
        });
        ro.observe(terminalRef.current);

        return () => {
            ro.disconnect();
            term.dispose();
        };
    }, []);

    // Feed logs into xterm
    useEffect(() => {
        const term = xtermRef.current;
        if (!term) return;

        // Only append new logs, don't clear (we want a continuous terminal)
        const newLogs = activeDeploy.logs.slice(lastLogCountRef.current);
        lastLogCountRef.current = activeDeploy.logs.length;
        
        newLogs.forEach(log => {
            let colorCode = '';
            if (log.type === 'error') colorCode = '\x1b[31m'; // Red
            else if (log.type === 'success') colorCode = '\x1b[32m'; // Green
            else if (log.type === 'warning') colorCode = '\x1b[33m'; // Yellow
            else if (log.type === 'info') colorCode = '\x1b[34m'; // Blue
            else if (log.type === 'header') colorCode = '\x1b[36;1m'; // Cyan bold
            
            const resetCode = '\x1b[0m';
            
            // Format message and split by lines
            const lines = log.message.split('\n');
            lines.forEach(line => {
                if (log.type === 'stream') {
                    term.writeln(line); // Stream already has ANSI if any
                } else {
                    term.writeln(`${colorCode}${line}${resetCode}`);
                }
            });
        });
    }, [activeDeploy.logs]);

    // Auto-close on success
    useEffect(() => {
        if (activeDeploy.status === 'success') {
            // Don't auto-close immediately - let user see the success message
            // Close when user clicks the button instead
            return () => {};
        }
    }, [activeDeploy.status, onClose]);

    // Calculate progress percentage based on log content
    const logText = activeDeploy.logs.map(l => l.message.toLowerCase()).join(' ');
    let progressPct = 0;
    
    if (activeDeploy.status === 'success') {
        progressPct = 100;
    } else if (activeDeploy.status === 'failed') {
        progressPct = 100; // Fills up in red
    } else {
        // Progress based on strict deployment log messages to prevent false positives
        if (logText.includes('running local ci') || logText.includes('local ci checks')) progressPct = 10;
        if (logText.includes('pushing to remote branch') || logText.includes('syncing local repository')) progressPct = 25;
        if (logText.includes('remote ci (github actions)')) progressPct = 40;
        if (logText.includes('using persistent connection') || logText.includes('connecting to')) progressPct = 50;
        if (logText.includes('building docker image')) progressPct = 65;
        if (logText.includes('starting new container')) progressPct = 80;
        if (logText.includes('running health check') || logText.includes('verifying deployment')) progressPct = 90;
        if (logText.includes('deployment complete') || logText.includes('live at:')) progressPct = 100;
        
        // Ensure minimum progress is shown
        progressPct = Math.max(10, Math.min(100, progressPct));
    }

    const isRunning = activeDeploy.status === 'running';

    return (
        <div className="modal-overlay" style={{ zIndex: 999, top: '38px' }}>
            <div className="modal-content" style={{ width: '800px', maxWidth: '95vw', background: 'var(--bg-main)' }}>
                <div className="modal-header">
                    <h3 className="h2" style={{ fontSize: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                        Deploying: <span style={{ color: 'var(--accent)' }}>{activeDeploy.projectName}</span>
                    </h3>
                </div>

                <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: '16px', padding: '24px' }}>
                    {/* Status Header */}
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '13px', fontWeight: 600 }}>
                        <div style={{ color: activeDeploy.status === 'failed' ? 'var(--error)' : activeDeploy.status === 'success' ? '#10B981' : 'var(--text-primary)' }}>
                            {activeDeploy.status === 'running' && `Deploying... [${activeDeploy.step || 'Running'}]`}
                            {activeDeploy.status === 'success' && `Deployment Successful! [Live]`}
                            {activeDeploy.status === 'failed' && `Deployment Failed`}
                        </div>
                        <div style={{ color: 'var(--text-muted)' }}>
                            {Math.round(progressPct)}%
                        </div>
                    </div>

                    {/* Progress Bar */}
                    <div style={{ width: '100%', height: '4px', background: 'var(--bg-card)', borderRadius: '2px', overflow: 'hidden' }}>
                        <div style={{ 
                            height: '100%', 
                            width: `${progressPct}%`, 
                            background: activeDeploy.status === 'failed' ? 'var(--error)' : activeDeploy.status === 'success' ? '#10B981' : 'var(--accent)',
                            transition: 'width 0.3s ease-out, background 0.3s ease-out',
                            boxShadow: activeDeploy.status === 'running' ? '0 0 10px var(--accent-glow)' : 'none'
                        }} />
                    </div>

                    {/* Authentic xterm.js Terminal Container */}
                    <div 
                        style={{ 
                            background: '#0E0E10', 
                            border: `1px solid ${activeDeploy.status === 'failed' ? 'var(--error)' : 'var(--border-color)'}`, 
                            borderRadius: '8px', 
                            padding: '12px',
                            height: '400px',
                            width: '100%',
                            boxShadow: 'inset 0 2px 10px rgba(0,0,0,0.5)',
                            overflow: 'hidden'
                        }}
                    >
                        <div ref={terminalRef} style={{ width: '100%', height: '100%' }} />
                    </div>

                    {/* Footer Actions */}
                    <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', marginTop: '8px' }}>
                        <button 
                            onClick={() => {
                                const logText = activeDeploy.logs.map(l => l.message).join('\n');
                                navigator.clipboard.writeText(logText);
                                setCopied(true);
                                setTimeout(() => setCopied(false), 2000);
                            }} 
                            className="btn btn-secondary" 
                            style={{ padding: '8px 24px' }}
                        >
                            {copied ? 'Copied!' : 'Copy Logs'}
                        </button>
                        {!isRunning && (
                            <button onClick={onClose} className="btn btn-primary" style={{ padding: '8px 24px' }}>
                                Close
                            </button>
                        )}
                    </div>
                </div>
            </div>

            <style>{`
                @keyframes shimmer {
                    0% { transform: translateX(-100%); }
                    100% { transform: translateX(100%); }
                }
            `}</style>
        </div>
    );
};

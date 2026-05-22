import React, { useState, useMemo, useRef, useEffect } from 'react';
import { CopyIcon, DownloadIcon, TrashIcon } from './Icons';

export interface LogLine {
    timestamp: number;
    type: 'info' | 'success' | 'warning' | 'error' | 'header';
    message: string;
    step: string;
}

interface LoggerConsoleProps {
    logs: LogLine[];
    onClear: () => void;
    projectName: string;
}

export const LoggerConsole: React.FC<LoggerConsoleProps> = ({ logs, onClear, projectName }) => {
    const [searchQuery, setSearchQuery] = useState('');
    const [stepFilter, setStepFilter] = useState('All');
    const terminalEndRef = useRef<HTMLDivElement>(null);

    // Extract unique steps from logs
    const steps = useMemo(() => {
        const set = new Set<string>();
        logs.forEach(l => {
            if (l.step) set.add(l.step);
        });
        return ['All', ...Array.from(set)];
    }, [logs]);

    // Filtered logs
    const filteredLogs = useMemo(() => {
        return logs.filter(line => {
            const matchesSearch = line.message.toLowerCase().includes(searchQuery.toLowerCase()) ||
                line.step.toLowerCase().includes(searchQuery.toLowerCase());
            const matchesStep = stepFilter === 'All' || line.step === stepFilter;
            return matchesSearch && matchesStep;
        });
    }, [logs, searchQuery, stepFilter]);

    // Auto-scroll on new log lines
    useEffect(() => {
        terminalEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [filteredLogs]);

    const handleCopy = () => {
        const text = filteredLogs.map(l => `[${new Date(l.timestamp).toLocaleTimeString()}] [${l.step}] ${l.message}`).join('\n');
        navigator.clipboard.writeText(text);
        alert('Logs copied to clipboard!');
    };

    const handleExport = () => {
        const text = filteredLogs.map(l => `[${new Date(l.timestamp).toLocaleTimeString()}] [${l.step}] ${l.message}`).join('\n');
        const blob = new Blob([text], { type: 'text/plain' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `autoflow-${projectName}-deploy.log`;
        a.click();
        URL.revokeObjectURL(url);
    };

    return (
        <div style={{
            background: '#0B0B0D',
            border: '1px solid var(--border-color)',
            borderRadius: '8px',
            display: 'flex',
            flexDirection: 'column',
            flex: 1,
            overflow: 'hidden',
            maxHeight: '450px'
        }}>
            {/* Header / Actions Bar */}
            <div style={{
                background: 'var(--bg-panel)',
                padding: '8px 16px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                borderBottom: '1px solid var(--border-color)',
                flexWrap: 'wrap',
                gap: '10px'
            }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-secondary)' }}>DEPLOYMENT LOGS</span>
                    <span style={{
                        fontSize: '10px',
                        background: '#232329',
                        padding: '1px 6px',
                        borderRadius: '3px',
                        color: 'var(--accent)'
                    }}>{filteredLogs.length} lines</span>
                </div>
                
                <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                    {/* Search Field */}
                    <input
                        type="text"
                        placeholder="Search logs..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        style={{
                            background: 'var(--bg-main)',
                            border: '1px solid var(--border-color)',
                            borderRadius: '4px',
                            padding: '4px 8px',
                            fontSize: '11px',
                            color: 'white',
                            outline: 'none'
                        }}
                    />

                    {/* Step Filter Dropdown */}
                    <select
                        value={stepFilter}
                        onChange={(e) => setStepFilter(e.target.value)}
                        style={{
                            background: 'var(--bg-main)',
                            border: '1px solid var(--border-color)',
                            borderRadius: '4px',
                            padding: '4px 8px',
                            fontSize: '11px',
                            color: 'white',
                            outline: 'none'
                        }}
                    >
                        {steps.map(step => (
                            <option key={step} value={step}>{step}</option>
                        ))}
                    </select>

                    <button className="btn btn-secondary" onClick={handleCopy} style={{ padding: '4px 8px', fontSize: '11px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                        <CopyIcon size={12} /> Copy
                    </button>
                    
                    <button className="btn btn-secondary" onClick={handleExport} style={{ padding: '4px 8px', fontSize: '11px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                        <DownloadIcon size={12} /> Export
                    </button>

                    <button className="btn btn-secondary" onClick={onClear} style={{ padding: '4px 8px', fontSize: '11px', color: 'var(--error)', display: 'flex', alignItems: 'center', gap: '4px' }}>
                        <TrashIcon size={12} /> Clear
                    </button>
                </div>
            </div>

            {/* Console Log Lines */}
            <div style={{
                padding: '16px',
                fontFamily: '"JetBrains Mono", Consolas, monospace',
                fontSize: '12.5px',
                overflowY: 'auto',
                flex: 1,
                lineHeight: '1.7',
                background: '#070709',
            }}>
                {filteredLogs.length === 0 ? (
                    <div style={{ color: 'var(--text-muted)', textAlign: 'center', padding: '24px' }}>
                        No logs output. Trigger a deployment to stream live status.
                    </div>
                ) : (
                    filteredLogs.map((log, idx) => {
                        let color = '#8F909A'; // info default
                        let bg = 'transparent';

                        if (log.type === 'success') {
                            color = 'var(--accent)';
                        } else if (log.type === 'warning') {
                            color = 'var(--warning)';
                        } else if (log.type === 'error') {
                            color = 'var(--error)';
                            bg = 'rgba(239, 68, 68, 0.05)';
                        } else if (log.type === 'header') {
                            color = '#3B82F6';
                            bg = 'rgba(59, 130, 246, 0.05)';
                        }

                        return (
                            <div key={idx} style={{
                                color,
                                background: bg,
                                padding: '2px 4px',
                                borderLeft: log.type === 'error' ? '2px solid var(--error)' : 'none',
                                display: 'flex',
                                gap: '8px'
                            }}>
                                <span style={{ color: 'var(--text-muted)', userSelect: 'none', fontSize: '11px' }}>
                                    [{new Date(log.timestamp).toLocaleTimeString()}]
                                </span>
                                {log.step && (
                                    <span style={{ color: '#6366F1', fontWeight: 600, fontSize: '11px', minWidth: '60px' }}>
                                        [{log.step.toUpperCase()}]
                                    </span>
                                )}
                                <span style={{ whiteSpace: 'pre-wrap' }}>{log.message}</span>
                            </div>
                        );
                    })
                )}
                <div ref={terminalEndRef} />
            </div>
        </div>
    );
};

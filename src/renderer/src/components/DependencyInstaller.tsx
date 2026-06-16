import React, { useState, useEffect } from 'react';
import { SuccessIcon, WarningIcon, SyncIcon } from './Icons';

declare global {
    interface Window {
        autoflow: any;
    }
}

interface DepStatus {
    name: string;
    installed: boolean;
    category: 'Required' | 'Recommended';
    description: string;
}

interface Props {
    onClose: () => void;
}

export const DependencyInstaller: React.FC<Props> = ({ onClose }) => {
    const [step, setStep] = useState<'Analyze' | 'Review' | 'Approve' | 'Install' | 'Verify'>('Analyze');
    const [deps, setDeps] = useState<DepStatus[]>([]);
    const [pkgManager, setPkgManager] = useState<string>('unknown');
    const [selectedDeps, setSelectedDeps] = useState<Set<string>>(new Set());
    const [logs, setLogs] = useState<string[]>([]);
    
    useEffect(() => {
        if (step === 'Analyze') {
            runAnalysis(false);
        }
    }, [step]);

    useEffect(() => {
        const handleLog = (log: string) => setLogs(prev => [...prev, log]);
        window.autoflow.onInstallerLog(handleLog);
    }, []);

    const runAnalysis = async (isVerification = false) => {
        try {
            const res = await window.autoflow.checkDependencies();
            setPkgManager(res.pkgManager);
            setDeps(res.deps);
            
            // Pre-select missing required dependencies
            const toSelect = new Set<string>();
            res.deps.forEach((d: DepStatus) => {
                if (!d.installed) {
                    toSelect.add(d.name);
                }
            });
            setSelectedDeps(toSelect);

            if (res.deps.every((d: DepStatus) => d.installed || d.category === 'Recommended')) {
                // If all required are installed, maybe we just show Review and they can skip
            }
            if (!isVerification) {
                setTimeout(() => setStep('Review'), 1000); // Artificial delay for UX
            }
        } catch (err) {
            setLogs([`Analysis failed: ${err}`]);
        }
    };

    const toggleSelection = (name: string) => {
        const next = new Set(selectedDeps);
        if (next.has(name)) next.delete(name);
        else next.add(name);
        setSelectedDeps(next);
    };

    const startInstall = async () => {
        setStep('Install');
        setLogs(['Starting installation...']);
        try {
            await window.autoflow.installDependencies(Array.from(selectedDeps), pkgManager);
            setStep('Verify');
            await runAnalysis(true); // Re-run analysis for verification
        } catch (err: any) {
            setLogs(prev => [...prev, `Installation Error: ${err.message}`]);
        }
    };

    const requiredDeps = deps.filter(d => d.category === 'Required');
    const recommendedDeps = deps.filter(d => d.category === 'Recommended');

    return (
        <div className="modal-overlay">
            <div className="modal-content" style={{ width: '600px' }}>
                <div className="modal-header">
                    <h3 className="h2" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <SyncIcon size={20} color="var(--accent)" /> Server Requirements Check
                    </h3>
                </div>

                <div className="modal-body" style={{ minHeight: '300px' }}>
                    {/* Stepper Header */}
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '24px', fontSize: '12px', fontWeight: 600, color: 'var(--text-muted)' }}>
                        <span style={{ color: step === 'Analyze' ? 'var(--accent)' : 'var(--text-primary)' }}>1. Analyze</span>
                        <span style={{ color: step === 'Review' ? 'var(--accent)' : 'var(--text-primary)' }}>2. Review</span>
                        <span style={{ color: step === 'Approve' ? 'var(--accent)' : 'var(--text-primary)' }}>3. Approve</span>
                        <span style={{ color: step === 'Install' ? 'var(--accent)' : 'var(--text-primary)' }}>4. Install</span>
                        <span style={{ color: step === 'Verify' ? 'var(--accent)' : 'var(--text-primary)' }}>5. Verify</span>
                    </div>

                    {step === 'Analyze' && (
                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '200px', gap: '16px' }}>
                            <div className="spinner" style={{ width: '24px', height: '24px', border: '3px solid var(--border-color)', borderTopColor: 'var(--accent)', borderRadius: '50%', animation: 'spin 1s linear infinite' }} />
                            <p className="text-secondary">Analyzing server environment and OS ({pkgManager})...</p>
                        </div>
                    )}

                    {(step === 'Review' || step === 'Approve') && (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                            {pkgManager === 'unknown' && (
                                <div style={{ background: 'var(--error-glow)', color: 'var(--error)', padding: '12px', borderRadius: '6px', fontSize: '13px' }}>
                                    Warning: Unsupported OS detected. Dependency installation might fail.
                                </div>
                            )}
                            
                            <div>
                                <h4 style={{ marginBottom: '8px', color: 'var(--text-primary)', fontSize: '14px' }}>Required Components</h4>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                    {requiredDeps.map(dep => (
                                        <div key={dep.name} style={{ display: 'flex', alignItems: 'flex-start', gap: '12px', background: 'var(--bg-main)', padding: '12px', borderRadius: '6px', border: '1px solid var(--border-color)' }}>
                                            {step === 'Approve' && !dep.installed ? (
                                                <input type="checkbox" checked={selectedDeps.has(dep.name)} onChange={() => toggleSelection(dep.name)} style={{ marginTop: '4px' }} />
                                            ) : (
                                                dep.installed ? <SuccessIcon color="var(--accent)" /> : <WarningIcon color="var(--warning)" />
                                            )}
                                            <div>
                                                <div style={{ fontWeight: 600, fontSize: '13px', color: dep.installed ? 'var(--text-primary)' : 'var(--warning)' }}>
                                                    {dep.name} {dep.installed ? '(Installed)' : '(Missing)'}
                                                </div>
                                                <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>{dep.description}</div>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>

                            <div>
                                <h4 style={{ marginBottom: '8px', color: 'var(--text-primary)', fontSize: '14px' }}>Recommended Components</h4>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                    {recommendedDeps.map(dep => (
                                        <div key={dep.name} style={{ display: 'flex', alignItems: 'flex-start', gap: '12px', background: 'var(--bg-main)', padding: '12px', borderRadius: '6px', border: '1px solid var(--border-color)' }}>
                                            {step === 'Approve' && !dep.installed ? (
                                                <input type="checkbox" checked={selectedDeps.has(dep.name)} onChange={() => toggleSelection(dep.name)} style={{ marginTop: '4px' }} />
                                            ) : (
                                                dep.installed ? <SuccessIcon color="var(--accent)" /> : <span style={{ color: 'var(--text-muted)' }}>○</span>
                                            )}
                                            <div>
                                                <div style={{ fontWeight: 600, fontSize: '13px', color: dep.installed ? 'var(--text-primary)' : 'var(--text-secondary)' }}>
                                                    {dep.name} {dep.installed ? '(Installed)' : '(Optional)'}
                                                </div>
                                                <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>{dep.description}</div>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>
                    )}

                    {step === 'Install' && (
                        <div style={{ background: '#000', color: '#0f0', fontFamily: 'monospace', padding: '16px', borderRadius: '6px', height: '250px', overflowY: 'auto', fontSize: '12px' }}>
                            {logs.map((log, i) => <div key={i}>&gt; {log}</div>)}
                            <div className="spinner" style={{ width: '12px', height: '12px', border: '2px solid #0f0', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 1s linear infinite', marginTop: '8px' }} />
                        </div>
                    )}

                    {step === 'Verify' && (
                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '200px', gap: '16px' }}>
                            <SuccessIcon size={48} color="var(--accent)" />
                            <h3 className="h2">Server Setup Complete</h3>
                            <p className="text-secondary">All required dependencies are now installed and verified.</p>
                        </div>
                    )}
                </div>

                <div className="modal-footer">
                    {step === 'Review' && (
                        <>
                            <button className="btn btn-secondary" onClick={onClose}>Skip for now</button>
                            <button className="btn btn-primary" onClick={() => setStep('Approve')}>Continue to Approve</button>
                        </>
                    )}
                    {step === 'Approve' && (
                        <>
                            <button className="btn btn-secondary" onClick={() => setStep('Review')}>Back</button>
                            <button className="btn btn-primary" onClick={startInstall} disabled={selectedDeps.size === 0}>
                                Install {selectedDeps.size} Packages
                            </button>
                        </>
                    )}
                    {step === 'Verify' && (
                        <button className="btn btn-primary" onClick={onClose}>Finish</button>
                    )}
                </div>
            </div>
            <style>{`@keyframes spin { 100% { transform: rotate(360deg); } }`}</style>
        </div>
    );
};

import React, { useState, useEffect } from 'react';
import { SuccessIcon, WarningIcon, SyncIcon, TrashIcon, DownloadIcon } from '../components/Icons';
import { DependencyInstaller } from '../components/DependencyInstaller';
import { useTheme } from '../contexts/ThemeContext';
import { PasswordInput } from '../components/PasswordInput';

interface SettingsProps {
    onReRunOnboarding: () => void;
    onResetConfig: () => void;
    showConfirm: (opts: { title: string; message: string; confirmLabel?: string; danger?: boolean; onConfirm: () => void }) => void;
}

export const Settings: React.FC<SettingsProps> = ({ onReRunOnboarding, onResetConfig, showConfirm }) => {
    const { theme, setTheme } = useTheme();

    // Config states
    const [serverIp, setServerIp] = useState('');
    const [sshUser, setSshUser] = useState('');
    const [sshPort, setSshPort] = useState('22');
    const [sshKeyPath, setSshKeyPath] = useState('');
    const [sshPassword, setSshPassword] = useState('');

    const [loading, setLoading] = useState(false);
    const [saveStatus, setSaveStatus] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
    const [showDependencyInstaller, setShowDependencyInstaller] = useState(false);

    const [cliStatus, setCliStatus] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
    const [installingCli, setInstallingCli] = useState(false);

    // Fetch existing settings on load
    useEffect(() => {
        const fetchConfig = async () => {
            try {
                const config = await window.autoflow.loadGlobalConfig();
                if (config) {
                    setServerIp(config.serverIp || '');
                    setSshUser(config.sshUser || '');
                    setSshPort(config.sshPort || '22');
                    setSshKeyPath(config.sshKeyPath || '');
                }
            } catch (err: any) {
                // Ignore missing config or failure on start
            }
        };
        fetchConfig();
    }, []);

    const handleBrowseKey = async () => {
        try {
            const filepath = await window.autoflow.browseFile();
            if (filepath) {
                setSshKeyPath(filepath);
            }
        } catch {
            // Cancelled browse
        }
    };

    const handleSaveConfig = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setSaveStatus(null);

        if (!serverIp || !sshUser || !sshPort || !sshKeyPath) {
            setSaveStatus({ type: 'error', message: 'All server parameters are required.' });
            setLoading(false);
            return;
        }

        try {
            await window.autoflow.saveGlobalConfig({
                serverIp,
                sshUser,
                sshPort,
                sshKeyPath
            });
            if (sshPassword) {
                await window.autoflow.invoke('vault:save-ssh-password', sshPassword);
                setSshPassword(''); // Clear for security
            }
            // Reconnect SSH with the new settings
            await window.autoflow.disconnectFromServer();
            await window.autoflow.connectToServer();
            setSaveStatus({ type: 'success', message: 'Server configuration saved. SSH reconnected.' });
        } catch (err: any) {
            setSaveStatus({ type: 'error', message: err.message || 'Failed to save configuration.' });
        } finally {
            setLoading(false);
        }
    };

    const handleInstallCli = async () => {
        setInstallingCli(true);
        setCliStatus(null);
        try {
            const result = await window.autoflow.installCli();
            if (result.success) {
                setCliStatus({ type: 'success', message: result.message || 'CLI installed successfully.' });
            } else {
                setCliStatus({ type: 'error', message: result.error || 'Failed to install CLI.' });
            }
        } catch (err: any) {
            setCliStatus({ type: 'error', message: err.message || 'An unexpected error occurred.' });
        } finally {
            setInstallingCli(false);
        }
    };

    const handleReRunOnboardingClick = () => {
        showConfirm({
            title: 'Re-run Onboarding',
            message: 'This will clear the active connection settings and log you out. You will need to re-enter your server details.',
            confirmLabel: 'Continue',
            danger: false,
            onConfirm: onReRunOnboarding
        });
    };

    const handleResetAllClick = () => {
        showConfirm({
            title: 'Factory Reset',
            message: 'This will permanently delete all connection details, lock the vault database, and clear the saved projects list. This action cannot be undone.',
            confirmLabel: 'Reset Everything',
            danger: true,
            onConfirm: onResetConfig
        });
    };

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px', flex: 1, overflowY: 'auto', paddingRight: '4px' }}>
            <div>
                <h1 className="h1">Settings</h1>
                <span className="text-secondary" style={{ fontSize: '13px' }}>Manage server connections, onboarding settings, and system state</span>
            </div>

            <div style={{ display: 'flex', gap: '24px', flexWrap: 'wrap' }}>
                {/* Left card: Edit Server Connection */}
                <div className="card" style={{ flex: 2, minWidth: '400px' }}>
                    <h3 className="h2" style={{ fontSize: '16px', marginBottom: '20px', borderBottom: '1px solid var(--border-color)', paddingBottom: '10px' }}>
                        VPS Server Configuration
                    </h3>

                    {saveStatus && (
                        <div style={{
                            background: saveStatus.type === 'success' ? 'var(--accent-glow)' : 'var(--error-glow)',
                            border: `1px solid ${saveStatus.type === 'success' ? 'rgba(16, 185, 129, 0.2)' : 'rgba(239, 68, 68, 0.2)'}`,
                            color: saveStatus.type === 'success' ? 'var(--accent)' : 'var(--error)',
                            padding: '10px 14px',
                            borderRadius: '6px',
                            fontSize: '12.5px',
                            marginBottom: '20px',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '6px'
                        }}>
                            {saveStatus.type === 'success' ? <SuccessIcon size={14} /> : <WarningIcon size={14} />} {saveStatus.message}
                        </div>
                    )}

                    <form onSubmit={handleSaveConfig} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                        <div className="form-group" style={{ marginBottom: 0 }}>
                            <label className="form-label">Server IP Address</label>
                            <input
                                type="text"
                                required
                                placeholder="192.168.1.100"
                                className="input"
                                value={serverIp}
                                onChange={(e) => setServerIp(e.target.value)}
                            />
                        </div>

                        <div style={{ display: 'flex', gap: '16px' }}>
                            <div className="form-group" style={{ flex: 2, marginBottom: 0 }}>
                                <label className="form-label">SSH Username</label>
                                <input
                                    type="text"
                                    required
                                    placeholder="root"
                                    className="input"
                                    value={sshUser}
                                    onChange={(e) => setSshUser(e.target.value)}
                                />
                            </div>
                            <div className="form-group" style={{ flex: 1, marginBottom: 0 }}>
                                <label className="form-label">SSH Port</label>
                                <input
                                    type="text"
                                    required
                                    placeholder="22"
                                    className="input"
                                    value={sshPort}
                                    onChange={(e) => setSshPort(e.target.value)}
                                />
                            </div>
                        </div>

                        <div className="form-group" style={{ marginBottom: '12px' }}>
                            <label className="form-label">SSH Private Key Path</label>
                            <div style={{ display: 'flex', gap: '8px' }}>
                                <input
                                    type="text"
                                    required
                                    placeholder="C:\Users\username\.ssh\id_rsa"
                                    className="input"
                                    value={sshKeyPath}
                                    onChange={(e) => setSshKeyPath(e.target.value)}
                                    style={{ flex: 1 }}
                                />
                                <button
                                    type="button"
                                    onClick={handleBrowseKey}
                                    className="btn btn-secondary"
                                >
                                    Browse
                                </button>
                            </div>
                        </div>

                        <div className="form-group" style={{ marginBottom: '12px' }}>
                            <label className="form-label">SSH Password Fallback (Optional, securely stored in Vault)</label>
                            <PasswordInput
                                placeholder="Leave empty to keep existing password"
                                value={sshPassword}
                                onChange={(e) => setSshPassword(e.target.value)}
                            />
                        </div>

                        <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '8px' }}>
                            <button
                                type="submit"
                                disabled={loading}
                                className="btn btn-primary"
                                style={{ padding: '10px 24px' }}
                            >
                                {loading ? 'Saving...' : 'Save Configuration'}
                            </button>
                        </div>
                    </form>
                </div>

                {/* Right card: System Maintenance & Danger Zone */}
                <div style={{ flex: 1, minWidth: '300px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
                    <div className="card">
                        <h3 className="h2" style={{ fontSize: '15px', marginBottom: '12px' }}>
                            Theme Preference
                        </h3>
                        <p className="text-secondary" style={{ fontSize: '12.5px', lineHeight: '1.5', marginBottom: '16px' }}>
                            Select your UI theme. System syncs with your OS.
                        </p>
                        <select 
                            className="input" 
                            value={theme}
                            onChange={(e) => setTheme(e.target.value as any)}
                            style={{ width: '100%' }}
                        >
                            <option value="light">Light Theme</option>
                            <option value="dark">Dark Theme</option>
                            <option value="system">System (Auto sync)</option>
                        </select>
                    </div>

                    <div className="card">
                        <h3 className="h2" style={{ fontSize: '15px', marginBottom: '12px' }}>
                            Onboarding Assistant
                        </h3>
                        <p className="text-secondary" style={{ fontSize: '12.5px', lineHeight: '1.5', marginBottom: '16px' }}>
                            Wipe server profiles cached in this session and restart the Step-by-Step server onboarding setup.
                        </p>
                        <button
                            onClick={handleReRunOnboardingClick}
                            className="btn btn-secondary"
                            style={{ width: '100%', padding: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}
                        >
                            <SyncIcon size={14} /> Re-run Onboarding
                        </button>
                    </div>

                    <div className="card">
                        <h3 className="h2" style={{ fontSize: '15px', marginBottom: '12px' }}>
                            Server Requirements
                        </h3>
                        <p className="text-secondary" style={{ fontSize: '12.5px', lineHeight: '1.5', marginBottom: '16px' }}>
                            Analyze your server environment and install missing dependencies like Git, Docker, and Nginx.
                        </p>
                        <button
                            onClick={() => setShowDependencyInstaller(true)}
                            className="btn btn-secondary"
                            style={{ width: '100%', padding: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}
                        >
                            <DownloadIcon size={14} /> Run Dependency Check
                        </button>
                    </div>

                    <div className="card">
                        <h3 className="h2" style={{ fontSize: '15px', marginBottom: '12px' }}>
                            Terminal Integration
                        </h3>
                        <p className="text-secondary" style={{ fontSize: '12.5px', lineHeight: '1.5', marginBottom: '16px' }}>
                            Install the standalone AutoFlow CLI globally so you can run 'autoflow' directly from your terminal.
                        </p>
                        {cliStatus && (
                            <div style={{
                                background: cliStatus.type === 'success' ? 'var(--accent-glow)' : 'var(--error-glow)',
                                color: cliStatus.type === 'success' ? 'var(--accent)' : 'var(--error)',
                                padding: '8px',
                                borderRadius: '4px',
                                fontSize: '12px',
                                marginBottom: '12px',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '6px'
                            }}>
                                {cliStatus.message}
                            </div>
                        )}
                        <button
                            onClick={handleInstallCli}
                            disabled={installingCli}
                            className="btn btn-secondary"
                            style={{ width: '100%', padding: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}
                        >
                            {installingCli ? 'Installing...' : 'Install Global CLI'}
                        </button>
                    </div>

                    <div className="card" style={{ border: '1px solid rgba(239, 68, 68, 0.3)' }}>
                        <h3 className="h2" style={{ fontSize: '15px', marginBottom: '12px', color: 'var(--error)' }}>
                            Danger Zone
                        </h3>
                        <p className="text-secondary" style={{ fontSize: '12.5px', lineHeight: '1.5', marginBottom: '16px' }}>
                            Perform a full factory reset. This deletes server keys, encryption vaults, credentials, and imported project paths from your computer.
                        </p>
                        <button
                            onClick={handleResetAllClick}
                            className="btn btn-danger"
                            style={{ width: '100%', padding: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}
                        >
                            <TrashIcon size={14} /> Reset Configuration
                        </button>
                    </div>
                </div>
            </div>

            {showDependencyInstaller && (
                <DependencyInstaller onClose={() => setShowDependencyInstaller(false)} />
            )}
        </div>
    );
};

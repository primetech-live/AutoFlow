import React, { useState, useEffect } from 'react';
import { WarningIcon } from '../components/Icons';
import { QRCodeSVG } from 'qrcode.react';
import { useTheme } from '../contexts/ThemeContext';
import { PasswordInput } from '../components/PasswordInput';

interface OnboardingProps {
    onComplete: () => void;
}

export const Onboarding: React.FC<OnboardingProps> = ({ onComplete }) => {
    const [step, setStep] = useState(0);
    const { theme, setTheme } = useTheme();
    
    // Server state
    const [serverIp, setServerIp] = useState('');
    const [sshUser, setSshUser] = useState('root');
    const [sshPort, setSshPort] = useState('22');
    const [sshKeyPath, setSshKeyPath] = useState('');
    const [sshAuthMethod, setSshAuthMethod] = useState<'key' | 'password'>('key');
    const [sshPassword, setSshPassword] = useState('');
    
    // Security state
    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [totpSecret, setTotpSecret] = useState('');
    const [otpUrl, setOtpUrl] = useState('');
    const [otpCode, setOtpCode] = useState('');
    
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);

    // Generate TOTP secret when entering step 2
    useEffect(() => {
        if (step === 2 && !totpSecret) {
            (window as any).autoflow.generateTOTPSecret().then((res: any) => {
                setTotpSecret(res.secret);
                setOtpUrl(res.otpauthUrl);
            });
        }
    }, [step]);

    const handleBrowseKey = async () => {
        try {
            const filepath = await (window as any).autoflow.browseFile();
            if (filepath) {
                setSshKeyPath(filepath);
            }
        } catch {
            // Ignore browse cancel/error
        }
    };

    const handleServerSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        setError('');
        if (!serverIp || !sshUser || !sshPort) {
            setError('Please fill in all server configuration parameters.');
            return;
        }
        if (sshAuthMethod === 'key' && !sshKeyPath) {
            setError('Please provide a path to your SSH Private Key.');
            return;
        }
        if (sshAuthMethod === 'password' && !sshPassword) {
            setError('Please enter the SSH password for your server.');
            return;
        }
        setStep(2);
    };

    const handleCompleteOnboarding = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');
        setLoading(true);

        if (password !== confirmPassword) {
            setError('Master passwords do not match.');
            setLoading(false);
            return;
        }

        if (password.length < 8) {
            setError('Master password must be at least 8 characters long.');
            setLoading(false);
            return;
        }

        try {
            // 1. Setup the vault
            await (window as any).autoflow.setupVault(password, totpSecret);
            
            // 2. Unlock vault session temporarily (this is implicit in setupVault, but we double unlock just in case)
            const unlocked = await (window as any).autoflow.unlockVault(password, otpCode);
            if (!unlocked) {
                setError('OTP verification failed. Please enter the correct 6-digit code from Google Authenticator.');
                setLoading(false);
                return;
            }

            // 3. Save the global server config
            await (window as any).autoflow.saveGlobalConfig({
                serverIp,
                sshUser,
                sshPort,
                sshKeyPath: sshAuthMethod === 'key' ? sshKeyPath : ''
            });

            // 4. Save SSH Password to vault if password auth was selected
            if (sshAuthMethod === 'password' && sshPassword) {
                await (window as any).autoflow.saveSshPassword(sshPassword);
            }

            onComplete();
        } catch (err: any) {
            setError(err.message || 'Onboarding configuration failed.');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div style={{
            background: 'var(--bg-main)',
            height: '100%',
            width: '100%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '24px',
            overflowY: 'auto'
        }}>
            <div style={{
                background: 'var(--bg-panel)',
                border: '1px solid var(--border-color)',
                borderRadius: '12px',
                padding: '40px',
                width: '520px',
                maxWidth: '100%',
                boxShadow: '0 10px 25px rgba(0,0,0,0.5)',
            }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '32px' }}>
                    <div>
                        <h1 className="h1" style={{ fontSize: '20px' }}>Setup Autoflow vNext</h1>
                        <span className="text-secondary" style={{ fontSize: '12px' }}>Initialize your deployment dashboard</span>
                    </div>
                    <div style={{
                        fontSize: '12px',
                        fontWeight: 700,
                        background: 'var(--border-color)',
                        padding: '4px 10px',
                        borderRadius: '12px',
                        color: 'var(--accent)'
                    }}>
                        STEP {step + 1} OF 3
                    </div>
                </div>

                {error && (
                    <div style={{
                        background: 'var(--error-glow)',
                        border: '1px solid rgba(239, 68, 68, 0.2)',
                        color: 'var(--error)',
                        padding: '10px 14px',
                        borderRadius: '6px',
                        fontSize: '12.5px',
                        marginBottom: '20px',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '6px'
                    }}>
                        <WarningIcon size={14} /> {error}
                    </div>
                )}

                {step === 0 ? (
                    <div>
                        <h3 className="h2" style={{ fontSize: '15px', marginBottom: '16px' }}>0. Theme Preference</h3>
                        <p className="text-secondary" style={{ fontSize: '13px', marginBottom: '24px' }}>
                            Choose a theme for your AutoFlow dashboard. You can always change this later in Settings.
                        </p>
                        
                        <div style={{ display: 'flex', gap: '16px', marginBottom: '32px' }}>
                            {['light', 'dark', 'system'].map((t) => (
                                <div 
                                    key={t}
                                    onClick={() => setTheme(t as 'light'|'dark'|'system')}
                                    style={{
                                        flex: 1,
                                        height: '100px',
                                        borderRadius: '8px',
                                        border: `2px solid ${theme === t ? 'var(--accent)' : 'var(--border-color)'}`,
                                        background: t === 'light' ? '#F7F9FC' : t === 'dark' ? '#0E0E10' : 'linear-gradient(135deg, #F7F9FC 50%, #0E0E10 50%)',
                                        cursor: 'pointer',
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        flexDirection: 'column',
                                        color: t === 'light' ? '#0F172A' : t === 'dark' ? '#F0F0F2' : 'var(--text-primary)',
                                        boxShadow: theme === t ? '0 0 15px var(--accent-glow)' : 'none',
                                        transition: 'all 0.2s'
                                    }}
                                >
                                    <span style={{ fontWeight: 600, fontSize: '14px', textTransform: 'capitalize' }}>{t}</span>
                                </div>
                            ))}
                        </div>

                        <button
                            type="button"
                            onClick={() => setStep(1)}
                            className="btn btn-primary"
                            style={{ width: '100%', padding: '12px' }}
                        >
                            Next: Server Setup →
                        </button>
                    </div>
                ) : step === 1 ? (
                    <form onSubmit={handleServerSubmit}>
                        <h3 className="h2" style={{ fontSize: '15px', marginBottom: '16px' }}>1. Remote VPS Server Credentials</h3>
                        
                        <div className="form-group">
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
                            <div className="form-group" style={{ flex: 2 }}>
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
                            <div className="form-group" style={{ flex: 1 }}>
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

                        {/* SSH Auth Method Toggle */}
                        <div className="form-group">
                            <label className="form-label">Authentication Method</label>
                            <div style={{
                                display: 'flex',
                                background: 'var(--bg-main)',
                                border: '1px solid var(--border-color)',
                                borderRadius: '8px',
                                padding: '4px',
                                gap: '4px',
                                marginBottom: '16px'
                            }}>
                                {(['key', 'password'] as const).map((method) => (
                                    <button
                                        key={method}
                                        type="button"
                                        onClick={() => { setSshAuthMethod(method); setError(''); }}
                                        style={{
                                            flex: 1,
                                            padding: '8px 12px',
                                            borderRadius: '6px',
                                            border: 'none',
                                            cursor: 'pointer',
                                            fontSize: '13px',
                                            fontWeight: 600,
                                            transition: 'all 0.18s ease',
                                            background: sshAuthMethod === method ? 'var(--accent)' : 'transparent',
                                            color: sshAuthMethod === method ? '#fff' : 'var(--text-secondary)',
                                            boxShadow: sshAuthMethod === method ? '0 2px 8px var(--accent-glow)' : 'none'
                                        }}
                                    >
                                        {method === 'key' ? '🔑  SSH Private Key' : '🔒  SSH Password'}
                                    </button>
                                ))}
                            </div>
                        </div>

                        {/* Conditional: SSH Key Path */}
                        {sshAuthMethod === 'key' && (
                            <div className="form-group" style={{ marginBottom: '32px' }}>
                                <label className="form-label">SSH Private Key Path</label>
                                <div style={{ display: 'flex', gap: '8px' }}>
                                    <input
                                        type="text"
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
                                <span style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '6px', display: 'block' }}>
                                    Recommended — more secure than passwords. Generate with <code style={{ fontSize: '10px' }}>ssh-keygen</code>.
                                </span>
                            </div>
                        )}

                        {/* Conditional: SSH Password */}
                        {sshAuthMethod === 'password' && (
                            <div className="form-group" style={{ marginBottom: '32px' }}>
                                <label className="form-label">SSH Password</label>
                                <PasswordInput
                                    placeholder="Enter your server SSH password"
                                    value={sshPassword}
                                    onChange={(e) => setSshPassword(e.target.value)}
                                />
                                <span style={{ fontSize: '11px', color: 'var(--warning)', marginTop: '6px', display: 'block' }}>
                                    ⚠️ Will be encrypted and stored securely in the AutoFlow vault.
                                </span>
                            </div>
                        )}

                        <button
                            type="submit"
                            className="btn btn-primary"
                            style={{ width: '100%', padding: '12px' }}
                        >
                            Next: Security Settings →
                        </button>
                    </form>
                ) : (
                    <form onSubmit={handleCompleteOnboarding}>
                        <h3 className="h2" style={{ fontSize: '15px', marginBottom: '16px' }}>2. Z+ Security Credentials</h3>
                        
                        <div style={{ display: 'flex', gap: '16px' }}>
                            <div className="form-group" style={{ flex: 1 }}>
                                <label className="form-label">Master Password</label>
                                <PasswordInput
                                    required
                                    placeholder="Minimum 8 chars"
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                />
                            </div>
                            <div className="form-group" style={{ flex: 1 }}>
                                <label className="form-label">Confirm Password</label>
                                <PasswordInput
                                    required
                                    placeholder="Confirm password"
                                    value={confirmPassword}
                                    onChange={(e) => setConfirmPassword(e.target.value)}
                                />
                            </div>
                        </div>

                        <div style={{
                            background: 'var(--bg-main)',
                            border: '1px solid var(--border-color)',
                            borderRadius: '8px',
                            padding: '16px',
                            marginBottom: '20px',
                            display: 'flex',
                            flexDirection: 'column',
                            alignItems: 'center',
                            gap: '12px'
                        }}>
                            <span style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)' }}>Google Authenticator Setup</span>
                            <span style={{ fontSize: '11px', color: 'var(--text-muted)', textAlign: 'center' }}>
                                Scan this QR code with your Google Authenticator app:
                            </span>
                            
                            {otpUrl ? (
                                <div style={{ background: '#fff', padding: '12px', borderRadius: '8px' }}>
                                    <QRCodeSVG value={otpUrl} size={128} level="M" />
                                </div>
                            ) : (
                                <div style={{ height: '152px', display: 'flex', alignItems: 'center' }}>Generating QR...</div>
                            )}
                            
                            <div style={{ fontSize: '10px', color: 'var(--text-muted)' }}>
                                Account Name: Autoflow vNext | Key Type: Time-based (TOTP)
                            </div>
                        </div>

                        <div className="form-group" style={{ marginBottom: '32px' }}>
                            <label className="form-label">Enter 6-digit Verification OTP</label>
                            <input
                                type="text"
                                required
                                maxLength={6}
                                pattern="\d{6}"
                                placeholder="123456"
                                className="input"
                                value={otpCode}
                                onChange={(e) => setOtpCode(e.target.value)}
                                style={{ letterSpacing: '0.2em', textAlign: 'center', fontSize: '16px', fontWeight: 700 }}
                            />
                        </div>

                        <div style={{ display: 'flex', gap: '12px' }}>
                            <button
                                type="button"
                                onClick={() => setStep(1)}
                                className="btn btn-secondary"
                                style={{ flex: 1 }}
                            >
                                Back
                            </button>
                            <button
                                type="submit"
                                disabled={loading}
                                className="btn btn-primary"
                                style={{ flex: 2 }}
                            >
                                {loading ? 'Saving Setup...' : 'Complete & Unlock'}
                            </button>
                        </div>
                    </form>
                )}
            </div>
        </div>
    );
};

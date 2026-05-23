import React, { useState, useEffect } from 'react';
import { WarningIcon } from '../components/Icons';
import { QRCodeSVG } from 'qrcode.react';

interface OnboardingProps {
    onComplete: () => void;
}

export const Onboarding: React.FC<OnboardingProps> = ({ onComplete }) => {
    const [step, setStep] = useState(1);
    
    // Server state
    const [serverIp, setServerIp] = useState('');
    const [sshUser, setSshUser] = useState('root');
    const [sshPort, setSshPort] = useState('22');
    const [sshKeyPath, setSshKeyPath] = useState('');
    
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
            window.autoflow.generateTOTPSecret().then(res => {
                setTotpSecret(res.secret);
                setOtpUrl(res.otpauthUrl);
            });
        }
    }, [step]);

    const handleBrowseKey = async () => {
        try {
            const filepath = await window.autoflow.browseFile();
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
        if (!serverIp || !sshUser || !sshPort || !sshKeyPath) {
            setError('Please fill in all server configuration parameters.');
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
            await window.autoflow.setupVault(password, totpSecret);
            
            // 2. Unlock vault session temporarily (this is implicit in setupVault, but we double unlock just in case)
            const unlocked = await window.autoflow.unlockVault(password, otpCode);
            if (!unlocked) {
                setError('OTP verification failed. Please enter the correct 6-digit code from Google Authenticator.');
                setLoading(false);
                return;
            }

            // 3. Save the global server config
            await window.autoflow.saveGlobalConfig({
                serverIp,
                sshUser,
                sshPort,
                sshKeyPath
            });

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
                        STEP {step} OF 2
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

                {step === 1 ? (
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
                                onChange={(e) => setSshUser && setServerIp(e.target.value)}
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

                        <div className="form-group" style={{ marginBottom: '32px' }}>
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
                                <input
                                    type="password"
                                    required
                                    placeholder="Minimum 8 chars"
                                    className="input"
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                />
                            </div>
                            <div className="form-group" style={{ flex: 1 }}>
                                <label className="form-label">Confirm Password</label>
                                <input
                                    type="password"
                                    required
                                    placeholder="Confirm password"
                                    className="input"
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

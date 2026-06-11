import React, { useState } from 'react';
import { LockIcon, WarningIcon } from '../components/Icons';
import appIcon from '../../assets/icon-1.png';
import { PasswordInput } from '../components/PasswordInput';

interface LockScreenProps {
    onUnlockSuccess: () => void;
    onResetRequest?: () => void;
}

export const LockScreen: React.FC<LockScreenProps> = ({ onUnlockSuccess, onResetRequest }) => {
    const [password, setPassword] = useState('');
    const [otp, setOtp] = useState('');
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');
        setLoading(true);

        try {
            const success = await window.autoflow.unlockVault(password, otp);
            if (success) {
                onUnlockSuccess();
            } else {
                setError('Invalid master password or OTP token.');
            }
        } catch (err: any) {
            setError(err.message || 'Verification failed. Try again.');
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
            flexDirection: 'column',
            padding: '24px'
        }}>
            <div style={{
                background: 'var(--bg-panel)',
                border: '1px solid var(--border-color)',
                borderRadius: '12px',
                padding: '40px',
                width: '400px',
                maxWidth: '100%',
                boxShadow: '0 10px 25px rgba(0,0,0,0.5)',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center'
            }}>
                <div style={{
                    marginBottom: '20px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center'
                }}>
                    <img src={appIcon} alt="Autoflow Icon" style={{ width: '80px', height: '80px', borderRadius: '16px' }} />
                </div>
                
                <h2 className="h2" style={{ marginBottom: '8px', textAlign: 'center' }}>Session Locked</h2>
                <p className="text-secondary" style={{ fontSize: '13px', marginBottom: '28px', textAlign: 'center' }}>
                    Enter your master password and Google Authenticator OTP to unlock the Autoflow vNext platform.
                </p>

                {error && (
                    <div style={{
                        background: 'var(--error-glow)',
                        border: '1px solid rgba(239, 68, 68, 0.2)',
                        color: 'var(--error)',
                        padding: '10px 14px',
                        borderRadius: '6px',
                        fontSize: '12.5px',
                        width: '100%',
                        marginBottom: '16px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '6px'
                    }}>
                        <WarningIcon size={14} /> {error}
                    </div>
                )}

                <form onSubmit={handleSubmit} style={{ width: '100%' }}>
                    <div className="form-group">
                        <label className="form-label">Master Password</label>
                        <PasswordInput
                            required
                            placeholder="••••••••"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                        />
                    </div>
                    
                    <div className="form-group" style={{ marginBottom: '24px' }}>
                        <label className="form-label">Authenticator OTP Token</label>
                        <input
                            type="text"
                            required
                            maxLength={6}
                            pattern="\d{6}"
                            placeholder="123456"
                            className="input"
                            value={otp}
                            onChange={(e) => setOtp(e.target.value)}
                            style={{ letterSpacing: '0.2em', textAlign: 'center', fontSize: '16px', fontWeight: 700 }}
                        />
                    </div>

                    <button
                        type="submit"
                        disabled={loading}
                        className="btn btn-primary"
                        style={{ width: '100%', padding: '12px' }}
                    >
                        {loading ? 'Verifying...' : 'Unlock Platform'}
                    </button>
                    
                    {onResetRequest && (
                        <div style={{ textAlign: 'center', marginTop: '16px' }}>
                            <a 
                                href="#" 
                                onClick={(e) => { e.preventDefault(); onResetRequest(); }}
                                style={{ fontSize: '12px', color: 'var(--text-muted)', textDecoration: 'underline', cursor: 'pointer' }}
                            >
                                Forgot password? Reset everything
                            </a>
                        </div>
                    )}
                </form>
            </div>
            
            <span style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '24px' }}>
                Autoflow automatically locks after 15 minutes of inactivity.
            </span>
        </div>
    );
};

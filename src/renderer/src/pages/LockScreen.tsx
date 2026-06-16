/// <reference types="vite/client" />
import React, { useState, useEffect } from 'react';
import { LockIcon, WarningIcon } from '../components/Icons';
import appIcon from '../../assets/icon-1.png';
import loginNaturalVisual from '../../assets/login_natural_visual.png';
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
    const [isMobile, setIsMobile] = useState(window.innerWidth < 850);

    useEffect(() => {
        const handleResize = () => setIsMobile(window.innerWidth < 850);
        window.addEventListener('resize', handleResize);
        return () => window.removeEventListener('resize', handleResize);
    }, []);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');
        setLoading(true);
        
        if (otp.length !== 6 || !/^\d+$/.test(otp)) {
            setError('Please enter a valid 6-digit OTP token.');
            setLoading(false);
            return;
        }

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
            flexDirection: 'row',
            margin: 0,
            padding: 0,
            overflow: 'hidden',
            boxSizing: 'border-box'
        }}>
            {/* Left Container: Realistic Workspace Image (60% width) */}
            {!isMobile && (
                <div style={{
                    width: '60%',
                    height: '100%',
                    position: 'relative',
                    background: `url(${loginNaturalVisual}) no-repeat center center`,
                    backgroundSize: 'cover',
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'flex-end',
                    padding: '60px',
                    boxSizing: 'border-box',
                    overflow: 'hidden'
                }}>
                    {/* Soft dark gradient overlay for bottom typography readability */}
                    <div style={{
                        position: 'absolute',
                        top: 0,
                        left: 0,
                        right: 0,
                        bottom: 0,
                        background: 'linear-gradient(to top, rgba(10, 15, 30, 0.9) 20%, rgba(10, 15, 30, 0.2) 100%)',
                        zIndex: 1
                    }} />

                    {/* Typography Content */}
                    <div style={{ zIndex: 2, color: '#ffffff', maxWidth: '520px' }}>
                        <h1 style={{ 
                            fontSize: '34px', 
                            fontWeight: 800, 
                            marginBottom: '16px', 
                            lineHeight: '1.25',
                            letterSpacing: '-0.02em',
                            background: 'linear-gradient(135deg, #ffffff 40%, #e2e8f0 100%)',
                            WebkitBackgroundClip: 'text',
                            WebkitTextFillColor: 'transparent'
                        }}>
                            Zero-Config VPS Deployments
                        </h1>
                        <p style={{ 
                            fontSize: '15px', 
                            color: 'rgba(255, 255, 255, 0.8)', 
                            lineHeight: '1.6', 
                            margin: 0,
                            fontWeight: 400
                        }}>
                            AutoFlow vNext orchestrates Git syncs, builds Docker containers, configures Nginx proxies, and secures HTTPS certifications automatically on your VPS.
                        </p>
                    </div>
                </div>
            )}

            {/* Right Container: CRM Form Login (40% width) */}
            <div style={{
                width: isMobile ? '100%' : '40%',
                height: '100%',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'center',
                alignItems: 'center',
                background: 'var(--bg-main)',
                borderLeft: isMobile ? 'none' : '1px solid var(--border-color)',
                padding: '40px',
                boxSizing: 'border-box',
                position: 'relative'
            }}>
                <div style={{
                    width: '100%',
                    maxWidth: '360px',
                    display: 'flex',
                    flexDirection: 'column'
                }}>
                    <div style={{
                        marginBottom: '28px',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '12px'
                    }}>
                        <img src={appIcon} alt="Autoflow Icon" style={{ width: '44px', height: '44px', borderRadius: '10px' }} />
                        <div>
                            <h3 style={{ margin: 0, fontSize: '18px', fontWeight: 800, color: 'var(--text-main)' }}>AutoFlow</h3>
                            <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>vNext platform</span>
                        </div>
                    </div>
                    
                    <h2 className="h2" style={{ marginBottom: '8px', textAlign: 'left', fontSize: '24px', fontWeight: 700 }}>Welcome Back</h2>
                    <p className="text-secondary" style={{ fontSize: '13px', marginBottom: '28px', textAlign: 'left', lineHeight: '1.5' }}>
                        Unlock the platform by entering your master password and 2FA authentication token.
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
                            gap: '8px'
                        }}>
                            <WarningIcon size={14} /> {error}
                        </div>
                    )}

                    <form onSubmit={handleSubmit} style={{ width: '100%' }}>
                        <div className="form-group" style={{ marginBottom: '18px' }}>
                            <label className="form-label">Master Password</label>
                            <PasswordInput
                                required
                                placeholder="••••••••"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                            />
                        </div>
                        
                        <div className="form-group" style={{ marginBottom: '28px' }}>
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
                                style={{ 
                                    letterSpacing: '0.25em', 
                                    textAlign: 'center', 
                                    fontSize: '18px', 
                                    fontWeight: 700,
                                    color: 'var(--text-main)'
                                }}
                            />
                        </div>

                        <button
                            type="submit"
                            disabled={loading}
                            className="btn btn-primary"
                            style={{ 
                                width: '100%', 
                                padding: '12px', 
                                fontSize: '14px', 
                                fontWeight: 600,
                                cursor: loading ? 'not-allowed' : 'pointer'
                            }}
                        >
                            {loading ? 'Verifying...' : 'Unlock Platform'}
                        </button>
                        
                        {onResetRequest && (
                            <div style={{ textAlign: 'center', marginTop: '20px' }}>
                                <a 
                                    href="#" 
                                    onClick={(e) => { e.preventDefault(); onResetRequest(); }}
                                    style={{ 
                                        fontSize: '12px', 
                                        color: 'var(--text-muted)', 
                                        textDecoration: 'underline', 
                                        cursor: 'pointer' 
                                    }}
                                >
                                    Forgot password? Reset everything
                                </a>
                            </div>
                        )}
                    </form>
                </div>
                
                <span style={{ 
                    position: 'absolute', 
                    bottom: '24px', 
                    fontSize: '11px', 
                    color: 'var(--text-muted)',
                    textAlign: 'center',
                    width: 'calc(100% - 80px)'
                }}>
                    AutoFlow automatically locks after 15 minutes of inactivity.
                </span>
            </div>
        </div>
    );
};

/// <reference types="vite/client" />
import React, { useState, useEffect } from 'react';
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
            {/* Left Container: Visual Graphic (60% width) */}
            {!isMobile && (
                <div style={{
                    width: '60%',
                    height: '100%',
                    position: 'relative',
                    background: '#070a13',
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'flex-end',
                    padding: '60px',
                    boxSizing: 'border-box',
                    overflow: 'hidden'
                }}>
                    {/* Futuristic Grid Pattern */}
                    <div style={{
                        position: 'absolute',
                        top: 0,
                        left: 0,
                        right: 0,
                        bottom: 0,
                        backgroundImage: 'radial-gradient(rgba(34, 211, 238, 0.12) 1.5px, transparent 1.5px)',
                        backgroundSize: '32px 32px',
                        zIndex: 0
                    }} />

                    {/* Ambient Glow Blobs */}
                    <div style={{
                        width: '320px',
                        height: '320px',
                        borderRadius: '50%',
                        background: 'rgba(34, 211, 238, 0.12)',
                        filter: 'blur(80px)',
                        position: 'absolute',
                        top: '15%',
                        left: '10%',
                        zIndex: 1
                    }} />

                    <div style={{
                        width: '280px',
                        height: '280px',
                        borderRadius: '50%',
                        background: 'rgba(99, 102, 241, 0.12)',
                        filter: 'blur(75px)',
                        position: 'absolute',
                        bottom: '20%',
                        right: '15%',
                        zIndex: 1
                    }} />

                    {/* Architectural SVG Illustration */}
                    <div style={{
                        position: 'absolute',
                        top: '40%',
                        left: '50%',
                        transform: 'translate(-50%, -50%)',
                        width: '100%',
                        maxWidth: '440px',
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        justifyContent: 'center',
                        zIndex: 2
                    }}>
                        <svg width="400" height="180" viewBox="0 0 400 180" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ overflow: 'visible' }}>
                            {/* Connection Line */}
                            <path d="M 80 90 L 320 90" stroke="url(#line-grad)" strokeWidth="3" strokeDasharray="6 4" />
                            
                            {/* Animated Flow Dot */}
                            <circle r="6" fill="#22d3ee">
                                <animateMotion dur="4s" repeatCount="indefinite" path="M 80 90 L 320 90" />
                            </circle>
                            
                            {/* Local Workstation Node */}
                            <g transform="translate(40, 50)">
                                <rect width="80" height="80" rx="16" fill="#0b0f19" stroke="rgba(255,255,255,0.08)" strokeWidth="2" />
                                <circle cx="40" cy="40" r="22" fill="rgba(99, 102, 241, 0.08)" />
                                <path d="M28 47h24v4H28zm4-30h16v24H32z" fill="#6366f1" />
                                <text x="40" y="105" fill="#94a3b8" fontSize="11" textAnchor="middle" fontWeight="600">Workstation</text>
                            </g>
                            
                            {/* Remote Server Node */}
                            <g transform="translate(280, 50)">
                                <rect width="80" height="80" rx="16" fill="#0b0f19" stroke="#22d3ee" strokeWidth="2" style={{ filter: 'drop-shadow(0 0 12px rgba(34,211,238,0.25))' }} />
                                <circle cx="40" cy="40" r="22" fill="rgba(34, 211, 238, 0.08)" />
                                <path d="M28 30h24v6H28zm0 10h24v6H28zm0 10h24v6H28z" fill="#22d3ee" />
                                <text x="40" y="105" fill="#22d3ee" fontSize="11" textAnchor="middle" fontWeight="600">Production VPS</text>
                            </g>

                            {/* Gradients */}
                            <defs>
                                <linearGradient id="line-grad" x1="0" y1="0" x2="1" y2="0">
                                    <stop offset="0%" stopColor="#6366f1" />
                                    <stop offset="50%" stopColor="#a855f7" />
                                    <stop offset="100%" stopColor="#22d3ee" />
                                </linearGradient>
                            </defs>
                        </svg>
                        
                        {/* Deployment Stats Box (Glassmorphic) */}
                        <div style={{
                            marginTop: '36px',
                            background: 'rgba(11, 15, 25, 0.65)',
                            backdropFilter: 'blur(16px)',
                            border: '1px solid rgba(255,255,255,0.06)',
                            borderRadius: '12px',
                            padding: '16px 20px',
                            width: '320px',
                            boxShadow: '0 10px 30px rgba(0, 0, 0, 0.4)',
                            display: 'flex',
                            flexDirection: 'column',
                            gap: '10px',
                            boxSizing: 'border-box'
                        }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                <span style={{ fontSize: '12.5px', color: 'rgba(255,255,255,0.6)', fontWeight: 500 }}>Active Deploy Pipeline</span>
                                <span style={{ fontSize: '10px', color: '#22d3ee', background: 'rgba(34, 211, 238, 0.1)', padding: '2px 8px', borderRadius: '12px', fontWeight: 600 }}>ONLINE</span>
                            </div>
                            <div style={{ height: '1px', background: 'rgba(255,255,255,0.06)' }} />
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11.5px' }}>
                                    <span style={{ color: 'rgba(255,255,255,0.45)' }}>Connection Status</span>
                                    <span style={{ color: '#fff', fontWeight: 500 }}>Encrypted SSH</span>
                                </div>
                                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11.5px' }}>
                                    <span style={{ color: 'rgba(255,255,255,0.45)' }}>Docker Build Cache</span>
                                    <span style={{ color: '#22c55e', fontWeight: 500 }}>Verified</span>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Typography Content */}
                    <div style={{ zIndex: 2, color: '#ffffff', maxWidth: '520px' }}>
                        <h1 style={{ 
                            fontSize: '34px', 
                            fontWeight: 800, 
                            marginBottom: '16px', 
                            lineHeight: '1.25',
                            letterSpacing: '-0.02em',
                            background: 'linear-gradient(135deg, #ffffff 40%, #a5f3fc 100%)',
                            WebkitBackgroundClip: 'text',
                            WebkitTextFillColor: 'transparent'
                        }}>
                            Zero-Config VPS Deployments
                        </h1>
                        <p style={{ 
                            fontSize: '15px', 
                            color: 'rgba(255, 255, 255, 0.75)', 
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

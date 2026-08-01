import React, { useState, useEffect, useRef } from 'react';
import { LockIcon } from './Icons';
import appIcon from '../../assets/icon-1.png';

import { useAuth } from '../core/AuthProvider';

interface TitlebarProps {
    isUnlocked: boolean;
    onLockClick?: () => void;
}

export const Titlebar: React.FC<TitlebarProps> = ({ isUnlocked, onLockClick }) => {
    const handleMinimize = () => window.autoflow.minimize();
    const handleMaximize = () => window.autoflow.maximize();
    const handleClose = () => window.autoflow.close();

    const { user, signOut } = useAuth();
    const [showPopover, setShowPopover] = useState(false);
    const [profile, setProfile] = useState<any>(null);
    const [projectCount, setProjectCount] = useState(0);
    const popoverRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (user && showPopover && !profile) {
            window.autoflow.getUserProfile().then(setProfile);
            window.autoflow.getSavedProjects().then((projects: any[]) => {
                setProjectCount(projects ? projects.length : 0);
            });
        }
    }, [user, showPopover, profile]);

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (popoverRef.current && !popoverRef.current.contains(event.target as Node)) {
                setShowPopover(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    return (
        <div className="titlebar">
            <div className="logo" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <img src={appIcon} alt="Autoflow Icon" style={{ width: '24px', height: '24px' }} />
                <span>AUTOFLOW <span className="badge">vNEXT</span></span>
            </div>
            
            <div style={{ display: 'flex', alignItems: 'center', height: '100%' }}>
                {isUnlocked && (
                    <div style={{ marginRight: '16px', display: 'flex', alignItems: 'center' }}>
                        <button 
                            className="no-drag"
                            onClick={onLockClick}
                            style={{
                                background: 'rgba(239, 68, 68, 0.1)',
                                border: '1px solid rgba(239, 68, 68, 0.2)',
                                color: '#EF4444',
                                fontSize: '11px',
                                padding: '3px 8px',
                                borderRadius: '4px',
                                cursor: 'pointer',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '4px',
                                fontWeight: 600
                            }}
                        >
                            <LockIcon size={12} color="#EF4444" /> Lock Session
                        </button>
                    </div>
                )}
                
                {user && (
                    <div className="no-drag" style={{ position: 'relative', display: 'flex', alignItems: 'center', marginRight: '16px' }} ref={popoverRef}>
                        <span style={{ marginRight: '12px', fontSize: '13px', fontWeight: 500, color: 'var(--text-secondary)' }}>
                            Welcome, <span style={{ color: 'var(--text-primary)' }}>{user.user_metadata?.full_name?.split(' ')[0] || 'User'}</span>
                        </span>
                        <div 
                            onClick={() => setShowPopover(!showPopover)}
                            style={{
                                width: '28px', height: '28px', borderRadius: '50%', overflow: 'hidden', cursor: 'pointer',
                                border: '1px solid var(--border-color)'
                            }}
                        >
                            <img src={user.user_metadata?.avatar_url || 'https://www.gravatar.com/avatar/?d=mp'} alt="Avatar" style={{ width: '100%', height: '100%' }} />
                        </div>
                        
                        {showPopover && (
                            <div style={{
                                position: 'absolute', top: '100%', right: '0', marginTop: '8px', width: '260px',
                                background: 'var(--bg-panel)', border: '1px solid var(--border-color)', borderRadius: '8px',
                                padding: '16px', zIndex: 1000, boxShadow: '0 4px 12px rgba(0,0,0,0.5)'
                            }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '16px' }}>
                                    <img src={user.user_metadata?.avatar_url || 'https://www.gravatar.com/avatar/?d=mp'} alt="Avatar" style={{ width: '40px', height: '40px', borderRadius: '50%' }} />
                                    <div style={{ overflow: 'hidden' }}>
                                        <div style={{ fontWeight: 600, fontSize: '14px', whiteSpace: 'nowrap', textOverflow: 'ellipsis', overflow: 'hidden' }}>
                                            {user.user_metadata?.full_name || 'User'}
                                        </div>
                                        <div style={{ fontSize: '12px', color: 'var(--text-secondary)', whiteSpace: 'nowrap', textOverflow: 'ellipsis', overflow: 'hidden' }}>
                                            {user.email}
                                        </div>
                                    </div>
                                </div>
                                <div style={{ background: 'var(--bg-main)', padding: '10px', borderRadius: '6px', marginBottom: '16px', fontSize: '13px' }}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                                        <span style={{ color: 'var(--text-secondary)' }}>Current Plan</span>
                                        <span style={{ fontWeight: 600, textTransform: 'capitalize' }}>{profile?.plan || 'Free'}</span>
                                    </div>
                                </div>
                                <div style={{ display: 'flex', gap: '8px' }}>
                                    <button className="btn btn-primary" style={{ flex: 1, padding: '8px', fontSize: '12px' }}>
                                        Upgrade
                                    </button>
                                    <button onClick={signOut} className="btn btn-secondary" style={{ flex: 1, padding: '8px', fontSize: '12px' }}>
                                        Sign Out
                                    </button>
                                </div>
                            </div>
                        )}
                    </div>
                )}

                <div className="no-drag" style={{ display: 'flex', height: '100%' }}>
                    <button onClick={handleMinimize} className="win-btn" title="Minimize">
                        <svg width="10.2" height="1" viewBox="0 0 10.2 1"><rect x="0" y="0" width="10.2" height="1" fill="currentColor"/></svg>
                    </button>
                    <button onClick={handleMaximize} className="win-btn" title="Maximize">
                        <svg width="10.2" height="10.2" viewBox="0 0 10.2 10.2"><path d="M0,0v10.2h10.2V0H0z M9.2,9.2H1V1h8.2V9.2z" fill="currentColor"/></svg>
                    </button>
                    <button onClick={handleClose} className="win-btn win-close" title="Close">
                        <svg width="10.2" height="10.2" viewBox="0 0 10.2 10.2"><path d="M10.2,0.7L9.5,0L5.1,4.4L0.7,0L0,0.7L4.4,5.1L0,9.5L0.7,10.2L5.1,5.8L9.5,10.2L10.2,9.5L5.8,5.1L10.2,0.7z" fill="currentColor"/></svg>
                    </button>
                </div>
            </div>
            <style>{`
                .win-btn {
                    width: 46px;
                    height: 100%;
                    background: transparent;
                    border: none;
                    color: var(--text-primary);
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    cursor: pointer;
                    transition: background 0.1s;
                }
                .win-btn:hover {
                    background: rgba(255, 255, 255, 0.08);
                }
                .win-close:hover {
                    background: #E81123 !important;
                    color: #FFFFFF !important;
                }
                .win-btn svg {
                    shape-rendering: crispEdges;
                }
                .no-drag {
                    -webkit-app-region: no-drag;
                }
            `}</style>
        </div>
    );
};

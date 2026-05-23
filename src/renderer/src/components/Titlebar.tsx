import React from 'react';
import { LockIcon } from './Icons';
import appIcon from '../../assets/icon-1.png';

interface TitlebarProps {
    isUnlocked: boolean;
    onLockClick?: () => void;
}

export const Titlebar: React.FC<TitlebarProps> = ({ isUnlocked, onLockClick }) => {
    const handleMinimize = () => window.autoflow.minimize();
    const handleMaximize = () => window.autoflow.maximize();
    const handleClose = () => window.autoflow.close();

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

import React from 'react';
import { LockIcon } from './Icons';

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
            <div className="logo">
                <span className="logo-accent">▲</span> AUTOFLOW <span className="badge">vNEXT</span>
            </div>
            
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                {isUnlocked && (
                    <button 
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
                            fontWeight: 600,
                            webkitAppRegion: 'no-drag' as any
                        }}
                    >
                        <LockIcon size={12} color="#EF4444" /> Lock Session
                    </button>
                )}
                
                <div className="window-controls">
                    <button onClick={handleMinimize}>&#9472;</button>
                    <button onClick={handleMaximize}>&#9633;</button>
                    <button onClick={handleClose} className="close">&#9587;</button>
                </div>
            </div>
        </div>
    );
};

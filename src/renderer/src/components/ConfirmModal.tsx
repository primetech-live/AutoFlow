import React from 'react';
import { WarningIcon } from './Icons';

interface ConfirmModalProps {
    title: string;
    message: string;
    confirmLabel?: string;
    cancelLabel?: string;
    danger?: boolean;
    onConfirm: () => void;
    onCancel: () => void;
}

export const ConfirmModal: React.FC<ConfirmModalProps> = ({
    title,
    message,
    confirmLabel = 'Confirm',
    cancelLabel = 'Cancel',
    danger = false,
    onConfirm,
    onCancel
}) => {
    return (
        <div className="modal-overlay" style={{ zIndex: 1100 }}>
            <div className="modal-content" style={{ width: '440px', maxWidth: '95vw' }}>
                <div className="modal-header" style={{ borderBottomColor: danger ? 'rgba(239,68,68,0.2)' : undefined }}>
                    <h3 className="h2" style={{
                        fontSize: '15px',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '8px',
                        color: danger ? 'var(--error)' : 'var(--text-primary)'
                    }}>
                        {danger && <WarningIcon size={16} color="var(--error)" />}
                        {title}
                    </h3>
                </div>
                <div className="modal-body" style={{ fontSize: '13px', lineHeight: '1.6', color: 'var(--text-secondary)', padding: '20px 24px' }}>
                    {message}
                </div>
                <div className="modal-footer" style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
                    <button onClick={onCancel} className="btn btn-secondary" style={{ padding: '8px 20px' }}>
                        {cancelLabel}
                    </button>
                    <button
                        onClick={onConfirm}
                        className={danger ? 'btn btn-danger' : 'btn btn-primary'}
                        style={{ padding: '8px 20px' }}
                    >
                        {confirmLabel}
                    </button>
                </div>
            </div>
        </div>
    );
};

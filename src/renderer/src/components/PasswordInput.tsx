import React, { useState } from 'react';
import { EyeIcon, EyeOffIcon } from './Icons';

interface PasswordInputProps extends React.InputHTMLAttributes<HTMLInputElement> {
    onVisibilityChange?: (visible: boolean) => void;
}

export const PasswordInput: React.FC<PasswordInputProps> = ({ className, ...props }) => {
    const [isVisible, setIsVisible] = useState(false);

    const toggleVisibility = () => {
        setIsVisible(!isVisible);
        if (props.onVisibilityChange) {
            props.onVisibilityChange(!isVisible);
        }
    };

    return (
        <div style={{ position: 'relative', width: '100%', display: 'flex', alignItems: 'center' }}>
            <input
                {...props}
                type={isVisible ? 'text' : 'password'}
                className={className || "input"}
                style={{ width: '100%', paddingRight: '40px', ...props.style }}
            />
            <button
                type="button"
                onClick={toggleVisibility}
                disabled={props.disabled}
                style={{
                    position: 'absolute',
                    right: '12px',
                    background: 'none',
                    border: 'none',
                    padding: '0',
                    cursor: props.disabled ? 'not-allowed' : 'pointer',
                    color: 'var(--text-muted)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    opacity: props.disabled ? 0.5 : 1
                }}
            >
                {isVisible ? <EyeOffIcon size={18} /> : <EyeIcon size={18} />}
            </button>
        </div>
    );
};

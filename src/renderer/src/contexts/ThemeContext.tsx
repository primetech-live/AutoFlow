import React, { createContext, useContext, useEffect, useState } from 'react';

type ThemeMode = 'light' | 'dark' | 'system';

interface ThemeContextType {
    theme: ThemeMode;
    resolvedTheme: 'light' | 'dark';
    setTheme: (theme: ThemeMode) => void;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export const ThemeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [theme, setThemeState] = useState<ThemeMode>(() => {
        try {
            const stored = localStorage.getItem('autoflow-theme');
            return stored ? JSON.parse(stored) : 'system';
        } catch {
            return 'system';
        }
    });

    const [resolvedTheme, setResolvedTheme] = useState<'light' | 'dark'>('dark');

    useEffect(() => {
        localStorage.setItem('autoflow-theme', JSON.stringify(theme));
        
        const applyTheme = (mode: 'light' | 'dark') => {
            document.documentElement.setAttribute('data-theme', mode);
            setResolvedTheme(mode);
        };

        if (theme === 'system') {
            const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
            applyTheme(mediaQuery.matches ? 'dark' : 'light');

            const handler = (e: MediaQueryListEvent) => {
                applyTheme(e.matches ? 'dark' : 'light');
            };
            mediaQuery.addEventListener('change', handler);
            return () => mediaQuery.removeEventListener('change', handler);
        } else {
            applyTheme(theme);
        }
    }, [theme]);

    return (
        <ThemeContext.Provider value={{ theme, resolvedTheme, setTheme: setThemeState }}>
            {children}
        </ThemeContext.Provider>
    );
};

export const useTheme = () => {
    const context = useContext(ThemeContext);
    if (context === undefined) {
        throw new Error('useTheme must be used within a ThemeProvider');
    }
    return context;
};

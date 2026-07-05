import React, { createContext, useContext, useEffect, useState } from 'react';
import { Session, User } from '@supabase/supabase-js';
import { supabase } from './supabase';

interface AuthContextType {
    session: Session | null;
    user: User | null;
    signInWithGoogle: () => Promise<void>;
    signOut: () => Promise<void>;
    isLoading: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [session, setSession] = useState<Session | null>(null);
    const [user, setUser] = useState<User | null>(null);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        supabase.auth.getSession().then(({ data: { session } }) => {
            setSession(session);
            setUser(session?.user ?? null);
            setIsLoading(false);
            if (session) syncSessionWithMain(session);
        });

        const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
            setSession(session);
            setUser(session?.user ?? null);
            if (session) syncSessionWithMain(session);
        });

        const unsubscribeDeepLink = window.autoflow.onAuthDeepLink?.(async (url: string) => {
            const hash = url.split('#')[1];
            if (hash) {
                const params = new URLSearchParams(hash);
                const access_token = params.get('access_token');
                const refresh_token = params.get('refresh_token');
                if (access_token && refresh_token) {
                    await supabase.auth.setSession({ access_token, refresh_token });
                }
            }
        });

        return () => {
            subscription.unsubscribe();
            if (unsubscribeDeepLink) unsubscribeDeepLink();
        };
    }, []);

    const syncSessionWithMain = async (session: Session) => {
        try {
            if (window.autoflow && window.autoflow.syncAuthSession) {
                await window.autoflow.syncAuthSession(session);
            }
        } catch (e) {
            console.error('Failed to sync session to main process:', e);
        }
    };

    const signInWithGoogle = async () => {
        const { data, error } = await supabase.auth.signInWithOAuth({
            provider: 'google',
            options: {
                redirectTo: 'autoflow://auth/callback',
                skipBrowserRedirect: true,
                queryParams: {
                    prompt: 'select_account'
                }
            }
        });
        
        if (data?.url && window.autoflow.openExternal) {
            await window.autoflow.openExternal(data.url);
        }
    };

    const signOut = async () => {
        await supabase.auth.signOut();
        if (window.autoflow && window.autoflow.clearAuthSession) {
            await window.autoflow.clearAuthSession();
        }
    };

    return (
        <AuthContext.Provider value={{ session, user, signInWithGoogle, signOut, isLoading }}>
            {children}
        </AuthContext.Provider>
    );
};

export const useAuth = () => {
    const context = useContext(AuthContext);
    if (context === undefined) {
        throw new Error('useAuth must be used within an AuthProvider');
    }
    return context;
};

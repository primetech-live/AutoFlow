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

        const unsubscribeDeepLink = window.autoflow.onAuthDeepLink?.(async (rawUrl: string) => {
            try {
                if (!rawUrl) return;
                const cleanUrl = rawUrl.trim().replace(/^"|"$/g, '');

                // 1. PKCE Authorization Code Exchange (?code=...)
                let code: string | null = null;
                if (cleanUrl.includes('?')) {
                    const queryString = cleanUrl.split('?')[1].split('#')[0];
                    const searchParams = new URLSearchParams(queryString);
                    code = searchParams.get('code');
                }

                if (code) {
                    const { data, error } = await supabase.auth.exchangeCodeForSession(code);
                    if (error) {
                        console.error('[Auth] Failed to exchange PKCE code for session:', error.message);
                    } else if (data?.session) {
                        setSession(data.session);
                        setUser(data.session.user ?? null);
                        await syncSessionWithMain(data.session);
                    }
                    return;
                }

                // 2. Hash Fragment Fallback (#access_token=...&refresh_token=...)
                if (cleanUrl.includes('#')) {
                    const hashString = cleanUrl.split('#')[1];
                    const hashParams = new URLSearchParams(hashString);
                    const access_token = hashParams.get('access_token');
                    const refresh_token = hashParams.get('refresh_token');
                    if (access_token && refresh_token) {
                        const { data, error } = await supabase.auth.setSession({ access_token, refresh_token });
                        if (error) {
                            console.error('[Auth] Failed to set session from hash tokens:', error.message);
                        } else if (data?.session) {
                            setSession(data.session);
                            setUser(data.session.user ?? null);
                            await syncSessionWithMain(data.session);
                        }
                    }
                }
            } catch (err) {
                console.error('[Auth] Error handling deep link:', err);
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

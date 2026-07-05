import { createClient, Session } from '@supabase/supabase-js';
import WebSocket from 'ws';

if (typeof global !== 'undefined' && !global.WebSocket) {
    (global as any).WebSocket = WebSocket;
}

const SUPABASE_URL = 'https://srfxjzmuyejdseukqmos.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNyZnhqem11eWVqZHNldWtxbW9zIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODMyMzQ0NjQsImV4cCI6MjA5ODgxMDQ2NH0.fTmWTG7scD2GvWG92fu0Mwjvyromyz_5BNJk2FJ9OiQ';

// The main process Supabase client
export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    auth: {
        persistSession: false,
        autoRefreshToken: false,
        detectSessionInUrl: false
    }
});

let currentUserId: string | null = null;

export const setAuthSession = async (session: Session) => {
    await supabase.auth.setSession({
        access_token: session.access_token,
        refresh_token: session.refresh_token
    });
    currentUserId = session.user.id;
};

export const clearAuthSession = async () => {
    await supabase.auth.signOut();
    currentUserId = null;
};

export const getCurrentUserId = () => currentUserId;

// waitlist.js
const SUPABASE_URL = 'https://srfxjzmuyejdseukqmos.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNyZnhqem11eWVqZHNldWtxbW9zIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODMyMzQ0NjQsImV4cCI6MjA5ODgxMDQ2NH0.fTmWTG7scD2GvWG92fu0Mwjvyromyz_5BNJk2FJ9OiQ';

// Initialize Supabase Client
const supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

document.addEventListener('DOMContentLoaded', async () => {
    
    // Add success message container to the DOM
    const successBanner = document.createElement('div');
    successBanner.id = 'waitlist-success-banner';
    successBanner.style.cssText = `
        display: none;
        position: fixed;
        top: 80px;
        left: 50%;
        transform: translateX(-50%);
        background-color: var(--c-primary);
        color: white;
        padding: 24px 32px;
        border-radius: 12px;
        box-shadow: 0 12px 32px rgba(37,99,235,0.4);
        z-index: 1000;
        text-align: center;
        max-width: 90%;
        width: 400px;
        font-family: var(--f-sans);
    `;
    successBanner.innerHTML = `
        <h3 style="margin-bottom: 12px; font-weight: 700;">Thank you for registering!</h3>
        <p style="font-size: 0.95rem; line-height: 1.5; opacity: 0.9;">
            You will soon be notified for your free 1-month Pro subscription.
        </p>
    `;
    document.body.appendChild(successBanner);

    // Get all Google auth buttons
    const googleBtns = document.querySelectorAll('.google-auth-btn');

    // Handle button clicks to start OAuth
    googleBtns.forEach(btn => {
        btn.addEventListener('click', async (e) => {
            e.preventDefault();
            // Flag that the user explicitly wants to join the waitlist
            localStorage.setItem('intent_to_join', 'true');
            
            // Start Google OAuth flow
            const { data, error } = await supabaseClient.auth.signInWithOAuth({
                provider: 'google',
                options: {
                    redirectTo: window.location.href,
                    queryParams: {
                        prompt: 'select_account'
                    }
                }
            });
            if (error) {
                console.error('Error signing in:', error.message);
                alert('Error connecting to Google. Please make sure Google Provider is configured in Supabase.');
            }
        });
    });

    const setJoinedUI = (name = null, avatar = null) => {
        const userName = name || localStorage.getItem('autoflow_user_name');
        const userAvatar = avatar || localStorage.getItem('autoflow_user_avatar');

        googleBtns.forEach(btn => {
            if (btn.id === 'google-login-btn-nav') {
                if (userName && userAvatar) {
                    // Replace the button with a user profile badge
                    const parent = btn.parentElement;
                    let profileBadge = document.getElementById('autoflow-user-profile');
                    if (!profileBadge) {
                        profileBadge = document.createElement('div');
                        profileBadge.id = 'autoflow-user-profile';
                        profileBadge.style.cssText = 'display: flex; align-items: center; gap: 12px; color: var(--c-bone); font-family: var(--f-sans); font-weight: 600; font-size: 0.95rem;';
                        profileBadge.innerHTML = `
                            <span style="opacity: 0.9;">${userName}</span>
                            <img src="${userAvatar}" alt="Profile" style="width: 36px; height: 36px; border-radius: 50%; border: 2px solid var(--c-primary); object-fit: cover;">
                        `;
                        parent.appendChild(profileBadge);
                    }
                    btn.style.display = 'none';
                } else {
                    btn.innerHTML = `JOINED`;
                    btn.style.backgroundColor = 'var(--c-slate)';
                    btn.style.color = '#fff';
                    btn.disabled = true;
                    btn.style.cursor = 'default';
                    btn.style.display = 'block';
                }
            } else {
                btn.innerHTML = `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="20 6 9 17 4 12"></polyline></svg> Joined`;
                btn.style.backgroundColor = 'var(--c-slate)';
                btn.style.color = '#fff';
                btn.disabled = true;
                btn.style.cursor = 'default';
            }
        });
    };
    
    const resetJoinedUI = () => {
        googleBtns.forEach(btn => {
            if (btn.id === 'google-login-btn-nav') {
                const profileBadge = document.getElementById('autoflow-user-profile');
                if (profileBadge) profileBadge.remove();
                
                btn.style.display = 'block';
                btn.innerHTML = `JOIN WAITLIST`;
                btn.style.backgroundColor = 'var(--c-primary)';
                btn.style.color = 'var(--c-bone)';
            } else {
                btn.innerHTML = `<svg viewBox="0 0 24 24" width="20" height="20" xmlns="http://www.w3.org/2000/svg"><path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/><path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/><path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/><path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/></svg> Sign in with Google`;
                btn.style.backgroundColor = '#ffffff';
                btn.style.color = '#1f2126';
            }
            btn.disabled = false;
            btn.style.cursor = 'pointer';
        });
    };

    if (localStorage.getItem('autoflow_waitlist_joined') === 'true') {
        setJoinedUI();
    }

    // Check session on page load
    const { data: { session } } = await supabaseClient.auth.getSession();
    
    if (session) {
        const user = session.user;
        const fullName = user.user_metadata?.full_name || user.email.split('@')[0];
        const avatarUrl = user.user_metadata?.avatar_url || '';
        
        // If user just returned from clicking the join button
        if (localStorage.getItem('intent_to_join') === 'true') {
            localStorage.removeItem('intent_to_join');
            
            // Insert user into waitlist
            const { error } = await supabaseClient
                .from('waitlist')
                .upsert([{ user_id: user.id, email: user.email }], { onConflict: 'user_id' });

            if (!error || error.code === '23505') {
                localStorage.setItem('autoflow_waitlist_joined', 'true');
                localStorage.setItem('autoflow_user_name', fullName);
                localStorage.setItem('autoflow_user_avatar', avatarUrl);
                
                setJoinedUI(fullName, avatarUrl);
                
                // Show success banner
                successBanner.style.display = 'block';
                setTimeout(() => {
                    successBanner.style.opacity = '0';
                    successBanner.style.transition = 'opacity 0.5s ease';
                    setTimeout(() => {
                        successBanner.style.display = 'none';
                        successBanner.style.opacity = '1';
                    }, 500);
                }, 6000);
            }
        } else {
            // Background sync: Ensure UI matches actual DB state
            const { data, error } = await supabaseClient
                .from('waitlist')
                .select('user_id')
                .eq('user_id', user.id)
                .single();
                
            if (error || !data) {
                // User is logged in, but they are NOT in the waitlist table
                localStorage.removeItem('autoflow_waitlist_joined');
                localStorage.removeItem('autoflow_user_name');
                localStorage.removeItem('autoflow_user_avatar');
                resetJoinedUI();
            } else {
                // User is legitimately in the waitlist
                localStorage.setItem('autoflow_waitlist_joined', 'true');
                localStorage.setItem('autoflow_user_name', fullName);
                localStorage.setItem('autoflow_user_avatar', avatarUrl);
                setJoinedUI(fullName, avatarUrl);
            }
        }
    } else {
        // No session at all, clear cache
        localStorage.removeItem('autoflow_waitlist_joined');
        localStorage.removeItem('autoflow_user_name');
        localStorage.removeItem('autoflow_user_avatar');
        resetJoinedUI();
    }
});
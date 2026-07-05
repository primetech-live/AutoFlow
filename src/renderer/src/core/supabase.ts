import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://srfxjzmuyejdseukqmos.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNyZnhqem11eWVqZHNldWtxbW9zIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODMyMzQ0NjQsImV4cCI6MjA5ODgxMDQ2NH0.fTmWTG7scD2GvWG92fu0Mwjvyromyz_5BNJk2FJ9OiQ';

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

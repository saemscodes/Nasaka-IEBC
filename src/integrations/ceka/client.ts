// src/integrations/ceka/client.ts
// CEKA Supabase Client — Official OAuth Configuration for Nasaka IEBC
import { createClient } from '@supabase/supabase-js';

const CEKA_SUPABASE_URL = "https://cajrvemigxghnfmyopiy.supabase.co";
const CEKA_SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNhanJ2ZW1pZ3hnaG5mbXlvcGl5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDQyOTU1OTAsImV4cCI6MjA1OTg3MTU5MH0.sgItW4OBC9i-eKnnUDxdMB6qgGdXyiKAD9c6C2u40As";

export const cekaSupabase = createClient(CEKA_SUPABASE_URL, CEKA_SUPABASE_ANON_KEY, {
    auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: false,
        storage: typeof window !== 'undefined' ? window.localStorage : undefined,
        storageKey: 'nasaka-ceka-auth-token',
        flowType: 'pkce',
    },
    global: {
        headers: {
            'x-client-info': 'nasaka-iebc-sandbox',
        },
    },
});

export const CEKA_OAUTH_BASE = "https://www.civiceducationkenya.com";
export const CEKA_OAUTH_URL = `${CEKA_OAUTH_BASE}/oauth/consent`;
export const CEKA_TOKEN_URL = `${CEKA_SUPABASE_URL}/functions/v1/oauth-token`;
export const CEKA_CLIENT_ID = import.meta.env.VITE_CEKA_CLIENT_ID || 'nasaka-iebc-v1';
export const CEKA_REDIRECT_URI = `${window.location.origin}/auth/callback`;

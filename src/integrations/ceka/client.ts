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

// Safe environment checks for Cloudflare Workers / SSR
const getEnvVar = (name: string) => {
    if (typeof process !== 'undefined' && process.env?.[name]) return process.env[name];
    try {
        // @ts-ignore - Vite specific
        if (typeof import.meta !== 'undefined' && import.meta.env?.[name]) return import.meta.env[name];
    } catch (e) { }
    return undefined;
};

export const CEKA_CLIENT_ID = getEnvVar('VITE_CEKA_CLIENT_ID') || 'nasaka-iebc-v1';

export const getRedirectUri = (origin?: string) => {
    const base = origin || (typeof window !== 'undefined' ? window.location.origin : 'https://nasakaiebc.civiceducationkenya.com');
    return `${base}/auth/callback`;
};

// Legacy Export for backward compat
export const CEKA_REDIRECT_URI = typeof window !== 'undefined' ? `${window.location.origin}/auth/callback` : 'https://nasakaiebc.civiceducationkenya.com/auth/callback';

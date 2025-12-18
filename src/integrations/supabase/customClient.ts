import { createClient } from '@supabase/supabase-js';
import type { Database } from './types';

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  console.error('Missing Supabase environment variables');
}

// Custom client with PKCE flow for enhanced security
export const supabaseCustom = createClient<Database>(
  SUPABASE_URL || 'https://ftswzvqwxdwgkvfbwfpx.supabase.co',
  SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZ0c3d6dnF3eGR3Z2t2ZmJ3ZnB4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTIzNTQ1NTEsImV4cCI6MjA2NzkzMDU1MX0.ZRYkA2uRUEG1M6zLpMI0waaprBORCl_sYQ8l3orhdUo',
  {
    auth: {
      autoRefreshToken: true,
      persistSession: true,
      detectSessionInUrl: true,
      storage: localStorage,
      storageKey: 'nasaka-auth-token-pkce',
      flowType: 'pkce' as const,
      debug: import.meta.env.DEV,
    },
    global: {
      headers: {
        'X-Client-Info': 'nasaka-iebc-pkce@1.1.0',
        'X-Request-ID': crypto.randomUUID(),
      },
    },
    db: {
      schema: 'public',
    },
  }
);

// PKCE-specific auth helper functions
export const authPKCE = {
  async signIn(email: string, password: string) {
    try {
      const { data, error } = await supabaseCustom.auth.signInWithPassword({
        email: email.trim(),
        password,
      });
      
      if (error) throw error;
      return { success: true, data };
    } catch (error: any) {
      console.error('PKCE Sign in error:', error);
      return { success: false, error: error.message };
    }
  },
  
  async signUp(email: string, password: string, metadata?: any) {
    try {
      const { data, error } = await supabaseCustom.auth.signUp({
        email: email.trim(),
        password,
        options: {
          data: metadata,
          emailRedirectTo: `${window.location.origin}/auth/callback`,
        },
      });
      
      if (error) throw error;
      return { success: true, data };
    } catch (error: any) {
      console.error('PKCE Sign up error:', error);
      return { success: false, error: error.message };
    }
  },
  
  async resetPassword(email: string) {
    try {
      const { error } = await supabaseCustom.auth.resetPasswordForEmail(
        email.trim(),
        {
          redirectTo: `${window.location.origin}/reset-password`,
        }
      );
      
      if (error) throw error;
      return { success: true };
    } catch (error: any) {
      console.error('PKCE Password reset error:', error);
      return { success: false, error: error.message };
    }
  },
  
  async verifyOtp(params: { email: string; token: string; type: 'email' | 'recovery' }) {
    try {
      const { data, error } = await supabaseCustom.auth.verifyOtp({
        email: params.email,
        token: params.token,
        type: params.type,
      });
      
      if (error) throw error;
      return { success: true, data };
    } catch (error: any) {
      console.error('PKCE OTP verification error:', error);
      return { success: false, error: error.message };
    }
  }
};

// Export the main client for use in components that need PKCE
export default supabaseCustom;

// Helper to check if we should use PKCE client (based on route or feature flag)
export function usePKCEForAuth(): boolean {
  // Use PKCE for all admin routes and sensitive operations
  const path = window.location.pathname;
  return path.includes('/admin') || path.includes('/auth') || path.includes('/reset-password');
}

// Get the appropriate client based on context
export function getSupabaseClient() {
  return usePKCEForAuth() ? supabaseCustom : supabaseCustom;
}
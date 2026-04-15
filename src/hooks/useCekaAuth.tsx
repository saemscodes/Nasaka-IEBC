/* =========================================================
   src/hooks/useCekaAuth.tsx
   CEKA-SPECIFIC AUTH HOOK
   Uses the cekaSupabase client for Sandbox integration.
   ========================================================= */

import {
    useState,
    useEffect,
    useCallback,
    useMemo,
    createContext,
    useContext,
    ReactNode,
} from 'react';
import type { Session, User } from '@supabase/supabase-js';
import { cekaSupabase } from '@/integrations/ceka/client';

interface Profile {
    id: string;
    display_name: string | null;
    avatar_url: string | null;
    onboarding_completed: boolean;
}

interface AuthContextValue {
    user: User | null;
    session: Session | null;
    loading: boolean;
    isLoading: boolean;
    error: string | null;
    profile: Profile | null;
    isAuthenticated: boolean;

    signUp: (
        email: string,
        password: string,
        displayName?: string
    ) => Promise<{ error: any | null }>;

    signIn: (
        email: string,
        password: string
    ) => Promise<{ error: any | null }>;

    signInWithGoogle: () => Promise<{ error: any | null }>;

    signOut: () => Promise<{ error: any | null }>;

    resetPassword: (
        email: string
    ) => Promise<{ error: any | null }>;

    updatePassword: (
        password: string
    ) => Promise<{ error: any | null }>;

    resendVerification: (
        email: string
    ) => Promise<{ error: any | null }>;
}

const CekaAuthContext = createContext<AuthContextValue | undefined>(undefined);

export const CekaAuthProvider = ({ children }: { children: ReactNode }) => {
    const auth = useProvideCekaAuth();
    return (
        <CekaAuthContext.Provider value={auth}>
            {children}
        </CekaAuthContext.Provider>
    );
};

export const useCekaAuth = (): AuthContextValue => {
    const ctx = useContext(CekaAuthContext);
    if (!ctx) {
        // Fallback to provide functionality even if provider is missing (useful for SandboxWidget)
        return useProvideCekaAuth();
    }
    return ctx;
};

function useProvideCekaAuth(): AuthContextValue {
    const [user, setUser] = useState<User | null>(null);
    const [session, setSession] = useState<Session | null>(null);
    const [profile, setProfile] = useState<Profile | null>(null);
    const [loading, setLoading] = useState<boolean>(true);
    const [error, setError] = useState<string | null>(null);

    const fetchProfile = useCallback(async (userId: string) => {
        try {
            const { data, error } = await cekaSupabase
                .from('nasaka_profiles')
                .select('*')
                .eq('user_id', userId)
                .single();

            if (error) {
                if (error.code !== 'PGRST116') console.error('Error fetching profile:', error);
                return null;
            }
            return data as Profile;
        } catch (err) {
            console.error('Error in fetchProfile:', err);
            return null;
        }
    }, []);

    useEffect(() => {
        let mounted = true;

        const initialize = async () => {
            const { data: { session }, error } = await cekaSupabase.auth.getSession();
            if (!mounted) return;

            if (error) setError(error.message);
            setSession(session);
            setUser(session?.user ?? null);

            if (session?.user) {
                const p = await fetchProfile(session.user.id);
                if (mounted) setProfile(p);
            }
            setLoading(false);
        };

        initialize();

        const {
            data: { subscription },
        } = cekaSupabase.auth.onAuthStateChange(async (_event, newSession) => {
            if (!mounted) return;
            setSession(newSession);
            setUser(newSession?.user ?? null);

            if (newSession?.user) {
                const p = await fetchProfile(newSession.user.id);
                if (mounted) setProfile(p);
            } else {
                setProfile(null);
            }
            setLoading(false);
        });

        return () => {
            mounted = false;
            subscription.unsubscribe();
        };
    }, [fetchProfile]);

    const signUp = useCallback(
        async (email: string, password: string, displayName?: string) => {
            const cleanEmail = email.trim().toLowerCase();
            setError(null);
            try {
                const { error } = await cekaSupabase.auth.signUp({
                    email: cleanEmail,
                    password,
                    options: {
                        emailRedirectTo: `${window.location.origin}/auth/callback`,
                        data: {
                            display_name: displayName ?? null,
                            full_name: displayName ?? null,
                        },
                    },
                });

                if (error) {
                    setError(error.message);
                    return { error };
                }

                return { error: null };
            } catch (err) {
                const errorMsg = err instanceof Error ? err.message : 'An unexpected error occurred during sign up';
                setError(errorMsg);
                return { error: new Error(errorMsg) };
            }
        },
        []
    );

    const signIn = useCallback(
        async (email: string, password: string) => {
            const cleanEmail = email.trim().toLowerCase();
            setError(null);
            try {
                const { error } = await cekaSupabase.auth.signInWithPassword({
                    email: cleanEmail,
                    password,
                });

                if (error) {
                    setError(error.message);
                    return { error };
                }

                return { error: null };
            } catch (err) {
                const errorMsg = err instanceof Error ? err.message : 'An unexpected error occurred during sign in';
                setError(errorMsg);
                return { error: new Error(errorMsg) };
            }
        },
        []
    );

    const signInWithGoogle = useCallback(async () => {
        setError(null);
        try {
            const { error } = await cekaSupabase.auth.signInWithOAuth({
                provider: 'google',
                options: {
                    redirectTo: `${window.location.origin}/auth/callback`,
                },
            });

            if (error) {
                setError(error.message);
                return { error };
            }

            return { error: null };
        } catch (err) {
            const errorMsg = err instanceof Error ? err.message : 'An unexpected error occurred during Google sign in';
            setError(errorMsg);
            return { error: new Error(errorMsg) };
        }
    }, []);

    const signOut = useCallback(async () => {
        setError(null);
        try {
            const { error } = await cekaSupabase.auth.signOut();

            if (error) {
                setError(error.message);
                return { error };
            }

            setUser(null);
            setSession(null);
            return { error: null };
        } catch (err) {
            const errorMsg = err instanceof Error ? err.message : 'An unexpected error occurred during sign out';
            setError(errorMsg);
            return { error: new Error(errorMsg) };
        }
    }, []);

    const resetPassword = useCallback(async (email: string) => {
        const cleanEmail = email.trim().toLowerCase();
        setError(null);
        try {
            const { error } = await cekaSupabase.auth.resetPasswordForEmail(cleanEmail, {
                redirectTo: `${window.location.origin}/auth/callback`,
            });

            if (error) {
                setError(error.message);
                return { error };
            }

            return { error: null };
        } catch (err) {
            const errorMsg = err instanceof Error ? err.message : 'An unexpected error occurred during password reset';
            setError(errorMsg);
            return { error: new Error(errorMsg) };
        }
    }, []);

    const updatePassword = useCallback(async (password: string) => {
        setError(null);
        try {
            const { error } = await cekaSupabase.auth.updateUser({ password });

            if (error) {
                setError(error.message);
                return { error };
            }

            return { error: null };
        } catch (err) {
            const errorMsg = err instanceof Error ? err.message : 'An unexpected error occurred during password update';
            setError(errorMsg);
            return { error: new Error(errorMsg) };
        }
    }, []);

    const resendVerification = useCallback(async (email: string) => {
        const cleanEmail = email.trim().toLowerCase();
        setError(null);
        try {
            const { error } = await cekaSupabase.auth.resend({
                type: 'signup',
                email: cleanEmail,
                options: {
                    emailRedirectTo: `${window.location.origin}/auth/callback`,
                },
            });

            if (error) {
                setError(error.message);
                return { error };
            }

            return { error: null };
        } catch (err) {
            const errorMsg = err instanceof Error ? err.message : 'An unexpected error occurred while resending verification';
            setError(errorMsg);
            return { error: new Error(errorMsg) };
        }
    }, []);

    return useMemo(() => ({
        user,
        session,
        profile,
        loading,
        isLoading: loading,
        error,
        isAuthenticated: !!user,

        signUp,
        signIn,
        signInWithGoogle,
        signOut,
        resetPassword,
        updatePassword,
        resendVerification,
    }), [
        user,
        session,
        profile,
        loading,
        error,
        signUp,
        signIn,
        signInWithGoogle,
        signOut,
        resetPassword,
        updatePassword,
        resendVerification,
    ]);
}

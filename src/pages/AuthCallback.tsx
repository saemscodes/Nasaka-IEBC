import React, { useEffect, useState } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Loader2, XCircle, Fingerprint } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { cekaSupabase, CEKA_TOKEN_URL, CEKA_REDIRECT_URI } from '@/integrations/ceka/client';
import { toast } from 'sonner';

const AuthCallback = () => {
    const [searchParams] = useSearchParams();
    const navigate = useNavigate();
    const { user, loading: authLoading } = useAuth();
    const [isProcessing, setIsProcessing] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const errorParam = searchParams.get('error');
    const errorDescription = searchParams.get('error_description');

    // AuthCallback.tsx
    useEffect(() => {
        const handleAuthCallback = async () => {
            setIsProcessing(true);
            setError(null);

            // 1. Handle CEKA OAuth specifically
            // If there's a 'code' from CEKA but no Supabase internal '__auth_token' match,
            // it's a redirect from CEKA to authorize the sandbox.
            const code = searchParams.get('code');
            const rawState = searchParams.get('state') || '';

            if (code && !errorParam) {
                try {
                    console.log('[AuthCallback] Exchanging CEKA OAuth code for session...');

                    // CEKA server-side PKCE encodes verifier as: "originalState||verifier"
                    // Fall back to client-side generated verifier stored in sessionStorage
                    let code_verifier: string | null = null;
                    if (rawState.includes('||')) {
                        const parts = rawState.split('||');
                        code_verifier = parts[1] || null;
                        console.log('[AuthCallback] Extracted PKCE verifier from CEKA state param.');
                    } else {
                        code_verifier = sessionStorage.getItem('ceka_oauth_verifier');
                        console.log('[AuthCallback] Using client-side PKCE verifier from sessionStorage.');
                    }
                    // Clean up to prevent reuse
                    sessionStorage.removeItem('ceka_oauth_verifier');

                    const response = await fetch(CEKA_TOKEN_URL, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            code,
                            redirect_uri: CEKA_REDIRECT_URI,
                            code_verifier
                        }),
                    });

                    if (!response.ok) {
                        const errorData = await response.json();
                        throw new Error(errorData.error || 'Failed to exchange token');
                    }

                    const data = await response.json();

                    if (data.access_token) {
                        const { error: sessionError } = await cekaSupabase.auth.setSession({
                            access_token: data.access_token,
                            refresh_token: data.refresh_token
                        });

                        if (sessionError) throw sessionError;

                        // Clean up PKCE state
                        sessionStorage.removeItem('ceka_oauth_state');
                        toast.success('CEKA Identity Verified');
                        navigate('/docs#sandbox', { replace: true });
                        return;
                    }
                } catch (err: any) {
                    console.error('[AuthCallback] CEKA Exchange Error:', err);
                    setError(`CEKA Authentication Failed: ${err.message}`);
                    return;
                }
            }

            // 2. Handle standard OAuth errors (both Supabase and CEKA)
            if (errorParam) {
                setError(errorDescription || 'Authentication failed');
                toast.error(errorDescription || 'Authentication failed');
                setTimeout(() => navigate('/auth'), 2000);
                return;
            }

            // Check if this is a password recovery link
            const type = searchParams.get('type');
            if (type === 'recovery') {
                const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event) => {
                    if (event === 'PASSWORD_RECOVERY') {
                        subscription.unsubscribe();
                        navigate('/auth/reset-password');
                    }
                });
                setTimeout(() => {
                    setIsProcessing(false);
                }, 1500);
                return;
            }

            try {
                // Get the current user session
                const { data: { session }, error: sessionError } = await supabase.auth.getSession();

                if (sessionError) throw sessionError;

                if (!session) {
                    // It might take a moment to sync
                    setError('No active session found. Retrying...');
                    return;
                }

                const currentUser = session.user;

                // Ensure profile exists (Backend triggers usually handle this, but we'll double check)
                const { data: profile, error: profileError } = await supabase
                    .from('nasaka_profiles')
                    .select('*')
                    .eq('user_id', currentUser.id)
                    .single();

                if (profileError && profileError.code === 'PGRST116') {
                    // Profile missing, create minimal one
                    await (supabase as any).from('nasaka_profiles').insert({
                        user_id: currentUser.id,
                        display_name: currentUser.user_metadata?.full_name || currentUser.email?.split('@')[0]
                    });
                }

                // Success - redirect to dashboard
                toast.success('Sign in successful!');
                navigate('/dashboard/api-keys');

            } catch (err: any) {
                console.error('Auth callback error:', err);
                setError(err.message || 'Authentication failed');
                toast.error(err.message || 'Failed to complete authentication');
                setTimeout(() => navigate('/auth'), 3000);
            } finally {
                setIsProcessing(false);
            }
        };

        if (isProcessing) {
            handleAuthCallback();
        }
    }, [isProcessing, navigate, errorParam, errorDescription, searchParams]);

    if (isProcessing || authLoading) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-[#02040A]">
                <div className="text-center space-y-8">
                    <div className="relative flex items-center justify-center">
                        <div className="absolute w-24 h-24 rounded-full border border-blue-500/30 animate-ping" />
                        <div className="absolute w-20 h-20 rounded-full border-2 border-blue-500/50 fingerprint-loader" />
                        <Fingerprint className="w-16 h-16 text-blue-500 relative z-10" />
                    </div>
                    <div>
                        <p className="text-blue-500 font-black tracking-[0.4em] uppercase text-[10px] mb-2">Verifying Identity</p>
                        <p className="text-white/40 font-bold text-xs tracking-tight">Sync Handshake in Progress...</p>
                    </div>
                </div>
            </div>
        );
    }

    if (error) {
        return (
            <div className="min-h-screen flex items-center justify-center p-4 bg-ios-gray-50 dark:bg-ios-gray-900">
                <Card className="w-full max-w-md border-0 shadow-2xl rounded-[3rem]">
                    <CardHeader className="text-center">
                        <div className="w-16 h-16 rounded-full bg-red-500/10 flex items-center justify-center mx-auto mb-4">
                            <XCircle className="w-8 h-8 text-red-500" />
                        </div>
                        <CardTitle className="text-2xl font-black">Authentication Failed</CardTitle>
                        <CardDescription className="text-sm">
                            {error}
                        </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <p className="text-center text-xs text-muted-foreground">Redirecting you back to login shortly...</p>
                    </CardContent>
                </Card>
            </div>
        );
    }

    return null;
};

export default AuthCallback;

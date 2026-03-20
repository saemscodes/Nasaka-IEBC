import React, { useEffect, useState } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Loader2, XCircle } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
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
            if (code && !errorParam) {
                console.log('[AuthCallback] Detected CEKA OAuth code, redirecting to sandbox...');
                // We redirect to the docs page with the code in the hash fragment or query
                // SandboxWidget will pick this up to initialize the session
                navigate(`/docs?code=${code}#sandbox`, { replace: true });
                return;
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
                    await supabase.from('nasaka_profiles').insert({
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
            <div className="min-h-screen flex items-center justify-center bg-ios-gray-50 dark:bg-ios-gray-900">
                <div className="text-center space-y-6">
                    <Loader2 className="w-12 h-12 animate-spin text-blue-500 mx-auto" />
                    <p className="text-muted-foreground font-bold tracking-tight uppercase text-xs">Completing Secure Authenication...</p>
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

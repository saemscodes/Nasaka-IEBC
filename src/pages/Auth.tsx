import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Mail, Lock, User, Eye, EyeOff, ArrowLeft, Loader2, Globe } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useAuth } from '@/hooks/useAuth';
import { useTheme } from '@/contexts/ThemeContext';
import { z } from 'zod';

const emailSchema = z.string().email('Please enter a valid email address');
const passwordSchema = z.string().min(6, 'Password must be at least 6 characters');

type AuthMode = 'signin' | 'signup' | 'forgot';

const Auth = () => {
    const navigate = useNavigate();
    const [searchParams] = useSearchParams();
    const { signIn, signUp, signInWithGoogle, resetPassword, resendVerification, isAuthenticated, loading: authLoading } = useAuth();
    const { theme } = useTheme();
    const isDark = theme === 'dark';

    const [mode, setMode] = useState<AuthMode>('signin');
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [displayName, setDisplayName] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [success, setSuccess] = useState<string | null>(null);
    const [validationErrors, setValidationErrors] = useState<{ email?: string; password?: string }>({});
    const [showResend, setShowResend] = useState(false);

    const redirectTo = searchParams.get('redirect') || '/dashboard/api-keys';

    useEffect(() => {
        if (isAuthenticated && !authLoading) {
            navigate(redirectTo, { replace: true });
        }
    }, [isAuthenticated, authLoading, navigate, redirectTo]);

    const validateForm = () => {
        const errors: { email?: string; password?: string } = {};
        const cleanEmail = email.trim().toLowerCase();

        try {
            emailSchema.parse(cleanEmail);
        } catch (e) {
            if (e instanceof z.ZodError) {
                errors.email = e.errors[0].message;
            }
        }

        if (mode !== 'forgot') {
            try {
                passwordSchema.parse(password);
            } catch (e) {
                if (e instanceof z.ZodError) {
                    errors.password = e.errors[0].message;
                }
            }
        }

        setValidationErrors(errors);
        return Object.keys(errors).length === 0;
    };

    const [resetCooldown, setResetCooldown] = useState(0);

    useEffect(() => {
        if (resetCooldown > 0) {
            const timer = setTimeout(() => setResetCooldown(resetCooldown - 1), 1000);
            return () => clearTimeout(timer);
        }
    }, [resetCooldown]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError(null);
        setSuccess(null);

        if (!validateForm()) return;

        const cleanEmail = email.trim().toLowerCase();
        setLoading(true);

        try {
            if (mode === 'signin') {
                const { error } = await signIn(cleanEmail, password);
                if (error) {
                    if (error.message.includes('Email not confirmed')) {
                        setError('Please confirm your email address to sign in.');
                        setShowResend(true);
                    } else if (error.message.includes('Invalid login credentials')) {
                        setError('Invalid email or password. Please try again.');
                    } else {
                        setError(error.message);
                    }
                }
            } else if (mode === 'signup') {
                const { error } = await signUp(cleanEmail, password, displayName);
                if (error) {
                    if (error.message.includes('User already registered')) {
                        setError('An account with this email already exists. Please sign in instead.');
                    } else {
                        setError(error.message);
                    }
                } else {
                    setSuccess('Account created! Please check your email inbox (and spam) to confirm your account.');
                    setShowResend(true);
                }
            } else if (mode === 'forgot') {
                if (resetCooldown > 0) return;
                const { error } = await resetPassword(cleanEmail);
                if (error) {
                    if (error.message.toLowerCase().includes('rate limit')) {
                        setError("Too many requests. Please wait a while before trying again.");
                    } else {
                        setError(error.message);
                    }
                } else {
                    setSuccess('Password reset link sent! Check your inbox (and spam).');
                    setResetCooldown(60);
                    setShowResend(true);
                }
            }
        } finally {
            setLoading(false);
        }
    };

    const handleResendVerification = async () => {
        if (!email) {
            setError('Please enter your email address first.');
            return;
        }

        const cleanEmail = email.trim().toLowerCase();
        setLoading(true);
        setError(null);
        setSuccess(null);
        try {
            const { error } = await resendVerification(cleanEmail);
            if (error) {
                if (error.message.toLowerCase().includes('rate limit')) {
                    setError("Too many requests. Please wait a while before trying again.");
                } else {
                    setError(error.message);
                }
            } else {
                setSuccess('Verification email resent! Please check your inbox.');
                if (mode === 'forgot') setResetCooldown(60);
            }
        } finally {
            setLoading(false);
        }
    };

    const handleGoogleSignIn = async () => {
        setError(null);
        setLoading(true);
        try {
            const { error } = await signInWithGoogle();
            if (error) {
                setError(error.message || 'Failed to sign in with Google. Please try again.');
            }
        } catch (err) {
            setError('An unexpected error occurred. Please try again.');
            console.error('Google sign-in error:', err);
        } finally {
            setLoading(false);
        }
    };

    const logo = isDark ? "/nasaka-logo-white.png" : "/nasaka-logo-blue.png";

    if (authLoading) {
        return (
            <div className={`min-h-screen flex items-center justify-center ${isDark ? 'bg-ios-gray-900' : 'bg-ios-gray-50'}`}>
                <Loader2 className="w-12 h-12 text-blue-500 animate-spin" />
            </div>
        );
    }

    return (
        <div className={`min-h-screen flex flex-col transition-colors duration-500 ${isDark ? 'bg-ios-gray-900 text-white' : 'bg-ios-gray-50 text-ios-gray-900'}`}>
            <header className="p-6">
                <Button variant="ghost" size="icon" onClick={() => navigate('/')} className="rounded-2xl">
                    <ArrowLeft className="w-5 h-5" />
                </Button>
            </header>

            <main className="flex-1 flex items-center justify-center p-6">
                <motion.div
                    initial={{ opacity: 0, y: 30 }}
                    animate={{ opacity: 1, y: 0 }}
                    className={`w-full max-w-sm p-8 rounded-[3rem] border ${isDark ? 'bg-ios-gray-800 border-ios-gray-700' : 'bg-white border-ios-gray-100 shadow-xl'}`}
                >
                    <div className="text-center mb-8">
                        <img
                            src={logo}
                            alt="Nasaka IEBC"
                            className="h-16 mx-auto mb-6 object-contain"
                        />
                        <h1 className="text-3xl font-black tracking-tight mb-2">
                            {mode === 'signin' && 'Developer Portal'}
                            {mode === 'signup' && 'Join Nasaka'}
                            {mode === 'forgot' && 'Reset Access'}
                        </h1>
                        <p className="text-sm text-muted-foreground">
                            {mode === 'signin' && 'Sign in to manage your API keys'}
                            {mode === 'signup' && 'Create an account to start building'}
                            {mode === 'forgot' && 'Enter your email to restore access'}
                        </p>
                    </div>

                    <AnimatePresence mode="wait">
                        {error && (
                            <motion.div
                                initial={{ opacity: 0, y: -10 }}
                                animate={{ opacity: 1, y: 0 }}
                                exit={{ opacity: 0, y: -10 }}
                                className="p-4 rounded-2xl bg-red-500/10 border border-red-500/20 text-red-500 text-sm text-center mb-6"
                            >
                                {error}
                            </motion.div>
                        )}

                        {success && (
                            <motion.div
                                initial={{ opacity: 0, y: -10 }}
                                animate={{ opacity: 1, y: 0 }}
                                exit={{ opacity: 0, y: -10 }}
                                className="p-4 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-600 dark:text-emerald-400 text-sm flex flex-col items-center gap-3 text-center mb-6"
                            >
                                <span>{success}</span>
                                {showResend && (
                                    <Button
                                        variant="link"
                                        size="sm"
                                        onClick={handleResendVerification}
                                        className="h-auto p-0 text-emerald-700 dark:text-emerald-300 font-bold"
                                    >
                                        Didn't get the email? Resend
                                    </Button>
                                )}
                            </motion.div>
                        )}
                    </AnimatePresence>

                    <form onSubmit={handleSubmit} className="space-y-4">
                        {mode === 'signup' && (
                            <div className="space-y-2">
                                <Label htmlFor="displayName" className="text-xs font-bold uppercase tracking-widest text-muted-foreground ml-1">Organisation / Name</Label>
                                <div className="relative">
                                    <User className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                                    <Input
                                        id="displayName"
                                        type="text"
                                        value={displayName}
                                        onChange={(e) => setDisplayName(e.target.value)}
                                        placeholder="e.g. My Agency"
                                        className={`pl-11 h-12 rounded-xl transition-all ${isDark ? 'bg-ios-gray-900 border-ios-gray-700' : 'bg-ios-gray-50 border-ios-gray-100'}`}
                                    />
                                </div>
                            </div>
                        )}

                        <div className="space-y-2">
                            <Label htmlFor="email" className="text-xs font-bold uppercase tracking-widest text-muted-foreground ml-1">Email Address</Label>
                            <div className="relative">
                                <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                                <Input
                                    id="email"
                                    type="email"
                                    value={email}
                                    onChange={(e) => {
                                        setEmail(e.target.value);
                                        setValidationErrors(prev => ({ ...prev, email: undefined }));
                                    }}
                                    placeholder="dev@organisation.org"
                                    className={`pl-11 h-12 rounded-xl transition-all ${isDark ? 'bg-ios-gray-900 border-ios-gray-700' : 'bg-ios-gray-50 border-ios-gray-100'}`}
                                    required
                                />
                            </div>
                            {validationErrors.email && (
                                <p className="text-xs text-red-500 ml-1">{validationErrors.email}</p>
                            )}
                        </div>

                        {mode !== 'forgot' && (
                            <div className="space-y-2">
                                <div className="flex items-center justify-between ml-1">
                                    <Label htmlFor="password" className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Password</Label>
                                    {mode === 'signin' && (
                                        <button
                                            type="button"
                                            onClick={() => setMode('forgot')}
                                            className="text-xs text-blue-500 font-bold hover:underline"
                                        >
                                            Forgot?
                                        </button>
                                    )}
                                </div>
                                <div className="relative">
                                    <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                                    <Input
                                        id="password"
                                        type={showPassword ? 'text' : 'password'}
                                        value={password}
                                        onChange={(e) => {
                                            setPassword(e.target.value);
                                            setValidationErrors(prev => ({ ...prev, password: undefined }));
                                        }}
                                        placeholder="Min. 6 characters"
                                        className={`pl-11 pr-11 h-12 rounded-xl transition-all ${isDark ? 'bg-ios-gray-900 border-ios-gray-700' : 'bg-ios-gray-50 border-ios-gray-100'}`}
                                        required
                                    />
                                    <button
                                        type="button"
                                        onClick={() => setShowPassword(!showPassword)}
                                        className="absolute right-4 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                                    >
                                        {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                                    </button>
                                </div>
                                {validationErrors.password && (
                                    <p className="text-xs text-red-500 ml-1">{validationErrors.password}</p>
                                )}
                            </div>
                        )}

                        <Button
                            type="submit"
                            className="w-full h-12 rounded-2xl bg-blue-600 text-white font-black hover:bg-blue-700 shadow-lg active:scale-[0.98] transition-all disabled:opacity-60"
                            size="lg"
                            disabled={loading || (mode === 'forgot' && resetCooldown > 0)}
                        >
                            {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : (
                                <>
                                    {mode === 'signin' && 'Sign In'}
                                    {mode === 'signup' && 'Create Account'}
                                    {mode === 'forgot' && (resetCooldown > 0 ? `Resend in ${resetCooldown}s` : 'Send Reset Link')}
                                </>
                            )}
                        </Button>
                    </form>

                    {mode !== 'forgot' && (
                        <>
                            <div className="relative my-8">
                                <div className="absolute inset-0 flex items-center">
                                    <div className="w-full border-t border-ios-gray-200 dark:border-ios-gray-700" />
                                </div>
                                <div className="relative flex justify-center text-xs uppercase">
                                    <span className={`px-2 text-muted-foreground font-bold ${isDark ? 'bg-ios-gray-800' : 'bg-white'}`}>Or continue with</span>
                                </div>
                            </div>

                            <Button
                                type="button"
                                variant="outline"
                                className={`w-full h-12 rounded-2xl font-bold border-ios-gray-200 dark:border-ios-gray-700 ${isDark ? 'hover:bg-ios-gray-700' : 'hover:bg-ios-gray-50'}`}
                                onClick={handleGoogleSignIn}
                                disabled={loading}
                            >
                                <svg className="w-5 h-5 mr-3" viewBox="0 0 24 24">
                                    <path
                                        fill="currentColor"
                                        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                                    />
                                    <path
                                        fill="currentColor"
                                        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                                    />
                                    <path
                                        fill="currentColor"
                                        d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                                    />
                                    <path
                                        fill="currentColor"
                                        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                                    />
                                </svg>
                                Continue with Google
                            </Button>
                        </>
                    )}

                    <div className="text-center mt-8">
                        {mode === 'signin' && (
                            <p className="text-sm text-muted-foreground font-bold">
                                Don't have an account?{' '}
                                <button
                                    type="button"
                                    onClick={() => { setMode('signup'); setError(null); setSuccess(null); }}
                                    className="text-blue-500 hover:underline"
                                >
                                    Get Started
                                </button>
                            </p>
                        )}
                        {mode === 'signup' && (
                            <p className="text-sm text-muted-foreground font-bold">
                                Already have an account?{' '}
                                <button
                                    type="button"
                                    onClick={() => { setMode('signin'); setError(null); setSuccess(null); }}
                                    className="text-blue-500 hover:underline"
                                >
                                    Sign In
                                </button>
                            </p>
                        )}
                        {mode === 'forgot' && (
                            <button
                                type="button"
                                onClick={() => { setMode('signin'); setError(null); setSuccess(null); }}
                                className="text-sm text-blue-500 font-bold hover:underline"
                            >
                                ← Back to sign in
                            </button>
                        )}
                    </div>
                </motion.div>
            </main>

            <footer className="p-10 text-center">
                <p className="text-xs text-muted-foreground uppercase tracking-widest font-black opacity-30">
                    Nasaka IEBC • B2B Data Infrastructure
                </p>
            </footer>
        </div>
    );
};

export default Auth;

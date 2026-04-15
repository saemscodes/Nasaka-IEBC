import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Mail, Lock, User, Eye, EyeOff, Loader2, Shield } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useAuth as useDefaultAuth } from '@/hooks/useAuth';
import { useTheme } from '@/contexts/ThemeContext';
import { z } from 'zod';
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogDescription,
} from "@/components/ui/dialog";
import { CEKA_OAUTH_URL, CEKA_CLIENT_ID, CEKA_REDIRECT_URI } from '@/integrations/ceka/client';

const emailSchema = z.string().email('Please enter a valid email address');
const passwordSchema = z.string().min(6, 'Password must be at least 6 characters');

type AuthMode = 'signin' | 'signup' | 'forgot';

interface AuthModalProps {
    isOpen?: boolean;
    onClose?: () => void;
    onSuccess?: () => void;
    initialMode?: AuthMode;
    embedded?: boolean;
    mode?: AuthMode;
    useAuthHook?: any;
}

export const AuthModal = ({ 
    isOpen = false, 
    onClose = () => {}, 
    onSuccess, 
    initialMode = 'signin',
    embedded = false,
    mode: propMode,
    useAuthHook = useDefaultAuth
}: AuthModalProps) => {
    const { signIn, signUp, resetPassword, resendVerification, isAuthenticated, loading: authLoading } = useAuthHook();
    const { theme } = useTheme();
    const isDark = theme === 'dark';

    const [mode, setMode] = useState<AuthMode>(propMode || initialMode);
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [displayName, setDisplayName] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [success, setSuccess] = useState<string | null>(null);
    const [validationErrors, setValidationErrors] = useState<{ email?: string; password?: string }>({});
    const [showResend, setShowResend] = useState(false);

    useEffect(() => {
        if (isAuthenticated && isOpen) {
            onSuccess?.();
            onClose();
        }
    }, [isAuthenticated, isOpen, onSuccess, onClose]);

    // Reset form state when modal opens/closes or mode changes
    useEffect(() => {
        if (isOpen || embedded) {
            setError(null);
            setSuccess(null);
            setValidationErrors({});
            setShowResend(false);
        }
    }, [isOpen, mode, embedded]);

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
                    } else if (error.message.includes('Database error saving new user')) {
                        setError('Database Error: The "pgcrypto" extension might be missing on your Supabase project. Please enable it.');
                    } else {
                        setError(error.message);
                    }
                }
            } else if (mode === 'signup') {
                const { error } = await signUp(cleanEmail, password, displayName);
                if (error) {
                    if (error.message.includes('User already registered')) {
                        setError('An account with this email already exists. Please sign in instead.');
                    } else if (error.message.includes('Database error saving new user')) {
                        setError('Database Error: The "pgcrypto" extension might be missing on your Supabase project. Please enable it.');
                    } else {
                        setError(error.message);
                    }
                } else {
                    setSuccess('Account created! Please check your email inbox to confirm your account.');
                    setShowResend(true);
                }
            } else if (mode === 'forgot') {
                if (resetCooldown > 0) return;
                const { error } = await resetPassword(cleanEmail);
                if (error) {
                    if (error.message.toLowerCase().includes('rate limit')) {
                        setError("Emails are capped to 2 per hour. Make sure you remember your password.");
                    } else {
                        setError(error.message);
                    }
                } else {
                    setSuccess('Password reset link sent! Check your inbox. The link is single-use and expires in 60 minutes.');
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

    const inputBg = isDark ? 'bg-[#1C1C1E] border-[#38383A]' : 'bg-[#F2F2F7] border-[#E5E5EA]';
    const inputFocus = 'focus:border-[#007AFF] focus:ring-1 focus:ring-[#007AFF]/30';

    const handleCekaOAuth = () => {
        const state = Math.random().toString(36).substring(7);
        sessionStorage.setItem('ceka_oauth_state', state);
        const authUrl = `${CEKA_OAUTH_URL}?client_id=${CEKA_CLIENT_ID}&redirect_uri=${encodeURIComponent(CEKA_REDIRECT_URI)}&response_type=code&scope=openid%20profile%20email&state=${state}`;
        window.location.href = authUrl;
    };

    const formContent = (
        <div className={`px-8 pb-8 pt-6 ${embedded ? 'w-full' : ''}`}>
            {!embedded && (
                <DialogHeader className="mb-6">
                    <DialogTitle className="text-2xl text-center tracking-tight" style={{ fontFamily: 'var(--font-display)' }}>
                        {mode === 'signin' && 'Sign In'}
                        {mode === 'signup' && 'Create Account'}
                        {mode === 'forgot' && 'Reset Password'}
                    </DialogTitle>
                    <DialogDescription className="text-center text-sm" style={{ fontFamily: 'var(--font-body)' }}>
                        {mode === 'signin' && 'Manage your Nasaka IEBC API infrastructure'}
                        {mode === 'signup' && 'Join the Nasaka IEBC developer ecosystem'}
                        {mode === 'forgot' && 'Enter your email to restore account access'}
                    </DialogDescription>
                </DialogHeader>
            )}

            {mode !== 'forgot' && (
                <div className="mb-6">
                    <Button
                        type="button"
                        onClick={handleCekaOAuth}
                        className="w-full h-14 rounded-2xl bg-[#007AFF] text-white font-bold hover:bg-[#0055CC] active:scale-[0.98] transition-all shadow-lg shadow-[#007AFF]/20 flex items-center justify-center gap-3 group"
                        style={{ fontFamily: 'var(--font-display)' }}
                    >
                        <img src="/ceka-logo-colored.png" alt="" className="h-5 w-auto brightness-0 invert" />
                        <span className="text-[17px] tracking-tight">Continue with CEKA</span>
                    </Button>
                    
                    <div className="relative my-8">
                        <div className="absolute inset-0 flex items-center">
                            <span className="w-full border-t border-muted/20"></span>
                        </div>
                        <div className="relative flex justify-center text-[10px] uppercase font-bold tracking-widest">
                            <span className={`px-4 ${isDark ? 'bg-[#1C1C1E]' : 'bg-white'} text-muted-foreground/60`}>or use credentials</span>
                        </div>
                    </div>
                </div>
            )}

            <AnimatePresence mode="wait">
                {error && (
                    <motion.div
                        initial={{ opacity: 0, y: -10 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -10 }}
                        className="p-3.5 rounded-xl bg-red-500/10 border border-red-500/20 text-red-500 text-sm text-center mb-5 font-semibold"
                        style={{ fontFamily: 'var(--font-body)' }}
                    >
                        {error}
                    </motion.div>
                )}
                {success && (
                    <motion.div
                        initial={{ opacity: 0, y: -10 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -10 }}
                        className="p-3.5 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-600 dark:text-emerald-400 text-sm text-center mb-5 font-semibold flex flex-col items-center gap-2"
                        style={{ fontFamily: 'var(--font-body)' }}
                    >
                        <span>{success}</span>
                        {showResend && (
                            <button
                                type="button"
                                onClick={handleResendVerification}
                                disabled={loading}
                                className="text-xs font-bold text-emerald-700 dark:text-emerald-300 hover:underline"
                            >
                                Didn't get the email? Resend
                            </button>
                        )}
                    </motion.div>
                )}
            </AnimatePresence>

            <form onSubmit={handleSubmit} className="space-y-4">
                {mode === 'signup' && (
                    <div className="space-y-1.5">
                        <Label className="text-[10px] font-bold uppercase tracking-[0.15em] text-muted-foreground ml-1" style={{ fontFamily: 'var(--font-body)' }}>Organisation / Name</Label>
                        <div className="relative">
                            <User className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                            <Input
                                type="text"
                                value={displayName}
                                onChange={e => setDisplayName(e.target.value)}
                                placeholder="Organisation or Full Name"
                                className={`pl-10 h-12 rounded-xl border transition-all ${inputBg} ${inputFocus}`}
                                style={{ fontFamily: 'var(--font-body)' }}
                            />
                        </div>
                    </div>
                )}

                <div className="space-y-1.5">
                    <Label className="text-[10px] font-bold uppercase tracking-[0.15em] text-muted-foreground ml-1" style={{ fontFamily: 'var(--font-body)' }}>Email Address</Label>
                    <div className="relative">
                        <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                        <Input
                            type="email"
                            value={email}
                            onChange={e => {
                                setEmail(e.target.value);
                                setValidationErrors(prev => ({ ...prev, email: undefined }));
                            }}
                            placeholder="dev@organisation.org"
                            className={`pl-10 h-12 rounded-xl border transition-all ${inputBg} ${inputFocus}`}
                            style={{ fontFamily: 'var(--font-body)' }}
                            required
                        />
                    </div>
                    {validationErrors.email && (
                        <p className="text-[11px] text-red-500 ml-1 font-medium">{validationErrors.email}</p>
                    )}
                </div>

                {mode !== 'forgot' && (
                    <div className="space-y-1.5">
                        <div className="flex items-center justify-between ml-1">
                            <Label className="text-[10px] font-bold uppercase tracking-[0.15em] text-muted-foreground" style={{ fontFamily: 'var(--font-body)' }}>Password</Label>
                            {mode === 'signin' && (
                                <button type="button" onClick={() => setMode('forgot')} className="text-[11px] text-[#007AFF] font-bold hover:underline">Forgot?</button>
                            )}
                        </div>
                        <div className="relative">
                            <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                            <Input
                                type={showPassword ? 'text' : 'password'}
                                value={password}
                                onChange={e => {
                                    setPassword(e.target.value);
                                    setValidationErrors(prev => ({ ...prev, password: undefined }));
                                }}
                                placeholder="Min. 6 characters"
                                className={`pl-10 pr-10 h-12 rounded-xl border transition-all ${inputBg} ${inputFocus}`}
                                style={{ fontFamily: 'var(--font-body)' }}
                                required
                            />
                            <button
                                type="button"
                                onClick={() => setShowPassword(!showPassword)}
                                className="absolute right-3.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                                aria-label={showPassword ? 'Hide password' : 'Show password'}
                            >
                                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                            </button>
                        </div>
                        {validationErrors.password && (
                            <p className="text-[11px] text-red-500 ml-1 font-medium">{validationErrors.password}</p>
                        )}
                    </div>
                )}

                <Button
                    type="submit"
                    disabled={loading || (mode === 'forgot' && resetCooldown > 0)}
                    className="w-full h-14 rounded-2xl bg-[#007AFF] text-white font-bold hover:bg-[#0055CC] active:scale-[0.98] transition-all shadow-lg shadow-[#007AFF]/20 flex items-center justify-center"
                    style={{ fontFamily: 'var(--font-display)' }}
                >
                    {loading ? <Loader2 className="w-6 h-6 animate-spin" /> : (
                        <span className="text-[17px] tracking-tight">
                            {mode === 'signin' && 'Sign In'}
                            {mode === 'signup' && 'Create Account'}
                            {mode === 'forgot' && (resetCooldown > 0 ? `Resend in ${resetCooldown}s` : 'Send Reset Link')}
                        </span>
                    )}
                </Button>

                {showResend && mode === 'signin' && (
                    <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={handleResendVerification}
                        className="w-full text-xs text-[#007AFF]"
                        disabled={loading}
                    >
                        Resend verification email
                    </Button>
                )}
            </form>

            <div className="text-center mt-5" style={{ fontFamily: 'var(--font-body)' }}>
                {mode === 'signin' ? (
                    <button
                        onClick={() => { setMode('signup'); setError(null); setSuccess(null); }}
                        className="text-sm text-[#007AFF] font-bold hover:underline"
                    >
                        Don't have an account? Start Free
                    </button>
                ) : mode === 'signup' ? (
                    <button
                        onClick={() => { setMode('signin'); setError(null); setSuccess(null); }}
                        className="text-sm text-[#007AFF] font-bold hover:underline"
                    >
                        Already have an account? Sign In
                    </button>
                ) : (
                    <button
                        onClick={() => { setMode('signin'); setError(null); setSuccess(null); }}
                        className="text-sm text-[#007AFF] font-bold hover:underline"
                    >
                        Back to sign in
                    </button>
                )}
            </div>

            <div className={`mt-6 pt-5 border-t ${isDark ? 'border-[#38383A]' : 'border-[#E5E5EA]'} flex items-center justify-center gap-2`}>
                <span className="text-[10px] font-bold uppercase tracking-[0.15em] text-muted-foreground" style={{ fontFamily: 'var(--font-body)' }}>
                    Powered by
                </span>
                <img
                    src={isDark ? '/ceka-logo-black.png' : '/ceka-logo-colored.png'}
                    alt="CEKA"
                    className="h-5 object-contain"
                    style={isDark ? { filter: 'invert(1)' } : undefined}
                />
            </div>
        </div>
    );

    if (embedded) return formContent;

    return (
        <Dialog open={isOpen} onOpenChange={onClose}>
            <DialogContent className={`sm:max-w-[420px] p-0 overflow-hidden border rounded-[2rem] shadow-2xl ${isDark ? 'bg-[#1C1C1E] border-[#38383A]' : 'bg-white border-[#E5E5EA]'}`}>
                <div className={`flex items-center justify-center gap-2 px-6 py-2.5 text-[10px] font-bold uppercase tracking-[0.2em] ${isDark ? 'bg-[#007AFF]/8 text-[#007AFF]' : 'bg-[#007AFF]/5 text-[#007AFF]'}`}>
                    <Shield className="w-3 h-3" />
                    Encrypted connection — your data is secure
                </div>
                {formContent}
            </DialogContent>
        </Dialog>
    );
};

export default AuthModal;

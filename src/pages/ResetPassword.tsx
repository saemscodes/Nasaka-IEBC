import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Lock, Eye, EyeOff, Loader2, CheckCircle, ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useAuth } from '@/hooks/useAuth';
import { useTheme } from '@/contexts/ThemeContext';
import { z } from 'zod';
import { toast } from 'sonner';

const passwordSchema = z.string().min(6, 'Password must be at least 6 characters');

const ResetPassword = () => {
    const navigate = useNavigate();
    const { updatePassword, session, loading: authLoading } = useAuth();
    const { theme } = useTheme();
    const isDark = theme === 'dark';

    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [success, setSuccess] = useState(false);
    const [validationErrors, setValidationErrors] = useState<{ password?: string; confirm?: string }>({});

    useEffect(() => {
        if (!authLoading && !session) {
            toast.error("Invalid or expired reset session. Please request a new link.");
            navigate('/auth');
        }
    }, [session, authLoading, navigate]);

    const validateForm = () => {
        const errors: { password?: string; confirm?: string } = {};

        try {
            passwordSchema.parse(password);
        } catch (e) {
            if (e instanceof z.ZodError) {
                errors.password = e.errors[0].message;
            }
        }

        if (password !== confirmPassword) {
            errors.confirm = "Passwords do not match";
        }

        setValidationErrors(errors);
        return Object.keys(errors).length === 0;
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError(null);

        if (!validateForm()) return;

        setLoading(true);

        try {
            const { error } = await updatePassword(password);
            if (error) {
                setError(error.message);
            } else {
                setSuccess(true);
                toast.success("Password updated successfully!");
                setTimeout(() => navigate('/auth'), 3000);
            }
        } catch (err: any) {
            setError(err.message || "An unexpected error occurred");
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
                <Button variant="ghost" size="icon" onClick={() => navigate('/auth')} className="rounded-2xl">
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
                        <img src={logo} alt="Nasaka IEBC" className="h-16 mx-auto mb-6 object-contain" />
                        <h1 className="text-3xl font-black tracking-tight mb-2">Set New Password</h1>
                        <p className="text-sm text-muted-foreground">
                            Create a secure password to protect your API access
                        </p>
                    </div>

                    {success ? (
                        <motion.div
                            initial={{ opacity: 0, scale: 0.95 }}
                            animate={{ opacity: 1, scale: 1 }}
                            className="p-6 rounded-[2rem] bg-emerald-500/10 border border-emerald-500/20 text-center space-y-4"
                        >
                            <CheckCircle className="w-12 h-12 text-emerald-500 mx-auto" />
                            <div className="space-y-2">
                                <h3 className="font-bold text-emerald-700 dark:text-emerald-400">Password Updated</h3>
                                <p className="text-sm text-emerald-600 dark:text-emerald-500">
                                    Your password has been changed successfully. Redirecting to sign in...
                                </p>
                            </div>
                            <Button onClick={() => navigate('/auth')} className="w-full h-11 rounded-xl bg-emerald-500 hover:bg-emerald-600 font-bold">
                                Sign In Now
                            </Button>
                        </motion.div>
                    ) : (
                        <form onSubmit={handleSubmit} className="space-y-4">
                            {error && (
                                <div className="p-4 rounded-2xl bg-red-500/10 border border-red-500/20 text-red-500 text-sm font-bold text-center">
                                    {error}
                                </div>
                            )}

                            <div className="space-y-2">
                                <Label htmlFor="password">New Password</Label>
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
                                        className={`pl-11 pr-11 h-12 rounded-xl border-ios-gray-100 dark:border-ios-gray-700 ${isDark ? 'bg-ios-gray-900' : 'bg-ios-gray-50'}`}
                                        required
                                    />
                                    <button
                                        type="button"
                                        onClick={() => setShowPassword(!showPassword)}
                                        className="absolute right-4 top-1/2 -translate-y-1/2 text-muted-foreground"
                                    >
                                        {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                                    </button>
                                </div>
                                {validationErrors.password && (
                                    <p className="text-xs text-red-500">{validationErrors.password}</p>
                                )}
                            </div>

                            <div className="space-y-2">
                                <Label htmlFor="confirmPassword">Confirm Password</Label>
                                <div className="relative">
                                    <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                                    <Input
                                        id="confirmPassword"
                                        type={showPassword ? 'text' : 'password'}
                                        value={confirmPassword}
                                        onChange={(e) => {
                                            setConfirmPassword(e.target.value);
                                            setValidationErrors(prev => ({ ...prev, confirm: undefined }));
                                        }}
                                        placeholder="Repeat password"
                                        className={`pl-11 h-12 rounded-xl border-ios-gray-100 dark:border-ios-gray-700 ${isDark ? 'bg-ios-gray-900' : 'bg-ios-gray-50'}`}
                                        required
                                    />
                                </div>
                                {validationErrors.confirm && (
                                    <p className="text-xs text-red-500">{validationErrors.confirm}</p>
                                )}
                            </div>

                            <Button type="submit" className="w-full h-12 rounded-2xl bg-blue-600 text-white font-black hover:bg-blue-700 shadow-lg active:scale-[0.98] transition-all" size="lg" disabled={loading}>
                                {loading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                                Update Password
                            </Button>
                        </form>
                    )}
                </motion.div>
            </main>
        </div>
    );
};

export default ResetPassword;

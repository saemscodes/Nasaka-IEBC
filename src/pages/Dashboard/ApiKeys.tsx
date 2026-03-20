import React, { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
    Key,
    Copy,
    Check,
    Eye,
    EyeOff,
    RefreshCw,
    Shield,
    Zap,
    Crown,
    Building2,
    Users,
    AlertCircle,
    Loader2,
    CreditCard,
    BarChart3,
    Clock,
    Calendar,
    ArrowUpRight,
    ChevronRight,
    Database,
    Trash2,
    Plus,
    LogOut,
    Coins
} from 'lucide-react';
import { useTheme } from '@/contexts/ThemeContext';
import { SEOHead } from '@/components/SEO/SEOHead';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { AuthModal } from '@/components/Auth/AuthModal';
import { toast } from 'sonner';

// ─── Types ───────────────────────────────────────────────────────────────────
interface ApiKeyData {
    id: string;
    key_prefix: string;
    tier: string;
    plan_status: string;
    monthly_request_count: number;
    credits_balance: number;
    current_period_start: string | null;
    current_period_end: string | null;
    monthly_reset_date: string | null;
    is_locked: boolean;
    created_at: string;
}

interface PaymentRecord {
    id: string;
    paystack_reference: string;
    channel: string;
    amount_kobo: number;
    currency: string;
    tier_purchased: string;
    billing_interval: string;
    status: string;
    paid_at: string | null;
    created_at: string;
}

// ─── Tier Config (Nasaka Blue) ───────────────────────────────────────────────
const TIER_CONFIG: Record<string, {
    icon: React.ReactNode;
    color: string;
    bgColor: string;
    monthlyLimit: number;
    label: string;
}> = {
    jamii: { icon: <img src="/icons/tiers/jamii.svg" alt="Jamii" className="w-4 h-4" />, color: 'text-[#007AFF]', bgColor: 'bg-[#007AFF]/5', monthlyLimit: 5000, label: 'Jamii (Community)' },
    mwananchi: { icon: <img src="/icons/tiers/mwananchi.svg" alt="Mwananchi" className="w-4 h-4" />, color: 'text-[#007AFF]', bgColor: 'bg-[#007AFF]/10', monthlyLimit: 100000, label: 'Mwananchi' },
    taifa: { icon: <img src="/icons/tiers/taifa.svg" alt="Taifa" className="w-4 h-4" />, color: 'text-[#007AFF]', bgColor: 'bg-[#007AFF]/15', monthlyLimit: 500000, label: 'Taifa' },
    serikali: { icon: <img src="/icons/tiers/serikali.svg" alt="Serikali" className="w-4 h-4" />, color: 'text-[#007AFF]', bgColor: 'bg-[#007AFF]/20', monthlyLimit: 0, label: 'Serikali (Enterprise)' }
};

// ─── Stat Card ───────────────────────────────────────────────────────────────
const StatCard = ({
    icon,
    label,
    value,
    subtext,
    isDark,
    color = 'text-blue-500'
}: {
    icon: React.ReactNode;
    label: string;
    value: string | number;
    subtext?: string;
    isDark: boolean;
    color?: string;
}) => (
    <div className={`p-6 rounded-[2rem] border ${isDark ? 'bg-ios-gray-800 border-ios-gray-700' : 'bg-white border-ios-gray-100 shadow-sm'}`}>
        <div className={`w-10 h-10 rounded-xl flex items-center justify-center mb-4 ${color.replace('text-', 'bg-').replace('500', '500/10')}`}>
            <span className={color}>{icon}</span>
        </div>
        <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground mb-1">{label}</p>
        <p className="text-2xl font-black">{value}</p>
        {subtext && <p className="text-xs text-muted-foreground mt-1">{subtext}</p>}
    </div>
);

// ─── Usage Progress Bar ──────────────────────────────────────────────────────
const UsageBar = ({
    used,
    limit,
    isDark
}: {
    used: number;
    limit: number;
    isDark: boolean;
}) => {
    const pct = limit > 0 ? Math.min((used / limit) * 100, 100) : 0;
    const isWarning = pct >= 70;
    const isDanger = pct >= 90;

    const barColor = isDanger ? 'bg-red-500' : isWarning ? 'bg-amber-500' : 'bg-blue-500';

    return (
        <div>
            <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-semibold">{used.toLocaleString()} / {limit.toLocaleString()} requests</span>
                <span className={`text-sm font-bold ${isDanger ? 'text-red-500' : isWarning ? 'text-amber-500' : 'text-blue-500'}`}>
                    {pct.toFixed(1)}%
                </span>
            </div>
            <div className={`w-full h-3 rounded-full overflow-hidden ${isDark ? 'bg-ios-gray-700' : 'bg-ios-gray-100'}`}>
                <motion.div
                    initial={{ width: 0 }}
                    animate={{ width: `${pct}%` }}
                    transition={{ duration: 1, ease: 'easeOut' }}
                    className={`h-full rounded-full ${barColor}`}
                />
            </div>
        </div>
    );
};

// ─── API Key Display ─────────────────────────────────────────────────────────
const ApiKeyRow = ({
    apiKey,
    isDark,
    onRefresh
}: {
    apiKey: ApiKeyData;
    isDark: boolean;
    onRefresh: () => void;
}) => {
    const [showKey, setShowKey] = useState(false);
    const [copied, setCopied] = useState(false);
    const tierConfig = TIER_CONFIG[apiKey.tier] || TIER_CONFIG.jamii;

    const handleCopy = () => {
        navigator.clipboard.writeText(apiKey.key_prefix + '••••••••');
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    const daysRemaining = apiKey.current_period_end
        ? Math.max(0, Math.ceil((new Date(apiKey.current_period_end).getTime() - Date.now()) / (1000 * 60 * 60 * 24)))
        : null;

    return (
        <div className={`p-6 rounded-[2rem] border ${isDark ? 'bg-ios-gray-800 border-ios-gray-700' : 'bg-white border-ios-gray-100 shadow-sm'}`}>
            <div className="flex items-start justify-between mb-4">
                <div className="flex items-center gap-3">
                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${tierConfig.bgColor}`}>
                        <span className={tierConfig.color}>{tierConfig.icon}</span>
                    </div>
                    <div>
                        <div className="flex items-center gap-2">
                            <span className="font-bold">{tierConfig.label}</span>
                            {apiKey.is_locked && (
                                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-red-500/10 text-red-500">LOCKED</span>
                            )}
                            {apiKey.plan_status === 'past_due' && (
                                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-500">PAST DUE</span>
                            )}
                            {apiKey.plan_status === 'active' && !apiKey.is_locked && (
                                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-500">ACTIVE</span>
                            )}
                        </div>
                        <p className="text-xs text-muted-foreground">
                            Created {new Date(apiKey.created_at).toLocaleDateString()}
                        </p>
                    </div>
                </div>
            </div>

            {/* API Key display */}
            <div className={`flex items-center gap-2 p-3 rounded-xl mb-4 font-mono text-sm ${isDark ? 'bg-ios-gray-900' : 'bg-ios-gray-50'}`}>
                <Key className="w-4 h-4 text-muted-foreground shrink-0" />
                <span className="flex-1 truncate">
                    {showKey ? apiKey.key_prefix + '••••••••••••••••' : '••••••••••••••••••••••••••••'}
                </span>
                <button onClick={() => setShowKey(!showKey)} className="p-1 hover:bg-ios-gray-200 dark:hover:bg-ios-gray-700 rounded-lg transition-colors">
                    {showKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
                <button onClick={handleCopy} className="p-1 hover:bg-ios-gray-200 dark:hover:bg-ios-gray-700 rounded-lg transition-colors">
                    {copied ? <Check className="w-4 h-4 text-emerald-500" /> : <Copy className="w-4 h-4" />}
                </button>
            </div>

            {/* Usage bar */}
            <UsageBar
                used={apiKey.monthly_request_count || 0}
                limit={tierConfig.monthlyLimit}
                isDark={isDark}
            />

            {/* Meta row */}
            <div className="flex flex-wrap gap-4 mt-4 text-xs text-muted-foreground">
                {apiKey.monthly_reset_date && (
                    <div className="flex items-center gap-1">
                        <RefreshCw className="w-3 h-3" />
                        Resets {new Date(apiKey.monthly_reset_date).toLocaleDateString()}
                    </div>
                )}
                {daysRemaining !== null && (
                    <div className="flex items-center gap-1">
                        <Calendar className="w-3 h-3" />
                        {daysRemaining} days remaining
                    </div>
                )}
                {apiKey.credits_balance > 0 && (
                    <div className="flex items-center gap-1">
                        <Coins className="w-3 h-3" />
                        {apiKey.credits_balance.toLocaleString()} credits
                    </div>
                )}
            </div>

            {/* Actions */}
            <div className="flex gap-2 mt-4">
                {apiKey.tier !== 'serikali' && apiKey.tier !== 'taifa' && (
                    <Link
                        to="/pricing"
                        className="flex-1 py-2.5 rounded-xl text-center font-bold text-sm bg-[#007AFF] hover:bg-[#0055CC] text-white hover:shadow-lg active:scale-[0.98] transition-all"
                    >
                        Upgrade Plan
                    </Link>
                )}
            </div>
        </div>
    );
};

// ─── Payment History Table ───────────────────────────────────────────────────
const PaymentHistory = ({
    payments,
    isDark,
    loading
}: {
    payments: PaymentRecord[];
    isDark: boolean;
    loading: boolean;
}) => {
    if (loading) {
        return (
            <div className="flex items-center justify-center py-12">
                <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
            </div>
        );
    }

    if (payments.length === 0) {
        return (
            <div className="text-center py-12">
                <CreditCard className="w-10 h-10 text-muted-foreground mx-auto mb-3 opacity-40" />
                <p className="text-muted-foreground text-sm">No payments yet</p>
            </div>
        );
    }

    return (
        <div className="overflow-x-auto">
            <table className="w-full text-sm">
                <thead>
                    <tr className="border-b border-ios-gray-200 dark:border-ios-gray-700">
                        <th className="text-left py-3 px-4 font-bold text-xs uppercase tracking-widest text-muted-foreground">Date</th>
                        <th className="text-left py-3 px-4 font-bold text-xs uppercase tracking-widest text-muted-foreground">Reference</th>
                        <th className="text-left py-3 px-4 font-bold text-xs uppercase tracking-widest text-muted-foreground">Product</th>
                        <th className="text-left py-3 px-4 font-bold text-xs uppercase tracking-widest text-muted-foreground">Channel</th>
                        <th className="text-right py-3 px-4 font-bold text-xs uppercase tracking-widest text-muted-foreground">Amount</th>
                        <th className="text-center py-3 px-4 font-bold text-xs uppercase tracking-widest text-muted-foreground">Status</th>
                    </tr>
                </thead>
                <tbody>
                    {payments.map(p => (
                        <tr key={p.id} className="border-b border-ios-gray-100 dark:border-ios-gray-800 last:border-0">
                            <td className="py-3 px-4 text-muted-foreground">
                                {p.paid_at ? new Date(p.paid_at).toLocaleDateString() : '—'}
                            </td>
                            <td className="py-3 px-4 font-mono text-xs">{p.paystack_reference}</td>
                            <td className="py-3 px-4 capitalize">{p.tier_purchased} ({p.billing_interval})</td>
                            <td className="py-3 px-4 capitalize">{p.channel.replace('_', ' ')}</td>
                            <td className="py-3 px-4 text-right font-bold">
                                {p.currency} {(p.amount_kobo / 100).toLocaleString()}
                            </td>
                            <td className="py-3 px-4 text-center">
                                <span className={`text-[10px] font-bold px-2 py-1 rounded-full ${p.status === 'success'
                                    ? 'bg-emerald-500/10 text-emerald-500'
                                    : p.status === 'failed'
                                        ? 'bg-red-500/10 text-red-500'
                                        : 'bg-amber-500/10 text-amber-500'
                                    }`}>
                                    {p.status.toUpperCase()}
                                </span>
                            </td>
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    );
};

// ─── Main Dashboard ──────────────────────────────────────────────────────────
const ApiKeys = () => {
    const { theme } = useTheme();
    const isDark = theme === 'dark';
    const navigate = useNavigate();
    const [searchParams] = useSearchParams();
    const { user, isAuthenticated, signOut, loading: authLoading } = useAuth();

    const [loading, setLoading] = useState(false);
    const [apiKeys, setApiKeys] = useState<ApiKeyData[]>([]);
    const [payments, setPayments] = useState<PaymentRecord[]>([]);
    const [paymentsLoading, setPaymentsLoading] = useState(true);
    const [error, setError] = useState('');

    const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);

    useEffect(() => {
        const purchased = searchParams.get('purchased');
        if (purchased) {
            toast.success('Your purchase was successful! Your API key has been updated.');
        }
    }, [searchParams]);

    const fetchData = useCallback(async () => {
        if (!isAuthenticated) return;

        setLoading(true);
        try {
            // Fetch API keys
            const { data: keys, error: keysErr } = await (supabase as any)
                .from('api_keys')
                .select('id, key_prefix, tier, plan_status, monthly_request_count, credits_balance, current_period_start, current_period_end, monthly_reset_date, is_locked, created_at')
                .eq('user_id', user?.id)
                .order('created_at', { ascending: false });

            if (keysErr) {
                console.error('Keys fetch error:', keysErr);
                setError('Failed to load API keys');
            } else {
                setApiKeys((keys as any[]) || []);
            }

            // Fetch payment history
            setPaymentsLoading(true);
            const keyIds = (keys || []).map((k: any) => k.id);
            if (keyIds.length > 0) {
                const { data: paymentData, error: payErr } = await (supabase as any)
                    .from('nasaka_payment_history')
                    .select('*')
                    .in('api_key_id', keyIds)
                    .order('created_at', { ascending: false })
                    .limit(20);

                if (!payErr && paymentData) {
                    setPayments(paymentData as any[]);
                }
            }
            setPaymentsLoading(false);
        } catch (err: any) {
            setError(err.message || 'An error occurred');
        } finally {
            setLoading(false);
        }
    }, [isAuthenticated, user]);

    useEffect(() => {
        fetchData();
    }, [fetchData]);

    const totalRequests = apiKeys.reduce((sum, k) => sum + (k.monthly_request_count || 0), 0);
    const totalCredits = apiKeys.reduce((sum, k) => sum + (k.credits_balance || 0), 0);
    const activeTier = apiKeys.length > 0 ? apiKeys[0].tier : 'jamii';

    if (loading || authLoading) {
        return (
            <div className={`min-h-screen flex items-center justify-center ${isDark ? 'bg-ios-gray-900' : 'bg-ios-gray-50'}`}>
                <div className="text-center">
                    <Loader2 className="w-10 h-10 animate-spin text-blue-500 mx-auto mb-4" />
                    <p className="text-muted-foreground">Loading dashboard…</p>
                </div>
            </div>
        );
    }

    if (!isAuthenticated) {
        return (
            <div className={`min-h-screen flex items-center justify-center ${isDark ? 'bg-ios-gray-900' : 'bg-ios-gray-50'}`}>
                <motion.div
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    className={`max-w-md p-12 rounded-[3.5rem] border text-center ${isDark ? 'bg-ios-gray-800 border-ios-gray-700' : 'bg-white border-ios-gray-100 shadow-xl'}`}
                >
                    <div className="w-20 h-20 rounded-full bg-blue-500/10 flex items-center justify-center mx-auto mb-8">
                        <Shield className="w-10 h-10 text-blue-500" />
                    </div>
                    <h2 className="text-3xl font-black mb-4 tracking-tight">API Infrastructure</h2>
                    <p className="text-muted-foreground mb-8 text-lg">
                        Sign in to manage your API keys, monitor usage, and scale your civic data access.
                    </p>
                    <div className="space-y-3">
                        <button
                            onClick={() => setIsAuthModalOpen(true)}
                            className="w-full h-14 rounded-2xl bg-blue-600 text-white font-black hover:bg-blue-700 shadow-lg active:scale-[0.98] transition-all flex items-center justify-center gap-2"
                        >
                            Sign In to Console
                        </button>
                        <Link
                            to="/"
                            className="w-full h-14 rounded-2xl bg-transparent font-bold flex items-center justify-center gap-2 hover:bg-ios-gray-100 dark:hover:bg-ios-gray-700 transition-all text-muted-foreground"
                        >
                            <ChevronRight className="w-4 h-4 rotate-180" />
                            Return Home
                        </Link>
                    </div>
                </motion.div>
                <AuthModal isOpen={isAuthModalOpen} onClose={() => setIsAuthModalOpen(false)} />
            </div>
        );
    }

    return (
        <div className={`min-h-screen pb-20 transition-colors duration-500 ${isDark ? 'bg-ios-gray-900 text-white' : 'bg-ios-gray-50 text-ios-gray-900'}`}>
            <SEOHead
                title="API Dashboard — Nasaka IEBC | Manage Your API Keys"
                description="Manage your Nasaka IEBC API keys, monitor usage, view payment history, and upgrade your plan."
                canonical="/dashboard/api-keys"
            />

            <div className="max-w-5xl mx-auto px-6 pt-16">
                {/* ── Header ── */}
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="mb-10"
                >
                    <div className="flex items-center justify-between mb-6">
                        <div>
                            <h1 className="text-4xl font-black tracking-tight">API Dashboard</h1>
                            <div className="flex items-center gap-4 mt-2">
                                <p className="text-muted-foreground">
                                    {user?.email || 'Developer Dashboard'}
                                </p>
                                <button
                                    onClick={() => signOut()}
                                    className="text-xs font-bold text-red-500 hover:underline flex items-center gap-1"
                                >
                                    <LogOut className="w-3 h-3" />
                                    Sign Out
                                </button>
                            </div>
                        </div>
                        <div className="flex gap-3">
                            <Link
                                to="/pricing"
                                className="px-6 py-2.5 rounded-xl font-bold text-sm bg-ios-gray-100 dark:bg-ios-gray-800 hover:bg-ios-gray-200 dark:hover:bg-ios-gray-700 transition-all flex items-center gap-2 border border-ios-gray-200 dark:border-ios-gray-700"
                            >
                                Plans
                            </Link>
                            <Link
                                to="/pricing"
                                className="px-6 py-2.5 rounded-xl font-bold text-sm bg-[#007AFF] hover:bg-[#0055CC] text-white hover:shadow-lg active:scale-[0.98] transition-all flex items-center gap-2"
                            >
                                Upgrade
                                <ArrowUpRight className="w-4 h-4" />
                            </Link>
                        </div>
                    </div>
                </motion.div>

                {/* ── Stats ── */}
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.1 }}
                    className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-10"
                >
                    <StatCard
                        icon={<BarChart3 className="w-5 h-5" />}
                        label="Monthly Requests"
                        value={totalRequests.toLocaleString()}
                        subtext={`of ${(TIER_CONFIG[activeTier]?.monthlyLimit || 5000).toLocaleString()} limit`}
                        isDark={isDark}
                        color="text-blue-500"
                    />
                    <StatCard
                        icon={<Key className="w-5 h-5" />}
                        label="API Keys"
                        value={apiKeys.length}
                        subtext={`${apiKeys.filter(k => !k.is_locked).length} active`}
                        isDark={isDark}
                        color="text-emerald-500"
                    />
                    <StatCard
                        icon={<Coins className="w-5 h-5" />}
                        label="Credits Balance"
                        value={totalCredits.toLocaleString()}
                        subtext="never expire"
                        isDark={isDark}
                        color="text-amber-500"
                    />
                    <StatCard
                        icon={<CreditCard className="w-5 h-5" />}
                        label="Total Payments"
                        value={payments.filter(p => p.status === 'success').length}
                        subtext={`KES ${payments.filter(p => p.status === 'success').reduce((s, p) => s + p.amount_kobo / 100, 0).toLocaleString()}`}
                        isDark={isDark}
                        color="text-[#007AFF]"
                    />
                </motion.div>

                {/* ── API Keys ── */}
                <motion.section
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.2 }}
                    className="mb-10"
                >
                    <div className="flex items-center justify-between mb-6">
                        <h2 className="text-2xl font-black">API Keys</h2>
                        <button
                            onClick={fetchData}
                            className={`p-2 rounded-xl transition-colors ${isDark ? 'hover:bg-ios-gray-800' : 'hover:bg-ios-gray-100'}`}
                        >
                            <RefreshCw className="w-4 h-4" />
                        </button>
                    </div>

                    {apiKeys.length === 0 ? (
                        <div className={`p-10 rounded-[3rem] border text-center ${isDark ? 'bg-ios-gray-800 border-ios-gray-700' : 'bg-white border-ios-gray-100 shadow-sm'}`}>
                            <Key className="w-12 h-12 text-muted-foreground mx-auto mb-4 opacity-40" />
                            <h3 className="text-xl font-bold mb-2">No API Keys Yet</h3>
                            <p className="text-muted-foreground mb-6 max-w-md mx-auto">
                                Create your first API key to start using the Nasaka IEBC data API. The Jamii (Community) tier is free.
                            </p>
                            <Link
                                to="/pricing"
                                className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-blue-500 text-white font-bold hover:bg-blue-600 transition-colors"
                            >
                                <Plus className="w-4 h-4" />
                                Get Started
                            </Link>
                        </div>
                    ) : (
                        <div className="space-y-4">
                            {apiKeys.map(key => (
                                <ApiKeyRow key={key.id} apiKey={key} isDark={isDark} onRefresh={fetchData} />
                            ))}
                        </div>
                    )}
                </motion.section>

                {/* ── Data Exports (Licenses) ── */}
                <motion.section
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.25 }}
                    className="mb-10"
                >
                    <h2 className="text-2xl font-black mb-6">Data Exports</h2>
                    <div className={`p-8 rounded-[2.5rem] border ${isDark ? 'bg-ios-gray-800 border-ios-gray-700' : 'bg-white border-ios-gray-100 shadow-sm'}`}>
                        <div className="flex items-center gap-4 mb-6">
                            <div className="w-12 h-12 rounded-2xl bg-[#007AFF]/10 flex items-center justify-center text-[#007AFF]">
                                <Database className="w-6 h-6" />
                            </div>
                            <div>
                                <h3 className="text-xl font-bold">Verified Datasets</h3>
                                <p className="text-sm text-muted-foreground">Download full GeoJSON/CSV datasets for your approved licenses.</p>
                            </div>
                        </div>

                        {apiKeys.some(k => k.tier === 'taifa' || k.tier === 'serikali') ? (
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <button
                                    onClick={() => window.open('/api/v1/licenses/download?format=geojson', '_blank')}
                                    className={`flex items-center justify-between p-4 rounded-2xl border transition-all hover:scale-[1.02] ${isDark ? 'bg-ios-gray-900 border-ios-gray-700' : 'bg-ios-gray-50 border-ios-gray-200'}`}
                                >
                                    <div className="flex items-center gap-3">
                                        <div className="p-2 rounded-lg bg-emerald-500/10 text-emerald-500"><Check className="w-4 h-4" /></div>
                                        <div className="text-left">
                                            <p className="font-bold text-sm">Full GeoJSON Packet</p>
                                            <p className="text-[10px] text-muted-foreground">Nightly build • Verified</p>
                                        </div>
                                    </div>
                                    <ArrowUpRight className="w-4 h-4 text-muted-foreground" />
                                </button>
                                <button
                                    onClick={() => window.open('/api/v1/licenses/download?format=csv', '_blank')}
                                    className={`flex items-center justify-between p-4 rounded-2xl border transition-all hover:scale-[1.02] ${isDark ? 'bg-ios-gray-900 border-ios-gray-700' : 'bg-ios-gray-50 border-ios-gray-200'}`}
                                >
                                    <div className="flex items-center gap-3">
                                        <div className="p-2 rounded-lg bg-blue-500/10 text-blue-500"><Check className="w-4 h-4" /></div>
                                        <div className="text-left">
                                            <p className="font-bold text-sm">Full CSV Dataset</p>
                                            <p className="text-[10px] text-muted-foreground">Optimized for Excel/GIS</p>
                                        </div>
                                    </div>
                                    <ArrowUpRight className="w-4 h-4 text-muted-foreground" />
                                </button>
                            </div>
                        ) : (
                            <div className="flex items-center gap-3 p-4 rounded-2xl bg-ios-gray-100 dark:bg-ios-gray-900/50 text-muted-foreground italic text-sm">
                                <AlertCircle className="w-4 h-4" />
                                <p>No active Data Licenses found. <Link to="/pricing" className="text-blue-500 not-italic font-bold hover:underline">View licenses →</Link></p>
                            </div>
                        )}
                    </div>
                </motion.section>

                {/* ── Payment History ── */}
                <motion.section
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.3 }}
                    className="mb-10"
                >
                    <h2 className="text-2xl font-black mb-6">Payment History</h2>
                    <div className={`rounded-[2.5rem] border overflow-hidden ${isDark ? 'bg-ios-gray-800 border-ios-gray-700' : 'bg-white border-ios-gray-100 shadow-sm'}`}>
                        <PaymentHistory payments={payments} isDark={isDark} loading={paymentsLoading} />
                    </div>
                </motion.section>

                {/* ── Quick Links ── */}
                <motion.section
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.4 }}
                    className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-10"
                >
                    <Link
                        to="/data-api"
                        className={`p-6 rounded-[2rem] border flex items-center gap-4 transition-all hover:scale-[1.02] ${isDark ? 'bg-ios-gray-800 border-ios-gray-700' : 'bg-white border-ios-gray-100 shadow-sm'}`}
                    >
                        <Database className="w-6 h-6 text-blue-500" />
                        <div>
                            <p className="font-bold">API Docs</p>
                            <p className="text-xs text-muted-foreground">View endpoints & examples</p>
                        </div>
                        <ChevronRight className="w-4 h-4 ml-auto text-muted-foreground" />
                    </Link>
                    <Link
                        to="/pricing"
                        className={`p-6 rounded-[2rem] border flex items-center gap-4 transition-all hover:scale-[1.02] ${isDark ? 'bg-ios-gray-800 border-ios-gray-700' : 'bg-white border-ios-gray-100 shadow-sm'}`}
                    >
                        <CreditCard className="w-6 h-6 text-[#007AFF]" />
                        <div>
                            <p className="font-bold">Pricing</p>
                            <p className="text-xs text-muted-foreground">Compare tiers & upgrade</p>
                        </div>
                        <ChevronRight className="w-4 h-4 ml-auto text-muted-foreground" />
                    </Link>
                    <a
                        href="mailto:support@civiceducationkenya.com"
                        className={`p-6 rounded-[2rem] border flex items-center gap-4 transition-all hover:scale-[1.02] ${isDark ? 'bg-ios-gray-800 border-ios-gray-700' : 'bg-white border-ios-gray-100 shadow-sm'}`}
                    >
                        <Shield className="w-6 h-6 text-emerald-500" />
                        <div>
                            <p className="font-bold">Support</p>
                            <p className="text-xs text-muted-foreground">Get help with your API</p>
                        </div>
                        <ChevronRight className="w-4 h-4 ml-auto text-muted-foreground" />
                    </a>
                </motion.section>

                {/* ── Back link ── */}
                <div className="text-center pb-10">
                    <Link to="/" className="text-blue-500 font-bold text-sm hover:underline flex items-center justify-center gap-1">
                        <ChevronRight className="w-4 h-4 rotate-180" />
                        Back to Nasaka IEBC
                    </Link>
                </div>
            </div>
            <AuthModal isOpen={isAuthModalOpen} onClose={() => setIsAuthModalOpen(false)} />
        </div>
    );
};

export default ApiKeys;

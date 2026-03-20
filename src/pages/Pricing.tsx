import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
    Check,
    X,
    Zap,
    Shield,
    Crown,
    Building2,
    CreditCard,
    FileText,
    GraduationCap,
    ChevronRight,
    ArrowRight,
    Loader2,
    Globe,
    Users,
    Send,
    Phone,
    Mail,
    Briefcase,
    AlertCircle,
    Database,
    Coins,
    Star
} from 'lucide-react';
import { useTheme } from '@/contexts/ThemeContext';
import { SEOHead, generateBreadcrumbSchema } from '@/components/SEO/SEOHead';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { AuthModal } from '@/components/Auth/AuthModal';
import { toast } from 'sonner';

// ─── Types ───────────────────────────────────────────────────────────────────
interface TierData {
    id: string;
    name: string;
    subtitle: string;
    price_kes?: number;
    price_kes_monthly?: number;
    price_kes_annual?: number;
    price_usd?: number;
    price_usd_monthly?: number;
    price_usd_annual?: number;
    annual_savings_kes?: number;
    billing?: string;
    billing_options?: string[];
    monthly_limit: number | null;
    burst_rate: string;
    overage_kes_per_10k?: number;
    features: string[];
    blocked?: string[];
    paystack_plan_codes?: { monthly: string | null; annual: string | null };
    cta: string;
    highlighted: boolean;
    contact_only?: boolean;
}

interface CreditPack {
    id: string;
    credits: number;
    price_kes: number;
    product_key: string;
}

interface DataLicense {
    id: string;
    name: string;
    price_kes: number;
    period: string;
    product_key: string;
}

interface PricingData {
    tiers: TierData[];
    credit_packs: CreditPack[];
    credit_weights: { standard_lookup: number; boundary_lookup: number; csv_export_per_1k_rows: number };
    data_licenses: DataLicense[];
    discounts: { nonprofit_academic: string; requirement: string; apply_url: string };
    paystack_public_key: string | null;
    currency: string;
    note: string;
}

// ─── Tier Icons (Custom SVGs, Nasaka Blue) ──────────────────────────────────
const TierIcon = ({ tier, className = 'w-6 h-6' }: { tier: string; className?: string }) => (
    <img src={`/icons/tiers/${tier}.svg`} alt={tier} className={className} />
);

const TIER_ICONS: Record<string, React.ReactNode> = {
    jamii: <TierIcon tier="jamii" />,
    mwananchi: <TierIcon tier="mwananchi" />,
    taifa: <TierIcon tier="taifa" />,
    serikali: <TierIcon tier="serikali" />
};

// ─── Nasaka Blue Unified Color Scheme ────────────────────────────────────────
const NASAKA_BLUE = '#007AFF';
const TIER_COLORS: Record<string, { bg: string; text: string; border: string; accent: string }> = {
    jamii: { bg: 'bg-[#007AFF]/5', text: 'text-[#007AFF]', border: 'border-[#007AFF]/15', accent: 'from-[#007AFF] to-[#0055CC]' },
    mwananchi: { bg: 'bg-[#007AFF]/10', text: 'text-[#007AFF]', border: 'border-[#007AFF]/25', accent: 'from-[#007AFF] to-[#0055CC]' },
    taifa: { bg: 'bg-[#007AFF]/15', text: 'text-[#007AFF]', border: 'border-[#007AFF]/30', accent: 'from-[#005ECB] to-[#003D8A]' },
    serikali: { bg: 'bg-[#007AFF]/20', text: 'text-[#007AFF]', border: 'border-[#007AFF]/35', accent: 'from-[#004DB3] to-[#002D6B]' }
};

// ─── Fallback Pricing Data (used when API is unreachable) ────────────────────
const FALLBACK_PRICING: PricingData = {
    tiers: [
        {
            id: 'jamii', name: 'Jamii', subtitle: 'Community & learners',
            monthly_limit: 5000, burst_rate: '2/s', billing: 'free',
            features: ['5,000 requests/mo', 'Standard fields only', 'JSON responses', 'Community support'],
            blocked: ['GeoJSON/CSV export', 'Boundary data', 'Landmark & confidence fields'],
            cta: 'Get Free Key', highlighted: false
        },
        {
            id: 'mwananchi', name: 'Mwananchi', subtitle: 'Developers & startups',
            monthly_limit: 100000, burst_rate: '10/s', billing: 'monthly',
            price_kes_monthly: 2500, price_kes_annual: 25000, annual_savings_kes: 5000,
            billing_options: ['monthly', 'annual'],
            features: ['100,000 requests/mo', 'All fields including confidence', 'GeoJSON export', 'Email support', 'Overage available'],
            overage_kes_per_10k: 200,
            cta: 'Start Building', highlighted: true
        },
        {
            id: 'taifa', name: 'Taifa', subtitle: 'Organizations & media',
            monthly_limit: 500000, burst_rate: '30/s', billing: 'monthly',
            price_kes_monthly: 7500, price_kes_annual: 75000, annual_savings_kes: 15000,
            billing_options: ['monthly', 'annual'],
            features: ['500,000 requests/mo', 'Full dataset access', 'CSV + GeoJSON export', 'Boundary polygons', 'Priority support', 'Bulk download'],
            overage_kes_per_10k: 100,
            cta: 'Go National', highlighted: false
        },
        {
            id: 'serikali', name: 'Serikali', subtitle: 'Government & enterprise',
            monthly_limit: null, burst_rate: '100/s', billing: 'custom',
            features: ['Custom quota', 'Dedicated infrastructure', 'SLA contract', 'SFTP data dumps', 'Account manager', 'Custom integrations'],
            cta: 'Contact Sales', highlighted: false, contact_only: true
        }
    ],
    credit_packs: [
        { id: 'pack_5k', credits: 5000, price_kes: 500, product_key: 'credits_5k' },
        { id: 'pack_50k', credits: 50000, price_kes: 4000, product_key: 'credits_50k' },
        { id: 'pack_500k', credits: 500000, price_kes: 30000, product_key: 'credits_500k' }
    ],
    credit_weights: { standard_lookup: 1, boundary_lookup: 2, csv_export_per_1k_rows: 5 },
    data_licenses: [
        { id: 'license_academic', name: 'Academic License', price_kes: 15000, period: 'year', product_key: 'license_academic' },
        { id: 'license_commercial', name: 'Commercial License', price_kes: 50000, period: 'year', product_key: 'license_commercial' }
    ],
    discounts: {
        nonprofit_academic: '50% off Mwananchi and Taifa tiers for verified nonprofits and academic institutions.',
        requirement: 'Must provide letterhead verification from a registered NGO or accredited university.',
        apply_url: '/dashboard/api-keys'
    },
    paystack_public_key: null,
    currency: 'KES',
    note: 'All prices in Kenya Shillings. USD equivalents available at checkout.'
};

// ─── Enterprise Form ─────────────────────────────────────────────────────────
const EnterpriseForm = ({ isDark }: { isDark: boolean }) => {
    const [form, setForm] = useState({
        organisation_name: '',
        contact_name: '',
        contact_email: '',
        contact_phone: '',
        organisation_type: '',
        use_case: '',
        estimated_monthly_requests: '',
        preferred_currency: 'KES'
    });
    const [submitting, setSubmitting] = useState(false);
    const [submitted, setSubmitted] = useState(false);
    const [error, setError] = useState('');

    const orgTypes = [
        { value: 'county_government', label: 'County Government' },
        { value: 'ngo', label: 'NGO / Civil Society' },
        { value: 'development_agency', label: 'Development Agency' },
        { value: 'media_house', label: 'Media House' },
        { value: 'research_institution', label: 'Research Institution' },
        { value: 'election_observer', label: 'Election Observer' },
        { value: 'other', label: 'Other' }
    ];

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setSubmitting(true);
        setError('');

        try {
            const resp = await fetch('/api/v1/enterprise/enquire', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(form)
            });

            if (!resp.ok) {
                const data = await resp.json();
                throw new Error(data.error || 'Submission failed');
            }

            setSubmitted(true);
        } catch (err: any) {
            setError(err.message || 'Failed to submit enquiry');
        } finally {
            setSubmitting(false);
        }
    };

    if (submitted) {
        return (
            <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                className={`p-10 rounded-3xl text-center ${isDark ? 'bg-ios-gray-800' : 'bg-white'}`}
            >
                <div className="w-16 h-16 rounded-full bg-[#007AFF]/10 flex items-center justify-center mx-auto mb-6">
                    <Check className="w-8 h-8 text-[#007AFF]" />
                </div>
                <h3 className="text-2xl font-bold mb-3">Enquiry Received</h3>
                <p className="text-muted-foreground max-w-md mx-auto">
                    Our team will review your requirements and respond within 48 hours.
                    We look forward to powering your civic infrastructure.
                </p>
            </motion.div>
        );
    }

    const inputClass = `w-full px-4 py-3 rounded-xl border transition-all focus:outline-none focus:ring-2 focus:ring-blue-500/30 ${isDark
        ? 'bg-ios-gray-900 border-ios-gray-700 text-white placeholder-ios-gray-500'
        : 'bg-ios-gray-50 border-ios-gray-200 text-ios-gray-900 placeholder-ios-gray-400'
        }`;

    return (
        <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                    <label className="block text-xs font-bold uppercase tracking-widest text-muted-foreground mb-2">Organisation *</label>
                    <input
                        type="text"
                        required
                        className={inputClass}
                        placeholder="Your organisation name"
                        value={form.organisation_name}
                        onChange={e => setForm(f => ({ ...f, organisation_name: e.target.value }))}
                    />
                </div>
                <div>
                    <label className="block text-xs font-bold uppercase tracking-widest text-muted-foreground mb-2">Contact Name *</label>
                    <input
                        type="text"
                        required
                        className={inputClass}
                        placeholder="Your full name"
                        value={form.contact_name}
                        onChange={e => setForm(f => ({ ...f, contact_name: e.target.value }))}
                    />
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                    <label className="block text-xs font-bold uppercase tracking-widest text-muted-foreground mb-2">Email *</label>
                    <input
                        type="email"
                        required
                        className={inputClass}
                        placeholder="you@organisation.org"
                        value={form.contact_email}
                        onChange={e => setForm(f => ({ ...f, contact_email: e.target.value }))}
                    />
                </div>
                <div>
                    <label className="block text-xs font-bold uppercase tracking-widest text-muted-foreground mb-2">Phone</label>
                    <input
                        type="tel"
                        className={inputClass}
                        placeholder="+254 7XX XXX XXX"
                        value={form.contact_phone}
                        onChange={e => setForm(f => ({ ...f, contact_phone: e.target.value }))}
                    />
                </div>
            </div>

            <div>
                <label className="block text-xs font-bold uppercase tracking-widest text-muted-foreground mb-2">Organisation Type *</label>
                <select
                    required
                    className={inputClass}
                    value={form.organisation_type}
                    onChange={e => setForm(f => ({ ...f, organisation_type: e.target.value }))}
                >
                    <option value="">Select type…</option>
                    {orgTypes.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                </select>
            </div>

            <div>
                <label className="block text-xs font-bold uppercase tracking-widest text-muted-foreground mb-2">Use Case *</label>
                <textarea
                    required
                    rows={3}
                    className={inputClass}
                    placeholder="Describe how you plan to use the IEBC data API…"
                    value={form.use_case}
                    onChange={e => setForm(f => ({ ...f, use_case: e.target.value }))}
                />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                    <label className="block text-xs font-bold uppercase tracking-widest text-muted-foreground mb-2">Est. Monthly Requests</label>
                    <input
                        type="text"
                        className={inputClass}
                        placeholder="e.g. 1,000,000"
                        value={form.estimated_monthly_requests}
                        onChange={e => setForm(f => ({ ...f, estimated_monthly_requests: e.target.value }))}
                    />
                </div>
                <div>
                    <label className="block text-xs font-bold uppercase tracking-widest text-muted-foreground mb-2">Currency Preference</label>
                    <select
                        className={inputClass}
                        value={form.preferred_currency}
                        onChange={e => setForm(f => ({ ...f, preferred_currency: e.target.value }))}
                    >
                        <option value="KES">KES (Kenya Shilling)</option>
                        <option value="USD">USD (US Dollar)</option>
                    </select>
                </div>
            </div>

            {error && (
                <div className="flex items-center gap-2 p-3 rounded-xl bg-red-500/10 text-red-500 text-sm">
                    <AlertCircle className="w-4 h-4 shrink-0" />
                    {error}
                </div>
            )}

            <button
                type="submit"
                disabled={submitting}
                className="w-full py-4 rounded-2xl font-bold text-white bg-[#007AFF] hover:bg-[#0055CC] hover:shadow-lg hover:shadow-[#007AFF]/20 hover:scale-[1.01] active:scale-[0.99] transition-all disabled:opacity-60"
            >
                {submitting ? (
                    <span className="flex items-center justify-center gap-2">
                        <Loader2 className="w-5 h-5 animate-spin" />
                        Submitting…
                    </span>
                ) : (
                    <span className="flex items-center justify-center gap-2">
                        <Send className="w-5 h-5" />
                        Submit Enterprise Enquiry
                    </span>
                )}
            </button>
        </form>
    );
};

// ─── Tier Card ───────────────────────────────────────────────────────────────
const TierCard = ({
    tier,
    isAnnual,
    isDark,
    index,
    onSelect
}: {
    tier: TierData;
    isAnnual: boolean;
    isDark: boolean;
    index: number;
    onSelect: (productKey: string, tierName: string) => void;
}) => {
    const colors = TIER_COLORS[tier.id] || TIER_COLORS.jamii;
    const icon = TIER_ICONS[tier.id];

    const displayPrice = tier.billing === 'free'
        ? 'Free'
        : tier.billing === 'custom'
            ? 'Custom'
            : isAnnual && tier.price_kes_annual
                ? `KES ${(tier.price_kes_annual / 12).toLocaleString()}`
                : `KES ${(tier.price_kes_monthly || 0).toLocaleString()}`;

    const displayPeriod = tier.billing === 'free' || tier.billing === 'custom'
        ? ''
        : isAnnual ? '/mo (billed annually)' : '/month';

    const annualTotal = isAnnual && tier.price_kes_annual
        ? `KES ${tier.price_kes_annual.toLocaleString()}/yr`
        : null;

    return (
        <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.1 + 0.2, type: 'spring', stiffness: 300, damping: 30 }}
            className={`relative flex flex-col p-8 rounded-[2.5rem] border backdrop-blur-xl transition-all hover:scale-[1.02] hover:shadow-2xl ${tier.highlighted
                ? `border-2 ${colors.border} shadow-xl ${isDark ? 'bg-[#1C1C1E]/90' : 'bg-white/90'}`
                : `${isDark ? 'bg-[#1C1C1E]/80 border-white/5' : 'bg-white/80 border-black/5 shadow-sm'}`
                }`}
        >
            {tier.highlighted && (
                <div className={`absolute -top-4 left-1/2 -translate-x-1/2 px-4 py-1.5 rounded-full text-xs font-bold text-white bg-gradient-to-r ${colors.accent}`}>
                    <Star className="w-3 h-3 inline mr-1 -mt-0.5" />
                    Most Popular
                </div>
            )}

            <div className={`w-12 h-12 rounded-2xl ${colors.bg} flex items-center justify-center ${colors.text} mb-6`}>
                {icon}
            </div>

            <h3 className="text-2xl font-black mb-1">{tier.name}</h3>
            <p className="text-sm text-muted-foreground mb-6">{tier.subtitle}</p>

            <div className="mb-6">
                <span className="text-4xl font-black">{displayPrice}</span>
                {displayPeriod && <span className="text-sm text-muted-foreground ml-1">{displayPeriod}</span>}
                {annualTotal && (
                    <p className="text-xs text-muted-foreground mt-1">{annualTotal}</p>
                )}
                {tier.annual_savings_kes && isAnnual && (
                    <p className="text-xs text-emerald-500 font-bold mt-1">
                        Save KES {tier.annual_savings_kes.toLocaleString()}/yr
                    </p>
                )}
            </div>

            <div className="mb-6">
                <div className="flex items-center gap-2 mb-2">
                    <Database className="w-4 h-4 text-muted-foreground" />
                    <span className="text-sm font-semibold">
                        {tier.monthly_limit ? `${tier.monthly_limit.toLocaleString()} requests/mo` : 'Custom quota'}
                    </span>
                </div>
                <div className="flex items-center gap-2">
                    <Zap className="w-4 h-4 text-muted-foreground" />
                    <span className="text-sm font-semibold">{tier.burst_rate} burst</span>
                </div>
            </div>

            <ul className="space-y-3 mb-8 flex-1">
                {tier.features.map(f => (
                    <li key={f} className="flex items-start gap-3 text-sm">
                        <Check className={`w-4 h-4 mt-0.5 shrink-0 ${colors.text}`} />
                        <span>{f}</span>
                    </li>
                ))}
                {tier.blocked?.map(f => (
                    <li key={f} className="flex items-start gap-3 text-sm text-muted-foreground">
                        <X className="w-4 h-4 mt-0.5 shrink-0 text-red-400" />
                        <span className="line-through">{f}</span>
                    </li>
                ))}
            </ul>

            {tier.contact_only ? (
                <a
                    href="#enterprise"
                    className={`w-full py-4 rounded-2xl font-bold text-center transition-all hover:shadow-lg active:scale-[0.98] bg-gradient-to-r ${colors.accent} text-white`}
                >
                    {tier.cta}
                </a>
            ) : (
                <button
                    onClick={() => {
                        const productKey = tier.billing === 'free' ? 'jamii' : `${tier.id}_${isAnnual ? 'annual' : 'monthly'}`;
                        onSelect(productKey, tier.name);
                    }}
                    className={`w-full py-4 rounded-2xl font-bold text-center transition-all hover:shadow-lg active:scale-[0.98] ${tier.billing === 'free'
                        ? (isDark ? 'bg-ios-gray-700 text-white hover:bg-ios-gray-600' : 'bg-ios-gray-100 text-ios-gray-900 hover:bg-ios-gray-200')
                        : `bg-gradient-to-r ${colors.accent} text-white`
                        }`}
                >
                    {tier.cta}
                </button>
            )}

            {tier.overage_kes_per_10k && (
                <p className="text-xs text-muted-foreground text-center mt-3">
                    Overage: KES {tier.overage_kes_per_10k}/10K extra requests
                </p>
            )}
        </motion.div>
    );
};

// ─── Main Pricing Page ───────────────────────────────────────────────────────
const Pricing = () => {
    const { theme } = useTheme();
    const isDark = theme === 'dark';
    const navigate = useNavigate();
    const { user, isAuthenticated } = useAuth();

    const [isAnnual, setIsAnnual] = useState(true);
    const [pricing, setPricing] = useState<PricingData | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');

    const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
    const [pendingPurchase, setPendingPurchase] = useState<{ productKey: string; tierName: string } | null>(null);
    const [isRedirecting, setIsRedirecting] = useState(false);

    const handlePurchase = async (productKey: string, tierName: string) => {
        if (!isAuthenticated) {
            setPendingPurchase({ productKey, tierName });
            setIsAuthModalOpen(true);
            return;
        }

        if (productKey === 'jamii') {
            navigate('/dashboard/api-keys');
            return;
        }

        setIsRedirecting(true);
        const loadingToast = toast.loading(`Initializing purchase for ${tierName}...`);

        try {
            const response = await fetch('/api/v1/billing/initialize', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    product_key: productKey,
                    email: user?.email,
                    callback_url: `${window.location.origin}/dashboard/api-keys?purchased=${productKey}`
                })
            });

            const result = await response.json();

            if (!response.ok) {
                throw new Error(result.error || 'Failed to initialize payment');
            }

            if (result.data?.authorization_url) {
                toast.success('Redirecting to Paystack...', { id: loadingToast });
                window.location.href = result.data.authorization_url;
            } else {
                throw new Error('No authorization URL received');
            }
        } catch (err: any) {
            console.error('Purchase error:', err);
            toast.error(err.message || 'Payment initialization failed', { id: loadingToast });
            setIsRedirecting(false);
        }
    };

    const onAuthSuccess = () => {
        if (pendingPurchase) {
            handlePurchase(pendingPurchase.productKey, pendingPurchase.tierName);
            setPendingPurchase(null);
        }
    };

    useEffect(() => {
        const fetchPricing = async () => {
            try {
                const resp = await fetch('/api/v1/billing/pricing');
                const contentType = resp.headers.get('content-type') || '';
                if (!resp.ok || !contentType.includes('application/json')) {
                    console.warn('[Pricing] API unavailable, using fallback data');
                    setPricing(FALLBACK_PRICING);
                    return;
                }
                const json = await resp.json();
                setPricing(json.data || FALLBACK_PRICING);
            } catch (err: any) {
                console.warn('[Pricing] Fetch failed, using fallback:', err.message);
                setPricing(FALLBACK_PRICING);
            } finally {
                setLoading(false);
            }
        };
        fetchPricing();
    }, []);

    if (loading) {
        return (
            <div className={`min-h-screen flex items-center justify-center ${isDark ? 'bg-[#0A0A0A]' : 'bg-[#F2F2F7]'}`}>
                <div className="text-center">
                    <Loader2 className="w-10 h-10 animate-spin text-blue-500 mx-auto mb-4" />
                    <p className={isDark ? 'text-[#98989D]' : 'text-[#8E8E93]'}>Loading pricing…</p>
                </div>
            </div>
        );
    }

    if (error || !pricing) {
        return (
            <div className={`min-h-screen flex items-center justify-center ${isDark ? 'bg-[#0A0A0A]' : 'bg-[#F2F2F7]'}`}>
                <div className="text-center max-w-md">
                    <AlertCircle className="w-10 h-10 text-red-500 mx-auto mb-4" />
                    <p className="text-red-500 font-black mb-2">Failed to load pricing</p>
                    <p className={`text-sm ${isDark ? 'text-[#98989D]' : 'text-[#8E8E93]'}`}>{error}</p>
                    <button
                        onClick={() => window.location.reload()}
                        className="mt-4 px-6 py-2.5 rounded-xl bg-blue-500 text-white font-bold hover:bg-blue-600 hover:shadow-lg transition-all active:scale-[0.98]"
                    >
                        Retry
                    </button>
                </div>
            </div>
        );
    }

    return (
        <div className={`min-h-screen pb-20 transition-colors duration-500 ${isDark ? 'bg-[#0A0A0A] text-white' : 'bg-[#F2F2F7] text-[#1C1C1E]'}`}>
            <SEOHead
                title="API Pricing — Nasaka IEBC | Kenya Electoral Data API"
                description="Access Kenya's most comprehensive IEBC office data API. Free community tier, paid plans from KES 2,500/month. Credit packs and data licenses available."
                canonical="/pricing"
                keywords="IEBC API pricing, Kenya election data API, civic data API, Nasaka IEBC plans, electoral data pricing"
                schema={[
                    generateBreadcrumbSchema([
                        { name: 'Home', url: '/' },
                        { name: 'API Pricing', url: '/pricing' }
                    ])
                ]}
            />

            {/* Topo background overlay */}
            <div
                className="fixed inset-0 pointer-events-none opacity-[0.03]"
                style={{ backgroundImage: 'url(/topo-bg.svg)', backgroundSize: '600px', backgroundRepeat: 'repeat' }}
            />

            <div className="relative max-w-7xl mx-auto px-6 pt-16">
                {/* ── Hero ── */}
                <motion.div
                    initial={{ opacity: 0, y: 30 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ type: 'spring', stiffness: 300, damping: 30 }}
                    className="text-center mb-14"
                >
                    <div className="inline-flex items-center px-4 py-2 rounded-full bg-[#007AFF]/10 text-[#007AFF] text-xs font-black uppercase tracking-[0.15em] mb-6">
                        <img src="/nasaka.svg" alt="Nasaka" className="w-3.5 h-3.5 mr-2" style={{ filter: 'invert(35%) sepia(91%) saturate(3000%) hue-rotate(200deg) brightness(100%) contrast(101%)' }} />
                        Nasaka API
                    </div>
                    <h1 className="text-5xl md:text-7xl font-black mb-6 tracking-tight" style={{ fontFamily: 'var(--font-display)' }}>
                        API <span className="text-[#007AFF]">Pricing</span>
                    </h1>
                    <p className={`text-lg max-w-2xl mx-auto mb-8 ${isDark ? 'text-[#98989D]' : 'text-[#8E8E93]'}`}>
                        Power your civic technology with Kenya's most comprehensive IEBC office dataset.
                        From community projects to enterprise deployments.
                    </p>

                    {/* ── Billing Toggle ── */}
                    <div className={`inline-flex items-center gap-1 p-1.5 rounded-2xl ${isDark ? 'bg-white/5' : 'bg-black/5'}`}>
                        <button
                            onClick={() => setIsAnnual(false)}
                            className={`px-6 py-2.5 rounded-xl text-sm font-bold transition-all ${!isAnnual
                                ? `${isDark ? 'bg-white/10 text-white' : 'bg-white text-[#1C1C1E] shadow-sm'}`
                                : `${isDark ? 'text-[#98989D]' : 'text-[#8E8E93]'} hover:text-foreground`
                                }`}
                        >
                            Monthly
                        </button>
                        <button
                            onClick={() => setIsAnnual(true)}
                            className={`px-6 py-2.5 rounded-xl text-sm font-bold transition-all flex items-center gap-2 ${isAnnual
                                ? `${isDark ? 'bg-white/10 text-white' : 'bg-white text-[#1C1C1E] shadow-sm'}`
                                : `${isDark ? 'text-[#98989D]' : 'text-[#8E8E93]'} hover:text-foreground`
                                }`}
                        >
                            Annual
                            <span className="text-[10px] font-black px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-500">
                                Save 17%
                            </span>
                        </button>
                    </div>

                    {/* ── Sandbox CTA ── */}
                    <div className="mt-6">
                        <Link
                            to="/docs#sandbox"
                            className={`inline-flex items-center gap-2 text-sm font-bold text-[#007AFF] hover:text-[#0055CC] transition-colors`}
                        >
                            <Zap className="w-4 h-4" />
                            Try the API Sandbox — free, instant, no key needed
                            <ChevronRight className="w-4 h-4" />
                        </Link>
                    </div>
                </motion.div>

                {/* ── Tier Cards ── */}
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-5 mb-20">
                    {pricing.tiers.map((tier, i) => (
                        <TierCard
                            key={tier.id}
                            tier={tier}
                            isAnnual={isAnnual}
                            isDark={isDark}
                            index={i}
                            onSelect={handlePurchase}
                        />
                    ))}
                </div>

                {/* ── Credit Packs ── */}
                <motion.section
                    initial={{ opacity: 0, y: 20 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true }}
                    className="mb-20"
                >
                    <div className="text-center mb-10">
                        <div className="inline-flex items-center px-4 py-2 rounded-full bg-[#007AFF]/10 text-[#007AFF] text-xs font-black uppercase tracking-[0.15em] mb-4">
                            <Coins className="w-3.5 h-3.5 mr-2" />
                            Pay Per Use
                        </div>
                        <h2 className="text-4xl font-black mb-3" style={{ fontFamily: 'var(--font-display)' }}>Credit Packs</h2>
                        <p className={`max-w-lg mx-auto ${isDark ? 'text-[#98989D]' : 'text-[#8E8E93]'}`}>
                            Perfect for grant-funded projects with lump-sum budgets. Credits never expire.
                        </p>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-5 max-w-4xl mx-auto">
                        {pricing.credit_packs.map((pack, i) => (
                            <motion.div
                                key={pack.id}
                                initial={{ opacity: 0, y: 20 }}
                                whileInView={{ opacity: 1, y: 0 }}
                                viewport={{ once: true }}
                                transition={{ delay: i * 0.1, type: 'spring', stiffness: 300, damping: 30 }}
                                className={`p-8 rounded-[2.5rem] border backdrop-blur-xl text-center transition-all hover:scale-[1.02] hover:shadow-2xl ${isDark ? 'bg-[#1C1C1E]/80 border-white/5' : 'bg-white/80 border-black/5 shadow-sm'
                                    }`}
                            >
                                <div className="w-14 h-14 rounded-2xl bg-[#007AFF]/10 flex items-center justify-center mx-auto mb-4"><Coins className="w-7 h-7 text-[#007AFF]" /></div>
                                <h3 className="text-xl font-bold mb-1">{pack.credits.toLocaleString()} Credits</h3>
                                <p className="text-3xl font-black mb-2">KES {pack.price_kes.toLocaleString()}</p>
                                <p className={`text-xs mb-6 ${isDark ? 'text-[#98989D]' : 'text-[#8E8E93]'}`}>
                                    KES {(pack.price_kes / pack.credits * 1000).toFixed(0)} per 1,000 requests
                                </p>
                                <button
                                    onClick={() => handlePurchase(pack.product_key, `${pack.credits.toLocaleString()} Credits`)}
                                    className="w-full py-3 rounded-xl font-bold text-sm block text-center bg-[#007AFF] text-white hover:bg-[#0055CC] hover:shadow-lg hover:shadow-[#007AFF]/20 active:scale-[0.98] transition-all"
                                >
                                    Buy Credits
                                </button>
                            </motion.div>
                        ))}
                    </div>

                    <div className={`mt-8 p-6 rounded-2xl text-center text-sm max-w-4xl mx-auto ${isDark ? 'bg-white/5' : 'bg-black/[0.03]'}`}>
                        <p className={isDark ? 'text-[#98989D]' : 'text-[#8E8E93]'}>
                            <strong className={isDark ? 'text-white' : 'text-[#1C1C1E]'}>Credit weights:</strong> Standard lookup = {pricing.credit_weights.standard_lookup} credit •
                            Boundary lookup = {pricing.credit_weights.boundary_lookup} credits •
                            CSV export (per 1K rows) = {pricing.credit_weights.csv_export_per_1k_rows} credits
                        </p>
                    </div>
                </motion.section>

                {/* ── Data Licenses ── */}
                <motion.section
                    initial={{ opacity: 0, y: 20 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true }}
                    className="mb-20"
                >
                    <div className="text-center mb-10">
                        <div className="inline-flex items-center px-4 py-2 rounded-full bg-[#007AFF]/10 text-[#007AFF] text-xs font-black uppercase tracking-[0.15em] mb-4">
                            <FileText className="w-3.5 h-3.5 mr-2" />
                            Full Dataset
                        </div>
                        <h2 className="text-4xl font-black mb-3" style={{ fontFamily: 'var(--font-display)' }}>Data Licenses</h2>
                        <p className={`max-w-lg mx-auto ${isDark ? 'text-[#98989D]' : 'text-[#8E8E93]'}`}>
                            Annual flat-fee access to our complete verified dataset. GeoJSON + CSV, updated quarterly. No API call counting.
                        </p>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-5 max-w-3xl mx-auto">
                        {pricing.data_licenses.map((lic, i) => (
                            <motion.div
                                key={lic.id}
                                initial={{ opacity: 0, y: 20 }}
                                whileInView={{ opacity: 1, y: 0 }}
                                viewport={{ once: true }}
                                transition={{ delay: i * 0.1, type: 'spring', stiffness: 300, damping: 30 }}
                                className={`p-8 rounded-[2.5rem] border backdrop-blur-xl text-center transition-all hover:scale-[1.02] hover:shadow-2xl ${isDark ? 'bg-[#1C1C1E]/80 border-white/5' : 'bg-white/80 border-black/5 shadow-sm'
                                    }`}
                            >
                                <div className="w-14 h-14 rounded-2xl bg-[#007AFF]/10 flex items-center justify-center mx-auto mb-4">
                                    {lic.id === 'license_academic'
                                        ? <GraduationCap className="w-7 h-7 text-[#007AFF]" />
                                        : <Briefcase className="w-7 h-7 text-[#007AFF]" />
                                    }
                                </div>
                                <h3 className="text-xl font-bold mb-1">{lic.name}</h3>
                                <p className="text-3xl font-black mb-1">KES {lic.price_kes.toLocaleString()}</p>
                                <p className={`text-xs mb-6 ${isDark ? 'text-[#98989D]' : 'text-[#8E8E93]'}`}>per {lic.period}</p>
                                <button
                                    onClick={() => handlePurchase(lic.product_key, lic.name)}
                                    className="w-full py-3 rounded-xl font-bold text-sm block text-center bg-[#007AFF] text-white hover:bg-[#0055CC] hover:shadow-lg hover:shadow-[#007AFF]/20 active:scale-[0.98] transition-all"
                                >
                                    Get License
                                </button>
                            </motion.div>
                        ))}
                    </div>
                </motion.section>

                {/* ── Nonprofit Discount ── */}
                <motion.section
                    initial={{ opacity: 0, y: 20 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true }}
                    className={`mb-20 p-10 rounded-[3rem] border backdrop-blur-xl ${isDark ? 'bg-[#1C1C1E]/80 border-white/5' : 'bg-white/80 border-black/5 shadow-sm'}`}
                >
                    <div className="flex flex-col md:flex-row items-center gap-8">
                        <div className="w-20 h-20 rounded-2xl flex items-center justify-center shrink-0 bg-[#007AFF]/10">
                            <Shield className="w-10 h-10 text-[#007AFF]" />
                        </div>
                        <div className="flex-1 text-center md:text-left">
                            <h3 className="text-2xl font-black mb-2">Nonprofit & Academic Discount</h3>
                            <p className={`mb-1 ${isDark ? 'text-[#98989D]' : 'text-[#8E8E93]'}`}>{pricing.discounts.nonprofit_academic}</p>
                            <p className={`text-sm ${isDark ? 'text-[#98989D]' : 'text-[#8E8E93]'}`}>{pricing.discounts.requirement}</p>
                        </div>
                        <button
                            onClick={() => {
                                if (!isAuthenticated) {
                                    setIsAuthModalOpen(true);
                                } else {
                                    navigate('/dashboard/api-keys');
                                }
                            }}
                            className="px-8 py-4 rounded-2xl font-bold bg-[#007AFF] text-white hover:bg-[#0055CC] hover:shadow-xl hover:shadow-[#007AFF]/20 active:scale-[0.98] transition-all shrink-0 flex items-center gap-2"
                        >
                            Apply Now
                            <ArrowRight className="w-5 h-5" />
                        </button>
                    </div>
                </motion.section>

                {/* ── Enterprise / Serikali Form ── */}
                <motion.section
                    id="enterprise"
                    initial={{ opacity: 0, y: 20 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true }}
                    className="mb-20"
                >
                    <div className="text-center mb-10">
                        <div className="inline-flex items-center px-4 py-2 rounded-full bg-[#007AFF]/10 text-[#007AFF] text-xs font-black uppercase tracking-[0.15em] mb-4">
                            <img src="/icons/tiers/serikali.svg" alt="Enterprise" className="w-3.5 h-3.5 mr-2" />
                            Enterprise
                        </div>
                        <h2 className="text-4xl font-black mb-3" style={{ fontFamily: 'var(--font-display)' }}>Serikali — Enterprise & Government</h2>
                        <p className={`max-w-lg mx-auto ${isDark ? 'text-[#98989D]' : 'text-[#8E8E93]'}`}>
                            Need custom quotas, SLA contracts, or SFTP data dumps? We'll tailor a solution for your organization.
                        </p>
                    </div>

                    <div className={`max-w-2xl mx-auto p-8 md:p-10 rounded-[3rem] border backdrop-blur-xl ${isDark ? 'bg-[#1C1C1E]/80 border-white/5' : 'bg-white/80 border-black/5 shadow-sm'
                        }`}>
                        <EnterpriseForm isDark={isDark} />
                    </div>
                </motion.section>

                {/* ── Back link ── */}
                <div className="text-center pb-10">
                    <Link to="/" className="text-blue-500 font-bold text-sm hover:underline flex items-center justify-center gap-1">
                        <ChevronRight className="w-4 h-4 rotate-180" />
                        Back to Nasaka IEBC
                    </Link>
                </div>
            </div>

            <AuthModal
                isOpen={isAuthModalOpen}
                onClose={() => setIsAuthModalOpen(false)}
                onSuccess={onAuthSuccess}
            />

            {isRedirecting && (
                <div className="fixed inset-0 bg-background/80 backdrop-blur-sm z-[100] flex items-center justify-center">
                    <div className="text-center">
                        <Loader2 className="w-12 h-12 animate-spin text-blue-500 mx-auto mb-4" />
                        <p className="text-xl font-black">Connecting to Secure Payment Gateway…</p>
                        <p className="text-muted-foreground">Please do not close this window.</p>
                    </div>
                </div>
            )}
        </div>
    );
};

export default Pricing;

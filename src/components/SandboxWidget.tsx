// src/components/SandboxWidget.tsx
// Nasaka IEBC — Interactive API Sandbox Widget
// Authenticates via CEKA OAuth, manages sandbox sessions, sends test requests

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
    Play,
    Terminal,
    Key,
    Clock,
    Zap,
    ChevronDown,
    Copy,
    Check,
    LogIn,
    Loader2,
    AlertCircle,
    RefreshCw,
    Shield,
} from 'lucide-react';
import { useTheme } from '@/contexts/ThemeContext';
import { cekaSupabase, CEKA_OAUTH_BASE, CEKA_CLIENT_ID } from '@/integrations/ceka/client';
import { toast } from 'sonner';

// ─── Types ───────────────────────────────────────────────────────────────────
interface SandboxSession {
    sandbox_key: string;
    email: string;
    requests_remaining: number;
    max_requests: number;
    expires_at: string;
}

interface SandboxResponse {
    data: any;
    meta: any;
    _sandbox?: {
        requests_remaining: number;
        latency_ms: number;
        session_expires_at: string;
    };
    error?: string;
}

// ─── Endpoint Config ─────────────────────────────────────────────────────────
const SANDBOX_ENDPOINTS = [
    { id: 'health', label: 'Health Check', path: '/api/v1/health', params: [] },
    {
        id: 'offices',
        label: 'List Offices',
        path: '/api/v1/offices',
        params: [
            { key: 'county', label: 'County', placeholder: 'NAIROBI', type: 'text' },
            { key: 'constituency', label: 'Constituency', placeholder: 'WESTLANDS', type: 'text' },
            { key: 'verified', label: 'Verified Only', placeholder: 'true', type: 'select', options: ['', 'true', 'false'] },
            { key: 'limit', label: 'Limit', placeholder: '10', type: 'number' },
        ],
    },
    {
        id: 'counties',
        label: 'List Counties',
        path: '/api/v1/counties',
        params: [],
    },
    {
        id: 'locate',
        label: 'Nearest Offices',
        path: '/api/v1/locate',
        params: [
            { key: 'lat', label: 'Latitude', placeholder: '-1.2838', type: 'number' },
            { key: 'lng', label: 'Longitude', placeholder: '36.8157', type: 'number' },
            { key: 'radius', label: 'Radius (km)', placeholder: '10', type: 'number' },
        ],
    },
    {
        id: 'stats',
        label: 'Dataset Stats',
        path: '/api/v1/stats',
        params: [],
    },
];

// ─── Component ───────────────────────────────────────────────────────────────
const SandboxWidget = () => {
    const { theme } = useTheme();
    const isDark = theme === 'dark';

    // CEKA Auth State
    const [cekaUser, setCekaUser] = useState<any>(null);
    const [authLoading, setAuthLoading] = useState(true);

    // Sandbox Session State
    const [session, setSession] = useState<SandboxSession | null>(null);
    const [activating, setActivating] = useState(false);

    // Request State
    const [selectedEndpoint, setSelectedEndpoint] = useState(SANDBOX_ENDPOINTS[0]);
    const [paramValues, setParamValues] = useState<Record<string, string>>({});
    const [sending, setSending] = useState(false);
    const [response, setResponse] = useState<SandboxResponse | null>(null);
    const [responseStatus, setResponseStatus] = useState<number>(0);
    const [responseLatency, setResponseLatency] = useState<number>(0);
    const [copied, setCopied] = useState(false);
    const [endpointOpen, setEndpointOpen] = useState(false);

    // Timer
    const [timeLeft, setTimeLeft] = useState('');
    const responseRef = useRef<HTMLPreElement>(null);

    // ─── CEKA Auth Check & OAuth Code Handling ───────────────────────────────
    useEffect(() => {
        const checkCekaAuth = async () => {
            try {
                const { data: { session: cekaSession } } = await cekaSupabase.auth.getSession();
                const sessionUser = cekaSession?.user ?? null;
                setCekaUser(sessionUser);

                // Check for OAuth 'code' in URL
                const params = new URLSearchParams(window.location.search);
                const code = params.get('code');
                if (code && !session) {
                    console.log('[SandboxWidget] Found OAuth code in URL, activating sandbox...');
                    await activateSandbox(code);

                    // Clean up URL without refreshing
                    const url = new URL(window.location.href);
                    url.searchParams.delete('code');
                    window.history.replaceState({}, '', url.pathname + url.hash);
                }
            } catch (err) {
                console.error('[SandboxWidget] Auth initialization failed:', err);
                setCekaUser(null);
            } finally {
                setAuthLoading(false);
            }
        };

        checkCekaAuth();

        const { data: { subscription } } = cekaSupabase.auth.onAuthStateChange((_event, cekaSession) => {
            setCekaUser(cekaSession?.user ?? null);
        });

        return () => subscription.unsubscribe();
    }, [session]);

    // ─── Expiry Timer ────────────────────────────────────────────────────────
    useEffect(() => {
        if (!session) return;
        const interval = setInterval(() => {
            const diff = new Date(session.expires_at).getTime() - Date.now();
            if (diff <= 0) {
                setTimeLeft('Expired');
                setSession(null);
                clearInterval(interval);
                return;
            }
            const h = Math.floor(diff / 3600000);
            const m = Math.floor((diff % 3600000) / 60000);
            const s = Math.floor((diff % 60000) / 1000);
            setTimeLeft(`${h}h ${m}m ${s}s`);
        }, 1000);
        return () => clearInterval(interval);
    }, [session]);

    // ─── CEKA Sign In (Official OAuth Redirect) ──────────────────────────────
    const handleCekaSignIn = useCallback(async () => {
        const state = crypto.randomUUID();
        sessionStorage.setItem('ceka_oauth_state', state);

        // Redirect to CEKA Consent Page
        const redirectUri = encodeURIComponent(`${window.location.origin}/auth/callback`);
        const scope = 'profile%20email';
        const consentUrl = `https://www.civiceducationkenya.com/oauth/consent?client_id=${CEKA_CLIENT_ID}&redirect_uri=${redirectUri}&scope=${scope}&state=${state}`;

        window.location.href = consentUrl;
    }, []);

    // ─── Activate Sandbox (Secure Exchange) ──────────────────────────────────
    const activateSandbox = useCallback(async (oauthCode?: string) => {
        // If we don't have a code yet, we can't activate securely
        if (!oauthCode) {
            handleCekaSignIn();
            return;
        }

        setActivating(true);
        try {
            const resp = await fetch('/api/v1/sandbox/init', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    code: oauthCode,
                }),
            });
            const data = await resp.json();
            if (!resp.ok) throw new Error(data.error || 'Failed to activate sandbox');

            setSession({
                sandbox_key: data.sandbox_key,
                email: data.user.email,
                requests_remaining: data.requests_remaining,
                max_requests: data.max_requests || 50,
                expires_at: data.expires_at,
            });
            setResponse(null);

            toast.success("Sandbox Activated", {
                description: `Welcome, ${data.user.name}. Your session is active for 2 hours.`,
            });
        } catch (err: any) {
            console.error('[SandboxWidget] Activation error:', err);
            // Don't alert if we're just checking on mount and it fails
            if (oauthCode) alert(`Sandbox activation failed: ${err.message}`);
        } finally {
            setActivating(false);
        }
    }, [handleCekaSignIn]);

    // ─── Send Request ────────────────────────────────────────────────────────
    const sendRequest = useCallback(async () => {
        if (!session) return;
        setSending(true);
        setResponse(null);

        const params = new URLSearchParams();
        params.set('endpoint', selectedEndpoint.id);
        for (const [key, value] of Object.entries(paramValues)) {
            if (value.trim()) params.set(key, value.trim());
        }

        const startTime = performance.now();
        try {
            const resp = await fetch(`/api/v1/sandbox/request?${params.toString()}`, {
                headers: { 'X-Sandbox-Key': session.sandbox_key },
            });
            const latency = Math.round(performance.now() - startTime);
            const data = await resp.json();
            setResponseStatus(resp.status);
            setResponseLatency(latency);
            setResponse(data);

            // Update remaining count from response
            if (data._sandbox?.requests_remaining !== undefined) {
                setSession(prev => prev ? { ...prev, requests_remaining: data._sandbox.requests_remaining } : null);
            }

            // Scroll to response
            setTimeout(() => responseRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' }), 100);
        } catch (err: any) {
            setResponseStatus(500);
            setResponseLatency(Math.round(performance.now() - startTime));
            setResponse({ data: null, meta: null, error: err.message });
        } finally {
            setSending(false);
        }
    }, [session, selectedEndpoint, paramValues]);

    // ─── Copy Response ───────────────────────────────────────────────────────
    const copyResponse = useCallback(() => {
        if (!response) return;
        navigator.clipboard.writeText(JSON.stringify(response, null, 2));
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    }, [response]);

    // ─── Styles ──────────────────────────────────────────────────────────────
    const cardBg = isDark ? 'bg-[#1C1C1E]/90' : 'bg-white/90';
    const cardBorder = isDark ? 'border-white/10' : 'border-black/5';
    const inputBg = isDark ? 'bg-[#2C2C2E]' : 'bg-[#F2F2F7]';
    const inputBorder = isDark ? 'border-white/10' : 'border-black/5';
    const inputText = isDark ? 'text-white' : 'text-[#1C1C1E]';
    const mutedText = isDark ? 'text-[#98989D]' : 'text-[#8E8E93]';
    const codeBg = isDark ? 'bg-[#0A0A0A]' : 'bg-[#1C1C1E]';

    // ─── Not Authenticated ───────────────────────────────────────────────────
    if (authLoading) {
        return (
            <div className={`${cardBg} backdrop-blur-2xl border ${cardBorder} rounded-[2rem] p-10`}>
                <div className="flex items-center justify-center gap-3">
                    <Loader2 className="w-5 h-5 animate-spin text-blue-500" />
                    <span className={mutedText}>Checking CEKA identity…</span>
                </div>
            </div>
        );
    }

    if (!cekaUser) {
        return (
            <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className={`${cardBg} backdrop-blur-2xl border ${cardBorder} rounded-[2rem] p-10`}
            >
                <div className="text-center">
                    <div className={`w-16 h-16 rounded-2xl ${isDark ? 'bg-blue-500/10' : 'bg-blue-50'} flex items-center justify-center mx-auto mb-6`}>
                        <Shield className="w-8 h-8 text-blue-500" />
                    </div>
                    <h3 className="text-2xl font-black mb-2">Sign in with CEKA</h3>
                    <p className={`text-sm ${mutedText} mb-6 max-w-sm mx-auto`}>
                        The API sandbox requires a CEKA (Civic Education Kenya) account. This prevents abuse and links sandbox sessions to your civic identity.
                    </p>
                    <button
                        onClick={handleCekaSignIn}
                        className="inline-flex items-center gap-2 px-8 py-4 rounded-2xl font-bold text-white bg-[#007AFF] hover:bg-[#0055CC] hover:shadow-xl hover:shadow-blue-500/20 active:scale-[0.98] transition-all"
                    >
                        <LogIn className="w-5 h-5" />
                        Sign in with CEKA
                    </button>
                    <p className={`text-xs ${mutedText} mt-4`}>
                        Don't have a CEKA account? <a href="https://civiceducationkenya.com/auth" target="_blank" rel="noopener noreferrer" className="text-blue-500 font-bold hover:underline">Create one free →</a>
                    </p>
                </div>
            </motion.div>
        );
    }

    // ─── No Active Session ───────────────────────────────────────────────────
    if (!session) {
        return (
            <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className={`${cardBg} backdrop-blur-2xl border ${cardBorder} rounded-[2rem] p-10`}
            >
                <div className="text-center">
                    <div className={`w-16 h-16 rounded-2xl ${isDark ? 'bg-emerald-500/10' : 'bg-emerald-50'} flex items-center justify-center mx-auto mb-6`}>
                        <Key className="w-8 h-8 text-emerald-500" />
                    </div>
                    <h3 className="text-2xl font-black mb-2">Activate Sandbox</h3>
                    <p className={`text-sm ${mutedText} mb-2`}>
                        Signed in as <span className="font-bold text-foreground">{cekaUser.email}</span>
                    </p>
                    <p className={`text-xs ${mutedText} mb-6`}>
                        50 requests • 2 hour session • 1 req/s burst • Fixture data
                    </p>
                    <button
                        onClick={() => activateSandbox()}
                        disabled={activating}
                        className="inline-flex items-center gap-2 px-8 py-4 rounded-2xl font-bold text-white bg-gradient-to-r from-emerald-500 to-teal-600 hover:shadow-xl hover:shadow-emerald-500/20 active:scale-[0.98] transition-all disabled:opacity-60"
                    >
                        {activating ? (
                            <>
                                <Loader2 className="w-5 h-5 animate-spin" />
                                Generating Key…
                            </>
                        ) : (
                            <>
                                <Zap className="w-5 h-5" />
                                Generate Sandbox Key
                            </>
                        )}
                    </button>
                </div>
            </motion.div>
        );
    }

    // ─── Active Session ──────────────────────────────────────────────────────
    const usagePct = ((session.max_requests - session.requests_remaining) / session.max_requests) * 100;

    return (
        <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className={`${cardBg} backdrop-blur-2xl border ${cardBorder} rounded-[2rem] overflow-hidden`}
        >
            {/* Session Header */}
            <div className={`px-8 py-5 border-b ${cardBorder} flex items-center justify-between flex-wrap gap-4`}>
                <div className="flex items-center gap-3">
                    <div className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
                    <span className="font-bold text-sm">Sandbox Active</span>
                    <span className={`text-xs ${mutedText} font-mono`}>{session.sandbox_key.slice(0, 24)}…</span>
                </div>
                <div className="flex items-center gap-4">
                    <div className="flex items-center gap-1.5">
                        <Terminal className={`w-3.5 h-3.5 ${mutedText}`} />
                        <span className="text-xs font-bold">{session.requests_remaining}/{session.max_requests}</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                        <Clock className={`w-3.5 h-3.5 ${mutedText}`} />
                        <span className="text-xs font-bold">{timeLeft}</span>
                    </div>
                    <button
                        onClick={() => { setSession(null); setResponse(null); }}
                        className={`text-xs font-bold ${mutedText} hover:text-red-500 transition-colors`}
                    >
                        End
                    </button>
                </div>
            </div>

            {/* Usage Bar */}
            <div className="px-8 pt-4 pb-2">
                <div className={`h-1.5 rounded-full ${isDark ? 'bg-white/5' : 'bg-black/5'} overflow-hidden`}>
                    <motion.div
                        className={`h-full rounded-full ${usagePct > 80 ? 'bg-red-500' : usagePct > 50 ? 'bg-amber-500' : 'bg-emerald-500'}`}
                        initial={{ width: 0 }}
                        animate={{ width: `${usagePct}%` }}
                        transition={{ duration: 0.5 }}
                    />
                </div>
            </div>

            {/* Request Builder */}
            <div className="px-8 py-6 space-y-4">
                {/* Endpoint Selector */}
                <div className="relative">
                    <label className={`block text-[10px] font-black uppercase tracking-[0.2em] ${mutedText} mb-2`}>Endpoint</label>
                    <button
                        onClick={() => setEndpointOpen(!endpointOpen)}
                        className={`w-full flex items-center justify-between px-4 py-3 rounded-xl ${inputBg} border ${inputBorder} ${inputText} font-bold text-sm transition-all`}
                    >
                        <span className="flex items-center gap-2">
                            <span className="text-emerald-500 font-mono text-xs">GET</span>
                            {selectedEndpoint.label}
                        </span>
                        <ChevronDown className={`w-4 h-4 transition-transform ${endpointOpen ? 'rotate-180' : ''}`} />
                    </button>
                    <AnimatePresence>
                        {endpointOpen && (
                            <motion.div
                                initial={{ opacity: 0, y: -8 }}
                                animate={{ opacity: 1, y: 0 }}
                                exit={{ opacity: 0, y: -8 }}
                                className={`absolute z-50 mt-2 w-full rounded-xl ${isDark ? 'bg-[#2C2C2E]' : 'bg-white'} border ${cardBorder} shadow-xl overflow-hidden`}
                            >
                                {SANDBOX_ENDPOINTS.map(ep => (
                                    <button
                                        key={ep.id}
                                        onClick={() => {
                                            setSelectedEndpoint(ep);
                                            setEndpointOpen(false);
                                            setParamValues({});
                                            setResponse(null);
                                        }}
                                        className={`w-full px-4 py-3 text-left text-sm font-bold flex items-center gap-2 transition-colors ${ep.id === selectedEndpoint.id
                                            ? 'text-blue-500 ' + (isDark ? 'bg-blue-500/10' : 'bg-blue-50')
                                            : isDark ? 'hover:bg-white/5' : 'hover:bg-black/5'
                                            }`}
                                    >
                                        <span className="text-emerald-500 font-mono text-xs">GET</span>
                                        {ep.label}
                                    </button>
                                ))}
                            </motion.div>
                        )}
                    </AnimatePresence>
                </div>

                {/* Parameters */}
                {selectedEndpoint.params.length > 0 && (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        {selectedEndpoint.params.map(param => (
                            <div key={param.key}>
                                <label className={`block text-[10px] font-black uppercase tracking-[0.2em] ${mutedText} mb-1.5`}>
                                    {param.label}
                                </label>
                                {param.type === 'select' ? (
                                    <select
                                        value={paramValues[param.key] || ''}
                                        onChange={e => setParamValues(p => ({ ...p, [param.key]: e.target.value }))}
                                        className={`w-full px-3 py-2.5 rounded-xl ${inputBg} border ${inputBorder} ${inputText} text-sm font-bold`}
                                    >
                                        <option value="">Any</option>
                                        {param.options?.filter(Boolean).map(o => (
                                            <option key={o} value={o}>{o}</option>
                                        ))}
                                    </select>
                                ) : (
                                    <input
                                        type={param.type === 'number' ? 'number' : 'text'}
                                        value={paramValues[param.key] || ''}
                                        onChange={e => setParamValues(p => ({ ...p, [param.key]: e.target.value }))}
                                        placeholder={param.placeholder}
                                        className={`w-full px-3 py-2.5 rounded-xl ${inputBg} border ${inputBorder} ${inputText} text-sm font-bold placeholder:font-normal placeholder:${mutedText}`}
                                    />
                                )}
                            </div>
                        ))}
                    </div>
                )}

                {/* Send Button */}
                <button
                    onClick={sendRequest}
                    disabled={sending || session.requests_remaining <= 0}
                    className="w-full flex items-center justify-center gap-2 py-3.5 rounded-xl font-bold text-sm text-white bg-[#007AFF] hover:bg-[#0055CC] hover:shadow-lg hover:shadow-blue-500/20 active:scale-[0.98] transition-all disabled:opacity-50"
                >
                    {sending ? (
                        <>
                            <Loader2 className="w-4 h-4 animate-spin" />
                            Sending…
                        </>
                    ) : (
                        <>
                            <Play className="w-4 h-4" />
                            Send Request
                        </>
                    )}
                </button>
            </div>

            {/* Response */}
            <AnimatePresence>
                {response && (
                    <motion.div
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: 'auto' }}
                        exit={{ opacity: 0, height: 0 }}
                        className={`border-t ${cardBorder}`}
                    >
                        {/* Response Header */}
                        <div className={`px-8 py-3 flex items-center justify-between border-b ${cardBorder}`}>
                            <div className="flex items-center gap-3">
                                <span className={`px-2.5 py-1 rounded-lg text-xs font-black ${responseStatus >= 200 && responseStatus < 300
                                    ? 'bg-emerald-500/10 text-emerald-500'
                                    : responseStatus >= 400
                                        ? 'bg-red-500/10 text-red-500'
                                        : 'bg-amber-500/10 text-amber-500'
                                    }`}>
                                    {responseStatus}
                                </span>
                                <span className={`text-xs ${mutedText}`}>{responseLatency}ms</span>
                            </div>
                            <button
                                onClick={copyResponse}
                                className={`flex items-center gap-1.5 text-xs font-bold ${mutedText} hover:text-foreground transition-colors`}
                            >
                                {copied ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
                                {copied ? 'Copied' : 'Copy'}
                            </button>
                        </div>

                        {/* Response Body */}
                        <pre
                            ref={responseRef}
                            className={`${codeBg} text-emerald-400 font-mono text-xs leading-relaxed p-6 max-h-[400px] overflow-auto`}
                        >
                            {JSON.stringify(response, null, 2)}
                        </pre>
                    </motion.div>
                )}
            </AnimatePresence>
        </motion.div>
    );
};

export default SandboxWidget;

// src/components/SandboxWidget.tsx
// Nasaka IEBC — Interactive API Sandbox Widget
// Hybrid Implementation: Merges Original Logic with Enhanced UX
// Adheres strictly to index.css Deep iOS Design & Zero Mocks policy.

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
    Globe,
    Cpu,
    Search,
    Fingerprint,
    Layout,
    Unlock,
    Code2,
    Map as MapIcon,
} from 'lucide-react';
import { useTheme } from '@/contexts/ThemeContext';
import { cekaSupabase, CEKA_OAUTH_BASE, CEKA_CLIENT_ID, CEKA_REDIRECT_URI } from '@/integrations/ceka/client';
import { toast } from 'sonner';
import { AuthModal } from './Auth/AuthModal';
import { useCekaAuth } from '@/hooks/useCekaAuth';

// ─── Types & Configuration ───────────────────────────────────────────────────
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

const SANDBOX_ENDPOINTS = [
    { 
        id: 'offices', 
        name: 'GET /offices', 
        label: 'List Offices', 
        path: '/api/v1/offices', 
        description: 'Filtered lookup of electoral offices',
        color: 'text-emerald-500', 
        bg: 'bg-emerald-500/10',
        params: [
            { key: 'county', label: 'County', placeholder: 'NAIROBI', type: 'text' },
            { key: 'constituency', label: 'Constituency', placeholder: 'WESTLANDS', type: 'text' },
            { key: 'verified', label: 'Verified Only', placeholder: 'true', type: 'select', options: ['', 'true', 'false'] },
            { key: 'limit', label: 'Limit', placeholder: '10', type: 'number' },
        ] 
    },
    { 
        id: 'search', 
        name: 'GET /search', 
        label: 'Global Search', 
        path: '/api/v1/search', 
        description: 'Semantic search across datasets',
        color: 'text-blue-500', 
        bg: 'bg-blue-500/10',
        params: [
            { key: 'q', label: 'Query', placeholder: 'City Hall', type: 'text' },
        ] 
    },
    { 
        id: 'locate', 
        name: 'GET /locate', 
        label: 'Nearest Offices', 
        path: '/api/v1/locate', 
        description: 'GPS-proximity based lookup',
        color: 'text-[#007AFF]', 
        bg: 'bg-[#007AFF]/10',
        params: [
            { key: 'lat', label: 'Latitude', placeholder: '-1.2838', type: 'number' },
            { key: 'lng', label: 'Longitude', placeholder: '36.8157', type: 'number' },
            { key: 'radius', label: 'Radius (km)', placeholder: '10', type: 'number' },
        ] 
    },
    { 
        id: 'stats', 
        name: 'GET /stats', 
        label: 'Dataset Stats', 
        path: '/api/v1/stats', 
        description: 'Real-time sync metrics',
        color: 'text-purple-500', 
        bg: 'bg-purple-500/10',
        params: [] 
    },
    { 
        id: 'health', 
        name: 'GET /health', 
        label: 'Health Check', 
        path: '/api/v1/health', 
        description: 'System availability check',
        color: 'text-white/40', 
        bg: 'bg-white/5',
        params: [] 
    },
];

// ─── Main Component ──────────────────────────────────────────────────────────
export const SandboxWidget = () => {
    const { theme } = useTheme();
    const isDark = theme === 'dark';

    // Core Logic States (Restored 1:1)
    const [cekaUser, setCekaUser] = useState<any>(null);
    const [authLoading, setAuthLoading] = useState(true);
    const [session, setSession] = useState<SandboxSession | null>(null);
    const [activating, setActivating] = useState(false);
    const [timeLeft, setTimeLeft] = useState('');

    // Request States
    const [selectedEndpoint, setSelectedEndpoint] = useState(SANDBOX_ENDPOINTS[0]);
    const [paramValues, setParamValues] = useState<Record<string, string>>({});
    const [sending, setSending] = useState(false);
    const [response, setResponse] = useState<SandboxResponse | null>(null);
    const [responseStatus, setResponseStatus] = useState<number>(0);
    const [responseLatency, setResponseLatency] = useState<number>(0);
    const [copied, setCopied] = useState(false);
    
    // UI States
    const [mode, setMode] = useState<'explorer' | 'developer' | 'map'>('developer');
    const responseRef = useRef<HTMLPreElement>(null);

    // ─── Authentication Flow ─────────────────────────────────────────────────
    useEffect(() => {
        const checkAuth = async () => {
            try {
                const { data: { session: cekaSession } } = await cekaSupabase.auth.getSession();
                setCekaUser(cekaSession?.user ?? null);

                // Handle auto-activation if cekaUser just logged in
                if (cekaSession?.user && !session && !activating) {
                    activateSandbox();
                }
            } catch (err) {
                console.error('[Sandbox] Auth init error:', err);
            } finally {
                setAuthLoading(false);
            }
        };
        checkAuth();
        const { data: { subscription } } = cekaSupabase.auth.onAuthStateChange((_event, session) => {
            setCekaUser(session?.user ?? null);
        });
        return () => subscription.unsubscribe();
    }, [session]);

    // ─── Session Timer ───────────────────────────────────────────────────────
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

    // ─── Activation Logic ────────────────────────────────────────────────────
    const activateSandbox = useCallback(async (oauthCode?: string) => {
        if (!oauthCode) {
            // Initiate OAuth if no code
            const state = crypto.randomUUID();
            sessionStorage.setItem('ceka_oauth_state', state);
            const redirectUri = encodeURIComponent(CEKA_REDIRECT_URI);
            window.location.href = `https://www.civiceducationkenya.com/oauth/consent?client_id=${CEKA_CLIENT_ID}&redirect_uri=${redirectUri}&scope=profile%20email&state=${state}`;
            return;
        }

        setActivating(true);
        try {
            const resp = await fetch('/api/v1/sandbox/init', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ code: oauthCode }),
            });
            const data = await resp.json();
            if (!resp.ok) throw new Error(data.error || 'Activation failed');

            setSession({
                sandbox_key: data.sandbox_key,
                email: data.user.email,
                requests_remaining: data.requests_remaining,
                max_requests: data.max_requests || 50,
                expires_at: data.expires_at,
            });
            toast.success("Sandbox Activated");
        } catch (err: any) {
            console.error('[Sandbox] Activation failed:', err);
            toast.error(err.message);
        } finally {
            setActivating(false);
        }
    }, []);

    // ─── Execution Logic ─────────────────────────────────────────────────────
    const sendRequest = useCallback(async () => {
        if (!session) return;
        setSending(true);
        setResponse(null);

        const params = new URLSearchParams();
        params.set('endpoint', selectedEndpoint.id);
        Object.entries(paramValues).forEach(([k, v]) => {
            if (v.trim()) params.set(k, v.trim());
        });

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

            if (data._sandbox?.requests_remaining !== undefined) {
                setSession(prev => prev ? { ...prev, requests_remaining: data._sandbox.requests_remaining } : null);
            }
            
            setTimeout(() => responseRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' }), 100);
        } catch (err: any) {
            setResponseStatus(500);
            setResponse({ data: null, meta: null, error: err.message });
        } finally {
            setSending(false);
        }
    }, [session, selectedEndpoint, paramValues]);

    const copyResponse = () => {
        if (!response) return;
        navigator.clipboard.writeText(JSON.stringify(response, null, 2));
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    // ─── Styling ─────────────────────────────────────────────────────────────
    const cardBg = isDark ? 'bg-[#1C1C1E]/95' : 'bg-white/95';
    const cardBorder = isDark ? 'border-white/10' : 'border-black/5';
    const inputBg = isDark ? 'bg-[#2C2C2E]' : 'bg-[#F2F2F7]';
    const mutedText = isDark ? 'text-[#98989D]' : 'text-[#8E8E93]';
    const isUnlocked = !!session;

    if (authLoading) {
        return (
            <div className={`w-full max-w-6xl mx-auto h-[600px] rounded-[3rem] border ${cardBorder} ${cardBg} backdrop-blur-3xl flex flex-col items-center justify-center`}>
                <Loader2 className="w-10 h-10 animate-spin text-[#007AFF] mb-4" />
                <span className="text-[10px] font-black uppercase tracking-[0.3em] text-[#007AFF]">Synchronizing Session...</span>
            </div>
        );
    }

    return (
        <div id="sandbox" className={`relative w-full max-w-6xl mx-auto rounded-[3rem] overflow-hidden border ${cardBorder} ${cardBg} backdrop-blur-3xl shadow-ios-high transition-all duration-700`}>
            {/* Header Header */}
            <div className={`flex items-center justify-between px-8 py-5 border-b ${cardBorder} bg-white/5`}>
                <div className="flex items-center gap-3">
                    <div className="flex gap-1.5">
                        <div className="w-3 h-3 rounded-full bg-red-500/20" />
                        <div className="w-3 h-3 rounded-full bg-amber-500/20" />
                        <div className="w-3 h-3 rounded-full bg-emerald-500/20" />
                    </div>
                    <div className="h-4 w-[1px] bg-white/10 mx-2" />
                    <div className="flex items-center gap-2">
                        <Fingerprint className="w-4 h-4 text-[#007AFF]" />
                        <span className="text-[10px] font-black uppercase tracking-[0.2em] text-[#007AFF]">Nasaka Payload Processor</span>
                    </div>
                </div>

                <div className="flex items-center gap-6">
                    <div className="hidden md:flex items-center gap-5">
                        {['explorer', 'developer', 'map'].map((m) => (
                            <button
                                key={m}
                                onClick={() => setMode(m as any)}
                                className={`text-[10px] font-black uppercase tracking-[0.15em] transition-all ${mode === m ? 'text-white' : 'text-white/40 hover:text-white/60'}`}
                            >
                                {m}
                            </button>
                        ))}
                    </div>

                    {cekaUser ? (
                        <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-emerald-500/10 border border-emerald-500/20">
                            <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                            <span className="text-[10px] font-black text-emerald-500 uppercase tracking-widest">{cekaUser.email?.split('@')[0]}</span>
                        </div>
                    ) : (
                        <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-amber-500/10 border border-amber-500/20">
                            <Shield className="w-3 h-3 text-amber-500" />
                            <span className="text-[10px] font-black text-amber-500 uppercase tracking-widest">Guest</span>
                        </div>
                    )}
                </div>
            </div>

            <div className={`grid grid-cols-1 lg:grid-cols-12 relative min-h-[600px] transition-all duration-1000 ${isUnlocked ? '' : 'overflow-hidden'}`}>
                
                {/* ── Side A: Parameters / Wall ── */}
                <div className={`col-span-1 lg:col-span-5 border-r ${cardBorder} flex flex-col relative overflow-hidden transition-all duration-1000 ${isUnlocked ? 'lg:col-span-4' : 'lg:col-span-5'}`}>
                    
                    {/* Security Wall Layer */}
                    <AnimatePresence>
                        {!isUnlocked && (
                            <motion.div 
                                initial={{ opacity: 0 }}
                                animate={{ opacity: 1 }}
                                exit={{ opacity: 0 }}
                                className="absolute inset-0 z-30 backdrop-blur-3xl bg-black/20 flex flex-col items-center justify-center p-0 text-center"
                            >
                                <div className="w-full h-full overflow-y-auto no-scrollbar">
                                    <AuthModal 
                                        embedded 
                                        mode="signin" 
                                        useAuthHook={useCekaAuth}
                                        onSuccess={() => {/* Handled by Auth Change Hook */}} 
                                    />
                                    {!cekaUser && (
                                        <div className="px-10 pb-12 -mt-4 text-center">
                                            <p className={`text-[11px] ${mutedText} mb-4`}>New to the platform?</p>
                                            <a href="https://civiceducationkenya.com/auth" target="_blank" rel="noopener noreferrer" className="text-[11px] font-black text-[#007AFF] uppercase tracking-widest hover:underline">Create Account →</a>
                                        </div>
                                    )}
                                    {cekaUser && (
                                        <motion.div initial={{ scale: 0.95 }} animate={{ scale: 1 }} className="h-full flex flex-col items-center justify-center p-12">
                                            <div className="w-20 h-20 rounded-3xl bg-emerald-500/10 flex items-center justify-center mb-8">
                                                <Zap className="w-10 h-10 text-emerald-500" />
                                            </div>
                                            <h3 className="text-xl font-black mb-3">Identity Locked</h3>
                                            <p className={`text-xs ${mutedText} mb-8 leading-relaxed`}>Welcome back, <strong>{cekaUser.email}</strong>.<br/>Activate your session to enable full interactive capabilities.</p>
                                            <button
                                                onClick={() => activateSandbox()}
                                                disabled={activating}
                                                className="w-full h-16 rounded-2xl bg-gradient-to-r from-emerald-500 to-teal-500 text-white font-black uppercase tracking-[0.2em] text-[11px] shadow-xl shadow-emerald-500/20 active:scale-[0.98] transition-all"
                                            >
                                                {activating ? <Loader2 className="w-5 h-5 animate-spin mx-auto" /> : "ACTIVATE SANDBOX SESSION"}
                                            </button>
                                        </motion.div>
                                    )}
                                </div>
                            </motion.div>
                        )}
                    </AnimatePresence>

                    {/* Request Parameters (Original Logic) */}
                    <div className="flex-1 p-8 space-y-8 overflow-y-auto no-scrollbar">
                        <div>
                            <h3 className="text-[10px] font-black uppercase tracking-[0.2em] mb-6 text-white/30">Select Operation</h3>
                            <div className="space-y-3">
                                {SANDBOX_ENDPOINTS.map(ep => (
                                    <button
                                        key={ep.id}
                                        onClick={() => { setSelectedEndpoint(ep); setParamValues({}); setResponse(null); }}
                                        className={`w-full flex items-start gap-4 p-4 rounded-2xl border transition-all duration-300 ${selectedEndpoint.id === ep.id ? 'bg-[#007AFF]/10 border-[#007AFF]/30 shadow-lg shadow-[#007AFF]/5' : 'border-transparent hover:bg-white/5'}`}
                                    >
                                        <div className={`w-10 h-10 rounded-xl ${ep.bg} flex items-center justify-center ${ep.color} shrink-0`}>
                                            {ep.id === 'offices' && <Layout className="w-5 h-5" />}
                                            {ep.id === 'search' && <Search className="w-5 h-5" />}
                                            {ep.id === 'locate' && <Globe className="w-5 h-5" />}
                                            {ep.id === 'health' && <Shield className="w-5 h-5" />}
                                            {ep.id === 'stats' && <Cpu className="w-5 h-5" />}
                                        </div>
                                        <div className="text-left mt-0.5">
                                            <div className="font-bold text-sm mb-0.5">{ep.name}</div>
                                            <div className="text-[10px] text-white/30 font-bold uppercase tracking-widest">{ep.label}</div>
                                        </div>
                                    </button>
                                ))}
                            </div>
                        </div>

                        <div className="space-y-6">
                            <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-white/30">Configuration Parameters</h3>
                            {selectedEndpoint.params.length > 0 ? (
                                <div className="space-y-4">
                                    {selectedEndpoint.params.map(param => (
                                        <div key={param.key} className="space-y-2">
                                            <label className="text-[10px] font-bold text-white/40 ml-1 uppercase tracking-tighter">{param.label}</label>
                                            {param.type === 'select' ? (
                                                <select
                                                    value={paramValues[param.key] || ''}
                                                    onChange={e => setParamValues(p => ({ ...p, [param.key]: e.target.value }))}
                                                    className={`w-full bg-white/5 border ${cardBorder} rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-[#007AFF]/30 transition-all text-white`}
                                                >
                                                    <option value="">Any</option>
                                                    {param.options?.filter(Boolean).map(o => <option key={o} value={o}>{o}</option>)}
                                                </select>
                                            ) : (
                                                <input
                                                    type={param.type === 'number' ? 'number' : 'text'}
                                                    value={paramValues[param.key] || ''}
                                                    onChange={e => setParamValues(p => ({ ...p, [param.key]: e.target.value }))}
                                                    placeholder={param.placeholder}
                                                    className={`w-full bg-white/5 border ${cardBorder} rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-[#007AFF]/30 transition-all text-white placeholder:text-white/20`}
                                                />
                                            )}
                                        </div>
                                    ))}
                                </div>
                            ) : (
                                <div className={`p-8 rounded-2xl border border-dashed ${cardBorder} text-center`}>
                                    <p className="text-[10px] font-bold text-white/20 uppercase tracking-[0.3em]">No Parameters Required</p>
                                </div>
                            )}

                            <button
                                onClick={sendRequest}
                                disabled={sending || !isUnlocked}
                                className="w-full h-16 rounded-2xl bg-[#007AFF] text-white font-black uppercase tracking-[0.2em] text-[11px] shadow-2xl shadow-[#007AFF]/40 hover:bg-[#005CCB] active:scale-[0.98] transition-all disabled:opacity-30"
                            >
                                {sending ? <Loader2 className="w-5 h-5 animate-spin mx-auto" /> : (
                                    <span className="flex items-center justify-center gap-3"><Play className="w-4 h-4 fill-current" /> EXECUTE PAYLOAD</span>
                                )}
                            </button>
                        </div>
                    </div>
                </div>

                {/* ── Side B: Response View ── */}
                <div className={`col-span-1 lg:col-span-7 bg-[#050505]/60 flex flex-col transition-all duration-1000 ${isUnlocked ? 'lg:col-span-8' : 'lg:col-span-7 relative'}`}>
                    
                    {/* Visual Wall (Blur) */}
                    <AnimatePresence>
                        {!isUnlocked && (
                            <motion.div 
                                initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                                className="absolute inset-0 z-20 backdrop-blur-md bg-black/40 flex flex-col items-center justify-center p-12 text-center"
                            >
                                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-[#007AFF]/10 rounded-full blur-[100px] pointer-events-none" />
                                <div className="relative">
                                    <div className="w-20 h-20 rounded-full border border-white/10 flex items-center justify-center mb-6 mx-auto">
                                        <div className="w-12 h-12 rounded-full border-2 border-[#007AFF] border-t-transparent animate-spin-slow" />
                                        <Shield className="w-6 h-6 text-[#007AFF] absolute" />
                                    </div>
                                    <h4 className="text-lg font-black text-white mb-2 uppercase tracking-tighter">Secure Data Stream</h4>
                                    <p className="text-xs text-white/40 max-w-xs mx-auto leading-relaxed underline-offset-4 decoration-[#007AFF]/40">Authenticated sessions enjoy 100% data fidelity with production-grade responses.</p>
                                </div>
                            </motion.div>
                        )}
                    </AnimatePresence>

                    <div className={`px-6 py-4 border-b ${cardBorder} flex items-center justify-between bg-black/20`}>
                        <div className="flex items-center gap-8">
                           <div className="flex items-center gap-2 px-3 py-1 rounded bg-white/5 border border-white/5">
                               <Terminal className="w-3.5 h-3.5 text-[#007AFF]" />
                               <span className="text-[10px] font-mono font-black text-white/40 tracking-widest">STDOUT</span>
                           </div>
                           {response && (
                               <div className="flex items-center gap-6">
                                   <div className="flex items-center gap-2">
                                        <div className={`w-1.5 h-1.5 rounded-full ${responseStatus < 400 ? 'bg-emerald-500' : 'bg-red-500'}`} />
                                        <span className={`text-[10px] font-mono font-bold ${responseStatus < 400 ? 'text-emerald-500' : 'text-red-500'}`}>STATUS_{responseStatus}</span>
                                   </div>
                                   <div className="flex items-center gap-2">
                                        <Clock className="w-3.5 h-3.5 text-white/20" />
                                        <span className="text-[10px] font-mono text-white/40">{responseLatency}ms</span>
                                   </div>
                               </div>
                           )}
                        </div>
                        <button onClick={copyResponse} disabled={!response} className={`p-2 rounded-xl transition-all ${copied ? "bg-emerald-500/10 text-emerald-500" : "bg-white/5 text-white/40 hover:text-white"}`}>
                            {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                        </button>
                    </div>

                    <div className="flex-1 relative overflow-hidden font-mono text-[13px]">
                        <AnimatePresence mode="wait">
                            {!response && !sending ? (
                                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="h-full flex flex-col items-center justify-center p-20 text-center opacity-10 grayscale">
                                    <Cpu className="w-20 h-20 text-white mb-6" />
                                    <h4 className="text-[10px] font-black uppercase tracking-[0.5em] text-white">System_Standby_IDLE</h4>
                                </motion.div>
                            ) : sending ? (
                                <div className="absolute inset-0 flex flex-col items-center justify-center z-10">
                                    <Loader2 className="w-10 h-10 animate-spin text-[#007AFF]" />
                                    <span className="mt-5 text-[9px] font-black uppercase tracking-[0.5em] text-[#007AFF] animate-pulse">Streaming_Payload...</span>
                                </div>
                            ) : (
                                <motion.div initial={{ opacity: 0, scale: 0.98 }} animate={{ opacity: 1, scale: 1 }} className="h-full overflow-auto custom-scrollbar p-8">
                                    <pre ref={responseRef} className="text-[#007AFF] custom-scrollbar selection:bg-[#007AFF]/30">
                                        {JSON.stringify(response, null, 4)}
                                    </pre>
                                </motion.div>
                            )}
                        </AnimatePresence>
                    </div>

                    {/* Footer Progress & Quota */}
                    <div className={`px-8 py-5 bg-black/60 border-t ${cardBorder} flex items-center justify-between`}>
                        <div className="flex items-center gap-10">
                            <div className="flex items-center gap-2">
                                <span className="text-[9px] font-black text-white/20 uppercase tracking-widest">Tier:</span>
                                <div className="px-2 py-0.5 rounded bg-blue-500/10 border border-blue-500/20"><span className="text-[9px] font-black text-[#007AFF]">SANDBOX_V1</span></div>
                            </div>
                            {session && (
                                <div className="flex items-center gap-10">
                                    <div className="flex items-center gap-2">
                                        <span className="text-[9px] font-black text-white/20 uppercase tracking-widest">Quota:</span>
                                        <span className="text-[10px] font-mono font-bold text-white/60">{session.requests_remaining} / {session.max_requests}</span>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <span className="text-[9px] font-black text-white/20 uppercase tracking-widest">TTL:</span>
                                        <span className="text-[10px] font-mono font-bold text-emerald-500">{timeLeft}</span>
                                    </div>
                                </div>
                            )}
                        </div>
                        {session && (
                             <button onClick={() => setSession(null)} className="flex items-center gap-2 px-3 py-1 rounded-lg hover:bg-red-500/10 text-white/20 hover:text-red-500 transition-all group">
                                <RefreshCw className="w-3 h-3 group-hover:rotate-180 transition-transform duration-700" />
                                <span className="text-[9px] font-black uppercase tracking-widest">Drop Session</span>
                             </button>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};

export default SandboxWidget;

import React, { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import {
    Shield,
    User,
    Clock,
    Fingerprint,
    ExternalLink,
    ShieldAlert,
    Search,
    Lock
} from 'lucide-react';

const AuditEvent = ({ event }) => {
    const getActionColor = (action) => {
        if (action.includes('REJECT') || action.includes('DELETE')) return 'text-red-400 bg-red-400/10 border-red-400/20';
        if (action.includes('VERIFY') || action.includes('PROMOTE')) return 'text-emerald-400 bg-emerald-400/10 border-emerald-400/20';
        return 'text-blue-400 bg-blue-400/10 border-blue-400/20';
    };

    return (
        <div className="flex items-start space-x-6 p-6 bg-white/[0.02] border border-white/5 rounded-3xl hover:bg-white/[0.04] transition-all group">
            <div className="flex-shrink-0 w-12 h-12 bg-white/5 rounded-2xl flex items-center justify-center text-gray-400 group-hover:text-blue-400 transition-colors">
                <User size={20} />
            </div>

            <div className="flex-1 space-y-2">
                <div className="flex justify-between items-start">
                    <div className="flex items-center space-x-3">
                        <span className={`px-2 py-0.5 rounded-lg text-[10px] font-black uppercase tracking-widest border ${getActionColor(event.action_type || event.action)}`}>
                            {event.action_type || event.action}
                        </span>
                        <span className="text-sm font-bold text-white">
                            {event.user_id ? event.user_id.split('-')[0] : 'System'}
                            <span className="text-gray-500 font-medium ml-2">on {event.table_name || 'Generic'}</span>
                        </span>
                    </div>
                    <div className="flex items-center space-x-2 text-xs text-gray-500">
                        <Clock size={12} />
                        <span>{new Date(event.created_at).toLocaleString()}</span>
                    </div>
                </div>

                <p className="text-sm text-gray-400 font-medium leading-relaxed">
                    {typeof event.details === 'string' ? event.details : JSON.stringify(event.details)}
                </p>

                <div className="flex items-center space-x-4 pt-2">
                    <div className="flex items-center space-x-1.5 text-[10px] text-gray-600 font-mono">
                        <Fingerprint size={10} />
                        <span>ID: {event.id.toString().slice(0, 8)}</span>
                    </div>
                    <div className="flex items-center space-x-1.5 text-[10px] text-gray-600 font-mono">
                        <Shield size={10} />
                        <span>Sec: {event.action_type ? 'High' : 'Normal'}</span>
                    </div>
                </div>
            </div>

            <button className="flex-shrink-0 text-gray-600 hover:text-white transition-colors">
                <ExternalLink size={18} />
            </button>
        </div>
    );
};

const SecurityAudit = () => {
    const [logs, setLogs] = useState([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState('');

    useEffect(() => {
        const fetchLogs = async () => {
            // Fetching from both security_audit_log and verification_log
            const [secResp, verResp] = await Promise.all([
                supabase.from('security_audit_log').select('*').order('created_at', { ascending: false }).limit(20),
                supabase.from('verification_log').select('*').order('created_at', { ascending: false }).limit(20)
            ]);

            const combined = [...(secResp.data || []), ...(verResp.data || [])]
                .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
                .slice(0, 30);

            setLogs(combined);
            setLoading(false);
        };

        fetchLogs();
    }, []);

    return (
        <div className="space-y-6">
            {/* Search Header */}
            <div className="flex items-center justify-between mb-8">
                <div className="relative flex-1 max-w-lg">
                    <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500" size={18} />
                    <input
                        type="text"
                        placeholder="Search audit trail by actor, action, or record..."
                        className="w-full bg-white/5 border border-white/10 rounded-2xl py-3 pl-12 pr-4 text-sm text-white placeholder-gray-500 outline-none focus:ring-2 focus:ring-blue-500/50 transition-all text-gray-400"
                    />
                </div>
                <div className="flex items-center space-x-3">
                    <button className="flex items-center space-x-2 px-4 py-2 bg-red-500/10 text-red-400 rounded-xl border border-red-500/20 text-xs font-bold uppercase tracking-widest">
                        <ShieldAlert size={14} />
                        <span>Export Encrypted Log</span>
                    </button>
                </div>
            </div>

            {/* Warning Banner */}
            <div className="bg-amber-500/10 border border-amber-500/20 rounded-[2rem] p-6 flex items-start space-x-4 mb-8">
                <div className="p-3 bg-amber-500/20 rounded-2xl text-amber-400">
                    <Lock size={20} />
                </div>
                <div>
                    <h4 className="text-sm font-bold text-amber-300 tracking-tight">Immutable Audit Core</h4>
                    <p className="text-xs text-amber-400/60 leading-relaxed uppercase tracking-wider font-medium">
                        All entries shown here are immutable and signed by the system kernel. Deletion of audit logs is restricted to Root level access only.
                    </p>
                </div>
            </div>

            {/* Main List */}
            <div className="space-y-4 max-h-[calc(100vh-250px)] overflow-y-auto pr-2 custom-scrollbar">
                {loading ? (
                    Array(6).fill(0).map((_, i) => (
                        <div key={i} className="h-24 bg-white/5 rounded-3xl animate-pulse border border-white/5" />
                    ))
                ) : logs.map((log) => (
                    <AuditEvent key={`${log.id}-${log.created_at}`} event={log} />
                ))}
            </div>
        </div>
    );
};

export default SecurityAudit;

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
    Lock,
    Info,
    HelpCircle
} from 'lucide-react';

const ACTION_DEFINITIONS = {
    'VERIFY': { label: 'Verification', desc: 'A contribution or office was verified as accurate by an admin' },
    'REJECT': { label: 'Rejection', desc: 'A contribution was rejected by an admin as inaccurate or duplicate' },
    'DELETE': { label: 'Deletion', desc: 'A record was permanently removed from the database' },
    'ADMIN_EDIT': { label: 'Admin Edit', desc: 'An admin manually edited an office record' },
    'ADMIN_DELETE': { label: 'Admin Delete', desc: 'An admin permanently deleted an office record' },
    'PROMOTE': { label: 'Promotion', desc: 'A contribution was promoted to an official IEBC office entry' },
    'INSERT': { label: 'Creation', desc: 'A new record was created in the system' },
    'UPDATE': { label: 'Update', desc: 'An existing record was modified' },
    'LOGIN': { label: 'Login', desc: 'A user logged into the admin panel' },
    'ARCHIVE': { label: 'Archive', desc: 'A record was moved to the archive' },
};

const AuditEvent = ({ event }) => {
    const getActionColor = (action) => {
        if (action.includes('REJECT') || action.includes('DELETE')) return 'text-red-400 bg-red-400/10 border-red-400/20';
        if (action.includes('VERIFY') || action.includes('PROMOTE')) return 'text-emerald-400 bg-emerald-400/10 border-emerald-400/20';
        return 'text-blue-400 bg-blue-400/10 border-blue-400/20';
    };

    const actionKey = (event.action_type || event.action || '').toUpperCase();
    const actionDef = Object.entries(ACTION_DEFINITIONS).find(([k]) => actionKey.includes(k));
    const severity = actionKey.includes('DELETE') || actionKey.includes('REJECT') ? 'High' : actionKey.includes('VERIFY') || actionKey.includes('PROMOTE') ? 'Medium' : 'Normal';

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
                    <div className="flex items-center space-x-1.5 text-[10px] text-gray-600 font-mono" title="Unique event identifier for audit traceability">
                        <Fingerprint size={10} />
                        <span>ID: {event.id.toString().slice(0, 8)}</span>
                    </div>
                    <div className="flex items-center space-x-1.5 text-[10px] text-gray-600 font-mono" title={`Severity: ${severity} — ${actionDef ? actionDef[1].desc : 'Uncategorized action'}`}>
                        <Shield size={10} />
                        <span>Sev: {severity}</span>
                    </div>
                    {event.record_id && (
                        <div className="flex items-center space-x-1.5 text-[10px] text-gray-600 font-mono" title="The database record this action affected">
                            <Info size={10} />
                            <span>Rec: {event.record_id}</span>
                        </div>
                    )}
                </div>
            </div>

            <button className="flex-shrink-0 text-gray-600 hover:text-white transition-colors" title="View raw event data">
                <ExternalLink size={18} />
            </button>
        </div>
    );
};

const SecurityAudit = () => {
    const [logs, setLogs] = useState([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState('');
    const [showLegend, setShowLegend] = useState(false);

    useEffect(() => {
        const fetchLogs = async () => {
            // Fetching from both security_audit_log and verification_log
            const [secResp, verResp] = await Promise.all([
                (supabase as any).from('security_audit_log').select('*').order('created_at', { ascending: false }).limit(20),
                (supabase as any).from('verification_log').select('*').order('created_at', { ascending: false }).limit(20)
            ]);

            const combined = [...(secResp.data || []), ...(verResp.data || [])]
                .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
                .slice(0, 30);

            setLogs(combined);
            setLoading(false);
        };

        fetchLogs();
    }, []);

    const filteredLogs = search
        ? logs.filter(log => {
            const s = search.toLowerCase();
            const action = (log.action_type || log.action || '').toLowerCase();
            const userId = (log.user_id || '').toLowerCase();
            const details = typeof log.details === 'string' ? log.details.toLowerCase() : JSON.stringify(log.details || '').toLowerCase();
            const table = (log.table_name || '').toLowerCase();
            return action.includes(s) || userId.includes(s) || details.includes(s) || table.includes(s);
        })
        : logs;

    return (
        <div className="space-y-6">
            {/* Search Header */}
            <div className="flex items-center justify-between mb-8">
                <div className="relative flex-1 max-w-lg">
                    <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500" size={18} />
                    <input
                        type="text"
                        placeholder="Search audit trail by actor, action, or record..."
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        className="w-full bg-white/5 border border-white/10 rounded-2xl py-3 pl-12 pr-4 text-sm text-white placeholder-gray-500 outline-none focus:ring-2 focus:ring-blue-500/50 transition-all"
                    />
                </div>
                <div className="flex items-center space-x-3">
                    <button
                        onClick={() => setShowLegend(!showLegend)}
                        className="flex items-center space-x-2 px-4 py-2 bg-blue-500/10 text-blue-400 rounded-xl border border-blue-500/20 text-xs font-bold uppercase tracking-widest"
                    >
                        <HelpCircle size={14} />
                        <span>Field Guide</span>
                    </button>
                    <button className="flex items-center space-x-2 px-4 py-2 bg-red-500/10 text-red-400 rounded-xl border border-red-500/20 text-xs font-bold uppercase tracking-widest">
                        <ShieldAlert size={14} />
                        <span>Export Encrypted Log</span>
                    </button>
                </div>
            </div>

            {/* Legend / Field Guide */}
            {showLegend && (
                <div className="bg-white/[0.03] border border-white/10 rounded-[2rem] p-6 space-y-4">
                    <h4 className="text-sm font-bold text-white uppercase tracking-widest">Audit Field Definitions</h4>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="space-y-3">
                            <h5 className="text-[10px] font-black text-blue-400 uppercase tracking-widest">Action Types</h5>
                            {Object.entries(ACTION_DEFINITIONS).map(([key, def]) => (
                                <div key={key} className="flex items-start space-x-3">
                                    <span className="text-[10px] font-mono text-gray-500 w-24 flex-shrink-0">{key}</span>
                                    <span className="text-xs text-gray-400">{def.desc}</span>
                                </div>
                            ))}
                        </div>
                        <div className="space-y-3">
                            <h5 className="text-[10px] font-black text-blue-400 uppercase tracking-widest">Column Meanings</h5>
                            <div className="space-y-3">
                                <div className="flex items-start space-x-3">
                                    <Fingerprint size={12} className="text-gray-500 mt-0.5 flex-shrink-0" />
                                    <div>
                                        <span className="text-xs font-bold text-gray-300">ID</span>
                                        <p className="text-xs text-gray-500">Unique event fingerprint. First 8 chars of the full UUID for readability.</p>
                                    </div>
                                </div>
                                <div className="flex items-start space-x-3">
                                    <Shield size={12} className="text-gray-500 mt-0.5 flex-shrink-0" />
                                    <div>
                                        <span className="text-xs font-bold text-gray-300">Severity (Sev)</span>
                                        <p className="text-xs text-gray-500">High = destructive actions (delete/reject). Medium = state changes (verify/promote). Normal = reads and updates.</p>
                                    </div>
                                </div>
                                <div className="flex items-start space-x-3">
                                    <User size={12} className="text-gray-500 mt-0.5 flex-shrink-0" />
                                    <div>
                                        <span className="text-xs font-bold text-gray-300">Actor</span>
                                        <p className="text-xs text-gray-500">The user ID (truncated) of the person or system process that triggered this action. "System" = automated pipeline.</p>
                                    </div>
                                </div>
                                <div className="flex items-start space-x-3">
                                    <Info size={12} className="text-gray-500 mt-0.5 flex-shrink-0" />
                                    <div>
                                        <span className="text-xs font-bold text-gray-300">Record (Rec)</span>
                                        <p className="text-xs text-gray-500">The database row ID that was affected by this action.</p>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            )}

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
                ) : filteredLogs.length > 0 ? filteredLogs.map((log) => (
                    <AuditEvent key={`${log.id}-${log.created_at}`} event={log} />
                )) : (
                    <div className="text-center py-12 text-gray-500 text-sm">
                        No audit events match your search "{search}"
                    </div>
                )}
            </div>
        </div>
    );
};

export default SecurityAudit;

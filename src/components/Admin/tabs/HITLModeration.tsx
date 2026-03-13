import React, { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { supabase } from '@/integrations/supabase/client';
import {
    Search,
    Filter,
    Map as MapIcon,
    CheckCircle,
    XCircle,
    Shield,
    Database,
    Zap,
    AlertCircle,
    Info,
    ExternalLink,
    ChevronDown,
    ArrowRight
} from 'lucide-react';
import { toast } from 'sonner';

const HITLModeration = () => {
    const [queue, setQueue] = useState([]);
    const [loading, setLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState('');
    const [statusFilter, setStatusFilter] = useState('pending');
    const [selectedItem, setSelectedItem] = useState(null);
    const [isActionLoading, setIsActionLoading] = useState(null);

    const fetchQueue = useCallback(async () => {
        setLoading(true);
        try {
            // Join with iebc_offices to get office details
            const { data, error } = await (supabase as any)
                .from('geocode_hitl_queue')
                .select('*, iebc_offices(id, constituency_name, county, office_location, latitude, longitude)')
                .eq('status', statusFilter)
                .order('created_at', { ascending: false });

            if (error) throw error;
            setQueue(data || []);
        } catch (err) {
            toast.error('Failed to fetch HITL queue');
            console.error(err);
        } finally {
            setLoading(false);
        }
    }, [statusFilter]);

    useEffect(() => {
        fetchQueue();
    }, [fetchQueue]);

    const handleAction = async (id, action) => {
        setIsActionLoading(id);
        try {
            const item = queue.find(q => q.id === id);
            if (!item) throw new Error('Item not found');

            if (action === 'approve') {
                // 1. Update the office coordinates
                const { error: updateError } = await supabase
                    .from('iebc_offices')
                    .update({
                        latitude: item.proposed_latitude,
                        longitude: item.proposed_longitude,
                        geocode_verified: true,
                        geocode_status: 'human_verified',
                        updated_at: new Date().toISOString()
                    })
                    .eq('id', item.office_id);

                if (updateError) throw updateError;
            }

            // 2. Update status in the queue
            const { error: statusError } = await (supabase as any)
                .from('geocode_hitl_queue')
                .update({
                    status: action === 'approve' ? 'resolved' : 'dismissed',
                    updated_at: new Date().toISOString()
                })
                .eq('id', id);

            if (statusError) throw statusError;

            toast.success(`Proposed change ${action === 'approve' ? 'approved' : 'dismissed'}`);
            fetchQueue();
            setSelectedItem(null);
        } catch (err) {
            toast.error(`Action failed: ${err.message}`);
        } finally {
            setIsActionLoading(null);
        }
    };

    const filteredItems = queue.filter(item => {
        const office = item.iebc_offices;
        if (!office) return false;
        return (
            office.constituency_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
            office.county?.toLowerCase().includes(searchQuery.toLowerCase()) ||
            item.issue_type?.toLowerCase().includes(searchQuery.toLowerCase())
        );
    });

    return (
        <div className="space-y-6">
            {/* Header / Stats Panel */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="bg-blue-600/10 border border-blue-500/20 rounded-3xl p-6 flex items-center space-x-4">
                    <div className="p-3 bg-blue-500/20 rounded-2xl text-blue-400">
                        <Zap size={24} />
                    </div>
                    <div>
                        <p className="text-[10px] font-black uppercase text-blue-400/60 tracking-widest">Awaiting Review</p>
                        <p className="text-2xl font-black text-white">{queue.length}</p>
                    </div>
                </div>
                <div className="bg-white/[0.03] border border-white/10 rounded-3xl p-6 flex items-center space-x-4">
                    <div className="p-3 bg-white/5 rounded-2xl text-gray-400">
                        <Shield size={24} />
                    </div>
                    <div>
                        <p className="text-[10px] font-black uppercase text-gray-500 tracking-widest">Engine Pipeline</p>
                        <p className="text-2xl font-black text-white">Consensus v9.5</p>
                    </div>
                </div>
                <div className="bg-white/[0.03] border border-white/10 rounded-3xl p-6 flex items-center space-x-4">
                    <div className="p-3 bg-white/5 rounded-2xl text-gray-400">
                        <Database size={24} />
                    </div>
                    <div>
                        <p className="text-[10px] font-black uppercase text-gray-500 tracking-widest">Queue Status</p>
                        <p className="text-2xl font-black text-white">Active</p>
                    </div>
                </div>
            </div>

            {/* Controls Bar */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white/[0.02] border border-white/10 rounded-3xl p-4">
                <div className="relative flex-1 max-w-md">
                    <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500" size={18} />
                    <input
                        type="text"
                        placeholder="Search queue by constituency or county..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="w-full bg-white/5 border border-white/10 rounded-2xl py-3 pl-12 pr-4 text-sm text-white placeholder-gray-500 outline-none focus:ring-2 focus:ring-blue-500/50 transition-all"
                    />
                </div>

                <div className="flex items-center space-x-3">
                    <div className="flex items-center bg-white/5 border border-white/10 rounded-2xl p-1">
                        {['pending', 'resolved', 'dismissed'].map((status) => (
                            <button
                                key={status}
                                onClick={() => setStatusFilter(status)}
                                className={`px-4 py-2 rounded-xl text-xs font-bold uppercase tracking-wider transition-all ${statusFilter === status
                                    ? 'bg-blue-600 text-white shadow-lg shadow-blue-500/20'
                                    : 'text-gray-500 hover:text-gray-300'
                                    }`}
                            >
                                {status}
                            </button>
                        ))}
                    </div>
                </div>
            </div>

            {/* Main Grid */}
            <div className="grid grid-cols-1 xl:grid-cols-12 gap-8">
                {/* List Side */}
                <div className="xl:col-span-7 space-y-4 max-h-[calc(100vh-350px)] overflow-y-auto pr-2 custom-scrollbar">
                    {loading ? (
                        Array(5).fill(0).map((_, i) => (
                            <div key={i} className="h-24 bg-white/5 rounded-3xl animate-pulse border border-white/5" />
                        ))
                    ) : filteredItems.length > 0 ? (
                        filteredItems.map((item) => (
                            <motion.div
                                layout
                                key={item.id}
                                onClick={() => setSelectedItem(item)}
                                className={`p-5 rounded-3xl border transition-all cursor-pointer group ${selectedItem?.id === item.id
                                    ? 'bg-blue-600/10 border-blue-500/40 shadow-2xl'
                                    : 'bg-white/[0.03] border-white/10 hover:border-white/20'
                                    }`}
                            >
                                <div className="flex justify-between items-start">
                                    <div className="space-y-1">
                                        <div className="flex items-center space-x-3">
                                            <h4 className="text-lg font-bold text-white group-hover:text-blue-400 transition-colors">
                                                {item.iebc_offices?.constituency_name || 'Office ID: ' + item.office_id}
                                            </h4>
                                            <span className={`px-2 py-0.5 rounded-lg text-[10px] font-black uppercase tracking-widest ${item.confidence >= 0.7 ? 'bg-emerald-500/20 text-emerald-400' :
                                                    item.confidence >= 0.4 ? 'bg-amber-500/20 text-amber-400' :
                                                        'bg-red-500/20 text-red-400'
                                                }`}>
                                                {Math.round(item.confidence * 100)}% Match
                                            </span>
                                        </div>
                                        <p className="text-xs text-gray-500">
                                            {item.iebc_offices?.county} • Issue: <span className="text-blue-400/60 uppercase font-black">{item.issue_type?.replace(/_/g, ' ')}</span>
                                        </p>
                                    </div>

                                    <div className="text-right">
                                        <div className="text-[10px] font-mono text-gray-600 mb-1">PROPOSED DIFF</div>
                                        <div className="flex items-center space-x-2 text-xs font-bold text-blue-400">
                                            <MapIcon size={12} />
                                            <span>{item.proposed_latitude?.toFixed(4)}, {item.proposed_longitude?.toFixed(4)}</span>
                                        </div>
                                    </div>
                                </div>
                            </motion.div>
                        ))
                    ) : (
                        <div className="text-center py-20 bg-white/[0.02] border border-dashed border-white/10 rounded-[2.5rem]">
                            <Info className="mx-auto text-gray-600 mb-4" size={48} />
                            <h3 className="text-xl font-bold text-gray-400">HITL Queue Clear</h3>
                            <p className="text-sm text-gray-500">No proposed geocoding overrides require attention.</p>
                        </div>
                    )}
                </div>

                {/* Detail Side */}
                <div className="xl:col-span-5">
                    <AnimatePresence mode="wait">
                        {selectedItem ? (
                            <motion.div
                                key={selectedItem.id}
                                initial={{ opacity: 0, x: 20 }}
                                animate={{ opacity: 1, x: 0 }}
                                exit={{ opacity: 0, x: 20 }}
                                className="bg-white/[0.04] border border-white/10 rounded-[2.5rem] p-8 space-y-6 sticky top-0"
                            >
                                <div className="border-b border-white/5 pb-6">
                                    <h3 className="text-xl font-bold text-white">Consensus Analysis</h3>
                                    <p className="text-xs text-gray-500 mt-1">Multi-source automated resolution report</p>
                                </div>

                                <div className="space-y-6">
                                    {/* Comparison View */}
                                    <div className="grid grid-cols-2 gap-4">
                                        <div className="bg-white/5 rounded-2xl p-4 border border-white/5 space-y-2">
                                            <p className="text-[10px] font-black uppercase text-gray-500 tracking-widest">Current State</p>
                                            <div className="text-xs space-y-1">
                                                <p className="text-white font-mono">{selectedItem.iebc_offices?.latitude?.toFixed(6) || 'N/A'}</p>
                                                <p className="text-white font-mono">{selectedItem.iebc_offices?.longitude?.toFixed(6) || 'N/A'}</p>
                                            </div>
                                            <div className="pt-2">
                                                <span className="bg-white/10 text-[9px] px-2 py-0.5 rounded uppercase font-black text-gray-400 tracking-tighter">Production</span>
                                            </div>
                                        </div>
                                        <div className="bg-blue-600/10 rounded-2xl p-4 border border-blue-500/20 space-y-2 relative overflow-hidden">
                                            <Zap className="absolute -right-2 -top-2 opacity-10 text-blue-400" size={64} />
                                            <p className="text-[10px] font-black uppercase text-blue-400 tracking-widest">Proposed Fix</p>
                                            <div className="text-xs space-y-1">
                                                <p className="text-white font-mono">{selectedItem.proposed_latitude?.toFixed(6)}</p>
                                                <p className="text-white font-mono">{selectedItem.proposed_longitude?.toFixed(6)}</p>
                                            </div>
                                            <div className="pt-2">
                                                <span className="bg-blue-600 text-[9px] px-2 py-0.5 rounded uppercase font-black text-white tracking-tighter">AI Consensus</span>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Source Details */}
                                    <div className="space-y-3">
                                        <p className="text-[10px] font-black uppercase text-gray-500 tracking-widest flex items-center space-x-2">
                                            <Shield size={12} />
                                            <span>Validation Sources ({selectedItem.agreement_count} Agree)</span>
                                        </p>
                                        <div className="space-y-2">
                                            {selectedItem.source_details?.map((s, idx) => (
                                                <div key={idx} className="flex items-center justify-between p-3 bg-white/5 rounded-xl text-[11px] border border-white/5">
                                                    <span className="text-gray-300 font-bold uppercase tracking-tight">{s.source}</span>
                                                    <div className="flex items-center space-x-3">
                                                        <span className="text-gray-500 font-mono">({s.lat.toFixed(4)}, {s.lng.toFixed(4)})</span>
                                                        <CheckCircle size={14} className="text-emerald-500" />
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    </div>

                                    {/* Spread Intel */}
                                    <div className="p-4 bg-amber-500/5 border border-amber-500/10 rounded-2xl flex items-start space-x-3">
                                        <AlertCircle size={18} className="text-amber-400 mt-0.5" />
                                        <div>
                                            <p className="text-xs font-bold text-amber-300">Clustering Warning</p>
                                            <p className="text-[10px] text-amber-400/60 leading-relaxed uppercase font-black">
                                                Consensus spread is {selectedItem.spread_km?.toFixed(2)}km. Recommend manual street-view validation before commitment.
                                            </p>
                                        </div>
                                    </div>
                                </div>

                                <div className="flex gap-3 pt-6 border-t border-white/5">
                                    <button
                                        onClick={() => handleAction(selectedItem.id, 'approve')}
                                        disabled={selectedItem.status !== 'pending' || isActionLoading === selectedItem.id}
                                        className="flex-1 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white font-bold py-3 rounded-2xl transition-all shadow-lg shadow-blue-500/20 flex items-center justify-center space-x-2"
                                    >
                                        {isActionLoading === selectedItem.id ? <div className="w-5 h-5 border-2 border-white/20 border-t-white rounded-full animate-spin" /> : <><CheckCircle size={18} /><span>Commit Fix</span></>}
                                    </button>
                                    <button
                                        onClick={() => handleAction(selectedItem.id, 'dismiss')}
                                        disabled={selectedItem.status !== 'pending' || isActionLoading === selectedItem.id}
                                        className="p-3 bg-red-600/20 text-red-400 border border-red-500/20 rounded-2xl hover:bg-red-600/30 transition-all flex items-center justify-center"
                                    >
                                        <XCircle size={18} />
                                    </button>
                                </div>

                                <a
                                    href={`https://www.google.com/maps/search/?api=1&query=${selectedItem.proposed_latitude},${selectedItem.proposed_longitude}`}
                                    target="_blank"
                                    rel="noreferrer"
                                    className="flex items-center justify-center space-x-2 text-xs text-gray-500 hover:text-blue-400 transition-colors pt-2"
                                >
                                    <span>Inspect coordinates on Map</span>
                                    <ExternalLink size={12} />
                                </a>
                            </motion.div>
                        ) : (
                            <div className="h-full flex flex-col items-center justify-center bg-white/[0.02] border border-dashed border-white/10 rounded-[2.5rem] p-8 text-center min-h-[400px]">
                                <div className="w-16 h-16 bg-white/5 rounded-3xl flex items-center justify-center mb-4">
                                    <Shield className="text-gray-600" size={32} />
                                </div>
                                <h4 className="text-lg font-bold text-gray-400">Select Issue</h4>
                                <p className="text-sm text-gray-500 max-w-xs">Review low-confidence bot resolutions to maintain IEBC registry integrity.</p>
                            </div>
                        )}
                    </AnimatePresence>
                </div>
            </div>
        </div>
    );
};

export default HITLModeration;

import React, { useState, useEffect, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';
import {
    Search,
    Download,
    Edit3,
    Trash2,
    MapPin,
    ChevronLeft,
    ChevronRight,
    Filter,
    ArrowUpDown
} from 'lucide-react';
import { toast } from 'sonner';

const DataRegistry = () => {
    const [offices, setOffices] = useState([]);
    const [loading, setLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState('');
    const [page, setPage] = useState(0);
    const [pageSize] = useState(25);
    const [totalCount, setTotalCount] = useState(0);
    const [sortConfig, setSortConfig] = useState({ key: 'constituency', direction: 'asc' });

    const fetchOffices = async () => {
        setLoading(true);
        try {
            let query = supabase
                .from('iebc_offices')
                .select('*', { count: 'exact' });

            if (searchQuery) {
                query = query.or(`office_location.ilike.%${searchQuery}%,constituency.ilike.%${searchQuery}%,county.ilike.%${searchQuery}%`);
            }

            query = query
                .order(sortConfig.key, { ascending: sortConfig.direction === 'asc' })
                .range(page * pageSize, (page + 1) * pageSize - 1);

            const { data, error, count } = await query;
            if (error) throw error;

            setOffices(data || []);
            setTotalCount(count || 0);
        } catch (err) {
            toast.error('Failed to fetch registry');
            console.error(err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        const timer = setTimeout(() => {
            fetchOffices();
        }, 500); // Debounce search
        return () => clearTimeout(timer);
    }, [searchQuery, page, sortConfig]);

    const toggleSort = (key) => {
        setSortConfig(prev => ({
            key,
            direction: prev.key === key && prev.direction === 'asc' ? 'desc' : 'asc'
        }));
    };

    const exportCSV = () => {
        const headers = ['ID', 'County', 'Constituency', 'Location', 'Latitude', 'Longitude', 'Verified'];
        const rows = offices.map(o => [o.id, o.county, o.constituency, o.office_location, o.latitude, o.longitude, o.verified]);
        const csvContent = "data:text/csv;charset=utf-8," + headers.join(",") + "\n" + rows.map(r => r.join(",")).join("\n");
        const encodedUri = encodeURI(csvContent);
        const link = document.createElement("a");
        link.setAttribute("href", encodedUri);
        link.setAttribute("download", "iebc_registry_export.csv");
        document.body.appendChild(link);
        link.click();
        toast.success('Registry export generated');
    };

    return (
        <div className="space-y-6">
            {/* Header Controls */}
            <div className="flex flex-col md:flex-row justify-between items-center gap-4">
                <div className="relative flex-1 max-w-xl">
                    <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500" size={18} />
                    <input
                        type="text"
                        placeholder="Global search across 290+ offices..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="w-full bg-white/5 border border-white/10 rounded-2xl py-3 pl-12 pr-4 text-sm text-white placeholder-gray-500 outline-none focus:ring-2 focus:ring-blue-500/50 transition-all"
                    />
                </div>

                <div className="flex items-center space-x-3 w-full md:w-auto">
                    <button onClick={exportCSV} className="flex-1 md:flex-none flex items-center justify-center space-x-2 px-6 py-3 bg-white/5 border border-white/10 rounded-2xl text-sm font-bold text-gray-300 hover:text-white hover:bg-white/10 transition-all">
                        <Download size={18} />
                        <span>Export CSV</span>
                    </button>
                    <button className="p-3 bg-blue-600 text-white rounded-2xl shadow-lg shadow-blue-500/20 hover:scale-105 transition-all">
                        <Filter size={18} />
                    </button>
                </div>
            </div>

            {/* Table Container - X/Y Scrollable */}
            <div className="bg-white/[0.02] border border-white/10 rounded-[2.5rem] overflow-hidden shadow-2xl relative">
                <div className="overflow-x-auto custom-scrollbar">
                    <table className="w-full text-left border-collapse">
                        <thead>
                            <tr className="bg-white/[0.03] border-b border-white/5 text-[10px] uppercase tracking-widest text-gray-500 font-black">
                                <th className="px-8 py-5">
                                    Status
                                </th>
                                <th
                                    className="px-6 py-5 cursor-pointer hover:text-blue-400 transition-colors"
                                    onClick={() => toggleSort('county')}
                                >
                                    <div className="flex items-center space-x-2"><span>County</span> <ArrowUpDown size={12} /></div>
                                </th>
                                <th
                                    className="px-6 py-5 cursor-pointer hover:text-blue-400 transition-colors"
                                    onClick={() => toggleSort('constituency')}
                                >
                                    <div className="flex items-center space-x-2"><span>Constituency</span> <ArrowUpDown size={12} /></div>
                                </th>
                                <th className="px-6 py-5">Office Location</th>
                                <th className="px-6 py-5">Coordinates</th>
                                <th className="px-6 py-5 text-right">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-white/5">
                            {loading ? (
                                Array(10).fill(0).map((_, i) => (
                                    <tr key={i} className="animate-pulse">
                                        <td colSpan={6} className="px-8 py-6 h-12 bg-white/5" />
                                    </tr>
                                ))
                            ) : offices.map((off) => (
                                <tr key={off.id} className="hover:bg-white/[0.02] transition-colors group">
                                    <td className="px-8 py-5">
                                        <div className={`w-2.5 h-2.5 rounded-full ${off.verified ? 'bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]' : 'bg-amber-500 shadow-[0_0_8px_rgba(245,158,11,0.5)]'}`} />
                                    </td>
                                    <td className="px-6 py-5 text-sm font-medium text-white">{off.county}</td>
                                    <td className="px-6 py-5 text-sm font-medium text-white">{off.constituency}</td>
                                    <td className="px-6 py-5 text-sm text-gray-400 max-w-xs truncate">{off.office_location}</td>
                                    <td className="px-6 py-5 text-xs font-mono text-gray-500">
                                        <div className="flex items-center space-x-2">
                                            <MapPin size={12} />
                                            <span>{off.latitude?.toFixed(4)}, {off.longitude?.toFixed(4)}</span>
                                        </div>
                                    </td>
                                    <td className="px-6 py-5 text-right">
                                        <div className="flex items-center justify-end space-x-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                            <button className="p-2 text-gray-400 hover:text-blue-400 transition-colors"><Edit3 size={16} /></button>
                                            <button className="p-2 text-gray-400 hover:text-red-400 transition-colors"><Trash2 size={16} /></button>
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>

                {/* Pagination */}
                <div className="p-6 bg-white/[0.03] border-t border-white/5 flex items-center justify-between">
                    <p className="text-xs text-gray-500 font-medium">
                        Showing <span className="text-white">{page * pageSize + 1}</span> to <span className="text-white">{Math.min((page + 1) * pageSize, totalCount)}</span> of <span className="text-white">{totalCount}</span> entries
                    </p>
                    <div className="flex items-center space-x-2">
                        <button
                            disabled={page === 0}
                            onClick={() => setPage(page - 1)}
                            className="p-2 bg-white/5 border border-white/10 rounded-xl text-gray-400 hover:text-white disabled:opacity-30 transition-all"
                        >
                            <ChevronLeft size={20} />
                        </button>
                        <div className="flex items-center px-4 space-x-1">
                            <span className="text-sm font-bold text-white">{page + 1}</span>
                            <span className="text-sm text-gray-600">/</span>
                            <span className="text-sm text-gray-600">{Math.ceil(totalCount / pageSize)}</span>
                        </div>
                        <button
                            disabled={(page + 1) * pageSize >= totalCount}
                            onClick={() => setPage(page + 1)}
                            className="p-2 bg-white/5 border border-white/10 rounded-xl text-gray-400 hover:text-white disabled:opacity-30 transition-all"
                        >
                            <ChevronRight size={20} />
                        </button>
                    </div>
                </div>
            </div>

            {/* Footer Note */}
            <div className="p-6 bg-blue-500/5 border border-blue-500/10 rounded-[2rem] flex items-start space-x-4">
                <div className="p-2 bg-blue-500/20 rounded-lg text-blue-400">
                    <MapPin size={20} />
                </div>
                <div className="space-y-1">
                    <h5 className="text-sm font-bold text-blue-300 tracking-tight">Data Integrity System</h5>
                    <p className="text-xs text-blue-400/60 leading-relaxed">
                        The IEBC Registry is the immutable backbone of Nasaka. All edits made here are logged in the
                        security audit trail. Ensure full coordinate verification before committing manual overrides.
                    </p>
                </div>
            </div>
        </div>
    );
};

export default DataRegistry;

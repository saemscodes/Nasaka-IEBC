import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { supabase } from '@/integrations/supabase/client';
import {
    Users,
    MapPin,
    CheckCircle,
    AlertTriangle,
    Activity,
    ArrowUpRight,
    TrendingUp,
    Clock,
    ShieldCheck
} from 'lucide-react';
import {
    AreaChart,
    Area,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    ResponsiveContainer
} from 'recharts';

const StatCard = ({ title, value, change = null, icon: Icon, color }) => (
    <motion.div
        whileHover={{ y: -4 }}
        className="bg-white/[0.03] backdrop-blur-md border border-white/10 rounded-3xl p-6 shadow-2xl relative overflow-hidden group"
    >
        <div className={`absolute top-0 right-0 w-32 h-32 bg-${color}-500/10 blur-[60px] rounded-full -mr-16 -mt-16 group-hover:bg-${color}-500/20 transition-all duration-500`} />

        <div className="flex justify-between items-start mb-4 relative z-10">
            <div className={`p-3 rounded-2xl bg-${color}-500/10 border border-${color}-500/20`}>
                <Icon className={`text-${color}-400`} size={24} />
            </div>
            {change && (
                <div className="flex items-center space-x-1 text-emerald-400 bg-emerald-400/10 px-2 py-1 rounded-lg text-xs font-bold ring-1 ring-emerald-400/20">
                    <TrendingUp size={12} />
                    <span>{change}</span>
                </div>
            )}
        </div>

        <div className="relative z-10">
            <h3 className="text-gray-400 text-sm font-medium mb-1">{title}</h3>
            <p className="text-3xl font-bold text-white tracking-tight">{value}</p>
        </div>
    </motion.div>
);

const InsightsOverview = ({ onTabChange }: { onTabChange?: (tab: string) => void }) => {
    const [stats, setStats] = useState({
        totalOffices: 0,
        pendingContributions: 0,
        verifiedOffices: 0,
        activeUsers: 0,
    });
    const [loading, setLoading] = useState(true);
    const [chartData, setChartData] = useState([]);
    const [timeRange, setTimeRange] = useState('7');
    const [urgentClusters, setUrgentClusters] = useState(0);
    const [pendingHitl, setPendingHitl] = useState(0);

    useEffect(() => {
        const fetchGlobalStats = async () => {
            try {
                const [officesResp, contributionsResp, contributorsResp] = await Promise.all([
                    supabase.from('iebc_offices').select('id, verified', { count: 'exact' }),
                    supabase.from('iebc_office_contributions').select('id', { count: 'exact' }).eq('status', 'pending_review'),
                    supabase.from('iebc_office_contributions').select('user_id')
                ]);

                const uniqueContributors = new Set(
                    (contributorsResp.data || [])
                        .map((c: any) => c.user_id)
                        .filter(Boolean)
                ).size;

                setStats({
                    totalOffices: officesResp.count || 0,
                    verifiedOffices: (officesResp.data as any[])?.filter(o => o.verified).length || 0,
                    pendingContributions: contributionsResp.count || 0,
                    activeUsers: uniqueContributors
                });
            } catch (err) {
                console.error('Error fetching global stats:', err);
            } finally {
                setLoading(false);
            }
        };

        fetchGlobalStats();
    }, []);

    useEffect(() => {
        const fetchChartData = async () => {
            const days = parseInt(timeRange);
            const since = new Date();
            since.setDate(since.getDate() - days);

            const { data, error } = await supabase
                .from('iebc_office_contributions')
                .select('created_at')
                .gte('created_at', since.toISOString())
                .order('created_at', { ascending: true });

            if (error || !data) {
                setChartData([]);
                return;
            }

            const buckets: Record<string, number> = {};
            for (let i = 0; i < days; i++) {
                const d = new Date();
                d.setDate(d.getDate() - (days - 1 - i));
                const key = d.toISOString().split('T')[0];
                buckets[key] = 0;
            }

            data.forEach(row => {
                const key = row.created_at.split('T')[0];
                if (buckets[key] !== undefined) {
                    buckets[key]++;
                }
            });

            const formatted = Object.entries(buckets).map(([date, count]) => {
                const d = new Date(date);
                return {
                    name: days <= 7
                        ? d.toLocaleDateString('en-US', { weekday: 'short' })
                        : d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
                    count
                };
            });

            setChartData(formatted);
        };

        fetchChartData();
    }, [timeRange]);

    useEffect(() => {
        const fetchUrgentData = async () => {
            const { data: offices } = await supabase
                .from('iebc_offices')
                .select('id, latitude, longitude')
                .not('latitude', 'is', null);

            if (offices && offices.length > 0) {
                let clusterCount = 0;
                for (let i = 0; i < offices.length; i++) {
                    for (let j = i + 1; j < offices.length; j++) {
                        const dLat = Math.abs(offices[i].latitude - offices[j].latitude);
                        const dLng = Math.abs(offices[i].longitude - offices[j].longitude);
                        if (dLat < 0.005 && dLng < 0.005) {
                            clusterCount++;
                        }
                    }
                }
                setUrgentClusters(clusterCount);
            }

            const { count } = await (supabase as any)
                .from('geocode_hitl_queue')
                .select('id', { count: 'exact', head: true })
                .eq('status', 'pending');
            setPendingHitl(count || 0);
        };

        fetchUrgentData();
    }, []);

    if (loading) return null;

    return (
        <div className="space-y-8">
            {/* Stats Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                <StatCard
                    title="Total Registered Offices"
                    value={stats.totalOffices}
                    icon={MapPin}
                    color="blue"
                />
                <StatCard
                    title="Pending Moderation"
                    value={stats.pendingContributions}
                    icon={Activity}
                    color="amber"
                />
                <StatCard
                    title="Verified Accuracy"
                    value={stats.totalOffices > 0 ? `${Math.round((stats.verifiedOffices / stats.totalOffices) * 100)}%` : '0%'}
                    icon={CheckCircle}
                    color="emerald"
                />
                <StatCard
                    title="Citizen Contributors"
                    value={stats.activeUsers}
                    icon={Users}
                    color="indigo"
                />
            </div>

            {/* Main Insights Area */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                {/* Activity Chart */}
                <div className="lg:col-span-2 bg-white/[0.02] border border-white/10 rounded-[2.5rem] p-8">
                    <div className="flex justify-between items-center mb-8">
                        <div>
                            <h3 className="text-xl font-bold text-white">Contribution Velocity</h3>
                            <p className="text-sm text-gray-400">
                                {timeRange === '7' ? 'Last 7 days' : 'Last 30 days'} submission trends
                            </p>
                        </div>
                        <select
                            value={timeRange}
                            onChange={(e) => setTimeRange(e.target.value)}
                            className="bg-white/5 border border-white/10 rounded-xl px-4 py-2 text-sm text-gray-300 outline-none focus:ring-2 focus:ring-blue-500/50 transition-all"
                        >
                            <option value="7">Last 7 Days</option>
                            <option value="30">Last 30 Days</option>
                        </select>
                    </div>

                    <div className="h-[300px] w-full">
                        <ResponsiveContainer width="100%" height="100%">
                            <AreaChart data={chartData}>
                                <defs>
                                    <linearGradient id="colorCount" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3} />
                                        <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                                    </linearGradient>
                                </defs>
                                <CartesianGrid strokeDasharray="3 3" stroke="#ffffff05" vertical={false} />
                                <XAxis
                                    dataKey="name"
                                    axisLine={false}
                                    tickLine={false}
                                    tick={{ fill: '#6b7280', fontSize: 12 }}
                                    dy={10}
                                />
                                <Tooltip
                                    contentStyle={{
                                        backgroundColor: '#0f172a',
                                        border: '1px solid rgba(255,255,255,0.1)',
                                        borderRadius: '16px',
                                        boxShadow: '0 10px 30px rgba(0,0,0,0.5)'
                                    }}
                                    itemStyle={{ color: '#fff' }}
                                />
                                <Area
                                    type="monotone"
                                    dataKey="count"
                                    stroke="#3b82f6"
                                    strokeWidth={3}
                                    fillOpacity={1}
                                    fill="url(#colorCount)"
                                />
                            </AreaChart>
                        </ResponsiveContainer>
                    </div>
                </div>

                {/* System Health / Alerts */}
                <div className="space-y-6">
                    <div className="bg-[#007AFF]/20 border border-[#007AFF]/20 rounded-[2.5rem] p-8 relative overflow-hidden">
                        <div className="absolute top-0 right-0 p-6 opacity-10">
                            <ShieldCheck size={120} />
                        </div>

                        <h3 className="text-xl font-bold text-white mb-2 relative z-10">System Status</h3>
                        <div className="flex items-center space-x-2 text-blue-400 mb-6 relative z-10">
                            <div className="w-2 h-2 bg-blue-400 rounded-full animate-ping" />
                            <span className="text-xs font-black uppercase tracking-widest">All Nodes Healthy</span>
                        </div>

                        <div className="space-y-4 relative z-10">
                            <div className="flex items-center justify-between text-sm">
                                <span className="text-gray-400">Database Engine</span>
                                <span className="text-emerald-400 font-bold">Stable</span>
                            </div>
                            <div className="flex items-center justify-between text-sm">
                                <span className="text-gray-400">Map Proxy API</span>
                                <span className="text-emerald-400 font-bold">99.9%</span>
                            </div>
                            <div className="flex items-center justify-between text-sm">
                                <span className="text-gray-400">HITL Runner</span>
                                <span className="text-blue-400 font-bold">{pendingHitl > 0 ? `${pendingHitl} pending` : 'Idle'}</span>
                            </div>
                        </div>
                    </div>

                    <div className="bg-white/[0.02] border border-white/10 rounded-[2.5rem] p-6">
                        <h4 className="text-sm font-bold text-gray-400 uppercase tracking-widest mb-4">Urgent Actions</h4>
                        <div className="space-y-3">
                            <button
                                onClick={() => {
                                    if (onTabChange) onTabChange('hitl');
                                }}
                                className="w-full flex items-center justify-between p-4 bg-amber-500/10 border border-amber-500/20 rounded-2xl group hover:bg-amber-500/20 transition-all"
                            >
                                <div className="flex items-center space-x-3 text-amber-400">
                                    <AlertTriangle size={18} />
                                    <span className="text-sm font-medium">{urgentClusters} clustered offices detected</span>
                                </div>
                                <ArrowUpRight size={16} className="text-amber-500 opacity-0 group-hover:opacity-100 transition-all" />
                            </button>
                            <button
                                onClick={() => {
                                    if (onTabChange) onTabChange('automation');
                                }}
                                className="w-full flex items-center justify-between p-4 bg-blue-500/10 border border-blue-500/20 rounded-2xl group hover:bg-blue-500/20 transition-all"
                            >
                                <div className="flex items-center space-x-3 text-blue-400">
                                    <Clock size={18} />
                                    <span className="text-sm font-medium">{pendingHitl > 0 ? `${pendingHitl} HITL entries pending` : 'Daily verification due'}</span>
                                </div>
                                <ArrowUpRight size={16} className="text-blue-500 opacity-0 group-hover:opacity-100 transition-all" />
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default InsightsOverview;

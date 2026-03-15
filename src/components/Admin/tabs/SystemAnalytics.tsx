import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { supabase } from '@/integrations/supabase/client';
import {
    BarChart3,
    Map,
    Globe,
    Zap,
    ArrowUpRight,
    Monitor,
    Smartphone
} from 'lucide-react';
import {
    BarChart,
    Bar,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    ResponsiveContainer,
    PieChart,
    Pie,
    Cell
} from 'recharts';

const AnalyticsCard = ({ title, children, className = "" }) => (
    <div className={`bg-white/[0.03] border border-white/10 rounded-[2.5rem] p-8 ${className}`}>
        <h3 className="text-lg font-bold text-white mb-6">{title}</h3>
        {children}
    </div>
);

const SystemAnalytics = () => {
    const [countyData, setCountyData] = useState([]);
    const [deviceData, setDeviceData] = useState([]);
    const [infraStats, setInfraStats] = useState({ dbLatency: 0, totalContribs: 0, lastSync: '' });
    const [loading, setLoading] = useState(true);

    const COLORS = ['#3b82f6', '#818cf8', '#c084fc', '#f472b6', '#fb923c'];

    useEffect(() => {
        const fetchAnalytics = async () => {
            try {
                // County contribution data
                const { data: contribs } = await supabase
                    .from('iebc_office_contributions')
                    .select('submitted_county, device_metadata');

                if (contribs && contribs.length > 0) {
                    // Aggregate by county
                    const countyMap: Record<string, number> = {};
                    const platformMap: Record<string, number> = {};

                    contribs.forEach((c) => {
                        const county = c.submitted_county || 'Unknown';
                        countyMap[county] = (countyMap[county] || 0) + 1;

                        // Device data
                        let dm: any = c.device_metadata;
                        if (typeof dm === 'string') {
                            try { dm = JSON.parse(dm); } catch { dm = null; }
                        }
                        if (dm && typeof dm === 'object') {
                            const platform = dm.platform || 'Unknown';
                            const simplified = platform.toLowerCase().includes('android') || platform.toLowerCase().includes('iphone') || platform.toLowerCase().includes('mobile')
                                ? 'Mobile'
                                : platform.toLowerCase().includes('win') || platform.toLowerCase().includes('mac') || platform.toLowerCase().includes('linux')
                                    ? 'Desktop'
                                    : platform.toLowerCase().includes('ipad') || platform.toLowerCase().includes('tablet')
                                        ? 'Tablet'
                                        : 'Other';
                            platformMap[simplified] = (platformMap[simplified] || 0) + 1;
                        } else {
                            platformMap['Unknown'] = (platformMap['Unknown'] || 0) + 1;
                        }
                    });

                    // Top 5 counties
                    const sorted = Object.entries(countyMap)
                        .sort((a, b) => b[1] - a[1])
                        .slice(0, 5)
                        .map(([name, count]) => ({ name, count }));
                    setCountyData(sorted);

                    // Device breakdown as percentages
                    const total = Object.values(platformMap).reduce((s, v) => s + v, 0);
                    const devices = Object.entries(platformMap)
                        .filter(([_, v]) => v > 0)
                        .map(([name, value]) => ({
                            name,
                            value: total > 0 ? Math.round((value / total) * 100) : 0
                        }))
                        .sort((a, b) => b.value - a.value);
                    setDeviceData(devices);
                }

                // Infrastructure stats: measure DB latency
                const t0 = Date.now();
                const { count } = await supabase
                    .from('iebc_office_contributions')
                    .select('id', { count: 'exact', head: true });
                const latency = Date.now() - t0;

                setInfraStats({
                    dbLatency: latency,
                    totalContribs: count || 0,
                    lastSync: new Date().toISOString()
                });
            } catch (err) {
                console.error('Analytics fetch error:', err);
            } finally {
                setLoading(false);
            }
        };

        fetchAnalytics();
    }, []);

    if (loading) {
        return (
            <div className="space-y-8">
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                    <div className="h-[400px] bg-white/5 rounded-[2.5rem] animate-pulse" />
                    <div className="h-[400px] bg-white/5 rounded-[2.5rem] animate-pulse" />
                </div>
            </div>
        );
    }

    const dbLatencyPct = Math.min(infraStats.dbLatency / 500 * 100, 100);
    const dbLatencyColor = infraStats.dbLatency < 100 ? 'emerald' : infraStats.dbLatency < 300 ? 'amber' : 'red';

    return (
        <div className="space-y-8">
            {/* Top row: Traffic by County & Device Mix */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                <AnalyticsCard title="Top Contribution Hubs (Counties)">
                    <div className="h-[300px]">
                        {countyData.length > 0 ? (
                            <ResponsiveContainer width="100%" height="100%">
                                <BarChart data={countyData}>
                                    <CartesianGrid strokeDasharray="3 3" stroke="#ffffff05" vertical={false} />
                                    <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: '#6b7280', fontSize: 12 }} />
                                    <YAxis axisLine={false} tickLine={false} tick={{ fill: '#6b7280', fontSize: 12 }} />
                                    <Tooltip
                                        cursor={{ fill: 'rgba(255,255,255,0.05)' }}
                                        contentStyle={{ backgroundColor: '#0f172a', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '12px' }}
                                    />
                                    <Bar dataKey="count" fill="#3b82f6" radius={[6, 6, 0, 0]} />
                                </BarChart>
                            </ResponsiveContainer>
                        ) : (
                            <div className="flex items-center justify-center h-full text-gray-500 text-sm">No contribution data yet — keep using the platform</div>
                        )}
                    </div>
                </AnalyticsCard>

                <AnalyticsCard title="Access Distribution">
                    <div className="flex flex-col md:flex-row items-center justify-between gap-8 h-[300px]">
                        <div className="w-full h-full md:w-1/2">
                            {deviceData.length > 0 ? (
                                <ResponsiveContainer width="100%" height="100%">
                                    <PieChart>
                                        <Pie
                                            data={deviceData}
                                            cx="50%"
                                            cy="50%"
                                            innerRadius={60}
                                            outerRadius={100}
                                            paddingAngle={5}
                                            dataKey="value"
                                        >
                                            {deviceData.map((entry, index) => (
                                                <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                                            ))}
                                        </Pie>
                                        <Tooltip />
                                    </PieChart>
                                </ResponsiveContainer>
                            ) : (
                                <div className="flex items-center justify-center h-full text-gray-500 text-sm">No device data yet</div>
                            )}
                        </div>

                        <div className="w-full md:w-1/2 space-y-4">
                            {deviceData.map((item, i) => (
                                <div key={item.name} className="flex items-center justify-between p-4 bg-white/5 rounded-2xl border border-white/5">
                                    <div className="flex items-center space-x-3">
                                        <div className="w-3 h-3 rounded-full" style={{ backgroundColor: COLORS[i % COLORS.length] }} />
                                        <span className="text-sm font-medium text-gray-300">{item.name}</span>
                                    </div>
                                    <span className="text-lg font-bold text-white">{item.value}%</span>
                                </div>
                            ))}
                        </div>
                    </div>
                </AnalyticsCard>
            </div>

            {/* Real-time Load */}
            <AnalyticsCard title="Live Infrastructure Health">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                    <div className="space-y-4">
                        <div className="flex items-center justify-between">
                            <div className="flex items-center space-x-2 text-gray-400">
                                <Monitor size={16} />
                                <span className="text-xs font-bold uppercase tracking-widest">DB Response</span>
                            </div>
                            <span className={`text-sm font-bold text-${dbLatencyColor}-400`}>{infraStats.dbLatency}ms</span>
                        </div>
                        <div className="w-full h-2 bg-white/5 rounded-full overflow-hidden">
                            <motion.div initial={{ width: 0 }} animate={{ width: `${dbLatencyPct}%` }} className={`h-full bg-${dbLatencyColor}-500`} />
                        </div>
                    </div>

                    <div className="space-y-4">
                        <div className="flex items-center justify-between">
                            <div className="flex items-center space-x-2 text-gray-400">
                                <Zap size={16} />
                                <span className="text-xs font-bold uppercase tracking-widest">Total Contributions</span>
                            </div>
                            <span className="text-sm font-bold text-blue-400">{infraStats.totalContribs}</span>
                        </div>
                        <div className="w-full h-2 bg-white/5 rounded-full overflow-hidden">
                            <motion.div initial={{ width: 0 }} animate={{ width: `${Math.min((infraStats.totalContribs / 500) * 100, 100)}%` }} className="h-full bg-blue-500" />
                        </div>
                    </div>

                    <div className="space-y-4">
                        <div className="flex items-center justify-between">
                            <div className="flex items-center space-x-2 text-gray-400">
                                <Globe size={16} />
                                <span className="text-xs font-bold uppercase tracking-widest">Last Sync</span>
                            </div>
                            <span className="text-sm font-bold text-indigo-400">{new Date(infraStats.lastSync).toLocaleTimeString()}</span>
                        </div>
                        <div className="w-full h-2 bg-white/5 rounded-full overflow-hidden">
                            <motion.div initial={{ width: 0 }} animate={{ width: '100%' }} className="h-full bg-indigo-500" />
                        </div>
                    </div>
                </div>
            </AnalyticsCard>
        </div>
    );
};

export default SystemAnalytics;

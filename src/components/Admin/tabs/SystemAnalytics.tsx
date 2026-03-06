import React from 'react';
import { motion } from 'framer-motion';
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
    const countyData = [
        { name: 'Nairobi', count: 124 },
        { name: 'Mombasa', count: 82 },
        { name: 'Kiambu', count: 65 },
        { name: 'Nakuru', count: 48 },
        { name: 'Kisumu', count: 42 },
    ];

    const deviceData = [
        { name: 'Mobile', value: 65 },
        { name: 'Desktop', value: 30 },
        { name: 'Tablet', value: 5 },
    ];

    const COLORS = ['#3b82f6', '#818cf8', '#c084fc'];

    return (
        <div className="space-y-8">
            {/* Top row: Traffic by County & Device Mix */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                <AnalyticsCard title="Top Contribution Hubs (Counties)">
                    <div className="h-[300px]">
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
                    </div>
                </AnalyticsCard>

                <AnalyticsCard title="Access Distribution">
                    <div className="flex flex-col md:flex-row items-center justify-between gap-8 h-[300px]">
                        <div className="w-full h-full md:w-1/2">
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
                        </div>

                        <div className="w-full md:w-1/2 space-y-4">
                            {deviceData.map((item, i) => (
                                <div key={item.name} className="flex items-center justify-between p-4 bg-white/5 rounded-2xl border border-white/5">
                                    <div className="flex items-center space-x-3">
                                        <div className="w-3 h-3 rounded-full" style={{ backgroundColor: COLORS[i] }} />
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
            <AnalyticsCard title="Global Infrastructure Load">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                    <div className="space-y-4">
                        <div className="flex items-center justify-between">
                            <div className="flex items-center space-x-2 text-gray-400">
                                <Monitor size={16} />
                                <span className="text-xs font-bold uppercase tracking-widest">CPU Usage</span>
                            </div>
                            <span className="text-sm font-bold text-blue-400">24%</span>
                        </div>
                        <div className="w-full h-2 bg-white/5 rounded-full overflow-hidden">
                            <motion.div initial={{ width: 0 }} animate={{ width: '24%' }} className="h-full bg-blue-500" />
                        </div>
                    </div>

                    <div className="space-y-4">
                        <div className="flex items-center justify-between">
                            <div className="flex items-center space-x-2 text-gray-400">
                                <Zap size={16} />
                                <span className="text-xs font-bold uppercase tracking-widest">API Latency</span>
                            </div>
                            <span className="text-sm font-bold text-emerald-400">42ms</span>
                        </div>
                        <div className="w-full h-2 bg-white/5 rounded-full overflow-hidden">
                            <motion.div initial={{ width: 0 }} animate={{ width: '15%' }} className="h-full bg-emerald-500" />
                        </div>
                    </div>

                    <div className="space-y-4">
                        <div className="flex items-center justify-between">
                            <div className="flex items-center space-x-2 text-gray-400">
                                <Globe size={16} />
                                <span className="text-xs font-bold uppercase tracking-widest">Bandwidth</span>
                            </div>
                            <span className="text-sm font-bold text-indigo-400">1.2 GB/s</span>
                        </div>
                        <div className="w-full h-2 bg-white/5 rounded-full overflow-hidden">
                            <motion.div initial={{ width: 0 }} animate={{ width: '60%' }} className="h-full bg-indigo-500" />
                        </div>
                    </div>
                </div>
            </AnalyticsCard>
        </div>
    );
};

export default SystemAnalytics;

import React, { useState } from 'react';
import { motion } from 'framer-motion';
import {
    FileCheck,
    Terminal,
    Database,
    Download,
    ChevronRight,
    ExternalLink,
    Code,
    Globe,
    Share2,
    Loader2,
    ShieldCheck,
    Cpu,
    Zap,
    Lock,
    Key,
    Check
} from 'lucide-react';
import { useTheme } from '@/contexts/ThemeContext';
import { SEOHead, generateBreadcrumbSchema } from '@/components/SEO/SEOHead';
import { Link } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';

const DataAPI = () => {
    const { theme } = useTheme();
    const isDark = theme === 'dark';
    const [isDownloading, setIsDownloading] = useState(false);
    const [copiedSnippet, setCopiedSnippet] = useState<string | null>(null);

    const copyToClipboard = (text: string, id: string) => {
        navigator.clipboard.writeText(text);
        setCopiedSnippet(id);
        setTimeout(() => setCopiedSnippet(null), 2000);
    };

    const handleDownloadCSV = async () => {
        setIsDownloading(true);
        try {
            const { data, error } = await supabase
                .from('iebc_offices')
                .select('county, constituency, office_location, latitude, longitude, verified')
                .eq('verified', true)
                .order('county');

            if (error) throw error;
            const headers = ['County', 'Constituency', 'Office Location', 'Latitude', 'Longitude', 'Verified'];
            const csvRows = [
                headers.join(','),
                ...data.map(row => [
                    `"${row.county}"`,
                    `"${row.constituency}"`,
                    `"${row.office_location}"`,
                    row.latitude || '',
                    row.longitude || '',
                    row.verified ? 'Yes' : 'No'
                ].join(','))
            ];
            const blob = new Blob(['\uFEFF' + csvRows.join('\n')], { type: 'text/csv;charset=utf-8;' });
            const url = URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = url;
            link.download = `nasaka-iebc-dataset.csv`;
            link.click();
            URL.revokeObjectURL(url);
        } catch (err) {
            console.error(err);
        } finally {
            setIsDownloading(false);
        }
    };

    const endpoints = [
        {
            method: 'GET',
            path: '/api/v1/offices',
            desc: 'List all IEBC offices with optional filters.',
            params: ['county', 'constituency', 'verified', 'limit']
        },
        {
            method: 'GET',
            path: '/api/v1/stats',
            desc: 'Get live electoral infrastructure statistics.',
            params: []
        },
        {
            method: 'GET',
            path: '/api/v1/locate',
            desc: 'Find nearest station by Geo-coordinates.',
            params: ['lat', 'lng', 'radius']
        }
    ];

    return (
        <div className={`min-h-screen pb-20 transition-colors duration-500 ${isDark ? 'bg-ios-gray-900 text-white' : 'bg-ios-gray-50 text-ios-gray-900'}`}>
            <SEOHead
                title="API Documentation — Nasaka IEBC | Build the Future of Kenyan Democracy"
                description="Comprehensive documentation for the Nasaka IEBC Open Data API. Integrate verified electoral geographic data into your applications."
                canonical="/data-api"
            />

            <div className="max-w-6xl mx-auto px-6 pt-20">
                {/* Hero section */}
                <motion.div
                    initial={{ opacity: 0, y: 30 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="mb-20 text-center"
                >
                    <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-blue-500/10 text-blue-500 text-xs font-black uppercase tracking-widest mb-6">
                        <Cpu className="w-3 h-3" />
                        Infrastructure for Democracy
                    </div>
                    <h1 className="text-6xl font-black mb-6 tracking-tight leading-tight">
                        Nasaka IEBC <br />
                        <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-500 via-indigo-500 to-purple-600">Developer Console</span>
                    </h1>
                    <p className="text-xl text-muted-foreground max-w-3xl mx-auto leading-relaxed">
                        Access high-resolution geographic data for 290 constituencies and 46,000+ polling stations. Built on the Vercel Edge for sub-50ms global latency.
                    </p>
                </motion.div>

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-10">
                    {/* Sidebar / Quick Reference */}
                    <div className="lg:col-span-1 space-y-6">
                        <section className={`p-8 rounded-[2.5rem] border ${isDark ? 'bg-ios-gray-800 border-ios-gray-700' : 'bg-white border-ios-gray-100 shadow-sm'}`}>
                            <h3 className="text-lg font-black mb-6 flex items-center gap-2">
                                <Key className="w-5 h-5 text-amber-500" />
                                Authentication
                            </h3>
                            <p className="text-sm text-muted-foreground mb-6">
                                All requests must include the <code className="px-1.5 py-0.5 rounded bg-amber-500/10 text-amber-600 font-bold">X-API-Key</code> header.
                            </p>
                            <Link
                                to="/dashboard/api-keys"
                                className="w-full py-4 rounded-2xl bg-ios-gray-100 dark:bg-ios-gray-900 flex items-center justify-center gap-2 font-bold text-sm hover:bg-amber-500 hover:text-white transition-all group"
                            >
                                Get Your API Key
                                <ChevronRight className="w-4 h-4 transition-transform group-hover:translate-x-1" />
                            </Link>
                        </section>

                        <section className={`p-8 rounded-[2.5rem] border ${isDark ? 'bg-ios-gray-800 border-ios-gray-700' : 'bg-white border-ios-gray-100 shadow-sm'}`}>
                            <h3 className="text-lg font-black mb-6 flex items-center gap-2">
                                <Terminal className="w-5 h-5 text-blue-500" />
                                SDKs & Tools
                            </h3>
                            <div className="space-y-4">
                                <button className="w-full p-4 rounded-xl border border-dashed border-ios-gray-300 dark:border-ios-gray-700 text-sm font-bold text-muted-foreground text-left flex items-center justify-between hover:border-blue-500/50 transition-all">
                                    Nasaka JS (beta)
                                    <span className="text-[10px] uppercase px-1.5 py-0.5 bg-ios-gray-100 dark:bg-ios-gray-900 rounded">Available Q3</span>
                                </button>
                                <button
                                    onClick={handleDownloadCSV}
                                    disabled={isDownloading}
                                    className="w-full p-4 rounded-xl bg-blue-500 text-white text-sm font-bold flex items-center justify-between hover:shadow-lg transition-all"
                                >
                                    Download CSV Dataset
                                    {isDownloading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
                                </button>
                            </div>
                        </section>
                    </div>

                    {/* Main Documentation Body */}
                    <div className="lg:col-span-2 space-y-12">
                        {/* API Reference */}
                        <section>
                            <h2 className="text-3xl font-black mb-8 px-2 flex items-center gap-3">
                                <Database className="w-8 h-8 text-blue-500" />
                                API Reference
                            </h2>
                            <div className="space-y-6">
                                {endpoints.map(ep => (
                                    <div
                                        key={ep.path}
                                        className={`p-8 rounded-[3rem] border transition-all hover:border-blue-500/30 ${isDark ? 'bg-ios-gray-800 border-ios-gray-700' : 'bg-white border-ios-gray-100 shadow-sm'}`}
                                    >
                                        <div className="flex items-center gap-3 mb-4">
                                            <span className="px-2.5 py-1 rounded-lg bg-emerald-500/10 text-emerald-500 font-black text-xs">
                                                {ep.method}
                                            </span>
                                            <code className="text-lg font-bold text-blue-500">{ep.path}</code>
                                        </div>
                                        <p className="text-muted-foreground mb-6 leading-relaxed">
                                            {ep.desc}
                                        </p>

                                        {ep.params.length > 0 && (
                                            <div className="mb-6">
                                                <p className="text-xs font-black uppercase tracking-widest text-muted-foreground mb-3">Parameters</p>
                                                <div className="flex flex-wrap gap-2">
                                                    {ep.params.map(p => (
                                                        <span key={p} className="px-2 py-1 rounded bg-ios-gray-100 dark:bg-ios-gray-900 text-xs font-mono">
                                                            ?{p}=value
                                                        </span>
                                                    ))}
                                                </div>
                                            </div>
                                        )}

                                        <div className="relative group">
                                            <div className="absolute top-4 right-4 z-10 opacity-0 group-hover:opacity-100 transition-opacity">
                                                <button
                                                    onClick={() => copyToClipboard(`curl https://nasakaiebc.civiceducationkenya.com${ep.path} -H "X-API-Key: YOUR_KEY"`, ep.path)}
                                                    className="p-2 rounded-lg bg-white/10 backdrop-blur hover:bg-white/20 transition-colors"
                                                >
                                                    {copiedSnippet === ep.path ? <Check className="w-4 h-4 text-emerald-400" /> : <Code className="w-4 h-4" />}
                                                </button>
                                            </div>
                                            <pre className={`p-6 rounded-2xl font-mono text-sm overflow-x-auto ${isDark ? 'bg-ios-gray-900' : 'bg-ios-gray-50'}`}>
                                                <code>curl -X {ep.method} "https://nasakaiebc.civiceducationkenya.com{ep.path}" \<br />
                                                    &nbsp;&nbsp;-H "X-API-Key: YOUR_KEY"</code>
                                            </pre>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </section>

                        {/* Integration Example */}
                        <section className={`p-10 rounded-[3.5rem] bg-gradient-to-br from-blue-600 to-indigo-800 text-white relative overflow-hidden`}>
                            <div className="relative z-10">
                                <h2 className="text-4xl font-black mb-6">Built for High Speed.</h2>
                                <p className="text-lg text-blue-100 mb-8 max-w-xl">
                                    Our platform uses Vercel Edge caching to serve voter infrastructure data. Use it for election monitoring, civic apps, or academic research.
                                </p>
                                <div className="grid grid-cols-2 gap-8">
                                    <div className="flex items-start gap-4">
                                        <div className="p-3 rounded-2xl bg-white/10 backdrop-blur">
                                            <Zap className="w-6 h-6" />
                                        </div>
                                        <div>
                                            <p className="font-bold">Edge Accelerated</p>
                                            <p className="text-xs text-blue-200">Sub-10ms response times for cached queries.</p>
                                        </div>
                                    </div>
                                    <div className="flex items-start gap-4">
                                        <div className="p-3 rounded-2xl bg-white/10 backdrop-blur">
                                            <Lock className="w-6 h-6" />
                                        </div>
                                        <div>
                                            <p className="font-bold">Secure Access</p>
                                            <p className="text-xs text-blue-200">Tier-based rate limiting and bot protection.</p>
                                        </div>
                                    </div>
                                </div>
                            </div>
                            {/* Decorative Blobs */}
                            <div className="absolute top-0 right-0 w-96 h-96 bg-blue-400/20 blur-[100px] rounded-full translate-x-1/2 -translate-y-1/2" />
                            <div className="absolute bottom-0 left-0 w-64 h-64 bg-indigo-400/20 blur-[80px] rounded-full -translate-x-1/2 translate-y-1/2" />
                        </section>

                        {/* Footer legal info */}
                        <section className="text-center pt-8 border-t border-ios-gray-100 dark:border-ios-gray-800">
                            <p className="text-sm text-muted-foreground">
                                Data provided "as-is" for civic transparency. Dataset version: 2026.03.17-LTS. <br />
                                <Link to="/terms" className="text-blue-500 font-bold hover:underline">Full Terms & Data License</Link>
                            </p>
                        </section>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default DataAPI;

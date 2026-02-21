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
    Loader2
} from 'lucide-react';
import { useTheme } from '@/contexts/ThemeContext';
import { SEOHead, generateBreadcrumbSchema, generateFAQSchema } from '@/components/SEO/SEOHead';
import { Link } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';

const DataAPI = () => {
    const { theme } = useTheme();
    const isDark = theme === 'dark';
    const [isDownloading, setIsDownloading] = useState(false);
    const [downloadError, setDownloadError] = useState<string | null>(null);

    const handleDownloadCSV = async () => {
        setIsDownloading(true);
        setDownloadError(null);
        try {
            const { data, error } = await supabase
                .from('iebc_offices')
                .select('county, constituency_name, office_location, latitude, longitude, formatted_address, landmark, verified')
                .eq('verified', true)
                .not('latitude', 'is', null)
                .not('longitude', 'is', null)
                .order('county')
                .order('constituency_name');

            if (error) throw error;
            if (!data || data.length === 0) throw new Error('No verified offices found');

            const headers = ['County', 'Constituency', 'Office Location', 'Latitude', 'Longitude', 'Formatted Address', 'Landmark', 'Verified'];
            const csvRows = [
                headers.join(','),
                ...data.map(row => [
                    `"${(row.county || '').replace(/"/g, '""')}"`,
                    `"${(row.constituency_name || '').replace(/"/g, '""')}"`,
                    `"${(row.office_location || '').replace(/"/g, '""')}"`,
                    row.latitude || '',
                    row.longitude || '',
                    `"${(row.formatted_address || '').replace(/"/g, '""')}"`,
                    `"${(row.landmark || '').replace(/"/g, '""')}"`,
                    row.verified ? 'Yes' : 'No'
                ].join(','))
            ];

            const csvContent = csvRows.join('\n');
            const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' });
            const url = URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = url;
            link.download = `nasaka-iebc-offices-${new Date().toISOString().split('T')[0]}.csv`;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            URL.revokeObjectURL(url);
        } catch (err: any) {
            console.error('CSV download failed:', err);
            setDownloadError(err.message || 'Download failed. Please try again.');
        } finally {
            setIsDownloading(false);
        }
    };

    const dataSpecs = [
        {
            label: 'Format',
            value: 'JSON / GeoJSON / CSV'
        },
        {
            label: 'Coverage',
            value: '47 Counties / 290 Constituencies'
        },
        {
            label: 'Verified',
            value: 'Community Crowdsourced'
        }
    ];

    return (
        <div className={`min-h-screen pb-20 transition-colors duration-500 ${isDark ? 'bg-ios-gray-900 text-white' : 'bg-ios-gray-50 text-ios-gray-900'}`}>
            <SEOHead
                title="Nasaka IEBC Dataset & Open API — Civic Election Data Kenya | Nasaka IEBC"
                description="Access open data for IEBC constituency offices in Kenya. Download the verified dataset in JSON format or use our public API for research and civic technology projects."
                canonical="/data-api"
                keywords="IEBC dataset download, Kenya election data API, open civic data, constituency office coordinates, Nasaka IEBC developer"
                schema={[
                    generateBreadcrumbSchema([
                        { name: 'Home', url: '/' },
                        { name: 'Data & API', url: '/data-api' }
                    ]),
                    {
                        "@context": "https://schema.org",
                        "@type": "Dataset",
                        "name": "Nasaka IEBC Constituency Office Directory",
                        "description": "A community-verified dataset of IEBC constituency offices and registration centers across Kenya, including geolocation coordinates and contact details.",
                        "url": "https://recall254.vercel.app/data-api",
                        "creator": {
                            "@type": "Organization",
                            "name": "Civic Education Kenya (CEKA)"
                        },
                        "license": "https://creativecommons.org/licenses/by/4.0/",
                        "spatialCoverage": "Kenya",
                        "variableMeasured": "Office geolocation, address, verification status"
                    }
                ]}
            />

            <div className="max-w-4xl mx-auto px-6 pt-16">
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="text-center mb-16"
                >
                    <div className="inline-flex items-center px-4 py-2 rounded-full bg-ios-blue/10 text-ios-blue text-sm font-bold mb-4">
                        <Code className="w-4 h-4 mr-2" />
                        Open Source & Open Data
                    </div>
                    <h1 className="text-5xl font-black mb-6 tracking-tight">Data & API</h1>
                    <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
                        Empowering researchers, developers, and civic organizations with verified electoral infrastructure data.
                    </p>
                </motion.div>

                <section className="mb-16">
                    <div className={`p-10 rounded-[3rem] border overflow-hidden relative ${isDark ? 'bg-ios-gray-800 border-ios-gray-700' : 'bg-white border-ios-gray-100 shadow-sm'}`}>
                        <div className="flex flex-col md:flex-row gap-10 items-center">
                            <div className="flex-1">
                                <h2 className="text-3xl font-black mb-6">Constituency Dataset</h2>
                                <p className="text-muted-foreground leading-relaxed mb-8">
                                    Our dataset provides precise geolocation for all 290 IEBC constituency offices. We use a multi-layered verification process combining official records and community ground-truth reports.
                                </p>
                                <div className="grid grid-cols-2 gap-4 mb-8">
                                    {dataSpecs.map(spec => (
                                        <div key={spec.label}>
                                            <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground block mb-1">{spec.label}</span>
                                            <span className="font-bold">{spec.value}</span>
                                        </div>
                                    ))}
                                </div>
                                <button
                                    onClick={handleDownloadCSV}
                                    disabled={isDownloading}
                                    className={`px-8 py-4 rounded-2xl font-bold flex items-center shadow-lg transition-all active:scale-95 ${isDownloading ? 'opacity-70 cursor-wait' : 'hover:shadow-xl hover:scale-[1.02]'} ${isDark ? 'bg-ios-blue text-white' : 'bg-ios-gray-900 text-white'}`}
                                >
                                    {isDownloading ? (
                                        <>
                                            <Loader2 className="w-5 h-5 mr-3 animate-spin" />
                                            Preparing Download…
                                        </>
                                    ) : (
                                        <>
                                            <Download className="w-5 h-5 mr-3" />
                                            Download CSV
                                        </>
                                    )}
                                </button>
                                {downloadError && (
                                    <p className="text-red-500 text-sm mt-3">{downloadError}</p>
                                )}
                            </div>
                            <div className={`w-full md:w-64 aspect-square rounded-[2.5rem] flex items-center justify-center relative ${isDark ? 'bg-ios-gray-900' : 'bg-ios-gray-50'}`}>
                                <Database className="w-20 h-20 text-ios-blue opacity-20" />
                                <div className="absolute inset-0 flex items-center justify-center">
                                    <Terminal className="w-12 h-12 text-ios-blue" />
                                </div>
                            </div>
                        </div>
                    </div>
                </section>

                <section className="mb-16">
                    <h2 className="text-3xl font-black mb-8 px-2">Developer Resources</h2>
                    <div className="grid md:grid-cols-2 gap-6">
                        {[
                            {
                                title: 'API Documentation',
                                desc: 'Integrate IEBC office locations directly into your GIS or civic platform.',
                                icon: <Globe className="w-6 h-6 text-ios-blue" />,
                                link: '#'
                            },
                            {
                                title: 'Crowdsourcing API',
                                desc: 'Submit verification reports programmatically from your observer apps.',
                                icon: <Share2 className="w-6 h-6 text-green-500" />,
                                link: '#'
                            }
                        ].map(item => (
                            <div
                                key={item.title}
                                className={`p-8 rounded-[2.5rem] border transition-all hover:scale-[1.02] ${isDark ? 'bg-ios-gray-800 border-ios-gray-700' : 'bg-white border-ios-gray-100 shadow-sm'}`}
                            >
                                <div className={`p-4 rounded-2xl w-fit mb-6 ${isDark ? 'bg-ios-gray-700' : 'bg-ios-gray-50'}`}>
                                    {item.icon}
                                </div>
                                <h3 className="text-xl font-bold mb-3">{item.title}</h3>
                                <p className="text-sm text-muted-foreground mb-6 leading-relaxed">
                                    {item.desc}
                                </p>
                                <span className="text-ios-blue font-bold text-sm flex items-center group">
                                    View Specs
                                    <ChevronRight className="w-4 h-4 ml-1 transition-transform group-hover:translate-x-1" />
                                </span>
                            </div>
                        ))}
                    </div>
                </section>

                <section className={`p-10 rounded-[3rem] border mb-20 ${isDark ? 'bg-ios-gray-950 border-ios-gray-800' : 'bg-ios-gray-100 border-ios-gray-200'}`}>
                    <div className="flex items-start gap-6">
                        <ShieldCheck className="w-12 h-12 text-ios-blue shrink-0" />
                        <div>
                            <h3 className="text-2xl font-bold mb-4">License & Attribution</h3>
                            <p className="text-muted-foreground leading-relaxed mb-4">
                                All Nasaka IEBC datasets are licensed under <a href="https://creativecommons.org/licenses/by/4.0/" target="_blank" rel="noopener noreferrer" className="text-ios-blue underline">Creative Commons Attribution 4.0 International (CC BY 4.0)</a>.
                            </p>
                            <p className="text-sm text-muted-foreground italic">
                                You are free to share and adapt the material for any purpose, even commercially, as long as you provide attribution to "Nasaka IEBC / Civic Education Kenya".
                            </p>
                        </div>
                    </div>
                </section>
            </div>
        </div>
    );
};

const ShieldCheck = ({ className }: { className?: string }) => (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
    </svg>
);

export default DataAPI;

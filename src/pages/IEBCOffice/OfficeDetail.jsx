import React, { useEffect, useState, useCallback } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
    MapPin,
    Navigation,
    Clock,
    CheckCircle2,
    AlertCircle,
    ArrowLeft,
    Share2,
    Copy,
    ExternalLink,
    ChevronRight,
    Info
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useTheme } from '@/contexts/ThemeContext';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import {
    SEOHead,
    generateOfficeSchema,
    generateBreadcrumbSchema,
    generateFAQSchema,
    slugify,
    deslugify
} from '@/components/SEO/SEOHead';
import LoadingSpinner from '@/components/IEBCOffice/LoadingSpinner';

const OfficeDetail = () => {
    const { county: rawCounty, area: rawArea, constituency: rawConstituency } = useParams();
    // rawArea is from the new /:county/:area route
    // rawConstituency is from the legacy /iebc-office/:county/:constituency route
    const currentArea = rawArea || rawConstituency;
    const navigate = useNavigate();
    const { theme } = useTheme();
    const isDark = theme === 'dark';
    const { t } = useTranslation();

    const [office, setOffice] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [nearbyOffices, setNearbyOffices] = useState([]);

    // URL Sanitization
    const sanitizeSlug = (slug) => slug?.toLowerCase().trim().replace(/[^\w-]/g, '');
    const countySlug = sanitizeSlug(rawCounty);
    const areaSlug = sanitizeSlug(currentArea);

    const fetchOfficeData = useCallback(async () => {
        setLoading(true);
        try {
            const countySearch = deslugify(countySlug);
            let areaSearch = areaSlug ? deslugify(areaSlug) : null;

            // Handle disambiguation: If area ends with "-town", remove it for database search
            if (areaSearch && areaSearch.toLowerCase().endsWith(' town')) {
                areaSearch = areaSearch.substring(0, areaSearch.length - 5);
            }

            let query = supabase
                .from('iebc_offices')
                .select('*');

            if (areaSearch) {
                query = query.ilike('constituency_name', areaSearch);
            } else {
                query = query.ilike('county', countySearch);
            }

            const { data, error: fetchError } = await query.limit(1).maybeSingle();

            if (fetchError) throw fetchError;

            if (!data) {
                // Fuzzy match attempt
                const { data: fuzzyData } = await supabase
                    .from('iebc_offices')
                    .select('*')
                    .ilike('county', `%${countySearch}%`)
                    .limit(1)
                    .maybeSingle();

                if (fuzzyData) {
                    const newUrl = `/${slugify(fuzzyData.county)}/${slugify(fuzzyData.constituency_name)}${slugify(fuzzyData.constituency_name) === slugify(fuzzyData.county) ? '-town' : ''}`;
                    navigate(newUrl, { replace: true });
                    return;
                }
                throw new Error('Office not found in our registry');
            }

            setOffice(data);

            // Fetch nearby offices in same county
            const { data: nearby } = await supabase
                .from('iebc_offices')
                .select('constituency_name, county, verified')
                .eq('county', data.county)
                .neq('constituency_name', data.constituency_name)
                .limit(5);

            setNearbyOffices(nearby || []);
        } catch (err) {
            console.error('Error fetching office:', err);
            setError(err.message);
        } finally {
            setLoading(false);
        }
    }, [countySlug, areaSlug, navigate]);

    useEffect(() => {
        if (countySlug) {
            fetchOfficeData();
        }
    }, [fetchOfficeData, countySlug]);

    const handleShare = async () => {
        const url = window.location.href;
        if (navigator.share) {
            try {
                await navigator.share({
                    title: `IEBC Office: ${office.constituency_name}`,
                    text: `Find directions and info for ${office.constituency_name} IEBC office on Nasaka.`,
                    url
                });
            } catch (err) {
                console.error('Share failed:', err);
            }
        } else {
            navigator.clipboard.writeText(url);
            toast.success('Link copied to clipboard');
        }
    };

    if (loading) return <div className="min-h-screen flex items-center justify-center bg-background"><LoadingSpinner /></div>;

    if (error || !office) {
        return (
            <div className="min-h-screen flex flex-col items-center justify-center p-6 text-center">
                <AlertCircle className="w-16 h-16 text-red-500 mb-4" />
                <h1 className="text-2xl font-bold mb-2">Office Not Found</h1>
                <p className="text-muted-foreground mb-6">{error || "We couldn't locate this IEBC office."}</p>
                <Link to="/iebc-office/map" className="px-6 py-3 bg-primary text-white rounded-xl font-medium">
                    Return to Map
                </Link>
            </div>
        );
    }

    const officeName = office.constituency_name || 'IEBC Office';
    const countyName = office.county || 'Kenya';
    const seoTitle = `${officeName} IEBC Office — ${countyName} County | Nasaka IEBC`;
    const seoDescription = `Find the IEBC constituency office for ${officeName}, ${countyName} County. Get directions, voter registration info, and community verified data.`;

    return (
        <div className={`min-h-screen pb-20 transition-colors duration-500 ${isDark ? 'bg-ios-gray-900 text-white' : 'bg-ios-gray-50 text-ios-gray-900'}`}>
            <SEOHead
                title={seoTitle}
                description={seoDescription}
                canonical={`/${slugify(countyName)}/${slugify(officeName)}`}
                schema={[
                    generateOfficeSchema(office),
                    generateBreadcrumbSchema([
                        { name: 'Home', url: '/' },
                        { name: 'IEBC Offices', url: '/iebc-office' },
                        { name: countyName, url: `/${slugify(countyName)}` },
                        {
                            name: officeName,
                            url: `/${slugify(countyName)}/${slugify(officeName)}${slugify(officeName) === slugify(countyName) ? '-town' : ''}`
                        }
                    ]),
                    generateFAQSchema([
                        {
                            question: `Where is the ${officeName} IEBC office located?`,
                            answer: `${officeName} IEBC office is located in ${office.address || office.county}. You can use Nasaka for precise directions.`
                        },
                        {
                            question: `What are the opening hours for ${officeName} IEBC office?`,
                            answer: `Standard hours are Monday to Friday, 8:00 AM to 5:00 PM. We recommend visiting during mid-morning for shorter queues.`
                        }
                    ])
                ]}
            />

            {/* iOS Header */}
            <header className={`sticky top-0 z-40 backdrop-blur-xl border-b transition-colors duration-300 ${isDark ? 'bg-ios-gray-900/80 border-ios-gray-800' : 'bg-white/80 border-ios-gray-100'}`}>
                <div className="max-w-2xl mx-auto px-4 h-16 flex items-center justify-between">
                    <button onClick={() => navigate(-1)} className="p-2 -ml-2 hover:bg-ios-gray-200/50 rounded-full transition-colors">
                        <ArrowLeft className="w-6 h-6" />
                    </button>
                    <h1 className="text-lg font-semibold truncate px-4">{officeName}</h1>
                    <button onClick={handleShare} className="p-2 -mr-2 hover:bg-ios-gray-200/50 rounded-full transition-colors">
                        <Share2 className="w-5 h-5" />
                    </button>
                </div>
            </header>

            <main className="max-w-2xl mx-auto p-4 space-y-6">
                {/* Verification Badge & Image Placeholder */}
                <section className={`rounded-3xl p-6 shadow-sm border overflow-hidden relative ${isDark ? 'bg-ios-gray-800 border-ios-gray-700' : 'bg-white border-ios-gray-100'}`}>
                    <div className="flex items-start justify-between mb-4">
                        <div>
                            <div className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300 mb-2">
                                {countyName} County
                            </div>
                            <h2 className="text-3xl font-bold">{officeName}</h2>
                            <p className="text-muted-foreground mt-1">{office.constituency_type || 'Constituency'} Office</p>
                        </div>
                        {office.verified && (
                            <div className="flex flex-col items-center">
                                <CheckCircle2 className="w-10 h-10 text-green-500" />
                                <span className="text-[10px] font-bold text-green-600 mt-1 uppercase tracking-tight">Verified</span>
                            </div>
                        )}
                    </div>

                    <div className={`mt-6 p-4 rounded-2xl flex items-center gap-4 ${isDark ? 'bg-ios-gray-700/50' : 'bg-ios-gray-50'}`}>
                        <div className="w-12 h-12 rounded-xl bg-blue-500 flex items-center justify-center text-white shrink-0">
                            <MapPin className="w-6 h-6" />
                        </div>
                        <div className="flex-1 min-w-0">
                            <p className="text-xs text-muted-foreground font-medium uppercase tracking-wider">Address</p>
                            <p className="text-sm font-medium leading-tight truncate">{office.address || 'Address information being verified by community'}</p>
                        </div>
                    </div>
                </section>

                {/* Quick Actions */}
                <section className="grid grid-cols-2 gap-3">
                    <button
                        onClick={() => window.open(`https://www.google.com/maps/dir/?api=1&destination=${office.latitude},${office.longitude}`, '_blank')}
                        className="flex flex-col items-center justify-center p-4 rounded-3xl bg-blue-500 text-white shadow-lg shadow-blue-500/20 active:scale-95 transition-transform"
                    >
                        <Navigation className="w-6 h-6 mb-2" />
                        <span className="text-sm font-semibold">Directions</span>
                    </button>
                    <button
                        onClick={() => navigate('/iebc-office/map', { state: { selectedOffice: office } })}
                        className={`flex flex-col items-center justify-center p-4 rounded-3xl shadow-sm border active:scale-95 transition-transform ${isDark ? 'bg-ios-gray-800 border-ios-gray-700' : 'bg-white border-ios-gray-100'}`}
                    >
                        <MapPin className="w-6 h-6 mb-2 text-blue-500" />
                        <span className="text-sm font-semibold">View on Map</span>
                    </button>
                </section>

                {/* Info Grid */}
                <section className={`rounded-3xl overflow-hidden border ${isDark ? 'bg-ios-gray-800 border-ios-gray-700' : 'bg-white border-ios-gray-100'}`}>
                    <div className="divide-y divide-ios-gray-500/10">
                        <div className="p-4 flex items-center justify-between">
                            <div className="flex items-center gap-3">
                                <Clock className="w-5 h-5 text-ios-blue" />
                                <span className="text-sm font-medium">Opening Hours</span>
                            </div>
                            <span className="text-xs text-muted-foreground font-medium">8:00 AM — 5:00 PM</span>
                        </div>
                        <div className="p-4 flex items-center justify-between">
                            <div className="flex items-center gap-3">
                                <Info className="w-5 h-5 text-ios-blue" />
                                <span className="text-sm font-medium">Constituency Code</span>
                            </div>
                            <span className="text-xs font-mono font-bold">{office.constituency_code || '---'}</span>
                        </div>
                    </div>
                </section>

                {/* Voter Registration Pillar */}
                <section className={`rounded-3xl p-6 border ${isDark ? 'bg-gradient-to-br from-green-900/20 to-transparent border-green-800/30' : 'bg-gradient-to-br from-green-50 to-white border-green-100'}`}>
                    <h3 className="text-lg font-bold mb-3 flex items-center gap-2">
                        <CheckCircle2 className="w-5 h-5 text-green-500" />
                        Voter Registration (CVR)
                    </h3>
                    <p className="text-sm text-muted-foreground leading-relaxed mb-4">
                        You can register as a voter at this office during Continuous Voter Registration periods. Bring your <strong>Original National ID</strong> or valid <strong>Passport</strong>.
                    </p>
                    <ul className="space-y-2">
                        {['Registration', 'Transfer of Polling Station', 'Update Particulars'].map(item => (
                            <li key={item} className="flex items-center gap-2 text-xs font-medium">
                                <div className="w-1 h-1 rounded-full bg-green-500" />
                                {item}
                            </li>
                        ))}
                    </ul>
                </section>

                {/* Nearby Offices */}
                {nearbyOffices.length > 0 && (
                    <section>
                        <h3 className="text-lg font-bold mb-4 px-1">Nearby in {countyName}</h3>
                        <div className="space-y-2">
                            {nearbyOffices.map((nob) => (
                                <Link
                                    key={nob.constituency_name}
                                    to={`/${slugify(countyName)}/${slugify(nob.constituency_name)}${slugify(nob.constituency_name) === slugify(countyName) ? '-town' : ''}`}
                                    className={`flex items-center justify-between p-4 rounded-2xl border transition-all active:scale-[0.98] ${isDark ? 'bg-ios-gray-800/50 border-ios-gray-800 hover:bg-ios-gray-800' : 'bg-white border-ios-gray-100 hover:bg-ios-gray-50'}`}
                                >
                                    <div className="flex items-center gap-3">
                                        <div className="w-8 h-8 rounded-full bg-ios-gray-100 dark:bg-ios-gray-700 flex items-center justify-center">
                                            <MapPin className="w-4 h-4 text-ios-blue" />
                                        </div>
                                        <div>
                                            <p className="text-sm font-semibold">{nob.constituency_name}</p>
                                            <p className="text-[10px] text-muted-foreground uppercase tracking-wider">{nob.verified ? 'Verified' : 'Unverified'}</p>
                                        </div>
                                    </div>
                                    <ChevronRight className="w-5 h-5 text-muted-foreground opacity-50" />
                                </Link>
                            ))}
                        </div>
                    </section>
                )}

                <footer className="text-center pt-8 opacity-40">
                    <p className="text-[10px] font-medium tracking-widest uppercase">
                        Data provided by community crowdsourcing
                    </p>
                    <p className="text-[10px] mt-1">
                        Last updated: {office.updated_at ? new Date(office.updated_at).toLocaleDateString() : 'Recently'}
                    </p>
                </footer>
            </main>
        </div>
    );
};

export default OfficeDetail;

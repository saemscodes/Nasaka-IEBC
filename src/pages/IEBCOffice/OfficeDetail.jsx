import React, { useEffect, useState, useCallback, useMemo } from 'react';
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
import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

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

    // Fix 5: Read persisted userLocation from sessionStorage for return navigation
    const savedUserLocation = useMemo(() => {
        try {
            const stored = sessionStorage.getItem('nasaka_userLocation');
            return stored ? JSON.parse(stored) : null;
        } catch (_) { return null; }
    }, []);

    // Mini-map marker icon
    const officeIcon = useMemo(() => L.divIcon({
        html: `<div style="width:32px;height:32px;background:#007AFF;border-radius:50%;border:3px solid white;box-shadow:0 2px 8px rgba(0,0,0,0.3);display:flex;align-items:center;justify-content:center">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>
        </div>`,
        className: '',
        iconSize: [32, 32],
        iconAnchor: [16, 32],
        popupAnchor: [0, -32]
    }), []);

    // URL Sanitization
    const sanitizeSlug = (slug) => slug?.toLowerCase().trim().replace(/[^\w-]/g, '');
    const countySlug = sanitizeSlug(rawCounty);
    const areaSlug = sanitizeSlug(currentArea);

    // Redirection Logic: Redirect legacy /iebc-office paths to hierarchical canonical paths
    useEffect(() => {
        if (window.location.pathname.startsWith('/iebc-office/') && office) {
            const countySlugLocal = slugify(office.county);
            let areaSlugLocal = slugify(office.constituency_name);

            // Apply disambiguation logic: area-town if matches county
            if (areaSlugLocal === countySlugLocal) {
                areaSlugLocal = `${areaSlugLocal}-town`;
            }

            const canonicalPath = `/${countySlugLocal}/${areaSlugLocal}`;
            // Log removed for production

            navigate(canonicalPath, { replace: true });
        }
    }, [office, navigate]);

    const fetchOfficeData = useCallback(async () => {
        setLoading(true);
        try {
            const countySearch = deslugify(countySlug);
            let areaSearch = areaSlug ? deslugify(areaSlug) : null;

            // Handle disambiguation: If area ends with "-town", remove it for database search
            if (areaSearch && areaSearch.toLowerCase().endsWith(' town')) {
                areaSearch = areaSearch.substring(0, areaSearch.length - 5);
            }

            let data = null;

            if (areaSearch) {
                // Fix 2: Step 1 — fuzzy match with %search% on constituency_name
                const { data: d1, error: e1 } = await supabase
                    .from('iebc_offices')
                    .select('*')
                    .ilike('constituency_name', `%${areaSearch}%`)
                    .limit(1)
                    .maybeSingle();

                if (e1) throw e1;
                data = d1;

                // Fix 2: Step 2 — multi-word fallback: split and try individual terms
                if (!data && areaSearch.includes(' ')) {
                    const terms = areaSearch.split(' ').filter(t => t.length > 2);
                    for (const term of terms) {
                        const { data: d2 } = await supabase
                            .from('iebc_offices')
                            .select('*')
                            .ilike('constituency_name', `%${term}%`)
                            .limit(1)
                            .maybeSingle();
                        if (d2) {
                            data = d2;
                            break;
                        }
                    }
                }
            } else {
                // County-only search
                const { data: d3, error: e3 } = await supabase
                    .from('iebc_offices')
                    .select('*')
                    .ilike('county', countySearch)
                    .limit(1)
                    .maybeSingle();

                if (e3) throw e3;
                data = d3;
            }

            if (!data) {
                // Final fuzzy fallback on county
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
            // Log removed for production

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
                <p className="text-muted-foreground mb-6">Nasaka is bringing the IEBC closer to you. We couldn't find this specific office just now - please check our registry again in a moment.</p>

                <Link
                    to="/iebc-office/map"
                    state={savedUserLocation ? { userLocation: savedUserLocation } : undefined}
                    className="px-6 py-3 bg-primary text-white rounded-xl font-medium"
                >
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
                        onClick={() => navigate('/iebc-office/map', {
                            state: {
                                selectedOffice: office,
                                ...(savedUserLocation ? { userLocation: savedUserLocation } : {})
                            }
                        })}
                        className={`flex flex-col items-center justify-center p-4 rounded-3xl shadow-sm border active:scale-95 transition-transform ${isDark ? 'bg-ios-gray-800 border-ios-gray-700' : 'bg-white border-ios-gray-100'}`}
                    >
                        <MapPin className="w-6 h-6 mb-2 text-blue-500" />
                        <span className="text-sm font-semibold">View on Map</span>
                    </button>
                </section>

                {/* Mini Map */}
                {office.latitude && office.longitude && (
                    <section className={`rounded-3xl overflow-hidden border shadow-sm ${isDark ? 'border-ios-gray-700' : 'border-ios-gray-100'}`}>
                        <div style={{ height: '200px', width: '100%' }}>
                            <MapContainer
                                center={[office.latitude, office.longitude]}
                                zoom={14}
                                scrollWheelZoom={false}
                                dragging={false}
                                zoomControl={false}
                                attributionControl={false}
                                style={{ height: '100%', width: '100%', borderRadius: '24px' }}
                            >
                                <TileLayer
                                    url={isDark
                                        ? 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png'
                                        : 'https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png'
                                    }
                                />
                                <Marker
                                    position={[office.latitude, office.longitude]}
                                    icon={officeIcon}
                                >
                                    <Popup>
                                        <div className="text-sm font-semibold">{officeName}</div>
                                        <div className="text-xs text-muted-foreground">{countyName} County</div>
                                    </Popup>
                                </Marker>
                            </MapContainer>
                        </div>
                    </section>
                )}

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
                        Data provided by CEKA community. Join <a href="https://www.civiceducationkenya.com/join-community" target="_blank" rel="noopener noreferrer" className="underline hover:text-blue-500 transition-colors">here</a>
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

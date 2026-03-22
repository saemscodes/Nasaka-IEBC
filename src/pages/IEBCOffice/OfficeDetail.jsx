import React, { useEffect, useState, useCallback, useMemo } from 'react';
import { useParams, useNavigate, Link, useLocation } from 'react-router-dom';
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
    ArrowRight,
    Info
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useTheme } from '@/contexts/ThemeContext';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { getTravelInsights } from '@/services/travelService';
import { resolveLocation } from '@/lib/geocoding/pipeline';
import {
    SEOHead,
    generateOfficeSchema,
    generateBreadcrumbSchema,
    generateFAQSchema,
    slugify,
    deslugify
} from '@/components/SEO/SEOHead';
import RadiusCircle from '@/components/map/RadiusCircle';
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import LoadingSpinner from '@/components/IEBCOffice/LoadingSpinner';

// Approximate distance function for radius visualization
const calculateDistance = (lat1, lon1, lat2, lon2) => {
    const R = 6371; // Radius of the earth in km
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
        Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
};

const OfficeDetail = () => {
    const { county: rawCounty, constituency: rawConstituency, ward: rawWard } = useParams();
    const navigate = useNavigate();
    const location = useLocation();

    // Extract optional query parameters for geographical resolution context
    const queryParams = new URLSearchParams(location.search);
    const overrideLat = queryParams.get('lat') ? parseFloat(queryParams.get('lat')) : null;
    const overrideLng = queryParams.get('lng') ? parseFloat(queryParams.get('lng')) : null;
    const originalSearch = queryParams.get('q');
    const { theme } = useTheme();
    const isDark = theme === 'dark';
    const { t } = useTranslation();

    const [office, setOffice] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [nearbyOffices, setNearbyOffices] = useState([]);
    const [liveIntelligence, setLiveIntelligence] = useState(null);
    const [intelligenceLoading, setIntelligenceLoading] = useState(false);

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
    // FIXED: Added truthy check for slug to prevent Uncaught TypeError: Cannot read properties of undefined (reading 'replace')
    const sanitizeSlug = (slug) => slug ? slug.toLowerCase().trim().replace(/[^\w-]/g, '') : '';
    const countySlug = sanitizeSlug(rawCounty);
    const constituencySlug = sanitizeSlug(rawConstituency);
    const wardSlug = sanitizeSlug(rawWard);

    // Redirection Logic: Redirect legacy paths to hierarchical canonical paths
    useEffect(() => {
        if (!office) return;

        const isLegacyPath = window.location.pathname.startsWith('/iebc-office/') ||
            window.location.pathname.startsWith('/nasaka-iebc/');

        const canonicalCounty = slugify(office.county);
        const canonicalConstituency = slugify(office.constituency_name);
        // If we are on a ward page, we want the ward slug too
        const canonicalWard = office.ward_name ? slugify(office.ward_name) : wardSlug;

        // Disambiguation
        let constPart = canonicalConstituency;
        if (constPart === canonicalCounty) constPart = `${constPart}-town`;

        let expectedPath = `/${canonicalCounty}/${constPart}`;
        if (wardSlug && canonicalWard) expectedPath += `/${canonicalWard}`;

        if (isLegacyPath || (window.location.pathname !== expectedPath && !location.search)) {
            navigate(expectedPath, { replace: true });
        }
    }, [office, navigate, location.pathname, wardSlug]);

    const fetchOfficeData = useCallback(async () => {
        setLoading(true);
        try {
            const countySearch = deslugify(countySlug);
            let constituencySearch = constituencySlug ? deslugify(constituencySlug) : null;

            // Handle disambiguation: If constituency ends with "-town", remove it for database search
            if (constituencySearch && constituencySearch.toLowerCase().endsWith(' town')) {
                constituencySearch = constituencySearch.substring(0, constituencySearch.length - 5);
            }

            let data = null;

            if (wardSlug) {
                const wardSearch = deslugify(wardSlug);
                // 1. Try exact ward match with hierarchy
                const { data: d0, error: e0 } = await supabase
                    .from('iebc_offices')
                    .select('id, county, constituency, constituency_name, office_location, latitude, longitude, verified, formatted_address, landmark, landmark_normalized, landmark_source, walking_effort, elevation_meters, geocode_verified, geocode_verified_at, multi_source_confidence, created_at, updated_at')
                    .ilike('ward_name', `%${wardSearch}%`)
                    .ilike('constituency_name', `%${constituencySearch}%`)
                    .limit(1)
                    .maybeSingle();

                if (e0) throw e0;
                data = d0;
            }

            if (!data && constituencySearch) {
                // 2. Try constituency match
                const { data: d1, error: e1 } = await supabase
                    .from('iebc_offices')
                    .select('id, county, constituency, constituency_name, office_location, latitude, longitude, verified, formatted_address, landmark, landmark_normalized, landmark_source, walking_effort, elevation_meters, geocode_verified, geocode_verified_at, multi_source_confidence, created_at, updated_at')
                    .ilike('constituency_name', `%${constituencySearch}%`)
                    .limit(1)
                    .maybeSingle();

                if (e1) throw e1;
                data = d1;
            }

            if (!data) {
                // 3. County-only fallback
                const { data: d3, error: e3 } = await supabase
                    .from('iebc_offices')
                    .select('id, county, constituency, constituency_name, office_location, latitude, longitude, verified, formatted_address, landmark, landmark_normalized, landmark_source, walking_effort, elevation_meters, geocode_verified, geocode_verified_at, multi_source_confidence, created_at, updated_at')
                    .ilike('county', countySearch)
                    .limit(1)
                    .maybeSingle();

                if (e3) throw e3;
                data = d3;
            }

            if (!data) {
                // 4. Geographical Fallback (HAM MODE)
                // If the URL contains a landmark or descriptive text that didn't match the DB
                const searchString = `${wardSlug ? deslugify(wardSlug) + ' ' : ''}${constituencySearch || ''} ${countySearch}`.trim();
                const geo = await resolveLocation(searchString);

                if (geo.result && geo.result.isKenyan) {
                    const { lat, lng } = geo.result;
                    // Find nearest ward from centroids
                    const { data: nearest } = await supabase.rpc('get_nearest_ward', {
                        lat_param: lat,
                        lng_param: lng
                    });

                    if (nearest && nearest.length > 0) {
                        const w = nearest[0];
                        // Get the actual office for this ward
                        const { data: finalOffice } = await supabase
                            .from('iebc_offices')
                            .select('*')
                            .eq('ward_name', w.ward_name)
                            .ilike('constituency', w.constituency)
                            .limit(1)
                            .maybeSingle();

                        if (finalOffice) {
                            // Perfect match found via geography context!
                            // We will trigger the canonical redirect in the next useEffect
                            setOffice(finalOffice);
                            // Set coordinates to center the map on the SEARCHED landmark, 
                            // not just the office centroid
                            // We'll use a hack of setting a local state or just navigating
                            const canonicalPath = `/${slugify(w.county)}/${slugify(w.constituency)}/${slugify(w.ward_name)}`;
                            navigate(`${canonicalPath}?lat=${lat}&lng=${lng}&q=${encodeURIComponent(searchString)}`, { replace: true });
                            return;
                        }
                    }
                }

                // Final fuzzy fallback on county as absolute last resort
                const { data: fuzzyData } = await supabase
                    .from('iebc_offices')
                    .select('id, county, constituency, constituency_name, office_location, latitude, longitude, verified, formatted_address, landmark, landmark_normalized, landmark_source, walking_effort, elevation_meters, geocode_verified, geocode_verified_at, multi_source_confidence, created_at, updated_at')
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
    }, [countySlug, constituencySlug, navigate]);

    useEffect(() => {
        if (countySlug) {
            fetchOfficeData();
        }
    }, [fetchOfficeData, countySlug]);

    // Live Intelligence — fetch travel + AI score when office has coordinates
    const fetchIntelligence = useCallback(async () => {
        if (!office?.latitude || !office?.longitude) return;
        setIntelligenceLoading(true);
        try {
            // Use saved user location or default to Nairobi CBD for score context
            const userLat = savedUserLocation?.latitude || -1.2921;
            const userLon = savedUserLocation?.longitude || 36.8219;
            const insights = await getTravelInsights(
                [userLat, userLon],
                [office.latitude, office.longitude],
                {
                    name: office.constituency_name,
                    county: office.county,
                    verified: office.verified
                }
            );
            setLiveIntelligence(insights);
        } catch {
            // Non-blocking
        } finally {
            setIntelligenceLoading(false);
        }
    }, [office, savedUserLocation]);

    useEffect(() => {
        if (office) fetchIntelligence();
    }, [office, fetchIntelligence]);

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
            try {
                await navigator.clipboard.writeText(url);
                toast.success('Link copied to clipboard');
            } catch (e) {
                toast.error('Failed to copy link');
            }
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
                    to="/map"
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
    const wardName = office.ward_name || deslugify(wardSlug);

    const displayTitle = wardSlug && office.ward_name ? `${wardName} Ward, ${officeName}` : officeName;
    const seoTitle = `${displayTitle} IEBC Office — ${countyName} County | Nasaka IEBC`;
    const seoDescription = `Find the IEBC constituency office for ${officeName}, ${countyName} County${wardSlug ? ` serving ${wardName} Ward` : ''}. Get directions, voter registration info, and community verified data.`;

    const breadcrumbItems = [
        { name: 'Home', url: '/' },
        { name: 'Nasaka IEBC', url: '/' },
        { name: countyName, url: `/${slugify(countyName)}` },
        {
            name: officeName,
            url: `/${slugify(countyName)}/${slugify(officeName)}${slugify(officeName) === slugify(countyName) ? '-town' : ''}`
        }
    ];

    if (wardSlug && office.ward_name) {
        breadcrumbItems.push({
            name: office.ward_name,
            url: `/${slugify(countyName)}/${slugify(officeName)}${slugify(officeName) === slugify(countyName) ? '-town' : ''}/${slugify(office.ward_name)}`
        });
    }

    // Canonical logic
    let canonical = `/${slugify(countyName)}/${slugify(officeName)}${slugify(officeName) === slugify(countyName) ? '-town' : ''}`;
    if (wardSlug && office.ward_name) canonical += `/${slugify(office.ward_name)}`;

    return (
        <div className={`min-h-screen pb-20 transition-colors duration-500 ${isDark ? 'bg-ios-gray-900 text-white' : 'bg-ios-gray-50 text-ios-gray-900'}`}>
            <SEOHead
                title={seoTitle}
                description={seoDescription}
                canonical={canonical}
                schema={[
                    generateOfficeSchema(office),
                    generateBreadcrumbSchema(breadcrumbItems),
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
                    <h1 className="text-lg font-semibold truncate px-4">
                        {wardSlug && office.ward_name ? `${office.ward_name} Ward` : officeName}
                    </h1>
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
                        onClick={() => navigate('/map', {
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
                                center={[overrideLat || office.latitude, overrideLng || office.longitude]}
                                zoom={overrideLat ? 16 : 14}
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

                                {overrideLat && overrideLng && (
                                    <>
                                        <RadiusCircle
                                            center={[overrideLat, overrideLng]}
                                            radiusKm={calculateDistance(overrideLat, overrideLng, office.latitude, office.longitude)}
                                            animating={true}
                                        />
                                        <Marker
                                            position={[overrideLat, overrideLng]}
                                            icon={L.divIcon({
                                                html: `<div style="width:24px;height:24px;background:#059669;border-radius:50%;border:2px solid white;box-shadow:0 2px 4px rgba(0,0,0,0.2);display:flex;align-items:center;justify-content:center">
                                                        <div style="width:8px;height:8px;background:white;border-radius:50%"></div>
                                                    </div>`,
                                                className: '',
                                                iconSize: [24, 24],
                                                iconAnchor: [12, 12]
                                            })}
                                        >
                                            <Popup>
                                                <div className="text-sm font-bold">Search Location: {originalSearch || 'Resolved Landmark'}</div>
                                                <div className="text-xs">Nearest IEBC Office is {officeName}</div>
                                            </Popup>
                                        </Marker>
                                    </>
                                )}
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

                {/* More About Area CTA (USER REQUESTED PRIORITY) */}
                <section className="mb-4">
                    <button
                        onClick={() => {
                            const countySlug = slugify(office.county || 'kenya');
                            navigate(`/${countySlug}`);
                        }}
                        className={`w-full py-4 px-6 rounded-3xl flex items-center justify-center gap-3 transition-all active:scale-95 shadow-lg ${isDark
                            ? 'bg-[#0b63c6] text-white shadow-[#0b63c6]/20 hover:bg-[#0b63c6]/90'
                            : 'bg-[#0b63c6] text-white shadow-blue-500/20 hover:bg-[#0851a1]'
                            }`}
                    >
                        <span className="font-bold text-center">
                            {(() => {
                                const { county, constituency_name, ward_name } = office;
                                let area = '';

                                // PRIORITY LIST:
                                // i) CONSTITUENCY, COUNTY
                                // ii) COUNTY
                                // iii) WARD, CONSTITUENCY
                                // iv) WARD, COUNTY
                                // v) CONSTITUENCY
                                // vi) WARD, CONSTITUENCY, COUNTY
                                // vii) WARD
                                if (constituency_name && county) {
                                    area = `${constituency_name}, ${county}`; // i
                                } else if (county) {
                                    area = county; // ii
                                } else if (ward_name && constituency_name) {
                                    area = `${ward_name}, ${constituency_name}`; // iii
                                } else if (ward_name && county) {
                                    area = `${ward_name}, ${county}`; // iv
                                } else if (constituency_name) {
                                    area = constituency_name; // v
                                } else if (ward_name && constituency_name && county) {
                                    area = `${ward_name}, ${constituency_name}, ${county}`; // vi
                                } else if (ward_name) {
                                    area = ward_name; // vii
                                } else {
                                    area = 'this area';
                                }

                                return t('bottomSheet.moreAboutArea', { area });
                            })()}
                        </span>
                        <ArrowRight className="w-5 h-5" />
                    </button>
                </section>

                {/* Live Intelligence Section */}
                {(liveIntelligence || intelligenceLoading) && (
                    <section className={`rounded-3xl p-6 border ${isDark ? 'bg-gradient-to-br from-blue-900/20 to-transparent border-blue-800/30' : 'bg-gradient-to-br from-blue-50 to-white border-blue-100'}`}>
                        <div className="flex items-center justify-between mb-4">
                            <h3 className="text-lg font-bold flex items-center gap-2">
                                <div className={`w-2 h-2 rounded-full ${intelligenceLoading ? 'bg-yellow-500 animate-pulse' : 'bg-green-500'}`} />
                                Live Intelligence
                            </h3>
                            <button
                                onClick={fetchIntelligence}
                                disabled={intelligenceLoading}
                                className={`text-xs font-medium px-3 py-1.5 rounded-full transition-all active:scale-95 ${isDark ? 'bg-blue-500/20 text-blue-300 hover:bg-blue-500/30' : 'bg-blue-100 text-[#0b63c6] hover:bg-blue-200'} ${intelligenceLoading ? 'opacity-50' : ''}`}
                            >
                                {intelligenceLoading ? 'Checking...' : 'Refresh'}
                            </button>
                        </div>

                        {intelligenceLoading && !liveIntelligence ? (
                            <div className="flex items-center justify-center py-6">
                                <div className="w-6 h-6 border-2 border-[#0b63c6] border-t-transparent rounded-full animate-spin" />
                                <span className={`ml-3 text-sm ${isDark ? 'text-ios-gray-400' : 'text-gray-500'}`}>Consulting AI providers...</span>
                            </div>
                        ) : liveIntelligence ? (
                            <div className="space-y-3">
                                {/* Weather Row */}
                                <div className="flex items-center justify-between">
                                    <span className={`text-sm ${isDark ? 'text-ios-gray-300' : 'text-gray-600'}`}>Weather</span>
                                    <span className="text-sm font-semibold">
                                        {liveIntelligence.weatherDesc}
                                        {liveIntelligence.temperature !== null && ` • ${liveIntelligence.temperature}°C`}
                                    </span>
                                </div>

                                {/* Wind + Rain */}
                                <div className="flex items-center justify-between">
                                    <span className={`text-sm ${isDark ? 'text-ios-gray-300' : 'text-gray-600'}`}>Conditions</span>
                                    <span className="text-sm font-semibold">
                                        {liveIntelligence.windSpeed !== null && `Wind ${liveIntelligence.windSpeed} km/h`}
                                        {liveIntelligence.precipProb > 0 && ` • ${liveIntelligence.precipProb}% rain`}
                                        {(!liveIntelligence.windSpeed && !liveIntelligence.precipProb) && 'N/A'}
                                    </span>
                                </div>

                                {/* Algorithm Score */}
                                <div className="flex items-center justify-between">
                                    <span className={`text-sm ${isDark ? 'text-ios-gray-300' : 'text-gray-600'}`}>Visit Difficulty</span>
                                    <span className={`text-sm font-bold px-2 py-0.5 rounded-full ${liveIntelligence.severity === 'low' ? 'bg-green-500/20 text-green-600 dark:text-green-400'
                                        : liveIntelligence.severity === 'medium' ? 'bg-yellow-500/20 text-yellow-600 dark:text-yellow-400'
                                            : 'bg-red-500/20 text-red-600 dark:text-red-400'
                                        }`}>{liveIntelligence.score}/100</span>
                                </div>

                                {/* AI Intelligence — Nasaka Blue Theme */}
                                {liveIntelligence.aiScore !== null && liveIntelligence.aiScore !== undefined && (
                                    <div className={`mt-2 p-3 rounded-xl border ${isDark ? 'bg-[#0b63c6]/10 border-[#0b63c6]/30' : 'bg-blue-50 border-blue-200'}`}>
                                        <div className="flex items-center justify-between mb-1">
                                            <span className={`text-xs font-bold uppercase tracking-wider ${isDark ? 'text-blue-400' : 'text-[#0b63c6]'}`}>
                                                AI Intelligence
                                            </span>
                                            <div className="flex items-center gap-1.5">
                                                {liveIntelligence.aiGroundTruthVerified && (
                                                    <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-green-500/20 text-green-600 dark:text-green-400 font-bold">✓ Verified</span>
                                                )}
                                                <span className={`text-lg font-black ${liveIntelligence.aiScore <= 25 ? 'text-green-500'
                                                    : liveIntelligence.aiScore <= 50 ? 'text-yellow-500'
                                                        : liveIntelligence.aiScore <= 75 ? 'text-orange-500'
                                                            : 'text-red-500'
                                                    }`}>{liveIntelligence.aiScore}<span className="text-xs opacity-60">/100</span></span>
                                            </div>
                                        </div>
                                        {liveIntelligence.aiReason && (
                                            <p className={`text-xs leading-relaxed ${isDark ? 'text-blue-100/70' : 'text-blue-900/70'}`}>
                                                {liveIntelligence.aiReason}
                                            </p>
                                        )}
                                        {liveIntelligence.aiGroundTruthNote && (
                                            <p className={`text-[10px] mt-1 italic ${isDark ? 'text-ios-gray-400' : 'text-gray-500'}`}>
                                                🌍 {liveIntelligence.aiGroundTruthNote}
                                            </p>
                                        )}
                                        <p className={`text-[9px] mt-1.5 ${isDark ? 'text-ios-gray-500' : 'text-gray-400'}`}>
                                            Powered by <span className="font-bold uppercase text-[#0b63c6]">{liveIntelligence.aiProvider === 'consensus' ? 'Nasaka Consensus' : liveIntelligence.aiProvider}</span> • {liveIntelligence.aiConfidence} confidence
                                        </p>
                                    </div>
                                )}

                                {liveIntelligence.stale && (
                                    <p className={`text-[10px] italic text-center mt-2 ${isDark ? 'text-ios-gray-500' : 'text-gray-400'}`}>⏱ Data may be stale — tap Refresh for latest</p>
                                )}
                            </div>
                        ) : null}
                    </section>
                )}


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
        </div >
    );
};

export default OfficeDetail;

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
import Avatar from 'boring-avatars';
import { toDecimalDegrees, isValidKenyaCoordinate, safeLatLng } from '@/utils/geoUtils';

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
    const { county: rawCounty, constituency: rawConstituency, ward: rawWard, index: rawIndex } = useParams();
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

    const [isECVRExpanded, setIsECVRExpanded] = useState(false);
    const [isIntelligenceExpanded, setIsIntelligenceExpanded] = useState(false);
    const [office, setOffice] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [nearbyOffices, setNearbyOffices] = useState([]);
    const [liveIntelligence, setLiveIntelligence] = useState(null);
    const [intelligenceLoading, setIntelligenceLoading] = useState(false);
    const [confirmations, setConfirmations] = useState([]);
    const [wards, setWards] = useState([]);
    const [contributionImage, setContributionImage] = useState(null);
    const [wardOffices, setWardOffices] = useState([]);

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
    const indexParam = rawIndex ? parseInt(rawIndex, 10) : null;

    // Route Whitelist / Exclusions
    const SYSTEM_ROUTES = ['map', 'api', '404', 'iebc-office', 'docs', 'pricing', 'legal', 'auth', 'admin', 'voter-services', 'boundary-review', 'election-resources', 'data-api', 'voter-registration'];
    const isSystemRoute = useMemo(() => {
        return SYSTEM_ROUTES.includes(countySlug) || SYSTEM_ROUTES.includes(constituencySlug);
    }, [countySlug, constituencySlug]);

    // Disambiguation Metadata
    const officeName = useMemo(() => {
        if (!office) return 'IEBC Office';
        // Use the specific location name if it differs from the constituency name for unique identification
        return office.office_location || office.constituency_name || 'IEBC Office';
    }, [office]);

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
        if (indexParam && wardOffices.length > 1) expectedPath += `/${indexParam}`;

        if (isLegacyPath || (window.location.pathname !== expectedPath && !location.search)) {
            navigate(expectedPath, { replace: true });
        }
    }, [office, navigate, location.pathname, wardSlug, indexParam, wardOffices]);

    const fetchOfficeData = useCallback(async () => {
        if (isSystemRoute) return;
        setLoading(true);
        setError(null);
        try {
            const countySearch = deslugify(countySlug);
            const constituencySearch = deslugify(constituencySlug).replace(/-town$/, '');
            const searchParams = new URLSearchParams(location.search);

            // Sanitize coordinates from URL
            const rawLat = parseFloat(searchParams.get('lat'));
            const rawLng = parseFloat(searchParams.get('lng'));
            const lat = (rawLat != null && !isNaN(rawLat)) ? toDecimalDegrees(rawLat, true) : null;
            const lng = (rawLng != null && !isNaN(rawLng)) ? toDecimalDegrees(rawLng, false) : null;

            let data = null;

            if (wardSlug) {
                const wardSearch = deslugify(wardSlug);
                // 1. Try ward match — fetch ALL offices in this ward for disambiguation
                const { data: wardResults, error: e0 } = await supabase
                    .from('iebc_offices')
                    .select('id, county, constituency, constituency_code, constituency_name, office_location, latitude, longitude, verified, formatted_address, landmark, landmark_normalized, landmark_source, walking_effort, elevation_meters, geocode_verified, geocode_verified_at, multi_source_confidence, created_at, updated_at, ward_name:ward')
                    .ilike('ward', `%${wardSearch}%`)
                    .ilike('constituency_name', `%${constituencySearch}%`)
                    .order('office_location', { ascending: true });

                if (e0) throw e0;

                if (wardResults && wardResults.length > 0) {
                    setWardOffices(wardResults);

                    if (wardResults.length === 1) {
                        data = wardResults[0];
                    } else if (indexParam && indexParam >= 1 && indexParam <= wardResults.length) {
                        data = wardResults[indexParam - 1];
                    } else if (indexParam && (indexParam < 1 || indexParam > wardResults.length)) {
                        data = wardResults[0];
                    } else {
                        data = wardResults[0];
                    }
                }
            }

            if (!data && constituencySearch) {
                // 2. Try constituency match
                const { data: d1, error: e1 } = await supabase
                    .from('iebc_offices')
                    .select('id, county, constituency, constituency_code, constituency_name, office_location, latitude, longitude, verified, formatted_address, landmark, landmark_normalized, landmark_source, walking_effort, elevation_meters, geocode_verified, geocode_verified_at, multi_source_confidence, created_at, updated_at, ward_name:ward')
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
                    .select('id, county, constituency, constituency_code, constituency_name, office_location, latitude, longitude, verified, formatted_address, landmark, landmark_normalized, landmark_source, walking_effort, elevation_meters, geocode_verified, geocode_verified_at, multi_source_confidence, created_at, updated_at, ward_name:ward')
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
                    try {
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
                                .eq('ward', w.ward_name)
                                .ilike('constituency', w.constituency)
                                .limit(1)
                                .maybeSingle();

                            if (finalOffice) {
                                setOffice(finalOffice);
                                const sLat = toDecimalDegrees(lat, true);
                                const sLng = toDecimalDegrees(lng, false);
                                const canonicalPath = `/${slugify(w.county)}/${slugify(w.constituency)}/${slugify(w.ward_name)}`;
                                navigate(`${canonicalPath}?lat=${sLat}&lng=${sLng}&q=${encodeURIComponent(searchString)}`, { replace: true });
                                return;
                            }
                        }
                    } catch (rpcError) {
                        console.warn('get_nearest_ward RPC unavailable, continuing with fuzzy fallback:', rpcError);
                    }
                }

                // Final fuzzy fallback on county as absolute last resort
                const { data: fuzzyData } = await supabase
                    .from('iebc_offices')
                    .select('id, county, constituency, constituency_code, constituency_name, office_location, latitude, longitude, verified, formatted_address, landmark, landmark_normalized, landmark_source, walking_effort, elevation_meters, geocode_verified, geocode_verified_at, multi_source_confidence, created_at, updated_at, ward_name:ward')
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
                .select('id, county, constituency_name, verified')
                .eq('county', data.county)
                .neq('id', data.id)
                .limit(5);

            setNearbyOffices(nearby || []);

        } catch (err) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    }, [countySlug, constituencySlug, navigate, wardSlug, indexParam]);

    useEffect(() => {
        if (countySlug) {
            fetchOfficeData();
        }
    }, [fetchOfficeData, countySlug]);

    // Fetch confirmations for verified-by badge
    useEffect(() => {
        if (!office?.id) return;
        const fetchConfirmations = async () => {
            try {
                const { data } = await supabase
                    .from('confirmations')
                    .select('user_id, is_accurate, notes, confirmed_at')
                    .eq('office_id', office.id)
                    .eq('is_accurate', true)
                    .order('confirmed_at', { ascending: false })
                    .limit(5);
                setConfirmations(data || []);
            } catch (_) {
                // Non-blocking
            }
        };
        fetchConfirmations();
    }, [office?.id]);

    // Fetch wards in this constituency
    useEffect(() => {
        if (!office?.constituency_name) return;
        const fetchWards = async () => {
            try {
                const { data } = await supabase
                    .from('iebc_offices')
                    .select('ward_name:ward, office_location, verified') // Aliased ward to ward_name
                    .ilike('constituency_name', office.constituency_name)
                    .not('ward', 'is', null)
                    .order('ward');
                // Deduplicate by ward_name
                const unique = [];
                const seen = new Set();
                (data || []).forEach(w => {
                    const normalized = (w.ward_name || '').toLowerCase().trim();
                    if (normalized && !seen.has(normalized)) {
                        seen.add(normalized);
                        unique.push(w);
                    }
                });
                setWards(unique);
            } catch (_) {
                // Non-blocking
            }
        };
        fetchWards();
    }, [office?.constituency_name]);

    // Fetch contribution image (if any)
    useEffect(() => {
        if (!office?.id) return;
        const fetchImage = async () => {
            try {
                const { data } = await supabase
                    .from('iebc_office_contributions')
                    .select('image_public_url')
                    .eq('original_office_id', office.id)
                    .eq('status', 'verified')
                    .not('image_public_url', 'is', null)
                    .order('created_at', { ascending: false })
                    .limit(1)
                    .maybeSingle();
                if (data?.image_public_url) {
                    setContributionImage(data.image_public_url);
                }
            } catch (_) {
                // Non-blocking
            }
        };
        fetchImage();
    }, [office?.id]);

    // Live Intelligence — fetch travel + AI score when office has coordinates
    const fetchIntelligence = useCallback(async () => {
        if (!office?.latitude || !office?.longitude) return;
        setIntelligenceLoading(true);
        try {
            // Use saved user location or default to Nairobi CBD for score context
            const [userLat, userLon] = safeLatLng(
                savedUserLocation?.latitude || -1.2921,
                savedUserLocation?.longitude || 36.8219
            );
            const [destLat, destLon] = safeLatLng(office.latitude, office.longitude);

            // Skip if destination is clearly not a valid Kenya coordinate
            if (!isValidKenyaCoordinate(destLat, destLon)) {
                console.warn('[OfficeDetail] Skipping intelligence for invalid coords:', destLat, destLon);
                setIntelligenceLoading(false);
                return;
            }

            const insights = await getTravelInsights(
                [userLat, userLon],
                [destLat, destLon],
                {
                    name: office.office_location || office.constituency_name,
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
                    title: `IEBC Office: ${officeName}`,
                    text: `Find directions and info for ${officeName} IEBC office in ${office.county} on Nasaka.`,
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

    if (isSystemRoute) return null;
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

    const countyName = office.county || 'Kenya';
    const wardName = office.ward_name || deslugify(wardSlug);
    const basePath = `/${slugify(countyName)}/${slugify(office.constituency_name)}${slugify(office.constituency_name) === slugify(office.county) ? '-town' : ''}/${slugify(wardName)}`;

    // Disambiguation UI: When a ward has multiple registration centers and no index is specified
    if (wardSlug && wardOffices.length > 1 && !indexParam) {
        return (
            <div className={`min-h-screen pb-20 transition-colors duration-500 ${isDark ? 'bg-ios-gray-900 text-white' : 'bg-ios-gray-50 text-ios-gray-900'}`}>
                <SEOHead
                    title={`${wardName} Ward Registration Centers — ${office.constituency_name}, ${countyName} | Nasaka IEBC`}
                    description={`${wardOffices.length} IEBC registration centers found in ${wardName} Ward, ${office.constituency_name}. Choose your nearest center for voter registration on Nasaka.`}
                    canonical={basePath}
                    schema={[
                        generateBreadcrumbSchema([
                            { name: 'Home', url: '/' },
                            { name: countyName, url: `/${slugify(countyName)}` },
                            { name: office.constituency_name, url: `/${slugify(countyName)}/${slugify(office.constituency_name)}${slugify(office.constituency_name) === slugify(office.county) ? '-town' : ''}` },
                            { name: `${wardName} Ward`, url: basePath }
                        ])
                    ]}
                />

                <header className={`sticky top-0 z-40 backdrop-blur-xl border-b transition-colors duration-300 ${isDark ? 'bg-ios-gray-900/80 border-ios-gray-800' : 'bg-white/80 border-ios-gray-100'}`}>
                    <div className="max-w-2xl mx-auto px-4 h-16 flex items-center justify-between">
                        <button onClick={() => navigate(-1)} className="p-2 -ml-2 rounded-full active:bg-ios-gray-200 dark:active:bg-ios-gray-800 transition-colors">
                            <ArrowLeft className="w-6 h-6" />
                        </button>
                        <h1 className="text-sm font-bold truncate">{wardName} Ward Centers</h1>
                        <div className="w-10" />
                    </div>
                </header>

                <main className="max-w-2xl mx-auto p-4 space-y-4">
                    <div className="px-1 mb-2">
                        <p className="text-2xl font-black">{wardOffices.length} Centers Found</p>
                        <p className="text-sm text-muted-foreground">Select the nearest center in {wardName} Ward.</p>
                    </div>

                    <div className="space-y-3">
                        {wardOffices.map((off, idx) => (
                            <Link
                                key={off.id}
                                to={`${basePath}/${idx + 1}`}
                                className={`block p-5 rounded-3xl border transition-all active:scale-[0.98] ${isDark ? 'bg-ios-gray-800/50 border-ios-gray-800' : 'bg-white border-ios-gray-100 shadow-sm'}`}
                            >
                                <div className="flex items-center justify-between mb-2">
                                    <span className="text-xs font-bold uppercase tracking-widest text-ios-blue">Center #{idx + 1}</span>
                                    {off.verified && (
                                        <div className="flex items-center gap-1 bg-green-500/10 text-green-500 px-2 py-0.5 rounded-full text-[10px] font-black uppercase">
                                            <CheckCircle2 className="w-3 h-3" />
                                            Verified
                                        </div>
                                    )}
                                </div>
                                <h3 className="text-lg font-bold mb-1">{off.office_location || `IEBC Office ${idx + 1}`}</h3>
                                <p className="text-xs text-muted-foreground line-clamp-1">{off.formatted_address || off.landmark || 'Detailed address in verification'}</p>
                            </Link>
                        ))}
                    </div>
                </main>
            </div>
        );
    }


    // Derived SEO / Breadcrumb Metadata
    const displayTitle = wardSlug && office.ward_name
        ? (indexParam && wardOffices.length > 1
            ? `${wardName} Ward Center #${indexParam}, ${officeName}`
            : `${wardName} Ward, ${officeName}`)
        : officeName;
    const seoTitle = `${displayTitle} IEBC Office — ${countyName} County | Nasaka IEBC`;
    const seoDescription = `Find the IEBC constituency office for ${officeName}, ${countyName} County${wardSlug ? ` serving ${wardName} Ward` : ''}${indexParam && wardOffices.length > 1 ? ` (Center #${indexParam} of ${wardOffices.length})` : ''}. Get directions, voter registration info, and community verified data.`;

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
        const wardBreadcrumbUrl = `/${slugify(countyName)}/${slugify(officeName)}${slugify(officeName) === slugify(countyName) ? '-town' : ''}/${slugify(office.ward_name)}`;
        breadcrumbItems.push({
            name: office.ward_name,
            url: wardBreadcrumbUrl
        });
        if (indexParam && wardOffices.length > 1) {
            breadcrumbItems.push({
                name: `Center #${indexParam}`,
                url: `${wardBreadcrumbUrl}/${indexParam}`
            });
        }
    }

    // Canonical logic
    let canonical = `/${slugify(countyName)}/${slugify(officeName)}${slugify(officeName) === slugify(countyName) ? '-town' : ''}`;
    if (wardSlug && office.ward_name) canonical += `/${slugify(office.ward_name)}`;
    if (indexParam && wardOffices.length > 1) canonical += `/${indexParam}`;

    return (
        <div className={`min-h-screen pb-20 transition-colors duration-500 bg-topo-backdrop ${isDark ? 'bg-ios-gray-900 text-white' : 'bg-ios-gray-50 text-ios-gray-900'}`}>
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
                                <span className="text-[10px] font-bold text-green-600 mt-1 uppercase tracking-tight">{t('office.verified')}</span>
                            </div>
                        )}
                    </div>

                    <div className={`mt-6 p-4 rounded-2xl flex items-center gap-4 ${isDark ? 'bg-ios-gray-700/50' : 'bg-ios-gray-50'}`}>
                        <div className="w-12 h-12 rounded-xl bg-blue-500 flex items-center justify-center text-white shrink-0">
                            <MapPin className="w-6 h-6" />
                        </div>
                        <div className="flex-1 min-w-0">
                            <p className="text-xs text-muted-foreground font-medium uppercase tracking-wider">{t('bottomSheet.address')}</p>
                            <p className="text-sm font-medium leading-tight truncate">{office.office_location || t('office.addressVerifying')}</p>
                        </div>
                    </div>

                    {/* Contribution Image — conditional */}
                    {contributionImage && (
                        <div className="mt-4 rounded-2xl overflow-hidden border border-ios-gray-100 dark:border-ios-gray-700">
                            <img
                                src={contributionImage}
                                alt={`${officeName} ${t('office.office')}`}
                                className="w-full h-48 object-cover"
                                loading="lazy"
                            />
                            <div className={`px-3 py-2 text-[10px] font-medium uppercase tracking-wider ${isDark ? 'bg-ios-gray-700/50 text-ios-gray-400' : 'bg-ios-gray-50 text-muted-foreground'}`}>
                                {t('office.communityPhoto')}
                            </div>
                        </div>
                    )}
                </section>

                {/* Quick Actions */}
                <section className="grid grid-cols-2 gap-3">
                    <button
                        onClick={() => window.open(`https://www.google.com/maps/dir/?api=1&destination=${office.latitude},${office.longitude}`, '_blank')}
                        className="flex flex-col items-center justify-center p-4 rounded-3xl bg-blue-500 text-white shadow-lg shadow-blue-500/20 active:scale-95 transition-transform"
                    >
                        <Navigation className="w-6 h-6 mb-2" />
                        <span className="text-sm font-semibold">{t('bottomSheet.directions')}</span>
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
                        <span className="text-sm font-semibold">{t('officeList.viewOnMap')}</span>
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
                            <span className="text-xs font-mono font-bold">{office.constituency_code != null ? String(office.constituency_code).padStart(3, '0') : '---'}</span>
                        </div>
                    </div>
                </section>



                {/* Live Intelligence Section */}
                <section className={`rounded-3xl border transition-all duration-300 ${isDark ? 'bg-gradient-to-br from-blue-900/20 to-transparent border-blue-800/30' : 'bg-gradient-to-br from-blue-50 to-white border-blue-100'}`}>
                    <div
                        role="button"
                        tabIndex={0}
                        onClick={() => setIsIntelligenceExpanded(!isIntelligenceExpanded)}
                        className="w-full p-6 flex items-center justify-between text-left group cursor-pointer focus:outline-none"
                    >
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-full bg-blue-500/10 flex items-center justify-center text-ios-blue">
                                <Info className="w-5 h-5" />
                            </div>
                            <div>
                                <h3 className="text-lg font-bold flex items-center gap-2">
                                    {t('intelligence.title')}
                                    <div className={`w-1.5 h-1.5 rounded-full ${intelligenceLoading ? 'bg-yellow-500 animate-pulse' : 'bg-green-500'}`} />
                                </h3>
                                {liveIntelligence ? (
                                    <div className="flex items-center gap-2 text-xs text-muted-foreground mt-0.5">
                                        <span>{liveIntelligence.weatherDesc} • {liveIntelligence.temperature}°C</span>
                                        <span className="opacity-20">|</span>
                                        <span className="font-bold text-ios-blue">{t('intelligence.score')}: {liveIntelligence.score}</span>
                                    </div>
                                ) : (
                                    <p className="text-xs text-muted-foreground">{t('intelligence.tapToCheck')}</p>
                                )}
                            </div>
                        </div>
                        <div className="flex items-center gap-3">
                            <button
                                onClick={(e) => {
                                    e.stopPropagation();
                                    fetchIntelligence();
                                }}
                                disabled={intelligenceLoading}
                                className={`p-2 rounded-xl transition-all active:scale-90 ${isDark ? 'bg-ios-gray-800/50 hover:bg-ios-gray-700' : 'bg-white hover:bg-ios-gray-100'} ${intelligenceLoading ? 'opacity-50' : ''}`}
                            >
                                <svg className={`w-4 h-4 ${intelligenceLoading ? 'animate-spin' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                                </svg>
                            </button>
                            <motion.div
                                animate={{ rotate: isIntelligenceExpanded ? 270 : 90 }}
                                transition={{ duration: 0.3, ease: [0.4, 0, 0.2, 1] }}
                                className={`p-2 rounded-full ${isDark ? 'bg-ios-gray-800 group-active:bg-ios-gray-700' : 'bg-ios-gray-100 group-active:bg-ios-gray-200'} transition-colors`}
                            >
                                <ChevronRight className="w-5 h-5 text-muted-foreground" />
                            </motion.div>
                        </div>
                    </div>

                    <AnimatePresence>
                        {isIntelligenceExpanded && (
                            <motion.div
                                initial={{ height: 0, opacity: 0 }}
                                animate={{ height: 'auto', opacity: 1 }}
                                exit={{ height: 0, opacity: 0 }}
                                transition={{ duration: 0.4, ease: [0.4, 0, 0.2, 1] }}
                                className="overflow-hidden"
                            >
                                <div className="p-6 pt-0 space-y-4">
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
                                                        <div className="mt-2 pt-2 border-t border-[#0b63c6]/20">
                                                            <p className={`text-[10px] italic ${isDark ? 'text-ios-gray-400' : 'text-gray-500'}`}>
                                                                {liveIntelligence.aiGroundTruthNote}
                                                            </p>
                                                        </div>
                                                    )}
                                                    <p className={`text-[9px] mt-1.5 ${isDark ? 'text-ios-gray-500' : 'text-gray-400'}`}>
                                                        Powered by <span className="font-bold uppercase text-[#0b63c6]">{liveIntelligence.aiProvider === 'consensus' ? 'Nasaka Consensus' : liveIntelligence.aiProvider}</span> • {liveIntelligence.aiConfidence} confidence
                                                    </p>
                                                </div>
                                            )}
                                        </div>
                                    ) : null}
                                    {liveIntelligence?.stale && (
                                        <p className={`text-[10px] italic text-center mt-2 ${isDark ? 'text-ios-gray-500' : 'text-gray-400'}`}>⏱ Data may be stale — tap Refresh for latest</p>
                                    )}
                                </div>
                            </motion.div>
                        )}
                    </AnimatePresence>
                </section>


                {/* Enhanced Voter Registration (ECVR / CVR) Section */}
                <section className={`rounded-3xl border transition-all duration-300 ${isDark ? 'bg-gradient-to-br from-green-900/10 to-transparent border-green-800/30' : 'bg-gradient-to-br from-green-50/50 to-white border-green-100'}`}>
                    <div
                        role="button"
                        tabIndex={0}
                        onClick={() => setIsECVRExpanded(!isECVRExpanded)}
                        className="w-full p-5 flex items-center justify-between text-left group cursor-pointer focus:outline-none"
                    >
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-full bg-green-500/10 flex items-center justify-center text-green-600 dark:text-green-400">
                                <CheckCircle2 className="w-5 h-5" />
                            </div>
                            <div>
                                <h3 className="text-lg font-bold">{t('office.voterRegTitle')}</h3>
                                <p className="text-xs text-muted-foreground">{t('office.voterRegTapDetails')}</p>
                            </div>
                        </div>
                        <motion.div
                            animate={{ rotate: isECVRExpanded ? 270 : 90 }}
                            transition={{ duration: 0.3, ease: [0.4, 0, 0.2, 1] }}
                            className={`p-2 rounded-full ${isDark ? 'bg-ios-gray-800 group-active:bg-ios-gray-700' : 'bg-ios-gray-100 group-active:bg-ios-gray-200'} transition-colors`}
                        >
                            <ChevronRight className="w-5 h-5 text-muted-foreground" />
                        </motion.div>
                    </div>

                    <AnimatePresence>
                        {isECVRExpanded && (
                            <motion.div
                                initial={{ height: 0, opacity: 0 }}
                                animate={{ height: 'auto', opacity: 1 }}
                                exit={{ height: 0, opacity: 0 }}
                                transition={{ duration: 0.4, ease: [0.4, 0, 0.2, 1] }}
                                className="overflow-hidden"
                            >
                                <div className="p-5 pt-0 space-y-5">
                                    {/* Status Banner */}
                                    <div className={`p-4 rounded-2xl flex items-start gap-3 ${isDark ? 'bg-green-950/40 border border-green-800/50' : 'bg-green-50 border border-green-100'}`}>
                                        <div className="mt-0.5">
                                            <div className="w-5 h-5 rounded-full bg-green-500 flex items-center justify-center flex-shrink-0">
                                                <CheckCircle2 className="w-3.5 h-3.5 text-white" />
                                            </div>
                                        </div>
                                        <div className="flex-1">
                                            <p className="font-semibold text-sm">{t('office.voterRegistrationDesc')}</p>
                                            <p className="text-xs text-muted-foreground mt-1">
                                                {t('office.voterRegDetailsSub')}
                                            </p>
                                        </div>
                                    </div>

                                    {/* Required Documents */}
                                    <div>
                                        <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-3 px-1">{t('office.requiredDocuments')}</p>
                                        <div className="grid grid-cols-1 gap-2 text-sm">
                                            <div className="flex items-center gap-3 bg-white/70 dark:bg-ios-gray-800/70 p-3 rounded-2xl border border-ios-gray-100 dark:border-ios-gray-700">
                                                <div className="w-7 h-7 rounded-lg bg-green-100 dark:bg-green-900/50 flex items-center justify-center text-green-600 dark:text-green-400 font-bold flex-shrink-0">
                                                    1
                                                </div>
                                                <div>
                                                    <p className="font-medium text-sm">{t('office.docID')}</p>
                                                    <p className="text-[10px] text-muted-foreground leading-tight">{t('office.docIDSub')}</p>
                                                </div>
                                            </div>
                                            <div className="flex items-center gap-3 bg-white/70 dark:bg-ios-gray-800/70 p-3 rounded-2xl border border-ios-gray-100 dark:border-ios-gray-700">
                                                <div className="w-7 h-7 rounded-lg bg-green-100 dark:bg-green-900/50 flex items-center justify-center text-green-600 dark:text-green-400 font-bold flex-shrink-0">
                                                    2
                                                </div>
                                                <div>
                                                    <p className="font-medium text-sm">{t('office.docPassport')}</p>
                                                    <p className="text-[10px] text-muted-foreground leading-tight">{t('office.docPassportSub')}</p>
                                                </div>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Services Offered at This Office */}
                                    <div>
                                        <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-3 px-1">{t('office.servicesAvailable')}</p>
                                        <ul className="space-y-3">
                                            <li className="flex gap-3">
                                                <div className="w-5 h-5 rounded-full bg-green-500/10 flex items-center justify-center flex-shrink-0 mt-0.5">
                                                    <CheckCircle2 className="w-3.5 h-3.5 text-green-500" />
                                                </div>
                                                <div className="flex-1">
                                                    <p className="font-medium text-sm">{t('office.serviceNewReg')}</p>
                                                    <p className="text-[10px] text-muted-foreground leading-tight">{t('office.serviceNewRegSub')}</p>
                                                </div>
                                            </li>
                                            <li className="flex gap-3">
                                                <div className="w-5 h-5 rounded-full bg-green-500/10 flex items-center justify-center flex-shrink-0 mt-0.5">
                                                    <CheckCircle2 className="w-3.5 h-3.5 text-green-500" />
                                                </div>
                                                <div className="flex-1">
                                                    <p className="font-medium text-sm">{t('office.serviceTransfer')}</p>
                                                    <p className="text-[10px] text-muted-foreground leading-tight">{t('office.serviceTransferSub')}</p>
                                                </div>
                                            </li>
                                            <li className="flex gap-3">
                                                <div className="w-5 h-5 rounded-full bg-green-500/10 flex items-center justify-center flex-shrink-0 mt-0.5">
                                                    <CheckCircle2 className="w-3.5 h-3.5 text-green-500" />
                                                </div>
                                                <div className="flex-1">
                                                    <p className="font-medium text-sm">{t('office.serviceUpdate')}</p>
                                                    <p className="text-[10px] text-muted-foreground leading-tight">{t('office.serviceUpdateSub')}</p>
                                                </div>
                                            </li>
                                            <li className="flex gap-3">
                                                <div className="w-5 h-5 rounded-full bg-green-500/10 flex items-center justify-center flex-shrink-0 mt-0.5">
                                                    <CheckCircle2 className="w-3.5 h-3.5 text-green-500" />
                                                </div>
                                                <div className="flex-1">
                                                    <p className="font-medium text-sm">{t('office.serviceReplacement')}</p>
                                                    <p className="text-[10px] text-muted-foreground leading-tight">{t('office.serviceReplacementSub')}</p>
                                                </div>
                                            </li>
                                        </ul>
                                    </div>

                                    {/* Practical Information */}
                                    <div className={`p-4 rounded-2xl text-[10px] leading-relaxed border ${isDark ? 'bg-ios-gray-900/50 border-ios-gray-700' : 'bg-white border-ios-gray-100'}`}>
                                        <p className="font-bold mb-1 uppercase tracking-wider text-[9px] text-muted-foreground opacity-60">Important Information</p>
                                        <ul className="space-y-1 text-muted-foreground list-disc pl-4 italic">
                                            <li>Bring original documents – photocopies are not accepted for new registration.</li>
                                            <li>Biometric (fingerprint + photo) capture is done on-site when CVR is active.</li>
                                            <li>Processing usually takes 10–30 minutes depending on queue size.</li>
                                            <li>Check the official IEBC website or call the constituency returning officer for current active registration dates.</li>
                                        </ul>
                                    </div>

                                    {/* CTA */}
                                    <button
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            window.open('https://verify.iebc.or.ke', '_blank');
                                        }}
                                        className="w-full py-4 px-6 bg-green-600 hover:bg-green-700 active:bg-green-800 text-white rounded-2xl font-bold text-xs flex items-center justify-center gap-2 shadow-lg shadow-green-500/20 transition-all active:scale-[0.985]"
                                    >
                                        <ExternalLink className="w-4 h-4" />
                                        Confirm Current Status on IEBC Portal
                                    </button>
                                </div>
                            </motion.div>
                        )}
                    </AnimatePresence>
                </section>

                {/* Nearby Offices */}
                {nearbyOffices.length > 0 && (
                    <section>
                        <h3 className="text-lg font-bold mb-4 px-1">{t('office.nearbyIn', { county: countyName })}</h3>
                        <div className="space-y-2">
                            {nearbyOffices.filter(nob => nob.constituency_name).map((nob, nobIdx) => (
                                <Link
                                    key={`${nob.constituency_name}-${nob.id || nobIdx}`}
                                    to={`/${slugify(countyName)}/${slugify(nob.constituency_name)}${slugify(nob.constituency_name) === slugify(countyName) ? '-town' : ''}`}
                                    className={`flex items-center justify-between p-4 rounded-2xl border transition-all active:scale-[0.98] ${isDark ? 'bg-ios-gray-800/50 border-ios-gray-800 hover:bg-ios-gray-800' : 'bg-white border-ios-gray-100 hover:bg-ios-gray-50'}`}
                                >
                                    <div className="flex items-center gap-3">
                                        <div className="w-8 h-8 rounded-full bg-ios-gray-100 dark:bg-ios-gray-700 flex items-center justify-center">
                                            <MapPin className="w-4 h-4 text-ios-blue" />
                                        </div>
                                        <div>
                                            <p className="text-sm font-semibold">{nob.constituency_name}</p>
                                            <p className="text-[10px] text-muted-foreground uppercase tracking-wider">{nob.verified ? t('office.verified') : t('office.unverified')}</p>
                                        </div>
                                    </div>
                                    <ChevronRight className="w-5 h-5 text-muted-foreground opacity-50" />
                                </Link>
                            ))}
                        </div>
                    </section>
                )}

                {/* Wards in this Constituency */}
                {wards.length > 0 && !wardSlug && (
                    <section>
                        <h3 className="text-lg font-bold mb-4 px-1">{t('office.wardsIn', { office: officeName })}</h3>
                        <div className="space-y-2">
                            {wards.filter(w => w.ward_name).map((w, wIdx) => (
                                <Link
                                    key={`${w.ward_name}-${w.id || wIdx}`}
                                    to={`/${slugify(countyName)}/${slugify(officeName)}${slugify(officeName) === slugify(countyName) ? '-town' : ''}/${slugify(w.ward_name)}`}
                                    className={`flex items-center justify-between p-4 rounded-2xl border transition-all active:scale-[0.98] ${isDark ? 'bg-ios-gray-800/50 border-ios-gray-800 hover:bg-ios-gray-800' : 'bg-white border-ios-gray-100 hover:bg-ios-gray-50'}`}
                                >
                                    <div className="flex items-center gap-3">
                                        <div className="w-8 h-8 rounded-full bg-ios-gray-100 dark:bg-ios-gray-700 flex items-center justify-center">
                                            <MapPin className="w-4 h-4 text-ios-blue" />
                                        </div>
                                        <div>
                                            <p className="text-sm font-semibold">{w.ward_name}</p>
                                            <p className="text-[10px] text-muted-foreground uppercase tracking-wider">
                                                {w.verified ? t('office.verified') : t('office.unverified')}
                                            </p>
                                        </div>
                                    </div>
                                    <ChevronRight className="w-5 h-5 text-muted-foreground opacity-50" />
                                </Link>
                            ))}
                        </div>
                    </section>
                )}

                {/* Polling Stations in this Ward */}
                {wardSlug && (
                    <section>
                        <h3 className="text-lg font-bold mb-4 px-1">Polling Stations in {wardName}</h3>
                        <div className={`p-8 text-center rounded-3xl border ${isDark ? 'bg-ios-gray-800/30 border-ios-gray-800' : 'bg-white border-ios-gray-100'}`}>
                            <AlertCircle className="w-8 h-8 text-ios-blue mx-auto mb-3 opacity-40" />
                            <p className="text-sm font-medium">Digital Polling Station registry is coming soon.</p>
                            <p className="text-xs text-muted-foreground mt-1">Verification of 40,000+ locations is in progress by the community.</p>
                        </div>
                    </section>
                )}

                {/* Go Back To Map CTA - Moved to bottom per user request */}
                <section className="mb-6 mt-4">
                    <button
                        onClick={() => navigate('/map', {
                            state: {
                                selectedOffice: office,
                                ...(savedUserLocation ? { userLocation: savedUserLocation } : {})
                            }
                        })}
                        className={`w-full py-4 px-6 rounded-3xl flex items-center justify-center gap-3 transition-all active:scale-95 shadow-lg ${isDark
                            ? 'bg-[#0b63c6] text-white shadow-[#0b63c6]/20 hover:bg-[#0b63c6]/90'
                            : 'bg-[#0b63c6] text-white shadow-blue-500/20 hover:bg-[#0851a1]'
                            }`}
                    >
                        <ArrowLeft className="w-5 h-5" />
                        <span className="font-bold text-center uppercase tracking-wider text-sm">
                            Go Back to Map
                        </span>
                    </button>
                </section>

                <footer className="text-center pt-8">
                    {/* Verified-by Badges */}
                    {confirmations.length > 0 ? (
                        <div className="space-y-3 mb-6">
                            <h4 className="text-xs font-bold uppercase tracking-widest text-muted-foreground">{t('office.verifiedBy')}</h4>
                            <div className="flex flex-wrap justify-center gap-3">
                                {confirmations.slice(0, 3).map((conf, idx) => {
                                    const isCeka = conf.user_id === 'ceka' || conf.user_id?.startsWith('ceka-');
                                    const displayName = isCeka ? 'CEKA' : conf.user_id ? `User ${conf.user_id.slice(0, 6)}` : 'Anonymous';
                                    const timeAgo = (() => {
                                        if (!conf.created_at) return 'Recently';
                                        const diff = Date.now() - new Date(conf.created_at).getTime();
                                        const days = Math.floor(diff / (1000 * 60 * 60 * 24));
                                        if (days === 0) return 'Today';
                                        if (days === 1) return 'Yesterday';
                                        if (days < 30) return `${days}d ago`;
                                        return `${Math.floor(days / 30)}mo ago`;
                                    })();
                                    return (
                                        <div key={idx} className="verified-by-badge">
                                            <div className="verified-by-avatar">
                                                {isCeka ? (
                                                    <div className="w-full h-full bg-white flex items-center justify-center p-1 overflow-hidden">
                                                        <img src="/ceka-logo.svg" alt="CEKA Logo" className="w-full h-full object-contain" />
                                                    </div>
                                                ) : (
                                                    <Avatar
                                                        size={36}
                                                        name={conf.user_id || `anon-${idx}`}
                                                        variant="beam"
                                                        colors={['#007AFF', '#34C759', '#FF9500', '#AF52DE', '#0b63c6']}
                                                    />
                                                )}
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <p className="text-xs font-semibold truncate">{displayName}</p>
                                                <p className="text-[10px] text-muted-foreground">{timeAgo}</p>
                                            </div>
                                            <svg className="w-4 h-4 text-green-500 flex-shrink-0" viewBox="0 0 24 24" fill="currentColor">
                                                <path d="M12 1l3.09 6.26L22 8.27l-5 4.87 1.18 6.88L12 16.77l-6.18 3.25L7 13.14 2 8.27l6.91-1.01L12 1z" />
                                            </svg>
                                        </div>
                                    );
                                })}
                            </div>
                            {confirmations.length > 3 && (
                                <p className="text-[10px] text-muted-foreground">+{confirmations.length - 3} more verifiers</p>
                            )}
                        </div>
                    ) : (
                        <div className="opacity-40 mb-4">
                            <p className="text-[10px] font-medium tracking-widest uppercase">
                                Data provided by CEKA community. Join <a href="https://www.civiceducationkenya.com/join-community" target="_blank" rel="noopener noreferrer" className="underline hover:text-blue-500 transition-colors">here</a>
                            </p>
                        </div>
                    )}
                    <p className="text-[10px] opacity-40 mt-1">
                        {t('office.lastUpdated')}: {office.updated_at ? new Date(office.updated_at).toLocaleDateString() : t('office.recently')}
                    </p>
                </footer>
            </main>
        </div >
    );
};

export default OfficeDetail;

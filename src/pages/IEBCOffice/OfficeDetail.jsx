/**
 * OfficeDetail.jsx
 * ─────────────────────────────────────────────────────────────────────────
 * SEO-optimized individual IEBC office page.
 * Deep iOS implementation using index.css design tokens.
 *
 * Routes:
 *   /iebc-office/:county/:constituency → Individual office page
 *   /iebc-office/:county              → County overview (redirects to map with filter)
 */

import React, { useEffect, useState, useMemo } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { useTheme } from '@/contexts/ThemeContext';
import { useTranslation } from 'react-i18next';
import { supabase } from '@/integrations/supabase/client';
import {
    SEOHead,
    generateOfficeSchema,
    generateBreadcrumbSchema,
    generateFAQSchema,
    generateWebsiteSchema,
    slugify,
    deslugify,
} from '@/components/SEO/SEOHead';
import { MapPin, Navigation, Clock, Phone, ChevronLeft, ExternalLink, Shield, CheckCircle, AlertTriangle, Share2, Copy, Map as MapIcon } from 'lucide-react';

// ─── URL Sanitization (XSS / injection protection) ──────────────────────────
function sanitizeSlug(slug) {
    if (!slug) return '';
    return slug
        .replace(/[^a-z0-9-]/gi, '')
        .toLowerCase()
        .substring(0, 100);
}

// ─── Fuzzy Matching for misspelled slugs ─────────────────────────────────────
function levenshtein(a, b) {
    const dp = Array.from({ length: a.length + 1 }, (_, i) =>
        Array.from({ length: b.length + 1 }, (_, j) => (i === 0 ? j : j === 0 ? i : 0))
    );
    for (let i = 1; i <= a.length; i++) {
        for (let j = 1; j <= b.length; j++) {
            dp[i][j] = Math.min(
                dp[i - 1][j] + 1,
                dp[i][j - 1] + 1,
                dp[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1)
            );
        }
    }
    return dp[a.length][b.length];
}

function findBestMatch(target, candidates) {
    if (!target || !candidates.length) return null;
    let best = null;
    let bestDist = Infinity;
    for (const c of candidates) {
        const dist = levenshtein(target, slugify(c));
        if (dist < bestDist) {
            bestDist = dist;
            best = c;
        }
    }
    // Only accept matches with distance <= 3 (allows common typos)
    return bestDist <= 3 ? best : null;
}

// ─── Office Detail Component ─────────────────────────────────────────────────
const OfficeDetail = () => {
    const { county: rawCounty, constituency: rawConstituency } = useParams();
    const navigate = useNavigate();
    const { theme } = useTheme();
    const { t } = useTranslation('nasaka');

    // Sanitize URL params
    const countySlug = sanitizeSlug(rawCounty);
    const constituencySlug = sanitizeSlug(rawConstituency);

    const [office, setOffice] = useState(null);
    const [nearbyOffices, setNearbyOffices] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [coordinatesCopied, setCopied] = useState(false);

    // Fetch office data from Supabase
    useEffect(() => {
        const fetchOffice = async () => {
            setLoading(true);
            setError(null);

            try {
                // Fetch all offices to perform fuzzy matching
                const { data: allOffices, error: fetchError } = await supabase
                    .from('iebc_offices')
                    .select('*')
                    .not('latitude', 'is', null)
                    .not('longitude', 'is', null);

                if (fetchError) throw fetchError;
                if (!allOffices || allOffices.length === 0) {
                    setError('no_offices');
                    return;
                }

                // Try exact slug match first
                let matched = null;

                if (constituencySlug) {
                    matched = allOffices.find((o) => {
                        const oCounty = slugify(o.county || '');
                        const oConst = slugify(o.constituency_name || o.constituency || o.office_location || '');
                        return oCounty === countySlug && oConst === constituencySlug;
                    });

                    // Fuzzy match if exact fails
                    if (!matched) {
                        const countyOffices = allOffices.filter(
                            (o) => slugify(o.county || '') === countySlug
                        );
                        if (countyOffices.length > 0) {
                            const candidateNames = countyOffices.map(
                                (o) => o.constituency_name || o.constituency || o.office_location || ''
                            );
                            const bestName = findBestMatch(constituencySlug, candidateNames);
                            if (bestName) {
                                matched = countyOffices.find(
                                    (o) => (o.constituency_name || o.constituency || o.office_location) === bestName
                                );
                                // Redirect to correct URL for SEO canonicalization
                                if (matched) {
                                    const correctSlug = slugify(bestName);
                                    if (correctSlug !== constituencySlug) {
                                        navigate(`/iebc-office/${countySlug}/${correctSlug}`, { replace: true });
                                        return;
                                    }
                                }
                            }
                        }
                    }
                }

                // County-only mode: redirect to map with county filter
                if (!constituencySlug && countySlug) {
                    const countyName = deslugify(countySlug);
                    navigate(`/iebc-office/map?q=${encodeURIComponent(countyName)}`, { replace: true });
                    return;
                }

                if (!matched) {
                    setError('not_found');
                    return;
                }

                setOffice(matched);

                // Find nearby offices (same county, different constituency)
                const nearby = allOffices
                    .filter(
                        (o) =>
                            slugify(o.county || '') === countySlug &&
                            o.id !== matched.id &&
                            o.latitude &&
                            o.longitude
                    )
                    .slice(0, 5);
                setNearbyOffices(nearby);
            } catch (err) {
                console.error('Office fetch error:', err);
                setError('fetch_error');
            } finally {
                setLoading(false);
            }
        };

        fetchOffice();
    }, [countySlug, constituencySlug, navigate]);

    // ─── Loading State (iOS-style) ───────────────────────────────────────────
    if (loading) {
        return (
            <div className={`min-h-screen flex items-center justify-center transition-colors duration-500 ${theme === 'dark' ? 'bg-[hsl(var(--background))]' : 'bg-gradient-to-br from-green-50/30 to-white'
                }`}>
                <SEOHead
                    title={`Loading IEBC Office — ${deslugify(countySlug)} | Nasaka IEBC`}
                    description="Loading IEBC office information..."
                    noIndex
                />
                <motion.div
                    className="flex flex-col items-center gap-4"
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ duration: 0.3 }}
                >
                    <div className="relative w-16 h-16">
                        <div className={`absolute inset-0 rounded-full animate-ping ${theme === 'dark' ? 'bg-blue-500/30' : 'bg-blue-400/20'
                            }`} />
                        <div className={`absolute inset-2 rounded-full flex items-center justify-center ${theme === 'dark' ? 'bg-blue-600' : 'bg-blue-500'
                            }`}>
                            <MapPin className="w-6 h-6 text-white" />
                        </div>
                    </div>
                    <p className={`text-sm font-medium ${theme === 'dark' ? 'text-gray-400' : 'text-gray-500'
                        }`}>
                        {t('common.loading', 'Loading...')}
                    </p>
                </motion.div>
            </div>
        );
    }

    // ─── Error / Not Found State ─────────────────────────────────────────────
    if (error || !office) {
        return (
            <div className={`min-h-screen flex items-center justify-center p-6 transition-colors duration-500 ${theme === 'dark' ? 'bg-[hsl(var(--background))]' : 'bg-gradient-to-br from-green-50/30 to-white'
                }`}>
                <SEOHead
                    title="IEBC Office Not Found — Nasaka IEBC"
                    description="The requested IEBC office could not be found. Use our interactive map to search for all 290+ IEBC offices across Kenya."
                    noIndex
                />
                <motion.div
                    className={`max-w-md w-full p-8 rounded-3xl border transition-all duration-300 ${theme === 'dark'
                            ? 'bg-[hsl(var(--card))] border-[hsl(var(--border))] shadow-ios-high-dark'
                            : 'bg-white border-gray-100 shadow-ios-high'
                        }`}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                >
                    <div className="text-center">
                        <div className={`mx-auto w-16 h-16 rounded-full flex items-center justify-center mb-4 ${theme === 'dark' ? 'bg-amber-500/20' : 'bg-amber-50'
                            }`}>
                            <AlertTriangle className={`w-8 h-8 ${theme === 'dark' ? 'text-amber-400' : 'text-amber-500'
                                }`} />
                        </div>
                        <h1 className={`text-2xl font-bold mb-2 ${theme === 'dark' ? 'text-white' : 'text-gray-900'
                            }`}>
                            Office Not Found
                        </h1>
                        <p className={`text-sm mb-6 ${theme === 'dark' ? 'text-gray-400' : 'text-gray-500'
                            }`}>
                            We couldn't find an IEBC office matching <span className={`font-mono text-xs px-2 py-1 rounded ${theme === 'dark' ? 'bg-gray-800' : 'bg-gray-100'
                                }`}>/{countySlug}/{constituencySlug}</span>
                        </p>
                        <div className="flex flex-col gap-3">
                            <Link
                                to="/iebc-office/map"
                                className={`px-6 py-3.5 rounded-2xl font-semibold text-sm text-white text-center transition-all duration-300 ${theme === 'dark'
                                        ? 'bg-blue-600 hover:bg-blue-700 shadow-lg shadow-blue-500/25'
                                        : 'bg-blue-500 hover:bg-blue-600 shadow-lg shadow-blue-400/25'
                                    }`}
                            >
                                <MapIcon className="w-4 h-4 inline-block mr-2" />
                                Search All Offices on Map
                            </Link>
                            <button
                                onClick={() => navigate(-1)}
                                className={`px-6 py-3.5 rounded-2xl font-medium text-sm border transition-all duration-300 ${theme === 'dark'
                                        ? 'text-blue-400 border-gray-700 bg-gray-800 hover:bg-gray-700'
                                        : 'text-blue-500 border-gray-200 bg-white hover:bg-gray-50'
                                    }`}
                            >
                                <ChevronLeft className="w-4 h-4 inline-block mr-1" />
                                Go Back
                            </button>
                        </div>
                    </div>
                </motion.div>
            </div>
        );
    }

    // ─── Data Extraction ─────────────────────────────────────────────────────
    const officeName = office.constituency_name || office.constituency || office.office_location || 'IEBC Office';
    const countyName = office.county || 'Kenya';
    const address = office.formatted_address || office.clean_office_location || office.office_location || '';
    const landmark = office.landmark || '';
    const isVerified = office.verified === true;
    const lastVerified = office.verified_at ? new Date(office.verified_at).toLocaleDateString('en-KE', { year: 'numeric', month: 'long', day: 'numeric' }) : null;
    const lastUpdated = office.updated_at ? new Date(office.updated_at).toLocaleDateString('en-KE', { year: 'numeric', month: 'long', day: 'numeric' }) : null;
    const lat = office.latitude;
    const lng = office.longitude;
    const canComputeUrl = `${slugify(countyName)}/${slugify(officeName)}`;

    // SEO meta
    const seoTitle = `IEBC Office ${officeName}, ${countyName} County — Voter Registration & Services | Nasaka IEBC`;
    const seoDescription = `Find the IEBC constituency office for ${officeName} in ${countyName} County, Kenya. Get directions, opening hours, and voter registration details. Community-verified location.`;
    const seoKeywords = `IEBC ${officeName}, IEBC office ${countyName}, voter registration ${officeName}, CVR ${countyName}, IEBC constituency office, nearest IEBC office ${countyName}, ${officeName} IEBC Kenya`;

    const officeSchema = generateOfficeSchema(office);
    const breadcrumbSchema = generateBreadcrumbSchema([
        { name: 'Home', url: '/' },
        { name: 'IEBC Offices', url: '/iebc-office' },
        { name: `${countyName} County`, url: `/iebc-office/${slugify(countyName)}` },
        { name: officeName, url: `/iebc-office/${canComputeUrl}` },
    ]);
    const faqSchema = generateFAQSchema([
        {
            question: `Where is the IEBC office for ${officeName}?`,
            answer: `The IEBC ${officeName} constituency office is located at ${address || `${countyName} County, Kenya`}. You can use the interactive map on Nasaka IEBC for turn-by-turn directions.`,
        },
        {
            question: `What are the opening hours for IEBC ${officeName}?`,
            answer: 'IEBC constituency offices typically operate Monday to Friday, 8:00 AM to 5:00 PM EAT. Hours may vary during voter registration drives.',
        },
        {
            question: `How do I register to vote at IEBC ${officeName}?`,
            answer: 'Visit the office during Continuous Voter Registration (CVR) periods with your Kenyan national ID or passport. The process takes approximately 5-10 minutes.',
        },
        {
            question: `How do I transfer my voter registration to ${officeName}?`,
            answer: `Visit the IEBC ${officeName} office with your national ID during any open CVR period. An IEBC official will help you transfer your voter registration to this constituency.`,
        },
    ]);

    const handleCopyCoordinates = () => {
        if (lat && lng) {
            navigator.clipboard.writeText(`${lat}, ${lng}`).then(() => {
                setCopied(true);
                setTimeout(() => setCopied(false), 2000);
            });
        }
    };

    const handleShare = async () => {
        const shareData = {
            title: `IEBC Office — ${officeName}`,
            text: `Find the IEBC ${officeName} office in ${countyName} County on Nasaka IEBC.`,
            url: `https://recall254.vercel.app/iebc-office/${canComputeUrl}`,
        };
        if (navigator.share) {
            try { await navigator.share(shareData); } catch { /* user cancelled */ }
        } else {
            navigator.clipboard.writeText(shareData.url);
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
        }
    };

    const isDark = theme === 'dark';

    // ─── Render ──────────────────────────────────────────────────────────────
    return (
        <div className={`min-h-screen transition-colors duration-500 ${isDark ? 'bg-[hsl(var(--background))]' : 'bg-gradient-to-br from-green-50/30 to-white'
            }`}>
            {/* ── SEO Head (invisible to users, visible to crawlers) ──────── */}
            <SEOHead
                title={seoTitle}
                description={seoDescription}
                canonical={`/iebc-office/${canComputeUrl}`}
                keywords={seoKeywords}
                schema={[officeSchema, breadcrumbSchema, faqSchema]}
            />

            {/* ── Top Navigation Bar ──────────────────────────────────────── */}
            <motion.header
                className={`fixed top-0 left-0 right-0 z-50 px-4 transition-all duration-300 ${isDark
                        ? 'bg-[hsl(var(--card)/0.95)]'
                        : 'bg-white/95'
                    }`}
                style={{
                    backdropFilter: 'blur(20px) saturate(180%)',
                    WebkitBackdropFilter: 'blur(20px) saturate(180%)',
                    paddingTop: 'calc(12px + env(safe-area-inset-top, 0px))',
                    borderBottom: isDark ? '0.5px solid hsl(var(--border))' : '0.5px solid rgba(0,0,0,0.08)',
                }}
                initial={{ y: -80 }}
                animate={{ y: 0 }}
                transition={{ type: 'spring', stiffness: 300, damping: 30 }}
            >
                <div className="max-w-2xl mx-auto flex items-center justify-between py-3">
                    <button
                        onClick={() => navigate('/iebc-office/map')}
                        className={`flex items-center gap-1.5 text-sm font-medium transition-colors ${isDark ? 'text-blue-400 hover:text-blue-300' : 'text-blue-500 hover:text-blue-600'
                            }`}
                        aria-label="Back to map"
                    >
                        <ChevronLeft className="w-5 h-5" />
                        <span>Map</span>
                    </button>
                    <h1 className={`text-sm font-semibold truncate max-w-[50%] ${isDark ? 'text-white' : 'text-gray-900'
                        }`}>
                        {officeName}
                    </h1>
                    <button
                        onClick={handleShare}
                        className={`p-2 rounded-full transition-colors ${isDark ? 'hover:bg-gray-800' : 'hover:bg-gray-100'
                            }`}
                        aria-label="Share office"
                    >
                        <Share2 className={`w-5 h-5 ${isDark ? 'text-gray-400' : 'text-gray-500'}`} />
                    </button>
                </div>
            </motion.header>

            {/* ── Main Content ────────────────────────────────────────────── */}
            <main
                className="max-w-2xl mx-auto px-4 pb-24"
                style={{ paddingTop: 'calc(80px + env(safe-area-inset-top, 0px))' }}
            >
                {/* Hero Card */}
                <motion.section
                    className={`rounded-3xl p-6 mb-4 border transition-all duration-300 ${isDark
                            ? 'bg-[hsl(var(--card))] border-[hsl(var(--border))] shadow-ios-high-dark'
                            : 'bg-white border-gray-100 shadow-ios-high'
                        }`}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.1 }}
                    aria-label="Office details"
                >
                    {/* Verified badge */}
                    <div className="flex items-center gap-2 mb-4">
                        {isVerified ? (
                            <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold ${isDark ? 'bg-green-500/15 text-green-400' : 'bg-green-50 text-green-600'
                                }`}>
                                <CheckCircle className="w-3.5 h-3.5" />
                                Community Verified
                            </span>
                        ) : (
                            <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold ${isDark ? 'bg-amber-500/15 text-amber-400' : 'bg-amber-50 text-amber-600'
                                }`}>
                                <Shield className="w-3.5 h-3.5" />
                                Unverified
                            </span>
                        )}
                        {lastVerified && (
                            <span className={`text-xs ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>
                                Verified: {lastVerified}
                            </span>
                        )}
                    </div>

                    {/* Title */}
                    <h1 className={`text-2xl font-bold mb-1 tracking-tight ${isDark ? 'text-white' : 'text-gray-900'
                        }`}>
                        IEBC Office — {officeName}
                    </h1>
                    <h2 className={`text-base font-medium mb-6 ${isDark ? 'text-blue-400' : 'text-blue-500'
                        }`}>
                        {countyName} County, Kenya
                    </h2>

                    {/* Info rows */}
                    <div className="space-y-4">
                        {/* Address */}
                        {address && (
                            <div className="flex items-start gap-3">
                                <div className={`flex-shrink-0 w-9 h-9 rounded-xl flex items-center justify-center ${isDark ? 'bg-blue-500/15' : 'bg-blue-50'
                                    }`}>
                                    <MapPin className={`w-4.5 h-4.5 ${isDark ? 'text-blue-400' : 'text-blue-500'}`} />
                                </div>
                                <div>
                                    <p className={`text-xs font-medium uppercase tracking-wider mb-0.5 ${isDark ? 'text-gray-500' : 'text-gray-400'
                                        }`}>Address</p>
                                    <p className={`text-sm ${isDark ? 'text-gray-200' : 'text-gray-700'}`}>{address}</p>
                                    {landmark && (
                                        <p className={`text-xs mt-0.5 ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>
                                            Near: {landmark}
                                        </p>
                                    )}
                                </div>
                            </div>
                        )}

                        {/* Opening Hours */}
                        <div className="flex items-start gap-3">
                            <div className={`flex-shrink-0 w-9 h-9 rounded-xl flex items-center justify-center ${isDark ? 'bg-green-500/15' : 'bg-green-50'
                                }`}>
                                <Clock className={`w-4.5 h-4.5 ${isDark ? 'text-green-400' : 'text-green-500'}`} />
                            </div>
                            <div>
                                <p className={`text-xs font-medium uppercase tracking-wider mb-0.5 ${isDark ? 'text-gray-500' : 'text-gray-400'
                                    }`}>Opening Hours</p>
                                <p className={`text-sm ${isDark ? 'text-gray-200' : 'text-gray-700'}`}>Monday — Friday, 8:00 AM — 5:00 PM</p>
                                <p className={`text-xs mt-0.5 ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>
                                    Hours may vary during CVR drives
                                </p>
                            </div>
                        </div>

                        {/* Coordinates */}
                        {lat && lng && (
                            <div className="flex items-start gap-3">
                                <div className={`flex-shrink-0 w-9 h-9 rounded-xl flex items-center justify-center ${isDark ? 'bg-purple-500/15' : 'bg-purple-50'
                                    }`}>
                                    <Navigation className={`w-4.5 h-4.5 ${isDark ? 'text-purple-400' : 'text-purple-500'}`} />
                                </div>
                                <div className="flex-1">
                                    <p className={`text-xs font-medium uppercase tracking-wider mb-0.5 ${isDark ? 'text-gray-500' : 'text-gray-400'
                                        }`}>Coordinates</p>
                                    <div className="flex items-center gap-2">
                                        <p className={`text-sm font-mono ${isDark ? 'text-gray-200' : 'text-gray-700'}`}>
                                            {lat.toFixed(6)}, {lng.toFixed(6)}
                                        </p>
                                        <button
                                            onClick={handleCopyCoordinates}
                                            className={`p-1 rounded-lg transition-colors ${isDark ? 'hover:bg-gray-800' : 'hover:bg-gray-100'
                                                }`}
                                            aria-label="Copy coordinates"
                                        >
                                            <Copy className={`w-3.5 h-3.5 ${coordinatesCopied
                                                    ? 'text-green-500'
                                                    : isDark ? 'text-gray-500' : 'text-gray-400'
                                                }`} />
                                        </button>
                                    </div>
                                    <AnimatePresence>
                                        {coordinatesCopied && (
                                            <motion.p
                                                initial={{ opacity: 0, y: -4 }}
                                                animate={{ opacity: 1, y: 0 }}
                                                exit={{ opacity: 0 }}
                                                className="text-xs text-green-500 mt-1"
                                            >
                                                Copied to clipboard!
                                            </motion.p>
                                        )}
                                    </AnimatePresence>
                                </div>
                            </div>
                        )}
                    </div>
                </motion.section>

                {/* Action Buttons */}
                <motion.section
                    className="grid grid-cols-2 gap-3 mb-4"
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.2 }}
                >
                    {lat && lng && (
                        <a
                            href={`https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className={`flex items-center justify-center gap-2 py-3.5 rounded-2xl font-semibold text-sm text-white transition-all duration-300 ${isDark
                                    ? 'bg-blue-600 hover:bg-blue-700 shadow-lg shadow-blue-500/25'
                                    : 'bg-blue-500 hover:bg-blue-600 shadow-lg shadow-blue-400/25'
                                }`}
                        >
                            <Navigation className="w-4 h-4" />
                            Get Directions
                        </a>
                    )}
                    <Link
                        to={`/iebc-office/map?q=${encodeURIComponent(officeName)}`}
                        className={`flex items-center justify-center gap-2 py-3.5 rounded-2xl font-semibold text-sm border transition-all duration-300 ${isDark
                                ? 'text-blue-400 border-gray-700 bg-gray-800/50 hover:bg-gray-700'
                                : 'text-blue-500 border-gray-200 bg-white hover:bg-gray-50'
                            }`}
                    >
                        <MapIcon className="w-4 h-4" />
                        View on Map
                    </Link>
                </motion.section>

                {/* Voter Registration Info Card */}
                <motion.section
                    className={`rounded-3xl p-6 mb-4 border transition-all duration-300 ${isDark
                            ? 'bg-[hsl(var(--card))] border-[hsl(var(--border))]'
                            : 'bg-white border-gray-100 shadow-lg shadow-gray-100/50'
                        }`}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.3 }}
                >
                    <h2 className={`text-lg font-bold mb-4 ${isDark ? 'text-white' : 'text-gray-900'}`}>
                        How to Register to Vote
                    </h2>
                    <div className="space-y-3">
                        {[
                            { step: '1', text: 'Bring your Kenyan National ID Card or valid Passport' },
                            { step: '2', text: 'Visit this IEBC office during Continuous Voter Registration (CVR) periods' },
                            { step: '3', text: 'An IEBC official will capture your biometric data (fingerprints and photo)' },
                            { step: '4', text: 'Receive your voter registration confirmation — process takes about 5–10 minutes' },
                        ].map((item) => (
                            <div key={item.step} className="flex items-start gap-3">
                                <div className={`flex-shrink-0 w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold ${isDark ? 'bg-green-500/20 text-green-400' : 'bg-green-50 text-green-600'
                                    }`}>
                                    {item.step}
                                </div>
                                <p className={`text-sm pt-0.5 ${isDark ? 'text-gray-300' : 'text-gray-600'}`}>
                                    {item.text}
                                </p>
                            </div>
                        ))}
                    </div>
                </motion.section>

                {/* FAQ Section (visible on page, matches JSON-LD) */}
                <motion.section
                    className={`rounded-3xl p-6 mb-4 border transition-all duration-300 ${isDark
                            ? 'bg-[hsl(var(--card))] border-[hsl(var(--border))]'
                            : 'bg-white border-gray-100 shadow-lg shadow-gray-100/50'
                        }`}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.4 }}
                >
                    <h2 className={`text-lg font-bold mb-4 ${isDark ? 'text-white' : 'text-gray-900'}`}>
                        Frequently Asked Questions
                    </h2>
                    <div className="space-y-4">
                        <FaqItem
                            question={`Where is the IEBC office for ${officeName}?`}
                            answer={`The IEBC ${officeName} constituency office is located at ${address || `${countyName} County, Kenya`}. You can use the interactive map on Nasaka IEBC for turn-by-turn directions.`}
                            isDark={isDark}
                        />
                        <FaqItem
                            question={`What are the opening hours for IEBC ${officeName}?`}
                            answer="IEBC constituency offices typically operate Monday to Friday, 8:00 AM to 5:00 PM EAT. Hours may vary during voter registration drives."
                            isDark={isDark}
                        />
                        <FaqItem
                            question={`How do I register to vote at IEBC ${officeName}?`}
                            answer="Visit the office during Continuous Voter Registration (CVR) periods with your Kenyan national ID or passport. The process takes approximately 5-10 minutes."
                            isDark={isDark}
                        />
                        <FaqItem
                            question={`How do I transfer my voter registration to ${officeName}?`}
                            answer={`Visit the IEBC ${officeName} office with your national ID during any open CVR period. An IEBC official will help you transfer your voter registration to this constituency.`}
                            isDark={isDark}
                        />
                    </div>
                </motion.section>

                {/* Nearby Offices */}
                {nearbyOffices.length > 0 && (
                    <motion.section
                        className={`rounded-3xl p-6 mb-4 border transition-all duration-300 ${isDark
                                ? 'bg-[hsl(var(--card))] border-[hsl(var(--border))]'
                                : 'bg-white border-gray-100 shadow-lg shadow-gray-100/50'
                            }`}
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.5 }}
                    >
                        <h2 className={`text-lg font-bold mb-4 ${isDark ? 'text-white' : 'text-gray-900'}`}>
                            Other {countyName} IEBC Offices
                        </h2>
                        <div className="space-y-2">
                            {nearbyOffices.map((nearby) => {
                                const nearbyName = nearby.constituency_name || nearby.constituency || nearby.office_location || 'IEBC Office';
                                const nearbySlug = slugify(nearbyName);
                                return (
                                    <Link
                                        key={nearby.id}
                                        to={`/iebc-office/${countySlug}/${nearbySlug}`}
                                        className={`flex items-center justify-between p-3.5 rounded-2xl transition-all duration-200 group ${isDark
                                                ? 'hover:bg-gray-800/50'
                                                : 'hover:bg-gray-50'
                                            }`}
                                    >
                                        <div className="flex items-center gap-3">
                                            <div className={`w-8 h-8 rounded-xl flex items-center justify-center ${isDark ? 'bg-blue-500/15' : 'bg-blue-50'
                                                }`}>
                                                <MapPin className={`w-4 h-4 ${isDark ? 'text-blue-400' : 'text-blue-500'}`} />
                                            </div>
                                            <div>
                                                <p className={`text-sm font-medium ${isDark ? 'text-gray-200' : 'text-gray-800'}`}>
                                                    {nearbyName}
                                                </p>
                                                {nearby.verified && (
                                                    <p className={`text-xs ${isDark ? 'text-green-500' : 'text-green-600'}`}>Verified</p>
                                                )}
                                            </div>
                                        </div>
                                        <ChevronLeft className={`w-4 h-4 rotate-180 transition-transform group-hover:translate-x-1 ${isDark ? 'text-gray-600' : 'text-gray-300'
                                            }`} />
                                    </Link>
                                );
                            })}
                        </div>
                    </motion.section>
                )}

                {/* Data source footer */}
                <motion.footer
                    className="text-center py-6"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: 0.6 }}
                >
                    <p className={`text-xs ${isDark ? 'text-gray-600' : 'text-gray-400'}`}>
                        Data source: {office.source || 'IEBC Kenya'} • {lastUpdated ? `Last updated: ${lastUpdated}` : 'Data from IEBC public records'}
                    </p>
                    <p className={`text-xs mt-1 ${isDark ? 'text-gray-700' : 'text-gray-300'}`}>
                        © {new Date().getFullYear()} Civic Education Kenya (CEKA). All rights reserved.
                    </p>
                </motion.footer>
            </main>
        </div>
    );
};

// ─── FAQ Item Subcomponent ───────────────────────────────────────────────────
const FaqItem = ({ question, answer, isDark }) => {
    const [isOpen, setIsOpen] = useState(false);
    return (
        <div className={`rounded-2xl overflow-hidden border transition-all duration-200 ${isDark ? 'border-gray-800' : 'border-gray-100'
            }`}>
            <button
                onClick={() => setIsOpen(!isOpen)}
                className={`w-full text-left px-4 py-3 flex items-start justify-between gap-2 transition-colors ${isDark ? 'hover:bg-gray-800/50' : 'hover:bg-gray-50'
                    }`}
                aria-expanded={isOpen}
            >
                <h3 className={`text-sm font-medium ${isDark ? 'text-gray-200' : 'text-gray-800'}`}>
                    {question}
                </h3>
                <motion.div
                    animate={{ rotate: isOpen ? 180 : 0 }}
                    transition={{ duration: 0.2 }}
                    className="flex-shrink-0 mt-0.5"
                >
                    <ChevronLeft className={`w-4 h-4 -rotate-90 ${isDark ? 'text-gray-500' : 'text-gray-400'}`} />
                </motion.div>
            </button>
            <AnimatePresence>
                {isOpen && (
                    <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.2 }}
                    >
                        <p className={`px-4 pb-3 text-sm ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
                            {answer}
                        </p>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
};

export default OfficeDetail;

// src/pages/Docs.tsx
// Nasaka IEBC — Full Interactive API Documentation
// iOS-inspired design, dark/light mode, framer-motion animations

import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
    Globe,
    Key,
    Zap,
    Shield,
    Terminal,
    Code2,
    ChevronRight,
    ChevronDown,
    Copy,
    Check,
    BookOpen,
    Layers,
    MapPin,
    Database,
    AlertTriangle,
    ArrowRight,
    Crown,
    Building2,
    Users,
    Heart,
    Play,
    ExternalLink,
} from 'lucide-react';
import { useTheme } from '@/contexts/ThemeContext';
import { SEOHead, generateBreadcrumbSchema } from '@/components/SEO/SEOHead';
import { Link } from 'react-router-dom';
import SandboxWidget from '@/components/SandboxWidget';

// ─── Types ───────────────────────────────────────────────────────────────────
interface EndpointDoc {
    method: string;
    path: string;
    title: string;
    description: string;
    auth: 'required' | 'optional' | 'none';
    tierMin?: string;
    params?: { name: string; type: string; required: boolean; description: string }[];
    responseExample: string;
}

// ─── Copy Button ─────────────────────────────────────────────────────────────
const CopyButton = ({ text }: { text: string }) => {
    const [copied, setCopied] = useState(false);
    const handleCopy = () => {
        navigator.clipboard.writeText(text);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };
    return (
        <button
            onClick={handleCopy}
            className="absolute top-3 right-3 flex items-center gap-1 px-2 py-1 rounded-lg bg-white/10 hover:bg-white/20 text-white/60 hover:text-white text-xs font-bold transition-all"
        >
            {copied ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
            {copied ? 'Copied' : 'Copy'}
        </button>
    );
};

// ─── Code Block ──────────────────────────────────────────────────────────────
const CodeBlock = ({ code, language }: { code: string; language: string }) => (
    <div className="relative rounded-xl overflow-hidden">
        <div className="flex items-center justify-between px-4 py-2 bg-[#0D0D0D] border-b border-white/5">
            <span className="text-[10px] font-black uppercase tracking-[0.2em] text-white/30">{language}</span>
        </div>
        <pre className="bg-[#0D0D0D] text-emerald-400 font-mono text-xs leading-relaxed p-4 overflow-x-auto">
            <code>{code}</code>
        </pre>
        <CopyButton text={code} />
    </div>
);

// ─── Endpoint Docs Data ──────────────────────────────────────────────────────
const ENDPOINTS: EndpointDoc[] = [
    {
        method: 'GET',
        path: '/api/v1/health',
        title: 'Health Check',
        description: 'Returns the operational status of all API services. No authentication required.',
        auth: 'none',
        responseExample: `{
  "status": "operational",
  "services": {
    "api_gateway": "ok",
    "edge_runtime": "ok",
    "database_connectivity": "configured",
    "auth_layer": "initialized"
  },
  "version": "1.2.0",
  "timestamp": "2026-03-20T02:04:12.000Z"
}`,
    },
    {
        method: 'GET',
        path: '/api/v1/offices',
        title: 'List IEBC Offices',
        description: 'Returns a paginated list of IEBC offices. Low-tier responses have premium fields stripped (confidence_score, landmark, geocode_status).',
        auth: 'optional',
        params: [
            { name: 'county', type: 'string', required: false, description: 'Filter by county name (case-insensitive, partial match). Supports all 47 Kenyan counties with normalization for common variants.' },
            { name: 'constituency', type: 'string', required: false, description: 'Filter by constituency name (case-insensitive, partial match).' },
            { name: 'verified', type: 'boolean', required: false, description: 'Filter by verification status. true = Nasaka-verified offices only.' },
            { name: 'limit', type: 'integer', required: false, description: 'Max results per page (default: 50, max: 200). Requests above 100 incur +1 credit weight.' },
            { name: 'offset', type: 'integer', required: false, description: 'Pagination offset (default: 0).' },
        ],
        responseExample: `{
  "data": [
    {
      "id": "abc-123",
      "constituency": "WESTLANDS",
      "county": "NAIROBI",
      "office_location": "Westlands IEBC Office, Ring Road",
      "latitude": -1.2672,
      "longitude": 36.8111,
      "verified": true,
      "formatted_address": "Ring Road Westlands, Nairobi"
    }
  ],
  "pagination": { "total": 290, "limit": 50, "offset": 0, "has_more": true },
  "meta": { "tier": "mwananchi", "shaped": false }
}`,
    },
    {
        method: 'GET',
        path: '/api/v1/offices/:id',
        title: 'Get Office Detail',
        description: 'Returns full detail for a single IEBC office by its UUID.',
        auth: 'optional',
        params: [
            { name: 'id', type: 'UUID', required: true, description: 'The office UUID (path parameter).' },
        ],
        responseExample: `{
  "data": {
    "id": "abc-123",
    "constituency": "WESTLANDS",
    "county": "NAIROBI",
    "office_location": "Westlands IEBC Office, Ring Road",
    "latitude": -1.2672,
    "longitude": 36.8111,
    "verified": true,
    "formatted_address": "Ring Road Westlands, Nairobi",
    "landmark": "Near Sarit Centre",
    "geocode_status": "nasaka_verified",
    "confidence_score": 0.97
  },
  "meta": { "tier": "taifa" }
}`,
    },
    {
        method: 'GET',
        path: '/api/v1/counties',
        title: 'List Counties',
        description: 'Returns all 47 Kenyan counties with office counts, verification counts, and coverage percentages.',
        auth: 'optional',
        responseExample: `{
  "data": [
    { "county": "NAIROBI", "office_count": 17, "verified_count": 15, "coverage_pct": 88.2 },
    { "county": "MOMBASA", "office_count": 6, "verified_count": 5, "coverage_pct": 83.3 }
  ],
  "meta": { "total": 47, "tier": "jamii" }
}`,
    },
    {
        method: 'GET',
        path: '/api/v1/locate',
        title: 'Nearest Offices',
        description: 'Finds the nearest IEBC offices to given GPS coordinates using Haversine distance. Returns results sorted by distance.',
        auth: 'optional',
        params: [
            { name: 'lat', type: 'float', required: true, description: 'Latitude (-5.0 to 5.0 for Kenya).' },
            { name: 'lng', type: 'float', required: true, description: 'Longitude (33.0 to 42.0 for Kenya).' },
            { name: 'radius', type: 'float', required: false, description: 'Search radius in kilometers (default: 10, max: 100).' },
        ],
        responseExample: `{
  "data": [
    {
      "id": "abc-123",
      "constituency": "STAREHE",
      "county": "NAIROBI",
      "office_location": "Anniversary Towers, University Way",
      "distance_km": 0.8,
      "verified": true
    }
  ],
  "meta": { "query": { "lat": -1.2838, "lng": 36.8157, "radius": 10 } }
}`,
    },
    {
        method: 'GET',
        path: '/api/v1/boundary',
        title: 'Electoral Boundaries',
        description: 'Returns boundary polygon data for counties and constituencies. Requires Mwananchi tier or above.',
        auth: 'required',
        tierMin: 'mwananchi',
        params: [
            { name: 'county', type: 'string', required: false, description: 'Filter boundaries by county.' },
            { name: 'format', type: 'string', required: false, description: 'Response format: json (default), geojson, csv. GeoJSON/CSV require Mwananchi+.' },
        ],
        responseExample: `{
  "data": [
    {
      "county": "NAIROBI",
      "boundary_type": "county",
      "geometry": { "type": "Polygon", "coordinates": [...] }
    }
  ]
}`,
    },
    {
        method: 'GET',
        path: '/api/v1/coordinates',
        title: 'Coordinate Lookup',
        description: 'Reverse geocodes coordinates to identify the IEBC administrative area (county, constituency).',
        auth: 'optional',
        params: [
            { name: 'lat', type: 'float', required: true, description: 'Latitude.' },
            { name: 'lng', type: 'float', required: true, description: 'Longitude.' },
        ],
        responseExample: `{
  "data": {
    "county": "NAIROBI",
    "constituency": "WESTLANDS",
    "ward": "Parklands/Highridge"
  }
}`,
    },
    {
        method: 'GET',
        path: '/api/v1/stats',
        title: 'Dataset Statistics',
        description: 'Returns aggregate dataset statistics: total offices, verified count, coverage rate, last update timestamp.',
        auth: 'none',
        responseExample: `{
  "data": {
    "total_offices": 290,
    "verified_offices": 247,
    "counties_covered": 47,
    "constituencies_covered": 290,
    "verification_rate": 85.2,
    "last_updated": "2026-03-15T00:00:00.000Z"
  }
}`,
    },
];

// ─── Tier Data (Nasaka Blue SVGs) ─────────────────────────────────────────
const TIERS = [
    { id: 'sandbox', name: 'Sandbox', monthly: '50/session', burst: '1/s', price: 'Free', icon: <Play className="w-5 h-5" />, color: 'text-[#007AFF]', bg: 'bg-[#007AFF]/5' },
    { id: 'jamii', name: 'Jamii', monthly: '5,000', burst: '2/s', price: 'Free', icon: <img src="/icons/tiers/jamii.svg" alt="Jamii" className="w-5 h-5" />, color: 'text-[#007AFF]', bg: 'bg-[#007AFF]/5' },
    { id: 'mwananchi', name: 'Mwananchi', monthly: '100,000', burst: '10/s', price: 'KES 2,500/mo', icon: <img src="/icons/tiers/mwananchi.svg" alt="Mwananchi" className="w-5 h-5" />, color: 'text-[#007AFF]', bg: 'bg-[#007AFF]/10' },
    { id: 'taifa', name: 'Taifa', monthly: '500,000', burst: '30/s', price: 'KES 7,500/mo', icon: <img src="/icons/tiers/taifa.svg" alt="Taifa" className="w-5 h-5" />, color: 'text-[#007AFF]', bg: 'bg-[#007AFF]/15' },
    { id: 'serikali', name: 'Serikali', monthly: '10,000,000', burst: '100/s', price: 'Custom', icon: <img src="/icons/tiers/serikali.svg" alt="Serikali" className="w-5 h-5" />, color: 'text-[#007AFF]', bg: 'bg-[#007AFF]/20' },
];

// ─── Error Codes ─────────────────────────────────────────────────────────────
const ERROR_CODES = [
    { code: 200, meaning: 'Success', description: 'Request completed successfully.' },
    { code: 201, meaning: 'Created', description: 'Resource created (sandbox session init).' },
    { code: 400, meaning: 'Bad Request', description: 'Missing or invalid parameters.' },
    { code: 401, meaning: 'Unauthorized', description: 'Missing or invalid API key.' },
    { code: 402, meaning: 'Payment Required', description: 'Subscription expired or past due.' },
    { code: 403, meaning: 'Forbidden', description: 'Tier too low for requested endpoint or format.' },
    { code: 405, meaning: 'Method Not Allowed', description: 'Only GET is supported on most endpoints.' },
    { code: 423, meaning: 'Locked', description: 'API key locked due to expired subscription.' },
    { code: 429, meaning: 'Too Many Requests', description: 'Burst rate or monthly quota exceeded. Check Retry-After header.' },
    { code: 500, meaning: 'Internal Error', description: 'Server error. Contact support if persistent.' },
    { code: 502, meaning: 'Bad Gateway', description: 'Database connection failed. Static fallback may be used.' },
    { code: 503, meaning: 'Maintenance', description: 'System under planned maintenance.' },
];

// ─── Code Examples ───────────────────────────────────────────────────────────
const CODE_EXAMPLES = {
    javascript: `const response = await fetch('https://nasakaiebc.civiceducationkenya.com/api/v1/offices?county=NAIROBI&limit=10', {
  headers: {
    'X-API-Key': 'nsk_live_your_api_key_here'
  }
});

const { data, pagination, meta } = await response.json();

console.log(\`Found \${pagination.total} offices in NAIROBI\`);
data.forEach(office => {
  console.log(\`  \${office.constituency}: \${office.office_location}\`);
  console.log(\`    Coords: \${office.latitude}, \${office.longitude}\`);
  console.log(\`    Verified: \${office.verified}\`);
});`,
    python: `import requests

response = requests.get(
    'https://nasakaiebc.civiceducationkenya.com/api/v1/offices',
    params={'county': 'NAIROBI', 'limit': 10},
    headers={'X-API-Key': 'nsk_live_your_api_key_here'}
)

result = response.json()
print(f"Found {result['pagination']['total']} offices in NAIROBI")

for office in result['data']:
    print(f"  {office['constituency']}: {office['office_location']}")
    print(f"    Coords: {office['latitude']}, {office['longitude']}")
    print(f"    Verified: {office['verified']}")`,
    curl: `curl -X GET \\
  'https://nasakaiebc.civiceducationkenya.com/api/v1/offices?county=NAIROBI&limit=10' \\
  -H 'X-API-Key: nsk_live_your_api_key_here' \\
  -H 'Accept: application/json'`,
};

// ─── Endpoint Card ───────────────────────────────────────────────────────────
const EndpointCard = ({ endpoint, isDark }: { endpoint: EndpointDoc; isDark: boolean }) => {
    const [isOpen, setIsOpen] = useState(false);

    const cardBg = isDark ? 'bg-[#1C1C1E]/80' : 'bg-white/80';
    const cardBorder = isDark ? 'border-white/5' : 'border-black/5';
    const mutedText = isDark ? 'text-[#98989D]' : 'text-[#8E8E93]';

    const methodColor = endpoint.method === 'GET' ? 'text-emerald-500 bg-emerald-500/10' : 'text-blue-500 bg-blue-500/10';
    const authBadge = endpoint.auth === 'required'
        ? { label: 'Key Required', color: 'text-[#007AFF] bg-[#007AFF]/10' }
        : endpoint.auth === 'optional'
            ? { label: 'Key Optional', color: `${isDark ? 'text-white/40 bg-white/5' : 'text-black/40 bg-black/5'}` }
            : { label: 'Public', color: 'text-emerald-500 bg-emerald-500/10' };

    return (
        <motion.div
            layout
            className={`${cardBg} backdrop-blur-xl border ${cardBorder} rounded-2xl overflow-hidden transition-all`}
        >
            <button
                onClick={() => setIsOpen(!isOpen)}
                className="w-full flex items-center justify-between px-6 py-4 text-left"
            >
                <div className="flex items-center gap-3 flex-wrap">
                    <span className={`px-2.5 py-1 rounded-lg text-xs font-black ${methodColor}`}>
                        {endpoint.method}
                    </span>
                    <span className="font-mono text-sm font-bold">{endpoint.path}</span>
                    <span className={`px-2 py-0.5 rounded-md text-[10px] font-black ${authBadge.color}`}>
                        {authBadge.label}
                    </span>
                    {endpoint.tierMin && (
                        <span className="px-2 py-0.5 rounded-md text-[10px] font-black text-[#007AFF] bg-[#007AFF]/10">
                            {endpoint.tierMin}+
                        </span>
                    )}
                </div>
                <ChevronDown className={`w-4 h-4 transition-transform shrink-0 ${isOpen ? 'rotate-180' : ''} ${mutedText}`} />
            </button>

            <AnimatePresence>
                {isOpen && (
                    <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.2 }}
                        className="overflow-hidden"
                    >
                        <div className={`px-6 pb-6 border-t ${cardBorder} pt-4 space-y-4`}>
                            <p className={`text-sm ${mutedText}`}>{endpoint.description}</p>

                            {endpoint.params && endpoint.params.length > 0 && (
                                <div>
                                    <h4 className={`text-[10px] font-black uppercase tracking-[0.2em] ${mutedText} mb-3`}>Parameters</h4>
                                    <div className="space-y-2">
                                        {endpoint.params.map(p => (
                                            <div key={p.name} className={`flex items-start gap-3 text-sm p-3 rounded-xl ${isDark ? 'bg-white/5' : 'bg-black/[0.02]'}`}>
                                                <code className="font-mono font-bold text-blue-500 shrink-0">{p.name}</code>
                                                <span className={`text-xs px-1.5 py-0.5 rounded font-bold shrink-0 ${isDark ? 'bg-white/10 text-white/50' : 'bg-black/5 text-black/50'}`}>{p.type}</span>
                                                {p.required && <span className="text-[10px] font-black text-red-500 shrink-0">REQUIRED</span>}
                                                <span className={mutedText}>{p.description}</span>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}

                            <div>
                                <h4 className={`text-[10px] font-black uppercase tracking-[0.2em] ${mutedText} mb-3`}>Response</h4>
                                <CodeBlock code={endpoint.responseExample} language="json" />
                            </div>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </motion.div>
    );
};

// ─── Main Docs Page ──────────────────────────────────────────────────────────
const Docs = () => {
    const { theme } = useTheme();
    const isDark = theme === 'dark';
    const [activeCodeTab, setActiveCodeTab] = useState<'javascript' | 'python' | 'curl'>('javascript');

    const bg = isDark ? 'bg-[#0A0A0A]' : 'bg-[#F2F2F7]';
    const text = isDark ? 'text-white' : 'text-[#1C1C1E]';
    const mutedText = isDark ? 'text-[#98989D]' : 'text-[#8E8E93]';
    const cardBg = isDark ? 'bg-[#1C1C1E]/80' : 'bg-white/80';
    const cardBorder = isDark ? 'border-white/5' : 'border-black/5';

    // Smooth scroll to hash on load (with retry for lazy-loaded content)
    useEffect(() => {
        if (window.location.hash) {
            const hash = window.location.hash.slice(1);
            const scrollToHash = (attempt = 0) => {
                const el = document.getElementById(hash);
                if (el) {
                    el.scrollIntoView({ behavior: 'smooth' });
                } else if (attempt < 5) {
                    setTimeout(() => scrollToHash(attempt + 1), 300);
                }
            };
            setTimeout(() => scrollToHash(), 500);
        }
    }, []);

    return (
        <div className={`min-h-screen pb-20 transition-colors duration-500 ${bg} ${text}`}>
            <SEOHead
                title="API Documentation — Nasaka IEBC | Kenya Electoral Data"
                description="Complete API reference for the Nasaka IEBC Kenya electoral data API. Endpoints, authentication, rate limits, code examples, and interactive sandbox."
                canonical="/docs"
                keywords="IEBC API docs, Nasaka API documentation, Kenya election data API reference, civic data developer"
                schema={[
                    generateBreadcrumbSchema([
                        { name: 'Home', url: '/' },
                        { name: 'API Docs', url: '/docs' },
                    ]),
                ]}
            />

            {/* Topo BG subtle overlay */}
            <div
                className="fixed inset-0 pointer-events-none opacity-[0.03]"
                style={{ backgroundImage: 'url(/topo-bg.svg)', backgroundSize: '600px', backgroundRepeat: 'repeat' }}
            />

            <div className="relative max-w-5xl mx-auto px-6 pt-16">
                {/* ── Hero ── */}
                <motion.div
                    initial={{ opacity: 0, y: 30 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="text-center mb-16"
                >
                    <div className="inline-flex items-center px-4 py-2 rounded-full bg-blue-500/10 text-blue-500 text-xs font-black uppercase tracking-[0.15em] mb-6">
                        <BookOpen className="w-3.5 h-3.5 mr-2" />
                        Developer Reference
                    </div>
                    <h1 className="text-5xl md:text-7xl font-black mb-6 tracking-tight">
                        Nasaka IEBC<br />
                        <span className="text-[#007AFF]">API Docs</span>
                    </h1>
                    <p className={`text-lg ${mutedText} max-w-2xl mx-auto mb-8`}>
                        Kenya's most comprehensive IEBC office dataset. 290 offices across all 47 counties,
                        geocoded, verified, and served through a production-grade REST API with tiered access.
                    </p>
                    <div className="flex items-center justify-center gap-4 flex-wrap">
                        <button
                            onClick={() => {
                                document.getElementById('sandbox')?.scrollIntoView({ behavior: 'smooth' });
                            }}
                            className="inline-flex items-center gap-2 px-6 py-3 rounded-2xl font-bold text-white bg-[#007AFF] hover:bg-[#0055CC] hover:shadow-xl hover:shadow-[#007AFF]/20 active:scale-[0.98] transition-all"
                        >
                            <Play className="w-4 h-4" />
                            Try the Sandbox
                        </button>
                        <Link
                            to="/pricing"
                            className={`inline-flex items-center gap-2 px-6 py-3 rounded-2xl font-bold border ${cardBorder} ${isDark ? 'hover:bg-white/5' : 'hover:bg-black/5'} transition-all`}
                        >
                            <Key className="w-4 h-4" />
                            Get API Key
                        </Link>
                    </div>
                </motion.div>

                {/* ── Quick Start ── */}
                <motion.section
                    initial={{ opacity: 0, y: 20 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true }}
                    className="mb-20"
                    id="quickstart"
                >
                    <h2 className="text-3xl font-black mb-8">Quick Start</h2>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        {[
                            { step: '1', title: 'Get an API Key', desc: 'Sign up and grab a free Jamii key from your dashboard. No credit card required.', icon: <Key className="w-6 h-6" />, color: 'text-[#007AFF]', bg: 'bg-[#007AFF]/10' },
                            { step: '2', title: 'Make a Request', desc: 'Send a GET request with your key in the X-API-Key header. All responses are JSON.', icon: <Terminal className="w-6 h-6" />, color: 'text-[#007AFF]', bg: 'bg-[#007AFF]/10' },
                            { step: '3', title: 'Parse the Response', desc: 'Every response includes data, pagination metadata, and your tier information.', icon: <Code2 className="w-6 h-6" />, color: 'text-[#007AFF]', bg: 'bg-[#007AFF]/10' },
                        ].map(item => (
                            <motion.div
                                key={item.step}
                                initial={{ opacity: 0, y: 20 }}
                                whileInView={{ opacity: 1, y: 0 }}
                                viewport={{ once: true }}
                                className={`${cardBg} backdrop-blur-xl border ${cardBorder} rounded-[2rem] p-8 transition-all hover:scale-[1.02]`}
                            >
                                <div className={`w-12 h-12 rounded-2xl ${item.bg} flex items-center justify-center ${item.color} mb-5`}>
                                    {item.icon}
                                </div>
                                <h3 className="text-lg font-black mb-2">{item.title}</h3>
                                <p className={`text-sm ${mutedText}`}>{item.desc}</p>
                            </motion.div>
                        ))}
                    </div>
                </motion.section>

                {/* ── Authentication ── */}
                <motion.section
                    initial={{ opacity: 0, y: 20 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true }}
                    className="mb-20"
                    id="authentication"
                >
                    <h2 className="text-3xl font-black mb-4">Authentication</h2>
                    <p className={`text-sm ${mutedText} mb-6`}>
                        All authenticated requests use the <code className="font-mono font-bold text-blue-500 mx-1">X-API-Key</code> header.
                        Some endpoints work without a key (public/guest tier) but are heavily rate-limited to 1 req/s with no monthly quota.
                    </p>

                    <CodeBlock
                        code={`GET /api/v1/offices?county=NAIROBI HTTP/1.1
Host: nasakaiebc.civiceducationkenya.com
X-API-Key: nsk_live_your_api_key_here
Accept: application/json`}
                        language="http"
                    />

                    <div className={`mt-6 p-5 rounded-2xl border ${cardBorder} ${isDark ? 'bg-amber-500/5' : 'bg-amber-50'} flex items-start gap-3`}>
                        <AlertTriangle className="w-5 h-5 text-amber-500 shrink-0 mt-0.5" />
                        <div>
                            <p className="text-sm font-bold mb-1">API keys are hashed server-side</p>
                            <p className={`text-xs ${mutedText}`}>
                                Your raw key is SHA-256 hashed before lookup. Keys starting with <code className="font-mono">nsk_live_</code> are production keys.
                                Keys starting with <code className="font-mono">nsk_sandbox_</code> are sandbox keys — use them only with the sandbox endpoint.
                            </p>
                        </div>
                    </div>
                </motion.section>

                {/* ── Tier Comparison ── */}
                <motion.section
                    initial={{ opacity: 0, y: 20 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true }}
                    className="mb-20"
                    id="tiers"
                >
                    <h2 className="text-3xl font-black mb-4">Access Tiers</h2>
                    <p className={`text-sm ${mutedText} mb-8`}>
                        Every API key belongs to a tier. Higher tiers unlock more endpoints, export formats, and higher throughput.
                    </p>

                    <div className={`overflow-x-auto rounded-2xl border ${cardBorder}`}>
                        <table className="w-full text-sm">
                            <thead>
                                <tr className={isDark ? 'bg-white/5' : 'bg-black/[0.02]'}>
                                    <th className={`text-left px-6 py-4 text-[10px] font-black uppercase tracking-[0.2em] ${mutedText}`}>Tier</th>
                                    <th className={`text-left px-6 py-4 text-[10px] font-black uppercase tracking-[0.2em] ${mutedText}`}>Monthly Requests</th>
                                    <th className={`text-left px-6 py-4 text-[10px] font-black uppercase tracking-[0.2em] ${mutedText}`}>Burst Rate</th>
                                    <th className={`text-left px-6 py-4 text-[10px] font-black uppercase tracking-[0.2em] ${mutedText}`}>Price</th>
                                </tr>
                            </thead>
                            <tbody>
                                {TIERS.map((tier, i) => (
                                    <tr key={tier.id} className={`border-t ${cardBorder} ${isDark ? 'hover:bg-white/5' : 'hover:bg-black/[0.02]'} transition-colors`}>
                                        <td className="px-6 py-4">
                                            <div className="flex items-center gap-3">
                                                <div className={`w-8 h-8 rounded-xl ${tier.bg} flex items-center justify-center ${tier.color}`}>
                                                    {tier.icon}
                                                </div>
                                                <span className="font-black">{tier.name}</span>
                                            </div>
                                        </td>
                                        <td className="px-6 py-4 font-bold font-mono">{tier.monthly}</td>
                                        <td className="px-6 py-4 font-bold font-mono">{tier.burst}</td>
                                        <td className="px-6 py-4 font-bold">{tier.price}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>

                    <div className="mt-4 text-center">
                        <Link to="/pricing" className="text-blue-500 font-bold text-sm hover:underline inline-flex items-center gap-1">
                            View full pricing, credit packs & data licenses
                            <ArrowRight className="w-4 h-4" />
                        </Link>
                    </div>
                </motion.section>

                {/* ── Endpoint Reference ── */}
                <motion.section
                    initial={{ opacity: 0, y: 20 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true }}
                    className="mb-20"
                    id="endpoints"
                >
                    <h2 className="text-3xl font-black mb-4">Endpoint Reference</h2>
                    <p className={`text-sm ${mutedText} mb-8`}>
                        All endpoints are prefixed with <code className="font-mono font-bold text-blue-500">/api/v1</code>.
                        Click any endpoint to expand its documentation.
                    </p>

                    <div className="space-y-3">
                        {ENDPOINTS.map(ep => (
                            <EndpointCard key={ep.path} endpoint={ep} isDark={isDark} />
                        ))}
                    </div>
                </motion.section>

                {/* ── Code Examples ── */}
                <motion.section
                    initial={{ opacity: 0, y: 20 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true }}
                    className="mb-20"
                    id="examples"
                >
                    <h2 className="text-3xl font-black mb-4">Code Examples</h2>
                    <p className={`text-sm ${mutedText} mb-6`}>
                        Ready-to-run code for listing IEBC offices in Nairobi.
                    </p>

                    {/* Language Tabs */}
                    <div className={`inline-flex items-center gap-1 p-1 rounded-xl ${isDark ? 'bg-white/5' : 'bg-black/5'} mb-4`}>
                        {(['javascript', 'python', 'curl'] as const).map(lang => (
                            <button
                                key={lang}
                                onClick={() => setActiveCodeTab(lang)}
                                className={`px-4 py-2 rounded-lg text-xs font-black uppercase tracking-widest transition-all ${activeCodeTab === lang
                                    ? `${isDark ? 'bg-white/10 text-white' : 'bg-white text-[#1C1C1E] shadow-sm'}`
                                    : mutedText
                                    }`}
                            >
                                {lang}
                            </button>
                        ))}
                    </div>

                    <CodeBlock code={CODE_EXAMPLES[activeCodeTab]} language={activeCodeTab} />
                </motion.section>

                {/* ── Rate Limits & Error Codes ── */}
                <motion.section
                    initial={{ opacity: 0, y: 20 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true }}
                    className="mb-20"
                    id="errors"
                >
                    <h2 className="text-3xl font-black mb-4">Rate Limits & Error Codes</h2>
                    <p className={`text-sm ${mutedText} mb-4`}>
                        Burst rate limiting is per-second via Upstash Redis. Monthly quotas are tracked in Supabase.
                        When rate-limited, check the <code className="font-mono font-bold text-blue-500">Retry-After</code> header.
                    </p>

                    <div className={`overflow-x-auto rounded-2xl border ${cardBorder}`}>
                        <table className="w-full text-sm">
                            <thead>
                                <tr className={isDark ? 'bg-white/5' : 'bg-black/[0.02]'}>
                                    <th className={`text-left px-6 py-4 text-[10px] font-black uppercase tracking-[0.2em] ${mutedText}`}>Code</th>
                                    <th className={`text-left px-6 py-4 text-[10px] font-black uppercase tracking-[0.2em] ${mutedText}`}>Status</th>
                                    <th className={`text-left px-6 py-4 text-[10px] font-black uppercase tracking-[0.2em] ${mutedText}`}>Description</th>
                                </tr>
                            </thead>
                            <tbody>
                                {ERROR_CODES.map(ec => (
                                    <tr key={ec.code} className={`border-t ${cardBorder} ${isDark ? 'hover:bg-white/5' : 'hover:bg-black/[0.02]'} transition-colors`}>
                                        <td className="px-6 py-3">
                                            <span className={`px-2.5 py-1 rounded-lg text-xs font-black ${ec.code >= 200 && ec.code < 300
                                                ? 'bg-emerald-500/10 text-emerald-500'
                                                : ec.code >= 400
                                                    ? 'bg-red-500/10 text-red-500'
                                                    : 'bg-amber-500/10 text-amber-500'
                                                }`}>
                                                {ec.code}
                                            </span>
                                        </td>
                                        <td className="px-6 py-3 font-bold">{ec.meaning}</td>
                                        <td className={`px-6 py-3 ${mutedText}`}>{ec.description}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </motion.section>

                {/* ── Sandbox ── */}
                <motion.section
                    initial={{ opacity: 0, y: 20 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true }}
                    className="mb-20"
                    id="sandbox"
                >
                    <div className="text-center mb-8">
                        <div className="inline-flex items-center px-4 py-2 rounded-full bg-blue-500/10 text-blue-500 text-xs font-black uppercase tracking-[0.15em] mb-4">
                            <Play className="w-3.5 h-3.5 mr-2" />
                            Interactive
                        </div>
                        <h2 className="text-3xl font-black mb-3">API Sandbox</h2>
                        <p className={`text-sm ${mutedText} max-w-lg mx-auto`}>
                            Test the API instantly with fixture data. 50 requests per session, no billing, no production data.
                            Sign in with your CEKA account to activate.
                        </p>
                    </div>

                    <SandboxWidget />
                </motion.section>

                {/* ── Pricing CTA ── */}
                <motion.section
                    initial={{ opacity: 0, y: 20 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true }}
                    className={`mb-20 p-10 rounded-[3rem] border ${cardBorder} ${cardBg} backdrop-blur-xl text-center`}
                >
                    <div className={`w-16 h-16 rounded-2xl bg-blue-500/10 flex items-center justify-center mx-auto mb-6`}>
                        <Heart className="w-8 h-8 text-blue-500" />
                    </div>
                    <h3 className="text-2xl font-black mb-3">Ready to Build?</h3>
                    <p className={`text-sm ${mutedText} max-w-md mx-auto mb-6`}>
                        Get a free Jamii API key with 5,000 requests/month. Upgrade anytime for more throughput, export formats, and boundary data.
                    </p>
                    <div className="flex items-center justify-center gap-4 flex-wrap">
                        <Link
                            to="/pricing"
                            className="inline-flex items-center gap-2 px-8 py-4 rounded-2xl font-bold text-white bg-[#007AFF] hover:bg-[#0055CC] hover:shadow-xl hover:shadow-[#007AFF]/20 active:scale-[0.98] transition-all"
                        >
                            View Pricing
                            <ArrowRight className="w-5 h-5" />
                        </Link>
                        <Link
                            to="/dashboard/api-keys"
                            className={`inline-flex items-center gap-2 px-8 py-4 rounded-2xl font-bold border ${cardBorder} ${isDark ? 'hover:bg-white/5' : 'hover:bg-black/5'} transition-all`}
                        >
                            <Key className="w-5 h-5" />
                            API Key Dashboard
                        </Link>
                    </div>
                </motion.section>

                {/* ── Footer navigation ── */}
                <div className="text-center pb-10">
                    <Link to="/" className="text-blue-500 font-bold text-sm hover:underline flex items-center justify-center gap-1">
                        <ChevronRight className="w-4 h-4 rotate-180" />
                        Back to Nasaka IEBC
                    </Link>
                </div>
            </div>
        </div>
    );
};

export default Docs;

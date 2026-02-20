/**
 * SEOHead.tsx
 * ─────────────────────────────────────────────────────────────────────────
 * Drop-in SEO component for every route in Nasaka IEBC.
 * Uses react-helmet-async so Google sees per-page meta tags even in a SPA.
 *
 * Integrated with the codebase's i18n system, Supabase office data schema,
 * and the existing CSS design tokens.
 */

import { Helmet } from 'react-helmet-async';
import { SUPPORTED_LANGUAGES } from '@/i18n';

// ─── Constants ────────────────────────────────────────────────────────────────
const SITE_NAME = 'Nasaka IEBC';
const SITE_URL = 'https://recall254.vercel.app';
const DEFAULT_OG_IMAGE = `${SITE_URL}/og-image.png`;
const TWITTER_HANDLE = '@CivicEdKenya';
const DEFAULT_LOCALE = 'en_KE';

// ─── Types ────────────────────────────────────────────────────────────────────
interface SEOHeadProps {
    /** Page title — keep under 60 chars, front-load primary keyword */
    title: string;
    /** Meta description — keep under 160 chars, include a CTA */
    description: string;
    /** Canonical URL path (e.g., '/iebc-office/nairobi/westlands') */
    canonical?: string;
    /** og:image URL — use 1200×630px image. Defaults to global OG image. */
    ogImage?: string;
    /** JSON-LD schema object(s) — pass GovernmentOffice schema for office detail pages */
    schema?: Record<string, unknown> | Record<string, unknown>[];
    /** Set to true for 404 and other pages Google should NOT index */
    noIndex?: boolean;
    /** Current language code for hreflang */
    lang?: string;
    /** Additional keywords for meta keywords tag */
    keywords?: string;
    /** og:type override (default: 'website') */
    ogType?: string;
    /** Article publish date for og:article:published_time */
    publishedTime?: string;
    /** Article modified date for og:article:modified_time */
    modifiedTime?: string;
}

export function SEOHead({
    title,
    description,
    canonical,
    ogImage = DEFAULT_OG_IMAGE,
    schema,
    noIndex = false,
    lang = 'en',
    keywords,
    ogType = 'website',
    publishedTime,
    modifiedTime,
}: SEOHeadProps) {
    const fullCanonical = canonical
        ? canonical.startsWith('http') ? canonical : `${SITE_URL}${canonical}`
        : undefined;

    // Build hreflang alternates for all supported languages
    const hreflangLinks = fullCanonical
        ? Object.keys(SUPPORTED_LANGUAGES).map((code) => {
            const hreflangCode = code === 'en' ? 'en-KE' : code === 'sw' ? 'sw-KE' : code;
            return { code: hreflangCode, href: `${fullCanonical}?lang=${code}` };
        })
        : [];

    // Normalize schema to array
    const schemas = schema
        ? Array.isArray(schema)
            ? schema
            : [schema]
        : [];

    return (
        <Helmet>
            {/* ── Primary ───────────────────────────────────────────────── */}
            <html lang={lang} />
            <title>{title}</title>
            <meta name="description" content={description} />
            {keywords && <meta name="keywords" content={keywords} />}
            {fullCanonical && <link rel="canonical" href={fullCanonical} />}
            <meta
                name="robots"
                content={
                    noIndex
                        ? 'noindex, nofollow'
                        : 'index, follow, max-image-preview:large, max-snippet:-1, max-video-preview:-1'
                }
            />

            {/* ── Geo Targeting ─────────────────────────────────────────── */}
            <meta name="geo.region" content="KE" />
            <meta name="geo.placename" content="Kenya" />
            <meta name="content-language" content={lang === 'sw' ? 'sw-KE' : 'en-KE'} />

            {/* ── Open Graph ───────────────────────────────────────────── */}
            <meta property="og:site_name" content={SITE_NAME} />
            <meta property="og:title" content={title} />
            <meta property="og:description" content={description} />
            {fullCanonical && <meta property="og:url" content={fullCanonical} />}
            <meta property="og:image" content={ogImage} />
            <meta property="og:image:width" content="1200" />
            <meta property="og:image:height" content="630" />
            <meta property="og:image:alt" content={title} />
            <meta property="og:type" content={ogType} />
            <meta property="og:locale" content={DEFAULT_LOCALE} />
            <meta property="og:locale:alternate" content="sw_KE" />
            {publishedTime && <meta property="article:published_time" content={publishedTime} />}
            {modifiedTime && <meta property="article:modified_time" content={modifiedTime} />}

            {/* ── Twitter / X ──────────────────────────────────────────── */}
            <meta name="twitter:card" content="summary_large_image" />
            <meta name="twitter:site" content={TWITTER_HANDLE} />
            <meta name="twitter:creator" content={TWITTER_HANDLE} />
            <meta name="twitter:title" content={title} />
            <meta name="twitter:description" content={description} />
            <meta name="twitter:image" content={ogImage} />
            <meta name="twitter:image:alt" content={title} />

            {/* ── Hreflang tags ─────────────────────────────────────────── */}
            {hreflangLinks.map(({ code, href }) => (
                <link key={code} rel="alternate" hrefLang={code} href={href} />
            ))}
            {fullCanonical && (
                <link rel="alternate" hrefLang="x-default" href={fullCanonical} />
            )}

            {/* ── JSON-LD schema ────────────────────────────────────────── */}
            {schemas.map((s, i) => (
                <script key={`schema-${i}`} type="application/ld+json">
                    {JSON.stringify(s)}
                </script>
            ))}
        </Helmet>
    );
}

// ─────────────────────────────────────────────────────────────────────────────
// HELPER: generateOfficeSchema
// Generates GovernmentOffice JSON-LD from an iebc_offices Supabase row.
// ─────────────────────────────────────────────────────────────────────────────
interface OfficeSchemaInput {
    constituency_name?: string | null;
    constituency?: string;
    office_location?: string;
    county?: string;
    latitude?: number | null;
    longitude?: number | null;
    formatted_address?: string | null;
    clean_office_location?: string | null;
    landmark?: string | null;
    verified?: boolean | null;
    verified_at?: string | null;
    updated_at?: string | null;
    source?: string | null;
}

export function generateOfficeSchema(office: OfficeSchemaInput) {
    const officeName = office.constituency_name || office.constituency || office.office_location || 'IEBC Office';
    const countyName = office.county || 'Kenya';
    const slug = slugify(officeName);
    const countySlug = slugify(countyName);

    return {
        '@context': 'https://schema.org',
        '@type': 'GovernmentOffice',
        name: `IEBC Constituency Office — ${officeName}`,
        description: `Official IEBC constituency office for ${officeName}, ${countyName} County, Kenya. Find voter registration services, office hours, and directions.`,
        address: {
            '@type': 'PostalAddress',
            streetAddress: office.formatted_address || office.clean_office_location || office.office_location || '',
            addressLocality: officeName,
            addressRegion: `${countyName} County`,
            addressCountry: 'KE',
        },
        geo: {
            '@type': 'GeoCoordinates',
            latitude: office.latitude,
            longitude: office.longitude,
        },
        url: `${SITE_URL}/iebc-office/${countySlug}/${slug}`,
        openingHoursSpecification: {
            '@type': 'OpeningHoursSpecification',
            dayOfWeek: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'],
            opens: '08:00',
            closes: '17:00',
        },
        parentOrganization: {
            '@type': 'GovernmentOrganization',
            name: 'Independent Electoral and Boundaries Commission (IEBC)',
            url: 'https://www.iebc.or.ke',
            sameAs: [
                'https://twitter.com/IEBCKenya',
                'https://www.facebook.com/IEBCKenya',
            ],
        },
        additionalProperty: [
            ...(office.verified_at
                ? [{ '@type': 'PropertyValue', name: 'last_verified', value: office.verified_at }]
                : office.updated_at
                    ? [{ '@type': 'PropertyValue', name: 'last_updated', value: office.updated_at }]
                    : []),
            ...(office.source
                ? [{ '@type': 'PropertyValue', name: 'data_source', value: office.source }]
                : []),
            {
                '@type': 'PropertyValue',
                name: 'verified_by',
                value: office.verified ? 'community' : 'unverified',
            },
        ],
        potentialAction: {
            '@type': 'FindAction',
            name: 'Find IEBC Office',
            target: `${SITE_URL}/iebc-office/${countySlug}/${slug}`,
        },
        ...(office.landmark && {
            containedInPlace: {
                '@type': 'Place',
                name: office.landmark,
            },
        }),
    };
}

// ─────────────────────────────────────────────────────────────────────────────
// HELPER: generateWebsiteSchema
// Site-wide schema for the WebSite + SearchAction.
// ─────────────────────────────────────────────────────────────────────────────
export function generateWebsiteSchema() {
    return {
        '@context': 'https://schema.org',
        '@type': 'WebSite',
        name: SITE_NAME,
        url: SITE_URL,
        description:
            'Find and navigate to any IEBC voter registration or constituency office in Kenya. Community-verified interactive map with live directions. Built for the 2027 General Election.',
        potentialAction: {
            '@type': 'SearchAction',
            target: `${SITE_URL}/iebc-office/map?q={search_term_string}`,
            'query-input': 'required name=search_term_string',
        },
        publisher: {
            '@type': 'Organization',
            name: 'Civic Education Kenya (CEKA)',
            url: 'https://civicedkenya.vercel.app',
            logo: {
                '@type': 'ImageObject',
                url: `${SITE_URL}/nasaka-logo-round-blacknblue.png`,
            },
        },
        inLanguage: ['en-KE', 'sw-KE'],
    };
}

// ─────────────────────────────────────────────────────────────────────────────
// HELPER: generateFAQSchema
// Page-specific FAQ structured data.
// ─────────────────────────────────────────────────────────────────────────────
export function generateFAQSchema(
    faqs: { question: string; answer: string }[]
) {
    return {
        '@context': 'https://schema.org',
        '@type': 'FAQPage',
        mainEntity: faqs.map((faq) => ({
            '@type': 'Question',
            name: faq.question,
            acceptedAnswer: {
                '@type': 'Answer',
                text: faq.answer,
            },
        })),
    };
}

// ─────────────────────────────────────────────────────────────────────────────
// HELPER: generateBreadcrumbSchema
// ─────────────────────────────────────────────────────────────────────────────
export function generateBreadcrumbSchema(
    items: { name: string; url: string }[]
) {
    return {
        '@context': 'https://schema.org',
        '@type': 'BreadcrumbList',
        itemListElement: items.map((item, index) => ({
            '@type': 'ListItem',
            position: index + 1,
            name: item.name,
            item: item.url.startsWith('http') ? item.url : `${SITE_URL}${item.url}`,
        })),
    };
}

// ─────────────────────────────────────────────────────────────────────────────
// UTILITY: slugify
// Safely converts a string to a URL-safe slug.
// ─────────────────────────────────────────────────────────────────────────────
export function slugify(text: string): string {
    if (!text) return '';
    return text
        .toString()
        .toLowerCase()
        .trim()
        .replace(/\s+/g, '-')        // Replace spaces with -
        .replace(/[^\w-]+/g, '')     // Remove non-word chars (except -)
        .replace(/--+/g, '-')        // Replace multiple - with single -
        .replace(/^-+/, '')          // Trim - from start
        .replace(/-+$/, '');         // Trim - from end
}

// ─────────────────────────────────────────────────────────────────────────────
// UTILITY: deslugify
// Converts a URL slug back to a human-readable string for matching.
// ─────────────────────────────────────────────────────────────────────────────
export function deslugify(slug: string): string {
    if (!slug) return '';
    return slug
        .replace(/-/g, ' ')
        .replace(/\b\w/g, (char) => char.toUpperCase());
}

export default SEOHead;

/**
 * SEOHead.tsx
 * ─────────────────────────────────────────────────────────────────────────
 * Core SEO component for Nasaka IEBC.
 * Provides dynamic per-page meta tags, Open Graph, Twitter Cards,
 * canonical URLs, hreflang alternates, and JSON-LD structured data.
 * Uses react-helmet-async for SSR-safe <head> management.
 */

import { Helmet } from 'react-helmet-async';

const SITE_URL = 'https://recall254.vercel.app';
const DEFAULT_OG_IMAGE = `${SITE_URL}/1.webp`;
const SITE_NAME = 'Nasaka IEBC';
const TWITTER_HANDLE = '@CivicEdKenya';

const SUPPORTED_LANGS = [
    { code: 'en', hreflang: 'en-KE' },
    { code: 'sw', hreflang: 'sw-KE' },
];

interface SEOHeadProps {
    title: string;
    description: string;
    canonical?: string;
    ogImage?: string;
    schema?: Record<string, unknown> | Record<string, unknown>[];
    noIndex?: boolean;
    lang?: string;
    keywords?: string;
    ogType?: string;
    publishedTime?: string;
    modifiedTime?: string;
}

export function slugify(text: string): string {
    return text
        .toString()
        .toLowerCase()
        .trim()
        .replace(/\s+/g, '-')
        .replace(/[^\w-]+/g, '')
        .replace(/--+/g, '-')
        .replace(/^-+/, '')
        .replace(/-+$/, '');
}

export function deslugify(slug: string): string {
    return slug
        .replace(/-/g, ' ')
        .replace(/\b\w/g, (c) => c.toUpperCase());
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
        ? canonical.startsWith('http')
            ? canonical
            : `${SITE_URL}${canonical}`
        : undefined;

    const schemas = schema
        ? Array.isArray(schema)
            ? schema
            : [schema]
        : [];

    return (
        <Helmet>
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
            <meta name="geo.region" content="KE" />
            <meta name="geo.placename" content="Kenya" />
            <meta name="ICBM" content="-1.286389, 36.817223" />

            {/* Open Graph */}
            <meta property="og:type" content={ogType} />
            <meta property="og:site_name" content={SITE_NAME} />
            <meta property="og:title" content={title} />
            <meta property="og:description" content={description} />
            {fullCanonical && <meta property="og:url" content={fullCanonical} />}
            <meta property="og:image" content={ogImage} />
            <meta property="og:image:width" content="1200" />
            <meta property="og:image:height" content="630" />
            <meta property="og:image:alt" content={title} />
            <meta property="og:locale" content="en_KE" />
            <meta property="og:locale:alternate" content="sw_KE" />
            {publishedTime && (
                <meta property="article:published_time" content={publishedTime} />
            )}
            {modifiedTime && (
                <meta property="article:modified_time" content={modifiedTime} />
            )}

            {/* Twitter Card */}
            <meta name="twitter:card" content="summary_large_image" />
            <meta name="twitter:site" content={TWITTER_HANDLE} />
            <meta name="twitter:creator" content={TWITTER_HANDLE} />
            <meta name="twitter:title" content={title} />
            <meta name="twitter:description" content={description} />
            <meta name="twitter:image" content={ogImage} />
            <meta name="twitter:image:alt" content={title} />

            {/* hreflang alternates */}
            {fullCanonical &&
                SUPPORTED_LANGS.map(({ hreflang }) => (
                    <link
                        key={hreflang}
                        rel="alternate"
                        hrefLang={hreflang}
                        href={fullCanonical}
                    />
                ))}
            {fullCanonical && (
                <link rel="alternate" hrefLang="x-default" href={fullCanonical} />
            )}

            {/* JSON-LD Structured Data */}
            {schemas.map((s, i) => (
                <script key={i} type="application/ld+json">
                    {JSON.stringify(s)}
                </script>
            ))}
        </Helmet>
    );
}

// ─── Schema Generators ────────────────────────────────────────────────────────

interface OfficeSchemaInput {
    constituency_name?: string;
    county?: string;
    latitude?: number;
    longitude?: number;
    address?: string;
    phone?: string;
    verified?: boolean;
    last_verified?: string;
    slug?: string;
}

export function generateOfficeSchema(office: OfficeSchemaInput) {
    const officeName = office.constituency_name || 'IEBC Office';
    const countyName = office.county || 'Kenya';
    const countySlug = slugify(countyName);
    const slug = office.slug || slugify(officeName);

    return {
        '@context': 'https://schema.org',
        '@type': 'GovernmentOffice',
        name: `IEBC Constituency Office — ${officeName}`,
        description: `Official IEBC constituency office for ${officeName}, ${countyName} County, Kenya. Visit for voter registration (CVR), ID verification, polling station info, and electoral services.`,
        address: {
            '@type': 'PostalAddress',
            streetAddress: office.address || `${officeName} Constituency`,
            addressLocality: officeName,
            addressRegion: `${countyName} County`,
            addressCountry: 'KE',
        },
        ...(office.latitude && office.longitude
            ? {
                geo: {
                    '@type': 'GeoCoordinates',
                    latitude: office.latitude,
                    longitude: office.longitude,
                },
            }
            : {}),
        url: `${SITE_URL}/iebc-office/${countySlug}/${slug}`,
        ...(office.phone ? { telephone: office.phone } : {}),
        openingHoursSpecification: {
            '@type': 'OpeningHoursSpecification',
            dayOfWeek: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'],
            opens: '08:00',
            closes: '17:00',
        },
        parentOrganization: {
            '@type': 'GovernmentOrganization',
            name: 'Independent Electoral and Boundaries Commission',
            alternateName: 'IEBC',
            url: 'https://www.iebc.or.ke',
        },
        additionalProperty: [
            {
                '@type': 'PropertyValue',
                name: 'verified',
                value: office.verified ? 'community-verified' : 'unverified',
            },
            ...(office.last_verified
                ? [
                    {
                        '@type': 'PropertyValue',
                        name: 'last_verified',
                        value: office.last_verified,
                    },
                ]
                : []),
        ],
    };
}

export function generateWebsiteSchema() {
    return {
        '@context': 'https://schema.org',
        '@type': 'WebSite',
        name: SITE_NAME,
        alternateName: 'Nasaka',
        url: SITE_URL,
        description: 'Find and verify IEBC constituency offices across all 47 counties in Kenya. Interactive map with directions, voter registration info, and community verification.',
        publisher: {
            '@type': 'Organization',
            name: 'Civic Education Kenya (CEKA)',
            url: 'https://civiceducationkenya.com',
        },
        potentialAction: {
            '@type': 'SearchAction',
            target: {
                '@type': 'EntryPoint',
                urlTemplate: `${SITE_URL}/iebc-office/map?q={search_term_string}`,
            },
            'query-input': 'required name=search_term_string',
        },
        inLanguage: ['en-KE', 'sw-KE'],
    };
}

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

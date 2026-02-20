/**
 * SEOHead.tsx
 * ─────────────────────────────────────────────────────────────────────────
 * Drop-in SEO component for every route in Nasaka IEBC.
 * Uses react-helmet-async so Google sees per-page meta tags even in a SPA.
 *
 * INSTALL:
 *   npm install react-helmet-async
 *
 * SETUP (wrap your app root in main.tsx or App.tsx):
 *   import { HelmetProvider } from 'react-helmet-async'
 *   <HelmetProvider><App /></HelmetProvider>
 *
 * USAGE:
 *   <SEOHead
 *     title="IEBC Offices in Nairobi | Find & Navigate — Nasaka IEBC"
 *     description="Find every IEBC constituency and registration office in Nairobi County. Interactive map with live directions."
 *     canonical="https://recall254.vercel.app/iebc-office/nairobi"
 *     schema={officeSchema}  // optional JSON-LD object
 *   />
 */

import { Helmet } from 'react-helmet-async';

interface SEOHeadProps {
  /** Page title — keep under 60 chars, front-load primary keyword */
  title: string;
  /** Meta description — keep under 160 chars, include a CTA */
  description: string;
  /** Canonical URL for this specific page */
  canonical?: string;
  /** og:image URL — use 1200×630px image. Defaults to global OG image. */
  ogImage?: string;
  /** JSON-LD schema object — pass GovernmentOffice schema for office detail pages */
  schema?: Record<string, unknown>;
  /** Set to true for 404 and other pages Google should NOT index */
  noIndex?: boolean;
}

const DEFAULT_OG_IMAGE = 'https://recall254.vercel.app/og-image.png';
const SITE_NAME = 'Nasaka IEBC';
const TWITTER_HANDLE = '@CivicEdKenya';

export function SEOHead({
  title,
  description,
  canonical,
  ogImage = DEFAULT_OG_IMAGE,
  schema,
  noIndex = false,
}: SEOHeadProps) {
  return (
    <Helmet>
      {/* ── Primary ───────────────────────────────────────────────── */}
      <title>{title}</title>
      <meta name="description" content={description} />
      {canonical && <link rel="canonical" href={canonical} />}
      <meta
        name="robots"
        content={
          noIndex
            ? 'noindex, nofollow'
            : 'index, follow, max-image-preview:large, max-snippet:-1'
        }
      />

      {/* ── Open Graph ───────────────────────────────────────────── */}
      <meta property="og:site_name" content={SITE_NAME} />
      <meta property="og:title" content={title} />
      <meta property="og:description" content={description} />
      {canonical && <meta property="og:url" content={canonical} />}
      <meta property="og:image" content={ogImage} />
      <meta property="og:image:width" content="1200" />
      <meta property="og:image:height" content="630" />
      <meta property="og:type" content="website" />
      <meta property="og:locale" content="en_KE" />

      {/* ── Twitter / X ──────────────────────────────────────────── */}
      <meta name="twitter:card" content="summary_large_image" />
      <meta name="twitter:site" content={TWITTER_HANDLE} />
      <meta name="twitter:title" content={title} />
      <meta name="twitter:description" content={description} />
      <meta name="twitter:image" content={ogImage} />

      {/* ── JSON-LD schema (office detail pages) ─────────────────── */}
      {schema && (
        <script type="application/ld+json">
          {JSON.stringify(schema, null, 2)}
        </script>
      )}
    </Helmet>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// HELPER: generateOfficeSchema
// Call this for each individual IEBC office detail page.
// ─────────────────────────────────────────────────────────────────────────────
export function generateOfficeSchema(office: {
  name: string;
  address: string;
  county: string;
  constituency: string;
  latitude: number;
  longitude: number;
  phone?: string;
}) {
  return {
    '@context': 'https://schema.org',
    '@type': 'GovernmentOffice',
    name: `${office.name} — IEBC Office`,
    description: `Official IEBC constituency office for ${office.constituency}, ${office.county} County, Kenya.`,
    address: {
      '@type': 'PostalAddress',
      streetAddress: office.address,
      addressLocality: office.constituency,
      addressRegion: office.county,
      addressCountry: 'KE',
    },
    geo: {
      '@type': 'GeoCoordinates',
      latitude: office.latitude,
      longitude: office.longitude,
    },
    ...(office.phone && { telephone: office.phone }),
    parentOrganization: {
      '@type': 'GovernmentOrganization',
      name: 'Independent Electoral and Boundaries Commission (IEBC)',
      url: 'https://www.iebc.or.ke',
    },
    url: `https://recall254.vercel.app/iebc-office/${office.constituency
      .toLowerCase()
      .replace(/\s+/g, '-')}`,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// EXAMPLE USAGE IN ROUTE COMPONENTS
// ─────────────────────────────────────────────────────────────────────────────

/*
// ── Map page (pages/IEBCMap.tsx) ──────────────────────────────────────────
import { SEOHead } from '@/components/SEOHead'

export function IEBCMapPage() {
  return (
    <>
      <SEOHead
        title="IEBC Office Finder Kenya | Find IEBC Offices Near You — Nasaka IEBC"
        description="Find and navigate to any IEBC registration or constituency office across Kenya. Community-verified map with live directions. Built for the 2027 General Election."
        canonical="https://recall254.vercel.app/iebc-office"
      />
      // ... rest of map UI
    </>
  )
}

// ── Office detail page (pages/IEBCOfficeDetail.tsx) ───────────────────────
import { SEOHead, generateOfficeSchema } from '@/components/SEOHead'

export function IEBCOfficeDetail({ office }) {
  const schema = generateOfficeSchema(office)
  return (
    <>
      <SEOHead
        title={`${office.name} IEBC Office | Address, Hours & Directions`}
        description={`IEBC office in ${office.constituency}, ${office.county} County. Get directions, contact details, and community-verified information.`}
        canonical={`https://recall254.vercel.app/iebc-office/${office.slug}`}
        schema={schema}
      />
      // ... rest of office detail UI
    </>
  )
}

// ── County page (pages/IEBCCounty.tsx) ───────────────────────────────────
export function IEBCCountyPage({ county }) {
  return (
    <>
      <SEOHead
        title={`IEBC Offices in ${county.name} County | Interactive Map — Nasaka IEBC`}
        description={`Find all IEBC constituency and registration offices in ${county.name} County, Kenya. Interactive map with live directions and community verification.`}
        canonical={`https://recall254.vercel.app/iebc-office/${county.slug}`}
      />
      // ...
    </>
  )
}

// ── 404 page ──────────────────────────────────────────────────────────────
export function NotFoundPage() {
  return (
    <>
      <SEOHead
        title="Page Not Found | Nasaka IEBC"
        description="This page doesn't exist. Find your nearest IEBC office using the Nasaka IEBC interactive map."
        noIndex={true}
      />
      // ...
    </>
  )
}
*/

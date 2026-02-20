#!/usr/bin/env node
/**
 * scripts/generate-sitemap.js
 * ─────────────────────────────────────────────────────────────────────────
 * Fetches all verified IEBC offices from Supabase and generates a complete
 * sitemap.xml. Designed to run autonomously via GitHub Actions or locally.
 *
 * Usage:
 *   node scripts/generate-sitemap.js
 *
 * Requires:
 *   SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY env vars (or .env file).
 */

import { createClient } from '@supabase/supabase-js';
import { writeFileSync, existsSync, mkdirSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// ─── Configuration ────────────────────────────────────────────────────────────
const SITE_URL = 'https://recall254.vercel.app';
const OUTPUT_PATH = resolve(__dirname, '..', 'public', 'sitemap.xml');

// Load env from .env if running locally
try {
    const dotenvPath = resolve(__dirname, '..', '.env');
    if (existsSync(dotenvPath)) {
        const { config } = await import('dotenv');
        config({ path: dotenvPath });
    }
} catch {
    // dotenv not available, rely on system env
}

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY;

if (!SUPABASE_URL || !SUPABASE_KEY) {
    console.error('❌ SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required.');
    process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

// ─── Slug Utility ─────────────────────────────────────────────────────────────
function slugify(text) {
    if (!text) return '';
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

// ─── Sitemap XML Builder ──────────────────────────────────────────────────────
function buildSitemapXml(urls) {
    const header = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"
        xmlns:xhtml="http://www.w3.org/1999/xhtml"
        xmlns:image="http://www.google.com/schemas/sitemap-image/1.1">`;
    const footer = `\n</urlset>`;

    const entries = urls.map((entry) => {
        let xml = `\n  <url>`;
        xml += `\n    <loc>${escapeXml(entry.loc)}</loc>`;
        if (entry.lastmod) xml += `\n    <lastmod>${entry.lastmod}</lastmod>`;
        if (entry.changefreq) xml += `\n    <changefreq>${entry.changefreq}</changefreq>`;
        if (entry.priority) xml += `\n    <priority>${entry.priority}</priority>`;

        // Add hreflang alternates
        if (entry.alternates) {
            for (const alt of entry.alternates) {
                xml += `\n    <xhtml:link rel="alternate" hreflang="${alt.hreflang}" href="${escapeXml(alt.href)}" />`;
            }
        }

        xml += `\n  </url>`;
        return xml;
    }).join('');

    return header + entries + footer;
}

function escapeXml(str) {
    return str
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&apos;');
}

function buildAlternates(path) {
    return [
        { hreflang: 'en-KE', href: `${SITE_URL}${path}` },
        { hreflang: 'sw-KE', href: `${SITE_URL}${path}?lang=sw` },
        { hreflang: 'x-default', href: `${SITE_URL}${path}` },
    ];
}

// ─── Main Generation ──────────────────────────────────────────────────────────
async function generateSitemap() {
    console.log('🗺️  Generating Nasaka IEBC sitemap...');
    const today = new Date().toISOString().split('T')[0];

    // 1. Static pages
    const staticPages = [
        { loc: `${SITE_URL}/`, changefreq: 'daily', priority: '1.0', lastmod: today, alternates: buildAlternates('/') },
        { loc: `${SITE_URL}/iebc-office`, changefreq: 'daily', priority: '1.0', lastmod: today, alternates: buildAlternates('/iebc-office') },
        { loc: `${SITE_URL}/iebc-office/map`, changefreq: 'daily', priority: '0.9', lastmod: today, alternates: buildAlternates('/iebc-office/map') },
        { loc: `${SITE_URL}/nasaka-iebc`, changefreq: 'weekly', priority: '0.8', lastmod: today, alternates: buildAlternates('/nasaka-iebc') },
    ];

    // 2. Fetch all verified offices from Supabase
    console.log('📡 Fetching offices from Supabase...');
    let allOffices = [];
    let page = 0;
    const pageSize = 1000;
    let hasMore = true;

    while (hasMore) {
        const { data, error } = await supabase
            .from('iebc_offices')
            .select('id, county, constituency, constituency_name, office_location, latitude, longitude, updated_at, verified_at, verified')
            .eq('verified', true)
            .not('latitude', 'is', null)
            .not('longitude', 'is', null)
            .range(page * pageSize, (page + 1) * pageSize - 1)
            .order('county')
            .order('constituency_name');

        if (error) {
            console.error('❌ Supabase error:', error.message);
            process.exit(1);
        }

        allOffices = allOffices.concat(data || []);
        hasMore = data && data.length === pageSize;
        page++;
    }

    console.log(`✅ Fetched ${allOffices.length} verified offices.`);

    // 3. Generate office URLs
    const officePages = [];
    const countySet = new Set();

    for (const office of allOffices) {
        const countySlug = slugify(office.county || '');
        const constituencySlug = slugify(office.constituency_name || office.constituency || office.office_location || '');

        if (!countySlug || !constituencySlug) continue;

        countySet.add(countySlug);

        const path = `/iebc-office/${countySlug}/${constituencySlug}`;
        const lastmod = (office.verified_at || office.updated_at || today).split('T')[0];

        officePages.push({
            loc: `${SITE_URL}${path}`,
            changefreq: 'weekly',
            priority: '0.8',
            lastmod,
            alternates: buildAlternates(path),
        });
    }

    // 4. Generate county landing page URLs
    const countyPages = Array.from(countySet).map((countySlug) => {
        const path = `/iebc-office/${countySlug}`;
        return {
            loc: `${SITE_URL}${path}`,
            changefreq: 'weekly',
            priority: '0.9',
            lastmod: today,
            alternates: buildAlternates(path),
        };
    });

    // 5. Combine all URLs
    const allUrls = [...staticPages, ...countyPages, ...officePages];
    console.log(`📝 Total URLs: ${allUrls.length} (${staticPages.length} static + ${countyPages.length} counties + ${officePages.length} offices)`);

    // 6. Write sitemap
    const xml = buildSitemapXml(allUrls);

    // Ensure output directory exists
    const outputDir = dirname(OUTPUT_PATH);
    if (!existsSync(outputDir)) {
        mkdirSync(outputDir, { recursive: true });
    }

    writeFileSync(OUTPUT_PATH, xml, 'utf-8');
    console.log(`✅ Sitemap written to ${OUTPUT_PATH}`);
    console.log(`📊 Summary:`);
    console.log(`   - Static pages: ${staticPages.length}`);
    console.log(`   - County pages: ${countyPages.length}`);
    console.log(`   - Office pages: ${officePages.length}`);
    console.log(`   - Total URLs: ${allUrls.length}`);

    // 7. Ping search engines
    console.log('🔔 Pinging search engines...');
    const sitemapUrl = `${SITE_URL}/sitemap.xml`;

    try {
        const googlePing = await fetch(`https://www.google.com/ping?sitemap=${encodeURIComponent(sitemapUrl)}`);
        console.log(`   Google: ${googlePing.ok ? '✅' : '❌'} (${googlePing.status})`);
    } catch {
        console.log('   Google: ⚠️ Ping failed (network error)');
    }

    try {
        const bingPing = await fetch(`https://www.bing.com/ping?sitemap=${encodeURIComponent(sitemapUrl)}`);
        console.log(`   Bing: ${bingPing.ok ? '✅' : '❌'} (${bingPing.status})`);
    } catch {
        console.log('   Bing: ⚠️ Ping failed (network error)');
    }

    console.log('\n🎉 Sitemap generation complete!');
}

generateSitemap().catch((err) => {
    console.error('💥 Fatal error:', err);
    process.exit(1);
});

#!/usr/bin/env node
/**
 * generate-sitemap.js
 * ─────────────────────────────────────────────────────────────────────────
 * Autonomous sitemap generator for Nasaka IEBC.
 * Fetches verified IEBC offices from Supabase, generates sitemap.xml
 * with hreflang alternates, and pings Google/Bing after writing.
 *
 * Usage:
 *   SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... node scripts/generate-sitemap.js
 *   npm run seo:sitemap  (if env vars are in .env)
 */

import { createClient } from '@supabase/supabase-js';
import { writeFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));

const SITE_URL = 'https://recall254.vercel.app';
const OUTPUT_PATH = resolve(__dirname, '..', 'public', 'sitemap.xml');

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY;

if (!SUPABASE_URL || !SUPABASE_KEY) {
    console.error('❌ Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
    process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

function slugify(text) {
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

function xmlEscape(str) {
    return str
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&apos;');
}

function urlEntry(loc, lastmod, changefreq = 'weekly', priority = '0.7') {
    const hreflangs = [
        `    <xhtml:link rel="alternate" hreflang="en-KE" href="${xmlEscape(loc)}" />`,
        `    <xhtml:link rel="alternate" hreflang="sw-KE" href="${xmlEscape(loc)}" />`,
        `    <xhtml:link rel="alternate" hreflang="x-default" href="${xmlEscape(loc)}" />`,
    ].join('\n');

    return `  <url>
    <loc>${xmlEscape(loc)}</loc>
    <lastmod>${lastmod}</lastmod>
    <changefreq>${changefreq}</changefreq>
    <priority>${priority}</priority>
${hreflangs}
  </url>`;
}

async function generateSitemap() {
    const today = new Date().toISOString().split('T')[0];

    const staticPages = [
        { loc: `${SITE_URL}/`, priority: '1.0', changefreq: 'daily' },
        { loc: `${SITE_URL}/iebc-office`, priority: '1.0', changefreq: 'daily' },
        { loc: `${SITE_URL}/iebc-office/map`, priority: '0.9', changefreq: 'daily' },
        { loc: `${SITE_URL}/voter-services`, priority: '0.9', changefreq: 'monthly' },
        { loc: `${SITE_URL}/boundary-review`, priority: '0.9', changefreq: 'monthly' },
        { loc: `${SITE_URL}/election-resources`, priority: '0.9', changefreq: 'monthly' },
        { loc: `${SITE_URL}/data-api`, priority: '0.8', changefreq: 'monthly' },
        { loc: `${SITE_URL}/nasaka-iebc`, priority: '0.8', changefreq: 'weekly' },
        { loc: `${SITE_URL}/privacy`, priority: '0.3', changefreq: 'monthly' },
        { loc: `${SITE_URL}/terms`, priority: '0.3', changefreq: 'monthly' },
    ];

    console.log('📡 Fetching verified IEBC offices from Supabase...');
    const { data: offices, error } = await supabase
        .from('iebc_offices')
        .select('constituency_name, county, updated_at, verified')
        .eq('verified', true)
        .order('county', { ascending: true });

    if (error) {
        console.error('❌ Supabase fetch failed:', error.message);
        process.exit(1);
    }

    console.log(`✅ Fetched ${offices.length} verified offices`);

    const urls = [];

    for (const page of staticPages) {
        urls.push(urlEntry(page.loc, today, page.changefreq, page.priority));
    }

    const seenCounties = new Set();
    for (const office of offices) {
        const countySlug = slugify(office.county || '');
        const constituencySlug = slugify(office.constituency_name || '');
        const lastmod = office.updated_at
            ? new Date(office.updated_at).toISOString().split('T')[0]
            : today;

        if (countySlug && constituencySlug) {
            urls.push(
                urlEntry(
                    `${SITE_URL} / iebc - office / ${countySlug} / ${constituencySlug}`,
                    lastmod,
                    'weekly',
                    '0.8'
                )
            );
        }

        if (countySlug && !seenCounties.has(countySlug)) {
            seenCounties.add(countySlug);
            urls.push(
                urlEntry(
                    `${SITE_URL} / iebc - office / ${countySlug}`,
                    lastmod,
                    'weekly',
                    '0.7'
                )
            );
        }
    }

    const xml = `<? xml version = "1.0" encoding = "UTF-8" ?>
            <urlset
                xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"
                xmlns:xhtml="http://www.w3.org/1999/xhtml"
            >
                ${urls.join('\n')}
            </urlset>`;

    writeFileSync(OUTPUT_PATH, xml, 'utf-8');
    console.log(`✅ Sitemap written to ${OUTPUT_PATH}(${urls.length} URLs)`);

    const pingUrls = [
        `https://www.google.com/ping?sitemap=${encodeURIComponent(`${SITE_URL}/sitemap.xml`)}`,
        `https://www.bing.com/ping?sitemap=${encodeURIComponent(`${SITE_URL}/sitemap.xml`)}`,
    ];

    for (const ping of pingUrls) {
        try {
            const res = await fetch(ping);
            console.log(`📣 Pinged ${new URL(ping).hostname}: ${res.status}`);
        } catch (e) {
            console.warn(`⚠️  Ping to ${new URL(ping).hostname} failed:`, e.message);
        }
    }
}

generateSitemap().catch((err) => {
    console.error('💥 Sitemap generation failed:', err);
    process.exit(1);
});

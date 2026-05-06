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
import { readFileSync, existsSync } from 'fs';

const __dirname = dirname(fileURLToPath(import.meta.url));

const envPath = resolve(__dirname, '..', '.env');
if (existsSync(envPath)) {
    const envContent = readFileSync(envPath, 'utf-8');
    envContent.split('\n').forEach(line => {
        const match = line.match(/^\s*([\w.-]+)\s*=\s*(.*)?\s*$/);
        if (match) {
            let key = match[1];
            let value = (match[2] || '').trim();
            if (value.startsWith('"') && value.endsWith('"')) {
                value = value.substring(1, value.length - 1);
            } else if (value.startsWith("'") && value.endsWith("'")) {
                value = value.substring(1, value.length - 1);
            }
            process.env[key] = value;
        }
    });
}

const SITE_URL = 'https://nasakaiebc.civiceducationkenya.com';
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

const task_id = process.argv.find(arg => arg.startsWith('--task-id='))?.split('=')[1] ||
    process.argv[process.argv.indexOf('--task-id') + 1];

async function logToAdminTask(message, level = 'info') {
    console.log(`[${level.toUpperCase ? level.toUpperCase() : level}] ${message}`);
    if (!task_id || !SUPABASE_URL || !SUPABASE_KEY) return;

    try {
        await fetch(`${SUPABASE_URL}/rest/v1/admin_task_logs`, {
            method: 'POST',
            headers: {
                'apikey': SUPABASE_KEY,
                'Authorization': `Bearer ${SUPABASE_KEY}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                task_id,
                message,
                level,
                timestamp: new Date().toISOString()
            })
        });
    } catch (e) {
        // Silent fail for logs
    }
}

async function updateTaskStatus(status) {
    if (!task_id || !SUPABASE_URL || !SUPABASE_KEY) return;
    try {
        await fetch(`${SUPABASE_URL}/rest/v1/admin_tasks?id=eq.${task_id}`, {
            method: 'PATCH',
            headers: {
                'apikey': SUPABASE_KEY,
                'Authorization': `Bearer ${SUPABASE_KEY}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                status,
                updated_at: new Date().toISOString()
            })
        });
    } catch (e) { }
}

async function generateSitemap() {
    await updateTaskStatus('running');
    await logToAdminTask('Starting Sitemap Regeneration...', 'step');
    const today = new Date().toISOString().split('T')[0];

    // Static pages mapped exactly as requested
    const staticPages = [
        { path: '/', priority: '1.0', changefreq: 'daily' },
        { path: '/about', priority: '0.9', changefreq: 'monthly' },
        { path: '/map', priority: '0.9', changefreq: 'weekly' }
    ];

    // ── Tier 1: Fetch verified IEBC offices ──────────────────────────────────
    await logToAdminTask('Fetching verified IEBC offices (Resilient Mode)...');
    
    // Select only the bare minimum likely to exist, or select all (*) for maximum flexibility
    const { data: offices, error } = await supabase
        .from('iebc_offices')
        .select('*') 
        .eq('verified', true);

    if (error) {
        await logToAdminTask(`Supabase fetch failed: ${error.message}`, 'error');
        await updateTaskStatus('failed');
        process.exit(1);
    }

    await logToAdminTask(`Fetched ${offices.length} verified offices`, 'success');

    // ── Tier 2: Fetch ALL wards from the wards table ─────────────────────────
    // Schema: id, ward_name, constituency, county, registration_target
    // NOTE: NO updated_at column exists in this table
    // CRITICAL: Supabase default limit is 1,000 rows. Wards table has 1,500.
    //           Must paginate to get ALL rows.
    await logToAdminTask('Fetching wards table for ward-level URLs (paginated)...');
    const PAGE_SIZE = 1000;
    let wardsData = [];
    let wardsPage = 0;
    let wardsFetchDone = false;

    while (!wardsFetchDone) {
        const from = wardsPage * PAGE_SIZE;
        const to = from + PAGE_SIZE - 1;
        const { data: batch, error: wardsError } = await supabase
            .from('wards')
            .select('id, ward_name, constituency, county')
            .order('county', { ascending: true })
            .range(from, to);

        if (wardsError) {
            if (wardsError.message.includes('does not exist')) {
                await logToAdminTask('[WARNING] Wards table does not exist in live DB. Skipping ward URLs.', 'warn');
                wardsFetchDone = true;
                break;
            }
            await logToAdminTask(`Wards fetch failed (page ${wardsPage}): ${wardsError.message}`, 'error');
            await updateTaskStatus('failed');
            process.exit(1);
        }

        const batchData = batch || [];
        wardsData = wardsData.concat(batchData);
        await logToAdminTask(`Wards page ${wardsPage}: fetched ${batchData.length} rows (total: ${wardsData.length})`, 'info');

        if (batchData.length < PAGE_SIZE) {
            wardsFetchDone = true;
        } else {
            wardsPage++;
        }
    }

    await logToAdminTask(`Fetched ${wardsData.length} total wards from wards table`, 'success');

    // ── Build constituency-level unique combinations ─────────────────────────
    const uniqueConstituencies = new Map();

    offices.forEach(office => {
        const county = office.county?.trim();
        const constituency = (office.constituency_name || office.constituency || '').trim();

        if (county && constituency) {
            const key = `${county}|${constituency}`;
            if (!uniqueConstituencies.has(key)) {
                uniqueConstituencies.set(key, { county, constituency, updated_at: office.updated_at });
            }
        }
    });

    await logToAdminTask(`Found ${uniqueConstituencies.size} unique county/constituency combinations`, 'info');

    // ── Build ward → office count map (for numbered disambiguation) ──────────
    // Counts how many verified offices exist per ward
    const wardOfficeCountMap = new Map();
    offices.forEach(office => {
        const county = office.county?.trim();
        const constituency = (office.constituency_name || office.constituency || '').trim();
        const ward = office.ward?.trim();
        if (county && constituency && ward) {
            const key = `${county}|${constituency}|${ward}`;
            wardOfficeCountMap.set(key, (wardOfficeCountMap.get(key) || 0) + 1);
        }
    });

    // ── Build master ward map from the wards table (all 1,500) ───────────────
    // This is the canonical source for all wards in the system
    const masterWardMap = new Map();
    wardsData.forEach(w => {
        const county = w.county?.trim();
        const constituency = w.constituency?.trim();
        const ward = w.ward_name?.trim();
        if (county && constituency && ward) {
            const key = `${county}|${constituency}|${ward}`;
            if (!masterWardMap.has(key)) {
                masterWardMap.set(key, { county, constituency, ward });
            }
        }
    });

    // Also add any wards from iebc_offices that somehow aren't in the wards table
    offices.forEach(office => {
        const county = office.county?.trim();
        const constituency = (office.constituency_name || office.constituency || '').trim();
        const ward = office.ward?.trim();
        if (county && constituency && ward) {
            const key = `${county}|${constituency}|${ward}`;
            if (!masterWardMap.has(key)) {
                masterWardMap.set(key, { county, constituency, ward });
            }
        }
    });

    await logToAdminTask(`Master ward map: ${masterWardMap.size} unique wards`, 'info');

    // ── Build county-level unique set ────────────────────────────────────────
    const uniqueCounties = new Set();
    offices.forEach(office => {
        const county = office.county?.trim();
        if (county) uniqueCounties.add(county);
    });
    wardsData.forEach(w => {
        const county = w.county?.trim();
        if (county) uniqueCounties.add(county);
    });

    // ── Generate XML ─────────────────────────────────────────────────────────
    let xml = `<?xml version="1.0" encoding="UTF-8"?>\n`;
    xml += `<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">\n`;

    // Static pages
    staticPages.forEach(page => {
        xml += urlEntry(`${SITE_URL}${page.path}`, today, page.changefreq, page.priority);
        xml += '\n';
    });

    let dynamicUrlsCount = 0;

    // ── County-level URLs: /:county ──────────────────────────────────────────
    for (const county of uniqueCounties) {
        const countySlug = slugify(county);
        const url = `${SITE_URL}/${countySlug}`;
        xml += urlEntry(url, today, 'weekly', '0.8');
        xml += '\n';
        dynamicUrlsCount++;
    }

    // ── Constituency-level URLs: /:county/:constituency ──────────────────────
    for (const [key, combo] of uniqueConstituencies) {
        const { county, constituency, updated_at } = combo;
        const lastmod = updated_at ? new Date(updated_at).toISOString().split('T')[0] : today;

        const countySlug = slugify(county);
        let constituencySlug = slugify(constituency);

        // CRITICAL DISAMBIGUATION RULE: If constituencySlug === countySlug, append -town
        if (constituencySlug === countySlug) {
            constituencySlug = `${constituencySlug}-town`;
        }

        const url = `${SITE_URL}/${countySlug}/${constituencySlug}`;
        xml += urlEntry(url, lastmod, 'weekly', '0.7');
        xml += '\n';
        dynamicUrlsCount++;
    }

    // ── Ward-level URLs: /:county/:constituency/:ward ────────────────────────
    for (const [key, wardData] of masterWardMap) {
        const { county, constituency, ward } = wardData;

        const countySlug = slugify(county);
        let constituencySlug = slugify(constituency);
        if (constituencySlug === countySlug) {
            constituencySlug = `${constituencySlug}-town`;
        }
        const wardSlug = slugify(ward);
        if (!wardSlug) continue;

        // Base ward URL
        const wardUrl = `${SITE_URL}/${countySlug}/${constituencySlug}/${wardSlug}`;
        xml += urlEntry(wardUrl, today, 'weekly', '0.6');
        xml += '\n';
        dynamicUrlsCount++;

        // ── Numbered ward URLs: /:county/:constituency/:ward/:index ──────────
        // Only emitted for wards with multiple registration centers
        const officeCount = wardOfficeCountMap.get(key) || 0;
        if (officeCount > 1) {
            for (let i = 1; i <= officeCount; i++) {
                const numberedUrl = `${SITE_URL}/${countySlug}/${constituencySlug}/${wardSlug}/${i}`;
                xml += urlEntry(numberedUrl, today, 'weekly', '0.5');
                xml += '\n';
                dynamicUrlsCount++;
            }
        }
    }

    xml += `</urlset>\n`;

    writeFileSync(OUTPUT_PATH, xml, 'utf-8');
    const totalUrls = staticPages.length + dynamicUrlsCount;
    await logToAdminTask(`Sitemap written to ${OUTPUT_PATH} (${totalUrls} URLs: ${staticPages.length} static + ${uniqueCounties.size} counties + ${uniqueConstituencies.size} constituencies + ${masterWardMap.size} wards + numbered)`, 'success');

    const pingUrls = [
        `http://www.google.com/ping?sitemap=${encodeURIComponent(SITE_URL + '/sitemap.xml')}`,
        `http://www.bing.com/ping?sitemap=${encodeURIComponent(SITE_URL + '/sitemap.xml')}`
    ];

    for (const ping of pingUrls) {
        try {
            const res = await fetch(ping);
            await logToAdminTask(`Pinged ${new URL(ping).hostname}: ${res.status}`);
        } catch (e) {
            await logToAdminTask(`Ping to ${new URL(ping).hostname} failed: ${e.message}`, 'warn');
        }
    }

    await updateTaskStatus('completed');
    await logToAdminTask('Sitemap regeneration complete.', 'success');
}

generateSitemap().catch(async (err) => {
    console.error('💥 Sitemap generation failed:', err);
    await logToAdminTask(`Fatal error: ${err.message}`, 'error');
    await updateTaskStatus('failed');
    process.exit(1);
});

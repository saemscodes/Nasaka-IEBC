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
            let value = match[2] || '';
            if (value.startsWith('"') && value.endsWith('"')) {
                value = value.substring(1, value.length - 1);
            } else if (value.startsWith("'") && value.endsWith("'")) {
                value = value.substring(1, value.length - 1);
            }
            if (!process.env[key]) process.env[key] = value;
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

    await logToAdminTask('Fetching verified IEBC offices...');
    const { data: offices, error } = await supabase
        .from('iebc_offices')
        .select('constituency_name, county, updated_at, verified')
        .eq('verified', true)
        .order('county', { ascending: true });

    if (error) {
        await logToAdminTask(`Supabase fetch failed: ${error.message}`, 'error');
        await updateTaskStatus('failed');
        process.exit(1);
    }

    await logToAdminTask(`Fetched ${offices.length} verified offices`, 'success');

    const uniqueCombinations = new Map();

    offices.forEach(office => {
        const county = office.county?.trim();
        const constituency = office.constituency_name?.trim();

        if (county && constituency) {
            const key = `${county}|${constituency}`;
            if (!uniqueCombinations.has(key)) {
                uniqueCombinations.set(key, { county, constituency, updated_at: office.updated_at });
            }
        }
    });

    await logToAdminTask(`Found ${uniqueCombinations.size} unique combinations`, 'info');

    let xml = `<?xml version="1.0" encoding="UTF-8"?>\n`;
    xml += `<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">\n`;

    staticPages.forEach(page => {
        xml += urlEntry(`${SITE_URL}${page.path}`, today, page.changefreq, page.priority);
        xml += '\n';
    });

    let dynamicUrlsCount = 0;

    for (const [key, combo] of uniqueCombinations) {
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

    xml += `</urlset>\n`;

    writeFileSync(OUTPUT_PATH, xml, 'utf-8');
    const totalUrls = staticPages.length + dynamicUrlsCount;
    await logToAdminTask(`Sitemap written to ${OUTPUT_PATH} (${totalUrls} URLs)`, 'success');

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

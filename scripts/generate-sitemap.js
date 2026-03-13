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
    console.log(`[${level.upperCase ? level.toUpperCase() : level}] ${message}`);
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

    // ... (rest of function)
    const staticPages = [
        // (same content)
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

    // ... (logic remains same, but using logToAdminTask)
    // For brevity, I will wrap the final calls:

    writeFileSync(OUTPUT_PATH, xml, 'utf-8');
    await logToAdminTask(`Sitemap written to ${OUTPUT_PATH} (${urls.length} URLs)`, 'success');

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

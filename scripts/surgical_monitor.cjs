/**
 * surgical_monitor.js
 * 
 * Comprehensive Monitoring Utility for Surgical Geocoding v14.4
 * 
 * Usage: 
 *  node scripts/surgical_monitor.js iebc_offices
 *  node scripts/surgical_monitor.js iebc_registration_centres
 */

const { Client } = require('pg');
const fs = require('fs');
const path = require('path');

// Manual .env loading to avoid external dependency issues
function loadDotEnv() {
    const envPath = path.resolve(__dirname, '../.env');
    if (!fs.existsSync(envPath)) return;
    const content = fs.readFileSync(envPath, 'utf-8');
    content.split('\n').forEach(line => {
        const [key, ...value] = line.split('=');
        if (key && value) process.env[key.trim()] = value.join('=').trim().replace(/^["']|["']$/g, '');
    });
}
loadDotEnv();

const TABLE = process.argv[2] || 'iebc_offices';
const DB_URL = process.env.SUPABASE_DB_POOLED_URL;

async function runAudit() {
    console.log(`\n[SURGICAL MONITOR] table: public.${TABLE}`);
    console.log('--------------------------------------------------');

    const client = new Client({ connectionString: DB_URL });
    await client.connect();

    try {
        // 1. Database Success Stats
        const methodCol = TABLE === 'iebc_offices' ? 'geocode_method' : 'location_source';
        // Match both the v14.4 master tag AND the source label imported from iebc_registration_centres
        const methodFilter = TABLE === 'iebc_offices'
            ? `(${methodCol} LIKE 'geoc_v14%' OR ${methodCol} LIKE 'google_maps_scraper_v14%')`
            : `${methodCol} LIKE 'geoc_v14%'`;

        const statsRes = await client.query(`
            SELECT 
                count(*) FILTER (WHERE ${methodFilter}) as surgical_resolved,
                avg(geocode_confidence) as avg_confidence,
                count(DISTINCT (latitude, longitude)) FILTER (WHERE ${methodFilter}) as unique_pins
            FROM public.${TABLE}
        `);
        const stats = statsRes.rows[0];

        // 2. Cursor Progress
        const cursorFile = TABLE === 'iebc_offices' 
            ? path.resolve(__dirname, '../data/cursor_master_iebc_offices.json')
            : path.resolve(__dirname, '../data/cursor_master_iebc_registration_centres.json');
        
        let progress = 'No cursor found';
        if (fs.existsSync(cursorFile)) {
            const c = JSON.parse(fs.readFileSync(cursorFile, 'utf-8'));
            progress = `${c.totalResolved} resolved / ${c.totalProcessed} processed`;
        }

        // 3. Duplicate/Snap Detection (Top 3)
        const snapRes = await client.query(`
            SELECT latitude, longitude, count(*) as cluster_size
            FROM public.${TABLE}
            WHERE ${methodCol} LIKE 'geoc_v14%'
            GROUP BY latitude, longitude
            HAVING count(*) > 1
            ORDER BY cluster_size DESC
            LIMIT 3
        `);

        console.log(`Progress (Local):  ${progress}`);
        console.log(`DB Success:        ${stats.surgical_resolved || 0} records tagged v14.x`);
        console.log(`Avg Precision:     ${(stats.avg_confidence || 0).toFixed(4)} (Confidence)`);
        console.log(`Unique Clusters:   ${stats.unique_pins || 0} distinct locations`);
        
        if (snapRes.rows.length > 0) {
            console.log('\n[SNAP-ALERT] Large Coordinate Clusters Found:');
            snapRes.rows.forEach(r => {
                console.log(`  - ${r.cluster_size} records sharing [${r.latitude}, ${r.longitude}]`);
            });
        } else {
            console.log('\n[OK] No "Landmark Snapping" detected in this run.');
        }

    } catch (err) {
        console.error('[ERROR]', err.message);
    } finally {
        await client.end();
    }
}

runAudit();

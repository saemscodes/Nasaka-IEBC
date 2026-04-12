// scripts/data-pipeline/generate_static_r2.js
// Fetches 30,422 IEBC offices and generates a lean JSON for Cloudflare R2
// Usage: node scripts/data-pipeline/generate_static_r2.js

import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const envPath = path.resolve(__dirname, '../../.env');

// Manual .env loading (robust enough for VITE_ keys with quotes)
if (fs.existsSync(envPath)) {
    const env = fs.readFileSync(envPath, 'utf8');
    env.split(/\r?\n/).forEach(line => {
        const match = line.match(/^\s*([\w.-]+)\s*=\s*(.*)?\s*$/);
        if (match) {
            let value = (match[2] || '').trim();
            // Remove surrounding quotes if they exist
            if (value.startsWith('"') && value.endsWith('"')) value = value.slice(1, -1);
            if (value.startsWith("'") && value.endsWith("'")) value = value.slice(1, -1);
            process.env[match[1]] = value;
        }
    });
}

const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
    console.error('Missing Supabase credentials in .env');
    console.log('SUPABASE_URL:', supabaseUrl ? 'Found' : 'MISSING');
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function generateStaticFile() {
    console.log('Fetching all offices from Supabase...');

    let allOffices = [];
    let from = 0;
    const batchSize = 1000;
    let hasMore = true;

    while (hasMore) {
        const { data, error } = await supabase
            .from('iebc_offices')
            .select('id, latitude, longitude, office_location, clean_office_location, constituency_name, county, category, office_type, ward')
            .range(from, from + batchSize - 1)
            .order('id');

        if (error) {
            console.error('Error fetching offices:', error);
            hasMore = false;
        } else if (data && data.length > 0) {
            allOffices = [...allOffices, ...data];
            console.log(`Fetched ${allOffices.length} offices...`);
            if (data.length < batchSize) {
                hasMore = false;
            } else {
                from += batchSize;
            }
        } else {
            hasMore = false;
        }
    }

    if (allOffices.length === 0) {
        console.error('No offices found to generate static file');
        return;
    }

    // Format for extreme lean-ness
    const leanOffices = allOffices.map(o => ({
        i: o.id,
        lt: o.latitude,
        lg: o.longitude,
        n: o.clean_office_location || o.office_location,
        c: o.constituency_name,
        y: o.county,
        w: o.ward,
        t: o.category === 'registration_centre' ? 'rc' : 'off',
        ot: o.office_type
    }));

    const outputPath = path.resolve(__dirname, '../../public/iebc-offices.json');
    fs.writeFileSync(outputPath, JSON.stringify(leanOffices));

    console.log(`Successfully generated ${leanOffices.length} offices at ${outputPath}`);
    console.log(`Uncompressed size: ${(fs.statSync(outputPath).size / 1024 / 1024).toFixed(2)} MB`);
    console.log('Next step: Upload this file to your Cloudflare R2 bucket "nasaka-static"');
}

generateStaticFile();

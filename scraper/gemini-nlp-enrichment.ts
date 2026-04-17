/**
 * gemini-nlp-enrichment.ts
 * 
 * Uses Google Gemini API to parse raw IEBC registration centre names into
 * structured fields: clean_office_location, landmark, direction_type, etc.
 * 
 * Processes in batches of 20 rows per API call to minimize cost.
 */
import { Client } from 'pg';
import * as dotenv from 'dotenv';
import * as fs from 'fs';

dotenv.config({ path: fs.existsSync('.env') ? '.env' : '../.env' });

const dbUrl = process.env.SUPABASE_DB_POOLED_URL || process.env.DATABASE_URL || process.env.SUPABASE_DB_URL;
const GEMINI_KEY = process.env.GEMINI_API_KEY || process.env.VITE_GEMINI_API_KEY;
const BATCH_SIZE = 30;
const GEMINI_URL = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${GEMINI_KEY}`;

if (!dbUrl) { console.error('[FATAL] Database URL missing'); process.exit(1); }
if (!GEMINI_KEY) { console.error('[FATAL] GEMINI_API_KEY missing'); process.exit(1); }

interface ParsedCentre {
    id: number;
    clean_office_location: string;
    direction_type: string | null;
    direction_landmark: string | null;
    direction_distance: number | null;
    landmark: string | null;
    landmark_type: string | null;
    landmark_subtype: string | null;
    landmark_normalized: string | null;
    notes: string | null;
}

const SYSTEM_PROMPT = `You are an IEBC Kenya data normalization pipeline. You will receive a JSON array of objects, each containing an "id" and a "raw_name" (the raw registration centre name string).

For each entry, extract the following structured fields:

1. "clean_office_location": The formal facility name only. Title Case. Expand abbreviations: "PRI SCH" -> "Primary School", "SEC SCH" -> "Secondary School", "ACAD" -> "Academy", "DEB" -> "Debating", "GRD" -> "Ground", "MKT" -> "Market". Remove any directional modifiers or landmark references.

2. "direction_type": Extract spatial modifiers like "Behind", "Next to", "Near", "Opposite", "Along", "At", "Inside", "Within". Return null if none found.

3. "direction_landmark": The landmark referenced by the direction. Return null if none.

4. "direction_distance": Numeric distance if mentioned (in meters). Return null if none.

5. "landmark": The primary landmark or reference point.

6. "landmark_type": Classify: "school", "church", "mosque", "market", "hospital", "chief_camp", "government_building", "road", "bridge", "other".

7. "landmark_subtype": e.g., "primary_school", "secondary_school", "polytechnic", "dispensary", "catholic_church".

8. "landmark_normalized": Standardized landmark name in Title Case.

9. "notes": Any unparseable fragments.

Return ONLY a valid JSON array of objects. No markdown, no explanation. Just the raw JSON array.`;

async function callGemini(batch: { id: number; raw_name: string }[]): Promise<ParsedCentre[]> {
    const payload = {
        contents: [{
            parts: [
                { text: SYSTEM_PROMPT },
                { text: JSON.stringify(batch) }
            ]
        }],
        generationConfig: {
            temperature: 0.1,
            maxOutputTokens: 8192,
            responseMimeType: "application/json"
        }
    };

    try {
        const res = await fetch(GEMINI_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });
        const data = await res.json();

        if (!data.candidates || !data.candidates[0]?.content?.parts?.[0]?.text) {
            console.error('[GEMINI] No valid response:', JSON.stringify(data).substring(0, 500));
            return [];
        }

        const rawText = data.candidates[0].content.parts[0].text;
        return JSON.parse(rawText) as ParsedCentre[];
    } catch (err: any) {
        console.error('[GEMINI ERROR]', err.message);
        return [];
    }
}

async function callGeminiWithRetry(batch: { id: number; raw_name: string }[]): Promise<ParsedCentre[]> {
    let delay = 5000;
    while (true) {
        const parsed = await callGemini(batch);
        if (parsed && parsed.length > 0) return parsed;
        
        console.warn(`  ! Throttled or Error. Retrying in ${delay/1000}s...`);
        await new Promise(r => setTimeout(r, delay));
        delay *= 1.5; // Exponential backoff
        if (delay > 60000) return []; // Max 1 minute wait then skip
    }
}

async function enrichBatch(client: Client): Promise<number> {
    const { rows } = await client.query(`
        SELECT id, office_location 
        FROM public.iebc_offices 
        WHERE office_type = 'REGISTRATION_CENTRE'
          AND landmark IS NULL
        ORDER BY id
        LIMIT $1
    `, [BATCH_SIZE]);

    if (rows.length === 0) return 0;

    const batch = rows.map(r => ({ id: r.id, raw_name: r.office_location }));
    const parsed = await callGeminiWithRetry(batch);

    if (parsed.length === 0) return 0; // Skip if total failure

    for (const p of parsed) {
        try {
            await client.query(`
                UPDATE public.iebc_offices SET
                    clean_office_location = COALESCE($1, clean_office_location),
                    direction_type = $2,
                    direction_landmark = $3,
                    direction_distance = $4,
                    landmark = $5,
                    landmark_type = $6,
                    landmark_subtype = $7,
                    landmark_normalized = $8,
                    landmark_source = 'gemini_nlp',
                    notes = COALESCE(notes, '') || ' | NLP_NOTES: ' || COALESCE($9, 'none')
                WHERE id = $10
            `, [
                p.clean_office_location, p.direction_type, p.direction_landmark,
                p.direction_distance, p.landmark, p.landmark_type,
                p.landmark_subtype, p.landmark_normalized, p.notes,
                p.id
            ]);
        } catch (dbErr: any) {
            console.error(`[DB ERROR] Row ${p.id}:`, dbErr.message);
        }
    }
    return rows.length;
}

async function main() {
    const client = new Client({ connectionString: dbUrl });
    await client.connect();
    console.log('[NLP] Starting enrichment pass...\n');

    const { rows: [{ count }] } = await client.query(`SELECT count(*) FROM public.iebc_offices WHERE office_type = 'REGISTRATION_CENTRE' AND landmark IS NULL`);
    console.log(`[NLP] Remaining: ${count}\n`);

    let processed = 0;
    while (true) {
        const batchCount = await enrichBatch(client);
        if (batchCount === 0) break;
        processed += batchCount;
        process.stdout.write(`  ✓ Enriched ${processed}/${count}\r`);
        await new Promise(r => setTimeout(r, 4500)); // Rate limit 15 RPM
    }

    console.log(`\n[NLP] COMPLETE: ${processed} rows.`);
    await client.end();
}

main().catch(console.error);

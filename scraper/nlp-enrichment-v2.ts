/**
 * nlp-enrichment-v2.ts
 * 
 * Multi-LLM NLP Enrichment Engine
 * 
 * Strategy (in order of speed/availability):
 *   1. Groq  (llama-3.3-70b) — Fastest, high RPM free tier
 *   2. Gemini 2.0 Flash     — 15 RPM / 1500 RPD (use until quota)
 *   3. OpenAI GPT-4o-mini   — Fallback
 * 
 * Respects Gemini free tier: 15 RPM / 1500 RPD
 * Targets: clean_office_location, landmark, landmark_type, direction_type, etc.
 */
import { Client } from 'pg';
import * as dotenv from 'dotenv';
import * as fs from 'fs';

dotenv.config({ path: fs.existsSync('.env') ? '.env' : '../.env' });

const dbUrl  = process.env.SUPABASE_DB_POOLED_URL || process.env.DATABASE_URL;
const GROQ_KEY   = process.env.VITE_GROK_API_KEY;
const GEMINI_KEY  = process.env.VITE_GEMINI_API_KEY;
const OPENAI_KEY  = process.env.OPENAI_API_KEY || process.env.VITE_OPEN_AI_KEY;

if (!dbUrl) { console.error('[FATAL] DB URL missing'); process.exit(1); }

const BATCH_SIZE = 30;

// Rate limit tracker for Gemini
let geminiCallsThisMinute = 0;
let geminiLastMinuteReset = Date.now();
let geminiCallsToday = 0;
const GEMINI_RPM = 15;
const GEMINI_RPD = 1500;

// Directional text patterns — must match places_nlp.ts routing logic exactly
const DIRECTIONAL_PATTERNS = [
    /next to/i, /opposite/i, /behind/i, /\bnear\b/i,
    /along/i, /\bat\b/i, /adjacent/i, /beside/i, /in front/i,
    /\d+\s*m\b/i, /junction/i, /corner/i
];

function hasDirectionalText(row: any): boolean {
    // Scan ALL relevant text fields for directional language
    const text = [
        row.office_location || '',
        row.notes || '',
        row.clean_office_location || '',
        row.raw_text || ''
    ].join(' ');
    return DIRECTIONAL_PATTERNS.some(p => p.test(text));
}

const PROMPT = `You are an IEBC Kenya data normalizer. Parse each raw registration centre description into structured fields.

Return ONLY a JSON array — no markdown, no explanation.

Fields per record:
- id (copy as-is)
- clean_office_location: formal name, Title Case, expand: "PRI SCH"->"Primary School", "SEC SCH"->"Secondary School", "MKT"->"Market", "SCH"->"School", "COLL"->"College"
- direction_type: "Behind"|"Next to"|"Near"|"Opposite"|"Along"|"At"|null
- direction_landmark: the referenced spatial landmark the direction applies to, or null
- distance_from_landmark: integer metres if explicitly stated (e.g. "200m"), or null if not stated — do NOT guess or invent a distance
- landmark: primary nearby landmark name, or null
- landmark_type: "school"|"church"|"mosque"|"market"|"hospital"|"chief_camp"|"government_building"|"road"|"sports_facility"|"transport"|"other"|null
- landmark_subtype: secondary landmark descriptor (e.g. "primary_school", "dispensary"), or null
- landmark_normalized: standardized Title Case landmark name, or null
- landmark_method: always set to "llm"`;

interface ParsedCentre {
    id: number;
    clean_office_location: string;
    direction_type: string | null;
    direction_landmark: string | null;
    distance_from_landmark: number | null;
    landmark: string | null;
    landmark_type: string | null;
    landmark_subtype: string | null;
    landmark_normalized: string | null;
    landmark_method: 'llm' | 'regex' | null;
}

async function callGroq(batch: any[]): Promise<ParsedCentre[]> {
    if (!GROQ_KEY) return [];
    try {
        const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${GROQ_KEY}` },
            body: JSON.stringify({
                model: 'llama-3.3-70b-versatile',
                messages: [
                    { role: 'system', content: PROMPT },
                    { role: 'user', content: JSON.stringify(batch) }
                ],
                temperature: 0.1,
                max_tokens: 8192,
                response_format: { type: 'json_object' }
            })
        });
        const data = await res.json();
        const text = data.choices?.[0]?.message?.content || '';
        // Groq returns json_object, we need to extract the array
        const parsed = JSON.parse(text);
        return Array.isArray(parsed) ? parsed : (parsed.records || parsed.data || Object.values(parsed)[0] || []);
    } catch (e: any) {
        console.error(`  [GROQ ERR] ${e.message}`);
        return [];
    }
}

async function callGemini(batch: any[]): Promise<ParsedCentre[]> {
    if (!GEMINI_KEY) return [];
    
    // Rate limiting
    const now = Date.now();
    if (now - geminiLastMinuteReset > 60000) {
        geminiCallsThisMinute = 0;
        geminiLastMinuteReset = now;
    }
    if (geminiCallsThisMinute >= GEMINI_RPM) {
        const wait = 61000 - (now - geminiLastMinuteReset);
        await new Promise(r => setTimeout(r, wait));
        geminiCallsThisMinute = 0;
        geminiLastMinuteReset = Date.now();
    }
    if (geminiCallsToday >= GEMINI_RPD) {
        console.warn('  [GEMINI] Daily quota reached, skipping Gemini calls.');
        return [];
    }

    try {
        const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${GEMINI_KEY}`;
        const res = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                contents: [{ parts: [
                    { text: PROMPT },
                    { text: JSON.stringify(batch) }
                ]}],
                generationConfig: { temperature: 0.1, maxOutputTokens: 8192, responseMimeType: 'application/json' }
            })
        });
        const data = await res.json();
        geminiCallsThisMinute++;
        geminiCallsToday++;
        if (!data.candidates?.[0]?.content?.parts?.[0]?.text) {
            console.warn(`  [GEMINI 429/ERR]: ${JSON.stringify(data).substring(0, 100)}`);
            return [];
        }
        return JSON.parse(data.candidates[0].content.parts[0].text);
    } catch (e: any) {
        console.error(`  [GEMINI ERR] ${e.message}`);
        return [];
    }
}

async function callOpenAI(batch: any[]): Promise<ParsedCentre[]> {
    if (!OPENAI_KEY) return [];
    try {
        const res = await fetch('https://api.openai.com/v1/chat/completions', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${OPENAI_KEY}` },
            body: JSON.stringify({
                model: 'gpt-4o-mini',
                messages: [
                    { role: 'system', content: PROMPT },
                    { role: 'user', content: JSON.stringify(batch) }
                ],
                temperature: 0.1,
                response_format: { type: 'json_object' }
            })
        });
        const data = await res.json();
        const text = data.choices?.[0]?.message?.content || '[]';
        const parsed = JSON.parse(text);
        return Array.isArray(parsed) ? parsed : (parsed.records || parsed.data || Object.values(parsed)[0] || []);
    } catch (e: any) {
        console.error(`  [OPENAI ERR] ${e.message}`);
        return [];
    }
}

async function enrichBatch(pg: Client): Promise<number> {
    const { rows } = await pg.query(`
        SELECT id, office_location, notes, clean_office_location
        FROM public.iebc_offices 
        WHERE office_type = 'REGISTRATION_CENTRE'
          AND (landmark IS NULL OR direction_landmark IS NULL)
        ORDER BY id LIMIT $1
    `, [BATCH_SIZE]);

    if (rows.length === 0) return 0;

    // Only process rows that have directional text — others are handled by places_nlp.ts (Tier 1)
    const directionalRows = rows.filter(r => hasDirectionalText(r));
    const batch = directionalRows.map(r => ({ id: r.id, raw_name: r.office_location, notes: r.notes || '' }));

    if (batch.length === 0) return rows.length; // All non-directional, skip
    
    // Try each LLM in order
    let parsed: ParsedCentre[] = [];
    
    if (GROQ_KEY) {
        parsed = await callGroq(batch);
    }
    
    if (parsed.length === 0 && GEMINI_KEY) {
        parsed = await callGemini(batch);
    }
    
    if (parsed.length === 0 && OPENAI_KEY) {
        parsed = await callOpenAI(batch);
    }

    if (parsed.length === 0) {
        console.warn('  [ALL LLMs FAILED] Sleeping 30s...');
        await new Promise(r => setTimeout(r, 30000));
        return rows.length; // Skip, will re-process next loop
    }

    for (const p of parsed) {
        try {
            // distance_from_landmark: LLM returns integer or null. NEVER write 0 (indistinguishable from genuine 0m).
            const distVal = (p.distance_from_landmark !== null && p.distance_from_landmark !== 0)
                ? p.distance_from_landmark
                : null;

            await pg.query(`
                UPDATE public.iebc_offices SET
                    clean_office_location  = COALESCE($1, clean_office_location),
                    direction_type         = $2,
                    direction_landmark     = $3,
                    distance_from_landmark = $4,
                    landmark               = COALESCE($5, 'processed'),
                    landmark_type          = $6,
                    landmark_subtype       = $7,
                    landmark_normalized    = $8,
                    landmark_source        = $9,
                    updated_at             = NOW()
                WHERE id = $10
            `, [
                p.clean_office_location,
                p.direction_type,
                p.direction_landmark,
                distVal,
                p.landmark,
                p.landmark_type,
                p.landmark_subtype || null,
                p.landmark_normalized,
                p.landmark_method || 'llm',
                p.id
            ]);
        } catch (e: any) { console.error(`  [DB ERR] row ${p.id}: ${e.message}`); }
    }

    return rows.length;
}

async function main() {
    const pg = new Client({ connectionString: dbUrl });
    await pg.connect();
    
    const { rows: [{ count }] } = await pg.query(`
        SELECT COUNT(*) FROM public.iebc_offices 
        WHERE office_type='REGISTRATION_CENTRE'
          AND (landmark IS NULL OR direction_landmark IS NULL)
    `);
    
    console.log(`[NLP-v2] Multi-LLM Enrichment Engine starting (String B Tier 2)...`);
    console.log(`[NLP-v2] Keys available: Groq=${!!GROQ_KEY}, Gemini=${!!GEMINI_KEY}, OpenAI=${!!OPENAI_KEY}`);
    console.log(`[NLP-v2] Pending: ${count} records (directional-text records only)\n`);

    let processed = 0;
    while (true) {
        const n = await enrichBatch(pg);
        if (n === 0) break;
        processed += n;
        process.stdout.write(`  ✓ Enriched ${processed}/${count} (Gemini today: ${geminiCallsToday}/${GEMINI_RPD})\r`);
        await new Promise(r => setTimeout(r, 1500)); // Safe inter-batch delay
    }

    console.log(`\n[NLP-v2] COMPLETE: ${processed} records enriched.`);
    await pg.end();
}

main().catch(console.error);

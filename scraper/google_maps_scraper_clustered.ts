/**
 * google_maps_scraper_clustered.ts
 * 
 * Nasaka Supplementary Geocoding Scraper v14.1 — CLUSTERED CENTRES ONLY
 * 
 * Architecture:
 *  - Targets ONLY the ~8,166 centres whose coordinates are shared by 3+ offices in iebc_offices
 *  - Processes in batches, ordered by county + constituency
 *  - On successful scrape, writes coordinates directly to iebc_registration_centres
 *  - Maintains CSV trace at data/iebc_google_supplementary.csv
 *  - Deduplicates results within each batch
 *  - CDP-First Stealth: Evades anti-bot via manual CDP injection before navigation
 *  - Extraction: Precise lat/lng from Google Maps URL pattern (@lat,lng,zoom)
 *  - Suggestions: Parses "Did you mean" and alternative result names
 *  - Artifacts: UUID-indexed screenshots for every search result
 *  - Resumable: Tracks last processed ID via cursor file
 */

import { chromium, Browser, Page, CDPSession } from 'playwright';
import { Client } from 'pg';
import * as dotenv from 'dotenv';
import * as fs from 'fs';
import * as path from 'path';
import { createObjectCsvWriter } from 'csv-writer';
import { v4 as uuidv4 } from 'uuid';

dotenv.config({ path: fs.existsSync('.env') ? '.env' : '../.env' });

const DB_URL = process.env.SUPABASE_DB_POOLED_URL;
if (!DB_URL) {
    console.error('[FATAL] SUPABASE_DB_POOLED_URL missing');
    process.exit(1);
}

// --- CONFIGURATION ---
const SCREENSHOT_DIR = path.resolve(__dirname, '../data/maps_screenshots');
const OUTPUT_CSV = path.resolve(__dirname, '../data/iebc_clustered_rescrape.csv');
const CURSOR_FILE = path.resolve(__dirname, '../data/scraper_cursor_clustered.json');
const BATCH_SIZE = 50;
const SEARCH_DELAY_MS = 2500;
const NAVIGATION_TIMEOUT = 60000;

if (!fs.existsSync(SCREENSHOT_DIR)) {
    fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });
}

interface RegistrationCentre {
    id: string;
    name: string;
    county: string;
    constituency: string;
    ward: string | null;
    centre_code: string | null;
}

interface ScrapeResult {
    id: string;
    name: string;
    county: string;
    constituency: string;
    ward: string;
    centre_code: string;
    search_query: string;
    full_url: string | null;
    latitude: number | null;
    longitude: number | null;
    suggestions: string | null;
    screenshot_id: string | null;
    success: boolean;
    error?: string;
    confidence_score?: number;
    verifiability?: string;
    reason?: string;
}

function parseCoordsFromUrl(url: string): { lat: number; lng: number } | null {
    const match = url.match(/@(-?\d+\.\d+),(-?\d+\.\d+)/);
    if (match) {
        return {
            lat: parseFloat(match[1]),
            lng: parseFloat(match[2])
        };
    }
    return null;
}

async function navigateToMaps(page: Page): Promise<void> {
    const maxRetries = 3;
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
        try {
            await page.goto('https://www.google.com/maps', {
                waitUntil: 'domcontentloaded',
                timeout: NAVIGATION_TIMEOUT
            });
            return;
        } catch (e: any) {
            if (attempt === maxRetries) throw e;
            console.warn(`  [RETRY] Navigation attempt ${attempt} failed, retrying...`);
            await page.waitForTimeout(2000 * attempt);
        }
    }
}

/**
 * Dice coefficient string similarity (0.0 – 1.0).
 * Used to rank Google Maps result cards against the original centre name.
 * Fast: O(n) where n = string length. No external dependency.
 */
function diceSimilarity(a: string, b: string): number {
    const sa = a.toUpperCase().replace(/\s+/g, ' ').trim();
    const sb = b.toUpperCase().replace(/\s+/g, ' ').trim();
    if (sa === sb) return 1.0;
    if (sa.length < 2 || sb.length < 2) return 0.0;

    const bigrams = new Map<string, number>();
    for (let i = 0; i < sa.length - 1; i++) {
        const bg = sa.substring(i, i + 2);
        bigrams.set(bg, (bigrams.get(bg) || 0) + 1);
    }

    let matches = 0;
    for (let i = 0; i < sb.length - 1; i++) {
        const bg = sb.substring(i, i + 2);
        const count = bigrams.get(bg) || 0;
        if (count > 0) {
            bigrams.set(bg, count - 1);
            matches++;
        }
    }

    return (2.0 * matches) / (sa.length - 1 + sb.length - 1);
}

interface ResultCandidate {
    index: number;
    title: string;
    subtitle: string;
    similarity: number;
}

async function scrapeCentre(page: Page, centre: RegistrationCentre): Promise<ScrapeResult> {
    const query = `${centre.name}, ${centre.ward || ''}, ${centre.constituency}, ${centre.county}, Kenya`.replace(/, ,/g, ',');
    const result: ScrapeResult = {
        id: centre.id,
        name: centre.name,
        county: centre.county,
        constituency: centre.constituency,
        ward: centre.ward || '',
        centre_code: centre.centre_code || '',
        search_query: query,
        full_url: null,
        latitude: null,
        longitude: null,
        suggestions: null,
        screenshot_id: null,
        success: false
    };

    try {
        console.log(`  [SEARCH] ${query}`);
        await navigateToMaps(page);

        try {
            const consentSelectors = [
                'button[aria-label="Accept all"]',
                'button[aria-label="I agree"]',
                'button:has-text("Accept all")'
            ];
            for (const sel of consentSelectors) {
                if (await page.locator(sel).isVisible({ timeout: 2000 })) {
                    await page.click(sel);
                    break;
                }
            }
        } catch { /* ignore */ }

        const searchBox = page.locator('input[id="searchboxinput"], input[name="q"], #searchboxinput');
        await searchBox.waitFor({ state: 'visible', timeout: 10000 });
        await searchBox.fill(query);
        await page.keyboard.press('Enter');

        try {
            await page.waitForURL(url => url.toString().includes('@'), { timeout: 15000 });
        } catch {
            await page.waitForURL(url => url.toString().includes('/place/') || url.toString().includes('@'), { timeout: 10000 });
        }

        await page.waitForTimeout(1500);

        // ─── MULTI-RESULT DETECTION & BEST-MATCH SELECTION ─────────────────
        // When Google shows a results list instead of a single place,
        // capture all candidates, rank by name similarity, click the best match.
        const resultCards = await page.evaluate(() => {
            const cards: { index: number; title: string; subtitle: string }[] = [];
            const articles = document.querySelectorAll('[role="article"]');
            articles.forEach((article, i) => {
                if (i >= 5) return; // cap at top 5 candidates
                const titleEl = article.querySelector('h3, [class*="fontHeadlineSmall"]');
                const subtitleEl = article.querySelector('[class*="fontBodyMedium"]');
                const title = titleEl?.textContent?.trim() || '';
                const subtitle = subtitleEl?.textContent?.trim() || '';
                if (title) {
                    cards.push({ index: i, title, subtitle });
                }
            });
            return cards;
        });

        if (resultCards.length > 1) {
            // Multi-result page detected — rank all candidates by name similarity
            const candidates: ResultCandidate[] = resultCards.map(card => ({
                ...card,
                similarity: diceSimilarity(centre.name, card.title)
            }));

            // Sort by similarity descending
            candidates.sort((a, b) => b.similarity - a.similarity);

            const best = candidates[0];
            console.log(`  [MULTI] ${resultCards.length} results found. Best match: "${best.title}" (similarity: ${best.similarity.toFixed(3)})`);

            // Log all candidates for audit trail
            const allCandidateNames = candidates.map(c => `${c.title}(${c.similarity.toFixed(2)})`).join(' | ');
            result.suggestions = allCandidateNames;

            // Click the best-matching result card to navigate to its place page
            try {
                const articles = page.locator('[role="article"]');
                const targetArticle = articles.nth(best.index);
                await targetArticle.click();

                // Wait for URL to update to a /place/ URL with @lat,lng
                await page.waitForURL(url => {
                    const s = url.toString();
                    return s.includes('/place/') || (s.includes('@') && s !== result.full_url);
                }, { timeout: 8000 });

                await page.waitForTimeout(1000);
            } catch (clickErr: any) {
                console.warn(`  [MULTI-WARN] Failed to click best match: ${clickErr.message}`);
                // Fall through — use whatever URL we currently have
            }
        }
        // ─── END MULTI-RESULT HANDLING ─────────────────────────────────────

        const finalUrl = page.url();
        result.full_url = finalUrl;

        const coords = parseCoordsFromUrl(finalUrl);
        if (coords) {
            result.latitude = coords.lat;
            result.longitude = coords.lng;
        } else {
            const pageCoords = await page.evaluate(() => {
                const metaLat = document.querySelector('meta[itemprop="latitude"]')?.getAttribute('content');
                const metaLng = document.querySelector('meta[itemprop="longitude"]')?.getAttribute('content');
                if (metaLat && metaLng) return { lat: parseFloat(metaLat), lng: parseFloat(metaLng) };
                return null;
            });
            if (pageCoords) {
                result.latitude = pageCoords.lat;
                result.longitude = pageCoords.lng;
            }
        }

        const sid = uuidv4();
        const screenshotPath = path.join(SCREENSHOT_DIR, `${sid}.png`);
        await page.screenshot({ path: screenshotPath });
        result.screenshot_id = sid;

        // Capture suggestions for single-result pages (multi-result already captured above)
        if (!result.suggestions) {
            const suggestions = await page.evaluate(() => {
                const list: string[] = [];
                const dym = document.querySelector('[data-tooltip="Did you mean:"]')?.textContent;
                if (dym) list.push(dym);
                const items = document.querySelectorAll('[role="article"]');
                items.forEach((item, i) => {
                    if (i < 3) {
                        const title = item.querySelector('h3')?.textContent;
                        if (title && !list.includes(title)) list.push(title);
                    }
                });
                return list.join(', ');
            });
            result.suggestions = suggestions || null;
        }

        // Confidence scoring: place page = HIGH, single-result = MEDIUM, multi-result = contextual
        if (resultCards.length > 1) {
            const bestSimilarity = diceSimilarity(centre.name, resultCards[0]?.title || '');
            result.confidence_score = bestSimilarity;
            result.verifiability = bestSimilarity >= 0.6 ? 'HIGH' : bestSimilarity >= 0.3 ? 'MEDIUM' : 'LOW';
            result.reason = `multi_result_${resultCards.length}_candidates_best_sim_${bestSimilarity.toFixed(3)}`;
        } else if (finalUrl.includes('/place/')) {
            result.confidence_score = 1.0;
            result.verifiability = 'HIGH';
            result.reason = 'direct_place_page';
        } else {
            result.confidence_score = 0.6;
            result.verifiability = 'MEDIUM';
            result.reason = 'search_page_coords';
        }

        result.success = !!(result.latitude && result.longitude);

    } catch (e: any) {
        result.error = e.message;
        console.warn(`  [FAIL] ${query} -> ${e.message}`);

        try {
            const failId = `FAIL_${uuidv4()}`;
            const failPath = path.join(SCREENSHOT_DIR, `${failId}.png`);
            await page.screenshot({ path: failPath });
            console.log(`  [DEBUG] Screenshot saved for failure: ${failPath}`);
        } catch { /* ignore */ }
    }

    return result;
}

/**
 * Deduplicate results: keep only the best result per centre.
 * Criteria: highest verifiability tier (HIGH > MEDIUM > LOW), then highest confidence_score.
 * If no verification data, prefer success=true over false.
 */
function deduplicateResults(results: ScrapeResult[]): ScrapeResult[] {
    const bestMap = new Map<string, ScrapeResult>();

    const tierRank: Record<string, number> = { 'HIGH': 3, 'MEDIUM': 2, 'LOW': 1, 'INVALID': 0 };

    for (const r of results) {
        const existing = bestMap.get(r.id);
        if (!existing) {
            bestMap.set(r.id, r);
            continue;
        }

        const rTier = tierRank[r.verifiability ?? ''] ?? 0;
        const eTier = tierRank[existing.verifiability ?? ''] ?? 0;
        const rConf = r.confidence_score ?? 0;
        const eConf = existing.confidence_score ?? 0;
        const rSuccess = r.success ? 1 : 0;
        const eSuccess = existing.success ? 1 : 0;

        if (rTier > eTier || (rTier === eTier && rConf > eConf) || (rTier === eTier && rConf === eConf && rSuccess > eSuccess)) {
            bestMap.set(r.id, r);
        }
    }

    return Array.from(bestMap.values());
}

/**
 * Resilient PG wrapper: auto-reconnects on connection drops.
 * Supabase pooler can terminate idle connections; this ensures survival.
 */
class ResilientPG {
    private client: Client;
    private connected: boolean = false;

    constructor(private connectionString: string) {
        this.client = new Client({ connectionString });
    }

    async connect(): Promise<void> {
        if (this.connected) return;
        this.client = new Client({ connectionString: this.connectionString });
        this.client.on('error', (err: Error) => {
            console.warn(`[PG] Connection error: ${err.message}. Will reconnect on next query.`);
            this.connected = false;
        });
        await this.client.connect();
        this.connected = true;
    }

    async query(text: string, params?: any[]): Promise<any> {
        for (let attempt = 1; attempt <= 3; attempt++) {
            try {
                if (!this.connected) await this.connect();
                return await this.client.query(text, params);
            } catch (err: any) {
                const isConnectionError = err.message?.includes('Connection terminated') ||
                    err.message?.includes('connection') ||
                    err.code === 'ECONNRESET' ||
                    err.code === 'EPIPE';
                if (isConnectionError && attempt < 3) {
                    console.warn(`[PG] Connection lost (attempt ${attempt}/3). Reconnecting in ${attempt * 2}s...`);
                    this.connected = false;
                    await new Promise(r => setTimeout(r, attempt * 2000));
                    continue;
                }
                throw err;
            }
        }
    }

    async end(): Promise<void> {
        try { await this.client.end(); } catch { /* ignore */ }
        this.connected = false;
    }
}

/**
 * Write a successful scrape result directly to iebc_registration_centres.
 */
async function writeToRegistrationCentres(pg: ResilientPG, result: ScrapeResult): Promise<boolean> {
    if (!result.success || !result.latitude || !result.longitude) return false;

    try {
        const res = await pg.query(`
            UPDATE public.iebc_registration_centres
            SET latitude = $1,
                longitude = $2,
                geocode_confidence = $3,
                location_source = 'google_maps_scraper_v14',
                location_type = $4,
                google_place_id = $5,
                updated_at = NOW()
            WHERE id = $6
        `, [
            result.latitude,
            result.longitude,
            result.full_url?.includes('/place/') ? 1.0 : 0.6,
            result.full_url?.includes('/place/') ? 'PLACE_PAGE' : 'SEARCH_PAGE',
            result.full_url || null,
            result.id
        ]);
        return (res.rowCount ?? 0) > 0;
    } catch (err: any) {
        console.warn(`  [DB-WARN] Failed to write ${result.name}: ${err.message}`);
        return false;
    }
}

/**
 * Load or initialize the cursor for resumable scraping.
 */
function loadCursor(): { lastProcessedId: string | null; totalProcessed: number; totalResolved: number } {
    if (fs.existsSync(CURSOR_FILE)) {
        return JSON.parse(fs.readFileSync(CURSOR_FILE, 'utf-8'));
    }
    return { lastProcessedId: null, totalProcessed: 0, totalResolved: 0 };
}

function saveCursor(cursor: { lastProcessedId: string | null; totalProcessed: number; totalResolved: number }) {
    fs.writeFileSync(CURSOR_FILE, JSON.stringify(cursor, null, 2));
}

async function main() {
    console.log('[GEOC-v14.1] Initializing Google Maps Clustered-Centres Scraper...');
    console.log('[GEOC-v14.1] Target: ONLY centres whose iebc_offices coordinates are shared by 3+ offices');

    const pg = new ResilientPG(DB_URL!);
    await pg.connect();

    const cursor = loadCursor();
    let { totalProcessed, totalResolved } = cursor;

    // Get total count for progress tracking
    const countResult = await pg.query(`
        SELECT count(*) as total FROM public.iebc_registration_centres rc
        WHERE EXISTS (
            SELECT 1 FROM (
                SELECT latitude, longitude FROM public.iebc_registration_centres
                WHERE latitude IS NOT NULL AND longitude IS NOT NULL
                GROUP BY latitude, longitude HAVING count(*) >= 3
            ) clustered
            WHERE rc.latitude = clustered.latitude AND rc.longitude = clustered.longitude
        )
    `);
    const totalCentres = parseInt(countResult.rows[0].total);
    console.log(`[GEOC-v14] Total centres in database: ${totalCentres}`);
    console.log(`[GEOC-v14] Resuming from: ${totalProcessed} processed, ${totalResolved} resolved`);

    const browser = await chromium.launch({
        headless: true,
        args: [
            '--disable-blink-features=AutomationControlled',
            '--no-sandbox',
            '--disable-setuid-sandbox',
            '--disable-web-security',
            '--disable-features=IsolateOrigins,site-per-process'
        ]
    });

    const context = await browser.newContext({
        userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        viewport: { width: 1280, height: 800 }
    });

    const page = await context.newPage();
    const cdp = await page.context().newCDPSession(page);
    await cdp.send('Page.addScriptToEvaluateOnNewDocument', {
        source: `
            Object.defineProperty(navigator, 'webdriver', { get: () => undefined });
            Object.defineProperty(navigator, 'languages', { get: () => ['en-US', 'en'] });
            Object.defineProperty(navigator, 'plugins', { get: () => [1, 2, 3, 4, 5] });
            window.chrome = { runtime: {} };
        `
    });

    // CSV writer with append mode
    const csvWriter = createObjectCsvWriter({
        path: OUTPUT_CSV,
        header: [
            { id: 'id', title: 'ID' },
            { id: 'name', title: 'NAME' },
            { id: 'county', title: 'COUNTY' },
            { id: 'constituency', title: 'CONSTITUENCY' },
            { id: 'ward', title: 'WARD' },
            { id: 'centre_code', title: 'CODE' },
            { id: 'search_query', title: 'QUERY' },
            { id: 'full_url', title: 'MAPS_URL' },
            { id: 'latitude', title: 'LAT' },
            { id: 'longitude', title: 'LNG' },
            { id: 'suggestions', title: 'SUGGESTIONS' },
            { id: 'screenshot_id', title: 'SCREENSHOT_ID' },
            { id: 'success', title: 'SUCCESS' },
            { id: 'error', title: 'ERROR' },
            { id: 'confidence_score', title: 'CONFIDENCE_SCORE' },
            { id: 'verifiability', title: 'VERIFIABILITY' },
            { id: 'reason', title: 'REASON' }
        ],
        append: fs.existsSync(OUTPUT_CSV)
    });

    // Process ALL centres in batches, ordered deterministically
    let batchNumber = Math.floor(totalProcessed / BATCH_SIZE);

    while (true) {
        // Fetch next batch from iebc_registration_centres
        // Use OFFSET for resumability based on totalProcessed
        let rows: RegistrationCentre[];
        try {
            const result = await pg.query(`
                SELECT rc.id::text as id, rc.name, rc.county, rc.constituency, rc.ward, rc.centre_code
                FROM public.iebc_registration_centres rc
                WHERE EXISTS (
                    SELECT 1 FROM (
                        SELECT latitude, longitude FROM public.iebc_registration_centres
                        WHERE latitude IS NOT NULL AND longitude IS NOT NULL
                        GROUP BY latitude, longitude HAVING count(*) >= 3
                    ) clustered
                    WHERE rc.latitude = clustered.latitude AND rc.longitude = clustered.longitude
                )
                ORDER BY rc.county, rc.constituency, rc.name
                OFFSET $1 LIMIT $2
            `, [totalProcessed, BATCH_SIZE]);
            rows = result.rows;
        } catch (err: any) {
            console.error(`[GEOC-v14] Fatal batch query failure: ${err.message}`);
            console.log(`[GEOC-v14] Saving cursor and exiting. Rerun to resume from record ${totalProcessed}.`);
            saveCursor({ lastProcessedId: null, totalProcessed, totalResolved });
            await browser.close();
            await pg.end();
            process.exit(1);
        }

        if (rows.length === 0) {
            console.log('[GEOC-v14] All centres processed. Exiting batch loop.');
            break;
        }

        batchNumber++;
        console.log(`\n[GEOC-v14] ===== BATCH ${batchNumber} | Records ${totalProcessed + 1}-${totalProcessed + rows.length} / ${totalCentres} =====`);

        const rawResults: ScrapeResult[] = [];

        for (const centre of rows) {
            const res = await scrapeCentre(page, centre);
            rawResults.push(res);

            // Write successful results directly to iebc_registration_centres
            if (res.success) {
                const written = await writeToRegistrationCentres(pg, res);
                if (written) {
                    totalResolved++;
                    console.log(`  [DB] Written to RC: ${res.name} (${res.latitude}, ${res.longitude})`);
                }
            }

            await page.waitForTimeout(SEARCH_DELAY_MS);
        }

        // Deduplicate within this batch before writing to CSV
        const deduped = deduplicateResults(rawResults);
        for (const r of deduped) {
            await csvWriter.writeRecords([r]);
        }

        totalProcessed += rows.length;

        // Update cursor for resumability
        saveCursor({
            lastProcessedId: rows[rows.length - 1].id,
            totalProcessed,
            totalResolved
        });

        const successCount = rawResults.filter(r => r.success).length;
        console.log(`[GEOC-v14] Batch ${batchNumber} complete: ${successCount}/${rows.length} resolved | Running total: ${totalResolved}/${totalProcessed} (${(100 * totalResolved / totalProcessed).toFixed(1)}%)`);
    }

    console.log(`\n[GEOC-v14] ========= FULL SCRAPE COMPLETE =========`);
    console.log(`  Total Processed:  ${totalProcessed}`);
    console.log(`  Total Resolved:   ${totalResolved}`);
    console.log(`  Success Rate:     ${(100 * totalResolved / totalProcessed).toFixed(1)}%`);
    console.log(`  CSV Trace:        ${OUTPUT_CSV}`);
    console.log(`  Screenshots:      ${SCREENSHOT_DIR}`);
    console.log(`[GEOC-v14] =====================================\n`);

    await browser.close();
    await pg.end();
}

main().catch(err => { console.error('[FATAL]', err); process.exit(1); });

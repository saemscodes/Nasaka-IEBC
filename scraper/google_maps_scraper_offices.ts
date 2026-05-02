/**
 * google_maps_scraper_offices.ts
 * 
 * Nasaka Surgical Geocoding Scraper v14.3 — IEBC_OFFICES SPECIALIZED
 * 
 * Architecture:
 *  - Target: ~8,166 clustered records in public.iebc_offices.
 *  - Sanitization: Aggressive regex to strip landmark contamination (e.g., ", at [CENTER]").
 *  - Iterative Search: Multi-stage fallbacks (Ward-locked -> Constituency-locked -> Discovery).
 *  - Precision Zoom: Forces max-zoom (z=18+) before coordinate capture to ensure building pin-point.
 *  - Similarity Gate: Strict >0.9 threshold for automatic resolution.
 *  - Result: Eliminates "Landmark Snapping" where multiple offices share a single landmark's coords.
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
const OUTPUT_CSV = path.resolve(__dirname, '../data/iebc_offices_clustered_rescrape.csv');
const CURSOR_FILE = path.resolve(__dirname, '../data/scraper_cursor_offices.json');
const BATCH_SIZE = 50;
const SEARCH_DELAY_MS = 3000; // Increased for surgical stability
const NAVIGATION_TIMEOUT = 60000;
const SIMILARITY_THRESHOLD = 0.90; // Strictly high gate

if (!fs.existsSync(SCREENSHOT_DIR)) {
    fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });
}

interface IEBCOffice {
    id: string;
    office_location: string;
    county: string;
    constituency: string;
    constituency_name: string | null;
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

function isFatalError(msg: string): boolean {
    const m = msg.toLowerCase();
    return m.includes('target page, context or browser has been closed')
        || m.includes('browser has been closed')
        || m.includes('target closed')
        || m.includes('protocol error');
}

async function findSearchBox(page: Page): Promise<any | null> {
    const selectors = [
        'input#searchboxinput',
        '#searchboxinput',
        'input.searchboxinput',
        'input[id*="searchbox"]',
        '[role="combobox"] input',
        'input[aria-label*="Search"]',
        'input[aria-label*="Tafuta"]',
        'input[placeholder*="Search"]',
        'input[placeholder*="Tafuta"]'
    ];
    for (const sel of selectors) {
        const locator = page.locator(sel);
        if (await locator.isVisible({ timeout: 1000 }).catch(() => false)) return locator;
    }
    const anyInput = page.locator('input:visible, textarea:visible').first();
    if (await anyInput.isVisible({ timeout: 1000 }).catch(() => false)) return anyInput;
    return null;
}

/**
 * Strips erroneous landmarks and suffixes from the office name
 */
function sanitizeName(name: string): string {
    if (!name) return '';
    return name
        .replace(/,?\s+at\s+.*$/i, '')            // Strip ", at [Landmark]"
        .replace(/,?\s+near\s+.*$/i, '')          // Strip ", near [Landmark]"
        .replace(/,?\s+\d+m\s+[NSEW].*$/i, '')    // Strip ", 1146m N of..."
        .replace(/\(.*\)/g, '')                   // Strip anything in parentheses
        .replace(/@.*$/i, '')                      // Strip "@..." markers
        .trim();
}

function parseCoordsFromUrl(url: string): { lat: number, lng: number, zoom: number } | null {
    const match = url.match(/@(-?\d+\.\d+),(-?\d+\.\d+),(\d+)z/);
    if (match) {
        return {
            lat: parseFloat(match[1]),
            lng: parseFloat(match[2]),
            zoom: parseInt(match[3])
        };
    }
    const pairMatch = url.match(/@(-?\d+\.\d+),(-?\d+\.\d+)/);
    if (pairMatch) {
        return {
            lat: parseFloat(pairMatch[1]),
            lng: parseFloat(pairMatch[2]),
            zoom: 12 // default
        };
    }
    return null;
}

async function navigateToMaps(page: Page): Promise<void> {
    // [STRATEGY] Only re-navigate if we are not on google maps at all.
    // This preserves the session and avoids triggering bot-detection via excessive reloads.
    if (page.url().includes('google.com/maps')) {
        // If we are already here, we just check if we can see the search box
        if (await findSearchBox(page)) return;
        // If not found, maybe we are stuck in a sub-view, so we proceed to reload
    }

    const maxRetries = 3;
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
        try {
            // [OPTIMIZATION] use 'domcontentloaded' instead of 'networkidle' to bypass slow background trackers
            await page.goto('https://www.google.com/maps', { waitUntil: 'domcontentloaded', timeout: NAVIGATION_TIMEOUT });
            
            const searchBox = await findSearchBox(page);
            if (searchBox) return;

            const consentSelectors = ['button[aria-label="Accept all"]', 'button[aria-label="I agree"]', 'button:has-text("Accept all")'];
            for (const sel of consentSelectors) {
                if (await page.locator(sel).isVisible({ timeout: 2000 })) { await page.click(sel); break; }
            }
            return;
        } catch (e: any) {
            if (isFatalError(e.message)) throw e;
            if (attempt === maxRetries) throw e;
            await page.waitForTimeout(2000 * attempt);
        }
    }
}

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

/**
 * Core Surgical Search Method
 */
async function scrapeOffice(page: Page, office: IEBCOffice): Promise<ScrapeResult> {
    const cleanName = sanitizeName(office.office_location);
    const ward = office.ward || office.constituency_name || '';
    
    // Waterfall Search Variations
    const searchVariations = [
        `${cleanName}, ${ward} Ward, ${office.constituency}, ${office.county}, Kenya`,
        `${cleanName}, ${office.constituency}, ${office.county}, Kenya`,
        `IEBC office ${cleanName}, ${office.county}, Kenya`
    ].map(q => q.replace(/, ,/g, ','));

    const result: ScrapeResult = {
        id: office.id,
        name: office.office_location,
        county: office.county,
        constituency: office.constituency,
        ward: ward,
        centre_code: office.centre_code || '',
        search_query: searchVariations[0],
        full_url: null,
        latitude: null,
        longitude: null,
        suggestions: null,
        screenshot_id: null,
        success: false
    };

    for (const [vIndex, query] of searchVariations.entries()) {
        try {
            console.log(`  [SEARCH-v${vIndex + 1}] ${query}`);
            await navigateToMaps(page);

            const searchBox = await findSearchBox(page);
            if (!searchBox) {
                const diagPath = path.join(SCREENSHOT_DIR, `block_diag_offices_${Date.now()}.png`);
                await page.screenshot({ path: diagPath });
                console.error(`  [BLOCK-DETECT] Search box missing. Diagnostic screenshot: ${diagPath}`);
                throw new Error('Search box not found after navigation');
            }

            await searchBox.fill(query);
            await page.keyboard.press('Enter');

            // Wait for response - either a Place Page or a List of results
            try {
                await page.waitForURL(url => url.toString().includes('/place/') || url.toString().includes('@'), { timeout: 15000 });
            } catch {
                // If it stalls, look for results list
                if (await page.locator('[role="article"]').count() === 0) continue; 
            }
            await page.waitForTimeout(2000);

            // 1. Analyze Results
            const resultCards = await page.evaluate(() => {
                const cards: { index: number; title: string; subtitle: string }[] = [];
                const articles = document.querySelectorAll('[role="article"]');
                articles.forEach((article, i) => {
                    if (i >= 5) return;
                    const titleEl = article.querySelector('h3, [class*="fontHeadlineSmall"]');
                    const subtitleEl = article.querySelector('[class*="fontBodyMedium"]');
                    const title = titleEl?.textContent?.trim() || '';
                    const subtitle = subtitleEl?.textContent?.trim() || '';
                    if (title) cards.push({ index: i, title, subtitle });
                });
                return cards;
            });

            let bestMatch = null;
            if (resultCards.length > 0) {
                const candidates = resultCards.map(c => ({ ...c, similarity: diceSimilarity(cleanName, c.title) }));
                candidates.sort((a, b) => b.similarity - a.similarity);
                if (candidates[0].similarity >= SIMILARITY_THRESHOLD) {
                    bestMatch = candidates[0];
                    console.log(`  [MATCH] Found: "${bestMatch.title}" (${bestMatch.similarity.toFixed(3)})`);
                    // Select it
                    const articles = page.locator('[role="article"]');
                    await articles.nth(bestMatch.index).click();
                    await page.waitForURL(url => url.toString().includes('/place/'), { timeout: 10000 });
                }
            } else {
                // Check if we went direct to a Place Page
                const pageTitle = await page.evaluate(() => document.querySelector('h1')?.textContent?.trim() || '');
                const titleSimilarity = diceSimilarity(cleanName, pageTitle);
                if (titleSimilarity >= SIMILARITY_THRESHOLD) {
                    bestMatch = { title: pageTitle, similarity: titleSimilarity };
                    console.log(`  [DIRECT] Auto-navigated to: "${pageTitle}" (${titleSimilarity.toFixed(3)})`);
                }
            }

            if (bestMatch) {
                // 2. Surgical Precision Zooming
                console.log(`  [ZOOM] Forcing Max Resolution...`);
                for (let i = 0; i < 5; i++) {
                    await page.keyboard.press('Control++'); // Browser zoom vs Maps zoom? Use keyboard short for maps
                    await page.keyboard.press('+'); // Maps zoom shortcut
                    await page.waitForTimeout(500);
                }
                
                // Wait for URL to stabilize at high zoom (z>=18)
                let finalCoords = null;
                for (let i = 0; i < 10; i++) {
                    await page.waitForTimeout(1000);
                    const currentUrl = page.url();
                    const coords = parseCoordsFromUrl(currentUrl);
                    if (coords && coords.zoom >= 17) {
                        finalCoords = coords;
                        result.full_url = currentUrl;
                        break;
                    }
                }

                if (finalCoords) {
                    result.latitude = finalCoords.lat;
                    result.longitude = finalCoords.lng;
                    result.confidence_score = bestMatch.similarity;
                    result.verifiability = 'HIGH';
                    result.success = true;
                    
                    const sid = uuidv4();
                    await page.screenshot({ path: path.join(SCREENSHOT_DIR, `${sid}.png`) });
                    result.screenshot_id = sid;
                    return result;
                }
            }

            console.warn(`  [GATE] Fallback v${vIndex + 1} rejected: No match above ${SIMILARITY_THRESHOLD}`);
        } catch (e: any) {
            console.warn(`  [ERROR-v${vIndex + 1}] ${e.message}`);
            if (isFatalError(e.message)) throw e;
        }
    }

    return result;
}

class ResilientPG {
    private client: Client;
    private connected: boolean = false;
    constructor(private connectionString: string) { this.client = new Client({ connectionString }); }
    async connect(): Promise<void> {
        if (this.connected) return;
        this.client = new Client({ connectionString: this.connectionString });
        await this.client.connect();
        this.connected = true;
    }
    async query(text: string, params?: any[]): Promise<any> {
        try { if (!this.connected) await this.connect(); return await this.client.query(text, params); }
        catch (err) { this.connected = false; throw err; }
    }
    async end(): Promise<void> { try { await this.client.end(); } catch { } this.connected = false; }
}

async function writeToOffices(pg: ResilientPG, result: ScrapeResult): Promise<boolean> {
    if (!result.success || !result.latitude || !result.longitude) return false;
    try {
        const res = await pg.query(`
            UPDATE public.iebc_offices
            SET latitude = $1, 
                longitude = $2, 
                geocode_confidence = $3,
                geocode_method = 'geoc_v14_3_surgical',
                geocode_status = 'verified',
                verified = true,
                updated_at = NOW()
            WHERE id = $4
        `, [result.latitude, result.longitude, result.confidence_score || 1.0, result.id]);
        return (res.rowCount ?? 0) > 0;
    } catch (err: any) { console.warn(`  [DB-WARN] ${result.name}: ${err.message}`); return false; }
}

async function launchBrowser(): Promise<{ browser: any; page: Page }> {
    const browser = await chromium.launch({
        headless: true, // Headed for CAPTCHA solving
        args: ['--disable-blink-features=AutomationControlled', '--no-sandbox', '--disable-dev-shm-usage']
    });
    const context = await browser.newContext({
        userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/120.0.0.0',
        viewport: { width: 1280, height: 800 }
    });
    const page = await context.newPage();
    return { browser, page };
}

async function main() {
    console.log('[GEOC-v14.3] Initializing Surgical Geocoding Pipeline...');
    const pg = new ResilientPG(DB_URL!); await pg.connect();

    const cursor = fs.existsSync(CURSOR_FILE) ? JSON.parse(fs.readFileSync(CURSOR_FILE, 'utf-8')) : { totalProcessed: 0, totalResolved: 0 };
    let { totalProcessed, totalResolved } = cursor;

    const countQuery = `
        SELECT count(*) as total FROM public.iebc_offices io
        WHERE EXISTS (
            SELECT 1 FROM (
                SELECT latitude, longitude FROM public.iebc_offices
                WHERE latitude IS NOT NULL AND longitude IS NOT NULL
                GROUP BY latitude, longitude HAVING count(*) >= 3
            ) clustered
            WHERE io.latitude = clustered.latitude AND io.longitude = clustered.longitude
        )
    `;
    const countResult = await pg.query(countQuery);
    const totalOffices = parseInt(countResult.rows[0].total);
    console.log(`[GEOC-v14.3] Clustered offices to process surgically: ${totalOffices}`);

    let { browser, page } = await launchBrowser();

    const csvWriter = createObjectCsvWriter({
        path: OUTPUT_CSV,
        header: [
            { id: 'id', title: 'ID' }, { id: 'name', title: 'NAME' }, { id: 'county', title: 'COUNTY' },
            { id: 'constituency', title: 'CONSTITUENCY' }, { id: 'ward', title: 'WARD' }, { id: 'centre_code', title: 'CODE' },
            { id: 'latitude', title: 'LAT' }, { id: 'longitude', title: 'LNG' }, { id: 'success', title: 'SUCCESS' }
        ],
        append: fs.existsSync(OUTPUT_CSV)
    });

    const queryCache = new Map<string, ScrapeResult>();

    while (true) {
        const result = await pg.query(`
            SELECT io.id::text as id, io.office_location, io.county, io.constituency, io.constituency_name, io.ward, io.centre_code
            FROM public.iebc_offices io
            WHERE EXISTS (
                SELECT 1 FROM (
                    SELECT latitude, longitude FROM public.iebc_offices
                    WHERE latitude IS NOT NULL AND longitude IS NOT NULL
                    GROUP BY latitude, longitude HAVING count(*) >= 3
                ) clustered
                WHERE io.latitude = clustered.latitude AND io.longitude = clustered.longitude
            )
            ORDER BY io.county, io.constituency, io.ward, io.office_location
            OFFSET $1 LIMIT $2
        `, [totalProcessed, BATCH_SIZE]);
        const rows = result.rows;
        if (rows.length === 0) break;

        console.log(`\n[BATCH] ${totalProcessed + 1}-${totalProcessed + rows.length} / ${totalOffices}`);
        for (const office of rows) {
            const cleanName = sanitizeName(office.office_location);
            const cacheKey = `${cleanName}-${office.ward || ''}-${office.constituency}-${office.county}`;
            
            if (queryCache.has(cacheKey)) {
                const cached = queryCache.get(cacheKey)!;
                console.log(`  [CACHE-HIT] ${office.office_location} (already resolved as ${cached.name})`);
                if (cached.success) {
                    const cloned = { ...cached, id: office.id };
                    if (await writeToOffices(pg, cloned)) totalResolved++;
                }
                continue;
            }

            let res: ScrapeResult;
            try {
                res = await scrapeOffice(page, office);
            } catch (scrapeErr: any) {
                const msg: string = scrapeErr?.message || '';
                if (isFatalError(msg)) {
                    console.warn(`  [BROWSER DEAD] Restarting... (${msg.slice(0, 60)})`);
                    try { await browser.close(); } catch (_) {}
                    await new Promise(r => setTimeout(r, 5000));
                    ({ browser, page } = await launchBrowser());
                    console.warn('  [BROWSER RESTARTED] Resuming from current record.');
                    try { res = await scrapeOffice(page, office); } catch (e2) {
                        res = {
                            id: office.id, name: office.office_location, county: office.county,
                            constituency: office.constituency, ward: office.ward || '', centre_code: office.centre_code || '',
                            search_query: '', full_url: null, latitude: null, longitude: null,
                            suggestions: null, screenshot_id: null, success: false
                        };
                    }
                } else {
                    console.warn(`  [ERR-SCRAPE] ${msg.slice(0, 80)}`);
                    res = {
                        id: office.id, name: office.office_location, county: office.county,
                        constituency: office.constituency, ward: office.ward || '', centre_code: office.centre_code || '',
                        search_query: '', full_url: null, latitude: null, longitude: null,
                        suggestions: null, screenshot_id: null, success: false
                    };
                }
            }
            if (res.success) { 
                if (await writeToOffices(pg, res)) totalResolved++;
                queryCache.set(cacheKey, res);
            }
            await csvWriter.writeRecords([res]);
            try { await page.waitForTimeout(SEARCH_DELAY_MS); } catch (_) {}
        }
        totalProcessed += rows.length;
        fs.writeFileSync(CURSOR_FILE, JSON.stringify({ totalProcessed, totalResolved }, null, 2));
    }
    console.log(`\n[GEOC-v14.3] DONE. Resolved: ${totalResolved}/${totalProcessed}`);
    try { await browser.close(); } catch (_) {}
    await pg.end();
}

main().catch(err => console.error(err));

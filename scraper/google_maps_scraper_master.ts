/**
 * google_maps_scraper_master.ts
 * 
 * Nasaka Master Surgical Geocoding Pipeline v14.4
 * 
 * Architecture:
 *  - Target: ALL records in iebc_offices or iebc_registration_centres.
 *  - Implementation: v14.3 Surgical logic (Regex Sanitization + Waterfall Fallbacks + Max-Zoom).
 *  - Versatility: Accepts table name as runtime argument.
 *  - Reliability: Search caching, coordinate drift protection, and strict similarity gates.
 */

import { chromium, Browser, Page } from 'playwright';
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
const CURSOR_DIR = path.resolve(__dirname, '../data');
const BATCH_SIZE = 50;
const SEARCH_DELAY_MS = 3000;
const NAVIGATION_TIMEOUT = 60000;
const SIMILARITY_THRESHOLD = 0.90;

if (!fs.existsSync(SCREENSHOT_DIR)) {
    fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });
}

interface IEBCRecord {
    id: string;
    name: string;      // maps to office_location or name
    county: string;
    constituency: string;
    ward: string | null;
    code: string | null; // maps to centre_code or code
}

interface ScrapeResult {
    id: string;
    name: string;
    county: string;
    constituency: string;
    ward: string;
    code: string;
    search_query: string;
    full_url: string | null;
    latitude: number | null;
    longitude: number | null;
    success: boolean;
    confidence_score?: number;
    verifiability?: string;
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
    // Final fallback: first visible input or textarea
    const anyInput = page.locator('input:visible, textarea:visible').first();
    if (await anyInput.isVisible({ timeout: 1000 }).catch(() => false)) return anyInput;
    return null;
}

function sanitizeName(name: string): string {
    if (!name) return '';
    return name
        .replace(/,?\s+at\s+.*$/i, '')
        .replace(/,?\s+near\s+.*$/i, '')
        .replace(/,?\s+\d+m\s+[NSEW].*$/i, '')
        .replace(/\(.*\)/g, '')
        .replace(/@.*$/i, '')
        .trim();
}

function parseCoordsFromUrl(url: string): { lat: number, lng: number, zoom: number } | null {
    const match = url.match(/@(-?\d+\.\d+),(-?\d+\.\d+),(\d+)z/);
    if (match) return { lat: parseFloat(match[1]), lng: parseFloat(match[2]), zoom: parseInt(match[3]) };
    const pairMatch = url.match(/@(-?\d+\.\d+),(-?\d+\.\d+)/);
    if (pairMatch) return { lat: parseFloat(pairMatch[1]), lng: parseFloat(pairMatch[2]), zoom: 12 };
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
        if (count > 0) { bigrams.set(bg, count - 1); matches++; }
    }
    return (2.0 * matches) / (sa.length - 1 + sb.length - 1);
}

async function scrapeMaster(page: Page, record: IEBCRecord): Promise<ScrapeResult> {
    const cleanName = sanitizeName(record.name);
    const ward = record.ward || '';
    const searchVariations = [
        `${cleanName}, ${ward} Ward, ${record.constituency}, ${record.county}, Kenya`,
        `${cleanName}, ${record.constituency}, ${record.county}, Kenya`,
        `IEBC ${cleanName}, ${record.county}, Kenya`
    ].map(q => q.replace(/, ,/g, ','));

    const result: ScrapeResult = {
        id: record.id,
        name: record.name,
        county: record.county,
        constituency: record.constituency,
        ward: ward,
        code: record.code || '',
        search_query: searchVariations[0],
        full_url: null,
        latitude: null,
        longitude: null,
        success: false
    };

    for (const [vIndex, query] of searchVariations.entries()) {
        try {
            console.log(`  [SEARCH-v${vIndex + 1}] ${query}`);
            await navigateToMaps(page);
            
            const searchBox = await findSearchBox(page);
            if (!searchBox) {
                const diagPath = path.join(SCREENSHOT_DIR, `block_diag_${Date.now()}.png`);
                await page.screenshot({ path: diagPath });
                console.error(`  [BLOCK-DETECT] Search box missing. Diagnostic screenshot: ${diagPath}`);
                throw new Error('Search box not found after navigation');
            }

            await searchBox.fill(query);
            await page.keyboard.press('Enter');

            try { await page.waitForURL(url => url.toString().includes('/place/') || url.toString().includes('@'), { timeout: 15000 }); }
            catch { if (await page.locator('[role="article"]').count() === 0) continue; }
            await page.waitForTimeout(2000);

            const resultCards = await page.evaluate(() => {
                const cards: { index: number; title: string }[] = [];
                const articles = document.querySelectorAll('[role="article"]');
                articles.forEach((article, i) => {
                    if (i >= 5) return;
                    const titleEl = article.querySelector('h3, [class*="fontHeadlineSmall"]');
                    const title = titleEl?.textContent?.trim() || '';
                    if (title) cards.push({ index: i, title });
                });
                return cards;
            });

            let bestMatch = null;
            if (resultCards.length > 0) {
                const candidates = resultCards.map(c => ({ ...c, similarity: diceSimilarity(cleanName, c.title) }));
                candidates.sort((a, b) => b.similarity - a.similarity);
                if (candidates[0].similarity >= SIMILARITY_THRESHOLD) {
                    bestMatch = candidates[0];
                    const articles = page.locator('[role="article"]');
                    await articles.nth(bestMatch.index).click();
                    await page.waitForURL(url => url.toString().includes('/place/'), { timeout: 10000 });
                }
            } else {
                const pageTitle = await page.evaluate(() => document.querySelector('h1')?.textContent?.trim() || '');
                const titleSimilarity = diceSimilarity(cleanName, pageTitle);
                if (titleSimilarity >= SIMILARITY_THRESHOLD) bestMatch = { title: pageTitle, similarity: titleSimilarity };
            }

            if (bestMatch) {
                console.log(`  [MATCH] Found: "${bestMatch.title}" (${bestMatch.similarity.toFixed(3)})`);
                for (let i = 0; i < 5; i++) { await page.keyboard.press('+'); await page.waitForTimeout(500); }
                
                let finalCoords = null;
                for (let i = 0; i < 8; i++) {
                    await page.waitForTimeout(1000);
                    const coords = parseCoordsFromUrl(page.url());
                    if (coords && coords.zoom >= 17) { finalCoords = coords; result.full_url = page.url(); break; }
                }

                if (finalCoords) {
                    result.latitude = finalCoords.lat;
                    result.longitude = finalCoords.lng;
                    result.confidence_score = bestMatch.similarity;
                    result.verifiability = 'HIGH';
                    result.success = true;
                    await page.screenshot({ path: path.join(SCREENSHOT_DIR, `${uuidv4()}.png`) });
                    return result;
                }
            }
            console.warn(`  [GATE] Fallback v${vIndex + 1} rejected.`);
        } catch (e: any) {
            console.warn(`  [ERR-v${vIndex + 1}] ${e.message}`);
            if (isFatalError(e.message)) throw e;
        }
    }
    return result;
}

class MasterDB {
    private client: Client;
    constructor(private connectionString: string) { this.client = new Client({ connectionString }); }
    async connect(): Promise<void> { await this.client.connect(); }
    async query(text: string, params?: any[]): Promise<any> { return await this.client.query(text, params); }
    async end(): Promise<void> { await this.client.end(); }
}

async function launchBrowser(): Promise<{ browser: any; page: Page }> {
    const browser = await chromium.launch({
        headless: true,
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
    const table = process.argv[2] || 'iebc_offices';
    const nullCoordsOnly = process.argv.includes('--null-only');
    console.log(`[GEOC-v14.4] Master Surgical Pipeline starting for table: ${table}${nullCoordsOnly ? ' [NULL-COORDS-ONLY MODE]' : ''}`);
    
    const db = new MasterDB(DB_URL!); await db.connect();
    
    const cursorFile = nullCoordsOnly
        ? path.join(CURSOR_DIR, `cursor_master_${table}_nullonly.json`)
        : path.join(CURSOR_DIR, `cursor_master_${table}.json`);
    const cursor = fs.existsSync(cursorFile) ? JSON.parse(fs.readFileSync(cursorFile, 'utf-8')) : { totalProcessed: 0, totalResolved: 0 };
    let { totalProcessed, totalResolved } = cursor;

    const nullFilter = nullCoordsOnly ? ` WHERE (latitude IS NULL OR longitude IS NULL)` : '';
    const countRes = await db.query(`SELECT count(*) as total FROM public.${table}${nullFilter}`);
    const totalRecords = parseInt(countRes.rows[0].total);
    console.log(`[GEOC-v14.4] Records to process in ${table}: ${totalRecords}`);

    let { browser, page } = await launchBrowser();

    const csvWriter = createObjectCsvWriter({
        path: path.join(CURSOR_DIR, `results_master_${table}.csv`),
        header: [
            { id: 'id', title: 'ID' }, { id: 'name', title: 'NAME' }, { id: 'latitude', title: 'LAT' }, 
            { id: 'longitude', title: 'LNG' }, { id: 'success', title: 'SUCCESS' }
        ],
        append: fs.existsSync(path.join(CURSOR_DIR, `results_master_${table}.csv`))
    });

    const queryCache = new Map<string, ScrapeResult>();

    while (totalProcessed < totalRecords) {
        const nameCol = table === 'iebc_offices' ? 'office_location' : 'name';
        const nullFilter = nullCoordsOnly ? ` AND (io.${nameCol} IS NOT NULL) AND (io.latitude IS NULL OR io.longitude IS NULL)` : '';
        const result = await db.query(`
            SELECT io.id::text, io.${nameCol} as name, io.county, io.constituency, io.ward, io.centre_code as code
            FROM public.${table} io
            WHERE 1=1${nullFilter}
            ORDER BY io.county, io.constituency, io.id
            OFFSET $1 LIMIT $2
        `, [totalProcessed, BATCH_SIZE]);
        
        const rows = result.rows;
        if (rows.length === 0) break;

        console.log(`\n[BATCH] ${totalProcessed + 1}-${totalProcessed + rows.length} / ${totalRecords}`);
        for (const record of rows) {
            const cleanName = sanitizeName(record.name);
            const cacheKey = `${cleanName}-${record.ward || ''}-${record.constituency}-${record.county}`;
            
            if (queryCache.has(cacheKey)) {
                const cached = queryCache.get(cacheKey)!;
                if (cached.success) {
                    if (table === 'iebc_offices') {
                        await db.query(`UPDATE public.${table} SET latitude=$1, longitude=$2, geocode_confidence=$3, geocode_method='geoc_v14_4_master', verified=true, updated_at=NOW() WHERE id=$4`, [cached.latitude, cached.longitude, cached.confidence_score, record.id]);
                    } else {
                        await db.query(`UPDATE public.${table} SET latitude=$1, longitude=$2, geocode_confidence=$3, location_source='geoc_v14_4_master', updated_at=NOW() WHERE id=$4`, [cached.latitude, cached.longitude, cached.confidence_score, record.id]);
                    }
                    totalResolved++;
                }
                continue;
            }

            let res: ScrapeResult;
            try {
                res = await scrapeMaster(page, record);
            } catch (scrapeErr: any) {
                const msg: string = scrapeErr?.message || '';
                if (isFatalError(msg)) {
                    console.warn(`  [BROWSER DEAD] Restarting... (${msg.slice(0, 60)})`);
                    try { await browser.close(); } catch (_) {}
                    await new Promise(r => setTimeout(r, 5000));
                    ({ browser, page } = await launchBrowser());
                    console.warn('  [BROWSER RESTARTED] Resuming from current record.');
                    // Retry once immediately for recursive recovery
                    try { res = await scrapeMaster(page, record); } catch (e2) {
                        res = {
                            id: record.id, name: record.name, county: record.county,
                            constituency: record.constituency, ward: record.ward || '',
                            code: record.code || '', search_query: '', full_url: null,
                            latitude: null, longitude: null, success: false
                        };
                    }
                } else {
                    console.warn(`  [ERR-SCRAPE] ${msg.slice(0, 80)}`);
                    res = {
                        id: record.id, name: record.name, county: record.county,
                        constituency: record.constituency, ward: record.ward || '',
                        code: record.code || '', search_query: '', full_url: null,
                        latitude: null, longitude: null, success: false
                    };
                }
            }
            if (res.success) {
                if (table === 'iebc_offices') {
                    await db.query(`UPDATE public.${table} SET latitude=$1, longitude=$2, geocode_confidence=$3, geocode_method='geoc_v14_4_master', verified=true, updated_at=NOW() WHERE id=$4`, [res.latitude, res.longitude, res.confidence_score, res.id]);
                } else {
                    await db.query(`UPDATE public.${table} SET latitude=$1, longitude=$2, geocode_confidence=$3, location_source='geoc_v14_4_master', updated_at=NOW() WHERE id=$4`, [res.latitude, res.longitude, res.confidence_score, res.id]);
                }
                totalResolved++;
                queryCache.set(cacheKey, res);
            }
            await csvWriter.writeRecords([res]);
            try { await page.waitForTimeout(SEARCH_DELAY_MS); } catch (_) {}
        }
        totalProcessed += rows.length;
        fs.writeFileSync(cursorFile, JSON.stringify({ totalProcessed, totalResolved }, null, 2));
    }
    try { await browser.close(); } catch (_) {}
    await db.end();
}

main().catch(err => console.error(err));

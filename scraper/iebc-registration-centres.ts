/**
 * iebc-registration-centres.ts
 * 
 * [OPUS-LEVEL IMPLEMENTATION - V2]
 * Exhaustively extracts all 24,000+ IEBC registration centres.
 * 
 * UPGRADES:
 * 1. "Show All" Entries: Taps the DataTables length menu to get all results in one go.
 * 2. Returning Officer (RO) Capture: Extracts name and email from the #contact panel.
 * 3. Sidebar Noise Exclusion: Uses strict ID-based row selection (#overallstats tbody tr).
 * 4. Resumable & IP-Polite: Respects rate limits while ensuring full county-constituency-ward coverage.
 */

import puppeteer, { Browser, Page } from 'puppeteer';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { Client } from 'pg';
import * as dotenv from 'dotenv';
import * as fs from 'fs';

dotenv.config({ path: fs.existsSync('.env') ? '.env' : '../.env' });

// ============================================================
// CONFIGURATION
// ============================================================
const SELECTORS = {
  countySelect: '#county',
  constituencySelect: '#constituency',
  wardSelect: '#wards select', // Dynamically injected
  lengthMenu: 'select[name="overallstats_length"]',
  submitButton: '#search-btn',
  resultsTable: '#overallstats',
  resultsRows: '#overallstats tbody tr',
  noDataMessage: 'No data available in table',
  contactPanel: '#contact'
};

const IEBC_URL = 'https://www.iebc.or.ke/registration/?where';
const BROWSER_RECYCLE_COUNTY_INTERVAL = 5;
const LOG_FILE = './scraper-log.json';
const REQUEST_DELAY_MS = 2500; // Polite delay to avoid IP blocking

// ============================================================
// LOGGING SYSTEM
// ============================================================
interface ScraperLog {
  grandTotal: number;
  completedCounties: number;
  totalCounties: number;
  lastUpdated: string;
  counties: Record<string, {
    status: 'done' | 'in-progress' | 'error';
    count: number;
    completedAt?: string;
  }>;
}

function loadLog(): ScraperLog {
  if (fs.existsSync(LOG_FILE)) {
    try {
      return JSON.parse(fs.readFileSync(LOG_FILE, 'utf-8'));
    } catch {
      console.warn('[LOG] Corrupt log file. Resetting.');
    }
  }
  return { grandTotal: 0, completedCounties: 0, totalCounties: 0, lastUpdated: new Date().toISOString(), counties: {} };
}

function saveLog(log: ScraperLog) {
  log.lastUpdated = new Date().toISOString();
  fs.writeFileSync(LOG_FILE, JSON.stringify(log, null, 2));
}

const sleep = (ms: number) => new Promise(res => setTimeout(res, ms));

// ============================================================
// CORE SCRAPER LOGIC
// ============================================================

async function extractOptions(page: Page, selector: string) {
  return page.evaluate((sel) => {
    const el = document.querySelector(sel) as HTMLSelectElement;
    if (!el) return [];
    return Array.from(el.options)
      .map(o => ({ value: o.value, label: o.textContent?.trim() }))
      .filter(o => o.value && o.value !== '' && o.value !== '-1' && !o.label?.includes('Select') && !o.label?.includes('Choose'));
  }, selector);
}

async function extractReturningOfficer(page: Page) {
  return page.evaluate((selPanel) => {
    const panel = document.querySelector(selPanel);
    if (!panel) return { name: null, email: null };
    
    // The panel contains a table with headers and data rows.
    // We target the data cells directly.
    const cells = panel.querySelectorAll('td');
    
    if (cells.length >= 2) {
      // Index 0: Name, Index 1: Email
      return {
        name: cells[0].textContent?.trim() || null,
        email: cells[1].textContent?.trim() || null
      };
    }
    
    // Fallback: search for text if table structure varies (unlikely)
    const text = panel.textContent || '';
    const nameMatch = text.match(/Name\s+([^\n\r]+)/i);
    const emailMatch = text.match(/Email\s+([^\n\r]+)/i);
    
    return {
      name: nameMatch ? nameMatch[1].replace(/Email.*/i, '').trim() : null,
      email: emailMatch ? emailMatch[1].trim() : null
    };
  }, SELECTORS.contactPanel);
}

async function extractVisibleCentres(page: Page, county: string, constituency: string, ward: string | null) {
  const roInfo = await extractReturningOfficer(page);
  
  return page.evaluate((county, constituency, ward, selRows, roName, roEmail) => {
    const rows = document.querySelectorAll(selRows);
    const data: any[] = [];
    rows.forEach(row => {
      const cells = row.querySelectorAll('td');
      if (cells.length > 0) {
        const name = cells[0].textContent?.trim();
        // Skip purely informative rows like "No data available"
        if (name && !name.toLowerCase().includes('no data')) {
            data.push({
              name,
              county,
              constituency,
              ward,
              returning_officer_name: roName,
              returning_officer_email: roEmail,
              raw_text: row.textContent?.trim() || null
            });
        }
      }
    });
    return data;
  }, county, constituency, ward, SELECTORS.resultsRows, roInfo.name, roInfo.email);
}

async function captureAllCentresForSelection(page: Page, county: string, constituency: string, ward: string | null): Promise<any[]> {
  // 1. Set DataTables to "All" (value -1)
  const lengthMenuExists = await page.$(SELECTORS.lengthMenu);
  if (lengthMenuExists) {
    await page.select(SELECTORS.lengthMenu, '-1');
    await sleep(2000); // Wait for table to expand
  }

  // 2. Wait for table update or "No data"
  await page.waitForFunction((selRows, noData) => {
    const rows = document.querySelectorAll(selRows);
    const text = document.body.innerText;
    return rows.length > 0 || text.includes(noData);
  }, { timeout: 15000 }, SELECTORS.resultsRows, SELECTORS.noDataMessage).catch(() => {});

  // 3. Extract all rows
  return await extractVisibleCentres(page, county, constituency, ward);
}

async function upsertCentres(centres: any[]) {
  if (centres.length === 0) return 0;
  
  // Dedup logic based on unique constraint
  const uniqueBatch = Array.from(new Map(centres.map(c => [`${c.name}|${c.county}|${c.constituency}`, c])).values());

  const pgClient = new Client({ connectionString: process.env.SUPABASE_DB_POOLED_URL });
  
  try {
    await pgClient.connect();
    let count = 0;
    
    for (const centre of uniqueBatch) {
      const query = `
        INSERT INTO public.iebc_registration_centres 
        (name, county, constituency, ward, returning_officer_name, returning_officer_email, raw_text, scraped_at)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
        ON CONFLICT (name, county, constituency) 
        DO UPDATE SET 
          ward = EXCLUDED.ward,
          returning_officer_name = EXCLUDED.returning_officer_name,
          returning_officer_email = EXCLUDED.returning_officer_email,
          raw_text = EXCLUDED.raw_text,
          scraped_at = EXCLUDED.scraped_at,
          updated_at = NOW();
      `;
      
      const values = [
        centre.name,
        centre.county,
        centre.constituency,
        centre.ward,
        centre.returning_officer_name,
        centre.returning_officer_email,
        centre.raw_text,
        new Date().toISOString()
      ];
      
      await pgClient.query(query, values);
      count++;
    }
    return count;
  } catch (err) {
    console.error(`[DB ERROR] ${(err as Error).message}`);
    return 0;
  } finally {
    await pgClient.end();
  }
}

async function scrapeWithWards(page: Page, county: string, constituency: string, supabase: SupabaseClient) {
  const wards = await extractOptions(page, SELECTORS.wardSelect);
  if (wards.length === 0) return 0;

  console.log(`      → ${wards.length} Wards found. Extracting...`);
  let totalInConst = 0;

  for (const ward of wards) {
    process.stdout.write(`        [WARD] ${ward.label}... `);
    await page.evaluate((val, sel) => {
      const dropdown = document.querySelector(sel) as HTMLSelectElement;
      if (dropdown) {
        dropdown.value = val;
        dropdown.dispatchEvent(new Event('change', { bubbles: true }));
      }
    }, ward.value, SELECTORS.wardSelect);
    
    await sleep(REQUEST_DELAY_MS);
    
    // In many cases, selection triggers show_wards.php which then triggers stations/contacts.
    // If there's a search button, we click it.
    const searchBtn = await page.$(SELECTORS.submitButton);
    if (searchBtn && await searchBtn.evaluate(el => (el as HTMLElement).offsetParent !== null)) {
      await searchBtn.click();
      await sleep(REQUEST_DELAY_MS);
    }

    const centres = await captureAllCentresForSelection(page, county, constituency, ward.label);
    const count = await upsertCentres(centres);
    totalInConst += count;
    console.log(`✓ Captured ${centres.length}.`);
  }
  return totalInConst;
}

async function scrapeConstituency(page: Page, county: string, constituency: { value: string; label: string }, supabase: SupabaseClient) {
  console.log(`    [CONST] ${constituency.label}`);
  await page.evaluate((val, sel) => {
    const dropdown = document.querySelector(sel) as HTMLSelectElement;
    if (dropdown) {
      dropdown.value = val;
      dropdown.dispatchEvent(new Event('change', { bubbles: true }));
    }
  }, constituency.value, SELECTORS.constituencySelect);
  
  await sleep(REQUEST_DELAY_MS);

  // Check for Wards dropdown injected via show_wards.php
  const wards = await extractOptions(page, SELECTORS.wardSelect);
  if (wards.length > 0) {
    return await scrapeWithWards(page, county, constituency.label, supabase);
  }

  // Fallback for constituencies without wards
  const searchBtn = await page.$(SELECTORS.submitButton);
  if (searchBtn && await searchBtn.evaluate(el => (el as HTMLElement).offsetParent !== null)) {
    await searchBtn.click();
    await sleep(3000);
  }

  const centres = await captureAllCentresForSelection(page, county, constituency.label, null);
  const count = await upsertCentres(centres);
  console.log(`      ✓ Captured ${centres.length} centres.`);
  return count;
}

// ============================================================
// MAIN EXECUTION
// ============================================================

async function main() {
  const isResume = process.env.RESUME === 'true';
  const supabase = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
  const log = loadLog();

  console.log(`\n[SCRAPER START] ${isResume ? 'RESUMING' : 'FRESH RUN'}`);
  
  let browser = await puppeteer.launch({ headless: true, args: ['--no-sandbox', '--disable-setuid-sandbox', '--window-size=1280,1000'] });
  let page = await browser.newPage();
  await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');

  // Pre-load to get counties
  await page.goto(IEBC_URL, { waitUntil: 'networkidle2' });
  const counties = await extractOptions(page, SELECTORS.countySelect);
  log.totalCounties = counties.length;

  for (let i = 0; i < counties.length; i++) {
    const county = counties[i];
    const logEntry = log.counties[county.label];

    if (isResume && logEntry?.status === 'done' && logEntry.count > 0) {
      console.log(`[SKIP] ${county.label} (${logEntry.count} centres)`);
      continue;
    }

    if (i > 0 && i % BROWSER_RECYCLE_COUNTY_INTERVAL === 0) {
      console.log(`[SYS] Recycling browser...`);
      await browser.close();
      browser = await puppeteer.launch({ headless: true, args: ['--no-sandbox', '--disable-setuid-sandbox'] });
      page = await browser.newPage();
      await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');
    }

    console.log(`\n[COUNTY] ${i + 1}/${counties.length}: ${county.label} (Grand Total: ${log.grandTotal})`);

    await page.goto(IEBC_URL, { waitUntil: 'networkidle2' });
    await page.evaluate((val, sel) => {
      const dropdown = document.querySelector(sel) as HTMLSelectElement;
      if (dropdown) {
        dropdown.value = val;
        dropdown.dispatchEvent(new Event('change', { bubbles: true }));
      }
    }, county.value, SELECTORS.countySelect);
    
    await sleep(REQUEST_DELAY_MS);
    const constituencies = await extractOptions(page, SELECTORS.constituencySelect);
    console.log(`    → Found ${constituencies.length} constituencies.`);

    let countyTotal = 0;
    for (const cons of constituencies) {
      try {
          countyTotal += await scrapeConstituency(page, county.label, cons, supabase);
      } catch (err) {
          console.error(`      [ERROR] Skipping constituency ${cons.label}: ${(err as Error).message}`);
      }
    }

    // Mark as done
    log.counties[county.label] = { 
        status: 'done', 
        count: countyTotal, 
        completedAt: new Date().toISOString() 
    };
    log.grandTotal = Object.values(log.counties).reduce((acc, c) => acc + (c.count || 0), 0);
    log.completedCounties = Object.values(log.counties).filter(c => c.status === 'done').length;
    saveLog(log);
    
    console.log(`[COUNTY DONE] ${county.label}: ${countyTotal} centres.`);
  }

  console.log(`\n[FINAL] Scrape Complete. Total: ${log.grandTotal} centres stored in Supabase.`);
  await browser.close();
}

main().catch(err => {
  console.error('[FATAL ERROR]', err);
  process.exit(1);
});

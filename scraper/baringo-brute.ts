import puppeteer from 'puppeteer';
import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import * as fs from 'fs';

dotenv.config({ path: '../.env' });

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL!;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

async function extractBaringo() {
  const browser = await puppeteer.launch({ headless: true });
  const page = await browser.newPage();
  await page.setViewport({ width: 1280, height: 800 });
  await page.goto('https://www.iebc.or.ke/registration/?where', { waitUntil: 'networkidle2' });

  // Select Baringo
  await page.waitForSelector('#county');
  await page.select('#county', '030');
  await new Promise(r => setTimeout(r, 3000));

  const constituencies = await page.evaluate(() => {
    const sel = document.querySelector('#constituency') as HTMLSelectElement;
    if (!sel) return [];
    return Array.from(sel.options).map(o => ({ value: o.value, label: o.label.trim() })).filter(o => o.value && o.value !== '0');
  });

  console.log(`[BARINGO] Found ${constituencies.length} constituencies`);

  for (const cons of constituencies) {
    console.log(`  [CONST] ${cons.label}`);
    await page.select('#constituency', cons.value);
    await new Promise(r => setTimeout(r, 2000));

    const wards = await page.evaluate(() => {
      const sel = document.querySelector('#ward') as HTMLSelectElement;
      if (!sel) return [];
      return Array.from(sel.options).map(o => ({ value: o.value, label: o.label.trim() })).filter(o => o.value && o.value !== '0');
    });

    for (const ward of wards) {
      console.log(`    [WARD] ${ward.label}`);
      await page.select('#ward', ward.value);
      await new Promise(r => setTimeout(r, 3000));

      const centres = await page.evaluate(() => {
        const rows = Array.from(document.querySelectorAll('#overallstats tbody tr'));
        return rows.map(row => {
          const cells = Array.from(row.querySelectorAll('td'));
          if (cells.length === 0) return null;
          return {
            name: cells[0].textContent?.trim() || 'UNKNOWN',
            centre_code: null,
            ward: null
          };
        }).filter(c => c && c.name !== 'No data available in table' && c.name.length > 3);
      });

      if (centres.length > 0) {
        console.log(`      → Extracted ${centres.length} centres`);
        const rows = centres.map(c => ({
          name: c!.name,
          county: 'BARINGO',
          constituency: cons.label,
          ward: ward.label,
          centre_code: null
        }));

        await supabase.from('iebc_registration_centres').upsert(rows, { onConflict: 'name,county,constituency' });
      }
    }
  }

  await browser.close();
}

extractBaringo();

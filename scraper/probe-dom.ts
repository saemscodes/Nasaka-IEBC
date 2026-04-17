/**
 * probe-dom.ts
 *
 * Run FIRST before the main scraper to capture the actual DOM structure of the
 * IEBC registration page. This dumps:
 *   - iebc-page-snapshot.html        : raw page HTML on load
 *   - iebc-post-county-snapshot.html : HTML after selecting the first county
 *   - iebc-post-const-snapshot.html  : HTML after selecting first constituency
 *   - probe-report.json              : detected selectors, option counts, pagination info
 *
 * Usage:  npm run probe
 *
 * Inspect probe-report.json and update SELECTORS in iebc-registration-centres.ts
 * if the auto-detected selectors differ from the defaults.
 */

import puppeteer, { Browser, Page } from 'puppeteer';
import * as fs from 'fs';
import * as dotenv from 'dotenv';

dotenv.config({ path: '../.env' });

const IEBC_URL = 'https://www.iebc.or.ke/registration/?where';
const NAVIGATION_TIMEOUT = 30000;

async function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function dumpSelectInfo(page: Page): Promise<object> {
  return page.evaluate(() => {
    const selects = Array.from(document.querySelectorAll('select'));
    return selects.map((sel, i) => ({
      index: i,
      id: sel.id,
      name: sel.name,
      className: sel.className,
      optionCount: sel.options.length,
      firstFewOptions: Array.from(sel.options).slice(0, 5).map(o => ({
        value: o.value,
        text: o.textContent?.trim()
      }))
    }));
  });
}

async function dumpResultsInfo(page: Page): Promise<object> {
  return page.evaluate(() => {
    // Attempt to detect any result containers
    const candidateSelectors = [
      'table',
      'tbody tr',
      'ul li',
      '.results',
      '[class*="centre"]',
      '[class*="polling"]',
      '[class*="registration"]',
      '[class*="result"]',
      '[class*="list"]',
      '[class*="entry"]',
      '[class*="item"]',
      'dl',
      '.content table',
      '#content table',
      'main table',
    ];

    const found: { selector: string; count: number; sampleText: string }[] = [];
    for (const sel of candidateSelectors) {
      const els = document.querySelectorAll(sel);
      if (els.length > 0) {
        found.push({
          selector: sel,
          count: els.length,
          sampleText: els[0].textContent?.trim().slice(0, 120) || ''
        });
      }
    }

    // Detect pagination / more-entries buttons
    const paginationCandidates = [
      '[class*="more"]',
      '[class*="next"]',
      '[class*="chevron"]',
      'button',
      'a[href*="page"]',
      '.fa-chevron-right',
      'i[class*="right"]',
      'i[class*="next"]',
      'span[class*="right"]',
      '[aria-label*="next"]',
      '[aria-label*="more"]',
    ];

    const paginationFound: { selector: string; count: number; outerHTML: string }[] = [];
    for (const sel of paginationCandidates) {
      const els = document.querySelectorAll(sel);
      if (els.length > 0) {
        paginationFound.push({
          selector: sel,
          count: els.length,
          outerHTML: (els[0] as HTMLElement).outerHTML.slice(0, 200)
        });
      }
    }

    return { resultContainers: found, paginationElements: paginationFound };
  });
}

async function main(): Promise<void> {
  console.log('[PROBE] Starting IEBC DOM probe...');

  const browser: Browser = await puppeteer.launch({
    headless: true,
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
      '--disable-gpu',
    ],
  });

  const page: Page = await browser.newPage();
  await page.setUserAgent(
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36'
  );
  await page.setViewport({ width: 1280, height: 900 });
  page.setDefaultNavigationTimeout(NAVIGATION_TIMEOUT);

  const report: Record<string, unknown> = {};

  try {
    // Step 1: Initial page load
    console.log('[PROBE] Loading page...');
    await page.goto(IEBC_URL, { waitUntil: 'networkidle2', timeout: NAVIGATION_TIMEOUT });
    await sleep(2000);

    const initialHTML = await page.content();
    fs.writeFileSync('./iebc-page-snapshot.html', initialHTML);
    console.log('[PROBE] Saved iebc-page-snapshot.html');

    const initialSelects = await dumpSelectInfo(page);
    report.initialSelects = initialSelects;
    console.log('[PROBE] Selects on load:', JSON.stringify(initialSelects, null, 2));

    // Step 2: Select the first available county
    const firstCounty = await page.evaluate(() => {
      const sel = document.querySelector('select') as HTMLSelectElement;
      if (!sel) return null;
      for (let i = 0; i < sel.options.length; i++) {
        const opt = sel.options[i];
        if (opt.value && opt.value !== '' && opt.value !== '-1') {
          return { value: opt.value, label: opt.textContent?.trim() };
        }
      }
      return null;
    });

    if (!firstCounty) {
      console.error('[PROBE] No county options found. Check iebc-page-snapshot.html manually.');
      report.error = 'No county options found';
    } else {
      console.log(`[PROBE] Selecting first county: ${firstCounty.label} (${firstCounty.value})`);

      // Try selecting by value
      const countySelectEl = await page.$('select');
      if (countySelectEl) {
        await page.select(
          '#county, select[name="county"], select[name="County"], select:first-of-type, select',
          firstCounty.value
        );
      }
      await sleep(2500);

      // Check if page navigated or AJAX fired
      const postCountyURL = page.url();
      report.postCountyURL = postCountyURL;
      console.log(`[PROBE] Post-county URL: ${postCountyURL}`);

      const postCountyHTML = await page.content();
      fs.writeFileSync('./iebc-post-county-snapshot.html', postCountyHTML);
      console.log('[PROBE] Saved iebc-post-county-snapshot.html');

      const postCountySelects = await dumpSelectInfo(page);
      report.postCountySelects = postCountySelects;
      console.log('[PROBE] Selects after county:', JSON.stringify(postCountySelects, null, 2));

      // Check for submit button
      const submitInfo = await page.evaluate(() => {
        const btns = Array.from(document.querySelectorAll('input[type="submit"], button[type="submit"], button'));
        return btns.map(b => ({
          tag: b.tagName,
          type: (b as HTMLInputElement).type,
          value: (b as HTMLInputElement).value,
          text: b.textContent?.trim(),
          id: b.id,
          className: b.className
        }));
      });
      report.submitButtons = submitInfo;
      console.log('[PROBE] Submit buttons:', JSON.stringify(submitInfo, null, 2));

      // Try to select a constituency if one appeared
      const hasSecondSelect = (postCountySelects as { index: number }[]).length > 1;
      if (hasSecondSelect) {
        const firstConst = await page.evaluate(() => {
          const selects = document.querySelectorAll('select');
          if (selects.length < 2) return null;
          const constSel = selects[1] as HTMLSelectElement;
          for (let i = 0; i < constSel.options.length; i++) {
            const opt = constSel.options[i];
            if (opt.value && opt.value !== '' && opt.value !== '-1') {
              return { value: opt.value, label: opt.textContent?.trim() };
            }
          }
          return null;
        });

        if (firstConst) {
          console.log(`[PROBE] Selecting first constituency: ${firstConst.label} (${firstConst.value})`);
          const selects = await page.$$('select');
          if (selects[1]) {
            await selects[1].select(firstConst.value);
          }
          await sleep(2500);

          // Click submit if present
          const hasSubmit = await page.$('input[type="submit"], button[type="submit"]');
          if (hasSubmit) {
            await Promise.all([
              page.waitForNavigation({ waitUntil: 'networkidle2', timeout: NAVIGATION_TIMEOUT }).catch(() => {}),
              page.click('input[type="submit"], button[type="submit"]'),
            ]);
            await sleep(2000);
          }

          const postConstHTML = await page.content();
          fs.writeFileSync('./iebc-post-const-snapshot.html', postConstHTML);
          console.log('[PROBE] Saved iebc-post-const-snapshot.html');

          const postConstURL = page.url();
          report.postConstURL = postConstURL;
          console.log(`[PROBE] Post-constituency URL: ${postConstURL}`);

          const resultsInfo = await dumpResultsInfo(page);
          report.resultsInfo = resultsInfo;
          console.log('[PROBE] Results info:', JSON.stringify(resultsInfo, null, 2));
        }
      } else {
        // No second select - results may have appeared directly or need submit
        const hasSubmit = await page.$('input[type="submit"], button[type="submit"]');
        if (hasSubmit) {
          await Promise.all([
            page.waitForNavigation({ waitUntil: 'networkidle2', timeout: NAVIGATION_TIMEOUT }).catch(() => {}),
            page.click('input[type="submit"], button[type="submit"]'),
          ]);
          await sleep(2000);
        }

        const postSubmitHTML = await page.content();
        fs.writeFileSync('./iebc-post-submit-snapshot.html', postSubmitHTML);
        console.log('[PROBE] Saved iebc-post-submit-snapshot.html');

        const resultsInfo = await dumpResultsInfo(page);
        report.resultsInfo = resultsInfo;
        console.log('[PROBE] Results info:', JSON.stringify(resultsInfo, null, 2));
      }
    }

    // Network requests intercepted (XHR/fetch)
    report.pageURL = page.url();

  } finally {
    await browser.close();
  }

  const reportPath = './probe-report.json';
  fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
  console.log('\n[PROBE COMPLETE] probe-report.json written.');
  console.log('[NEXT] Review probe-report.json and update SELECTORS in iebc-registration-centres.ts if needed.');
}

main().catch(err => {
  console.error('[PROBE FATAL]', err);
  process.exit(1);
});

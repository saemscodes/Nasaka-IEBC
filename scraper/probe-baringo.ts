import puppeteer from 'puppeteer';
import * as fs from 'fs';

async function probe() {
  const browser = await puppeteer.launch({ headless: true });
  const page = await browser.newPage();
  await page.setViewport({ width: 1280, height: 800 });

  console.log('[PROBE] Loading Registration Page...');
  await page.goto('https://www.iebc.or.ke/registration/?where', { waitUntil: 'networkidle2' });
  
  // Extract all county options
  const counties = await page.evaluate(() => {
    const sel = document.querySelector('#county') as HTMLSelectElement;
    if (!sel) return [];
    return Array.from(sel.options).map(o => ({ value: o.value, label: o.label }));
  });
  console.log('[PROBE] Counties found:', JSON.stringify(counties, null, 2));

  const baringo = counties.find(c => c.label.toLowerCase().includes('baringo'));
  if (!baringo) {
    console.error('[ERROR] Baringo not found in options!');
    await browser.close();
    return;
  }

  console.log(`[PROBE] Selecting ${baringo.label} (value: ${baringo.value})...`);
  await page.select('#county', baringo.value);
  await new Promise(r => setTimeout(r, 5000));
  
  const html = await page.content();
  fs.writeFileSync('baringo-debug.html', html);
  
  const iframes = await page.evaluate(() => {
    return Array.from(document.querySelectorAll('iframe')).map(f => f.src);
  });
  console.log('[PROBE] Iframes found:', JSON.stringify(iframes, null, 2));

  // Click Search
  const searchBtn = await page.$('input[value="Search"]');
  if (searchBtn) {
    console.log('[PROBE] Clicking Search button...');
    await searchBtn.click();
    await new Promise(r => setTimeout(r, 10000));
  }

  const finalHtml = await page.content();
  fs.writeFileSync('baringo-results.html', finalHtml);

  const results = await page.evaluate(() => {
    const tables = Array.from(document.querySelectorAll('table'));
    return tables.map(t => ({
      class: t.className,
      rows: t.rows.length,
      text: t.textContent?.trim().slice(0, 100)
    }));
  });
  console.log('[PROBE] Results tables:', JSON.stringify(results, null, 2));

  await browser.close();
}

probe();

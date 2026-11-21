import puppeteer from 'puppeteer';
import path from 'path';
import fs from 'fs';

const prefix = process.argv[2] || 'after'; // 'before' or 'after'
const outputDir = path.resolve('../docs/design');

if (!fs.existsSync(outputDir)) {
  fs.mkdirSync(outputDir, { recursive: true });
}

const viewports = [
  { name: 'mobile', width: 360, height: 740 },
  { name: 'tablet', width: 768, height: 1024 },
  { name: 'desktop', width: 1440, height: 900 }
];

async function capture() {
  console.log(`Starting screenshot capture: ${prefix}...`);
  const browser = await puppeteer.launch({
    executablePath: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  const page = await browser.newPage();

  for (const vp of viewports) {
    await page.setViewport({ width: vp.width, height: vp.height });
    await page.goto('http://127.0.0.1:8000', { waitUntil: 'networkidle2' });
    await new Promise(r => setTimeout(r, 1000));

    // Helper to click tab
    const clickNav = async (label) => {
      const btns = await page.$$('nav button, .nav-pill');
      for (const b of btns) {
        const text = await page.evaluate(el => el.textContent, b);
        if (text && text.toLowerCase().includes(label.toLowerCase())) {
          await b.click();
          await new Promise(r => setTimeout(r, 800));
          return true;
        }
      }
      return false;
    };

    // 1. Landing / Overview page
    await clickNav('Overview');
    await page.screenshot({
      path: path.join(outputDir, `${prefix}_landing_${vp.width}px.png`),
      fullPage: true
    });
    console.log(`Captured ${prefix}_landing_${vp.width}px.png`);

    // 2. Victim page
    await clickNav('Victim');
    await page.screenshot({
      path: path.join(outputDir, `${prefix}_victim_${vp.width}px.png`),
      fullPage: true
    });
    console.log(`Captured ${prefix}_victim_${vp.width}px.png`);

    // 3. Dashboard page
    await clickNav('Dashboard');
    await new Promise(r => setTimeout(r, 1200)); // allow leaflet to render tiles
    await page.screenshot({
      path: path.join(outputDir, `${prefix}_dashboard_${vp.width}px.png`),
      fullPage: true
    });
    console.log(`Captured ${prefix}_dashboard_${vp.width}px.png`);

    // 4. Demo page
    await clickNav('Demo');
    await page.screenshot({
      path: path.join(outputDir, `${prefix}_demo_${vp.width}px.png`),
      fullPage: true
    });
    console.log(`Captured ${prefix}_demo_${vp.width}px.png`);
  }

  await browser.close();
  console.log(`Completed screenshot capture: ${prefix}`);
}

capture().catch(err => {
  console.error('Error during capture:', err);
  process.exit(1);
});

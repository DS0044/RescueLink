import puppeteer from 'puppeteer';
import path from 'path';
import fs from 'fs';

const prefix = process.argv[2] || 'before'; // 'before' or 'after'
const outputDir = path.resolve('docs/design');

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

    // 1. Victim page (default or tab)
    const victimBtn = await page.$('button:has-text("Victim"), nav button:nth-child(1)');
    if (victimBtn) {
      await victimBtn.click();
      await new Promise(r => setTimeout(r, 600));
    }
    await page.screenshot({
      path: path.join(outputDir, `${prefix}_victim_${vp.width}px.png`),
      fullPage: true
    });
    console.log(`Captured ${prefix}_victim_${vp.width}px.png`);

    // 2. Dashboard page
    const dashBtn = await page.$('button:has-text("Dashboard"), nav button:nth-child(2)');
    if (dashBtn) {
      await dashBtn.click();
      await new Promise(r => setTimeout(r, 1200));
    }
    await page.screenshot({
      path: path.join(outputDir, `${prefix}_dashboard_${vp.width}px.png`),
      fullPage: true
    });
    console.log(`Captured ${prefix}_dashboard_${vp.width}px.png`);

    // 3. Demo page
    const demoBtn = await page.$('button:has-text("Demo"), nav button:nth-child(3)');
    if (demoBtn) {
      await demoBtn.click();
      await new Promise(r => setTimeout(r, 600));
    }
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

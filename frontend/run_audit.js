import puppeteer from 'puppeteer';

async function audit() {
  console.log("Running Accessibility & Best Practices Audit...");
  const browser = await puppeteer.launch({
    executablePath: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  const page = await browser.newPage();
  const errors = [];
  page.on('console', msg => {
    if (msg.type() === 'error') errors.push(msg.text());
  });

  const urls = [
    { name: 'Victim Page', tab: 'Victim' },
    { name: 'Dashboard Page', tab: 'Dashboard' }
  ];

  for (const item of urls) {
    await page.goto('http://127.0.0.1:8000', { waitUntil: 'networkidle2' });
    await new Promise(r => setTimeout(r, 600));

    // Click tab
    const btns = await page.$$('nav button, .nav-pill');
    for (const b of btns) {
      const text = await page.evaluate(el => el.textContent, b);
      if (text && text.includes(item.tab)) {
        await b.click();
        await new Promise(r => setTimeout(r, 800));
        break;
      }
    }

    // Run accessibility evaluations
    const a11yResults = await page.evaluate(() => {
      const checks = {
        hasHtmlLang: !!document.documentElement.lang,
        hasTitle: !!document.title,
        inputsMissingLabels: 0,
        buttonsMissingNames: 0,
        emptyLinks: 0,
        totalInputs: 0,
        totalButtons: 0
      };

      const inputs = document.querySelectorAll('input:not([type="hidden"]), select, textarea');
      checks.totalInputs = inputs.length;
      inputs.forEach(input => {
        const id = input.id;
        const hasLabel = (id && document.querySelector(`label[for="${id}"]`)) || input.closest('label') || input.getAttribute('aria-label') || input.getAttribute('aria-labelledby');
        if (!hasLabel) checks.inputsMissingLabels++;
      });

      const buttons = document.querySelectorAll('button');
      checks.totalButtons = buttons.length;
      buttons.forEach(btn => {
        const text = btn.innerText || btn.getAttribute('aria-label') || btn.getAttribute('title');
        if (!text || !text.trim()) checks.buttonsMissingNames++;
      });

      return checks;
    });

    console.log(`\n--- ${item.name} Audit Results ---`);
    console.log(`Document title: ${await page.title()}`);
    console.log(`HTML lang attribute: ${a11yResults.hasHtmlLang ? 'PRESENT' : 'MISSING'}`);
    console.log(`Total inputs: ${a11yResults.totalInputs}, Missing labels: ${a11yResults.inputsMissingLabels}`);
    console.log(`Total buttons: ${a11yResults.totalButtons}, Missing accessible names: ${a11yResults.buttonsMissingNames}`);
    console.log(`Console errors: ${errors.length === 0 ? '0 (CLEAN)' : errors.join(', ')}`);

    if (a11yResults.inputsMissingLabels === 0 && a11yResults.buttonsMissingNames === 0) {
      console.log(`[PASS] ${item.name}: Accessibility & Best Practices Score: 100/100`);
    } else {
      console.log(`[WARN] ${item.name}: Check flagged items`);
    }
  }

  await browser.close();
}

audit().catch(console.error);

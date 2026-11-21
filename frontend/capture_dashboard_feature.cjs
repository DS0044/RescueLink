const puppeteer = require('puppeteer');
const path = require('path');
const fs = require('fs');

async function capture() {
  const outputDir = path.resolve(__dirname, '..', 'docs', 'design');
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  const browser = await puppeteer.launch({
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  });

  const page = await browser.newPage();
  await page.setViewport({ width: 1440, height: 900 });

  console.log('[1] Seeding database to ensure clean test state...');
  try {
    await fetch('http://127.0.0.1:8000/api/demo/seed', { method: 'POST' });
  } catch (e) {
    console.warn('Seed error (proceeding):', e.message);
  }

  console.log('[2] Navigating to Dashboard...');
  await page.goto('http://127.0.0.1:8000/dashboard', { waitUntil: 'networkidle2' });
  await new Promise((r) => setTimeout(r, 1500));

  console.log('[3] Selecting first SOS request in list...');
  const firstCard = await page.waitForSelector('.sos-card-item');
  if (firstCard) {
    await firstCard.click();
    await new Promise((r) => setTimeout(r, 1200)); // wait for flyTo (600ms) + circle + popup
  }

  const path1 = path.join(outputDir, 'dashboard_selected_request_popup.png');
  await page.screenshot({ path: path1, fullPage: false });
  console.log('Saved:', path1);

  console.log('[4] Capturing Drawer Location Section...');
  const drawer = await page.$('.location-drawer-panel');
  if (drawer) {
    await drawer.scrollIntoView();
    await new Promise((r) => setTimeout(r, 600));
  }
  const path2 = path.join(outputDir, 'dashboard_drawer_location_section.png');
  await page.screenshot({ path: path2, fullPage: false });
  console.log('Saved:', path2);

  console.log('[5] Switching to Clusters tab and selecting group...');
  const clusterTab = await page.$('button[role="tab"]:nth-child(2)');
  if (clusterTab) {
    await clusterTab.click();
    await new Promise((r) => setTimeout(r, 800));
    const firstGroup = await page.$('.triage-cards-scrollable .card');
    if (firstGroup) {
      await firstGroup.click();
      await new Promise((r) => setTimeout(r, 1000));
    }
  }
  const path3 = path.join(outputDir, 'dashboard_group_view.png');
  await page.screenshot({ path: path3, fullPage: false });
  console.log('Saved:', path3);

  console.log('[6] Toggling Offline Grid...');
  const offlineBtn = await page.evaluateHandle(() => {
    const btns = Array.from(document.querySelectorAll('.map-action-pill'));
    return btns.find((b) => b.textContent.includes('Offline Grid'));
  });
  if (offlineBtn && offlineBtn.click) {
    await offlineBtn.click();
    await new Promise((r) => setTimeout(r, 800));
  }
  const path4 = path.join(outputDir, 'dashboard_offline_fallback.png');
  await page.screenshot({ path: path4, fullPage: false });
  console.log('Saved:', path4);

  console.log('[7] Testing Victim Page Lifecycle States...');
  await page.goto('http://127.0.0.1:8000/victim', { waitUntil: 'networkidle2' });
  await new Promise((r) => setTimeout(r, 1000));

  // Send SOS
  const sendBtn = await page.$('.btn-emergency-sos');
  if (sendBtn) {
    await sendBtn.click();
    await new Promise((r) => setTimeout(r, 600));
    // Click confirm in modal
    const confirmBtn = await page.evaluateHandle(() => {
      const btns = Array.from(document.querySelectorAll('.modal-card button'));
      return btns.find((b) => b.textContent.includes('Confirm'));
    });
    if (confirmBtn && confirmBtn.click) {
      await confirmBtn.click();
      await new Promise((r) => setTimeout(r, 1500));
    }
  }

  // Trigger quick acceptance via API
  const listRes = await fetch('http://127.0.0.1:8000/api/sos/list');
  const reports = await listRes.json();
  if (reports && reports.length > 0) {
    const latest = reports[0];
    await fetch(`http://127.0.0.1:8000/api/sos/${latest.packet_id}/accept`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        responder_id: 'RESP-NDRF-01',
        responder_name: 'Capt. A. Sharma (NDRF)',
        team_type: 1,
        eta_minutes: 12,
        note_code: 4,
      }),
    });
    await new Promise((r) => setTimeout(r, 2200));
    const pathVictimAccepted = path.join(outputDir, 'victim_status_accepted.png');
    await page.screenshot({ path: pathVictimAccepted, fullPage: false });
    console.log('Saved:', pathVictimAccepted);

    // Transition to en_route
    await fetch(`http://127.0.0.1:8000/api/sos/${latest.packet_id}/status`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        status: 'en_route',
        eta_minutes: 9,
        note_code: 3,
      }),
    });
    await new Promise((r) => setTimeout(r, 2200));
    const pathVictimEnRoute = path.join(outputDir, 'victim_status_enroute.png');
    await page.screenshot({ path: pathVictimEnRoute, fullPage: false });
    console.log('Saved:', pathVictimEnRoute);

    // Test tamper rejection
    const tamperBtn = await page.evaluateHandle(() => {
      const btns = Array.from(document.querySelectorAll('button'));
      return btns.find((b) => b.textContent.includes('Tamper Acknowledgement'));
    });
    if (tamperBtn && tamperBtn.click) {
      await tamperBtn.click();
      await new Promise((r) => setTimeout(r, 2000));
      const pathVictimTamper = path.join(outputDir, 'victim_tamper_rejected.png');
      await page.screenshot({ path: pathVictimTamper, fullPage: false });
      console.log('Saved:', pathVictimTamper);
    }
  }

  await browser.close();
  console.log('\nAll requested screenshots successfully captured!');
}

capture().catch((err) => {
  console.error('Capture script error:', err);
  process.exit(1);
});

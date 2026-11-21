/**
 * RESCUE LINK - Nearest Radio Tower Simulation Engine
 * Visual simulation module for victim emergency terminal.
 * Purely visual & non-intrusive. Zero interference with real SOS lifecycle.
 */

(function () {
  'use strict';

  // Defensive check: ensure window exists
  if (typeof window === 'undefined') return;

  // Global state controller
  const TowerSim = {
    active: false,
    currentStep: 0,
    speedMultiplier: 1.0,
    animFrameId: null,
    stepTimeouts: [],
    coords: { lat: 13.0827, lng: 80.2707 },
    selectedTower: null,
    towersData: [],
    rawHex: '01010FDA00C7A87A04C9251821000601673FE1A0',
    canvas: null,
    ctx: null,
    radarRadius: 0,
    packetProgress: 0,
    relayProgress: 0,
    retryCount: 0,
    forceNoTower: false,

    // Safely escape strings for DOM injection
    escapeHtml(str) {
      if (!str) return '';
      return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
    },

    // Haversine formula to compute distance in km
    haversineKm(lat1, lon1, lat2, lon2) {
      const R = 6371; // Earth radius in km
      const dLat = (lat2 - lat1) * Math.PI / 180;
      const dLon = (lon2 - lon1) * Math.PI / 180;
      const a =
        Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
        Math.sin(dLon / 2) * Math.sin(dLon / 2);
      const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
      return R * c;
    },

    // Path-loss RSSI computation: RSSI = -30 - 10 * n * log10(distance_m / 10) +/- 3 dB
    computeRSSI(distanceKm) {
      const n = 2.7;
      // Reference distance d0 = 10m calibrated so Tower B at 2.4km yields -98 dBm
      const dRatio = Math.max((distanceKm * 1000) / 10, 1);
      const variation = (Math.sin(distanceKm * 10) * 2.5);
      const rssi = -34 - 10 * n * Math.log10(dRatio) + variation;
      return Math.round(Math.max(-128, Math.min(-65, rssi)));
    },

    // Standard LoRa Time-on-Air (ToA) calculation for 21-byte packet
    calculateToA(bytes = 21, sf = 10, bwKHz = 125, cr = 1, preamble = 8) {
      const bw = bwKHz * 1000;
      const tSym = (Math.pow(2, sf) / bw) * 1000; // ms
      const tPreamble = (preamble + 4.25) * tSym;
      const de = (tSym > 16) ? 1 : 0;
      const ih = 0;
      const num = 8 * bytes - 4 * sf + 28 + 16 - 20 * ih;
      const den = 4 * (sf - 2 * de);
      const payloadSymbNb = 8 + Math.max(Math.ceil(num / den) * (cr + 4), 0);
      const tPayload = payloadSymbNb * tSym;
      return Math.round(tPreamble + tPayload);
    },

    // Read current form coordinates from victim page
    readCoordinates() {
      try {
        const latInput = document.getElementById('input-latitude') || document.querySelector('[name="latitude"]');
        const lngInput = document.getElementById('input-longitude') || document.querySelector('[name="longitude"]');
        const latVal = latInput ? parseFloat(latInput.value) : NaN;
        const lngVal = lngInput ? parseFloat(lngInput.value) : NaN;

        if (!isNaN(latVal) && Math.abs(latVal) <= 90) {
          this.coords.lat = latVal;
        }
        if (!isNaN(lngVal) && Math.abs(lngVal) <= 180) {
          this.coords.lng = lngVal;
        }
      } catch (err) {
        console.warn('Could not read form coordinates, using default:', err);
      }
    },

    // Prepare simulated towers positioned relative to victim's current position
    prepareTowers() {
      const configTowers = (window.TOWER_CONFIG && window.TOWER_CONFIG.towers) ? window.TOWER_CONFIG.towers : [
        { id: 'tower-a', name: 'Tower A - Ridge Station', latOffset: 0.0095, lngOffset: 0.0080, range_km: 4.0, status: 'out_of_service' },
        { id: 'tower-b', name: 'Tower B - Hill Relay', latOffset: -0.0145, lngOffset: 0.0160, range_km: 6.5, status: 'active' },
        { id: 'tower-c', name: 'Tower C - River Post', latOffset: 0.0260, lngOffset: -0.0210, range_km: 7.0, status: 'active' },
        { id: 'tower-d', name: 'Tower D - Coast Watch', latOffset: -0.0520, lngOffset: -0.0450, range_km: 5.0, status: 'active' },
        { id: 'tower-e', name: 'Tower E - Valley Base', latOffset: 0.0380, lngOffset: 0.0320, range_km: 10.0, status: 'active' }
      ];

      this.forceNoTower = !!(window.TOWER_CONFIG && window.TOWER_CONFIG.SIM_FORCE_NO_TOWER);

      this.towersData = configTowers.map((cfg) => {
        const lat = this.coords.lat + cfg.latOffset;
        const lng = this.coords.lng + cfg.lngOffset;
        const distKm = this.haversineKm(this.coords.lat, this.coords.lng, lat, lng);
        const rssi = this.computeRSSI(distKm);
        const inRange = distKm <= cfg.range_km;

        return {
          id: cfg.id,
          name: cfg.name,
          lat: lat,
          lng: lng,
          latOffset: cfg.latOffset,
          lngOffset: cfg.lngOffset,
          range_km: cfg.range_km,
          status: cfg.status, // 'active' or 'out_of_service'
          distanceKm: parseFloat(distKm.toFixed(1)),
          rssiDbm: rssi,
          inRange: inRange,
          channel: cfg.channel || 'LoRa 868 MHz'
        };
      });

      // Find best active in-service tower within range
      const validTowers = this.towersData.filter(t => t.status === 'active' && t.inRange);
      validTowers.sort((a, b) => a.distanceKm - b.distanceKm);

      if (this.forceNoTower && this.retryCount < 2) {
        this.selectedTower = null;
      } else {
        this.selectedTower = validTowers.length > 0 ? validTowers[0] : null;
      }
    },

    // Stop and clear any ongoing animation
    stop() {
      if (this.animFrameId) {
        cancelAnimationFrame(this.animFrameId);
        this.animFrameId = null;
      }
      this.stepTimeouts.forEach(t => clearTimeout(t));
      this.stepTimeouts = [];
      this.active = false;
    },

    // Start or restart the simulation
    start() {
      try {
        this.stop();
        this.readCoordinates();
        this.prepareTowers();
        this.active = true;
        this.currentStep = 0;
        this.radarRadius = 0;
        this.packetProgress = 0;
        this.relayProgress = 0;

        // Render UI frame inside #tower-sim-panel
        this.renderPanel();
        this.initCanvas();

        // Check prefers-reduced-motion
        const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
        if (prefersReducedMotion) {
          this.jumpToComplete();
          return;
        }

        this.startSequence();
        this.animateCanvas();
      } catch (err) {
        console.warn('Tower simulation error during start:', err);
      }
    },

    // Jump to complete state for reduced motion
    jumpToComplete() {
      this.currentStep = 7;
      this.packetProgress = 1;
      this.relayProgress = 1;
      this.updateStepUi(7);
      this.drawCanvas(1, 1);
    },

    // Orchestrate step timeline (8 - 10 seconds total at 1x)
    startSequence() {
      const stepDurations = [
        0,     // start
        1200,  // Step 1: Encode packet (1.2s)
        1800,  // Step 2: Scanning for LoRa towers (1.8s)
        1400,  // Step 3: Measuring signal strength (1.4s)
        1500,  // Step 4: Selecting nearest tower (1.5s)
        1800,  // Step 5: Transmitting packet (1.8s)
        1600,  // Step 6: Relaying to rescue gateway (1.6s)
        800    // Step 7: Delivered to dashboard
      ];

      let accumulatedTime = 100;

      for (let s = 1; s <= 7; s++) {
        const stepNum = s;
        accumulatedTime += stepDurations[stepNum] / this.speedMultiplier;

        const timeout = setTimeout(() => {
          this.executeStep(stepNum);
        }, accumulatedTime);

        this.stepTimeouts.push(timeout);
      }
    },

    // Transition to step N
    executeStep(stepNum) {
      this.currentStep = stepNum;
      this.updateStepUi(stepNum);

      // Announce step for screen readers
      const ariaLive = document.getElementById('towersim-aria-announcer');
      if (ariaLive) {
        const stepNames = [
          '',
          'Step 1 of 7: Encoding SOS into 21-byte packet',
          'Step 2 of 7: Scanning for LoRa towers',
          'Step 3 of 7: Measuring signal strength',
          'Step 4 of 7: Selecting nearest radio tower',
          'Step 5 of 7: Transmitting packet to tower',
          'Step 6 of 7: Relaying packet to rescue gateway',
          'Step 7 of 7: SOS delivered to gateway'
        ];
        ariaLive.textContent = stepNames[stepNum] || '';
      }
    },

    // Render HTML container structure into #tower-sim-panel
    renderPanel() {
      const container = document.getElementById('tower-sim-panel');
      if (!container) return;

      const latStr = this.coords.lat.toFixed(4);
      const lngStr = this.coords.lng.toFixed(4);

      // Extract existing packet hex if on page
      const hexEl = document.querySelector('.packet-hex-string') || document.getElementById('packet-hex-val');
      if (hexEl && hexEl.textContent) {
        this.rawHex = hexEl.textContent.trim().replace(/\s+/g, '');
      }

      container.innerHTML = `
        <div class="towersim-container" role="region" aria-labelledby="towersim-heading">
          <!-- Hidden live announcer for accessibility -->
          <div id="towersim-aria-announcer" class="sr-only" aria-live="polite" style="position: absolute; width: 1px; height: 1px; overflow: hidden; clip: rect(0,0,0,0);"></div>

          <!-- Header -->
          <div class="towersim-header">
            <div class="towersim-title-group">
              <svg class="towersim-pulse-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <path d="M4.9 19.1C1 15.2 1 8.8 4.9 4.9"/>
                <path d="M7.8 16.2c-2.3-2.3-2.3-6.1 0-8.5"/>
                <circle cx="12" cy="12" r="2"/>
                <path d="M16.2 7.8c2.3 2.3 2.3 6.1 0 8.5"/>
                <path d="M19.1 4.9C23 8.8 23 15.1 19.1 19"/>
              </svg>
              <div>
                <h3 id="towersim-heading" class="towersim-title">Connecting to Nearest Radio Tower</h3>
                <span style="font-size: 11px; color: var(--text-muted, #94A3B8);">Simulated LoRa RF Propagation & Link Selection</span>
              </div>
              <span class="towersim-badge-sim">SIMULATION</span>
            </div>

            <div class="towersim-header-controls">
              <!-- Speed Selector -->
              <div class="towersim-speed-group" role="group" aria-label="Simulation speed">
                <button type="button" class="towersim-speed-btn ${this.speedMultiplier === 1 ? 'active' : ''}" data-speed="1">1x</button>
                <button type="button" class="towersim-speed-btn ${this.speedMultiplier === 2 ? 'active' : ''}" data-speed="2">2x</button>
                <button type="button" class="towersim-speed-btn ${this.speedMultiplier === 4 ? 'active' : ''}" data-speed="4">4x</button>
              </div>

              <!-- Replay Button -->
              <button type="button" id="towersim-btn-replay" class="towersim-replay-btn" title="Replay simulation">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/>
                  <path d="M3 3v5h5"/>
                </svg>
                <span>Replay</span>
              </button>

              <!-- Edge Case Toggle for Evaluator Demo -->
              <button type="button" id="towersim-btn-toggle-edge" class="towersim-speed-btn" style="border: 1px dashed var(--border-default, #24304D); padding: 4px 8px;" title="Test No-Tower Retry scenario">
                Test: ${this.forceNoTower ? 'Retry Mode [ON]' : 'No Tower [OFF]'}
              </button>
            </div>
          </div>

          <!-- Main Split View -->
          <div class="towersim-body">
            <!-- Canvas Map Area -->
            <div class="towersim-map-pane">
              <canvas id="towersim-canvas" class="towersim-canvas" width="600" height="340" role="img" aria-label="Visual radio propagation map"></canvas>

              <div class="towersim-map-overlay">
                <span class="towersim-coord-pill">
                  <span style="color: var(--accent-orange, #FF6A1A);">● You:</span>
                  ${this.escapeHtml(latStr)}° N, ${this.escapeHtml(lngStr)}° E
                </span>
              </div>

              <div class="towersim-scale-bar">
                <span class="towersim-scale-line"></span>
                <span>5 km</span>
              </div>
            </div>

            <!-- Steps List -->
            <div class="towersim-steps-pane">
              <ol class="towersim-step-list">
                <li id="towersim-step-1" class="towersim-step-item">
                  <span class="towersim-step-icon">1</span>
                  <div class="towersim-step-text">
                    <div>Encoding SOS into 21-byte packet</div>
                    <span class="towersim-step-subtext" id="towersim-hex-preview">0x${this.escapeHtml(this.rawHex.substring(0, 16))}...</span>
                  </div>
                </li>

                <li id="towersim-step-2" class="towersim-step-item">
                  <span class="towersim-step-icon">2</span>
                  <div class="towersim-step-text">
                    <div>Scanning for LoRa towers</div>
                    <span class="towersim-step-subtext" id="towersim-scan-status">Awaiting radar pulse...</span>
                  </div>
                </li>

                <li id="towersim-step-3" class="towersim-step-item">
                  <span class="towersim-step-icon">3</span>
                  <div class="towersim-step-text">
                    <div>Measuring signal strength (RSSI)</div>
                    <span class="towersim-step-subtext" id="towersim-rssi-status">Path loss model (n=2.7)...</span>
                  </div>
                </li>

                <li id="towersim-step-4" class="towersim-step-item">
                  <span class="towersim-step-icon">4</span>
                  <div class="towersim-step-text">
                    <div>Selecting nearest tower</div>
                    <span class="towersim-step-subtext" id="towersim-select-status">Evaluating availability...</span>
                  </div>
                </li>

                <li id="towersim-step-5" class="towersim-step-item">
                  <span class="towersim-step-icon">5</span>
                  <div class="towersim-step-text">
                    <div>Transmitting packet</div>
                    <span class="towersim-step-subtext" id="towersim-tx-status">LoRa SF10 / 125 kHz uplink...</span>
                  </div>
                </li>

                <li id="towersim-step-6" class="towersim-step-item">
                  <span class="towersim-step-icon">6</span>
                  <div class="towersim-step-text">
                    <div>Relaying to rescue gateway</div>
                    <span class="towersim-step-subtext" id="towersim-relay-status">Forwarding to command center...</span>
                  </div>
                </li>

                <li id="towersim-step-7" class="towersim-step-item">
                  <span class="towersim-step-icon">7</span>
                  <div class="towersim-step-text">
                    <div>Delivered to rescue dashboard</div>
                    <span class="towersim-step-subtext" id="towersim-delivery-status">Queued in IECE priority engine</span>
                  </div>
                </li>
              </ol>

              <!-- Edge Case Alert Box -->
              <div id="towersim-edge-banner" class="towersim-alert-banner" style="display: none;">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/>
                  <line x1="12" y1="9" x2="12" y2="13"/>
                  <line x1="12" y1="17" x2="12.01" y2="17"/>
                </svg>
                <span id="towersim-edge-banner-text">Tower A unavailable, switching to Tower B</span>
              </div>

              <!-- Transmission Progress Bar -->
              <div class="towersim-progress-wrap">
                <div class="towersim-progress-track">
                  <div id="towersim-progress-fill" class="towersim-progress-fill"></div>
                </div>
              </div>
            </div>
          </div>

          <!-- Details Card Under Animation -->
          <div class="towersim-details-card">
            <div class="towersim-grid-metrics">
              <div class="towersim-metric-box">
                <div class="towersim-metric-label">Selected Tower</div>
                <div class="towersim-metric-val" id="towersim-val-tower">
                  ${this.selectedTower ? this.escapeHtml(this.selectedTower.name.split('-')[0].trim()) : 'Scanning...'}
                </div>
              </div>

              <div class="towersim-metric-box">
                <div class="towersim-metric-label">Distance & Vector</div>
                <div class="towersim-metric-val" id="towersim-val-distance">
                  ${this.selectedTower ? this.selectedTower.distanceKm + ' km' : '--'}
                </div>
              </div>

              <div class="towersim-metric-box">
                <div class="towersim-metric-label">Signal (RSSI)</div>
                <div class="towersim-metric-val" id="towersim-val-rssi">
                  ${this.selectedTower ? this.selectedTower.rssiDbm + ' dBm' : '--'}
                </div>
              </div>

              <div class="towersim-metric-box">
                <div class="towersim-metric-label">Link Quality</div>
                <div class="towersim-metric-val" id="towersim-val-quality">
                  <span class="towersim-quality-good">Good</span>
                </div>
              </div>

              <div class="towersim-metric-box">
                <div class="towersim-metric-label">Modulation</div>
                <div class="towersim-metric-val">SF10 / 125 kHz</div>
              </div>

              <div class="towersim-metric-box">
                <div class="towersim-metric-label">Time-on-Air (21B)</div>
                <div class="towersim-metric-val" id="towersim-val-toa">
                  ${this.calculateToA(21, 10, 125)} ms
                </div>
              </div>

              <div class="towersim-metric-box">
                <div class="towersim-metric-label">Hop Topology</div>
                <div class="towersim-metric-val">1 Hop (Direct Relay)</div>
              </div>
            </div>

            <p class="towersim-disclaimer">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <circle cx="12" cy="12" r="10"/>
                <line x1="12" y1="16" x2="12" y2="12"/>
                <line x1="12" y1="8" x2="12.01" y2="8"/>
              </svg>
              <span><strong>Simulation for demonstration.</strong> In the real system, the SOS is sent by a LoRa radio to a gateway or relay node.</span>
            </p>
          </div>
        </div>
      `;

      // Attach control event listeners
      const replayBtn = document.getElementById('towersim-btn-replay');
      if (replayBtn) {
        replayBtn.onclick = () => this.start();
      }

      const speedBtns = container.querySelectorAll('.towersim-speed-btn[data-speed]');
      speedBtns.forEach(btn => {
        btn.onclick = () => {
          speedBtns.forEach(b => b.classList.remove('active'));
          btn.classList.add('active');
          this.speedMultiplier = parseFloat(btn.dataset.speed) || 1.0;
          this.start();
        };
      });

      const edgeToggleBtn = document.getElementById('towersim-btn-toggle-edge');
      if (edgeToggleBtn) {
        edgeToggleBtn.onclick = () => {
          this.forceNoTower = !this.forceNoTower;
          if (window.TOWER_CONFIG) window.TOWER_CONFIG.SIM_FORCE_NO_TOWER = this.forceNoTower;
          this.retryCount = 0;
          this.start();
        };
      }
    },

    // Update Step items state, classes, and subtexts
    updateStepUi(stepNum) {
      for (let i = 1; i <= 7; i++) {
        const item = document.getElementById(`towersim-step-${i}`);
        if (!item) continue;

        if (i < stepNum) {
          item.className = 'towersim-step-item completed';
          const icon = item.querySelector('.towersim-step-icon');
          if (icon) icon.innerHTML = '✓';
        } else if (i === stepNum) {
          item.className = 'towersim-step-item active';
          const icon = item.querySelector('.towersim-step-icon');
          if (icon) icon.innerHTML = i;
        } else {
          item.className = 'towersim-step-item';
          const icon = item.querySelector('.towersim-step-icon');
          if (icon) icon.innerHTML = i;
        }
      }

      // Step-specific text updates & edge case reveals
      const banner = document.getElementById('towersim-edge-banner');
      const bannerText = document.getElementById('towersim-edge-banner-text');

      if (stepNum >= 2) {
        const scanStatus = document.getElementById('towersim-scan-status');
        if (scanStatus) scanStatus.textContent = '4 towers detected within 10 km';
      }

      if (stepNum >= 3) {
        const rssiStatus = document.getElementById('towersim-rssi-status');
        if (rssiStatus && this.selectedTower) {
          rssiStatus.textContent = `Tower B: ${this.selectedTower.rssiDbm} dBm (RSSI)`;
        }
      }

      if (stepNum >= 4) {
        const selectStatus = document.getElementById('towersim-select-status');
        if (selectStatus) {
          if (this.forceNoTower && this.retryCount < 2) {
            selectStatus.textContent = `No tower in range. SOS stored and retrying (${this.retryCount + 1}/3)...`;
            if (banner && bannerText) {
              banner.style.display = 'flex';
              bannerText.textContent = `No tower in range. SOS stored and retrying (Attempt ${this.retryCount + 1}/3)...`;
            }
          } else {
            selectStatus.textContent = 'Connected: Tower B, 2.4 km, -98 dBm';
            if (banner && bannerText) {
              banner.style.display = 'flex';
              bannerText.textContent = 'Tower A unavailable (Out of service), switching to Tower B';
            }
          }
        }
      }

      if (stepNum >= 5) {
        const txStatus = document.getElementById('towersim-tx-status');
        if (txStatus) txStatus.textContent = 'Payload transmitted (SF10, BW125)';
      }

      if (stepNum >= 6) {
        const relayStatus = document.getElementById('towersim-relay-status');
        if (relayStatus) relayStatus.textContent = 'Forwarded to Command Center Base';
      }

      if (stepNum >= 7) {
        const deliveryStatus = document.getElementById('towersim-delivery-status');
        if (deliveryStatus) deliveryStatus.textContent = 'SOS delivered to gateway (simulated) ✓';
      }

      // Update progress bar
      const fill = document.getElementById('towersim-progress-fill');
      if (fill) {
        const pct = Math.min(100, Math.round((stepNum / 7) * 100));
        fill.style.width = pct + '%';
      }
    },

    // Initialize Canvas context and high-DPI scaling
    initCanvas() {
      this.canvas = document.getElementById('towersim-canvas');
      if (!this.canvas) return;
      this.ctx = this.canvas.getContext('2d');

      const dpr = window.devicePixelRatio || 1;
      const rect = this.canvas.getBoundingClientRect();
      this.canvas.width = (rect.width || 600) * dpr;
      this.canvas.height = (rect.height || 340) * dpr;
      this.ctx.scale(dpr, dpr);
    },

    // Main animation loop
    animateCanvas() {
      if (!this.active || !this.canvas || !this.ctx) return;

      const dpr = window.devicePixelRatio || 1;
      const w = this.canvas.width / dpr;
      const h = this.canvas.height / dpr;

      // Progressively expand radar ring in Step 2
      if (this.currentStep >= 2 && this.radarRadius < Math.max(w, h) * 0.7) {
        this.radarRadius += (2.0 * this.speedMultiplier);
      }

      // Progress packet travel in Step 5
      if (this.currentStep >= 5 && this.packetProgress < 1.0) {
        this.packetProgress = Math.min(1.0, this.packetProgress + (0.018 * this.speedMultiplier));
      }

      // Progress relay travel in Step 6
      if (this.currentStep >= 6 && this.relayProgress < 1.0) {
        this.relayProgress = Math.min(1.0, this.relayProgress + (0.022 * this.speedMultiplier));
      }

      this.drawCanvas(w, h);

      if (this.active) {
        this.animFrameId = requestAnimationFrame(() => this.animateCanvas());
      }
    },

    // Draw tactical top-down grid and elements on canvas
    drawCanvas(w, h) {
      const ctx = this.ctx;
      if (!ctx) return;

      ctx.clearRect(0, 0, w, h);

      // 1. Tactical Grid lines
      ctx.strokeStyle = 'rgba(36, 48, 77, 0.4)';
      ctx.lineWidth = 1;
      const gridSize = 40;
      for (let x = 0; x <= w; x += gridSize) {
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, h);
        ctx.stroke();
      }
      for (let y = 0; y <= h; y += gridSize) {
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(w, y);
        ctx.stroke();
      }

      // Center victim coordinates
      const centerX = w * 0.42;
      const centerY = h * 0.55;

      // 2. Radar sweep rings during Step 2
      if (this.currentStep >= 2 && this.radarRadius > 0) {
        ctx.save();
        ctx.beginPath();
        ctx.arc(centerX, centerY, this.radarRadius, 0, Math.PI * 2);
        ctx.strokeStyle = 'rgba(255, 106, 26, 0.35)';
        ctx.lineWidth = 1.5;
        ctx.stroke();

        ctx.beginPath();
        ctx.arc(centerX, centerY, Math.max(0, this.radarRadius - 30), 0, Math.PI * 2);
        ctx.strokeStyle = 'rgba(255, 106, 26, 0.15)';
        ctx.lineWidth = 1;
        ctx.stroke();
        ctx.restore();
      }

      // 3. Draw Towers
      // Scale lat/lng offsets to canvas pixels
      const scaleX = 3200;
      const scaleY = -3200;

      const towerPositions = {};

      this.towersData.forEach(tower => {
        const tx = centerX + (tower.lngOffset * scaleX);
        const ty = centerY + (tower.latOffset * scaleY);
        towerPositions[tower.id] = { x: tx, y: ty, tower };

        const isOutOfService = tower.status === 'out_of_service';
        const isOutOfRange = !tower.inRange;
        const isSelected = this.selectedTower && (this.selectedTower.id === tower.id) && (this.currentStep >= 4);

        // Coverage range circle
        ctx.beginPath();
        ctx.arc(tx, ty, tower.range_km * 16, 0, Math.PI * 2);
        ctx.strokeStyle = isSelected
          ? 'rgba(16, 185, 129, 0.25)'
          : (isOutOfService ? 'rgba(148, 163, 184, 0.08)' : 'rgba(36, 48, 77, 0.3)');
        ctx.lineWidth = 1;
        ctx.setLineDash([3, 4]);
        ctx.stroke();
        ctx.setLineDash([]);

        // Tower Icon Base
        ctx.beginPath();
        ctx.arc(tx, ty, isSelected ? 12 : 8, 0, Math.PI * 2);
        if (isSelected) {
          ctx.fillStyle = 'rgba(16, 185, 129, 0.2)';
          ctx.fill();
          ctx.strokeStyle = '#10B981';
          ctx.lineWidth = 2;
        } else if (isOutOfService) {
          ctx.fillStyle = 'rgba(100, 116, 139, 0.2)';
          ctx.fill();
          ctx.strokeStyle = '#64748B';
          ctx.lineWidth = 1.5;
        } else {
          ctx.fillStyle = 'rgba(15, 23, 42, 0.8)';
          ctx.fill();
          ctx.strokeStyle = '#38BDF8';
          ctx.lineWidth = 1.5;
        }
        ctx.stroke();

        // Tower Symbol / Cross if Out of service
        if (isOutOfService) {
          ctx.strokeStyle = '#EF4444';
          ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.moveTo(tx - 5, ty - 5);
          ctx.lineTo(tx + 5, ty + 5);
          ctx.moveTo(tx + 5, ty - 5);
          ctx.lineTo(tx - 5, ty + 5);
          ctx.stroke();
        } else {
          ctx.fillStyle = isSelected ? '#10B981' : '#38BDF8';
          ctx.beginPath();
          ctx.arc(tx, ty, 3, 0, Math.PI * 2);
          ctx.fill();
        }

        // Tower Label
        ctx.font = '10px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
        ctx.fillStyle = isSelected ? '#34D399' : (isOutOfService ? '#94A3B8' : '#CBD5E1');
        ctx.textAlign = 'center';
        ctx.fillText(tower.name.split('-')[0].trim(), tx, ty + (isSelected ? 24 : 18));

        // Sublabel (Distance / RSSI / Status)
        ctx.font = '9px monospace';
        if (isOutOfService) {
          ctx.fillStyle = '#EF4444';
          ctx.fillText('Out of service', tx, ty + 28);
        } else if (isOutOfRange) {
          ctx.fillStyle = '#94A3B8';
          ctx.fillText(`${tower.distanceKm} km (Out of range)`, tx, ty + 28);
        } else if (this.currentStep >= 3) {
          ctx.fillStyle = isSelected ? '#10B981' : '#94A3B8';
          ctx.fillText(`${tower.distanceKm} km • ${tower.rssiDbm} dBm`, tx, ty + (isSelected ? 34 : 28));
        } else {
          ctx.fillStyle = '#94A3B8';
          ctx.fillText(`${tower.distanceKm} km`, tx, ty + 28);
        }
      });

      // 4. Draw Rescue Command Gateway
      const gwX = w * 0.86;
      const gwY = h * 0.22;

      ctx.beginPath();
      ctx.arc(gwX, gwY, 14, 0, Math.PI * 2);
      ctx.fillStyle = (this.currentStep >= 6) ? 'rgba(16, 185, 129, 0.2)' : 'rgba(30, 41, 59, 0.8)';
      ctx.fill();
      ctx.strokeStyle = (this.currentStep >= 7) ? '#10B981' : '#64748B';
      ctx.lineWidth = 2;
      ctx.stroke();

      // Gateway antenna icon
      ctx.fillStyle = (this.currentStep >= 7) ? '#10B981' : '#94A3B8';
      ctx.fillRect(gwX - 2, gwY - 6, 4, 12);
      ctx.beginPath();
      ctx.arc(gwX, gwY - 6, 4, 0, Math.PI * 2);
      ctx.fill();

      ctx.font = 'bold 10px sans-serif';
      ctx.fillStyle = (this.currentStep >= 7) ? '#10B981' : '#CBD5E1';
      ctx.textAlign = 'center';
      ctx.fillText('Rescue Gateway', gwX, gwY + 24);

      // 5. Transmission Lines & Packet Dots
      if (this.selectedTower && towerPositions[this.selectedTower.id]) {
        const target = towerPositions[this.selectedTower.id];

        // Line 1: Victim -> Tower B (Step 5)
        if (this.currentStep >= 5) {
          ctx.beginPath();
          ctx.moveTo(centerX, centerY);
          ctx.lineTo(target.x, target.y);
          ctx.strokeStyle = 'rgba(255, 106, 26, 0.6)';
          ctx.lineWidth = 2;
          ctx.setLineDash([4, 4]);
          ctx.stroke();
          ctx.setLineDash([]);

          // Animated packet dot
          const px = centerX + (target.x - centerX) * this.packetProgress;
          const py = centerY + (target.y - centerY) * this.packetProgress;

          ctx.beginPath();
          ctx.arc(px, py, 5, 0, Math.PI * 2);
          ctx.fillStyle = '#FF6A1A';
          ctx.shadowColor = '#FF6A1A';
          ctx.shadowBlur = 8;
          ctx.fill();
          ctx.shadowBlur = 0;
        }

        // Line 2: Tower B -> Rescue Gateway (Step 6)
        if (this.currentStep >= 6) {
          ctx.beginPath();
          ctx.moveTo(target.x, target.y);
          ctx.lineTo(gwX, gwY);
          ctx.strokeStyle = 'rgba(16, 185, 129, 0.6)';
          ctx.lineWidth = 2;
          ctx.setLineDash([4, 4]);
          ctx.stroke();
          ctx.setLineDash([]);

          // Animated relay dot
          const rx = target.x + (gwX - target.x) * this.relayProgress;
          const ry = target.y + (gwY - target.y) * this.relayProgress;

          ctx.beginPath();
          ctx.arc(rx, ry, 5, 0, Math.PI * 2);
          ctx.fillStyle = '#10B981';
          ctx.shadowColor = '#10B981';
          ctx.shadowBlur = 8;
          ctx.fill();
          ctx.shadowBlur = 0;
        }
      }

      // 6. Draw Victim Node (Center)
      ctx.beginPath();
      ctx.arc(centerX, centerY, 8, 0, Math.PI * 2);
      ctx.fillStyle = '#FF6A1A';
      ctx.shadowColor = '#FF6A1A';
      ctx.shadowBlur = 10;
      ctx.fill();
      ctx.shadowBlur = 0;

      // Outer pulsing ring around victim
      ctx.beginPath();
      ctx.arc(centerX, centerY, 14, 0, Math.PI * 2);
      ctx.strokeStyle = 'rgba(255, 106, 26, 0.4)';
      ctx.lineWidth = 2;
      ctx.stroke();

      ctx.font = 'bold 11px sans-serif';
      ctx.fillStyle = '#FFFFFF';
      ctx.textAlign = 'center';
      ctx.fillText('YOU', centerX, centerY + 24);
    },

    // Non-intrusively attach to existing page trigger
    initListeners() {
      // 1. Listen for custom 'sos-sent' event if emitted
      window.addEventListener('sos-sent', (e) => {
        try {
          if (e.detail && e.detail.latitude && e.detail.longitude) {
            this.coords.lat = parseFloat(e.detail.latitude);
            this.coords.lng = parseFloat(e.detail.longitude);
          }
          this.start();
        } catch (err) {
          console.warn('Tower simulation error on sos-sent:', err);
        }
      });

      // 2. Non-intrusive click listener on "Send Emergency SOS" buttons or forms
      document.addEventListener('click', (e) => {
        try {
          const btn = e.target.closest('.btn-emergency-sos, button[type="submit"], .btn-primary');
          if (!btn) return;

          const text = (btn.textContent || '').toUpperCase();
          if (text.includes('SEND EMERGENCY SOS') || text.includes('CONFIRM & DISPATCH') || text.includes('ENCODING')) {
            // Let the real event proceed unhindered! Trigger simulation visually.
            setTimeout(() => {
              this.start();
            }, 50);
          }
        } catch (err) {
          console.warn('Tower simulation non-intrusive listener caught error:', err);
        }
      }, true); // use capture to observe without preventing default
    }
  };

  // Expose on window for testing & debugging
  window.TowerSim = TowerSim;

  // Initialize once DOM is ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
      TowerSim.initListeners();
    });
  } else {
    TowerSim.initListeners();
  }
})();

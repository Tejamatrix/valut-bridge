// ==UserScript==
// @name         BulletScalp Pro v4.0 - Universal Auto-Tracker & Precision Scalper
// @namespace    http://tampermonkey.net/
// @version      4.0.0
// @description  Precision live trading assistant for Olymp Trade, Groww, Quotex & Pocket Option. Auto-detects changing live prices, features 1-click Target Lock, and high-accuracy entry timing.
// @author       BulletScalp
// @match        *://*.olymptrade.com/*
// @match        *://olymptrade.com/*
// @match        *://*.groww.in/*
// @match        *://groww.in/*
// @match        *://kite.zerodha.com/*
// @match        *://web.dhan.co/*
// @match        *://*.quotex.com/*
// @match        *://*.pocketoption.com/*
// @match        *://in.tradingview.com/*
// @match        *://*.tradingview.com/*
// @grant        none
// @run-at       document-start
// ==/UserScript==

(function () {
  'use strict';

  // Clean up any older instance
  if (window.__BULLETSCALP_INTERVAL__) clearInterval(window.__BULLETSCALP_INTERVAL__);
  if (window.__BULLETSCALP_CHANGE_INTERVAL__) clearInterval(window.__BULLETSCALP_CHANGE_INTERVAL__);
  const oldHud = document.getElementById("bullet-scalp-hud");
  if (oldHud) oldHud.remove();
  const oldBtn = document.getElementById("bullet-scalp-reopen-btn");
  if (oldBtn) oldBtn.remove();

  const host = window.location.hostname.toLowerCase();
  const isOlymp = host.includes("olymptrade") || host.includes("quotex") || host.includes("pocketoption");

  console.log("%c[BulletScalp Pro v4.0] Universal Precision Engine Loaded", "color: #00ff88; font-weight: bold; font-size: 14px;");

  const state = {
    isOlymp: isOlymp,
    symbol: isOlymp ? "DETECTING..." : "NIFTY 50",
    currentPrice: 0.0,
    lockedElement: null, // Point & Lock element reference
    isPicking: false,
    ticks: [],
    candles: [],
    timeframeSec: isOlymp ? 30 : 60,
    currentCandle: null,
    indicators: {
      rsiFast: 50,
      rsi14: 50,
      bbUpper: 0,
      bbLower: 0,
      bbMid: 0,
      momentum: 0
    },
    signal: {
      action: "HOLD",
      confidence: 0,
      simpleAdvice: "WAITING FOR PRICE TICKS...",
      simpleReason: "Move your chart or click [🎯 PICK PRICE] if price doesn't change."
    },
    soundEnabled: true,
    lastAlertAction: null
  };

  // --- Dynamic Value Tracker (Finds whatever number changes every second on screen) ---
  const elementHistory = new Map();

  function trackChangingElements() {
    if (state.lockedElement && document.body.contains(state.lockedElement)) {
      const clean = (state.lockedElement.innerText || '').replace(/[^0-9.]/g, '');
      const val = parseFloat(clean);
      if (!isNaN(val) && val > 0.0001) {
        handleNewPrice(val);
        return;
      }
    }

    // Inspect elements on page
    const candidates = document.querySelectorAll('span, div, p, b, strong, button');
    for (const el of candidates) {
      if (el.id === 'bullet-scalp-hud' || el.closest('#bullet-scalp-hud')) continue;
      
      const txt = (el.innerText || '').trim();
      if (txt.length >= 3 && txt.length <= 15 && /[0-9]+\.[0-9]{2,5}/.test(txt)) {
        const clean = txt.replace(/[^0-9.]/g, '');
        const val = parseFloat(clean);
        if (!isNaN(val) && val > 0.0001 && val < 500000) {
          const oldVal = elementHistory.get(el);
          if (oldVal !== undefined && oldVal !== val) {
            // This element just changed live on screen! That is the price!
            state.lockedElement = el;
            handleNewPrice(val);
            return;
          }
          elementHistory.set(el, val);
          if (elementHistory.size > 200) {
            const first = elementHistory.keys().next().value;
            elementHistory.delete(first);
          }
        }
      }
    }

    // Static fallback selectors
    const staticSelectors = [
      '[data-test="chart-legend-price"]',
      '.chart-legend__price',
      '.current-price',
      '.deal-form__price',
      '[class*="quoteValue"]',
      '[class*="chartLegendPrice"]',
      '.tv-symbol-price-quote__value',
      '.fs24',
      '.priceText',
      '.last-price'
    ];

    for (const sel of staticSelectors) {
      const el = document.querySelector(sel);
      if (el && el.innerText) {
        const clean = el.innerText.replace(/[^0-9.]/g, '');
        const val = parseFloat(clean);
        if (!isNaN(val) && val > 0.0001) {
          handleNewPrice(val);
          break;
        }
      }
    }
  }

  window.__BULLETSCALP_INTERVAL__ = setInterval(trackChangingElements, 100);

  // Auto-detect Asset Name
  function detectAsset() {
    const symSelectors = [
      '[data-test="asset-name"]',
      '.asset-select__name',
      '.chart-legend__asset',
      '[class*="assetName"]',
      'button[class*="asset"]',
      'h1',
      '.company-name',
      '.tradingsymbol',
      '[data-symbol-short]'
    ];
    for (const sel of symSelectors) {
      const el = document.querySelector(sel);
      if (el && el.innerText && el.innerText.trim().length > 1) {
        const t = el.innerText.trim().toUpperCase();
        if (!t.includes("EXPLORE") && !t.includes("STOCKS") && t.length < 25) {
          if (t !== state.symbol) {
            state.symbol = t;
            const b = document.getElementById("hud-symbol-badge");
            if (b) b.innerText = t.substring(0, 14);
            break;
          }
        }
      }
    }
  }
  setInterval(detectAsset, 1000);

  // --- Processing Engine ---
  function handleNewPrice(price) {
    if (isNaN(price) || price <= 0) return;
    if (price === state.currentPrice && Date.now() - state.ticks[state.ticks.length - 1]?.t < 500) return;

    state.previousPrice = state.currentPrice || price;
    state.currentPrice = price;
    const now = Date.now();

    state.ticks.push({ p: price, t: now });
    if (state.ticks.length > 500) state.ticks.shift();

    updateCandles(price, now);
    computeIndicators();
    evaluateSignal();
    renderHUD();
  }

  function updateCandles(price, now) {
    const bucket = Math.floor(now / (state.timeframeSec * 1000)) * (state.timeframeSec * 1000);
    if (!state.currentCandle || state.currentCandle.t !== bucket) {
      if (state.currentCandle) {
        state.candles.push(state.currentCandle);
        if (state.candles.length > 150) state.candles.shift();
      }
      state.currentCandle = { t: bucket, o: price, h: price, l: price, c: price, v: 1 };
    } else {
      state.currentCandle.h = Math.max(state.currentCandle.h, price);
      state.currentCandle.l = Math.min(state.currentCandle.l, price);
      state.currentCandle.c = price;
      state.currentCandle.v += 1;
    }
  }

  function computeIndicators() {
    const closes = state.candles.map(c => c.c);
    if (state.currentCandle) closes.push(state.currentCandle.c);
    if (closes.length < 3) return;

    state.indicators.rsiFast = calculateRSI(closes, Math.min(6, closes.length - 1));
    state.indicators.rsi14 = calculateRSI(closes, Math.min(14, closes.length - 1));

    const bb = calculateBollingerBands(closes, Math.min(20, closes.length));
    state.indicators.bbUpper = bb.upper;
    state.indicators.bbLower = bb.lower;
    state.indicators.bbMid = bb.mid;

    if (state.ticks.length >= 3) {
      const past = state.ticks[state.ticks.length - 3].p;
      state.indicators.momentum = ((state.currentPrice - past) / past) * 10000;
    }
  }

  function calculateRSI(data, period) {
    if (data.length <= period) return 50;
    let gains = 0, losses = 0;
    for (let i = data.length - period; i < data.length; i++) {
      const diff = data[i] - data[i - 1];
      if (diff >= 0) gains += diff;
      else losses -= diff;
    }
    if (losses === 0) return 100;
    const rs = (gains / period) / (losses / period);
    return Math.round(100 - (100 / (1 + rs)));
  }

  function calculateBollingerBands(data, period) {
    const slice = data.slice(-period);
    const mean = slice.reduce((a, b) => a + b, 0) / slice.length;
    const variance = slice.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / slice.length;
    const stdDev = Math.sqrt(variance);
    return { mid: mean, upper: mean + (2.0 * stdDev), lower: mean - (2.0 * stdDev) };
  }

  // --- High-Accuracy Olymp Trade & Stock Scalping Strategy ---
  function evaluateSignal() {
    const { rsiFast, rsi14, bbUpper, bbLower, momentum } = state.indicators;
    const price = state.currentPrice;
    const cur = state.currentCandle;

    let upPoints = 0;
    let downPoints = 0;
    const upReasons = [];
    const downReasons = [];

    // Condition 1: Extreme RSI Oversold / Overbought
    if (rsiFast <= 20) {
      upPoints += 40;
      upReasons.push("Price dropped to an extreme bottom. High chance to bounce UP.");
    } else if (rsiFast >= 80) {
      downPoints += 40;
      downReasons.push("Price climbed to an extreme peak. High chance to fall DOWN.");
    }

    // Condition 2: Bollinger Band Piercing
    if (bbLower > 0 && price <= bbLower) {
      upPoints += 30;
      upReasons.push("Price pierced outside the bottom band. Reversal UP expected.");
    } else if (bbUpper > 0 && price >= bbUpper) {
      downPoints += 30;
      downReasons.push("Price pierced outside the top band. Reversal DOWN expected.");
    }

    // Condition 3: Rejection Wicks (Pinbar absorption)
    if (cur) {
      const body = Math.abs(cur.c - cur.o);
      const lowerWick = Math.min(cur.o, cur.c) - cur.l;
      const upperWick = cur.h - Math.max(cur.o, cur.c);
      if (lowerWick > body * 1.5 && lowerWick > 0.00005) {
        upPoints += 25;
        upReasons.push("Big buyers rejected the drop. Bottom wick formed.");
      }
      if (upperWick > body * 1.5 && upperWick > 0.00005) {
        downPoints += 25;
        downReasons.push("Big sellers capped the rally. Top wick formed.");
      }
    }

    // Condition 4: Immediate Tick Momentum
    if (momentum > 1.0) {
      upPoints += 15;
    } else if (momentum < -1.0) {
      downPoints += 15;
    }

    let action = "HOLD";
    let confidence = 0;
    let simpleAdvice = "";
    let simpleReason = "";

    // High Threshold (70 Points) for strict precision
    if (upPoints >= 70 && upPoints > downPoints + 30) {
      action = "BUY";
      confidence = Math.min(95, Math.round(upPoints));
      simpleAdvice = state.isOlymp ? "👉 ENTER UP (CALL / GREEN) NOW" : "👉 BUY CE (CALL) / GO LONG";
      simpleReason = upReasons.join(" • ");
    } else if (downPoints >= 70 && downPoints > upPoints + 30) {
      action = "SELL";
      confidence = Math.min(95, Math.round(downPoints));
      simpleAdvice = state.isOlymp ? "👉 ENTER DOWN (PUT / RED) NOW" : "👉 BUY PE (PUT) / GO SHORT";
      simpleReason = downReasons.join(" • ");
    } else {
      action = "HOLD";
      confidence = 0;
      simpleAdvice = "DO NOT TRADE! WAIT.";
      simpleReason = "Market is in sideways chop or in the middle of a range. Wait for price to touch an extreme top or bottom.";
    }

    state.signal = { action, confidence, simpleAdvice, simpleReason };

    if (action !== "HOLD" && confidence >= 75 && state.lastAlertAction !== action) {
      playChime(action);
      state.lastAlertAction = action;
    } else if (action === "HOLD") {
      state.lastAlertAction = null;
    }
  }

  function playChime(action) {
    if (!state.soundEnabled) return;
    try {
      const ctx = new (window.AudioContext || window.webkitAudioContext)();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      const now = ctx.currentTime;
      if (action === "BUY") {
        osc.frequency.setValueAtTime(880, now);
        osc.frequency.exponentialRampToValueAtTime(1174.66, now + 0.18);
      } else {
        osc.frequency.setValueAtTime(740, now);
        osc.frequency.exponentialRampToValueAtTime(523.25, now + 0.22);
      }
      gain.gain.setValueAtTime(0.2, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.35);
      osc.start(now);
      osc.stop(now + 0.35);
    } catch (e) {}
  }

  // --- Interactive "Click-To-Lock" Target Feature ---
  function startPricePicker() {
    state.isPicking = true;
    const overlay = document.createElement("div");
    overlay.id = "bullet-picker-overlay";
    overlay.style.cssText = `
      position: fixed;
      top: 0; left: 0; width: 100vw; height: 100vh;
      background: rgba(0, 255, 136, 0.08);
      cursor: crosshair;
      z-index: 9999999999;
      display: flex;
      justify-content: center;
      align-items: center;
      color: #ffffff;
      font-size: 16px;
      font-weight: 800;
      text-shadow: 0 2px 8px rgba(0,0,0,0.8);
      pointer-events: auto;
    `;
    overlay.innerHTML = `<div style="background:#0f172a; border:2px solid #00ff88; padding:12px 20px; border-radius:10px;">🎯 CLICK DIRECTLY ON THE LIVE PRICE ON YOUR CHART TO LOCK IT!</div>`;

    function onOverlayClick(e) {
      overlay.remove();
      state.isPicking = false;

      // Find element right under click
      const el = document.elementFromPoint(e.clientX, e.clientY);
      if (el) {
        state.lockedElement = el;
        el.style.outline = "2px solid #00ff88";
        const clean = (el.innerText || '').replace(/[^0-9.]/g, '');
        const val = parseFloat(clean);
        if (!isNaN(val) && val > 0) handleNewPrice(val);
      }
      document.removeEventListener('click', onOverlayClick, true);
    }

    setTimeout(() => {
      document.addEventListener('click', onOverlayClick, true);
    }, 100);

    document.body.appendChild(overlay);
  }

  // --- Clean User-Friendly HUD ---
  function createHUD() {
    const hud = document.createElement("div");
    hud.id = "bullet-scalp-hud";
    hud.style.cssText = `
      position: fixed;
      top: 70px;
      right: 25px;
      width: 330px;
      background: rgba(15, 20, 28, 0.98);
      border: 1.5px solid #00ff88;
      border-radius: 12px;
      box-shadow: 0 12px 40px rgba(0, 0, 0, 0.9), 0 0 18px rgba(0, 255, 136, 0.25);
      backdrop-filter: blur(12px);
      color: #ffffff;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      z-index: 999999999;
      user-select: none;
      overflow: hidden;
    `;

    hud.innerHTML = `
      <div id="hud-drag-header" style="
        background: #1a2230;
        padding: 10px 14px;
        display: flex;
        justify-content: space-between;
        align-items: center;
        border-bottom: 1px solid rgba(255,255,255,0.1);
        cursor: grab;
      ">
        <div style="display: flex; align-items: center; gap: 8px;">
          <span style="display:inline-block; width:9px; height:9px; border-radius:50%; background:#00ff88; box-shadow:0 0 8px #00ff88;"></span>
          <span style="font-weight: 800; font-size: 13px; color: #00ff88;">PRECISION SCALPER</span>
          <span id="hud-symbol-badge" style="font-size: 10px; background: rgba(0,255,136,0.18); color: #00ff88; padding: 2px 6px; border-radius: 4px; font-weight: 700;">${state.symbol}</span>
        </div>
        <div style="display: flex; gap: 8px; align-items: center;">
          <button id="hud-pick-btn" title="Click to manually lock onto live price" style="background:#0284c7; border:none; color:#fff; cursor:pointer; font-size:10px; padding:3px 6px; border-radius:4px; font-weight:700;">🎯 LOCK</button>
          <button id="hud-sound-btn" style="background:#263142; border:none; color:#c9d1d9; cursor:pointer; font-size:10px; padding:3px 6px; border-radius:4px;">SND</button>
          <button id="hud-close-btn" title="Close" style="background:#dc2626; border:none; color:#ffffff; cursor:pointer; font-size:13px; font-weight:bold; width:22px; height:22px; border-radius:50%; display:flex; align-items:center; justify-content:center; line-height:1;">X</button>
        </div>
      </div>

      <div id="hud-body" style="padding: 14px;">
        
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px;">
          <div>
            <div style="font-size: 10px; text-transform: uppercase; color: #94a3b8; font-weight: 700;">DETECTED LIVE PRICE:</div>
            <div id="hud-price" style="font-size: 22px; font-weight: 900; color: #ffffff; font-family: monospace;">--.--</div>
          </div>
          <div>
            <select id="hud-tf-select" style="
              background: #1e293b;
              border: 1px solid #475569;
              color: #f1f5f9;
              font-size: 11px;
              padding: 5px 8px;
              border-radius: 6px;
              cursor: pointer;
              font-weight: 600;
            ">
              <option value="15" ${state.timeframeSec === 15 ? "selected" : ""}>15s Scalp</option>
              <option value="30" ${state.timeframeSec === 30 ? "selected" : ""}>30s Scalp</option>
              <option value="60" ${state.timeframeSec === 60 ? "selected" : ""}>1m Normal</option>
              <option value="300" ${state.timeframeSec === 300 ? "selected" : ""}>5m Trend</option>
            </select>
          </div>
        </div>

        <div id="hud-signal-box" style="
          background: rgba(234, 179, 8, 0.16);
          border: 1.5px solid #eab308;
          border-radius: 8px;
          padding: 12px;
          text-align: center;
          margin-bottom: 12px;
        ">
          <div style="font-size: 10px; font-weight: 700; text-transform: uppercase; color: #cbd5e1; margin-bottom: 4px;">
            WHAT TO DO RIGHT NOW:
          </div>
          <div id="hud-action-text" style="font-size: 17px; font-weight: 900; color: #eab308; letter-spacing: 0.5px;">
            DO NOT TRADE! WAIT.
          </div>
          <div id="hud-confidence-text" style="margin-top: 4px; font-size: 11px; color: #94a3b8; font-weight: 600;">
            Confidence: 0% (Searching for safe setup)
          </div>
        </div>

        <div style="background: #16202c; border: 1px solid #283548; border-radius: 8px; padding: 12px; margin-bottom: 10px;">
          <div style="font-size: 11px; font-weight: 800; color: #00ff88; text-transform: uppercase; margin-bottom: 4px;">
            WHY (SIMPLE EXPLANATION):
          </div>
          <div id="hud-simple-reason" style="font-size: 12px; line-height: 1.5; color: #e2e8f0;">
            Waiting for live price movement to detect direction...
          </div>
        </div>

        <div style="display: flex; justify-content: space-between; font-size: 10px; color: #64748b;">
          <span>Hold top bar to drag</span>
          <span style="color:#0284c7; cursor:pointer;" onclick="document.getElementById('hud-pick-btn').click();">Click [🎯 LOCK] if price stops</span>
        </div>

      </div>
    `;

    document.body.appendChild(hud);
    makeDraggable(hud, document.getElementById("hud-drag-header"));

    document.getElementById("hud-pick-btn").addEventListener("click", startPricePicker);

    document.getElementById("hud-tf-select").addEventListener("change", (e) => {
      state.timeframeSec = parseInt(e.target.value);
      state.candles = [];
      state.currentCandle = null;
    });

    document.getElementById("hud-sound-btn").addEventListener("click", () => {
      state.soundEnabled = !state.soundEnabled;
      document.getElementById("hud-sound-btn").innerText = state.soundEnabled ? "SND" : "MUTED";
      document.getElementById("hud-sound-btn").style.background = state.soundEnabled ? "#263142" : "#334155";
    });

    document.getElementById("hud-close-btn").addEventListener("click", () => {
      hud.remove();
      createReopenPill();
    });
  }

  function createReopenPill() {
    const pill = document.createElement("button");
    pill.id = "bullet-scalp-reopen-btn";
    pill.style.cssText = `
      position: fixed;
      bottom: 25px;
      right: 25px;
      background: #0f172a;
      border: 1.5px solid #00ff88;
      color: #00ff88;
      font-size: 11px;
      font-weight: 800;
      padding: 8px 14px;
      border-radius: 30px;
      box-shadow: 0 4px 15px rgba(0, 0, 0, 0.5);
      cursor: pointer;
      z-index: 999999999;
      font-family: sans-serif;
    `;
    pill.innerText = "OPEN ASSISTANT";
    pill.onclick = () => {
      pill.remove();
      createHUD();
    };
    document.body.appendChild(pill);
  }

  function renderHUD() {
    const priceEl = document.getElementById("hud-price");
    if (!priceEl) return;

    const numDecimals = state.currentPrice < 10 ? 5 : 2;
    priceEl.innerText = state.currentPrice.toFixed(numDecimals);

    const box = document.getElementById("hud-signal-box");
    const actText = document.getElementById("hud-action-text");
    const confText = document.getElementById("hud-confidence-text");
    const reasonText = document.getElementById("hud-simple-reason");

    actText.innerText = state.signal.simpleAdvice;
    confText.innerText = state.signal.confidence > 0 ? `Confidence: ${state.signal.confidence}% (High Edge)` : "Confidence: 0% (Searching for safe setup)";
    reasonText.innerText = state.signal.simpleReason;

    if (state.signal.action === "BUY") {
      actText.style.color = "#00ff88";
      box.style.background = "rgba(0, 255, 136, 0.16)";
      box.style.border = "1.5px solid #00ff88";
      box.style.boxShadow = "0 0 15px rgba(0, 255, 136, 0.35)";
    } else if (state.signal.action === "SELL") {
      actText.style.color = "#ef4444";
      box.style.background = "rgba(239, 68, 68, 0.16)";
      box.style.border = "1.5px solid #ef4444";
      box.style.boxShadow = "0 0 15px rgba(239, 68, 68, 0.35)";
    } else {
      actText.style.color = "#eab308";
      box.style.background = "rgba(234, 179, 8, 0.16)";
      box.style.border = "1.5px solid #eab308";
      box.style.boxShadow = "none";
    }
  }

  function makeDraggable(element, handle) {
    let posX = 0, posY = 0, mouseX = 0, mouseY = 0;
    handle.onmousedown = dragMouseDown;

    function dragMouseDown(e) {
      e.preventDefault();
      mouseX = e.clientX;
      mouseY = e.clientY;
      document.onmouseup = closeDragElement;
      document.onmousemove = elementDrag;
    }

    function elementDrag(e) {
      e.preventDefault();
      posX = mouseX - e.clientX;
      posY = mouseY - e.clientY;
      mouseX = e.clientX;
      mouseY = e.clientY;
      element.style.top = (element.offsetTop - posY) + "px";
      element.style.left = (element.offsetLeft - posX) + "px";
      element.style.right = "auto";
    }

    function closeDragElement() {
      document.onmouseup = null;
      document.onmousemove = null;
    }
  }

  createHUD();

})();

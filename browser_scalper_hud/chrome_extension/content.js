/**
 * BulletScalp Pro Live HUD - Version 2.0 (Indian Stock Market & F&O + Global)
 * Built for Zerodha Kite, Groww, Dhan, Angel One, Upstox, Fyers, and TradingView.
 * Provides real-time BUY CE (Call), BUY PE (Put), or AVOID/HOLD with Target, Stop-Loss, and Explanations.
 */

(function () {
  'use strict';

  if (window.__BULLETSCALP_LOADED__) return;
  window.__BULLETSCALP_LOADED__ = true;

  console.log("%c[BulletScalp Pro v2.0] Indian Stock & F&O Engine Loaded", "color: #00ff88; font-weight: bold; font-size: 14px;");

  const state = {
    symbol: "DETECTING...",
    currentPrice: 0.0,
    previousPrice: 0.0,
    dayHigh: 0.0,
    dayLow: 0.0,
    lastTickTime: Date.now(),
    ticks: [],
    candles: [],
    timeframeSec: 60, // Default 1-minute (standard Indian intraday scalping)
    currentCandle: null,
    indicators: {
      vwap: 0.0,
      ema9: 0.0,
      ema21: 0.0,
      rsi14: 50,
      rsiFast: 50,
      bbUpper: 0.0,
      bbLower: 0.0,
      bbMid: 0.0,
      momentumBps: 0.0
    },
    signal: {
      action: "HOLD",   // "BUY_CE", "BUY_PE", "HOLD"
      confidence: 0,
      targetPrice: 0.0,
      stopLossPrice: 0.0,
      riskReward: "1:2",
      reasons: ["Scanning Indian broker market depth & ticks..."],
      timestamp: Date.now()
    },
    soundEnabled: true,
    lastAlertAction: null
  };

  // --- WebSocket Hook to capture broker data stream (JSON / Binary) ---
  const OriginalWebSocket = window.WebSocket;
  window.WebSocket = function (...args) {
    const ws = new OriginalWebSocket(...args);

    ws.addEventListener('message', function (event) {
      try {
        if (typeof event.data === 'string') {
          parseBrokerData(event.data);
        } else if (event.data instanceof ArrayBuffer) {
          // KiteTicker or binary stream
          parseBinaryTick(new DataView(event.data));
        }
      } catch (e) {}
    });

    return ws;
  };
  window.WebSocket.prototype = OriginalWebSocket.prototype;

  function parseBrokerData(raw) {
    if (!raw) return;
    try {
      if (raw.startsWith('[') || raw.startsWith('{')) {
        const parsed = JSON.parse(raw);
        extractPriceFromObj(parsed);
      }
    } catch (e) {
      const match = raw.match(/"(price|ltp|last_price|close)"\s*:\s*([0-9.]+)/i);
      if (match && match[2]) {
        handleNewPrice(parseFloat(match[2]));
      }
    }
  }

  function extractPriceFromObj(obj) {
    if (!obj) return;
    if (typeof obj === 'number') {
      if (obj > 0.5 && obj < 500000) handleNewPrice(obj);
      return;
    }
    if (Array.isArray(obj)) {
      for (const item of obj) {
        if (typeof item === 'object') extractPriceFromObj(item);
      }
    } else if (typeof obj === 'object') {
      const p = obj.ltp || obj.last_price || obj.price || obj.close || obj.rate;
      if (typeof p === 'number' && p > 0) {
        handleNewPrice(p);
      } else {
        for (const k in obj) {
          if (typeof obj[k] === 'object') extractPriceFromObj(obj[k]);
        }
      }
    }
  }

  function parseBinaryTick(view) {
    try {
      // Zerodha KiteTicker packet inspection: packets of 8, 28, 32, or 184 bytes
      if (view.byteLength >= 8) {
        const numPackets = view.getInt16(0);
        if (numPackets > 0 && numPackets < 100) {
          let offset = 2;
          for (let i = 0; i < numPackets; i++) {
            if (offset + 8 > view.byteLength) break;
            const length = view.getInt16(offset);
            offset += 2;
            if (length >= 8) {
              const token = view.getInt32(offset);
              const ltp = view.getInt32(offset + 4) / 100.0;
              if (ltp > 0.5 && ltp < 500000) {
                handleNewPrice(ltp);
              }
            }
            offset += length;
          }
        }
      }
    } catch (e) {}
  }

  // --- High-Speed Indian Broker DOM Inspector (Zerodha, Groww, Dhan, Angel One, Upstox, TradingView) ---
  setInterval(() => {
    // 1. Symbol Detection
    detectSymbol();

    // 2. LTP (Last Traded Price) Detection
    const ltpSelectors = [
      // Zerodha Kite
      '.instrument.selected .last-price',
      '.header-right .last-price',
      '.orderbook .last-price',
      'span.last-price',
      '.stock-price .last-price',
      
      // Groww
      '.fs24.bold',
      '.cur-po .fs24',
      'span[class*="pricePrimary"]',
      'div[class*="pricePrimary"]',
      
      // Dhan
      '.price-text',
      '.company-price',
      '.ltp-val',
      '[class*="ltpText"]',
      
      // Upstox
      '.priceText',
      '.quote-ltp',
      '[data-testid*="ltp"]',
      
      // Angel One
      '.ltp',
      '.price',
      '[class*="ltp"]',
      
      // TradingView
      '.tv-symbol-price-quote__value',
      '.chart-legend__price',
      '.js-symbol-last'
    ];

    for (const sel of ltpSelectors) {
      const el = document.querySelector(sel);
      if (el && el.innerText) {
        const clean = el.innerText.replace(/[^0-9.]/g, '');
        const val = parseFloat(clean);
        if (!isNaN(val) && val > 0 && Math.abs(val - state.currentPrice) > 0.01) {
          handleNewPrice(val);
          break;
        }
      }
    }
  }, 100);

  function detectSymbol() {
    const symSelectors = [
      '.instrument.selected .tradingsymbol',
      '.header-left .tradingsymbol',
      '.chart-page .tradingsymbol',
      '.symbol-name',
      '.company-name',
      '[data-symbol-short]',
      'h1[class*="symbol"]',
      '.tv-symbol-header__title'
    ];

    for (const sel of symSelectors) {
      const el = document.querySelector(sel);
      if (el && el.innerText && el.innerText.trim().length > 1) {
        const sym = el.innerText.trim().toUpperCase();
        if (sym !== state.symbol && sym.length < 30) {
          state.symbol = sym;
          const badge = document.getElementById("hud-symbol-badge");
          if (badge) badge.innerText = sym;
          break;
        }
      }
    }
  }

  // --- Processing Engine ---
  function handleNewPrice(price) {
    if (isNaN(price) || price <= 0) return;
    state.previousPrice = state.currentPrice || price;
    state.currentPrice = price;

    if (state.dayHigh === 0 || price > state.dayHigh) state.dayHigh = price;
    if (state.dayLow === 0 || price < state.dayLow) state.dayLow = price;

    const now = Date.now();
    state.lastTickTime = now;

    state.ticks.push({ p: price, t: now });
    if (state.ticks.length > 600) state.ticks.shift();

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
    if (closes.length < 5) return;

    // 1. VWAP (Volume Weighted Average Price) approximation from candle highs, lows, closes
    let cumTypicalVol = 0, cumVol = 0;
    const allCandles = [...state.candles];
    if (state.currentCandle) allCandles.push(state.currentCandle);
    for (const c of allCandles) {
      const tp = (c.h + c.l + c.c) / 3.0;
      cumTypicalVol += tp * c.v;
      cumVol += c.v;
    }
    state.indicators.vwap = cumVol > 0 ? (cumTypicalVol / cumVol) : state.currentPrice;

    // 2. EMA 9 & EMA 21 (Indian Intraday Trend Ribbon)
    state.indicators.ema9 = calculateEMA(closes, 9);
    state.indicators.ema21 = calculateEMA(closes, 21);

    // 3. RSI 14 & Fast RSI 7
    state.indicators.rsi14 = calculateRSI(closes, Math.min(14, closes.length - 1));
    state.indicators.rsiFast = calculateRSI(closes, Math.min(7, closes.length - 1));

    // 4. Bollinger Bands (20, 2)
    const bb = calculateBollingerBands(closes, Math.min(20, closes.length));
    state.indicators.bbUpper = bb.upper;
    state.indicators.bbLower = bb.lower;
    state.indicators.bbMid = bb.mid;

    // 5. Micro-momentum
    if (state.ticks.length >= 6) {
      const past = state.ticks[state.ticks.length - 6].p;
      state.indicators.momentumBps = ((state.currentPrice - past) / past) * 10000;
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

  function calculateEMA(data, period) {
    if (data.length === 0) return 0;
    const k = 2 / (period + 1);
    let ema = data[0];
    for (let i = 1; i < data.length; i++) {
      ema = data[i] * k + ema * (1 - k);
    }
    return ema;
  }

  function calculateBollingerBands(data, period) {
    const slice = data.slice(-period);
    const mean = slice.reduce((a, b) => a + b, 0) / slice.length;
    const variance = slice.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / slice.length;
    const stdDev = Math.sqrt(variance);
    return {
      mid: mean,
      upper: mean + (2.0 * stdDev),
      lower: mean - (2.0 * stdDev)
    };
  }

  // --- Indian Stock & F&O Strategy Matrix ---
  function evaluateSignal() {
    const { vwap, ema9, ema21, rsi14, rsiFast, bbUpper, bbLower, momentumBps } = state.indicators;
    const price = state.currentPrice;
    const cur = state.currentCandle;

    let ceScore = 0; // Call / Long Score
    let peScore = 0; // Put / Short Score
    const ceReasons = [];
    const peReasons = [];

    // Factor 1: VWAP (The King of Indian Intraday)
    if (vwap > 0) {
      if (price > vwap) {
        ceScore += 30;
        ceReasons.push(`Price trading above VWAP (₹${vwap.toFixed(2)}) - Bullish Bias`);
      } else {
        peScore += 30;
        peReasons.push(`Price trading below VWAP (₹${vwap.toFixed(2)}) - Bearish Bias`);
      }
    }

    // Factor 2: EMA Ribbon Trend (EMA 9 vs EMA 21)
    if (ema9 > 0 && ema21 > 0) {
      if (ema9 > ema21 && price > ema9) {
        ceScore += 25;
        ceReasons.push(`Strong Bullish EMA ribbon alignment (EMA 9 > EMA 21)`);
      } else if (ema9 < ema21 && price < ema9) {
        peScore += 25;
        peReasons.push(`Strong Bearish EMA ribbon alignment (EMA 9 < EMA 21)`);
      }
    }

    // Factor 3: RSI Range Shift (Bull Zone 55-75 vs Bear Zone 25-45)
    if (rsi14 >= 55 && rsi14 <= 75) {
      ceScore += 20;
      ceReasons.push(`RSI in Bullish Momentum zone (${rsi14})`);
    } else if (rsi14 <= 45 && rsi14 >= 25) {
      peScore += 20;
      peReasons.push(`RSI in Bearish Breakdown zone (${rsi14})`);
    } else if (rsiFast <= 20) {
      ceScore += 25;
      ceReasons.push(`Fast RSI oversold exhaustion (${rsiFast}) - Reversal bounce ready`);
    } else if (rsiFast >= 80) {
      peScore += 25;
      peReasons.push(`Fast RSI overbought exhaustion (${rsiFast}) - Reversal drop ready`);
    }

    // Factor 4: Breakout & Candlestick Rejection
    if (cur) {
      const body = Math.abs(cur.c - cur.o);
      const lowerWick = Math.min(cur.o, cur.c) - cur.l;
      const upperWick = cur.h - Math.max(cur.o, cur.c);

      if (lowerWick > body * 1.5 && lowerWick > 0.1) {
        ceScore += 20;
        ceReasons.push("Strong bottom rejection hammer wick (buyers absorbing selling)");
      }
      if (upperWick > body * 1.5 && upperWick > 0.1) {
        peScore += 20;
        peReasons.push("Strong top exhaustion shooting star wick (sellers capping rally)");
      }
    }

    // Factor 5: Momentum Velocity
    if (momentumBps > 1.2) {
      ceScore += 15;
      ceReasons.push(`Positive price velocity surge (+${momentumBps.toFixed(1)} bps)`);
    } else if (momentumBps < -1.2) {
      peScore += 15;
      peReasons.push(`Negative price velocity breakdown (${momentumBps.toFixed(1)} bps)`);
    }

    // Thresholds & Option Buyer Protection
    const THRESHOLD = 65;
    let action = "HOLD";
    let confidence = 0;
    let reasons = [];
    let sl = 0.0, tp = 0.0;

    // Detect asset class to set realistic SL & TP (Nifty vs Bank Nifty vs Stocks)
    const isNifty = state.symbol.includes("NIFTY") && !state.symbol.includes("BANK");
    const isBankNifty = state.symbol.includes("BANK");

    let slDistance = price * 0.003; // Default 0.3%
    if (isNifty) slDistance = Math.max(15, price * 0.001); // 15-20 pts
    else if (isBankNifty) slDistance = Math.max(40, price * 0.0015); // 40-50 pts

    const tpDistance = slDistance * 2.0; // 1:2 Risk-Reward

    if (ceScore >= THRESHOLD && ceScore > peScore + 20) {
      action = "BUY_CE";
      confidence = Math.min(96, Math.round(ceScore));
      reasons = ceReasons;
      sl = price - slDistance;
      tp = price + tpDistance;
    } else if (peScore >= THRESHOLD && peScore > ceScore + 20) {
      action = "BUY_PE";
      confidence = Math.min(96, Math.round(peScore));
      reasons = peReasons;
      sl = price + slDistance;
      tp = price - tpDistance;
    } else {
      action = "HOLD";
      confidence = Math.round(Math.max(ceScore, peScore));
      reasons = [
        "Market in Sideways Chop / Consolidation zone.",
        "⛔ THETA DECAY WARNING: Avoid buying CE or PE right now (Option buyers lose money in chop)."
      ];
    }

    state.signal = {
      action,
      confidence,
      targetPrice: tp,
      stopLossPrice: sl,
      riskReward: "1:2",
      reasons,
      timestamp: Date.now()
    };

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
      if (action === "BUY_CE") {
        osc.frequency.setValueAtTime(880, now);
        osc.frequency.exponentialRampToValueAtTime(1174.66, now + 0.18);
      } else {
        osc.frequency.setValueAtTime(740, now);
        osc.frequency.exponentialRampToValueAtTime(523.25, now + 0.22);
      }

      gain.gain.setValueAtTime(0.25, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.35);

      osc.start(now);
      osc.stop(now + 0.35);
    } catch (e) {}
  }

  // --- Floating Modern HUD ---
  function createHUD() {
    const existing = document.getElementById("bullet-scalp-hud");
    if (existing) existing.remove();

    const hud = document.createElement("div");
    hud.id = "bullet-scalp-hud";
    hud.style.cssText = `
      position: fixed;
      top: 75px;
      right: 25px;
      width: 340px;
      background: rgba(13, 17, 23, 0.96);
      border: 1px solid rgba(0, 255, 136, 0.4);
      border-radius: 12px;
      box-shadow: 0 10px 35px rgba(0, 0, 0, 0.85), 0 0 15px rgba(0, 255, 136, 0.15);
      backdrop-filter: blur(12px);
      color: #e6edf3;
      font-family: 'Segoe UI', -apple-system, BlinkMacSystemFont, Roboto, monospace;
      z-index: 99999999;
      user-select: none;
      overflow: hidden;
      transition: border-color 0.3s ease;
    `;

    hud.innerHTML = `
      <!-- Header / Drag Handle -->
      <div id="hud-drag-header" style="
        background: linear-gradient(90deg, rgba(0,255,136,0.18), rgba(22,27,34,0.7));
        padding: 10px 14px;
        display: flex;
        justify-content: space-between;
        align-items: center;
        border-bottom: 1px solid rgba(255,255,255,0.08);
        cursor: grab;
      ">
        <div style="display: flex; align-items: center; gap: 8px;">
          <span style="display:inline-block; width:9px; height:9px; border-radius:50%; background:#00ff88; box-shadow:0 0 8px #00ff88;"></span>
          <span style="font-weight: 800; font-size: 13px; letter-spacing: 0.5px; color: #00ff88;">BULLETSCALP PRO</span>
          <span id="hud-symbol-badge" style="font-size: 10px; background: rgba(0,255,136,0.2); color: #00ff88; padding: 2px 6px; border-radius: 4px; font-weight: 700;">NIFTY / STOCK</span>
        </div>
        <div style="display: flex; gap: 8px; align-items: center;">
          <button id="hud-sound-btn" title="Toggle Sound" style="background:none; border:none; color:#8b949e; cursor:pointer; font-size:13px;">🔊</button>
          <button id="hud-min-btn" title="Minimize" style="background:none; border:none; color:#8b949e; cursor:pointer; font-size:15px; font-weight:bold;">−</button>
        </div>
      </div>

      <!-- Main Body -->
      <div id="hud-body" style="padding: 14px;">
        
        <!-- Live Price & Timeframe Selector -->
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px;">
          <div>
            <div style="font-size: 10px; text-transform: uppercase; color: #8b949e; font-weight: 600;">LIVE LAST TRADED PRICE (LTP)</div>
            <div id="hud-price" style="font-size: 22px; font-weight: 900; color: #ffffff; font-family: monospace;">₹--.----</div>
          </div>
          <div>
            <select id="hud-tf-select" style="
              background: #161b22;
              border: 1px solid #30363d;
              color: #c9d1d9;
              font-size: 11px;
              padding: 4px 8px;
              border-radius: 6px;
              cursor: pointer;
            ">
              <option value="60" selected>1m Intraday</option>
              <option value="180">3m Scalp</option>
              <option value="300">5m Standard</option>
              <option value="900">15m Trend</option>
              <option value="15">15s Micro</option>
            </select>
          </div>
        </div>

        <!-- Actionable Signal Box -->
        <div id="hud-signal-box" style="
          background: rgba(234, 179, 8, 0.15);
          border: 1px solid rgba(234, 179, 8, 0.4);
          border-radius: 8px;
          padding: 12px;
          text-align: center;
          margin-bottom: 12px;
          transition: all 0.25s ease;
        ">
          <div id="hud-signal-action" style="font-size: 18px; font-weight: 900; color: #eab308; letter-spacing: 0.5px;">
            HOLD / AVOID CHOP
          </div>
          <div style="margin-top: 4px; font-size: 11px; color: #8b949e;">
            Signal Confidence: <span id="hud-confidence" style="font-weight: 800; color: #ffffff;">0%</span>
          </div>
        </div>

        <!-- Target & Stop-Loss Box (For Indian Options & Equities) -->
        <div id="hud-levels-box" style="display: grid; grid-template-columns: 1fr 1fr; gap: 8px; margin-bottom: 12px; font-size: 11px;">
          <div style="background: rgba(0,255,136,0.1); border: 1px solid rgba(0,255,136,0.3); border-radius: 6px; padding: 6px 8px; text-align: center;">
            <div style="color: #00ff88; font-size: 9px; font-weight: 700; text-transform: uppercase;">Target (1:2 R:R)</div>
            <div id="hud-tp-val" style="font-weight: 800; color: #fff; margin-top: 2px;">--</div>
          </div>
          <div style="background: rgba(255,71,87,0.1); border: 1px solid rgba(255,71,87,0.3); border-radius: 6px; padding: 6px 8px; text-align: center;">
            <div style="color: #ff4757; font-size: 9px; font-weight: 700; text-transform: uppercase;">Stop Loss (SL)</div>
            <div id="hud-sl-val" style="font-weight: 800; color: #fff; margin-top: 2px;">--</div>
          </div>
        </div>

        <!-- Why / Explanation Section -->
        <div style="margin-bottom: 12px; background: rgba(22, 27, 34, 0.7); border: 1px solid rgba(48, 54, 61, 0.6); border-radius: 8px; padding: 10px;">
          <div style="font-size: 10px; text-transform: uppercase; color: #00ff88; font-weight: 700; margin-bottom: 6px;">
            💡 WHY THIS SIGNAL (EXPLANATION):
          </div>
          <div id="hud-reasons" style="font-size: 11px; line-height: 1.45; color: #c9d1d9; font-weight: 500;">
            Waiting for live price ticks to detect VWAP & EMA trend...
          </div>
        </div>

        <!-- Live Technical Indicator Grid -->
        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 8px; font-size: 10px; color: #8b949e;">
          <div style="background:#161b22; padding: 6px 8px; border-radius: 6px; border: 1px solid #21262d;">
            <span>VWAP: </span><span id="hud-vwap" style="font-weight: 700; color:#fff;">--</span>
          </div>
          <div style="background:#161b22; padding: 6px 8px; border-radius: 6px; border: 1px solid #21262d;">
            <span>RSI (14): </span><span id="hud-rsi" style="font-weight: 700; color:#fff;">50</span>
          </div>
        </div>

      </div>
    `;

    document.body.appendChild(hud);
    makeDraggable(hud, document.getElementById("hud-drag-header"));

    document.getElementById("hud-tf-select").addEventListener("change", (e) => {
      state.timeframeSec = parseInt(e.target.value);
      state.candles = [];
      state.currentCandle = null;
    });

    document.getElementById("hud-sound-btn").addEventListener("click", () => {
      state.soundEnabled = !state.soundEnabled;
      document.getElementById("hud-sound-btn").innerText = state.soundEnabled ? "🔊" : "🔇";
    });

    let minimized = false;
    document.getElementById("hud-min-btn").addEventListener("click", () => {
      minimized = !minimized;
      document.getElementById("hud-body").style.display = minimized ? "none" : "block";
      document.getElementById("hud-min-btn").innerText = minimized ? "+" : "−";
    });
  }

  function renderHUD() {
    const priceEl = document.getElementById("hud-price");
    if (!priceEl) return;

    priceEl.innerText = `₹${state.currentPrice.toFixed(2)}`;

    const box = document.getElementById("hud-signal-box");
    const act = document.getElementById("hud-signal-action");
    const conf = document.getElementById("hud-confidence");
    const reasonsEl = document.getElementById("hud-reasons");
    const vwapEl = document.getElementById("hud-vwap");
    const rsiEl = document.getElementById("hud-rsi");
    const tpEl = document.getElementById("hud-tp-val");
    const slEl = document.getElementById("hud-sl-val");

    conf.innerText = `${state.signal.confidence}%`;
    reasonsEl.innerHTML = state.signal.reasons.map(r => `• ${r}`).join("<br>");

    // VWAP & RSI
    vwapEl.innerText = state.indicators.vwap > 0 ? `₹${state.indicators.vwap.toFixed(1)}` : '--';
    vwapEl.style.color = state.currentPrice > state.indicators.vwap ? "#00ff88" : "#ff4757";

    rsiEl.innerText = `${state.indicators.rsi14}`;
    rsiEl.style.color = state.indicators.rsi14 >= 55 ? "#00ff88" : (state.indicators.rsi14 <= 45 ? "#ff4757" : "#fff");

    // Target & SL
    tpEl.innerText = state.signal.targetPrice > 0 ? `₹${state.signal.targetPrice.toFixed(1)}` : '--';
    slEl.innerText = state.signal.stopLossPrice > 0 ? `₹${state.signal.stopLossPrice.toFixed(1)}` : '--';

    // Signal Styles
    if (state.signal.action === "BUY_CE") {
      act.innerHTML = "⚡ BUY CE (CALL) / LONG";
      act.style.color = "#00ff88";
      box.style.background = "rgba(0, 255, 136, 0.18)";
      box.style.border = "1px solid #00ff88";
      box.style.boxShadow = "0 0 15px rgba(0, 255, 136, 0.4)";
    } else if (state.signal.action === "BUY_PE") {
      act.innerHTML = "⚡ BUY PE (PUT) / SHORT";
      act.style.color = "#ff4757";
      box.style.background = "rgba(255, 71, 87, 0.18)";
      box.style.border = "1px solid #ff4757";
      box.style.boxShadow = "0 0 15px rgba(255, 71, 87, 0.4)";
    } else {
      act.innerHTML = "⛔ AVOID TRADING / CHOP";
      act.style.color = "#eab308";
      box.style.background = "rgba(234, 179, 8, 0.15)";
      box.style.border = "1px solid rgba(234, 179, 8, 0.4)";
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

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", createHUD);
  } else {
    createHUD();
  }

})();

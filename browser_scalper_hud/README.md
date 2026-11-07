# ⚡ BulletScalp Pro Live HUD v2.0
### Indian Stock & F&O Market (Nifty / Bank Nifty / Equities) + Global

This version is specifically customized for **Indian Stock Broker Web Apps** (Zerodha Kite, Groww, Dhan, Angel One, Upstox, Fyers, and TradingView). 

It eliminates binary gambling (like 5s Olymp Trade) and focuses on real **Indian Intraday & Options Scalping (CE / PE)** with **VWAP**, **EMA Ribbon (9/21)**, **RSI Pullbacks**, **Theta Decay Chop Filters**, and **1:2 Risk-to-Reward Target / Stop-Loss calculations**.

---

## 🇮🇳 Supported Indian Platforms & Brokers

- **Zerodha Kite** (`kite.zerodha.com`)
- **Groww** (`groww.in`)
- **Dhan Web** (`web.dhan.co`)
- **Angel One** (`trade.angelone.in` & `angelone.in`)
- **Upstox Pro** (`pro.upstox.com`)
- **Fyers Web** (`trade.fyers.in`)
- **Shoonya / Finvasia** (`shoonya.finvasia.com`)
- **TradingView India** (`in.tradingview.com` & `tradingview.com`)

---

## 🚀 How to Launch on Your Broker (3 Options)

### ⚡ Method 1: Instant Launch (Fastest — 2 Seconds, No Setup Needed)
1. Open your trading tab in Chrome, Edge, or Brave:
   - e.g. Open **Zerodha Kite**, **Groww**, or **Dhan** with **NIFTY 50**, **BANKNIFTY**, or any stock chart open.
2. Press **`F12`** on your keyboard (or right-click anywhere on the page -> click **Inspect**).
3. Click the **Console** tab at the top.
4. Open the file [`browser_scalper_hud.user.js`](file:///c:/Users/ktgg5/OneDrive/Desktop/browser_scalper_hud/browser_scalper_hud.user.js), copy the entire code, paste it into the Console, and press **Enter**.
5. The HUD will immediately appear floating on top of your Kite/Groww/Dhan chart!

---

### 🧩 Method 2: Load as Permanent Chrome / Edge Extension
1. Open your browser and go to:
   - For Chrome / Brave: `chrome://extensions`
   - For Microsoft Edge: `edge://extensions`
2. Turn ON **Developer mode** (top-right corner).
3. Click **"Load unpacked"**.
4. Select the folder:
   ```
   C:\Users\ktgg5\OneDrive\Desktop\browser_scalper_hud\chrome_extension
   ```
5. Whenever you open Kite, Groww, Dhan, Angel One, or Upstox, the HUD will load automatically!

---

### 🐒 Method 3: Tampermonkey Userscript
1. Install the free **Tampermonkey** extension from Chrome Web Store.
2. Click the Tampermonkey icon -> **Create a new script**.
3. Paste the contents of [`browser_scalper_hud.user.js`](file:///c:/Users/ktgg5/OneDrive/Desktop/browser_scalper_hud/browser_scalper_hud.user.js) and press `Ctrl + S`.

---

## 🎯 Features Tailored for Indian Traders

1. **Auto-Detects Instrument & Symbol**:
   Detects whether you are trading `NIFTY 50`, `BANKNIFTY`, `FINNIFTY`, `SENSEX`, or a stock like `RELIANCE`, `TATA MOTORS`, etc.
2. **Actionable F&O Signals**:
   - `⚡ BUY CE (CALL) / LONG` (Neon Green)
   - `⚡ BUY PE (PUT) / SHORT` (Neon Red)
   - `⛔ AVOID TRADING / CHOP` (Amber)
3. **Theta Decay Protection (Chop Filter)**:
   In Indian Options trading, buying options in a sideways market causes heavy losses due to time decay (Theta). When the market is in a squeeze or chop, the HUD alerts:
   *"⛔ THETA DECAY WARNING: Avoid buying CE or PE right now (Option buyers lose money in chop)."*
4. **Calculates Target & Stop-Loss (1:2 R:R)**:
   - Shows live calculated **Target** (1:2 Risk-Reward) and **Stop-Loss (SL)** based on current index ATR/points.
5. **Key Indicators Included**:
   - **VWAP (Volume-Weighted Average Price)**: Above VWAP = Bullish CE bias; Below VWAP = Bearish PE bias.
   - **EMA 9 & EMA 21 Trend Ribbon**: Detects pullback entries in trending moves.
   - **RSI (14)**: Bull zone (55–75) vs Bear zone (25–45) vs Reversal exhaustions.
   - **Rejection Pinbar Wicks**: Detects institutional buyer/seller absorption.
6. **Timeframe Selector**:
   Switch between `1m Intraday`, `3m Scalp`, `5m Standard`, and `15m Trend` right from the HUD dropdown.

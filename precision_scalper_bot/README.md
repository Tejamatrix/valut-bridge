# ⚡ BULLET SCALPER PRO

An ultra-low latency, high-precision crypto scalping bot designed for short-term microstructure trading. Built in Python 3 with `asyncio`, `orjson`, `websockets`, and `rich`, achieving **sub-millisecond (< 30 microsecond)** tick computation and real-time execution.

---

## 🌟 Key Architecture & Why It Is High-Precision

Traditional trading bots rely on lagging indicators (like 5-minute MACD or RSI) which are too slow for short-term scalping. **BulletScalp operates at the microstructure level**:

1. **Depth-Weighted Order Book Imbalance (OBI)**:
   Measures resting liquidity across 50 levels of Level 2 depth. An exponential decay weight prioritizes top-of-book pressure. If buyers stack significant depth over sellers (+25% to +60% dominance), immediate upward pressure is detected.
2. **Predictive Micro-Price (Volume-Weighted Midpoint)**:
   $$P_{\text{micro}} = \frac{P_{\text{bid}} \cdot Q_{\text{ask}} + P_{\text{ask}} \cdot Q_{\text{bid}}}{Q_{\text{bid}} + Q_{\text{ask}}}$$
   Micro-price predicts quote replenishment direction milliseconds before the actual mid-price moves.
3. **Cumulative Volume Delta (CVD) & Aggressive Trade Flow**:
   Monitors tick-by-tick public trade flow in a rolling 15-second window. Confirms whether aggressive market orders (takers) are sweeping the book in agreement with the limit order depth, filtering out spoofing.
4. **Anti-Slippage Liquidity Gate**:
   Monitors the bid-ask spread in basis points (1 bp = 0.01%). If volatility causes the spread to widen beyond `max_spread_bps`, all entry signals are instantly locked to prevent slippage.
5. **Dynamic Trailing Stop & Scalp Timeout**:
   - Locks in profits as soon as a scalp reaches activation profit (e.g. +0.15%).
   - Dynamic trailing stop moves tight behind price (e.g. 0.08%).
   - Hard take-profit (e.g. +0.35%) and hard stop-loss (e.g. -0.20%).
   - Scalp timeout closes stagnant positions if target isn't reached within 90 seconds.

---

## 📁 Project Structure

```
precision_scalper_bot/
├── config.py           # Configurable thresholds, risk params, pairs, fees
├── orderbook.py        # Sub-millisecond L2 orderbook & OBI calculation engine
├── trades_tracker.py   # Tick-by-tick CVD and aggressive trade flow tracker
├── strategy.py         # Multi-factor confidence scoring & signal matrix
├── risk_engine.py      # Position tracking, trailing stop-loss, realistic fees & slippage
├── live_trader.py      # Bybit V5 private REST client with HMAC-SHA256 signature
├── ws_client.py        # Raw Bybit V5 WebSocket with automatic heartbeat & reconnect
├── dashboard.py        # Rich terminal TUI (Level 2 ladder, gauges, live PnL)
├── main.py             # CLI application entrypoint
├── web_app.py          # FastAPI server with WebSocket broadcast for Web GUI
├── static/
│   └── index.html      # Dark-mode professional Trading Desk interface
├── test_bot.py         # Automated unit & integration benchmark test suite
├── run_terminal.bat    # 1-click launcher for Terminal TUI
├── run_web.bat         # 1-click launcher for Web Browser Trading Desk
└── requirements.txt    # Python dependencies
```

---

## 🚀 Quick Start Guide

### 1. Launch Live Terminal TUI
Open a command prompt in the project directory, or double-click `run_terminal.bat`:
```bash
python main.py --symbol BTCUSDT --size 1000 --balance 10000 --tp 0.35 --sl 0.20
```
Command options:
- `--symbol`: Trading pair (`BTCUSDT`, `ETHUSDT`, `SOLUSDT`, etc.)
- `--market`: `spot` (default) or `linear` (perpetuals)
- `--size`: Position size in USDT (e.g., `1000`)
- `--balance`: Initial paper portfolio balance (e.g., `10000`)
- `--tp`: Target take-profit percentage (e.g., `0.35` for +0.35%)
- `--sl`: Hard stop-loss percentage (e.g., `0.20` for -0.20%)
- `--headless`: Run silently in the background without UI

### 2. Launch Real-Time Browser Trading Desk
Double-click `run_web.bat` or run:
```bash
python web_app.py
```
Open your browser at **`http://127.0.0.1:8000`**. You will see:
- Real-time animated Level 2 Depth Ladder with color-coded depth bars
- Live Order Book Imbalance (OBI) horizontal gauge
- Micro-price divergence and 15s Cumulative Volume Delta (CVD)
- Real-time BUY / SELL / HOLD signal indicator with confidence breakdown
- Live active scalp position card with trailing stop indicator and PnL
- Session statistics (Win rate, Realized PnL, Total scalps, Drawdown)

### 3. Run Benchmark & Unit Tests
```bash
python test_bot.py
```
Runs the test suite verifying sub-millisecond calculation speed (~25 microseconds) across the order book, strategy engine, and risk manager.

---

## ⚙️ Configuration & Parameter Tuning (`config.py`)

| Parameter | Default | Description |
|---|---|---|
| `symbol` | `"BTCUSDT"` | Active trading pair |
| `market_type` | `"spot"` | `"spot"` or `"linear"` (perpetual futures) |
| `top_n_imbalance` | `20` | Depth levels used for weighted imbalance |
| `imbalance_decay` | `0.85` | Decay weight for deeper book levels |
| `obi_buy_threshold` | `+0.25` | Min bid dominance (+25%) to trigger Buy |
| `obi_sell_threshold` | `-0.25` | Min ask dominance (-25%) to trigger Sell |
| `cvd_window_seconds`| `15.0` | Rolling window to measure aggressive market orders |
| `max_spread_bps` | `3.0` | Max spread allowed before rejecting trades |
| `take_profit_pct` | `0.35%` | Target scalp profit |
| `stop_loss_pct` | `0.20%` | Maximum allowable risk per scalp |
| `trailing_stop_activation_pct` | `0.15%` | Profit threshold to activate trailing stop |
| `trailing_stop_distance_pct` | `0.08%` | Distance to trail behind peak price |
| `max_hold_time_seconds` | `90.0` | Max duration to hold stagnant scalps |

---

## 🔐 Switching to Live Trading Mode

When you are satisfied with paper trading results and want to connect live funds:
1. Set your Bybit V5 API keys in Windows environment or `.env`:
   ```bash
   set BYBIT_API_KEY=your_bybit_api_key
   set BYBIT_API_SECRET=your_bybit_api_secret
   ```
2. Run with the `--live` flag:
   ```bash
   python main.py --symbol BTCUSDT --live
   ```

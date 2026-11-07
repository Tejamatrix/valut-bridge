"""
FastAPI Real-Time Web Server & WebSocket broadcaster for BulletScalp.
Provides a modern browser-based High-Frequency Trading Desk.
"""
import asyncio
import os
import time
from typing import Set
from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.responses import HTMLResponse, FileResponse
from fastapi.staticfiles import StaticFiles
import uvicorn
import orjson

from config import ScalperConfig
from orderbook import OrderBook
from trades_tracker import TradesTracker
from strategy import ScalperStrategy, ScalperSignal
from risk_engine import ExecutionEngine
from ws_client import BybitWebSocketClient

app = FastAPI(title="BulletScalp Real-Time Web Trading Desk")

# In-memory bot instance
config = ScalperConfig()
ob = OrderBook(depth_limit=config.depth_levels, top_n_imbalance=config.top_n_imbalance, decay_factor=config.imbalance_decay)
tracker = TradesTracker(window_seconds=config.cvd_window_seconds)
strategy = ScalperStrategy(config)
engine = ExecutionEngine(config)
events_log = []

active_websockets: Set[WebSocket] = set()

def log_event(message: str):
    ts = time.strftime("%H:%M:%S")
    events_log.append(f"[{ts}] {message}")
    if len(events_log) > 40:
        events_log.pop(0)

def on_orderbook(msg: dict):
    data = msg.get("data", {})
    msg_type = msg.get("type")
    ts = msg.get("ts", 0)
    bids, asks = data.get("b", []), data.get("a", [])

    if msg_type == "snapshot":
        ob.handle_snapshot(bids, asks, ts)
    elif msg_type == "delta":
        ob.handle_delta(bids, asks, ts)

    ob_metrics = ob.get_metrics()
    if not ob_metrics:
        return

    # Check active position
    closed = engine.update_tick(ob_metrics["best_bid"], ob_metrics["best_ask"])
    if closed:
        pnl_tag = f"+${closed.pnl_usd:.2f}" if closed.pnl_usd >= 0 else f"-${abs(closed.pnl_usd):.2f}"
        log_event(f"CLOSED {closed.side} via {closed.exit_reason} @ ${closed.exit_price:,.2f} | PnL: {pnl_tag}")

    # Evaluate signal
    trade_metrics = tracker.get_metrics()
    signal = strategy.evaluate(ob_metrics, trade_metrics)

    # Execute trade if trigger fires
    if signal.action in ("BUY", "SELL") and engine.can_open_position():
        pos = engine.execute_signal(signal.action, ob_metrics["best_bid"], ob_metrics["best_ask"])
        if pos:
            log_event(f"OPENED {pos.side} @ ${pos.entry_price:,.2f} | Conf: {signal.confidence:.0f}% | TP: ${pos.take_profit_price:,.2f}")

def on_trade(msg: dict):
    trades = msg.get("data", [])
    for t in trades:
        p = float(t.get("p", 0.0))
        s = float(t.get("v", 0.0))
        side = t.get("S", "Buy")
        ts = t.get("T")
        tracker.add_trade(p, s, side, ts)

ws_client = BybitWebSocketClient(config, on_orderbook=on_orderbook, on_trade=on_trade)

@app.on_event("startup")
async def startup_event():
    asyncio.create_task(ws_client.start())
    asyncio.create_task(broadcast_loop())

async def broadcast_loop():
    """Broadcasts current state to all connected web clients at 10 FPS."""
    while True:
        await asyncio.sleep(0.1)
        if not active_websockets:
            continue

        ob_metrics = ob.get_metrics() or {}
        trade_metrics = tracker.get_metrics()
        signal = strategy.evaluate(ob_metrics, trade_metrics) if ob_metrics else None
        stats = engine.get_summary_stats()
        pos = engine.active_position

        pos_dict = None
        if pos:
            pos_dict = {
                "side": pos.side,
                "entry_price": round(pos.entry_price, 2),
                "current_price": round(pos.current_price, 2),
                "size_usd": round(pos.size_usd, 2),
                "unrealized_pnl_usd": round(pos.unrealized_pnl_usd, 2),
                "unrealized_pnl_pct": round(pos.unrealized_pnl_pct, 2),
                "tp": round(pos.take_profit_price, 2),
                "sl": round(pos.stop_loss_price, 2),
                "trailing_stop": round(pos.trailing_stop_price, 2) if pos.trailing_stop_price else None,
                "trailing_active": pos.trailing_active,
                "elapsed": round(time.time() - pos.entry_time, 1)
            }

        payload = {
            "symbol": config.symbol,
            "latency_ms": round(ws_client.last_latency_ms, 1),
            "orderbook": {
                "bids": ob_metrics.get("top_bids", []),
                "asks": ob_metrics.get("top_asks", []),
                "best_bid": ob_metrics.get("best_bid", 0.0),
                "best_ask": ob_metrics.get("best_ask", 0.0),
                "mid_price": ob_metrics.get("mid_price", 0.0),
                "spread_usd": ob_metrics.get("spread_usd", 0.0),
                "spread_bps": ob_metrics.get("spread_bps", 0.0),
                "micro_price": ob_metrics.get("micro_price", 0.0),
                "micro_div_bps": ob_metrics.get("micro_div_bps", 0.0),
                "obi": ob_metrics.get("weighted_obi", 0.0),
            },
            "flow": trade_metrics,
            "signal": {
                "action": signal.action if signal else "HOLD",
                "confidence": signal.confidence if signal else 0.0,
                "reasons": signal.reasons if signal else []
            },
            "position": pos_dict,
            "performance": stats,
            "logs": events_log[-8:]
        }

        data_json = orjson.dumps(payload).decode('utf-8')
        dead_sockets = set()
        for ws in active_websockets:
            try:
                await ws.send_text(data_json)
            except Exception:
                dead_sockets.add(ws)
        active_websockets.difference_update(dead_sockets)

@app.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket):
    await websocket.accept()
    active_websockets.add(websocket)
    try:
        while True:
            await websocket.receive_text()
    except WebSocketDisconnect:
        active_websockets.discard(websocket)

# Serve Frontend
STATIC_DIR = os.path.join(os.path.dirname(__file__), "static")
os.makedirs(STATIC_DIR, exist_ok=True)
app.mount("/static", StaticFiles(directory=STATIC_DIR), name="static")

@app.get("/")
async def get_index():
    index_file = os.path.join(STATIC_DIR, "index.html")
    if os.path.exists(index_file):
        return FileResponse(index_file)
    return HTMLResponse("<h1>BulletScalp Web Desk</h1><p>static/index.html loading...</p>")

if __name__ == "__main__":
    uvicorn.run("web_app:app", host="127.0.0.1", port=8000, log_level="info")

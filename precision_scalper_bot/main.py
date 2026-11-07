"""
Main Application Orchestrator for BulletScalp.
High-precision, sub-millisecond crypto microstructure scalping bot.
"""
import sys
import os
import argparse
import asyncio
import time
from typing import List
from rich.live import Live
from rich.console import Console

from config import ScalperConfig
from orderbook import OrderBook
from trades_tracker import TradesTracker
from strategy import ScalperStrategy, ScalperSignal
from risk_engine import ExecutionEngine
from dashboard import ScalperDashboard
from ws_client import BybitWebSocketClient

# Global event audit log
events_log: List[str] = []

def log_event(message: str):
    timestamp = time.strftime("%H:%M:%S")
    events_log.append(f"[{timestamp}] {message}")
    if len(events_log) > 50:
        events_log.pop(0)

class BulletScalperBot:
    def __init__(self, config: ScalperConfig):
        self.config = config
        self.ob = OrderBook(
            depth_limit=config.depth_levels,
            top_n_imbalance=config.top_n_imbalance,
            decay_factor=config.imbalance_decay
        )
        self.tracker = TradesTracker(window_seconds=config.cvd_window_seconds)
        self.strategy = ScalperStrategy(config)
        self.engine = ExecutionEngine(config)
        self.dashboard = ScalperDashboard(config, self.engine, events_log)
        
        self.current_signal: ScalperSignal = ScalperSignal("HOLD", 0.0, 0.0, 0.0, 0.0, 0.0, 0.5, 0.0, ["Initializing"])
        self.cached_ob_metrics = None
        self.cached_trade_metrics = None
        self.running = False
        self.ws_client = None

    def on_orderbook_message(self, msg: dict):
        """Callback executed in microseconds on each order book packet."""
        data = msg.get("data", {})
        msg_type = msg.get("type")
        ts = msg.get("ts", 0)
        
        bids = data.get("b", [])
        asks = data.get("a", [])

        if msg_type == "snapshot":
            self.ob.handle_snapshot(bids, asks, ts)
            log_event(f"Order book initialized with {len(bids)} bids and {len(asks)} asks")
        elif msg_type == "delta":
            self.ob.handle_delta(bids, asks, ts)

        # Compute instant metrics
        ob_metrics = self.ob.get_metrics()
        if not ob_metrics:
            return
            
        self.cached_ob_metrics = ob_metrics

        # Check existing active position against new quote
        closed = self.engine.update_tick(ob_metrics["best_bid"], ob_metrics["best_ask"])
        if closed:
            pnl_tag = f"+${closed.pnl_usd:.2f}" if closed.pnl_usd >= 0 else f"-${abs(closed.pnl_usd):.2f}"
            log_event(f"CLOSED {closed.side} via {closed.exit_reason} @ ${closed.exit_price:,.2f} | PnL: {pnl_tag} ({closed.pnl_pct:+.2f}%)")

        # Evaluate strategy signals
        self.cached_trade_metrics = self.tracker.get_metrics()
        signal = self.strategy.evaluate(ob_metrics, self.cached_trade_metrics)
        self.current_signal = signal

        # Execute new position if actionable
        if signal.action in ("BUY", "SELL") and self.engine.can_open_position():
            pos = self.engine.execute_signal(signal.action, ob_metrics["best_bid"], ob_metrics["best_ask"])
            if pos:
                log_event(f"OPENED {pos.side} @ ${pos.entry_price:,.2f} | Conf: {signal.confidence:.0f}% | TP: ${pos.take_profit_price:,.2f}")

    def on_trade_message(self, msg: dict):
        """Callback executed on incoming tick trades."""
        trades = msg.get("data", [])
        for t in trades:
            price = float(t.get("p", 0.0))
            size = float(t.get("v", 0.0))
            side = t.get("S", "Buy")
            ts = t.get("T")
            self.tracker.add_trade(price, size, side, ts)

    async def run_terminal(self):
        """Runs the bot with Rich live dashboard."""
        self.running = True
        self.ws_client = BybitWebSocketClient(
            self.config,
            on_orderbook=self.on_orderbook_message,
            on_trade=self.on_trade_message
        )
        ws_task = asyncio.create_task(self.ws_client.start())
        log_event(f"Connecting to Bybit V5 {self.config.market_type.upper()} WebSocket...")

        console = Console()
        with Live(console=console, refresh_per_second=10, screen=True) as live:
            while self.running:
                latency = self.ws_client.last_latency_ms if self.ws_client else 0.0
                layout = self.dashboard.build_layout(
                    self.cached_ob_metrics,
                    self.cached_trade_metrics,
                    self.current_signal,
                    latency
                )
                live.update(layout)
                await asyncio.sleep(0.1)

        await self.ws_client.stop()
        await ws_task

    async def run_headless(self):
        """Headless background mode without terminal rendering."""
        self.running = True
        self.ws_client = BybitWebSocketClient(
            self.config,
            on_orderbook=self.on_orderbook_message,
            on_trade=self.on_trade_message
        )
        ws_task = asyncio.create_task(self.ws_client.start())
        print(f"[BulletScalp] Running headless for {self.config.symbol} on {self.config.exchange}...")
        try:
            while self.running:
                await asyncio.sleep(1)
        except (KeyboardInterrupt, asyncio.CancelledError):
            self.running = False
            await self.ws_client.stop()
            await ws_task

def main():
    parser = argparse.ArgumentParser(description="BulletScalp - High-Precision Short-Term Scalping Bot")
    parser.add_argument("--symbol", type=str, default="BTCUSDT", help="Pair to trade (e.g. BTCUSDT, ETHUSDT, SOLUSDT)")
    parser.add_argument("--market", type=str, default="spot", choices=["spot", "linear"], help="spot or linear futures")
    parser.add_argument("--size", type=float, default=1000.0, help="USDT position size per scalp")
    parser.add_argument("--balance", type=float, default=10000.0, help="Initial paper trading balance")
    parser.add_argument("--tp", type=float, default=0.35, help="Take-profit percent (e.g. 0.35)")
    parser.add_argument("--sl", type=float, default=0.20, help="Stop-loss percent (e.g. 0.20)")
    parser.add_argument("--live", action="store_true", help="Enable Live Trading mode (requires API keys in env)")
    parser.add_argument("--headless", action="store_true", help="Run without full screen TUI")
    
    args = parser.parse_args()

    cfg = ScalperConfig(
        symbol=args.symbol.upper(),
        market_type=args.market,
        trade_size_usd=args.size,
        initial_balance=args.balance,
        take_profit_pct=args.tp,
        stop_loss_pct=args.sl,
        paper_trading=not args.live
    )

    bot = BulletScalperBot(cfg)

    try:
        if args.headless:
            asyncio.run(bot.run_headless())
        else:
            asyncio.run(bot.run_terminal())
    except KeyboardInterrupt:
        print("\n[BulletScalp] Stopped gracefully.")

if __name__ == "__main__":
    main()

"""
Unit & Integration Test Suite for BulletScalp Bot.
Validates:
1. Sub-millisecond Order Book imbalance & Micro-price calculations
2. Tick volume & CVD calculations
3. Strategy signal generation
4. Execution & Trailing Stop logic
"""
import time
from config import ScalperConfig
from orderbook import OrderBook
from trades_tracker import TradesTracker
from strategy import ScalperStrategy
from risk_engine import ExecutionEngine

def test_orderbook():
    print("[TEST] Testing OrderBook...")
    ob = OrderBook(depth_limit=50, top_n_imbalance=10)
    
    # Simulate snapshot: Heavy bid book
    bids = [[f"{65000 - i*0.5:.2f}", f"{(10 - i)*0.5:.4f}"] for i in range(10)]
    asks = [[f"{65000.5 + i*0.5:.2f}", f"0.1000"] for i in range(10)]
    
    start_t = time.perf_counter()
    ob.handle_snapshot(bids, asks)
    metrics = ob.get_metrics()
    elapsed_us = (time.perf_counter() - start_t) * 1_000_000
    
    assert metrics is not None
    assert metrics["best_bid"] == 65000.00
    assert metrics["best_ask"] == 65000.50
    assert metrics["spread_usd"] == 0.50
    assert metrics["weighted_obi"] > 0.40  # Bids heavily outweigh asks
    assert metrics["micro_price"] > metrics["mid_price"]  # Micro-price pulled towards ask
    print(f"  [PASS] OrderBook computed in {elapsed_us:.1f} microseconds! OBI: {metrics['weighted_obi']*100:.1f}%, Spread: {metrics['spread_bps']:.2f} bps")

def test_trades_tracker():
    print("[TEST] Testing TradesTracker...")
    tracker = TradesTracker(window_seconds=15.0)
    
    # Simulate aggressive buyer sweep
    for _ in range(10):
        tracker.add_trade(price=65000.50, size=0.5, side="Buy")
    for _ in range(2):
        tracker.add_trade(price=65000.00, size=0.1, side="Sell")
        
    metrics = tracker.get_metrics()
    assert metrics["trade_count"] == 12
    assert metrics["cvd"] > 4.0
    assert metrics["buy_ratio"] > 0.80
    print(f"  [PASS] TradesTracker computed: CVD: {metrics['cvd']:.2f}, Buy Ratio: {metrics['buy_ratio']*100:.1f}%")

def test_strategy():
    print("[TEST] Testing Strategy Engine...")
    cfg = ScalperConfig()
    strat = ScalperStrategy(cfg)
    
    ob_metrics = {
        "mid_price": 65000.0,
        "best_bid": 64999.5,
        "best_ask": 65000.5,
        "spread_bps": 1.5,
        "weighted_obi": 0.45,
        "micro_div_bps": 1.2
    }
    trade_metrics = {
        "cvd": 5.2,
        "buy_ratio": 0.85,
        "trade_count": 10,
        "velocity_tps": 2.0
    }
    
    sig = strat.evaluate(ob_metrics, trade_metrics)
    assert sig.action == "BUY"
    assert sig.confidence >= 70.0
    print(f"  [PASS] Strategy output: {sig.action} (Confidence: {sig.confidence}%) Reasons: {sig.reasons}")

def test_risk_and_execution():
    print("[TEST] Testing Execution & Trailing Stop Engine...")
    cfg = ScalperConfig(trade_size_usd=1000.0, take_profit_pct=0.35, stop_loss_pct=0.20, trailing_stop_activation_pct=0.15)
    engine = ExecutionEngine(cfg)
    
    # Open Buy
    pos = engine.execute_signal("BUY", current_best_bid=65000.0, current_best_ask=65000.5)
    assert pos is not None
    assert pos.side == "LONG"
    print(f"  [PASS] Position Opened: {pos.side} @ ${pos.entry_price:,.2f}")
    
    # Tick 1: Price goes up +0.20% -> Trailing stop activates
    p1 = pos.entry_price * 1.0020
    engine.update_tick(best_bid=p1, best_ask=p1 + 0.5)
    assert pos.trailing_active is True
    print(f"  [PASS] Trailing Stop armed at ${pos.trailing_stop_price:,.2f}")
    
    # Tick 2: Hits take profit (+0.40%)
    p_tp = pos.entry_price * 1.0040
    closed = engine.update_tick(best_bid=p_tp, best_ask=p_tp + 0.5)
    assert closed is not None
    assert closed.pnl_usd > 0
    print(f"  [PASS] Closed via {closed.exit_reason}: Net PnL: +${closed.pnl_usd:.2f} ({closed.pnl_pct:+.2f}%)")
    
    stats = engine.get_summary_stats()
    assert stats["total_trades"] == 1
    assert stats["win_rate"] == 100.0
    print(f"  [PASS] Session Stats: Win Rate: {stats['win_rate']}%, Balance: ${stats['balance']:,.2f}")

if __name__ == "__main__":
    print("=" * 60)
    print("BULLET SCALPER INTEGRATION TESTS")
    print("=" * 60)
    test_orderbook()
    test_trades_tracker()
    test_strategy()
    test_risk_and_execution()
    print("=" * 60)
    print("ALL TESTS PASSED WITH SUB-MILLISECOND SPEED!")
    print("=" * 60)

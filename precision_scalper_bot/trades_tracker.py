"""
Tick-by-tick Trade Flow and Volume Delta Tracker.
Tracks:
- Cumulative Volume Delta (CVD = Aggressive Buy Volume - Aggressive Sell Volume)
- Buy/Sell Ratio over rolling time windows
- Trade Velocity (ticks/second) to spot whale liquidity sweeps
- Rolling VWAP of aggressive market execution
"""
import time
from collections import deque
from dataclasses import dataclass
from typing import Deque, Optional, Tuple

@dataclass
class TradeTick:
    timestamp: float   # seconds
    price: float
    size: float
    side: str          # 'Buy' (taker bought) or 'Sell' (taker sold)

class TradesTracker:
    def __init__(self, window_seconds: float = 15.0):
        self.window_seconds = window_seconds
        self.trades: Deque[TradeTick] = deque()
        self.total_buy_vol_all_time: float = 0.0
        self.total_sell_vol_all_time: float = 0.0
        self.last_trade_price: float = 0.0
        self.last_trade_time: float = 0.0

    def add_trade(self, price: float, size: float, side: str, timestamp_ms: Optional[int] = None):
        """Adds a new public market trade tick."""
        t_sec = (timestamp_ms / 1000.0) if timestamp_ms else time.time()
        
        tick = TradeTick(
            timestamp=t_sec,
            price=price,
            size=size,
            side=side
        )
        self.trades.append(tick)
        self.last_trade_price = price
        self.last_trade_time = t_sec
        
        if side.lower() == "buy":
            self.total_buy_vol_all_time += size
        else:
            self.total_sell_vol_all_time += size

        # Clean expired trades outside the window
        self._prune(t_sec)

    def _prune(self, current_time: float):
        cutoff = current_time - self.window_seconds
        while self.trades and self.trades[0].timestamp < cutoff:
            self.trades.popleft()

    def get_metrics(self) -> dict:
        """
        Computes rolling CVD, trade velocity, and volume metrics over the rolling window.
        """
        now = time.time()
        self._prune(now)
        
        if not self.trades:
            return {
                "window_buy_vol": 0.0,
                "window_sell_vol": 0.0,
                "cvd": 0.0,
                "buy_ratio": 0.5,
                "trade_count": 0,
                "velocity_tps": 0.0,
                "rolling_vwap": self.last_trade_price,
                "last_price": self.last_trade_price
            }
            
        buy_vol = 0.0
        sell_vol = 0.0
        weighted_price_sum = 0.0
        total_vol = 0.0
        
        for t in self.trades:
            vol = t.size
            total_vol += vol
            weighted_price_sum += t.price * vol
            if t.side.lower() == "buy":
                buy_vol += vol
            else:
                sell_vol += vol
                
        cvd = buy_vol - sell_vol
        buy_ratio = (buy_vol / total_vol) if total_vol > 0 else 0.5
        velocity_tps = len(self.trades) / max(self.window_seconds, 1.0)
        rolling_vwap = (weighted_price_sum / total_vol) if total_vol > 0 else self.last_trade_price
        
        return {
            "window_buy_vol": buy_vol,
            "window_sell_vol": sell_vol,
            "cvd": cvd,
            "buy_ratio": buy_ratio,
            "trade_count": len(self.trades),
            "velocity_tps": velocity_tps,
            "rolling_vwap": rolling_vwap,
            "last_price": self.last_trade_price
        }

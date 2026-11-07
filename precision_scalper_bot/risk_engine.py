"""
Risk Management and Execution Simulation Engine for High-Frequency Scalping.
Features:
- Sub-second position tracking with realistic slippage & fee modeling
- Dynamic Trailing Stop-Loss
- Hard Stop-Loss and Target Take-Profit
- Scalp Timeout Protection (exits stagnant trades)
- Complete metrics: Win rate, Profit Factor, Expectancy, Max Drawdown
"""
import time
from dataclasses import dataclass, field
from typing import Optional, List
from config import ScalperConfig

@dataclass
class Position:
    symbol: str
    side: str                 # "LONG" or "SHORT"
    entry_price: float
    size_asset: float
    size_usd: float
    entry_time: float
    take_profit_price: float
    stop_loss_price: float
    trailing_stop_price: Optional[float] = None
    trailing_active: bool = False
    highest_price: float = 0.0
    lowest_price: float = 0.0
    current_price: float = 0.0
    unrealized_pnl_usd: float = 0.0
    unrealized_pnl_pct: float = 0.0

@dataclass
class ClosedTrade:
    symbol: str
    side: str
    entry_price: float
    exit_price: float
    size_usd: float
    pnl_usd: float
    pnl_pct: float
    entry_time: float
    exit_time: float
    duration_seconds: float
    exit_reason: str          # "Take Profit", "Stop Loss", "Trailing Stop", "Timeout", "Signal Reversal"

class ExecutionEngine:
    def __init__(self, config: ScalperConfig):
        self.config = config
        self.balance: float = config.initial_balance
        self.peak_balance: float = config.initial_balance
        self.active_position: Optional[Position] = None
        self.trade_history: List[ClosedTrade] = []
        self.max_drawdown_usd: float = 0.0
        self.max_drawdown_pct: float = 0.0

    def can_open_position(self) -> bool:
        """Returns True if engine has capacity to enter a new trade."""
        return self.active_position is None and self.balance >= self.config.trade_size_usd

    def execute_signal(self, signal_action: str, current_best_bid: float, current_best_ask: float) -> Optional[Position]:
        """Opens a position based on high-precision signal."""
        if not self.can_open_position():
            return None

        now = time.time()
        slippage_mult = self.config.slippage_bps / 10000.0

        if signal_action == "BUY":
            # Buy fills at ask + slippage
            fill_price = current_best_ask * (1.0 + slippage_mult)
            tp = fill_price * (1.0 + (self.config.take_profit_pct / 100.0))
            sl = fill_price * (1.0 - (self.config.stop_loss_pct / 100.0))
            side = "LONG"
        elif signal_action == "SELL":
            # Short fills at bid - slippage
            fill_price = current_best_bid * (1.0 - slippage_mult)
            tp = fill_price * (1.0 - (self.config.take_profit_pct / 100.0))
            sl = fill_price * (1.0 + (self.config.stop_loss_pct / 100.0))
            side = "SHORT"
        else:
            return None

        # Calculate position size
        size_usd = self.config.trade_size_usd
        size_asset = size_usd / fill_price
        
        # Deduct entry fee
        entry_fee = size_usd * (self.config.taker_fee_pct / 100.0)
        self.balance -= entry_fee

        self.active_position = Position(
            symbol=self.config.symbol,
            side=side,
            entry_price=fill_price,
            size_asset=size_asset,
            size_usd=size_usd,
            entry_time=now,
            take_profit_price=tp,
            stop_loss_price=sl,
            highest_price=fill_price,
            lowest_price=fill_price,
            current_price=fill_price,
            unrealized_pnl_usd=-entry_fee,
            unrealized_pnl_pct=-(self.config.taker_fee_pct)
        )
        return self.active_position

    def update_tick(self, best_bid: float, best_ask: float) -> Optional[ClosedTrade]:
        """
        Evaluates active position against current price on every tick.
        Triggers TP, SL, Trailing Stop, or Max Hold Timeout.
        """
        if not self.active_position:
            return None

        pos = self.active_position
        now = time.time()
        duration = now - pos.entry_time
        slippage_mult = self.config.slippage_bps / 10000.0

        if pos.side == "LONG":
            pos.current_price = best_bid  # Exits would hit bid
            if pos.current_price > pos.highest_price:
                pos.highest_price = pos.current_price

            gross_pnl_pct = ((pos.current_price - pos.entry_price) / pos.entry_price) * 100.0
            gross_pnl_usd = (pos.current_price - pos.entry_price) * pos.size_asset

            # 1. Trailing Stop Logic
            if not pos.trailing_active and gross_pnl_pct >= self.config.trailing_stop_activation_pct:
                pos.trailing_active = True
                pos.trailing_stop_price = pos.current_price * (1.0 - (self.config.trailing_stop_distance_pct / 100.0))
            
            if pos.trailing_active:
                new_trail = pos.highest_price * (1.0 - (self.config.trailing_stop_distance_pct / 100.0))
                if pos.trailing_stop_price is None or new_trail > pos.trailing_stop_price:
                    pos.trailing_stop_price = new_trail

            # 2. Check Exit Conditions
            exit_reason = None
            exit_fill_price = pos.current_price * (1.0 - slippage_mult)

            if pos.current_price >= pos.take_profit_price:
                exit_reason = "Take Profit"
            elif pos.trailing_active and pos.current_price <= (pos.trailing_stop_price or 0.0):
                exit_reason = "Trailing Stop"
            elif pos.current_price <= pos.stop_loss_price:
                exit_reason = "Stop Loss"
            elif duration >= self.config.max_hold_time_seconds:
                exit_reason = "Timeout"

        else: # SHORT position
            pos.current_price = best_ask  # Exits would lift ask
            if pos.lowest_price == 0.0 or pos.current_price < pos.lowest_price:
                pos.lowest_price = pos.current_price

            gross_pnl_pct = ((pos.entry_price - pos.current_price) / pos.entry_price) * 100.0
            gross_pnl_usd = (pos.entry_price - pos.current_price) * pos.size_asset

            # Trailing Stop for Short
            if not pos.trailing_active and gross_pnl_pct >= self.config.trailing_stop_activation_pct:
                pos.trailing_active = True
                pos.trailing_stop_price = pos.current_price * (1.0 + (self.config.trailing_stop_distance_pct / 100.0))

            if pos.trailing_active:
                new_trail = pos.lowest_price * (1.0 + (self.config.trailing_stop_distance_pct / 100.0))
                if pos.trailing_stop_price is None or new_trail < pos.trailing_stop_price:
                    pos.trailing_stop_price = new_trail

            # Check Exit Conditions
            exit_reason = None
            exit_fill_price = pos.current_price * (1.0 + slippage_mult)

            if pos.current_price <= pos.take_profit_price:
                exit_reason = "Take Profit"
            elif pos.trailing_active and pos.current_price >= (pos.trailing_stop_price or float('inf')):
                exit_reason = "Trailing Stop"
            elif pos.current_price >= pos.stop_loss_price:
                exit_reason = "Stop Loss"
            elif duration >= self.config.max_hold_time_seconds:
                exit_reason = "Timeout"

        # Update real-time unrealized stats
        fee_pct_total = self.config.taker_fee_pct * 2.0  # entry + exit fee
        pos.unrealized_pnl_pct = gross_pnl_pct - fee_pct_total
        pos.unrealized_pnl_usd = (pos.unrealized_pnl_pct / 100.0) * pos.size_usd

        # Execute exit if triggered
        if exit_reason:
            return self._close_position(exit_fill_price, exit_reason, now)

        return None

    def _close_position(self, exit_price: float, reason: str, exit_time: float) -> ClosedTrade:
        pos = self.active_position
        duration = exit_time - pos.entry_time
        
        if pos.side == "LONG":
            gross_usd = (exit_price - pos.entry_price) * pos.size_asset
        else:
            gross_usd = (pos.entry_price - exit_price) * pos.size_asset

        exit_fee = pos.size_usd * (self.config.taker_fee_pct / 100.0)
        net_pnl_usd = gross_usd - exit_fee
        net_pnl_pct = (net_pnl_usd / pos.size_usd) * 100.0

        self.balance += net_pnl_usd

        # Update drawdown tracking
        if self.balance > self.peak_balance:
            self.peak_balance = self.balance
        dd_usd = self.peak_balance - self.balance
        dd_pct = (dd_usd / self.peak_balance) * 100.0 if self.peak_balance > 0 else 0.0

        if dd_usd > self.max_drawdown_usd:
            self.max_drawdown_usd = dd_usd
            self.max_drawdown_pct = dd_pct

        trade = ClosedTrade(
            symbol=pos.symbol,
            side=pos.side,
            entry_price=pos.entry_price,
            exit_price=exit_price,
            size_usd=pos.size_usd,
            pnl_usd=net_pnl_usd,
            pnl_pct=net_pnl_pct,
            entry_time=pos.entry_time,
            exit_time=exit_time,
            duration_seconds=round(duration, 1),
            exit_reason=reason
        )
        
        self.trade_history.append(trade)
        self.active_position = None
        return trade

    def get_summary_stats(self) -> dict:
        """Returns comprehensive performance metrics."""
        total_trades = len(self.trade_history)
        if total_trades == 0:
            return {
                "balance": self.balance,
                "equity": self.balance,
                "total_trades": 0,
                "win_count": 0,
                "loss_count": 0,
                "win_rate": 0.0,
                "net_pnl_usd": 0.0,
                "profit_factor": 0.0,
                "max_drawdown_usd": 0.0,
                "max_drawdown_pct": 0.0
            }

        wins = [t for t in self.trade_history if t.pnl_usd > 0]
        losses = [t for t in self.trade_history if t.pnl_usd <= 0]
        
        gross_profit = sum(t.pnl_usd for t in wins)
        gross_loss = abs(sum(t.pnl_usd for t in losses))
        profit_factor = (gross_profit / gross_loss) if gross_loss > 0 else (99.9 if gross_profit > 0 else 0.0)

        unrealized = self.active_position.unrealized_pnl_usd if self.active_position else 0.0

        return {
            "balance": round(self.balance, 2),
            "equity": round(self.balance + unrealized, 2),
            "total_trades": total_trades,
            "win_count": len(wins),
            "loss_count": len(losses),
            "win_rate": round((len(wins) / total_trades) * 100.0, 1),
            "net_pnl_usd": round(sum(t.pnl_usd for t in self.trade_history), 2),
            "profit_factor": round(profit_factor, 2),
            "max_drawdown_usd": round(self.max_drawdown_usd, 2),
            "max_drawdown_pct": round(self.max_drawdown_pct, 2)
        }

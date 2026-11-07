"""
High-Precision Microstructure Scalping Strategy Engine.
Fuses:
1. Depth-Weighted Order Book Imbalance (OBI)
2. Micro-Price / Midpoint Lead Divergence
3. Aggressive Cumulative Volume Delta (CVD) confirmation
4. Strict Spread & Liquidity Gates
"""
from dataclasses import dataclass
from typing import Optional
from config import ScalperConfig

@dataclass
class ScalperSignal:
    action: str             # "BUY", "SELL", or "HOLD"
    confidence: float       # 0.0 to 100.0%
    price: float            # Current reference price
    obi: float              # [-1.0, 1.0]
    micro_div_bps: float    # basis points
    cvd: float              # volume units
    buy_ratio: float        # [0.0, 1.0]
    spread_bps: float       # basis points
    reasons: list           # Human-readable breakdown of factors

class ScalperStrategy:
    def __init__(self, config: ScalperConfig):
        self.config = config

    def evaluate(self, ob_metrics: Optional[dict], trade_metrics: Optional[dict]) -> ScalperSignal:
        """
        Evaluates real-time market microstructure in sub-millisecond time.
        Produces BUY / SELL / HOLD with exact score & reasons.
        """
        if not ob_metrics or not trade_metrics:
            return ScalperSignal("HOLD", 0.0, 0.0, 0.0, 0.0, 0.0, 0.5, 0.0, ["Awaiting market data"])

        mid_price = ob_metrics["mid_price"]
        spread_bps = ob_metrics["spread_bps"]
        obi = ob_metrics["weighted_obi"]
        micro_div_bps = ob_metrics["micro_div_bps"]
        
        cvd = trade_metrics["cvd"]
        buy_ratio = trade_metrics["buy_ratio"]
        velocity_tps = trade_metrics["velocity_tps"]
        
        reasons = []

        # Gate 1: Spread Liquidity Check (Anti-Slippage Shield)
        if spread_bps > self.config.max_spread_bps:
            reasons.append(f"Spread widened to {spread_bps:.2f} bps (Max: {self.config.max_spread_bps:.1f} bps)")
            return ScalperSignal("HOLD", 0.0, mid_price, obi, micro_div_bps, cvd, buy_ratio, spread_bps, reasons)

        # Gate 2: Market Activity Check
        if trade_metrics["trade_count"] < 3:
            reasons.append("Insufficient trade velocity in rolling window")
            return ScalperSignal("HOLD", 0.0, mid_price, obi, micro_div_bps, cvd, buy_ratio, spread_bps, reasons)

        # Factor Scoring (0 to 100)
        # Factor A: Order Book Imbalance (up to 40 pts)
        # Factor B: Micro-Price Divergence (up to 30 pts)
        # Factor C: Aggressive Volume Flow (up to 30 pts)

        buy_score = 0.0
        sell_score = 0.0

        # --- Evaluate BUY Direction ---
        if obi > self.config.obi_buy_threshold:
            pts = min(40.0, (obi / 0.60) * 40.0)
            buy_score += pts
            reasons.append(f"Bid book stacked: OBI +{obi*100:.1f}% (+{pts:.0f} pts)")

        if micro_div_bps > self.config.micro_price_min_bps:
            pts = min(30.0, (micro_div_bps / 2.0) * 30.0)
            buy_score += pts
            reasons.append(f"Micro-price leading up by +{micro_div_bps:.2f} bps (+{pts:.0f} pts)")

        if buy_ratio > self.config.cvd_min_ratio and cvd > 0:
            pts = min(30.0, ((buy_ratio - 0.5) / 0.35) * 30.0)
            buy_score += pts
            reasons.append(f"Aggressive market buying: {buy_ratio*100:.1f}% CVD (+{pts:.0f} pts)")

        # --- Evaluate SELL Direction ---
        if obi < self.config.obi_sell_threshold:
            pts = min(40.0, (abs(obi) / 0.60) * 40.0)
            sell_score += pts
            reasons.append(f"Ask book heavy: OBI {obi*100:.1f}% (+{pts:.0f} pts)")

        if micro_div_bps < -self.config.micro_price_min_bps:
            pts = min(30.0, (abs(micro_div_bps) / 2.0) * 30.0)
            sell_score += pts
            reasons.append(f"Micro-price pushing down by {micro_div_bps:.2f} bps (+{pts:.0f} pts)")

        if buy_ratio < (1.0 - self.config.cvd_min_ratio) and cvd < 0:
            sell_ratio = 1.0 - buy_ratio
            pts = min(30.0, ((sell_ratio - 0.5) / 0.35) * 30.0)
            sell_score += pts
            reasons.append(f"Aggressive market selling: {sell_ratio*100:.1f}% CVD (+{pts:.0f} pts)")

        # Decision Matrix
        if buy_score >= self.config.min_confidence_to_trade and buy_score > sell_score + 15.0:
            return ScalperSignal("BUY", round(buy_score, 1), ob_metrics["best_ask"], obi, micro_div_bps, cvd, buy_ratio, spread_bps, reasons)
        elif sell_score >= self.config.min_confidence_to_trade and sell_score > buy_score + 15.0:
            return ScalperSignal("SELL", round(sell_score, 1), ob_metrics["best_bid"], obi, micro_div_bps, cvd, buy_ratio, spread_bps, reasons)
        else:
            return ScalperSignal("HOLD", round(max(buy_score, sell_score), 1), mid_price, obi, micro_div_bps, cvd, buy_ratio, spread_bps, reasons)

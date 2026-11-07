"""
Configuration module for the High-Precision Short-Term Scalping Bot.
Tune parameters here for different asset classes and risk appetites.
"""
import os
from dataclasses import dataclass, field
from typing import Optional

@dataclass
class ScalperConfig:
    # --- Market & Connection ---
    exchange: str = "bybit"  # "bybit"
    symbol: str = "BTCUSDT"  # BTCUSDT, ETHUSDT, SOLUSDT, etc.
    market_type: str = "spot"  # "spot" or "linear" (perpetual futures)
    ws_endpoint: str = "wss://stream.bybit.com/v5/public/spot"
    ws_linear_endpoint: str = "wss://stream.bybit.com/v5/public/linear"
    
    # --- Microstructure & Order Book Analytics ---
    depth_levels: int = 50           # Levels to track from L2 order book
    top_n_imbalance: int = 20        # Top N levels used for weighted imbalance
    imbalance_decay: float = 0.85    # Depth weighting factor (decay per level)
    
    # Signal Thresholds (Microstructure)
    obi_buy_threshold: float = 0.25       # +25% Bid dominance
    obi_sell_threshold: float = -0.25     # -25% Ask dominance
    min_confidence_to_trade: float = 70.0 # Min signal score (0-100)
    
    # Micro-Price divergence threshold in basis points (1 bp = 0.01%)
    micro_price_min_bps: float = 0.5
    
    # Cumulative Volume Delta (CVD) window in seconds
    cvd_window_seconds: float = 15.0
    cvd_min_ratio: float = 0.60          # 60% aggressive volume dominance
    
    # Spread Liquidity Filter
    max_spread_bps: float = 3.0          # Max allowable spread in bps (reject if spread > 3 bps)
    
    # --- Risk & Position Management ---
    paper_trading: bool = True           # True = Paper simulation, False = Live execution
    initial_balance: float = 10000.0     # Starting USDT balance in paper mode
    trade_size_usd: float = 1000.0       # USD value allocated per trade
    max_open_positions: int = 1          # Scalping holds 1 focused position at a time
    
    # Target & Stop Controls (in percentage)
    take_profit_pct: float = 0.35        # +0.35% take profit
    stop_loss_pct: float = 0.20          # -0.20% stop loss
    trailing_stop_activation_pct: float = 0.15 # Activate trailing stop after +0.15% profit
    trailing_stop_distance_pct: float = 0.08   # Trail by 0.08%
    max_hold_time_seconds: float = 90.0        # Max duration to hold scalping position
    
    # Fee & Slippage simulation (Paper mode)
    taker_fee_pct: float = 0.045         # 0.045% taker fee
    slippage_bps: float = 0.5            # 0.5 bps simulated execution slippage
    
    # Optional Live API Keys (from environment variables)
    api_key: Optional[str] = field(default_factory=lambda: os.getenv("BYBIT_API_KEY", ""))
    api_secret: Optional[str] = field(default_factory=lambda: os.getenv("BYBIT_API_SECRET", ""))

    def get_ws_url(self) -> str:
        if self.market_type == "linear":
            return self.ws_linear_endpoint
        return self.ws_endpoint

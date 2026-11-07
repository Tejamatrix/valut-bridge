"""
Ultra-low latency In-Memory Level 2 Order Book engine.
Computes real-time Microstructure metrics:
- Depth-Weighted Order Book Imbalance (OBI)
- Micro-Price (Volume-Weighted Midpoint Price)
- Dynamic Spread (Absolute & BPS)
- Top-of-Book Pressure
"""
import math
from typing import Dict, List, Tuple, Optional

class OrderBook:
    def __init__(self, depth_limit: int = 50, top_n_imbalance: int = 20, decay_factor: float = 0.85):
        self.depth_limit = depth_limit
        self.top_n_imbalance = top_n_imbalance
        self.decay_factor = decay_factor
        
        # In-memory depth stores: {price_float: size_float}
        self.bids: Dict[float, float] = {}
        self.asks: Dict[float, float] = {}
        
        self.last_update_ts: int = 0
        self.is_initialized: bool = False
        
        # Precompute decay weights for top_n_imbalance levels
        self.weights = [math.pow(self.decay_factor, i) for i in range(self.top_n_imbalance)]
        self.sum_weights = sum(self.weights)

    def handle_snapshot(self, bids_data: List[List[str]], asks_data: List[List[str]], ts: int = 0):
        """Processes initial full snapshot from the exchange."""
        self.bids.clear()
        self.asks.clear()
        
        for item in bids_data:
            p, s = float(item[0]), float(item[1])
            if s > 0:
                self.bids[p] = s
                
        for item in asks_data:
            p, s = float(item[0]), float(item[1])
            if s > 0:
                self.asks[p] = s
                
        self.last_update_ts = ts
        self.is_initialized = True

    def handle_delta(self, bids_data: List[List[str]], asks_data: List[List[str]], ts: int = 0):
        """Processes real-time incremental updates (delta)."""
        for item in bids_data:
            p, s = float(item[0]), float(item[1])
            if s <= 0:
                self.bids.pop(p, None)
            else:
                self.bids[p] = s

        for item in asks_data:
            p, s = float(item[0]), float(item[1])
            if s <= 0:
                self.asks.pop(p, None)
            else:
                self.asks[p] = s
                
        self.last_update_ts = ts

    def get_top_bids(self, n: int = 10) -> List[Tuple[float, float]]:
        """Returns top N bids sorted highest to lowest price."""
        if not self.bids:
            return []
        sorted_bids = sorted(self.bids.items(), key=lambda x: x[0], reverse=True)
        return sorted_bids[:n]

    def get_top_asks(self, n: int = 10) -> List[Tuple[float, float]]:
        """Returns top N asks sorted lowest to highest price."""
        if not self.asks:
            return []
        sorted_asks = sorted(self.asks.items(), key=lambda x: x[0])
        return sorted_asks[:n]

    def get_metrics(self) -> Optional[dict]:
        """
        Computes sub-millisecond microstructure indicators.
        Returns:
            dict containing best_bid, best_ask, mid_price, spread_usd, spread_bps,
            micro_price, micro_div_bps, weighted_obi, bid_vol_sum, ask_vol_sum
        """
        if not self.bids or not self.asks:
            return None
            
        top_bids = self.get_top_bids(self.top_n_imbalance)
        top_asks = self.get_top_asks(self.top_n_imbalance)
        
        if not top_bids or not top_asks:
            return None
            
        best_bid, best_bid_size = top_bids[0]
        best_ask, best_ask_size = top_asks[0]
        
        # Ensure book is not crossed
        if best_bid >= best_ask:
            return None
            
        mid_price = (best_bid + best_ask) / 2.0
        spread_usd = best_ask - best_bid
        spread_bps = (spread_usd / mid_price) * 10000.0  # 1 bp = 0.01%
        
        # 1. Micro-Price (Volume-Weighted Midpoint at Top of Book)
        # Reflects the price that balances the immediate queue length
        denom = best_bid_size + best_ask_size
        if denom > 0:
            # Notice the weights: If Bid size is huge, it pushes price UP towards Ask!
            micro_price = (best_bid * best_ask_size + best_ask * best_bid_size) / denom
        else:
            micro_price = mid_price
            
        micro_div_bps = ((micro_price - mid_price) / mid_price) * 10000.0
        
        # 2. Depth-Weighted Order Book Imbalance (OBI)
        weighted_bid_vol = 0.0
        weighted_ask_vol = 0.0
        raw_bid_vol = 0.0
        raw_ask_vol = 0.0
        
        n_bids = len(top_bids)
        for i in range(n_bids):
            w = self.weights[i]
            vol = top_bids[i][1]
            weighted_bid_vol += vol * w
            raw_bid_vol += vol
            
        n_asks = len(top_asks)
        for i in range(n_asks):
            w = self.weights[i]
            vol = top_asks[i][1]
            weighted_ask_vol += vol * w
            raw_ask_vol += vol
            
        total_weighted_vol = weighted_bid_vol + weighted_ask_vol
        if total_weighted_vol > 0:
            weighted_obi = (weighted_bid_vol - weighted_ask_vol) / total_weighted_vol
        else:
            weighted_obi = 0.0
            
        return {
            "best_bid": best_bid,
            "best_ask": best_ask,
            "best_bid_size": best_bid_size,
            "best_ask_size": best_ask_size,
            "mid_price": mid_price,
            "spread_usd": spread_usd,
            "spread_bps": spread_bps,
            "micro_price": micro_price,
            "micro_div_bps": micro_div_bps,
            "weighted_obi": weighted_obi,  # [-1.0 (Extreme Ask) to +1.0 (Extreme Bid)]
            "raw_bid_vol": raw_bid_vol,
            "raw_ask_vol": raw_ask_vol,
            "top_bids": top_bids[:5],
            "top_asks": top_asks[:5],
            "timestamp": self.last_update_ts
        }

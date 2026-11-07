"""
Bybit V5 Live Execution Adapter.
Used when paper_trading = False to route orders directly to Bybit V5 REST API with HMAC-SHA256 signature.
"""
import time
import hmac
import hashlib
import httpx
from typing import Optional, Dict, Any
from config import ScalperConfig

class BybitLiveTrader:
    def __init__(self, config: ScalperConfig):
        self.config = config
        self.base_url = "https://api.bybit.com"
        self.api_key = config.api_key
        self.api_secret = config.api_secret

    def _generate_signature(self, timestamp: int, params_str: str) -> str:
        """Generates Bybit V5 API signature."""
        recv_window = "5000"
        raw = f"{timestamp}{self.api_key}{recv_window}{params_str}"
        return hmac.new(
            self.api_secret.encode('utf-8'),
            raw.encode('utf-8'),
            hashlib.sha256
        ).hexdigest()

    def _get_headers(self, timestamp: int, signature: str) -> Dict[str, str]:
        return {
            "X-BAPI-API-KEY": self.api_key,
            "X-BAPI-SIGN": signature,
            "X-BAPI-TIMESTAMP": str(timestamp),
            "X-BAPI-RECV-WINDOW": "5000",
            "Content-Type": "application/json"
        }

    async def place_order(self, side: str, qty: float, price: Optional[float] = None, 
                          order_type: str = "Market", tp: Optional[float] = None, 
                          sl: Optional[float] = None) -> Dict[str, Any]:
        """
        Submits order to Bybit V5 endpoint: /v5/order/create
        """
        if not self.api_key or not self.api_secret:
            raise ValueError("Bybit API key or Secret is missing in config.")

        endpoint = "/v5/order/create"
        url = f"{self.base_url}{endpoint}"
        ts = int(time.time() * 1000)

        category = "spot" if self.config.market_type == "spot" else "linear"
        payload = {
            "category": category,
            "symbol": self.config.symbol,
            "side": "Buy" if side.upper() == "BUY" else "Sell",
            "orderType": order_type,
            "qty": str(qty)
        }

        if price and order_type == "Limit":
            payload["price"] = str(price)
        if tp:
            payload["takeProfit"] = str(round(tp, 4))
        if sl:
            payload["stopLoss"] = str(round(sl, 4))

        import orjson
        body_str = orjson.dumps(payload).decode('utf-8')
        sig = self._generate_signature(ts, body_str)
        headers = self._get_headers(ts, sig)

        async with httpx.AsyncClient(timeout=5.0) as client:
            resp = await client.post(url, headers=headers, content=body_str)
            return resp.json()

    async def get_wallet_balance(self) -> float:
        """Fetches total equity balance from Unified / Spot account."""
        if not self.api_key or not self.api_secret:
            return 0.0

        endpoint = "/v5/account/wallet-balance"
        ts = int(time.time() * 1000)
        query_str = "accountType=UNIFIED"
        sig = self._generate_signature(ts, query_str)
        headers = self._get_headers(ts, sig)
        url = f"{self.base_url}{endpoint}?{query_str}"

        try:
            async with httpx.AsyncClient(timeout=5.0) as client:
                resp = await client.get(url, headers=headers)
                data = resp.json()
                if data.get("retCode") == 0:
                    coins = data.get("result", {}).get("list", [{}])[0].get("coin", [])
                    for c in coins:
                        if c.get("coin") == "USDT":
                            return float(c.get("walletBalance", 0.0))
        except Exception:
            pass
        return 0.0

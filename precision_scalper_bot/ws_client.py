"""
Ultra-fast WebSocket client for Bybit V5 streaming feeds.
Subscribes to L2 Order Book, Public Trades, and Tickers.
Features auto-reconnection, ping-pong heartbeat, and sub-millisecond parsing via orjson.
"""
import asyncio
import time
from typing import Callable, Optional
import websockets
import orjson
from config import ScalperConfig

class BybitWebSocketClient:
    def __init__(self, config: ScalperConfig, 
                 on_orderbook: Callable[[dict], None], 
                 on_trade: Callable[[dict], None],
                 on_ticker: Optional[Callable[[dict], None]] = None):
        self.config = config
        self.on_orderbook = on_orderbook
        self.on_trade = on_trade
        self.on_ticker = on_ticker
        
        self.is_running = False
        self.ws_conn: Optional[websockets.WebSocketClientProtocol] = None
        self.last_latency_ms: float = 0.0
        self.reconnect_count: int = 0

    async def start(self):
        """Runs the continuous WebSocket feed loop."""
        self.is_running = True
        ws_url = self.config.get_ws_url()

        while self.is_running:
            try:
                async with websockets.connect(
                    ws_url,
                    ping_interval=None, # Bybit handles manual ping messages
                    close_timeout=5,
                    max_size=10_000_000
                ) as ws:
                    self.ws_conn = ws
                    self.reconnect_count = 0
                    
                    # 1. Subscribe to channels
                    symbol = self.config.symbol.upper()
                    channels = [
                        f"orderbook.50.{symbol}",
                        f"publicTrade.{symbol}",
                        f"tickers.{symbol}"
                    ]
                    sub_message = {
                        "op": "subscribe",
                        "args": channels
                    }
                    await ws.send(orjson.dumps(sub_message).decode('utf-8'))
                    
                    # 2. Launch background heartbeat
                    heartbeat_task = asyncio.create_task(self._heartbeat(ws))

                    # 3. Message ingestion loop
                    try:
                        async for raw_message in ws:
                            if not self.is_running:
                                break
                            self._handle_raw_message(raw_message)
                    finally:
                        heartbeat_task.cancel()

            except (websockets.ConnectionClosed, asyncio.TimeoutError, Exception) as e:
                if not self.is_running:
                    break
                self.reconnect_count += 1
                backoff = min(5.0, 0.5 * (2 ** min(self.reconnect_count, 4)))
                await asyncio.sleep(backoff)

    async def _heartbeat(self, ws):
        """Sends Bybit ping frame every 20 seconds to keep connection fresh."""
        ping_payload = orjson.dumps({"op": "ping"}).decode('utf-8')
        while self.is_running:
            try:
                await asyncio.sleep(20)
                await ws.send(ping_payload)
            except asyncio.CancelledError:
                break
            except Exception:
                break

    def _handle_raw_message(self, raw_message: str):
        """Dispatches messages with zero-overhead orjson decoding."""
        try:
            msg = orjson.loads(raw_message)
            topic = msg.get("topic")
            
            # Latency measurement
            msg_ts = msg.get("ts") or msg.get("cts")
            if msg_ts:
                now_ms = int(time.time() * 1000)
                self.last_latency_ms = max(0.0, float(now_ms - msg_ts))

            if not topic:
                return

            if "orderbook" in topic:
                self.on_orderbook(msg)
            elif "publicTrade" in topic:
                self.on_trade(msg)
            elif "tickers" in topic and self.on_ticker:
                self.on_ticker(msg)

        except Exception:
            pass

    async def stop(self):
        """Cleanly disconnects the WebSocket."""
        self.is_running = False
        if self.ws_conn:
            await self.ws_conn.close()

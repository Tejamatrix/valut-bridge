"""
Rich-based Live Terminal User Interface (TUI) for BulletScalp Bot.
Renders real-time Level 2 depth ladder, microstructure signals, active positions,
and account performance in an ultra-clean high-frequency trading dashboard.
"""
import time
from rich.layout import Layout
from rich.panel import Panel
from rich.table import Table
from rich.text import Text
from rich.console import Group
from config import ScalperConfig
from orderbook import OrderBook
from trades_tracker import TradesTracker
from strategy import ScalperSignal
from risk_engine import ExecutionEngine

class ScalperDashboard:
    def __init__(self, config: ScalperConfig, engine: ExecutionEngine, events_log: list):
        self.config = config
        self.engine = engine
        self.events_log = events_log

    def build_layout(self, 
                     ob_metrics: dict, 
                     trade_metrics: dict, 
                     signal: ScalperSignal, 
                     latency_ms: float) -> Layout:
        layout = Layout()
        layout.split_column(
            Layout(name="header", size=3),
            Layout(name="body", ratio=1),
            Layout(name="footer", size=5)
        )
        layout["body"].split_row(
            Layout(name="left", ratio=1),
            Layout(name="right", ratio=1)
        )
        layout["left"].split_column(
            Layout(name="orderbook", ratio=3),
            Layout(name="flow", ratio=2)
        )
        layout["right"].split_column(
            Layout(name="signal", size=6),
            Layout(name="position", size=7),
            Layout(name="performance", ratio=1)
        )

        # 1. Header
        layout["header"].update(self._render_header(latency_ms))
        
        # 2. Left - Order Book & Flow
        layout["left"]["orderbook"].update(self._render_orderbook(ob_metrics))
        layout["left"]["flow"].update(self._render_flow(ob_metrics, trade_metrics))

        # 3. Right - Signal, Position, Stats
        layout["right"]["signal"].update(self._render_signal(signal))
        layout["right"]["position"].update(self._render_position())
        layout["right"]["performance"].update(self._render_performance())

        # 4. Footer - Event Log
        layout["footer"].update(self._render_footer())

        return layout

    def _render_header(self, latency_ms: float) -> Panel:
        mode_text = "[bold green]PAPER TRADING[/bold green]" if self.config.paper_trading else "[bold red]LIVE TRADING[/bold red]"
        lat_color = "green" if latency_ms < 50 else ("yellow" if latency_ms < 150 else "red")
        
        t = Table.grid(expand=True)
        t.add_column(justify="left", ratio=2)
        t.add_column(justify="center", ratio=3)
        t.add_column(justify="right", ratio=2)
        
        t.add_row(
            Text.from_markup(f"[bold cyan]⚡ BULLET SCALPER PRO[/bold cyan] | [bold yellow]{self.config.symbol}[/bold yellow]"),
            Text.from_markup(f"Mode: {mode_text} | Exchange: [bold white]{self.config.exchange.upper()}[/bold white]"),
            Text.from_markup(f"WS Latency: [{lat_color}]{latency_ms:.0f} ms[/{lat_color}] | {time.strftime('%H:%M:%S')}")
        )
        return Panel(t, style="cyan")

    def _render_orderbook(self, ob: dict) -> Panel:
        if not ob:
            return Panel(Text("Waiting for Order Book Snapshot...", style="yellow"), title="L2 Order Book")

        table = Table(box=None, expand=True, show_header=True, header_style="bold magenta", padding=(0, 1))
        table.add_column("Type", justify="left", width=6)
        table.add_column("Price (USDT)", justify="right")
        table.add_column("Size", justify="right")
        table.add_column("Depth Depth", justify="left", width=14)

        # Top 4 Asks in reverse order (highest ask down to best ask)
        top_asks = list(reversed(ob.get("top_asks", [])[:4]))
        max_vol = max(ob.get("raw_bid_vol", 1.0), ob.get("raw_ask_vol", 1.0), 0.001)

        for p, s in top_asks:
            bar_len = min(12, int((s / max_vol) * 40))
            bar = "█" * max(1, bar_len)
            table.add_row("ASK", f"[red]{p:,.2f}[/red]", f"{s:.4f}", f"[red]{bar}[/red]")

        # Spread Divider Row
        spread_usd = ob.get("spread_usd", 0.0)
        spread_bps = ob.get("spread_bps", 0.0)
        table.add_row(
            "SPREAD", 
            f"[bold yellow]${spread_usd:.2f}[/bold yellow]", 
            f"[bold yellow]{spread_bps:.2f} bps[/bold yellow]", 
            "[dim]──────────────[/dim]"
        )

        # Top 4 Bids (best bid down to lower bids)
        top_bids = ob.get("top_bids", [])[:4]
        for p, s in top_bids:
            bar_len = min(12, int((s / max_vol) * 40))
            bar = "█" * max(1, bar_len)
            table.add_row("BID", f"[green]{p:,.2f}[/green]", f"{s:.4f}", f"[green]{bar}[/green]")

        return Panel(table, title="[bold]Level 2 Depth Ladder[/bold]", border_style="blue")

    def _render_flow(self, ob: dict, flow: dict) -> Panel:
        if not ob or not flow:
            return Panel(Text("Gathering trade flow...", style="dim"), title="Microstructure Flow")

        obi = ob.get("weighted_obi", 0.0)
        micro_bps = ob.get("micro_div_bps", 0.0)
        cvd = flow.get("cvd", 0.0)
        buy_ratio = flow.get("buy_ratio", 0.5) * 100.0
        tps = flow.get("velocity_tps", 0.0)

        # Visual OBI Bar: [-1.0 ... 0 ... +1.0]
        # Maps -1 to 0 (red), 0 to 1 (green)
        obi_val = int((obi + 1.0) * 10)  # 0 to 20
        obi_bar = "🔴" * max(0, 10 - obi_val) + "⚪" + "🟢" * max(0, obi_val - 10)

        obi_color = "green" if obi > 0.2 else ("red" if obi < -0.2 else "white")
        micro_color = "green" if micro_bps > 0.5 else ("red" if micro_bps < -0.5 else "white")
        cvd_color = "green" if cvd > 0 else "red"

        text = Group(
            Text.from_markup(f"Order Book Imbalance (OBI): [{obi_color}]{obi*100:+.1f}%[/{obi_color}]  {obi_bar}"),
            Text.from_markup(f"Micro-Price Divergence:     [{micro_color}]{micro_bps:+.2f} bps[/{micro_color}] (Predictive Lead)"),
            Text.from_markup(f"Volume Delta (15s CVD):     [{cvd_color}]{cvd:+.4f}[/{cvd_color}] (Buy Ratio: [bold]{buy_ratio:.1f}%[/bold])"),
            Text.from_markup(f"Trade Execution Velocity:   [cyan]{tps:.1f} trades/sec[/cyan] | Rolling VWAP: [yellow]${flow.get('rolling_vwap', 0.0):,.2f}[/yellow]")
        )
        return Panel(text, title="[bold]Microstructure & Delta Flow[/bold]", border_style="cyan")

    def _render_signal(self, sig: ScalperSignal) -> Panel:
        if not sig:
            return Panel(Text("Scanning micro-ticks..."), title="Strategy Signal")

        if sig.action == "BUY":
            status_text = f"[bold white on green]  ⚡ BUY NOW (CONFIDENCE: {sig.confidence:.1f}%)  [/bold white on green]"
        elif sig.action == "SELL":
            status_text = f"[bold white on red]  ⚡ SELL / SHORT NOW (CONFIDENCE: {sig.confidence:.1f}%)  [/bold white on red]"
        else:
            status_text = f"[bold black on yellow]  HOLD / SCANNING (CONFIDENCE: {sig.confidence:.1f}%)  [/bold black on yellow]"

        reason_str = " | ".join(sig.reasons[:2]) if sig.reasons else "Equilibrium"
        content = Group(
            Text.from_markup(status_text),
            Text.from_markup(f"[dim]Triggers:[/dim] {reason_str}")
        )
        return Panel(content, title="[bold]Signal Engine[/bold]", border_style="magenta")

    def _render_position(self) -> Panel:
        pos = self.engine.active_position
        if not pos:
            return Panel(Text("No Active Position. Waiting for high-confidence setup...", style="dim"), title="Position Manager")

        pnl_color = "green" if pos.unrealized_pnl_usd >= 0 else "red"
        trail_status = f"[green]Active (${pos.trailing_stop_price:,.2f})[/green]" if pos.trailing_active else "[dim]Armed[/dim]"
        elapsed = round(time.time() - pos.entry_time, 1)

        t = Table.grid(expand=True, padding=(0, 1))
        t.add_column(ratio=1)
        t.add_column(ratio=1)
        
        side_tag = f"[bold green]{pos.side}[/bold green]" if pos.side == "LONG" else f"[bold red]{pos.side}[/bold red]"
        t.add_row(
            Text.from_markup(f"Side: {side_tag} @ [bold]${pos.entry_price:,.2f}[/bold]"),
            Text.from_markup(f"PnL: [{pnl_color}][bold]{pos.unrealized_pnl_pct:+.2f}% (${pos.unrealized_pnl_usd:+.2f})[/bold][/{pnl_color}]")
        )
        t.add_row(
            Text.from_markup(f"Target TP: [green]${pos.take_profit_price:,.2f}[/green] | Hard SL: [red]${pos.stop_loss_price:,.2f}[/red]"),
            Text.from_markup(f"Trailing SL: {trail_status} | Time: [yellow]{elapsed:.0f}s / {self.config.max_hold_time_seconds:.0f}s[/yellow]")
        )
        return Panel(t, title="[bold]Active Scalp Trade[/bold]", border_style="yellow")

    def _render_performance(self) -> Panel:
        stats = self.engine.get_summary_stats()
        pnl_color = "green" if stats["net_pnl_usd"] >= 0 else "red"
        
        t = Table.grid(expand=True, padding=(0, 1))
        t.add_column(ratio=1)
        t.add_column(ratio=1)

        t.add_row(
            Text.from_markup(f"Balance: [bold white]${stats['balance']:,.2f}[/bold white] (Equity: ${stats['equity']:,.2f})"),
            Text.from_markup(f"Net Realized PnL: [{pnl_color}][bold]{stats['net_pnl_usd']:+,.2f} USDT[/bold][/{pnl_color}]")
        )
        t.add_row(
            Text.from_markup(f"Total Scalps: [bold]{stats['total_trades']}[/bold] (W: {stats['win_count']} / L: {stats['loss_count']})"),
            Text.from_markup(f"Win Rate: [bold cyan]{stats['win_rate']:.1f}%[/bold cyan] | Profit Factor: [bold]{stats['profit_factor']:.2f}[/bold]")
        )
        t.add_row(
            Text.from_markup(f"Max Drawdown: [red]${stats['max_drawdown_usd']:.2f} ({stats['max_drawdown_pct']:.2f}%)[/red]"),
            Text.from_markup(f"Alloc per Trade: [white]${self.config.trade_size_usd:,.0f}[/white]")
        )
        return Panel(t, title="[bold]Session Performance[/bold]", border_style="green")

    def _render_footer(self) -> Panel:
        if not self.events_log:
            logs = "[dim]No events yet. Stream operational.[/dim]"
        else:
            logs = "  •  ".join(self.events_log[-3:])
        return Panel(Text.from_markup(logs), title="[bold]Execution & Audit Log[/bold]", border_style="white")

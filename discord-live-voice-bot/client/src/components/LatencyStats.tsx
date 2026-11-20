import React from 'react';
import type { StreamStats, VoiceStateInfo } from '../types';
import { Wifi, Gauge, ShieldCheck, Layers, Cpu } from 'lucide-react';

interface Props {
  latencyMs: number;
  streamStats: StreamStats | null;
  voiceState: VoiceStateInfo | null;
}

export const LatencyStats: React.FC<Props> = ({
  latencyMs,
  streamStats,
  voiceState,
}) => {
  const getPingColor = (ping: number) => {
    if (ping <= 35) return 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20';
    if (ping <= 75) return 'text-yellow-400 bg-yellow-500/10 border-yellow-500/20';
    return 'text-red-400 bg-red-500/10 border-red-500/20';
  };

  return (
    <div className="bg-[#1e1f22] border border-[#2b2d31] rounded-2xl p-5 shadow-lg">
      <div className="flex items-center space-x-2.5 mb-4">
        <div className="p-2 bg-cyan-500/10 text-cyan-400 rounded-xl">
          <Gauge className="w-5 h-5" />
        </div>
        <div>
          <h2 className="text-base font-bold text-white tracking-wide">Live Stream Telemetry</h2>
          <p className="text-xs text-gray-400">Ultra-low latency packet stats & DAVE encryption</p>
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {/* Socket Latency */}
        <div className="bg-[#141518] p-3 rounded-xl border border-[#2b2d31]">
          <div className="flex items-center justify-between text-gray-400 text-xs mb-1">
            <span>WS Latency</span>
            <Wifi className="w-3.5 h-3.5 text-cyan-400" />
          </div>
          <div className="flex items-baseline space-x-1">
            <span className="text-xl font-bold font-mono text-white">{latencyMs}</span>
            <span className="text-xs text-gray-400 font-mono">ms</span>
          </div>
          <span className={`inline-block mt-1 text-[10px] font-semibold px-1.5 py-0.5 rounded border ${getPingColor(latencyMs)}`}>
            {latencyMs <= 35 ? 'ULTRA LOW' : latencyMs <= 75 ? 'OPTIMAL' : 'HIGH JITTER'}
          </span>
        </div>

        {/* Discord UDP Voice Ping */}
        <div className="bg-[#141518] p-3 rounded-xl border border-[#2b2d31]">
          <div className="flex items-center justify-between text-gray-400 text-xs mb-1">
            <span>Voice Ping</span>
            <Cpu className="w-3.5 h-3.5 text-emerald-400" />
          </div>
          <div className="flex items-baseline space-x-1">
            <span className="text-xl font-bold font-mono text-white">{voiceState?.ping || 0}</span>
            <span className="text-xs text-gray-400 font-mono">ms</span>
          </div>
          <span className="inline-block mt-1 text-[10px] text-gray-400 font-mono">
            Discord Gateway
          </span>
        </div>

        {/* Jitter Queue Size */}
        <div className="bg-[#141518] p-3 rounded-xl border border-[#2b2d31]">
          <div className="flex items-center justify-between text-gray-400 text-xs mb-1">
            <span>Jitter Buffer</span>
            <Layers className="w-3.5 h-3.5 text-purple-400" />
          </div>
          <div className="flex items-baseline space-x-1">
            <span className="text-xl font-bold font-mono text-white">
              {streamStats?.bufferQueueSize || 0}
            </span>
            <span className="text-xs text-gray-400 font-mono">frames</span>
          </div>
          <span className="inline-block mt-1 text-[10px] text-purple-400 font-mono">
            ~{((streamStats?.bufferQueueSize || 0) * 20)}ms buffered
          </span>
        </div>

        {/* DAVE E2EE Status */}
        <div className="bg-[#141518] p-3 rounded-xl border border-[#2b2d31]">
          <div className="flex items-center justify-between text-gray-400 text-xs mb-1">
            <span>Protocol</span>
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
          </div>
          <div className="flex items-baseline space-x-1">
            <span className="text-sm font-bold text-emerald-400">DAVE E2EE</span>
          </div>
          <span className="inline-block mt-1 text-[10px] text-emerald-400 font-mono">
            v{voiceState?.daveProtocolVersion || 1} Active
          </span>
        </div>
      </div>

      {/* Audio Codec & Spec Bar */}
      <div className="mt-3 p-2.5 bg-[#141518] rounded-xl border border-[#2b2d31] flex flex-wrap items-center justify-between gap-2 text-xs text-gray-400 font-mono">
        <div>
          Format: <strong className="text-white">48,000 Hz</strong> • <strong className="text-white">16-bit Stereo PCM</strong>
        </div>
        <div>
          Frame Interval: <strong className="text-emerald-400">20 ms</strong> • Payload: <strong className="text-emerald-400">3,840 bytes</strong>
        </div>
        <div>
          Packets Sent: <strong className="text-cyan-400">{streamStats?.packetsDispatched || 0}</strong>
        </div>
      </div>
    </div>
  );
};

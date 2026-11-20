import React from 'react';
import { Mic, Power, Zap, Sparkles } from 'lucide-react';
import type { SpeakMode, GodXParams } from '../types';

interface Props {
  audioDevices: MediaDeviceInfo[];
  selectedDeviceId: string;
  onDeviceChange: (deviceId: string) => void;
  params: GodXParams;
  onUpdateParam: <K extends keyof GodXParams>(key: K, val: GodXParams[K]) => void;
  onApplyPreset: (name: 'nuke' | 'demon' | 'scream' | 'clean') => void;
  speakMode: SpeakMode;
  onModeChange: (mode: SpeakMode) => void;
  micActive: boolean;
  onStartMic: () => void;
  onStopMic: () => void;
  micError: string | null;
}

export const AudioSettings: React.FC<Props> = ({
  audioDevices,
  selectedDeviceId,
  onDeviceChange,
  params,
  onUpdateParam,
  onApplyPreset,
  speakMode,
  onModeChange,
  micActive,
  onStartMic,
  onStopMic,
  micError,
}) => {
  // Mode label helper
  const getTalksetMode = (t: number) => {
    const v = Math.round(t * 100);
    if (v >= 90) return { icon: '☣️', mode: 'GOD-MODE MAX', color: 'text-red-500' };
    if (v >= 70) return { icon: '💀', mode: 'SCREAM SQUARER', color: 'text-fuchsia-400' };
    if (v >= 45) return { icon: '👺', mode: 'DEMON WAVE', color: 'text-rose-400' };
    if (v >= 20) return { icon: '🌑', mode: 'TUBE OVERDRIVE', color: 'text-amber-400' };
    return { icon: '⚡', mode: 'CLEAN DRIVE', color: 'text-cyan-400' };
  };

  const modeInfo = getTalksetMode(params.talkset);

  return (
    <div className="bg-[#1e1f22] border border-[#ff0055]/30 rounded-2xl p-5 shadow-2xl relative overflow-hidden backdrop-blur-md">
      {/* Top Cyber Glow Line */}
      <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-[#ff0055] via-purple-600 to-[#00ffea]" />

      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center space-x-2.5">
          <div className="p-2 bg-[#ff0055]/10 text-[#ff0055] rounded-xl border border-[#ff0055]/30 shadow-[0_0_15px_rgba(255,0,85,0.3)]">
            <Zap className="w-5 h-5 animate-pulse" />
          </div>
          <div>
            <div className="flex items-center space-x-2">
              <h2 className="text-base font-black text-white tracking-wider">GOD-X APEX DSP ENGINE</h2>
              <span className="text-[9px] px-2 py-0.5 rounded bg-[#ff0055]/20 text-[#ff0055] border border-[#ff0055]/40 font-mono font-bold tracking-widest">
                V10 LOUD
              </span>
            </div>
            <p className="text-xs text-gray-400">Psychoacoustic Presence, Asymmetric Wavefolding & True Peak Limiter</p>
          </div>
        </div>

        {/* Mic Activation Button */}
        <button
          onClick={micActive ? onStopMic : onStartMic}
          className={`flex items-center space-x-1.5 px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all shadow-md cursor-pointer ${
            micActive
              ? 'bg-[#00ff66]/10 hover:bg-[#00ff66]/20 text-[#00ff66] border border-[#00ff66]/40 shadow-[0_0_12px_rgba(0,255,102,0.2)]'
              : 'bg-gradient-to-r from-[#ff0055] to-purple-600 hover:opacity-90 text-white'
          }`}
        >
          <Power className="w-3.5 h-3.5" />
          <span>{micActive ? 'Engine Online' : 'Start Engine'}</span>
        </button>
      </div>

      {micError && (
        <div className="mb-4 text-xs text-red-400 bg-red-500/10 border border-red-500/20 p-2.5 rounded-xl">
          {micError}
        </div>
      )}

      {/* 1-CLICK PRESET MATRIX */}
      <div className="mb-5">
        <div className="text-[10px] font-mono font-black text-gray-400 uppercase tracking-widest mb-2 flex items-center space-x-1">
          <Sparkles className="w-3 h-3 text-[#ff0055]" />
          <span>Instant Sound Presets</span>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          <button
            type="button"
            onClick={() => onApplyPreset('nuke')}
            className="p-2.5 rounded-xl bg-gradient-to-r from-[#ff0055]/20 to-orange-500/20 hover:from-[#ff0055] hover:to-orange-500 border border-[#ff0055]/50 text-white font-black text-xs tracking-wider transition-all shadow-md hover:shadow-[0_0_15px_rgba(255,0,85,0.6)] cursor-pointer text-center"
          >
            ⚡ GOD-X NUKE
          </button>
          <button
            type="button"
            onClick={() => onApplyPreset('demon')}
            className="p-2.5 rounded-xl bg-gradient-to-r from-purple-900/40 to-rose-900/40 hover:from-purple-600 hover:to-rose-600 border border-purple-500/40 text-white font-black text-xs tracking-wider transition-all shadow-md hover:shadow-[0_0_15px_rgba(168,85,247,0.6)] cursor-pointer text-center"
          >
            👺 DEMON VOID
          </button>
          <button
            type="button"
            onClick={() => onApplyPreset('scream')}
            className="p-2.5 rounded-xl bg-gradient-to-r from-red-900/40 to-fuchsia-900/40 hover:from-red-600 hover:to-fuchsia-600 border border-red-500/40 text-white font-black text-xs tracking-wider transition-all shadow-md hover:shadow-[0_0_15px_rgba(239,68,68,0.6)] cursor-pointer text-center"
          >
            💀 SCREAM-WAR
          </button>
          <button
            type="button"
            onClick={() => onApplyPreset('clean')}
            className="p-2.5 rounded-xl bg-[#141518] hover:bg-[#2b2d31] border border-gray-700 text-gray-300 hover:text-white font-bold text-xs tracking-wider transition-all cursor-pointer text-center"
          >
            🛡️ CLEAN RESET
          </button>
        </div>
      </div>

      {/* CENTRAL CORE SATURATION CARD */}
      <div className="p-3.5 mb-4 bg-gradient-to-b from-[#23052d]/80 to-[#0a000f]/90 rounded-xl border border-purple-500/40 text-center shadow-[inset_0_0_20px_rgba(166,0,255,0.2)]">
        <div className="text-2xl mb-1 filter drop-shadow-[0_0_8px_rgba(255,0,85,0.8)]">{modeInfo.icon}</div>
        <div className={`text-[10px] font-mono font-black tracking-widest uppercase ${modeInfo.color}`}>
          {modeInfo.mode}
        </div>
        <div className="text-2xl font-black text-[#ff0055] drop-shadow-[0_0_12px_rgba(255,0,85,0.8)] font-mono">
          {Math.round(params.talkset * 100)}%
        </div>
        <div className="w-full h-1 bg-[#20000a] rounded-full my-2 overflow-hidden border border-[#350012]">
          <div
            style={{ width: `${params.talkset * 100}%` }}
            className="h-full bg-gradient-to-r from-[#ff0055] to-purple-500 shadow-[0_0_8px_#ff0055]"
          />
        </div>
        <input
          type="range"
          min="0"
          max="1"
          step="0.01"
          value={params.talkset}
          onChange={(e) => onUpdateParam('talkset', parseFloat(e.target.value))}
          className="w-full h-1.5 bg-[#141518] rounded-lg appearance-none cursor-pointer accent-[#ff0055]"
        />
      </div>

      <div className="space-y-3.5">
        {/* MASTER GAIN (1x to 500x) */}
        <div>
          <div className="flex justify-between text-xs font-bold text-gray-300 uppercase tracking-wider mb-1 font-mono">
            <span>MASTER GAIN</span>
            <b className="text-[#ff0055]">{params.gain}x</b>
          </div>
          <div className="w-full h-1 bg-[#20000a] rounded-full mb-1.5 overflow-hidden border border-[#350012]">
            <div
              style={{ width: `${(params.gain / 500) * 100}%` }}
              className="h-full bg-gradient-to-r from-[#ff0055] to-purple-500"
            />
          </div>
          <input
            type="range"
            min="1"
            max="500"
            step="1"
            value={params.gain}
            onChange={(e) => onUpdateParam('gain', parseInt(e.target.value, 10))}
            className="w-full h-1.5 bg-[#141518] rounded-lg appearance-none cursor-pointer accent-[#ff0055]"
          />
        </div>

        {/* FREQUENCY POWER GRID */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {/* PRESENCE CUT */}
          <div>
            <div className="flex justify-between text-[11px] font-bold text-gray-300 uppercase tracking-wider mb-1 font-mono">
              <span>PRESENCE CUT (3.4kHz)</span>
              <b className="text-[#ff0055]">{Math.round(params.dominance * 100)}%</b>
            </div>
            <input
              type="range"
              min="0"
              max="1"
              step="0.01"
              value={params.dominance}
              onChange={(e) => onUpdateParam('dominance', parseFloat(e.target.value))}
              className="w-full h-1.5 bg-[#141518] rounded-lg appearance-none cursor-pointer accent-[#ff0055]"
            />
          </div>

          {/* CHEST PUNCH */}
          <div>
            <div className="flex justify-between text-[11px] font-bold text-gray-300 uppercase tracking-wider mb-1 font-mono">
              <span>CHEST PUNCH (180Hz)</span>
              <b className="text-[#ff0055]">{Math.round(params.punch * 100)}%</b>
            </div>
            <input
              type="range"
              min="0"
              max="1"
              step="0.01"
              value={params.punch}
              onChange={(e) => onUpdateParam('punch', parseFloat(e.target.value))}
              className="w-full h-1.5 bg-[#141518] rounded-lg appearance-none cursor-pointer accent-[#ff0055]"
            />
          </div>
        </div>

        {/* SPATIAL & REVERB GRID */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {/* DUAL-EAR WIDE */}
          <div>
            <div className="flex justify-between text-[11px] font-bold text-gray-300 uppercase tracking-wider mb-1 font-mono">
              <span>HAAS STEREO WIDENER</span>
              <b className="text-[#00ffea]">{Math.round(params.wide * 100)}%</b>
            </div>
            <input
              type="range"
              min="0"
              max="1"
              step="0.01"
              value={params.wide}
              onChange={(e) => onUpdateParam('wide', parseFloat(e.target.value))}
              className="w-full h-1.5 bg-[#141518] rounded-lg appearance-none cursor-pointer accent-[#00ffea]"
            />
          </div>

          {/* ARENA ECHO */}
          <div>
            <div className="flex justify-between text-[11px] font-bold text-gray-300 uppercase tracking-wider mb-1 font-mono">
              <span>ARENA FEEDBACK ECHO</span>
              <b className="text-[#ff0055]">{Math.round(params.echo * 100)}%</b>
            </div>
            <input
              type="range"
              min="0"
              max="1"
              step="0.01"
              value={params.echo}
              onChange={(e) => onUpdateParam('echo', parseFloat(e.target.value))}
              className="w-full h-1.5 bg-[#141518] rounded-lg appearance-none cursor-pointer accent-[#ff0055]"
            />
          </div>
        </div>

        {/* BATTLE BOOST */}
        <div>
          <div className="flex justify-between text-[11px] font-bold text-gray-300 uppercase tracking-wider mb-1 font-mono">
            <span>BATTLE BOOST MULTIPLIER</span>
            <b className="text-yellow-400">{Math.round(params.boost * 100)}%</b>
          </div>
          <input
            type="range"
            min="0"
            max="1"
            step="0.01"
            value={params.boost}
            onChange={(e) => onUpdateParam('boost', parseFloat(e.target.value))}
            className="w-full h-1.5 bg-[#141518] rounded-lg appearance-none cursor-pointer accent-yellow-400"
          />
        </div>

        {/* NOISE GATE (ANTI-HISS) */}
        <div>
          <div className="flex justify-between text-[11px] font-bold text-gray-300 uppercase tracking-wider mb-1 font-mono">
            <span>INTELLIGENT NOISE GATE</span>
            <b className="text-emerald-400">{params.gate === 0 ? 'OFF' : `${Math.round(params.gate * 100)}%`}</b>
          </div>
          <input
            type="range"
            min="0"
            max="1"
            step="0.01"
            value={params.gate}
            onChange={(e) => onUpdateParam('gate', parseFloat(e.target.value))}
            className="w-full h-1.5 bg-[#141518] rounded-lg appearance-none cursor-pointer accent-emerald-400"
          />
        </div>

        {/* Device Selection & Mode */}
        <div className="pt-2 border-t border-[#2b2d31] grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="text-[11px] font-medium text-gray-400 mb-1 flex items-center justify-between">
              <span className="flex items-center space-x-1">
                <Mic className="w-3.5 h-3.5 text-gray-400" />
                <span>Microphone</span>
              </span>
            </label>
            <select
              value={selectedDeviceId}
              onChange={(e) => onDeviceChange(e.target.value)}
              className="w-full px-2.5 py-1.5 bg-[#141518] border border-[#2b2d31] rounded-lg text-xs text-white focus:outline-none focus:border-[#ff0055]"
            >
              {audioDevices.length === 0 ? (
                <option value="default">Default System Microphone</option>
              ) : (
                audioDevices.map((device, idx) => (
                  <option key={device.deviceId || idx} value={device.deviceId}>
                    {device.label || `Microphone ${idx + 1}`}
                  </option>
                ))
              )}
            </select>
          </div>

          <div>
            <label className="text-[11px] font-medium text-gray-400 mb-1 block">PTT Mode</label>
            <div className="grid grid-cols-2 gap-1.5 bg-[#141518] p-1 rounded-lg border border-[#2b2d31]">
              <button
                type="button"
                onClick={() => onModeChange('ptt')}
                className={`py-1 rounded text-[11px] font-bold transition-all cursor-pointer ${
                  speakMode === 'ptt' ? 'bg-[#ff0055] text-white shadow-sm' : 'text-gray-400 hover:text-white'
                }`}
              >
                Push-to-Talk
              </button>
              <button
                type="button"
                onClick={() => onModeChange('toggle')}
                className={`py-1 rounded text-[11px] font-bold transition-all cursor-pointer ${
                  speakMode === 'toggle' ? 'bg-[#ff0055] text-white shadow-sm' : 'text-gray-400 hover:text-white'
                }`}
              >
                Toggle
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Volume2, VolumeX, Zap, Radio, BellRing, Sparkles, Headphones, AlertTriangle } from 'lucide-react';
import type { TestBeepState, TestBeepOptions, VoiceStateInfo } from '../types';

interface Props {
  beepState: TestBeepState;
  onStartBeep: (options?: TestBeepOptions) => void;
  onStopBeep: () => void;
  voiceState: VoiceStateInfo | null;
}

export const TestBeepCard: React.FC<Props> = ({
  beepState,
  onStartBeep,
  onStopBeep,
  voiceState,
}) => {
  const [freq, setFreq] = useState<number>(2800);
  const [wave, setWave] = useState<'square' | 'sine' | 'dual' | 'sawtooth'>('square');
  const [gain, setGain] = useState<number>(1.2); // Loud default (120%)
  const [browserPreview, setBrowserPreview] = useState<boolean>(true);

  // Web Audio Context for Local Browser Preview
  const audioCtxRef = useRef<AudioContext | null>(null);
  const oscRef = useRef<OscillatorNode | null>(null);
  const osc2Ref = useRef<OscillatorNode | null>(null);
  const gainNodeRef = useRef<GainNode | null>(null);
  const isPointerDownRef = useRef(false);

  // Initialize or resume AudioContext
  const getAudioContext = useCallback(() => {
    if (!audioCtxRef.current || audioCtxRef.current.state === 'closed') {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      audioCtxRef.current = new AudioCtx();
    }
    if (audioCtxRef.current.state === 'suspended') {
      audioCtxRef.current.resume();
    }
    return audioCtxRef.current;
  }, []);

  // Stop local browser sound preview
  const stopLocalPreview = useCallback(() => {
    try {
      if (oscRef.current) {
        oscRef.current.stop();
        oscRef.current.disconnect();
        oscRef.current = null;
      }
      if (osc2Ref.current) {
        osc2Ref.current.stop();
        osc2Ref.current.disconnect();
        osc2Ref.current = null;
      }
      if (gainNodeRef.current) {
        gainNodeRef.current.disconnect();
        gainNodeRef.current = null;
      }
    } catch {}
  }, []);

  // Start local browser sound preview
  const startLocalPreview = useCallback(
    (f: number, w: 'square' | 'sine' | 'dual' | 'sawtooth', g: number) => {
      if (!browserPreview) return;
      stopLocalPreview();

      try {
        const ctx = getAudioContext();
        const now = ctx.currentTime;
        const gainNode = ctx.createGain();
        // Safe level for headphones while keeping it loud
        const safeHeadphoneVol = Math.min(0.35, g * 0.25);
        gainNode.gain.setValueAtTime(safeHeadphoneVol, now);
        gainNode.connect(ctx.destination);
        gainNodeRef.current = gainNode;

        const osc = ctx.createOscillator();
        osc.type = w === 'dual' ? 'square' : w;
        osc.frequency.setValueAtTime(f, now);
        osc.connect(gainNode);
        osc.start(now);
        oscRef.current = osc;

        if (w === 'dual') {
          const osc2 = ctx.createOscillator();
          osc2.type = 'sawtooth';
          osc2.frequency.setValueAtTime(f * 1.25, now);
          osc2.connect(gainNode);
          osc2.start(now);
          osc2Ref.current = osc2;
        }
      } catch (e) {
        console.warn('Local preview audio error:', e);
      }
    },
    [browserPreview, getAudioContext, stopLocalPreview]
  );

  // Sync local preview with beepState from server
  useEffect(() => {
    if (beepState.active) {
      startLocalPreview(beepState.freq, beepState.wave, beepState.gain);
    } else {
      stopLocalPreview();
    }
    return () => {
      stopLocalPreview();
    };
  }, [beepState.active, beepState.freq, beepState.wave, beepState.gain, startLocalPreview, stopLocalPreview]);

  // Quick preset triggers
  const playPulse = (durationMs: number) => {
    onStartBeep({
      freq,
      wave,
      gain,
      durationMs,
    });
  };

  const toggleContinuous = () => {
    if (beepState.active) {
      onStopBeep();
    } else {
      onStartBeep({
        freq,
        wave,
        gain,
        durationMs: 0, // 0 = continuous until stopped
      });
    }
  };

  // Push and Hold Handlers
  const handlePointerDown = (e: React.PointerEvent) => {
    isPointerDownRef.current = true;
    try {
      (e.target as HTMLElement).setPointerCapture(e.pointerId);
    } catch {}
    onStartBeep({
      freq,
      wave,
      gain,
      durationMs: 0,
    });
  };

  const handlePointerUp = (e: React.PointerEvent) => {
    if (isPointerDownRef.current) {
      isPointerDownRef.current = false;
      try {
        (e.target as HTMLElement).releasePointerCapture(e.pointerId);
      } catch {}
      onStopBeep();
    }
  };

  const presets = [
    { label: '🎯 2.5 kHz Piercing', f: 2500, w: 'square' as const, g: 1.2 },
    { label: '⚡ 3.2 kHz Ultra-High', f: 3200, w: 'square' as const, g: 1.4 },
    { label: '💀 4.0 kHz Screamer', f: 4000, w: 'square' as const, g: 1.5 },
    { label: '🚨 2.8 kHz War Dual', f: 2800, w: 'dual' as const, g: 1.3 },
    { label: '🔔 1.5 kHz Pure Alert', f: 1500, w: 'sine' as const, g: 1.0 },
  ];

  const isConnectedToVoice = voiceState?.isConnected ?? false;

  return (
    <div className="bg-[#1e1f22] border border-[#2b2d31] rounded-3xl p-6 shadow-2xl relative overflow-hidden transition-all duration-300">
      {/* Background glow when active */}
      <div
        className={`absolute inset-0 transition-opacity duration-300 pointer-events-none ${
          beepState.active
            ? 'opacity-25 bg-[radial-gradient(circle_at_center,#f59e0b_0%,transparent_75%)]'
            : 'opacity-5 bg-[radial-gradient(circle_at_center,#5865F2_0%,transparent_75%)]'
        }`}
      />

      {/* Header */}
      <div className="relative flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-[#2b2d31]">
        <div className="flex items-center space-x-3">
          <div
            className={`p-3 rounded-2xl border transition-colors ${
              beepState.active
                ? 'bg-amber-500/20 border-amber-500/50 text-amber-400 animate-pulse'
                : 'bg-[#2b2d31] border-[#35373c] text-discord-brand'
            }`}
          >
            <BellRing className={`w-6 h-6 ${beepState.active ? 'animate-bounce' : ''}`} />
          </div>
          <div>
            <div className="flex items-center space-x-2">
              <h3 className="font-black text-white text-base tracking-wide flex items-center gap-1.5">
                HIGH-PITCH TEST BEEP
                <span className="text-[10px] uppercase font-bold tracking-widest px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/30">
                  LOUD APEX
                </span>
              </h3>
            </div>
            <p className="text-xs text-gray-400 mt-0.5">
              Broadcast a piercing loud high-frequency beep through the bot into Discord voice to test volume & clarity.
            </p>
          </div>
        </div>

        {/* Live Status Badge */}
        <div className="flex items-center space-x-3">
          {beepState.active ? (
            <span className="flex items-center space-x-2 px-3.5 py-1.5 rounded-full text-xs font-black tracking-wider bg-amber-500/20 text-amber-300 border border-amber-500/40 animate-pulse shadow-lg shadow-amber-500/20">
              <Radio className="w-4 h-4 animate-spin text-amber-400" />
              <span>BEEPING LIVE ({beepState.freq}Hz • {Math.round(beepState.gain * 100)}%)</span>
            </span>
          ) : (
            <span className="flex items-center space-x-1.5 px-3 py-1 rounded-full text-xs font-mono text-gray-400 bg-[#2b2d31] border border-[#35373c]">
              <span className="w-2 h-2 rounded-full bg-gray-500" />
              <span>BEEP IDLE</span>
            </span>
          )}
        </div>
      </div>

      {/* Voice Connection Notice */}
      {!isConnectedToVoice && (
        <div className="relative mt-4 flex items-center space-x-2.5 p-3 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-300 text-xs">
          <AlertTriangle className="w-4 h-4 shrink-0 text-amber-400" />
          <span>
            Bot is not currently in a voice channel. <strong>Join a voice channel</strong> above so others on Discord can hear the loud test beep!
          </span>
        </div>
      )}

      {/* Quick Frequency & Style Presets */}
      <div className="relative mt-5">
        <label className="text-[11px] font-bold text-gray-400 tracking-wider uppercase block mb-2.5">
          1-Click High-Pitch Presets:
        </label>
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
          {presets.map((p) => {
            const isSelected = freq === p.f && wave === p.w;
            return (
              <button
                key={p.label}
                onClick={() => {
                  setFreq(p.f);
                  setWave(p.w);
                  setGain(p.g);
                  // Play a quick 1s preview burst when clicking preset
                  onStartBeep({
                    freq: p.f,
                    wave: p.w,
                    gain: p.g,
                    durationMs: 1000,
                  });
                }}
                className={`py-2 px-2.5 rounded-xl font-bold text-xs transition-all flex items-center justify-center space-x-1 border ${
                  isSelected
                    ? 'bg-amber-500 text-black border-amber-400 shadow-lg shadow-amber-500/30 scale-102'
                    : 'bg-[#2b2d31] hover:bg-[#35373c] text-gray-200 border-[#383a40]'
                }`}
              >
                <span>{p.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Controls Grid */}
      <div className="relative mt-5 grid grid-cols-1 md:grid-cols-3 gap-4 p-4 rounded-2xl bg-[#18191c] border border-[#2b2d31]">
        {/* Frequency Slider */}
        <div className="space-y-1.5">
          <div className="flex justify-between items-center text-xs">
            <span className="font-bold text-gray-300">Pitch Frequency</span>
            <span className="font-mono text-amber-400 font-bold">{freq} Hz</span>
          </div>
          <input
            type="range"
            min={1000}
            max={5000}
            step={50}
            value={freq}
            onChange={(e) => setFreq(Number(e.target.value))}
            className="w-full accent-amber-500 cursor-pointer h-2 bg-[#2b2d31] rounded-lg"
          />
          <div className="flex justify-between text-[10px] text-gray-500 font-mono">
            <span>1 kHz (Medium)</span>
            <span>2.8 kHz (Piercing)</span>
            <span>5 kHz (Mosquito)</span>
          </div>
        </div>

        {/* Master Loudness / Gain */}
        <div className="space-y-1.5">
          <div className="flex justify-between items-center text-xs">
            <span className="font-bold text-gray-300">Beep Loudness</span>
            <span className="font-mono text-amber-400 font-bold">{Math.round(gain * 100)}% {gain > 1.0 ? '⚡ OVERDRIVEN' : ''}</span>
          </div>
          <input
            type="range"
            min={0.5}
            max={2.0}
            step={0.05}
            value={gain}
            onChange={(e) => setGain(Number(e.target.value))}
            className="w-full accent-amber-500 cursor-pointer h-2 bg-[#2b2d31] rounded-lg"
          />
          <div className="flex justify-between text-[10px] text-gray-500 font-mono">
            <span>50%</span>
            <span>100% (0 dBFS)</span>
            <span className="text-amber-400 font-bold">200% (Apex Max)</span>
          </div>
        </div>

        {/* Waveform Selector */}
        <div className="space-y-1.5">
          <div className="flex justify-between items-center text-xs">
            <span className="font-bold text-gray-300">Sound Waveform</span>
            <span className="font-mono text-gray-400 capitalize">{wave}</span>
          </div>
          <div className="grid grid-cols-2 gap-1.5">
            <button
              onClick={() => setWave('square')}
              className={`py-1.5 px-2 rounded-lg text-xs font-semibold border ${
                wave === 'square'
                  ? 'bg-amber-500/20 text-amber-300 border-amber-500/40'
                  : 'bg-[#2b2d31] text-gray-300 border-[#383a40]'
              }`}
            >
              Square (Max Loud)
            </button>
            <button
              onClick={() => setWave('sine')}
              className={`py-1.5 px-2 rounded-lg text-xs font-semibold border ${
                wave === 'sine'
                  ? 'bg-amber-500/20 text-amber-300 border-amber-500/40'
                  : 'bg-[#2b2d31] text-gray-300 border-[#383a40]'
              }`}
            >
              Sine (Pure Tone)
            </button>
            <button
              onClick={() => setWave('dual')}
              className={`py-1.5 px-2 rounded-lg text-xs font-semibold border ${
                wave === 'dual'
                  ? 'bg-amber-500/20 text-amber-300 border-amber-500/40'
                  : 'bg-[#2b2d31] text-gray-300 border-[#383a40]'
              }`}
            >
              Dual Screamer
            </button>
            <button
              onClick={() => setWave('sawtooth')}
              className={`py-1.5 px-2 rounded-lg text-xs font-semibold border ${
                wave === 'sawtooth'
                  ? 'bg-amber-500/20 text-amber-300 border-amber-500/40'
                  : 'bg-[#2b2d31] text-gray-300 border-[#383a40]'
              }`}
            >
              Sawtooth (Bite)
            </button>
          </div>
        </div>
      </div>

      {/* Action Play Buttons & Browser Preview Toggle */}
      <div className="relative mt-5 flex flex-col sm:flex-row items-center justify-between gap-4">
        {/* Local browser preview checkbox */}
        <label className="flex items-center space-x-2 text-xs text-gray-300 cursor-pointer select-none">
          <input
            type="checkbox"
            checked={browserPreview}
            onChange={(e) => setBrowserPreview(e.target.checked)}
            className="rounded bg-[#2b2d31] border-[#383a40] text-amber-500 focus:ring-0 w-4 h-4"
          />
          <Headphones className="w-4 h-4 text-gray-400" />
          <span>Also preview beep in my browser headphones</span>
        </label>

        {/* Play Action Buttons */}
        <div className="flex flex-wrap items-center gap-2.5 w-full sm:w-auto">
          {/* 1-Sec Quick Beep */}
          <button
            onClick={() => playPulse(1000)}
            className="flex-1 sm:flex-none px-4 py-2.5 rounded-xl font-bold text-xs bg-[#2b2d31] hover:bg-[#383a40] text-white border border-[#3f4147] transition-all flex items-center justify-center space-x-1.5 shadow"
          >
            <Zap className="w-3.5 h-3.5 text-amber-400" />
            <span>1-Sec Beep</span>
          </button>

          {/* 3-Sec Loud Blast */}
          <button
            onClick={() => playPulse(3000)}
            className="flex-1 sm:flex-none px-4 py-2.5 rounded-xl font-bold text-xs bg-[#2b2d31] hover:bg-[#383a40] text-white border border-[#3f4147] transition-all flex items-center justify-center space-x-1.5 shadow"
          >
            <Sparkles className="w-3.5 h-3.5 text-amber-400" />
            <span>3-Sec Blast</span>
          </button>

          {/* Push & Hold To Beep */}
          <button
            onPointerDown={handlePointerDown}
            onPointerUp={handlePointerUp}
            onPointerCancel={handlePointerUp}
            className="flex-1 sm:flex-none px-4 py-2.5 rounded-xl font-bold text-xs bg-amber-500 hover:bg-amber-400 active:bg-amber-600 text-black border border-amber-400 transition-all flex items-center justify-center space-x-1.5 shadow-lg shadow-amber-500/20 cursor-pointer select-none"
          >
            <Volume2 className="w-3.5 h-3.5" />
            <span>Hold to Beep</span>
          </button>

          {/* Toggle Continuous Beep */}
          <button
            onClick={toggleContinuous}
            className={`flex-1 sm:flex-none px-5 py-2.5 rounded-xl font-black text-xs transition-all flex items-center justify-center space-x-2 border shadow-lg ${
              beepState.active
                ? 'bg-red-500 hover:bg-red-600 text-white border-red-400 animate-pulse shadow-red-500/30'
                : 'bg-emerald-600 hover:bg-emerald-500 text-white border-emerald-500 shadow-emerald-600/20'
            }`}
          >
            {beepState.active ? (
              <>
                <VolumeX className="w-4 h-4" />
                <span>STOP BEEP</span>
              </>
            ) : (
              <>
                <Radio className="w-4 h-4" />
                <span>CONTINUOUS BEEP</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};

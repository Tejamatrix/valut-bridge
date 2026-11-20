import React, { useRef } from 'react';
import { Mic, MicOff, Radio, Volume2 } from 'lucide-react';
import type { SpeakMode } from '../types';

interface Props {
  isSpeaking: boolean;
  onStartSpeaking: () => void;
  onStopSpeaking: () => void;
  onToggleSpeaking: () => void;
  speakMode: SpeakMode;
  audioLevel: number; // 0 - 100
  micActive: boolean;
  channelConnected: boolean;
  onStartMic: () => void;
  broadcastMode?: 'group' | 'individual';
  accountsCount?: number;
  activeAccountName?: string;
}

export const PushToTalkButton: React.FC<Props> = ({
  isSpeaking,
  onStartSpeaking,
  onStopSpeaking,
  onToggleSpeaking,
  speakMode,
  audioLevel,
  micActive,
  channelConnected,
  onStartMic,
  broadcastMode = 'group',
  accountsCount = 1,
  activeAccountName,
}) => {
  const isPointerDownRef = useRef(false);

  // Mouse & Touch event handlers for Push-to-Talk
  const handlePointerDown = (e: React.PointerEvent) => {
    if (!micActive) {
      // Auto-start mic on click if not active
      onStartMic();
      return;
    }

    if (speakMode === 'ptt') {
      isPointerDownRef.current = true;
      try {
        (e.target as HTMLElement).setPointerCapture(e.pointerId);
      } catch {}
      onStartSpeaking();
    }
  };

  const handlePointerUp = (e: React.PointerEvent) => {
    if (!micActive) return;

    if (speakMode === 'ptt' && isPointerDownRef.current) {
      isPointerDownRef.current = false;
      try {
        (e.target as HTMLElement).releasePointerCapture(e.pointerId);
      } catch {}
      onStopSpeaking();
    } else if (speakMode === 'toggle') {
      onToggleSpeaking();
    }
  };

  const handlePointerCancel = (e: React.PointerEvent) => {
    if (speakMode === 'ptt' && isPointerDownRef.current) {
      isPointerDownRef.current = false;
      try {
        (e.target as HTMLElement).releasePointerCapture(e.pointerId);
      } catch {}
      onStopSpeaking();
    }
  };

  // Dynamic scale calculation based on live audio intensity
  const soundScale = isSpeaking ? 1 + (audioLevel / 100) * 0.18 : 1;
  const ringScale = isSpeaking ? 1 + (audioLevel / 100) * 0.45 : 1;

  return (
    <div className="flex flex-col items-center justify-center p-8 bg-[#1e1f22] border border-[#2b2d31] rounded-3xl shadow-2xl relative overflow-hidden">
      {/* Background radial glow */}
      <div
        className={`absolute inset-0 transition-opacity duration-300 pointer-events-none ${
          isSpeaking && channelConnected
            ? 'opacity-30 bg-[radial-gradient(circle_at_center,#57F287_0%,transparent_70%)]'
            : isSpeaking
            ? 'opacity-25 bg-[radial-gradient(circle_at_center,#5865F2_0%,transparent_70%)]'
            : 'opacity-10 bg-[radial-gradient(circle_at_center,#5865F2_0%,transparent_70%)]'
        }`}
      />

      {/* Broadcasting Live Status Pill */}
      <div className="mb-6 flex items-center space-x-2">
        {isSpeaking ? (
          channelConnected ? (
            <span className="flex items-center space-x-2 px-4 py-1.5 rounded-full text-xs font-black tracking-widest bg-emerald-500/20 text-emerald-400 border border-emerald-500/40 animate-pulse">
              <Radio className="w-4 h-4 animate-spin text-emerald-400" />
              <span>
                {broadcastMode === 'group'
                  ? `TRANSMITTING LIVE TO ALL ${accountsCount} ACCOUNTS`
                  : `TRANSMITTING LIVE (${activeAccountName || 'ACTIVE ACCOUNT'})`}
              </span>
            </span>
          ) : (
            <span className="flex items-center space-x-2 px-4 py-1.5 rounded-full text-xs font-bold tracking-wider bg-discord-brand/20 text-discord-brand border border-discord-brand/40">
              <span className="w-2 h-2 rounded-full bg-discord-brand animate-ping" />
              <span>MIC ACTIVE (TEST MODE • JOIN VC TO BROADCAST)</span>
            </span>
          )
        ) : (
          <span className="flex items-center space-x-2 px-3.5 py-1 rounded-full text-xs font-semibold text-gray-400 bg-[#141518] border border-[#2b2d31]">
            <span className={`w-2 h-2 rounded-full ${micActive ? 'bg-emerald-400' : 'bg-gray-500'}`} />
            <span>
              {!micActive
                ? 'CLICK BUTTON TO ACTIVATE MIC'
                : !channelConnected
                ? 'MIC READY • JOIN VOICE CHANNEL TO TRANSMIT'
                : broadcastMode === 'group'
                ? `READY • GROUP VOICE (${accountsCount} ACCOUNTS)`
                : `READY • INDIVIDUAL VOICE (${activeAccountName || 'TARGET'})`}
            </span>
          </span>
        )}
      </div>

      {/* Interactive Main Button */}
      <div className="relative flex items-center justify-center my-4">
        {/* Dynamic Outer Sound Rings */}
        {isSpeaking && (
          <>
            <div
              style={{ transform: `scale(${ringScale})` }}
              className={`absolute w-44 h-44 rounded-full border-2 transition-transform duration-75 pointer-events-none ${
                channelConnected ? 'border-emerald-500/40' : 'border-discord-brand/40'
              }`}
            />
            <div
              style={{ transform: `scale(${ringScale * 1.25})` }}
              className={`absolute w-44 h-44 rounded-full border transition-transform duration-100 pointer-events-none ${
                channelConnected ? 'border-emerald-500/20' : 'border-discord-brand/20'
              }`}
            />
          </>
        )}

        <button
          type="button"
          onPointerDown={handlePointerDown}
          onPointerUp={handlePointerUp}
          onPointerCancel={handlePointerCancel}
          style={{ transform: `scale(${soundScale})` }}
          className={`relative z-10 w-36 h-36 rounded-full flex flex-col items-center justify-center select-none outline-none shadow-2xl transition-all duration-100 cursor-pointer ${
            !micActive
              ? 'bg-[#141518] border-4 border-[#2b2d31] hover:border-discord-brand text-gray-400 hover:text-white'
              : isSpeaking && channelConnected
              ? 'bg-gradient-to-tr from-emerald-600 to-green-500 border-4 border-emerald-300 text-white shadow-emerald-500/50'
              : isSpeaking
              ? 'bg-gradient-to-tr from-discord-brand to-purple-600 border-4 border-indigo-300 text-white shadow-discord-brand/50'
              : 'bg-gradient-to-tr from-discord-brand to-indigo-600 border-4 border-indigo-400/30 text-white hover:border-discord-brand hover:scale-105 shadow-discord-brand/30'
          }`}
        >
          {isSpeaking ? (
            <Volume2 className="w-12 h-12 text-white animate-speaking" />
          ) : !micActive ? (
            <MicOff className="w-12 h-12 text-gray-500" />
          ) : (
            <Mic className="w-12 h-12 text-white" />
          )}

          <span className="mt-2 text-[11px] font-black tracking-wider uppercase text-center px-2">
            {!micActive
              ? 'ENABLE MIC'
              : isSpeaking
              ? 'SPEAKING'
              : speakMode === 'ptt'
              ? 'HOLD TO TALK'
              : 'CLICK TO TALK'}
          </span>
        </button>
      </div>

      {/* Control Tips & Hotkey Banner */}
      <div className="mt-6 text-center">
        <div className="inline-flex items-center space-x-2 px-3 py-1 bg-[#141518] rounded-xl border border-[#2b2d31] text-xs text-gray-400">
          <span>Hotkey:</span>
          <kbd className="px-2 py-0.5 bg-[#2b2d31] text-white font-mono text-xs rounded border border-gray-600 shadow-sm">
            SPACEBAR
          </kbd>
          <span className="text-gray-500">•</span>
          <span>Mode: <strong className="text-discord-brand">{speakMode === 'ptt' ? 'Push-To-Talk' : 'Toggle'}</strong></span>
        </div>
        <p className="text-[11px] text-gray-500 mt-2">
          {speakMode === 'ptt'
            ? 'Press and hold Spacebar or the button above to broadcast into the channel.'
            : 'Press Spacebar or click the button once to talk, press again to stop.'}
        </p>
      </div>
    </div>
  );
};

import React from 'react';
import { Mic, MicOff, Headphones, VolumeX, Radio } from 'lucide-react';
import type { VoiceStateInfo } from '../types';

interface Props {
  voiceState: VoiceStateInfo | null;
  onSetMute: (mute: boolean) => void;
  onSetDeaf: (deaf: boolean) => void;
  disabled: boolean;
}

export const SelfControls: React.FC<Props> = ({
  voiceState,
  onSetMute,
  onSetDeaf,
  disabled,
}) => {
  const isMuted = voiceState?.selfMute ?? false;
  const isDeaf = voiceState?.selfDeaf ?? false;

  return (
    <div className="bg-[#1e1f22] border border-[#2b2d31] rounded-2xl p-4 shadow-lg flex items-center justify-between">
      <div className="flex items-center space-x-2">
        <Radio className="w-4 h-4 text-discord-brand" />
        <span className="text-xs font-bold text-white uppercase tracking-wider">Discord Voice Controls</span>
      </div>

      <div className="flex items-center space-x-2">
        {/* Self Mute */}
        <button
          onClick={() => onSetMute(!isMuted)}
          disabled={disabled}
          className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all disabled:opacity-40 cursor-pointer ${
            isMuted
              ? 'bg-red-500/20 text-red-400 border border-red-500/30'
              : 'bg-[#141518] hover:bg-[#2b2d31] text-gray-300 border border-[#2b2d31]'
          }`}
          title={isMuted ? 'Unmute Bot' : 'Self-Mute Bot'}
        >
          {isMuted ? <MicOff className="w-3.5 h-3.5 text-red-400" /> : <Mic className="w-3.5 h-3.5 text-gray-300" />}
          <span>{isMuted ? 'Muted' : 'Mute'}</span>
        </button>

        {/* Self Deafen */}
        <button
          onClick={() => onSetDeaf(!isDeaf)}
          disabled={disabled}
          className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all disabled:opacity-40 cursor-pointer ${
            isDeaf
              ? 'bg-red-500/20 text-red-400 border border-red-500/30'
              : 'bg-[#141518] hover:bg-[#2b2d31] text-gray-300 border border-[#2b2d31]'
          }`}
          title={isDeaf ? 'Undeafen Bot' : 'Self-Deafen Bot'}
        >
          {isDeaf ? <VolumeX className="w-3.5 h-3.5 text-red-400" /> : <Headphones className="w-3.5 h-3.5 text-gray-300" />}
          <span>{isDeaf ? 'Deafened' : 'Deafen'}</span>
        </button>
      </div>
    </div>
  );
};

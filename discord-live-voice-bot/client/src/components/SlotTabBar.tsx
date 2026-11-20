import React from 'react';
import type { AccountSummary, BroadcastMode } from '../types';
import { Users, User, Plus, Radio, Sparkles } from 'lucide-react';

interface Props {
  selectedSlot: number;
  onSelectSlot: (slot: number) => void;
  accounts: AccountSummary[];
  broadcastMode: BroadcastMode;
  onSetBroadcastMode: (mode: BroadcastMode) => void;
  maxSlots?: number;
}

export const SlotTabBar: React.FC<Props> = ({
  selectedSlot,
  onSelectSlot,
  accounts,
  broadcastMode,
  onSetBroadcastMode,
  maxSlots = 5,
}) => {
  const slots = Array.from({ length: maxSlots }, (_, i) => i + 1);

  return (
    <div className="bg-[#18191c] border-2 border-[#2b2d31] rounded-2xl p-3 shadow-xl space-y-3">
      {/* Top Row: Custom Slots Label & Slot Tabs */}
      <div className="flex flex-wrap items-center gap-2">
        {/* Custom Slots Badge */}
        <div className="px-3.5 py-1.5 rounded-xl bg-amber-400 text-black font-black text-xs uppercase tracking-wider flex items-center space-x-1.5 shadow-sm border border-amber-300">
          <Sparkles className="w-3.5 h-3.5" />
          <span>CUSTOM SLOTS ({maxSlots})</span>
        </div>

        {/* 5 Slot Tabs */}
        <div className="flex flex-wrap items-center gap-2 flex-1">
          {slots.map((slotNum) => {
            const acc = accounts.find((a) => a.slot === slotNum);
            const isSelected = selectedSlot === slotNum;
            const inVoice = acc?.voiceState?.isConnected ?? false;

            return (
              <button
                key={slotNum}
                type="button"
                onClick={() => onSelectSlot(slotNum)}
                className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center space-x-2 border cursor-pointer select-none ${
                  isSelected
                    ? 'bg-amber-400 text-black border-amber-300 shadow-md font-black scale-102 ring-2 ring-amber-400/30'
                    : acc
                    ? 'bg-[#222429] hover:bg-[#2c2e35] text-white border-[#383a40]'
                    : 'bg-[#1b1c20] hover:bg-[#23242a] text-gray-400 border-dashed border-[#33353c]'
                }`}
              >
                {acc ? (
                  <>
                    {/* Account Avatar */}
                    {acc.profile.avatarUrl ? (
                      <img
                        src={acc.profile.avatarUrl}
                        alt={acc.profile.username}
                        className="w-4 h-4 rounded-full border border-black/20"
                      />
                    ) : (
                      <div className="w-4 h-4 rounded-full bg-indigo-600 text-[10px] text-white flex items-center justify-center font-bold">
                        {acc.profile.username.charAt(0).toUpperCase()}
                      </div>
                    )}

                    <span className="truncate max-w-[110px]">{acc.profile.username}</span>

                    {/* In VC green dot */}
                    {inVoice && (
                      <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" title="In Voice Channel" />
                    )}
                  </>
                ) : (
                  <>
                    <Plus className="w-3.5 h-3.5 text-gray-400" />
                    <span>+ SLOT 0{slotNum}</span>
                  </>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Mode Switch Pills: INDIVIDUAL vs JOINT SYNC / COMBINE PLAY */}
      <div className="flex flex-wrap items-center justify-between gap-3 pt-2.5 border-t border-[#26282e]">
        <div className="flex items-center space-x-2">
          {/* INDIVIDUAL Button */}
          <button
            type="button"
            onClick={() => onSetBroadcastMode('individual')}
            className={`px-4 py-2 rounded-xl text-xs font-black transition-all flex items-center space-x-1.5 border cursor-pointer ${
              broadcastMode === 'individual'
                ? 'bg-amber-400 text-black border-amber-300 shadow-md shadow-amber-400/20'
                : 'bg-[#222429] text-gray-300 border-[#383a40] hover:bg-[#2b2d34]'
            }`}
          >
            <User className="w-4 h-4" />
            <span>INDIVIDUAL</span>
          </button>

          {/* JOINT SYNC / COMBINE PLAY Button */}
          <button
            type="button"
            onClick={() => onSetBroadcastMode('group')}
            className={`px-4 py-2 rounded-xl text-xs font-black transition-all flex items-center space-x-1.5 border cursor-pointer ${
              broadcastMode === 'group'
                ? 'bg-amber-400 text-black border-amber-300 shadow-md shadow-amber-400/20'
                : 'bg-[#222429] text-gray-300 border-[#383a40] hover:bg-[#2b2d34]'
            }`}
          >
            <Users className="w-4 h-4" />
            <span>💛 JOINT SYNC / COMBINE PLAY</span>
          </button>
        </div>

        {/* Live Active Mode Indicator Text */}
        <div className="text-xs text-gray-400 font-mono flex items-center space-x-2">
          <span className="text-gray-500">PLAYBACK:</span>
          {broadcastMode === 'individual' ? (
            <span className="text-amber-400 font-bold flex items-center space-x-1">
              <span>INDIVIDUAL (SLOT 0{selectedSlot})</span>
            </span>
          ) : (
            <span className="text-emerald-400 font-bold flex items-center space-x-1">
              <Radio className="w-3.5 h-3.5 animate-spin" />
              <span>COMBINE PLAY (ALL {accounts.length} BOTS SYNCED)</span>
            </span>
          )}
        </div>
      </div>
    </div>
  );
};

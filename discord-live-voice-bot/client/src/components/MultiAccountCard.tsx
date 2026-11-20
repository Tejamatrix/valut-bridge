import React, { useState } from 'react';
import type { AccountSummary, BroadcastMode } from '../types';
import { AccountVoiceSlot } from './AccountVoiceSlot';
import {
  Users,
  User,
  Plus,
  Link,
  Sparkles,
  AlertCircle,
  Zap,
} from 'lucide-react';

interface Props {
  accounts: AccountSummary[];
  broadcastMode: BroadcastMode;
  activeAccountId: string | null;
  onAddAccount: (token: string) => Promise<any>;
  onRemoveAccount: (accountId: string) => void;
  onSelectActiveAccount: (accountId: string) => void;
  onSetBroadcastMode: (mode: BroadcastMode, targetAccountId?: string) => void;
  onDisconnectAll: () => void;
  onJoinChannel: (guildId: string, channelId: string, accountId: string) => void;
  onLeaveChannel: (accountId: string) => void;
  onToggleVoiceMerge: (accountId: string, merged: boolean) => void;
  onSetAllVoiceMerged: (merged: boolean) => void;
  onSetMute: (mute: boolean, accountId: string) => void;
  onSetDeaf: (deaf: boolean, accountId: string) => void;
  errorMessage: string | null;
}

export const MultiAccountCard: React.FC<Props> = ({
  accounts,
  broadcastMode,
  activeAccountId,
  onAddAccount,
  onRemoveAccount,
  onSelectActiveAccount,
  onSetBroadcastMode,
  onDisconnectAll,
  onJoinChannel,
  onLeaveChannel,
  onToggleVoiceMerge,
  onSetAllVoiceMerged,
  onSetMute,
  onSetDeaf,
  errorMessage,
}) => {
  const [tokenInput, setTokenInput] = useState('');
  const [isAdding, setIsAdding] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);

  const handleAddSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!tokenInput.trim() || isAdding) return;

    setLocalError(null);
    setIsAdding(true);
    try {
      await onAddAccount(tokenInput.trim());
      setTokenInput('');
    } catch (err: any) {
      setLocalError(err.message);
    } finally {
      setIsAdding(false);
    }
  };

  const totalSlots = 7;
  const accountsCount = accounts.length;
  const inVoiceCount = accounts.filter((a) => a.voiceState?.isConnected).length;
  const mergedCount = accounts.filter((a) => a.voiceState?.isConnected && a.isVoiceMerged).length;

  return (
    <div className="bg-[#1e1f22] border border-[#2b2d31] rounded-3xl p-6 shadow-2xl relative overflow-hidden backdrop-blur-md space-y-5">
      {/* Background glow */}
      <div className="absolute inset-0 bg-gradient-to-br from-indigo-500/5 via-transparent to-emerald-500/5 pointer-events-none" />

      {/* Header */}
      <div className="relative flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-[#2b2d31]">
        <div className="flex items-center space-x-3">
          <div className="p-3 bg-indigo-500/20 text-indigo-400 border border-indigo-500/30 rounded-2xl shadow-inner">
            <Users className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center space-x-2">
              <h2 className="text-base font-black text-white tracking-wide">
                MULTI-ACCOUNT CONTROLLER
              </h2>
              <span className="text-[10px] font-black px-2 py-0.5 rounded-full bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
                UP TO 7 TOKENS
              </span>
            </div>
            <p className="text-xs text-gray-400 mt-0.5">
              Control each account's channels individually & merge voices together to broadcast simultaneously.
            </p>
          </div>
        </div>

        {/* Slot Counter Pill & Disconnect All */}
        <div className="flex items-center space-x-2">
          <span className="px-3.5 py-1.5 rounded-full text-xs font-mono font-bold bg-[#141518] border border-[#2b2d31] text-gray-300 flex items-center space-x-2">
            <span
              className={`w-2 h-2 rounded-full ${
                accountsCount > 0 ? 'bg-emerald-400 animate-pulse' : 'bg-gray-500'
              }`}
            />
            <span>
              {accountsCount} / {totalSlots} ACTIVE
            </span>
          </span>
          {accountsCount > 0 && (
            <button
              onClick={onDisconnectAll}
              className="px-3 py-1.5 rounded-xl text-xs font-bold bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/30 transition-colors cursor-pointer"
            >
              Disconnect All
            </button>
          )}
        </div>
      </div>

      {/* MERGE VOICE MASTER CONTROLLER BANNER */}
      <div className="relative p-4 rounded-2xl bg-[#141518] border border-[#2b2d31] shadow-inner">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center space-x-3">
            <div
              className={`p-2.5 rounded-xl border ${
                mergedCount > 0
                  ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/40 animate-pulse'
                  : 'bg-[#1e1f22] text-gray-400 border-[#2b2d31]'
              }`}
            >
              <Link className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <span className="text-xs font-black text-white tracking-wide flex items-center space-x-1">
                  <span>VOICE MERGE ENGINE</span>
                  <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                </span>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-[#222429] text-gray-300 border border-[#2b2d31]">
                  {inVoiceCount} In VC • {mergedCount} Merged
                </span>
              </div>
              <p className="text-[11px] text-gray-400 mt-0.5">
                Join both accounts in your server below, then click Merge Voice so all bots connect to your live mic!
              </p>
            </div>
          </div>

          {/* Merge Action Buttons */}
          <div className="flex items-center space-x-2">
            <button
              type="button"
              onClick={() => onSetAllVoiceMerged(true)}
              className="px-4 py-2 rounded-xl text-xs font-black bg-emerald-600 hover:bg-emerald-500 text-white shadow-lg shadow-emerald-600/30 transition-all flex items-center space-x-1.5 cursor-pointer"
            >
              <Zap className="w-3.5 h-3.5" />
              <span>⚡ MERGE VOICE (ALL BOTS)</span>
            </button>
            <button
              type="button"
              onClick={() => onSetAllVoiceMerged(false)}
              className="px-3 py-2 rounded-xl text-xs font-bold bg-[#222429] hover:bg-[#2b2d33] text-gray-400 border border-[#383a40] transition-all cursor-pointer"
            >
              Unmerge All
            </button>
          </div>
        </div>

        {/* Mode Selector Toggle: Group (Merged) vs Individual */}
        <div className="grid grid-cols-2 gap-2 mt-3 pt-3 border-t border-[#222429]">
          <button
            type="button"
            onClick={() => onSetBroadcastMode('group')}
            className={`py-2 px-3 rounded-xl border text-xs font-bold flex items-center justify-center space-x-2 transition-all cursor-pointer ${
              broadcastMode === 'group'
                ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/50 shadow-md shadow-emerald-500/10'
                : 'bg-[#1b1c20] text-gray-400 border-[#2b2d31] hover:text-gray-200'
            }`}
          >
            <Users className="w-4 h-4" />
            <span>GROUP / MERGE VOICE (ALL BOTS)</span>
          </button>

          <button
            type="button"
            onClick={() => onSetBroadcastMode('individual')}
            className={`py-2 px-3 rounded-xl border text-xs font-bold flex items-center justify-center space-x-2 transition-all cursor-pointer ${
              broadcastMode === 'individual'
                ? 'bg-cyan-500/20 text-cyan-300 border-cyan-500/50 shadow-md shadow-cyan-500/10'
                : 'bg-[#1b1c20] text-gray-400 border-[#2b2d31] hover:text-gray-200'
            }`}
          >
            <User className="w-4 h-4" />
            <span>INDIVIDUAL VOICE (TARGET ONLY)</span>
          </button>
        </div>
      </div>

      {/* Add Token Input Bar */}
      <form onSubmit={handleAddSubmit} className="relative">
        <label className="block text-xs font-bold text-gray-300 mb-1.5">
          Add Account Token ({accountsCount}/{totalSlots} Slots Used):
        </label>
        <div className="flex items-center space-x-2">
          <input
            type="password"
            placeholder={
              accountsCount >= totalSlots
                ? 'Maximum 7 accounts reached'
                : 'Paste Discord / Bluecord Account Token...'
            }
            value={tokenInput}
            onChange={(e) => setTokenInput(e.target.value)}
            disabled={accountsCount >= totalSlots || isAdding}
            className="flex-1 px-4 py-2.5 rounded-xl bg-[#141518] border border-[#2b2d31] text-xs text-white placeholder-gray-500 focus:outline-none focus:border-indigo-500 disabled:opacity-40"
          />
          <button
            type="submit"
            disabled={!tokenInput.trim() || accountsCount >= totalSlots || isAdding}
            className="px-5 py-2.5 rounded-xl font-bold text-xs bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 disabled:cursor-not-allowed text-white flex items-center space-x-1.5 transition-all shadow-md shadow-indigo-600/20 cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>{isAdding ? 'Connecting...' : 'Add Account'}</span>
          </button>
        </div>

        {/* Error notification */}
        {(localError || errorMessage) && (
          <div className="mt-2.5 flex items-center space-x-2 p-2.5 rounded-xl bg-red-500/10 border border-red-500/30 text-red-400 text-xs">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{localError || errorMessage}</span>
          </div>
        )}
      </form>

      {/* Account Slots with Specified Channels */}
      <div className="space-y-3">
        <label className="block text-[11px] font-bold text-gray-400 uppercase tracking-wider">
          Connected Accounts & Channel Routers:
        </label>

        {accounts.length === 0 ? (
          <div className="p-8 rounded-2xl border border-dashed border-[#2b2d31] text-center text-gray-500 text-xs">
            <User className="w-8 h-8 mx-auto mb-2 text-gray-600" />
            <p className="font-semibold text-gray-400">No accounts connected yet</p>
            <p className="text-[11px] text-gray-500 mt-0.5">
              Paste a Discord token above to add Account #1 (up to 7 accounts).
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {accounts.map((acc) => (
              <AccountVoiceSlot
                key={acc.id}
                account={acc}
                broadcastMode={broadcastMode}
                isActiveTarget={activeAccountId === acc.id}
                onJoinChannel={onJoinChannel}
                onLeaveChannel={onLeaveChannel}
                onToggleVoiceMerge={onToggleVoiceMerge}
                onSetMute={onSetMute}
                onSetDeaf={onSetDeaf}
                onRemoveAccount={onRemoveAccount}
                onSelectActiveAccount={onSelectActiveAccount}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

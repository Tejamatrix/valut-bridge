import React, { useState, useEffect, useCallback } from 'react';
import type { AccountSummary, GuildData, BroadcastMode } from '../types';
import {
  Radio,
  Mic,
  MicOff,
  Headphones,
  Trash2,
  PhoneCall,
  PhoneOff,
  Link,
  Unlink,
  CheckCircle2,
  Server,
  Loader2,
  RefreshCw,
} from 'lucide-react';

const SERVER_URL = import.meta.env.VITE_SERVER_URL || 'http://localhost:4000';

interface Props {
  account: AccountSummary;
  broadcastMode: BroadcastMode;
  isActiveTarget: boolean;
  onJoinChannel: (guildId: string, channelId: string, accountId: string) => void;
  onLeaveChannel: (accountId: string) => void;
  onToggleVoiceMerge: (accountId: string, merged: boolean) => void;
  onSetMute: (mute: boolean, accountId: string) => void;
  onSetDeaf: (deaf: boolean, accountId: string) => void;
  onRemoveAccount: (accountId: string) => void;
  onSelectActiveAccount: (accountId: string) => void;
}

export const AccountVoiceSlot: React.FC<Props> = ({
  account,
  broadcastMode,
  isActiveTarget,
  onJoinChannel,
  onLeaveChannel,
  onToggleVoiceMerge,
  onSetMute,
  onSetDeaf,
  onRemoveAccount,
  onSelectActiveAccount,
}) => {
  const [guilds, setGuilds] = useState<GuildData[]>([]);
  const [isLoadingGuilds, setIsLoadingGuilds] = useState<boolean>(false);
  const [selectedGuildId, setSelectedGuildId] = useState<string>('');
  const [selectedChannelId, setSelectedChannelId] = useState<string>('');
  const [loadingChannels, setLoadingChannels] = useState<boolean>(false);
  const [manualMode, setManualMode] = useState<boolean>(false);
  const [manualGuildId, setManualGuildId] = useState<string>('');
  const [manualChannelId, setManualChannelId] = useState<string>('');
  const [isJoining, setIsJoining] = useState<boolean>(false);

  const isVoiceConnected = account.voiceState?.isConnected ?? false;
  const isMerged = account.isVoiceMerged;

  // Fetch this account's servers
  const fetchGuilds = useCallback(async () => {
    setIsLoadingGuilds(true);
    try {
      const res = await fetch(`${SERVER_URL}/api/guilds?accountId=${encodeURIComponent(account.id)}`);
      const data = await res.json();
      if (data.success && data.guilds) {
        setGuilds(data.guilds);
      }
    } catch {
      // Ignore
    } finally {
      setIsLoadingGuilds(false);
    }
  }, [account.id]);

  useEffect(() => {
    fetchGuilds();
  }, [fetchGuilds]);

  // Handle server dropdown change
  const handleGuildChange = async (gId: string) => {
    setSelectedGuildId(gId);
    setSelectedChannelId('');
    if (!gId) return;

    setLoadingChannels(true);
    try {
      const res = await fetch(
        `${SERVER_URL}/api/guilds/${gId}/channels?accountId=${encodeURIComponent(account.id)}`
      );
      const data = await res.json();
      if (data.success && data.channels && data.channels.length > 0) {
        setGuilds((prev) =>
          prev.map((g) => (g.id === gId ? { ...g, channels: data.channels } : g))
        );
        setSelectedChannelId(data.channels[0].id);
      }
    } catch {
      // Ignore
    } finally {
      setLoadingChannels(false);
    }
  };

  const handleJoinClick = async () => {
    setIsJoining(true);
    try {
      if (manualMode) {
        if (manualGuildId.trim() && manualChannelId.trim()) {
          await onJoinChannel(manualGuildId.trim(), manualChannelId.trim(), account.id);
        }
      } else {
        if (selectedGuildId && selectedChannelId) {
          await onJoinChannel(selectedGuildId, selectedChannelId, account.id);
        }
      }
    } finally {
      setIsJoining(false);
    }
  };

  const currentGuild = guilds.find((g) => g.id === selectedGuildId);
  const isJoinDisabled =
    isJoining ||
    (manualMode ? !manualGuildId || !manualChannelId : !selectedGuildId || !selectedChannelId);

  return (
    <div
      className={`rounded-2xl border p-4 transition-all ${
        isVoiceConnected
          ? isMerged
            ? 'bg-[#14181f] border-emerald-500/40 shadow-lg shadow-emerald-500/5'
            : 'bg-[#17181c] border-amber-500/30'
          : 'bg-[#141518] border-[#2b2d31]'
      }`}
    >
      {/* Top Row: Account Profile, Voice Status, and Quick Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-[#24262b]">
        {/* Account Identity */}
        <div className="flex items-center space-x-3">
          <div className="px-2.5 py-1 rounded-lg text-xs font-mono font-black bg-[#222429] text-gray-300">
            Slot #{account.slot}
          </div>

          <div className="relative">
            {account.profile.avatarUrl ? (
              <img
                src={account.profile.avatarUrl}
                alt={account.profile.username}
                className="w-10 h-10 rounded-full border border-[#2b2d31]"
              />
            ) : (
              <div className="w-10 h-10 rounded-full bg-indigo-600 text-white flex items-center justify-center font-bold text-sm">
                {account.profile.username.charAt(0).toUpperCase()}
              </div>
            )}
            <span
              className={`absolute bottom-0 right-0 w-3 h-3 rounded-full border-2 border-[#141518] ${
                account.profile.status === 'online' ? 'bg-emerald-400' : 'bg-amber-400'
              }`}
            />
          </div>

          <div>
            <div className="flex items-center space-x-2">
              <span className="text-sm font-black text-white">{account.profile.username}</span>
              <span className="text-xs font-mono text-gray-400">
                #{account.profile.discriminator || '0'}
              </span>
            </div>
            <div className="flex items-center space-x-2 mt-0.5">
              {isVoiceConnected ? (
                <span className="flex items-center space-x-1.5 text-xs font-bold text-emerald-400">
                  <Radio className="w-3.5 h-3.5 animate-spin" />
                  <span>
                    In VC: #{account.voiceState?.channelName || account.voiceState?.channelId}
                  </span>
                </span>
              ) : (
                <span className="text-xs text-gray-500">Not in Voice Channel</span>
              )}
              <span className="text-gray-600">•</span>
              <span className="text-xs font-mono text-gray-400">{account.profile.ping || 0}ms</span>
            </div>
          </div>
        </div>

        {/* Right Side: Active Target Switch & Remove Account */}
        <div className="flex items-center space-x-2 self-end sm:self-auto">
          {broadcastMode === 'individual' && (
            <button
              onClick={() => onSelectActiveAccount(account.id)}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center space-x-1.5 cursor-pointer border ${
                isActiveTarget
                  ? 'bg-cyan-500 text-black border-cyan-400 font-black shadow-md shadow-cyan-500/20'
                  : 'bg-[#222429] hover:bg-[#2b2d33] text-gray-300 border-[#383a40]'
              }`}
            >
              {isActiveTarget ? (
                <>
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  <span>ACTIVE MIC</span>
                </>
              ) : (
                <span>Switch Mic Here</span>
              )}
            </button>
          )}

          <button
            onClick={() => onRemoveAccount(account.id)}
            title="Disconnect Account"
            className="p-2 rounded-xl bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/30 text-xs transition-colors cursor-pointer"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Embedded Channel Controls for this Specific Account */}
      <div className="mt-3">
        {!isVoiceConnected ? (
          /* When NOT in voice: Server and Channel Dropdowns */
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold text-gray-400 tracking-wider uppercase flex items-center space-x-1">
                <Server className="w-3.5 h-3.5 text-indigo-400" />
                <span>Select Server & Voice Channel for Slot #{account.slot}</span>
              </span>
              <div className="flex items-center space-x-2">
                <button
                  type="button"
                  onClick={() => setManualMode(!manualMode)}
                  className={`text-[10px] px-2 py-0.5 rounded border transition-colors ${
                    manualMode
                      ? 'bg-cyan-500/20 border-cyan-500 text-cyan-300'
                      : 'bg-[#222429] border-[#2b2d31] text-gray-400 hover:text-gray-200'
                  }`}
                >
                  {manualMode ? 'ID Mode Active' : 'Paste Channel ID'}
                </button>
                <button
                  type="button"
                  onClick={fetchGuilds}
                  disabled={isLoadingGuilds}
                  title="Refresh servers"
                  className="p-1 rounded bg-[#222429] text-gray-400 hover:text-gray-200"
                >
                  <RefreshCw className={`w-3 h-3 ${isLoadingGuilds ? 'animate-spin' : ''}`} />
                </button>
              </div>
            </div>

            {manualMode ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <input
                  type="text"
                  placeholder="Discord Server (Guild) ID..."
                  value={manualGuildId}
                  onChange={(e) => setManualGuildId(e.target.value)}
                  className="px-3 py-2 bg-[#1b1c20] border border-[#2b2d31] rounded-xl text-xs text-white focus:outline-none focus:border-cyan-400"
                />
                <input
                  type="text"
                  placeholder="Voice Channel ID..."
                  value={manualChannelId}
                  onChange={(e) => setManualChannelId(e.target.value)}
                  className="px-3 py-2 bg-[#1b1c20] border border-[#2b2d31] rounded-xl text-xs text-white focus:outline-none focus:border-cyan-400"
                />
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {/* Server Selector */}
                <div>
                  <select
                    value={selectedGuildId}
                    onChange={(e) => handleGuildChange(e.target.value)}
                    disabled={guilds.length === 0 || isLoadingGuilds}
                    className="w-full px-3 py-2 bg-[#1b1c20] border border-[#2b2d31] rounded-xl text-xs text-white focus:outline-none focus:border-indigo-400 disabled:opacity-40"
                  >
                    <option value="">
                      {guilds.length === 0
                        ? isLoadingGuilds
                          ? 'Loading servers...'
                          : 'No servers found'
                        : '-- Choose a Server --'}
                    </option>
                    {guilds.map((g) => (
                      <option key={g.id} value={g.id}>
                        {g.name}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Voice Channel Selector */}
                <div>
                  <select
                    value={selectedChannelId}
                    onChange={(e) => setSelectedChannelId(e.target.value)}
                    disabled={!selectedGuildId || loadingChannels || !currentGuild || currentGuild.channels.length === 0}
                    className="w-full px-3 py-2 bg-[#1b1c20] border border-[#2b2d31] rounded-xl text-xs text-white focus:outline-none focus:border-indigo-400 disabled:opacity-40"
                  >
                    <option value="">
                      {!selectedGuildId
                        ? 'Select server first'
                        : loadingChannels
                        ? 'Loading channels...'
                        : currentGuild?.channels.length === 0
                        ? 'No voice channels found'
                        : '-- Choose a Voice Channel --'}
                    </option>
                    {currentGuild?.channels.map((ch) => (
                      <option key={ch.id} value={ch.id}>
                        {ch.type === 'stage' ? '🎭 Stage: ' : '🔊 '}
                        {ch.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            )}

            {/* Join Action Button */}
            <div className="flex justify-end pt-1">
              <button
                type="button"
                onClick={handleJoinClick}
                disabled={isJoinDisabled}
                className="flex items-center space-x-1.5 px-4 py-2 rounded-xl text-xs font-bold bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 disabled:cursor-not-allowed text-white shadow-md shadow-emerald-600/20 transition-all cursor-pointer"
              >
                {isJoining ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <PhoneCall className="w-3.5 h-3.5" />
                )}
                <span>{isJoining ? 'Joining...' : `Join Channel (Slot #${account.slot})`}</span>
              </button>
            </div>
          </div>
        ) : (
          /* When IN VOICE: Show Voice Merged Status, Mute/Deafen & Leave controls */
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3 rounded-xl bg-[#1b1c20] border border-[#2b2d31]">
            {/* Left: MERGE VOICE TOGGLE */}
            <div className="flex items-center space-x-3">
              <button
                type="button"
                onClick={() => onToggleVoiceMerge(account.id, !isMerged)}
                className={`px-3 py-2 rounded-xl text-xs font-black transition-all flex items-center space-x-2 border shadow-sm cursor-pointer ${
                  isMerged
                    ? 'bg-emerald-500 text-black border-emerald-400 shadow-emerald-500/20'
                    : 'bg-[#24262c] text-gray-400 border-[#383a40] hover:text-gray-200'
                }`}
              >
                {isMerged ? <Link className="w-4 h-4" /> : <Unlink className="w-4 h-4" />}
                <span>{isMerged ? '🔗 VOICE MERGED (STREAMING MIC)' : 'STANDBY (VOICE UNMERGED)'}</span>
              </button>

              <span className="text-[11px] text-gray-400 hidden sm:inline">
                {isMerged
                  ? 'Broadcasting your live voice into channel'
                  : 'Click to merge into microphone stream'}
              </span>
            </div>

            {/* Right: Mute, Deafen, and Leave Buttons */}
            <div className="flex items-center space-x-2">
              <button
                type="button"
                onClick={() => onSetMute(!account.voiceState?.selfMute, account.id)}
                title={account.voiceState?.selfMute ? 'Unmute account' : 'Self-mute account'}
                className={`p-2 rounded-xl text-xs transition-colors border ${
                  account.voiceState?.selfMute
                    ? 'bg-red-500/20 text-red-400 border-red-500/40'
                    : 'bg-[#24262c] hover:bg-[#2e3037] text-gray-300 border-[#383a40]'
                }`}
              >
                {account.voiceState?.selfMute ? (
                  <MicOff className="w-4 h-4" />
                ) : (
                  <Mic className="w-4 h-4" />
                )}
              </button>

              <button
                type="button"
                onClick={() => onSetDeaf(!account.voiceState?.selfDeaf, account.id)}
                title={account.voiceState?.selfDeaf ? 'Undeafen account' : 'Self-deafen account'}
                className={`p-2 rounded-xl text-xs transition-colors border ${
                  account.voiceState?.selfDeaf
                    ? 'bg-red-500/20 text-red-400 border-red-500/40'
                    : 'bg-[#24262c] hover:bg-[#2e3037] text-gray-300 border-[#383a40]'
                }`}
              >
                <Headphones
                  className={`w-4 h-4 ${
                    account.voiceState?.selfDeaf ? 'text-red-400' : 'text-gray-300'
                  }`}
                />
              </button>

              <button
                type="button"
                onClick={() => onLeaveChannel(account.id)}
                className="flex items-center space-x-1.5 px-3 py-2 rounded-xl text-xs font-bold bg-red-600/80 hover:bg-red-600 text-white border border-red-500 transition-colors cursor-pointer"
              >
                <PhoneOff className="w-3.5 h-3.5" />
                <span>Leave VC</span>
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

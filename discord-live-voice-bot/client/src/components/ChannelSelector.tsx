import React, { useState } from 'react';
import type { GuildData, VoiceStateInfo } from '../types';
import { Volume2, Server, PhoneCall, PhoneOff, ShieldCheck, RefreshCw, Hash, Loader2 } from 'lucide-react';

interface Props {
  guilds: GuildData[];
  voiceState: VoiceStateInfo | null;
  onJoin: (guildId: string, channelId: string) => void;
  onJoinAll?: (guildId: string, channelId: string) => void;
  onLeave: () => void;
  onLeaveAll?: () => void;
  onRefresh: () => void;
  isLoadingGuilds: boolean;
  botConnected: boolean;
  onFetchGuildChannels?: (guildId: string) => Promise<any>;
  accountsCount?: number;
}

export const ChannelSelector: React.FC<Props> = ({
  guilds,
  voiceState,
  onJoin,
  onJoinAll,
  onLeave,
  onLeaveAll,
  onRefresh,
  isLoadingGuilds,
  botConnected,
  onFetchGuildChannels,
  accountsCount = 1,
}) => {
  const [selectedGuildId, setSelectedGuildId] = useState<string>('');
  const [selectedChannelId, setSelectedChannelId] = useState<string>('');
  const [manualMode, setManualMode] = useState<boolean>(false);
  const [manualGuildId, setManualGuildId] = useState<string>('');
  const [manualChannelId, setManualChannelId] = useState<string>('');
  const [loadingChannels, setLoadingChannels] = useState<boolean>(false);

  const currentGuild = guilds.find((g) => g.id === selectedGuildId);
  const isJoined = voiceState?.isConnected ?? false;

  const handleGuildChange = async (gId: string) => {
    setSelectedGuildId(gId);
    setSelectedChannelId('');

    if (!gId) return;

    // Fetch this guild's voice channels on demand
    if (onFetchGuildChannels) {
      setLoadingChannels(true);
      try {
        const channels = await onFetchGuildChannels(gId);
        if (channels && channels.length > 0) {
          setSelectedChannelId(channels[0].id);
        }
      } finally {
        setLoadingChannels(false);
      }
    } else {
      const targetGuild = guilds.find((g) => g.id === gId);
      if (targetGuild && targetGuild.channels.length > 0) {
        setSelectedChannelId(targetGuild.channels[0].id);
      }
    }
  };

  const handleJoinClick = () => {
    if (manualMode) {
      if (manualGuildId.trim() && manualChannelId.trim()) {
        onJoin(manualGuildId.trim(), manualChannelId.trim());
      }
    } else {
      if (selectedGuildId && selectedChannelId) {
        onJoin(selectedGuildId, selectedChannelId);
      }
    }
  };

  const handleJoinAllClick = () => {
    if (!onJoinAll) return;
    if (manualMode) {
      if (manualGuildId.trim() && manualChannelId.trim()) {
        onJoinAll(manualGuildId.trim(), manualChannelId.trim());
      }
    } else {
      if (selectedGuildId && selectedChannelId) {
        onJoinAll(selectedGuildId, selectedChannelId);
      }
    }
  };

  const isJoinDisabled =
    !botConnected ||
    (manualMode ? !manualGuildId || !manualChannelId : !selectedGuildId || !selectedChannelId);

  return (
    <div className="bg-[#1e1f22] border border-[#2b2d31] rounded-2xl p-5 shadow-lg relative backdrop-blur-md">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center space-x-2.5">
          <div className="p-2 bg-emerald-500/10 text-emerald-400 rounded-xl">
            <Volume2 className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-base font-bold text-white tracking-wide">Voice Channel Router</h2>
            <p className="text-xs text-gray-400">Select server & voice channel to broadcast live</p>
          </div>
        </div>

        <div className="flex items-center space-x-2">
          <button
            onClick={() => setManualMode(!manualMode)}
            className={`text-xs px-2.5 py-1 rounded-lg border transition-colors cursor-pointer ${
              manualMode
                ? 'bg-cyan-500/20 border-cyan-500 text-cyan-300'
                : 'bg-[#141518] border-[#2b2d31] text-gray-400 hover:text-gray-200'
            }`}
          >
            {manualMode ? 'ID Direct Active' : 'Paste Channel ID'}
          </button>
          <button
            onClick={onRefresh}
            disabled={!botConnected || isLoadingGuilds}
            className="p-1.5 rounded-lg bg-[#141518] border border-[#2b2d31] text-gray-400 hover:text-gray-200 disabled:opacity-40 cursor-pointer"
            title="Refresh Server List"
          >
            <RefreshCw className={`w-4 h-4 ${isLoadingGuilds ? 'animate-spin text-cyan-400' : ''}`} />
          </button>
        </div>
      </div>

      {/* Voice Status Banner if active */}
      {isJoined && (
        <div className="mb-4 p-3 bg-emerald-500/10 border border-emerald-500/30 rounded-xl flex items-center justify-between">
          <div className="flex items-center space-x-2.5">
            <span className="relative flex h-3 w-3">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-3 w-3 bg-emerald-500"></span>
            </span>
            <div>
              <p className="text-xs text-emerald-400 font-bold uppercase tracking-wider">Broadcasting Voice</p>
              <p className="text-sm font-semibold text-white">
                {voiceState?.guildName || 'Server'} • <span className="text-emerald-300">#{voiceState?.channelName || 'Voice Channel'}</span>
              </p>
            </div>
          </div>

          <div className="flex items-center space-x-2">
            <span className="hidden sm:flex items-center space-x-1 text-[11px] px-2 py-0.5 rounded-md bg-emerald-950/50 border border-emerald-500/40 text-emerald-300">
              <ShieldCheck className="w-3.5 h-3.5" />
              <span>DAVE E2EE</span>
            </span>
            <button
              onClick={onLeave}
              className="flex items-center space-x-1 px-3 py-1.5 text-xs font-bold rounded-lg bg-red-500/20 hover:bg-red-500/30 text-red-400 border border-red-500/40 transition-colors cursor-pointer"
            >
              <PhoneOff className="w-3.5 h-3.5" />
              <span>Leave</span>
            </button>
          </div>
        </div>
      )}

      {manualMode ? (
        /* Manual ID Input */
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-4">
          <div>
            <label className="block text-xs font-medium text-gray-400 mb-1">Guild (Server) ID</label>
            <div className="relative">
              <Server className="w-4 h-4 absolute left-3 top-3 text-gray-500" />
              <input
                type="text"
                placeholder="Paste Server ID (e.g. 11399...)"
                value={manualGuildId}
                onChange={(e) => setManualGuildId(e.target.value)}
                className="w-full pl-9 pr-3 py-2 bg-[#141518] border border-[#2b2d31] rounded-xl text-sm text-white placeholder-gray-600 focus:outline-none focus:border-cyan-400 font-mono text-xs"
              />
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-400 mb-1">Voice Channel ID</label>
            <div className="relative">
              <Hash className="w-4 h-4 absolute left-3 top-3 text-gray-500" />
              <input
                type="text"
                placeholder="Paste Voice Channel ID"
                value={manualChannelId}
                onChange={(e) => setManualChannelId(e.target.value)}
                className="w-full pl-9 pr-3 py-2 bg-[#141518] border border-[#2b2d31] rounded-xl text-sm text-white placeholder-gray-600 focus:outline-none focus:border-cyan-400 font-mono text-xs"
              />
            </div>
          </div>
        </div>
      ) : (
        /* Dropdown Selectors */
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-4">
          {/* Server Selector */}
          <div>
            <label className="block text-xs font-medium text-gray-400 mb-1">Discord Server</label>
            <select
              value={selectedGuildId}
              onChange={(e) => handleGuildChange(e.target.value)}
              disabled={!botConnected || guilds.length === 0}
              className="w-full px-3 py-2.5 bg-[#141518] border border-[#2b2d31] rounded-xl text-sm text-white focus:outline-none focus:border-cyan-400 disabled:opacity-40"
            >
              <option value="">{guilds.length === 0 ? (botConnected ? 'Loading servers...' : 'Connect account first') : '-- Choose a Server --'}</option>
              {guilds.map((g) => (
                <option key={g.id} value={g.id}>
                  {g.name}
                </option>
              ))}
            </select>
          </div>

          {/* Voice Channel Selector */}
          <div>
            <label className="block text-xs font-medium text-gray-400 mb-1 flex items-center justify-between">
              <span>Voice Channel</span>
              {loadingChannels && (
                <span className="flex items-center space-x-1 text-cyan-400 text-[10px]">
                  <Loader2 className="w-3 h-3 animate-spin" />
                  <span>Loading...</span>
                </span>
              )}
            </label>
            <select
              value={selectedChannelId}
              onChange={(e) => setSelectedChannelId(e.target.value)}
              disabled={!selectedGuildId || loadingChannels || !currentGuild || currentGuild.channels.length === 0}
              className="w-full px-3 py-2.5 bg-[#141518] border border-[#2b2d31] rounded-xl text-sm text-white focus:outline-none focus:border-cyan-400 disabled:opacity-40"
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
                  {ch.name} {ch.userLimit ? `[${ch.currentUsers}/${ch.userLimit}]` : `[${ch.currentUsers}]`}
                </option>
              ))}
            </select>
          </div>
        </div>
      )}

      {/* Action Buttons */}
      <div className="flex flex-wrap items-center justify-end gap-2.5">
        {!isJoined ? (
          <>
            <button
              onClick={handleJoinClick}
              disabled={isJoinDisabled}
              className="flex items-center space-x-2 px-4 py-2.5 rounded-xl text-xs font-bold bg-[#2b2d31] hover:bg-[#383a40] disabled:opacity-40 disabled:cursor-not-allowed text-white border border-[#3f4147] transition-all cursor-pointer shadow"
            >
              <PhoneCall className="w-4 h-4 text-emerald-400" />
              <span>Join (Active Account)</span>
            </button>

            {onJoinAll && accountsCount > 1 && (
              <button
                onClick={handleJoinAllClick}
                disabled={isJoinDisabled}
                className="flex items-center space-x-2 px-5 py-2.5 rounded-xl text-xs font-black bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 disabled:cursor-not-allowed text-white shadow-lg shadow-emerald-600/30 transition-all cursor-pointer"
              >
                <PhoneCall className="w-4 h-4" />
                <span>⚡ JOIN ALL ({accountsCount} BOTS)</span>
              </button>
            )}
          </>
        ) : (
          <div className="flex items-center space-x-2">
            <button
              onClick={onLeave}
              className="flex items-center space-x-2 px-4 py-2.5 rounded-xl text-xs font-bold bg-[#2b2d31] hover:bg-[#383a40] text-gray-300 border border-[#3f4147] transition-all cursor-pointer"
            >
              <PhoneOff className="w-4 h-4 text-amber-400" />
              <span>Leave (Active)</span>
            </button>

            {onLeaveAll && accountsCount > 1 && (
              <button
                onClick={onLeaveAll}
                className="flex items-center space-x-2 px-5 py-2.5 rounded-xl text-xs font-bold bg-red-600 hover:bg-red-500 text-white shadow-md shadow-red-600/20 transition-all cursor-pointer"
              >
                <PhoneOff className="w-4 h-4" />
                <span>Disconnect All Bots</span>
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

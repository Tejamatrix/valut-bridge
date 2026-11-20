import React, { useState, useEffect, useCallback } from 'react';
import type { AccountSummary, GuildData } from '../types';
import {
  Server,
  PhoneCall,
  PhoneOff,
  Mic,
  MicOff,
  Headphones,
  Radio,
  Plus,
  Loader2,
  RefreshCw,
  AlertCircle,
  Sparkles,
  Trash2,
  CheckCircle2,
  Users,
} from 'lucide-react';

const SERVER_URL = import.meta.env.VITE_SERVER_URL || 'http://localhost:4000';

interface Props {
  slotNumber: number;
  account?: AccountSummary;
  onAddAccount: (token: string, slot?: number) => Promise<any>;
  onRemoveAccount: (accountId: string) => void;
  onJoinChannel: (guildId: string, channelId: string, accountId: string) => void;
  onLeaveChannel: (accountId: string) => void;
  onSetMute: (mute: boolean, accountId: string) => void;
  onSetDeaf: (deaf: boolean, accountId: string) => void;
}

export const SlotDetailsCard: React.FC<Props> = ({
  slotNumber,
  account,
  onAddAccount,
  onRemoveAccount,
  onJoinChannel,
  onLeaveChannel,
  onSetMute,
  onSetDeaf,
}) => {
  // Token input state for empty slot
  const [tokenInput, setTokenInput] = useState('');
  const [isConnecting, setIsConnecting] = useState(false);
  const [slotError, setSlotError] = useState<string | null>(null);

  // Channel router state for connected slot
  const [guilds, setGuilds] = useState<GuildData[]>([]);
  const [isLoadingGuilds, setIsLoadingGuilds] = useState(false);
  const [selectedGuildId, setSelectedGuildId] = useState('');
  const [selectedChannelId, setSelectedChannelId] = useState('');
  const [loadingChannels, setLoadingChannels] = useState(false);
  const [manualMode, setManualMode] = useState(false);
  const [manualGuildId, setManualGuildId] = useState('');
  const [manualChannelId, setManualChannelId] = useState('');
  const [isJoining, setIsJoining] = useState(false);

  // Invite join state
  const [inviteInput, setInviteInput] = useState('');
  const [isJoiningInvite, setIsJoiningInvite] = useState(false);
  const [inviteMsg, setInviteMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Fetch servers for this specific account
  const fetchGuilds = useCallback(async () => {
    if (!account) return;
    setIsLoadingGuilds(true);
    try {
      const res = await fetch(
        `${SERVER_URL}/api/guilds?accountId=${encodeURIComponent(account.id)}`
      );
      const data = await res.json();
      if (data.success && data.guilds) {
        setGuilds(data.guilds);
        // If nothing selected yet and we have servers, select the first one
        if (!selectedGuildId && data.guilds.length > 0) {
          setSelectedGuildId(data.guilds[0].id);
        }
      }
    } catch {
      // Ignore
    } finally {
      setIsLoadingGuilds(false);
    }
  }, [account, selectedGuildId]);

  useEffect(() => {
    if (account) {
      fetchGuilds();
    } else {
      setGuilds([]);
      setSelectedGuildId('');
      setSelectedChannelId('');
    }
  }, [account, fetchGuilds]);

  // Handle server dropdown change
  const handleGuildChange = async (gId: string) => {
    setSelectedGuildId(gId);
    setSelectedChannelId('');
    if (!gId || !account) return;

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

  const handleJoinInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!account || !inviteInput.trim() || isJoiningInvite) return;
    setIsJoiningInvite(true);
    setInviteMsg(null);
    try {
      const res = await fetch(`${SERVER_URL}/api/accounts/${account.id}/join-invite`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ invite: inviteInput.trim() }),
      });
      const data = await res.json();
      if (data.success) {
        setInviteMsg({ type: 'success', text: 'Successfully joined server!' });
        setInviteInput('');
        fetchGuilds();
      } else {
        setInviteMsg({ type: 'error', text: data.error || 'Failed to join server.' });
      }
    } catch (err: any) {
      setInviteMsg({ type: 'error', text: err.message });
    } finally {
      setIsJoiningInvite(false);
    }
  };

  const handleLeaveGuild = async (guildId: string) => {
    if (!account) return;
    if (!window.confirm('Are you sure you want this account to leave this server?')) return;
    try {
      const res = await fetch(`${SERVER_URL}/api/accounts/${account.id}/leave-guild`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ guildId }),
      });
      const data = await res.json();
      if (data.success) {
        if (selectedGuildId === guildId) {
          setSelectedGuildId('');
          setSelectedChannelId('');
        }
        fetchGuilds();
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleConnectToken = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!tokenInput.trim() || isConnecting) return;

    setSlotError(null);
    setIsConnecting(true);
    try {
      await onAddAccount(tokenInput.trim(), slotNumber);
      setTokenInput('');
    } catch (err: any) {
      setSlotError(err.message);
    } finally {
      setIsConnecting(false);
    }
  };

  const handleJoinClick = async () => {
    if (!account) return;
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

  const isVoiceConnected = account?.voiceState?.isConnected ?? false;
  const currentGuild = guilds.find((g) => g.id === selectedGuildId);
  const isJoinDisabled =
    isJoining ||
    (manualMode ? !manualGuildId || !manualChannelId : !selectedGuildId || !selectedChannelId);

  // If slot is EMPTY: Show Token Connection Card
  if (!account) {
    return (
      <div className="bg-[#18191c] border-2 border-dashed border-[#2b2d31] rounded-3xl p-8 shadow-xl text-center space-y-4">
        <div className="w-14 h-14 mx-auto rounded-2xl bg-amber-400/10 border border-amber-400/30 flex items-center justify-center text-amber-400">
          <Plus className="w-7 h-7" />
        </div>

        <div>
          <h2 className="text-base font-black text-white tracking-wide">
            SLOT 0{slotNumber}: EMPTY SLOT
          </h2>
          <p className="text-xs text-gray-400 mt-1 max-w-md mx-auto">
            Paste your Discord / Bluecord account token below to add Account #0{slotNumber}. You can add up to 5 slots!
          </p>
        </div>

        <form onSubmit={handleConnectToken} className="max-w-xl mx-auto space-y-3 pt-2">
          <div className="flex flex-col sm:flex-row items-center gap-2">
            <input
              type="password"
              placeholder={`Paste Discord / Bluecord Token for Slot 0${slotNumber}...`}
              value={tokenInput}
              onChange={(e) => setTokenInput(e.target.value)}
              disabled={isConnecting}
              className="flex-1 w-full px-4 py-3 rounded-xl bg-[#141518] border border-[#2b2d31] text-xs text-white placeholder-gray-500 focus:outline-none focus:border-amber-400"
            />
            <button
              type="submit"
              disabled={!tokenInput.trim() || isConnecting}
              className="w-full sm:w-auto px-6 py-3 rounded-xl font-black text-xs bg-amber-400 hover:bg-amber-300 disabled:opacity-40 disabled:cursor-not-allowed text-black flex items-center justify-center space-x-2 transition-all shadow-lg shadow-amber-400/20 cursor-pointer"
            >
              {isConnecting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Connecting...</span>
                </>
              ) : (
                <>
                  <Sparkles className="w-4 h-4" />
                  <span>Connect Slot 0{slotNumber}</span>
                </>
              )}
            </button>
          </div>

          {slotError && (
            <div className="flex items-center space-x-2 p-3 rounded-xl bg-red-500/10 border border-red-500/30 text-red-400 text-xs text-left">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{slotError}</span>
            </div>
          )}
        </form>
      </div>
    );
  }

  // If slot HAS AN ACCOUNT: Show Account Info & Channel Router
  return (
    <div className="space-y-4">
      {/* Account Profile Banner (Matching Image Style) */}
      <div className="bg-[#18191c] border-2 border-[#2b2d31] rounded-3xl p-5 shadow-xl flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        {/* Left: Avatar + Username + ID */}
        <div className="flex items-center space-x-4">
          <div className="relative">
            {account.profile.avatarUrl ? (
              <img
                src={account.profile.avatarUrl}
                alt={account.profile.username}
                className="w-14 h-14 rounded-2xl border-2 border-amber-400/40 shadow-md"
              />
            ) : (
              <div className="w-14 h-14 rounded-2xl bg-indigo-600 text-white flex items-center justify-center font-black text-xl">
                {account.profile.username.charAt(0).toUpperCase()}
              </div>
            )}
            <span
              className={`absolute -bottom-1 -right-1 w-4 h-4 rounded-full border-2 border-[#18191c] ${
                account.profile.status === 'online' ? 'bg-emerald-400' : 'bg-amber-400'
              }`}
            />
          </div>

          <div>
            <div className="flex items-center space-x-2">
              <h2 className="text-base font-black text-white tracking-wide">
                {account.profile.username}
              </h2>
              <span className="text-xs font-mono text-gray-400">
                #{account.profile.discriminator || '0'}
              </span>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-amber-400/20 text-amber-300 border border-amber-400/30 uppercase">
                Slot 0{slotNumber}
              </span>
            </div>

            <div className="flex flex-wrap items-center gap-2 mt-1 text-xs text-gray-400 font-mono">
              <span>ID: {account.id}</span>
              <span>•</span>
              <span className="text-gray-300">
                {guilds.length > 0 ? `${guilds.length} Servers Accessible` : 'Discord Account'}
              </span>
              <span>•</span>
              <span className="text-emerald-400 font-bold">{account.profile.ping || 0}ms</span>
            </div>
          </div>
        </div>

        {/* Right: Disconnect Slot Button */}
        <div className="flex items-center space-x-2 self-end sm:self-auto">
          <button
            type="button"
            onClick={() => onRemoveAccount(account.id)}
            className="px-4 py-2 rounded-xl text-xs font-black bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/30 transition-all cursor-pointer"
          >
            DISCONNECT SLOT
          </button>
        </div>
      </div>

      {/* Channel Router & Server Management Card */}
      <div className="bg-[#18191c] border-2 border-[#2b2d31] rounded-3xl p-5 shadow-xl space-y-4">
        {/* + JOIN SERVER VIA INVITE (Matching User UI) */}
        <div className="bg-[#141518] border border-[#2b2d31] rounded-2xl p-3.5 space-y-2.5">
          <div className="flex items-center space-x-1.5 text-xs font-black text-white">
            <Plus className="w-3.5 h-3.5 text-amber-400" />
            <span>+ JOIN SERVER VIA INVITE</span>
          </div>

          <form onSubmit={handleJoinInvite} className="space-y-2">
            <input
              type="text"
              placeholder="discord.gg/xyz or invite code"
              value={inviteInput}
              onChange={(e) => setInviteInput(e.target.value)}
              disabled={isJoiningInvite}
              className="w-full px-3.5 py-2.5 bg-[#18191c] border border-[#2b2d31] rounded-xl text-xs text-white placeholder-gray-500 focus:outline-none focus:border-amber-400"
            />
            <button
              type="submit"
              disabled={!inviteInput.trim() || isJoiningInvite}
              className="w-full py-2.5 px-4 rounded-xl text-xs font-black bg-amber-400 hover:bg-amber-300 disabled:opacity-40 disabled:cursor-not-allowed text-black flex items-center justify-center space-x-1.5 transition-all shadow-md shadow-amber-400/20 cursor-pointer"
            >
              {isJoiningInvite ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  <span>Joining Server...</span>
                </>
              ) : (
                <>
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>AUTO-JOIN SERVER</span>
                </>
              )}
            </button>
          </form>

          {inviteMsg && (
            <div
              className={`p-2 rounded-xl text-xs flex items-center space-x-1.5 ${
                inviteMsg.type === 'success'
                  ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30'
                  : 'bg-red-500/10 text-red-400 border border-red-500/30'
              }`}
            >
              {inviteMsg.type === 'success' ? (
                <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
              ) : (
                <AlertCircle className="w-3.5 h-3.5 shrink-0" />
              )}
              <span>{inviteMsg.text}</span>
            </div>
          )}
        </div>

        {/* JOINED SERVERS LIST (Matching User UI) */}
        <div className="space-y-2">
          <div className="flex items-center justify-between text-xs font-black text-gray-300">
            <div className="flex items-center space-x-1.5">
              <Server className="w-3.5 h-3.5 text-amber-400" />
              <span>JOINED SERVERS ({guilds.length})</span>
            </div>
            <button
              type="button"
              onClick={fetchGuilds}
              disabled={isLoadingGuilds}
              className="p-1 rounded-lg hover:bg-[#222429] text-gray-400 hover:text-white transition-colors cursor-pointer"
              title="Refresh Server List"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isLoadingGuilds ? 'animate-spin' : ''}`} />
            </button>
          </div>

          {guilds.length === 0 ? (
            <div className="p-4 rounded-xl bg-[#141518] border border-[#2b2d31] text-center text-xs text-gray-500">
              {isLoadingGuilds ? 'Loading servers...' : 'No servers found for this account. Join one via invite above!'}
            </div>
          ) : (
            <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1">
              {guilds.map((g) => {
                const isSelected = selectedGuildId === g.id;
                return (
                  <div
                    key={g.id}
                    onClick={() => handleGuildChange(g.id)}
                    className={`flex items-center justify-between p-2 rounded-xl border transition-all cursor-pointer ${
                      isSelected
                        ? 'bg-amber-400/10 border-amber-400 text-white'
                        : 'bg-[#141518] hover:bg-[#1b1c20] border-[#2b2d31] text-gray-300'
                    }`}
                  >
                    <div className="flex items-center space-x-2.5 overflow-hidden">
                      {g.iconUrl ? (
                        <img
                          src={g.iconUrl}
                          alt={g.name}
                          className="w-7 h-7 rounded-lg shrink-0 border border-black/20"
                        />
                      ) : (
                        <div className="w-7 h-7 rounded-lg bg-indigo-600 text-white flex items-center justify-center font-bold text-xs shrink-0">
                          {g.name.charAt(0).toUpperCase()}
                        </div>
                      )}
                      <div className="truncate">
                        <div className="text-xs font-bold truncate">{g.name}</div>
                        <div className="text-[10px] text-gray-400 font-mono flex items-center space-x-1">
                          <Users className="w-2.5 h-2.5" />
                          <span>{g.memberCount ? `${g.memberCount} members` : 'Accessible'}</span>
                        </div>
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleLeaveGuild(g.id);
                      }}
                      title="Leave Server"
                      className="p-1.5 rounded-lg text-gray-400 hover:text-red-400 hover:bg-red-500/10 transition-colors cursor-pointer shrink-0"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* SELECTED SERVER DETAILS & VOICE CONTROLS */}
        {currentGuild && (
          <div className="p-3.5 rounded-2xl bg-[#141518] border border-[#2b2d31] space-y-3">
            {/* Server Header Banner (Matching User UI) */}
            <div className="flex items-center justify-between pb-2 border-b border-[#222429]">
              <div className="flex items-center space-x-2.5 overflow-hidden">
                {currentGuild.iconUrl ? (
                  <img
                    src={currentGuild.iconUrl}
                    alt={currentGuild.name}
                    className="w-8 h-8 rounded-xl shrink-0"
                  />
                ) : (
                  <div className="w-8 h-8 rounded-xl bg-amber-400 text-black flex items-center justify-center font-black text-xs shrink-0">
                    {currentGuild.name.charAt(0).toUpperCase()}
                  </div>
                )}
                <div className="truncate">
                  <div className="text-xs font-black text-white truncate">{currentGuild.name}</div>
                  <div className="text-[10px] text-gray-400 font-mono">
                    ID: {currentGuild.id} • {currentGuild.channels.length} Channels Accessible
                  </div>
                </div>
              </div>

              <button
                type="button"
                onClick={() => handleLeaveGuild(currentGuild.id)}
                className="px-2.5 py-1 rounded-lg text-[10px] font-black bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/30 transition-all cursor-pointer shrink-0"
              >
                LEAVE SERVER
              </button>
            </div>

            {/* If In Voice: Voice State & Self-Mute/Deaf controls */}
            {isVoiceConnected ? (
              <div className="space-y-2 pt-1">
                <div className="flex items-center justify-between">
                  <span className="px-3 py-1 rounded-full text-xs font-black bg-emerald-500/20 text-emerald-400 border border-emerald-500/40 flex items-center space-x-1.5 animate-pulse">
                    <Radio className="w-3.5 h-3.5 animate-spin" />
                    <span>CONNECTED TO: #{account.voiceState?.channelName || account.voiceState?.channelId}</span>
                  </span>

                  <button
                    type="button"
                    onClick={() => onLeaveChannel(account.id)}
                    className="flex items-center space-x-1 px-3 py-1.5 rounded-xl text-xs font-black bg-red-600 hover:bg-red-500 text-white shadow-md shadow-red-600/30 transition-all cursor-pointer"
                  >
                    <PhoneOff className="w-3.5 h-3.5" />
                    <span>LEAVE VC</span>
                  </button>
                </div>

                <div className="flex items-center space-x-2 pt-1">
                  <button
                    type="button"
                    onClick={() => onSetMute(!account.voiceState?.selfMute, account.id)}
                    className={`flex-1 py-2 px-3 rounded-xl text-xs font-bold transition-colors border flex items-center justify-center space-x-1.5 cursor-pointer ${
                      account.voiceState?.selfMute
                        ? 'bg-red-500/20 text-red-400 border-red-500/40'
                        : 'bg-[#18191c] hover:bg-[#222429] text-gray-300 border-[#2b2d31]'
                    }`}
                  >
                    {account.voiceState?.selfMute ? <MicOff className="w-3.5 h-3.5" /> : <Mic className="w-3.5 h-3.5" />}
                    <span>{account.voiceState?.selfMute ? 'MUTED' : 'MUTE'}</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => onSetDeaf(!account.voiceState?.selfDeaf, account.id)}
                    className={`flex-1 py-2 px-3 rounded-xl text-xs font-bold transition-colors border flex items-center justify-center space-x-1.5 cursor-pointer ${
                      account.voiceState?.selfDeaf
                        ? 'bg-red-500/20 text-red-400 border-red-500/40'
                        : 'bg-[#18191c] hover:bg-[#222429] text-gray-300 border-[#2b2d31]'
                    }`}
                  >
                    <Headphones className={`w-3.5 h-3.5 ${account.voiceState?.selfDeaf ? 'text-red-400' : 'text-gray-300'}`} />
                    <span>{account.voiceState?.selfDeaf ? 'DEAFENED' : 'DEAFEN'}</span>
                  </button>
                </div>
              </div>
            ) : (
              /* If Not In Voice: Choose Voice Channel and Join Button */
              <div className="space-y-2 pt-1">
                <label className="block text-xs font-medium text-gray-400 flex items-center justify-between">
                  <span>Voice Channel</span>
                  {loadingChannels && (
                    <span className="text-[10px] text-amber-400 flex items-center space-x-1">
                      <Loader2 className="w-3 h-3 animate-spin" />
                      <span>Loading...</span>
                    </span>
                  )}
                </label>

                <select
                  value={selectedChannelId}
                  onChange={(e) => setSelectedChannelId(e.target.value)}
                  disabled={loadingChannels || currentGuild.channels.length === 0}
                  className="w-full px-3.5 py-2.5 bg-[#18191c] border border-[#2b2d31] rounded-xl text-xs text-white focus:outline-none focus:border-amber-400 disabled:opacity-40"
                >
                  <option value="">
                    {loadingChannels
                      ? 'Loading channels...'
                      : currentGuild.channels.length === 0
                      ? 'No voice channels found'
                      : '-- Choose a Voice Channel --'}
                  </option>
                  {currentGuild.channels.map((ch) => (
                    <option key={ch.id} value={ch.id}>
                      {ch.type === 'stage' ? '🎭 Stage: ' : '🔊 '}
                      {ch.name}
                    </option>
                  ))}
                </select>

                <button
                  type="button"
                  onClick={handleJoinClick}
                  disabled={isJoinDisabled}
                  className="w-full py-2.5 px-4 rounded-xl text-xs font-black bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 disabled:cursor-not-allowed text-white shadow-lg shadow-emerald-600/30 flex items-center justify-center space-x-2 transition-all cursor-pointer"
                >
                  {isJoining ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>Joining...</span>
                    </>
                  ) : (
                    <>
                      <PhoneCall className="w-4 h-4" />
                      <span>JOIN VOICE CHANNEL</span>
                    </>
                  )}
                </button>
              </div>
            )}
          </div>
        )}

        {/* Manual ID Join Option */}
        <div className="pt-1">
          <div className="flex items-center justify-between">
            <button
              type="button"
              onClick={() => setManualMode(!manualMode)}
              className="text-[11px] text-gray-400 hover:text-amber-400 underline transition-colors cursor-pointer"
            >
              {manualMode ? 'Hide Direct ID Mode' : 'Or join by Direct Server & Channel ID'}
            </button>
          </div>

          {manualMode && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mt-2 p-3 bg-[#141518] border border-[#2b2d31] rounded-xl">
              <input
                type="text"
                placeholder="Server (Guild) ID..."
                value={manualGuildId}
                onChange={(e) => setManualGuildId(e.target.value)}
                className="px-3 py-2 bg-[#18191c] border border-[#2b2d31] rounded-lg text-xs text-white focus:outline-none focus:border-amber-400"
              />
              <input
                type="text"
                placeholder="Voice Channel ID..."
                value={manualChannelId}
                onChange={(e) => setManualChannelId(e.target.value)}
                className="px-3 py-2 bg-[#18191c] border border-[#2b2d31] rounded-lg text-xs text-white focus:outline-none focus:border-amber-400"
              />
              <button
                type="button"
                onClick={handleJoinClick}
                disabled={!manualGuildId.trim() || !manualChannelId.trim() || isJoining}
                className="col-span-full py-2 px-3 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 text-white rounded-lg text-xs font-bold cursor-pointer"
              >
                Join by ID
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

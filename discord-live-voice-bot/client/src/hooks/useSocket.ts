import { useState, useEffect, useCallback, useRef } from 'react';
import { io, Socket } from 'socket.io-client';
import type {
  BotProfile,
  VoiceStateInfo,
  StreamStats,
  GuildData,
  TestBeepState,
  TestBeepOptions,
  MultiAccountState,
  BroadcastMode,
} from '../types';

const SERVER_URL = import.meta.env.VITE_SERVER_URL || 'http://localhost:4000';

export function useSocket() {
  const [isConnected, setIsConnected] = useState(false);
  const [latencyMs, setLatencyMs] = useState(0);
  const [multiAccountState, setMultiAccountState] = useState<MultiAccountState>({
    broadcastMode: 'group',
    activeAccountId: null,
    accounts: [],
    maxSlots: 7,
  });
  const [botProfile, setBotProfile] = useState<BotProfile | null>(null);
  const [voiceState, setVoiceState] = useState<VoiceStateInfo | null>(null);
  const [streamStats, setStreamStats] = useState<StreamStats | null>(null);
  const [beepState, setBeepState] = useState<TestBeepState>({
    active: false,
    freq: 2800,
    wave: 'square',
    durationMs: 1500,
    gain: 1.0,
  });
  const [guilds, setGuilds] = useState<GuildData[]>([]);
  const [isLoadingGuilds, setIsLoadingGuilds] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const socketRef = useRef<Socket | null>(null);

  const refreshGuilds = useCallback(async (accountId?: string) => {
    setIsLoadingGuilds(true);
    try {
      const url = accountId
        ? `${SERVER_URL}/api/guilds?accountId=${encodeURIComponent(accountId)}`
        : `${SERVER_URL}/api/guilds`;
      const res = await fetch(url);
      const data = await res.json();
      if (data.success && data.guilds) {
        setGuilds(data.guilds);
      }
    } catch (e) {
      // Account might not be logged in yet
    } finally {
      setIsLoadingGuilds(false);
    }
  }, []);

  useEffect(() => {
    const socket = io(SERVER_URL, {
      transports: ['websocket', 'polling'],
      reconnectionAttempts: 15,
      reconnectionDelay: 1000,
    });

    socketRef.current = socket;

    socket.on('connect', () => {
      setIsConnected(true);
      setErrorMessage(null);
      console.log('[Socket] Connected to backend');
      refreshGuilds();
    });

    socket.on('disconnect', () => {
      setIsConnected(false);
      console.log('[Socket] Disconnected from backend');
    });

    socket.on('multi_account_state', (state: MultiAccountState) => {
      setMultiAccountState(state);
      // Auto-refresh guilds if active account changed
      if (state.activeAccountId) {
        refreshGuilds(state.activeAccountId);
      }
    });

    socket.on('bot_profile', (profile: BotProfile | null) => {
      setBotProfile(profile);
      if (profile && profile.status === 'online') {
        refreshGuilds();
      }
    });

    socket.on('voice_state', (state: VoiceStateInfo) => {
      setVoiceState(state);
    });

    socket.on('stream_stats', (stats: StreamStats) => {
      setStreamStats(stats);
    });

    socket.on('beep_state', (state: TestBeepState) => {
      setBeepState(state);
    });

    socket.on('bot_error', (msg: string) => {
      setErrorMessage(msg);
    });

    // Ping / Latency measure interval
    const pingInterval = setInterval(() => {
      if (socket.connected) {
        const start = performance.now();
        socket.emit('ping_measure', Date.now(), () => {
          const delta = Math.round(performance.now() - start);
          setLatencyMs(delta);
        });
      }
    }, 2000);

    return () => {
      clearInterval(pingInterval);
      socket.disconnect();
    };
  }, [refreshGuilds]);

  const fetchGuildChannels = useCallback(async (guildId: string, accountId?: string) => {
    try {
      const url = accountId
        ? `${SERVER_URL}/api/guilds/${guildId}/channels?accountId=${encodeURIComponent(accountId)}`
        : `${SERVER_URL}/api/guilds/${guildId}/channels`;
      const res = await fetch(url);
      const data = await res.json();
      if (data.success && data.channels) {
        setGuilds((prev) =>
          prev.map((g) => (g.id === guildId ? { ...g, channels: data.channels } : g))
        );
        return data.channels;
      }
    } catch (e) {}
    return [];
  }, []);

  // Multi-Account Operations
  const addAccount = useCallback(async (token: string, slot?: number) => {
    setErrorMessage(null);
    try {
      const res = await fetch(`${SERVER_URL}/api/accounts/add`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, slot }),
      });
      const data = await res.json();
      if (!data.success) {
        throw new Error(data.error || 'Failed to add account token.');
      }
      if (data.multiAccount) {
        setMultiAccountState(data.multiAccount);
      }
      await refreshGuilds(data.account?.id);
      return data.account;
    } catch (err: any) {
      setErrorMessage(err.message);
      throw err;
    }
  }, [refreshGuilds]);

  const removeAccount = useCallback(async (accountId: string) => {
    setErrorMessage(null);
    try {
      const res = await fetch(`${SERVER_URL}/api/accounts/${encodeURIComponent(accountId)}`, {
        method: 'DELETE',
      });
      const data = await res.json();
      if (!data.success) {
        throw new Error(data.error || 'Failed to remove account.');
      }
      if (data.multiAccount) {
        setMultiAccountState(data.multiAccount);
      }
    } catch (err: any) {
      setErrorMessage(err.message);
    }
  }, []);

  const setActiveAccount = useCallback((accountId: string) => {
    if (!socketRef.current) return;
    setErrorMessage(null);
    socketRef.current.emit('set_active_account', { accountId }, (res: any) => {
      if (res && !res.success) {
        setErrorMessage(res.error);
      } else if (res && res.state) {
        setMultiAccountState(res.state);
        refreshGuilds(accountId);
      }
    });
  }, [refreshGuilds]);

  const setBroadcastMode = useCallback((mode: BroadcastMode, targetAccountId?: string) => {
    if (!socketRef.current) return;
    setErrorMessage(null);
    socketRef.current.emit('set_broadcast_mode', { mode, targetAccountId }, (res: any) => {
      if (res && !res.success) {
        setErrorMessage(res.error);
      } else if (res && res.state) {
        setMultiAccountState(res.state);
      }
    });
  }, []);

  const setAccountVoiceMerged = useCallback((accountId: string, merged: boolean) => {
    if (!socketRef.current) return;
    setErrorMessage(null);
    socketRef.current.emit('set_voice_merge', { accountId, merged }, (res: any) => {
      if (res && !res.success) {
        setErrorMessage(res.error);
      } else if (res && res.state) {
        setMultiAccountState(res.state);
      }
    });
  }, []);

  const setAllVoiceMerged = useCallback((merged: boolean) => {
    if (!socketRef.current) return;
    setErrorMessage(null);
    socketRef.current.emit('set_all_voice_merge', { merged }, (res: any) => {
      if (res && !res.success) {
        setErrorMessage(res.error);
      } else if (res && res.state) {
        setMultiAccountState(res.state);
      }
    });
  }, []);

  // Backward compatibility: loginWithToken maps to addAccount
  const loginWithToken = useCallback(async (token: string) => {
    return addAccount(token);
  }, [addAccount]);

  const disconnectBot = useCallback(async () => {
    try {
      await fetch(`${SERVER_URL}/api/auth/disconnect`, { method: 'POST' });
      setBotProfile(null);
      setVoiceState(null);
      setGuilds([]);
      setMultiAccountState({
        broadcastMode: 'group',
        activeAccountId: null,
        accounts: [],
        maxSlots: 7,
      });
    } catch (err: any) {
      setErrorMessage(err.message);
    }
  }, []);

  const joinChannel = useCallback((guildId: string, channelId: string, accountId?: string) => {
    if (!socketRef.current) return;
    setErrorMessage(null);
    socketRef.current.emit('join_channel', { guildId, channelId, accountId }, (res: any) => {
      if (res && !res.success) {
        setErrorMessage(res.error);
      }
    });
  }, []);

  const joinAllChannels = useCallback((guildId: string, channelId: string) => {
    if (!socketRef.current) return;
    setErrorMessage(null);
    socketRef.current.emit('join_all_channel', { guildId, channelId }, (res: any) => {
      if (res && !res.success) {
        setErrorMessage(res.error);
      }
    });
  }, []);

  const leaveChannel = useCallback((accountId?: string) => {
    if (!socketRef.current) return;
    socketRef.current.emit('leave_channel', { accountId }, (res: any) => {
      if (res && !res.success) {
        setErrorMessage(res.error);
      }
    });
  }, []);

  const leaveAllChannels = useCallback(() => {
    if (!socketRef.current) return;
    socketRef.current.emit('leave_channel', {}, (res: any) => {
      if (res && !res.success) {
        setErrorMessage(res.error);
      }
    });
  }, []);

  const setMute = useCallback((mute: boolean, accountId?: string) => {
    if (!socketRef.current) return;
    socketRef.current.emit('set_mute', { mute, accountId });
  }, []);

  const setDeaf = useCallback((deaf: boolean, accountId?: string) => {
    if (!socketRef.current) return;
    socketRef.current.emit('set_deaf', { deaf, accountId });
  }, []);

  const setVolume = useCallback((volume: number, accountId?: string) => {
    if (!socketRef.current || !socketRef.current.connected) return;
    socketRef.current.emit('set_volume', { volume, accountId });
  }, []);

  const sendAudioChunk = useCallback((chunk: ArrayBuffer) => {
    if (socketRef.current && socketRef.current.connected) {
      socketRef.current.emit('audio_chunk', chunk);
    }
  }, []);

  const sendPttState = useCallback((speaking: boolean) => {
    if (socketRef.current && socketRef.current.connected) {
      socketRef.current.emit('ptt_state', speaking);
    }
  }, []);

  const startTestBeep = useCallback((options?: TestBeepOptions) => {
    if (!socketRef.current || !socketRef.current.connected) return;
    socketRef.current.emit('start_test_beep', options, (res: any) => {
      if (res && !res.success) {
        setErrorMessage(res.error || 'Failed to start test beep');
      }
    });
  }, []);

  const stopTestBeep = useCallback(() => {
    if (!socketRef.current || !socketRef.current.connected) return;
    socketRef.current.emit('stop_test_beep', (res: any) => {
      if (res && !res.success) {
        setErrorMessage(res.error || 'Failed to stop test beep');
      }
    });
  }, []);

  return {
    isConnected,
    latencyMs,
    multiAccountState,
    accounts: multiAccountState.accounts,
    broadcastMode: multiAccountState.broadcastMode,
    activeAccountId: multiAccountState.activeAccountId,
    botProfile,
    voiceState,
    streamStats,
    beepState,
    guilds,
    isLoadingGuilds,
    errorMessage,
    setErrorMessage,
    addAccount,
    removeAccount,
    setActiveAccount,
    setBroadcastMode,
    setAccountVoiceMerged,
    setAllVoiceMerged,
    loginWithToken,
    disconnectBot,
    joinChannel,
    joinAllChannels,
    leaveChannel,
    leaveAllChannels,
    setMute,
    setDeaf,
    setVolume,
    sendAudioChunk,
    sendPttState,
    startTestBeep,
    stopTestBeep,
    refreshGuilds,
    fetchGuildChannels,
  };
}

import express from 'express';
import http from 'node:http';
import path from 'node:path';
import fs from 'node:fs';
import { Server as SocketIOServer } from 'socket.io';
import cors from 'cors';
import { config } from './config.js';
import { DiscordBotManager } from './discord/botManager.js';
import { createApiRouter } from './routes/api.js';

const app = express();
const server = http.createServer(app);

// Enable CORS for dashboard
app.use(cors({
  origin: '*',
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
}));
app.use(express.json());

// Initialize Multi-Account Discord Bot Manager
const botManager = new DiscordBotManager();

// Mount REST routes
app.use('/api', createApiRouter(botManager));

// Serve production client build if exists
const clientDistPath = path.resolve(process.cwd(), 'client', 'dist');
if (fs.existsSync(clientDistPath)) {
  console.log(`[App] Serving production frontend build from: ${clientDistPath}`);
  app.use(express.static(clientDistPath));
  // Express 5 catch-all for SPA
  app.use((req, res, next) => {
    if (req.method === 'GET' && !req.path.startsWith('/api') && !req.path.startsWith('/socket.io')) {
      return res.sendFile(path.join(clientDistPath, 'index.html'));
    }
    next();
  });
}

// Initialize Socket.io with binary transport enabled
const io = new SocketIOServer(server, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST'],
  },
  maxHttpBufferSize: 1e7, // 10MB binary chunks supported
  pingInterval: 10000,
  pingTimeout: 5000,
});

io.on('connection', (socket) => {
  console.log(`[Socket.io] Client connected: ${socket.id}`);

  // Send initial state on connection
  socket.emit('multi_account_state', botManager.getMultiAccountState());
  socket.emit('bot_profile', botManager.getBotProfile());
  const vm = botManager.getVoiceManager();
  if (vm) {
    socket.emit('voice_state', vm.getState());
  }
  socket.emit('stream_stats', botManager.getAggregatedStreamStats());
  socket.emit('beep_state', botManager.getBeepState());

  // Real-time binary audio stream chunk from browser microphone
  // (Transmits to ALL accounts in Group mode, or Active account in Individual mode)
  socket.on('audio_chunk', (chunk: Buffer | ArrayBuffer) => {
    botManager.pushAudioChunk(chunk);
  });

  // Push-to-Talk / Toggle-to-Speak state change
  socket.on('ptt_state', (speaking: boolean) => {
    botManager.setSpeakingState(Boolean(speaking));
    io.emit('ptt_active', Boolean(speaking));
  });

  // Test Beep Sound Generation (High-Pitch, Loud Test Play)
  socket.on('start_test_beep', (options: any, callback) => {
    try {
      const state = botManager.startBeep(options);
      io.emit('beep_state', state);
      if (typeof callback === 'function') callback({ success: true, state });
    } catch (err: any) {
      if (typeof callback === 'function') callback({ success: false, error: err.message });
    }
  });

  socket.on('stop_test_beep', (callback) => {
    try {
      const state = botManager.stopBeep();
      io.emit('beep_state', state);
      if (typeof callback === 'function') callback({ success: true, state });
    } catch (err: any) {
      if (typeof callback === 'function') callback({ success: false, error: err.message });
    }
  });

  // Multi-Account Controls
  socket.on('add_account', async ({ token, slot }, callback) => {
    try {
      const summary = await botManager.addAccount(token, slot);
      io.emit('multi_account_state', botManager.getMultiAccountState());
      if (typeof callback === 'function') callback({ success: true, account: summary });
    } catch (err: any) {
      if (typeof callback === 'function') callback({ success: false, error: err.message });
    }
  });

  socket.on('remove_account', async ({ accountId }, callback) => {
    try {
      await botManager.removeAccount(accountId);
      io.emit('multi_account_state', botManager.getMultiAccountState());
      if (typeof callback === 'function') callback({ success: true });
    } catch (err: any) {
      if (typeof callback === 'function') callback({ success: false, error: err.message });
    }
  });

  socket.on('set_active_account', ({ accountId }, callback) => {
    try {
      const state = botManager.setActiveAccount(accountId);
      io.emit('multi_account_state', state);
      io.emit('bot_profile', botManager.getBotProfile());
      if (typeof callback === 'function') callback({ success: true, state });
    } catch (err: any) {
      if (typeof callback === 'function') callback({ success: false, error: err.message });
    }
  });

  socket.on('set_broadcast_mode', ({ mode, targetAccountId }, callback) => {
    try {
      const state = botManager.setBroadcastMode(mode, targetAccountId);
      io.emit('multi_account_state', state);
      if (typeof callback === 'function') callback({ success: true, state });
    } catch (err: any) {
      if (typeof callback === 'function') callback({ success: false, error: err.message });
    }
  });

  socket.on('set_voice_merge', ({ accountId, merged }, callback) => {
    try {
      const state = botManager.setAccountVoiceMerged(accountId, merged);
      io.emit('multi_account_state', state);
      if (typeof callback === 'function') callback({ success: true, state });
    } catch (err: any) {
      if (typeof callback === 'function') callback({ success: false, error: err.message });
    }
  });

  socket.on('set_all_voice_merge', ({ merged }, callback) => {
    try {
      const state = botManager.setAllVoiceMerged(merged);
      io.emit('multi_account_state', state);
      if (typeof callback === 'function') callback({ success: true, state });
    } catch (err: any) {
      if (typeof callback === 'function') callback({ success: false, error: err.message });
    }
  });

  // Roundtrip latency measure
  socket.on('ping_measure', (clientTime: number, callback: (serverTime: number) => void) => {
    if (typeof callback === 'function') {
      callback(Date.now());
    }
  });

  // Quick voice channel actions via socket
  socket.on('fetch_guild_channels', async ({ guildId, accountId }, callback) => {
    try {
      const channels = await botManager.getGuildChannels(guildId, accountId);
      if (typeof callback === 'function') callback({ success: true, channels });
    } catch (err: any) {
      if (typeof callback === 'function') callback({ success: false, error: err.message });
    }
  });

  socket.on('join_channel', async ({ guildId, channelId, accountId }, callback) => {
    try {
      const targetId = accountId || botManager.getActiveSession()?.id;
      if (!targetId) throw new Error('No account available to join voice channel.');
      const state = await botManager.joinChannel(targetId, guildId, channelId);
      io.emit('voice_state', botManager.getVoiceManager()?.getState() || state);
      io.emit('multi_account_state', botManager.getMultiAccountState());
      if (typeof callback === 'function') callback({ success: true, state });
    } catch (err: any) {
      if (typeof callback === 'function') callback({ success: false, error: err.message });
    }
  });

  socket.on('join_all_channel', async ({ guildId, channelId }, callback) => {
    try {
      const states = await botManager.joinAllToChannel(guildId, channelId);
      io.emit('multi_account_state', botManager.getMultiAccountState());
      io.emit('voice_state', botManager.getVoiceManager()?.getState() || null);
      if (typeof callback === 'function') callback({ success: true, states });
    } catch (err: any) {
      if (typeof callback === 'function') callback({ success: false, error: err.message });
    }
  });

  socket.on('leave_channel', async ({ accountId }, callback) => {
    try {
      if (accountId) {
        const state = await botManager.leaveChannel(accountId);
        io.emit('multi_account_state', botManager.getMultiAccountState());
        if (typeof callback === 'function') callback({ success: true, state });
      } else {
        await botManager.leaveAllChannels();
        io.emit('multi_account_state', botManager.getMultiAccountState());
        if (typeof callback === 'function') callback({ success: true });
      }
    } catch (err: any) {
      if (typeof callback === 'function') callback({ success: false, error: err.message });
    }
  });

  socket.on('set_mute', ({ accountId, mute }: { accountId?: string; mute: boolean }) => {
    if (accountId) {
      botManager.setSelfMute(accountId, mute);
    } else {
      botManager.setAllSelfMute(mute);
    }
    io.emit('multi_account_state', botManager.getMultiAccountState());
  });

  socket.on('set_deaf', ({ accountId, deaf }: { accountId?: string; deaf: boolean }) => {
    if (accountId) {
      botManager.setSelfDeaf(accountId, deaf);
    } else {
      botManager.setAllSelfDeaf(deaf);
    }
    io.emit('multi_account_state', botManager.getMultiAccountState());
  });

  socket.on('join_invite', async ({ accountId, invite }, callback) => {
    try {
      const targetId = accountId || botManager.getActiveSession()?.id;
      if (!targetId) throw new Error('No account available.');
      const result = await botManager.joinGuildViaInvite(targetId, invite);
      if (typeof callback === 'function') callback({ success: true, result });
    } catch (err: any) {
      if (typeof callback === 'function') callback({ success: false, error: err.message });
    }
  });

  socket.on('leave_guild', async ({ accountId, guildId }, callback) => {
    try {
      const targetId = accountId || botManager.getActiveSession()?.id;
      if (!targetId) throw new Error('No account available.');
      await botManager.leaveGuild(targetId, guildId);
      if (typeof callback === 'function') callback({ success: true });
    } catch (err: any) {
      if (typeof callback === 'function') callback({ success: false, error: err.message });
    }
  });

  socket.on('set_volume', ({ volume, accountId }: { volume: number; accountId?: string }) => {
    botManager.setOutputVolume(volume, accountId);
    io.emit('volume_changed', { volume, accountId });
  });

  socket.on('disconnect', () => {
    console.log(`[Socket.io] Client disconnected: ${socket.id}`);
  });
});

// Broadcast bot state updates
botManager.on('accounts_changed', (state) => {
  io.emit('multi_account_state', state);
  io.emit('bot_profile', botManager.getBotProfile());
  const vm = botManager.getVoiceManager();
  if (vm) io.emit('voice_state', vm.getState());
});

botManager.on('voiceStateChange', () => {
  io.emit('multi_account_state', botManager.getMultiAccountState());
  const vm = botManager.getVoiceManager();
  if (vm) io.emit('voice_state', vm.getState());
});

botManager.on('beep_state', (beepState) => {
  io.emit('beep_state', beepState);
});

botManager.on('accountError', ({ slot, error }) => {
  io.emit('bot_error', `Slot #${slot} Error: ${error}`);
});

// Periodic heartbeat & stats broadcast every 500ms
setInterval(() => {
  io.emit('stream_stats', botManager.getAggregatedStreamStats());
  const vm = botManager.getVoiceManager();
  if (vm) {
    io.emit('voice_state', vm.getState());
  }
}, 500);

// Auto-login if defaultBotToken configured in .env
if (config.defaultBotToken) {
  console.log('[App] DISCORD_BOT_TOKEN found in environment. Attempting automatic login for Slot #1...');
  botManager.addAccount(config.defaultBotToken).catch((err) => {
    console.warn('[App] Automatic login failed:', err.message);
  });
}

server.listen(config.port, () => {
  console.log(`
=============================================================
  DISCORD LIVE VOICE BOT - MULTI-ACCOUNT BROADCASTER (UP TO 7)
=============================================================
  Backend Server running on: http://localhost:${config.port}
  Multi-Account Engine:      Active (Up to 7 Discord Tokens)
  Broadcast Modes:           Group Voice (All) & Individual
  Socket.io Binary Stream:   Enabled (48kHz 16-bit PCM Stereo)
  Discord DAVE Protocol:     Enabled natively
=============================================================
  `);
});

// Graceful shutdown
process.on('SIGINT', async () => {
  console.log('\n[App] Gracefully shutting down...');
  await botManager.disconnectAll();
  process.exit(0);
});

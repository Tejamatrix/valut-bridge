import { Client } from 'discord.js-selfbot-v13';
import { EventEmitter } from 'node:events';
import { DiscordVoiceManager, VoiceStateInfo } from './voiceManager.js';
import { LiveAudioStreamer, TestBeepOptions, TestBeepState, StreamStats } from '../audio/audioStreamer.js';

export interface BotProfile {
  id: string;
  username: string;
  discriminator: string;
  tag: string;
  avatarUrl: string | null;
  status: 'online' | 'offline' | 'connecting' | 'error';
  ping: number;
  guildCount: number;
  isUserAccount: boolean;
}

export interface VoiceChannelData {
  id: string;
  name: string;
  type: 'voice' | 'stage';
  userLimit: number;
  currentUsers: number;
}

export interface GuildData {
  id: string;
  name: string;
  iconUrl: string | null;
  channels: VoiceChannelData[];
  memberCount?: number;
}

export type BroadcastMode = 'group' | 'individual';

export interface AccountSession {
  id: string;
  slot: number;
  token: string;
  client: Client;
  streamer: LiveAudioStreamer;
  voiceManager: DiscordVoiceManager;
  profile: BotProfile;
  isVoiceMerged: boolean;
}

export interface AccountSummary {
  id: string;
  slot: number;
  profile: BotProfile;
  voiceState: VoiceStateInfo | null;
  isActive: boolean;
  isVoiceMerged: boolean;
}

export interface MultiAccountState {
  broadcastMode: BroadcastMode;
  activeAccountId: string | null;
  accounts: AccountSummary[];
  maxSlots: number;
}

export class DiscordBotManager extends EventEmitter {
  public static readonly MAX_SLOTS = 5;

  private sessions: Map<string, AccountSession> = new Map();
  private activeAccountId: string | null = null;
  private broadcastMode: BroadcastMode = 'group';

  constructor() {
    super();
  }

  public getBroadcastMode(): BroadcastMode {
    return this.broadcastMode;
  }

  public setBroadcastMode(mode: BroadcastMode, targetAccountId?: string): MultiAccountState {
    this.broadcastMode = mode;
    if (targetAccountId && this.sessions.has(targetAccountId)) {
      this.activeAccountId = targetAccountId;
    }
    console.log(`[AccountManager] Broadcast mode switched to: ${mode.toUpperCase()} (Active target: ${this.activeAccountId || 'None'})`);
    this.emitAccountsChanged();
    return this.getMultiAccountState();
  }

  public setActiveAccount(accountId: string): MultiAccountState {
    if (this.sessions.has(accountId)) {
      this.activeAccountId = accountId;
      console.log(`[AccountManager] Active target account set to: ${this.sessions.get(accountId)?.profile.username} (${accountId})`);
      this.emitAccountsChanged();
    }
    return this.getMultiAccountState();
  }

  public getActiveSession(): AccountSession | null {
    if (this.activeAccountId && this.sessions.has(this.activeAccountId)) {
      return this.sessions.get(this.activeAccountId)!;
    }
    const first = this.sessions.values().next().value;
    return first || null;
  }

  public getSession(accountId: string): AccountSession | null {
    return this.sessions.get(accountId) || null;
  }

  public getSessions(): AccountSession[] {
    return Array.from(this.sessions.values()).sort((a, b) => a.slot - b.slot);
  }

  private findNextAvailableSlot(): number {
    const usedSlots = new Set(Array.from(this.sessions.values()).map((s) => s.slot));
    for (let slot = 1; slot <= DiscordBotManager.MAX_SLOTS; slot++) {
      if (!usedSlots.has(slot)) return slot;
    }
    return 1;
  }

  public async addAccount(token: string, targetSlot?: number): Promise<AccountSummary> {
    const slot = targetSlot && targetSlot >= 1 && targetSlot <= DiscordBotManager.MAX_SLOTS
      ? targetSlot
      : this.findNextAvailableSlot();

    // If an account is already occupying this specific slot, remove it first cleanly
    const existingInSlot = Array.from(this.sessions.values()).find((s) => s.slot === slot);
    if (existingInSlot) {
      await this.removeAccount(existingInSlot.id);
    }

    if (this.sessions.size >= DiscordBotManager.MAX_SLOTS) {
      throw new Error(`Maximum limit of ${DiscordBotManager.MAX_SLOTS} accounts reached. Please disconnect an account first.`);
    }

    let trimmed = token.trim();
    if ((trimmed.startsWith('"') && trimmed.endsWith('"')) || (trimmed.startsWith("'") && trimmed.endsWith("'"))) {
      trimmed = trimmed.slice(1, -1).trim();
    }
    if (trimmed.startsWith('DISCORD_TOKEN=')) trimmed = trimmed.replace('DISCORD_TOKEN=', '').trim();
    if (trimmed.startsWith('TOKEN=')) trimmed = trimmed.replace('TOKEN=', '').trim();

    if (!trimmed) {
      throw new Error('Discord token cannot be empty.');
    }

    // Verify token with Discord REST API first
    const checkUserRes = await fetch('https://discord.com/api/v9/users/@me', {
      headers: {
        Authorization: trimmed,
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) discord/1.0.9210 Chrome/134.0.6998.205 Electron/35.3.0 Safari/537.36',
      },
    });

    let userData: any = null;
    let isBotToken = false;

    if (checkUserRes.ok) {
      userData = await checkUserRes.json();
    } else {
      // Check bot token
      const botCheckRes = await fetch('https://discord.com/api/v9/users/@me', {
        headers: {
          Authorization: trimmed.startsWith('Bot ') ? trimmed : `Bot ${trimmed}`,
        },
      });
      if (botCheckRes.ok) {
        trimmed = trimmed.startsWith('Bot ') ? trimmed : `Bot ${trimmed}`;
        userData = await botCheckRes.json();
        isBotToken = true;
      } else {
        throw new Error(
          `Discord rejected this token (${checkUserRes.status} Unauthorized). Please make sure you copied the token correctly from Bluecord Settings -> Account -> Copy Token.`
        );
      }
    }

    const userId = userData.id;

    // Check if account is already added
    if (this.sessions.has(userId)) {
      const existing = this.sessions.get(userId)!;
      throw new Error(`Account "${existing.profile.username}" is already connected in Slot #${existing.slot}.`);
    }

    console.log(`[AccountManager] Adding Account in Slot #${slot}: ${userData.username}#${userData.discriminator || '0'} (ID: ${userId})`);

    // Create dedicated audio streamer and client for this account
    const streamer = new LiveAudioStreamer();
    const client = new (Client as any)({
      checkUpdate: false,
      autoRedeemNitro: false,
    }) as Client;

    let voiceManager: DiscordVoiceManager | null = null;

    const initialProfile: BotProfile = {
      id: userId,
      username: userData.username,
      discriminator: userData.discriminator || '0',
      tag: `${userData.username}#${userData.discriminator || '0'}`,
      avatarUrl: userData.avatar
        ? `https://cdn.discordapp.com/avatars/${userId}/${userData.avatar}.png`
        : null,
      status: 'connecting',
      ping: 0,
      guildCount: 0,
      isUserAccount: !isBotToken,
    };

    const session: AccountSession = {
      id: userId,
      slot,
      token: trimmed,
      client,
      streamer,
      voiceManager: null as any, // Set after client ready or init
      profile: initialProfile,
      isVoiceMerged: true, // Default to voice merged
    };

    // Setup client events
    client.on('ready', async () => {
      console.log(`[AccountManager][Slot #${slot}] Connected to Gateway as ${client.user?.tag} (ID: ${client.user?.id})`);
      voiceManager = new DiscordVoiceManager(client, streamer);
      session.voiceManager = voiceManager;

      voiceManager.on('voiceStateChange', (state) => {
        this.emit('voiceStateChange', { accountId: userId, slot, state });
        this.emitAccountsChanged();
      });

      session.profile = {
        id: client.user!.id,
        username: client.user!.username,
        discriminator: client.user!.discriminator || '0',
        tag: client.user!.tag || client.user!.username,
        avatarUrl: client.user!.displayAvatarURL({ dynamic: true, size: 128 }),
        status: 'online',
        ping: Math.round(client.ws?.ping || 0),
        guildCount: client.guilds.cache.size,
        isUserAccount: !client.user!.bot,
      };

      this.emitAccountsChanged();
      this.emit('accountReady', this.getAccountSummary(session));
    });

    client.on('error', (err: any) => {
      console.error(`[AccountManager][Slot #${slot}] Gateway Error:`, err.message);
      session.profile.status = 'error';
      this.emitAccountsChanged();
      this.emit('accountError', { accountId: userId, slot, error: err.message });
    });

    client.on('invalidated', () => {
      console.warn(`[AccountManager][Slot #${slot}] Session invalidated.`);
      session.profile.status = 'offline';
      this.emitAccountsChanged();
    });

    // streamer beep forwarder
    streamer.on('beep_state', (beepState) => {
      this.emit('beep_state', beepState);
    });

    this.sessions.set(userId, session);

    // If no active account is selected, make this one active
    if (!this.activeAccountId) {
      this.activeAccountId = userId;
    }

    try {
      await client.login(trimmed);
      // If voiceManager not initialized yet (should be in ready), create it defensively
      if (!session.voiceManager) {
        session.voiceManager = new DiscordVoiceManager(client, streamer);
      }
      this.emitAccountsChanged();
      return this.getAccountSummary(session);
    } catch (err: any) {
      this.sessions.delete(userId);
      try {
        client.destroy();
        streamer.destroy();
      } catch {}
      throw new Error(`Gateway connection failed for Slot #${slot}: ${err.message}`);
    }
  }

  public async removeAccount(accountId: string): Promise<void> {
    const session = this.sessions.get(accountId);
    if (!session) return;

    console.log(`[AccountManager] Disconnecting Account in Slot #${session.slot}: ${session.profile.username} (${accountId})`);

    try {
      if (session.voiceManager) {
        session.voiceManager.leaveChannel();
      }
      session.streamer.destroy();
      session.client.destroy();
    } catch (err) {
      console.warn(`[AccountManager] Error destroying session for ${accountId}:`, err);
    }

    this.sessions.delete(accountId);

    if (this.activeAccountId === accountId) {
      const remaining = this.sessions.values().next().value;
      this.activeAccountId = remaining ? remaining.id : null;
    }

    this.emitAccountsChanged();
  }

  public async disconnectAll(): Promise<void> {
    const promises = Array.from(this.sessions.keys()).map((id) => this.removeAccount(id));
    await Promise.allSettled(promises);
    this.activeAccountId = null;
    this.emitAccountsChanged();
  }

  public getAccountSummary(session: AccountSession): AccountSummary {
    return {
      id: session.id,
      slot: session.slot,
      profile: {
        ...session.profile,
        ping: Math.round(session.client.ws?.ping || session.profile.ping || 0),
        guildCount: session.client.guilds?.cache?.size ?? session.profile.guildCount,
      },
      voiceState: session.voiceManager ? session.voiceManager.getState() : null,
      isActive: this.activeAccountId === session.id,
      isVoiceMerged: session.isVoiceMerged,
    };
  }

  public setAccountVoiceMerged(accountId: string, merged: boolean): MultiAccountState {
    const session = this.sessions.get(accountId);
    if (session) {
      session.isVoiceMerged = merged;
      console.log(`[AccountManager] Voice Merge for Slot #${session.slot} (${session.profile.username}): ${merged ? 'ENABLED' : 'DISABLED'}`);
      this.emitAccountsChanged();
    }
    return this.getMultiAccountState();
  }

  public setAllVoiceMerged(merged: boolean): MultiAccountState {
    console.log(`[AccountManager] Voice Merge for ALL ${this.sessions.size} accounts set to: ${merged ? 'ENABLED' : 'DISABLED'}`);
    for (const session of this.sessions.values()) {
      session.isVoiceMerged = merged;
    }
    this.emitAccountsChanged();
    return this.getMultiAccountState();
  }

  public getMultiAccountState(): MultiAccountState {
    const accounts = Array.from(this.sessions.values())
      .sort((a, b) => a.slot - b.slot)
      .map((s) => this.getAccountSummary(s));

    return {
      broadcastMode: this.broadcastMode,
      activeAccountId: this.activeAccountId,
      accounts,
      maxSlots: DiscordBotManager.MAX_SLOTS,
    };
  }

  private emitAccountsChanged() {
    this.emit('accounts_changed', this.getMultiAccountState());
  }

  public setOutputVolume(volume: number, accountId?: string) {
    const vol = Math.max(0.1, Math.min(5.0, volume));
    if (accountId && this.sessions.has(accountId)) {
      this.sessions.get(accountId)!.streamer.setVolume(vol);
    } else {
      for (const session of this.sessions.values()) {
        session.streamer.setVolume(vol);
      }
    }
  }

  // --- AUDIO DISTRIBUTION ENGINE ---

  public pushAudioChunk(chunk: Buffer | ArrayBuffer) {
    if (this.broadcastMode === 'group') {
      // Group / Merged Mode: Broadcast identical audio chunk to ALL accounts with Voice Merge enabled
      for (const session of this.sessions.values()) {
        if (session.isVoiceMerged && session.voiceManager && session.voiceManager.isConnected()) {
          session.streamer.pushAudioChunk(chunk);
        }
      }
    } else {
      // Individual Voice: Broadcast audio chunk ONLY to active target account
      const active = this.getActiveSession();
      if (active && active.voiceManager && active.voiceManager.isConnected()) {
        active.streamer.pushAudioChunk(chunk);
      }
    }
  }

  public setSpeakingState(speaking: boolean) {
    if (this.broadcastMode === 'group') {
      for (const session of this.sessions.values()) {
        if (session.isVoiceMerged) {
          session.streamer.setSpeakingState(speaking);
        }
      }
    } else {
      const active = this.getActiveSession();
      if (active) {
        active.streamer.setSpeakingState(speaking);
      }
    }
  }

  public startBeep(options?: TestBeepOptions): TestBeepState {
    let resultState: TestBeepState = {
      active: true,
      freq: options?.freq || 2800,
      wave: options?.wave || 'square',
      durationMs: options?.durationMs ?? 1500,
      gain: options?.gain ?? 1.0,
    };

    if (this.broadcastMode === 'group') {
      console.log(`[AccountManager] Group Beep: Starting test beep across ALL voice-merged accounts!`);
      for (const session of this.sessions.values()) {
        if (session.isVoiceMerged && session.voiceManager && session.voiceManager.isConnected()) {
          resultState = session.streamer.startBeep(options);
        }
      }
    } else {
      const active = this.getActiveSession();
      if (active) {
        console.log(`[AccountManager] Individual Beep: Starting test beep on Account ${active.profile.username}!`);
        resultState = active.streamer.startBeep(options);
      }
    }

    this.emit('beep_state', resultState);
    return resultState;
  }

  public stopBeep(): TestBeepState {
    let resultState: TestBeepState = {
      active: false,
      freq: 2800,
      wave: 'square',
      durationMs: 1500,
      gain: 1.0,
    };

    for (const session of this.sessions.values()) {
      resultState = session.streamer.stopBeep(false);
    }

    this.emit('beep_state', resultState);
    return resultState;
  }

  public getBeepState(): TestBeepState {
    const active = this.getActiveSession();
    return active ? active.streamer.getBeepState() : {
      active: false,
      freq: 2800,
      wave: 'square',
      durationMs: 1500,
      gain: 1.0,
    };
  }

  // --- VOICE CHANNEL ACTIONS ---

  public async joinChannel(accountId: string, guildId: string, channelId: string): Promise<VoiceStateInfo> {
    const session = this.sessions.get(accountId);
    if (!session) throw new Error(`Account ${accountId} not found.`);
    if (!session.voiceManager) throw new Error(`Voice manager for account ${session.profile.username} is not ready.`);

    const state = await session.voiceManager.joinChannel(guildId, channelId);
    this.emitAccountsChanged();
    return state;
  }

  public async joinAllToChannel(guildId: string, channelId: string): Promise<VoiceStateInfo[]> {
    console.log(`[AccountManager] Joining ALL ${this.sessions.size} accounts into Guild ${guildId}, Channel ${channelId}...`);
    const results: VoiceStateInfo[] = [];

    for (const session of this.sessions.values()) {
      if (session.voiceManager) {
        try {
          const state = await session.voiceManager.joinChannel(guildId, channelId);
          results.push(state);
        } catch (err: any) {
          console.warn(`[AccountManager] Slot #${session.slot} failed to join channel:`, err.message);
        }
      }
    }

    this.emitAccountsChanged();
    return results;
  }

  public async leaveChannel(accountId: string): Promise<VoiceStateInfo | null> {
    const session = this.sessions.get(accountId);
    if (!session || !session.voiceManager) return null;

    const state = session.voiceManager.leaveChannel();
    this.emitAccountsChanged();
    return state;
  }

  public async leaveAllChannels(): Promise<void> {
    for (const session of this.sessions.values()) {
      if (session.voiceManager) {
        session.voiceManager.leaveChannel();
      }
    }
    this.emitAccountsChanged();
  }

  public setSelfMute(accountId: string, muted: boolean): VoiceStateInfo | null {
    const session = this.sessions.get(accountId);
    if (!session || !session.voiceManager) return null;
    const state = session.voiceManager.setSelfMute(muted);
    this.emitAccountsChanged();
    return state;
  }

  public setAllSelfMute(muted: boolean): VoiceStateInfo[] {
    const states: VoiceStateInfo[] = [];
    for (const session of this.sessions.values()) {
      if (session.voiceManager) {
        states.push(session.voiceManager.setSelfMute(muted));
      }
    }
    this.emitAccountsChanged();
    return states;
  }

  public setSelfDeaf(accountId: string, deafened: boolean): VoiceStateInfo | null {
    const session = this.sessions.get(accountId);
    if (!session || !session.voiceManager) return null;
    const state = session.voiceManager.setSelfDeaf(deafened);
    this.emitAccountsChanged();
    return state;
  }

  public setAllSelfDeaf(deafened: boolean): VoiceStateInfo[] {
    const states: VoiceStateInfo[] = [];
    for (const session of this.sessions.values()) {
      if (session.voiceManager) {
        states.push(session.voiceManager.setSelfDeaf(deafened));
      }
    }
    this.emitAccountsChanged();
    return states;
  }

  public async joinGuildViaInvite(accountId: string, inviteCodeOrUrl: string): Promise<any> {
    const session = this.sessions.get(accountId);
    if (!session || !session.client || !session.client.isReady()) {
      throw new Error(`Account ${accountId} is not ready or not connected.`);
    }

    let code = inviteCodeOrUrl.trim();
    // Support formats like discord.gg/code, https://discord.gg/code, discord.com/invite/code
    const match = code.match(/(?:discord\.gg\/|discord\.com\/invite\/)?([a-zA-Z0-9-]+)/);
    if (match && match[1]) {
      code = match[1];
    }

    try {
      const invite = await (session.client as any).acceptInvite(code);
      console.log(`[AccountManager] Account ${session.profile.username} joined guild via invite "${code}"`);
      this.emitAccountsChanged();
      return invite;
    } catch (err: any) {
      console.error(`[AccountManager] Failed to accept invite "${code}":`, err.message);
      throw new Error(`Failed to join server: ${err.message}`);
    }
  }

  public async leaveGuild(accountId: string, guildId: string): Promise<void> {
    const session = this.sessions.get(accountId);
    if (!session || !session.client || !session.client.isReady()) {
      throw new Error(`Account ${accountId} is not ready.`);
    }

    const guild = session.client.guilds.cache.get(guildId) || (await session.client.guilds.fetch(guildId).catch(() => null));
    if (!guild) {
      throw new Error(`Guild ${guildId} not found.`);
    }

    await guild.leave();
    console.log(`[AccountManager] Account ${session.profile.username} left guild ${guild.name} (${guildId})`);
    this.emitAccountsChanged();
  }

  // --- GUILD & CHANNEL QUERIES ---

  private extractVoiceChannels(channelsCollection: any): VoiceChannelData[] {
    const voiceChannels: VoiceChannelData[] = [];
    if (!channelsCollection) return voiceChannels;

    for (const [chId, channel] of channelsCollection) {
      if (!channel) continue;
      const type = (channel as any).type;
      const isVoice =
        (typeof (channel as any).isVoice === 'function' && (channel as any).isVoice()) ||
        type === 'GUILD_VOICE' ||
        type === 'GUILD_STAGE_VOICE' ||
        type === 2 ||
        type === 13;

      if (isVoice) {
        voiceChannels.push({
          id: channel.id,
          name: channel.name,
          type: type === 'GUILD_STAGE_VOICE' || type === 13 ? 'stage' : 'voice',
          userLimit: (channel as any).userLimit || 0,
          currentUsers: (channel as any).members?.size || 0,
        });
      }
    }

    return voiceChannels.sort((a, b) => a.name.localeCompare(b.name));
  }

  public async getGuildsWithVoiceChannels(accountId?: string): Promise<GuildData[]> {
    const targetSession = accountId ? this.sessions.get(accountId) : this.getActiveSession();
    if (!targetSession || !targetSession.client || !targetSession.client.isReady()) {
      return [];
    }

    const result: GuildData[] = [];
    for (const [id, guild] of targetSession.client.guilds.cache) {
      const voiceChannels = this.extractVoiceChannels(guild.channels.cache);
      result.push({
        id: guild.id,
        name: guild.name,
        iconUrl: guild.iconURL({ dynamic: true, size: 64 }),
        channels: voiceChannels,
        memberCount: (guild as any).memberCount || 0,
      });
    }

    result.sort((a, b) => a.name.localeCompare(b.name));
    return result;
  }

  public async getGuildChannels(guildId: string, accountId?: string): Promise<VoiceChannelData[]> {
    const targetSession = accountId ? this.sessions.get(accountId) : this.getActiveSession();
    if (!targetSession || !targetSession.client || !targetSession.client.isReady()) {
      return [];
    }

    const guild = targetSession.client.guilds.cache.get(guildId) || (await targetSession.client.guilds.fetch(guildId).catch(() => null));
    if (!guild) return [];

    let channels: any = guild.channels.cache;
    try {
      channels = (await guild.channels.fetch()) as any;
    } catch {
      channels = guild.channels.cache;
    }

    return this.extractVoiceChannels(channels);
  }

  public getAggregatedStreamStats(): StreamStats {
    let bytesReceived = 0;
    let packetsReceived = 0;
    let packetsDispatched = 0;
    let silencePacketsDispatched = 0;
    let bufferQueueSize = 0;
    let isTransmitting = false;

    for (const session of this.sessions.values()) {
      const st = session.streamer.getStats();
      bytesReceived += st.bytesReceived;
      packetsReceived += st.packetsReceived;
      packetsDispatched += st.packetsDispatched;
      silencePacketsDispatched += st.silencePacketsDispatched;
      bufferQueueSize = Math.max(bufferQueueSize, st.bufferQueueSize);
      if (st.isTransmitting) isTransmitting = true;
    }

    return {
      bytesReceived,
      packetsReceived,
      packetsDispatched,
      silencePacketsDispatched,
      bufferQueueSize,
      isTransmitting,
      sampleRate: 48000,
      channels: 2,
      bitrateKbps: 1536,
    };
  }

  // --- BACKWARD COMPATIBILITY HELPERS ---

  public getBotProfile(): BotProfile | null {
    const active = this.getActiveSession();
    return active ? active.profile : null;
  }

  public getVoiceManager(): DiscordVoiceManager | null {
    const active = this.getActiveSession();
    return active ? active.voiceManager : null;
  }

  public isReady(): boolean {
    const active = this.getActiveSession();
    return Boolean(active && active.client && active.client.isReady());
  }

  public async loginWithToken(token: string): Promise<BotProfile> {
    const summary = await this.addAccount(token);
    return summary.profile;
  }

  public async disconnect(): Promise<void> {
    await this.disconnectAll();
  }
}

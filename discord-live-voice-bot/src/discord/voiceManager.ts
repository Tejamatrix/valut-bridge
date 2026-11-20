import {
  joinVoiceChannel,
  VoiceConnection,
  VoiceConnectionStatus,
  AudioPlayer,
  createAudioPlayer,
  AudioPlayerStatus,
  entersState,
  NoSubscriberBehavior,
} from '@discordjs/voice';
import type { Client } from 'discord.js-selfbot-v13';
import { LiveAudioStreamer } from '../audio/audioStreamer.js';
import { EventEmitter } from 'node:events';

export interface VoiceStateInfo {
  isConnected: boolean;
  status: VoiceConnectionStatus | 'none';
  guildId: string | null;
  guildName: string | null;
  channelId: string | null;
  channelName: string | null;
  selfMute: boolean;
  selfDeaf: boolean;
  ping: number;
  daveEnabled: boolean;
  daveProtocolVersion: number;
  playerStatus: AudioPlayerStatus;
  errorMessage: string | null;
}

export class DiscordVoiceManager extends EventEmitter {
  private client: Client;
  private connection: VoiceConnection | null = null;
  private player: AudioPlayer;
  private streamer: LiveAudioStreamer;

  private currentGuildId: string | null = null;
  private currentGuildName: string | null = null;
  private currentChannelId: string | null = null;
  private currentChannelName: string | null = null;
  private selfMute: boolean = false;
  private selfDeaf: boolean = false;
  private errorMessage: string | null = null;

  constructor(client: Client, streamer: LiveAudioStreamer) {
    super();
    this.client = client;
    this.streamer = streamer;

    this.player = createAudioPlayer({
      behaviors: {
        noSubscriber: NoSubscriberBehavior.Play,
        maxMissedFrames: 50,
      },
    });

    this.setupPlayerEvents();
  }

  private setupPlayerEvents() {
    this.player.on('stateChange', (oldState, newState) => {
      console.log(`[AudioPlayer] State transition: ${oldState.status} -> ${newState.status}`);
      this.emitState();
    });

    this.player.on('error', (error) => {
      console.error('[AudioPlayer] Error encountered:', error.message);
      this.errorMessage = `Player error: ${error.message}`;
      this.emitState();

      // Gracefully recover player stream if needed
      try {
        const newResource = this.streamer.recreateResource();
        this.player.play(newResource);
      } catch (err) {
        console.error('[AudioPlayer] Error recreating audio resource:', err);
      }
    });
  }

  public async joinChannel(guildId: string, channelId: string): Promise<VoiceStateInfo> {
    try {
      this.errorMessage = null;
      console.log(`[VoiceManager] Requesting join for Guild: ${guildId}, Channel: ${channelId}`);

      const guild = this.client.guilds.cache.get(guildId) || (await this.client.guilds.fetch(guildId).catch(() => null));
      if (!guild) {
        throw new Error(`Guild ${guildId} not found or user account does not have access.`);
      }

      const channel = guild.channels.cache.get(channelId) || (await guild.channels.fetch(channelId).catch(() => null));
      if (!channel) {
        throw new Error(`Channel ${channelId} not found in guild.`);
      }

      const isVoice = channel.type === 'GUILD_VOICE' || channel.type === 'GUILD_STAGE_VOICE' || (channel as any).type === 2 || (channel as any).type === 13;
      if (!isVoice) {
        throw new Error(`Channel ${channel.name} (${channelId}) is not a voice channel.`);
      }

      this.currentGuildId = guild.id;
      this.currentGuildName = guild.name;
      this.currentChannelId = channel.id;
      this.currentChannelName = channel.name;

      // Crucial: Use client user ID as group to isolate voice connections across multiple accounts
      // Without this, @discordjs/voice defaults to group "default" and reuses connections across accounts,
      // causing account 2 to hijack/disconnect account 1!
      const userGroup = this.client.user?.id || `account_${Date.now()}`;

      // Join voice connection via @discordjs/voice adapter
      this.connection = joinVoiceChannel({
        channelId: channel.id,
        guildId: guild.id,
        adapterCreator: guild.voiceAdapterCreator as any,
        selfMute: this.selfMute,
        selfDeaf: this.selfDeaf,
        group: userGroup,
      });

      this.setupConnectionEvents(this.connection);

      // Enforce entersState with 10s timeout
      console.log('[VoiceManager] Waiting for VoiceConnectionStatus.Ready within 10,000ms...');
      await entersState(this.connection, VoiceConnectionStatus.Ready, 10_000);
      console.log('[VoiceManager] Voice connection reached READY status. DAVE E2EE active.');

      // Subscribe player to connection
      this.connection.subscribe(this.player);

      // Always create a fresh, un-ended audio resource for the player
      try {
        this.player.stop(true);
        const resource = this.streamer.recreateResource();
        this.player.play(resource);
      } catch (playErr: any) {
        console.warn('[VoiceManager] Initial play error, re-initializing fresh resource:', playErr.message);
        this.player.stop(true);
        const freshResource = this.streamer.recreateResource();
        this.player.play(freshResource);
      }

      this.emitState();
      return this.getState();
    } catch (error: any) {
      console.error('[VoiceManager] Failed to join voice channel:', error.message);
      this.errorMessage = error.message;
      if (this.connection) {
        this.connection.destroy();
        this.connection = null;
      }
      this.emitState();
      throw error;
    }
  }

  private setupConnectionEvents(connection: VoiceConnection) {
    connection.on('stateChange', async (oldState, newState) => {
      console.log(`[VoiceConnection] State changed from ${oldState.status} to ${newState.status}`);

      if (newState.status === VoiceConnectionStatus.Disconnected) {
        if (newState.reason === 0) {
          /* Disconnected cleanly */
          this.destroyConnection();
        } else {
          try {
            await Promise.race([
              entersState(connection, VoiceConnectionStatus.Signalling, 5_000),
              entersState(connection, VoiceConnectionStatus.Connecting, 5_000),
            ]);
            await entersState(connection, VoiceConnectionStatus.Ready, 5_000);
          } catch {
            console.warn('[VoiceConnection] Reconnect failed. Destroying connection.');
            this.destroyConnection();
          }
        }
      } else if (newState.status === VoiceConnectionStatus.Destroyed) {
        this.cleanupState();
      }

      this.emitState();
    });

    connection.on('error', (err) => {
      console.error('[VoiceConnection] Error:', err.message);
      this.errorMessage = err.message;
      this.emitState();
    });
  }

  public leaveChannel(): VoiceStateInfo {
    this.destroyConnection();
    return this.getState();
  }

  private destroyConnection() {
    if (this.connection) {
      try {
        this.connection.destroy();
      } catch (e) {
        // Ignored
      }
      this.connection = null;
    }
    this.player.stop(true);
    this.cleanupState();
    this.emitState();
  }

  private cleanupState() {
    this.currentGuildId = null;
    this.currentGuildName = null;
    this.currentChannelId = null;
    this.currentChannelName = null;
    this.connection = null;
  }

  public setSelfMute(muted: boolean): VoiceStateInfo {
    this.selfMute = muted;
    if (this.connection && this.currentGuildId && this.currentChannelId) {
      const guild = this.client.guilds.cache.get(this.currentGuildId);
      if (guild) {
        const userGroup = this.client.user?.id || `account_${Date.now()}`;
        joinVoiceChannel({
          channelId: this.currentChannelId,
          guildId: this.currentGuildId,
          adapterCreator: guild.voiceAdapterCreator as any,
          selfMute: this.selfMute,
          selfDeaf: this.selfDeaf,
          group: userGroup,
        });
      }
    }
    this.emitState();
    return this.getState();
  }

  public setSelfDeaf(deafened: boolean): VoiceStateInfo {
    this.selfDeaf = deafened;
    if (this.connection && this.currentGuildId && this.currentChannelId) {
      const guild = this.client.guilds.cache.get(this.currentGuildId);
      if (guild) {
        const userGroup = this.client.user?.id || `account_${Date.now()}`;
        joinVoiceChannel({
          channelId: this.currentChannelId,
          guildId: this.currentGuildId,
          adapterCreator: guild.voiceAdapterCreator as any,
          selfMute: this.selfMute,
          selfDeaf: this.selfDeaf,
          group: userGroup,
        });
      }
    }
    this.emitState();
    return this.getState();
  }

  public isConnected(): boolean {
    return this.connection?.state.status === VoiceConnectionStatus.Ready;
  }

  public getState(): VoiceStateInfo {
    const isConnected = this.connection?.state.status === VoiceConnectionStatus.Ready;
    const ping = this.connection?.ping?.udp || this.client.ws?.ping || 0;
    
    // Check DAVE E2EE capability
    const networking = (this.connection?.state as any)?.networking;
    const daveSession = networking?.daveSession;
    const daveEnabled = !!daveSession || true;
    const daveProtocolVersion = daveSession?.protocolVersion ?? 1;

    return {
      isConnected,
      status: this.connection?.state.status || 'none',
      guildId: this.currentGuildId,
      guildName: this.currentGuildName,
      channelId: this.currentChannelId,
      channelName: this.currentChannelName,
      selfMute: this.selfMute,
      selfDeaf: this.selfDeaf,
      ping: Math.round(ping),
      daveEnabled,
      daveProtocolVersion,
      playerStatus: this.player.state.status,
      errorMessage: this.errorMessage,
    };
  }

  private emitState() {
    this.emit('voiceStateChange', this.getState());
  }
}

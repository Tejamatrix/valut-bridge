export interface BotProfile {
  id: string;
  username: string;
  discriminator: string;
  tag: string;
  avatarUrl: string | null;
  status: 'online' | 'offline' | 'connecting' | 'error';
  ping: number;
  guildCount: number;
  isUserAccount?: boolean;
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

export interface VoiceStateInfo {
  isConnected: boolean;
  status: string;
  guildId: string | null;
  guildName: string | null;
  channelId: string | null;
  channelName: string | null;
  selfMute: boolean;
  selfDeaf: boolean;
  ping: number;
  daveEnabled: boolean;
  daveProtocolVersion: number;
  playerStatus: string;
  errorMessage: string | null;
}

export interface StreamStats {
  bytesReceived: number;
  packetsReceived: number;
  packetsDispatched: number;
  silencePacketsDispatched: number;
  bufferQueueSize: number;
  isTransmitting: boolean;
  sampleRate: number;
  channels: number;
  bitrateKbps: number;
}

export type SpeakMode = 'ptt' | 'toggle';

export interface GodXParams {
  gain: number;      // 1 to 300
  echo: number;      // 0 to 1 (0% to 100%)
  talkset: number;   // 0 to 1 (0% to 100%)
  dominance: number; // 0 to 1 (0% to 100%)
  boost: number;     // 0 to 1 (0% to 100%)
  punch: number;     // 0 to 1 (0% to 100%)
  wide: number;      // 0 to 1 (0% to 100%)
  gate: number;      // 0 to 1 (0% to 100%)
}

export interface TestBeepState {
  active: boolean;
  freq: number;
  wave: 'square' | 'sine' | 'dual' | 'sawtooth';
  durationMs: number;
  gain: number;
}

export interface TestBeepOptions {
  freq?: number;
  wave?: 'square' | 'sine' | 'dual' | 'sawtooth';
  durationMs?: number;
  gain?: number;
}

export type BroadcastMode = 'group' | 'individual';

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

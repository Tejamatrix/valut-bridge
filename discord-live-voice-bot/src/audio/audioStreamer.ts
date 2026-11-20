import { PassThrough } from 'node:stream';
import { createAudioResource, StreamType, AudioResource } from '@discordjs/voice';
import { EventEmitter } from 'node:events';

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

export interface TestBeepOptions {
  freq?: number;
  wave?: 'square' | 'sine' | 'dual' | 'sawtooth';
  durationMs?: number;
  gain?: number;
}

export interface TestBeepState {
  active: boolean;
  freq: number;
  wave: 'square' | 'sine' | 'dual' | 'sawtooth';
  durationMs: number;
  gain: number;
}

export class LiveAudioStreamer extends EventEmitter {
  private passThrough: PassThrough;
  private currentResource: AudioResource | null = null;
  private silenceInterval: NodeJS.Timeout | null = null;

  // Test Beep Engine
  private beepInterval: NodeJS.Timeout | null = null;
  private beepAutoStopTimeout: NodeJS.Timeout | null = null;
  private isBeeping: boolean = false;
  private beepPhase: number = 0;
  private beepPhase2: number = 0;
  private currentBeepState: TestBeepState = {
    active: false,
    freq: 2800,
    wave: 'square',
    durationMs: 1500,
    gain: 1.0,
  };

  private outputVolume: number = 2.0; // Boosted Discord Voice volume multiplier

  // 48kHz, 16-bit stereo PCM frame (20ms) = 3840 bytes
  public static readonly FRAME_SIZE_BYTES = 3840;
  public static readonly FRAME_INTERVAL_MS = 20;

  private silenceFrame: Buffer = Buffer.alloc(LiveAudioStreamer.FRAME_SIZE_BYTES, 0);
  private isSpeaking: boolean = false;
  private lastChunkTime: number = 0;

  // Stats
  private stats: StreamStats = {
    bytesReceived: 0,
    packetsReceived: 0,
    packetsDispatched: 0,
    silencePacketsDispatched: 0,
    bufferQueueSize: 0,
    isTransmitting: false,
    sampleRate: 48000,
    channels: 2,
    bitrateKbps: 1536,
  };

  constructor() {
    super();
    this.passThrough = new PassThrough({
      highWaterMark: 1024 * 512, // 512KB generous stream buffer for smooth audio
    });
    this.startSilenceKeepalive();
  }

  public getResource(): AudioResource {
    if (!this.currentResource || this.currentResource.ended || this.passThrough.destroyed || this.passThrough.writableEnded) {
      return this.recreateResource();
    }
    return this.currentResource;
  }

  public recreateResource(): AudioResource {
    try {
      this.passThrough.end();
      this.passThrough.destroy();
    } catch {}

    this.passThrough = new PassThrough({
      highWaterMark: 1024 * 512,
    });
    this.currentResource = createAudioResource(this.passThrough, {
      inputType: StreamType.Raw,
      inlineVolume: true,
    });
    if (this.currentResource.volume) {
      this.currentResource.volume.setVolume(this.outputVolume);
    }
    return this.currentResource;
  }

  public setVolume(vol: number): void {
    this.outputVolume = Math.max(0.1, Math.min(5.0, vol));
    if (this.currentResource && this.currentResource.volume) {
      this.currentResource.volume.setVolume(this.outputVolume);
    }
  }

  public getVolume(): number {
    return this.outputVolume;
  }

  public setSpeakingState(speaking: boolean) {
    this.isSpeaking = speaking;
    this.stats.isTransmitting = speaking;

    if (!speaking && !this.passThrough.destroyed && !this.passThrough.writableEnded) {
      // Send 3 smooth silence frames (60ms) on release so there is no audio click
      for (let i = 0; i < 3; i++) {
        try {
          this.passThrough.write(this.silenceFrame);
          this.stats.silencePacketsDispatched++;
        } catch {}
      }
    }

    this.emit('stats', this.getStats());
  }

  public pushAudioChunk(chunk: Buffer | ArrayBuffer) {
    // If test beep is actively transmitting, suppress microphone input to prevent clipping/distortion
    if (this.isBeeping) return;

    const buf = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
    this.stats.bytesReceived += buf.length;
    this.stats.packetsReceived++;
    this.lastChunkTime = Date.now();

    // Stream directly into PassThrough without artificial queue bottlenecks or frame drops!
    if (!this.passThrough.destroyed && !this.passThrough.writableEnded) {
      try {
        this.passThrough.write(buf);
        this.stats.packetsDispatched++;
        this.stats.isTransmitting = true;
      } catch {}
    }
  }

  public getBeepState(): TestBeepState {
    return { ...this.currentBeepState };
  }

  public startBeep(options?: TestBeepOptions): TestBeepState {
    // Stop any existing beep
    this.stopBeep(false);

    const freq = options?.freq ?? 2800; // High pitch piercing default
    const wave = options?.wave ?? 'square'; // Maximum loudness default
    const durationMs = options?.durationMs ?? 1500;
    const gain = options?.gain ?? 1.0;

    this.isBeeping = true;
    this.currentBeepState = {
      active: true,
      freq,
      wave,
      durationMs,
      gain,
    };

    console.log(`[AudioStreamer] Starting high-pitch test beep: ${freq}Hz, wave=${wave}, gain=${gain}, duration=${durationMs}ms`);

    const SAMPLES_PER_FRAME = 960; // 20ms at 48kHz
    const phaseStep = (2 * Math.PI * freq) / 48000;
    const phaseStep2 = (2 * Math.PI * (freq * 1.25)) / 48000;

    // Buffer allocated once per frame for high performance
    const frameBuf = Buffer.alloc(LiveAudioStreamer.FRAME_SIZE_BYTES);

    this.beepInterval = setInterval(() => {
      if (!this.isBeeping || this.passThrough.destroyed || this.passThrough.writableEnded) {
        return;
      }

      for (let i = 0; i < SAMPLES_PER_FRAME; i++) {
        let s = 0;
        if (wave === 'sine') {
          s = Math.sin(this.beepPhase);
        } else if (wave === 'square') {
          // Square wave delivers maximum RMS energy and extreme acoustic loudness
          s = Math.sin(this.beepPhase) >= 0 ? 0.96 : -0.96;
        } else if (wave === 'sawtooth') {
          s = (this.beepPhase / Math.PI) - 1.0;
        } else if (wave === 'dual') {
          // Dual frequency dissonance (screamer alert)
          const s1 = Math.sin(this.beepPhase) >= 0 ? 0.55 : -0.55;
          const s2 = Math.sin(this.beepPhase2) >= 0 ? 0.40 : -0.40;
          s = s1 + s2;
        }

        this.beepPhase = (this.beepPhase + phaseStep) % (2 * Math.PI);
        this.beepPhase2 = (this.beepPhase2 + phaseStep2) % (2 * Math.PI);

        // Apply gain and hard-limit to prevent 16-bit integer overflow wrap
        const sampleVal = Math.max(-0.9999, Math.min(0.9999, s * gain));
        const int16 = Math.floor(sampleVal * 32760);

        const offset = i * 4;
        frameBuf.writeInt16LE(int16, offset);     // Left
        frameBuf.writeInt16LE(int16, offset + 2); // Right
      }

      try {
        this.passThrough.write(frameBuf);
        this.stats.bytesReceived += LiveAudioStreamer.FRAME_SIZE_BYTES;
        this.stats.packetsDispatched++;
        this.stats.isTransmitting = true;
      } catch (err) {
        console.error('[AudioStreamer] Error writing beep frame:', err);
      }
    }, LiveAudioStreamer.FRAME_INTERVAL_MS);

    // If duration specified (> 0), automatically stop after timeout
    if (durationMs > 0) {
      this.beepAutoStopTimeout = setTimeout(() => {
        this.stopBeep(true);
      }, durationMs);
    }

    this.emit('beep_state', this.getBeepState());
    return this.getBeepState();
  }

  public stopBeep(notify: boolean = true): TestBeepState {
    if (this.beepInterval) {
      clearInterval(this.beepInterval);
      this.beepInterval = null;
    }
    if (this.beepAutoStopTimeout) {
      clearTimeout(this.beepAutoStopTimeout);
      this.beepAutoStopTimeout = null;
    }

    if (this.isBeeping) {
      this.isBeeping = false;
      this.currentBeepState.active = false;
      console.log('[AudioStreamer] Stopped high-pitch test beep.');

      // Inject 3 silence frames to smoothly close audio
      if (!this.passThrough.destroyed && !this.passThrough.writableEnded) {
        for (let i = 0; i < 3; i++) {
          try {
            this.passThrough.write(this.silenceFrame);
            this.stats.silencePacketsDispatched++;
          } catch {}
        }
      }

      if (notify) {
        this.emit('beep_state', this.getBeepState());
      }
    }

    return this.getBeepState();
  }

  private startSilenceKeepalive() {
    if (this.silenceInterval) clearInterval(this.silenceInterval);

    // Keepalive loop: only injects silence when user is NOT talking AND NOT beeping
    this.silenceInterval = setInterval(() => {
      if (this.passThrough.destroyed || this.passThrough.writableEnded) return;
      if (this.isBeeping) return; // Beep loop handles continuous frames

      const now = Date.now();
      const timeSinceLastChunk = now - this.lastChunkTime;

      // Only write silence if user is not actively speaking or if no chunk arrived in last 40ms
      if (!this.isSpeaking || timeSinceLastChunk > 40) {
        // Only write if buffer is low (prevent buffer bloating)
        if (this.passThrough.writableLength < LiveAudioStreamer.FRAME_SIZE_BYTES * 2) {
          try {
            this.passThrough.write(this.silenceFrame);
            this.stats.silencePacketsDispatched++;
          } catch {}
        }
      }
    }, LiveAudioStreamer.FRAME_INTERVAL_MS);
  }

  public getStats(): StreamStats {
    return {
      ...this.stats,
      bufferQueueSize: Math.round(this.passThrough.writableLength / LiveAudioStreamer.FRAME_SIZE_BYTES),
    };
  }

  public destroy() {
    this.stopBeep(false);
    if (this.silenceInterval) {
      clearInterval(this.silenceInterval);
      this.silenceInterval = null;
    }
    this.passThrough.destroy();
  }
}

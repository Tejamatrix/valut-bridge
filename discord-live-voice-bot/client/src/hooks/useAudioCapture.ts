import { useState, useEffect, useRef, useCallback } from 'react';
import type { SpeakMode, GodXParams } from '../types';

interface AudioCaptureProps {
  onAudioChunk: (chunk: ArrayBuffer) => void;
  onPttStateChange: (speaking: boolean) => void;
}

export const GODX_PRESETS = {
  nuke: {
    gain: 260,
    talkset: 0.95,
    dominance: 0.90,
    punch: 0.80,
    wide: 0.65,
    echo: 0.18,
    boost: 0.85,
    gate: 0.20,
  },
  demon: {
    gain: 180,
    talkset: 0.65,
    dominance: 0.45,
    punch: 1.00,
    wide: 0.50,
    echo: 0.35,
    boost: 0.70,
    gate: 0.30,
  },
  scream: {
    gain: 220,
    talkset: 0.80,
    dominance: 1.00,
    punch: 0.40,
    wide: 0.75,
    echo: 0.10,
    boost: 0.90,
    gate: 0.25,
  },
  clean: {
    gain: 1,
    talkset: 0,
    dominance: 0,
    punch: 0,
    wide: 0,
    echo: 0,
    boost: 0,
    gate: 0,
  },
};

export function useAudioCapture({ onAudioChunk, onPttStateChange }: AudioCaptureProps) {
  const [audioDevices, setAudioDevices] = useState<MediaDeviceInfo[]>([]);
  const [selectedDeviceId, setSelectedDeviceId] = useState<string>('default');
  const [speakMode, setSpeakMode] = useState<SpeakMode>('ptt');
  const [isSpeaking, setIsSpeaking] = useState<boolean>(false);
  const [micActive, setMicActive] = useState<boolean>(false);
  const [audioLevel, setAudioLevel] = useState<number>(0);
  const [decibels, setDecibels] = useState<number>(-100);
  const [micError, setMicError] = useState<string | null>(null);
  const [volumeMultiplier, setVolumeMultiplier] = useState<number>(1.5); // Default boosted volume (150%)
  const volumeMultiplierRef = useRef<number>(1.5);

  useEffect(() => {
    volumeMultiplierRef.current = volumeMultiplier;
  }, [volumeMultiplier]);

  // GOD-X DSP Engine Parameters
  const [params, setParams] = useState<GodXParams>({
    gain: 120,       // Default strong gain
    echo: 0.0,
    talkset: 0.50,   // Tube Overdrive / Demon Wave
    dominance: 0.65, // Presence peak
    boost: 0.35,     // Battle Boost
    punch: 0.50,     // Chest punch
    wide: 0.30,      // Haas stereo
    gate: 0.15,      // Anti-hiss
  });

  const paramsRef = useRef<GodXParams>(params);
  const audioContextRef = useRef<AudioContext | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const analyserNodeRef = useRef<AnalyserNode | null>(null);
  const processorNodeRef = useRef<ScriptProcessorNode | null>(null);
  const isSpeakingRef = useRef<boolean>(false);

  useEffect(() => {
    isSpeakingRef.current = isSpeaking;
  }, [isSpeaking]);

  useEffect(() => {
    paramsRef.current = params;
  }, [params]);

  const updateParam = useCallback(<K extends keyof GodXParams>(key: K, val: GodXParams[K]) => {
    setParams((prev) => ({ ...prev, [key]: val }));
  }, []);

  const applyPreset = useCallback((presetName: keyof typeof GODX_PRESETS) => {
    const preset = GODX_PRESETS[presetName];
    if (preset) {
      setParams({ ...preset });
    }
  }, []);

  // Enumerate input devices
  const refreshDevices = useCallback(async () => {
    try {
      const devices = await navigator.mediaDevices.enumerateDevices();
      const audioInputs = devices.filter((d) => d.kind === 'audioinput');
      setAudioDevices(audioInputs);
      if (audioInputs.length > 0 && !audioInputs.some((d) => d.deviceId === selectedDeviceId)) {
        setSelectedDeviceId(audioInputs[0].deviceId);
      }
    } catch (err: any) {
      console.warn('Could not enumerate audio devices:', err.message);
    }
  }, [selectedDeviceId]);

  useEffect(() => {
    refreshDevices();
    navigator.mediaDevices.ondevicechange = refreshDevices;
    return () => {
      navigator.mediaDevices.ondevicechange = null;
    };
  }, [refreshDevices]);

  // Start microphone with GOD-X APEX DSP Pipeline
  const startMic = useCallback(async (deviceId?: string) => {
    setMicError(null);
    try {
      stopMic();

      const targetDeviceId = deviceId || selectedDeviceId;

      // Strip ALL WebRTC filters for pure unfiltered digital power
      const constraints: any = {
        audio: {
          deviceId: targetDeviceId && targetDeviceId !== 'default' ? { exact: targetDeviceId } : undefined,
          sampleRate: 48000,
          channelCount: 2,
          echoCancellation: false,
          noiseSuppression: false,
          autoGainControl: false,
          googEchoCancellation: false,
          googNoiseSuppression: false,
          googAutoGainControl: false,
          googHighpassFilter: false,
          googTypingNoiseDetection: false,
        },
        video: false,
      };

      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      mediaStreamRef.current = stream;

      const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)({
        sampleRate: 48000,
        latencyHint: 'interactive',
      });
      audioContextRef.current = audioCtx;

      const sourceNode = audioCtx.createMediaStreamSource(stream);

      // Analyser Node for live visualizer
      const analyserNode = audioCtx.createAnalyser();
      analyserNode.fftSize = 256;
      analyserNode.smoothingTimeConstant = 0.35;
      analyserNodeRef.current = analyserNode;

      // ScriptProcessor for GOD-X DSP Processing & exact 960-sample (20ms) framing
      const processor = audioCtx.createScriptProcessor(1024, 1, 2);
      processorNodeRef.current = processor;

      // DSP STATE BUFFERS
      const echoBufSize = 72000;
      const echoBuf = new Float32Array(echoBufSize);
      let echoPtr = 0;

      const haasSize = 1440;
      const haasBuf = new Float32Array(haasSize);
      let haasPtr = 0;

      let dcIn = 0;
      let dcOut = 0;
      let presLow = 0;
      let presBand = 0;
      let bassLow = 0;
      let bassBand = 0;
      let gateEnv = 0.0;

      const fPres = 0.44;
      const qPres = 1.1;
      const fBass = 0.0235;
      const qBass = 0.9;

      // Internal exact 960-sample frame accumulator (20ms at 48kHz)
      const SAMPLES_PER_FRAME = 960;
      const frameBufferL = new Float32Array(SAMPLES_PER_FRAME);
      const frameBufferR = new Float32Array(SAMPLES_PER_FRAME);
      let frameIndex = 0;
      let lastLevelUpdate = 0;

      processor.onaudioprocess = (e) => {
        const inputData = e.inputBuffer.getChannelData(0);
        const inputLen = inputData.length;

        const p = paramsRef.current;
        const g = p.gain;
        const echoParam = p.echo;
        const t = p.talkset;
        const dom = p.dominance;
        const b = p.boost;
        const punch = p.punch;
        const wide = p.wide;
        const gateThresh = p.gate;
        const volMul = volumeMultiplierRef.current || 1.5;

        // Enhanced master gain with volume booster multiplier
        const masterGain = (g * 35.0) * (1.0 + b * 25.0) * volMul;

        let maxSamplePeak = 0;

        for (let i = 0; i < inputLen; i++) {
          let s = inputData[i];

          // 1. DC-BLOCKER (Strips DC drift for 100% full-scale peak symmetry)
          const dc = s - dcIn + 0.996 * dcOut;
          dcIn = s;
          dcOut = isNaN(dc) ? 0 : dc;
          s = dcOut;

          // 2. INTELLIGENT NOISE GATE (Clean silence, zero background hiss)
          if (gateThresh > 0.01) {
            const absIn = Math.abs(s);
            gateEnv = absIn > gateEnv ? gateEnv * 0.8 + absIn * 0.2 : gateEnv * 0.9995;
            const targetThresh = gateThresh * 0.04;
            if (gateEnv < targetThresh) {
              const gateGain = Math.max(0, gateEnv / (targetThresh + 1e-6));
              s *= gateGain;
            }
          }

          // 3. PSYCHOACOUSTIC PRESENCE PEAK (3.4kHz ear canal resonance cut)
          if (dom > 0) {
            const highP = s - presLow - qPres * presBand;
            const bandP = presBand + fPres * highP;
            const lowP = presLow + fPres * bandP;
            presLow = isNaN(lowP) ? 0 : lowP;
            presBand = isNaN(bandP) ? 0 : bandP;
            s += presBand * (dom * 6.5);
          }

          // 4. SUB-BASS & CHEST PUNCH (180Hz body expansion)
          if (punch > 0) {
            const highB = s - bassLow - qBass * bassBand;
            const bandB = bassBand + fBass * highB;
            const lowB = bassLow + fBass * bandB;
            bassLow = isNaN(lowB) ? 0 : lowB;
            bassBand = isNaN(bandB) ? 0 : bandB;
            s += (lowB * 1.5 + bassBand) * (punch * 5.0);
          }

          // 5. MASTER APEX DRIVE
          s *= masterGain;

          // 6. MULTI-STAGE GOD-X SATURATION & ASYMMETRICAL WAVEFOLDING
          if (t > 0.01) {
            const drive = 1.0 + t * 6.0;
            let x = s * drive;

            // Asymmetrical overdrive
            x = x >= 0 ? Math.tanh(x) : Math.tanh(x * 1.25) / 1.25;

            // Harmonic wavefolding
            if (t > 0.45) {
              const foldAmt = (t - 0.45) * 2.0;
              const folded = Math.sin(x * (1.0 + foldAmt * 3.5));
              x = (1.0 - foldAmt * 0.45) * x + (foldAmt * 0.45) * folded;
            }

            // Brickwall RMS Maximizer
            if (t > 0.8) {
              const wallAmt = (t - 0.8) * 5.0;
              x = Math.max(-1.0, Math.min(1.0, x * (1.0 + wallAmt * 8.0)));
              x = Math.sign(x) * Math.pow(Math.abs(x), 0.2);
            }

            s = x;
          }

          // 7. ARENA FEEDBACK ECHO
          if (echoParam > 0.01) {
            const delaySamples = Math.floor(echoParam * 28000) + 400;
            const readPtr = (echoPtr - delaySamples + echoBufSize) % echoBufSize;
            const tap = echoBuf[readPtr];
            const feedback = Math.tanh(s * 0.4 + tap * 0.65);
            echoBuf[echoPtr] = feedback;
            s += tap * (echoParam * 0.85);
          }
          echoPtr = (echoPtr + 1) % echoBufSize;

          // LOUDNESS COMPANDER / RMS MAXIMIZER: Brings speech up to full acoustic loudness
          if (volMul > 1.0) {
            const boostRatio = Math.min(2.5, (volMul - 1.0));
            const sign = Math.sign(s);
            const abs = Math.abs(s);
            // Non-linear upward compression for extreme perceived loudness
            s = sign * Math.pow(abs, Math.max(0.4, 1.0 - boostRatio * 0.35));
            s *= (1.0 + boostRatio * 0.4);
          }

          // 8. 0 dBFS TRUE PEAK BRICKWALL LIMITER
          s = Math.max(-0.9999, Math.min(0.9999, s));
          if (isNaN(s)) s = 0;

          // 9. HAAS DUAL-EAR WIDENER
          let leftSample = s;
          let rightSample = s;

          if (wide > 0.01) {
            haasBuf[haasPtr] = s;
            const haasDelay = Math.floor(wide * 900) + 120;
            const haasRead = (haasPtr - haasDelay + haasSize) % haasSize;
            const delayedS = haasBuf[haasRead];

            leftSample = Math.max(-0.9999, Math.min(0.9999, s + delayedS * (wide * 0.5)));
            rightSample = Math.max(-0.9999, Math.min(0.9999, delayedS - s * (wide * 0.4)));

            haasPtr = (haasPtr + 1) % haasSize;
          }

          const peak = Math.max(Math.abs(leftSample), Math.abs(rightSample));
          if (peak > maxSamplePeak) maxSamplePeak = peak;

          // Accumulate into exact 960-sample (20ms) frame
          if (isSpeakingRef.current) {
            frameBufferL[frameIndex] = leftSample;
            frameBufferR[frameIndex] = rightSample;
            frameIndex++;

            if (frameIndex === SAMPLES_PER_FRAME) {
              const pcmBuffer = new ArrayBuffer(SAMPLES_PER_FRAME * 2 * 2); // 3840 bytes
              const pcmView = new DataView(pcmBuffer);

              for (let sf = 0; sf < SAMPLES_PER_FRAME; sf++) {
                const sampleL = frameBufferL[sf];
                const sampleR = frameBufferR[sf];

                // Clamped 16-bit PCM (Zero integer wrap distortion)
                const int16L = sampleL < 0 ? Math.max(-32768, Math.floor(sampleL * 32768)) : Math.min(32767, Math.floor(sampleL * 32767));
                const int16R = sampleR < 0 ? Math.max(-32768, Math.floor(sampleR * 32768)) : Math.min(32767, Math.floor(sampleR * 32767));

                const offset = sf * 4;
                pcmView.setInt16(offset, int16L, true);
                pcmView.setInt16(offset + 2, int16R, true);
              }

              onAudioChunk(pcmBuffer);
              frameIndex = 0;
            }
          } else {
            frameIndex = 0;
          }
        }

        // Throttled VU Level and Decibels update
        const now = performance.now();
        if (now - lastLevelUpdate > 60) {
          lastLevelUpdate = now;
          const db = maxSamplePeak > 0 ? 20 * Math.log10(maxSamplePeak) : -100;
          setDecibels(Math.round(db));
          setAudioLevel(Math.min(100, Math.round(maxSamplePeak * 100)));
        }
      };

      // Connect: Source -> Analyser -> Processor -> Destination (muted)
      sourceNode.connect(analyserNode);
      analyserNode.connect(processor);

      const muteGain = audioCtx.createGain();
      muteGain.gain.setValueAtTime(0, audioCtx.currentTime);
      processor.connect(muteGain);
      muteGain.connect(audioCtx.destination);

      setMicActive(true);
      await refreshDevices();
    } catch (err: any) {
      console.error('[AudioCapture] Mic capture failed:', err);
      setMicError(`Microphone access error: ${err.message}`);
      setMicActive(false);
    }
  }, [onAudioChunk, refreshDevices, selectedDeviceId]);

  const stopMic = useCallback(() => {
    if (processorNodeRef.current) {
      processorNodeRef.current.disconnect();
      processorNodeRef.current = null;
    }
    if (analyserNodeRef.current) {
      analyserNodeRef.current.disconnect();
      analyserNodeRef.current = null;
    }
    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach((track) => track.stop());
      mediaStreamRef.current = null;
    }
    if (audioContextRef.current && audioContextRef.current.state !== 'closed') {
      audioContextRef.current.close().catch(() => {});
      audioContextRef.current = null;
    }

    setMicActive(false);
    setIsSpeaking(false);
    isSpeakingRef.current = false;
    onPttStateChange(false);
  }, [onPttStateChange]);

  const setSpeaking = useCallback((speaking: boolean) => {
    if (isSpeakingRef.current === speaking) return;
    setIsSpeaking(speaking);
    isSpeakingRef.current = speaking;
    onPttStateChange(speaking);
  }, [onPttStateChange]);

  const toggleSpeaking = useCallback(() => {
    const next = !isSpeakingRef.current;
    setSpeaking(next);
  }, [setSpeaking]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable)) {
        return;
      }

      if (e.code === 'Space') {
        e.preventDefault();
        if (speakMode === 'ptt') {
          if (!isSpeakingRef.current) {
            setSpeaking(true);
          }
        } else if (speakMode === 'toggle' && !e.repeat) {
          toggleSpeaking();
        }
      }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      if (e.code === 'Space' && speakMode === 'ptt') {
        e.preventDefault();
        setSpeaking(false);
      }
    };

    const handleBlur = () => {
      if (speakMode === 'ptt' && isSpeakingRef.current) {
        setSpeaking(false);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    window.addEventListener('blur', handleBlur);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
      window.removeEventListener('blur', handleBlur);
    };
  }, [speakMode, setSpeaking, toggleSpeaking]);

  return {
    audioDevices,
    selectedDeviceId,
    setSelectedDeviceId,
    params,
    updateParam,
    applyPreset,
    speakMode,
    setSpeakMode,
    isSpeaking,
    setSpeaking,
    toggleSpeaking,
    micActive,
    audioLevel,
    decibels,
    micError,
    startMic,
    stopMic,
    analyserNode: analyserNodeRef.current,
    volumeMultiplier,
    setVolumeMultiplier,
  };
}

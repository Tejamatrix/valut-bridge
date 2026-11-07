import time
import numpy as np
import sounddevice as sd
from scipy.signal import butter, lfilter

class AudioDSP:
    def __init__(self, sample_rate=48000):
        self.sample_rate = sample_rate
        # 80 Hz high pass to eliminate DC offset and sub-rumble
        b_hp, a_hp = butter(2, 80 / (sample_rate / 2), btype='highpass')
        self.b_hp = b_hp
        self.a_hp = a_hp
        self.zi_hp = np.zeros(max(len(a_hp), len(b_hp)) - 1)

        # Low shelf / Bass boost around 150 Hz
        b_bass, a_bass = butter(2, 180 / (sample_rate / 2), btype='lowpass')
        self.b_bass = b_bass
        self.a_bass = a_bass
        self.zi_bass = np.zeros(max(len(a_bass), len(b_bass)) - 1)

    def process(self, data, gain=10.0, mode="Clean Booster", noise_gate_thresh_db=-55.0, bass_boost_amount=0.0):
        """
        data: numpy array shape (N, 1) or (N,) float32
        gain: linear multiplier (1.0 = normal, 10.0 = 10x loud, 30.0 = extreme)
        mode: "Clean Booster", "Ear-Rape / Hard Clip", "Megaphone / Radio"
        noise_gate_thresh_db: threshold in dB below which audio is gated/silenced
        bass_boost_amount: 0.0 to 3.0
        """
        samples = data.flatten()

        # 1. High-pass filter to remove DC bias & subsonic rumble
        try:
            samples, self.zi_hp = lfilter(self.b_hp, self.a_hp, samples, zi=self.zi_hp)
        except Exception:
            pass

        # 2. Noise Gate check (to stop 10x amplified room hiss when silent)
        rms = np.sqrt(np.mean(samples ** 2) + 1e-12)
        rms_db = 20 * np.log10(rms + 1e-12)
        
        gate_gain = 1.0
        if noise_gate_thresh_db > -90.0:
            if rms_db < noise_gate_thresh_db:
                gate_gain = 0.0
            elif rms_db < (noise_gate_thresh_db + 6.0):
                # Smooth 6dB transition curve
                gate_gain = (rms_db - noise_gate_thresh_db) / 6.0
        samples *= gate_gain

        # 3. Bass Boost (if enabled)
        if bass_boost_amount > 0.0:
            try:
                low_freqs, self.zi_bass = lfilter(self.b_bass, self.a_bass, samples, zi=self.zi_bass)
                samples = samples + (low_freqs * bass_boost_amount)
            except Exception:
                pass

        # 4. Apply Gain (User's 10x or custom volume)
        samples *= gain

        # 5. Non-linear Limiting & Saturation Modes
        if mode == "Clean Booster":
            # Soft tanh saturation curve: allows extreme loudness without ugly square clicks
            # Normalizes softly up to 1.0 max ceiling
            samples = np.tanh(samples * 1.2) * 0.98

        elif mode == "Ear-Rape / Hard Clip":
            # Hard clip at +/- 1.0 with raw edge
            samples = np.clip(samples, -1.0, 1.0)

        elif mode == "Megaphone / Radio":
            # Heavy drive and bandpass distortion
            samples = np.clip(np.tanh(samples * 2.5) * 1.5, -1.0, 1.0)

        return samples.reshape(-1, 1).astype(np.float32), float(rms)


class AudioEngine:
    def __init__(self):
        self.stream = None
        self.is_running = False
        self.sample_rate = 48000
        self.block_size = 512

        # Parameters
        self.gain = 10.0  # 10x loudness default
        self.mode = "Clean Booster"
        self.noise_gate_thresh_db = -50.0
        self.bass_boost = 0.0
        self.is_muted = False

        # Devices
        self.input_device_id = None
        self.output_device_id = None

        # Level meters (thread-safe reading)
        self.current_in_level = 0.0
        self.current_out_level = 0.0

        self.dsp = AudioDSP(self.sample_rate)

    @staticmethod
    def get_devices():
        devices = sd.query_devices()
        hostapis = sd.query_hostapis()
        
        inputs = []
        outputs = []

        for idx, dev in enumerate(devices):
            hostapi_name = hostapis[dev['hostapi']]['name']
            name = f"{dev['name']} ({hostapi_name})"
            if dev['max_input_channels'] > 0:
                inputs.append((idx, name, dev['name']))
            if dev['max_output_channels'] > 0:
                outputs.append((idx, name, dev['name']))

        return inputs, outputs

    def _audio_callback(self, indata, outdata, frames, time_info, status):
        if status:
            pass  # Overflow or underflow

        in_peak = float(np.max(np.abs(indata)))
        self.current_in_level = in_peak

        if self.is_muted:
            outdata.fill(0)
            self.current_out_level = 0.0
            return

        processed, _ = self.dsp.process(
            indata,
            gain=self.gain,
            mode=self.mode,
            noise_gate_thresh_db=self.noise_gate_thresh_db,
            bass_boost_amount=self.bass_boost
        )

        out_peak = float(np.max(np.abs(processed)))
        self.current_out_level = out_peak

        outdata[:] = processed

    def start(self, input_device_id, output_device_id):
        self.stop()
        self.input_device_id = input_device_id
        self.output_device_id = output_device_id

        self.dsp = AudioDSP(self.sample_rate)

        # Open full duplex low latency stream
        self.stream = sd.Stream(
            device=(self.input_device_id, self.output_device_id),
            samplerate=self.sample_rate,
            blocksize=self.block_size,
            dtype='float32',
            channels=1,
            latency='low',
            callback=self._audio_callback
        )
        self.stream.start()
        self.is_running = True

    def stop(self):
        if self.stream is not None:
            try:
                self.stream.stop()
                self.stream.close()
            except Exception:
                pass
            self.stream = None
        self.is_running = False
        self.current_in_level = 0.0
        self.current_out_level = 0.0

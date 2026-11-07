import sys
import os
import threading
import time
import tkinter as tk
from tkinter import messagebox
import customtkinter as ctk
import numpy as np

from audio_engine import AudioEngine
import cable_installer

# Appearance setup
ctk.set_appearance_mode("Dark")
ctk.set_default_color_theme("blue")

class LoudVoiceApp(ctk.CTk):
    def __init__(self):
        super().__init__()

        self.title("LoudVoice — Extreme Discord Voice Interface")
        self.geometry("780x880")
        self.minsize(720, 800)

        self.engine = AudioEngine()
        self.monitor_headphone_device_id = None
        self.original_output_device_id = None

        self._build_ui()
        self._load_devices()
        self._start_meter_thread()

    def _build_ui(self):
        # Container frame
        self.main_scroll = ctk.CTkScrollableFrame(self, fg_color="transparent")
        self.main_scroll.pack(fill="both", expand=True, padx=20, pady=20)

        # 1. Header
        header_frame = ctk.CTkFrame(self.main_scroll, fg_color="#181824", corner_radius=12)
        header_frame.pack(fill="x", pady=(0, 15), ipady=8)

        title = ctk.CTkLabel(
            header_frame, 
            text="⚡ LOUDVOICE INTERFACE", 
            font=ctk.CTkFont(size=24, weight="bold"),
            text_color="#FF3366"
        )
        title.pack(anchor="w", padx=20, pady=(10, 2))

        subtitle = ctk.CTkLabel(
            header_frame, 
            text="Real-time 10x-50x Microphone Pre-amp, Clipper & Discord Audio Bridge", 
            font=ctk.CTkFont(size=13),
            text_color="#A0A0B0"
        )
        subtitle.pack(anchor="w", padx=20, pady=(0, 10))

        # 2. Devices Setup Frame
        dev_frame = ctk.CTkFrame(self.main_scroll, corner_radius=12)
        dev_frame.pack(fill="x", pady=(0, 15), padx=0, ipady=10)

        dev_title = ctk.CTkLabel(dev_frame, text="1. AUDIO ROUTING", font=ctk.CTkFont(size=15, weight="bold"))
        dev_title.pack(anchor="w", padx=20, pady=(10, 8))

        # Input Mic
        lbl_in = ctk.CTkLabel(dev_frame, text="Input Microphone (Your Real Mic):", font=ctk.CTkFont(size=12))
        lbl_in.pack(anchor="w", padx=20, pady=(2, 2))
        self.combo_input = ctk.CTkComboBox(dev_frame, values=[], width=680, command=self._on_device_changed)
        self.combo_input.pack(fill="x", padx=20, pady=(0, 10))

        # Output Virtual Cable
        lbl_out = ctk.CTkLabel(dev_frame, text="Output Device (Send to 'CABLE Input' or Headphones to test):", font=ctk.CTkFont(size=12))
        lbl_out.pack(anchor="w", padx=20, pady=(2, 2))
        self.combo_output = ctk.CTkComboBox(dev_frame, values=[], width=680, command=self._on_device_changed)
        self.combo_output.pack(fill="x", padx=20, pady=(0, 10))

        # Device action buttons
        btn_dev_row = ctk.CTkFrame(dev_frame, fg_color="transparent")
        btn_dev_row.pack(fill="x", padx=20, pady=(2, 5))

        self.btn_refresh = ctk.CTkButton(
            btn_dev_row, 
            text="🔄 Refresh Devices", 
            width=150, 
            fg_color="#2D3250", 
            hover_color="#424769",
            command=self._load_devices
        )
        self.btn_refresh.pack(side="left", padx=(0, 10))

        self.btn_install_cable = ctk.CTkButton(
            btn_dev_row, 
            text="📥 Install VB-CABLE Driver", 
            width=200, 
            fg_color="#3F2E56", 
            hover_color="#5D4B78",
            command=self._install_vbcable
        )
        self.btn_install_cable.pack(side="left", padx=(0, 10))

        self.btn_discord_guide = ctk.CTkButton(
            btn_dev_row, 
            text="⚙️ Discord Settings Setup", 
            width=180, 
            fg_color="#1E3E62", 
            hover_color="#005C78",
            command=self._show_discord_guide
        )
        self.btn_discord_guide.pack(side="right")

        # 3. Main Power & Presets
        control_frame = ctk.CTkFrame(self.main_scroll, corner_radius=12)
        control_frame.pack(fill="x", pady=(0, 15), ipady=10)

        ctrl_title = ctk.CTkLabel(control_frame, text="2. GAIN & VOLUME MULTIPLIER", font=ctk.CTkFont(size=15, weight="bold"))
        ctrl_title.pack(anchor="w", padx=20, pady=(10, 5))

        # Multiplier display
        self.lbl_gain_val = ctk.CTkLabel(
            control_frame, 
            text="10.0x (+20.0 dB)", 
            font=ctk.CTkFont(size=32, weight="bold"),
            text_color="#FF3366"
        )
        self.lbl_gain_val.pack(pady=(2, 4))

        # Slider
        self.slider_gain = ctk.CTkSlider(
            control_frame, 
            from_=1.0, 
            to=50.0, 
            number_of_steps=98, 
            width=680, 
            progress_color="#FF3366", 
            button_color="#FF3366",
            button_hover_color="#FF6688",
            command=self._on_gain_slider
        )
        self.slider_gain.set(10.0)
        self.slider_gain.pack(padx=20, pady=(0, 12))

        # Quick preset buttons
        preset_row = ctk.CTkFrame(control_frame, fg_color="transparent")
        preset_row.pack(fill="x", padx=20, pady=(0, 10))

        presets = [
            ("1x Normal", 1.0),
            ("5x Loud", 5.0),
            ("10x Extreme (Target)", 10.0),
            ("25x Insane", 25.0),
            ("50x Ear-Destroyer", 50.0)
        ]

        for p_name, p_val in presets:
            btn = ctk.CTkButton(
                preset_row, 
                text=p_name, 
                font=ctk.CTkFont(size=11, weight="bold"),
                fg_color="#222831" if p_val != 10.0 else "#990033",
                hover_color="#393E46" if p_val != 10.0 else "#CC0044",
                width=120,
                command=lambda v=p_val: self._set_gain_preset(v)
            )
            btn.pack(side="left", expand=True, padx=3)

        # 4. Processing Modes & Filters
        dsp_frame = ctk.CTkFrame(self.main_scroll, corner_radius=12)
        dsp_frame.pack(fill="x", pady=(0, 15), ipady=10)

        dsp_title = ctk.CTkLabel(dsp_frame, text="3. SOUND COLOR & DISTORTION ENGINE", font=ctk.CTkFont(size=15, weight="bold"))
        dsp_title.pack(anchor="w", padx=20, pady=(10, 5))

        # Mode Selector
        lbl_mode = ctk.CTkLabel(dsp_frame, text="Audio Processing Mode:")
        lbl_mode.pack(anchor="w", padx=20, pady=(2, 2))
        
        self.mode_var = ctk.StringVar(value="Clean Booster")
        self.seg_mode = ctk.CTkSegmentedButton(
            dsp_frame,
            values=["Clean Booster", "Ear-Rape / Hard Clip", "Megaphone / Radio"],
            variable=self.mode_var,
            command=self._on_mode_changed,
            selected_color="#FF3366",
            selected_hover_color="#E02958"
        )
        self.seg_mode.pack(fill="x", padx=20, pady=(0, 12))

        # Bass Boost Slider
        lbl_bass = ctk.CTkLabel(dsp_frame, text="Bass Boost (Deep Thunder Resonance):")
        lbl_bass.pack(anchor="w", padx=20, pady=(2, 2))
        self.slider_bass = ctk.CTkSlider(
            dsp_frame, 
            from_=0.0, 
            to=3.0, 
            width=680, 
            command=self._on_bass_slider
        )
        self.slider_bass.set(0.0)
        self.slider_bass.pack(padx=20, pady=(0, 12))

        # Noise Gate
        lbl_gate = ctk.CTkLabel(dsp_frame, text="Noise Gate (Suppresses background static/room noise when quiet):")
        lbl_gate.pack(anchor="w", padx=20, pady=(2, 2))
        self.slider_gate = ctk.CTkSlider(
            dsp_frame, 
            from_=-80.0, 
            to=-30.0, 
            width=680, 
            command=self._on_gate_slider
        )
        self.slider_gate.set(-50.0)
        self.slider_gate.pack(padx=20, pady=(0, 10))

        # 5. Live Meters
        meter_frame = ctk.CTkFrame(self.main_scroll, corner_radius=12)
        meter_frame.pack(fill="x", pady=(0, 15), ipady=10)

        meter_title = ctk.CTkLabel(meter_frame, text="4. LIVE AUDIO METERS", font=ctk.CTkFont(size=15, weight="bold"))
        meter_title.pack(anchor="w", padx=20, pady=(10, 5))

        # Input Meter
        lbl_in_meter = ctk.CTkLabel(meter_frame, text="Mic Input Level:")
        lbl_in_meter.pack(anchor="w", padx=20)
        self.bar_in = ctk.CTkProgressBar(meter_frame, width=680, progress_color="#00ADB5")
        self.bar_in.set(0.0)
        self.bar_in.pack(padx=20, pady=(2, 8))

        # Output Meter
        lbl_out_meter = ctk.CTkLabel(meter_frame, text="Amplified Output Level (Discord):")
        lbl_out_meter.pack(anchor="w", padx=20)
        self.bar_out = ctk.CTkProgressBar(meter_frame, width=680, progress_color="#FF2E63")
        self.bar_out.set(0.0)
        self.bar_out.pack(padx=20, pady=(2, 10))

        # 6. Master Controls (Start / Stop / Mute / Listen)
        action_frame = ctk.CTkFrame(self.main_scroll, fg_color="transparent")
        action_frame.pack(fill="x", pady=(5, 10))

        self.btn_toggle_power = ctk.CTkButton(
            action_frame, 
            text="▶ START BOOSTING", 
            font=ctk.CTkFont(size=18, weight="bold"),
            height=55,
            fg_color="#00B894", 
            hover_color="#00997B",
            command=self._toggle_power
        )
        self.btn_toggle_power.pack(side="left", fill="x", expand=True, padx=(0, 10))

        self.btn_mute = ctk.CTkButton(
            action_frame, 
            text="🎙️ Mute Mic", 
            font=ctk.CTkFont(size=14, weight="bold"),
            height=55,
            width=130,
            fg_color="#393E46", 
            hover_color="#4E5561",
            command=self._toggle_mute
        )
        self.btn_mute.pack(side="left", padx=(0, 10))

        self.switch_monitor = ctk.CTkSwitch(
            action_frame, 
            text="🎧 Test in My Headphones", 
            font=ctk.CTkFont(size=13, weight="bold"),
            command=self._toggle_monitor
        )
        self.switch_monitor.pack(side="right", padx=(10, 0))

    def _load_devices(self):
        inputs, outputs = AudioEngine.get_devices()
        self.input_device_map = inputs
        self.output_device_map = outputs

        in_names = [f"[{i[0]}] {i[1]}" for i in inputs]
        out_names = [f"[{o[0]}] {o[1]}" for o in outputs]

        self.combo_input.configure(values=in_names)
        self.combo_output.configure(values=out_names)

        # Smart defaults:
        # For input: look for real headset or microphone
        default_in_idx = 0
        for idx, (dev_id, full_name, raw_name) in enumerate(inputs):
            if any(k in raw_name.lower() for k in ["headset", "microphone array", "realtek"]):
                default_in_idx = idx
                break
        if in_names:
            self.combo_input.set(in_names[default_in_idx])

        # For output: prefer VB-Audio Virtual Cable (CABLE Input)
        default_out_idx = 0
        cable_found = False
        for idx, (dev_id, full_name, raw_name) in enumerate(outputs):
            if "cable input" in raw_name.lower() or "vb-audio" in raw_name.lower():
                default_out_idx = idx
                cable_found = True
                break
            elif "headphones" in raw_name.lower() or "speaker" in raw_name.lower():
                if not cable_found:
                    default_out_idx = idx

        if out_names:
            self.combo_output.set(out_names[default_out_idx])

    def _get_selected_ids(self):
        in_str = self.combo_input.get()
        out_str = self.combo_output.get()

        try:
            in_id = int(in_str.split("]")[0].replace("[", ""))
        except Exception:
            in_id = None

        try:
            out_id = int(out_str.split("]")[0].replace("[", ""))
        except Exception:
            out_id = None

        return in_id, out_id

    def _on_gain_slider(self, val):
        val = round(float(val), 1)
        db = 20 * np.log10(val)
        self.lbl_gain_val.configure(text=f"{val:.1f}x (+{db:.1f} dB)")
        self.engine.gain = val

    def _set_gain_preset(self, val):
        self.slider_gain.set(val)
        self._on_gain_slider(val)

    def _on_mode_changed(self, mode):
        self.engine.mode = mode

    def _on_bass_slider(self, val):
        self.engine.bass_boost = float(val)

    def _on_gate_slider(self, val):
        self.engine.noise_gate_thresh_db = float(val)

    def _on_device_changed(self, choice=None):
        if self.engine.is_running:
            self._restart_stream()

    def _toggle_power(self):
        if self.engine.is_running:
            self.engine.stop()
            self.btn_toggle_power.configure(
                text="▶ START BOOSTING", 
                fg_color="#00B894", 
                hover_color="#00997B"
            )
        else:
            in_id, out_id = self._get_selected_ids()
            if in_id is None or out_id is None:
                messagebox.showerror("Error", "Please select valid Input and Output audio devices.")
                return
            try:
                self.engine.start(in_id, out_id)
                self.btn_toggle_power.configure(
                    text="⏹ STOP BOOSTING", 
                    fg_color="#D63031", 
                    hover_color="#C0392B"
                )
            except Exception as e:
                messagebox.showerror("Audio Engine Error", f"Failed to start stream:\n{str(e)}")

    def _restart_stream(self):
        if self.engine.is_running:
            in_id, out_id = self._get_selected_ids()
            try:
                self.engine.start(in_id, out_id)
            except Exception as e:
                self.engine.stop()
                self.btn_toggle_power.configure(
                    text="▶ START BOOSTING", 
                    fg_color="#00B894", 
                    hover_color="#00997B"
                )
                messagebox.showerror("Error", f"Device switch failed:\n{e}")

    def _toggle_mute(self):
        self.engine.is_muted = not self.engine.is_muted
        if self.engine.is_muted:
            self.btn_mute.configure(text="🔇 MUTED", fg_color="#D63031")
        else:
            self.btn_mute.configure(text="🎙️ Mute Mic", fg_color="#393E46")

    def _toggle_monitor(self):
        # Switch output between selected device and headphones
        if self.switch_monitor.get() == 1:
            # Find user's headphones / speakers
            headphone_idx = None
            for idx, name, raw in self.output_device_map:
                if any(k in raw.lower() for k in ["headphone", "headset", "speaker"]):
                    headphone_idx = idx
                    break
            if headphone_idx is not None:
                self.original_output_str = self.combo_output.get()
                for out_str in self.combo_output.cget("values"):
                    if out_str.startswith(f"[{headphone_idx}]"):
                        self.combo_output.set(out_str)
                        break
                if self.engine.is_running:
                    self._restart_stream()
        else:
            if hasattr(self, 'original_output_str') and self.original_output_str:
                self.combo_output.set(self.original_output_str)
                if self.engine.is_running:
                    self._restart_stream()

    def _install_vbcable(self):
        ans = messagebox.askyesno(
            "Install VB-CABLE Driver",
            "This will download the official free VB-Audio Virtual Cable driver and launch the installer as Administrator.\n\nAfter installation, restart LoudVoice to see 'CABLE Input'. Proceed?"
        )
        if not ans:
            return

        def run_install():
            try:
                exe = cable_installer.download_and_extract_vbcable()
                cable_installer.launch_installer(exe)
                self.after(1000, lambda: messagebox.showinfo(
                    "Setup Launched", 
                    "The VB-CABLE installer has been launched!\n\n1. Click 'Install Driver' in the installer window.\n2. When finished, return here and click 'Refresh Devices'."
                ))
            except Exception as e:
                self.after(0, lambda: messagebox.showerror("Download Error", str(e)))

        threading.Thread(target=run_install, daemon=True).start()

    def _show_discord_guide(self):
        guide_win = ctk.CTkToplevel(self)
        guide_win.title("Discord Configuration Checklist")
        guide_win.geometry("560x520")
        guide_win.attributes("-topmost", True)

        txt = (
            "CRITICAL DISCORD SETTINGS FOR 10x LOUD VOICE:\n\n"
            "Open Discord -> User Settings (Gear icon) -> Voice & Video:\n\n"
            "1. INPUT DEVICE:\n"
            "   Select 'CABLE Output (VB-Audio Virtual Cable)'\n\n"
            "2. INPUT VOLUME SLIDER:\n"
            "   Set to 100%\n\n"
            "3. INPUT SENSITIVITY:\n"
            "   Turn OFF 'Automatically determine input sensitivity'\n"
            "   Set the slider to around -60 dB to -50 dB so it never cuts you off\n\n"
            "4. NOISE SUPPRESSION:\n"
            "   Set to 'None' (Turn OFF Krisp & Standard)\n"
            "   *Important: Krisp suppresses extreme volume and screaming!*\n\n"
            "5. ADVANCED VOICE PROCESSING (Scroll Down):\n"
            "   - Echo Cancellation: OFF\n"
            "   - Noise Reduction: OFF\n"
            "   - Automatic Gain Control: MUST BE TURNED OFF\n"
            "     (If AGC is ON, Discord will automatically lower your 10x volume back down!)\n\n"
            "Once configured, you will be 10x louder to everyone in the call!"
        )

        label = ctk.CTkLabel(
            guide_win, 
            text=txt, 
            justify="left", 
            font=ctk.CTkFont(size=13),
            wraplength=500
        )
        label.pack(padx=20, pady=20)

        btn_close = ctk.CTkButton(guide_win, text="Got it!", command=guide_win.destroy, width=120)
        btn_close.pack(pady=(0, 20))

    def _start_meter_thread(self):
        def update_meters():
            while True:
                time.sleep(0.04) # ~25 fps
                if self.engine.is_running:
                    in_lvl = min(1.0, self.engine.current_in_level * 2.0)
                    out_lvl = min(1.0, self.engine.current_out_level)
                    self.bar_in.set(in_lvl)
                    self.bar_out.set(out_lvl)
                else:
                    self.bar_in.set(0.0)
                    self.bar_out.set(0.0)

        t = threading.Thread(target=update_meters, daemon=True)
        t.start()


if __name__ == "__main__":
    app = LoudVoiceApp()
    app.mainloop()

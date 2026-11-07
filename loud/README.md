# ⚡ LoudVoice — Extreme Discord Voice Booster & Interface

A dedicated low-latency real-time voice pre-amp and digital booster designed to sit between your physical microphone and Discord, giving you **10x to 50x loudness**, distortion modes, bass boost, and anti-background-hiss noise gating.

---

## 🛠️ How Audio Routing Works to Discord

Normally, your microphone connects directly to Discord:
```
[Physical Mic] ───────────────► [Discord] (Capped at normal volume)
```

With **LoudVoice**:
```
[Physical Mic] 
       │
       ▼
[LoudVoice Engine] (10x Gain Boost + Tanh Soft Limiter + Bass Boost + Gate)
       │
       ▼
[CABLE Input (VB-Audio Virtual Cable)]
       │
       ▼
[Discord] (Listens to 'CABLE Output' at 10x massive volume!)
```

---

## 🚀 Quick Start

1. **Install Virtual Audio Cable (Required once)**:
   - Click the **"📥 Install VB-CABLE Driver"** button inside the app (or run `python cable_installer.py`).
   - Extract and run `VBCABLE_Setup_x64.exe` as Administrator, and click **Install Driver**.
   - Restart the app and click **🔄 Refresh Devices**.

2. **Select Devices**:
   - **Input**: Select your real microphone (e.g., `Microphone Array` or `Headset (ZEB-THUNDER PRO)`).
   - **Output**: Select `CABLE Input (VB-Audio Virtual Cable)`.
   *(Tip: Turn on the **"🎧 Test in My Headphones"** switch to hear the volume in your ears before broadcasting!)*

3. **Set Multiplier**:
   - Slide or click the **10x Extreme** preset (+20 dB boost!).

4. **Start Stream**:
   - Click **▶ START BOOSTING**.

---

## ⚙️ Critical Discord Settings Checklist

Discord by default has features designed to silence screams and normalize loud audio. **You must turn these off for 10x loudness to work**:

Open **Discord Settings (Gear Icon) -> Voice & Video**:
1. **Input Device**: Change to `CABLE Output (VB-Audio Virtual Cable)`.
2. **Input Volume**: Set to `100%`.
3. **Input Sensitivity**: Disable *"Automatically determine input sensitivity"* and slide the bar to `-60 dB`.
4. **Noise Suppression**: Set to **None** *(Turn OFF Krisp — Krisp silences boosted volume!)*.
5. **Advanced**:
   - **Echo Cancellation**: Turn OFF
   - **Noise Reduction**: Turn OFF
   - **Automatic Gain Control (AGC)**: **TURN OFF** *(If left on, Discord will quietly reduce your volume back down!)*

---

## 🎛️ Audio Modes

- **Clean Booster (Soft Limiter)**: Uses smooth hyperbolic tangent (`tanh`) compression. Makes you sound gigantic, deep, and 10x louder without harsh digital buzzing or clicks.
- **Ear-Rape / Hard Clip**: Hard clippers that transform your voice into pure square waves when screaming.
- **Megaphone / Radio**: High-frequency drive that simulates an overdriven police radio or bullhorn.
- **Noise Gate Slider**: Completely cuts microphone hiss when you are not speaking so the 10x gain does not create background static.
- **Bass Boost Slider**: Thickens the fundamental frequencies of your voice for an intimidating bass punch.

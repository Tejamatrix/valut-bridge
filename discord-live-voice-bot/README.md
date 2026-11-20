# Discord Live Voice Bot 🎙️⚡

An ultra-low latency, real-time microphone broadcasting system designed to stream live audio directly from your browser microphone into Discord voice channels with sub-50ms latency and native **Discord DAVE E2EE** support.

Supports **Discord User Account Tokens (Bluecord, Mobile, Desktop/Web Client)** as well as standard bot tokens.

---

## 🌟 Key Features

- **Discord User Account Token Support (Bluecord & Client)**:
  - Connect with your Discord user token extracted directly from **Bluecord** or browser DevTools.
  - Automatically loads all your servers and voice channels without requiring bot invites or server admin permissions.
- **Ultra-Low Latency Direct PCM Pipeline**:
  - Web Audio API captures microphone audio at **48,000 Hz** (native Discord sample rate).
  - Audio frames are converted directly into 16-bit signed PCM stereo (`StreamType.Raw`) and streamed via WebSockets / Socket.io binary chunks.
  - Zero browser WebM container delays and zero ffmpeg re-encoding latency.
- **Modern Discord DAVE Protocol Support**:
  - Integrated with `@discordjs/voice` (v0.19+) and `@snazzah/davey` for Discord's modern End-to-End Encryption (E2EE) protocol.
  - Enforces `entersState(connection, VoiceConnectionStatus.Ready, 10000)` verification before audio transmission.
- **Intelligent Jitter & Silence Buffer**:
  - Continuous 20ms frame loop (3,840 bytes/packet) prevents stream starvation or audio player disconnects during pauses in speech.
  - Buffer length monitoring prevents latency accumulation.
- **Cyber / Discord-Themed Real-Time Dashboard**:
  - **Dynamic Push-to-Talk (PTT)**: Interactive Hold-to-Speak button with pulsating sound rings and **Spacebar** hotkey support.
  - **Toggle-to-Speak Mode**: One-click latching mode for hands-free broadcasting.
  - **Live VU Meter & Frequency Spectrum**: Real-time canvas audio visualizer and -60 dB to 0 dB peak meter.
  - **Microphone Hardware & Gain Booster**: Device selector + 100% to 300% (1.0x to 3.0x) software gain multiplier.
  - **One-Click Voice Router**: Real-time server and voice channel selector with instant Join & Leave controls.
  - **Discord Self-Controls**: Live Self-Mute, Self-Deafen, and Gateway Ping display.

---

## 🚀 Quick Start Guide

### 1. Run in Development Mode
```bash
npm run dev
```
- Web Dashboard: **[http://localhost:5173/](http://localhost:5173/)**
- Backend API & WebSockets: **http://localhost:4000**

### 2. Connect Your Account Token from Bluecord
1. Open **Bluecord** on your phone / emulator.
2. Go to **Settings** ➔ **Bluecord Settings** ➔ **Account** ➔ tap **Copy Token**.
3. Open **[http://localhost:5173/](http://localhost:5173/)**, paste your token into the **Discord Account Authentication** box, and click **Connect Account**.
4. Select any server and voice channel you want to broadcast in.
5. Click **Start Mic**, hold **Spacebar** or the Push-to-Talk button, and your voice will be streamed live into the Discord voice channel!

---

## 📄 License
MIT

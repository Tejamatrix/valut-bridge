# 🛡️ VaultBridge — Remote Mobile Emergency Data & File Bridge

> **Secure remote document & emergency data retrieval system.** Access your files, contacts, 2FA OTPs, and GPS location from any laptop browser even if your phone is lost, forgotten at home, or during emergencies.

---

## 🌟 Key Features

* 📁 **Remote File Explorer**:
  * Browse `/storage/emulated/0` (Internal Storage, SD Card, Downloads, WhatsApp Documents, DCIM).
  * Fast search across phone storage by filename or extension (`.pdf`, `.docx`, `.jpg`, etc.).
  * Resilient chunk-based file downloader with SHA-256 integrity verification.
* 🛡️ **Emergency Data Extraction**:
  * **Contacts Export**: View and 1-click export all contacts to `.vcf` (vCard) or CSV.
  * **2FA & SMS Recovery**: Fetch recent SMS verification codes to log into your email/bank when locked out.
* 📍 **Lost Phone Radar**:
  * Battery percentage, charging status, and network connection info.
  * Live GPS coordinates with direct Google Maps link.
  * Emergency Siren: Trigger a 100% volume alarm on the phone to find it nearby.
* 🔐 **Secure & Permission-First**:
  * 6-digit Quick PIN pairing or Device ID + Master Secret.
  * Runs as a battery-optimized Android Foreground Service with auto-boot restart (`RECEIVE_BOOT_COMPLETED`).

---

## 📂 Project Architecture

```
mobile-emergency-bridge/
├── server/               # Node.js WebSocket & Express Relay + Web Dashboard Host
│   ├── index.js          # Pairing logic, device registry, command routing
│   └── public/           # Modern Glassmorphic Web Dashboard UI
├── simulator/            # Mock Android Agent for immediate laptop testing
│   ├── device.js         # Simulates Android storage, battery, SMS, contacts, GPS
│   └── storage/          # Sample documents (Passport scan, Tickets, Agreements)
├── android-client/       # Complete Native Android Studio Kotlin Project
│   ├── app/src/main/
│   │   ├── AndroidManifest.xml
│   │   └── java/com/vaultbridge/emergency/
│   │       ├── MainActivity.kt
│   │       ├── service/EmergencyBridgeService.kt
│   │       ├── service/BootReceiver.kt
│   │       └── modules/FileManager.kt & EmergencyDataManager.kt
└── web-dashboard/        # Standalone copy of the Dashboard
```

---

## 🚀 Quick Start (Test It on Your Laptop in 30 Seconds!)

You don't need an Android device plugged in right away to see the whole system in action. The built-in simulator emulates a phone with sample files:

### 1. Start the Relay Server
Open a terminal:
```bash
cd mobile-emergency-bridge/server
npm start
```
The server will start at `http://localhost:4000`.

### 2. Start the Mobile Simulator
Open a second terminal:
```bash
cd mobile-emergency-bridge/simulator
npm start
```
The simulator will connect to the relay and print its **Pairing PIN** (e.g. `784219`).

### 3. Open the Dashboard on Your Laptop
1. Open your browser and go to: **[http://localhost:4000](http://localhost:4000)**
2. Click **Device Pairing** (or enter the 6-digit PIN / default secret `emergency123`).
3. You can now:
   * Browse folders like `Download/` and `Documents/`.
   * Download `Passport_Scan_Confidential.pdf` or `Flight_Ticket_E-Pass.pdf`.
   * Search for `.pdf` files.
   * Switch to the **2FA & SMS** tab and copy verification OTPs.
   * Switch to **Phone Radar** to view battery and GPS coordinates.
   * Trigger the Emergency Siren!

---

## 📱 Deploying to a Real Android Phone

When you are ready to install it on your actual Android smartphone:

1. Open the folder `mobile-emergency-bridge/android-client/` in **Android Studio**.
2. Connect your phone via USB (with USB Debugging enabled) and click **Run**.
3. On your phone:
   * Tap **1. Grant All Files Access** (Android Settings > Allow access to manage all files).
   * Tap **2. Grant SMS, Contacts & GPS**.
   * Tap **3. Disable Battery Optimization** (ensures Android does not put the bridge to sleep).
4. Enter your Relay Server address (e.g. `ws://192.168.1.X:4000` or your cloud URL) and tap **Save & Start Bridge Service**.
5. Your phone will generate a 6-digit PIN. Enter this PIN on your laptop to connect!

---

## 🌐 Deploying to the Cloud (Anywhere Access over 4G/5G)

To access your phone when you are away from home (over cellular data):
1. Deploy the `server/` folder to a free cloud host like **Render**, **Railway**, or a **VPS**.
2. Your server will get a public URL like `https://my-relay.onrender.com` (WebSocket: `wss://my-relay.onrender.com`).
3. Set that URL in both your Android App and open that URL on any laptop in the world to access your files in an emergency!

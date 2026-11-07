const http = require('http');
const express = require('express');
const { WebSocketServer, WebSocket } = require('ws');
const cors = require('cors');

const path = require('path');

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

const PORT = process.env.PORT || 4000;

// Device Registry
// key: deviceId -> { ws, deviceName, secretKey, pairingPin, lastSeen, status }
const devices = new Map();

// Dashboard sessions
// key: dashboardWs -> { deviceId }
const dashboardSessions = new Map();

// Pin lookup
// pin -> deviceId
const pinToDevice = new Map();

function generatePin() {
  let pin;
  do {
    pin = Math.floor(100000 + Math.random() * 900000).toString();
  } while (pinToDevice.has(pin));
  return pin;
}

// REST endpoints
app.get('/api/status', (req, res) => {
  res.json({
    status: 'online',
    connectedDevices: devices.size,
    timestamp: new Date().toISOString()
  });
});

app.get('/api/devices', (req, res) => {
  const list = [];
  for (const [id, dev] of devices.entries()) {
    list.push({
      deviceId: id,
      deviceName: dev.deviceName || 'Android Device',
      online: dev.ws && dev.ws.readyState === WebSocket.OPEN,
      lastSeen: dev.lastSeen,
      pairingPin: dev.pairingPin
    });
  }
  res.json(list);
});

const server = http.createServer(app);
const wss = new WebSocketServer({ server });

wss.on('connection', (ws) => {
  let role = null; // 'device' | 'dashboard'
  let currentDeviceId = null;

  ws.on('message', (messageRaw) => {
    try {
      const msg = JSON.parse(messageRaw.toString());
      const { type } = msg;

      // ==========================================
      // 1. MOBILE DEVICE REGISTRATION
      // ==========================================
      if (type === 'register_device') {
        const { deviceId, deviceName, secretKey } = msg;
        if (!deviceId) {
          ws.send(JSON.stringify({ type: 'error', message: 'Missing deviceId' }));
          return;
        }

        role = 'device';
        currentDeviceId = deviceId;

        // Generate or retain pairing PIN
        let pin = generatePin();
        pinToDevice.set(pin, deviceId);

        devices.set(deviceId, {
          ws,
          deviceName: deviceName || 'Android Phone',
          secretKey: secretKey || '',
          pairingPin: pin,
          lastSeen: Date.now(),
          status: 'online'
        });

        console.log(`[Device Registered] ${deviceName} (${deviceId}) | Pairing PIN: ${pin}`);

        ws.send(JSON.stringify({
          type: 'device_registered',
          deviceId,
          pairingPin: pin,
          message: 'Device registered successfully. Ready for emergency access.'
        }));
        return;
      }

      // ==========================================
      // 2. DASHBOARD AUTHENTICATION & PAIRING
      // ==========================================
      if (type === 'connect_dashboard') {
        let { deviceId, pairingPin, secretKey } = msg;

        // If PIN provided, resolve deviceId
        if (pairingPin && pinToDevice.has(pairingPin)) {
          deviceId = pinToDevice.get(pairingPin);
        }

        if (!deviceId || !devices.has(deviceId)) {
          ws.send(JSON.stringify({
            type: 'auth_failed',
            message: 'Device not found or offline. Verify your Device ID or PIN.'
          }));
          return;
        }

        const targetDev = devices.get(deviceId);
        
        // Optional secretKey verification
        if (targetDev.secretKey && targetDev.secretKey !== secretKey) {
          ws.send(JSON.stringify({
            type: 'auth_failed',
            message: 'Invalid Secret Key / Master Password.'
          }));
          return;
        }

        role = 'dashboard';
        currentDeviceId = deviceId;
        dashboardSessions.set(ws, { deviceId });

        console.log(`[Dashboard Connected] Linked to ${targetDev.deviceName} (${deviceId})`);

        ws.send(JSON.stringify({
          type: 'auth_success',
          deviceId,
          deviceName: targetDev.deviceName,
          message: `Connected securely to ${targetDev.deviceName}`
        }));

        // Immediately request device status to update dashboard
        if (targetDev.ws && targetDev.ws.readyState === WebSocket.OPEN) {
          targetDev.ws.send(JSON.stringify({
            type: 'command',
            action: 'get_status',
            requestId: 'initial_status'
          }));
        }
        return;
      }

      // ==========================================
      // 3. RELAY COMMANDS: DASHBOARD -> DEVICE
      // ==========================================
      if (role === 'dashboard') {
        const session = dashboardSessions.get(ws);
        if (!session || !devices.has(session.deviceId)) {
          ws.send(JSON.stringify({ type: 'error', message: 'Not connected to any device' }));
          return;
        }

        const targetDev = devices.get(session.deviceId);
        if (!targetDev.ws || targetDev.ws.readyState !== WebSocket.OPEN) {
          ws.send(JSON.stringify({
            type: 'device_offline',
            requestId: msg.requestId,
            message: 'Device is currently unreachable / asleep.'
          }));
          return;
        }

        // Forward message to mobile device
        targetDev.ws.send(JSON.stringify(msg));
        return;
      }

      // ==========================================
      // 4. RELAY RESPONSES: DEVICE -> DASHBOARD(S)
      // ==========================================
      if (role === 'device') {
        const dev = devices.get(currentDeviceId);
        if (dev) {
          dev.lastSeen = Date.now();
        }

        // Forward message to all dashboards observing this device
        for (const [dashWs, session] of dashboardSessions.entries()) {
          if (session.deviceId === currentDeviceId && dashWs.readyState === WebSocket.OPEN) {
            dashWs.send(JSON.stringify(msg));
          }
        }
        return;
      }

      // Ping/Heartbeat
      if (type === 'ping') {
        ws.send(JSON.stringify({ type: 'pong', timestamp: Date.now() }));
      }
    } catch (err) {
      console.error('[Error handling message]', err);
    }
  });

  ws.on('close', () => {
    if (role === 'device' && currentDeviceId) {
      console.log(`[Device Disconnected] ${currentDeviceId}`);
      const dev = devices.get(currentDeviceId);
      if (dev && dev.ws === ws) {
        dev.status = 'offline';
        // Notify any active dashboards
        for (const [dashWs, session] of dashboardSessions.entries()) {
          if (session.deviceId === currentDeviceId && dashWs.readyState === WebSocket.OPEN) {
            dashWs.send(JSON.stringify({
              type: 'device_status_change',
              status: 'offline',
              message: 'Mobile device lost connection.'
            }));
          }
        }
      }
    } else if (role === 'dashboard') {
      dashboardSessions.delete(ws);
      console.log(`[Dashboard Disconnected]`);
    }
  });
});

server.listen(PORT, () => {
  console.log(`=======================================================`);
  console.log(`  VaultBridge Relay Server Running on Port ${PORT}`);
  console.log(`  WebSocket Endpoint: ws://localhost:${PORT}`);
  console.log(`  HTTP Endpoint:      http://localhost:${PORT}`);
  console.log(`=======================================================`);
});

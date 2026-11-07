const WebSocket = require('ws');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const SERVER_URL = process.env.RELAY_URL || 'ws://localhost:4000';
const DEVICE_ID = process.env.DEVICE_ID || 'pixel-8-pro-secure';
const DEVICE_NAME = process.env.DEVICE_NAME || 'Google Pixel 8 Pro (Android 14)';
const SECRET_KEY = process.env.SECRET_KEY || 'emergency123';

const ROOT_STORAGE = path.resolve(__dirname, 'storage');

console.log(`Starting Mobile Device Agent Simulator...`);
console.log(`Device ID:    ${DEVICE_ID}`);
console.log(`Device Name:  ${DEVICE_NAME}`);
console.log(`Virtual Storage: ${ROOT_STORAGE}`);

let ws;
let reconnectTimer = null;

// Mock Android system state
let batteryLevel = 87;
let isCharging = false;
let gpsLocation = {
  latitude: 37.7749,
  longitude: -122.4194,
  accuracy: '12m',
  address: 'San Francisco, CA (Near Market St)',
  timestamp: new Date().toISOString()
};

const mockContacts = [
  { name: 'Dr. Sarah Connor (Family Doctor)', phone: '+1 (555) 302-8819', email: 'drconnor@medclinic.org' },
  { name: 'Mom (Emergency Contact 1)', phone: '+1 (555) 449-1122', email: 'mom.doe@gmail.com' },
  { name: 'Alex Smith (Lawyer / Attorney)', phone: '+1 (555) 890-3341', email: 'asmith@legalfirm.com' },
  { name: 'Office IT Helpdesk (24/7)', phone: '+1 (555) 901-0022', email: 'support@company.com' },
  { name: 'Apartment Building Superintendent', phone: '+1 (555) 882-9901', email: 'super@sunsetapartments.com' }
];

const mockSMS = [
  { from: 'ChaseBank', body: 'Chase Bank: Your 2FA emergency login OTP is 849201. Valid for 10 minutes. Do not share.', time: '10 mins ago', date: new Date(Date.now() - 10 * 60 * 1000).toISOString() },
  { from: 'Google', body: 'G-729104 is your Google verification code for account recovery.', time: '25 mins ago', date: new Date(Date.now() - 25 * 60 * 1000).toISOString() },
  { from: 'Mom', body: 'Hey, are you home yet? Let me know once you find your documents.', time: '1 hour ago', date: new Date(Date.now() - 60 * 60 * 1000).toISOString() },
  { from: 'WorkIT', body: 'VPN Access request approved for workstation WK-8819.', time: '3 hours ago', date: new Date(Date.now() - 180 * 60 * 1000).toISOString() }
];

function connect() {
  if (ws && (ws.readyState === WebSocket.OPEN || ws.readyState === WebSocket.CONNECTING)) {
    return;
  }

  console.log(`[Connecting to Relay Server: ${SERVER_URL}]...`);
  ws = new WebSocket(SERVER_URL);

  ws.on('open', () => {
    console.log(`[Connected to Relay!] Registering device...`);
    ws.send(JSON.stringify({
      type: 'register_device',
      deviceId: DEVICE_ID,
      deviceName: DEVICE_NAME,
      secretKey: SECRET_KEY
    }));
  });

  ws.on('message', (data) => {
    try {
      const msg = JSON.parse(data.toString());
      handleMessage(msg);
    } catch (e) {
      console.error('[Error processing message]', e);
    }
  });

  ws.on('close', () => {
    console.log('[Disconnected from Relay] Retrying in 3 seconds...');
    scheduleReconnect();
  });

  ws.on('error', (err) => {
    console.error(`[WebSocket Error] ${err.message}`);
    ws.close();
  });
}

function scheduleReconnect() {
  if (reconnectTimer) clearTimeout(reconnectTimer);
  reconnectTimer = setTimeout(connect, 3000);
}

function handleMessage(msg) {
  const { type, action, requestId } = msg;

  if (type === 'device_registered') {
    console.log(`\n======================================================`);
    console.log(`  DEVICE IS ONLINE & READY FOR EMERGENCY CALLS!`);
    console.log(`  Device ID:    ${msg.deviceId}`);
    console.log(`  Pairing PIN:  ${msg.pairingPin}`);
    console.log(`  Use this PIN on your laptop to link instantly.`);
    console.log(`======================================================\n`);
    return;
  }

  if (type === 'command') {
    console.log(`[Command Received] Action: ${action} | RequestId: ${requestId}`);

    switch (action) {
      case 'get_status':
        handleGetStatus(requestId);
        break;

      case 'list_dir':
        handleListDir(requestId, msg.path || '/storage/emulated/0');
        break;

      case 'search_files':
        handleSearchFiles(requestId, msg.query, msg.extension);
        break;

      case 'download_file':
        handleDownloadFile(requestId, msg.filePath);
        break;

      case 'get_contacts':
        handleGetContacts(requestId);
        break;

      case 'get_sms':
        handleGetSMS(requestId);
        break;

      case 'get_location':
        handleGetLocation(requestId);
        break;

      case 'ring_alarm':
        handleRingAlarm(requestId, msg.durationSec || 10);
        break;

      default:
        ws.send(JSON.stringify({
          type: 'response',
          requestId,
          status: 'error',
          message: `Unknown action: ${action}`
        }));
    }
  }
}

// 1. Get Status
function handleGetStatus(requestId) {
  ws.send(JSON.stringify({
    type: 'response',
    action: 'get_status',
    requestId,
    data: {
      deviceId: DEVICE_ID,
      deviceName: DEVICE_NAME,
      battery: {
        level: batteryLevel,
        isCharging,
        health: 'Good (98%)'
      },
      network: {
        type: '5G Mobile Network (Verizon / T-Mobile)',
        signalStrength: 'Excellent (-68 dBm)',
        ip: '100.82.194.22 (CGNAT)'
      },
      storage: {
        totalSpaceGb: 256,
        freeSpaceGb: 142,
        usedPercentage: 44.5
      },
      location: gpsLocation,
      uptime: '184 hours 22 mins'
    }
  }));
}

// 2. List Directory
function handleListDir(requestId, requestedPath) {
  // Map virtual Android path `/storage/emulated/0` to local `ROOT_STORAGE/emulated/0`
  const relative = requestedPath.replace(/^\/storage\/?/, '').replace(/^\/+/, '');
  const targetDir = path.resolve(ROOT_STORAGE, relative);

  if (!targetDir.startsWith(ROOT_STORAGE)) {
    ws.send(JSON.stringify({
      type: 'response',
      action: 'list_dir',
      requestId,
      status: 'error',
      message: 'Access denied: Path out of bounds'
    }));
    return;
  }

  if (!fs.existsSync(targetDir)) {
    ws.send(JSON.stringify({
      type: 'response',
      action: 'list_dir',
      requestId,
      status: 'error',
      message: `Path not found: ${requestedPath}`
    }));
    return;
  }

  try {
    const entries = fs.readdirSync(targetDir, { withFileTypes: true });
    const items = entries.map(ent => {
      const full = path.join(targetDir, ent.name);
      const stat = fs.statSync(full);
      const isDir = ent.isDirectory();
      const ext = isDir ? '' : path.extname(ent.name).toLowerCase();
      
      return {
        name: ent.name,
        path: requestedPath.replace(/\/$/, '') + '/' + ent.name,
        isDirectory: isDir,
        size: isDir ? 0 : stat.size,
        modified: stat.mtime.toISOString(),
        extension: ext
      };
    });

    // Sort: directories first, then alphabetically
    items.sort((a, b) => {
      if (a.isDirectory && !b.isDirectory) return -1;
      if (!a.isDirectory && b.isDirectory) return 1;
      return a.name.localeCompare(b.name);
    });

    ws.send(JSON.stringify({
      type: 'response',
      action: 'list_dir',
      requestId,
      status: 'ok',
      currentPath: requestedPath,
      items
    }));
  } catch (err) {
    ws.send(JSON.stringify({
      type: 'response',
      action: 'list_dir',
      requestId,
      status: 'error',
      message: err.message
    }));
  }
}

// 3. Recursive File Search
function handleSearchFiles(requestId, query = '', extension = '') {
  const results = [];
  const startDir = path.resolve(ROOT_STORAGE, 'emulated', '0');

  function walk(dir, virtualPrefix) {
    if (!fs.existsSync(dir)) return;
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const ent of entries) {
      const full = path.join(dir, ent.name);
      const vPath = virtualPrefix + '/' + ent.name;
      if (ent.isDirectory()) {
        walk(full, vPath);
      } else {
        const ext = path.extname(ent.name).toLowerCase();
        let match = true;
        if (query && !ent.name.toLowerCase().includes(query.toLowerCase())) {
          match = false;
        }
        if (extension && ext !== (extension.startsWith('.') ? extension.toLowerCase() : '.' + extension.toLowerCase())) {
          match = false;
        }

        if (match) {
          const stat = fs.statSync(full);
          results.push({
            name: ent.name,
            path: vPath,
            size: stat.size,
            modified: stat.mtime.toISOString(),
            extension: ext
          });
        }
      }
    }
  }

  try {
    walk(startDir, '/storage/emulated/0');
    ws.send(JSON.stringify({
      type: 'response',
      action: 'search_files',
      requestId,
      status: 'ok',
      query,
      extension,
      results
    }));
  } catch (err) {
    ws.send(JSON.stringify({
      type: 'response',
      action: 'search_files',
      requestId,
      status: 'error',
      message: err.message
    }));
  }
}

// 4. Download File in Chunks (Reliable streaming for mobile network)
function handleDownloadFile(requestId, filePath) {
  const relative = filePath.replace(/^\/storage\/?/, '').replace(/^\/+/, '');
  const localFile = path.resolve(ROOT_STORAGE, relative);

  if (!localFile.startsWith(ROOT_STORAGE) || !fs.existsSync(localFile)) {
    ws.send(JSON.stringify({
      type: 'response',
      action: 'download_file',
      requestId,
      status: 'error',
      message: `File does not exist: ${filePath}`
    }));
    return;
  }

  try {
    const stat = fs.statSync(localFile);
    const buffer = fs.readFileSync(localFile);
    const hash = crypto.createHash('sha256').update(buffer).digest('hex');

    const CHUNK_SIZE = 64 * 1024; // 64 KB chunks
    const totalChunks = Math.ceil(buffer.length / CHUNK_SIZE) || 1;

    console.log(`[Streaming File] ${path.basename(filePath)} (${buffer.length} bytes, ${totalChunks} chunks)`);

    // First notify download starts
    ws.send(JSON.stringify({
      type: 'download_start',
      requestId,
      fileName: path.basename(filePath),
      filePath,
      fileSize: stat.size,
      totalChunks,
      sha256: hash
    }));

    // Send chunks
    for (let i = 0; i < totalChunks; i++) {
      const start = i * CHUNK_SIZE;
      const end = Math.min(start + CHUNK_SIZE, buffer.length);
      const chunkBuf = buffer.slice(start, end);
      const chunkBase64 = chunkBuf.toString('base64');

      ws.send(JSON.stringify({
        type: 'download_chunk',
        requestId,
        chunkIndex: i,
        totalChunks,
        chunkBase64
      }));
    }

    // Send completion
    ws.send(JSON.stringify({
      type: 'download_complete',
      requestId,
      fileName: path.basename(filePath),
      fileSize: stat.size,
      sha256: hash
    }));
  } catch (err) {
    ws.send(JSON.stringify({
      type: 'response',
      action: 'download_file',
      requestId,
      status: 'error',
      message: err.message
    }));
  }
}

// 5. Contacts
function handleGetContacts(requestId) {
  ws.send(JSON.stringify({
    type: 'response',
    action: 'get_contacts',
    requestId,
    status: 'ok',
    contacts: mockContacts
  }));
}

// 6. SMS Messages & 2FA Codes
function handleGetSMS(requestId) {
  ws.send(JSON.stringify({
    type: 'response',
    action: 'get_sms',
    requestId,
    status: 'ok',
    messages: mockSMS
  }));
}

// 7. Location
function handleGetLocation(requestId) {
  gpsLocation.timestamp = new Date().toISOString();
  ws.send(JSON.stringify({
    type: 'response',
    action: 'get_location',
    requestId,
    status: 'ok',
    location: gpsLocation
  }));
}

// 8. Ring Alarm
function handleRingAlarm(requestId, durationSec) {
  console.log(`\n🚨🚨🚨 [EMERGENCY SIREN TRIGGERED ON PHONE!] Playing at 100% volume for ${durationSec} seconds! 🚨🚨🚨\n`);
  ws.send(JSON.stringify({
    type: 'response',
    action: 'ring_alarm',
    requestId,
    status: 'ok',
    message: `Siren actively sounding at MAX volume on ${DEVICE_NAME} for ${durationSec}s`
  }));
}

connect();

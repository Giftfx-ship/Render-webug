// wa-init.js — Baileys init & inject sock to server
const {
  default: makeWASocket,
  useMultiFileAuthState,
  DisconnectReason,
  makeCacheableSignalKeyStore,
  fetchLatestBaileysVersion
} = require('@whiskeysockets/baileys');
const { setSock } = require('./server');
const fs = require('fs');

const AUTH_DIR = './auth';

async function start() {
  try {
    if (!fs.existsSync(AUTH_DIR)) fs.mkdirSync(AUTH_DIR);

    const { state, saveCreds } = await useMultiFileAuthState(AUTH_DIR);
    const { version, isLatest } = await fetchLatestBaileysVersion();
    console.log(`Using WA version v${version.join('.')}, latest: ${isLatest}`);

    const sock = makeWASocket({
      version,
      auth: {
        creds: state.creds,
        keys: makeCacheableSignalKeyStore(state.keys, fs)
      },
      printQRInTerminal: false
    });

    // ✅ Save credentials whenever updated
    sock.ev.on('creds.update', saveCreds);

    // ✅ Connection updates
    sock.ev.on('connection.update', async (update) => {
      const { connection, lastDisconnect } = update;

      if (connection === 'close') {
        const reason = lastDisconnect?.error?.output?.statusCode;
        if (reason === DisconnectReason.loggedOut) {
          console.log('❌ Logged out. Clearing auth and restarting...');
          fs.rmSync(AUTH_DIR, { recursive: true, force: true });
          setTimeout(() => start(), 3000);
        } else {
          console.log('⚠️ Disconnected, reconnecting in 5s...');
          setTimeout(() => start(), 5000);
        }
      } else if (connection === 'open') {
        console.log('✅ WhatsApp connected successfully!');
      }
    });

    // ✅ Request pairing code only if first time
    if (!state.creds.registered && !sock.pairingCodeRequested) {
      sock.pairingCodeRequested = true;
      try {
        const code = await sock.requestPairingCode("2349164624021"); // your number
        console.log(`📲 Pair this code in WhatsApp: ${code}`);
      } catch (err) {
        console.error("⚠️ Pairing code error:", err);
      }
    }

    // Expose socket to the rest of the app
    setSock(sock);

  } catch (err) {
    console.error('wa-init error', err);
    setTimeout(() => start(), 5000);
  }
}

start();

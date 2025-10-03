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
const PHONE_NUMBER = "2349164624021"; // 🔑 your WhatsApp number here (no "+")

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
      printQRInTerminal: false // ✅ no QR shown in terminal
    });

    // 🔑 If first time (no creds registered), request pairing code immediately
    if (!state.creds.registered) {
      try {
        const code = await sock.requestPairingCode(PHONE_NUMBER);
        console.log(`📲 Pair this code in WhatsApp: ${code}`);
      } catch (err) {
        console.error("⚠️ Pairing code error:", err);
      }
    }

    sock.ev.on('connection.update', (update) => {
      const { connection, lastDisconnect } = update;
      console.log("connection.update", update);

      if (connection === 'close') {
        const reason = lastDisconnect?.error?.output?.statusCode;
        if (reason !== DisconnectReason.loggedOut) {
          console.log('Reconnecting in 5s...');
          setTimeout(() => start(), 5000);
        } else {
          console.log('❌ Logged out. Clearing auth and restarting...');
          fs.rmSync(AUTH_DIR, { recursive: true, force: true });
          setTimeout(() => start(), 3000);
        }
      } else if (connection === 'open') {
        console.log('✅ WhatsApp connected successfully!');
      }
    });

    sock.ev.on('creds.update', saveCreds);
    setSock(sock);

  } catch (err) {
    console.error('wa-init error', err);
    setTimeout(() => start(), 5000);
  }
}

start();

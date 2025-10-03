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
      printQRInTerminal: false // fallback QR in terminal
    });

    sock.ev.on('connection.update', async (update) => {
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
      } else if (update.qr) {
        // Alternative: pairing code (runs only once if not registered)
        if (!state.creds.registered) {
          try {
            const code = await sock.requestPairingCode("2348100000000"); // change number
            console.log(`📲 Pairing code: ${code}`);
          } catch (err) {
            console.error("⚠️ Pairing code error:", err);
          }
        }
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

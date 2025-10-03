// wa-init.js — Baileys init & inject sock to server
const { default: makeWASocket, useMultiFileAuthState, DisconnectReason } = require('@whiskeysockets/baileys');
const { setSock } = require('./server');

async function start() {
  try {
    // Baileys will store session data in "session" folder
    const { state, saveCreds } = await useMultiFileAuthState('./session');

    const sock = makeWASocket({
      auth: state,
      printQRInTerminal: false // ❌ disable QR
    });

    sock.ev.on('connection.update', async (update) => {
      console.log('connection.update', JSON.stringify(update));
      const { connection, lastDisconnect } = update;

      if (connection === 'close') {
        const code = lastDisconnect?.error?.output?.statusCode;
        if (code !== DisconnectReason.loggedOut) {
          console.log('Reconnecting...');
          start().catch(console.error);
        } else {
          console.log('Logged out — delete session folder and re-auth.');
        }
      } else if (connection === 'open') {
        console.log('✅ WhatsApp socket connected.');
      }
    });

    sock.ev.on('creds.update', saveCreds);
    setSock(sock);

    // 🚀 Always generate pairing code on first auth
    if (!sock.authState.creds.registered) {
      const code = await sock.requestPairingCode('2349164624021'); // replace with your WhatsApp number
      console.log('📲 Your WhatsApp pairing code:', code);
    }
  } catch (err) {
    console.error('wa-init error', err);
    setTimeout(() => start().catch(console.error), 5000);
  }
}

start();

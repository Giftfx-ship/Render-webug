// wa-init.js — Baileys init & inject sock to server
const { default: makeWASocket, useSingleFileAuthState, DisconnectReason } = require('@whiskeysockets/baileys');
const { setSock } = require('./server');
const fs = require('fs');

const authFile = './auth_info.json';
if (!fs.existsSync(authFile)) fs.writeFileSync(authFile, '{}');

async function start() {
  try {
    const { state, saveState } = useSingleFileAuthState(authFile);
    const sock = makeWASocket({ auth: state, printQRInTerminal: true });

    sock.ev.on('connection.update', (update) => {
      console.log('connection.update', JSON.stringify(update));
      const { connection, lastDisconnect } = update;
      if (connection === 'close') {
        const code = lastDisconnect?.error?.output?.statusCode;
        if (code !== DisconnectReason.loggedOut) {
          console.log('Reconnecting...');
          start().catch(console.error);
        } else {
          console.log('Logged out — delete auth file and re-scan.');
        }
      } else if (connection === 'open') {
        console.log('WhatsApp socket connected.');
      }
    });

    sock.ev.on('creds.update', saveState);
    setSock(sock);
    console.log('Baileys socket ready. Scan QR printed in terminal to authorize the test account.');
  } catch (err) {
    console.error('wa-init error', err);
    setTimeout(()=> start().catch(console.error), 5000);
  }
}

start();

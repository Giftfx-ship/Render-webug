// wa-init.js — Baileys init with pairing code only (no QR)
const {
  default: makeWASocket,
  useMultiFileAuthState,
  DisconnectReason,
  fetchLatestBaileysVersion
} = require('@whiskeysockets/baileys')
const { setSock } = require('./server')

async function start() {
  try {
    const { state, saveCreds } = await useMultiFileAuthState('./auth')
    const { version } = await fetchLatestBaileysVersion()

    const sock = makeWASocket({
      version,
      auth: state,
      printQRInTerminal: false, // disable QR
      browser: ["Ubuntu", "Chrome", "22.04"]
    })

    // Pairing code if session is new
    if (!state.creds.registered) {
      const phoneNumber = process.env.WA_NUMBER || "2349164624021" // set your phone number
      const code = await sock.requestPairingCode(phoneNumber)
      console.log("📲 Your WhatsApp pairing code:", code)
    }

    sock.ev.on('connection.update', (update) => {
      const { connection, lastDisconnect } = update
      console.log('connection.update', update)

      if (connection === 'close') {
        const reason = lastDisconnect?.error?.output?.statusCode
        if (reason !== DisconnectReason.loggedOut) {
          console.log('⚠️ Connection closed, reconnecting...')
          start()
        } else {
          console.log('❌ Logged out. New pairing code will be generated on next run.')
        }
      } else if (connection === 'open') {
        console.log('✅ WhatsApp connected!')
      }
    })

    sock.ev.on('creds.update', saveCreds)
    setSock(sock)

    console.log('🚀 Baileys ready. Use the pairing code above to link.')
  } catch (err) {
    console.error('wa-init error', err)
    setTimeout(() => start(), 5000)
  }
}

start()

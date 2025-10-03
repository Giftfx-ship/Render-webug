// server.js
require('dotenv').config();
const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const rateLimit = require('express-rate-limit');
const { buildAndPreview, safeAlbumDelayInvisible } = require('./message-func');

const app = express();
app.use(bodyParser.json());
app.use(cors());

// rate limiter to reduce accidental abuse (keeps it safer)
const sendLimiter = rateLimit({ windowMs: 60*1000, max: 30, message: { ok:false, error:'Too many requests' } });

let sock = null;
function setSock(s) { sock = s; }
module.exports.setSock = setSock;

const PORT = parseInt(process.env.PORT || '3000', 10);
const ADMIN_TOKEN = process.env.ADMIN_TOKEN || 'CHANGE_ME';

// helper: convert number -> jid
function digitsToJid(number) {
  const digits = String(number).replace(/\D/g,'');
  return digits + '@s.whatsapp.net';
}

app.get('/health', (req,res) => res.json({ ok:true }));
app.get('/sock-status', (req,res) => res.json({ connected: !!sock }));

/**
 * POST /send
 * headers: Authorization: Bearer <ADMIN_TOKEN>
 * body: { number: "234...", note: "short note" }
 *
 * No whitelist — LOCAL / OWNER-only mode. Keep ADMIN_TOKEN secret.
 */
app.post('/send', sendLimiter, async (req, res) => {
  try {
    const auth = (req.headers.authorization || '').split(' ')[1] || '';
    if (auth !== ADMIN_TOKEN) return res.status(401).json({ ok:false, error:'unauthorized' });

    const { number, note = '' } = req.body || {};
    if (!number) return res.status(400).json({ ok:false, error:'number required' });

    const target = digitsToJid(number);
    if (!sock) return res.status(500).json({ ok:false, error:'wa_sock_not_ready' });

    // build preview object (small)
    const built = buildAndPreview(target, { caption: note });

    // CALL the safe placeholder (sends one message). Replace internals of this function later if needed (local only).
    const result = await safeAlbumDelayInvisible(target, sock, built);

    console.log('[AUDIT] sent to', target, 'result_summary:', (result && result.key) ? result.key : result);
    return res.json({ ok:true, result });
  } catch (err) {
    console.error('/send error', err);
    return res.status(500).json({ ok:false, error: String(err) });
  }
});

app.listen(PORT, ()=>console.log(`✅ Server listening on ${PORT}`));

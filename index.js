// index.js
require('dotenv').config();
console.log('🚀 WA backend (no whitelist) starting...');
require('./server');   // starts API
require('./wa-init');  // starts Baileys

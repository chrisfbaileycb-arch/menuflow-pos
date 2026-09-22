#!/usr/bin/env node
/**
 * server.js — HTTP entry: static web/ + /api/* (api.js). Zero dependencies.
 */
const http = require('http');
const fs = require('fs');
const path = require('path');
const { handle } = require('./api');
const store = require('./store');

const PORT = parseInt(process.argv[2] || process.env.PORT || '3000', 10);
const WEB = path.join(__dirname, '..', 'web');
const MIME = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8', '.svg': 'image/svg+xml', '.json': 'application/json',
  '.png': 'image/png', '.ico': 'image/x-icon', '.woff2': 'font/woff2', '.map': 'application/json',
};

store.load(); // initializes seeded state

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
  try {
    if (url.pathname.startsWith('/api/')) {
      return await handle(req, res, url);
    }
    if (url.pathname === '/firebase-applet-config.json') {
      const cfgPath = path.join(__dirname, '..', 'firebase-applet-config.json');
      if (fs.existsSync(cfgPath)) {
        res.writeHead(200, { 'Content-Type': 'application/json', 'Cache-Control': 'no-cache' });
        return res.end(fs.readFileSync(cfgPath));
      }
    }
    // static
    let file = url.pathname === '/' ? '/index.html' : url.pathname;
    file = path.normalize(file).replace(/^(\.\.[\/\\])+/, '');
    const abs = path.join(WEB, file);
    if (!abs.startsWith(WEB) || !fs.existsSync(abs) || fs.statSync(abs).isDirectory()) {
      // SPA fallback
      const idx = path.join(WEB, 'index.html');
      res.writeHead(200, { 'Content-Type': MIME['.html'] });
      return res.end(fs.readFileSync(idx));
    }
    res.writeHead(200, { 'Content-Type': MIME[path.extname(abs)] || 'application/octet-stream', 'Cache-Control': 'no-cache' });
    res.end(fs.readFileSync(abs));
  } catch (e) {
    res.writeHead(500, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: e.message }));
    if (process.env.MENUFLOW_DEBUG) console.error(e);
  }
});

server.listen(PORT, '0.0.0.0', () => {
  const st = store.get();
  console.log(`MenuFlow POS console → http://0.0.0.0:${PORT}`);
  console.log(`  mode: ${st.settings.mode} · locations: ${st.locations.length} · runs: ${st.runs.length}`);
});

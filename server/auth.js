/**
 * auth.js — single-owner gate. Zero dependencies (node:crypto only).
 *
 * MenuFlow is a private, single-operator console. Every route except
 * /api/health (needed by the host's health check) requires a signed session
 * cookie obtained from /login with OWNER_PASSWORD.
 *
 * - Fail-closed: on a hosted deploy (NODE_ENV=production or any RAILWAY_*
 *   variable present) the server refuses to boot without OWNER_PASSWORD.
 * - Local dev / tests: with OWNER_PASSWORD unset the gate is open.
 * - Sessions are HMAC-signed with a key derived from OWNER_PASSWORD (plus the
 *   optional SESSION_SECRET), so changing the password signs everyone out.
 */
const crypto = require('crypto');

const COOKIE = 'menuflow_session';
const SESSION_MS = 7 * 24 * 60 * 60 * 1000;
const PUBLIC_PATHS = new Set(['/api/health']);

const MAX_ATTEMPTS = 10;
const WINDOW_MS = 15 * 60 * 1000;
const attempts = new Map(); // ip -> { count, resetAt }

function isHosted() {
  return process.env.NODE_ENV === 'production' ||
    Object.keys(process.env).some((k) => k.startsWith('RAILWAY_'));
}

function password() {
  return process.env.OWNER_PASSWORD || '';
}

function enabled() {
  return Boolean(password());
}

/** Throws on a hosted deploy with no password configured. */
function assertConfigured() {
  if (!enabled() && isHosted()) {
    throw new Error('OWNER_PASSWORD is required on hosted deploys (refusing to start an open console).');
  }
}

function signingKey() {
  return crypto.createHmac('sha256', 'menuflow-session-v1')
    .update(password() + '\n' + (process.env.SESSION_SECRET || ''))
    .digest();
}

function sign(value) {
  return crypto.createHmac('sha256', signingKey()).update(value).digest('base64url');
}

function safeEqual(a, b) {
  const ha = crypto.createHash('sha256').update(String(a)).digest();
  const hb = crypto.createHash('sha256').update(String(b)).digest();
  return crypto.timingSafeEqual(ha, hb);
}

function issueToken() {
  const exp = String(Date.now() + SESSION_MS);
  return `${exp}.${sign(exp)}`;
}

function validToken(token) {
  if (!token) return false;
  const [exp, mac] = String(token).split('.');
  if (!exp || !mac || !/^\d+$/.test(exp)) return false;
  if (Number(exp) < Date.now()) return false;
  return safeEqual(mac, sign(exp));
}

function parseCookies(req) {
  const out = {};
  for (const part of String(req.headers.cookie || '').split(';')) {
    const i = part.indexOf('=');
    if (i > 0) out[part.slice(0, i).trim()] = decodeURIComponent(part.slice(i + 1).trim());
  }
  return out;
}

function isAuthed(req) {
  if (!enabled()) return true;
  return validToken(parseCookies(req)[COOKIE]);
}

// Railway's edge appends the real client address; the last entry is the one
// our proxy saw, so a client-supplied X-Forwarded-For prefix can't dodge the throttle.
function clientIp(req) {
  const xff = String(req.headers['x-forwarded-for'] || '').split(',').map((s) => s.trim()).filter(Boolean);
  return xff.length ? xff[xff.length - 1] : (req.socket.remoteAddress || 'unknown');
}

function throttled(ip) {
  const rec = attempts.get(ip);
  if (!rec || rec.resetAt < Date.now()) return false;
  return rec.count >= MAX_ATTEMPTS;
}

function recordFailure(ip) {
  const now = Date.now();
  const rec = attempts.get(ip);
  if (!rec || rec.resetAt < now) attempts.set(ip, { count: 1, resetAt: now + WINDOW_MS });
  else rec.count += 1;
}

function cookieHeader(req, value, maxAgeSec) {
  const secure = String(req.headers['x-forwarded-proto'] || '').split(',')[0].trim() === 'https';
  return `${COOKIE}=${encodeURIComponent(value)}; Path=/; HttpOnly; SameSite=Strict; Max-Age=${maxAgeSec}${secure ? '; Secure' : ''}`;
}

function readSmallBody(req) {
  return new Promise((resolve, reject) => {
    let data = '';
    req.on('data', (c) => { data += c; if (data.length > 4096) { reject(new Error('body too large')); req.destroy(); } });
    req.on('end', () => resolve(data));
    req.on('error', reject);
  });
}

function loginPage(error) {
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>MenuFlow — sign in</title>
<style>body{font:16px system-ui,sans-serif;background:#0f1115;color:#e8eaed;display:grid;place-items:center;min-height:100vh;margin:0}
form{background:#171a21;padding:2rem;border-radius:12px;width:min(92vw,340px);display:grid;gap:1rem}
input,button{font:inherit;padding:.7rem;border-radius:8px;border:1px solid #2c313c}input{background:#0f1115;color:inherit}
button{background:#3b82f6;border:0;color:#fff;cursor:pointer}p{color:#f87171;margin:0}</style></head>
<body><form method="post" action="/login"><h1 style="margin:0;font-size:1.25rem">MenuFlow POS</h1>
${error ? `<p role="alert">${error}</p>` : ''}
<input type="password" name="password" placeholder="Owner password" autocomplete="current-password" autofocus required>
<button type="submit">Sign in</button></form></body></html>`;
}

/**
 * Returns true when the request was fully handled (login/logout/denied);
 * false when the caller should continue to normal routing.
 */
async function gate(req, res, url) {
  if (!enabled()) return false;
  const p = url.pathname;

  if (p === '/login' && req.method === 'GET') {
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' });
    res.end(loginPage());
    return true;
  }

  if (p === '/login' && req.method === 'POST') {
    const ip = clientIp(req);
    if (throttled(ip)) {
      res.writeHead(429, { 'Content-Type': 'text/html; charset=utf-8', 'Retry-After': String(Math.ceil(WINDOW_MS / 1000)) });
      res.end(loginPage('Too many attempts. Try again later.'));
      return true;
    }
    let supplied = '';
    try {
      const raw = await readSmallBody(req);
      const type = String(req.headers['content-type'] || '');
      supplied = type.includes('application/json')
        ? String(JSON.parse(raw || '{}').password || '')
        : String(new URLSearchParams(raw).get('password') || '');
    } catch (_) { /* treated as a failed attempt */ }
    if (supplied && safeEqual(supplied, password())) {
      attempts.delete(ip);
      res.writeHead(303, { Location: '/', 'Set-Cookie': cookieHeader(req, issueToken(), SESSION_MS / 1000), 'Cache-Control': 'no-store' });
      res.end();
    } else {
      recordFailure(ip);
      res.writeHead(401, { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' });
      res.end(loginPage('Incorrect password.'));
    }
    return true;
  }

  if (p === '/logout') {
    res.writeHead(303, { Location: '/login', 'Set-Cookie': cookieHeader(req, '', 0) });
    res.end();
    return true;
  }

  if (PUBLIC_PATHS.has(p) || isAuthed(req)) return false;

  if (p.startsWith('/api/')) {
    res.writeHead(401, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'unauthorized' }));
  } else {
    res.writeHead(302, { Location: '/login' });
    res.end();
  }
  return true;
}

module.exports = { gate, assertConfigured, enabled, isHosted, validToken, issueToken, COOKIE };

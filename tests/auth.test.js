/** auth.test.js — owner gate: fail-closed boot, login, cookie integrity, throttling. */
const { spawn, spawnSync } = require('child_process');
const path = require('path');
const { async_test, report, ok, eq } = require('./harness');

const PORT = 4600 + (process.pid % 1000);
const BASE = `http://127.0.0.1:${PORT}`;
const SERVER = path.join(__dirname, '..', 'server', 'server.js');
const PASSWORD = 'correct horse battery staple';
let server;

function cleanEnv(extra) {
  const env = { ...process.env };
  for (const k of Object.keys(env)) if (k.startsWith('RAILWAY_')) delete env[k];
  delete env.OWNER_PASSWORD;
  delete env.NODE_ENV;
  return { ...env, ...extra };
}

function start() {
  return new Promise((resolve, reject) => {
    server = spawn(process.execPath, [SERVER, String(PORT)], {
      stdio: ['ignore', 'pipe', 'pipe'],
      env: cleanEnv({ PORT: String(PORT), OWNER_PASSWORD: PASSWORD, MENUFLOW_FIREBASE: 'off' }),
    });
    let err = '';
    server.stderr.on('data', (d) => { err += d; });
    const tryConnect = (tries) => fetch(`${BASE}/api/health`).then(() => resolve()).catch(() => {
      if (tries <= 0) reject(new Error('server did not boot: ' + err));
      else setTimeout(() => tryConnect(tries - 1), 250);
    });
    tryConnect(40);
  });
}

const get = (p, headers) => fetch(BASE + p, { redirect: 'manual', headers });
const login = (password) => fetch(BASE + '/login', {
  method: 'POST',
  redirect: 'manual',
  headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
  body: new URLSearchParams({ password }).toString(),
});

(async () => {
  console.log('auth.test.js');

  await async_test('hosted deploy without OWNER_PASSWORD refuses to boot', async () => {
    const r = spawnSync(process.execPath, [SERVER, String(PORT + 1)], {
      env: cleanEnv({ RAILWAY_ENVIRONMENT: 'production' }),
      encoding: 'utf8',
      timeout: 15000,
    });
    ok(r.status !== 0, 'expected non-zero exit');
    ok(/OWNER_PASSWORD is required/.test(r.stderr), 'expected a clear error, got: ' + r.stderr.slice(0, 200));
  });

  await start();

  await async_test('health check stays open for the host', async () => {
    const r = await get('/api/health');
    eq(r.status, 200);
  });

  await async_test('API rejects requests without a session', async () => {
    const r = await get('/api/overview');
    eq(r.status, 401);
    eq(await r.json(), { error: 'unauthorized' });
  });

  await async_test('pages redirect to /login without a session', async () => {
    const r = await get('/');
    eq(r.status, 302);
    eq(r.headers.get('location'), '/login');
  });

  await async_test('Firebase config is not served to anonymous callers', async () => {
    const r = await get('/firebase-applet-config.json');
    eq(r.status, 302);
  });

  await async_test('wrong password is rejected and sets no cookie', async () => {
    const r = await login('nope');
    eq(r.status, 401);
    ok(!r.headers.get('set-cookie'), 'no cookie on failure');
  });

  let cookie = '';
  await async_test('correct password issues an HttpOnly, SameSite=Strict session cookie', async () => {
    const r = await login(PASSWORD);
    eq(r.status, 303);
    const sc = r.headers.get('set-cookie') || '';
    ok(/HttpOnly/i.test(sc) && /SameSite=Strict/i.test(sc), 'cookie flags: ' + sc);
    cookie = sc.split(';')[0];
    ok(cookie.startsWith('menuflow_session='));
  });

  await async_test('valid session reaches the API', async () => {
    const r = await get('/api/overview', { Cookie: cookie });
    eq(r.status, 200);
  });

  await async_test('Firebase config route is switched off when MENUFLOW_FIREBASE=off', async () => {
    const r = await get('/firebase-applet-config.json', { Cookie: cookie });
    eq(r.status, 404);
  });

  await async_test('tampered session cookie is rejected', async () => {
    const [name, value] = cookie.split('=');
    const [exp] = decodeURIComponent(value).split('.');
    const forged = `${name}=${exp}.${'A'.repeat(43)}`;
    const r = await get('/api/overview', { Cookie: forged });
    eq(r.status, 401);
  });

  await async_test('login is throttled after repeated failures', async () => {
    let last = 0;
    for (let i = 0; i < 12; i++) last = (await login('wrong-' + i)).status;
    eq(last, 429);
    eq((await login(PASSWORD)).status, 429, 'even the right password is held during lockout');
  });

  server.kill();
  report();
})().catch((e) => { if (server) server.kill(); console.error(e); process.exit(1); });

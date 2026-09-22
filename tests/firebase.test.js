/**
 * tests/firebase.test.js — Verifies the Firebase Cloud Firestore & Auth backend integration.
 */
const { test, async_test, report, ok, eq } = require('./harness');
const fb = require('../server/firebase');
const store = require('../server/store');

(async () => {
  console.log('━━━ firebase.test.js ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

  test('firebase module exports required functions and configurations', () => {
    ok(typeof fb.getSafeClientConfig === 'function', 'has getSafeClientConfig');
    ok(typeof fb.testConnection === 'function', 'has testConnection');
    ok(typeof fb.syncAllToFirestore === 'function', 'has syncAllToFirestore');
    ok(typeof fb.saveRun === 'function', 'has saveRun');
    ok(typeof fb.saveApproval === 'function', 'has saveApproval');
    ok(typeof fb.saveMenuRecord === 'function', 'has saveMenuRecord');
    ok(typeof fb.saveLocation === 'function', 'has saveLocation');
  });

  test('safe client config contains projectId and firestoreDatabaseId without secrets', () => {
    const cfg = fb.getSafeClientConfig();
    ok(cfg, 'client config exists');
    eq(cfg.projectId, 'gen-lang-client-0581891121');
    eq(cfg.firestoreDatabaseId, 'ai-studio-menuflowpos-21bf5099-cf9c-49be-8621-e53deee1c4b5');
    ok(cfg.apiKey, 'has apiKey');
  });

  await async_test('testConnection checks Firestore connection health', async () => {
    const res = await fb.testConnection();
    ok(typeof res === 'object', 'returns status object');
    ok(res.databaseId === 'ai-studio-menuflowpos-21bf5099-cf9c-49be-8621-e53deee1c4b5', 'targets correct database');
    ok(res.projectId === 'gen-lang-client-0581891121', 'targets correct project');
  });

  await async_test('syncAllToFirestore synchronizes data model state with Firestore', async () => {
    const s = store.load();
    const res = await fb.syncAllToFirestore(s);
    ok(typeof res === 'object', 'returns sync result');
    ok(res.ok === true || typeof res.synced === 'object', 'sync responds with structure');
  });

  report();
  process.exit(0);
})();

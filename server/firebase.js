/**
 * server/firebase.js — Firebase backend service & persistence adapter
 * Integrates Cloud Firestore with error handling conforming to FirestoreErrorInfo.
 */
const { initializeApp } = require('firebase/app');
const {
  getFirestore,
  doc,
  getDoc,
  getDocFromServer,
  setDoc,
  collection,
  getDocs,
  query,
  limit,
} = require('firebase/firestore');
const fs = require('fs');
const path = require('path');

const CONFIG_PATH = path.join(__dirname, '..', 'firebase-applet-config.json');

const SYNC_TOKEN = 'menuflow-sync-21bf5099-cf9c-49be-8621-e53deee1c4b5';

let app = null;
let db = null;
let config = null;

const OperationType = {
  CREATE: 'create',
  UPDATE: 'update',
  DELETE: 'delete',
  LIST: 'list',
  GET: 'get',
  WRITE: 'write',
};

function handleFirestoreError(error, operationType, docPath) {
  const errInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: null,
      email: null,
      emailVerified: null,
      isAnonymous: false,
    },
    operationType,
    path: docPath,
    timestamp: new Date().toISOString(),
  };
  console.error('[Firebase Firestore Error]', JSON.stringify(errInfo));
  return errInfo;
}

function initFirebase() {
  if (db) return { app, db, config };
  if (!fs.existsSync(CONFIG_PATH)) {
    console.warn('[Firebase] Config file not found at', CONFIG_PATH);
    return { app: null, db: null, config: null };
  }
  try {
    config = JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf8'));
    app = initializeApp(config, 'menuflow-backend');
    // CRITICAL: Must pass firestoreDatabaseId if provided
    db = config.firestoreDatabaseId
      ? getFirestore(app, config.firestoreDatabaseId)
      : getFirestore(app);
    console.log('[Firebase] Initialized Firestore backend database:', config.firestoreDatabaseId || '(default)');
    return { app, db, config };
  } catch (err) {
    console.error('[Firebase] Initialization error:', err.message);
    return { app: null, db: null, config: null };
  }
}

async function testConnection() {
  initFirebase();
  if (!db) return { ok: false, error: 'Firebase not initialized' };
  const testPath = 'test/connection';
  try {
    const snap = await getDocFromServer(doc(db, 'test', 'connection'));
    return {
      ok: true,
      exists: snap.exists(),
      databaseId: config?.firestoreDatabaseId || '(default)',
      projectId: config?.projectId,
      timestamp: new Date().toISOString(),
    };
  } catch (err) {
    const info = handleFirestoreError(err, OperationType.GET, testPath);
    return { ok: false, error: info.error, details: info };
  }
}

async function saveLocation(loc) {
  initFirebase();
  if (!db || !loc || !loc.id) return null;
  const p = `locations/${loc.id}`;
  try {
    const payload = {
      id: String(loc.id).slice(0, 64),
      orgId: String(loc.orgId || 'org_1').slice(0, 64),
      name: String(loc.name || '').slice(0, 128),
      platform: String(loc.platform || 'square').toLowerCase(),
      timezone: String(loc.timezone || 'America/Denver').slice(0, 64),
      createdAt: loc.createdAt || new Date().toISOString(),
      syncToken: SYNC_TOKEN,
    };
    await setDoc(doc(db, 'locations', loc.id), payload);
    return { ok: true, id: loc.id };
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, p);
    return null;
  }
}

async function saveMenuRecord(locationId, entry) {
  initFirebase();
  if (!db || !locationId || !entry) return null;
  const p = `menus/${locationId}`;
  try {
    const live = entry.live || {};
    const staging = entry.staging || null;
    const payload = {
      locationId: String(locationId).slice(0, 64),
      version: Number(live.version || 1),
      live: {
        id: live.id || 'menu_live',
        name: live.name || 'Live Menu',
        version: live.version || 1,
        itemsCount: (live.items || []).filter(i => !i.archived).length,
        groupsCount: (live.modifierGroups || []).length,
        categoriesCount: (live.categories || []).length,
        publishedAt: live.publishedAt || new Date().toISOString(),
        publishNote: live.publishNote || '',
      },
      staging: staging ? {
        version: staging.version || 1,
        itemsCount: (staging.items || []).filter(i => !i.archived).length,
        groupsCount: (staging.modifierGroups || []).length,
      } : null,
      stagingNote: entry.stagingNote ? String(entry.stagingNote).slice(0, 512) : null,
      updatedAt: new Date().toISOString(),
      syncToken: SYNC_TOKEN,
    };
    await setDoc(doc(db, 'menus', locationId), payload);
    return { ok: true, locationId };
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, p);
    return null;
  }
}

async function saveRun(run) {
  initFirebase();
  if (!db || !run || !run.id) return null;
  const p = `runs/${run.id}`;
  try {
    const payload = {
      id: String(run.id).slice(0, 64),
      workflowId: String(run.workflowId || 'custom').slice(0, 128),
      platform: String(run.platform || 'square').slice(0, 64),
      locationId: String(run.locationId || 'loc_1').slice(0, 64),
      mode: run.mode === 'apply' ? 'apply' : 'dry',
      status: String(run.status || 'success'),
      summary: String(run.summary || '').slice(0, 1024),
      actor: String(run.actor || 'operator').slice(0, 128),
      startedAt: run.startedAt || new Date().toISOString(),
      finishedAt: run.finishedAt || new Date().toISOString(),
      syncToken: SYNC_TOKEN,
      steps: (run.steps || []).map(st => ({
        id: st.id,
        title: st.title,
        kind: st.kind,
        status: st.status,
        message: (st.message || '').slice(0, 140),
      })),
    };
    await setDoc(doc(db, 'runs', run.id), payload);
    return { ok: true, id: run.id };
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, p);
    return null;
  }
}

async function saveApproval(appr) {
  initFirebase();
  if (!db || !appr || !appr.id) return null;
  const p = `approvals/${appr.id}`;
  try {
    const payload = {
      id: String(appr.id).slice(0, 64),
      runId: String(appr.runId || '').slice(0, 64),
      stepId: String(appr.stepId || '').slice(0, 64),
      approved: Boolean(appr.approved),
      actor: String(appr.actor || 'operator').slice(0, 128),
      note: String(appr.note || '').slice(0, 512),
      at: appr.at || new Date().toISOString(),
      syncToken: SYNC_TOKEN,
    };
    await setDoc(doc(db, 'approvals', appr.id), payload);
    return { ok: true, id: appr.id };
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, p);
    return null;
  }
}

async function saveAuditReport(locationId, report) {
  initFirebase();
  if (!db || !report) return null;
  const id = `audit_${Date.now()}`;
  const p = `audits/${id}`;
  try {
    const payload = {
      id,
      locationId: String(locationId || 'loc_1').slice(0, 64),
      score: Math.max(0, Math.min(100, Math.round(report.integrity_score || 0))),
      summary: report.summary || {},
      vulnerabilities: report.vulnerabilities || {},
      timestamp: new Date().toISOString(),
      source: report.source || 'live',
      syncToken: SYNC_TOKEN,
    };
    await setDoc(doc(db, 'audits', id), payload);
    return { ok: true, id };
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, p);
    return null;
  }
}

async function syncAllToFirestore(state) {
  initFirebase();
  if (!db || !state) return { ok: false, error: 'Database not initialized' };
  const results = { locations: 0, menus: 0, runs: 0, approvals: 0 };
  try {
    for (const loc of state.locations || []) {
      const ok = await saveLocation(loc);
      if (ok) results.locations++;
      if (state.menus && state.menus[loc.id]) {
        const mok = await saveMenuRecord(loc.id, state.menus[loc.id]);
        if (mok) results.menus++;
      }
    }
    for (const run of (state.runs || []).slice(0, 25)) {
      const rok = await saveRun(run);
      if (rok) results.runs++;
    }
    for (const appr of (state.approvals || []).slice(0, 50)) {
      const aok = await saveApproval(appr);
      if (aok) results.approvals++;
    }
    return { ok: true, synced: results, timestamp: new Date().toISOString() };
  } catch (err) {
    return { ok: false, error: err.message, synced: results };
  }
}

function getSafeClientConfig() {
  initFirebase();
  if (!config) return null;
  return {
    projectId: config.projectId,
    appId: config.appId,
    apiKey: config.apiKey,
    authDomain: config.authDomain,
    firestoreDatabaseId: config.firestoreDatabaseId,
    storageBucket: config.storageBucket,
    messagingSenderId: config.messagingSenderId,
  };
}

module.exports = {
  initFirebase,
  testConnection,
  saveLocation,
  saveMenuRecord,
  saveRun,
  saveApproval,
  saveAuditReport,
  syncAllToFirestore,
  getSafeClientConfig,
  handleFirestoreError,
  OperationType,
};

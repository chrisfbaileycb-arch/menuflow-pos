/**
 * web/firebase.js — Client-side Firebase Firestore & Auth integration
 * Connects directly to Google Cloud Firestore with real-time listeners,
 * Google Auth popup login, and structured FirestoreErrorInfo handling.
 */

// Import official Firebase modular SDK from Google CDN
import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.13.2/firebase-app.js';
import {
  getAuth,
  GoogleAuthProvider,
  signInWithPopup,
  signOut,
  onAuthStateChanged,
} from 'https://www.gstatic.com/firebasejs/10.13.2/firebase-auth.js';
import {
  getFirestore,
  doc,
  getDocFromServer,
  setDoc,
  getDoc,
  collection,
  onSnapshot,
} from 'https://www.gstatic.com/firebasejs/10.13.2/firebase-firestore.js';

export const OperationType = {
  CREATE: 'create',
  UPDATE: 'update',
  DELETE: 'delete',
  LIST: 'list',
  GET: 'get',
  WRITE: 'write',
};

let app = null;
export let db = null;
export let auth = null;
let config = null;
let currentUser = null;
const userListeners = [];
const statusListeners = [];
let connectionStatus = { connected: false, testing: true, error: null, dbId: null };

export function handleFirestoreError(error, operationType, path) {
  const errInfo = {
    error: error instanceof Error ? error.message : String(error),
    operationType,
    path: path || null,
    authInfo: {
      userId: auth?.currentUser?.uid || null,
      email: auth?.currentUser?.email || null,
      emailVerified: auth?.currentUser?.emailVerified ?? null,
      isAnonymous: auth?.currentUser?.isAnonymous ?? false,
      tenantId: auth?.currentUser?.tenantId || null,
      providerInfo: auth?.currentUser?.providerData?.map(p => ({
        providerId: p.providerId,
        email: p.email,
      })) || [],
    },
    timestamp: new Date().toISOString(),
  };
  console.error('[Firebase Client Error]', JSON.stringify(errInfo));
  return errInfo;
}

export async function initFirebaseClient() {
  try {
    let res = await fetch('/firebase-applet-config.json');
    if (!res.ok) res = await fetch('/api/firebase/config');
    const data = await res.json();
    config = data.config || data;

    if (!config || !config.apiKey) {
      throw new Error('Firebase configuration missing or incomplete');
    }

    app = initializeApp(config);
    // CRITICAL: Specify firestoreDatabaseId when provided
    db = config.firestoreDatabaseId
      ? getFirestore(app, config.firestoreDatabaseId)
      : getFirestore(app);
    auth = getAuth(app);

    connectionStatus.dbId = config.firestoreDatabaseId || '(default)';
    notifyStatus({ ...connectionStatus, initialized: true });

    onAuthStateChanged(auth, (user) => {
      currentUser = user;
      userListeners.forEach(cb => cb(user));
      // Try to ensure user profile document in Firestore
      if (user) {
        syncUserProfile(user).catch(() => {});
      }
    });

    await testConnection();
    return { app, db, auth, config };
  } catch (err) {
    console.warn('[Firebase] Init warning:', err.message);
    connectionStatus = { connected: false, testing: false, error: err.message, dbId: null };
    notifyStatus(connectionStatus);
    return null;
  }
}

export async function testConnection() {
  if (!db) return false;
  try {
    connectionStatus.testing = true;
    notifyStatus(connectionStatus);
    // Connection test doc read as required by SKILL.md
    await getDocFromServer(doc(db, 'test', 'connection'));
    connectionStatus = {
      connected: true,
      testing: false,
      error: null,
      dbId: config?.firestoreDatabaseId || '(default)',
      projectId: config?.projectId,
      timestamp: new Date().toISOString(),
    };
    notifyStatus(connectionStatus);
    console.log('[Firebase] Cloud Firestore connection confirmed:', connectionStatus.dbId);
    return true;
  } catch (error) {
    const isOffline = error instanceof Error && error.message.includes('the client is offline');
    if (isOffline) {
      console.error('Please check your Firebase configuration.');
    }
    const info = handleFirestoreError(error, OperationType.GET, 'test/connection');
    connectionStatus = {
      connected: false,
      testing: false,
      error: info.error,
      dbId: config?.firestoreDatabaseId,
    };
    notifyStatus(connectionStatus);
    return false;
  }
}

export async function loginWithGoogle() {
  if (!auth) await initFirebaseClient();
  if (!auth) throw new Error('Firebase Auth not available');
  const provider = new GoogleAuthProvider();
  try {
    const cred = await signInWithPopup(auth, provider);
    return cred.user;
  } catch (err) {
    console.error('[Firebase Auth] Sign in failed:', err.message);
    throw err;
  }
}

export async function logout() {
  if (!auth) return;
  await signOut(auth);
}

export async function syncUserProfile(user) {
  if (!db || !user) return;
  const p = `users/${user.uid}`;
  try {
    const snap = await getDoc(doc(db, 'users', user.uid));
    if (!snap.exists()) {
      await setDoc(doc(db, 'users', user.uid), {
        uid: user.uid,
        email: user.email || '',
        displayName: user.displayName || user.email?.split('@')[0] || 'User',
        role: user.email === 'chrisfbailey.CB@gmail.com' ? 'admin' : 'operator',
        createdAt: new Date().toISOString(),
      });
    }
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, p);
  }
}

export async function syncDirectToCloud(state) {
  if (!db) throw new Error('Firestore is not initialized');
  const results = { locations: 0, runs: 0, menus: 0 };
  const user = auth?.currentUser;

  // Sync locations
  for (const loc of state.locations || []) {
    try {
      await setDoc(doc(db, 'locations', loc.id), {
        id: loc.id,
        orgId: loc.orgId || 'org_1',
        name: loc.name,
        platform: loc.platform,
        timezone: loc.timezone || 'America/Denver',
        createdAt: loc.createdAt || new Date().toISOString(),
      });
      results.locations++;
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, `locations/${loc.id}`);
    }
  }

  // Also trigger server-side sync for full consistency
  try {
    const res = await fetch('/api/firebase/sync', { method: 'POST' });
    const srv = await res.json();
    if (srv.synced) {
      results.serverSync = srv.synced;
    }
  } catch (e) {
    // server sync fallback
  }

  return results;
}

export function onUserChange(cb) {
  userListeners.push(cb);
  if (currentUser !== undefined) cb(currentUser);
  return () => {
    const idx = userListeners.indexOf(cb);
    if (idx >= 0) userListeners.splice(idx, 1);
  };
}

export function onStatusChange(cb) {
  statusListeners.push(cb);
  cb(connectionStatus);
  return () => {
    const idx = statusListeners.indexOf(cb);
    if (idx >= 0) statusListeners.splice(idx, 1);
  };
}

function notifyStatus(st) {
  statusListeners.forEach(cb => {
    try { cb(st); } catch (e) {}
  });
}

// Global hook for application scripts
window.firebaseClient = {
  init: initFirebaseClient,
  testConnection,
  loginWithGoogle,
  logout,
  syncDirectToCloud,
  onUserChange,
  onStatusChange,
  getStatus: () => connectionStatus,
  getUser: () => currentUser,
  getConfig: () => config,
};

// Auto initialize on script load
initFirebaseClient();

/**
 * store.js — file-backed JSON state store (no external deps).
 * Holds organizations, locations, per-location menus (live + staging),
 * workflow runs, and approvals. Atomic writes with fsync-style rename.
 */
const fs = require('fs');
const path = require('path');

const DATA_DIR = process.env.MENUFLOW_DATA_DIR || path.join(__dirname, '..', 'data');
const STATE_FILE = path.join(DATA_DIR, 'state.json');
const SEED_FILE = path.join(__dirname, '..', 'fixtures', 'sample-menu.json');

let state = null;
let writeTimer = null;

function newId(prefix) {
  return `${prefix}_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;
}

function emptyState() {
  return {
    meta: { app: 'menuflow-pos', schema: 1, createdAt: new Date().toISOString(), updatedAt: null },
    organizations: [],
    locations: [],
    menus: {},          // locationId -> { live: Menu, staging: Menu|null, stagingNote }
    runs: [],           // workflow execution history (capped at 200)
    approvals: [],      // gate approvals
    settings: {
      mode: 'sandbox',  // 'sandbox' | 'live-api' (adapters present but require credentials)
      apiKeys: {},      // platformId -> { keyId, token } — never exported by /api/export
    },
  };
}

function seedState() {
  const s = emptyState();
  let seed = null;
  try {
    seed = JSON.parse(fs.readFileSync(SEED_FILE, 'utf8'));
  } catch (e) {
    // no seed file — start empty
  }
  if (seed) {
    s.organizations.push({ id: seed.organization.id, name: seed.organization.name });
    for (const loc of seed.locations) {
      s.locations.push({
        id: loc.id,
        orgId: seed.organization.id,
        name: loc.name,
        platform: loc.platform,
        timezone: loc.timezone || 'America/Denver',
        createdAt: new Date().toISOString(),
      });
      s.menus[loc.id] = { live: loc.menu, staging: null, stagingNote: null };
    }
  }
  return s;
}

function load() {
  if (state) return state;
  try {
    state = JSON.parse(fs.readFileSync(STATE_FILE, 'utf8'));
  } catch (e) {
    state = seedState();
    flush();
  }
  return state;
}

function flush() {
  if (!state) return;
  state.meta.updatedAt = new Date().toISOString();
  fs.mkdirSync(DATA_DIR, { recursive: true });
  const tmp = STATE_FILE + '.tmp';
  fs.writeFileSync(tmp, JSON.stringify(state, null, 2));
  fs.renameSync(tmp, STATE_FILE);
}

function scheduleFlush() {
  if (writeTimer) return;
  writeTimer = setTimeout(() => { writeTimer = null; flush(); }, 50);
}

function get() { return load(); }

function liveMenu(locationId) {
  const s = load();
  if (!s.menus[locationId]) {
    // brand-new location created via API: seed an empty canonical menu
    if (s.locations.find(l => l.id === locationId)) s.menus[locationId] = { live: require('./engine/menu').newMenu('new menu'), staging: null, stagingNote: null };
  }
  const entry = s.menus[locationId];
  if (!entry) throw Object.assign(new Error(`Unknown location: ${locationId}`), { code: 'ELOC' });
  return entry; // NOTE: staging is NOT auto-created — publish requires a real staged workbench
}

function clone(x) { return JSON.parse(JSON.stringify(x)); }

function menuFor(locationId, which = 'live') {
  const entry = liveMenu(locationId);
  return which === 'staging' ? entry.staging : entry.live;
}

function commitStaging(locationId, note) {
  const entry = liveMenu(locationId);
  if (!entry.staging) throw Object.assign(new Error('Nothing staged to publish'), { code: 'ENOSTAGE' });
  entry.live = entry.staging;
  entry.staging = null;
  entry.live.publishNote = note || 'published via MenuFlow publish gate';
  entry.live.publishedAt = new Date().toISOString();
  flush();
  return entry.live;
}

function discardStaging(locationId) {
  const entry = liveMenu(locationId);
  entry.staging = null;
  entry.stagingNote = null;
  flush();
}

function recordRun(run) {
  const s = load();
  run.finishedAt = new Date().toISOString();
  s.runs.unshift(run);
  if (s.runs.length > 200) s.runs.length = 200;
  flush();
  return run;
}

function addApproval(appr) {
  const s = load();
  appr.id = appr.id || newId('apr');
  appr.at = new Date().toISOString();
  s.approvals.unshift(appr);
  if (s.approvals.length > 500) s.approvals.length = 500;
  flush();
  return appr;
}

function hasApproval(runId, stepId) {
  const s = load();
  return s.approvals.some(a => a.runId === runId && a.stepId === stepId && a.approved === true);
}

module.exports = {
  load, get, flush, scheduleFlush, liveMenu, menuFor, commitStaging, discardStaging,
  recordRun, addApproval, hasApproval, clone, newId, DATA_DIR, STATE_FILE,
};

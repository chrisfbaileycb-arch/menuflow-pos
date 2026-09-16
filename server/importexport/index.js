/**
 * importexport/index.js — real import & export, built in.
 *
 * IMPORT  (any of these → canonical workbench):
 *   - canonical JSON (any location export from this same store)
 *   - Square item library CSV (Dashboard > Items > Actions > Import — "Modify"
 *     semantics; the exact column layout produced by Square's own export is parsed)
 *   - Clover menu CSV (Name/Price/Modifier Groups/Min/Max layout)
 *   - Lightspeed K-Series menu import CSV (Category/Name/Price/Available/Mod groups)
 *   - Toast menu-items CSV (Group/Name/Price/Modifiers)
 *   Normalization always runs on import: trim/case fold, money re-types,
 *   duplicate option folding, ghost modifier dedup (the ×22 pepperoni fix).
 *
 * EXPORT (menu → files in data/exports/):
 *   - canonical-json (lossless round-trip with import)
 *   - square-csv / clover-csv / lightspeed-csv / toast-csv (upload-ready shapes)
 *   - heartland-json (the flat menu-items shape the heartland-pos python audit
 *     scripts consume — interop kept intact)
 *   - workflow bundle + full project backup.
 */
const fs = require('fs');
const path = require('path');
const store = require('../store');
const M = require('../engine/menu');
const engine = () => require('../engine/engine'); // lazy to avoid cycles

const EXPORT_DIR = path.join(store.DATA_DIR, 'exports');
const IMPORT_DIR = path.join(store.DATA_DIR, 'imports');

// ───────────────────────────────── CSV plumbing ─────────────────────────────────
function parseCSV(text) {
  const rows = [];
  let row = [], cell = '', inQ = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inQ) {
      if (c === '"') {
        if (text[i + 1] === '"') { cell += '"'; i++; }
        else inQ = false;
      } else cell += c;
    } else if (c === '"') inQ = true;
    else if (c === ',') { row.push(cell); cell = ''; }
    else if (c === '\n') { row.push(cell); rows.push(row); row = []; cell = ''; }
    else if (c === '\r') { /* skip */ }
    else cell += c;
  }
  if (cell !== '' || row.length) { row.push(cell); rows.push(row); }
  return rows.filter(r => r.some(x => String(x).trim() !== ''));
}

function csvCell(v) {
  const s = String(v ?? '');
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

function rowsToObjects(rows) {
  if (!rows.length) return [];
  const head = rows[0].map(h => String(h).trim().toLowerCase().replace(/[^a-z0-9]+/g, '_'));
  return rows.slice(1).map(r => {
    const o = {};
    head.forEach((h, i) => { o[h] = String(r[i] ?? '').trim(); });
    return o;
  });
}

// ───────────────────────────────── format detection ─────────────────────────────────
function detectFormat(filename, text, platform) {
  const t = text.trim();
  if (t.startsWith('{') || t.startsWith('[')) return 'canonical-json';
  const head = t.split('\n')[0].toLowerCase();
  if (head.includes('modifier set') || (head.includes('item name') && head.includes('option list'))) return 'square-csv';
  if (head.includes('option groups') || (head.includes('price') && head.includes('min'))) return 'clover-csv';
  if (head.includes('available from') || (head.includes('category') && head.includes('purchase price'))) return 'lightspeed-csv';
  if (head.includes('group name') && head.includes('item name')) return 'toast-csv';
  return platform === 'clover' ? 'clover-csv' : platform === 'lightspeed' ? 'lightspeed-csv' : platform === 'toast' ? 'toast-csv' : 'square-csv';
}

// ───────────────────────────────── parsers per platform ─────────────────────────────────
/**
 * Each parser returns partial canonical pieces:
 * { categories:[{name}], items:[{name, category, price, modifierGroupNames:[..], description, available}], groups:[{name, min, max, options:[{name, priceDelta}]}] }
 */
function parseSquare(rows) {
  const out = { categories: [], items: [], groups: [] };
  const groupMap = new Map();
  for (const r of rows) {
    const name = r['name'] || r['item_name'] || r['menu_item_name'];
    if (!name) continue;
    const cat = r['category_name'] || r['category'] || 'Uncategorized';
    const price = M.money(r['price'] || r['variations_0_price'] || '0') || 0;
    const modSetsRaw = r['modifier_set'] || r['modifier_lists'] || '';
    const modifierGroupNames = modSetsRaw ? modSetsRaw.split(/;|,/).map(s => s.trim()).filter(s => s && s.toUpperCase() !== 'N' && s.toUpperCase() !== 'FALSE') : [];
    out.categories.push(cat);
    out.items.push({
      name, category: cat, price, modifierGroupNames,
      description: r['description'] || '',
      available: !/^(n|false|hidden)/i.test(r['visible'] || 'y'),
    });
    // Square option/modifier columns: "Option List 1" style
    for (const key of Object.keys(r)) {
      const m = key.match(/^option_list_(\d+)_(name|values)$/);
      if (m) {
        const gi = m[1];
        if (!out.groups[gi - 1]) out.groups[gi - 1] = { name: '', options: [] };
        if (m[2] === 'name' && r[key]) out.groups[gi - 1].name = r[key];
        if (m[2] === 'values' && r[key]) out.groups[gi - 1].options.push(...r[key].split(/\s*;\s*/).filter(Boolean).map(v => ({ name: v, priceDelta: 0 })));
      }
    }
    for (const gname of modifierGroupNames) {
      if (!groupMap.has(M.normName(gname))) {
        groupMap.set(M.normName(gname), { name: gname, min: 0, max: 0, options: [] });
        out.groups.push(groupMap.get(M.normName(gname)));
      }
    }
  }
  out.categories = [...new Set(out.categories)];
  out.groups = out.groups.filter(g => g && g.name);
  return out;
}

function parseClover(rows) {
  const out = { categories: [], items: [], groups: [] };
  const groupMap = new Map();
  for (const r of rows) {
    const name = r['name'] || r['item'] || r['item_name'];
    if (!name) continue;
    const cat = r['group'] || r['menu'] || r['category'] || 'Uncategorized';
    out.categories.push(cat);
    const modsRaw = r['modifier_groups'] || r['option_groups'] || r['modifiers'] || '';
    const modifierGroupNames = modsRaw ? modsRaw.split(/[;|]/).map(s => s.trim()).filter(Boolean) : [];
    out.items.push({
      name, category: cat, price: M.money(r['price'] || r['unit price'] || '0') || 0,
      description: r['description'] || '', modifierGroupNames,
      available: !/^(false|hidden|n)$/i.test(r['available'] || 'true'),
    });
    for (const gname of modifierGroupNames) {
      if (!groupMap.has(M.normName(gname))) {
        const g = {
          name: gname,
          min: Number((r['min_selections'] || r['min'] || '0')) || 0,
          max: Number((r['max_selections'] || r['max'] || '0')) || 0,
          options: (r['modifiers_in_group'] || r['options'] || '').split(/[;|]/).map(s => s.trim()).filter(Boolean).map(o => ({ name: o, priceDelta: 0 })),
        };
        groupMap.set(M.normName(gname), g);
        out.groups.push(g);
      }
    }
  }
  out.categories = [...new Set(out.categories)];
  return out;
}

function parseLightspeed(rows) {
  const out = { categories: [], items: [], groups: [] };
  for (const r of rows) {
    const kind = (r['type'] || '').toLowerCase();
    if (kind === 'category' || (!r['name'] && r['category'])) { out.categories.push(r['category'] || r['name']); continue; }
    const name = r['name'] || r['item_name'];
    if (!name) continue;
    out.categories.push(r['category'] || 'Uncategorized');
    const mgRaw = r['modifier_groups'] || '';
    out.items.push({
      name, category: r['category'] || 'Uncategorized',
      price: M.money(r['price'] || '0') || 0,
      description: r['description'] || '',
      modifierGroupNames: mgRaw ? mgRaw.split(/[;|]/).map(s => s.trim()).filter(Boolean) : [],
      available: !/^(no|false)$/i.test(r['available'] || 'yes'),
      tax: r['tax'] || r['tax rate'] || null,
    });
    for (const gname of (mgRaw ? mgRaw.split(/[;|]/).map(s => s.trim()).filter(Boolean) : [])) {
      if (!out.groups.find(g => M.normName(g.name) === M.normName(gname))) {
        out.groups.push({ name: gname, min: Number(r['min'] || 0) || 0, max: Number(r['max'] || 0) || 0, options: [] });
      }
    }
  }
  out.categories = [...new Set(out.categories)];
  return out;
}

function parseToast(rows) {
  const out = { categories: [], items: [], groups: [] };
  const groupMap = new Map();
  for (const r of rows) {
    const cat = r['group_name'] || r['menu_group'] || r['category'] || 'Uncategorized';
    const name = r['item_name'] || r['name'];
    if (!name) continue;
    out.categories.push(cat);
    const modsRaw = r['modifier_groups'] || '';
    const modifierGroupNames = modsRaw ? modsRaw.split('|').map(s => s.trim()).filter(Boolean) : [];
    out.items.push({
      name, category: cat, price: M.money(r['price'] || '0') || 0,
      description: r['description'] || '', modifierGroupNames,
      available: !/^(false|no)$/i.test(r['available'] || 'true'),
    });
    for (const gname of modifierGroupNames) {
      if (!groupMap.has(M.normName(gname))) {
        const g = {
          name: gname, min: 0,
          max: 0,
          options: (r['modifiers'] || '').split('|').map(s => s.trim()).filter(Boolean).map(o => ({ name: o, priceDelta: 0 })),
        };
        groupMap.set(M.normName(gname), g);
        out.groups.push(g);
      }
    }
  }
  out.categories = [...new Set(out.categories)];
  return out;
}

function parseCanonical(text) {
  const data = JSON.parse(text);
  const menu = Array.isArray(data) ? { items: data } : (data.menu || data);
  if (Array.isArray(data)) {
    // heartland-pos flat script format: [{name, category, price, modifiers:[{name}], time_ranges}]
    const groups = new Map();
    const items = [];
    for (const it of data) {
      for (const mod of it.modifiers || []) {
        const key = M.normName(mod.group || 'Modifiers');
        if (!groups.has(key)) groups.set(key, { name: mod.group || 'Modifiers', min: 0, max: 0, options: [] });
        const g = groups.get(key);
        if (!g.options.find(o => M.normName(o.name) === M.normName(mod.name))) g.options.push({ name: mod.name, priceDelta: mod.price || 0 });
      }
      items.push({
        name: it.name, category: it.category || 'Uncategorized',
        price: typeof it.price === 'string' ? M.money(it.price) : Math.round((it.price || 0)),
        description: it.description || '',
        modifierGroupNames: (it.modifiers || []).map(m => m.group || 'Modifiers'),
        legacyTimeRanges: it.time_ranges || null,
      });
    }
    return { categories: [...new Set(items.map(i => i.category))], items, groups: [...groups.values()], _flat: true };
  }
  return { canonical: true, menu, meta: { channels: data.channels, pricingRules: menu.pricingRules, schedules: menu.schedules } };
}

// ───────────────────────────────── apply to workbench ─────────────────────────────────
function applyPieces(menu, parsed, warnings) {
  let normalized = 0;
  const catByName = new Map();
  for (const cname of parsed.categories || []) {
    const c = M.ensureCategory(menu, cname);
    catByName.set(M.normName(cname), c);
    if (c.name !== cname) normalized++;
  }
  const gByName = new Map();
  for (const g of menu.modifierGroups) gByName.set(M.normName(g.name), g);
  for (const pg of parsed.groups || []) {
    if (!pg || !pg.name) continue;
    const key = M.normName(pg.name);
    let g = gByName.get(key);
    if (!g) {
      g = { id: `mg_${key.replace(/[^a-z0-9]+/g, '_')}`, name: M.titleCase(pg.name), minChoices: pg.min || 0, maxChoices: pg.max || 0, included: 0, shared: false, halfAndHalfAllowed: false, availableOnline: true, options: [], itemScope: null };
      menu.modifierGroups.push(g);
      gByName.set(key, g);
    }
    const seen = new Set(g.options.map(o => M.normName(o.name)));
    for (const opt of pg.options || []) {
      const ok = M.normName(opt.name);
      if (!ok || !opt.name) continue;
      if (seen.has(ok)) { normalized++; continue; } // folded duplicate option
      seen.add(ok);
      g.options.push({ id: `mo_${ok.replace(/[^a-z0-9]+/g, '_')}`, name: M.titleCase(opt.name), priceDelta: M.money(opt.priceDelta) || 0, default: false });
      if (M.titleCase(opt.name) !== opt.name) normalized++;
    }
  }
  const seenItemKeys = new Map(menu.items.map(i => [M.normName(i.name) + '::' + M.normName(i.category), i]));
  for (const pi of parsed.items) {
    if (!pi.name) continue;
    const key = M.normName(pi.name) + '::' + M.normName(pi.category);
    let item = seenItemKeys.get(key);
    const normNameVal = M.titleCase(pi.name);
    if (normNameVal !== pi.name) normalized++;
    if (!item) {
      item = {
        id: `it_${key.replace(/[^a-z0-9]+/g, '_')}`,
        name: normNameVal, category: (catByName.get(M.normName(pi.category)) || M.ensureCategory(menu, pi.category)).name,
        price: pi.price, description: pi.description || '', modifierGroups: [],
        channels: menu.channels.filter(c => c.status === 'live').map(c => c.name),
        course: pi.course || 0, rush: false, hold: false, halfAndHalf: false, misc: false,
        unavailable: null, stock: null, archived: false, taxRateId: 'tx_food',
      };
      menu.items.push(item);
      seenItemKeys.set(key, item);
    } else {
      if (pi.price != null && pi.price !== item.price) { item.price = pi.price; normalized++; }
      if (pi.description != null) item.description = pi.description;
    }
    if (pi.legacyTimeRanges) item.time_ranges = pi.legacyTimeRanges;
    const wanted = new Set((pi.modifierGroupNames || []).map(n => M.normName(n)));
    const ids = [...wanted].map(k => gByName.get(k)?.id).filter(Boolean);
    item.modifierGroups = ids.length ? ids : item.modifierGroups;
    if (!item.modifierGroups?.length && wanted.size) warnings.push(`item "${item.name}" referenced modifier groups not present after import: ${[...wanted].join(', ')}`);
  }
  return normalized;
}

function importRaw(content, filename, { format = 'auto', platform = 'heartland', menu, mode = 'modify' } = {}) {
  const fmt = format === 'auto' ? detectFormat(filename, content, platform) : format;
  const warnings = [];
  if (mode === 'replace') { menu.items = []; menu.modifierGroups = []; menu.categories = []; warnings.push('replace mode: staging menu cleared before import (Square Replace Item Library semantics — this is the destructive path)'); }
  let parsed;
  if (fmt === 'canonical-json') {
    const c = parseCanonical(content);
    if (c.canonical) {
      for (const key of ['categories', 'items', 'modifierGroups', 'pricingRules', 'schedules']) {
        if (c.menu[key]) menu[key] = c.menu[key];
      }
      if (c.menu.channels) menu.channels = c.menu.channels;
      if (c.menu.taxRates) menu.taxRates = c.menu.taxRates;
      const normRes = require('../engine/skills/menu-ops')['menu.normalize'].handler({ runId: 'import' }, { dryPreview: false }, menu);
      return { format: fmt, summary: { items: menu.items.length, categories: menu.categories.length, groups: menu.modifierGroups.length, normalized: normRes.diff.count }, warnings };
    }
    parsed = c;
  } else {
    const rows = rowsToObjects(parseCSV(content));
    if (!rows.length) throw new Error(`No data rows found in ${filename}`);
    parsed = fmt === 'square-csv' ? parseSquare(rows)
      : fmt === 'clover-csv' ? parseClover(rows)
        : fmt === 'lightspeed-csv' ? parseLightspeed(rows)
          : parseToast(rows);
  }
  const normalized = applyPieces(menu, parsed, warnings);
  if (warnings.length > 20) warnings.length = 20;
  return {
    format: fmt,
    summary: {
      items: menu.items.length,
      categories: menu.categories.length,
      groups: menu.modifierGroups.length,
      normalized,
    },
    warnings,
  };
}

function importFile(file, opts) {
  let abs = file;
  if (!path.isAbsolute(abs)) abs = path.join(IMPORT_DIR, file);
  if (!fs.existsSync(abs)) {
    // convenience fallback: repo fixtures folder (used by verify/test suites)
    const fx = path.join(__dirname, '..', '..', 'fixtures', path.basename(file));
    if (fs.existsSync(fx)) abs = fx;
  }
  if (!fs.existsSync(abs)) throw new Error(`Import file not found: ${abs} (place files under data/imports/)`);
  return importRaw(fs.readFileSync(abs, 'utf8'), path.basename(abs), opts);
}

// ───────────────────────────────── exporters ─────────────────────────────────
function exportMenu(menu, format, platform, dryRun = false) {
  if (!dryRun) fs.mkdirSync(EXPORT_DIR, { recursive: true });
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  const base = `menuflow-${platform}-${stamp}`;
  let filename, content;
  if (format === 'canonical-json') {
    filename = `${base}.json`;
    content = JSON.stringify({ kind: 'menuflow.canonical-menu', exportedAt: new Date().toISOString(), menu }, null, 2);
  } else if (format === 'heartland-json') {
    // the exact flat shape heartland-pos python audit scripts consume
    filename = `${base}.heartland-export.json`;
    const flat = menu.items.filter(i => !i.archived).map(i => ({
      name: i.name, category: i.category, price: i.price,
      modifiers: (i.modifierGroups || []).flatMap(gid => {
        const g = menu.modifierGroups.find(x => x.id === gid);
        return (g?.options || []).map(o => ({ name: o.name, group: g.name, price: o.priceDelta }));
      }),
      time_ranges: i.time_ranges || [],
    }));
    content = JSON.stringify(flat, null, 2);
  } else if (format === 'square-csv') {
    filename = `${base}.square.csv`;
    const head = ['Name', 'Category Name', 'Price', 'Description', 'Modifier Set', 'Visible'];
    const rows = [head.join(',')];
    for (const it of menu.items.filter(i => !i.archived)) {
      const mods = (it.modifierGroups || []).map(gid => menu.modifierGroups.find(g => g.id === gid)?.name).filter(Boolean).join('; ');
      rows.push([csvCell(it.name), csvCell(it.category), (it.price / 100).toFixed(2), csvCell(it.description || ''), csvCell(mods), it.unavailable ? 'N' : 'Y'].join(','));
    }
    content = rows.join('\n');
  } else if (format === 'clover-csv') {
    filename = `${base}.clover.csv`;
    const head = ['Name', 'Group', 'Price', 'Description', 'Modifier Groups', 'Available'];
    const rows = [head.join(',')];
    for (const it of menu.items.filter(i => !i.archived)) {
      const mods = (it.modifierGroups || []).map(gid => menu.modifierGroups.find(g => g.id === gid)?.name).filter(Boolean).join('; ');
      rows.push([csvCell(it.name), csvCell(it.category), (it.price / 100).toFixed(2), csvCell(it.description || ''), csvCell(mods), it.unavailable ? 'false' : 'true'].join(','));
    }
    content = rows.join('\n');
  } else if (format === 'lightspeed-csv') {
    filename = `${base}.lightspeed.csv`;
    const head = ['Type', 'Name', 'Category', 'Price', 'Description', 'Modifier Groups', 'Available'];
    const rows = [head.join(',')];
    for (const c of menu.categories) rows.push(['category', csvCell(c.name), '', '', '', '', 'yes'].join(','));
    for (const it of menu.items.filter(i => !i.archived)) {
      const mods = (it.modifierGroups || []).map(gid => menu.modifierGroups.find(g => g.id === gid)?.name).filter(Boolean).join('; ');
      rows.push(['item', csvCell(it.name), csvCell(it.category), (it.price / 100).toFixed(2), csvCell(it.description || ''), csvCell(mods), it.unavailable ? 'no' : 'yes'].join(','));
    }
    content = rows.join('\n');
  } else if (format === 'toast-csv') {
    filename = `${base}.toast.csv`;
    const head = ['Group Name', 'Item Name', 'Price', 'Description', 'Modifier Groups', 'Available'];
    const rows = [head.join(',')];
    for (const it of menu.items.filter(i => !i.archived)) {
      const mods = (it.modifierGroups || []).map(gid => menu.modifierGroups.find(g => g.id === gid)?.name).filter(Boolean).join('|');
      rows.push([csvCell(it.category), csvCell(it.name), (it.price / 100).toFixed(2), csvCell(it.description || ''), csvCell(mods), it.unavailable ? 'false' : 'true'].join(','));
    }
    content = rows.join('\n');
  } else throw new Error(`Unknown export format: ${format}`);
  const file = path.join(EXPORT_DIR, filename);
  if (!dryRun) fs.writeFileSync(file, content);
  return { filename, path: dryRun ? '(dry-run: not written)' : file, format, bytes: Buffer.byteLength(content), content };
}

function exportWorkflows(platform) {
  fs.mkdirSync(EXPORT_DIR, { recursive: true });
  const all = engine().listWorkflows(platform);
  const verification = engine().validateAll({});
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  const filename = `menuflow-workflows-${platform}-${stamp}.json`;
  const payload = {
    kind: 'menuflow.workflow-bundle', platform, exportedAt: new Date().toISOString(),
    workflows: all,
    verification: { ok: verification.ok, totals: verification.totals, platform: verification.platforms[platform] || null },
    sources: Object.fromEntries(Object.entries(require('../sources').SOURCES).map(([k, v]) => [k, { title: v.title, url: v.url, verified: v.verified }])),
  };
  const file = path.join(EXPORT_DIR, filename);
  fs.writeFileSync(file, JSON.stringify(payload, null, 2));
  return { filename, path: file, workflows: all.length, verified: verification.ok, bytes: Buffer.byteLength(JSON.stringify(payload)) };
}

function exportProject() {
  fs.mkdirSync(EXPORT_DIR, { recursive: true });
  const s = store.load();
  const cloneData = JSON.parse(JSON.stringify(s));
  cloneData.settings.apiKeys = {}; // never export credentials
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  const filename = `menuflow-project-backup-${stamp}.json`;
  const file = path.join(EXPORT_DIR, filename);
  fs.writeFileSync(file, JSON.stringify(cloneData, null, 2));
  return { filename, path: file, bytes: fs.statSync(file).size };
}

function importProject(content) {
  const data = JSON.parse(content);
  if (!data.meta || data.meta.app !== 'menuflow-pos') throw new Error('Not a MenuFlow project backup (meta.app missing)');
  data.settings = data.settings || { mode: 'sandbox', apiKeys: {} };
  data.settings.apiKeys = {}; // drop credentials from imported backups too
  fs.mkdirSync(store.DATA_DIR, { recursive: true });
  fs.writeFileSync(store.STATE_FILE, JSON.stringify(data, null, 2));
  return { locations: data.locations.length, runs: (data.runs || []).length };
}

module.exports = {
  parseCSV, rowsToObjects, detectFormat, importRaw, importFile,
  exportMenu, exportWorkflows, exportProject, importProject,
  EXPORT_DIR, IMPORT_DIR,
};

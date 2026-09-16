/** io.test.js — import/export: normalization, platform CSV shapes, round-trips, backups. */
const fs = require('fs');
const path = require('path');
const { test, eq, ok, report } = require('./harness');
const IE = require('../server/importexport');
const store = require('../server/store');
const M = require('../server/engine/menu');

store.load();

test('canonical JSON export → import round-trips exactly', () => {
  const loc = 'loc_marios';
  const live = store.menuFor(loc, 'live');
  const out = IE.exportMenu(live, 'canonical-json', 'heartland');
  const fresh = M.newMenu('fresh');
  const r = IE.importRaw(fs.readFileSync(out.path, 'utf8'), out.filename, { format: 'canonical-json', platform: 'heartland', menu: fresh });
  eq(r.summary.items, live.items.length, 'item count round-trips');
  eq(fresh.categories.length, live.categories.length, 'categories');
  eq(fresh.modifierGroups.length, live.modifierGroups.length, 'groups');
  eq(fresh.pricingRules.length, live.pricingRules.length, 'pricing rules');
  eq(fresh.schedules.length, live.schedules.length, 'schedules');
  const a = JSON.parse(fs.readFileSync(out.path, 'utf8')).menu.items.find(i => i.name === 'Meat Lovers Pizza');
  const b = fresh.items.find(i => i.name === 'Meat Lovers Pizza');
  eq(a.modifierGroups, b.modifierGroups, 'modifier links preserved');
  eq(a.price, b.price, 'price preserved');
  fs.rmSync(out.path);
});

test('square CSV export is re-importable and folds case-duplicate options', () => {
  const loc = 'loc_marios';
  const live = store.menuFor(loc, 'live');
  const out = IE.exportMenu(live, 'square-csv', 'heartland');
  const fresh = M.newMenu('roundtrip');
  const r = IE.importRaw(fs.readFileSync(out.path, 'utf8'), out.filename, { format: 'square-csv', menu: fresh });
  ok(r.summary.items >= 25, `items imported: ${r.summary.items}`);
  ok(r.summary.normalized >= 0);
  // re-importing the same CSV into the same workbench does not duplicate items
  const before = fresh.items.length;
  IE.importRaw(fs.readFileSync(out.path, 'utf8'), out.filename, { format: 'square-csv', menu: fresh });
  eq(fresh.items.length, before, 'idempotent upsert');
  fs.rmSync(out.path);
});

test('import normalization: trims, folds "pepperoni"/"Pepperoni", converts money strings (the ×22 problem)', () => {
  const menu = M.newMenu('n');
  const csv = [
    'Name,Category Name,Price,Description,Modifier Set,Visible',
    '  Pepperoni  Pizza,Pizza,14.50,,Toppings,Y',
    'pepperoni pizza,Pizza,14.5,  ,Toppings,Y',          // same item, near-dup name+case → merged
    'Cheese Pizza,Pizza,$12.00,,Toppings;  toppings,Y', // money string + dup modifier set
  ].join('\n');
  const r = IE.importRaw(csv, 'x.csv', { format: 'square-csv', menu });
  eq(menu.items.length, 2, `duplicate rows consolidated, got ${menu.items.length}`);
  const toppings = menu.modifierGroups.find(g => /toppings/i.test(g.name));
  ok(toppings, 'group created once despite case variants');
  eq(r.summary.items, 2);
});

test('clover + lightspeed + toast CSV parsers produce canonical rows', () => {
  const clo = 'Name,Group,Price,Description,Modifier Groups,Available\nHot Wing,Apps,9.50,,Sauce;Sides,true\n';
  const ls = 'Type,Name,Category,Price,Description,Modifier Groups,Available\nitem,Hot Wing,Apps,9.50,,Sauce,yes\n';
  const toast = 'Group Name,Item Name,Price,Description,Modifier Groups,Available\nApps,Hot Wing,9.50,,Sauce,true\n';
  for (const [fmt, csv] of [['clover-csv', clo], ['lightspeed-csv', ls], ['toast-csv', toast]]) {
    const menu = M.newMenu(fmt);
    const r = IE.importRaw(csv, 'f.csv', { format: fmt, menu });
    eq(r.summary.items, 1, fmt);
    const it = menu.items[0];
    eq(it.name, 'Hot Wing', fmt);
    eq(it.category, 'Apps', fmt);
    eq(it.price, 950, `${fmt} money`);
    ok((it.modifierGroups || []).length >= 1, `${fmt} groups`);
  }
});

test('unknown format detection still parses JSON arrays (heartland flat export from the python tooling)', () => {
  const menu = M.newMenu('flat');
  const flat = [
    { name: 'Pepperoni Pizza', category: 'Pizza', price: 14.5, modifiers: [{ name: 'pepperoni', group: 'Toppings', price: 2.5 }] },
    { name: 'Cheese Pizza', category: 'Pizza', price: 12.5, modifiers: [{ name: 'cheese', group: 'Toppings', price: 2 }] },
  ];
  const r = IE.importRaw(JSON.stringify(flat), 'menu-export.json', { menu });
  eq(r.summary.items, 2);
  ok(menu.modifierGroups.length >= 1);
});

test('replace mode clears staging before importing; modify keeps and merges', () => {
  const loc = 'loc_marios';
  const live = store.menuFor(loc, 'live');
  const m1 = store.clone(live);
  const csv = 'Name,Category Name,Price,Description,Modifier Set,Visible\nOnly Item,Pizza,9.00,,,Y\n';
  IE.importRaw(csv, 'x.csv', { format: 'square-csv', menu: m1, mode: 'replace' });
  eq(m1.items.length, 1, 'replace wipes then imports');
  const m2 = store.clone(live);
  const before = m2.items.length;
  IE.importRaw(csv, 'x.csv', { format: 'square-csv', menu: m2, mode: 'modify' });
  eq(m2.items.length, before + 1, 'modify adds one');
});

test('workflow bundle export contains verification results + sources', () => {
  const out = IE.exportWorkflows('heartland');
  const data = JSON.parse(fs.readFileSync(out.path, 'utf8'));
  eq(data.platform, 'heartland');
  ok(data.workflows.length >= 8, 'has heartland workflows');
  ok(data.verification.ok === true, 'bundle carries verification state');
  ok(Object.keys(data.sources).length >= 5, 'sources attached for offline traceability');
  ok(data.workflows.every(w => w.steps.every(st => st.kind !== 'manual' || (st.citations || []).length > 0)), 'every manual step in the bundle cites a manual');
  fs.rmSync(out.path);
});

test('project backup/restore round-trips (credentials never exported)', () => {
  const out = IE.exportProject();
  const data = JSON.parse(fs.readFileSync(out.path, 'utf8'));
  eq(Object.keys(data.settings.apiKeys || {}).length, 0, 'no credentials in backups');
  ok(data.locations.length >= 7);
  const r = IE.importProject(fs.readFileSync(out.path, 'utf8'));
  eq(r.locations, data.locations.length);
  fs.rmSync(out.path);
});

test('CSV parser handles quoted commas/newlines and the Y/N modifier flag', () => {
  const csv = [
    'Name,Category Name,Price,Description,Modifier Set,Visible',
    '"Pizza, Deluxe",Pizza,15.00,"extra: cheese\n, sauce",Toppings,Y',
    '"No mods",Pizza,10.00,,N,Y',
  ].join('\n');
  const menu = M.newMenu('q');
  IE.importRaw(csv, 'q.csv', { format: 'square-csv', menu });
  const d = menu.items.find(i => i.name.startsWith('Pizza'));
  ok(d, 'quoted comma name parsed');
  eq(d.price, 1500);
  const n = menu.items.find(i => /^No Mods$/i.test(i.name));
  eq((n.modifierGroups || []).length, 0, 'modifier column "N" = off');
});

/* ── per-platform bulk-file formats (docs/manuals/<platform>.md) ───────────────────── */

test('TouchBistro bulk-upload shape: export re-imports through auto-detection', () => {
  const live = store.menuFor('loc_marios_touchbistro', 'live');
  const out = IE.exportMenu(live, 'touchbistro-csv', 'touchbistro');
  const text = fs.readFileSync(out.path, 'utf8');
  eq(IE.detectFormat(out.filename, text, 'touchbistro'), 'touchbistro-csv',
    'our own TouchBistro file must auto-detect as TouchBistro, not Square or Clover');
  const fresh = M.newMenu('tb-roundtrip');
  const r = IE.importRaw(text, out.filename, { format: 'auto', platform: 'touchbistro', menu: fresh });
  eq(r.format, 'touchbistro-csv');
  // TouchBistro rows are item-centric: a group travels only if some item lists it, so the
  // expected group count is the set of group names actually referenced by non-archived items.
  const liveById = new Map((live.modifierGroups || []).map(g => [g.id, g.name]));
  const referenced = new Set(live.items.filter(i => !i.archived)
    .flatMap(i => (i.modifierGroups || []).map(id => liveById.get(id)).filter(Boolean)));
  eq(r.summary.items, live.items.filter(i => !i.archived).length, 'items preserved');
  eq(r.summary.groups, referenced.size, 'groups travel via the item rows that reference them');
  ok(fresh.items.every(i => i.price > 0), 'prices must survive as cents');
  fs.rmSync(out.path);
});

test('TouchBistro: Tax and Kitchen Printer columns are reported, not written', () => {
  const text = fs.readFileSync(path.join(__dirname, '..', 'fixtures', 'touchbistro-menu.csv'), 'utf8');
  const fresh = M.newMenu('tb-fixture');
  const r = IE.importRaw(text, 'touchbistro-menu.csv', { format: 'auto', platform: 'touchbistro', menu: fresh });
  eq(r.format, 'touchbistro-csv', 'the Sales Category header must win over the Clover min/max rule');
  ok(r.warnings.some(w => /tax/i.test(w)), 'tax is set per item in RMM, so the importer must say it is skipping it');
  ok(r.warnings.some(w => /kitchen|printer/i.test(w)), 'kitchen-printer routing has no canonical equivalent');
  ok(!fresh.items.some(i => i.taxRates || i.tax || i.printerGroup || i.kitchenPrinter),
    'ignored columns must not leak half-formed fields into the menu');
  ok(fresh.items.length >= 3, `rows imported: ${fresh.items.length}`);
});

test('vendor fixtures parse into the shapes their manuals describe', () => {
  const F = f => fs.readFileSync(path.join(__dirname, '..', 'fixtures', f), 'utf8');

  // Toast: one row per item here (the real tool uses one row per OPERATION), groups carry |
  const toast = M.newMenu('t');
  const rt = IE.importRaw(F('toast-menu.csv'), 'toast-menu.csv', { format: 'auto', platform: 'toast', menu: toast });
  eq(rt.format, 'toast-csv');
  eq(toast.items[0].price, 1450, 'price string 14.50 -> 1450 cents');
  ok(toast.modifierGroups.length >= 2, `toast groups: ${toast.modifierGroups.length}`);
  ok(toast.modifierGroups.every(g => (g.options || []).length > 0),
    'an empty modifier group is what hides a Toast menu in third-party syncs');

  // Clover: Min/Max selections drive the group cardinality the kiosk fix depends on
  const clover = M.newMenu('c');
  const rc = IE.importRaw(F('clover-items.csv'), 'clover-items.csv', { format: 'auto', platform: 'clover', menu: clover });
  eq(rc.format, 'clover-csv');
  const size = clover.modifierGroups.find(g => g.name === 'Pizza Size');
  eq([size.minChoices, size.maxChoices, size.options.length], [0, 1, 3], 'Clover Min/Max must map onto canonical cardinality');
  const wing = clover.modifierGroups.find(g => g.name === 'Wing Sauce');
  eq([wing.minChoices, wing.maxChoices, wing.options.length], [1, 1, 4], 'forced single-select survives the round trip');

  // Heartland: the legacy flat array the client's python tooling produced
  const hl = M.newMenu('h');
  const rh = IE.importRaw(F('heartland-flat.json'), 'heartland-flat.json', { format: 'auto', platform: 'heartland', menu: hl });
  eq(rh.format, 'canonical-json');
  eq([rh.summary.items, rh.summary.groups, rh.summary.categories], [5, 3, 3], 'flat heartland export counts');
});

test('our own Lightspeed export auto-detects back (regression: it read as Square)', () => {
  const live = store.menuFor('loc_marios_lightspeed', 'live');
  const out = IE.exportMenu(live, 'lightspeed-csv', 'lightspeed');
  const text = fs.readFileSync(out.path, 'utf8');
  eq(IE.detectFormat(out.filename, text, 'lightspeed'), 'lightspeed-csv',
    'the Type + Modifier Groups header is what distinguishes a Lightspeed file');
  const fresh = M.newMenu('ls');
  IE.importRaw(text, out.filename, { format: 'auto', platform: 'lightspeed', menu: fresh });
  ok(fresh.modifierGroups.length > 0, 'groups=0 meant the file was parsed with the wrong grammar');
  ok(fresh.items.length === live.items.filter(i => !i.archived).length, 'item count');
  fs.rmSync(out.path);
});

test('detection order: a Square header is never read as TouchBistro and vice versa', () => {
  const sq = fs.readFileSync(path.join(__dirname, '..', 'fixtures', 'square-export.csv'), 'utf8');
  eq(IE.detectFormat('square-export.csv', sq, 'square'), 'square-csv', 'Square keeps its own header');
  eq(IE.detectFormat('new-library.csv', sq, 'touchbistro'), 'square-csv',
    'platform fallback must not hijack a file that already matches the Square grammar');
  const tb = fs.readFileSync(path.join(__dirname, '..', 'fixtures', 'touchbistro-menu.csv'), 'utf8');
  eq(IE.detectFormat('anything.csv', tb, 'heartland'), 'touchbistro-csv',
    'Sales Category is the only reliable TouchBistro signal, so it must not be diluted with Item Name/Visible');
});

report();

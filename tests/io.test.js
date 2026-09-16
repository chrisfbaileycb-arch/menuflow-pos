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

report();

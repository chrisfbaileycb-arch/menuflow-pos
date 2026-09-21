/**
 * audit.test.js — parity with the ORIGINAL heartland-pos audit scripts
 * (tests/parity/*.py vendored verbatim from the client knowledge repo):
 * run Python → run JS port on the same input → assert identical detections.
 * Plus targeted unit checks for the extended (model-aware) scans.
 */
const { execFileSync } = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { test, eq, ok, report } = require('./harness');
const store = require('../server/store');
const A = require('../server/engine/audit');
const IE = require('../server/importexport');
const M = require('../server/engine/menu');

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'menuflow-parity-'));

/** Build a parity input: same structure, but without case-collision options
 *  (the JS engine additionally folds 'pepperoni'/'Pepperoni' as a normalization
 *   feature; the python scripts key on exact name. Removing the duplicate option
 *   makes the datasets comparable 1:1.) */
function parityMenu() {
  const menu = store.clone(store.menuFor('loc_marios', 'live'));
  const g = menu.modifierGroups.find(x => x.id === 'mg_toppings');
  g.options = g.options.filter(o => o.id !== 'mo_pep2'); // drop lowercase twin
  return menu;
}

function toPythonInput(menu) {
  return menu.items.filter(i => !i.archived).map(i => ({
    name: i.name, category: i.category, price: i.price,
    modifiers: (i.modifierGroups || []).flatMap(gid => {
      const g = menu.modifierGroups.find(x => x.id === gid);
      return (g?.options || []).map(o => ({ name: o.name, group: g.name, price: o.priceDelta }));
    }),
    time_ranges: i.time_ranges || [],
  }));
}

function runPython(script, inputJson) {
  const inF = path.join(tmp, 'in.json'), outF = path.join(tmp, `out-${script}`);
  fs.writeFileSync(inF, JSON.stringify(inputJson));
  execFileSync('python3', [path.join(__dirname, 'parity', script), '--input', inF, '--output', outF], { stdio: 'pipe' });
  return JSON.parse(fs.readFileSync(outF, 'utf8'));
}

test('parity: modifier cross-contamination matches modifier-scan.py', () => {
  const menu = parityMenu();
  const rows = toPythonInput(menu);
  const py = runPython('modifier-scan.py', rows);
  const js = A.modifierCrossContamination(menu);
  eq(js.length, py.cross_contamination_violations.length, 'violation count');
  for (const p of py.cross_contamination_violations) {
    const j = js.find(x => x.modifier === p.modifier);
    ok(j, `python flagged '${p.modifier}' but JS did not`);
    eq(j.item_count, p.item_count, `item_count for ${p.modifier}`);
    eq(j.severity, p.severity, `severity for ${p.modifier}`);
    eq(j.categories_affected, p.categories_affected, `categories for ${p.modifier}`);
  }
  for (const j of js) ok(py.cross_contamination_violations.some(p => p.modifier === j.modifier), `JS flagged '${j.modifier}' but python did not`);
});

test('parity: redundant modifiers match redundancy-check.py (>5 / HIGH>15)', () => {
  const menu = parityMenu();
  const py = runPython('redundancy-check.py', toPythonInput(menu));
  const js = A.modifierMaintenanceRisk(menu);
  eq(js.length, py.redundant_modifiers.length, 'count');
  for (const p of py.redundant_modifiers) {
    const j = js.find(x => M.normName(x.name) === p.name);
    ok(j, `python redundancy '${p.name}' missing in JS`);
    eq(j.occurrence_count, p.occurrence_count, `count for ${p.name}`);
    eq(j.severity, p.severity, `severity for ${p.name}`);
  }
});

test('parity: duplicate item names match redundancy-check.py', () => {
  const menu = parityMenu();
  const py = runPython('redundancy-check.py', toPythonInput(menu));
  const js = A.duplicateItemNames(menu);
  eq(js.length, py.duplicate_items.length);
  for (const p of py.duplicate_items) ok(js.some(j => j.name === p.name), `python dup '${p.name}' missing`);
});

test('parity: midnight violations on item ranges match redundancy-check.py (JS is a superset for schedules)', () => {
  const menu = parityMenu();
  const py = runPython('redundancy-check.py', toPythonInput(menu));
  const js = A.midnightViolations(menu).filter(v => v.owner === 'item');
  eq(js.length, py.midnight_rule_violations.length, 'item-range midnight count');
  if (js.length) {
    eq(js[0].range, py.midnight_rule_violations[0].range.replace(/\u2013/g, '–'), 'range string');
    eq(js[0].severity, py.midnight_rule_violations[0].severity);
  }
});

test('parity: 86 cascade risk matches 86-risk-report.py (incl. revenue exposure)', () => {
  const menu = parityMenu();
  const py = runPython('86-risk-report.py', toPythonInput(menu));
  const js = A.cascadeRisk86(menu);
  const pyAll = [...py.high_risk_items, ...py.medium_risk_items];
  eq(js.length, pyAll.length, 'total cascade entries');
  for (const p of pyAll) {
    const j = js.find(x => x.modifier === p.modifier);
    ok(j, `python cascade '${p.modifier}' missing in JS`);
    eq(j.items_that_would_be_affected, p.items_that_would_be_affected, `items for ${p.modifier}`);
    eq(j.category_count, p.category_count, `cats for ${p.modifier}`);
    eq(j.severity, p.severity, `sev for ${p.modifier}`);
    eq(j.estimated_revenue_exposure_cents, Math.round(p.estimated_revenue_exposure), `exposure for ${p.modifier} (input prices are cents on both sides)`);
  }
});

test('python scripts execute against the console export file format unchanged', () => {
  const menu = parityMenu();
  const out = IE.exportMenu(menu, 'heartland-json', 'heartland');
  const py = runPython('modifier-scan.py', JSON.parse(fs.readFileSync(out.path, 'utf8')));
  ok(py.summary.total_items_scanned === menu.items.filter(i => !i.archived).length, 'export readable by original tooling');
  fs.rmSync(out.path, { force: true });
});

test('extended scans fire on seeded patterns (empty groups, dead force, rush+hold, course 0)', () => {
  const menu = store.menuFor('loc_marios', 'live');
  ok(A.emptyModifierGroups(menu).some(f => f.group === 'Kiosk Extras'), 'empty group detected');
  ok(A.pricingRuleConflicts(menu).some(f => f.type === 'DEAD_FORCE_PRICE_RULE' && f.dead_rule.includes('STALE')), 'dead force rule detected');
  ok(A.pricingRuleConflicts(menu).some(f => f.type === 'PRICING_RULE_STACK_DEEP'), 'deep stack detected');
  ok(A.coursingIssues(menu).some(f => f.type === 'RUSH_HOLD_CONFLICT' && f.item.includes('Buffalo Wings')), 'rush+hold detected');
  ok(A.coursingIssues(menu).filter(f => f.type === 'COURSE_UNASSIGNED').length >= 5, 'course-0 items detected');
  ok(A.isolationViolations(menu).length >= 2, 'record-level isolation violations detected');
  ok(A.midnightViolations(menu).length >= 3, 'midnight violations (schedules+rules+legacy ranges) detected');
  const full = A.fullAudit(menu);
  ok(full.integrity_score, 'integrity_score present');
  ok(typeof full.integrity_score.score === 'number' && full.integrity_score.score >= 0 && full.integrity_score.score <= 100, 'numeric integrity score in [0, 100]');
  ok(full.vulnerabilities, 'vulnerabilities present');
  ok(Array.isArray(full.vulnerabilities.items), 'vulnerabilities items array');
  const priceCollisions = A.priceCollisions(menu);
  ok(Array.isArray(priceCollisions), 'price collisions array');
  const sidecar = A.sideCarReconstruction(menu);
  ok(Array.isArray(sidecar), 'sidecar reconstruction array');
  const swaps = A.unrestrictedProteinSwaps(menu);
  ok(Array.isArray(swaps), 'protein swaps array');
});

fs.rmSync(tmp, { recursive: true, force: true });
report();

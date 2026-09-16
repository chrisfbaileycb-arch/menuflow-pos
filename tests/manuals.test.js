/**
 * manuals.test.js — the docs/manuals ↔ registry ↔ workflow contract.
 *
 * The per-platform manuals are load-bearing: their section headings become the citation
 * excerpts a workflow resolves to, and the verifier refuses citations that do not resolve.
 * This suite is what stops the three layers from drifting apart.
 */
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');
const { test, eq, ok, match, report } = require('./harness');
const { SOURCES, getCitation } = require('../server/sources');
const PLATFORMS = require('../server/platforms');
const engine = require('../server/engine/engine');

const ROOT = path.join(__dirname, '..');
const MANUAL_DIR = path.join(ROOT, 'docs', 'manuals');
const HEADING = /^## \d+\.\s+([a-z0-9-]+)\s+—\s+(.+)$/;
const plats = PLATFORMS.list();
const workflows = engine.listWorkflows();

const headingsOf = file => {
  const keys = [];
  for (const line of fs.readFileSync(path.join(MANUAL_DIR, file), 'utf8').split('\n')) {
    const m = line.match(HEADING);
    if (m) keys.push(m[1]);
  }
  return keys;
};

test('every platform in the dropdown ships its own manual, registered and on disk', () => {
  eq(plats.length, 7, 'platform count');
  for (const p of plats) {
    const doc = SOURCES[`${p.id}.manual`];
    ok(doc, `${p.id}: no "${p.id}.manual" document registered`);
    ok(doc.publisher && doc.url, `${p.id}: manual needs a publisher and a source URL`);
    ok(['official-doc', 'access-limited', 'compiled', 'community-doc'].includes(doc.verified),
      `${p.id}: unexpected verification status ${doc.verified}`);
    ok(doc.checked, `${p.id}: manual needs the date its sources were checked`);
    ok(fs.existsSync(path.join(ROOT, p.manual)), `${p.id}: ${p.manual} missing on disk`);
    eq(doc.manual, p.manual, `${p.id}: registry points at a different file than the catalog`);
    ok(Object.keys(doc.sections).length >= 8, `${p.id}: manual has only ${Object.keys(doc.sections).length} sections`);
  }
});

test('manual headings and registry sections agree in both directions', () => {
  for (const p of plats) {
    const file = `${p.id}.md`;
    const doc = SOURCES[`${p.id}.manual`];
    const md = headingsOf(file).sort();
    const reg = Object.keys(doc.sections).sort();
    eq(md, reg, `${p.id}: headings (docs/manuals/${file}) != registry sections`);
    for (const [k, v] of Object.entries(doc.sections)) {
      ok(typeof v === 'string' && v.length >= 40, `${p.id}#${k}: excerpt too short to cite (${v && v.length})`);
      ok(!/`/.test(v), `${p.id}#${k}: excerpt still carries markdown backticks`);
    }
  }
});

test('the generated registry is exactly what the manuals produce (no stale excerpts)', () => {
  // runs the real builder in check mode — not a reimplementation of its parsing
  execFileSync(process.execPath, [path.join(ROOT, 'fixtures', 'build-manual-sources.js'), '--check'], { stdio: 'pipe' });
});

test('every citation in every workflow resolves to real text, with a manual path when applicable', () => {
  let citations = 0, fromManuals = 0;
  for (const wf of workflows) {
    for (const st of wf.steps) {
      for (const c of st.citations || []) {
        citations++;
        const res = getCitation(c.doc, c.section);
        ok(res && res.excerpt, `${wf.id}/${st.id}: citation ${c.doc}#${c.section} does not resolve`);
        ok(res.excerpt.length >= 40, `${wf.id}/${st.id}: resolved excerpt is not citable`);
        if (res.manual) {
          fromManuals++;
          ok(fs.existsSync(path.join(ROOT, res.manual)), `${wf.id}/${st.id}: manual file ${res.manual} missing`);
        }
      }
    }
  }
  ok(citations >= 200, `expected broad citation coverage, got ${citations}`);
  ok(fromManuals >= 80, `expected the new manuals to be actually cited, got ${fromManuals}`);
  console.log(`    (${citations} citations resolve; ${fromManuals} now point into docs/manuals/)`);
});

test('a platform manual is only cited by its own platform (plus shared doctrine)', () => {
  for (const wf of workflows) {
    for (const st of wf.steps) {
      for (const c of st.citations || []) {
        const m = c.doc.match(/^([a-z]+)\.manual$/);
        if (!m) continue;
        eq(m[1], wf.platform, `${wf.id}/${st.id}: cites ${c.doc}, which belongs to another system`);
      }
    }
  }
});

test('import/export workflows cite the platform manual AND the cross-platform divergence note', () => {
  const bulk = workflows.filter(w => w.category === 'import' || w.category === 'export');
  ok(bulk.length >= 12, `expected every platform covered by bulk-file workflows, got ${bulk.length}`);
  const cited = [];
  for (const wf of bulk) {
    const all = wf.steps.flatMap(s => s.citations || []);
    ok(all.some(c => c.doc === `${wf.platform}.manual`), `${wf.id}: no citation into ${wf.platform}.manual`);
    if (wf.platform !== 'heartland') ok(all.some(c => c.doc === 'signalF.csv-matrix' && c.section === 'menuflow-divergence'),
      `${wf.id}: missing the "this file is not the vendor upload file" citation`);
    cited.push(wf.platform);
  }
  // heartland exports carry the divergence note on the workflow that matters most for it
  const hlExport = bulk.find(w => w.platform === 'heartland');
  ok(hlExport, 'heartland needs a bulk-file workflow too');
  const perPlat = [...new Set(cited)].sort();
  ok(perPlat.length >= 6, `bulk coverage spread across only ${perPlat.length} platforms`);
  console.log(`    (${bulk.length} bulk-file workflows across ${perPlat.length} platforms: ${perPlat.join(', ')})`);
});

test('each platform either has a manual-cited import workflow or documents that no bulk file exists', () => {
  for (const p of plats) {
    const hasImport = workflows.some(w => w.platform === p.id && w.category === 'import');
    const text = fs.readFileSync(path.join(MANUAL_DIR, `${p.id}.md`), 'utf8');
    if (hasImport) {
      ok(p.bulkFile, `${p.id}: imports files but declares no bulkFile identity`);
      ok(/mapping|review format|not a|never/i.test(text), `${p.id}: manual must state the MenuFlow↔vendor mapping`);
    } else {
      ok(/no.{0,80}CSV|no owner-facing file|not accept a CSV/i.test(text),
        `${p.id}: no import workflow, so the manual has to say the platform takes no bulk file`);
      ok(p.capabilities.csvImport !== true, `${p.id}: claims csvImport but has no import workflow`);
    }
  }
});

test('modifier encodings are distinct per platform — the reason the manuals exist', () => {
  const enc = plats.map(p => p.modifierEncoding || '');
  enc.forEach((e, i) => ok(e.length > 40, `${plats[i].id}: modifierEncoding is too thin to be useful`));
  eq(new Set(enc).size, enc.length, 'two platforms share an identical modifier-encoding description');
  // the matrix has to describe all seven, and the grammar traps that bite in practice
  const mx = fs.readFileSync(path.join(MANUAL_DIR, 'csv-matrix.md'), 'utf8');
  for (const p of plats) ok(mx.toLowerCase().includes(p.short.toLowerCase()), `csv-matrix never mentions ${p.short}`);
  for (const sec of ['unit-of-row', 'modifier-encoding', 'yes-no-tokens', 'price-formats',
    'identifier-columns', 'file-shape-constraints', 'reversibility', 'never-round-trips',
    'canonical-mapping', 'menuflow-divergence']) {
    ok(SOURCES['signalF.csv-matrix'].sections[sec], `csv-matrix missing section ${sec}`);
  }
  const table = mx.split('\n').filter(l => /^\| /.test(l) && !/^\|\s*-+/.test(l));
  ok(table.length >= 8, `modifier-encoding table has ${table.length} rows`);
});

test('the dropdown surfaces the file contract, and the UI is wired to show it', () => {
  const api = require('../server/api');
  ok(api, 'api module loads');
  const html = fs.readFileSync(path.join(ROOT, 'web', 'index.html'), 'utf8');
  const app = fs.readFileSync(path.join(ROOT, 'web', 'app.js'), 'utf8');
  ok(html.includes('id="platMeta"'), 'index.html lost the platform fingerprint slot');
  ok(app.includes("$('#platMeta')") && app.includes('bulkFile'), 'app.js no longer renders the bulk-file identity');
  for (const p of plats) {
    ok(p.bulkFile && p.modifierEncoding && p.manual, `${p.id}: dropdown entry missing bulkFile/modifierEncoding/manual`);
  }
});

test('manuals keep the safety doctrine visible where it hurts: irreversibility and no-round-trip', () => {
  const toast = SOURCES['toast.manual'].sections;
  const ls = SOURCES['lightspeed.manual'].sections;
  const tbMd = fs.readFileSync(path.join(MANUAL_DIR, 'touchbistro.md'), 'utf8');
  ok(/not reversible/.test(toast.irreversibility), 'Toast irreversibility must be stated, not softened');
  ok(/cannot be deleted/.test(ls['no-delete-and-no-undo']) && /automatically reversed/.test(ls['no-delete-and-no-undo']),
    'Lightspeed must state both: no delete, no undo');
  // TouchBistro's registry excerpt is the section's lead sentence, so the create-only limits are
  // asserted against the manual body where they are actually written.
  ok(/cannot batch upload updates to existing menu items/i.test(tbMd), 'TouchBistro must document that bulk is create-only');
  ok(/no batch delete/i.test(tbMd), 'TouchBistro must document that there is no batch delete');
  ok(SOURCES['touchbistro.manual'].sections['bulk-upload-new-only'].length > 40, 'and the cited excerpt must still be citable');
  for (const p of plats) {
    ok(/audit-checklist/.test(headingsOf(`${p.id}.md`).join('-')), `${p.id}: manual needs a post-change checklist`);
  }
});

test('the counts the docs quote are the counts the machine reports', () => {
  // Every one of these numbers used to be maintained by hand, twice now. This is the guard.
  const reg = engine.validateAll({});
  const README = fs.readFileSync(path.join(ROOT, 'README.md'), 'utf8');
  const SOURCES_MD = fs.readFileSync(path.join(ROOT, 'docs', 'SOURCES.md'), 'utf8');
  // NOTE: no static test-count claim — several suites generate tests in per-platform loops,
  // so a regex over the sources under-reports what the runner actually executes.
  const sections = Object.values(SOURCES).reduce((n, d) => n + Object.keys(d.sections || {}).length, 0);
  const manualSections = plats.reduce((n, p) => n + Object.keys(SOURCES[`${p.id}.manual`].sections).length, 0)
    + Object.keys(SOURCES['signalF.csv-matrix'].sections).length;

  const claims = [
    [/certify all (\d+) workflows/, reg.totals.workflows, README, 'workflows certified'],
    [/dry-runs all (\d+) workflows/, reg.totals.workflows, README, 'dry-run coverage'],
    [/executes all (\d+) workflows in \*\*apply mode\*\*/, reg.totals.workflows, fs.readFileSync(path.join(ROOT, 'docs', 'ARCHITECTURE.md'), 'utf8'), 'apply-mode coverage'],
    [/(\d+) executable actions/, require('../server/engine/registry').list().length, README, 'skill count'],
    [/(\d+) post-step verification predicates/, Object.keys(require('../server/engine/checks')).length, README, 'predicate count'],
    [/(\d+) indexed documents/, Object.keys(SOURCES).length, README, 'registered doc count'],
    [/(\d+) citable sections/, manualSections, README, 'manual section count'],
    [/carrying (\d+) citable sections between them/, manualSections, SOURCES_MD, 'manual-section total'],
  ];
  for (const [re, expected, hay, label] of claims) {
    if (!hay) continue;
    const m = hay.match(re);
    ok(m, `README/SOURCES no longer states the ${label} in a checkable form`);
    const got = Number(m[1] !== undefined && m[1] !== null ? m[1] : m[2]);
    eq(got, expected, `${label}: docs say ${got}, the machine says ${expected}`);
  }
  // SOURCES.md quotes the registry's size and its status breakdown; both rot silently otherwise
  const tally = {};
  for (const d of Object.values(SOURCES)) tally[d.verified || 'none'] = (tally[d.verified || 'none'] || 0) + 1;
  const srcClaim = SOURCES_MD.match(/(\d+) documents are indexed: (\d+) `official-doc`, (\d+) `client-kb`, (\d+) `legacy-manual`, (\d+) `compiled`[\s\S]*?(\d+) `access-limited`/);
  ok(srcClaim, 'SOURCES.md no longer states its document count and status breakdown in a checkable form');
  const [total, off, kb, leg, comp, acc] = srcClaim.slice(1).map(Number);
  eq(total, Object.keys(SOURCES).length, 'SOURCES.md document count');
  eq([off, kb, leg, comp, acc], [tally['official-doc'], tally['client-kb'], tally['legacy-manual'], tally['compiled'], tally['access-limited']],
    'SOURCES.md verification-status breakdown');
  eq(off + kb + leg + comp + acc, total, 'SOURCES.md statuses do not add up to its own total');

  // SOURCES.md also table-lists each manual's section count — the number the generator owns
  for (const [, file, docId, secs] of SOURCES_MD.matchAll(/^\| `(\w[\w-]*\.md)` \| `([\w.]+)\.manual`? \| (\d+) \|/gm)) {
    const doc = SOURCES[`${docId}.manual`] || SOURCES[docId];
    ok(doc, `SOURCES.md table lists ${file} but no such manual is registered`);
    eq(Number(secs), Object.keys(doc.sections).length, `${file}: section count in SOURCES.md vs the generated registry`);
  }
  eq((SOURCES_MD.match(/^\| `\w+[\w-]*\.md` \|/gm) || []).length, plats.length + 1,
    'SOURCES.md manual table should list all 7 platform manuals plus the csv matrix');

  // the platform table in README is the fastest thing to go stale, so diff it against the engine
  // README may use either the catalog's full name or its short label — both are checked against
  // the same authoritative list, so an invented platform name still fails the count assertion.
  const byName = new Map(plats.flatMap(p => [[p.name, p.id], [p.short, p.id]]));
  const rows = [...README.matchAll(/^\|\s*(.+?)\s*\|\s*(\d+)\s*\|/gm)];
  let checked = 0;
  for (const [, name, count] of rows) {
    const id = byName.get(name);
    if (!id) continue;
    eq(Number(count), reg.platforms[id].verified, `README table: ${name} says ${count} workflows, engine verified ${reg.platforms[id].verified}`);
    eq(reg.platforms[id].workflows, Number(count), `README table: ${name} workflow count vs loaded count`);
    checked++;
  }
  eq(checked, plats.length, `README platform table covers ${checked} of ${plats.length} platforms`);
  ok(manualSections >= 100, `manuals shrank to ${manualSections} sections`);
});

report();

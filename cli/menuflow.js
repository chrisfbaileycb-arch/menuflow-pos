#!/usr/bin/env node
/**
 * cli/menuflow.js — headless control of the exact same engine the web UI uses.
 *
 * USAGE
 *   node cli/menuflow.js platforms
 *   node cli/menuflow.js workflows [--platform heartland] [--json]
 *   node cli/menuflow.js show <platform> <workflow-id>
 *   node cli/menuflow.js verify [--json]
 *   node cli/menuflow.js run  <platform> <workflow-id> [--apply] [--input k=v ...] [--approve step ...] [--location id]
 *   node cli/menuflow.js menu [--location id] [--which live|staging]
 *   node cli/menuflow.js audit [--location id] [--md]
 *   node cli/menuflow.js quick <skill> [--arg k=v ...] [--location id]
 *   node cli/menuflow.js import <file> [--format auto|square-csv|clover-csv|lightspeed-csv|toast-csv|touchbistro-csv|canonical-json] [--mode modify|replace]
 *   node cli/menuflow.js export [--format canonical-json|square-csv|clover-csv|lightspeed-csv|toast-csv|touchbistro-csv|heartland-json] [--scope live|staging|workflows|project]
 *   node cli/menuflow.js publish [--yes] | discard
 *   node cli/menuflow.js skills
 */
const store = require('../server/store');
const engine = require('../server/engine/engine');
const REG = require('../server/engine/registry');
const Audit = require('../server/engine/audit');
const IE = require('../server/importexport');
const PLATFORMS = require('../server/platforms');
const M = require('../server/engine/menu');

const argv = process.argv.slice(2);
const flags = {};
const positionals = [];
const VALUE_FLAGS = new Set(['platform', 'location', 'format', 'mode', 'which', 'scope', 'actor', 'input', 'arg', 'approve']);
for (let i = 0; i < argv.length; i++) {
  const a = argv[i];
  if (a.startsWith('--')) {
    const k = a.slice(2);
    if (VALUE_FLAGS.has(k)) {
      flags[k] = flags[k] || [];
      while (argv[i + 1] && !argv[i + 1].startsWith('--')) flags[k].push(argv[++i]);
      if (['input', 'arg', 'approve'].includes(k)) continue;
      flags[k] = flags[k][0];
    } else flags[k] = true;
  } else positionals.push(a);
}
const kv = (list) => {
  const o = {};
  for (const pair of list || []) {
    const idx = pair.indexOf('=');
    if (idx < 0) continue;
    const k = pair.slice(0, idx), raw = pair.slice(idx + 1);
    if (raw.includes(',')) o[k] = raw.split(',').map(x => x.trim()).filter(Boolean).map(x => /^-?\d+(\.\d+)?$/.test(x) ? Number(x) : x);
    else o[k] = /^-?\d+(\.\d+)?$/.test(raw) ? Number(raw) : raw;
  }
  return o;
};
const pick = (list, sep = ', ') => (list.length > 1 ? list : list[0] === undefined ? undefined : String(list[0]).split(sep).map(x => x.trim()).filter(Boolean));

function locId() {
  const s = store.get();
  if (flags.location) return flags.location;
  const plat = flags.platform;
  return (plat && (s.locations.find(l => l.platform === plat) || {}).id) || s.locations[0].id;
}

const cmd = positionals[0];
const out = (x) => console.log(typeof x === 'string' ? x : JSON.stringify(x, null, 2));

switch (cmd) {
  case 'platforms': {
    const counts = {};
    for (const wf of engine.listWorkflows()) counts[wf.platform] = (counts[wf.platform] || 0) + 1;
    out(PLATFORMS.list().map(p => `${p.id.padEnd(12)} ${p.name.padEnd(34)} ${String(counts[p.id] || 0).padStart(2)} workflows · portal: ${p.portal}`));
    break;
  }
  case 'workflows': {
    const wfs = engine.listWorkflows(flags.platform);
    if (flags.json) return out(wfs.map(({ __file, ...w }) => w));
    out(wfs.map(w => `${w.platform.padEnd(11)} ${w.id.padEnd(34)} [${w.risk.padEnd(6)}] ${w.title}`));
    out(`\n${wfs.length} workflows · engine-verified: run \`menuflow.js verify\``);
    break;
  }
  case 'show': {
    const wf = engine.getWorkflow(positionals[1], positionals[2]);
    const { SOURCES, getCitation } = require('../server/sources');
    void SOURCES;
    for (const [i, st] of wf.steps.entries()) {
      const tag = st.kind === 'auto' ? `⟐ ${st.skill}` : st.kind === 'gate' ? '⛔ CLIENT GATE' : '✎ manual';
      console.log(`Step ${i + 1} [${tag}] ${st.title}`);
      if (st.instructions) console.log(`    ${st.instructions}`);
      for (const c of st.citations || []) {
        const cite = getCitation(c.doc, c.section);
        console.log(`    📖 ${c.doc} § ${c.section}${cite ? ` — “${String(cite.excerpt).slice(0, 110)}…”` : ' (MISSING SOURCE)'}  [${cite?.verified}]`);
      }
      if (st.checks?.length) console.log(`    ✓ checks: ${st.checks.map(c => c.check).join(', ')}`);
    }
    const v = engine.validateWorkflow(wf, { docPrefixes: PLATFORMS[wf.platform].docPrefixes });
    console.log(`\nvalidation: ${v.ok ? 'VERIFIED ✓' : 'FAILURES → ' + v.errors.join('; ')}`);
    break;
  }
  case 'verify': {
    const report = engine.validateAll({});
    if (flags.json) return out(report);
    const s = store.load();
    let execOk = 0, execBad = [];
    const locFor = (platform) => (s.locations.find(l => l.platform === platform) || s.locations[0]);
    for (const wf of engine.listWorkflows()) {
      const inputs = {};
      for (const inp of wf.inputs || []) {
        const ex = inp.example;
        if (ex === undefined) continue;
        if (inp.type === 'number') inputs[inp.name] = parseInt(String(ex), 10) || 0;
        else if (inp.type === 'money') inputs[inp.name] = String(ex).match(/[\d.]+/)?.[0] || '0';
        else if (inp.type === 'string[]') inputs[inp.name] = String(ex).split(',').map(s => s.trim()).filter(Boolean);
        else if (inp.type === 'number[]') inputs[inp.name] = String(ex).replace(/[^0-9,]/g, '').split(',').filter(x => x !== '').map(Number);
        else inputs[inp.name] = String(ex).match(/[\w.'-]+\.(csv|json|xlsx|txt|md)\b/i)?.[0] || String(ex).split(/\s+—\s+|\s+\(/)[0].trim();
      }
      try {
        const run = engine.run({ platform: wf.platform, workflowId: wf.id, locationId: locFor(wf.platform).id, mode: 'dry', inputs, approvals: wf.steps.filter(s => s.kind === 'gate').map(s => s.id), actor: 'cli-verify' });
        if (run.status === 'ok') execOk++; else execBad.push(`${wf.platform}/${wf.id} → ${run.status} @ ${run.stoppedAt}`);
      } catch (e) { execBad.push(`${wf.platform}/${wf.id} → exception: ${e.message}`); }
    }
    out([
      `workflows: ${report.totals.workflows} · schema errors: ${report.totals.errors}`,
      `steps: ${report.totals.auto} auto / ${report.totals.manual} manual / ${report.totals.gates} gates`,
      `owner's-manual citations: ${report.totals.citations} (all resolve: ${report.totals.errors === 0})`,
      `skills: ${report.skills} · docs indexed: ${report.docs} · checks: ${report.totals.checks}`,
      `dry-run executions: ${execOk} clean` + (execBad.length ? ` | failures:\n  ${execBad.join('\n  ')}` : ''),
      report.ok && !execBad.length ? 'RESULT: PASS' : 'RESULT: FAIL',
    ].join('\n'));
    process.exit(report.ok && !execBad.length ? 0 : 1);
  }
  case 'run': {
    const [platform, id] = positionals.slice(1);
    const wf = engine.getWorkflow(platform, id);
    const inputs = Object.assign({}, kv(flags.input));
    for (const inp of wf.inputs || []) {
      if (inputs[inp.name] !== undefined && typeof inputs[inp.name] === 'string' && inputs[inp.name].includes(',')) inputs[inp.name] = pick([inputs[inp.name]]);
      if (inputs[inp.name] === undefined && inp.required) { console.error(`--input ${inp.name}=… is required (${inp.type}). Example: ${inp.example}`); process.exit(2); }
    }
    const run = engine.run({ platform, workflowId: id, locationId: locId(), mode: flags.apply ? 'apply' : 'dry', inputs, approvals: flags.approve || [], actor: flags.actor || process.env.USER || 'cli' });
    for (const st of run.steps) console.log(`  [${st.status.padEnd(18)}] ${st.id} — ${st.message}`.slice(0, 240));
    console.log(`\nrun ${run.id} · ${run.mode} · ${run.status}` + (run.committedToStaging ? ' · workbench staged (menuflow publish to apply live)' : ''));
    process.exit(run.status === 'ok' ? 0 : run.status === 'awaiting_approval' || run.status === 'awaiting_ack' ? 3 : 1);
  }
  case 'menu': {
    const menu = store.menuFor(locId(), flags.which === 'staging' ? 'staging' : 'live');
    const g = new Map(menu.modifierGroups.map(x => [x.id, x.name]));
    out(menu.items.map(i => `${i.archived ? '✗' : i.unavailable ? '8' : '·'} ${i.name.padEnd(28)} ${(i.category || '').padEnd(12)} ${String(M.displayMoney(i.price)).padStart(8)}  groups:[${(i.modifierGroups || []).map(x => g.get(x)).join('|')}]`));
    break;
  }
  case 'audit': {
    const menu = store.menuFor(locId(), 'live');
    const report = Audit.fullAudit(menu);
    if (flags.md) return console.log(Audit.renderAuditMarkdown(report));
    out({ summary: report.summary, sections: Object.fromEntries(report.sections.map(s => [s.key, s.findings.length])) });
    break;
  }
  case 'quick': {
    const skill = positionals[1];
    if (!REG.has(skill)) { console.error(`unknown skill: ${skill}`); process.exit(2); }
    const entry = store.liveMenu(locId());
    const workbench = store.clone(entry.staging || entry.live);
    const loc = store.get().locations.find(l => l.id === locId());
    const r = REG.get(skill).handler({ store, runId: 'cli', mode: 'apply', actor: 'cli', location: loc, platform: loc.platform, baselineMenu: workbench }, kv(flags.arg), workbench);
    if (r.blocked) { console.error('BLOCKED: ' + r.message); process.exit(3); }
    entry.staging = workbench; entry.stagingNote = `cli quick ${skill}`;
    store.flush();
    out(r.message + (r.notes?.length ? `\nnotes: ${r.notes.join(' | ')}` : '') + '\n(staged — publish to apply)');
    break;
  }
  case 'import': {
    const file = positionals[1];
    const entry = store.liveMenu(locId());
    const workbench = flags.live ? store.clone(entry.live) : store.clone(entry.staging || entry.live);
    const r = IE.importFile(file, { format: flags.format || 'auto', platform: store.get().locations.find(l => l.id === locId()).platform, menu: workbench, mode: flags.mode || 'modify' });
    if (!flags.dry) { entry.staging = workbench; entry.stagingNote = `cli import ${file}`; store.flush(); }
    out({ ...r, note: flags.dry ? '(--dry: nothing staged)' : 'staged on workbench' });
    break;
  }
  case 'export': {
    const s = store.get();
    const loc = s.locations.find(l => l.id === locId());
    if (flags.scope === 'workflows') return out(IE.exportWorkflows(loc.platform));
    if (flags.scope === 'project') return out(IE.exportProject());
    const menu = store.menuFor(loc.id, flags.scope === 'staging' ? 'staging' : 'live');
    const r = IE.exportMenu(menu, flags.format || 'canonical-json', loc.platform);
    out({ filename: r.filename, path: r.path, bytes: r.bytes });
    break;
  }
  case 'publish': {
    const entry = store.liveMenu(locId());
    if (!entry.staging) { console.error('nothing staged'); process.exit(2); }
    const report = Audit.fullAudit(entry.staging);
    const BLOCK = new Set(['EMPTY_MODIFIER_GROUP', 'MIDNIGHT_RULE_VIOLATION', 'RUSH_HOLD_CONFLICT', 'DEAD_FORCE_PRICE_RULE', 'MODIFIER_RECORD_SPANS_CATEGORIES', 'SHADOW_EMPTY']);
    const blockers = report.sections.flatMap(x => x.findings).filter(f => f.severity === 'HIGH' && BLOCK.has(f.type));
    if (blockers.length && !flags.yes) { console.error(`BLOCKED by ${blockers.length} integrity findings (use --yes to override; each override is recorded).`); process.exit(3); }
    IE.exportMenu(entry.live, 'canonical-json', store.get().locations.find(l => l.id === locId()).platform); // pre-publish backup
    const menu = store.commitStaging(locId(), `cli publish by ${process.env.USER || 'cli'}${blockers.length ? ' (OVERRIDE)' : ''}`);
    out(`published v${menu.version} to live (${blockers.length} overridden)`);
    break;
  }
  case 'discard':
    store.discardStaging(locId()); out('staging discarded'); break;
  case 'skills':
    out(REG.list().map(s => `${s.name.padEnd(34)} ${s.destructive ? '[destructive] ' : ''}${s.title}`)); break;
  default:
    console.log(require('fs').readFileSync(__filename, 'utf8').match(/\/\*\*\n \* USAGE\n([\s\S]*?)\*\//)[1].replace(/^ \* ?/gm, ''));
}

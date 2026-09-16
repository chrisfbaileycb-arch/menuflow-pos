/**
 * engine.js — workflow loader, static verifier, and transactional executor.
 *
 * Guarantees enforced here (the "not just a pretty front end" contract):
 *  - every `auto` step maps to a real handler in the skill registry
 *  - every `manual` step carries instructions + a citation that resolves in
 *    sources.js to a REAL manual/help section (owner's manual traceability)
 *  - destructive/high-risk workflows are rejected unless they include a gate
 *  - steps run against an isolated workbench; `checks` must pass or the run
 *    fails and nothing is committed
 *  - apply-mode results are committed to STAGING only; live changes require an
 *    explicit publish (audit-before-action doctrine)
 */
const fs = require('fs');
const path = require('path');
const store = require('../store');
const { SOURCES, hasCitation, getCitation } = require('../sources');
const REG = require('./registry');
const CHECKS = require('./checks');
const M = require('./menu');
const WORKFLOW_DIR = path.join(__dirname, '..', 'workflows');

// ───────────────────────── loading ─────────────────────────
function listWorkflows(platform) {
  const out = [];
  if (!fs.existsSync(WORKFLOW_DIR)) return out;
  for (const platDir of fs.readdirSync(WORKFLOW_DIR)) {
    if (platform && platDir !== platform) continue;
    const abs = path.join(WORKFLOW_DIR, platDir);
    if (!fs.statSync(abs).isDirectory()) continue;
    for (const f of fs.readdirSync(abs)) {
      if (!f.endsWith('.json')) continue;
      const wf = JSON.parse(fs.readFileSync(path.join(abs, f), 'utf8'));
      wf.__file = `workflows/${platDir}/${f}`;
      out.push(wf);
    }
  }
  return out.sort((a, b) => a.platform.localeCompare(b.platform) || a.category.localeCompare(b.category) || a.id.localeCompare(b.id));
}

function getWorkflow(platform, id) {
  const all = listWorkflows(platform);
  const wf = all.find(w => w.id === id);
  if (!wf) throw Object.assign(new Error(`Workflow not found: ${platform}/${id}`), { code: 'EWF' });
  return wf;
}

// ───────────────────────── template args ─────────────────────────
function resolveValue(v, inputs) {
  if (typeof v === 'string') {
    const whole = v.match(/^\{([a-zA-Z0-9_.]+)\}$/);
    if (whole) return inputs[whole[1]];
    return v.replace(/\{([a-zA-Z0-9_.]+)\}/g, (m, k) => (k in inputs ? String(inputs[k]) : m));
  }
  if (Array.isArray(v)) return v.map(x => resolveValue(x, inputs));
  if (v && typeof v === 'object') {
    const o = {};
    for (const [k, val] of Object.entries(v)) o[k] = resolveValue(val, inputs);
    return o;
  }
  return v;
}

function tokenErrors(v, declaredInputs) {
  const errs = [];
  const walk = (x) => {
    if (typeof x === 'string') {
      for (const m of x.matchAll(/\{([a-zA-Z0-9_.]+)\}/g)) {
        if (!declaredInputs.includes(m[1])) errs.push(`args reference undeclared input "{${m[1]}}"`);
      }
    } else if (Array.isArray(x)) x.forEach(walk);
    else if (x && typeof x === 'object') Object.values(x).forEach(walk);
  };
  walk(v);
  return errs;
}

// ───────────────────────── validation ─────────────────────────
function validateWorkflow(wf, opts = {}) {
  const errors = [];
  const warnings = [];
  const err = (s) => errors.push(s);
  const warn = (s) => warnings.push(s);
  const plat = opts.platform || wf.platform;
  const docPrefixes = opts.docPrefixes || null;
  const declared = (wf.inputs || []).map(i => i.name);

  if (!wf.id) err('missing id');
  if (wf.__file && wf.__file.endsWith(`${wf.id}.json`) === false) err(`id "${wf.id}" must match filename`);
  if (wf.platform !== plat) err(`platform field "${wf.platform}" != folder "${plat}"`);
  if (!wf.title) err('missing title');
  if (!wf.summary) err('missing summary');
  if (!wf.category) err('missing category');
  if (!['low', 'medium', 'high'].includes(wf.risk)) err(`risk must be low|medium|high (got "${wf.risk}")`);
  if (!Array.isArray(wf.steps) || !wf.steps.length) err('steps must be a non-empty array');
  for (const inp of wf.inputs || []) {
    if (!inp.name || !inp.type) err(`input missing name/type: ${JSON.stringify(inp)}`);
  }

  const seenStepIds = new Set();
  let usesDestructive = false;
  let hasGate = false;
  const stepIds = new Set();

  for (const [i, st] of (wf.steps || []).entries()) {
    const sid = st.id || `step${i + 1}`;
    if (seenStepIds.has(sid)) err(`duplicate step id "${sid}"`);
    seenStepIds.add(sid);
    stepIds.add(sid);
    if (!st.title) err(`step ${sid}: missing title`);
    if (!['auto', 'manual', 'gate'].includes(st.kind)) err(`step ${sid}: kind must be auto|manual|gate`);

    for (const c of st.citations || []) {
      if (!hasCitation(c.doc, c.section)) err(`step ${sid}: citation ${c.doc}#${c.section} not found in sources registry`);
      else if (docPrefixes && !docPrefixes.some(p => c.doc.startsWith(p))) err(`step ${sid}: citation ${c.doc} is not a manual of platform "${plat}" (allowed: ${docPrefixes.join(', ')})`);
    }

    if (st.kind === 'auto') {
      if (!st.skill) err(`step ${sid}: auto step must name a skill`);
      else if (!REG.has(st.skill)) err(`step ${sid}: unknown skill "${st.skill}" — actions must be implemented, not decorative`);
      else {
        const skill = REG.get(st.skill);
        if (skill.destructive) usesDestructive = true;
        const provided = Object.keys(st.args || {});
        for (const p of skill.params || []) {
          if (p.required && !provided.includes(p.name) && !declared.includes(p.name)) {
            err(`step ${sid}: skill ${st.skill} requires param "${p.name}"`);
          }
        }
      }
      const te = tokenErrors(st.args || {}, declared);
      te.forEach(x => err(`step ${sid}: ${x}`));
    }
    if (st.kind === 'manual') {
      if (!st.instructions) err(`step ${sid}: manual steps must carry operator instructions`);
      if (!(st.citations && st.citations.length)) err(`step ${sid}: manual steps must cite the owner's manual (doc + section)`);
    }
    if (st.kind === 'gate') {
      hasGate = true;
      if (!st.instructions && !st.title) err(`step ${sid}: gate needs a title/instructions`);
    }
    for (const chk of st.checks || []) {
      if (!CHECKS[chk.check]) err(`step ${sid}: unknown check "${chk.check}"`);
      const ce = tokenErrors(chk.args || {}, declared);
      ce.forEach(x => err(`step ${sid} check ${chk.check}: ${x}`));
    }
  }

  if ((wf.risk === 'high' || usesDestructive) && !hasGate) {
    err(`high-risk/destructive workflow must include a "gate" step (audit-before-action doctrine)`);
  }
  return { ok: errors.length === 0, errors, warnings, verified: Boolean(opts.platform) && errors.length === 0 };
}

// ───────────────────────── execution ─────────────────────────
/**
 * run({platform, workflowId, locationId, mode, inputs, approvals, actor})
 *  - mode 'dry': throwaway clone; nothing persisted except the run record.
 *  - mode 'apply': workbench committed to STAGING on full success.
 *  - gates/acks: if an approval for that step isn't in `approvals`, execution
 *    pauses there and the run returns status awaiting_approval / awaiting_ack.
 */
/**
 * A list-typed skill param can arrive as a single string from a workflow input, a CLI `--input`,
 * or the UI's comma-separated field. Splitting at this boundary is deliberate: `for (const ref of
 * 'Hamburger; Cheeseburger')` would otherwise iterate characters, and the step would read as a soft
 * no-op instead of the broken contract it is.
 */
function coerceListArgs(skill, args) {
  if (!skill || !skill.params || !args) return args;
  for (const p of skill.params) {
    const v = args[p.name];
    if (typeof v !== 'string') continue;
    if (p.type === 'string[]') args[p.name] = v.split(/[,;]/).map(x => x.trim()).filter(Boolean);
    else if (p.type === 'number[]') args[p.name] = v.split(/[,;]/).map(x => parseFloat(x.trim())).filter(n => Number.isFinite(n));
  }
  return args;
}

function run(opts) {
  const { platform, workflowId, locationId, mode = 'dry', inputs = {}, approvals = [], actor = 'operator' } = opts;
  const wf = getWorkflow(platform, workflowId);
  const s = store.get();
  const location = s.locations.find(l => l.id === locationId);
  if (!location) throw Object.assign(new Error(`Unknown location ${locationId}`), { code: 'ELOC' });
  const entry = store.liveMenu(locationId);

  const approvedSet = new Set(approvals.map(a => typeof a === 'string' ? a : a.stepId));
  const runId = store.newId('run');
  const startedAt = new Date().toISOString();

  // Work from the current workbench (staging if present, else live).
  const workbench = store.clone(entry.staging || entry.live);
  const ctx = {
    store, runId, mode, actor, location, platform,
    baselineMenu: store.clone(workbench), // snapshot BEFORE any step mutates it
    inputs,
  };

  // pre-validate inputs (required + coercion)
  const resolvedInputs = {};
  for (const inp of wf.inputs || []) {
    if (inputs[inp.name] !== undefined) resolvedInputs[inp.name] = inputs[inp.name];
    else if (inp.required) throw Object.assign(new Error(`Missing required input "${inp.name}" (${inp.description || inp.example || inp.type})`), { code: 'EINPUT' });
  }
  for (const k of Object.keys(inputs)) {
    if (!(wf.inputs || []).some(i => i.name === k)) throw Object.assign(new Error(`Unknown input "${k}" — declared: ${(wf.inputs || []).map(i => i.name).join(', ') || 'none'}`), { code: 'EINPUT' });
  }

  const results = [];
  let status = 'ok';
  let stoppedAt = null;

  for (const st of wf.steps) {
    const sid = st.id;
    const rec = { id: sid, title: st.title, kind: st.kind, status: 'ok', message: '', diff: null, findings: [], notes: [] };
    try {
      if (st.kind === 'gate') {
        if (!approvedSet.has(sid)) {
          rec.status = 'awaiting_approval';
          rec.message = st.instructions || 'Client sign-off required before this step may proceed.';
          results.push(rec);
          status = 'awaiting_approval';
          stoppedAt = sid;
          break;
        }
        rec.status = 'approved';
        rec.message = `Gate approved (actor: ${actor})${st.evidence ? ` — evidence: ${st.evidence}` : ''}`;
      } else if (st.kind === 'manual') {
        // Operator task card. In a real engagement the operator performs it in
        // the vendor portal; the engine verifies intent against the workbench.
        let verified = false;
        let detail = 'instruction delivered to operator';
        for (const chk of st.checks || []) {
          const { pass, detail: d } = CHECKS[chk.check].fn(workbench, resolveValue(chk.args || {}, resolvedInputs), ctx);
          if (pass) { verified = true; detail = d; } else { detail = d; verified = false; break; }
        }
        if (!verified && (!st.checks || st.checks.length === 0)) {
          if (mode === 'apply' && !approvedSet.has(sid)) {
            rec.status = 'awaiting_ack';
            rec.message = `ACK required — ${st.instructions}`;
            results.push(rec);
            status = 'awaiting_ack';
            stoppedAt = sid;
            break;
          }
          verified = true;
        }
        if (!verified && st.fatal === false) {
          rec.status = 'soft-warning';
          rec.message = `${st.instructions} [verify deferred: ${detail}]`;
          results.push(rec);
          continue;
        }
        rec.status = verified ? 'verified' : 'failed';
        rec.message = `${st.instructions} [verify: ${detail}]`;
        rec.citations = (st.citations || []).map(c => getCitation(c.doc, c.section));
        if (!verified) { status = 'failed'; stoppedAt = sid; results.push(rec); break; }
      } else {
        // auto
        const skill = REG.get(st.skill);
        const args = coerceListArgs(skill, resolveValue(st.args || {}, resolvedInputs));
        let r;
        try {
          r = skill.handler(ctx, args, workbench);
        } catch (e) {
          if (st.fatal === false) {
            rec.status = 'soft-warning';
            rec.message = `Skipped (soft): ${e.message}`;
            results.push(rec);
            continue;
          }
          throw e;
        }
        rec.message = r.message;
        rec.diff = r.diff || null;
        rec.findings = r.findings || [];
        rec.notes = r.notes || [];
        if (r.blocked) { rec.status = 'blocked'; status = 'blocked'; stoppedAt = sid; results.push(rec); break; }
        // ok field on result can veto (e.g. audit.verify_fix regression)
        if (r.ok === false) { rec.status = 'failed'; status = 'failed'; stoppedAt = sid; results.push(rec); break; }
        // post-step checks
        for (const chk of st.checks || []) {
          const { pass, detail } = CHECKS[chk.check].fn(workbench, resolveValue(chk.args || {}, resolvedInputs), ctx);
          rec.checks = rec.checks || [];
          rec.checks.push({ check: chk.check, pass, detail });
          if (!pass && st.fatal !== false) {
            rec.status = 'failed';
            rec.message += ` — CHECK FAILED (${chk.check}): ${detail}`;
            status = 'failed';
            stoppedAt = sid;
            break;
          }
        }
        if (status === 'failed') { results.push(rec); break; }
      }
    } catch (e) {
      rec.status = 'failed';
      rec.message = `Exception: ${e.message}`;
      rec.error = e.message;
      status = 'failed';
      stoppedAt = sid;
    }
    results.push(rec);
  }

  // success in apply mode → commit workbench to staging (live untouched until publish)
  if (status === 'ok' && mode === 'apply') {
    if (ctx.__publishedInRun) {
      entry.staging = null; // run published through its own gated publish step
      entry.stagingNote = null;
    } else {
      entry.staging = workbench;
      entry.stagingNote = `workbench from run ${runId} (${platform}/${workflowId}) by ${actor}`;
    }
    store.flush();
  }

  const run = {
    id: runId,
    workflowId, platform, locationId, mode, actor,
    inputs: resolvedInputs,
    status,
    stoppedAt,
    startedAt,
    steps: results,
    summary: {
      total: wf.steps.length,
      ok: results.filter(r => ['ok', 'verified', 'approved'].includes(r.status)).length,
      findings: results.reduce((n, r) => n + (r.findings ? r.findings.length : 0), 0),
      title: wf.title,
    },
    workflowRisk: wf.risk,
    committedToStaging: status === 'ok' && mode === 'apply',
  };
  if (mode !== 'dry') store.recordRun(run);
  else { store.recordRun(run); run.dryRun = true; }
  return run;
}

function validateAll(opts = {}) {
  const platforms = require('../platforms');
  const report = { ok: true, verifiedAt: new Date().toISOString(), platforms: {}, totals: { workflows: 0, steps: 0, auto: 0, manual: 0, gates: 0, citations: 0, checks: 0, errors: 0 } };
  const all = listWorkflows();
  for (const wf of all) {
    const plat = platforms[wf.platform];
    if (!plat) { report.ok = false; report.platforms[wf.platform] = { error: 'unknown platform' }; continue; }
    const v = validateWorkflow(wf, { docPrefixes: plat.docPrefixes });
    // Bulk-file workflows carry an extra obligation: they must cite the platform manual that
    // defines the format they parse or emit. Without it, an operator diffing a MenuFlow CSV
    // against the vendor's real upload file has no documented basis for the difference.
    const extra = [];
    if ((wf.category === 'import' || wf.category === 'export') && SOURCES[`${wf.platform}.manual`]) {
      const cited = (wf.steps || []).some(s => (s.citations || []).some(ci => ci.doc === `${wf.platform}.manual`));
      if (!cited) extra.push(`${wf.id}: ${wf.category} workflow must cite ${wf.platform}.manual so its file format stays traceable to the owner's manual`);
    }
    const errors = v.errors.concat(extra);
    const p = (report.platforms[wf.platform] = report.platforms[wf.platform] || { workflows: 0, verified: 0, failures: [] });
    p.workflows++;
    if (errors.length === 0) p.verified++; else { p.failures.push({ id: wf.id, errors }); report.ok = false; report.totals.errors += errors.length; }
    report.totals.workflows++;
    report.totals.steps += wf.steps.length;
    report.totals.auto += wf.steps.filter(s => s.kind === 'auto').length;
    report.totals.manual += wf.steps.filter(s => s.kind === 'manual').length;
    report.totals.gates += wf.steps.filter(s => s.kind === 'gate').length;
    report.totals.citations += wf.steps.reduce((n, s) => n + (s.citations || []).length, 0);
    report.totals.checks += wf.steps.reduce((n, s) => n + (s.checks || []).length, 0);
  }
  report.skills = REG.list().length;
  report.docs = Object.keys(SOURCES).length;
  return report;
}

module.exports = { listWorkflows, getWorkflow, validateWorkflow, validateAll, run, WORKFLOW_DIR };

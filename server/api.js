/**
 * api.js — REST layer. The web UI and CLI talk to exactly these routes,
 * so everything visible in the frontend is genuinely backed by the engine.
 */
const fs = require('fs');
const path = require('path');
const store = require('./store');
const engine = require('./engine/engine');
const REG = require('./engine/registry');
const CHECKS = require('./engine/checks');
const { SOURCES } = require('./sources');
const PLATFORMS = require('./platforms');
const IE = require('./importexport');
const Audit = require('./engine/audit');
const M = require('./engine/menu');

function json(res, code, obj) {
  const body = JSON.stringify(obj);
  res.writeHead(code, { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body) });
  res.end(body);
}
function readBody(req) {
  return new Promise((resolve, reject) => {
    let data = '';
    req.on('data', (c) => { data += c; if (data.length > 25 * 1024 * 1024) reject(new Error('body too large')); });
    req.on('end', () => { try { resolve(data ? JSON.parse(data) : {}); } catch (e) { reject(e); } });
  });
}

function resolveWfDetail(wf) {
  const detail = JSON.parse(JSON.stringify(wf));
  const plat = PLATFORMS[wf.platform];
  detail.validation = engine.validateWorkflow(wf, { docPrefixes: plat.docPrefixes });
  detail.steps = detail.steps.map(st => ({
    ...st,
    citations: (st.citations || []).map(ct => ({ ...ct, ...(require('./sources').getCitation(ct.doc, ct.section) || {}) })),
    skillTitle: st.skill ? REG.get(st.skill)?.title : undefined,
    checkTitles: (st.checks || []).map(ch => CHECKS[ch.check]?.title).filter(Boolean),
  }));
  delete detail.__file;
  return detail;
}

async function handle(req, res, url) {
  const p = url.pathname;
  const s = store.load();

  // ── catalog ──
  if (p === '/api/health' && req.method === 'GET') return json(res, 200, { ok: true, app: 'menuflow-pos', mode: s.settings.mode, time: new Date().toISOString() });
  if (p === '/api/platforms' && req.method === 'GET') {
    const counts = {};
    for (const wf of engine.listWorkflows()) counts[wf.platform] = (counts[wf.platform] || 0) + 1;
    return json(res, 200, {
      platforms: PLATFORMS.list().map(pl => ({ ...pl, workflowCount: counts[pl.id] || 0 })),
    });
  }
  if (p === '/api/skills' && req.method === 'GET') return json(res, 200, { skills: REG.list(), checks: Object.entries(CHECKS).map(([k, v]) => ({ name: k, title: v.title })) });
  if (p === '/api/sources' && req.method === 'GET') return json(res, 200, { sources: SOURCES });
  if (p === '/api/verify' && req.method === 'GET') return json(res, 200, engine.validateAll({}));

  // ── overview / locations / menu ──
  if (p === '/api/overview' && req.method === 'GET') {
    return json(res, 200, {
      org: s.organizations[0] || null,
      locations: s.locations.map(l => {
        const entry = s.menus[l.id] || {};
        const live = entry.live;
        const audit = live ? Audit.fullAudit(live) : null;
        return {
          id: l.id, name: l.name, platform: l.platform,
          items: live ? live.items.filter(i => !i.archived).length : 0,
          groups: live ? live.modifierGroups.length : 0,
          channels: live ? live.channels.length : 0,
          version: live ? live.version : 0,
          hasStaging: Boolean(entry.staging),
          stagingNote: entry.stagingNote || null,
          publishedAt: live?.publishedAt || null,
          findings: audit ? { HIGH: audit.summary.high, MEDIUM: audit.summary.medium, LOW: audit.summary.low } : null,
          shadow: live?.shadowBuild ? live.shadowBuild.status : null,
        };
      }),
      runsCount: s.runs.length,
    });
  }
  if (p === '/api/menu' && req.method === 'GET') {
    const locId = url.searchParams.get('location') || s.locations[0]?.id;
    const which = url.searchParams.get('which') || 'auto';
    const entry = store.liveMenu(locId);
    const useWhich = which === 'auto' ? (entry.staging ? 'staging' : 'live') : which;
    const menu = useWhich === 'staging' && entry.staging ? entry.staging : entry.live;
    const out = JSON.parse(JSON.stringify(menu));
    out.__source = useWhich;
    return json(res, 200, { location: locId, menu: out });
  }

  // ── workflows ──
  if (p === '/api/workflows' && req.method === 'GET') {
    const plat = url.searchParams.get('platform') || undefined;
    const wfs = engine.listWorkflows(plat).map(w => {
      const { steps, inputs, ...meta } = w;
      delete meta.__file;
      return { ...meta, stepsTotal: steps.length, autoSteps: steps.filter(x => x.kind === 'auto').length, manualSteps: steps.filter(x => x.kind === 'manual').length, gates: steps.filter(x => x.kind === 'gate').length, citations: steps.reduce((n, x) => n + (x.citations || []).length, 0) };
    });
    return json(res, 200, { workflows: wfs });
  }
  let m = p.match(/^\/api\/workflows\/([\w-]+)\/([\w.-]+)$/);
  if (m && req.method === 'GET') {
    try { return json(res, 200, { workflow: resolveWfDetail(engine.getWorkflow(m[1], m[2])) }); }
    catch (e) { return json(res, 404, { error: e.message }); }
  }
  m = p.match(/^\/api\/workflows\/([\w-]+)\/([\w.-]+)\/validate$/);
  if (m && req.method === 'POST') {
    const wf = engine.getWorkflow(m[1], m[2]);
    return json(res, 200, engine.validateWorkflow(wf, { docPrefixes: PLATFORMS[m[1]].docPrefixes }));
  }
  m = p.match(/^\/api\/workflows\/([\w-]+)\/([\w.-]+)\/run$/);
  if (m && req.method === 'POST') {
    const body = await readBody(req);
    try {
      const run = engine.run({
        platform: m[1], workflowId: m[2],
        locationId: body.location || s.locations[0].id,
        mode: body.mode === 'apply' ? 'apply' : 'dry',
        inputs: body.inputs || {},
        approvals: body.approvals || [],
        actor: body.actor || 'web-operator',
      });
      return json(res, 200, { run });
    } catch (e) { return json(res, 400, { error: e.message, code: e.code }); }
  }

  // ── runs & approvals ──
  if (p === '/api/runs' && req.method === 'GET') {
    const loc = url.searchParams.get('location');
    const runs = s.runs.filter(r => !loc || r.locationId === loc).slice(0, 60)
      .map(r => ({ id: r.id, workflowId: r.workflowId, platform: r.platform, locationId: r.locationId, mode: r.mode, status: r.status, startedAt: r.startedAt, summary: r.summary, steps: r.steps.map(st => ({ id: st.id, title: st.title, kind: st.kind, status: st.status, message: (st.message || '').slice(0, 140) })) }));
    return json(res, 200, { runs });
  }
  m = p.match(/^\/api\/runs\/([\w_]+)$/);
  if (m && req.method === 'GET') {
    const r = s.runs.find(x => x.id === m[1]);
    return r ? json(res, 200, { run: r }) : json(res, 404, { error: 'run not found' });
  }
  if (p === '/api/approve' && req.method === 'POST') {
    const body = await readBody(req);
    const appr = store.addApproval({ runId: body.runId, stepId: body.stepId, approved: body.approved !== false, actor: body.actor || 'web-operator', note: body.note || '' });
    return json(res, 200, { approval: appr });
  }

  // ── staging / publish ──
  if (p === '/api/publish' && req.method === 'POST') {
    const body = await readBody(req);
    const locId = body.location || s.locations[0].id;
    const entry = store.liveMenu(locId);
    if (!entry.staging) return json(res, 400, { error: 'Nothing staged to publish.' });
    const report = Audit.fullAudit(entry.staging);
    const BLOCKING = new Set(['EMPTY_MODIFIER_GROUP', 'MIDNIGHT_RULE_VIOLATION', 'RUSH_HOLD_CONFLICT', 'DEAD_FORCE_PRICE_RULE', 'MODIFIER_RECORD_SPANS_CATEGORIES', 'SHADOW_EMPTY']);
    const blockers = report.sections.flatMap(x => x.findings).filter(f => f.severity === 'HIGH' && BLOCKING.has(f.type));
    if (blockers.length && !body.override) return json(res, 409, { error: `Publish blocked — ${blockers.length} integrity blocker(s).`, blockers: blockers.slice(0, 20) });
    // safety: pre-publish backup
    IE.exportMenu(entry.live, 'canonical-json', (s.locations.find(l => l.id === locId) || {}).platform);
    const menu = store.commitStaging(locId, body.note || `published by ${body.actor || 'web-operator'}${blockers.length ? ' (OVERRIDE: blockers acknowledged)' : ''}`);
    return json(res, 200, { ok: true, version: menu.version, publishedAt: menu.publishedAt, overrodeBlockers: blockers.length || 0 });
  }
  if (p === '/api/publish/discard' && req.method === 'POST') {
    const body = await readBody(req);
    store.discardStaging(body.location || s.locations[0].id);
    return json(res, 200, { ok: true });
  }

  // ── quick skill actions (write to staging workbench only) ──
  if (p === '/api/quick' && req.method === 'POST') {
    const body = await readBody(req);
    const skill = REG.get(body.skill);
    if (!skill) return json(res, 400, { error: `Unknown skill: ${body.skill}` });
    const locId = body.location || s.locations[0].id;
    const entry = store.liveMenu(locId);
    const workbench = store.clone(entry.staging || entry.live);
    try {
      const r = skill.handler({ store, runId: store.newId('qa'), mode: 'apply', actor: body.actor || 'web-quick', location: s.locations.find(l => l.id === locId), platform: (s.locations.find(l => l.id === locId) || {}).platform, baselineMenu: workbench }, body.args || {}, workbench);
      if (r.blocked) return json(res, 409, { blocked: true, message: r.message, findings: r.findings || [] });
      if (body.skill === 'publish.apply') return json(res, 200, { ok: true, message: r.message });
      entry.staging = workbench;
      entry.stagingNote = `quick action ${body.skill} by ${body.actor || 'web-quick'}`;
      store.flush();
      return json(res, 200, { ok: true, message: r.message, notes: r.notes || [], findingsCount: (r.findings || []).length });
    } catch (e) { return json(res, 400, { error: e.message }); }
  }

  // ── audit ──
  if (p === '/api/audit' && req.method === 'GET' || p === '/api/audit' && req.method === 'POST') {
    const locId = url.searchParams.get('location') || s.locations[0].id;
    const entry = store.liveMenu(locId);
    const menu = entry.staging || entry.live;
    const report = Audit.fullAudit(menu);
    return json(res, 200, { report, source: entry.staging ? 'staging' : 'live', markdown: Audit.renderAuditMarkdown(report) });
  }

  if (p === '/api/audit/patch' && req.method === 'POST') {
    const body = await readBody(req);
    const locId = body.location || s.locations[0].id;
    const entry = store.liveMenu(locId);
    const workbench = entry.staging ? store.clone(entry.staging) : store.clone(entry.live);
    try {
      const patch = body.patch;
      if (!patch || !patch.action) return json(res, 400, { error: 'Invalid patch specification' });

      let summary = patch.summary || '';
      let applied = false;
      if (patch.action === 'set_item_price') {
        const item = (workbench.items || []).find(i => i.id === patch.itemId || (patch.itemName && M.normName(i.name) === M.normName(patch.itemName)));
        if (!item) return json(res, 404, { error: `Item not found for patch: ${patch.itemId || patch.itemName}` });
        const oldPrice = item.price;
        item.price = Number(patch.value ?? patch.recommendedPrice);
        applied = true;
        summary = summary || `Updated '${item.name}' price from $${(oldPrice / 100).toFixed(2)} to $${(item.price / 100).toFixed(2)}`;
      } else if (patch.action === 'adjust_modifier_delta' || patch.action === 'set_modifier_delta') {
        const g = (workbench.modifierGroups || []).find(g => g.id === patch.groupId || (patch.groupName && M.normName(g.name) === M.normName(patch.groupName)));
        if (!g) return json(res, 404, { error: `Modifier group not found for patch: ${patch.groupId || patch.groupName}` });
        const opt = (g.options || []).find(o => o.id === patch.optionId || (patch.optionName && M.normName(o.name) === M.normName(patch.optionName)));
        if (!opt) return json(res, 404, { error: `Modifier option not found for patch: ${patch.optionId || patch.optionName}` });
        const oldDelta = opt.priceDelta || 0;
        opt.priceDelta = Number(patch.value ?? patch.recommendedDelta);
        applied = true;
        summary = summary || `Updated '${opt.name}' delta in '${g.name}' from +$${(oldDelta / 100).toFixed(2)} to +$${(opt.priceDelta / 100).toFixed(2)}`;
      } else if (patch.action === 'set_group_included') {
        const g = (workbench.modifierGroups || []).find(g => g.id === patch.groupId || (patch.groupName && M.normName(g.name) === M.normName(patch.groupName)));
        if (!g) return json(res, 404, { error: `Modifier group not found for patch: ${patch.groupId || patch.groupName}` });
        g.included = Number(patch.value ?? patch.recommendedIncluded);
        applied = true;
        summary = summary || `Set included count to ${g.included} on '${g.name}'`;
      } else if (patch.action === 'set_group_max_choices') {
        const g = (workbench.modifierGroups || []).find(g => g.id === patch.groupId || (patch.groupName && M.normName(g.name) === M.normName(patch.groupName)));
        if (!g) return json(res, 404, { error: `Modifier group not found for patch: ${patch.groupId || patch.groupName}` });
        g.maxChoices = Number(patch.value ?? patch.recommendedMaxChoices);
        applied = true;
        summary = summary || `Capped maxChoices to ${g.maxChoices} on '${g.name}'`;
      } else {
        return json(res, 400, { error: `Unsupported patch action: ${patch.action}` });
      }

      entry.staging = workbench;
      entry.stagingNote = `Patch: ${summary || patch.action}`;
      store.flush();

      const report = Audit.fullAudit(workbench);
      return json(res, 200, {
        ok: true,
        message: `Patch applied: ${summary}`,
        summary,
        applied,
        report,
        source: 'staging',
        markdown: Audit.renderAuditMarkdown(report),
        integrity_score: report.integrity_score,
        vulnerabilities: report.vulnerabilities,
      });
    } catch (e) { return json(res, 400, { error: e.message }); }
  }

  // ── import / export ──
  if (p === '/api/import' && req.method === 'POST') {
    const body = await readBody(req);
    const locId = body.location || s.locations[0].id;
    const entry = store.liveMenu(locId);
    const workbench = entry.staging ? store.clone(entry.staging) : store.clone(entry.live);
    try {
      const out = body.content
        ? IE.importRaw(body.content, body.filename || 'pasted.txt', { format: body.format || 'auto', platform: (s.locations.find(l => l.id === locId) || {}).platform, menu: workbench, mode: body.mode === 'replace' ? 'replace' : 'modify' })
        : IE.importFile(body.file, { format: body.format || 'auto', platform: (s.locations.find(l => l.id === locId) || {}).platform, menu: workbench, mode: body.mode === 'replace' ? 'replace' : 'modify' });
      const audit = Audit.fullAudit(workbench);
      entry.staging = workbench;
      entry.stagingNote = `import ${body.filename || body.file || 'raw'} (${out.format}, ${body.mode || 'modify'}) — staged, not live`;
      store.flush();
      return json(res, 200, { ok: true, ...out, auditSummary: audit.summary, note: 'Import lands in STAGING. Review, then Publish.' });
    } catch (e) { return json(res, 400, { error: e.message }); }
  }
  if (p === '/api/import/template' && req.method === 'GET') {
    const platform = url.searchParams.get('platform') || 'square';
    const templates = {
      square: 'Name,Category Name,Price,Description,Modifier Set,Visible\nSample Pizza,Pizza,12.50,A description,Pizza Toppings,Y\n',
      clover: 'Name,Group,Price,Description,Modifier Groups,Available\nSample Pizza,Pizza,12.50,,Pizza Toppings;Crust,true\n',
      lightspeed: 'Type,Name,Category,Price,Description,Modifier Groups,Available\nitem,Sample Pizza,Pizza,12.50,,Crust Style,yes\n',
      toast: 'Group Name,Item Name,Price,Description,Modifier Groups,Available\nPizza,Sample Pizza,12.50,,Crust|Pizza Toppings,true\n',
      canonical: '{\n  "categories": [{"id":"cat_pizza","name":"Pizza"}],\n  "items": [{"id":"it_1","name":"Sample Pizza","category":"Pizza","price":1250,"description":"","modifierGroups":["mg_x"],"channels":["Dine-In","Online"],"course":2,"archived":false}],\n  "modifierGroups": [{"id":"mg_x","name":"Sample Group","minChoices":0,"maxChoices":2,"included":0,"shared":false,"options":[{"id":"mo_1","name":"Option","priceDelta":100,"default":false}]}]\n}\n',
    };
    const body = templates[platform] || templates.square;
    res.writeHead(200, { 'Content-Type': 'text/csv', 'Content-Disposition': `attachment; filename="menuflow-${platform}-template.csv"` });
    return res.end(body);
  }
  if (p === '/api/export' && req.method === 'POST') {
    const body = await readBody(req);
    const locId = body.location || s.locations[0].id;
    const entry = store.liveMenu(locId);
    const location = s.locations.find(l => l.id === locId) || {};
    try {
      if (body.scope === 'workflows') {
        const out = IE.exportWorkflows(location.platform || 'heartland');
        return json(res, 200, { ok: true, ...out });
      }
      if (body.scope === 'project') {
        const out = IE.exportProject();
        return json(res, 200, { ok: true, ...out });
      }
      if (body.scope === 'audit' || body.scope === 'audit-report') {
        const menu = body.source === 'staging' && entry.staging ? entry.staging : (entry.staging || entry.live);
        const report = Audit.fullAudit(menu);
        const md = Audit.renderAuditMarkdown(report);
        const reportsDir = path.join(store.DATA_DIR, 'reports');
        fs.mkdirSync(reportsDir, { recursive: true });
        const stamp = new Date().toISOString().replace(/[:.]/g, '-');
        const filename = `audit-integrity-report-${stamp}.md`;
        const file = path.join(reportsDir, filename);
        fs.writeFileSync(file, md);
        return json(res, 200, { ok: true, filename, path: file, bytes: Buffer.byteLength(md), format: 'markdown', report, integrity_score: report.integrity_score });
      }
      const menu = body.scope === 'staging' && entry.staging ? entry.staging : entry.live;
      const out = IE.exportMenu(menu, body.format || 'canonical-json', location.platform || 'heartland');
      return json(res, 200, { ok: true, filename: out.filename, path: out.path, bytes: out.bytes, format: out.format });
    } catch (e) { return json(res, 400, { error: e.message }); }
  }
  if (p === '/api/download' && req.method === 'GET') {
    const name = path.basename(url.searchParams.get('file') || '');
    const dir = url.searchParams.get('dir') === 'reports' ? path.join(store.DATA_DIR, 'reports') : IE.EXPORT_DIR;
    const file = path.join(dir, name);
    if (!file.startsWith(dir) || !fs.existsSync(file)) return json(res, 404, { error: 'not found' });
    const type = name.endsWith('.json') ? 'application/json' : name.endsWith('.csv') ? 'text/csv' : 'text/markdown';
    res.writeHead(200, { 'Content-Type': type, 'Content-Disposition': `attachment; filename="${name}"` });
    return res.end(fs.readFileSync(file));
  }
  if (p === '/api/files' && req.method === 'GET') {
    const list = (dir) => fs.existsSync(dir) ? fs.readdirSync(dir).filter(f => !f.startsWith('.')).map(f => ({ name: f, bytes: fs.statSync(path.join(dir, f)).size, at: fs.statSync(path.join(dir, f)).mtime.toISOString() })) : [];
    return json(res, 200, { exports: list(IE.EXPORT_DIR).slice(0, 40), reports: list(path.join(store.DATA_DIR, 'reports')).slice(0, 40), imports: list(IE.IMPORT_DIR).slice(0, 40) });
  }

  // ── locations ──
  if (p === '/api/locations' && req.method === 'POST') {
    const body = await readBody(req);
    if (!body.name || !body.platform || !PLATFORMS[body.platform]) return json(res, 400, { error: 'name + a valid platform are required' });
    const st = store.get();
    const loc = { id: store.newId('loc'), orgId: st.organizations[0]?.id || 'org_1', name: body.name, platform: body.platform, timezone: body.timezone || 'America/Denver', createdAt: new Date().toISOString() };
    st.locations.push(loc);
    st.menus[loc.id] = { live: M.newMenu(`${body.name} menu`), staging: null, stagingNote: null };
    store.flush();
    return json(res, 200, { ok: true, location: loc });
  }
  if (p === '/api/settings' && req.method === 'POST') {
    const body = await readBody(req);
    const st = store.get();
    if (body.mode === 'live-api' || body.mode === 'sandbox') st.settings.mode = body.mode;
    if (body.apiKeys) st.settings.apiKeys = Object.assign(st.settings.apiKeys || {}, body.apiKeys);
    store.flush();
    return json(res, 200, { ok: true, mode: st.settings.mode, keyPlatforms: Object.keys(st.settings.apiKeys || {}) });
  }

  return json(res, 404, { error: `No route: ${req.method} ${p}` });
}

module.exports = { handle };

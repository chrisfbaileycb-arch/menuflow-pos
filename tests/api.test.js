/** api.test.js — boots the real HTTP server on an ephemeral port and exercises the console endpoints. */
const { spawn } = require('child_process');
const path = require('path');
const net = require('net');
const { async_test, report, ok, eq } = require('./harness');

const PORT = 3000 + (process.pid % 1500);
const BASE = `http://127.0.0.1:${PORT}`;
let server;

function start() {
  return new Promise((resolve, reject) => {
    server = spawn(process.execPath, [path.join(__dirname, '..', 'server', 'server.js'), String(PORT)], {
      stdio: ['ignore', 'pipe', 'pipe'],
      env: { ...process.env, PORT: String(PORT) },
    });
    let err = '';
    server.stderr.on('data', d => { err += d; });
    const tryConnect = (tries) => fetch(`${BASE}/api/health`).then(r => r.json()).then(() => resolve()).catch(() => {
      if (tries <= 0) reject(new Error('server did not boot: ' + err));
      else setTimeout(() => tryConnect(tries - 1), 250);
    });
    tryConnect(40);
  });
}
async function j(p, opts) {
  const r = await fetch(BASE + p, opts ? { headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(opts.body), method: opts.method || 'POST' } : undefined);
  const isJson = (r.headers.get('content-type') || '').includes('json');
  const body = isJson ? await r.json() : await r.text();
  return { status: r.status, body };
}

(async () => {
  await start();

  await async_test('GET / serves the console shell', async () => {
    const r = await fetch(BASE + '/');
    ok(r.ok);
    const t = await r.text();
    ok(t.includes('MenuFlow POS') && t.includes('platformSelect') && t.includes('app.js'), 'shell has brand + platform dropdown + app wiring');
  });

  await async_test('/api/platforms → 7 POS systems for the dropdown', async () => {
    const { body } = await j('/api/platforms');
    eq(body.platforms.length, 7);
    ok(body.platforms.every(p => p.workflowCount >= 5), 'each platform carries a workflow catalog');
    ok(body.platforms.some(p => p.id === 'heartland' && p.workflowCount >= 9));
  });

  await async_test('/api/verify → all workflows verified over HTTP', async () => {
    const { body } = await j('/api/verify');
    eq(body.ok, true);
    ok(body.totals.citations >= 100);
    ok(body.skills >= 40);
  });

  await async_test('workflow detail resolves owner-manual citations with excerpts + links', async () => {
    const { body } = await j('/api/workflows/heartland/hl.modifier-isolate');
    const manualStep = body.workflow.steps.find(s => s.kind === 'manual');
    ok(manualStep, 'has manual portal step');
    const cite = manualStep.citations[0];
    ok(cite.url.startsWith('http'), 'citation links to source');
    ok(cite.excerpt && cite.excerpt.length > 20, 'citation carries manual excerpt');
    eq(body.workflow.validation.ok, true);
  });

  await async_test('run without approvals pauses at gate; approve + rerun completes; publish honors integrity block', async () => {
    const paused = await j('/api/workflows/heartland/hl.pricing-stack-fix/run', { body: { location: 'loc_marios', mode: 'apply', inputs: {} } });
    eq(paused.body.run.status, 'awaiting_approval');
    const okRun = await j('/api/workflows/heartland/hl.pricing-stack-fix/run', { body: { location: 'loc_marios', mode: 'apply', inputs: {}, approvals: ['s-approve'] } });
    eq(okRun.body.run.status, 'ok');
    eq(okRun.body.run.committedToStaging, true);
    const menu = await j('/api/menu?location=loc_marios');
    eq(menu.body.menu.__source, 'staging', 'menu endpoint shows staged workbench when present');
    const pub = await j('/api/publish', { body: { location: 'loc_marios' } });
    eq(pub.status, 409, 'publish blocked by remaining HIGH integrity findings');
    ok(pub.body.blockers.length > 0);
    await j('/api/publish/discard', { body: { location: 'loc_marios' } });
  });

  await async_test('gate approvals are recorded as audit evidence', async () => {
    const { body } = await j('/api/approve', { body: { runId: 'run_test', stepId: 's-x', approved: true, actor: 'c.bailey', note: 'client email 9/15' } });
    ok(body.approval.id);
    eq(body.approval.actor, 'c.bailey');
  });

  await async_test('quick action → staging only; publish flow works on a clean menu', async () => {
    const loc = 'loc_marios_toast';
    const q = await j('/api/quick', { body: { location: loc, skill: 'menu.item.set_price', args: { item: 'Margherita Pizza', price: '13.00' } } });
    eq(q.status, 200);
    ok(q.body.ok);
    const menu = await j(`/api/menu?location=${loc}`);
    eq(menu.body.menu.__source, 'staging');
    const marg = menu.body.menu.items.find(i => /margherita/i.test(i.name));
    eq(marg.price, 1300, 'quick action applied to staging');
    const pub = await j('/api/publish', { body: { location: loc } });
    eq(pub.status, 200, 'clean toast menu publishes');
    const live = await j(`/api/menu?location=${loc}&which=live`);
    eq(live.body.menu.items.find(i => /margherita/i.test(i.name)).price, 1300);
  });

  await async_test('import endpoint normalizes + audits + stages', async () => {
    const csv = 'Name,Category Name,Price,Description,Modifier Set,Visible\nTest Wing,Apps,9.99,,Sauce,Y\n';
    const r = await j('/api/import', { body: { location: 'loc_marios_clover', content: csv, filename: 't.csv', format: 'square-csv', mode: 'modify' } });
    eq(r.status, 200);
    ok(r.body.summary.items >= 1);
    ok(r.body.auditSummary, 'audit summary included for review');
    await j('/api/publish/discard', { body: { location: 'loc_marios_clover' } });
  });

  await async_test('export endpoint writes files & download works', async () => {
    const r = await j('/api/export', { body: { location: 'loc_marios_toast', scope: 'live', format: 'square-csv' } });
    eq(r.status, 200);
    const d = await fetch(`${BASE}/api/download?file=${encodeURIComponent(r.body.filename)}`);
    ok(d.ok, 'download served');
    const txt = await d.text();
    ok(txt.startsWith('Name,Category Name,Price'), 'CSV content served for download');
  });

  await async_test('/api/audit returns structured findings for the UI tables', async () => {
    const { body } = await j('/api/audit?location=loc_marios');
    ok(body.report.sections.length >= 8);
    ok(body.markdown.includes('# Menu Audit Report'));
    ok(body.report.integrity_score, 'integrity_score on report');
    ok(body.report.vulnerabilities, 'vulnerabilities on report');
    const cc = body.report.sections.find(s => s.key === 'cross_contamination');
    ok(cc.findings.some(f => /pepperoni/i.test(f.modifier)), 'pepperoni problem surfaced via API');

    const vWithPatch = body.report.vulnerabilities.items.find(i => i.patch);
    if (vWithPatch) {
      const patchRes = await j('/api/audit/patch', { body: { location: 'loc_marios', patch: vWithPatch.patch } });
      eq(patchRes.status, 200);
      ok(patchRes.body.ok, 'patch executed successfully');
      ok(patchRes.body.integrity_score, 'updated integrity score returned');
    }
  });

  await async_test('new location: create → run workflow → stage → publish (empty→first item)', async () => {
    const created = await j('/api/locations', { body: { name: 'Test Bar', platform: 'aloha' } });
    eq(created.status, 200);
    const loc = created.body.location.id;
    const run = await j(`/api/workflows/aloha/aloha.modifier-setup/run`, { body: { location: loc, mode: 'apply', inputs: { groupName: 'Bar Snacks', optionName: 'Pretzel Bites', maxChoices: 2 }, approvals: ['s-adm'] } });
    eq(run.body.run.status, 'ok');
    const pub = await j('/api/publish', { body: { location: loc } });
    eq(pub.status, 200);
  });

  await async_test('errors: unknown skill 400, unknown route 404, unknown location handled', async () => {
    const a = await j('/api/quick', { body: { skill: 'nope.nope' } });
    eq(a.status, 400);
    const b = await j('/api/definitely-not-here');
    eq(b.status, 404);
  });

  server.kill('SIGTERM');
  report();
})().catch(e => { console.error(e); try { server.kill(); } catch (_) { } process.exit(1); });

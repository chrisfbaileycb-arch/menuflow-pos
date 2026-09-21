#!/usr/bin/env node
/**
 * verify-cli.js — the proof that "workflows are verified and executable":
 *   1. schema-validates every workflow definition
 *   2. every skill reference resolves to a real handler
 *   3. every owner's-manual citation resolves in the sources registry
 *      (and belongs to the workflow's platform)
 *   4. DRY-RUNS every workflow end-to-end against the seeded sandbox menu
 *
 * Exit code 0 only when ALL of that passes. Used by `npm run verify`,
 * CI, and by the web UI's "Verify all" button (GET /api/verify).
 */
const engine = require('./engine/engine');
const store = require('./store');
const REG = require('./engine/registry');

function main() {
  store.load();
  const report = engine.validateAll({});
  const state = store.get();
  if (!state.locations.length) {
    console.error('No locations seeded — run: node fixtures/build-fixture.js');
    process.exit(1);
  }
  const locFor = (platform) => (state.locations.find(l => l.platform === platform) || state.locations[0]);

  let execTotal = 0, execPassed = 0;
  const execFailures = [];
  for (const wf of engine.listWorkflows()) {
    // dry-run each workflow against a throwaway workbench on its platform's location
    {
      const useLoc = locFor(wf.platform).id;
      try {
        const inputs = {};
        for (const inp of wf.inputs || []) {
          // feed example-derived values so dry runs actually exercise logic
          const ex = inp.example;
          if (ex === undefined) {
            if (inp.required) {
              inputs[inp.name] = inp.type === 'number' || inp.type === 'money' ? (inp.type === 'money' ? '9.99' : 1)
                : inp.type === 'string[]' || inp.type === 'number[]' ? ['x'] : 'sample';
            }
            continue;
          }
          if (inp.type === 'number') inputs[inp.name] = parseInt(String(ex), 10) || 0;
          else if (inp.type === 'money') inputs[inp.name] = String(ex).match(/[\d.]+/)?.[0] || '0';
          else if (inp.type === 'string[]') inputs[inp.name] = String(ex).split(',').map(s => s.trim()).filter(Boolean);
          else if (inp.type === 'number[]') inputs[inp.name] = String(ex).replace(/[^0-9,]/g, '').split(',').filter(x => x !== '').map(Number);
          else if (inp.type === 'boolean') inputs[inp.name] = !/^no|false/i.test(String(ex));
          // strings pass through LITERALLY: the UI pre-fills `example` verbatim, so a dry run
          // with firstToken() would certify a value no operator can actually submit.
          else inputs[inp.name] = String(ex);
        }
        const run = engine.run({ platform: wf.platform, workflowId: wf.id, locationId: useLoc, mode: 'dry', inputs, approvals: allGates(wf), actor: 'verify-cli' });
        execTotal++;
        if (run.status === 'ok') execPassed++;
        else execFailures.push({ wf: `${wf.platform}/${wf.id}`, status: run.status, stoppedAt: run.stoppedAt, detail: firstFailure(run) });
      } catch (e) {
        execTotal++;
        execFailures.push({ wf: `${wf.platform}/${wf.id}`, status: 'exception', detail: e.message });
      }
    }
  }

  console.log('═'.repeat(64));
  console.log('MENUFLOW WORKFLOW VERIFICATION REPORT');
  console.log('═'.repeat(64));
  console.log(`Workflows found        : ${report.totals.workflows}`);
  console.log(`Static schema status   : ${report.totals.errors === 0 ? 'valid (0 issues)' : `${report.totals.errors} issues`}`);
  console.log(`Steps (auto/manual/gate): ${report.totals.auto}/${report.totals.manual}/${report.totals.gates}`);
  console.log(`Owner's-manual citations: ${report.totals.citations} (all resolved: ${report.totals.errors === 0})`);
  console.log(`Post-step checks       : ${report.totals.checks}`);
  console.log(`Skills implemented     : ${report.skills}`);
  console.log(`Manual sources indexed : ${report.docs}`);
  console.log('');
  for (const [plat, info] of Object.entries(report.platforms)) {
    const fail = info.failures ? info.failures.length : 0;
    console.log(`  ${plat.padEnd(12)} ${info.verified}/${info.workflows} verified${fail ? `  ✗ ${fail} failing` : ''}`);
  }
  console.log('');
  console.log(`Dry-run executions     : ${execPassed}/${execTotal} completed cleanly`);
  if (execFailures.length) {
    console.log('\nFailures:');
    for (const f of execFailures) console.log(`  ✗ ${f.wf} [${f.status}] @ ${f.stoppedAt || '-'}: ${f.detail}`);
  }
  const ok = report.ok && execFailures.length === 0;
  console.log('');
  console.log(ok ? 'RESULT: PASS — every workflow schema-valid, citations resolve, every dry-run executes.' : 'RESULT: FAIL');
  process.exit(ok ? 0 : 1);
}

function allGates(wf) {
  return wf.steps.filter(s => s.kind === 'gate').map(s => s.id)
    .concat(wf.steps.filter(s => s.kind === 'manual').map(s => s.id));
}
function firstFailure(run) {
  const f = (run.steps || []).filter(s => ['failed', 'blocked', 'exception'].includes(s.status)).pop();
  return f ? `${f.id}: ${f.message}`.slice(0, 160) : (run.error || '');
}

main();

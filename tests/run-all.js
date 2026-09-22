#!/usr/bin/env node
/**
 * run-all.js — executes every test suite in an ISOLATED temp data dir so the
 * repo's data/state.json is never touched by tests.
 */
const { execFileSync } = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'menuflow-test-'));
const suites = ['engine.test.js', 'audit.test.js', 'workflows.test.js', 'io.test.js', 'manuals.test.js', 'api.test.js', 'firebase.test.js'];
if (!fs.existsSync(path.join(tmp, 'fixtures'))) {
  // tests read fixtures through require paths relative to the repo — nothing to copy
}
process.env.MENUFLOW_TEST_TMP = tmp;

let fail = 0;
for (const suite of suites) {
  console.log(`\n━━━ ${suite} ${'━'.repeat(56 - suite.length)}`);
  // each suite gets its own isolated store
  const env = { ...process.env, MENUFLOW_DATA_DIR: path.join(tmp, suite + '.data') };
  try {
    execFileSync(process.execPath, [path.join(__dirname, suite)], { stdio: 'inherit', env, cwd: path.join(__dirname, '..') });
  } catch (e) {
    fail++;
  }
}
fs.rmSync(tmp, { recursive: true, force: true });
console.log(`\n${fail === 0 ? '✅ ALL SUITES PASSED' : `❌ ${fail} suite(s) failed`}`);
process.exit(fail === 0 ? 0 : 1);

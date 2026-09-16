/** harness.js — micro test framework: keeps the repo dependency-free. */
let passed = 0, failed = 0, current = '';
const failures = [];
function test(name, fn) {
  current = name;
  try { fn(); passed++; console.log(`  ✓ ${name}`); }
  catch (e) { failed++; failures.push({ name, err: e }); console.log(`  ✗ ${name}\n      ${e.message}`); }
}
function async_test(name, fn) {
  return fn().then(() => { passed++; console.log(`  ✓ ${name}`); })
    .catch(e => { failed++; failures.push({ name, err: e }); console.log(`  ✗ ${name}\n      ${e.message}`); });
}
function eq(a, b, msg = '') { const ja = JSON.stringify(a), jb = JSON.stringify(b); if (ja !== jb) throw new Error(`${msg} expected ${jb}, got ${ja}`); }
function ok(v, msg = '') { if (!v) throw new Error(msg || 'expected truthy'); }
function match(arr, pred, msg = '') { const hit = arr.find(pred); if (!hit) throw new Error(`${msg} — no element matched`); return hit; }
function report() {
  console.log(`\n${passed} passed, ${failed} failed`);
  if (failed) { for (const f of failures) console.log(`FAIL: ${f.name}\n  ${f.err.stack}`); process.exit(1); }
}
module.exports = { test, async_test, eq, ok, match, report };

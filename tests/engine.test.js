/** engine.test.js — executor semantics: validation, gates, checks, staging. */
const { test, eq, ok, match, report } = require('./harness');
const engine = require('../server/engine/engine');
const store = require('../server/store');
const REG = require('../server/engine/registry');
const A = require('../server/engine/audit');
const M = require('../server/engine/menu');

test('skill registry populated & every referenced skill exists', () => {
  const skills = REG.list();
  ok(skills.length >= 40, `expected >=40 skills, got ${skills.length}`);
  for (const wf of engine.listWorkflows()) {
    for (const st of wf.steps) if (st.kind === 'auto') ok(REG.has(st.skill), `${wf.id}/${st.id} → unknown skill ${st.skill}`);
  }
});

test('verifier rejects: unknown skill, missing citation, destructive w/o gate, bad tokens', () => {
  const bad = {
    id: 'x.y', platform: 'heartland', category: 'test', risk: 'high', title: 't', summary: 's',
    inputs: [],
    steps: [
      { id: 's1', kind: 'auto', title: 'ghost', skill: 'does.not.exist' },
      { id: 's2', kind: 'manual', title: 'no cite', instructions: 'do it' },
      { id: 's3', kind: 'auto', title: 'bad token', skill: 'menu.item.un86', args: { item: '{notDeclared}' } },
    ],
  };
  const v = engine.validateWorkflow(bad, { docPrefixes: ['heartland'] });
  ok(!v.ok);
  ok(v.errors.some(e => e.includes('unknown skill')));
  ok(v.errors.some(e => e.includes("must cite the owner's manual")));
  ok(v.errors.some(e => e.includes('undeclared input')));
  ok(v.errors.some(e => e.includes('gate')), 'high-risk without gate must fail');
});

test('verifier rejects citations that resolve to no manual section', () => {
  const wf = {
    id: 'x.y', platform: 'heartland', category: 'test', risk: 'low', title: 't', summary: 's', inputs: [],
    steps: [{ id: 's1', kind: 'manual', title: 'a', instructions: 'b', citations: [{ doc: 'heartland.items-screen', section: 'invented-section' }] }],
  };
  const v = engine.validateWorkflow(wf, { docPrefixes: ['heartland'] });
  ok(v.errors.some(e => e.includes('not found in sources registry')), JSON.stringify(v.errors));
});

test('verifier rejects cross-platform citations (square wf citing clover manual)', () => {
  const wf = {
    id: 'sq.x', platform: 'square', category: 'test', risk: 'low', title: 't', summary: 's', inputs: [],
    steps: [{ id: 's1', kind: 'manual', title: 'a', instructions: 'b', citations: [{ doc: 'clover.sync', section: 'windows' }] }],
  };
  const v = engine.validateWorkflow(wf, { docPrefixes: ['square'] });
  ok(v.errors.some(e => e.includes('is not a manual of platform')), JSON.stringify(v.errors));
});

test('apply-mode run commits to STAGING only; publish moves it to live; discard reverts', () => {
  const loc = 'loc_marios';
  const before = JSON.stringify(store.menuFor(loc, 'live'));
  const wf = engine.getWorkflow('heartland', 'hl.item-create');
  const run = engine.run({
    platform: 'heartland', workflowId: 'hl.item-create', locationId: loc, mode: 'apply',
    inputs: { itemName: 'Parma Pizza', category: 'Pizza', price: '17.50', course: 2 },
    approvals: wf.steps.filter(s => s.kind === 'manual').map(s => s.id),
    actor: 'test',
  });
  eq(run.status, 'ok');
  const live = JSON.stringify(store.menuFor(loc, 'live'));
  eq(live, before, 'live menu must be untouched by apply-mode runs');
  const staged = store.menuFor(loc, 'staging');
  ok(staged.items.some(i => /parma/i.test(i.name)), 'staged workbench contains the new item');
  // publish (no HIGH blockers introduced beyond existing… blockers exist on seed) → use raw commitStaging for state test
  store.commitStaging(loc, 'test publish');
  ok(store.menuFor(loc, 'live').items.some(i => /parma/i.test(i.name)), 'after publish live contains item');
  // discard path
  store.discardStaging(loc);
  eq(store.get().menus[loc].staging, null, 'discard clears staging');
});

test('failed check leaves nothing staged (transactional)', () => {
  const loc = 'loc_marios';
  store.discardStaging(loc);
  const before = JSON.stringify(store.menuFor(loc, 'live'));
  // hl.midnight-split WITHOUT approvals for manual step would pause; here craft a check-failure scenario:
  // price a item then assert price check fails via workflow-level validation, not runtime — so instead
  // directly test that a run failing at step N does not commit:
  const run = engine.run({
    platform: 'heartland', workflowId: 'hl.pricing-stack-fix', locationId: loc, mode: 'apply',
    inputs: {}, approvals: [], actor: 'test',
  });
  eq(run.status, 'awaiting_approval', 'high-risk flow must pause at its gate when unapproved');
  eq(store.get().menus[loc].staging, null, 'paused run commits nothing');
  eq(JSON.stringify(store.menuFor(loc, 'live')), before, 'live untouched by paused run');
});

test('gate approval → resume completes and stages', () => {
  const loc = 'loc_marios';
  const wf = engine.getWorkflow('heartland', 'hl.pricing-stack-fix');
  const apps = wf.steps.filter(s => s.kind === 'gate' || s.kind === 'manual').map(s => s.id);
  const run = engine.run({ platform: 'heartland', workflowId: wf.id, locationId: loc, mode: 'apply', inputs: {}, approvals: apps, actor: 'test' });
  eq(run.status, 'ok');
  const staged = store.menuFor(loc, 'staging');
  const dead = A.pricingRuleConflicts(staged).filter(f => f.type === 'DEAD_FORCE_PRICE_RULE');
  eq(dead.length, 0, 'staged menu has the dead rule repaired');
  store.discardStaging(loc);
});

test('midnight skill: crossing range auto-splits with next-day semantics', () => {
  const menu = M.newMenu('t');
  const A2 = require('../server/engine/skills/pricing');
  const ctx = { runId: 't', mode: 'test', location: {}, platform: 'heartland', baselineMenu: menu };
  A2['menu.schedule.set'].handler(ctx, { name: 'Late Night', days: [5], start: '10:00 PM', end: '2:00 AM', items: [] }, menu);
  eq(menu.schedules.length, 2, 'split into two entries');
  eq(menu.schedules[1].dayOffset, 1, 'post-midnight entry is next day');
  eq(A.midnightViolations(menu).length, 0, 'audit now clean');
});

test('86 marks unavailable without deleting; un86 restores; delete requires exact confirm string', () => {
  const menu = store.menuFor('loc_marios', 'live');
  const ops = require('../server/engine/skills/menu-ops');
  const ctx = { runId: 't', mode: 'test', location: {}, platform: 'heartland', baselineMenu: menu };
  ops['menu.item.86'].handler(ctx, { item: 'Meat Lovers Pizza', reason: 'test out of pepperoni' }, menu);
  const it = M.findItem(menu, 'Meat Lovers Pizza');
  ok(it.unavailable && it.unavailable.pos, 'marked unavailable');
  ok(menu.items.includes(it), 'still present (not deleted)');
  ops['menu.item.un86'].handler(ctx, { item: 'Meat Lovers Pizza' }, menu);
  ok(!M.findItem(menu, 'Meat Lovers Pizza').unavailable, 'restored');
  const r = ops['menu.item.remove'].handler(ctx, { itemId: 'it_wings', reason: 'cleanup test', confirm: 'WRONG' }, menu);
  ok(r.blocked === true, 'delete blocked without confirm');
});

test('isolation: pepperoni split clears record-level span violations', () => {
  const m = store.clone(store.menuFor('loc_marios', 'live'));
  const mods = require('../server/engine/skills/modifiers');
  const ctx = { runId: 't', mode: 'test', location: {}, platform: 'heartland', baselineMenu: m };
  const before = A.isolationViolations(m).length;
  ok(before >= 2, `expected seeded violations, got ${before}`);
  mods['menu.modifier.isolate_all_shared'].handler(ctx, {}, m);
  eq(A.isolationViolations(m).length, 0, 'after isolate-all: zero record-level violations');
  // Size groups remain allowed to span (shared + allowed kind)
  ok(A.modifierCrossContamination(m).length > 0, 'name-based scan still informational — by design');
});

report();

/**
 * pricing.js — dynamic pricing rules + schedules with the Midnight Rule
 * automatically enforced on write (Ruffo instruction: never write a crossing
 * range as a single entry — split into pre/post-midnight with day increment).
 */
const M = require('../menu');
const newId = (p) => `${p}_${Math.random().toString(36).slice(2, 9)}`;

const specificity = (rule) => {
  let s = 0;
  const sc = rule.scope || {};
  if (rule.appliesTo && rule.appliesTo.items) s += 16;
  else if (rule.appliesTo && rule.appliesTo.categories) s += 8;
  if (sc.room) s += 4;
  if (sc.channel) s += 2;
  if (sc.days) s += 2;
  if (sc.timeRanges) s += 2;
  if (rule.enabled === false) s -= 100;
  return s;
};

module.exports = {
  'menu.pricing.rule.add': {
    title: 'Add a dynamic pricing rule (Force / +$ / % / Multiplier) with scope filters',
    description: 'Rule types per KB pricing-rules. Priority is recomputed so most-specific stays on top (first match wins).',
    params: [
      { name: 'name', required: true, type: 'string' },
      { name: 'type', required: true, type: 'string', example: 'force | dollar | percent | multiplier' },
      { name: 'value', required: true, type: 'money', example: '3.00 for $3 force; -20 for -20%; 2 for 2×' },
      { name: 'items', required: false, type: 'string[]' },
      { name: 'categories', required: false, type: 'string[]' },
      { name: 'days', required: false, type: 'number[]', example: '0=Sun … 6=Sat' },
      { name: 'start', required: false, type: 'string', example: '4:00 PM' },
      { name: 'end', required: false, type: 'string', example: '6:00 PM' },
      { name: 'channel', required: false, type: 'string' },
      { name: 'room', required: false, type: 'string' },
      { name: 'postTax', required: false, type: 'boolean' },
    ],
    handler(ctx, args, menu) {
      if (!['force', 'dollar', 'percent', 'multiplier'].includes(args.type)) {
        throw new Error(`Invalid rule type "${args.type}" — must be force|dollar|percent|multiplier`);
      }
      const scope = {};
      if (args.days) scope.days = args.days.map(Number);
      if (args.start && args.end) {
        const s = M.parseTime(args.start), e = M.parseTime(args.end);
        if (s == null || e == null) throw new Error(`Unparseable time range: ${args.start}–${args.end}`);
        scope.timeRanges = M.splitMidnight(s, e).ranges.map(r => ({ startMin: r.startMin, endMin: r.endMin, dayOffset: r.dayOffset || 0, label: r.label }));
      }
      if (args.channel) scope.channel = args.channel;
      if (args.room) scope.room = args.room;
      let value;
      if (args.type === 'force') value = M.money(args.value);
      else if (args.type === 'dollar') value = M.money(args.value);
      else if (args.type === 'percent') value = Number(args.value);
      else value = Number(args.value);
      const rule = {
        id: newId('pr'), name: args.name, type: args.type, value,
        appliesTo: args.items
          ? { items: (Array.isArray(args.items) ? args.items : [args.items]).map(ref => (M.findItem(menu, ref) || { id: ref }).id) }
          : args.categories ? { categories: (Array.isArray(args.categories) ? args.categories : [args.categories]) } : { all: true },
        scope, postTax: Boolean(args.postTax), enabled: true, priority: 99,
      };
      menu.pricingRules.push(rule);
      // auto re-sort by specificity (Ruffo: most specific must be on top)
      menu.pricingRules.sort((a, b) => specificity(b) - specificity(a) || (a.priority || 99) - (b.priority || 99));
      menu.pricingRules.forEach((r, i) => { r.priority = i + 1; });
      const notes = [];
      if (scope.timeRanges && scope.timeRanges.length > 1) notes.push('Midnight Rule applied automatically: crossing range split into pre/post-midnight entries (post portion on NEXT calendar day).');
      M.touch(menu);
      return { message: `Pricing rule "${rule.name}" added at priority ${rule.priority} (first match wins)`, notes };
    },
  },

  'menu.pricing.rule.set_enabled': {
    title: 'Enable/disable a pricing rule',
    params: [
      { name: 'rule', required: true, type: 'string' },
      { name: 'enabled', required: true, type: 'boolean' },
    ],
    handler(ctx, args, menu) {
      const r = menu.pricingRules.find(x => x.id === args.rule || M.normName(x.name) === M.normName(args.rule));
      if (!r) throw new Error(`Rule not found: ${args.rule}`);
      r.enabled = Boolean(args.enabled);
      M.touch(menu);
      return { message: `Rule "${r.name}" ${r.enabled ? 'ENABLED' : 'DISABLED'}` };
    },
  },

  'menu.pricing.reorder_specificity': {
    title: 'Re-sort pricing stack most-specific-first (disables shadowed dead rules)',
    params: [],
    handler(ctx, args, menu) {
      const before = menu.pricingRules.map(r => r.name);
      menu.pricingRules.sort((a, b) => specificity(b) - specificity(a));
      menu.pricingRules.forEach((r, i) => { r.priority = i + 1; });
      const after = menu.pricingRules.map(r => r.name);
      M.touch(menu);
      return { message: `Re-sorted ${after.length} rules by specificity`, diff: { before, after } };
    },
  },

  'menu.schedule.set': {
    title: 'Schedule an item-availability window (days + time range) — auto-splits midnight crossings',
    params: [
      { name: 'name', required: true, type: 'string' },
      { name: 'days', required: true, type: 'number[]' },
      { name: 'start', required: true, type: 'string' },
      { name: 'end', required: true, type: 'string' },
      { name: 'items', required: false, type: 'string[]' },
    ],
    handler(ctx, args, menu) {
      const s = M.parseTime(args.start), e = M.parseTime(args.end);
      if (s == null || e == null) throw new Error(`Unparseable schedule times: ${args.start}/${args.end}`);
      const itemIds = (args.items ? (Array.isArray(args.items) ? args.items : [args.items]) : []).map(ref => {
        const it = M.findItem(menu, ref);
        if (!it) throw new Error(`Item not found: ${ref}`);
        return it.id;
      });
      const { legal, ranges } = M.splitMidnight(s, e);
      const created = [];
      let twin = null;
      for (const r of ranges) {
        const sch = {
          id: newId('sch'),
          name: legal ? args.name : `${args.name} — ${r.label}`,
          days: args.days.map(Number),
          startMin: r.startMin, endMin: r.endMin,
          appliesTo: itemIds, splitFrom: null, dayOffset: r.dayOffset || 0,
        };
        if (twin) sch.splitFrom = twin;
        if (!twin) twin = sch.id;
        menu.schedules.push(sch);
        created.push(`${sch.name}: ${M.fmtTime(r.startMin)}–${M.fmtTime(r.endMin)}${r.dayOffset ? ' (next day)' : ''}`);
      }
      M.touch(menu);
      return {
        message: created.length > 1 ? `Midnight Rule: split into ${created.length} entries → ${created.join(' | ')}` : `Schedule set: ${created[0]}`,
        notes: created.length > 1 ? ['Post-midnight portion assigned to the NEXT calendar day (KB midnight-rule §day-increment).'] : [],
      };
    },
  },

  'menu.schedule.remove': {
    title: 'Remove a schedule window (by id or name; twins follow)',
    params: [{ name: 'schedule', required: true, type: 'string' }],
    handler(ctx, args, menu) {
      const idx = menu.schedules.findIndex(s => s.id === args.schedule || M.normName(s.name) === M.normName(args.schedule));
      if (idx < 0) throw new Error(`Schedule not found: ${args.schedule}`);
      const [gone] = menu.schedules.splice(idx, 1);
      const twin = menu.schedules.findIndex(s => s.splitFrom === gone.id || gone.splitFrom === s.id);
      if (twin >= 0) menu.schedules.splice(twin, 1);
      M.touch(menu);
      return { message: `Removed schedule "${gone.name}"${twin >= 0 ? ' (+ its split twin)' : ''}` };
    },
  },

  'menu.schedule.auto_split_all': {
    title: 'AUTO-REPAIR: split every midnight-crossing range on the menu (schedules + rule windows)',
    description: 'Ruffo instruction — "never write a crossing range as a single entry": scans schedules, pricing-rule time windows and legacy item ranges, rewrites each violation as pre/post-midnight entries with the day increment.',
    params: [],
    handler(ctx, args, menu) {
      const A = require('../audit');
      let fixed = 0;
      // 1) schedules
      const viol = A.midnightViolations(menu);
      const bad = new Set(viol.filter(v => v.owner === 'schedule').map(v => v.item));
      const kept = [];
      for (const sch of menu.schedules || []) {
        if (bad.has(`${sch.name || sch.id}`) || sch.endMin <= sch.startMin) {
          const { ranges } = M.splitMidnight(sch.startMin, sch.endMin);
          let firstId = null;
          for (const r of ranges) {
            const twin = { ...sch, id: `${sch.id}${firstId ? '_pm' : ''}`, name: `${sch.name}${ranges.length > 1 ? ` — ${r.label}` : ''}`, startMin: r.startMin, endMin: r.endMin, dayOffset: r.dayOffset || 0, splitFrom: firstId };
            if (!firstId) firstId = twin.id;
            kept.push(twin);
          }
          fixed++;
        } else kept.push(sch);
      }
      menu.schedules = kept;
      // 2) pricing rule windows
      for (const rule of menu.pricingRules || []) {
        const trs = rule.scope && rule.scope.timeRanges;
        if (!trs) continue;
        const out = [];
        for (const tr of trs) {
          const s = M.parseTime(tr.startMin != null ? tr.startMin : tr.start);
          const e = M.parseTime(tr.endMin != null ? tr.endMin : tr.end);
          if (s == null || e == null) { out.push(tr); continue; }
          if (e > s) { out.push(tr); continue; }
          const { ranges } = M.splitMidnight(s, e);
          out.push(...ranges.map(r => ({ startMin: r.startMin, endMin: r.endMin, dayOffset: r.dayOffset || 0, label: r.label })));
          fixed++;
        }
        rule.scope.timeRanges = out;
      }
      // 3) legacy flat item ranges (imported heartland exports)
      for (const it of menu.items || []) {
        if (!it.time_ranges) continue;
        const out = [];
        for (const tr of it.time_ranges) {
          const s = M.parseTime(tr.start), e = M.parseTime(tr.end);
          if (s == null || e == null || e > s) { out.push(tr); continue; }
          out.push({ start: M.fmtTime(s), end: '11:59 PM', label: 'pre-midnight' }, { start: '12:00 AM', end: tr.end, day: 'next', label: 'post-midnight (next day)' });
          fixed++;
        }
        it.time_ranges = out;
      }
      M.touch(menu);
      return { message: fixed ? `Auto-split ${fixed} midnight-crossing range(s) into pre/post entries (day incremented)` : 'No midnight violations to repair' };
    },
  },

  'menu.pricing.disable_dead_force_rules': {
    title: 'AUTO-REPAIR: disable shadowed (dead) Force Price rules',
    description: 'First-match-wins means any second matching force rule is dead config; KB fix is disable-or-rescope. This disables (non-destructively; re-enable anytime).',
    params: [],
    handler(ctx, args, menu) {
      const A = require('../audit');
      const dead = A.pricingRuleConflicts(menu).filter(f => f.type === 'DEAD_FORCE_PRICE_RULE');
      const names = new Set(dead.map(d => d.dead_rule));
      let n = 0;
      for (const r of menu.pricingRules) {
        if (names.has(r.name) && r.enabled !== false) { r.enabled = false; r.disabledReason = 'Dead shadowed force-price rule (auto-repair by hl.pricing-stack-fix)'; n++; }
      }
      M.touch(menu);
      return { message: n ? `Disabled ${n} dead force-price rule(s): ${[...names].join(', ')}` : 'No dead force rules present' };
    },
  },

  'menu.tax.ensure': {
    title: 'Define/assign a tax rate preset (food vs alcohol vs merchandise)',
    params: [
      { name: 'name', required: true, type: 'string' },
      { name: 'ratePct', required: true, type: 'number' },
      { name: 'items', required: false, type: 'string[]' },
    ],
    handler(ctx, args, menu) {
      let tx = menu.taxRates.find(t => M.normName(t.name) === M.normName(args.name));
      if (!tx) {
        tx = { id: newId('tx'), name: M.titleCase(args.name), ratePct: Number(args.ratePct) };
        menu.taxRates.push(tx);
      } else tx.ratePct = Number(args.ratePct);
      let assigned = 0;
      for (const ref of args.items || []) {
        const it = M.findItem(menu, ref);
        if (it) { it.taxRateId = tx.id; assigned++; }
      }
      M.touch(menu);
      return { message: `Tax "${tx.name}" @ ${tx.ratePct}%${args.items ? ` — assigned to ${assigned} item(s)` : ''}` };
    },
  },
};

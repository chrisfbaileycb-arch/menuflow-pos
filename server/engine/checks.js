/**
 * checks.js — named post-step verification predicates.
 * A workflow step can declare `checks`; they run against the workbench after
 * the step executes, and a failing check fails the run (with rollback of the
 * uncommitted workbench). This is what makes workflows *verified*, not just
 * scripted.
 */
const M = require('./menu');
const A = require('./audit');

module.exports = {
  'group-has-members': {
    title: 'The modifier group this step touched has at least one member option',
    args: 'group',
    fn(menu, args) {
      const want = M.normName(args.group);
      const g = (menu.modifierGroups || []).find(x => M.normName(x.name) === want);
      if (!g) return { pass: false, detail: `no modifier group named "${args.group}"` };
      const n = (g.options || []).length;
      return { pass: n > 0, detail: `"${g.name}" has ${n} option(s)` + (n ? '' : ' — a group with no members never appears at the POS and breaks third-party menu syncs') };
    },
  },
  'item-exists': {
    title: 'An item with this name exists on the workbench',
    fn(menu, args) {
      const it = M.findItem(menu, args.item);
      return { pass: Boolean(it), detail: it ? `"${it.name}" in ${it.category} @ ${M.displayMoney(it.price)}` : `no item matching "${args.item}"` };
    },
  },
  'item-price': {
    title: 'Item price equals expected (cents or money string)',
    fn(menu, args) {
      const it = M.findItem(menu, args.item);
      if (!it) return { pass: false, detail: 'item missing' };
      const want = M.money(args.price);
      return { pass: it.price === want, detail: `"${it.name}" price ${M.displayMoney(it.price)} vs expected ${M.displayMoney(want)}` };
    },
  },
  'item-unavailable': {
    title: 'Item is 86’d / marked unavailable at POS',
    fn(menu, args) {
      const it = M.findItem(menu, args.item);
      return { pass: Boolean(it && it.unavailable && it.unavailable.pos), detail: it ? `"${it.name}" unavailable=${Boolean(it.unavailable && it.unavailable.pos)}` : 'item missing' };
    },
  },
  'item-available': {
    title: 'Item is available (not 86’d)',
    fn(menu, args) {
      const it = M.findItem(menu, args.item);
      return { pass: Boolean(it) && !(it.unavailable && it.unavailable.pos), detail: it ? `"${it.name}" availability OK` : 'item missing' };
    },
  },
  'modifier-isolated': {
    title: 'The named modifier no longer crosses item categories',
    fn(menu, args) {
      const { isolated, violation } = A.isolationCheck(menu, args.modifier);
      return {
        pass: isolated,
        detail: isolated
          ? `"${args.modifier}" is isolated to a single category — 86 cascade risk eliminated`
          : `still spans ${violation.category_count} categories (${violation.categories_affected.join(', ')})`,
      };
    },
  },
  'no-midnight-violations': {
    title: 'No unsplit midnight-crossing ranges remain',
    fn(menu) {
      const v = A.midnightViolations(menu);
      return { pass: v.length === 0, detail: v.length ? `${v.length} violation(s): ${v.map(x => x.item).join(', ')}` : 'all time ranges legal' };
    },
  },
  'no-dead-force-price': {
    title: 'No dead/shadowed Force Price rules remain',
    fn(menu) {
      const v = A.pricingRuleConflicts(menu).filter(f => f.type === 'DEAD_FORCE_PRICE_RULE');
      return { pass: v.length === 0, detail: v.length ? `${v.length} dead rule(s)` : 'force-price stack clean' };
    },
  },
  'no-empty-modifier-groups': {
    title: 'No empty modifier groups (third-party sync safety). Optional arg `group` scopes to one group.',
    fn(menu, args = {}) {
      let v = A.emptyModifierGroups(menu);
      if (args && args.group) {
        const g = M.findGroup(menu, args.group);
        v = v.filter(f => (g && f.group === g.name) || M.normName(f.group) === M.normName(args.group));
        if (!g && !v.length) return { pass: false, detail: `group "${args.group}" not found on workbench` };
      }
      return { pass: v.length === 0, detail: v.length ? `${v.length} empty group(s): ${v.map(x => x.group).join(', ')}` : (args.group ? `"${args.group}" has options ✓` : 'no empty groups') };
    },
  },
  'shadow-channels-exist': {
    title: 'Every live channel has a v2 shadow',
    fn(menu) {
      const lives = menu.channels.filter(c => c.status === 'live' && !/ v2$/.test(c.name));
      const missing = lives.filter(c => !menu.channels.find(x => x.name === `${c.name} v2` && x.status === 'shadow'));
      return { pass: missing.length === 0, detail: missing.length ? `missing shadows for: ${missing.map(c => c.name).join(', ')}` : `${lives.length} live channel(s) each shadowed` };
    },
  },
  'shadow-verified': {
    title: 'Shadow build passed verification and is ready for cutover',
    fn(menu) {
      const ok = menu.shadowBuild && menu.shadowBuild.status === 'verified';
      return { pass: Boolean(ok), detail: menu.shadowBuild ? `status=${menu.shadowBuild.status}` : 'no shadow build in progress' };
    },
  },
  'cutover-complete': {
    title: 'Cutover recorded with client approval reference',
    fn(menu) {
      const sb = menu.shadowBuild;
      const ok = sb && sb.status === 'cut-over' && sb.approvalRef;
      return { pass: Boolean(ok), detail: ok ? `cutover ${sb.cutOverAt} (approval ${sb.approvalRef})` : 'cutover not completed/authorized' };
    },
  },
  'no-rush-hold-conflict': {
    title: 'No item carries Rush and Hold simultaneously',
    fn(menu) {
      const v = A.coursingIssues(menu).filter(f => f.type === 'RUSH_HOLD_CONFLICT');
      return { pass: v.length === 0, detail: v.length ? `${v.length} conflict(s): ${v.map(x => x.item).join(', ')}` : 'kitchen routing flags consistent' };
    },
  },
  'item-count-min': {
    title: 'Workbench retains at least N non-archived items (safety floor)',
    fn(menu, args) {
      const n = menu.items.filter(i => !i.archived).length;
      const min = Number(args.min || 1);
      return { pass: n >= min, detail: `${n} live item(s), floor ${min}` };
    },
  },
};

/**
 * modifiers.js — modifier group/option skills, including the signature
 * "isolate" operation that fixes the pepperoni problem per
 * heartland.kb.modifier-architecture.
 */
const M = require('../menu');
const newId = (p) => `${p}_${Math.random().toString(36).slice(2, 9)}`;

function resolveGroup(menu, ref) {
  const g = M.findGroup(menu, ref);
  if (!g) throw new Error(`Modifier group not found: ${ref}`);
  return g;
}
function sharedOptionNames(menu) {
  // names of options currently appearing under >1 category
  const A = require('../audit');
  return A.modifierCrossContamination(menu).map(v => M.normName(v.modifier));
}

function firstOptionName(menu, groupName) {
  const g = menu.modifierGroups.find(x => x.name === groupName);
  return g && g.options && g.options[0] ? g.options[0].name : groupName;
}

module.exports = {
  'menu.modifier.group.ensure': {
    title: 'Create/ensure a modifier group with min/max choices + included count',
    description: 'Mirrors Heartland Admin Console > Menu > Modifiers (New): Name, Minimum Choices, Maximum Choices, Number of Included Ingredients, Show Modifier Name, Available Online.',
    params: [
      { name: 'name', required: true, type: 'string' },
      { name: 'minChoices', required: false, type: 'number' },
      { name: 'maxChoices', required: false, type: 'number' },
      { name: 'included', required: false, type: 'number' },
      { name: 'shared', required: false, type: 'boolean' },
      { name: 'availableOnline', required: false, type: 'boolean' },
    ],
    handler(ctx, args, menu) {
      let g = menu.modifierGroups.find(x => M.normName(x.name) === M.normName(args.name));
      const created = !g;
      if (!g) {
        g = {
          id: newId('mg'), name: M.titleCase(args.name),
          minChoices: args.minChoices != null ? Number(args.minChoices) : 0,
          maxChoices: args.maxChoices != null ? Number(args.maxChoices) : 0,
          included: args.included != null ? Number(args.included) : 0,
          shared: args.shared === true,   // ISOLATED_BY_DEFAULT: true — shared must be explicit
          halfAndHalfAllowed: false, availableOnline: args.availableOnline !== false,
          options: [], itemScope: null,
        };
        menu.modifierGroups.push(g);
      } else {
        if (args.minChoices != null) g.minChoices = Number(args.minChoices);
        if (args.maxChoices != null) g.maxChoices = Number(args.maxChoices);
        if (args.included != null) g.included = Number(args.included);
        if (args.shared != null) g.shared = Boolean(args.shared);
        if (args.availableOnline != null) g.availableOnline = Boolean(args.availableOnline);
      }
      const notes = [];
      if (g.shared) notes.push('shared=true recorded — KB allows sharing only for Size / Prep style / Temperature; document why.');
      if (g.maxChoices > 0 && g.minChoices > g.maxChoices) throw new Error(`minChoices(${g.minChoices}) > maxChoices(${g.maxChoices}) — invalid configuration`);
      M.touch(menu);
      return { message: `${created ? 'Created' : 'Updated'} modifier group "${g.name}" (min ${g.minChoices}, max ${g.maxChoices}, included ${g.included}${g.shared ? ', SHARED' : ', isolated'})`, notes };
    },
  },

  'menu.modifier.option.upsert': {
    title: 'Add/update an option inside a modifier group (name, price delta, default)',
    params: [
      { name: 'group', required: true, type: 'string' },
      { name: 'name', required: true, type: 'string' },
      { name: 'priceDelta', required: false, type: 'money' },
      { name: 'isDefault', required: false, type: 'boolean' },
    ],
    handler(ctx, args, menu) {
      const g = resolveGroup(menu, args.group);
      let opt = (g.options || []).find(o => M.normName(o.name) === M.normName(args.name));
      const created = !opt;
      if (!opt) {
        opt = { id: newId('mo'), name: M.titleCase(args.name), priceDelta: 0, default: false };
        g.options.push(opt);
      }
      if (args.priceDelta != null) opt.priceDelta = M.money(args.priceDelta) || 0;
      if (args.isDefault != null) {
        if (args.isDefault) for (const o of g.options) o.default = (o === opt);
        else opt.default = false;
      }
      M.touch(menu);
      return { message: `Option "${opt.name}" in "${g.name}": ${M.displayMoney(opt.priceDelta)}${opt.default ? ' (default)' : ''}${created ? ' [new]' : ''}` };
    },
  },

  'menu.modifier.link': {
    title: 'Attach a modifier group to specific items (Assigned Items)',
    params: [
      { name: 'group', required: true, type: 'string' },
      { name: 'items', required: true, type: 'string[]' },
    ],
    handler(ctx, args, menu) {
      const g = resolveGroup(menu, args.group);
      const linked = [];
      for (const ref of args.items) {
        const item = M.findItem(menu, ref);
        if (!item) throw new Error(`Item not found: ${ref}`);
        item.modifierGroups = item.modifierGroups || [];
        if (!item.modifierGroups.includes(g.id)) { item.modifierGroups.push(g.id); linked.push(item.name); }
      }
      M.touch(menu);
      return { message: `Linked "${g.name}" → ${linked.length ? linked.join(', ') : 'already attached (no change)'}` };
    },
  },

  'menu.modifier.unlink': {
    title: 'Remove a modifier group from specific items (or all items)',
    params: [
      { name: 'group', required: true, type: 'string' },
      { name: 'items', required: false, type: 'string[]' },
    ],
    handler(ctx, args, menu) {
      const g = resolveGroup(menu, args.group);
      let n = 0;
      for (const item of menu.items) {
        if (args.items && args.items.length) {
          const hit = args.items.some(ref => item.id === ref || M.normName(item.name) === M.normName(ref));
          if (!hit) continue;
        }
        if ((item.modifierGroups || []).includes(g.id)) {
          item.modifierGroups = item.modifierGroups.filter(x => x !== g.id);
          n++;
        }
      }
      M.touch(menu);
      return { message: `Unlinked "${g.name}" from ${n} item(s)` };
    },
  },

  'menu.modifier.isolate': {
    title: 'ISOLATE a shared modifier — the pepperoni-problem fix',
    description:
      'Splits a cross-category shared modifier into per-category, item-scoped groups ' +
      '(Is Shared = false). After isolation, 86-ing one category’s copy no longer cascades.',
    params: [
      { name: 'modifier', required: true, type: 'string' },
      { name: 'sharedOptionIds', required: false, type: 'string[]' },
    ],
    handler(ctx, args, menu) {
      const target = M.normName(args.modifier);
      // Which groups contain an option matching the target modifier name?
      const hits = [];
      for (const g of menu.modifierGroups) {
        for (const o of g.options || []) {
          if (M.normName(o.name) === target) hits.push({ g, o });
        }
      }
      if (!hits.length) return { message: `No modifier named "${args.modifier}" found — nothing to isolate.` };

      // affected items per category
      const byCat = new Map();
      for (const item of menu.items) {
        const inGroup = (item.modifierGroups || []).some(gid => hits.some(h => h.g.id === gid));
        if (!inGroup) continue;
        const cat = item.category || 'Uncategorized';
        if (!byCat.has(cat)) byCat.set(cat, []);
        byCat.get(cat).push(item);
      }
      if (byCat.size <= 1) {
        return { message: `"${args.modifier}" already touches only one category (${[...byCat.keys()][0] || '—'}). No isolation needed.` };
      }

      const steps = [];
      // 1) remove matching option from all shared groups; unlink those groups from affected items if group becomes option-empty for that item
      for (const item of menu.items) {
        const touched = (item.modifierGroups || []).filter(gid => hits.some(h => h.g.id === gid));
        if (!touched.length) continue;
        // remove hit groups from item
        item.modifierGroups = item.modifierGroups.filter(gid => !hits.some(h => h.g.id === gid));
      }
      for (const h of hits) {
        h.g.options = h.g.options.filter(o => o !== h.o);
        if (h.g.options.length === 0) steps.push(`group "${h.g.name}" emptied — archived`);
      }
      // prune emptied groups
      menu.modifierGroups = menu.modifierGroups.filter(g => (g.options || []).length > 0);

      // 2) create per-category item-scoped groups
      const created = [];
      for (const [cat, items] of byCat) {
        const gname = `${cat} ${M.titleCase(args.modifier)}`;
        let g = menu.modifierGroups.find(x => M.normName(x.name) === M.normName(gname));
        if (!g) {
          g = {
            id: newId('mg'), name: gname,
            minChoices: 0, maxChoices: 1, included: 0,
            shared: false, halfAndHalfAllowed: false, availableOnline: true,
            options: [], itemScope: [],
          };
          menu.modifierGroups.push(g);
        }
        const src = hits[0].o;
        let opt = g.options.find(o => M.normName(o.name) === target);
        if (!opt) {
          opt = { id: newId('mo'), name: M.titleCase(src.name), priceDelta: src.priceDelta || 0, default: false };
          g.options.push(opt);
        }
        for (const it of items) {
          it.modifierGroups = it.modifierGroups || [];
          if (!it.modifierGroups.includes(g.id)) it.modifierGroups.push(g.id);
          g.itemScope.push(it.id);
        }
        created.push(`${g.name} (${items.length} items)`);
      }
      M.touch(menu);
      return {
        message: `Isolated "${args.modifier}": ${byCat.size} per-category group(s) → ${created.join('; ')}`,
        diff: { categories: [...byCat.keys()], created },
        notes: ['Set Is Shared = false on each — done by default here (KB modifier-architecture §isolation).'],
      };
    },
  },

  'menu.modifier.isolate_all_shared': {
    title: 'AUTO-REPAIR: enforce the isolation standard menu-wide',
    description: 'Splits EVERY modifier record (group) that spans more than one category into per-category item-scoped copies with all options preserved (explicitly-shared Size/Prep/Temperature groups are allowed by the KB and left alone).',
    params: [],
    handler(ctx, args, menu) {
      const A = require('../audit');
      const viol = A.isolationViolations(menu);
      const done = [];
      for (const v of viol) {
        const g = menu.modifierGroups.find(x => x.name === v.group);
        if (!g) continue;
        const byCat = new Map();
        for (const it of menu.items) {
          if (it.archived) continue;
          if ((it.modifierGroups || []).includes(g.id)) {
            const cat = it.category || 'Uncategorized';
            if (!byCat.has(cat)) byCat.set(cat, []);
            byCat.get(cat).push(it);
          }
        }
        for (const [cat, items] of byCat) {
          const gname = `${cat} ${g.name}`;
          let ng = menu.modifierGroups.find(x => M.normName(x.name) === M.normName(gname));
          if (!ng) {
            ng = {
              id: newId('mg'), name: gname, minChoices: g.minChoices || 0, maxChoices: g.maxChoices || 0,
              included: g.included || 0, shared: false, halfAndHalfAllowed: false, availableOnline: g.availableOnline !== false,
              options: (g.options || []).map(o => ({ id: newId('mo'), name: o.name, priceDelta: o.priceDelta || 0, default: o.default, extraMultiplier: o.extraMultiplier })),
              itemScope: [],
            };
            menu.modifierGroups.push(ng);
          }
          for (const it of items) {
            it.modifierGroups = (it.modifierGroups || []).filter(x => x !== g.id);
            if (!it.modifierGroups.includes(ng.id)) it.modifierGroups.push(ng.id);
            ng.itemScope.push(it.id);
          }
        }
        menu.modifierGroups = menu.modifierGroups.filter(x => x.id !== g.id);
        done.push(`${g.name} → ${byCat.size} scoped group(s)`);
      }
      if (done.length) M.touch(menu);
      return { message: done.length ? `Isolation standard enforced: ${done.length} cross-category record(s) split` : 'Isolation rule already satisfied menu-wide', notes: done.slice(0, 10) };
    },
  },

  'menu.modifier.set_price_delta': {
    title: 'Set the price delta for a modifier option (all groups or one)',
    params: [
      { name: 'option', required: true, type: 'string' },
      { name: 'priceDelta', required: true, type: 'money' },
      { name: 'group', required: false, type: 'string' },
    ],
    handler(ctx, args, menu) {
      const target = M.normName(args.option);
      const n = M.money(args.priceDelta);
      let changed = 0;
      for (const g of menu.modifierGroups) {
        if (args.group && M.normName(g.name) !== M.normName(args.group)) continue;
        for (const o of g.options || []) {
          if (M.normName(o.name) === target) { o.priceDelta = n; changed++; }
        }
      }
      if (!changed) throw new Error(`No modifier option named "${args.option}" found.`);
      M.touch(menu);
      return { message: `Set "${args.option}" price delta → ${M.displayMoney(n)} on ${changed} option record(s)` };
    },
  },

  'menu.modifier.remove_empty': {
    title: 'AUTO-REPAIR: delete empty modifier groups (fill-or-delete rule)',
    description: 'Empty modifier groups break third-party syncs and can hide entire menus (Toast §empty-group). The documented fix is exactly this: add options, or delete the group. Removal is applied to the workbench; live untouched until publish.',
    params: [],
    handler(ctx, args, menu) {
      const A = require('../audit');
      const empties = A.emptyModifierGroups(menu);
      const ids = new Set(empties.map(e => menu.modifierGroups.find(g => g.name === e.group)?.id).filter(Boolean));
      if (!ids.size) return { message: 'No empty modifier groups present' };
      for (const it of menu.items) it.modifierGroups = (it.modifierGroups || []).filter(x => !ids.has(x));
      menu.modifierGroups = menu.modifierGroups.filter(g => !ids.has(g.id));
      M.touch(menu);
      return { message: `Removed ${ids.size} empty modifier group(s) (sync-blocker cleared)`, diff: { removed: [...ids].map(id => id) } };
    },
  },

  'menu.modifier.multiplier_extra': {
    title: 'Configure "Extra = 2.0× multiplier" semantics for an ingredient (KB pricing-rules §multiplier)',
    params: [
      { name: 'option', required: true, type: 'string' },
      { name: 'multiplier', required: false, type: 'number' },
    ],
    handler(ctx, args, menu) {
      const mult = args.multiplier != null ? Number(args.multiplier) : 2.0;
      const target = M.normName(args.option);
      let n = 0;
      for (const g of menu.modifierGroups) {
        for (const o of g.options || []) {
          if (M.normName(o.name) === target) {
            o.extraMultiplier = mult;
            o.priceDelta = Math.round((o.priceDelta || 0) * 1) ; // base price kept; POS shows "Extra" at multiplier
            o.extraLabel = `Extra (+${(mult - 1) * 100}% of base)`;
            n++;
          }
        }
      }
      if (!n) throw new Error(`Option not found: ${args.option}`);
      M.touch(menu);
      return { message: `"${args.option}": Extra uses a ${mult.toFixed(1)}× multiplier on ingredient price (not manual stacking) on ${n} record(s)` };
    },
  },
};

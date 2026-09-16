/**
 * menu-ops.js — item/category/availability/86 skills (executable actions).
 * Handler contract: (ctx, args, menu) => { message, diff?, findings?, blocked? }
 * `menu` is the staging workbench the executor commits only through the publish gate.
 */
const M = require('../menu');

const moneyArg = (v) => { const c = M.money(v); if (c == null) throw new Error(`Invalid money value: ${v}`); return c; };
const newId = (p) => `${p}_${Math.random().toString(36).slice(2, 9)}`;

module.exports = {
  'menu.category.ensure': {
    title: 'Ensure a menu category exists',
    params: [{ name: 'name', required: true, type: 'string' }],
    handler(ctx, args, menu) {
      const cat = M.ensureCategory(menu, args.name);
      return { message: `Category ready: "${cat.name}" (${cat.id})` };
    },
  },

  'menu.item.upsert': {
    title: 'Create or update a menu item (name, category, price, description, course)',
    params: [
      { name: 'name', required: true, type: 'string' },
      { name: 'category', required: true, type: 'string' },
      { name: 'price', required: false, type: 'money' },
      { name: 'description', required: false, type: 'string' },
      { name: 'course', required: false, type: 'number' },
      { name: 'channels', required: false, type: 'string[]' },
    ],
    handler(ctx, args, menu) {
      let item = M.findItem(menu, args.name);
      const created = !item;
      if (!item) {
        item = {
          id: newId('it'), name: M.titleCase(args.name),
          category: (M.ensureCategory(menu, args.category)).name,
          price: args.price != null ? moneyArg(args.price) : 0,
          description: args.description || '',
          modifierGroups: [], channels: args.channels || menu.channels.filter(c => c.status === 'live').map(c => c.name),
          course: args.course != null ? Number(args.course) : 0,
          rush: false, hold: false, halfAndHalf: false, misc: false,
          unavailable: null, stock: null, archived: false,
          taxRateId: 'tx_food',
        };
        menu.items.push(item);
      } else {
        if (args.category) item.category = M.ensureCategory(menu, args.category).name;
        if (args.price != null) item.price = moneyArg(args.price);
        if (args.description != null) item.description = args.description;
        if (args.course != null) item.course = Number(args.course);
        if (args.channels) item.channels = args.channels;
      }
      M.touch(menu);
      return { message: `${created ? 'Created' : 'Updated'} item "${item.name}" @ ${M.displayMoney(item.price)} (${item.category})` };
    },
  },

  'menu.item.set_price': {
    title: 'Set the price of one item',
    params: [
      { name: 'item', required: true, type: 'string' },
      { name: 'price', required: true, type: 'money' },
    ],
    handler(ctx, args, menu) {
      const item = M.findItem(menu, args.item);
      if (!item) throw new Error(`Item not found: ${args.item}`);
      const before = item.price;
      item.price = moneyArg(args.price);
      M.touch(menu);
      return { message: `Price "${item.name}": ${M.displayMoney(before)} → ${M.displayMoney(item.price)}`, diff: { before, after: item.price } };
    },
  },

  'menu.item.bulk_price_pct': {
    title: 'Adjust prices by percentage for a category (or whole menu)',
    description: 'Negative pct = reduction. Rounds to nearest cent.',
    params: [
      { name: 'pct', required: true, type: 'number' },
      { name: 'category', required: false, type: 'string' },
    ],
    handler(ctx, args, menu) {
      const pct = Number(args.pct);
      const targets = menu.items.filter(i => !i.archived && (!args.category || i.category === args.category));
      const changes = [];
      for (const it of targets) {
        const before = it.price;
        it.price = Math.round(it.price * (1 + pct / 100));
        changes.push({ item: it.name, before, after: it.price });
      }
      M.touch(menu);
      return { message: `Repriced ${changes.length} items by ${pct}%`, diff: { count: changes.length, sample: changes.slice(0, 10) } };
    },
  },

  'menu.item.86': {
    title: '86 an item (unavailable-for-ordering, reversible; never deletes)',
    description:
      'Signal F protocol: during service prefer customer contact + stock counts; this marks the item ' +
      'unavailable at the POS only (menu record intact), with reason + auto-restore date.',
    params: [
      { name: 'item', required: true, type: 'string' },
      { name: 'reason', required: true, type: 'string' },
      { name: 'until', required: false, type: 'string', example: '2026-09-16' },
      { name: 'count', required: false, type: 'number', example: '6 (stock limit, Heartland Item Stock Management style)' },
    ],
    handler(ctx, args, menu) {
      const item = M.findItem(menu, args.item);
      if (!item) throw new Error(`Item not found: ${args.item}`);
      item.unavailable = { pos: true, reason: args.reason, until: args.until || null, setAt: new Date().toISOString(), byRun: ctx.runId };
      if (args.count != null) item.stock = { count: Number(args.count) };
      M.touch(menu);
      const dependents = (menu.modifierGroups || []).filter(g => (g.options || []).some(o => M.normName(o.name) === M.normName(item.name))).length;
      return {
        message: `86’d "${item.name}" — reversible, POS-only. ${args.count != null ? `Stock limit ${args.count}.` : ''}` ,
        notes: [
          'Protocol: contact customers with pending orders directly; do not let the system silently kill categories.',
          dependents ? `This name is also used as a modifier option on ${dependents} group(s) — check isolation before end-of-service disable.` : 'Not referenced as a modifier elsewhere.',
        ],
      };
    },
  },

  'menu.item.un86': {
    title: 'Restore an 86’d item to availability',
    params: [{ name: 'item', required: true, type: 'string' }],
    handler(ctx, args, menu) {
      const item = M.findItem(menu, args.item);
      if (!item) throw new Error(`Item not found: ${args.item}`);
      const was = item.unavailable;
      item.unavailable = null; item.stock = null;
      M.touch(menu);
      return { message: was ? `Restored "${item.name}" to ordering` : `"${item.name}" was already available` };
    },
  },

  'menu.item.set_availability': {
    title: 'Toggle channel visibility for an item (POS / Online / Carry-Out, independently)',
    params: [
      { name: 'item', required: true, type: 'string' },
      { name: 'channels', required: true, type: 'string[]' },
      { name: 'enabled', required: false, type: 'boolean' },
    ],
    handler(ctx, args, menu) {
      const item = M.findItem(menu, args.item);
      if (!item) throw new Error(`Item not found: ${args.item}`);
      const on = args.enabled !== false;
      const set = new Set(item.channels || []);
      for (const c of args.channels) on ? set.add(c) : set.delete(c);
      item.channels = [...set];
      M.touch(menu);
      return { message: `"${item.name}" channels: [${item.channels.join(', ') || '—none—'}]` };
    },
  },

  'menu.item.set_course': {
    title: 'Assign a course number (0–9; lower fires first)',
    params: [
      { name: 'item', required: true, type: 'string' },
      { name: 'course', required: true, type: 'number' },
      { name: 'rush', required: false, type: 'boolean' },
      { name: 'hold', required: false, type: 'boolean' },
    ],
    handler(ctx, args, menu) {
      const item = M.findItem(menu, args.item);
      if (!item) throw new Error(`Item not found: ${args.item}`);
      item.course = Math.max(0, Math.min(9, Number(args.course)));
      if (args.rush != null) item.rush = Boolean(args.rush);
      if (args.hold != null) item.hold = Boolean(args.hold);
      const notes = [];
      if (item.rush && item.hold) notes.push('WARNING: Rush+Hold simultaneously is a configuration error (KB coursing §audit) — resolve before publish.');
      M.touch(menu);
      return { message: `"${item.name}" course=${item.course}${item.rush ? ' RUSH' : ''}${item.hold ? ' HOLD' : ''}`, notes };
    },
  },

  'menu.item.set_flags': {
    title: 'Set item behavior flags (Half & Half pricing eligibility, Misc/editable item)',
    params: [
      { name: 'item', required: true, type: 'string' },
      { name: 'halfAndHalf', required: false, type: 'boolean' },
      { name: 'misc', required: false, type: 'boolean' },
    ],
    handler(ctx, args, menu) {
      const item = M.findItem(menu, args.item);
      if (!item) throw new Error(`Item not found: ${args.item}`);
      if (args.halfAndHalf != null) item.halfAndHalf = Boolean(args.halfAndHalf);
      if (args.misc != null) item.misc = Boolean(args.misc);
      M.touch(menu);
      return { message: `"${item.name}" flags: halfAndHalf=${item.halfAndHalf}, misc=${item.misc}` };
    },
  },

  'menu.item.archive': {
    title: 'Archive an item (removed from all menus/channels; record retained — Lightspeed-style)',
    destructive: true,
    params: [
      { name: 'item', required: true, type: 'string' },
      { name: 'reason', required: true, type: 'string' },
    ],
    handler(ctx, args, menu) {
      const item = M.findItem(menu, args.item);
      if (!item) throw new Error(`Item not found: ${args.item}`);
      item.archived = true;
      item.archiveReason = args.reason;
      item.archivedAt = new Date().toISOString();
      M.touch(menu);
      return { message: `Archived "${item.name}" — recoverable from archive, removed from ordering everywhere.` };
    },
  },

  'menu.item.remove': {
    title: 'HARD DELETE an item record',
    description: 'Destructive. The Signal F standard is archive/unavailable instead; this exists only for cleanup of duplicates confirmed by audit.',
    destructive: true,
    params: [
      { name: 'itemId', required: true, type: 'string' },
      { name: 'reason', required: true, type: 'string' },
      { name: 'confirm', required: true, type: 'string', example: 'DELETE-<itemId> — must match the item id to execute' },
    ],
    handler(ctx, args, menu) {
      const idx = menu.items.findIndex(i => i.id === args.itemId || M.normName(i.name) === M.normName(args.itemId));
      if (idx < 0) throw new Error(`Item not found: ${args.itemId}`);
      const victim = menu.items[idx];
      if (String(args.confirm) !== `DELETE-${victim.id}`) {
        return { blocked: true, message: `Confirmation required: pass confirm="DELETE-${victim.id}". Reason given: "${args.reason}".` };
      }
      menu.items.splice(idx, 1);
      for (const g of menu.modifierGroups) {
        if (Array.isArray(g.itemScope)) g.itemScope = g.itemScope.filter(x => x !== victim.id);
      }
      M.touch(menu);
      return { message: `Deleted item record "${victim.name}" (${victim.id}) — reason logged: ${args.reason}` };
    },
  },

  'menu.item.consolidate_duplicates': {
    title: 'Consolidate duplicate item names (keeps cheapest-maintenance canonical, archives the rest)',
    params: [{ name: 'category', required: false, type: 'string' }],
    handler(ctx, args, menu) {
      const byName = new Map();
      for (const it of menu.items) {
        if (it.archived) continue;
        if (args.category && it.category !== args.category) continue;
        const k = M.normName(it.name);
        if (!byName.has(k)) byName.set(k, []);
        byName.get(k).push(it);
      }
      let merged = 0;
      for (const [, dupes] of byName) {
        if (dupes.length < 2) continue;
        dupes.sort((a, b) => (b.modifierGroups?.length || 0) - (a.modifierGroups?.length || 0));
        const keep = dupes[0];
        for (const d of dupes.slice(1)) {
          d.archived = true;
          d.archiveReason = 'Consolidated duplicate name — kept canonical entry with full modifier config.';
          d.mergedInto = keep.id;
          merged++;
        }
      }
      M.touch(menu);
      return { message: merged ? `Consolidated ${merged} duplicate item(s)` : 'No duplicate item names found' };
    },
  },

  'menu.normalize': {
    title: 'Normalize the menu: trim names, fold case, dedupe identical modifier options, strip ghost whitespace',
    params: [{ name: 'dryPreview', required: false, type: 'boolean' }],
    handler(ctx, args, menu) {
      const actions = [];
      for (const it of menu.items) {
        const fixed = String(it.name || '').trim().replace(/\s+/g, ' ');
        if (fixed !== it.name) { actions.push(`renamed item "${it.name}" → "${fixed}"`); it.name = fixed; }
        if (typeof it.price === 'string') { it.price = M.money(it.price); actions.push(`re-typed price on "${it.name}" as integer cents`); }
      }
      for (const g of menu.modifierGroups) {
        const seen = new Set(); const kept = [];
        for (const o of g.options || []) {
          const k = M.normName(o.name);
          if (seen.has(k)) { actions.push(`folded duplicate option "${o.name}" in group "${g.name}"`); continue; }
          seen.add(k);
          o.name = M.titleCase(o.name);
          kept.push(o);
        }
        g.options = kept;
      }
      M.touch(menu);
      return { message: `Normalization: ${actions.length} correction(s)`, diff: { actions: actions.slice(0, 40), count: actions.length } };
    },
  },
};

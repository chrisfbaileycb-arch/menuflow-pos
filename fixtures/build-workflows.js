/**
 * build-workflows.js — single source for all workflow definitions; emits
 * server/workflows/<platform>/<id>.json files (the engine loads the JSON).
 * Run: node fixtures/build-workflows.js
 *
 * Conventions enforced by the engine verifier (and by tests):
 *  - every manual step cites an owner's-manual doc#section that exists in server/sources.js
 *  - every auto step calls a registered skill with its required params
 *  - destructive/high-risk flows must include a client-approval gate
 *  - `checks` are live verification predicates evaluated on the workbench
 */
const fs = require('fs');
const path = require('path');

const OUT = path.join(__dirname, '..', 'server', 'workflows');
const c = (doc, section) => ({ doc, section });
const auto = (id, title, skill, args = {}, extra = {}) => ({ id, kind: 'auto', title, skill, args, ...extra });
const manual = (id, title, instructions, citations, extra = {}) => ({ id, kind: 'manual', title, instructions, citations, ...extra });
const gate = (id, title, instructions, extra = {}) => ({ id, kind: 'gate', title, instructions, ...extra });

const WF = [];
const def = (platform, wf) => WF.push({ platform, ...wf });

// Shared building blocks ------------------------------------------------------
const auditThenFix = (plat, cites) => ([
  auto('s-audit', 'Run the full menu audit and write the client report', 'audit.full', {}, { citations: cites }),
  gate('s-gate', 'Client approval of audit findings + scope',
    'Present the audit report (HIGH/MEDIUM findings, 86-cascade exposure). Obtain WRITTEN approval for the scope: targeted fix vs full normalization. Never touch the live system before this gate.'),
]);

// ══════════════════════════════ HEARTLAND (9) ══════════════════════════════
def('heartland', {
  id: 'hl.full-menu-audit', category: 'audit', risk: 'low',
  title: 'Full menu audit (cross-contamination, redundancy, 86-cascade, midnight, pricing, coursing)',
  summary: 'One-run equivalent of executing heartland-pos modifier-scan.py + redundancy-check.py + 86-risk-report.py and reading the KB rules. Writes a client-facing report to data/reports/.',
  inputs: [],
  steps: [
    auto('s-audit', 'Run all audit scans over the workbench', 'audit.full', {}, { citations: [c('heartland.kb.audit-protocol', 'protocol'), c('heartland.kb.modifier-architecture', 'pepperoni-problem')] }),
    auto('s-md', 'Render client-facing markdown report', 'report.markdown', {}),
  ],
});

def('heartland', {
  id: 'hl.item-create', category: 'menu', risk: 'low',
  title: 'Add or update a menu item (Items screen)',
  summary: 'Create/update an item exactly as the Admin Console Items screen describes: category, price, modifier associations, default ingredients, course.',
  inputs: [
    { name: 'itemName', type: 'string', required: true, example: 'Truffle Mushroom Pizza' },
    { name: 'category', type: 'string', required: true, example: 'Pizza' },
    { name: 'price', type: 'money', required: true, example: '18.50' },
    { name: 'course', type: 'number', required: false, example: '2 (entree)' },
  ],
  steps: [
    auto('s-cat', 'Ensure category exists', 'menu.category.ensure', { name: '{category}' }),
    auto('s-upsert', 'Create/update the item record', 'menu.item.upsert', { name: '{itemName}', category: '{category}', price: '{price}', course: '{course}' }, { citations: [c('heartland.items-screen', 'create')] }),
    manual('s-mods', 'Associate modifiers on the Items screen',
      'Admin Console > Menu > Items > select item. In the Modifiers list, pick the modifiers for this item; tap ingredients to store them as order defaults.',
      [c('heartland.items-screen', 'modifiers'), c('heartland.items-screen', 'default-ingredients')]),
    auto('s-course', 'Assign course number for kitchen firing', 'menu.item.set_course', { item: '{itemName}', course: '{course}' }, { citations: [c('heartland.kb.coursing', 'basics')] }),
    manual('s-half', 'Set Half & Half pricing behavior where it makes sense',
      'On the item record, set the Half & Half Pricing list (None/pizza-style) — only enable where portion logic applies (pizza, subs), never on pasta/beverages.',
      [c('heartland.items-screen', 'half-and-half')]),
    auto('s-verify', 'Verify the item landed on the workbench', 'menu.channel.list', {}, { checks: [{ check: 'item-exists', args: { item: '{itemName}' } }] }),
  ],
});

def('heartland', {
  id: 'hl.modifier-create', category: 'modifiers', risk: 'low',
  title: 'Create a modifier group with choices, prices, and assigned items',
  summary: 'Builds a modifier per the Modifiers screen: Name, Show Modifier Name, Minimum/Maximum Choices, Number of Included Ingredients, ingredient Default Prices, Assigned Items, Available Online.',
  inputs: [
    { name: 'groupName', type: 'string', required: true, example: 'Pizza Toppings' },
    { name: 'minChoices', type: 'number', required: false, example: '0' },
    { name: 'maxChoices', type: 'number', required: true, example: '8' },
    { name: 'included', type: 'number', required: false, example: '0' },
    { name: 'optionName', type: 'string', required: true, example: 'Jalapeños' },
    { name: 'optionPrice', type: 'money', required: false, example: '1.00' },
    { name: 'items', type: 'string[]', required: false, example: 'Margherita Pizza, Meat Lovers Pizza' },
  ],
  steps: [
    auto('s-grp', 'Create the group with choice rules', 'menu.modifier.group.ensure',
      { name: '{groupName}', minChoices: '{minChoices}', maxChoices: '{maxChoices}', included: '{included}', shared: false, availableOnline: true },
      { citations: [c('heartland.modifiers-screen', 'access'), c('heartland.modifiers-screen', 'min-choices'), c('heartland.modifiers-screen', 'max-choices'), c('heartland.modifiers-screen', 'included')] }),
    auto('s-opt', 'Add the ingredient with its Default Price', 'menu.modifier.option.upsert',
      { group: '{groupName}', name: '{optionName}', priceDelta: '{optionPrice}' },
      { citations: [c('heartland.modifiers-screen', 'ingredient-price')] }),
    auto('s-link', 'Assign to items (Assigned Items list)', 'menu.modifier.link', { group: '{groupName}', items: '{items}' }, { citations: [c('heartland.modifiers-screen', 'assigned-items')], fatal: false }),
    manual('s-show', 'Set Show Modifier Name + Available Online',
      'On the modifier record, enable display on POS screen, KDS and printed slips as required, and tick Available Online so the Online Ordering website exposes it.',
      [c('heartland.modifiers-screen', 'show-name'), c('heartland.modifiers-screen', 'available-online')]),
    auto('s-empty', 'Guard: the new group must have options (sync-blocker rule)', 'audit.empty-groups', {}, { checks: [{ check: 'no-empty-modifier-groups', args: { group: '{groupName}' } }] }),
  ],
});

def('heartland', {
  id: 'hl.modifier-isolate', category: 'modifiers', risk: 'medium',
  title: 'Isolate a shared modifier — fix the pepperoni problem',
  summary: 'Splits one cross-category modifier into per-category item-scoped copies (Is Shared = false) so 86-ing pizza pepperoni never disables pasta/salad revenue.',
  inputs: [
    { name: 'modifier', type: 'string', required: true, example: 'Pepperoni' },
  ],
  steps: [
    auto('s-scan', 'Quantify current cross-contamination + 86 exposure', 'audit.cross-contamination', {}, { citations: [c('heartland.kb.modifier-architecture', 'pepperoni-problem')] }),
    auto('s-risk', 'Revenue exposure if the shared copy is disabled', 'audit.86-risk', {}, { citations: [c('heartland.kb.audit-protocol', 'never-86')] }),
    gate('s-approve', 'Written client approval for the rebuild of this modifier',
      'Present items/categories/revenue exposure from the two scans. Modifier isolation changes ordering UX, so it requires explicit sign-off (KB: audit before action).'),
    auto('s-isolate', 'Split into per-category, item-scoped groups', 'menu.modifier.isolate', { modifier: '{modifier}' }, { citations: [c('heartland.kb.modifier-architecture', 'isolation')] }),
    manual('s-portal', 'Mirror the split in the Admin Console',
      'Admin Console > Menu > Modifiers: create one group per category (e.g. "Pizza Pepperoni"), leave the shared flag OFF, and re-assign items from the single shared copy to the scoped copies. Delete the shared copy only after both sides match.',
      [c('heartland.modifiers-screen', 'assigned-items')]),
    auto('s-verify', 'Verify isolation + improvement vs baseline', 'audit.verify_fix', { metric: 'cross_contamination' },
      { checks: [{ check: 'modifier-isolated', args: { modifier: '{modifier}' } }] }),
  ],
});

def('heartland', {
  id: 'hl.86-stock-limit', category: 'operations', risk: 'medium',
  title: 'Run-out protocol: 86 via stock limit — never by deleting',
  summary: 'Implements the Heartland item-stock path (long-press item > stock limit, or Manager > Item Stock Management) with the Signal F rule: contact customers, disable in-system only after service.',
  inputs: [
    { name: 'item', type: 'string', required: true, example: 'Pepperoni Pizza' },
    { name: 'count', type: 'number', required: false, example: '6 — remaining sellable quantity' },
    { name: 'reason', type: 'string', required: true, example: '86 pepperoni — delivery missed' },
  ],
  steps: [
    auto('s-cascade', 'Check cascade: what else shares this ingredient?', 'audit.86-risk', {}, { citations: [c('heartland.kb.audit-protocol', 'never-86')] }),
    manual('s-stock', 'Set the stock limit at the POS',
      'In the order screen long-press the item and enter the remaining stock number; for bulk changes use User Menu > Manager > Item Stock Management. The item disappears from ordering when the count reaches zero — nothing is deleted.',
      [c('heartland.mini-manager-guide', 'item-stock')]),
    auto('s-mark', 'Record the reversible POS-level 86 in the workbench', 'menu.item.86', { item: '{item}', reason: '{reason}', count: '{count}' }, { fatal: false }),
    auto('s-verify', 'Verify availability state on the workbench', 'menu.channel.list', {}, { checks: [{ check: 'item-unavailable', args: { item: '{item}' }, fatal: false }], fatal: false }),
    manual('s-restore', 'Re-enable at next delivery + clear customer backlog',
      'When supply returns, restore stock counts. During the outage, staff must contact guests who already ordered the affected items rather than letting silent substitutions happen.',
      [c('heartland.kb.audit-protocol', 'never-86')]),
  ],
});

def('heartland', {
  id: 'hl.midnight-split', category: 'schedules', risk: 'low',
  title: 'Fix unsplit midnight-crossing ranges (silent-failure repair)',
  summary: 'Scans every schedule, pricing-rule window and legacy item range; rewrites crossings as pre-midnight (…–11:59 PM) + post-midnight (12:00 AM–…) on the NEXT calendar day, exactly as the KB midnight rule demands.',
  inputs: [],
  steps: [
    auto('s-scan', 'List every midnight violation on this menu', 'audit.midnight', {}, { citations: [c('heartland.kb.midnight-rule', 'audit')] }),
    auto('s-split', 'Auto-split all crossing ranges (engine enforces the rule)', 'menu.schedule.auto_split_all', {}, { citations: [c('heartland.kb.midnight-rule', 'rule'), c('heartland.kb.midnight-rule', 'day-increment')] }),
    manual('s-portal', 'Mirror the split entries in the portal',
      'Admin Console: recreate each crossing window as TWO entries — e.g. Sat 9:00 PM–11:59 PM and Sun 12:00 AM–2:00 AM. The post-midnight entry belongs to the NEXT calendar day. Never save a single crossing range.',
      [c('heartland.kb.midnight-rule', 'rule')]),
    auto('s-verify', 'Verify zero violations remain', 'audit.midnight', {}, { checks: [{ check: 'no-midnight-violations' }] }),
  ],
});

def('heartland', {
  id: 'hl.pricing-stack-fix', category: 'pricing', risk: 'medium',
  title: 'Repair the dynamic pricing stack (dead force rules, ordering, post-tax flags)',
  summary: 'Heartland pricing rules are first-match-wins: sort most-specific first, disable shadowed duplicates non-destructively, and sanity-check discount post-tax flags.',
  inputs: [],
  steps: [
    auto('s-audit', 'Find conflicts: deep stacks, dead force rules, post-tax suspects', 'audit.pricing', {}, { citations: [c('heartland.kb.pricing-rules', 'audit-conflicts')] }),
    gate('s-approve', 'Owner approves rule changes (they move real money)',
      'Force-price changes alter guest charges directly. Confirm which rule should win (bar vs whole-venue happy hour) in writing.'),
    auto('s-reorder', 'Re-sort rules most-specific-first', 'menu.pricing.reorder_specificity', {}, { citations: [c('heartland.kb.pricing-rules', 'priority')] }),
    auto('s-dead', 'Disable shadowed force rules (non-destructive)', 'menu.pricing.disable_dead_force_rules', {}),
    auto('s-verify', 'Verify no dead force rules remain', 'audit.pricing', {}, { checks: [{ check: 'no-dead-force-price' }] }),
    auto('s-fix', 'Confirm improvement vs baseline', 'audit.verify_fix', { metric: 'pricing' }),
  ],
});

def('heartland', {
  id: 'hl.shadow-build-cutover', category: 'rebuild', risk: 'high',
  title: 'Shadow build v2 channels → client verification → cutover (zero downtime)',
  summary: 'The rebuild guide as an executable flow: pre-build checklist, export backup, create [Channel] v2 for every live channel, verify structure, gate on client sign-off, cutover with the originals retained as fallback.',
  inputs: [
    { name: 'approvalRef', type: 'string', required: true, example: 'signed-form-2026-09-14 or email thread link' },
  ],
  steps: [
    manual('s-checklist', 'Pre-build checklist (all five boxes)',
      'Confirm: audit report delivered & reviewed; client authorization form signed; scope agreed in writing; admin menu credentials live; clean current export saved. Any unchecked box stops the build.',
      [c('heartland.kb.shadow-build', 'checklist')]),
    auto('s-backup', 'Save a clean export before building', 'io.export.menu', { format: 'heartland-json', scope: 'live' }, { citations: [c('heartland.kb.shadow-build', 'checklist')] }),
    auto('s-shadow', 'Create v2 channels for every live channel', 'channel.shadow_create', {}, { citations: [c('heartland.kb.shadow-build', 'naming')] }),
    auto('s-audit', 'Audit the shadow workbench', 'audit.full', {}),
    auto('s-repairs', 'Apply the auto-repairs (empty groups, midnight splits, dead force rules, casing/prices)', 'menu.normalize', {}),
    auto('s-empty', 'Remove empty modifier groups', 'menu.modifier.remove_empty', {}, { citations: [c('signalF.shared-rules', 'empty-groups')] }),
    auto('s-mid', 'Split midnight-crossing windows', 'menu.schedule.auto_split_all', {}, { citations: [c('heartland.kb.midnight-rule', 'rule')] }),
    auto('s-isoall', 'Enforce isolation standard menu-wide', 'menu.modifier.isolate_all_shared', {}, { citations: [c('heartland.kb.modifier-architecture', 'isolation')] }),
    auto('s-dead', 'Disable dead force-price rules', 'menu.pricing.disable_dead_force_rules', {}),
    auto('s-rush', 'Resolve Rush+Hold kitchen-routing contradictions', 'menu.item.set_course', { item: 'Buffalo Wings (10pc)', course: 1, rush: false, hold: false }, { citations: [c('heartland.kb.coursing', 'basics')], fatal: false }),
    auto('s-verify', 'Structural verification of each v2 channel', 'channel.shadow_verify', {}, { checks: [{ check: 'shadow-channels-exist' }, { check: 'shadow-verified' }, { check: 'no-empty-modifier-groups' }, { check: 'modifier-isolated', args: { modifier: 'Pepperoni' } }] }),
    gate('s-client', 'Client has walked each v2 channel on a device',
      'Client tests Dine-In v2, Carry-Out v2, Pick-Up v2, Online v2 end to end (orders, modifiers, tickets, KDS). They control the flip; nothing cuts over before this box is ticked.'),
    auto('s-cutover', 'Promote v2 to live; retain originals as fallback', 'channel.cutover', { clientApprovalRef: '{approvalRef}' }, { citations: [c('heartland.kb.shadow-build', 'principle')] }),
    auto('s-pub', 'Publish the workbench to the live menu in this console', 'publish.apply', {}),
    manual('s-retire', 'Retirement of v1 is the client’s call, later',
      'After a 48-hour clean soak, if the client agrees, retire the v1 channels (channel.retire with approvalRef). Until then, old channels stay available as fallback.',
      [c('heartland.kb.shadow-build', 'phase-retire')], { checks: [{ check: 'cutover-complete' }] }),
  ],
});

def('heartland', {
  id: 'hl.menu-rebuild-normalized', category: 'rebuild', risk: 'high',
  title: 'Full menu normalization rebuild (the five-step Signal F workflow)',
  summary: 'Audit → scope approval → shadow build → normalization + isolation + pricing/temporal repair → verified cutover. The complete pipeline from the heartland-pos README, executable.',
  inputs: [
    { name: 'approvalRef', type: 'string', required: true, example: 'signed scope agreement id' },
    { name: 'fixModifier', type: 'string', required: false, example: 'Pepperoni — the modifier to isolate first' },
  ],
  steps: [
    ...auditThenFix('heartland', [c('heartland.kb.audit-protocol', 'protocol')]),
    auto('s-normalize', 'Normalize names, casing, prices, duplicate options', 'menu.normalize', {}),
    auto('s-dedup', 'Consolidate duplicate item names (keep canonical config)', 'menu.item.consolidate_duplicates', {}, { citations: [c('heartland.kb.modifier-architecture', 'pepperoni-problem')] }),
    auto('s-isolate', 'Isolate the flagged shared modifier (if named)', 'menu.modifier.isolate', { modifier: '{fixModifier}' }, { fatal: false }),
    auto('s-rush', 'Resolve Rush+Hold contradictions found by coursing audit', 'menu.item.set_course', { item: 'Buffalo Wings (10pc)', course: 1, rush: false, hold: false }, { citations: [c('heartland.kb.coursing', 'basics')] }),
    auto('s-isoall', 'Enforce the isolation standard menu-wide (split any remaining cross-category records)', 'menu.modifier.isolate_all_shared', {}, { citations: [c('heartland.kb.modifier-architecture', 'isolation')] }),
    auto('s-empty', 'Clear empty modifier groups (sync-blockers)', 'menu.modifier.remove_empty', {}, { citations: [c('signalF.shared-rules', 'empty-groups')] }),
    auto('s-mid', 'Auto-split all midnight-crossing windows', 'menu.schedule.auto_split_all', {}, { citations: [c('heartland.kb.midnight-rule', 'rule')] }),
    auto('s-dead', 'Disable dead force-price rules', 'menu.pricing.disable_dead_force_rules', {}),
    auto('s-shadow', 'Build all v2 channels', 'channel.shadow_create', {}),
    auto('s-verify', 'Verify shadow structure', 'channel.shadow_verify', {}, { checks: [{ check: 'no-empty-modifier-groups' }, { check: 'shadow-verified' }, { check: 'no-midnight-violations' }] }),
    gate('s-final', 'Client approves cutover of the rebuilt menu',
      'Walk v2 channels with the owner. Record the written approval reference before promotion.'),
    auto('s-cutover', 'Cutover with fallback retained', 'channel.cutover', { clientApprovalRef: '{approvalRef}' }),
    auto('s-pub', 'Publish to live through the validation gate', 'publish.apply', {}),
    auto('s-check', 'Final safety checks', 'menu.channel.list', {}, { checks: [{ check: 'item-count-min', args: { min: 10 } }, { check: 'no-midnight-violations' }, { check: 'cutover-complete' }] }),
  ],
});

def('heartland', {
  id: 'hl.backup-export', category: 'export', risk: 'low',
  title: 'Export everything: menu JSON, platform CSV, audit report, workflow bundle, project backup',
  summary: 'Built-in export run used before/after any change: canonical JSON + Heartland-flat JSON + workflow bundle + full project backup.',
  inputs: [],
  steps: [
    auto('s-menu', 'Canonical live-menu JSON export', 'io.export.menu', { format: 'canonical-json', scope: 'live' }),
    auto('s-hl', 'Heartland flat export (consumed by heartland-pos python audit scripts)', 'io.export.menu', { format: 'heartland-json', scope: 'live' }),
    auto('s-wf', 'Verified workflow bundle for this platform', 'io.export.workflows', {}),
    auto('s-proj', 'Full project backup (credentials stripped)', 'io.export.project', {}),
  ],
});

// ══════════════════════════════════ TOAST (8) ══════════════════════════════
def('toast', {
  id: 'toast.item-create', category: 'menu', risk: 'low',
  title: 'Add a menu item (Toast Web) and reach the POS via Publish',
  summary: 'Create the item under Menus, attach modifier groups, then the mandatory Save → Publish all changes cycle — unpublished edits never reach the POS.',
  inputs: [
    { name: 'itemName', type: 'string', required: true, example: 'Truffle Wings' },
    { name: 'group', type: 'string', required: true, example: 'Appetizers' },
    { name: 'price', type: 'money', required: true, example: '13.50' },
  ],
  steps: [
    auto('s-cat', 'Ensure the menu group exists', 'menu.category.ensure', { name: '{group}' }),
    auto('s-item', 'Create the item on the workbench', 'menu.item.upsert', { name: '{itemName}', category: '{group}', price: '{price}' }),
    manual('s-portal', 'Create the item in Toast Web and attach modifier groups',
      'Toast Web > Menus > Groups & items > Add item. Set name/price, choose the menu group, and attach the modifier groups this item needs. A new item with no attached groups will order without prompts.',
      [c('toast.menu-items', 'add')]),
    manual('s-publish', 'Save, then Publish all changes',
      'Click Save, then Publish all changes — edits do NOT reach the POS or third-party channels until published.',
      [c('toast.modifier-groups', 'publish')]),
    auto('s-verify', 'Verify item on the workbench', 'menu.channel.list', {}, { checks: [{ check: 'item-exists', args: { item: '{itemName}' } }] }),
  ],
});

def('toast', {
  id: 'toast.modifier-group-setup', category: 'modifiers', risk: 'medium',
  title: 'Create a modifier group + options with the right Required/Optional behavior',
  summary: 'Replicates Toast Web modifier-group creation including the behavior matrix (Required blocks sends; Optional can force a POS prompt) and the empty-group trap.',
  inputs: [
    { name: 'groupName', type: 'string', required: true, example: 'Wing Sauces' },
    { name: 'optionName', type: 'string', required: true, example: 'Ghost Chili' },
    { name: 'priceDelta', type: 'money', required: false, example: '1.00' },
    { name: 'maxChoices', type: 'number', required: false, example: '2' },
  ],
  steps: [
    auto('s-grp', 'Create the group (min 1 when required behavior is intended)', 'menu.modifier.group.ensure', { name: '{groupName}', maxChoices: '{maxChoices}', shared: false }, { citations: [c('toast.modifier-groups', 'create')] }),
    auto('s-opt', 'Add the option with price delta', 'menu.modifier.option.upsert', { group: '{groupName}', name: '{optionName}', priceDelta: '{priceDelta}' }),
    manual('s-behavior', 'Set Required vs Optional + Include a POS prompt',
      'On the group: Required forces a selection before the item can be sent; Optional shows the group only if "Include a POS prompt" is enabled — choose deliberately per service flow.',
      [c('toast.modifier-groups', 'behavior')]),
    manual('s-order', 'Control display order if staff complain about prompt sequence',
      'Group Properties > Display Ordering Priority (1 = first), then Front of house > Order screen setup > UI options > Modifier Ordering Priority = Yes. Save and publish.',
      [c('toast.modifier-display', 'priority')], { fatal: false }),
    auto('s-empty', 'Empty groups break online-ordering syncs — block them', 'audit.empty-groups', {}, { citations: [c('toast.modifier-groups', 'empty-group')], checks: [{ check: 'no-empty-modifier-groups' }] }),
  ],
});

def('toast', {
  id: 'toast.bulk-price-change', category: 'pricing', risk: 'medium',
  title: 'Bulk price change via advanced properties (and publish)',
  summary: 'Menus > Bulk management > Advanced properties for mass edits, then publish. Uses the percentage adjuster on the workbench so the diff is auditable.',
  inputs: [
    { name: 'pct', type: 'number', required: true, example: '5 (percent, negative allowed)' },
    { name: 'category', type: 'string', required: false, example: 'Pizza' },
  ],
  steps: [
    auto('s-apply', 'Apply the percentage adjustment to the workbench', 'menu.item.bulk_price_pct', { pct: '{pct}', category: '{category}' }),
    manual('s-portal', 'Mirror via Toast Web bulk management',
      'Menus > Bulk management > Advanced properties: show the Price column, edit inline for the same scope, Save, Publish all changes. Review rows before publishing.',
      [c('toast.bulk-advanced', 'advanced-props')]),
    auto('s-sanity', 'Safety floor: menu must not be emptied by an errant scope', 'menu.channel.list', {}, { checks: [{ check: 'item-count-min', args: { min: 5 } }] }),
  ],
});

def('toast', {
  id: 'toast.86-item', category: 'operations', risk: 'medium',
  title: '86 an item on the POS for the run (reversible, not a delete)',
  summary: 'Run-side 86 removes the item from ordering for the shift only; the menu record stays intact. Paired with the contact-customers protocol.',
  inputs: [
    { name: 'item', type: 'string', required: true, example: 'Pepperoni Pizza' },
    { name: 'reason', type: 'string', required: true, example: 'out of pepperoni — restock 5 PM' },
  ],
  steps: [
    auto('s-cascade', 'Quantify cascade exposure for shared ingredients', 'audit.86-risk', {}, { citations: [c('heartland.kb.audit-protocol', 'never-86')] }),
    manual('s-pos86', '86 on the handheld/Flex',
      'Select the item line (or use the inventory/86 flow on the terminal) and choose 86. This is run-scoped: it hides the item without touching menu setup, and clears with the next open.',
      [c('toast.card-terminal', '86')]),
    auto('s-workbench', 'Mirror the 86 on the workbench with reason + restore plan', 'menu.item.86', { item: '{item}', reason: '{reason}' }, { fatal: false }),
    auto('s-verify', 'Verify state', 'menu.channel.list', {}, { checks: [{ check: 'item-unavailable', args: { item: '{item}' }, fatal: false }], fatal: false }),
  ],
});

def('toast', {
  id: 'toast.online-sync-check', category: 'integrations', risk: 'low',
  title: 'Pre-flight before Online Ordering / third-party go-live',
  summary: 'Everything third-party channels need: no empty groups, everything published, modifier visibility intent set.',
  inputs: [],
  steps: [
    auto('s-empty', 'Block on empty modifier groups (known sync breaker)', 'audit.empty-groups', {}, { citations: [c('toast.modifier-groups', 'empty-group')], checks: [{ check: 'no-empty-modifier-groups' }] }),
    manual('s-publish', 'Confirm "Publish all changes" completed',
      'If any tile shows unpublished edits, publish them — unpubished changes never reach Online Ordering or delivery integrations.',
      [c('toast.modifier-groups', 'publish')]),
    manual('s-troubleshoot', 'Missing modifiers on a channel?',
      'Plain Optional groups hide themselves until staff opens them; enable "Include a POS prompt" or switch the group Required, then republish.',
      [c('toast.modifier-groups', 'troubleshooting')]),
    auto('s-list', 'Snapshot channel state for the ticket', 'menu.channel.list', {}),
  ],
});

def('toast', {
  id: 'toast.publish-cycle', category: 'operations', risk: 'low',
  title: 'Publish cycle only (after manual portal edits)',
  summary: 'For edits made directly in Toast Web by staff: the gate sequence that makes changes real, with verification.',
  inputs: [],
  steps: [
    manual('s-save', 'Save each edited record', 'Every editor must show "Saved" before publishing — saves stage changes at the account level.', [c('toast.modifier-groups', 'publish')]),
    manual('s-publish', 'Publish all changes', 'Menus > Publish all changes. Wait for the POS tiles to confirm the new revision.', [c('toast.modifier-groups', 'publish')]),
    manual('s-confirm', 'Confirm on a terminal', 'Add the edited item to a test check, cancel the check, verify name/price/modifiers and the printed ticket.', [c('toast.online-ordering', 'visibility')]),
  ],
});

def('toast', {
  id: 'toast.menu-audit-normalize', category: 'audit', risk: 'medium',
  title: 'Audit + normalize a migrated Toast menu (shadow build included)',
  summary: 'Runs the full audit set, gates on client approval, normalizes, isolates shared modifiers, and shadow-builds v2 channels on this console before any cutover discussion.',
  inputs: [
    { name: 'fixModifier', type: 'string', required: false, example: 'Pepperoni' },
  ],
  steps: [
    ...auditThenFix('toast', [c('heartland.kb.audit-protocol', 'protocol')]),
    auto('s-norm', 'Normalize names/casing/duplicate options', 'menu.normalize', {}),
    auto('s-iso', 'Isolate the flagged shared modifier', 'menu.modifier.isolate', { modifier: '{fixModifier}' }, { fatal: false }),
    auto('s-shadow', 'Shadow-build v2 channels (Toast never sees anything until publish)', 'channel.shadow_create', {}),
    auto('s-verify', 'Verify shadows + sync-blockers', 'channel.shadow_verify', {}, { checks: [{ check: 'no-empty-modifier-groups' }, { check: 'shadow-verified' }] }),
    auto('s-fixverify', 'Confirm finding-count improvement vs baseline', 'audit.verify_fix', {}, { checks: [{ check: 'no-empty-modifier-groups' }] }),
  ],
});

def('toast', {
  id: 'toast.eod-close', category: 'operations', risk: 'low',
  title: 'End-of-day close checklist (Day Reporting)',
  summary: 'Manager close-out: reconcile Day Reporting, void reasons, and next-open resets.',
  inputs: [],
  steps: [
    manual('s-dayreport', 'Review Day Reporting before rollover',
      'Terminal close cash drawers, then in Toast Web open Day Reporting: variance per drawer, tips out of sync, and open checks must be zero before the day rolls.',
      [c('toast.day-reporting', 'close')]),
    manual('s-voids', 'Sweep void reasons',
      'Filter the day’s voids; every saved-item void should carry a reason code — chase blanks with shift leads.',
      [c('toast.card-terminal', 'void')]),
    manual('s-86reset', 'Confirm run-scoped 86s are cleared for tomorrow',
      'Any item still 86’d for restock should either return to menu at open or get a proper availability plan for the day.',
      [c('toast.card-terminal', '86')]),
  ],
});

// ══════════════════════════════════ SQUARE (7) ══════════════════════════════
def('square', {
  id: 'square.csv-import', category: 'import', risk: 'medium',
  title: 'Import the item library from CSV (Modify mode) with review gate',
  summary: 'Dashboard > Items > Actions > Import Library > Modify Item Library. The engine parses the real Square export shape, then a mandatory review gate mirrors "Review your changes and click Confirm". Undo Catalogue documented as the escape hatch.',
  inputs: [
    { name: 'file', type: 'string', required: true, example: 'square-export.csv', description: 'a file under data/imports/ (a repo fixture is resolved as a fallback so the example runs)' },
  ],
  steps: [
    manual('s-backup', 'Export the current library first',
      'Items page > Export > CSV. This file is the rollback reference and the exact column template the importer expects.',
      [c('square.library-import-export', 'export')]),
    auto('s-import', 'Parse + normalize the CSV into the staging workbench', 'io.import.menu', { file: '{file}', format: 'square-csv', mode: 'modify' }, { citations: [c('square.library-import-export', 'import-modify')] }),
    auto('s-audit', 'Audit the imported workbench before it can be confirmed', 'audit.full', {}),
    gate('s-confirm', 'Review diff and confirm import (this is Square’s Confirm step)',
      'Compare the summary counts + audit findings against the exported backup. Only then does the change proceed; Square keeps Actions > Undo Catalogue available for a full revert.'),
    manual('s-undo', 'Know the undo path',
      'If anything looks wrong after Confirm: Items page > Actions > Undo Catalogue to roll back to the previous library version.',
      [c('square.library-import-export', 'undo')]),
  ],
});

def('square', {
  id: 'square.csv-export', category: 'export', risk: 'low',
  title: 'Export the library to a Square-shaped CSV',
  summary: 'Writes the MenuFlow review shape (Name, Category Name, Price, Description, Modifier Set, Visible) for handoff, diffing and audit input. The real Square template adds Token/Reference/Variation columns and one Y/N column per existing modifier set, so this file is a spec for the Dashboard sheet, not a drop-in upload (docs/manuals/square.md # menuflow-format).',
  inputs: [],
  steps: [
    auto('s-export', 'Write square-csv to data/exports/', 'io.export.menu', { format: 'square-csv', scope: 'live' }, { citations: [c('square.library-import-export', 'export')] }),
  ],
});

def('square', {
  id: 'square.modifier-vs-option-sets', category: 'modifiers', risk: 'low',
  title: 'Set up Options vs Modifier sets correctly (the classic Square trap)',
  summary: 'Options = variations of the item itself (size); Modifiers = add-ons at order time. Keeps them in separate groups with correct Y-mapping in the CSV.',
  inputs: [
    { name: 'groupName', type: 'string', required: true, example: 'Modifier Sets / Extra Toppings' },
    { name: 'optionName', type: 'string', required: true, example: 'Add Truffle Oil' },
    { name: 'priceDelta', type: 'money', required: false, example: '2.00' },
    { name: 'item', type: 'string', required: false, example: 'Garlic Knots' },
  ],
  steps: [
    manual('s-split', 'Create the right KIND of set',
      'Decide first: is it a variation (option: size, milk) or an add-on (modifier)? Mixed sets create CSV import chaos. In Dashboard: Library > Modifier options / Item options.',
      [c('square.library-items', 'items-vs-modifiers')]),
    auto('s-grp', 'Create the group on the workbench', 'menu.modifier.group.ensure', { name: '{groupName}', shared: false }),
    auto('s-opt', 'Add the option with its price delta', 'menu.modifier.option.upsert', { group: '{groupName}', name: '{optionName}', priceDelta: '{priceDelta}' }),
    auto('s-link', 'Attach to the item — mirrors the "Y" in the Modifier Set column', 'menu.modifier.link', { group: '{groupName}', items: '{item}' }, { citations: [c('square.library-import-export', 'modifier-y')], fatal: false }),
    auto('s-check', 'The new set must not be empty', 'audit.empty-groups', {}, { checks: [{ check: 'no-empty-modifier-groups', args: { group: '{groupName}' } }] }),
  ],
});

def('square', {
  id: 'square.sold-out-86', category: 'operations', risk: 'medium',
  title: '86 safely: Sold-out with scheduled auto-return',
  summary: 'Square supports marking an item temporarily sold out with automatic return — the reversible 86. Never hide items by deleting or unpublishing the category.',
  inputs: [
    { name: 'item', type: 'string', required: true, example: 'Pepperoni Pizza' },
    { name: 'reason', type: 'string', required: true, example: '86 pepperoni until tomorrow 11 AM' },
  ],
  steps: [
    auto('s-cascade', 'Cascade check first', 'audit.86-risk', {}, { citations: [c('heartland.kb.audit-protocol', 'never-86')] }),
    manual('s-soldout', 'Mark Sold out with scheduled return',
      'In the item record (or the Restaurants app during service), set the item Sold out and schedule when it should come back automatically — that removes ordering without breaking reporting history.',
      [c('square.library-items', 'sold-out')]),
    auto('s-mirror', 'Mirror the state on the workbench', 'menu.item.86', { item: '{item}', reason: '{reason}' }, { fatal: false }),
    auto('s-verify', 'Verify availability state', 'menu.channel.list', {}, { checks: [{ check: 'item-unavailable', args: { item: '{item}' }, fatal: false }], fatal: false }),
  ],
});

def('square', {
  id: 'square.channel-availability', category: 'operations', risk: 'low',
  title: 'Per-location / per-channel item availability',
  summary: 'Items carry availability flags for locations and channels (online ordering, pickup, delivery) independently of POS visibility.',
  inputs: [
    { name: 'item', type: 'string', required: true, example: 'Draft Beer' },
    { name: 'channels', type: 'string[]', required: true, example: 'Online, Carry-Out' },
    { name: 'enabled', type: 'string', required: false, example: 'true|false' },
  ],
  steps: [
    auto('s-set', 'Toggle channel visibility on the workbench', 'menu.item.set_availability', { item: '{item}', channels: '{channels}', enabled: '{enabled}' }),
    manual('s-portal', 'Set it in the Dashboard too',
      'Item record > availability: pick locations and channels explicitly. An item can be visible on POS but hidden from online ordering (and vice-versa) — set both sides deliberately.',
      [c('square.library-items', 'fields')]),
    auto('s-verify', 'Confirm the state', 'menu.channel.list', {}),
  ],
});

def('square', {
  id: 'square.price-update', category: 'pricing', risk: 'low',
  title: 'Update a price (single item, with verification)',
  summary: 'Single-item price change on the workbench, verified, mirrored via Library edit or a one-row Modify-mode CSV import.',
  inputs: [
    { name: 'item', type: 'string', required: true, example: 'Caesar' },
    { name: 'price', type: 'money', required: true, example: '10.50' },
  ],
  steps: [
    auto('s-set', 'Set the new price on the workbench', 'menu.item.set_price', { item: '{item}', price: '{price}' }),
    manual('s-portal', 'Apply in Dashboard (or a Modify-mode CSV)',
      'Library > Items > edit the price — or export, change the one row, re-import with Modify Item Library. Never use Replace for a price tweak.',
      [c('square.library-import-export', 'import-modify')]),
    auto('s-verify', 'Verify price landed', 'menu.channel.list', {}, { checks: [{ check: 'item-price', args: { item: '{item}', price: '{price}' } }] }),
  ],
});

def('square', {
  id: 'square.menu-transfer-replace', category: 'import', risk: 'high',
  title: 'Full menu migration with Replace Item Library (gated, with caveat sweep)',
  summary: 'Replace deletes the entire library first — Square also does NOT carry display groups, advanced modifier settings, or auto-add across accounts. This flow forces backup, written approval, import, and a settings re-check sweep.',
  inputs: [
    { name: 'file', type: 'string', required: true, example: 'new-library.csv', description: 'a file under data/imports/ (a repo fixture is resolved as a fallback so the example runs)' },
    { name: 'approvalRef', type: 'string', required: true, example: 'client approval email id' },
  ],
  steps: [
    manual('s-backup', 'Export the current library (rollback = re-import this)', 'Items > Export > CSV; store the file with the approval ref.', [c('square.library-import-export', 'export')]),
    gate('s-approval', 'Written approval for REPLACE (library destruction follows)',
      'Replace Item Library deletes ALL existing items before importing. Attach the approval reference, expected item counts, and the list of settings that will need re-doing afterward.'),
    auto('s-import', 'Parse into the workbench with replace semantics', 'io.import.menu', { file: '{file}', format: 'square-csv', mode: 'replace' }, { citations: [c('square.library-import-export', 'import-replace')] }),
    auto('s-clean', 'Drop referenced-but-empty modifier groups created by the CSV (fill-or-delete rule)', 'menu.modifier.remove_empty', {}),
    auto('s-audit', 'Audit the replaced menu', 'audit.full', {}),
    manual('s-settings', 'Re-apply restaurant-specific settings that do NOT transfer',
      'Recreate display groups, advanced modifier settings, and auto-add-to-check rules in the target account — CSV migration silently drops them.',
      [c('square.transfer-note', 'caveat')]),
    gate('s-go', 'Confirm Replace + publish', 'Only after the counts, audit, and settings sweep look right: Confirm import in Dashboard, then publish from this console.'),
    auto('s-pub', 'Publish the workbench to live', 'publish.apply', {}),
  ],
});

// ══════════════════════════════════ CLOVER (6) ══════════════════════════════
def('clover', {
  id: 'clover.item-create', category: 'menu', risk: 'low',
  title: 'Add a menu item (Items / Menu management)',
  summary: 'Create the item, place it in the menu/group, attach modifier (option) groups, with icons and prices set the way the owner guide describes.',
  inputs: [
    { name: 'itemName', type: 'string', required: true, example: 'Nashville Hot Chicken Pizza' },
    { name: 'group', type: 'string', required: true, example: 'Pizza' },
    { name: 'price', type: 'money', required: true, example: '17.00' },
  ],
  steps: [
    auto('s-cat', 'Ensure group/category', 'menu.category.ensure', { name: '{group}' }),
    auto('s-item', 'Create on workbench', 'menu.item.upsert', { name: '{itemName}', category: '{group}', price: '{price}' }),
    manual('s-portal', 'Create in Clover menu management',
      'Setup > Menu: add the item under the right group, set price + icon, and attach the modifier (option) groups. Suggested items: up to 3 per category appear next to this item on the customer-facing devices.',
      [c('clover.item-editor', 'create')]),
    auto('s-verify', 'Verify', 'menu.channel.list', {}, { checks: [{ check: 'item-exists', args: { item: '{itemName}' } }] }),
  ],
});

def('clover', {
  id: 'clover.modifier-groups', category: 'modifiers', risk: 'medium',
  title: 'Build option groups with min/max + Pop Up Automatically',
  summary: 'The kiosk/POS-correct modifier setup: min/max selections, auto-pop behavior, and — when serving both staff and kiosk — duplicate the group per interface and disable the unused side.',
  inputs: [
    { name: 'groupName', type: 'string', required: true, example: 'Crust Style' },
    { name: 'optionName', type: 'string', required: false, example: 'Thin Crust' },
    { name: 'min', type: 'number', required: false, example: '1' },
    { name: 'max', type: 'number', required: true, example: '1' },
    { name: 'popup', type: 'string', required: false, example: 'yes|no' },
  ],
  steps: [
    auto('s-grp', 'Create the group with selection rules', 'menu.modifier.group.ensure', { name: '{groupName}', minChoices: '{min}', maxChoices: '{max}' }, { citations: [c('clover.item-editor', 'modifier-groups')] }),
    auto('s-opt', 'Add the first option (prevents the empty-group sync breaker)', 'menu.modifier.option.upsert', { group: '{groupName}', name: '{optionName}' }, { fatal: false }),
    manual('s-popup', 'Pop Up Automatically',
      'Set Pop Up Automatically = YES only when the group must be answered (min 1). For kiosk-specific builds: create "Toppings – Kiosk", set its popup = NO, and turn OFF the staff-side group in the other interface so the two never drift.',
      [c('clover.item-editor', 'popup')]),
    manual('s-kiosk', 'Kiosk duplicate pattern',
      'Menu Modifiers tab: rename the group for kiosk display only, and set min/max per the customer flow. Never share one group across staff + kiosk with conflicting rules.',
      [c('clover.sync', 'kiosk-groups')], { fatal: false }),
    auto('s-guard', 'The new group must not be empty', 'audit.empty-groups', {}, { checks: [{ check: 'no-empty-modifier-groups', args: { group: '{groupName}' } }] }),
  ],
});

def('clover', {
  id: 'clover.price-sync', category: 'pricing', risk: 'low',
  title: 'Price change with correct sync expectations',
  summary: 'Prices/availability propagate in ~10 minutes; structural edits (names, modifier groups) in ~4 hours — the workflow forces the sync so verification is meaningful.',
  inputs: [
    { name: 'item', type: 'string', required: true, example: 'Margherita Pizza' },
    { name: 'price', type: 'money', required: true, example: '13.00' },
  ],
  steps: [
    auto('s-set', 'Set the price on the workbench', 'menu.item.set_price', { item: '{item}', price: '{price}' }),
    manual('s-sync', 'Force sync before verifying',
      'After structural changes, click "Sync with Clover" so data pushes within ~10 minutes instead of the ~4-hour window — then verify on the customer-facing channel.',
      [c('clover.sync', 'windows'), c('clover.sync', 'force-sync')]),
    auto('s-verify', 'Verify price', 'menu.channel.list', {}, { checks: [{ check: 'item-price', args: { item: '{item}', price: '{price}' } }] }),
  ],
});

def('clover', {
  id: 'clover.inventory-86', category: 'operations', risk: 'medium',
  title: 'Run-out via inventory counts / availability (never delete)',
  summary: 'Zero the inventory count or mark the item unavailable — dependent items grey out instead of vanishing; deleting menu records is irreversible for reporting.',
  inputs: [
    { name: 'item', type: 'string', required: true, example: 'Buffalo Wings' },
    { name: 'reason', type: 'string', required: true, example: 'wing supplier miss' },
  ],
  steps: [
    auto('s-cascade', 'Cascade exposure report', 'audit.86-risk', {}, { citations: [c('heartland.kb.audit-protocol', 'never-86')] }),
    manual('s-count', 'Set inventory to zero (or mark group unavailable)',
      'Inventory app > item > count 0 with the auto-unavailable behavior; or Menu management > set the item/group unavailable. Reversible and keeps history.',
      [c('clover.inventory', 'count'), c('clover.inventory', '86')]),
    auto('s-mirror', 'Mirror on the workbench', 'menu.item.86', { item: '{item}', reason: '{reason}' }, { fatal: false }),
    auto('s-verify', 'Verify state', 'menu.channel.list', {}, { checks: [{ check: 'item-unavailable', args: { item: '{item}' }, fatal: false }], fatal: false }),
  ],
});

def('clover', {
  id: 'clover.online-sync', category: 'integrations', risk: 'low',
  title: 'Online ordering / kiosk sync verification',
  summary: 'After structural changes, force sync and verify price+availability windows; confirms channel visibility matches intent.',
  inputs: [],
  steps: [
    manual('s-force', 'Force the sync', 'Commandpoint/integration panel > "Sync with Clover"; price and availability land within ~10 minutes; everything else follows the 4-hour window.', [c('clover.sync', 'force-sync'), c('clover.sync', 'windows')]),
    auto('s-list', 'Snapshot channels', 'menu.channel.list', {}),
    manual('s-verify', 'Verify on the customer-facing device', 'Open the kiosk/online menu as a guest: item names, prices, option popups and group availability must match the POS exactly. Log any drift with timestamps for the support case.', [c('clover.sync', 'windows')]),
  ],
});

def('clover', {
  id: 'clover.menu-audit-normalize', category: 'audit', risk: 'medium',
  title: 'Audit + normalize (shared modifier isolation, shadows, sync preflight)',
  summary: 'The Signal F audit pipeline on a Clover account: full audit, written approval gate, normalize, isolate cross-category modifiers, shadow channels, empty-group blocker sweep.',
  inputs: [
    { name: 'fixModifier', type: 'string', required: false, example: 'Pepperoni' },
  ],
  steps: [
    ...auditThenFix('clover', [c('heartland.kb.audit-protocol', 'protocol')]),
    auto('s-norm', 'Normalize casing/prices/duplicate options', 'menu.normalize', {}),
    auto('s-iso', 'Isolate the flagged shared modifier', 'menu.modifier.isolate', { modifier: '{fixModifier}' }, { fatal: false }),
    auto('s-shadow', 'Shadow v2 channels', 'channel.shadow_create', {}),
    auto('s-verify', 'Verify shadows + sync blockers', 'channel.shadow_verify', {}, { checks: [{ check: 'no-empty-modifier-groups' }, { check: 'shadow-verified' }] }),
  ],
});

// ══════════════════════════════ LIGHTSPEED (6) ══════════════════════════════
def('lightspeed', {
  id: 'lightspeed.item-create', category: 'menu', risk: 'low',
  title: 'Add an item (Back Office > Menu > Item list)',
  summary: 'Create items in the K-Series Back Office; SKU auto-generates if blank; the item becomes orderable once on the right menu.',
  inputs: [
    { name: 'itemName', type: 'string', required: true, example: 'Cacio e Pepe' },
    { name: 'category', type: 'string', required: true, example: 'Pasta' },
    { name: 'price', type: 'money', required: true, example: '15.50' },
  ],
  steps: [
    auto('s-cat', 'Ensure category', 'menu.category.ensure', { name: '{category}' }),
    auto('s-item', 'Create on workbench', 'menu.item.upsert', { name: '{itemName}', category: '{category}', price: '{price}' }),
    manual('s-bo', 'Create in the Back Office item list',
      'Back Office > Menu > Item list > Create > Item: name, price, accounting group, allergens/notes. Leave SKU blank to auto-generate. Then add the item to the relevant menus.',
      [c('lightspeed.menus', 'structure'), c('lightspeed.item-list', 'table')]),
    auto('s-verify', 'Verify', 'menu.channel.list', {}, { checks: [{ check: 'item-exists', args: { item: '{itemName}' } }] }),
  ],
});

def('lightspeed', {
  id: 'lightspeed.modifier-group-create', category: 'modifiers', risk: 'low',
  title: 'Create a modifier group + modifiers (and attach)',
  summary: 'Menu > Item list > Create > Modifier group; existing modifiers are found by name search to prevent duplicate entries — the engine mirrors that: reuse by normalized name.',
  inputs: [
    { name: 'groupName', type: 'string', required: true, example: 'Extra sauces' },
    { name: 'optionName', type: 'string', required: true, example: 'Extra garlic sauce' },
    { name: 'priceDelta', type: 'money', required: false, example: '1.50' },
    { name: 'item', type: 'string', required: false, example: 'Garlic Knots' },
  ],
  steps: [
    auto('s-grp', 'Create/reuse the group (name-search semantics)', 'menu.modifier.group.ensure', { name: '{groupName}', shared: false }, { citations: [c('lightspeed.item-list', 'create')] }),
    auto('s-opt', 'Add the modifier option', 'menu.modifier.option.upsert', { group: '{groupName}', name: '{optionName}', priceDelta: '{priceDelta}' }),
    auto('s-link', 'Attach to the item record (Details > Modifier groups)', 'menu.modifier.link', { group: '{groupName}', items: '{item}' }, { citations: [c('lightspeed.item-list', 'unlink')], fatal: false }),
    auto('s-guard', 'The new group must have modifiers attached', 'audit.empty-groups', {}, { checks: [{ check: 'no-empty-modifier-groups', args: { group: '{groupName}' } }] }),
  ],
});

def('lightspeed', {
  id: 'lightspeed.archive-item', category: 'menu', risk: 'high',
  title: 'Archive an item — multi-location blast-radius gate',
  summary: 'Archive removes the record from ALL menus at ALL locations at once. The gate forces a scope check first; delete is not offered for menu records.',
  inputs: [
    { name: 'item', type: 'string', required: true, example: 'Sausage Pizza' },
    { name: 'reason', type: 'string', required: true, example: 'retired after tasting-menu experiment' },
  ],
  steps: [
    gate('s-scope', 'Confirm scope across locations/menus (blast radius)',
      'List every menu/location referencing this item. Archive is account-wide — a second menu in another venue disappears at the same instant. Written confirmation of the exact scope is mandatory.'),
    auto('s-check', 'Cascade check before removal', 'audit.86-risk', {}, { citations: [c('heartland.kb.audit-protocol', 'never-86')] }),
    auto('s-archive', 'Archive on the workbench (record retained, recoverable)', 'menu.item.archive', { item: '{item}', reason: '{reason}' }, { citations: [c('lightspeed.item-list', 'archive')], fatal: false }),
    manual('s-bo', 'Archive in the Back Office', 'Menu > Item list > three-dot menu beside the item > Archive. Un-archive later from the same menu if needed.', [c('lightspeed.item-list', 'archive')]),
    auto('s-floor', 'Safety floor: menu still substantial', 'menu.channel.list', {}, { checks: [{ check: 'item-count-min', args: { min: 10 } }] }),
  ],
});

def('lightspeed', {
  id: 'lightspeed.price-list-daypart', category: 'pricing', risk: 'medium',
  title: 'Happy hour via price list + period (the K-Series way)',
  summary: 'Day-parted pricing uses price lists with periods attached to menus — model the rule on the workbench, then mirror in Back Office.',
  inputs: [
    { name: 'name', type: 'string', required: true, example: 'Happy Hour 4-6' },
    { name: 'price', type: 'money', required: true, example: '3.00' },
    { name: 'item', type: 'string', required: true, example: 'Draft Beer' },
    { name: 'start', type: 'string', required: true, example: '2:00 PM' },
    { name: 'end', type: 'string', required: true, example: '3:00 PM' },
  ],
  steps: [
    auto('s-rule', 'Create the force-price rule (engine keeps the stack sorted)', 'menu.pricing.rule.add', { name: '{name}', type: 'force', value: '{price}', items: '{item}', start: '{start}', end: '{end}', postTax: false }, { citations: [c('lightspeed.menus', 'price-lists')] }),
    manual('s-bo', 'Build the price list + period',
      'Back Office > Menu > Price lists: create "Happy Hour 4-6", add the period (days + start/end), attach to the menu that serves that day part. Items not in the price list keep base prices.',
      [c('lightspeed.menus', 'price-lists')]),
    auto('s-verify', 'No dead force rules', 'audit.pricing', {}, { checks: [{ check: 'no-dead-force-price' }] }),
  ],
});

def('lightspeed', {
  id: 'lightspeed.menu-import', category: 'import', risk: 'medium',
  title: 'Bulk menu import (CSV) with audit + publish gate',
  summary: 'Load menu structure via the Back Office import utilities; the workbench parses the same CSV shape this console exports for Lightspeed, audits it, and gates publication.',
  inputs: [
    { name: 'file', type: 'string', required: true, example: 'lightspeed-menu.csv', description: 'a file under data/imports/ (a repo fixture is resolved as a fallback so the example runs)' },
  ],
  steps: [
    manual('s-prepare', 'Prepare the CSV from an exported template',
      'Customize the Item list table (Edit table), export a shape to copy, fill rows: type (category/item), name, category, price, modifier groups, available yes/no.',
      [c('lightspeed.menus', 'import'), c('lightspeed.item-list', 'table')]),
    auto('s-import', 'Import into the workbench (normalize on the way in)', 'io.import.menu', { file: '{file}', format: 'lightspeed-csv' }),
    auto('s-clean', 'CSVs carry group names without options — fold the artifacts (empty referenced groups are sync-breakers)', 'menu.modifier.remove_empty', {}, { citations: [c('signalF.shared-rules', 'empty-groups')] }),
    auto('s-audit', 'Full audit of the imported structure', 'audit.full', {}),
    gate('s-confirm', 'Review + confirm (Back Office shows its own import preview — reconcile counts first)', 'Import counts here must match the preview counts in the portal before confirming.'),
    auto('s-publish', 'Publish workbench in this console', 'publish.apply', {}),
  ],
});

def('lightspeed', {
  id: 'lightspeed.menu-audit-normalize', category: 'audit', risk: 'medium',
  title: 'Audit + normalize + shadows (K-Series build)',
  summary: 'Same Signal F pipeline, K-Series semantics: archive not delete; empty groups blocked; price-list sanity.',
  inputs: [
    { name: 'fixModifier', type: 'string', required: false, example: 'Pepperoni' },
  ],
  steps: [
    ...auditThenFix('lightspeed', [c('heartland.kb.audit-protocol', 'protocol')]),
    auto('s-norm', 'Normalize', 'menu.normalize', {}),
    auto('s-iso', 'Isolate shared modifier if flagged', 'menu.modifier.isolate', { modifier: '{fixModifier}' }, { fatal: false }),
    auto('s-shadow', 'Shadow channels', 'channel.shadow_create', {}),
    auto('s-verify', 'Verify shadows', 'channel.shadow_verify', {}, { checks: [{ check: 'no-empty-modifier-groups' }, { check: 'shadow-verified' }] }),
  ],
});

// ══════════════════════════════ TOUCHBISTRO (6) ══════════════════════════════
def('touchbistro', {
  id: 'touchbistro.item-create', category: 'menu', risk: 'low',
  title: 'Add a menu item (sales category, course, tax, printers)',
  summary: 'RMM/Menu build: sales category, course inheritance from category (override when needed), tax line, and kitchen printer routing — the exact settings the review screen shows.',
  inputs: [
    { name: 'itemName', type: 'string', required: true, example: 'Carbonara' },
    { name: 'category', type: 'string', required: true, example: 'Pasta' },
    { name: 'price', type: 'money', required: true, example: '16.00' },
    { name: 'course', type: 'number', required: false, example: '2' },
  ],
  steps: [
    auto('s-cat', 'Ensure sales category', 'menu.category.ensure', { name: '{category}' }),
    auto('s-item', 'Create item on workbench', 'menu.item.upsert', { name: '{itemName}', category: '{category}', price: '{price}', course: '{course}' }),
    manual('s-rmm', 'Configure the item in Menu/RMM',
      'Set: Sales Category; Course (inherit the category’s, override only when needed — e.g. iced coffees on the dessert course); tax setting; kitchen printers for firing. The item review line must read: Category · Visible · Course / Tax / Printers.',
      [c('touchbistro.menu-items', 'fields'), c('touchbistro.menu-items', 'course')]),
    auto('s-verify', 'Verify', 'menu.channel.list', {}, { checks: [{ check: 'item-exists', args: { item: '{itemName}' } }] }),
  ],
});

def('touchbistro', {
  id: 'touchbistro.86-hide', category: 'operations', risk: 'low',
  title: '86 = X next to POS (record stays)',
  summary: 'TouchBistro hides an item from POS ordering by clicking the X beside POS — the canonical reversible 86. Online Ordering visibility is a separate control and must be set deliberately.',
  inputs: [
    { name: 'item', type: 'string', required: true, example: 'Pepperoni Pizza' },
    { name: 'reason', type: 'string', required: true, example: 'market miss — back Thursday' },
  ],
  steps: [
    auto('s-cascade', 'Cascade exposure check', 'audit.86-risk', {}, { citations: [c('heartland.kb.audit-protocol', 'never-86')] }),
    manual('s-x', 'Click the X icon next to POS on the item',
      'Menu > item > enable/disable: the X beside POS hides it from in-house ordering without deleting anything; leave the Online Ordering toggle as the situation demands (it is independent).',
      [c('touchbistro.menu-items', 'hide'), c('touchbistro.menu-items', 'online')]),
    auto('s-mirror', 'Mirror 86 on the workbench', 'menu.item.86', { item: '{item}', reason: '{reason}' }, { fatal: false }),
    auto('s-verify', 'Verify state', 'menu.channel.list', {}, { checks: [{ check: 'item-unavailable', args: { item: '{item}' }, fatal: false }], fatal: false }),
  ],
});

def('touchbistro', {
  id: 'touchbistro.online-visibility', category: 'integrations', risk: 'low',
  title: 'Online Ordering availability toggle (per item, independent of POS)',
  summary: 'Enable/disable each item for Online Ordering via its drop-down without touching POS visibility — e.g. keep wings POS-only during a rush.',
  inputs: [
    { name: 'item', type: 'string', required: true, example: 'Buffalo Wings' },
    { name: 'enabled', type: 'string', required: true, example: 'true|false' },
  ],
  steps: [
    manual('s-toggle', 'Set the Online Ordering toggle',
      'Menu > item > Online Ordering drop-down: enable or X it out. This control is independent of the POS X — set both per intent.',
      [c('touchbistro.menu-items', 'online')]),
    auto('s-mirror', 'Mirror on the workbench channel visibility', 'menu.item.set_availability', { item: '{item}', channels: ['Online'], enabled: '{enabled}' }),
    auto('s-verify', 'Snapshot', 'menu.channel.list', {}),
  ],
});

def('touchbistro', {
  id: 'touchbistro.courses-setup', category: 'kitchen', risk: 'low',
  title: 'Course assignment + kitchen fire consistency',
  summary: 'Assign categories/items to courses (apps 1 / entrees 2 / desserts 3) and kill Rush+Hold contradictions that scramble the kitchen queue.',
  inputs: [],
  steps: [
    auto('s-scan', 'Find course-0 full-service items and flag conflicts', 'audit.coursing', {}, { citations: [c('heartland.kb.coursing', 'audit')] }),
    auto('s-fix', 'Resolve a Rush+Hold conflict on the workbench', 'menu.item.set_course', { item: 'Buffalo Wings', course: 1, rush: false, hold: false }, { citations: [c('touchbistro.owner-guide', 'courses')] }),
    auto('s-verify', 'Verify no conflicts remain', 'audit.coursing', {}, { checks: [{ check: 'no-rush-hold-conflict' }] }),
  ],
});

def('touchbistro', {
  id: 'touchbistro.price-tax-change', category: 'pricing', risk: 'low',
  title: 'Price update + tax preset verification',
  summary: 'After any price edit or import, re-verify the item’s tax line — TouchBistro keeps tax per item/category and it silently follows the wrong preset otherwise.',
  inputs: [
    { name: 'item', type: 'string', required: true, example: 'Draft Beer' },
    { name: 'price', type: 'money', required: true, example: '7.00' },
  ],
  steps: [
    auto('s-price', 'Set the price on the workbench', 'menu.item.set_price', { item: '{item}', price: '{price}' }),
    manual('s-tax', 'Re-verify the tax setting after the change',
      'Review screen line 2 is the tax setting — alcohol vs food presets must be re-checked after any price import, not assumed.',
      [c('touchbistro.owner-guide', 'tax')]),
    auto('s-verify', 'Verify price', 'menu.channel.list', {}, { checks: [{ check: 'item-price', args: { item: '{item}', price: '{price}' } }] }),
  ],
});

def('touchbistro', {
  id: 'touchbistro.menu-audit-normalize', category: 'audit', risk: 'medium',
  title: 'Audit + normalize (TouchBistro build)',
  summary: 'Full pipeline: audit, gate, normalize, isolate, course sweep, shadow channels, verification checks.',
  inputs: [
    { name: 'fixModifier', type: 'string', required: false, example: 'Pepperoni' },
  ],
  steps: [
    ...auditThenFix('touchbistro', [c('heartland.kb.audit-protocol', 'protocol')]),
    auto('s-norm', 'Normalize casing/prices/options', 'menu.normalize', {}),
    auto('s-iso', 'Isolate the flagged modifier', 'menu.modifier.isolate', { modifier: '{fixModifier}' }, { fatal: false }),
    auto('s-course', 'Coursing sweep', 'audit.coursing', {}),
    auto('s-shadow', 'Shadow v2 channels', 'channel.shadow_create', {}),
    auto('s-verify', 'Verify', 'channel.shadow_verify', {}, { checks: [{ check: 'shadow-verified' }] }),
  ],
});

// ══════════════════════════════════ ALOHA (6) ══════════════════════════════
def('aloha', {
  id: 'aloha.adm-menu-structure-audit', category: 'audit', risk: 'medium',
  title: 'Menu structure audit (blocks → sections → items)',
  summary: 'Legacy-manual platform: confirm the ADM hierarchy before automated scans; then run the full canonical audit against the exported menu.',
  inputs: [],
  steps: [
    manual('s-confirm', 'Confirm ADM hierarchy matches the running POS build',
      'ADM: menu = ordered blocks; blocks contain sections; sections hold items with attached modifiers. Export the menu (or use the latest export) and confirm revision/date matches the terminals — Aloha config drifts across versions; re-verify against the client’s manual revision.',
      [c('aloha.adm-menu', 'structure')]),
    auto('s-audit', 'Full canonical audit on the workbench', 'audit.full', {}),
    gate('s-review', 'Findings review with the client', 'Present HIGH/MEDIUM findings (86-cascade, cross-contamination, midnight ranges). Written scope decision follows before edits.'),
  ],
});

def('aloha', {
  id: 'aloha.modifier-setup', category: 'modifiers', risk: 'low',
  title: 'Define modifiers once, attach deliberately',
  summary: 'Aloha pattern: modifier definitions live centrally (typo-tape style) and attach to items/sections with forced entry; the workbench mirrors with isolated groups by default.',
  inputs: [
    { name: 'groupName', type: 'string', required: true, example: 'Steak Doneness' },
    { name: 'optionName', type: 'string', required: true, example: 'Medium Rare' },
    { name: 'maxChoices', type: 'number', required: false, example: '1' },
  ],
  steps: [
    manual('s-adm', 'Create the modifier definition in ADM',
      'Define once in ADM with price deltas and forced-entry flags; attach to items/sections. Do not create per-item duplicates for the same real-world add-on — reuse the definition, but keep per-category items scoped (KB isolation rule).',
      [c('aloha.adm-menu', 'modifiers')]),
    auto('s-grp', 'Mirror on the workbench', 'menu.modifier.group.ensure', { name: '{groupName}', minChoices: 1, maxChoices: '{maxChoices}', shared: false }),
    auto('s-opt', 'Add the option', 'menu.modifier.option.upsert', { group: '{groupName}', name: '{optionName}' }),
    auto('s-guard', 'Empty-group guard on the new record', 'audit.empty-groups', {}, { checks: [{ check: 'no-empty-modifier-groups', args: { group: '{groupName}' } }] }),
  ],
});

def('aloha', {
  id: 'aloha.shift-86', category: 'operations', risk: 'medium',
  title: 'Run-side 86 (shift scope) + next-open reset',
  summary: 'Use the POS 86 screen during service — the menu definition stays intact; 86s must be cleared before the next open per the operator reference.',
  inputs: [
    { name: 'item', type: 'string', required: true, example: 'Buffalo Wings' },
    { name: 'reason', type: 'string', required: true, example: 'purveyor short — 86 tonight only' },
  ],
  steps: [
    auto('s-cascade', 'Cascade exposure first', 'audit.86-risk', {}, { citations: [c('heartland.kb.audit-protocol', 'never-86')] }),
    manual('s-86', '86 at the terminal', 'Aloha POS > 86 screen: select the item; it is removed from ordering for the current shift only — menu definitions in ADM are untouched.', [c('aloha.pos-86', '86')]),
    auto('s-mirror', 'Mirror on the workbench', 'menu.item.86', { item: '{item}', reason: '{reason}' }, { fatal: false }),
    manual('s-clear', 'Clear 86s before the next open', 'During EOD, verify the 86 list is emptied or consciously carried; stale 86s are the #1 "ghost menu" complaint.', [c('aloha.pos-86', 'eod')], { checks: [{ check: 'item-unavailable', args: { item: '{item}' }, fatal: false }], fatal: false }),
  ],
});

def('aloha', {
  id: 'aloha.tax-pricing', category: 'pricing', risk: 'medium',
  title: 'Tax rate definitions + per-item assignment',
  summary: 'Rates live centrally in ADM and attach per item/section (food vs alcohol vs merchandise). Misassigned tax is a common migration bug; set and verify both sides.',
  inputs: [
    { name: 'taxName', type: 'string', required: true, example: 'Alcohol' },
    { name: 'ratePct', type: 'number', required: true, example: '12.0' },
    { name: 'items', type: 'string[]', required: false, example: 'Draft Beer' },
  ],
  steps: [
    auto('s-set', 'Define/assign on the workbench', 'menu.tax.ensure', { name: '{taxName}', ratePct: '{ratePct}', items: '{items}' }, { citations: [c('aloha.adm-menu', 'tax')] }),
    manual('s-adm', 'Mirror in ADM', 'ADM: tax rates > define; assign the rate to the matching item/section records. Then ring one of each on a test ticket and read the tax lines before service.', [c('aloha.adm-menu', 'tax')]),
  ],
});

def('aloha', {
  id: 'aloha.eod-close', category: 'operations', risk: 'low',
  title: 'End-of-day close checklist',
  summary: 'Roll the day on the terminals, verify 86 clears and cash/charge totals reconcile per the operator reference.',
  inputs: [],
  steps: [
    manual('s-eod', 'Run EOD reports', 'Terminal: End of Day > roll the business day; verify no open shifts and every drawer closed. Keep the EOD packet with the audit files.', [c('aloha.pos-86', 'eod')]),
    manual('s-86clear', 'Confirm the 86 list reset for tomorrow', 'The shift-scoped 86s should not survive into the next open unless intentionally carried.', [c('aloha.pos-86', '86')]),
    auto('s-snapshot', 'Snapshot channel/workbench state for the log', 'menu.channel.list', {}),
  ],
});

def('aloha', {
  id: 'aloha.menu-audit-normalize', category: 'rebuild', risk: 'high',
  title: 'Aloha menu rebuild pipeline (audit → gate → normalize → shadow → verify)',
  summary: 'The five-step rebuild for an Aloha venue: canonical audit first, written approval, normalization + isolation + midnight sweep, v2 shadow workbench, verification — ADM-side changes are made by the operator between gates.',
  inputs: [
    { name: 'fixModifier', type: 'string', required: false, example: 'Pepperoni' },
  ],
  steps: [
    ...auditThenFix('aloha', [c('heartland.kb.audit-protocol', 'protocol')]),
    auto('s-norm', 'Normalize the workbench menu', 'menu.normalize', {}),
    auto('s-iso', 'Isolate flagged shared modifier', 'menu.modifier.isolate', { modifier: '{fixModifier}' }, { fatal: false }),
    auto('s-mid', 'Split midnight-crossing ranges', 'audit.midnight', {}, { checks: [{ check: 'no-midnight-violations', args: {}, fatal: false }], fatal: false }),
    auto('s-shadow', 'Shadow v2 channels', 'channel.shadow_create', {}),
    auto('s-verify', 'Verify shadow structure', 'channel.shadow_verify', {}, { checks: [{ check: 'shadow-verified' }] }),
    manual('s-admrebuild', 'Operator applies the rebuilt structure in ADM', 'Between gates: rebuild blocks/sections/modifiers in ADM exactly as the workbench shows; export the new build and re-import here (io.import.menu) for parity confirmation.', [c('aloha.adm-menu', 'structure')]),
  ],
});

// ──────────────────── bulk-file coverage: one import/export contract per platform ────────────────────
// Every system encodes a menu differently in its bulk file - most of all the modifiers. These
// workflows make that difference executable rather than a footnote: name the vendor surface,
// stage into the workbench, audit it, gate it, then finish on the portal-side manual step with
// the citation from docs/manuals/<platform>.md that justifies it.

def('toast', {
  id: 'toast.bulk-menu-import', category: 'import', risk: 'high',
  title: 'Bulk menu change through the Toast import tool (operation rows; irreversible)',
  summary: 'Menus > Bulk management > Bulk import tool. Stages a toast-csv change set, audits it (empty modifier groups break third-party syncs on Toast), then the operator re-emits it as operation rows before the irreversible upload. Save, then Publish all changes.',
  inputs: [
    { name: 'file', type: 'string', required: true, example: 'toast-menu.csv', description: 'a file under data/imports/ (a repo fixture is resolved as a fallback so the example runs)' },
  ],
  steps: [
    manual('s-package', 'Confirm the package entitlement before quoting a bulk change',
      'The bulk import tool needs Restaurant Management Essentials, Pro or Enterprise, or the multi-location module. On a base package the same work is manual entry in Toast Web - price the engagement that way.',
      [c('toast.manual', 'access-requirement')]),
    manual('s-backup', 'Export the current menu and file it with the approval reference',
      'Menu management > Bulk management > Advanced properties is where you export, archive and restore. Toast states that bulk-import changes are not reversible, so this export is the entire rollback plan.',
      [c('toast.manual', 'irreversibility'), c('toast.manual', 'items-database-exports')]),
    auto('s-import', 'Stage the change set from the MenuFlow review file', 'io.import.menu',
      { file: '{file}', format: 'toast-csv', mode: 'modify' }, { citations: [c('toast.manual', 'menuflow-format')] }),
    auto('s-audit', 'Audit the staged workbench before anything can be confirmed', 'audit.full', {},
      { fatal: false, notes: 'findings are advisory here: the gate is where the human decides',
        checks: [{ check: 'no-empty-modifier-groups' }] }),
    auto('s-empty', 'Clear empty modifier groups (they break delivery integrations on Toast)', 'menu.modifier.remove_empty', {}, { fatal: false }),
    gate('s-confirm', 'Approve the rebuild plan - Toast cannot undo this upload',
      'Confirm the counts against the backup export and record that the client accepts the irreversibility before any row is submitted.'),
    manual('s-rows', 'Re-emit as operation rows on a copy of the template',
      'Copy the template inside the tool (the validation lists live in the copy), then one row per operation: Operation=CREATE, Entity type=MENU_ITEM / MODIFIER_GROUP / MODIFIER, a unique Operation ID, and the parent named with Parent entity type + Parent version ID or operation ID (the Toast GUID if it already exists, otherwise the Operation ID of the row that creates it). Group pricing: BASE charges the group price; PRICED_BY_MODIFIERS puts prices on the modifier rows and leaves the group Price cell empty. Prices are strings - no currency symbol, and (1.00) means a reduction.',
      [c('toast.manual', 'operation-rows'), c('toast.manual', 'parent-attach'), c('toast.manual', 'pricing-strategies'), c('toast.manual', 'price-string-rules')]),
    manual('s-publish', 'Save, then Publish all changes, then verify on a device',
      'An un-published edit never reaches the terminals. Ring the edited item into a test check on a POS/Flex and read the printed ticket before closing.',
      [c('toast.manual', 'publish-cycle')]),
  ],
});

def('toast', {
  id: 'toast.items-database-export', category: 'export', risk: 'low',
  title: 'Export the menu for handoff (review format - not a Toast upload file)',
  summary: 'Writes toast-csv (Group Name, Item Name, Price, Description, Modifier Groups, Modifiers, Available) from the live menu for audit, diffing and third-party handoff, with the mapping to the operation-row template stated on the step.',
  inputs: [],
  steps: [
    auto('s-export', 'Write toast-csv to data/exports/', 'io.export.menu', { format: 'toast-csv', scope: 'live' },
      { citations: [c('toast.manual', 'menuflow-format')] }),
    manual('s-map', 'If this feeds the import tool, re-emit as operation rows',
      'One row per item is a review shape, not a Toast import. Convert to Operation / Entity type / Operation ID rows, and remember the upload cannot be reversed - take a fresh Items Database export of the destination first.',
      [c('toast.manual', 'operation-rows'), c('toast.manual', 'irreversibility')]),
  ],
});

def('clover', {
  id: 'clover.bulk-item-import', category: 'import', risk: 'medium',
  title: 'Bulk item import via the Clover workbook (tabs, not a CSV upload)',
  summary: 'Items > Item list > Download template. Clover takes an .xls/.xlsx workbook with one tab per object type and reports validation by sheet and row; the engine stages the equivalent clover-csv, audits it, and hands the operator the association + popup-flag checklist.',
  inputs: [
    { name: 'file', type: 'string', required: true, example: 'clover-items.csv', description: 'the exported inventory workbook flattened to CSV; a file under data/imports/ (fixtures resolve as a fallback)' },
  ],
  steps: [
    manual('s-workbook', 'Build the workbook - Clover will not take a CSV',
      'Items > Item list > Download template gives inventory-template.xls with an Instructions tab and an Items tab; the same affordance exists on Categories, Modifier Groups and Printer Labels. The file must be .xls/.xlsx and 5 MB or smaller.',
      [c('clover.manual', 'import-mechanism'), c('clover.manual', 'template-tabs')]),
    auto('s-import', 'Stage the change set from the MenuFlow review file', 'io.import.menu',
      { file: '{file}', format: 'clover-csv', mode: 'modify' }, { citations: [c('clover.manual', 'menuflow-format')] }),
    auto('s-audit', 'Audit the staged workbench', 'audit.full', {},
      { fatal: false, checks: [{ check: 'no-empty-modifier-groups' }] }),
    auto('s-empty', 'Drop modifier groups that would import with no options', 'menu.modifier.remove_empty', {}, { fatal: false }),
    manual('s-attach', 'Attach every group to its items - orphans import cleanly and stay invisible',
      'A group with no item association is valid data that never appears at order entry. Check the association count, not just the group count.',
      [c('clover.manual', 'item-association')]),
    gate('s-confirm', 'Read the per-tab counts on the To be added to inventory page, then Continue',
      'Nothing is written until Continue, so this is the last free exit. Compare the counts to the workbook rows and resolve any Review Error by sheet and row first.'),
    manual('s-sync', 'Force Sync with Clover, then verify on the customer-facing device',
      'Price and availability land within about 10 minutes; structural changes (new items, new or edited modifier groups) can take up to 4 hours. Force the sync from the integration panel rather than waiting.',
      [c('clover.manual', 'sync-timing'), c('clover.manual', 'review-error-by-sheet-row')]),
  ],
});

def('clover', {
  id: 'clover.bulk-item-export', category: 'export', risk: 'low',
  title: 'Export items for backup or transfer (full list only; IDs are account-local)',
  summary: 'Writes clover-csv from the live menu and states Clover-specific transfer rules: Clover exports the whole item list only, and the Clover ID column must be blanked before importing into another merchant.',
  inputs: [],
  steps: [
    auto('s-export', 'Write clover-csv to data/exports/', 'io.export.menu', { format: 'clover-csv', scope: 'live' },
      { citations: [c('clover.manual', 'menuflow-format')] }),
    manual('s-scope', 'Know that the vendor export is all-or-nothing',
      'Items > Item list > vertical menu > Export gives CloverItemDownload.csv for the full item list; a partial export is not supported, so trim it yourself and keep the original as the backup.',
      [c('clover.manual', 'export-full-list-only')]),
    manual('s-ids', 'Blank the identifier column before importing elsewhere',
      'Into a different merchant account, delete the Clover ID values or the import targets records that do not exist there. Then rebuild the workbook tabs per object type.',
      [c('clover.manual', 'delete-the-id-column'), c('clover.manual', 'import-mechanism')]),
  ],
});

def('touchbistro', {
  id: 'touchbistro.bulk-menu-upload', category: 'import', risk: 'medium',
  title: 'Bulk menu upload (new items only - no updates, no tax, no deletes)',
  summary: 'Menu Management / RMM batch upload. The engine stages the file and mirrors the vendor limits: a Tax or kitchen-printer column is reported, not applied, because TouchBistro bulk upload cannot set them.',
  inputs: [
    { name: 'file', type: 'string', required: true, example: 'touchbistro-menu.csv', description: 'a file under data/imports/ (a repo fixture is resolved as a fallback so the example runs)' },
  ],
  steps: [
    manual('s-scope', 'Scope the work first: bulk creates items, it does not change them',
      'The documented limits are: no batch updates to existing items, no menu image/thumbnail, tax cannot be set, and there is no batch delete. A price change or retirement is per-item work in RMM - never present it as a CSV.',
      [c('touchbistro.manual', 'bulk-upload-new-only'), c('touchbistro.manual', 'access-and-caveats')]),
    auto('s-import', 'Stage the upload file (tax and printer columns are reported, not applied)', 'io.import.menu',
      { file: '{file}', format: 'touchbistro-csv', mode: 'modify' }, { citations: [c('touchbistro.manual', 'menuflow-format')] }),
    auto('s-audit', 'Audit the staged workbench', 'audit.full', {},
      { fatal: false, checks: [{ check: 'no-empty-modifier-groups' }, { check: 'no-midnight-violations' }] }),
    manual('s-rmm', 'Upload inside the target category, then set modifier groups and taxes there',
      'Menu Options > Categories, pick the category (e.g. Mains) and complete Modifier Groups and Taxes on the same screen. Category choice matters: items inherit course, printers and tax defaults from it.',
      [c('touchbistro.manual', 'rmm-upload-flow'), c('touchbistro.manual', 'category-inheritance')]),
    manual('s-review', 'Read the review lines on every item created',
      'Sales category, visible/hidden, course, tax, kitchen printers - the settings continue off screen, so scroll. An item with no printer assignment rings fine and never prints.',
      [c('touchbistro.manual', 'item-review-lines')]),
    gate('s-confirm', 'Confirm with the owner before the dining room sees it',
      'Confirm the item count, that no update was expected from this path, and that tax was set per item afterwards.'),
  ],
});

def('touchbistro', {
  id: 'touchbistro.menu-export', category: 'export', risk: 'low',
  title: 'Export the menu for audit and handoff (review format, per-item changes follow)',
  summary: 'Writes touchbistro-csv (Item Name, Sales Category, Price, Description, Course, Hidden, Modifier Groups) for diffing and audit input. Every change it implies still has to be applied item-by-item in RMM.',
  inputs: [],
  steps: [
    auto('s-export', 'Write touchbistro-csv to data/exports/', 'io.export.menu', { format: 'touchbistro-csv', scope: 'live' },
      { citations: [c('touchbistro.manual', 'menuflow-format')] }),
    manual('s-apply', 'Apply changes per item in RMM; do not expect this file to upload',
      'The vendor bulk path accepts new items only, so a diff of this file is a work order, not a deployment artifact. Record which rows need an update, a tax fix or a retirement, and do those in RMM.',
      [c('touchbistro.manual', 'bulk-upload-new-only'), c('touchbistro.manual', 'item-review-lines')]),
  ],
});

def('lightspeed', {
  id: 'lightspeed.menu-export', category: 'export', risk: 'low',
  title: 'Export items for backup or bulk update (reformat before any re-import)',
  summary: 'Writes lightspeed-csv (Type, Name, Category, Price, Description, Modifier Groups, Available) for handoff and diffing, with the K-Series warnings that matter: some exported columns are not valid for re-import, and updates cannot be reversed.',
  inputs: [],
  steps: [
    auto('s-export', 'Write lightspeed-csv to data/exports/', 'io.export.menu', { format: 'lightspeed-csv', scope: 'live' },
      { citations: [c('lightspeed.manual', 'menuflow-format')] }),
    manual('s-reformat', 'Re-format before re-import and never trust the automatic mapping',
      'Back Office export columns are not all import-safe; SKU and Type must be mapped by hand on the import screen, and unused optional columns should be deleted rather than left blank.',
      [c('lightspeed.manual', 'export-reimport-trap'), c('lightspeed.manual', 'column-mapping'), c('lightspeed.manual', 'row-limits')]),
    manual('s-irreversible', 'Accept that updates cannot be reversed and items cannot be deleted',
      'Retirement here means disable, not delete; there is no Undo Catalogue. Confirm the accounting group spelling too - a near-miss silently creates a duplicate with its own tax and production-center settings.',
      [c('lightspeed.manual', 'no-delete-and-no-undo'), c('lightspeed.manual', 'accounting-group-autocreate')]),
  ],
});

def('aloha', {
  id: 'aloha.menu-export', category: 'export', risk: 'low',
  title: 'Export the menu as a specification (Aloha has no owner-facing file import)',
  summary: 'Writes canonical JSON from the live menu for audit, shadow build and change specification. On Aloha this is a work order for Maintenance > Menu records - there is no CSV to upload.',
  inputs: [],
  steps: [
    auto('s-export', 'Write canonical JSON to data/exports/', 'io.export.menu', { format: 'canonical-json', scope: 'live' },
      { citations: [c('aloha.manual', 'menuflow-format')] }),
    manual('s-records', 'Apply as item-database records, then distribute by ownership',
      'Create or patch the records under Maintenance > Menu (Items, Modifier Groups, Categories, Taxes, Item Routing); an item needs tax, category and printer group to be complete. The ownership level on the record is what controls distribution to stores.',
      [c('aloha.manual', 'item-maintenance-path'), c('aloha.manual', 'mandatory-assignments'), c('aloha.manual', 'item-number-ranges')]),
    manual('s-bulk', 'If the change set is genuinely bulk, raise an NCR data-service task',
      'Bulk edits to the item database are an NCR data-service activity, not an owner upload. Send the export as the specification and get the revision and scope confirmed in writing before anything is pushed.',
      [c('aloha.manual', 'no-csv-import-86-and-roll')]),
  ],
});

def('aloha', {
  id: 'aloha.item-modifier-record-build', category: 'modifiers', risk: 'medium',
  title: 'Build a modifier group the Aloha way (groups are items; 10 per item, 54 per group)',
  summary: 'Creates the group and its limits in the workbench, then mirrors Aloha record construction: modifier items exist first, the group collects them, and the item attaches up to ten groups on its Modifier tab. Menu-wide sharing stays confined to exception modifier groups.',
  inputs: [
    { name: 'groupName', type: 'string', required: true, example: 'Extras' },
    { name: 'memberItem', type: 'string', required: true, example: 'Extra Cheese',
      description: 'first member only — an Aloha group is a collection of item records, so a group with no members is not a real record; add the rest in Maintenance > Menu > Modifier Groups' },
    { name: 'minChoices', type: 'number', required: false, example: '0' },
    { name: 'maxChoices', type: 'number', required: false, example: '3' },
    { name: 'items', type: 'string', required: false, example: 'Pepperoni Pizza, Veggie Pizza',
      description: 'comma- or semicolon-separated; each must be an item on this location\'s menu' },
  ],
  steps: [
    auto('s-group', 'Create or update the modifier group with its selection limits', 'menu.modifier.group.ensure',
      { name: '{groupName}', minChoices: '{minChoices}', maxChoices: '{maxChoices}' },
      { citations: [c('aloha.manual', 'group-limits-and-prompting')] }),
    auto('s-member', 'Give the group its first member item', 'menu.modifier.option.upsert',
      { group: '{groupName}', name: '{memberItem}', priceDelta: 0 },
      { citations: [c('aloha.manual', 'modifier-groups-central')] }),
    auto('s-link', 'Attach the group to its items in the workbench', 'menu.modifier.link', { group: '{groupName}', items: '{items}' },
      { fatal: false, notes: ['soft by design: items that do not exist in this menu are a no-op, not a failure'],
        citations: [c('aloha.manual', 'modifier-tab-ten-groups')] }),
    manual('s-items', 'Create the modifier items first, then collect them into the group',
      'Maintenance > Menu > Items defines the items (cheese, lettuce, pickles); Maintenance > Menu > Modifier Groups collects them (Extras) and the item attaches them back. A group that is never assigned to an item on its Modifier tab does not appear at the terminal - and an item can take at most ten groups (Modifier 1 through Modifier 10, Standard type only).',
      [c('aloha.manual', 'modifier-groups-central'), c('aloha.manual', 'modifier-tab-ten-groups')]),
    manual('s-layout', 'Set the layout, prompting and free allowance',
      'Up to 54 modifiers per group; buttons show the short name, item number and price. Choose whether the group appears automatically or via the Modify button, set min/max (1/1 for a forced single choice), and set Free for the number of no-charge selections.',
      [c('aloha.manual', 'group-limits-and-prompting')]),
    manual('s-exception', 'Keep menu-wide sharing inside an exception modifier group',
      'For things like hot sauce or cheese sauce that modify anything on the submenu, use Maintenance > Menu > Exception Modifiers (reached at the POS via Modify > Special). That is the documented, intentional sharing mechanism - it is not the cross-contamination defect, and the audit allowlist treats it as designed sharing.',
      [c('aloha.manual', 'exception-modifier-groups')]),
    auto('s-counts', 'Confirm the group this run built is actually populated', 'menu.normalize', { dryPreview: true },
      { citations: [c('aloha.manual', 'audit-checklist')],
        // scoped to the object this run created: a client menu may hold unrelated empty groups
        // (the seeded Kiosk Extras dirt does), and asserting global cleanliness here would be noise
        checks: [{ check: 'group-has-members', args: { group: '{groupName}' } }] }),
  ],
});

def('heartland', {
  id: 'hl.menu-json-import', category: 'import', risk: 'medium',
  title: 'Import a menu JSON into the shadow build (Heartland has no CSV path)',
  summary: 'Heartland menu edits are Admin Console fields and terminal state - there is no owner-facing CSV. This workflow takes canonical or heartland-flat JSON into staging, audits it, and stops at the portal-side entry with the field checklist.',
  inputs: [
    { name: 'file', type: 'string', required: true, example: 'heartland-flat.json', description: 'canonical JSON or the legacy flat array from the heartland-pos tooling (fixtures resolve as a fallback)' },
  ],
  steps: [
    manual('s-source', 'Confirm what the source file actually is',
      'A bare JSON array of {name, category, price, modifiers, time_ranges} is the legacy flat export the audit scripts consume: no pricing-rule stack, no channels, no group limits. Never treat it as a backup - take the canonical export for that.',
      [c('heartland.manual', 'json-shape'), c('heartland.manual', 'no-csv-import')]),
    auto('s-import', 'Stage the file into the workbench (normalization runs on import)', 'io.import.menu',
      { file: '{file}', format: 'canonical-json', mode: 'modify' }, { citations: [c('heartland.manual', 'menuflow-format')] }),
    auto('s-audit', 'Audit the staged menu before it can be approved', 'audit.full', {},
      { citations: [c('heartland.manual', 'audit-checklist')] }),
    gate('s-scope', 'Client approves the scope before any portal entry starts',
      'Walk the findings and the diff summary. Modifier isolation changes ordering UX, so it needs explicit sign-off - audit before action.'),
    manual('s-portal', 'Enter the fields in the Admin Console; read back the terminal state',
      'Admin Console > Menu > Items and > Modifiers for names, prices, Assigned Items, Min/Max Choices, Number of Included Ingredients, per-ingredient Default Price and Available Online. Stock limits and 86 state live on the terminal (long-press the item, or Manager > Item Stock Management) and never appear in a portal export.',
      [c('heartland.manual', 'items-screen'), c('heartland.manual', 'modifiers-screen'), c('heartland.manual', 'admin-vs-pos')]),
  ],
});


// ─────────────────────────── manual links for existing workflows ───────────────────────────
// Ties each already-written step to the platform-manual section that justifies it, so a citation
// is a pointer into docs/manuals/ rather than a generic vendor-doc reference. `target` is a step
// id, or first/last/all over the workflow's manual steps.
const MANUAL_LINKS = {
  'hl.item-create': { first: ['items-screen'] },
  'hl.modifier-create': { all: ['modifiers-screen'] },
  'hl.modifier-isolate': { first: ['modifiers-screen'] },
  'hl.86-stock-limit': { first: ['admin-vs-pos'] },
  'hl.backup-export': { first: ['no-csv-import'], last: ['menuflow-format'] },
  'hl.menu-rebuild-normalized': { first: ['json-shape'] },
  'hl.midnight-split': { first: ['legacy-time-ranges'] },
  'hl.full-menu-audit': { first: ['audit-checklist'] },
  'hl.shadow-build-cutover': { first: ['admin-vs-pos'] },
  'hl.pricing-stack-fix': { first: ['discounts-vs-adjustments'] },
  'toast.item-create': { last: ['publish-cycle'] },
  'toast.modifier-group-setup': { first: ['required-vs-optional-prompts'], last: ['empty-modifier-groups'] },
  'toast.bulk-price-change': { first: ['price-string-rules'], last: ['irreversibility'] },
  'toast.86-item': { first: ['publish-cycle'] },
  'toast.online-sync-check': { first: ['empty-modifier-groups'] },
  'toast.menu-audit-normalize': { first: ['items-database-exports'] },
  'toast.eod-close': { first: ['publish-cycle'] },
  'toast.publish-cycle': { all: ['publish-cycle'] },
  'square.csv-import': { first: ['template-source'], last: ['undo-catalogue'] },
  'square.csv-export': { last: ['menuflow-format'] },
  'square.menu-transfer-replace': { first: ['modify-vs-replace'], last: ['not-exported'] },
  'square.modifier-vs-option-sets': { first: ['not-exported'] },
  'square.price-update': { first: ['price-and-variable'] },
  'square.channel-availability': { first: ['location-columns'] },
  'square.sold-out-86': { first: ['audit-checklist'] },
  'clover.item-create': { first: ['item-association'] },
  'clover.modifier-groups': { first: ['modifier-group-model'], last: ['kiosk-duplicate-groups'] },
  'clover.price-sync': { first: ['sync-timing'] },
  'clover.online-sync': { first: ['sync-timing'] },
  'clover.inventory-86': { first: ['price-in-cents'] },
  'clover.menu-audit-normalize': { first: ['audit-checklist'] },
  'lightspeed.menu-import': { first: ['column-mapping'], last: ['export-reimport-trap'] },
  'lightspeed.item-create': { first: ['required-columns'] },
  'lightspeed.modifier-group-create': { first: ['min-max-for-groups'], last: ['extra-price'] },
  'lightspeed.archive-item': { first: ['no-delete-and-no-undo'] },
  'lightspeed.price-list-daypart': { first: ['extra-price'] },
  'lightspeed.menu-audit-normalize': { first: ['audit-checklist'] },
  'touchbistro.item-create': { first: ['rmm-upload-flow'] },
  'touchbistro.86-hide': { first: ['pos-86-is-not-delete'] },
  'touchbistro.online-visibility': { first: ['online-toggle-independent'] },
  'touchbistro.price-tax-change': { first: ['bulk-upload-new-only'] },
  'touchbistro.courses-setup': { first: ['category-inheritance'] },
  'touchbistro.menu-audit-normalize': { first: ['item-review-lines'] },
  'aloha.modifier-setup': { first: ['modifier-tab-ten-groups'], last: ['group-limits-and-prompting'] },
  'aloha.shift-86': { first: ['no-csv-import-86-and-roll'] },
  'aloha.eod-close': { first: ['no-csv-import-86-and-roll'] },
  'aloha.adm-menu-structure-audit': { first: ['mandatory-assignments'] },
  'aloha.menu-audit-normalize': { first: ['audit-checklist'] },
  'aloha.tax-pricing': { first: ['price-methods-and-building-blocks'] },
};

const CHECK = process.argv.includes('--check');
(function applyManualLinks() {
  const byId = new Map(WF.map(w => [w.id, w]));
  let added = 0, misses = [];
  for (const [wfId, spec] of Object.entries(MANUAL_LINKS)) {
    const wf = byId.get(wfId);
    if (!wf) { misses.push(`workflow ${wfId} not found`); continue; }
    const docId = `${wf.platform}.manual`;
    // Audit/export workflows can be all-auto; citations are legal on auto steps too, so fall
    // back to those rather than silently skipping the link.
    const manuals = wf.steps.filter(s => s.kind === 'manual').length
      ? wf.steps.filter(s => s.kind === 'manual')
      : wf.steps.filter(s => s.kind === 'auto');
    for (const [target, sections] of Object.entries(spec)) {
      const steps = target === 'all' ? manuals
        : target === 'first' ? manuals.slice(0, 1)
          : target === 'last' ? manuals.slice(-1)
            : manuals.filter(s => s.id === target);
      if (!steps.length) { misses.push(`${wfId}: no manual step for target "${target}"`); continue; }
      for (const st of steps) {
        st.citations = st.citations || [];
        for (const sec of sections) {
          if (!st.citations.some(x => x.doc === docId && x.section === sec)) { st.citations.push(c(docId, sec)); added++; }
        }
      }
    }
  }
  // Every import/export workflow ends up carrying the cross-platform divergence statement, so the
  // "this file is not the vendor upload file" warning is part of the certified run record.
  for (const wf of WF) {
    if (wf.category !== 'import' && wf.category !== 'export') continue;
    const st = [...wf.steps].reverse().find(s => s.kind === 'manual') || wf.steps[wf.steps.length - 1];
    st.citations = st.citations || [];
    if (!st.citations.some(x => x.doc === 'signalF.csv-matrix' && x.section === 'menuflow-divergence')) {
      st.citations.push(c('signalF.csv-matrix', 'menuflow-divergence')); added++;
    }
  }
  if (misses.length) throw new Error('MANUAL_LINKS errors:\n  ' + misses.join('\n  '));
  if (!CHECK) console.log(`manual links applied: ${added} citations attached to bulk-file steps`);
})();

// ────────────────────────────────────────── emit ──────────────────────────────────────────
// --check compares the builder's output against what is on disk instead of writing it. The
// generated workflow JSONs are never hand-edited, so drift here means either an unrun generator
// or someone editing an artifact directly — both must fail the gate, not silently ship.
const ROOT = path.join(__dirname, '..');
let count = 0, stale = [];
for (const wf of WF) {
  const dir = path.join(OUT, wf.platform);
  const doc = wf;
  const file = path.join(dir, `${doc.id}.json`);
  const payload = JSON.stringify(doc, null, 2) + '\n';
  if (CHECK) {
    const onDisk = fs.existsSync(file) ? fs.readFileSync(file, 'utf8') : null;
    if (onDisk === null) stale.push(`${path.relative(ROOT, file)}: missing`);
    else if (onDisk !== payload) stale.push(`${path.relative(ROOT, file)}: differs from the builder output`);
    count++;
    continue;
  }
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(file, payload);
  count++;
}
if (CHECK) {
  // files on disk that the builder no longer produces are just as stale
  for (const plat of fs.readdirSync(OUT)) {
    const pd = path.join(OUT, plat);
    if (!fs.statSync(pd).isDirectory()) continue;
    for (const f of fs.readdirSync(pd)) {
      const id = f.replace(/\.json$/, '');
      if (!WF.some(w => w.id === id)) stale.push(`server/workflows/${plat}/${f}: not produced by the builder`);
    }
  }
  if (stale.length) {
    console.error(`workflow artifacts are stale (${stale.length}):\n  ${stale.join('\n  ')}`);
    console.error('run: node fixtures/build-workflows.js');
    process.exit(1);
  }
  console.log(`workflow artifacts are current (${count} files match the builder)`);
  process.exit(0);
}
console.log(`Wrote ${count} workflow files to ${OUT}`);
const perPlat = {};
for (const wf of WF) perPlat[wf.platform] = (perPlat[wf.platform] || 0) + 1;
console.log(perPlat);

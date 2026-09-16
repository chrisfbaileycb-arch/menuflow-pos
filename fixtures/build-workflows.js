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
    { name: 'file', type: 'string', required: true, example: 'square-export.csv (place under data/imports/)' },
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
  summary: 'Produces the exact importable shape (Name, Category Name, Price, Description, Modifier Set, Visible) that Dashboard > Items > Export yields, for handoff or bulk editing.',
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
    { name: 'item', type: 'string', required: false, example: 'Fettuccine Alfredo' },
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
    { name: 'file', type: 'string', required: true, example: 'new-library.csv in data/imports/' },
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
    { name: 'item', type: 'string', required: false, example: 'Cacio e Pepe' },
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
    { name: 'item', type: 'string', required: true, example: 'Discontinued Special' },
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
    { name: 'file', type: 'string', required: true, example: 'lightspeed-menu.csv in data/imports/' },
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
    auto('s-fix', 'Resolve a Rush+Hold conflict on the workbench', 'menu.item.set_course', { item: 'Buffalo Wings (10pc)', course: 1, rush: false, hold: false }, { citations: [c('touchbistro.owner-guide', 'courses')], fatal: false }),
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
    { name: 'item', type: 'string', required: true, example: 'Scallops' },
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

// ────────────────────────────────────────── emit ──────────────────────────────────────────
let count = 0;
for (const wf of WF) {
  const dir = path.join(OUT, wf.platform);
  fs.mkdirSync(dir, { recursive: true });
  const doc = wf;
  const file = path.join(dir, `${doc.id}.json`);
  fs.writeFileSync(file, JSON.stringify(doc, null, 2) + '\n');
  count++;
}
console.log(`Wrote ${count} workflow files to ${OUT}`);
const perPlat = {};
for (const wf of WF) perPlat[wf.platform] = (perPlat[wf.platform] || 0) + 1;
console.log(perPlat);

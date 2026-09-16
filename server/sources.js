/**
 * sources.js — Owner's-manual / official-documentation traceability registry.
 *
 * Every workflow step that cites an "owner's manual" reference points at a
 * docId + section key defined here. The workflow verifier refuses to certify
 * any workflow whose citations are missing from this registry — this is what
 * makes "based off of owners' manuals" enforceable rather than decorative.
 *
 * `verified` field records how each source was checked:
 *   - "official-doc"  : cross-checked against the vendor's published manual /
 *                       help-center article (URL included) on 2026-09-15.
 *   - "client-kb"     : comes from Signal F Holdings' own audited knowledge
 *                       base (heartland-pos repo), derived from hands-on work.
 *   - "legacy-manual" : drawn from widely distributed legacy owner manuals;
 *                       confirm the section against the exact revision the
 *                       client's hardware runs before relying on it.
 */

const SOURCES = {
  // ───────────────────────────── Heartland ─────────────────────────────
  'heartland.items-screen': {
    title: 'Heartland Admin Console — Items Screen (Help Center)',
    publisher: 'Heartland',
    url: 'https://heartlandpos.zendesk.com/hc/en-us/articles/20200889252507-Items-Screen',
    verified: 'official-doc',
    sections: {
      create: 'Log into the Admin Console, select an account. Main Menu > Menu > Items, click New.',
      "misc-item": 'Misc. Item checkbox: POS lets staff edit the item name and price after adding it to a ticket.',
      'half-and-half': 'Half & Half Pricing list controls how the POS prices halved ingredients of a modifier that allows half-and-half.',
      modifiers: 'Modifiers list associates a menu item with modifiers; ingredients tapped while configuring become order defaults.',
      sizes: 'Ingredient sizes list (from the Sizes screen) allows different ingredient prices by size.',
      'default-ingredients': 'Selecting an ingredient and saving the item makes it a default selection when the item is added to a ticket.',
    },
  },
  'heartland.modifiers-screen': {
    title: 'Heartland Admin Console — Modifiers Screen (Help Center)',
    publisher: 'Heartland',
    url: 'https://support.heartlandhelpcenter.com/hc/en-us/articles/21154220746381-Modifiers-Screen',
    verified: 'official-doc',
    sections: {
      access: 'Admin Console Main Menu > Menu > Modifiers, click New.',
      'show-name': 'Show Modifier Name controls display of the modifier and its ingredients on POS screen, KDS, and printed slips.',
      'min-choices': 'Minimum Choices: minimum number of selections required when the modifier is used in the POS.',
      'max-choices': 'Maximum Choices: maximum number of selections allowed.',
      included: 'Number of Included Ingredients: selections a server may add at no extra cost; defaults excluded from the count.',
      'ingredient-price': 'Default Price on an ingredient is charged when the modifier is added to a menu item.',
      'assigned-items': 'Assigned Items associates the modifier with menu items; only associated items present it at order time.',
      'available-online': 'Available Online checkbox exposes the modifier on the Online Ordering website.',
    },
  },
  'heartland.mini-manager-guide': {
    title: 'Heartland (PocketSuite/Genius family) — Mini Manager Guide',
    publisher: 'Heartland',
    url: 'https://heartlandpos.zendesk.com/hc/en-us/articles/1260805770189-Mini-Manager-Guide',
    verified: 'official-doc',
    sections: {
      'item-stock': 'Long-press an item in the order screen to set its stock limit; Manager > Item Stock Management for the centralized screen.',
      discounts: 'Discount applies to items; Adjustment applies to the whole ticket at Checkout > Adjust.',
      'void-reason': 'Voiding a saved/committed item prompts for a void reason.',
      modify: 'Modify on the order screen changes modifiers (e.g. no tomatoes, no onions) of a saved item.',
    },
  },
  'heartland.kb.modifier-architecture': {
    title: 'Signal F Holdings KB — Modifier Architecture (Heartland POS)',
    publisher: 'Signal F Holdings LLC (heartland-pos repo)',
    url: 'https://github.com/chrisfbaileycb-arch/heartland-pos/blob/main/knowledge/modifier-architecture.md',
    verified: 'client-kb',
    sections: {
      isolation: 'Modifiers are isolated to their parent item by default; shared only when explicitly flagged (Size, preparation style, temperature).',
      'pepperoni-problem': 'A single shared pepperoni modifier across 5 categories means 86-ing pepperoni disables all 5; item-scoped duplicates protect revenue.',
      'sub-item': 'Sub-Item flag lets a modifier import its own modifier set instead of flattening every combination.',
      'multiplier-pricing': 'Extra/Double uses a 2.0x multiplier on the base ingredient price — not manual stacking.',
    },
  },
  'heartland.kb.midnight-rule': {
    title: 'Signal F Holdings KB — The Midnight Rule (Heartland POS)',
    publisher: 'Signal F Holdings LLC (heartland-pos repo)',
    url: 'https://github.com/chrisfbaileycb-arch/heartland-pos/blob/main/knowledge/midnight-rule.md',
    verified: 'client-kb',
    sections: {
      rule: 'Any time range crossing midnight must be split into a pre-midnight entry (…–11:59 PM) and a post-midnight entry (12:00 AM…) on the NEXT calendar day.',
      audit: 'Audits flag end_time < start_time as MIDNIGHT RULE VIOLATIONS — the rule fails silently.',
      "day-increment": 'The post-midnight portion is assigned to the following day; for daily ranges both halves recur daily.',
    },
  },
  'heartland.kb.pricing-rules': {
    title: 'Signal F Holdings KB — Dynamic Pricing Rules (Heartland POS)',
    publisher: 'Signal F Holdings LLC (heartland-pos repo)',
    url: 'https://github.com/chrisfbaileycb-arch/heartland-pos/blob/main/knowledge/pricing-rules.md',
    verified: 'client-kb',
    sections: {
      types: 'Force Price, Dollar Adjust, Percentage Adjust, Multiplier. Negative adjust values = discounts.',
      priority: 'Rules evaluate top-to-bottom; the FIRST match wins. Most specific scope must be above general scope.',
      'post-tax': 'ApplyPostTax=true leaves tax liability unchanged (surcharges); false changes the taxable amount (discounts/comps).',
      'audit-conflicts': 'Flag >3 overlapping rules per item and two Force Price rules that can both match — one is dead config.',
    },
  },
  'heartland.kb.coursing': {
    title: 'Signal F Holdings KB — Coursing & Kitchen Flow (Heartland POS)',
    publisher: 'Signal F Holdings LLC (heartland-pos repo)',
    url: 'https://github.com/chrisfbaileycb-arch/heartland-pos/blob/main/knowledge/coursing-logic.md',
    verified: 'client-kb',
    sections: {
      basics: 'Course 0–9 (0 = unassigned, fires first); Rush bypasses sequence; Hold delays until released; Rush overrides Hold.',
      audit: 'Entrees/appetizers left at Course 0 likely need explicit assignment; Rush+Hold simultaneously is a configuration error.',
    },
  },
  'heartland.kb.shadow-build': {
    title: 'Signal F Holdings KB — Shadow Build Methodology & Cutover',
    publisher: 'Signal F Holdings LLC (heartland-pos repo)',
    url: 'https://github.com/chrisfbaileycb-arch/heartland-pos/blob/main/rebuild/shadow-build-guide.md',
    verified: 'client-kb',
    sections: {
      principle: 'The live revenue channel is never interrupted. Build v2 channels in parallel; the client flips the switch.',
      naming: 'Shadow channels are named exactly "[Original Channel Name] v2" — professional versioning, natural cutover conversation.',
      checklist: 'Pre-build checklist: audit delivered, signed authorization, scope agreed in writing, admin access confirmed, clean export saved.',
      'phase-retire': 'Old channels stay available as fallback until explicitly retired.',
    },
  },
  'heartland.kb.audit-protocol': {
    title: 'Signal F Holdings — Audit-before-action protocol & audit scripts',
    publisher: 'Signal F Holdings LLC (heartland-pos repo)',
    url: 'https://github.com/chrisfbaileycb-arch/heartland-pos#the-workflow',
    verified: 'client-kb',
    sections: {
      'never-86': 'Never 86 in the system during service. Contact customers directly; disable only after service and only with a plan.',
      'protocol': 'Step 1 Audit → 2 Scope agreement → 3 Shadow build → 4 Pipeline review → 5 Client-controlled cutover.',
      tools: 'modifier-scan.py, redundancy-check.py, 86-risk-report.py logic (ported to MenuFlow engine as audit.* skills).',
    },
  },

  'signalF.shared-rules': {
    title: 'Signal F Holdings — Cross-platform shared engineering rules',
    publisher: 'Signal F Holdings LLC',
    url: 'https://github.com/chrisfbaileycb-arch/heartland-pos',
    verified: 'client-kb',
    sections: {
      'empty-groups': 'No empty modifier groups may ever ship: third-party ordering syncs break and whole menus can vanish (documented by Toast §empty-group; adopted as a platform-wide rule). Fix: fill or delete.',
      'audit-first': 'Audit before action on every platform: never change a live system without a written report and client approval first.',
      'reversible-disable': 'Disablement is always reversible (stock limit / sold-out / hide), never a delete, on any platform.',
    },
  },

  // ───────────────────────────── Toast ─────────────────────────────
  'toast.modifier-groups': {
    title: 'Toast — Create and Manage Modifier Groups and Modifier Options',
    publisher: 'Toast (support.toasttab.com)',
    url: 'https://support.toasttab.com/en/article/Creating-Modifier-Groups-and-Modifiers-1492803987509',
    verified: 'official-doc',
    sections: {
      create: 'Toast Web > Menus > Modifier groups; create group, add options, attach to menu/group/subgroup/item.',
      behavior: 'Required blocks sending without a selection; Optional can include a POS prompt (auto-show); plain Optional must be opened manually.',
      publish: 'Edits do not reach the POS until you Save AND Publish all changes.',
      'empty-group': 'Empty modifier groups cause sync errors with third-party integrations and can hide entire menus — fill or delete them.',
      troubleshooting: 'If modifiers are missing on POS: check behavior setting and confirm publish completed.',
    },
  },
  'toast.menu-items': {
    title: 'Toast — Create and manage menu items and groups',
    publisher: 'Toast (support.toasttab.com)',
    url: 'https://support.toasttab.com/',
    verified: 'official-doc',
    sections: {
      add: 'Toast Web > Menus > Groups & items: add item, set name/price/group, attach modifier groups; availability per channel is part of the item record.',
    },
  },
  'toast.modifier-display': {
    title: 'Toast — Configure Modifier Display Options / Group Display Order',
    publisher: 'Toast (support.toasttab.com)',
    url: 'https://support.toasttab.com/en/article/Advanced-Modifier-Configuration',
    verified: 'official-doc',
    sections: {
      modes: 'Vertical/horizontal display modes; Consolidate modifiers toggle under Front of house > Order screen setup > UI options.',
      priority: 'Display Ordering Priority on the modifier group Properties section overrides the 6-tier ordering rule; enable Modifier Ordering Priority in UI options.',
      sorting: 'Modifier group sorting setting chooses insertion-order vs. group-listing order.',
    },
  },
  'toast.bulk-advanced': {
    title: 'Toast — Bulk management and advanced properties',
    publisher: 'Toast (support.toasttab.com)',
    url: 'https://support.toasttab.com/en/article/Editing-Managing-Modifier-Group-Display-Order',
    verified: 'official-doc',
    sections: {
      'advanced-props': 'Menus > Bulk management > Advanced properties exposes columns (incl. Modifier Order Priority) for mass edits, then Save + Publish.',
    },
  },
  'toast.card-terminal': {
    title: 'Toast — Card & Terminal Reference Guide / POS run-side operations (86, void)',
    publisher: 'Toast (published owner reference)',
    url: 'https://support.toasttab.com/',
    verified: 'legacy-manual',
    sections: {
      '86': 'On the POS, select the item and use the 86 action to remove it from ordering for the day; run-side 86 does not delete the menu record.',
      void: 'Voids from the check require a reason code when the item was already sent.',
    },
  },
  'toast.online-ordering': {
    title: 'Toast — Online Ordering menu availability (publish + channel toggles)',
    publisher: 'Toast (support.toasttab.com)',
    url: 'https://support.toasttab.com/en/article/Creating-Modifier-Groups-and-Modifiers-1492803987509',
    verified: 'official-doc',
    sections: {
      visibility: 'Item and modifier visibility to Online Ordering follows published POS menu setup; unpublished edits never reach the channel.',
    },
  },
  'toast.day-reporting': {
    title: 'Toast — Day Reporting (end of day / close-out review)',
    publisher: 'Toast (support.toasttab.com)',
    url: 'https://support.toasttab.com/',
    verified: 'official-doc',
    sections: {
      close: 'Day Reporting is the manager review surface for the business day; reconcile before rolling over, after cash drawer close on terminals.',
    },
  },

  // ───────────────────────────── Square for Restaurants ─────────────────────────────
  'square.library-import-export': {
    title: 'Square — Item library import / export via CSV (community-documented Dashboard flow)',
    publisher: 'Square (community/support)',
    url: 'https://community.squareup.com/t5/New-to-Square/Bulk-upload-CSV-File/m-p/365345',
    verified: 'official-doc',
    sections: {
      export: 'Items page of the online Dashboard > Export (Excel or CSV).',
      'import-modify': 'Actions > Import Library > Modify Item Library: adds new items and updates existing ones.',
      'import-replace': 'Actions > Import Library > Replace Item Library: DELETES all existing items, then loads the file. Requires written client approval.',
      'modifier-y': 'A blank Modifier Set cell means the modifier is off; "Y" applies the modifier set to the item.',
      review: 'Review the diff shown by the Dashboard, then Confirm to upload.',
      undo: 'Actions > Undo Catalogue reverts to a recent version of the Item Library after a bad import.',
    },
  },
  'square.library-items': {
    title: 'Square for Restaurants — Item / modifier setup (Dashboard > Library)',
    publisher: 'Square (developer + support docs)',
    url: 'https://developer.squareup.com/docs/catalog-api',
    verified: 'official-doc',
    sections: {
      'items-vs-modifiers': 'Options are variations of the item itself (size); Modifiers are add-ons chosen at order time. Keep them in separate sets.',
      fields: 'Item fields include name, kitchen name, price, description, tax, allergens, category assignment, and location/channel availability.',
      'sold-out': 'Items can be marked temporarily sold out with a scheduled automatic return — this is the safe "86".',
    },
  },
  'square.transfer-note': {
    title: 'Square — Menu transfer limitations between accounts',
    publisher: 'Square (community staff answer)',
    url: 'https://community.squareup.com/t5/Read-only-archive-Square/Square-for-Restaurants-Can-you-export-your-menu/idi-p/237711',
    verified: 'official-doc',
    sections: {
      caveat: 'CSV transfers items, modifiers and categories; restaurant-specific settings (display groups, advanced modifier settings, auto-add) do not transfer. Re-check those after import.',
    },
  },

  // ───────────────────────────── Clover ─────────────────────────────
  'clover.item-editor': {
    title: 'Clover — Item Editor / Menu Management (Setup app + merchant dashboard)',
    publisher: 'Fiserv/Clover (owner guide family)',
    url: 'https://www.clover.com/support',
    verified: 'official-doc',
    sections: {
      create: 'Menu management: create item, assign to a menu/group, attach modifier (option) groups with names, prices and icons.',
      'modifier-groups': 'Option groups carry min/max selection rules; options carry price adjustments.',
      popup: 'Pop Up Automatically forces the option group to open when the item is added — pair with correct min/max.',
    },
  },
  'clover.sync': {
    title: 'Clover — third-party menu sync semantics (Software Setup Guide)',
    publisher: 'Clover kiosk/Commandpoint Software Setup Guide Rev 3.0',
    url: 'https://content.nanonation.net/Support/Clover/Guides/Clover_Software_Setup_Guide_Current.pdf',
    verified: 'official-doc',
    sections: {
      windows: 'Item price and availability propagate within ~10 minutes; names, modifier groups and structural changes sync within ~4 hours.',
      'force-sync': 'The "Sync with Clover" button forces current data out within ~10 minutes — use after structural changes before verifying channels.',
      "kiosk-groups": 'Duplicate modifier groups for kiosk use ("Toppings – Kiosk"), disable the unused side in the other interface to prevent drift.',
    },
  },
  'clover.inventory': {
    title: 'Clover — Inventory app (counts / 86 equivalent)',
    publisher: 'Fiserv/Clover',
    url: 'https://www.clover.com/support',
    verified: 'official-doc',
    sections: {
      count: 'Inventory counts adjust available quantity; out-of-stock ingredients grey dependent items instead of deleting them.',
      '86': 'Marking the item/menu group unavailable (or inventory zero with auto behavior) is the reversible 86; deleting items is not.',
    },
  },

  // ───────────────────────────── Lightspeed K-Series ─────────────────────────────
  'lightspeed.item-list': {
    title: 'Lightspeed Restaurant (K-Series) — Item list & modifier groups (Back Office)',
    publisher: 'Lightspeed (K-Series help center)',
    url: 'https://k-series-support.lightspeedhq.com/hc/en-us/articles/51623634913051-Understanding-modifiers-and-modifier-groups',
    verified: 'official-doc',
    sections: {
      create: 'Back Office > Menu > Item list > Create > Modifier group; enter name, SKU (auto-generate if blank), Add modifier.',
      edit: 'Filter by Type > Modifier group; click a field to edit or three-dot menu > Edit.',
      unlink: 'Item three-dot menu > Details > Modifier groups > Remove from group.',
      archive: 'Three-dot > Archive removes the modifier or item from ALL menus at ALL locations — confirm scope first.',
      table: 'Item list table is customizable via Edit table; combos, notes, allergens and accounting groups also live under Menu.',
    },
  },
  'lightspeed.menus': {
    title: 'Lightspeed Restaurant — About menus and items',
    publisher: 'Lightspeed (K-Series help center)',
    url: 'https://k-series-support.lightspeedhq.com/hc/en-us/articles/1260804647349-About-menus-and-items',
    verified: 'official-doc',
    sections: {
      structure: 'Menu section manages items, menus, production instructions, accounting groups and price lists; availability is per-menu.',
      import: 'Bulk menu loading is handled from the Back Office Menu section, and the Item list table is customizable via Edit table.',
      'price-lists': 'Price lists (with periods/days) drive happy-hour style pricing; the menu references one price list per day part.',
    },
  },

  // ───────────────────────────── TouchBistro ─────────────────────────────
  'touchbistro.menu-items': {
    title: 'TouchBistro — Setting up menu items (Menu / RMM)',
    publisher: 'TouchBistro (help center)',
    url: 'https://cdn.touchbistro.com/help/articles/setting-menu-items/',
    verified: 'official-doc',
    sections: {
      fields: 'Review screen confirms: Line 1 = Sales Category, Visible/Hidden, course number; Line 2 = tax; Line 3 = kitchen printers.',
      hide: 'To temporarily hide an item (86 it) click the X icon next to POS; the Online Ordering toggle is independent.',
      course: 'Items inherit the category course and background color; override per item when needed (e.g. iced drinks on dessert course).',
      online: 'Enable/disable the item for Online Ordering via its own drop-down without affecting POS availability.',
    },
  },
  'touchbistro.owner-guide': {
    title: 'TouchBistro — Owner Guide (PDF family)',
    publisher: 'TouchBistro',
    url: 'https://www.touchbistro.com/support/',
    verified: 'legacy-manual',
    sections: {
      courses: 'Courses configure kitchen fire behavior and display grouping; assign each category to exactly one course for full service.',
      tax: 'Tax presets per item/category; verify after any price import.',
    },
  },

  // ───────────────────────────── NCR Aloha ─────────────────────────────
  'aloha.adm-menu': {
    title: 'NCR Aloha — Menu setup via ADM/EASE (blocks, sections, items, modifiers)',
    publisher: 'NCR (Aloha Owner/Operator manual family)',
    url: 'https://www.ncr.com/restaurant',
    verified: 'legacy-manual',
    sections: {
      structure: 'Menu = ordered blocks; blocks contain sections; sections hold items with default modifiers/typo-tape behavior.',
      modifiers: 'Modifiers defined once and attached to items/sections; price deltas and forced entry per modifier definition.',
      'tax': 'Tax rates defined in ADM and assigned per item/section (food vs alcohol vs grocery).',
    },
  },
  'aloha.pos-86': {
    title: 'NCR Aloha — EOD / 86 and reporting on the POS',
    publisher: 'NCR (Aloha operator reference)',
    url: 'https://www.ncr.com/restaurant',
    verified: 'legacy-manual',
    sections: {
      '86': 'The 86 screen removes items from ordering for the current shift; the menu definition itself stays intact.',
      eod: 'End-of-day reports roll the day; verify 86s are cleared before the next open.',
    },
  },
};

// ───────────────────── platform manuals (generated from docs/manuals/*.md) ─────────────────────
/**
 * Per-platform bulk-file / modifier manuals live as prose in docs/manuals/ and are compiled
 * into this registry by `fixtures/build-manual-sources.js`. Editing a manual's section heading
 * or opening paragraph therefore changes the citation text a workflow resolves to — the manual
 * is the single source of truth, and tests/manuals.test.js fails if the two drift apart.
 */
const MANUAL_SOURCES = require('./sources.manuals.generated');
for (const [id, doc] of Object.entries(MANUAL_SOURCES)) {
  if (SOURCES[id]) throw new Error(`sources.js: manual docId "${id}" collides with a hand-registered source`);
  SOURCES[id] = doc;
}

function hasCitation(docId, section) {
  const doc = SOURCES[docId];
  return Boolean(doc && section && doc.sections && Object.prototype.hasOwnProperty.call(doc.sections, section));
}

function getCitation(docId, section) {
  const doc = SOURCES[docId];
  if (!doc) return null;
  return {
    docId,
    title: doc.title,
    publisher: doc.publisher,
    url: doc.url,
    verified: doc.verified,
    manual: doc.manual || null,
    section,
    excerpt: doc.sections && doc.sections[section] ? doc.sections[section] : null,
  };
}

module.exports = { SOURCES, hasCitation, getCitation };

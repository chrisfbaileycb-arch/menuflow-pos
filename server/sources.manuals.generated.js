/**
 * sources.manuals.generated.js — GENERATED, DO NOT EDIT.
 * Derived from docs/manuals/*.md by fixtures/build-manual-sources.js (that script and those
 * files are the source of truth; edit a manual, then re-run the builder).
 * Regenerated: 2026-09-16T04:22:18
 *   aloha.md → aloha.manual (15 sections)
 *   clover.md → clover.manual (13 sections)
 *   csv-matrix.md → signalF.csv-matrix (10 sections)
 *   heartland.md → heartland.manual (9 sections)
 *   lightspeed.md → lightspeed.manual (16 sections)
 *   square.md → square.manual (15 sections)
 *   toast.md → toast.manual (14 sections)
 *   touchbistro.md → touchbistro.manual (10 sections)
 */

const MANUAL_SOURCES = {
  "aloha.manual": {
    "title": "NCR Aloha — item database, modifier groups, exception modifiers, and menu distribution",
    "publisher": "NCR (Voyix) — Aloha POS implementation docs, Field definitions: Items / Modifier Groups / Submenus; Included Modifiers",
    "url": "https://docs.ncrvoyix.com/restaurant/aloha-pos/implementing/field_definitions/items",
    "verified": "official-doc",
    "checked": "2026-09-15",
    "platform": "aloha",
    "manual": "docs/manuals/aloha.md",
    "sections": {
      "item-maintenance-path": "Maintenance → Menu → Items is where every item lives: menu items, the items used to modify them (cheese, lettuce, pickles), and retail items.",
      "mandatory-assignments": "NCR states it as a rule: it is mandatory to apply a tax, a category, and a printer group to an item, and where applicable a modifier group must be assigned (more than one is allowed).",
      "item-number-ranges": "Assign numbers in blocks with a uniform method (their example: appetizers 3000–3999, entrées 4000–4999). Valid range is 1 to 999998, with 999999 reserved for the PLU button, 30100–30199 reserved for 'Open' items (Table Service only, unavailable for gift certificates), and 30200–30299 reserved for …",
      "name-lengths": "Short name appears on the order button, up to 15 characters, but may crop past 11 — type \\n where you want it to break onto a second line. Chit name is up to 15 characters and is typically ALL CAPS, with the explicit instruction to consult the chef.",
      "modifier-tab-ten-groups": "On the item's Modifier tab you attach up to ten groups via the Modifier 1 through Modifier 10 drop-downs in the Modified by group bar — and the tab only appears when the item type is Standard.",
      "modifier-groups-central": "Maintenance → Menu → Modifier Groups: \"modifiers are groups of items used to extend, alter, or further define menu items\", and NCR describes the relationship as circular — items are defined in the Items file, collected into a modifier group, then assigned back to an item.",
      "group-limits-and-prompting": "A group holds up to 54 modifiers on its Layout tab, each button showing the item's short name (or its BMP bitmap if assigned), the item number in the lower-left and the assigned price in the lower-right.",
      "substitution-and-included": "On the item's Dynamic Modifiers tab you designate modifiers as Included (the hamburger's lettuce), with a Substitution charge of None (default: cannot be swapped, and counts against the group's min/max/free only when added to the check), No Charge (can be swapped for a non-included modifier in the …",
      "exception-modifier-groups": "A submenu (TS) has an Exception modifier group: \"the group of items you can use to modify any menu item on the submenu without having to define the items as modifiers for each item\", for things like hot sauce, cheese sauce or onions that apply to no specific item but are requested often enough to …",
      "print-independently-and-routing": "Under the item's Modifier tab, If used as modifier → Print independently prints the modifier on the chit in the same format as a regular item.",
      "price-methods-and-building-blocks": "A modifier item's Price method is Item price (default), Button price or Price level — the difference between pricing the underlying item, the button in a specific group, or a price-level table.",
      "pizza-matrix": "Where a pizzeria workflow is used, the item's Pizza Topping Matrix and Included Topping Matrix tabs hold per-topping depletion percentages — 50% half the regular depletion, 100% no change, 200% double — and a modifier code only appears as a matrix column if Maintenance → Menu → Modifier Codes → …",
      "no-csv-import-86-and-roll": "There is no supported owner-facing menu CSV import: the menu is built as records in the item database and distributed to stores under the ownership model (§3), and an Aloha \"transfer\" between accounts is a back-office data task, not an upload.",
      "audit-checklist": "1. Every item has tax + category + printer group (§2) — the three mandatory assignments. 2. Short/chit/long names within 15 / 15 / 25 characters and chit names readable by the chef (§4). 3. No collision with the reserved number ranges, and blocks used consistently (§3). 4.",
      "menuflow-format": "MenuFlow offers no aloha-csv format, because the platform has no owner-facing CSV to feed (§13). jsonImport: true means a MenuFlow canonical JSON export of an Aloha location can be re-imported into the console for audit, shadow builds and remediation planning, and the aloha.* workflows end in …"
    }
  },
  "clover.manual": {
    "title": "Clover — bulk item import (Excel template), modifier groups, and sync windows",
    "publisher": "Clover / Fiserv — Developer docs (Bulk import inventory; Manage modifier groups and modifiers) + Clover Help",
    "url": "https://docs.clover.com/dev/docs/importing-inventory",
    "verified": "official-doc",
    "checked": "2026-09-15",
    "platform": "clover",
    "manual": "docs/manuals/clover.md",
    "sections": {
      "import-mechanism": "Clover merchants import bulk inventory using a Microsoft Excel sheet, which must be .xls or .xlsx and no larger than 5 MB. There is no CSV upload for Clover's item import — a file that is otherwise perfect but comma-separated simply will not be accepted.",
      "template-tabs": "The import starts at Items → Item list → Download template, giving inventory-template.xls with an Instructions tab and an Items tab; the same download/import affordances exist on the Categories, Modifier Groups and Printer Labels pages.",
      "review-error-by-sheet-row": "If the workbook contains errors the page shows a Review Error link listing problems by Sheet and Row; fix and Start New Import. A clean upload shows a To be added to inventory page with a count per tab, and nothing is written until Continue.",
      "modifier-group-model": "A modifier group carries name and the two selection limits minRequired and maxAllowed that constrain the modifiers applied to an order line item, and showByDefault, which defaults to true on creation — the group pops up when the item is rung. Two operational consequences.",
      "price-in-cents": "The API-level example sets a modifier with {\"price\":100,\"name\":\"Tofu\"} for $1.00, and a modifier's own price is what a webhook/price sync propagates to third-party channels. Money is integer cents throughout Clover's item layer.",
      "item-association": "Groups are created and then associated to items: at the API level via /v3/merchants/{mId}/item_modifier_groups with {modifierGroup:{id}, item:{id}} pairs, and removed the same endpoint with ?delete=true. On the Dashboard the same link is the item's modifier-group list.",
      "export-full-list-only": "Items → Item list → vertical menu → Export produces CloverItemDownload.csv covering the full item list only; a partial export is not supported.",
      "delete-the-id-column": "The export carries each record's Clover ID. When re-importing into a different merchant account (the common processor-change scenario) the IDs must be deleted from the item rows, otherwise the import targets identifiers that do not exist in that merchant.",
      "sync-timing": "Clover's own sync guidance: price and availability changes propagate to online ordering and delivery integrations within about 10 minutes, while structural menu changes (new items, new or edited modifier groups) can take up to 4 hours, and Sync with Clover in the integration's settings forces a …",
      "kiosk-duplicate-groups": "Clover's kiosk guidance for duplicated modifier groups is to create the per-category group and set Pop Up Automatically to no on the duplicate, so the kiosk flow prompts once per item rather than stacking prompts.",
      "option-groups-vs-modifiers": "Clover's UI and API have used option group, shared group and modifier group for the same construct; the data model calls the shared object a modifier group whose rows are modifiers, while variants are the item-shape mechanism (size/temperature) that behaves differently — variants change what you …",
      "audit-checklist": "1. Counts per tab on the To be added page vs the workbook rows (§3). 2. Every modifier group attached to ≥1 item — the invisible-orphan failure (§6). 3. minRequired/maxAllowed sane on each group, and 0/0 only where genuinely unbounded (§4). 4. showByDefault false on optional add-on groups.",
      "menuflow-format": "MenuFlow emits and reads Name, Group, Price, Description, Modifier Groups, Available with ; between group names and true/false for availability, and it accepts Option Groups / Modifiers in group / Min / Max on the way in."
    }
  },
  "signalF.csv-matrix": {
    "title": "Cross-platform CSV/Excel matrix — how each POS encodes items, modifiers and availability in bulk files",
    "publisher": "Signal F Holdings — compiled from the per-platform manuals in this directory (each claim is cited there)",
    "url": "https://github.com/chrisfbaileycb-arch/menuflow-pos/tree/main/docs/manuals",
    "verified": "compiled",
    "checked": "2026-09-15",
    "platform": "shared",
    "manual": "docs/manuals/csv-matrix.md",
    "sections": {
      "unit-of-row": "Square: one item variation (rows sharing an Item Name merge into one item). Clover: one row per object, split across workbook tabs by type. Toast: one row per operation (Operation + Entity type + Operation ID), so the file is a script.",
      "modifier-encoding": "The modifier is where the platforms diverge most, because three of them put the modifier reference in the file and keep its definition somewhere else entirely. Read the \"where\" columns as the audit checklist: anything not in the file has to be verified in the portal.",
      "yes-no-tokens": "Y/N (Square, e.g. Archived, Modifier set [...], blank = off); true/false (Clover availability, Toast Available); yes/no (Lightspeed Available); 1/0 (O-Series toggles such as Is Modifier — and note that is O-Series, not K-Series).",
      "price-formats": "Square: numeric, $0.00 or greater, or blank/Variable — a fixed price cannot be negative. Clover: integer cents at the data layer (100 = $1.00), truncated rather than rounded if you supply fractional cents.",
      "identifier-columns": "Square: Token (blank for new, never edited for existing) and Reference/Reference Handle. Clover: Clover ID must be deleted when importing into a different merchant. Lightspeed: SKU is both identity and update key — reusing one silently edits somebody else's item.",
      "file-shape-constraints": "Clover wants .xls/.xlsx ≤ 5 MB and will not take a CSV for item import. Square's CSV path rejects xlsx/xls/xlsm, demands the file name is unchanged, forbids deleting empty columns or renaming headers, and advises removing commas from text until after import.",
      "reversibility": "Square offers Actions → Undo Catalogue after an import, a real (if one-shot) escape hatch, plus an explicit Modify vs Replace choice at upload. Toast states that bulk-import changes are not reversible.",
      "never-round-trips": "Modifier set definitions (options, prices, min/max, popup behaviour) on Square; menus, sections, display order, advanced modifier settings and auto-adds on Square; association between items and groups if you only fill the group tab on Clover.",
      "canonical-mapping": "Canonical items reference modifier group records; groups hold options with priceDelta; a group carries minChoices, maxChoices, included, shared, availableOnline; availability is per channel name; pricing is a first-match-wins rule stack with scope filters; money is integer cents.",
      "menuflow-divergence": "square-csv, clover-csv, lightspeed-csv and toast-csv in this repo are deliberately simplified: a small, human-diffable, semicolon/pipe-separated shape for staging, audit and dry-run."
    }
  },
  "heartland.manual": {
    "title": "Heartland PocketSuite/Genius — Admin Console menu editing, the JSON contract, and what bulk really means",
    "publisher": "Heartland / Fiserv Help Center (Items Screen, Modifiers Screen, Mini Manager Guide) + Signal F Holdings KB",
    "url": "https://heartlandpos.zendesk.com/hc/en-us/articles/20200889252507-Items-Screen",
    "verified": "official-doc",
    "checked": "2026-09-15",
    "platform": "heartland",
    "manual": "docs/manuals/heartland.md",
    "sections": {
      "no-csv-import": "Heartland's documented menu surfaces are Admin Console → Menu → Items (and Modifiers, Categories, Tax, Online Ordering) with per-field entry, plus on-terminal edits from the Mini Manager.",
      "items-screen": "Log into the Admin Console, select the account, then Main Menu → Menu → Items, and click New. Field behaviour worth knowing: the Misc.",
      "modifiers-screen": "Admin Console → Menu → Modifiers carries: Name, Show Modifier Name, Min Choices, Max Choices, Number of Included Ingredients, ingredient Default Price, the Assigned Items list, and Available Online.",
      "admin-vs-pos": "Hosted edits live in the Admin Console; terminal-side state lives on the Genius. Item stock limits are set on the terminal (long-press the item, or Manager → Item Stock Management), and 86-by-stock-limit is a per-service state that never appears in a portal menu export.",
      "discounts-vs-adjustments": "At checkout, a discount applies to items while an adjustment applies to the ticket, and a void prompts for a reason. This distinction drives the pricing-stack audit: a discount attached to an item interacts with modifier default prices, whereas an adjustment does not, so \"the guest paid less than …",
      "json-shape": "heartland-json is the exact shape the original heartland-pos python scripts read: a JSON array of {name, category, price, modifiers:[{name, group, price}], time_ranges}, with price in integer cents and time_ranges as [start, end] minute offsets from midnight.",
      "legacy-time-ranges": "In the flat shape an item carries time_ranges; ranges that cross midnight must be split at the day boundary or the item is available at the wrong hours (their own rule: 22:00–02:00 becomes 22:00–23:59 plus 00:00–02:00, with the day increment handled at the boundary).",
      "audit-checklist": "1. Every shared modifier group's Assigned Items span: one group across unrelated categories is the primary finding (cross_contamination). 2. Min/Max Choices sane per group, with 0/0 only where unbounded is intended. 3.",
      "menuflow-format": "Two formats, on purpose. canonical-json is lossless against MenuFlow's own model (categories, items, modifier groups with options/min/max/included/shared flags, pricing rules, schedules, channels) and is the format a re-import must use for a shadow build."
    }
  },
  "lightspeed.manual": {
    "title": "Lightspeed Restaurant (K-Series) — item import columns, groups as items, and menu screens",
    "publisher": "Lightspeed — Restaurant K-Series support (Importing and exporting items in bulk; Importing and exporting menus; Modifiers and modifier groups)",
    "url": "https://k-series-support.lightspeedhq.com/hc/en-us/articles/1260804656109-Importing-and-exporting-items-in-bulk",
    "verified": "official-doc",
    "checked": "2026-09-15",
    "platform": "lightspeed",
    "manual": "docs/manuals/lightspeed.md",
    "sections": {
      "required-columns": "SKU must be present on all imports: unique for new items, and used as the key that identifies which existing item to modify when updating. Accounting group must also be present — accounting groups carry shared settings such as taxes and production centers.",
      "min-max-for-groups": "For rows typed Group, the Min - Max column is mandatory, in the form 2-5 meaning \"choose at least 2, at most 5\". This is K-Series' equivalent of Heartland's Min/Max Choices and Clover's minRequired/maxAllowed, expressed as one hyphenated cell instead of two columns.",
      "extra-price": "Extra price adds a price for an item inside a group: in the group Fries, sweet potato fries sell above the French fries by the amount in that member's cell.",
      "parent-sku": "Parent SKU identifies the main menu item an item belongs to (documented for combos); group membership follows the same parent/child shape rather than a join table.",
      "menu-screen-path": "The optional Menu/Screen column places the button, formatted Menu/Screen/Sub-screen; all menus created in the Back Office are valid targets.",
      "column-mapping": "On the Import items page you map each column of your file to a Back Office field; SKU and Type must be mapped for the import to process, unused optional columns are set to Skip for import, and Map identical column names does it automatically — Lightspeed explicitly recommends double-checking the …",
      "accounting-group-autocreate": "An optional toggle creates any accounting groups in the file that do not exist yet; if it is left off, items whose accounting group does not exist will not import.",
      "no-delete-and-no-undo": "Once imported, items can be disabled or re-enabled from the Back Office, but they cannot be deleted, and the documentation states plainly that item updates cannot be automatically reversed after they are imported. There is no Undo Catalogue equivalent.",
      "export-reimport-trap": "The guidance is explicit: some item columns will not be correctly formatted for re-import after they are exported from the Back Office, so you must re-format them against the import requirements before uploading.",
      "other-columns": "Name must be unique. Production instruction values must already exist in the Back Office before the import can reference them. Course is a number, or blank to leave unset. Statistic group uses category/tag and comma-separates several. Barcode accepts EAN/UPC and comma-separates multiples.",
      "row-limits": "Menu/item import files are capped (the item import documentation works to a 10,000-row limit for price and item files) and the guidance asks you to delete an entire optional column if it is unused rather than leave it blank, to streamline the import.",
      "modifiers-and-groups": "Modifier groups are built under Menu → Item list → Create → Modifier group; the option list has SKU auto-generated but editable, each option takes an Option name, a Price adjustment and an Accounting group, and its Parent item group is filled for you when you add options to the group.",
      "ai-menu-scan": "Menu → Item list → Import → Start import → Scan your menu accepts .PDF, .PNG, .JPG, .HTML, .CSV or .TXT and auto-creates items, with Advanced settings that change your data model: Modifier strategy (Shared — one modifier group applied across all types of an item, e.g.",
      "k-vs-o-series": "Lightspeed's other restaurant product (O-Series, formerly Kounta) documents a different import: required columns like Cost Tax Code and Is Modifier (1/0), Yes/No toggles written as 1/0, an explicit \"do not edit Product ID\", a 450-row file-size rule, and \"product variants and option sets cannot be …",
      "audit-checklist": "1. No new item row reused an existing SKU (§1) — this is the destructive mistake. 2. Every Group row has a parseable Min - Max (§2) and its members have Extra price rather than the parent (§3). 3. Accounting group strings match existing groups exactly; no near-miss duplicates (§7). 4.",
      "menuflow-format": "MenuFlow writes Type, Name, Category, Price, Description, Modifier Groups, Available — with Type rows for categories, ; between modifier group names, and yes/no availability — and reads Min/Max, Tax and Available back in."
    }
  },
  "square.manual": {
    "title": "Square for Restaurants — item library CSV, import/export and modifier sets",
    "publisher": "Square / Block, Inc. — Help Center (article 5153) + Seller Community, moderator-confirmed threads",
    "url": "https://squareup.com/help/au/en/article/5153-import-items-online",
    "verified": "official-doc",
    "checked": "2026-09-15",
    "platform": "square",
    "manual": "docs/manuals/square.md",
    "sections": {
      "template-source": "Sign in to the Square Dashboard, open Items & services (or Items & menus / Items & inventory) → Items, then Actions → Export Library. For a new library choose Blank import library to download the template; to update, export All items or Items matching applied filters.",
      "required-columns": "The import requires Item Name, Variation Name, Description and SKU. If the account has more than one location, Enabled [Location Name] becomes required as well.",
      "token-and-reference": "Token is populated by the Dashboard automatically. For a new item leave it blank; for an edit never change it. Reference (or Reference Handle) is the value used to associate variations across rows — including linking stock to sell-by variations during an inventory import.",
      "modifier-set-columns": "There is no column that defines a modifier set. The file carries Modifier set [Your modifier set] — one column per set that already exists in the account — holding a Yes (Y) / No (N) value indicating whether that set applies to the item. Leaving the field blank defaults the modifier to off.",
      "variation-grouping": "Square groups rows by Item Name; variations of one item must therefore share the same name (and, per the importer's validation errors, the same description). Two distinct products that happen to share a name are silently merged into one item with two variations.",
      "price-and-variable": "Price must be numeric and $0.00 or greater; a fixed price cannot be negative. Leaving it blank, or writing Variable, creates a variable-priced item where staff enter the amount at sale time.",
      "commas-and-quotes": "The import tool is strict about the file: it must be a CSV for the CSV path (XLSX/XLS/XLSM are rejected by that path), the file name must not change, no empty columns may be deleted, and Square's own troubleshooting advice is to remove commas from any text you add and put them back after import.",
      "tax-header-format": "A tax column must keep the exact heading form including the rate in parentheses, e.g. Tax - Sales (7%). A renamed or re-formatted tax header does not fail loudly; it is simply not recognized, and the item imports untaxed.",
      "modify-vs-replace": "Actions → Import Library asks you to choose Modify Item Library (add new + update existing) or Replace Item Library (delete all existing items, then load the file). Replace is destructive to the whole library, not just to rows present in the file. In the Dashboard the confirmation is explicit.",
      "undo-catalogue": "After a confirmed import, the Items page offers Actions → Undo [Import/Update] (Undo Catalogue) to roll the library back to the pre-import state.",
      "item-type-values": "Supported values include Standard, Prepared food and beverage, Physical good, Event, Digital, Other, Bundle, Service and Donation. Blank imports as Standard.",
      "location-columns": "Each location contributes columns (Price [Loc], Stock alert count [Loc], Enabled [Loc]). Importing a single-location file into a multi-location account leaves the other locations untouched rather than disabling them; importing the reverse can strip location pricing.",
      "not-exported": "Modifier sets, their options, prices and selection rules; menus and menu sections; display/feature order; advanced modifier settings (min/max selections, sold-out ordering); auto-add to check; kitchen/printer routing; item images; and channel visibility toggles beyond the location Enabled columns.",
      "audit-checklist": "1. Row count in = item count out, and variation count per item unchanged (guards §5 accidental merging). 2. Duplicate Item Name across categories (the merge hazard) — MenuFlow's duplicate_items and cross_contamination scans. 3.",
      "menuflow-format": "MenuFlow's square-csv export writes Name, Category Name, Price, Description, Modifier Set, Visible and its importer also reads Category Name, Option List N — Name/Values and modifier_lists."
    }
  },
  "toast.manual": {
    "title": "Toast — bulk menu import (operation-row templates), modifier pricing, and the publish cycle",
    "publisher": "Toast, Inc. — Platform guide (Bulk import tool overview; Filling out a bulk import spreadsheet) + Toast Support",
    "url": "https://doc.toasttab.com/doc/platformguide/platformBulkImportToolOverview.html",
    "verified": "official-doc",
    "checked": "2026-09-15",
    "platform": "toast",
    "manual": "docs/manuals/toast.md",
    "sections": {
      "access-requirement": "A restaurant must have Restaurant Management Essentials, Pro or Enterprise, or the multi-location module, to access the bulk menu import feature. Confirm the entitlement before quoting a menu migration as \"a CSV away\"; on a base package the same work is manual entry in Toast Web.",
      "irreversibility": "Toast's own documentation leads with this: changes made using the bulk import tool are not reversible. There is no undo button analogous to Square's Undo Catalogue.",
      "templates": "Basic creates new menu items, modifier groups and modifiers with the minimum fields (name, pricing strategy, price, parent) and forces BASE pricing on items. Item update updates name, price, SKU, PLU, description, POS name, kitchen name and sales category on existing items.",
      "operation-rows": "Every row carries Operation (for the basic template always CREATE), Entity type (MENU_ITEM, MODIFIER_GROUP, MODIFIER) and a Operation ID that must be unique in the file, up to 255 characters, and is conventionally 1, 2, 3… Toast Support's own recommendation is exactly that increment.",
      "parent-attach": "Parent entity type takes MENU_GROUP, MENU_ITEM or MODIFIER_GROUP, and Parent version ID or operation ID names the parent. If the parent already exists in Toast, enter its Toast GUID; if the parent is being created in the same spreadsheet, enter the operation ID of the row that creates it.",
      "pricing-strategies": "Pricing strategy or method is case-insensitive and its legal values depend on the entity: menu items created with the basic template must use BASE.",
      "price-string-rules": "A Toast price cell: may use a minus sign (-1.00) or parentheses ((1.00)) to indicate a reduction; cents are optional (10 and 10.00 both valid); thousands separators optional (1,000 or 1000); null accepted; max 25 characters; and no currency symbol ($100 is invalid).",
      "publish-cycle": "Every Toast menu edit requires Save and then Publish all changes; an un-published edit is invisible to the terminals. Treat publish as the commit point of the whole operation: the audit, the dry-run and the checks happen pre-publish, and the \"did it work\" verification happens post-publish on a …",
      "empty-modifier-groups": "Toast documents that empty modifier groups (a group with no modifiers, or with all modifiers inactive) break third-party syncs and can cause menus to fail to appear; the fix is to fill the group or delete it.",
      "required-vs-optional-prompts": "When creating modifier groups and modifiers, a group is Required or Optional, and the POS prompt behaviour is set by \"Include a POS prompt\". A required group without the prompt is a legal configuration that produces orders missing the choice — i.e.",
      "items-database-exports": "Menu management → Bulk management → Advanced properties (and the Items Database view) is where you archive, restore, version and export menu data; it is explicitly not where a menu is built.",
      "menu-manager-export": "Toast's menu manager has a more recent export/import workflow covering a limited set of pricing update types: the CSV it produces is already filled out from your existing menu data. Functionally it produces the same operation-row shape.",
      "audit-checklist": "1. The import log per operation ID, not just a \"success\" banner — some operations fail alone. 2. Operation ID uniqueness in the submitted file (§4) — duplicates are the classic silent-misattach cause. 3. Every MODIFIER_GROUP row resolves to a parent that existed at submit time (§5). 4.",
      "menuflow-format": "MenuFlow's Toast file is one row per item (Group Name, Item Name, Price, Description, Modifier Groups, Available, with | between modifier groups) because that is the shape a human can read against a printed menu and the shape the audit engine can check."
    }
  },
  "touchbistro.manual": {
    "title": "TouchBistro — bulk menu upload, RMM item setup, and the modifier/86 model",
    "publisher": "TouchBistro — Help Center (\"Setting up Menu Items\"; \"Uploading Menu Items in Bulk using RMM\" / \"…using Menu Management 1.0\")",
    "url": "https://cdn.touchbistro.com/help/articles/setting-menu-items/",
    "verified": "access-limited",
    "checked": "2026-09-15",
    "platform": "touchbistro",
    "manual": "docs/manuals/touchbistro.md",
    "sections": {
      "access-and-caveats": "Setting up Menu Items is published as a static CDN article and was read directly; its field notes are reproduced below. The bulk-upload articles now redirect to a logged-in help portal (help.touchbistro.com), so their titles, section lists and the documented limitations come from the public index …",
      "bulk-upload-new-only": "Menu Management's bulk path takes a comma-separated-values file edited in Excel or Google Sheets to batch upload multiple pre-defined menu items.",
      "rmm-upload-flow": "RMM's upload path is Menu Options → Categories, pick the category to upload into (e.g. Mains), then supply the items, with Modifier Groups and Taxes completed on the same screen where they are needed.",
      "category-inheritance": "In the item editor, most of the additional-detail settings are defaulted by the Menu Category and only need reviewing; the item screen lets you tap Menu Category to move the item and Sales Category to assign its reporting bucket, and course inherits from the category with a per-item override.",
      "item-review-lines": "TouchBistro's own guidance is to review the item's detail lines rather than assume defaults: sales category, visible/hidden, course, tax, and kitchen printers.",
      "modifiers-as-options": "TouchBistro's modifiers are option lists attached to items, configured with a minimum and maximum number of selections and per-option price adjustments; the item's own Modifier Groups are set in RMM (with the option to leave a group non-popupping for kiosk/online flows).",
      "pos-86-is-not-delete": "86ing on the TouchBistro POS is the X next to the item; it removes the item from ordering without touching the menu definition, and the record survives for reporting.",
      "online-toggle-independent": "The Online Ordering (per-channel visibility) setting is independent of the item's hidden state and of the POS 86. An item can be sellable in the dining room and hidden online, or live online and 86'd at the register.",
      "audit-checklist": "1. Tax set on the item, not assumed from the category (§4/§5) — the bulk path cannot fix it (§2). 2. Course correct (or deliberately overridden) and consistent with the category default (§4). 3. Visibility: hidden vs 86'd vs online-hidden, each read separately (§7/§8). 4.",
      "menuflow-format": "MenuFlow has no touchbistro-csv upload format: TouchBistro's bulk path accepts only new items and ignores tax and image settings (§2), so a MenuFlow TouchBistro export exists for diffing, audit input and shadow-build review, while the TouchBistro import path in this repo consumes canonical JSON …"
    }
  }
};

module.exports = MANUAL_SOURCES;

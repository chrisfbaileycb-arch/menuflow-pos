---
docId: toast.manual
title: Toast — bulk menu import (operation-row templates), modifier pricing, and the publish cycle
platform: toast
publisher: Toast, Inc. — Platform guide (Bulk import tool overview; Filling out a bulk import spreadsheet) + Toast Support
url: https://doc.toasttab.com/doc/platformguide/platformBulkImportToolOverview.html
verified: official-doc
checked: 2026-09-15
file: docs/manuals/toast.md
scope: >
  The Toast Web bulk import tool's spreadsheet semantics — why it is operation rows rather
  than one row per item — plus modifier-group pricing and the publish step that every Toast
  change depends on.
---

# Toast — bulk import and the publish cycle

A Toast bulk import file is a **list of operations**, not a list of items. Every row says
"CREATE this entity" or "UPDATE this attribute" and names its parent. That single design
decision explains why a spreadsheet copied from another POS never works on Toast, and why
the import is the right place to enforce ordering.

## 1. access-requirement — The bulk import tool is a paid-module feature

A restaurant must have **Restaurant Management Essentials, Pro or Enterprise**, or the
multi-location module, to access the bulk menu import feature. Confirm the entitlement
before quoting a menu migration as "a CSV away"; on a base package the same work is manual
entry in Toast Web. Reach the tool at **Menus → Bulk management → Bulk import tool**.

## 2. irreversibility — Bulk import changes are not reversible

Toast's own documentation leads with this: **changes made using the bulk import tool are not
reversible.** There is no undo button analogous to Square's Undo Catalogue. That makes the
pre-import export mandatory rather than advisory, and it is why MenuFlow treats any
toast import workflow as gate-protected, staged, and dry-run-first: the audit trail and the
saved export are the only rollback path.

## 3. templates — Three spreadsheets for three jobs

**Basic** creates new menu items, modifier groups and modifiers with the minimum fields
(name, pricing strategy, price, parent) and forces `BASE` pricing on items. **Item update**
updates name, price, SKU, PLU, description, POS name, kitchen name and sales category on
existing items. **Advanced** creates and *attaches* items, modifier groups and modifiers and
sets things like button color, SKU and PLU. Each template is a Google Sheets file you copy
from the tool page and then download as CSV — the copy step is not optional, because the
drop-down validation lives in the copy.

## 4. operation-rows — Operation, Entity type, Operation ID

Every row carries **`Operation`** (for the basic template always `CREATE`), **`Entity type`**
(`MENU_ITEM`, `MODIFIER_GROUP`, `MODIFIER`) and a **`Operation ID`** that must be **unique in
the file**, up to 255 characters, and is conventionally 1, 2, 3… Toast Support's own
recommendation is exactly that increment. The operation ID is a *temporary, file-local key*:
it is how one row refers to another row's entity before that entity exists.

## 5. parent-attach — Naming the parent with a GUID or an operation ID

**`Parent entity type`** takes `MENU_GROUP`, `MENU_ITEM` or `MODIFIER_GROUP`, and
**`Parent version ID or operation ID`** names the parent. If the parent already exists in
Toast, enter its **Toast GUID**; if the parent is being created **in the same spreadsheet**,
enter the **operation ID** of the row that creates it. So a valid import file is a
dependency graph: create the group before the item that points at it, and create the item
before the modifier group attached to it. A flat "one row per item" file has no way to
express this, which is the mechanical reason row-order matters in Toast files.

## 6. pricing-strategies — BASE vs PRICED_BY_MODIFIERS on the group

`Pricing strategy or method` is case-insensitive and its legal values depend on the entity:
menu items created with the basic template must use `BASE`; a **modifier group** uses
`BASE` to mean "additional charge — price set by modifier group" (one flat price for the
group) or `PRICED_BY_MODIFIERS` for "additional charge — price set on individual modifiers".
When a group is `PRICED_BY_MODIFIERS` the **group's `Price` cell must be left empty** and the
prices live on the modifier rows; when the group is `BASE`, an individual modifier's own
strategy and price are **ignored**. Note the documented constraint: you cannot create, via
the bulk tool, a modifier group that does not charge for its modifiers — a
free-choice group has to be built in Toast Web, not imported.

## 7. price-string-rules — Prices are strings with their own grammar

A Toast price cell: may use a minus sign (`-1.00`) or parentheses (`(1.00)`) to indicate a
**reduction**; cents are optional (`10` and `10.00` both valid); thousands separators
optional (`1,000` or `1000`); `null` accepted; **max 25 characters**; and **no currency
symbol** (`$100` is invalid). The parentheses convention means a cell like `(1.00)` is a
*discount modifier* — worth checking deliberately, because a spreadsheet that auto-formats
accounting negatives will silently turn an intended typo into a price reduction.

## 8. publish-cycle — Save is not publish; nothing reaches the POS until you publish

Every Toast menu edit requires **Save** and then **Publish all changes**; an un-published
edit is invisible to the terminals. Treat publish as the commit point of the whole operation:
the audit, the dry-run and the checks happen pre-publish, and the "did it work" verification
happens post-publish on a POS/Flex device, not in the editor. MenuFlow's
`toast.publish-cycle` workflow exists because the two-step is the most frequent cause of
"we changed it and nothing happened".

## 9. empty-modifier-groups — Empty groups break third-party syncs and can hide menus

Toast documents that **empty modifier groups** (a group with no modifiers, or with all
modifiers inactive) break third-party syncs and can cause menus to fail to appear; the fix
is to fill the group or delete it. This is why the engine blocks publishing a menu with
empty groups rather than warning: on Toast the defect does not surface as a bad button, it
surfaces as a broken delivery integration at 6pm.

## 10. required-vs-optional-prompts — "Include a POS prompt" is the required flag

When creating modifier groups and modifiers, a group is **Required** or **Optional**, and the
POS prompt behaviour is set by **"Include a POS prompt"**. A required group without the
prompt is a legal configuration that produces orders missing the choice — i.e. the ticket
looks fine and the kitchen never learns the guest wanted no onion. Verify prompt and
requirement together, never one without the other.

## 11. items-database-exports — The Items Database is for review, archive and export, not creation

**Menu management → Bulk management → Advanced properties** (and the Items Database view) is
where you archive, restore, version and export menu data; it is explicitly *not* where a
menu is built. Restore of an archived entity is done from the same advanced-properties path
with **Show Archived Menus / Groups** toggled on. For an audit this is the authoritative
place to answer "does this item exist at all, and at which locations/versions?", which the
flat items export cannot answer.

## 12. menu-manager-export — A newer export/import path that pre-fills the file

Toast's menu manager has a more recent export/import workflow covering a **limited set of
pricing update types**: the CSV it produces is already filled out from your existing menu
data. Functionally it produces the same operation-row shape. Prefer it over hand-editing a
basic template when the change you want is inside its supported set — the file being
pre-filled by Toast is what removes the GUID-vs-operation-ID transcription risk.

## 13. audit-checklist — What to check after a Toast bulk import

1. The import log per operation ID, not just a "success" banner — some operations fail alone.
2. `Operation ID` uniqueness in the submitted file (§4) — duplicates are the classic
   silent-misattach cause.
3. Every `MODIFIER_GROUP` row resolves to a parent that existed at submit time (§5).
4. No group left empty by the import (§9) — run the `empty_groups` check before publish.
5. Group pricing strategy vs where prices actually are: `PRICED_BY_MODIFIERS` with a group
   price, or `BASE` with per-modifier prices you thought were live (§6).
6. Accounting-style parentheses in price cells that were never meant as reductions (§7).
7. Published, then verified on a device (§8).

## 14. menuflow-format — MenuFlow's `toast-csv` is a review format, not an upload file

MenuFlow's Toast file is one row per item (`Group Name, Item Name, Price, Description,
Modifier Groups, Available`, with `|` between modifier groups) because that is the shape a
human can read against a printed menu and the shape the audit engine can check. It is **not**
the Toast bulk import template: Toast needs operation rows with `Operation`, `Entity type`,
`Operation ID`, `Parent entity type` and `Parent version ID or operation ID` (§3–§5), and
Toast's import is irreversible (§2). Mapping MenuFlow → Toast means emitting, per MenuFlow
row: one `MENU_ITEM` CREATE row parented to its menu group, one `MODIFIER_GROUP` CREATE row
parented to the item or menu group, and one `MODIFIER` CREATE row per option — with
`PRICED_BY_MODIFIERS` where MenuFlow carries per-option deltas. MenuFlow never claims to
produce a Toast-uploadable file, and its import/export workflows end in a caveat step saying
so; the portal write stays a human-gated manual step.

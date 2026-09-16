---
docId: clover.manual
title: Clover — bulk item import (Excel template), modifier groups, and sync windows
platform: clover
publisher: Clover / Fiserv — Developer docs (Bulk import inventory; Manage modifier groups and modifiers) + Clover Help
url: https://docs.clover.com/dev/docs/importing-inventory
verified: official-doc
checked: 2026-09-15
file: docs/manuals/clover.md
scope: >
  Bulk item creation in the Clover Merchant Dashboard and the modifier-group data model
  that a menu migration has to reproduce. Kiosk/Online addenda note where Clover's own
  apps behave differently.
---

# Clover — bulk items and modifier groups

Clover's model is item-centric with **modifier groups as separate shared objects** that are
*associated* to items. That association is the step every Clover migration forgets, and it
is why "the items came over but there are no modifiers" is the most common Clover service
call a consultant sees.

## 1. import-mechanism — Bulk import is an Excel workbook, not a CSV

Clover merchants import bulk inventory using a **Microsoft Excel sheet**, which must be
`.xls` or `.xlsx` and **no larger than 5 MB**. There is no CSV upload for Clover's item
import — a file that is otherwise perfect but comma-separated simply will not be accepted.
Any Clover migration plan therefore has an Excel step, and any tool that produces CSV
(including MenuFlow) is producing a *source* for that workbook, not the upload itself.

## 2. template-tabs — One workbook, one tab per object type

The import starts at **Items → Item list → Download template**, giving `inventory-template.xls`
with an **Instructions** tab and an **Items** tab; the same download/import affordances exist
on the **Categories**, **Modifier Groups** and **Printer Labels** pages. Fill one tab per
object type, then **Import Your Menu Spreadsheet** (drag-and-drop or Choose File).
Because each object type has its own tab, a modifier group can exist in the workbook while
being attached to nothing — the workbook will not warn you.

## 3. review-error-by-sheet-row — Validation reports by sheet and row, and import is a preview-then-continue flow

If the workbook contains errors the page shows a **Review Error** link listing problems **by
Sheet and Row**; fix and **Start New Import**. A clean upload shows a *To be added to
inventory* page with a count per tab, and nothing is written until **Continue**. Read that
count: it is the cheapest check that the right number of items *and* modifier groups
landed, and it is the last point at which a bad workbook is free to abandon.

## 4. modifier-group-model — minRequired, maxAllowed, showByDefault

A modifier group carries `name` and the two selection limits **`minRequired`** and
**`maxAllowed`** that constrain the modifiers applied to an order line item, and
**`showByDefault`**, which defaults to **`true`** on creation — the group pops up when the
item is rung. Two operational consequences:

- A group imported without setting `showByDefault: false` on an optional add-on group adds a
  tap to every order of that item: slower line at the register, and in a kiosk it is an
  abandonment surface.
- `minRequired: 1, maxAllowed: 1` is how a *forced single choice* (steak temperature, milk
  alternative) is expressed; `0/0` is unbounded-optional. Clover has no "required but
  default-preselected" state in the group itself — the default has to be an included
  modifier or a modifier with the default flag.

## 5. price-in-cents — Modifier prices are integer cents

The API-level example sets a modifier with `{"price":100,"name":"Tofu"}` for **$1.00**, and
a modifier's own price is what a webhook/price sync propagates to third-party channels.
Money is integer cents throughout Clover's item layer; a spreadsheet written in dollars is
converted by the Dashboard, and a value like `1.005` is truncated silently rather than
rounded. Audit price deltas in cents, never in formatted strings.

## 6. item-association — A group attached to nothing is invisible

Groups are created and then **associated to items**: at the API level via
`/v3/merchants/{mId}/item_modifier_groups` with `{modifierGroup:{id}, item:{id}}` pairs, and
removed the same endpoint with `?delete=true`. On the Dashboard the same link is the item's
modifier-group list. Because association is a *separate* object from both the group and the
item, an import that creates 40 items and 6 modifier groups can leave 6 groups attached to
0 items — perfectly valid data, completely invisible at order entry. Verify association
counts explicitly after every import.

## 7. export-full-list-only — Export is whole-menu, with no partial option

**Items → Item list → vertical menu → Export** produces `CloverItemDownload.csv` covering
the **full item list only**; a partial export is not supported. Two effects worth planning
around: the export is a complete backup you should take before any bulk change (it is the
rollback reference), and on a large multi-section menu it is a big file you must not trim
into an import without keeping the columns Clover expects.

## 8. delete-the-id-column — Clover IDs are the key; blank them for new records

The export carries each record's `Clover ID`. When re-importing into a **different**
merchant account (the common processor-change scenario) the IDs must be **deleted** from
the item rows, otherwise the import targets identifiers that do not exist in that merchant.
Same rule as Square's `Token`: identifiers are only meaningful inside the account that
issued them.

## 9. sync-timing — Price and availability sync in ~10 minutes; structural changes up to 4 hours

Clover's own sync guidance: price and availability changes propagate to online ordering
and delivery integrations within about **10 minutes**, while structural menu changes (new
items, new or edited modifier groups) can take up to **4 hours**, and **Sync with Clover**
in the integration's settings forces a refresh. This is the difference between a menu change
that is safe during service and one that is not: a price edit at 6pm is visible in the
dinner rush; a modifier-group edit may not reach the ordering channel until after close.
MenuFlow's `clover.online-sync` and `clover.price-sync` workflows encode the two windows
separately for that reason.

## 10. kiosk-duplicate-groups — Kiosk wants per-category groups, not one shared copy

Clover's kiosk guidance for duplicated modifier groups is to create the per-category group
and set **Pop Up Automatically** to **no** on the duplicate, so the kiosk flow prompts once
per item rather than stacking prompts. Read alongside the isolation doctrine: the fix for a
shared "Pepperoni" group that reaches every category is a scoped group per category — but on
Clover the popup flag has to be part of the change or you have traded contamination for a
worse ordering UX.

## 11. option-groups-vs-modifiers — "Option Group" is the older name you will see everywhere

Clover's UI and API have used *option group*, *shared group* and *modifier group* for the same
construct; the data model calls the shared object a modifier group whose rows are
modifiers, while *variants* are the item-shape mechanism (size/temperature) that behaves
differently — variants change what you sell, modifiers describe how you sell it. When mapping
a menu from a platform with a single "modifier" concept, decide deliberately for each group
whether it is a variant (one item, several prices) or a modifier group (one item, price
deltas), because Clover reports and inventory treat the two differently.

## 12. audit-checklist — What to check after a Clover import

1. Counts per tab on the *To be added* page vs the workbook rows (§3).
2. Every modifier group attached to ≥1 item — the invisible-orphan failure (§6).
3. `minRequired/maxAllowed` sane on each group, and 0/0 only where genuinely unbounded (§4).
4. `showByDefault` false on optional add-on groups; true only on forced choices (§4).
5. Price deltas as integer cents, none truncated (§5).
6. Empty groups: a group with zero modifiers must be filled or deleted before it reaches a
   third-party sync (§2/§6).
7. Force a **Sync with Clover** and confirm the ordering channel after a structural change
   (§9).

## 13. menuflow-format — MenuFlow's `clover-csv` is a review format, not an upload file

MenuFlow emits and reads `Name, Group, Price, Description, Modifier Groups, Available`
with `;` between group names and `true/false` for availability, and it accepts
`Option Groups` / `Modifiers in group` / `Min` / `Max` on the way in. To get that into
Clover you must place the same data on the workbook's Items, Categories and Modifier Groups
tabs, set the popup flag per group, and import the `.xlsx` (§1). MenuFlow uses the CSV to
stage, audit and dry-run the change; the upload stays a human-gated manual step.

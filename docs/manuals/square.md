---
docId: square.manual
title: Square for Restaurants — item library CSV, import/export and modifier sets
platform: square
publisher: Square / Block, Inc. — Help Center (article 5153) + Seller Community, moderator-confirmed threads
url: https://squareup.com/help/au/en/article/5153-import-items-online
verified: official-doc
checked: 2026-09-15
file: docs/manuals/square.md
scope: >
  Item-library bulk import/export in the Square Dashboard, and how modifier sets are
  expressed in that file. Applies to Square for Restaurants accounts that share the
  Items library; Restaurants-only constructs (menus, menu sections, courses, auto-adds)
  are covered in "what never round-trips".
---

# Square for Restaurants — item library CSV

Square's bulk file is an **Item Library** file, not a menu file. One row is one **item
variation**; the menu structure a guest sees is a separate object. This distinction
explains most failed imports and most "my modifiers disappeared" service calls.

## 1. template-source — Always import into the template you exported from your own account

Sign in to the Square Dashboard, open **Items & services** (or **Items & menus** /
**Items & inventory**) → **Items**, then **Actions → Export Library**. For a new library
choose **Blank import library** to download the template; to update, export **All items**
or **Items matching applied filters**. Square's own guidance is to create at least one
sample item by hand first, then export it, because the export is the authoritative column
set for that account. Header names cannot be changed and columns cannot be added — you
may add rows only.

## 2. required-columns — The four columns that must be present

The import requires **Item Name**, **Variation Name**, **Description** and **SKU**. If the
account has more than one location, **`Enabled [Location Name]`** becomes required as
well. A blank `Category` does not error: the item lands in *Uncategorised*, and re-importing
an item with a blank `Category` does **not** strip it from the category it already belongs
to.

## 3. token-and-reference — Token/Reference columns are Square's keys; leave them blank for new items

`Token` is populated by the Dashboard automatically. For a **new** item leave it blank;
for an **edit** never change it. `Reference` (or Reference Handle) is the value used to
associate variations across rows — including linking stock to sell-by variations during an
inventory import. Practically: the file is idempotent only if these keys survive your
spreadsheet edits, so a re-export before every import is mandatory hygiene.

## 4. modifier-set-columns — Modifiers travel as one Y/N column per set

There is **no** column that defines a modifier set. The file carries
**`Modifier set [Your modifier set]`** — one column per set that already exists in the
account — holding a **Yes (Y) / No (N)** value indicating whether that set applies to the
item. Leaving the field blank defaults the modifier to **off**. Consequences for a
consultant:

- A set that does not exist in the destination account cannot be created by the import;
  it must be built in **Items → Modifiers** first, or the column is silently meaningless.
- The **contents** of a set (options, prices, min/max, selection rules) never appear in
  the file, so they can never be audited or migrated through it.
- Because Y/N is per row, a modifier set is attached to a *variation*, and the effective
  attachment for the item is the union across its variations — two variations of one item
  disagreeing is a real, common state.

## 5. variation-grouping — Rows sharing an Item Name become one item with variations

Square groups rows by `Item Name`; variations of one item must therefore share the same
name (and, per the importer's validation errors, the same description). Two distinct
products that happen to share a name are silently merged into one item with two
variations. This is the single most damaging accidental transformation in a Square import:
it is a **duplicate-name / cross-contamination** event of exactly the kind the audit suite
flags on other platforms, but here it is created *by the import itself*.

## 6. price-and-variable — Price is numeric, blank, or the literal `Variable`

`Price` must be numeric and **$0.00 or greater**; a fixed price cannot be negative. Leaving
it blank, or writing `Variable`, creates a variable-priced item where staff enter the
amount at sale time. Location-specific pricing goes in **`Price [Your location name]`**,
and the same location-suffix trick applies to stock alert counts and availability.

## 7. commas-and-quotes — Remove commas from text if you are working in CSV

The import tool is strict about the file: it must be a **CSV** for the CSV path (XLSX/XLS/XLSM
are rejected by that path), the file name must not change, no empty columns may be deleted,
and Square's own troubleshooting advice is to **remove commas from any text you add** and
put them back after import. Modern guidance leans to the `.xlsx` template, which tolerates
commas and leading zeros better. Where an SKU or GTIN has a leading zero, force the column
to Text or the spreadsheet will eat the zero and break scanning.

## 8. tax-header-format — Tax columns are identified by the percentage in the header

A tax column must keep the exact heading form including the rate in parentheses, e.g.
**`Tax - Sales (7%)`**. A renamed or re-formatted tax header does not fail loudly; it is
simply not recognized, and the item imports untaxed. Verify tax assignment after import as
part of the post-import checks, never assume it.

## 9. modify-vs-replace — Two import modes, one of them destructive

**Actions → Import Library** asks you to choose **Modify Item Library** (add new + update
existing) or **Replace Item Library** (delete all existing items, then load the file).
Replace is destructive to the whole library, not just to rows present in the file. In the
Dashboard the confirmation is explicit; the flow MenuFlow mirrors as a gate step, because an
operator on a phone cannot undo a Replace.

## 10. undo-catalogue — Undo is a Dashboard action with a limited window

After a confirmed import, the Items page offers **Actions → Undo [Import/Update]** (Undo
Catalogue) to roll the library back to the pre-import state. It rolls back the *catalogue*,
which is why it must be the first response to a bad import — but treat it as a one-shot
escape hatch: once another import happens the earlier state may no longer be recoverable,
so take the pre-import export anyway.

## 11. item-type-values — `Item Type` accepts a fixed vocabulary

Supported values include `Standard`, `Prepared food and beverage`, `Physical good`,
`Event`, `Digital`, `Other`, `Bundle`, `Service` and `Donation`. Blank imports as
**Standard**. Square for Restaurants rejects unsupported composite types through the
import path (a `Combo` item type, for example, is not importable for third-party menu
syncs) — those must be built in the Dashboard.

## 12. location-columns — Multi-location accounts change the shape of the file

Each location contributes columns (`Price [Loc]`, `Stock alert count [Loc]`,
`Enabled [Loc]`). Importing a single-location file into a multi-location account leaves
the other locations untouched rather than disabling them; importing the reverse can strip
location pricing. Re-export from the *destination* account and map onto that, never reuse
the source account's file.

## 13. not-exported — What Square never puts in or takes out of the file

Modifier **sets**, their options, prices and selection rules; **menus and menu sections**;
**display/feature order**; **advanced modifier settings** (min/max selections, sold-out
ordering); **auto-add to check**; kitchen/printer routing; item images; and channel
visibility toggles beyond the location `Enabled` columns. Square's own transfer answer to
owners moving an account is blunt: the CSV moves items, not the restaurant-specific
settings. A menu migration therefore finishes in the portal, and the workflow that models
it ends in a manual caveat step for exactly that reason.

## 14. audit-checklist — What to check after a Square import

1. Row count in = item count out, and **variation count** per item unchanged (guards
   §5 accidental merging).
2. Duplicate `Item Name` across categories (the merge hazard) — MenuFlow's `duplicate_items`
   and `cross_contamination` scans.
3. Every `Modifier set [...]` column that was `Y` resolves to a real set in the
   destination account, and each set has **at least one option** (an empty set is invisible
   in the file but fatal at order entry).
4. Tax headers recognized — spot-check two items' tax rates (§8).
5. `Token` present on rows that existed before the import (§3).
6. If Replace was used: `Actions → Undo Catalogue` is still available before any further
   import (§10).

## 15. menuflow-format — MenuFlow's `square-csv` is a review format, not an upload file

MenuFlow's `square-csv` export writes `Name, Category Name, Price, Description, Modifier
Set, Visible` and its importer also reads `Category Name`, `Option List N — Name/Values`
and `modifier_lists`. That shape is deliberately **smaller** than Square's real template so
a human can diff it during a shadow build, and it uses `;` to separate several modifier set
names in one cell rather than one Y/N column per set. Do not upload a MenuFlow CSV into the
Square Dashboard and expect a clean import: to feed Square, export the account's own
template, paste these values into the matching columns (modifier sets → one Y per set
column), and import *that*. MenuFlow uses the file for staging, audit and dry-runs; the
portal write stays a human-gated manual step for exactly this reason.

---
docId: lightspeed.manual
title: Lightspeed Restaurant (K-Series) — item import columns, groups as items, and menu screens
platform: lightspeed
publisher: Lightspeed — Restaurant K-Series support (Importing and exporting items in bulk; Importing and exporting menus; Modifiers and modifier groups)
url: https://k-series-support.lightspeedhq.com/hc/en-us/articles/1260804656109-Importing-and-exporting-items-in-bulk
verified: official-doc
checked: 2026-09-15
file: docs/manuals/lightspeed.md
scope: >
  K-Series Back Office item and menu imports. Lightspeed Restaurant **O-Series / Kounta**
  has a different template and different limits; do not apply this manual there (see
  "k-vs-o-series").
---

# Lightspeed Restaurant (K-Series) — items, groups, menus

K-Series treats a modifier group as **a kind of item**: `Type` distinguishes `Item`,
`Sub-item`, `Group` and `Combo`, so the same import file that creates your entrées also
creates the "Choice of side" group and its members. That is elegant for scripting and
lethal when the key column is wrong, because the key is `SKU` and the file updates by SKU.

## 1. required-columns — SKU and Accounting group are mandatory on every import

**`SKU`** must be present on all imports: unique for new items, and used as the **key that
identifies which existing item to modify** when updating. **`Accounting group`** must also be
present — accounting groups carry shared settings such as taxes and production centers.
**`Type`** is required to identify each row as `Item`, `Sub-item`, `Group` or `Combo`.
Because `SKU` is the update key, a new item that reuses an existing SKU is not an error — it
is an edit of somebody else's item. Re-export before you build an add-only file and check
for collisions.

## 2. min-max-for-groups — Group rows carry their own selection limits

For rows typed `Group`, the **`Min - Max`** column is mandatory, in the form **`2-5`** meaning
"choose at least 2, at most 5". This is K-Series' equivalent of Heartland's Min/Max Choices
and Clover's `minRequired`/`maxAllowed`, expressed as one hyphenated cell instead of two
columns. A `Group` row with a missing or malformed `Min - Max` is the most common
whole-import rejection.

## 3. extra-price — The price delta of a group member lives on the member

**`Extra price`** adds a price for an item **inside** a group: in the group `Fries`, sweet
potato fries sell above the French fries by the amount in that member's cell. Combined with
`Default price` on the item row (blank `Default price` means staff enter the price at the POS),
that is the whole pricing model for modifiers: base on the parent, delta on the member. Map
MenuFlow's `priceDelta` here, and never into the parent's `Default price`.

## 4. parent-sku — Hierarchy is expressed by pointing at the parent's SKU

**`Parent SKU`** identifies the main menu item an item belongs to (documented for combos);
group membership follows the same parent/child shape rather than a join table. Two practical
consequences for an import file: parent rows must be present (or already exist) for children
to resolve, and re-parenting is an edit of the child's `Parent SKU`, not of the parent.

## 5. menu-screen-path — Menu placement uses one slash-delimited cell

The optional **`Menu/Screen`** column places the button, formatted **`Menu/Screen/Sub-screen`**;
all menus created in the Back Office are valid targets. Menu placement is a **separate**
import from item creation: **Menu → Menu management → select menu → More actions → Import**,
with a file whose headers are **`SKU`** and **`Screens`**, and where a sub-screen is written
**`Main##Sub-screen`** (e.g. `Drinks##Coffee`). An item import that omits `Menu/Screen`
creates real, sellable items that appear on no screen — the "imported but invisible" state.

## 6. column-mapping — Import is a mapping step, not a fixed template

On the **Import items** page you map each column of your file to a Back Office field;
**`SKU`** and **`Type`** must be mapped for the import to process, unused optional columns
are set to **Skip for import**, and **Map identical column names** does it automatically —
Lightspeed explicitly recommends double-checking the automatic mappings. The import preview
then reports how many new inventory elements will be created. This is why a header rename is
not fatal in K-Series (you map it manually) but a mis-mapping is: the file is accepted and
the wrong field is written.

## 7. accounting-group-autocreate — New accounting groups need an explicit opt-in

An optional toggle creates any accounting groups in the file that do not exist yet;
**if it is left off, items whose accounting group does not exist will not import**.
Lightspeed also warns to double-check spelling, because a near-miss silently
**creates a duplicate accounting group** — which then duplicates tax and production-center
settings across your reporting. Check group-name equality, not similarity, after every import.

## 8. no-delete-and-no-undo — Imported items can be disabled, not deleted; updates cannot be reversed

Once imported, **items can be disabled or re-enabled from the Back Office, but they cannot be
deleted**, and the documentation states plainly that **item updates cannot be automatically
reversed after they are imported**. There is no Undo Catalogue equivalent. The pre-import
export is therefore not a courtesy — it is the entire rollback plan, and "disable" is the
supported way to retire an item.

## 9. export-reimport-trap — Some exported columns are not valid on re-import

The guidance is explicit: **some item columns will not be correctly formatted for
re-import after they are exported** from the Back Office, so you must re-format them against
the import requirements before uploading. The routine "export, edit, import" loop that works
on Square or Clover is only safe here once you know which columns those are for your account
— test it on a scratch copy of two or three rows before trusting a 400-row pass.

## 10. other-columns — Small formatting rules that fail imports

`Name` must be unique. `Production instruction` values must already exist in the Back Office
before the import can reference them. `Course` is a number, or blank to leave unset.
`Statistic group` uses **`category/tag`** and comma-separates several. `Barcode` accepts
EAN/UPC and comma-separates multiples. `Button color` must be **one word, no hyphens**.
`Sharing status` is `Local` (this location only), `Shared` (name shared; details such as
price may differ per location) or `Global` (name and details shared). `Weight` is a
denominator in grams (`100` or `1000`) and `Tare` is grams without a unit; `Package content`
is numeric against `Package unit` (`g`, `lb`, `mL`, `fl oz`, or `%`).

## 11. row-limits — Keep files small, and delete empty optional columns

Menu/item import files are capped (the item import documentation works to a **10,000-row**
limit for price and item files) and the guidance asks you to **delete an entire optional
column if it is unused** rather than leave it blank, to streamline the import. On very large
menus, splitting the file by category is safer than a single monolithic upload: it bounds
what a failed import can touch.

## 12. modifiers-and-groups — Group creation, editing, and the archive semantics

Modifier groups are built under **Menu → Item list → Create → Modifier group**; the option
list has **SKU auto-generated** but editable, each option takes an **Option name**, a **Price
adjustment** and an **Accounting group**, and its **Parent item group** is filled for you when
you add options to the group. Groups are attached to items from the item's own editor, and
removed with the three-dot **Archive** action — which Lightspeed warns removes the group from
**all menus at all locations**. In multi-location accounts that single click is a fleet-wide
change, so an archive is an approval-gated action here, never a tidy-up.

## 13. ai-menu-scan — The scan path has its own modifier decisions

**Menu → Item list → Import → Start import → Scan your menu** accepts `.PDF`, `.PNG`,
`.JPG`, `.HTML`, `.CSV` or `.TXT` and auto-creates items, with **Advanced settings** that
change your data model: **Modifier strategy** (*Shared* — one modifier group applied across
all types of an item, e.g. milk on every coffee — or *Separate*), and **Size format**
(*Separate items*, *Base price + modifiers*, or *Zero base + full price modifiers*). Choose
these before running a scan: the isolation doctrine says *Separate*, and *Base price +
modifiers* is the shape that keeps a size ladder priceable without duplicating items.
Items created this way get an auto-assigned accounting group and auto-generated SKUs, which
is exactly what you then have to reconcile against real SKUs.

## 14. k-vs-o-series — Do not read O-Series/Kounta advice as K-Series

Lightspeed's other restaurant product (**O-Series**, formerly **Kounta**) documents a
different import: required columns like `Cost Tax Code` and **`Is Modifier`** (1/0), Yes/No
toggles written as **1/0**, an explicit "do not edit `Product ID`", a **450-row** file-size
rule, and "product variants and option sets cannot be bulk imported". None of that is the
K-Series contract above. When a client's menu is on O-Series, the correct manual is the
O-Series one — and the no-bulk-variants rule means modifier structure must be built by hand,
which changes the engagement estimate.

## 15. audit-checklist — What to check after a K-Series import

1. No new item row reused an existing **SKU** (§1) — this is the destructive mistake.
2. Every `Group` row has a parseable `Min - Max` (§2) and its members have `Extra price`
   rather than the parent (§3).
3. `Accounting group` strings match existing groups **exactly**; no near-miss duplicates (§7).
4. Items appear on a screen — check `Menu/Screen` (§5) before declaring success.
5. Column mapping screen re-read against the preview counts (§6).
6. Anything you meant to retire is **disabled with intent**, not half-renamed (§8), and no
   fleet-wide **Archive** was used as a shortcut (§12).
7. Empty option lists on any new group (the same defect Toast documents as sync-breaking).

## 16. menuflow-format — MenuFlow's `lightspeed-csv` is a review format, not an upload file

MenuFlow writes `Type, Name, Category, Price, Description, Modifier Groups, Available` —
with `Type` rows for categories, `;` between modifier group names, and `yes/no` availability
— and reads `Min`/`Max`, `Tax` and `Available` back in. Real K-Series needs `SKU`,
`Accounting group`, `Type` (`Item`/`Group`/`Sub-item`/`Combo`), `Min - Max` as `2-5`, and
`Extra price` on members (§1–§3), plus a separate menu file for placement (§5). To feed
Lightspeed, map MenuFlow columns onto the official template (MenuFlow's `modifierGroups` →
a `Group` row plus member rows carrying `Extra price`), and re-check SKUs against a fresh
export because updates are irreversible (§8). MenuFlow's file is for staging, audit and
dry-run; the Back Office upload stays a human-gated manual step.

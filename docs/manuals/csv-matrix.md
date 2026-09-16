---
docId: signalF.csv-matrix
title: Cross-platform CSV/Excel matrix — how each POS encodes items, modifiers and availability in bulk files
platform: shared
publisher: Signal F Holdings — compiled from the per-platform manuals in this directory (each claim is cited there)
url: https://github.com/chrisfbaileycb-arch/menuflow-pos/tree/main/docs/manuals
verified: compiled
checked: 2026-09-15
file: docs/manuals/csv-matrix.md
scope: >
  The comparison layer: given any vendor menu file, this is how you decide what the modifier
  columns mean, what will silently fail, and what can never round-trip. Cited by workflows on
  every platform, so the mapping has to stay honest.
---

# Cross-platform bulk-file matrix

Every vendor's "menu CSV" is an encoding of the same four objects — **item**, **category or
group-of-items**, **modifier group**, **modifier option with a price delta** — and they differ
in *where the hierarchy lives*, which is where migrations break.

## 1. unit-of-row — What one row means decides everything

Square: one **item variation** (rows sharing an `Item Name` merge into one item). Clover:
one row per **object**, split across **workbook tabs** by type. Toast: one row per
**operation** (`Operation` + `Entity type` + `Operation ID`), so the file is a script.
Lightspeed K-Series: one row per **item or group**, distinguished by `Type`
(`Item`/`Sub-item`/`Group`/`Combo`). TouchBistro: one row per **new item only** — updates are
not expressible. Heartland and Aloha: **no owner-facing file at all**. Consequence: a
transform that is a simple column rename between Square and Lightspeed is a structural
rewrite between Square and Toast.

## 2. modifier-encoding — Four ways to say "this item takes these add-ons"

The modifier is where the platforms diverge most, because three of them put the modifier
*reference* in the file and keep its definition somewhere else entirely. Read the "where"
columns as the audit checklist: anything not in the file has to be verified in the portal.

| Platform | Mechanism in the file | Where min/max lives | Where the price delta lives |
|---|---|---|---|
| Square | `Modifier set [Name]` column per set, **Y/N** value | not in the file (Dashboard only) | not in the file |
| Clover | group rows on a **Modifier Groups tab**, item rows reference them | `minRequired` / `maxAllowed` on the group | `price` on the modifier (integer cents) |
| Toast | `MODIFIER_GROUP` and `MODIFIER` **operation rows**, parented by ID | on the group row | on the group (`BASE`) or per modifier (`PRICED_BY_MODIFIERS`) |
| Lightspeed | `Type=Group` row + member rows | `Min - Max` on the group, e.g. `2-5` | `Extra price` on the member |
| TouchBistro | modifier groups set in **RMM**, not by bulk upload | RMM item/group config | RMM item/group config |
| Heartland | no file; Admin Console **Assigned Items** | `Min Choices` / `Max Choices` | per-ingredient `Default Price` |
| Aloha | no file; **Maintenance → Menu → Modifier Groups**, groups are items | group **min/max** + **Free** | `Price method`: item / button / price level |

The audit rule that falls out of this table: **"is the modifier attached?"** is a different
question in each column — a Y/N cell, a tab join, a parent-ID reference, a `Type=Group`
membership, an RMM setting, an Assigned Items list, or an item-database assignment. A
migration tool that flattens these into one boolean loses exactly the information that
predicts whether the change will work.

## 3. yes-no-tokens — The same boolean has five spellings

`Y`/`N` (Square, e.g. `Archived`, `Modifier set [...]`, blank = off); `true`/`false` (Clover
availability, Toast `Available`); `yes`/`no` (Lightspeed `Available`); **`1`/`0`** (O-Series
toggles such as `Is Modifier` — and note that is O-Series, not K-Series); and for Aloha/
TouchBistro, checkbox state in the back office with no file equivalent. MenuFlow normalizes
all of these on import and writes the **platform-native token** on export so a diff against a
vendor file stays readable. Never trust a spreadsheet's auto-formatting here: `TRUE` becomes
`True`, `Y` becomes the date `2019-01-01`-adjacent garbage in some locales, and `007` loses
its leading zero — so key columns (`Token`, `SKU`, `GTIN`) must be text-formatted before saving.

## 4. price-formats — Cents, dollars, strings, and negatives

Square: numeric, **$0.00 or greater**, or blank/`Variable` — a fixed price cannot be negative.
Clover: integer **cents** at the data layer (`100` = $1.00), truncated rather than rounded if
you supply fractional cents. Toast: a **string** with its own grammar — `-1.00` or `(1.00)`
for a reduction, cents optional, thousands separators optional, `null` allowed, ≤25 chars,
**no currency symbol**. Lightspeed: `Default price` on the item (blank = price at the POS) plus
`Extra price` on the member. Heartland/Aloha: portal fields, and Heartland's canonical model
stores integer cents. The two traps that actually cost money: an accounting-formatted
`(1.00)` on Toast is a **discount**, not a typo; and a blank `Default price` on Lightspeed is
**manual pricing at the terminal**, not a zero.

## 5. identifier-columns — Keys are account-local, and blank-means-create is the only safe rule

Square: `Token` (blank for new, never edited for existing) and `Reference`/`Reference Handle`.
Clover: **`Clover ID` must be deleted** when importing into a different merchant. Lightspeed:
`SKU` is both identity and update key — reusing one silently **edits somebody else's item**;
O-Series uses `Product ID`, which must be left blank for new rows. Toast: entities are
addressed by **Toast GUID**, or by a file-local `Operation ID` for things created in the same
file. The invariant across all of them: an identifier column is only meaningful inside the
account that issued it, so **a cross-account file must have every identifier blanked**, and a
same-account update file must have none touched. MenuFlow records which mode it was in for
every import so a re-run is explicable.

## 6. file-shape-constraints — Sizes, formats, headers and the columns that must die

Clover wants **.xls/.xlsx ≤ 5 MB** and will not take a CSV for item import. Square's CSV path
rejects xlsx/xls/xlsm, demands the file name is unchanged, forbids deleting empty columns or
renaming headers, and advises **removing commas from text** until after import. Lightspeed caps
imports around **10,000 rows**, tells you to **delete unused optional columns**, and requires
manual column mapping with `SKU` and `Type` mapped; O-Series instead caps files at **450 rows**
per import. Toast's file is produced by downloading a Google Sheets template copy (the
validation dropdowns live in the copy). TouchBistro's bulk file is new-items-only. Practical
rule: the "clean up the spreadsheet" instincts that make a file prettier are the ones that get
it rejected — normalize in MenuFlow, keep the vendor file ugly and untouched.

## 7. reversibility — Which imports you can undo and which you cannot

**Square** offers **Actions → Undo Catalogue** after an import, a real (if one-shot) escape
hatch, plus an explicit Modify vs Replace choice at upload. **Toast** states that bulk-import
changes are **not reversible**. **Lightspeed** states item updates **cannot be automatically
reversed**, that imported items **cannot be deleted** (only disabled/re-enabled), and that new
accounting groups need an explicit opt-in or those rows simply will not import. **Clover** lets
you abandon at the *To be added to inventory* preview but has no post-import undo. **Heartland**
and **Aloha** are back-office edit-by-field, so "undo" means editing the fields back. The
engine's `irreversible: true` flag on a workflow is derived from this row of the table, and it
is what forces the backup-before-write gate.

## 8. never-round-trips — Fields no menu file will carry

Modifier **set definitions** (options, prices, min/max, popup behaviour) on Square; **menus,
sections, display order, advanced modifier settings and auto-adds** on Square; **association
between items and groups** if you only fill the group tab on Clover; **POS button color, prep
stations, courses, sales categories, tax rates, ordering-channel visibility and time-based
online rules** on Toast; **`Menu/Screen` placement** if you only ran the item import on
Lightspeed; **tax, images and deletes** on TouchBistro's bulk path; **terminal-side stock
limits and 86 state** on Heartland; and on Aloha the whole **routing/substitution/matrix**
layer, which is item-database configuration. Every one of these is a step in a MenuFlow
workflow, not a column — which is why the workflows that look "incomplete as a CSV" are the
correct design.

## 9. canonical-mapping — How MenuFlow's model absorbs the difference

Canonical items reference modifier **group records**; groups hold **options** with
`priceDelta`; a group carries `minChoices`, `maxChoices`, `included`, `shared`,
`availableOnline`; availability is per **channel name**; pricing is a first-match-wins rule
stack with scope filters; money is **integer cents**; times are **minutes from midnight**. Each
parser maps its platform's §2 mechanism onto that shape and each writer maps it back, so
cross-platform statements ("isolation applied", "empty groups present") mean the same thing on
all seven. Two deliberate choices: Square's Y/N columns become **names** (a set referenced but
not defined in the file is reported, not invented), and Lightspeed's `Min - Max` string is
parsed into the two numeric fields so the `2-5` form never leaks into the model.

## 10. menuflow-divergence — MenuFlow's platform CSVs are review formats, and are labelled as such

`square-csv`, `clover-csv`, `lightspeed-csv` and `toast-csv` in this repo are **deliberately
simplified**: a small, human-diffable, semicolon/pipe-separated shape for staging, audit and
dry-run. They are not vendor-uploadable files — most obviously for Toast (no operation rows,
no parent references) and Clover (which needs an .xlsx workbook, not CSV at all), and each
platform manual ends with a `menuflow-format` section stating its own mapping and warning. The
portal write therefore stays a human-gated `manual` step with citations, and the
`heartland-json` export is the one format here whose byte-shape is *contractually* verified —
by parity tests against the client's own python scripts (§2 of `heartland.manual`).

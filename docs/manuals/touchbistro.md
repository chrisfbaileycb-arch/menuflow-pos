---
docId: touchbistro.manual
title: TouchBistro — bulk menu upload, RMM item setup, and the modifier/86 model
platform: touchbistro
publisher: TouchBistro — Help Center ("Setting up Menu Items"; "Uploading Menu Items in Bulk using RMM" / "…using Menu Management 1.0")
url: https://cdn.touchbistro.com/help/articles/setting-menu-items/
verified: access-limited
checked: 2026-09-15
file: docs/manuals/touchbistro.md
scope: >
  TouchBistro menu construction: the CSV bulk-upload path, Restaurant Menu Manager (RMM)
  item fields, the modifier ("option") model, POS 86 semantics and the independent online
  ordering toggle. Status is `access-limited` (see "access-and-caveats"): the field-level
  article is public, the bulk-upload article now sits behind the help-portal login, so
  re-confirm its list against your client's RMM build before guiding a change.
---

# TouchBistro — menu items, bulk upload, and 86s

TouchBistro's menu lives on the **iPad app's own configuration**, edited either in the app or
in **Restaurant Menu Manager (RMM)**, and its bulk path is deliberately narrower than the
cloud POS vendors: it is an **add-new-items** tool, not a menu-sync tool.

## 1. access-and-caveats — Which parts of this manual are first-hand

`Setting up Menu Items` is published as a static CDN article and was read directly; its
field notes are reproduced below. The bulk-upload articles now redirect to a
**logged-in help portal** (`help.touchbistro.com`), so their titles, section lists and the
documented limitations come from the public index entry rather than a fetched page. Treat
§2–§4 as **directional**: confirm the exact limits in your client's RMM before quoting a
migration, and record the revision in the workflow run. Anything not verified is marked as
such here and in `server/sources.js`.

## 2. bulk-upload-new-only — You can batch-add, but you cannot batch-update

Menu Management's bulk path takes a **comma-separated-values file edited in Excel or Google
Sheets** to batch upload multiple **pre-defined** menu items. The documented limitations are
that you **cannot batch upload updates to existing menu items**, cannot set the menu
image/thumbnail, **cannot set the tax setting**, and there is **no batch delete**. That set of
limitations decides what a TouchBistro engagement looks like: bulk is for building a menu
once, and every subsequent change — price edits, retirement, tax fixes, re-coursing — is
per-item work in RMM or the app. Plan and price accordingly, and never present a TouchBistro
price change as "just a CSV".

## 3. rmm-upload-flow — Categories first, then modifiers and taxes

RMM's upload path is **Menu Options → Categories**, pick the category to upload into (e.g.
**Mains**), then supply the items, with **Modifier Groups** and **Taxes** completed on the
same screen where they are needed. The order is not cosmetic: category assignment drives the
item's inherited settings (§4), so an item uploaded before its category exists — or into the
wrong one — inherits the wrong defaults, and those defaults (course, printers, tax) are
exactly the fields the bulk path will not let you correct afterwards.

## 4. category-inheritance — Items inherit from their sales category, and can override

In the item editor, most of the additional-detail settings are **defaulted by the Menu
Category** and only need reviewing; the item screen lets you tap **Menu Category** to move the
item and **Sales Category** to assign its reporting bucket, and course **inherits from the
category with a per-item override**. Two audit consequences: (a) a category-level change is a
mass edit of every item that does not override, so it needs the same care as a bulk import;
(b) an item whose category and sales category disagree still rings and still taxes correctly
but reports in the wrong bucket — the audit's `coursing` and category checks look for exactly
this drift, and the review screen notes that additional settings continue **off-screen, so
scroll**.

## 5. item-review-lines — The lines to read on every item

TouchBistro's own guidance is to review the item's detail lines rather than assume defaults:
**sales category**, **visible/hidden**, **course**, **tax**, and **kitchen printers**. Hidden
is a legitimate state to find during service (a hidden item is not an 86 — see §7), tax
presets must be re-confirmed on the item rather than trusted from the category, and the
printer assignment is what determines whether the kitchen sees the ticket at all. A menu
audit that checks only names and prices will pass a menu that fires to no printer.

## 6. modifiers-as-options — Option lists with min/max, and per-item attachment

TouchBistro's modifiers are option lists attached to items, configured with a minimum and
maximum number of selections and per-option price adjustments; the item's own **Modifier
Groups** are set in RMM (with the option to leave a group non-popupping for kiosk/online
flows). For isolation purposes the model is the same as Clover's: the group is a shared object
referenced by items, so one "Pepperoni" group attached across Pizza, Salads and Appetizers is
cross-contamination with a price-delta surface, and the fix is one scoped group per category.
TouchBistro gives you no bulk path to do that (limitation §2), which is precisely why
the isolation workflow ends in manual RMM steps with a verified checklist rather than an
import.

## 7. pos-86-is-not-delete — The X beside an item on the POS hides it for the shift and keeps the record

86ing on the TouchBistro POS is the **X** next to the item; it removes the item from ordering
without touching the menu definition, and the record survives for reporting. That is the
behaviour the never-86-during-service doctrine is designed around: the mechanism is reversible
and cheap, so the failure mode is not losing data — it is **never un-86ing it**, and
un-86ing has to be a tracked, closed-out action rather than a memory. Record the item, the
reason, who did it, and the expected return.

## 8. online-toggle-independent — Online ordering visibility is its own switch

The **Online Ordering** (per-channel visibility) setting is **independent** of the item's
hidden state and of the POS 86. An item can be sellable in the dining room and hidden online,
or live online and 86'd at the register. Any "we sold through an item we were out of" or
"it never showed up online" investigation starts by reading both settings, and MenuFlow's
channel checks compare them rather than assuming one implies the other.

## 9. audit-checklist — What to check after a TouchBistro change

1. Tax set on the item, not assumed from the category (§4/§5) — the bulk path cannot fix it (§2).
2. Course correct (or deliberately overridden) and consistent with the category default (§4).
3. Visibility: hidden vs 86'd vs online-hidden, each read separately (§7/§8).
4. Kitchen printer assignments present on every new item (§5).
5. Modifier groups: no empty groups, min/max coherent, and no single group shared across
   unrelated categories (§6).
6. Sales category matches the reporting bucket the owner expects (§4).
7. Nothing in the change set required a bulk *update* — if it did, it is manual work (§2).

## 10. menuflow-format — MenuFlow's TouchBistro file is a review format, not an upload file

MenuFlow has no `touchbistro-csv` upload format: TouchBistro's bulk path accepts only new
items and ignores tax and image settings (§2), so a MenuFlow TouchBistro export exists for
diffing, audit input and shadow-build review, while the TouchBistro import path in this repo
consumes **canonical JSON** (`jsonImport: true`, `csvImport` is not offered for this
platform). Practically: run the audit and the isolation/remediation in MenuFlow, then apply
item-by-item in RMM (or through TouchBistro support where the menu is being built for the
first time), and verify with §5's review lines on the device.

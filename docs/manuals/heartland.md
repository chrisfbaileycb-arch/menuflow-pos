---
docId: heartland.manual
title: Heartland PocketSuite/Genius — Admin Console menu editing, the JSON contract, and what bulk really means
platform: heartland
publisher: Heartland / Fiserv Help Center (Items Screen, Modifiers Screen, Mini Manager Guide) + Signal F Holdings KB
url: https://heartlandpos.zendesk.com/hc/en-us/articles/20200889252507-Items-Screen
verified: official-doc
checked: 2026-09-15
file: docs/manuals/heartland.md
scope: >
  Heartland's menu-editing surfaces and the data contract MenuFlow uses in place of a CSV,
  consolidating the per-screen help-center docs already registered individually. Read the
  individual `heartland.items-screen` / `heartland.modifiers-screen` /
  `heartland.mini-manager-guide` registry entries for field-level citations; this document is
  the platform overview and the bulk-data reality.
---

# Heartland (PocketSuite / Genius) — the bulk-data reality

Heartland is the platform this whole console was built on, and the reason the audit-before-action
doctrine exists. Its menu is edited field-by-field in a hosted Admin Console; the POS is a
Genius terminal; and there is **no owner-facing menu CSV** — which is exactly why the JSON
contract in this repo is byte-compatible with the legacy python tooling instead of pretending
to be a spreadsheet.

## 1. no-csv-import — There is no Items CSV in the Admin Console

Heartland's documented menu surfaces are **Admin Console → Menu → Items** (and **Modifiers**,
**Categories**, **Tax**, **Online Ordering**) with per-field entry, plus on-terminal edits from
the Mini Manager. `csvImport` is therefore **false** for this platform in
`server/platforms/index.js`, and MenuFlow accepts `jsonImport` (canonical JSON and the flat
`heartland-json` shape) instead. Any plan that assumes "export the old system's CSV and push it
into Heartland" involves either Heartland's own professional menu-build service or hand entry —
say so in the estimate.

## 2. items-screen — New item, Misc. Item, Half & Half pricing

Log into the Admin Console, select the account, then **Main Menu → Menu → Items**, and click
**New**. Field behaviour worth knowing: the **Misc. Item** checkbox lets the POS edit an item's
**name and price after it is added to a ticket** (their example is a whole ham, sold by weight —
the ticket is priced at sale time), and the **Half & Half Pricing** list controls how the POS
prices *halved* ingredients of a modifier that allows half-and-half. `halfAndHalf` and `misc`
exist as first-class fields in MenuFlow's canonical model precisely because these two flags
change pricing without changing any price field — an audit that diffs prices alone will miss
them entirely.

## 3. modifiers-screen — Eight fields decide the whole modifier experience

**Admin Console → Menu → Modifiers** carries: **Name**, **Show Modifier Name**, **Min Choices**,
**Max Choices**, **Number of Included Ingredients**, **ingredient Default Price**, the
**Assigned Items** list, and **Available Online**. Read them as a system, because the classic
failure is coherent-but-wrong: one shared "Pepperoni" group with `Min 0 / Max 0` (unbounded)
assigned across pizza, salad, pasta and appetizers. The per-item `Default Price` is why
isolation matters for money, not just UX: once you split a shared group into per-category
copies, each copy's default ingredient price is **free** until someone sets it — the
isolation workflow therefore ends with a pricing verification step rather than a success
message. The **Available Online** flag is independent of POS availability, so an item can be
orderable at the terminal and invisible on the ordering channel.

## 4. admin-vs-pos — Two different authorities; the portal is not always the source of truth

Hosted edits live in the Admin Console; terminal-side state lives on the Genius. Item
**stock limits** are set on the terminal (long-press the item, or **Manager → Item Stock
Management**), and **86-by-stock-limit** is a per-service state that never appears in a portal
menu export. Cross-check both sides during an audit: a menu that looks correct in the Admin
Console and has 14 items sitting at a stock limit of 0 on the terminal is a menu that is
wrong, and no portal-side export can tell you.

## 5. discounts-vs-adjustments — Discount is per item, adjustment is per ticket

At checkout, a **discount** applies to **items** while an **adjustment** applies to the
**ticket**, and a void prompts for a reason. This distinction drives the pricing-stack audit:
a discount attached to an item interacts with modifier default prices, whereas an adjustment
does not, so "the guest paid less than the menu says" investigations have to start by
identifying which mechanism was used. The void-reason prompt is also the reason
MenuFlow's audit trail records the *reason* string as part of an exception rather than
treating a void as a bare state change.

## 6. json-shape — The flat export the legacy tooling consumes

`heartland-json` is the exact shape the original `heartland-pos` python scripts read:
a JSON array of `{name, category, price, modifiers:[{name, group, price}], time_ranges}`,
with `price` in integer cents and `time_ranges` as `[start, end]` minute offsets from
midnight. MenuFlow emits this on export and parses it on import (a bare top-level array is
detected as this format), and a parity test runs the **vendored python scripts against the
export** to prove the contract has not drifted. That test is the reason the doctrine
("modifier isolation", "Midnight Rule", "never 86 during service") is enforceable here rather
than aspirational: the same numbers the client's own scripts produced must be what MenuFlow
reports.

## 7. legacy-time-ranges — Availability windows are the Midnight Rule's raw material

In the flat shape an item carries `time_ranges`; ranges that **cross midnight** must be
split at the day boundary or the item is available at the wrong hours (their own rule:
`22:00–02:00` becomes `22:00–23:59` plus `00:00–02:00`, with the day increment handled at
the boundary). MenuFlow keeps unsplit legacy ranges on the item as `time_ranges` after import
so the original defect remains *visible and auditable* rather than being quietly repaired by
the normalizer, and `menu.schedule.auto_split_all` is an explicit, gated action — the
midnight audit and the split are separate steps on purpose.

## 8. audit-checklist — What to check on a Heartland menu

1. Every shared modifier group's **Assigned Items** span: one group across unrelated
   categories is the primary finding (`cross_contamination`).
2. `Min/Max Choices` sane per group, with `0/0` only where unbounded is intended.
3. **Number of Included Ingredients** vs the actual default ingredients, and per-ingredient
   **Default Price** populated after any isolation (§3).
4. **Half & Half Pricing** lists present where half-and-half is allowed (§2).
5. **Available Online** vs terminal availability reconciled per item (§3/§4).
6. Item **stock limits** and 86 state read from the terminal, not inferred (§4).
7. `time_ranges` crossing midnight (the Midnight Rule), and no manual 86 left open past
   service (§7).
8. Pricing-stack conflicts: dead force rules, overlapping windows, post-tax suspects.

## 9. menuflow-format — What this repo exports for Heartland

Two formats, on purpose. **`canonical-json`** is lossless against MenuFlow's own model
(categories, items, modifier groups with options/min/max/included/shared flags, pricing rules,
schedules, channels) and is the format a re-import must use for a shadow build.
**`heartland-json`** is the read-only-compatibility format for the legacy scripts (§6) and
carries no pricing-rule stack, no channels and no group limits — never treat it as a backup.
Both are exports of the *workbench* state; neither is an upload to the Heartland Admin
Console, where the portal-side steps stay human-gated manual cards with citations.

---
docId: aloha.manual
title: "NCR Aloha — item database, modifier groups, exception modifiers, and menu distribution"
platform: aloha
publisher: NCR (Voyix) — Aloha POS implementation docs, Field definitions: Items / Modifier Groups / Submenus; Included Modifiers
url: https://docs.ncrvoyix.com/restaurant/aloha-pos/implementing/field_definitions/items
verified: official-doc
checked: 2026-09-15
file: docs/manuals/aloha.md
scope: >
  Aloha back-office menu construction (Maintenance > Menu) and the modifier mechanics that
  replace a CSV import: item database, modifier groups, dynamic/included modifiers,
  exception modifier groups, and store distribution. Aloha Cloud's company/store split is
  noted where it changes the answer.
---

# NCR Aloha — the item database *is* the menu language

Aloha has no owner-facing menu CSV. Every change is a record in the **item database**, edited
under **Maintenance → Menu**, and pushed to stores. The important architectural fact for a
consultant: in Aloha a **modifier is an item** — so the questions are never "does the file
have a modifier column" but "which item, attached to which group, distributed to which store".

## 1. item-maintenance-path — Maintenance → Menu → Items, and the four dependencies

**Maintenance → Menu → Items** is where every item lives: menu items, the items used to
modify them (cheese, lettuce, pickles), and retail items. Each item **requires data from
Taxes, Surcharges, Modifiers and Categories** to be complete, and only after items exist do
you assemble submenus, modifier groups and exception modifier groups. There is a hard limit
of 999,999 items in principle, capped for real by the **Maximum number of items** option
under **Maintenance → Business → Installed Products → Global tab**, with the vendor's own
warning that raising the menu to 30,000 items **uses more memory and should be used only
when necessary**. "Add another item" is therefore a performance decision, not just a data
decision.

## 2. mandatory-assignments — Tax, category and printer group are not optional

NCR states it as a rule: **it is mandatory to apply a tax, a category, and a printer group to
an item**, and where applicable a modifier group must be assigned (more than one is allowed).
An item missing routing is not a cosmetic defect — it simply never prints — and an item with
no category will not appear in the menu structures assembled from categories. Any menu build
checklist for Aloha starts with these three fields per item.

## 3. item-number-ranges — Numbering is meaningful, and some ranges are reserved

Assign numbers in blocks with a uniform method (their example: appetizers 3000–3999, entrées
4000–4999). Valid range is **1 to 999998**, with **999999 reserved for the PLU button**,
**30100–30199 reserved for 'Open' items** (Table Service only, unavailable for gift
certificates), and **30200–30299 reserved for the Aloha gift certificate item type**. Also:
an item's **ownership level** determines how records are filtered, **how data is distributed
to a store**, and who can view or edit it — so a store-scoped item and a company-scoped item
with the same number are different operational objects.

## 4. name-lengths — Three names, three character budgets

**Short name** appears on the order button, up to **15 characters**, but may crop past 11 —
type **`\n`** where you want it to break onto a second line. **Chit name** is up to **15**
characters and is typically ALL CAPS, with the explicit instruction to consult the chef.
**Long name** is up to **25** characters and is what the guest sees on the check. A menu
audit that checks only "long name" uniqueness misses the two fields that actually determine
whether a server can find the button and whether the kitchen can read the ticket.

## 5. modifier-tab-ten-groups — Up to ten modifier groups per item, Standard type only

On the item's **Modifier tab** you attach **up to ten** groups via the **Modifier 1 through
Modifier 10** drop-downs in the **Modified by** group bar — and the tab only appears when the
item type is **Standard**. Each referenced group must already be defined under
**Maintenance → Menu → Modifier Groups** or the assignment cannot be made. Ten is a real
ceiling on a build-heavy concept (an item that would want "sides, toppings, temperature,
size, sauce, allergy, prep, and three more" runs out of slots), so the design question on
Aloha menus is which of those become groups and which become **included** modifiers on the
item (§8).

## 6. modifier-groups-central — Groups are items, collected and reused

**Maintenance → Menu → Modifier Groups**: "modifiers are groups of items used to extend, alter,
or further define menu items", and NCR describes the relationship as **circular** — items are
defined in the Items file, collected into a modifier group, then assigned back to an item.
Their example is literal: lettuce, onions and pickles are items, collected into a group called
**Extras**, assigned to **Hamburger**. A price can be applied to the modifier item when
needed. Two corollaries matter for our isolation doctrine: sharing one group across many
parents is **the intended design**, so "shared group" is not by itself a finding; and
because the group's members are items, **editing that item's price or availability propagates
to every parent that uses it** — which is exactly the blast radius the 86-cascade check
measures. Also documented: a modifier group can modify another modifier group (salad toppings
modifying a salad), and **you must associate groups to items in the Items file or the group
never appears at the terminal**.

## 7. group-limits-and-prompting — 54 buttons, min/max, Free, and appear-on-selection

A group holds **up to 54 modifiers** on its Layout tab, each button showing the item's
**short name** (or its BMP bitmap if assigned), the **item number in the lower-left** and the
assigned **price in the lower-right**. The group settings control whether it appears
automatically when the parent item is selected or only via the **Modify** button, plus the
**minimum** and **maximum** number of modifiers selectable and **Free** — the number of items
from the group a guest may order at no charge (with `Free: 1` meaning POS does not charge for
the lower-priced item). Their guidance for a forced side choice is **Minimum 1 / Maximum 1**;
for "add or omit on request" groups, rarely force anything. There is also a documented
caution that modifiers force extra screen navigation and can slow the line — a group that
pops up for a zero-price yes/no is a throughput cost, which is the same argument the kiosk
popup guidance makes on Clover.

## 8. substitution-and-included — Implied/included modifiers and the three substitution charges

On the item's **Dynamic Modifiers** tab you designate modifiers as **Included** (the
hamburger's lettuce), with a **Substitution charge** of **None** (default: cannot be swapped,
and counts against the group's min/max/free only when added to the check), **No Charge** (can
be swapped for a non-included modifier in the same group at no charge; **neither** modifier
counts against min/max/free), or **Change Difference** (swap and charge the difference;
**if the included modifier is dearer, the substitution prices at $0.00 rather than a
negative amount**). You can veto a specific modifier from being used as a substitute via
**Not eligible for substitution** on the Modifier Groups Layout tab (QS). Implied modifiers
are assigned per item under the **SKU Numbers** tab's **Implied Modifiers** group bar by
moving items from *Available* to *Included* with **>>**. Read the min/max interaction before
touching included modifiers: the substitution settings change *what counts toward the limits*,
so an "obvious" free-swap convenience can silently disable a forced-choice rule.

## 9. exception-modifier-groups — Submenu-wide "special" modifiers, no per-item assignment

A submenu (TS) has an **Exception modifier group**: "the group of items you can use to modify
any menu item on the submenu without having to define the items as modifiers for each item",
for things like hot sauce, cheese sauce or onions that apply to no specific item but are
requested often enough to warrant inclusion; the server reaches them via **Modify → Special**,
and they are created under **Maintenance → Menu → Exception Modifiers**. For cross-contamination
audits this is a **deliberate, documented, menu-wide sharing mechanism** — the opposite of the
Heartland anti-pattern — so a shared group at submenu scope on Aloha is *correct design*, and
should be recorded as an allowlisted shared construct rather than remediated into 40 copies.

## 10. print-independently-and-routing — When a modifier prints as its own line

Under the item's Modifier tab, **If used as modifier → Print independently** prints the
modifier on the chit in the same format as a regular item; by default a modifier prints to the
same printer as the item it modifies, and selecting this routes it to the printer group
assigned to that modifier item in **Maintenance → Menu → Item Routing**. Aloha Cloud's
equivalent is **Independent Modifier**, which detaches the modifier from the parent so it can
take a different **Routing Group** and prints at that station. This is the knob for
"the bar needs to see the modifier, not the grill", and it is per-modifier-item, so one
shared group can route two ways at once.

## 11. price-methods-and-building-blocks — Button price vs item price, and Build items

A modifier item's **Price method** is **Item price** (default), **Button price** or **Price
level** — the difference between pricing the underlying item, the button in a specific group,
or a price-level table. Group types are **Standard** (a grouping of standard items to choose
from) and **Build** (a grouping of items designated as *build* items), and the item type
**Build (QS only)** is "a grouping of **included, zero-priced modifiers** that you can use as
a base to prepare one or more menu items" (their example: oil, vinegar, lettuce, red onions and
flat bread as one salad base). Choosing Build-style composition is what lets a fast-casual
Aloha site keep 2,000 topping items off the parent item's ten modifier slots (§5). Aloha Cloud
adds the store/company split: modifier groups and items are defined **at company level**,
while at **store level you can only edit pricing and availability** for individual modifier
items — so a store manager's "fix" is scoped by design, and a request to change a definition
is a company-level ticket.

## 12. pizza-matrix — Modifier codes with depletion percentages

Where a pizzeria workflow is used, the item's **Pizza Topping Matrix** and **Included Topping
Matrix** tabs hold per-topping **depletion percentages** — `50%` half the regular depletion,
`100%` no change, `200%` double — and a modifier code only appears as a matrix column if
**Maintenance → Menu → Modifier Codes → Used in pizza matrix** is selected; the Included
Topping Matrix tab itself appears only when the item's **Advanced Pizza → Pizza** flag is set.
Inventory accuracy for a shared topping is therefore a *modifier-code* setting, not an item
price setting, and an audit that ignores modifier codes will report correct counts against the
wrong expectation.

## 13. no-csv-import-86-and-roll — No owner CSV; 86s are shift-scoped and cleared at EOD

There is no supported owner-facing menu CSV import: the menu is built as records in the
item database and **distributed** to stores under the ownership model (§3), and an Aloha
"transfer" between accounts is a back-office data task, not an upload. Separately, the
**86 screen removes items from ordering for the current shift while the menu definition stays
integrated**, and the end-of-day reports roll the day — with the explicit operator note to
confirm 86s are cleared before the next open. That pairing is the whole reason the console
models Aloha 86s as shift-scoped, tracked, and required-closed: nothing in Aloha deletes the
item, so the failure mode is a stale 86 persisting into tomorrow's open because nobody
re-enabled it.

## 14. audit-checklist — What to check on an Aloha menu

1. Every item has **tax + category + printer group** (§2) — the three mandatory assignments.
2. Short/chit/long names within **15 / 15 / 25** characters and chit names readable by the
   chef (§4).
3. No collision with the reserved number ranges, and blocks used consistently (§3).
4. No item depending on a modifier group that is not assigned to it (§6), and no group
   assigned that has zero usable buttons (§7).
5. Groups at or under **54** modifiers and items at or under **10** groups (§5/§7).
6. Included-modifier substitution settings reviewed against min/max/free intent (§8).
7. Menu-wide sharing confined to **exception modifier groups** where it is intentional (§9);
   anything else shared across unrelated categories is a scoped-group candidate.
8. Shift 86s cleared, and none carried into the next open (§13).

## 15. menuflow-format — What "import/export" means on Aloha here

MenuFlow offers no `aloha-csv` format, because the platform has no owner-facing CSV to feed
(§13). `jsonImport: true` means a MenuFlow **canonical JSON** export of an Aloha location can
be re-imported into the console for audit, shadow builds and remediation planning, and the
`aloha.*` workflows end in manual steps that name the exact Maintenance paths above. Where a
client insists on a bulk change, it is an NCR data-service task against the item database —
raise it as such and treat the export as the specification, not the mechanism.

# SOURCES — owner's-manual traceability register

Machine-readable truth lives in two places: the per-platform manuals in `docs/manuals/*.md`
(human-facing, with the vendor's own words) and `server/sources.js` (the registry every workflow
citation resolves against). `server/sources.manuals.generated.js` is derived from the manuals by
`fixtures/build-manual-sources.js` and is never edited by hand.

Every `manual` workflow step cites `{doc, section}`. The verifier fails any workflow whose citation
doesn't resolve, fails citation of a platform's manual from another platform's workflow (with the
exception of `heartland.kb.*` Signal F knowledge-base docs and `signalF.shared-rules`, which apply
fleet-wide), and — since 1.2 — fails any **import/export workflow that does not cite its own
platform manual**, because a file format nobody can trace back to the vendor's documentation is not
a verified format.

37 documents are indexed: 24 `official-doc`, 7 `client-kb`, 4 `legacy-manual`, 1 `compiled`
(the CSV matrix), 1 `access-limited` (TouchBistro's RMM bulk-upload article). 8 of them are the
repo-side manuals below, carrying 102 citable sections between them.

## Verification statuses

| Status | Meaning | Action for operators |
|---|---|---|
| `official-doc` | Cross-checked 2026-09-15 against the vendor's published owner manual / help-center section (URL recorded in the document's front matter or in `sources.js`). Navigation paths quoted in step instructions come from these pages. | Re-verify if the vendor UI has changed since this date. |
| `client-kb` | Signal F Holdings' own audited knowledge base (`heartland-pos` repo: modifier architecture, midnight rule, pricing rules, coursing, shadow build, audit scripts). Heartland-specific and battle-tested through client engagements. | Canonical for Heartland; portable rules flagged where used elsewhere. |
| `legacy-manual` | From widely distributed legacy owner-manual families (NCR Aloha ADM/EASE, TouchBistro Owner Guide, Toast Card & Terminal reference). Section semantics are stable but revision wording varies. | Confirm against the exact revision the client's terminals/portal run before guiding portal work. |
| `compiled` | Written by Signal F by cross-reading several vendor documents (no single vendor page says it). `signalF.csv-matrix` is the honest answer to "what does *our* file do differently, platform by platform". | Treat as engineering doctrine, not as a vendor quotation. |
| `access-limited` | The vendor's document exists but sits behind a login, so the manual records what is publicly verifiable plus what was confirmed from the product's own UI copy. TouchBistro's RMM Menu Management bulk-upload article is the case. | Re-check with a client login during the engagement before promising a bulk path. |

## Repo-side manuals (`docs/manuals/`)

Each file is front matter + numbered `## N. key — Title` sections; the key becomes the citable
section id, and the first paragraph becomes the excerpt shown in the UI, the run record and the
exported bundle.

| File | docId | Sections | Status | What it exists to pin down |
|---|---|---|---|---|
| `square.md` | `square.manual` | 15 | official-doc | The import template's required columns, `Token` semantics, one Y/N column **per existing modifier set**, `Actions → Import Library` Modify vs Replace, `Undo Catalogue`. |
| `clover.md` | `clover.manual` | 13 | official-doc | Item import is an **.xls/.xlsx workbook (≤5 MB), not a CSV**; group `minRequired`/`maxAllowed`/`showByDefault`; prices in **integer cents**; export is a full item list whose `Clover ID` column must go before another merchant imports it. |
| `toast.md` | `toast.manual` | 14 | official-doc | The bulk tool takes **one row per operation**, not per item; `BASE` vs `PRICED_BY_MODIFIERS`; empty modifier groups break third-party syncs; bulk changes are **not reversible**; Save ≠ Publish. |
| `lightspeed.md` | `lightspeed.manual` | 16 | official-doc | `SKU` is the update key and `Accounting group` is required; `Type` Item/Sub-item/Group/Combo; group cardinality as one `Min - Max` cell; **items can be disabled but never deleted** and updates cannot be auto-reversed; some exported columns are not valid for re-import. |
| `touchbistro.md` | `touchbistro.manual` | 10 | access-limited | Bulk upload creates **new items only** — no batch update, no tax, no images, no batch delete; POS 86 is the X beside an item (shift-scoped); Online Ordering visibility is independent of hidden/86. |
| `aloha.md` | `aloha.manual` | 15 | official-doc | There is **no owner-facing menu CSV**: modifiers are Items, a group collects up to 54 buttons, an item attaches up to 10 groups on its Modifier tab; exception modifier groups are the legitimate way to share; per-shift 86 rolls at EOD. |
| `heartland.md` | `heartland.manual` | 9 | official-doc | Admin Console field semantics behind the JSON we export, the legacy flat-array shape our python tooling consumed, `[[1320,120]]` midnight ranges, and why stock limits are not an 86. |
| `csv-matrix.md` | `signalF.csv-matrix` | 10 | compiled | Side-by-side: what a "row" means per platform, how each encodes modifiers, yes/no vocabularies (`Y/N`, `true/false`, `1/0`, `Yes/No`), price grammars, key columns, file-shape limits, reversibility, what never round-trips, the canonical mapping, and the MenuFlow divergence statement. |

**Every one of these files ends with a `menuflow-format` section that says the same thing in
print:** the CSV MenuFlow writes is a *review and diff* format for the shadow build — it is not a
vendor-uploadable file, and each `menuflow-format` section lists the exact differences from that
platform's real template. Importers are held to the same standard: where a vendor path cannot
represent something (TouchBistro's Tax and Kitchen Printer columns), the importer **reports a
warning and refuses the write** rather than silently inventing a field.

## Platform coverage map

- **Heartland** — Items screen, Modifiers screen, Mini Manager Guide (stock limits/voids/discounts) + the five KB documents.
- **Toast** — Create & manage modifier groups (incl. Required/Optional + POS prompt, empty-group sync breaker, publish semantics), modifier display/order configuration, bulk management advanced properties, Day Reporting, POS 86/void reference.
- **Square for Restaurants** — Library import/export (Modify vs Replace, Y-flags, review-confirm, Undo Catalogue), item fields incl. sold-out-with-auto-return and per-channel availability, the documented menu-transfer caveat.
- **Clover** — bulk item workbook, item/option-group editing incl. Pop Up Automatically, third-party sync windows (10 min vs 4 h + force sync), inventory-count 86 semantics, kiosk duplicate-group defect.
- **Lightspeed K-Series** — import column mapping, item and modifier group creation, archive (all-menus/all-locations warning), price lists for dayparts, the export→re-import trap.
- **TouchBistro** — menu item fields incl. the review screen lines (category/visible/course, tax, printers), bulk upload's create-only limits, POS-hide (86) X-toggle, independent Online Ordering toggle, course inheritance & override, tax preset caution.
- **NCR Aloha** — ADM blocks→sections→items hierarchy, central modifier definitions, modifier groups and their limits, exception modifier groups, tax assignment, POS 86 screen (shift-scoped) and EOD roll. `docs/manuals/aloha.md` is compiled from NCR Voyix's published Aloha POS / Aloha Cloud implementation docs; the older `legacy-manual` entries remain for ADM/EASE-era revision families.

## Where citations are enforced

- Static: `server/engine/engine.js → validateWorkflow` (schema, skill/check existence, gate doctrine, citation resolution, per-platform legality) — `npm run verify` and the per-workflow validate endpoint.
- Bulk files: `validateAll` additionally requires every `import`/`export` workflow to cite its own `<platform>.manual`, and `tests/manuals.test.js` requires the last manual step of each to also cite `signalF.csv-matrix#menuflow-divergence`.
- Execution: workflow dry-runs inside the verify CLI/test suite prove steps execute against state; manual steps carry their citations into run records so evidence travels with the audit trail (`GET /api/runs/:id`).
- Export: the workflow bundle export embeds the sources registry so a handed-off bundle can be independently re-verified offline.
- Freshness: `npm run check:artifacts` re-derives both the citation registry (from `docs/manuals/*.md`) and `server/workflows/*.json` (from `fixtures/build-workflows.js`) in `--check` mode; any drift between an artifact and its generator fails CI.

## Updating

1. Edit the manual: `docs/manuals/<platform>.md`. Front matter takes `docId`, `title`, `platform`,
   `publisher`, `url`, `verified`, `checked`, `file`, `scope`; sections are `## N. key — Title`.
2. `node fixtures/build-manual-sources.js` — regenerates the citation registry (8 docs / 102
   sections today). Never hand-edit `server/sources.manuals.generated.js`; `sources.js` throws on a
   `docId` collision, and `--check` catches drift.
3. Point workflow steps at the new keys via `MANUAL_LINKS` in `fixtures/build-workflows.js` (or
   `c('<platform>.manual', '<key>')` inside a definition), then `node fixtures/build-workflows.js`.
   Never hand-edit `server/workflows/<platform>/*.json`.
4. If the manual describes a file path our importer/exporter does not actually honour, fix the
   importer in `server/importexport/index.js` — the prose is not softened to match the code, and a
   divergence that is intentional gets written into the platform's `menuflow-format` section.
5. `npm run verify && npm test` (both must report PASS/ALL SUITES PASSED); `npm run check:artifacts`
   is run by CI as well.

# SOURCES — owner's-manual traceability register

Machine-readable truth lives in `server/sources.js`; this file explains status and coverage.

Every `manual` workflow step cites `{doc, section}`. The verifier fails any workflow whose citation doesn't resolve here, and fails citation of a platform's manual from another platform's workflow (with the exception of `heartland.kb.*` Signal F knowledge-base docs and `signalF.shared-rules`, which apply fleet-wide).

## Verification statuses

| Status | Meaning | Action for operators |
|---|---|---|
| `official-doc` | Cross-checked 2026-09-15 against the vendor's published owner manual / help-center section (URL recorded in sources.js). Navigation paths quoted in step instructions come from these pages. | Re-verify if the vendor UI has changed since this date. |
| `client-kb` | Signal F Holdings' own audited knowledge base (`heartland-pos` repo: modifier architecture, midnight rule, pricing rules, coursing, shadow build, audit scripts). Heartland-specific and battle-tested through client engagements. | Canonical for Heartland; portable rules flagged where used elsewhere. |
| `legacy-manual` | From widely distributed legacy owner-manual families (NCR Aloha ADM/EASE, TouchBistro Owner Guide, Toast Card & Terminal reference). Section semantics are stable but revision wording varies. | Confirm against the exact revision the client's terminals/portal run before guiding portal work. |

## Platform coverage map

- **Heartland** — Items screen, Modifiers screen, Mini Manager Guide (stock limits/voids/discounts) + the five KB documents.
- **Toast** — Create & manage modifier groups (incl. Required/Optional + POS prompt, empty-group sync breaker, publish semantics), modifier display/order configuration, bulk management advanced properties, Day Reporting, POS 86/void reference.
- **Square for Restaurants** — Library import/export (Modify vs Replace, Y-flags, review-confirm, Undo Catalogue), item fields incl. sold-out-with-auto-return and per-channel availability, the documented menu-transfer caveat.
- **Clover** — item/option-group editing incl. Pop Up Automatically, third-party sync windows (10 min vs 4 h + force sync), inventory-count 86 semantics.
- **Lightspeed K-Series** — Back Office item list, modifier group creation/attachment/removal, archive (all-menus/all-locations warning), price lists for dayparts, import utilities.
- **TouchBistro** — menu item fields incl. the review screen lines (category/visible/course, tax, printers), POS-hide (86) X-toggle, independent Online Ordering toggle, course inheritance & override, tax preset caution.
- **NCR Aloha** — ADM blocks→sections→items hierarchy, central modifier definitions, tax assignment, POS 86 screen (shift-scoped) and EOD roll. Marked `legacy-manual` throughout — the platform predates hosted help centers; re-confirm revision-specific names.

## Where citations are enforced

- Static: `server/engine/engine.js → validateWorkflow` (npm run verify, per-workflow validate endpoint).
- Execution: workflow dry-runs inside the verify CLI/test suite prove steps execute against state; manual steps carry their citations into run records so evidence travels with the audit trail (`GET /api/runs/:id`).
- Export: the workflow bundle export embeds the sources registry so a handed-off bundle can be independently re-verified offline.

## Updating

1. Add/modify a doc entry in `server/sources.js` (title, publisher, URL, `verified`, and per-section one-line actionable summaries).
2. Point workflow steps at it.
3. `npm run verify && npm test`.

# Changelog

All notable changes to MenuFlow POS. Dates are UTC.

## [1.2.0] — 2026-09-16

Owner's manuals, platform by platform — because no two POS systems read the same CSV,
and each one encodes modifiers differently.

### Added
- `docs/manuals/` — a manual per represented platform (**square, clover, toast,
  lightspeed, touchbistro, aloha, heartland**) plus `csv-matrix.md`, 102 citable sections
  in total. Each platform file documents the vendor's real bulk-file contract, its
  **modifier model**, its post-change audit checklist, and a closing `menuflow-format`
  section that states exactly how MenuFlow's file differs from the uploadable one.
- Those manuals are now the citation source, not prose sitting next to the code:
  `fixtures/build-manual-sources.js` derives `server/sources.manuals.generated.js` from
  the markdown (front matter + `## N. key — Title` headings), `server/sources.js` merges
  it and throws on a `docId` collision, and `getCitation` returns the manual path so the
  UI, run records and exported bundles can point at the file section the step came from.
- **10 new bulk-file workflows** so every platform's import/export path is verified rather
  than implied: `toast.bulk-menu-import` (high risk), `toast.items-database-export`,
  `clover.bulk-item-import`, `clover.bulk-item-export`, `touchbistro.bulk-menu-upload`,
  `touchbistro.menu-export`, `lightspeed.menu-export`, `aloha.menu-export`,
  `aloha.item-modifier-record-build`, `hl.menu-json-import` — 59 workflows in total.
- `touchbistro-csv` as a real format in `server/importexport/` — header detection, a parser
  that maps Item/Category/Price/Course/Hidden/Modifier Groups, and **warnings instead of
  writes** for the Tax and Kitchen Printer columns the vendor bulk path cannot set — plus a
  matching export writer.
- Enforcement, in three layers: `validateAll` fails any `import`/`export` workflow that does
  not cite its own `<platform>.manual`; `tests/manuals.test.js` (11 tests) checks heading ↔
  registry agreement in both directions, that every one of the 253 citations resolves to real
  text, that a platform manual is only cited by its own platform, that per-platform modifier
  encodings are genuinely distinct, and that the safety doctrine (Toast irreversibility,
  Lightspeed no-delete/no-undo, TouchBistro create-only) is still written down; and
  `npm run check:artifacts` fails on any drift between a manual, the registry and the
  generated workflow JSONs (`--check` on both builders, timestamp-insensitive).
- `fixtures/` vendor samples used as workflow example inputs: `touchbistro-menu.csv`,
  `toast-menu.csv`, `clover-items.csv`, `heartland-flat.json`.
- The dropdown now identifies each system by its file contract too: `bulkFile`,
  `modifierEncoding` and `manual` per platform, served by `/api/platforms`, shown as a
  fingerprint line under the selector and in full on the Sources tab.
- `npm run check:artifacts` (also a CI step) re-runs both generators in `--check` mode, so a
  manual edited without regenerating, or a hand-edited `server/workflows/*.json`, fails the build.
- `.github/workflows/verify.yml` gained an artifact-freshness guard step.

### Changed
- `server/importexport/index.js` no longer describes itself as producing upload-ready vendor
  files. It emits **MenuFlow review shapes**: importable into the shadow build, diffable
  against a vendor export, not a drop-in for the vendor's own importer — per platform, in
  `docs/manuals/<platform>.md # menuflow-format`.
- `detectFormat` ordering and rules tightened so the new grammars cannot steal each other's
  files (Clover's `price + min` was swallowing TouchBistro's `Modifier Min`).
- Platform capabilities corrected against the manuals: Toast **does** take a bulk CSV (the
  operation-row spreadsheet), Clover **does not** (it takes an `.xls`/`.xlsx` workbook, now
  flagged `xlsxImport`), TouchBistro's CSV is flagged `csvAddsOnly`.
- `square.csv-export`'s summary stopped claiming to produce "the exact importable shape that
  Dashboard > Items > Export yields"; it produces the review shape, and says which columns
  the real template adds.
- `aloha.item-modifier-record-build` creates its group's first member item instead of
  shipping an empty group with a soft-failing check — in Aloha a modifier group is a
  collection of item records, so an empty one is not a record at all.

### Fixed
- **The certification was reading its own inputs too generously.** `verify-cli` fed
  `firstToken(example)` into every string-typed input, so a dry run of
  `touchbistro.86-hide --input item='Pepperoni Pizza'` was actually executed with `Pepperoni`,
  and `example: 'x.csv (place under data/imports/)'` silently became `x.csv`. String examples
  are now passed **literally** — the value the UI pre-fills is the value that gets certified —
  and the prose guidance moved into each input's `description`. All 59 workflows still pass, so
  nothing else was hiding behind the truncation.
- Six workflows had examples naming items that do not exist in the location they are verified
  against (`aloha.shift-86` → `Scallops`, `lightspeed.archive-item` → `Discontinued Special`,
  `lightspeed.modifier-group-create` / `square.modifier-vs-option-sets` → pasta,
  `touchbistro.courses-setup` → `Buffalo Wings (10pc)`, `aloha.item-modifier-record-build` →
  `Hamburger`). Each one made its auto step soft-skip on `Item not found: …` **in every certified
  run** — green, but proving nothing. Examples now name real items in the platform location, and
  `tests/workflows.test.js` fails on any vacuous auto step so this cannot come back.
- `menu.modifier.link` and the other list-typed skills accept a `string[]` param, but a workflow
  input typed `string` reached them as raw text — `for (const ref of 'A; B')` iterated
  *characters*. `engine.js` now coerces a string into a list at the skill boundary (splitting on
  `,` or `;`), which is what the UI's comma-separated field already promised.
- `aloha.item-modifier-record-build` asserted global cleanliness (`no-empty-modifier-groups`)
  after building one group, so it failed on any menu holding unrelated empty groups — including
  the seeded showcase. It now asserts the scoped truth via a new predicate,
  `group-has-members`, and the fleet-wide empties question stays where it belongs: the audit.
- Our own `lightspeed-csv` export did not auto-detect back on re-import (it read as a Square
  file and produced zero modifier groups). Now covered by a regression test.
- Audit steps inside the new import workflows reported pre-existing dirt as a hard failure;
  they are advisory by design — the client gate is where the human decides.
- `README` said 14 post-step predicates while `checks.js` had 13; `docs/SOURCES.md` now carries
  `tests/manuals.test.js`'s doc-count guard, which diffs every quoted count (workflows per
  platform, citations, predicates, registered docs, manual sections) against the machine.
- Manual front-matter `checked:` dates were stamped in UTC (a day ahead of the reviewer's
  local date); corrected to 2026-09-15.

## [1.1.0] — 2026-09-16

Ship-readiness: the artifact can now get itself onto GitHub without anyone
hand-typing git commands, and the docs no longer overstate what the code does.

### Added
- `scripts/push-to-github.sh` — one-shot publish path. Preflight runs the
  certification (`node server/verify-cli.js`) and **refuses to commit or push unless it
  prints `RESULT: PASS`**; optionally gates on `npm test` with `RUN_TESTS=1`. Creates
  `chrisfbaileycb-arch/menuflow-pos` via the GitHub API when it does not exist yet,
  accepts an explicit remote as `$1` (https or ssh), resolves the branch with
  `git symbolic-ref --short -q HEAD` (falling back to `main`) rather than hardcoding it,
  and pushes the resolved commit SHA.
- `npm run push` — same script invoked through `bash`, so it still runs on copies that
  lose the executable bit (zip extraction, Windows checkout).
- `.github/workflows/verify.yml` — CI re-runs `npm run verify` and `npm test` on node
  18/20/22 for every push and PR, re-asserts `RESULT: PASS` from the verifier's own
  output, and guards two invariants that are invisible in a diff: no `data/`, `.env`, key
  or credential path may be tracked, and the 7-entry platform catalog behind the dropdown
  must still be present. Every step was executed locally before the file was committed.
- `CHANGELOG.md`.

### Fixed
- The repository was on `master`, not `main`: `git push -u origin main` failed with
  `src refspec main does not match any`. Branch renamed to `main`; the script no longer
  assumes a branch name at all.
- An interrupted or failed push left a **token-bearing `origin`** in `.git/config`. Pushes
  now go directly to a URL, so credentials never reach the config, a credential-free
  `origin` is written only after success, and the working copy ends in a state where a
  plain `git push` works.
- `scripts/push-to-github.sh` lost its `0755` mode across a workspace snapshot; restored,
  and the mode is verified inside the shipped zip.

- `scripts/push-to-github.sh` died with `fatal: not a git repository` (exit 128) when run
  from an unzipped delivery, because `git rev-parse --abbrev-ref HEAD` executes under
  `set -e` before any friendly message could print — i.e. the documented one-command
  publish failed for exactly the client who received the zip. The script now detects the
  absence of `.git`, initializes a repository (opt out with `INIT=0`, which then exits 3
  with the manual commands), and pushes the resolved commit SHA so an unborn or detached
  HEAD cannot produce a `src refspec ... does not match any` error.

### Changed
- README "Safety model / scope" corrected: **five of seven** platforms declare a live-API
  adapter id (`pocketsuite-rest`, `toast-live-api`, `square-catalog-api`,
  `clover-menu-api`, `lightspeed-urban-api`); TouchBistro and Aloha ship
  `apiAdapter: null` because their menu writes are iPad-local / ADM-back-office driven.
  The previous wording implied all seven were API-wired.
- README: new "Pushing to GitHub" runbook; layout tree lists `scripts/`.
- `docs/ARCHITECTURE.md`: documents the delivery/publish path alongside the runtime path.

## [1.0.0] — 2026-09-15

Initial build: multi-platform restaurant POS operations console.

- **Engine** (`server/engine/`): workflow loader, strict schema verifier, transactional
  executor with `auto` / `manual` / `gate` steps, post-step checks, staging vs live
  publish, dry-run safety (no write path commits staging in dry mode).
- **49 workflows** across 7 platforms — Heartland 10, Toast 8, Square for Restaurants 7,
  Clover 6, Lightspeed K-Series 6, TouchBistro 6, NCR Aloha 6 — generated from
  `fixtures/build-workflows.js` (the generator is the source of truth).
- **52 executable skills** (`menu` / `modifiers` / `pricing` / `channels` / `audit-ops` /
  `io-ops`) and **14 verification predicates**.
- **Citation enforcement**: every manual step carries `{doc, section}` that must resolve in
  `server/sources.js` (29 owner's-manual / KB documents, 122 citations), and a platform may
  only cite documents in its own `docPrefixes` namespace.
- **Audit ported from the client's own tooling**: `server/engine/audit.js` reproduces the
  `heartland-pos` python scripts (cross-contamination, redundancy, duplicate items,
  midnight rule, 86-cascade, pricing conflicts) plus model-aware record-level isolation,
  with a parity suite that executes the vendored `.py` scripts against our export.
- **Import/export built in**: CSV for Square/Clover/Lightspeed/Toast, canonical lossless
  JSON, `heartland-json` compatible with the legacy tooling, verified workflow bundles,
  credentials-stripped project backups.
- **Platform dropdown** (`server/platforms/index.js`) identifying each POS system with
  vendor, portal names, capabilities and doc namespace.
- Surfaces: zero-CDN web console (`web/`), REST API (`server/api.js`), headless CLI
  (`cli/menuflow.js`).
- Doctrine enforced in code, not prose: audit before action, never 86 during service,
  shadow builds only, modifier isolation by default, Midnight Rule, integrity-gated
  publish with recorded overrides.
- 47 tests / 5 suites; `npm run verify` certifies 49/49 workflows including end-to-end
  dry runs.

# Changelog

All notable changes to MenuFlow POS. Dates are UTC.

## [1.1.0] — 2026-09-16

Ship-readiness: the artifact can now get itself onto GitHub without anyone
hand-typing git commands, and the docs no longer overstate what the code does.

### Added
- `scripts/push-to-github.sh` — one-shot publish path. Preflight runs the
  certification (`node server/verify-cli.js`) and **refuses to commit or push unless it
  prints `RESULT: PASS`**; optionally gates on `npm test` with `RUN_TESTS=1`. Creates
  `chrisfbaileycb-arch/menuflow-pos` via the GitHub API when it does not exist yet,
  accepts an explicit remote as `$1` (https or ssh), and derives the branch from
  `git rev-parse --abbrev-ref HEAD` instead of hardcoding it.
- `npm run push` — same script invoked through `bash`, so it still runs on copies that
  lose the executable bit (zip extraction, Windows checkout).
- This file.

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

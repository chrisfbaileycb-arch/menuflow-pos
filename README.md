# MenuFlow POS

**Multi-platform restaurant POS operations console — Signal F Holdings LLC**

Not a front-end mock: every action, workflow and skill below is a real, executable engine capability with an HTTP + CLI surface, a test suite, and per-step citations resolved against each POS platform's owner's manuals / official documentation. Import and export are built in at every layer (UI, CLI, workflow steps, API).

---

## What it is

One console that identifies **each POS system in a dropdown** and, per platform, ships a catalog of **verified, executable workflows** for the menu-operations work a POS consultant / owner actually does:

| Platform | Workflows | Portal the manual steps navigate |
|---|---|---|
| Heartland (PocketSuite / Genius) | 10 | Admin Console `Menu > Items / Modifiers` + Manager POS |
| Toast | 8 | Toast Web `Menus / Front of house` + POS |
| Square for Restaurants | 7 | Dashboard `Library / Items > Actions > Import Library` |
| Clover | 6 | Dashboard `Items / Menu` + Inventory app |
| Lightspeed Restaurant (K-Series) | 6 | Back Office `Menu > Item list` |
| TouchBistro | 6 | Menu tool / RMM |
| NCR Aloha | 6 | ADM + POS 86/EOD screens |

Plus the **shared Signal F intelligence layer** on every platform: menu audit, shadow-build methodology, modifier isolation, the Midnight Rule, pricing-stack doctrine, the never-86 protocol.

## Run it

```bash
node server/server.js            # or: npm start   → http://localhost:3000
node server/verify-cli.js        # or: npm run verify  → certify all 49 workflows
npm test                         # 47 tests incl. parity vs the original python audit scripts
node cli/menuflow.js --help      # same engine, headless
```

Zero dependencies (Node ≥ 18). State lives in `data/state.json`; reset with `rm -rf data` (reseeds from `fixtures/sample-menu.json`).

## The three promises, and how they're enforced

### 1. "Not just a pretty front end"
There are **52 implemented skills** (engine actions) behind the UI. The workflow verifier (`server/engine/engine.js → validateWorkflow`) **rejects** any workflow whose `auto` step names a skill that doesn't exist, and any high-risk/destructive workflow that lacks a client-approval gate. Steps run transactionally on an isolated workbench:
- `apply` runs commit to **staging**; only an explicit **publish** (validated by integrity checks) writes to live;
- every step may declare `checks` (14 verification predicates — e.g. `modifier-isolated`, `no-midnight-violations`) that run against real menu state after execution;
- gates pause the run and resume only with a recorded approval (`/api/approve`), which is stored as audit evidence.

### 2. "Import and export built in"
- **Import:** Square/Clover/Lightspeed/Toast **CSV** (the shapes their own Dashboard exports use) and canonical/Heartland-flat **JSON**, all normalization-cleaned on entry (trim, case folding, money re-typing, duplicate-option folding — the ×22-pepperoni fix). Imports land in staging, are audited, and require publish.
- **Export:** canonical JSON (lossless round-trip), per-platform CSVs, `heartland-json` **byte-compatible with the original heartland-pos python tooling** (proven by a parity test that runs the `.py` scripts on the export), audit reports (MD/JSON), the **verified workflow bundle** (for offline/client handoff), and a credentials-stripped full project backup.
- Available from the web UI, `POST /api/import` / `POST /api/export`, workflow steps (`io.*` skills), and the CLI.

### 3. "Workflows verified, executable, based off owners' manuals"
Every **manual** (operator-side) step carries an owner's-manual citation `{doc, section}` that must resolve in `server/sources.js` — 29 indexed documents with per-section excerpts. Each workflow JSON is statically schema-checked, and `npm run verify` additionally **dry-runs all 49 workflows end-to-end** against the seeded sandbox menus. Verification status is surfaced in the UI ("Verify all workflows" banner), the API (`GET /api/verify`), the CLI (`menuflow.js verify`), and stamped into exported workflow bundles.

Citation provenance is honest and per-doc:
- `official-doc` — cross-checked against the vendor's published manual/help-center section (URLs in `server/sources.js`, checked 2026-09-15),
- `client-kb` — derived from the audited Signal F `heartland-pos` knowledge base (Heartland-specific logic: midnight rule, modifier isolation, pricing priority, shadow build),
- `legacy-manual` — from widely distributed legacy owner manuals (NCR Aloha, TouchBistro owner guide, Toast Card & Terminal) — re-confirm against the client's exact revision before portal work.

## Engine philosophy (baked in, not decorative)

- **Audit before action** — no flow touches a live system without a report + written approval gate first (enforced by the gate validator and the publish blocker).
- **Shadow builds only** — `channel.shadow_create/verify/cutover` implement the v2-channel methodology exactly: `[Channel] v2`, live never interrupted, originals retained as fallback until retired.
- **Modifier isolation by default** — `shared=true` must be explicit; `menu.modifier.isolate` / `isolate_all_shared` split cross-category records per category (the pepperoni problem).
- **Never 86 in the system** — the 86 skills are reversible POS-side unavailability + customer-contact protocol; hard delete requires an exact `DELETE-<id>` confirmation and a gate.
- **Midnight Rule** — schedules and pricing windows that cross midnight are *impossible to write* as single entries: `menu.schedule.set` and `pricing.rule.add` auto-split with next-day assignment, and audits flag legacy offenders.

## Layout

```
server/
  server.js · api.js         HTTP + REST (the ONLY surface the UI/CLI use)
  sources.js                 owner's-manual citation registry (doc § section excerpts)
  engine/
    engine.js                loader, strict verifier, transactional executor
    registry.js · skills/    52 executable actions (menu/modifiers/pricing/channels/audit/io)
    checks.js                14 post-step verification predicates
    audit.js                 heartland-pos audit scripts ported + extended (model-aware)
    menu.js                  canonical menu model (cents, minutes-from-midnight)
  workflows/<platform>/      49 verified workflow JSON definitions
  platforms/                 dropdown catalog: docs namespaces, capabilities, portal names
  importexport/              CSV/JSON parsers & writers for all platforms + backups
  verify-cli.js              the certification run
web/                          zero-dependency console UI (dropdown, runner, gates, tables)
cli/menuflow.js              headless engine
tests/                        47 tests incl. python-parity (tests/parity/ holds the vendored scripts)
fixtures/                     seed menus (dirty showcase + clean control), CSV samples, generators
docs/                         ARCHITECTURE.md · SOURCES.md
scripts/push-to-github.sh     preflight-verified publish to GitHub (see "Pushing to GitHub")
```

## Safety model / scope

Sandbox mode is default and executes against the local workbench store. Five of the seven platform entries declare a live-API adapter id (`pocketsuite-rest`, `toast-live-api`, `square-catalog-api`, `clover-menu-api`, `lightspeed-urban-api`); TouchBistro and Aloha deliberately ship `apiAdapter: null` because their menu writes are iPad-local / ADM-back-office driven, so the console stays portal-gated there. Either way **live-API mode requires per-platform credentials** and the portal-side `manual` steps remain operator-executed task cards with verified citations — the console verifies them with workbench checks and explicit ACKs. Audit, remediation, import/export, isolation, midnight-split, shadow-build and publish flows are all genuinely automated here; the actual write to a vendor's hosted menu is deliberately human-gated by design doctrine ("clients control their own cutover").

## Pushing to GitHub

`scripts/push-to-github.sh` is the one-shot path, and it refuses to ship anything that isn't green:

```bash
GH_TOKEN=<fine-grained PAT> ./scripts/push-to-github.sh     # creates chrisfbaileycb-arch/menuflow-pos if absent, then pushes main
RUN_TESTS=1 GH_TOKEN=... ./scripts/push-to-github.sh         # also gate on the 47-test suite
./scripts/push-to-github.sh git@github.com:chrisfbaileycb-arch/menuflow-pos.git   # ssh, no token
./scripts/push-to-github.sh https://github.com/chrisfbaileycb-arch/menuflow-pos.git # will prompt for auth
```

`npm run push` is the same script via `bash`, so it still works if the executable bit is lost in a zip copy or a Windows checkout.

Preflight runs `node server/verify-cli.js` and requires `RESULT: PASS` (schema-valid workflows, resolvable citations, clean dry-runs) before anything is committed or pushed; `data/` is gitignored so no run state leaves the machine. The token is passed straight to `git push` as a URL and is never written into `.git/config`, a credential helper, or the commit — the origin left behind is credential-free. Needs only *Administration* + *Contents* read/write on the single repo (fine-grained). The branch is `main`.

## Maintained by

Christopher Bailey — Signal F Holdings LLC · YR Hub.

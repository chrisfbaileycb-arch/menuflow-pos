# ARCHITECTURE

## Data flow

```
┌────────────┐   fetch    ┌──────────────────────── server/api.js ───────────────────────┐
│  web/ UI   │ ─────────► │ routes: platforms·workflows·run·approve·menu·audit·io·publish│
└────────────┘            └──────┬────────────────────────────────────────────────────┬──┘
┌────────────┐   argv            │                                                    │
│  cli/      │ ─────────────────►│                        engine/engine.js ◄──────────┤
└────────────┘                   │                load+validate+execute workflows     │
                                 ▼                                                  ▼
                      server/workflows/<platform>/*.json                  engine/registry.js
                                 │                                            │ 52 skills
                                 ▼                                            ▼
                       sources.js (citations)                       engine/menu.js (canonical model)
                                                                        ▲        │
                                  store.js (data/state.json) ───────────┘        ▼
                                  live + staging per location            engine/audit.js
                                                                         importexport/ (CSV/JSON)
```

## Canonical model (single source of truth across platforms)

Items reference modifier **groups** (records); groups hold options; availability is per channel **name**; pricing rules are a first-match-wins stack with scope filters (days/time windows/channel/room); schedules are day+window entries. Money = integer cents; times = minutes from midnight. Platform adapters map this model to/from portal CSVs and (when credentialed) vendor APIs.

## Workflow definition schema

```jsonc
{
  "id": "hl.modifier-isolate",          // must equal filename & match folder platform
  "platform": "heartland",
  "category": "modifiers",              // UI filter chip
  "risk": "medium",                     // low | medium | high → high forces a gate step
  "title": "…", "summary": "…",
  "inputs": [{ "name": "modifier", "type": "string", "required": true, "example": "Pepperoni" }],
  "preconditions": ["…"],
  "steps": [
    { "id": "s-scan", "kind": "auto",   "title": "…", "skill": "audit.cross-contamination", "args": {}, "citations": [{"doc": "heartland.kb.modifier-architecture", "section": "pepperoni-problem"}] },
    { "id": "s-approve", "kind": "gate","title": "…", "instructions": "written client approval…" },
    { "id": "s-portal", "kind": "manual","title": "…", "instructions": "Admin Console > Menu > Modifiers…", "citations": [ … ] },
    { "id": "s-verify", "kind": "auto", "title": "…", "skill": "audit.verify_fix", "checks": [{ "check": "modifier-isolated", "args": { "modifier": "{modifier}" } }] }
  ]
}
```

Step `args` support `{inputName}` templates (whole-value or interpolated; arrays supported). `fatal: false` degrades a step to a soft warning (used for optional remediations).

## Execution semantics

1. `run()` snapshots staging-or-live into an isolated **workbench**; `ctx.baselineMenu` preserves the pre-run state for `audit.verify_fix` before/after deltas.
2. Steps execute in order. `auto` → skill handler mutates the workbench. `manual` → task card; auto-passes when its declared `checks` already hold on the workbench, else requires operator ACK (recorded approval). `gate` → halts the run until an approval exists; resumption = same call with `approvals: [stepId…]` (runs are deterministic, so replay-to-resume is safe).
3. Any check failure or throwing `auto` step (non-fatal:false) fails the run; **nothing is committed**.
4. Success + `apply` commits workbench → **staging**. Live changes only via `publish.apply` (in-workflow, always after a gate) or `POST /api/publish` — both re-run the integrity audit and 409 on HIGH blockers (empty groups, midnight ranges, dead force rules, cross-category modifier records, rush+hold, empty shadow channels).

## Verification (the "verified" in "verified workflows")

`validateAll()` (npm run verify / GET /api/verify / menuflow verify / export bundles / UI banner):
- schema + filename/folder/id consistency
- every `auto.skill` exists; every required param provided or input-declared
- every citation resolves in `sources.js`; every citation belongs to the platform (or the shared Signal F docs)
- manual steps have instructions + ≥1 citation; gates have instructions
- high-risk or destructive-skill workflows must contain a gate
- then a **dry-run execution of every workflow** with example-derived inputs and pre-approvals; exit code 0 only if all pass.

`npm test` additionally executes all 49 workflows in **apply mode** with real checks and asserts state transitions (isolation, midnight-split, cutover lifecycle, CSV import idempotence), python parity of the ported audit scripts, IO round-trips, and HTTP API behaviors (pause/resume, publish blocker, staging isolation).

## Extension points

- New skill: export a handler from `server/engine/skills/*.js` (auto-registered; `params` drive validation).
- New check: add to `engine/checks.js`.
- New platform: entry in `server/platforms/index.js` (docPrefixes bind which manual citations it may use) + `server/workflows/<id>/` JSONs + a seed location if desired.
- New workflow: add to `fixtures/build-workflows.js` and regenerate (keeps the catalog source reviewable), or write the JSON directly; CI gates on verify.

# POS Coverage — Modular Intake / Output Audit

**Status: 11/11 POS have dedicated intake + output modules.** Each lives in `src/adapters/<pos>/`.

| POS | Module | Intake (import) | Output (export) | Manifest | What's stubbed / missing | What we still need from you |
|---|---|---|---|---|---|---|
| **Toast** | `toast/skillset.ts` + `toast/impl.ts` | `executeStaffImport` `executeRewardsImport` + `menu_audit_scan` (vertical CREATE/UPDATE/ATTACH) | `executeStaffExport` `executeRewardsExport` | `ToastPosSkillSet` — oauth2 `TOAST_API_KEY` + `TOAST_LOCATION_GUID` | Menu **execute** is audit-only (validates sequence IDs, rejects horizontal rows). No live Toast API push yet — needs Toast Partner API credentials + confirmation of whether to use `menuConfig` vs direct DB write. | Confirm Toast environment: sandbox GUID + whether you want browser-agent fallback when API is unavailable. |
| **Square** | `square/skillset.ts` + `square/impl.ts` | `executeStaffImport` / `executeRewardsImport` (token `itm_/var_/mod_` horizontal) | `executeStaffExport` / `executeRewardsExport` | `SquarePosSkillSet` — oauth2 `SQUARE_ACCESS_TOKEN` + `SQUARE_LOCATION_ID` | Modifier set pre-existence check is noted but not enforced. Overlap validation for shifts is stubbed. | Square location IDs + confirmation of Catalog API version to target. |
| **Clover** | `clover/skillset.ts` + `clover/impl.ts` | `executeStaffImport` / `executeRewardsImport` (multi-tab `.xlsx`) | `executeStaffExport` / `executeRewardsExport` | `CloverPosSkillSet` — bearer `CLOVER_API_TOKEN` + `CLOVER_MERCHANT_ID` | XSLX parser is wired to CSV fallback — true `.xlsx` tab stitching (ITEMS/MODIFIER_GROUPS/MODIFIERS FK join) needs `exceljs` dep. | Sample Clover workbook + whether you want us to add `exceljs`. |
| **NCR Aloha** | `aloha/skillset.ts` + `aloha/impl.ts` + `aloha/schema.ts` | `executeStaffImport` / `executeRewardsImport` (fixed-width DBF/XML, ID length rules) | `executeStaffExport` / `executeRewardsExport` | `AlohaPosSkillSet` — local_agent `ALOHA_USERNAME` + `ALOHA_STORE_ID` | Enterprise XML node mapping is type-only; DBF binary parse not implemented. Daypart Modes → submenu linkage is spec'd not executed. | Aloha export sample (DBF or XML) + length rule overrides if any. |
| **SpotOn** | `spoton/skillset.ts` + `spoton/impl.ts` | `executeStaffImport` / `executeRewardsImport` (JSON catalog + ledger route) | `executeStaffExport` / `executeRewardsExport` | `SpotOnPosSkillSet` — `SPOTON_API_KEY` + `SPOTON_LOCATION_ID` | Room Maps / Dayparts associative arrays are validated as types only; no live hardware ledger POST. | SpotOn API docs or sample JSON catalog payload. |
| **TouchBistro** | `touchbistro/skillset.ts` + `touchbistro/impl.ts` | `executeStaffImport` / `executeRewardsImport` (SQLite snapshot) | `executeStaffExport` / `executeRewardsExport` | `TouchBistroPosSkillSet` — bearer `TOUCHBISTRO_API_TOKEN` + `TOUCHBISTRO_VENUE_ID` | iPad SQLite low-overhead array constraint is not runtime-checked. | TouchBistro cloud sync endpoint + venue ID. |
| **Lightspeed** | `lightspeed/skillset.ts` + `lightspeed/impl.ts` | `executeStaffImport` / `executeRewardsImport` (ingredient tree) | `executeStaffExport` / `executeRewardsExport` | `LightspeedPosSkillSet` — oauth2 `LIGHTSPEED_API_KEY` | Inventory depletion linkage is spec'd, not wired to warehouse API. | Lightspeed account ID + whether to include `Company` field in rewards. |
| **Shift4 SkyTab** | `skytab/skillset.ts` + `skytab/impl.ts` | `executeStaffImport` / `executeRewardsImport` (payment-anchored DB) | `executeStaffExport` / `executeRewardsExport` | `SkyTabPosSkillSet` — `SKYTAB_API_KEY` + `SKYTAB_MERCHANT_ID` | Terminal-category mapping is stubbed; settlement key anchoring not validated live. | SkyTab merchant ID + terminal mapping sheet if available. |
| **Oracle MICROS** | `micros/skillset.ts` + `micros/impl.ts` | `executeStaffImport` / `executeRewardsImport` (RVC / Obj_Num) | `executeStaffExport` / `executeRewardsExport` | `MicrosPosSkillSet` — `MICROS_API_KEY` + `MICROS_ENTERPRISE_ID` | Multi-venue RVC hierarchy is typed, not executed against Simphony. | MICROS enterprise ID + RVC list. |
| **Revel** | `revel/skillset.ts` + `revel/impl.ts` | `executeStaffImport` / `executeRewardsImport` (open-API tree) | `executeStaffExport` / `executeRewardsExport` | `RevelPosSkillSet` — `REVEL_API_KEY` + `REVEL_ESTABLISHMENT_ID` | Delivery override metrics are noted, not calculated. | Revel establishment ID + delivery partner list. |
| **Heartland** | `heartland/skillset.ts` + `heartland/impl.ts` | `executeStaffImport` / `executeRewardsImport` | `executeStaffExport` / `executeRewardsExport` | `HeartlandPosSkillSet` v1.2.0 — `HEARTLAND_SECRET_API_KEY` + `HEARTLAND_LOCATION_ID` | Full reference implementation — other POS were cloned from this pattern. | None — Heartland is complete as template. |

## Shared contracts
- `src/adapters/types.ts` — `PosProvider` now includes all 11 values, `CsvImportResult`, `PosSkillSetDefinition`
- `src/adapters/posEcosystem.ts` — single source of truth for `POS_PROFILES` schemas + system rules
- `src/adapters/staff/index.ts` — shared CSV normalization (`parseStaffRecord` / `parseRewardsMemberRecord`)
- `src/adapters/utils/csv.ts` — RFC-4180 `buildRowsFromString` used by all executors
- `automation/browser_agent.py` — generic Playwright fallback for any POS when no public API export exists (loyalty / coupons / payroll / menu import)

## What's still stubbed across all new modules
1. **Live API calls** — executors validate + normalize but do not POST to the POS. Intentional for v1; prevents accidental writes.
2. **Menu import execution** — most POS expose `menu_audit_scan` as validate-only; full `executeMenuImport` to be added once you confirm target API.
3. **Payroll `timecard_pull`** — skill declared, executor not wired (payroll is export-only in v1).
4. **Clover `.xlsx`** — needs `exceljs` dep decision.

## Next step
Provide one sample export per POS (even a single-row CSV) + credential type preference, and we wire live calls behind `VITE_POS_MODE=live` flag without touching v1 Toast UI.

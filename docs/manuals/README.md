# Platform manuals — bulk files, modifiers, and portal reality

Seven platform manuals plus one cross-platform matrix. They exist because **every POS encodes
the same menu differently in its bulk file**, and the difference is not cosmetic: it decides
which migrations are a column rename, which are a structural rewrite, and which cannot be a
file at all.

| Manual | Platform doc id | Bulk path | Modifier model in the file |
|---|---|---|---|
| [`square.md`](square.md) | `square.manual` | CSV/XLSX item-library template, Modify or Replace | `Modifier set [Name]` Y/N column — set *contents* never in the file |
| [`clover.md`](clover.md) | `clover.manual` | `.xls`/`.xlsx` workbook, one tab per object type, ≤5 MB | group rows + item association; `minRequired`/`maxAllowed`; prices in cents |
| [`toast.md`](toast.md) | `toast.manual` | operation-row CSV from a Google-Sheets template; **not reversible** | `MODIFIER_GROUP`/`MODIFIER` rows parented by GUID or operation ID |
| [`lightspeed.md`](lightspeed.md) | `lightspeed.manual` | CSV/XLSX with manual column mapping; keys on `SKU` | `Type=Group` rows with `Min - Max` (`2-5`); `Extra price` on members |
| [`touchbistro.md`](touchbistro.md) | `touchbistro.manual` | new items only — no bulk updates, no tax, no delete | RMM per-item configuration, not the bulk file |
| [`aloha.md`](aloha.md) | `aloha.manual` | none — records in the item database, distributed by ownership | modifiers **are items**; up to 10 groups per item, 54 buttons per group |
| [`heartland.md`](heartland.md) | `heartland.manual` | none — Admin Console fields; JSON is the data contract | `Min/Max Choices`, included ingredients, per-ingredient default price |
| [`csv-matrix.md`](csv-matrix.md) | `signalF.csv-matrix` | comparison layer cited by every platform | all seven encodings side by side |

## How these manuals are wired into the code

The manuals are not decoration; they are load-bearing in three places:

1. **Registry.** `fixtures/build-manual-sources.js` parses every manual in this directory —
   its front matter and its numbered `## N. key — Title` headings — and generates
   `server/sources.manuals.generated.js`, which `server/sources.js` merges into the citation
   registry. The manual file is therefore the **single source of truth** for both the prose and
   the exact excerpt text a workflow cites.
2. **Enforcement.** A workflow step's citation must resolve to a doc + section here, and a
   platform may only cite its own manuals (plus the shared `signalF.*` / `heartland.kb.*`
   doctrine docs). So `toast.csv-import` cannot quietly lean on a Heartland sentence.
3. **Tests.** `tests/manuals.test.js` fails if a heading has no registry section, a registry
   section has no heading, the generated file is stale, or a platform's import/export workflow
   does not cite its own manual. Run `node fixtures/build-manual-sources.js` after editing a
   manual, then `npm run verify`.

```
front matter (docId, platform, url, verified, file)
        │
        ├─ heading "## 3. modifier-set-columns — …"  ──►  SOURCES['square.manual'].sections['modifier-set-columns']
        │                                                       ▲
        └─► server/sources.manuals.generated.js ──► server/sources.js
                                                            │
                        workflow JSON: {"doc":"square.manual","section":"modifier-set-columns"}
                                                            ▼
                              verifier resolves it, UI shows the excerpt, run record keeps it
```

## Statuses used here, and what they mean for an operator

| `verified` | Meaning | What to do |
|---|---|---|
| `official-doc` | Read from the vendor's own documentation on 2026-09-16 (URL in front matter) | Re-check if the vendor UI has moved since; paths quoted in steps came from these pages |
| `access-limited` | Vendor article exists but sits behind a help-portal login; wording taken from the public index entry (TouchBistro bulk upload) | Confirm against the client's build before guiding a change |
| `compiled` | Synthesis across the cited vendor pages (the matrix) | Cite for the mapping, cite the platform manual for the claim itself |
| `community-doc` | Vendor-staff answer in a public forum (Square Seller Community) | Reliable for behaviour, weaker for exact navigation |
| `client-kb` | Signal F Holdings' audited `heartland-pos` knowledge base | Canonical for Heartland; portable rules flagged where used |
| `legacy-manual` | Widely distributed legacy owner-manual families | Re-confirm against the client's exact revision |

Anything a manual could **not** verify is stated as unverified in the manual itself — see §1 of
`touchbistro.md` for the worked example. That is deliberate: a manual that reads as uniform
confidence is a manual that will be trusted in the wrong place.

## Three rules the manuals converge on

- **Take the export first.** Every platform's file is keyed on an identifier that only means
  something inside the account that issued it (`Token`, `Clover ID`, `SKU`, GUID), so the
  export is both template and rollback reference.
- **Check attachment, not existence.** A modifier group that exists but is attached to nothing
  is valid data and an invisible menu. Association counts are the first post-import check on
  Clover, Lightspeed, Heartland and Aloha alike.
- **Know which imports you can undo.** Square has Undo Catalogue; Toast says changes are not
  reversible; Lightspeed says updates cannot be automatically reversed and items cannot be
  deleted, only disabled. That difference is encoded as the `irreversible` flag on workflows and
  is what forces the backup-before-write gate.

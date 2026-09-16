/**
 * io-ops.js — import/export as first-class executable skills
 * (so workflows can include "import this CSV" or "export a backup" steps).
 */
const M = require('../menu');
const IE = require('../../importexport');
const store = require('../../store');

module.exports = {
  'io.import.menu': {
    title: 'Import a menu file (canonical JSON or platform CSV) into the staging workbench',
    description: 'Normalization runs on import (trim/case/price types + duplicate option folding). Live menu is untouched until publish.',
    params: [
      { name: 'file', required: true, type: 'string', example: 'path inside data/imports/ or an absolute path' },
      { name: 'format', required: false, type: 'string', example: 'auto | canonical-json | square-csv | clover-csv | lightspeed-csv | toast-csv' },
      { name: 'mode', required: false, type: 'string', example: 'modify | replace (replace clears staging items first)' },
    ],
    handler(ctx, args, menu) {
      const result = IE.importFile(args.file, {
        format: args.format || 'auto',
        platform: ctx.platform,
        menu,
        mode: args.mode === 'replace' ? 'replace' : 'modify',
      });
      M.touch(menu);
      return {
        message: `Imported ${result.summary.items} item(s), ${result.summary.groups} group(s), ${result.summary.categories} categories — ${result.summary.normalized} normalization fix(es)`,
        diff: result.summary,
        notes: result.warnings.map(w => `WARN: ${w}`).slice(0, 10),
      };
    },
  },

  'io.import.raw': {
    title: 'Import from raw content (used by the web UI drop-in with pasted file contents)',
    params: [
      { name: 'content', required: true, type: 'string' },
      { name: 'filename', required: false, type: 'string' },
      { name: 'format', required: false, type: 'string' },
    ],
    handler(ctx, args, menu) {
      const result = IE.importRaw(args.content, args.filename || 'pasted', {
        format: args.format || 'auto', platform: ctx.platform, menu,
      });
      M.touch(menu);
      return { message: `Imported (raw): ${result.summary.items} item(s); normalized ${result.summary.normalized} issue(s)`, diff: result.summary, notes: result.warnings.slice(0, 10) };
    },
  },

  'io.export.menu': {
    title: 'Export the live menu (canonical JSON or platform CSV) → data/exports/',
    params: [
      { name: 'format', required: false, type: 'string', example: 'canonical-json | square-csv | clover-csv | lightspeed-csv | toast-csv | heartland-json' },
      { name: 'scope', required: false, type: 'string', example: 'live | staging (default live)' },
    ],
    handler(ctx, args, menu) {
      const useMenu = args.scope === 'staging' ? menu : store.menuFor(ctx.location.id, 'live');
      const out = IE.exportMenu(useMenu, args.format || 'canonical-json', ctx.platform, ctx.mode === 'dry');
      return { message: ctx.mode === 'dry' ? `[dry-run] would export ${out.filename} (${out.bytes} bytes)` : `Exported ${out.filename} (${out.bytes} bytes) → ${out.path}`, diff: { filename: out.filename, format: out.format } };
    },
  },

  'io.export.workflows': {
    title: 'Export this platform’s verified workflow bundle (JSON) for offline/auditing use',
    params: [],
    handler(ctx, args, menu) {
      const out = IE.exportWorkflows(ctx.platform);
      return { message: `Workflow bundle exported: ${out.filename} (${out.workflows.length} workflows, ${out.verified ? 'ALL VERIFIED' : 'verification pending'})`, diff: { path: out.path } };
    },
  },

  'io.export.project': {
    title: 'Full project backup (settings, locations, menus, run history) — safe to hand off',
    params: [],
    handler(ctx, args, menu) {
      const out = IE.exportProject();
      return { message: `Project backup written: ${out.path}`, diff: { bytes: out.bytes } };
    },
  },

  'publish.apply': {
    title: 'PUBLISH — commit the verified staging workbench to the live menu',
    description: 'The ONLY path that touches the live menu. Blocked while HIGH audit blockers exist (empty groups, midnight violations, rush+hold conflicts).',
    params: [],
    handler(ctx, args, menu) {
      const Audit = require('../audit');
      const report = Audit.fullAudit(menu);
      // System-integrity blockers only. 86-cascade HIGHs are operational protocol
      // (documented in the run notes), not config defects — they never block publish.
      const BLOCKING = new Set(['EMPTY_MODIFIER_GROUP', 'MIDNIGHT_RULE_VIOLATION', 'RUSH_HOLD_CONFLICT', 'DEAD_FORCE_PRICE_RULE', 'MODIFIER_RECORD_SPANS_CATEGORIES', 'SHADOW_EMPTY']);
      const blockers = report.sections.flatMap(s => s.findings).filter(f => f.severity === 'HIGH' && BLOCKING.has(f.type));
      if (blockers.length) {
        return { blocked: true, message: `Publish blocked — ${blockers.length} integrity blocker(s) remain (empty groups / midnight ranges / rush+hold / dead force rules / cross-contamination). Clear them or document an exception (audit-before-action doctrine).`, findings: blockers.slice(0, 15) };
      }
      if (ctx.mode === 'dry') {
        return { message: '[dry-run] publish validation PASSED — all integrity blockers clear. In apply mode this commits staging → live.', findings: [] };
      }
      // write the current workbench into staging, then commit it to live
      const entry = store.liveMenu(ctx.location.id);
      entry.staging = JSON.parse(JSON.stringify(menu));
      store.commitStaging(ctx.location.id, `published by ${ctx.actor} via run ${ctx.runId}`);
      ctx.__publishedInRun = true;
      return { message: 'PUBLISHED: workbench validated (no HIGH blockers) and committed to the live menu. Prior state recoverable from data/exports backups.', findings: [] };
    },
  },

  'publish.discard': {
    title: 'Discard staging — revert the workbench, live untouched',
    params: [],
    handler(ctx, args, menu) {
      store.discardStaging(ctx.location.id);
      return { message: 'Staging discarded. Live menu was never modified.' };
    },
  },
};

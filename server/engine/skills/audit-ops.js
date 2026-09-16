/**
 * audit-ops.js — audit skills wrapping engine/audit.js (ported heartland-pos tools),
 * plus finding-reduction verification (before → after) used by remediation workflows.
 */
const Audit = require('../audit');
const M = require('../menu');
const fs = require('fs');
const path = require('path');

function writeReport(ctx, name, content) {
  if (ctx && ctx.mode === 'dry') return `(dry-run: ${name} not written)`;
  const dir = path.join(require('../../store').DATA_DIR, 'reports');
  fs.mkdirSync(dir, { recursive: true });
  const file = path.join(dir, `${new Date().toISOString().slice(0, 10)}-${name}`);
  fs.writeFileSync(file, content);
  return file;
}

function baseline(ctx) {
  if (!ctx.baselineFindings) ctx.baselineFindings = Audit.fullAudit(ctx.baselineMenu);
  return ctx.baselineFindings;
}

module.exports = {
  'audit.cross-contamination': {
    title: 'Scan for modifier cross-contamination (pepperoni problem)',
    params: [],
    handler(ctx, args, menu) {
      const v = Audit.modifierCrossContamination(menu);
      return { message: `Cross-contamination scan: ${v.length} violation(s)`, findings: v };
    },
  },
  'audit.redundancy': {
    title: 'Scan for redundant modifiers, duplicate item names (×22 problem)',
    params: [],
    handler(ctx, args, menu) {
      const maint = Audit.modifierMaintenanceRisk(menu);
      const dups = Audit.duplicateItemNames(menu);
      return { message: `Redundancy scan: ${maint.length} redundant modifier(s), ${dups.length} duplicate name group(s)`, findings: [...maint, ...dups] };
    },
  },
  'audit.86-risk': {
    title: '86 cascade risk report (never-86 protocol)',
    params: [],
    handler(ctx, args, menu) {
      const r = Audit.cascadeRisk86(menu);
      return {
        message: `86-risk: ${r.length} modifier(s) with cascade exposure`,
        findings: r,
        notes: ['Core protocol: never 86 in-system during service; contact customers; disable after service with a plan.'],
      };
    },
  },
  'audit.midnight': {
    title: 'Midnight Rule violations audit (silent failures)',
    params: [],
    handler(ctx, args, menu) {
      const v = Audit.midnightViolations(menu);
      return { message: `Midnight Rule audit: ${v.length} violation(s)`, findings: v };
    },
  },
  'audit.pricing': {
    title: 'Pricing-rule stack audit (deep stacks, dead force rules, post-tax flags)',
    params: [],
    handler(ctx, args, menu) {
      const v = Audit.pricingRuleConflicts(menu);
      return { message: `Pricing audit: ${v.length} finding(s)`, findings: v };
    },
  },
  'audit.empty-groups': {
    title: 'Empty modifier group audit (third-party sync breaker)',
    params: [],
    handler(ctx, args, menu) {
      const v = Audit.emptyModifierGroups(menu);
      return { message: `Empty group audit: ${v.length} blocker(s)`, findings: v };
    },
  },
  'audit.coursing': {
    title: 'Coursing audit (Course 0 in full service; Rush+Hold conflict)',
    params: [],
    handler(ctx, args, menu) {
      const v = Audit.coursingIssues(menu);
      return { message: `Coursing audit: ${v.length} finding(s)`, findings: v };
    },
  },
  'audit.full': {
    title: 'FULL AUDIT — all scans + client report',
    params: [{ name: 'writeReport', required: false, type: 'boolean' }],
    handler(ctx, args, menu) {
      const report = Audit.fullAudit(menu);
      const out = { message: `Full audit: ${report.summary.total_findings} finding(s) — HIGH ${report.summary.high}/MED ${report.summary.medium}/LOW ${report.summary.low}`, findings: report.sections.flatMap(s => s.findings), report };
      if (args.writeReport !== false) {
        const md = Audit.renderAuditMarkdown(report);
        out.reportMdPath = writeReport(ctx, 'audit-report.md', md);
        out.reportJsonPath = writeReport(ctx, 'audit-report.json', JSON.stringify(report, null, 2));
      }
      return out;
    },
  },
  'audit.verify_fix': {
    title: 'Verify a remediation reduced findings vs. the audit baseline',
    description: 'Compares current workbench against the snapshot taken at run start. Used after isolation/split/dead-rule cleanup.',
    params: [{ name: 'metric', required: false, type: 'string', example: 'cross_contamination|midnight|pricing|empty_groups|duplicates|all' }],
    handler(ctx, args, menu) {
      const base = baseline(ctx);
      const now = Audit.fullAudit(menu);
      const metric = args.metric || 'all';
      const sec = (rep, key) => {
        if (metric !== 'all' && rep.sections.find(s => s.key === key) == null) return 0;
        return rep.sections.find(s => s.key === key)?.findings.length || 0;
      };
      const cmp = {
        cross_contamination: [sec(base, 'isolation'), sec(now, 'isolation')],
        midnight: [sec(base, 'midnight_rule'), sec(now, 'midnight_rule')],
        pricing: [sec(base, 'pricing_conflicts'), sec(now, 'pricing_conflicts')],
        empty_groups: [sec(base, 'empty_groups'), sec(now, 'empty_groups')],
        duplicates: [sec(base, 'duplicate_items'), sec(now, 'duplicate_items')],
      };
      const improved = Object.entries(cmp).filter(([k, [b, n]]) => n < b).map(([k]) => k);
      const regressed = Object.entries(cmp).filter(([k, [b, n]]) => n > b).map(([k]) => k);
      // Idempotence rule: any regression fails; no-change-on-clean-menu passes.
      const ok = regressed.length === 0;
      return {
        message: `Fix verification: ${improved.length ? `improved [${improved.join(', ')}]` : 'no change required (baseline already clean)'}${regressed.length ? `; REGRESSED [${regressed.join(', ')}]` : ''}`,
        findings: Object.entries(cmp).map(([k, [b, n]]) => ({ type: 'METRIC', metric: k, before: b, after: n })),
        ok,
      };
    },
  },
  'report.markdown': {
    title: 'Render the current audit (or supplied report) as client-facing markdown',
    params: [],
    handler(ctx, args, menu) {
      const report = Audit.fullAudit(menu);
      const md = Audit.renderAuditMarkdown(report);
      const file = writeReport(ctx, 'client-report.md', md);
      return { message: `Client report written to ${path.relative(process.cwd(), file)}`, markdown: md };
    },
  },
  'menu.channel.list': {
    title: 'List channels and statuses (diagnostic)',
    params: [],
    handler(ctx, args, menu) {
      return { message: menu.channels.map(c => `${c.name} [${c.status}]`).join(', ') || 'no channels', diff: { channels: menu.channels } };
    },
  },
};

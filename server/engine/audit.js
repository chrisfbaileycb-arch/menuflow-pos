/**
 * audit.js — Signal F Holdings audit engine (JS port of heartland-pos audit/*.py).
 * Parity of detection logic & thresholds with modifier-scan.py, redundancy-check.py
 * and 86-risk-report.py, extended to the canonical multi-platform menu model.
 * Tests assert parity against the original Python outputs.
 */
const M = require('./menu');

const severity = (items, cats, { highItems = 5, highCats = 2 }) =>
  (items >= highItems || cats >= highCats) ? 'HIGH' : 'MEDIUM';

/** Expand canonical menu into flat rows {item, category, price, optionName} per option occurrence. */
function optionRows(menu) {
  const rows = [];
  for (const item of menu.items) {
    if (item.archived) continue;
    for (const gid of item.modifierGroups || []) {
      const group = menu.modifierGroups.find(g => g.id === gid);
      if (!group) continue;
      for (const opt of group.options || []) {
        rows.push({
          item: item.name,
          itemId: item.id,
          category: item.category || 'Uncategorized',
          price: item.price || 0,
          optionName: opt.name,
          optionNameNorm: M.normName(opt.name),
          groupId: group.id,
          groupName: group.name,
        });
      }
    }
  }
  return rows;
}

/**
 * 1:1 port of scan_modifier_crosscontamination() — modifier name appearing
 * on more than one item category (the "pepperoni problem").
 */
function modifierCrossContamination(menu) {
  const rows = optionRows(menu);
  const cats = new Map();      // optionNameNorm -> Set(category)
  const perOpt = new Map();     // optionNameNorm -> rows
  for (const r of rows) {
    if (!r.optionName) continue;
    if (!cats.has(r.optionNameNorm)) cats.set(r.optionNameNorm, new Set());
    cats.get(r.optionNameNorm).add(r.category);
    if (!perOpt.has(r.optionNameNorm)) perOpt.set(r.optionNameNorm, []);
    perOpt.get(r.optionNameNorm).push(r);
  }
  const violations = [];
  for (const [nameNorm, catSet] of cats) {
    if (catSet.size > 1) {
      const affected = perOpt.get(nameNorm);
      const display = affected[0].optionName;
      violations.push({
        type: 'MODIFIER_CROSS_CONTAMINATION',
        modifier: display,
        severity: affected.length > 5 ? 'HIGH' : 'MEDIUM',
        categories_affected: [...catSet].sort(),
        category_count: catSet.size,
        items_affected: affected.map(r => ({ item: r.item, category: r.category })),
        item_count: affected.length,
        '86_risk': `Disabling '${display}' would affect ${affected.length} items across ${catSet.size} categories`,
        recommendation: `Create separate '${display}' modifier for each category. Set Is Shared = false on each.`,
      });
    }
  }
  violations.sort((a, b) => (a.severity === 'HIGH' ? 0 : 1) - (b.severity === 'HIGH' ? 0 : 1) || b.item_count - a.item_count);
  return violations;
}

/** Port of scan_redundant_modifiers() (threshold >10) — same-name repetition. */
function redundantModifiers(menu, threshold = 10) {
  const rows = optionRows(menu);
  const count = new Map();
  for (const r of rows) count.set(r.optionNameNorm, (count.get(r.optionNameNorm) || 0) + 1);
  const out = [];
  for (const [nameNorm, c] of count) {
    if (c > threshold) {
      const display = rows.find(r => r.optionNameNorm === nameNorm).optionName;
      out.push({
        type: 'REDUNDANT_MODIFIER',
        modifier: display,
        occurrence_count: c,
        recommendation: `'${display}' appears ${c} times. Consider whether a proper modifier group would reduce maintenance burden.`,
      });
    }
  }
  out.sort((a, b) => b.occurrence_count - a.occurrence_count);
  return out;
}

/** Port of check_modifier_redundancy() (threshold >5, HIGH >15). */
function modifierMaintenanceRisk(menu, threshold = 5) {
  const rows = optionRows(menu);
  const byName = new Map();
  for (const r of rows) {
    if (!byName.has(r.optionNameNorm)) byName.set(r.optionNameNorm, []);
    byName.get(r.optionNameNorm).push(r);
  }
  const out = [];
  for (const [, entries] of byName) {
    const c = entries.length;
    if (c > threshold) {
      const display = entries[0].optionName;
      out.push({
        type: 'REDUNDANT_MODIFIER',
        name: display,
        occurrence_count: c,
        severity: c > 15 ? 'HIGH' : 'MEDIUM',
        appears_on: [...new Set(entries.map(e => e.item))].slice(0, 10),
        maintenance_risk: `If '${display}' needs a price change, it must be updated ${c} times manually. One missed update creates pricing inconsistency.`,
        recommendation: `Create one '${display}' modifier group and assign it to relevant items. Reduce to 1 entry.`,
      });
    }
  }
  out.sort((a, b) => (a.severity === 'HIGH' ? 0 : 1) - (b.severity === 'HIGH' ? 0 : 1) || b.occurrence_count - a.occurrence_count);
  return out;
}

/** Port of check_item_name_duplicates(). */
function duplicateItemNames(menu) {
  const byName = new Map();
  for (const it of menu.items) {
    if (it.archived) continue;
    const k = M.normName(it.name);
    if (!k) continue;
    if (!byName.has(k)) byName.set(k, []);
    byName.get(k).push({ name: it.name, category: it.category || 'Uncategorized', id: it.id });
  }
  const out = [];
  for (const [name, entries] of byName) {
    if (entries.length > 1) {
      out.push({
        type: 'DUPLICATE_ITEM_NAME',
        name,
        occurrences: entries,
        count: entries.length,
        recommendation: 'Verify these are intentional (e.g., same item in different categories) or consolidate.',
      });
    }
  }
  return out;
}

/**
 * Port of check_midnight_violations() extended to schedules[] and pricingRules[].
 * (Python read item.time_ranges; canonical model stores menu-level schedules,
 *  legacy items may still carry time_ranges.)
 */
function midnightViolations(menu) {
  const out = [];
  const check = (label, range, owner) => {
    const s = M.parseTime(range.start != null ? range.start : range.startMin);
    const e = M.parseTime(range.end != null ? range.end : range.endMin);
    if (s == null || e == null) return;
    if (e < s) {
      out.push({
        type: 'MIDNIGHT_RULE_VIOLATION',
        item: label, owner,
        range: `${M.fmtTime(s)} – ${M.fmtTime(e)}`,
        severity: 'HIGH',
        explanation: 'End time is earlier than start time. This range crosses midnight and must be split into two entries.',
        fix: `Split into: [${M.fmtTime(s)} – 11:59 PM] and [12:00 AM – ${M.fmtTime(e)}] on the next calendar day.`,
      });
    } else if (e === 0 && s > 12 * 60) {
      out.push({
        type: 'MIDNIGHT_RULE_VIOLATION',
        item: label, owner,
        range: `${M.fmtTime(s)} – 12:00 AM`,
        severity: 'MEDIUM',
        explanation: 'End time of 12:00 AM with a start after noon usually means the rule was meant to run PAST midnight.',
        fix: `End at 11:59 PM or split into two entries.`,
      });
    }
  };
  for (const sch of menu.schedules || []) {
    check(`${sch.name || sch.id}`, { start: sch.startMin, end: sch.endMin }, 'schedule');
  }
  for (const rule of menu.pricingRules || []) {
    for (const tr of (rule.scope && rule.scope.timeRanges) || []) {
      check(rule.name || rule.id, tr, 'pricingRule');
    }
  }
  for (const it of menu.items || []) {
    for (const tr of it.time_ranges || []) check(it.name, tr, 'item');
  }
  return out;
}

/** Port of calculate_cascade_risk() from 86-risk-report.py. */
function cascadeRisk86(menu) {
  const rows = optionRows(menu);
  const impact = new Map(); // optionNameNorm -> {display, items:[], cats:Set, exposure}
  for (const r of rows) {
    if (!impact.has(r.optionNameNorm)) {
      impact.set(r.optionNameNorm, { display: r.optionName, items: [], cats: new Set(), exposure: 0 });
    }
    const rec = impact.get(r.optionNameNorm);
    rec.items.push({ item: r.item, category: r.category, price: r.price });
    rec.cats.add(r.category);
    rec.exposure += r.price || 0;
  }
  const out = [];
  for (const [, rec] of impact) {
    const itemCount = rec.items.length;
    const catCount = rec.cats.size;
    if (itemCount > 1) {
      out.push({
        type: 'EIGHTY_SIX_CASCADE_RISK',
        modifier: rec.display,
        items_that_would_be_affected: itemCount,
        categories_affected: [...rec.cats].sort(),
        category_count: catCount,
        estimated_revenue_exposure_cents: Math.round(rec.exposure),
        affected_items: rec.items,
        severity: severity(itemCount, catCount, { highItems: 5, highCats: 2 }),
        recommendation:
          `Do NOT 86 '${rec.display}' in the system. ` +
          `Contact affected customers directly. If supply is limited, update item descriptions to note availability.`,
      });
    }
  }
  out.sort((a, b) => (a.severity === 'HIGH' ? 0 : 1) - (b.severity === 'HIGH' ? 0 : 1) || b.items_that_would_be_affected - a.items_that_would_be_affected);
  return out;
}

const SHARED_OK = /(size|prep|temperature|doneness|ice|milk)/i;
/**
 * Record-level isolation audit (canonical model). A modifier GROUP (record) that
 * spans more than one item category violates the isolation rule unless it is an
 * explicitly-shared group of an allowed kind (Size / Prep / Temperature — KB
 * modifier-architecture §shared-modifiers). This is the model-aware upgrade of
 * the name-based pepperoni scan and is what publish-blocking checks use.
 */
function isolationViolations(menu) {
  const A = require('./menu');
  const out = [];
  for (const g of menu.modifierGroups || []) {
    if (!g.options || !g.options.length) continue;
    const cats = new Set();
    let count = 0;
    for (const it of menu.items) {
      if (it.archived) continue;
      if ((it.modifierGroups || []).includes(g.id)) { cats.add(it.category || 'Uncategorized'); count++; }
    }
    if (cats.size > 1 && !(g.shared && SHARED_OK.test(g.name))) {
      out.push({
        type: 'MODIFIER_RECORD_SPANS_CATEGORIES',
        group: g.name,
        severity: g.shared ? 'HIGH' : 'MEDIUM',
        categories_affected: [...cats].sort(),
        category_count: cats.size,
        item_count: count,
        explanation: `Modifier record "${g.name}" is attached across ${cats.size} categories${g.shared ? ' and marked Shared' : ''}; disabling it cascades.`,
        recommendation: `Split "${g.name}" per category (menu.modifier.isolate) and keep Is Shared off unless it is a Size/Prep/Temperature group.`,
      });
    }
  }
  return out;
}

/** Do two force-price rules' effective windows intersect? Missing/any window = always on. */
function rangesIntersect(a, b) {
  const win = (r) => {
    const trs = r.scope && r.scope.timeRanges;
    if (!trs || !trs.length) return [{ start: 0, end: 24 * 60 - 1, day: 'any' }];
    return trs.map(t => ({ start: M.parseTime(t.startMin != null ? t.startMin : t.start), end: M.parseTime(t.endMin != null ? t.endMin : t.end) }));
  };
  const daysA = a.scope && a.scope.days ? new Set(a.scope.days.map(Number)) : null;
  const daysB = b.scope && b.scope.days ? new Set(b.scope.days.map(Number)) : null;
  if (daysA && daysB && ![...daysA].some(d => daysB.has(d))) return false;
  for (const wa of win(a)) for (const wb of win(b)) {
    if (wa.start == null || wa.end == null || wb.start == null || wb.end == null) return true;
    if (wa.start <= wb.end && wb.start <= wa.end) return true;
  }
  return false;
}

/** Pricing-rule audit per heartland.kb.pricing-rules (Nemotron/Ruffo instructions). */
function pricingRuleConflicts(menu) {
  const out = [];
  const enabled = (menu.pricingRules || []).filter(r => r.enabled !== false);
  // two force-price rules that can match the same item in the same window
  const byItem = new Map();
  for (const rule of enabled) {
    const targets = rule.appliesTo && rule.appliesTo.items
      ? rule.appliesTo.items
      : rule.appliesTo && rule.appliesTo.categories
        ? menu.items.filter(i => rule.appliesTo.categories.includes(i.category)).map(i => i.id)
        : menu.items.map(i => i.id);
    for (const t of targets) {
      if (!byItem.has(t)) byItem.set(t, []);
      byItem.get(t).push(rule);
    }
  }
  for (const [itemId, rules] of byItem) {
    const item = menu.items.find(i => i.id === itemId);
    if (!item) continue;
    if (rules.length > 3) {
      out.push({
        type: 'PRICING_RULE_STACK_DEEP',
        item: item.name,
        severity: 'MEDIUM',
        rule_count: rules.length,
        rules: rules.map(r => r.name),
        explanation: 'More than 3 overlapping pricing rules on one item — first-match-wins makes the stack fragile.',
        recommendation: 'Collapse the stack; keep most-specific rules above general ones (KB pricing-rules §priority).',
      });
    }
    const forces = rules.filter(r => r.type === 'force');
    const overlapping = [];
    for (const r of forces) {
      if (!overlapping.length || overlapping.some(o => rangesIntersect(o, r))) overlapping.push(r);
    }
    if (overlapping.length > 1) {
      const losers = overlapping.slice(1);
      for (const loser of losers) {
        out.push({
          type: 'DEAD_FORCE_PRICE_RULE',
          item: item.name,
          severity: 'HIGH',
          dead_rule: loser.name,
          shadowed_by: forces[0].name,
          explanation: `Two Force Price rules can match '${item.name}'; only the first fires — '${loser.name}' is dead config.`,
          recommendation: `Disable or rescope '${loser.name}', then re-sort the stack by specificity.`,
      });
      }
    }
    for (const r of rules) {
      if (r.type === 'percent' && r.value < 0 && r.postTax === true) {
        out.push({
          type: 'DISCOUNT_POSTTAX_SUSPECT',
          item: item.name, rule: r.name, severity: 'MEDIUM',
          explanation: 'Discount rules should typically be ApplyPostTax=false (reduces taxable amount).',
          recommendation: `Confirm '${r.name}' post-tax flag with the owner before the next publish.`,
        });
      }
    }
  }
  return out;
}

/** Toast-documented rule: empty modifier groups break third-party sync/visibility. */
function emptyModifierGroups(menu) {
  const out = [];
  for (const g of menu.modifierGroups || []) {
    if (!g.options || g.options.length === 0) {
      out.push({
        type: 'EMPTY_MODIFIER_GROUP',
        group: g.name, severity: 'HIGH',
        explanation: "Empty modifier groups cause synchronization errors with third-party integrations and can affect visibility of entire menus.",
        recommendation: `Add options to '${g.name}' or delete the group entirely (Toast §empty-group).`,
      });
    }
  }
  return out;
}

/** Coursing audit per heartland.kb.coursing (Nemotron instruction). */
function coursingIssues(menu) {
  const out = [];
  const entreeish = /pizza|pasta|steak|chicken|entree|calzone|stromboli|salad|appetizer|wings/i;
  for (const it of menu.items || []) {
    if (it.archived) continue;
    const cat = (it.category || '');
    if ((it.course === 0 || it.course == null) && entreeish.test(cat)) {
      out.push({
        type: 'COURSE_UNASSIGNED',
        item: it.name, severity: 'LOW',
        explanation: `'${it.name}' is in a full-service category but sits at Course 0 (unassigned).`,
        recommendation: 'Set explicit course numbers (apps=1, entrees=2, desserts=3) for dine-in flow.',
      });
    }
    if (it.rush && it.hold) {
      out.push({
        type: 'RUSH_HOLD_CONFLICT',
        item: it.name, severity: 'HIGH',
        explanation: 'Rush and Hold are both set — contradictory kitchen routing.',
        recommendation: 'Keep one flag. Rush fires immediately and bypasses Hold; do not use Rush as a course substitute.',
      });
    }
  }
  return out;
}

/** Isolation check (post-fix verifier): does `modifierName` still touch >1 category? */
function isolationCheck(menu, modifierName) {
  // Record-level: does any SINGLE modifier record containing the named option
  // span more than one category? (Post-isolation, per-category records each
  // hold the option — that is the KB-correct end state, not a name collision.)
  const A = require('./menu');
  const target = A.normName(modifierName);
  const spans = [];
  for (const g of menu.modifierGroups || []) {
    if (!(g.options || []).some(o => A.normName(o.name) === target)) continue;
    const cats = new Set();
    for (const it of menu.items) {
      if (it.archived) continue;
      if ((it.modifierGroups || []).includes(g.id)) cats.add(it.category || 'Uncategorized');
    }
    if (cats.size > 1 && !(g.shared && SHARED_OK.test(g.name))) spans.push({ group: g.name, categories: [...cats].sort(), shared: !!g.shared });
  }
  return { isolated: spans.length === 0, violation: spans.length ? spans[0] : null };
}

/** Aggregate: the full client audit (equivalent of running all three python scripts + extended checks). */
function fullAudit(menu) {
  const cross = modifierCrossContamination(menu);
  const iso = isolationViolations(menu);
  const maint = modifierMaintenanceRisk(menu);
  const dups = duplicateItemNames(menu);
  const midnight = midnightViolations(menu);
  const cascade = cascadeRisk86(menu);
  const pricing = pricingRuleConflicts(menu);
  const empties = emptyModifierGroups(menu);
  const coursing = coursingIssues(menu);
  const redundancy10 = redundantModifiers(menu);

  const sections = [
    { key: 'cross_contamination', title: 'Modifier Cross-Contamination (the pepperoni problem — name scan)', findings: cross },
    { key: 'isolation', title: 'Isolation Rule (per-record spans; blocks publish at HIGH)', findings: iso },
    { key: 'maintenance_redundancy', title: 'Redundant Modifier Maintenance Risk', findings: maint },
    { key: 'duplicate_items', title: 'Duplicate Item Names', findings: dups },
    { key: 'midnight_rule', title: 'Midnight Rule Violations (silent failures)', findings: midnight },
    { key: 'eighty_six_cascade', title: '86 Cascade Risk', findings: cascade.filter(f => f.severity === 'HIGH' || f.severity === 'MEDIUM') },
    { key: 'pricing_conflicts', title: 'Pricing Rule Conflicts', findings: pricing },
    { key: 'empty_groups', title: 'Empty Modifier Groups (sync-breakers)', findings: empties },
    { key: 'coursing', title: 'Coursing Issues', findings: coursing },
  ];
  const all = sections.flatMap(s => s.findings.map(f => ({ ...f, section: s.title })));
  const counts = { HIGH: 0, MEDIUM: 0, LOW: 0 };
  for (const f of all) { counts[f.severity || 'LOW'] = (counts[f.severity || 'LOW'] || 0) + 1; }

  return {
    report_type: 'MenuFlow Full Menu Audit',
    system: 'canonical (portable across platforms)',
    generated_by: 'Signal F Holdings LLC — menuflow-pos audit engine (parity: heartland-pos audit scripts)',
    scanned: { total_items: menu.items.length, categories: menu.categories.length, modifier_groups: menu.modifierGroups.length },
    summary: {
      total_findings: all.length,
      high: counts.HIGH, medium: counts.MEDIUM, low: counts.LOW,
      action_required: (counts.HIGH + counts.MEDIUM) > 0,
      isolation_violations: iso.length,
    },
    protocol: 'Audit before action. Present this report to the client, obtain written approval, then shadow-build; never modify the live system directly.',
    sections,
    legacy_redundancy_gt10: redundancy10,
  };
}

/** Render audit as client-facing markdown (audit/report-template.md style). */
function renderAuditMarkdown(report) {
  const L = [];
  L.push('# Menu Audit Report');
  L.push('');
  L.push(`*Generated ${new Date().toISOString()} — MenuFlow POS audit engine (Signal F Holdings)*`);
  L.push('');
  L.push(`**Items scanned:** ${report.scanned.total_items} · **Findings:** ${report.summary.total_findings} ` +
    `(HIGH ${report.summary.high} / MEDIUM ${report.summary.medium} / LOW ${report.summary.low})`);
  L.push('');
  L.push(`> ${report.protocol}`);
  L.push('');
  for (const s of report.sections) {
    L.push(`## ${s.title}`);
    L.push('');
    if (!s.findings.length) { L.push('_No findings._'); L.push(''); continue; }
    for (const f of s.findings) {
      L.push(`- **[${f.severity}]** ${f['86_risk'] || f.explanation || f.maintenance_risk || ''}`.trim());
      const who = f.modifier || f.item || f.group || f.name || '';
      if (who) L.push(`  - Subject: \`${who}\`${f.categories_affected ? ` across [${f.categories_affected.join(', ')}]` : ''}${f.item_count ? ` — ${f.item_count} items` : ''}`);
      if (f.recommendation) L.push(`  - Fix: ${f.recommendation}`);
      if (f.fix) L.push(`  - Fix: ${f.fix}`);
    }
    L.push('');
  }
  L.push('## Next Steps');
  L.push('1. Present this report to the owner; obtain written approval (audit/report-template.md).');
  L.push('2. Scope: targeted fixes vs full rebuild.');
  L.push('3. Shadow build v2 channels; verify every channel; owner controls cutover.');
  return L.join('\n');
}

module.exports = {
  optionRows, modifierCrossContamination, isolationViolations, redundantModifiers, modifierMaintenanceRisk,
  duplicateItemNames, midnightViolations, cascadeRisk86, pricingRuleConflicts,
  emptyModifierGroups, coursingIssues, isolationCheck, fullAudit, renderAuditMarkdown,
};

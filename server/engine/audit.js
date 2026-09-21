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

/**
 * 1. Price Collisions: Identical base prices on items with disparate underlying food costs.
 */
function priceCollisions(menu) {
  const out = [];
  const activeItems = (menu.items || []).filter(i => !i.archived);

  const getCostTier = (item) => {
    const text = `${item.name} ${item.description || ''}`.toLowerCase();
    if (/steak|ribeye|tenderloin|filet|salmon|seafood|shrimp|meat lovers|bbq chicken|buffalo chicken|prosciutto|veal|lamb/i.test(text)) {
      return { tier: 3, label: 'Premium Protein Tier', score: 3 };
    }
    if (/chicken|sausage|pepperoni|meatball|ham|bacon|pork|beef|calzone|stromboli/i.test(text)) {
      return { tier: 2, label: 'Standard Protein Tier', score: 2 };
    }
    return { tier: 1, label: 'Base / Vegetarian Tier', score: 1 };
  };

  const byPrice = new Map();
  for (const item of activeItems) {
    if (item.price == null || item.price === 0) continue;
    if (!byPrice.has(item.price)) byPrice.set(item.price, []);
    byPrice.get(item.price).push(item);
  }

  for (const [price, items] of byPrice) {
    if (items.length < 2) continue;
    // Pairwise comparison to find disparate food-cost items with identical price
    const seenHigher = new Set();
    for (let i = 0; i < items.length; i++) {
      for (let j = i + 1; j < items.length; j++) {
        const a = items[i], b = items[j];
        const costA = getCostTier(a), costB = getCostTier(b);
        const diff = Math.abs(costA.score - costB.score);
        if (diff >= 1) {
          const higher = costA.score > costB.score ? a : b;
          const lower = costA.score > costB.score ? b : a;
          const higherTier = costA.score > costB.score ? costA : costB;
          const lowerTier = costA.score > costB.score ? costB : costA;

          if (seenHigher.has(higher.id)) continue;
          seenHigher.add(higher.id);

          const recommendedPrice = price + (diff * 150);
          out.push({
            type: 'PRICE_COLLISION',
            severity: diff >= 2 ? 'CRITICAL' : 'HIGH',
            item: higher.name,
            itemId: higher.id,
            colliding_with: lower.name,
            collidingItemId: lower.id,
            category: higher.category,
            price,
            recommended_price: recommendedPrice,
            margin_bleed_cents: diff * 150,
            margin_leak: `$${((diff * 150) / 100).toFixed(2)} unit margin compression`,
            cost_differential: `${higher.name} (${higherTier.label}) vs ${lower.name} (${lowerTier.label})`,
            explanation: `Identical base price ($${(price / 100).toFixed(2)}) for items with disparate underlying food costs: '${higher.name}' incurs higher protein/recipe costs than '${lower.name}', compressing gross margin.`,
            recommendation: `Increase '${higher.name}' to $${(recommendedPrice / 100).toFixed(2)} to maintain margin target parity.`,
            patch: {
              action: 'set_item_price',
              itemId: higher.id,
              itemName: higher.name,
              currentPrice: price,
              recommendedPrice,
              value: recommendedPrice,
              summary: `Increase '${higher.name}' price from $${(price / 100).toFixed(2)} → $${(recommendedPrice / 100).toFixed(2)}`
            }
          });
        }
      }
    }
  }
  return out;
}

/**
 * 2. Side-Car Reconstruction: Adding modifiers/sides reconstructs a signature or standalone item for less than the menu price.
 */
function sideCarReconstruction(menu) {
  const out = [];
  const activeItems = (menu.items || []).filter(i => !i.archived);
  const groups = menu.modifierGroups || [];
  const groupsMap = new Map(groups.map(g => [g.id, g]));

  // Check A: Standalone menu items available as discounted side-car modifiers
  for (const item of activeItems) {
    const itemNameNorm = M.normName(item.name);
    for (const group of groups) {
      for (const opt of group.options || []) {
        const optNameNorm = M.normName(opt.name);
        const matches = optNameNorm === itemNameNorm ||
          (optNameNorm.includes('knot') && itemNameNorm.includes('knot')) ||
          (optNameNorm.includes('wing') && itemNameNorm.includes('wing')) ||
          (optNameNorm.includes('salad') && itemNameNorm.includes('salad'));

        if (matches) {
          const sidePrice = Math.max(0, opt.priceDelta || 0);
          const effectiveSidePrice = group.included > 0 ? 0 : sidePrice;
          if (item.price > effectiveSidePrice) {
            const marginLeak = item.price - effectiveSidePrice;
            if (marginLeak >= 150) {
              const recommendedDelta = item.price;
              out.push({
                type: 'SIDE_CAR_RECONSTRUCTION',
                severity: marginLeak >= 250 ? 'CRITICAL' : 'HIGH',
                item: item.name,
                itemId: item.id,
                group: group.name,
                groupId: group.id,
                option: opt.name,
                optionId: opt.id,
                menu_price: item.price,
                reconstructed_price: effectiveSidePrice,
                margin_bleed_cents: marginLeak,
                margin_leak: `$${(marginLeak / 100).toFixed(2)} leak per side-car order`,
                explanation: `'${opt.name}' is available in modifier group '${group.name}' for $${(effectiveSidePrice / 100).toFixed(2)}${group.included > 0 ? ' (included free)' : ''}, while standalone menu item '${item.name}' is priced at $${(item.price / 100).toFixed(2)}. Guests can reconstruct the full dish as a side-car for a substantial discount.`,
                recommendation: `Align '${opt.name}' price delta in '${group.name}' to +$${(recommendedDelta / 100).toFixed(2)} to eliminate side-car arbitrage.`,
                patch: {
                  action: 'adjust_modifier_delta',
                  groupId: group.id,
                  groupName: group.name,
                  optionId: opt.id,
                  optionName: opt.name,
                  currentDelta: opt.priceDelta || 0,
                  recommendedDelta,
                  value: recommendedDelta,
                  summary: `Set '${opt.name}' in group '${group.name}' delta to +$${(recommendedDelta / 100).toFixed(2)}`
                }
              });
            }
          }
        }
      }
    }
  }

  // Check B: Base Item + Modifier Reconstructing Signature Item for less than menu price
  for (const baseItem of activeItems) {
    for (const gid of baseItem.modifierGroups || []) {
      const g = groupsMap.get(gid);
      if (!g) continue;
      for (const opt of g.options || []) {
        const optNorm = M.normName(opt.name);
        for (const sigItem of activeItems) {
          if (sigItem.id === baseItem.id) continue;
          const sigNorm = M.normName(sigItem.name);
          const isReconstruction = sigNorm.includes(optNorm) &&
            (sigNorm.includes(M.normName(baseItem.category)) ||
             baseItem.name.split(' ').some(w => w.length > 3 && sigNorm.includes(M.normName(w))));

          if (isReconstruction) {
            const reconstructedPrice = baseItem.price + (opt.priceDelta || 0);
            if (reconstructedPrice < sigItem.price) {
              const leak = sigItem.price - reconstructedPrice;
              if (leak >= 100) {
                const neededDelta = sigItem.price - baseItem.price;
                out.push({
                  type: 'SIDE_CAR_RECONSTRUCTION',
                  severity: leak >= 250 ? 'CRITICAL' : 'HIGH',
                  signature_item: sigItem.name,
                  signatureItemId: sigItem.id,
                  base_item: baseItem.name,
                  baseItemId: baseItem.id,
                  modifier: opt.name,
                  group: g.name,
                  groupId: g.id,
                  optionId: opt.id,
                  menu_price: sigItem.price,
                  reconstructed_price: reconstructedPrice,
                  margin_bleed_cents: leak,
                  margin_leak: `$${(leak / 100).toFixed(2)} discount loophole`,
                  explanation: `Adding '${opt.name}' (+$${((opt.priceDelta || 0) / 100).toFixed(2)}) to '${baseItem.name}' ($${(baseItem.price / 100).toFixed(2)}) reconstructs signature '${sigItem.name}' for $${(reconstructedPrice / 100).toFixed(2)}, which is $${(leak / 100).toFixed(2)} cheaper than menu price ($${(sigItem.price / 100).toFixed(2)}).`,
                  recommendation: `Increase '${opt.name}' modifier delta to +$${(neededDelta / 100).toFixed(2)} on '${baseItem.name}'.`,
                  patch: {
                    action: 'adjust_modifier_delta',
                    groupId: g.id,
                    groupName: g.name,
                    optionId: opt.id,
                    optionName: opt.name,
                    currentDelta: opt.priceDelta || 0,
                    recommendedDelta: neededDelta,
                    value: neededDelta,
                    summary: `Increase '${opt.name}' delta in '${g.name}' to +$${(neededDelta / 100).toFixed(2)}`
                  }
                });
              }
            }
          }
        }
      }
    }
  }

  return out;
}

/**
 * 3. Unrestricted Protein / Premium Modifier Swaps: Unconstrained or free substitutions causing margin bleed.
 */
function unrestrictedProteinSwaps(menu) {
  const out = [];
  const groups = menu.modifierGroups || [];
  const premiumProteinRegex = /grilled chicken|chicken|steak|ribeye|shrimp|salmon|bacon|prosciutto|sausage|meatball/i;

  for (const g of groups) {
    const isProteinGroup = /protein|meat|topping|extra/i.test(g.name);

    // Free included choices on high-cost protein options
    if (g.included > 0) {
      for (const opt of g.options || []) {
        if (premiumProteinRegex.test(opt.name)) {
          const bleed = opt.priceDelta > 0 ? opt.priceDelta : 300;
          out.push({
            type: 'UNRESTRICTED_PROTEIN_SWAP',
            severity: 'CRITICAL',
            group: g.name,
            groupId: g.id,
            option: opt.name,
            optionId: opt.id,
            margin_bleed_cents: bleed,
            margin_leak: `$${(bleed / 100).toFixed(2)} free protein bleed`,
            explanation: `Modifier group '${g.name}' allows ${g.included} free included choice(s) without excluding high-cost protein '${opt.name}'. Guests can swap or select premium proteins with zero incremental margin coverage.`,
            recommendation: `Set included=0 on '${g.name}' or mandate an upcharge of +$${(bleed / 100).toFixed(2)} for '${opt.name}'.`,
            patch: {
              action: 'set_group_included',
              groupId: g.id,
              groupName: g.name,
              currentIncluded: g.included,
              recommendedIncluded: 0,
              value: 0,
              summary: `Set included=0 on '${g.name}' to close free protein swap loophole`
            }
          });
        }
      }
    }

    // Protein group with zero price delta on premium proteins
    if (isProteinGroup) {
      for (const opt of g.options || []) {
        if (premiumProteinRegex.test(opt.name) && (opt.priceDelta == null || opt.priceDelta === 0)) {
          out.push({
            type: 'UNRESTRICTED_PROTEIN_SWAP',
            severity: 'HIGH',
            group: g.name,
            groupId: g.id,
            option: opt.name,
            optionId: opt.id,
            margin_bleed_cents: 300,
            margin_leak: '$3.00 uncharged margin bleed',
            explanation: `Premium protein '${opt.name}' in group '${g.name}' has a $0.00 price delta. Unrestricted additions/swaps cause direct food cost bleed.`,
            recommendation: `Establish a minimum surcharge of +$3.00 for '${opt.name}' in '${g.name}'.`,
            patch: {
              action: 'adjust_modifier_delta',
              groupId: g.id,
              groupName: g.name,
              optionId: opt.id,
              optionName: opt.name,
              currentDelta: 0,
              recommendedDelta: 300,
              value: 300,
              summary: `Set '${opt.name}' price delta to +$3.00 in '${g.name}'`
            }
          });
        }
      }
    }

    // Excessive / unbounded protein choices
    if (isProteinGroup && (g.maxChoices === 0 || g.maxChoices > 4)) {
      const hasPremium = (g.options || []).some(o => premiumProteinRegex.test(o.name));
      if (hasPremium) {
        out.push({
          type: 'UNRESTRICTED_PROTEIN_SWAP',
          severity: 'MEDIUM',
          group: g.name,
          groupId: g.id,
          margin_bleed_cents: 200,
          margin_leak: 'Unbounded portion leakage',
          explanation: `Modifier group '${g.name}' has unconstrained maxChoices (${g.maxChoices === 0 ? 'unlimited' : g.maxChoices}) on high-cost proteins, exposing orders to ingredient stacking without portion caps.`,
          recommendation: `Cap maxChoices to 2 or 3 to enforce portion control and kitchen pacing.`,
          patch: {
            action: 'set_group_max_choices',
            groupId: g.id,
            groupName: g.name,
            currentMaxChoices: g.maxChoices,
            recommendedMaxChoices: 2,
            value: 2,
            summary: `Cap maxChoices on '${g.name}' to 2`
          }
        });
      }
    }
  }

  return out;
}

/**
 * 4. Compute Menu Integrity Score (1–100 radial score dial).
 * Red for < 60, Amber for 60–84, Green for 85–100.
 */
function computeMenuIntegrity(menu, allFindings) {
  let score = 100;
  for (const f of allFindings) {
    if (f.severity === 'CRITICAL') score -= 12;
    else if (f.severity === 'HIGH') score -= 6;
    else if (f.severity === 'MEDIUM') score -= 2;
    else if (f.severity === 'LOW') score -= 1;
  }
  score = Math.max(1, Math.min(100, Math.round(score)));

  const rating = score < 60 ? 'CRITICAL' : score < 85 ? 'AMBER' : 'GREEN';
  const color = score < 60 ? '#ff5c5c' : score < 85 ? '#ffb454' : '#41e0a0';
  const label = score < 60
    ? 'Critical Vulnerabilities'
    : score < 85
      ? 'Moderate Integrity'
      : 'Optimal Integrity';

  return {
    score,
    rating,
    color,
    label,
  };
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

  const pCollisions = priceCollisions(menu);
  const sideCar = sideCarReconstruction(menu);
  const proteinSwaps = unrestrictedProteinSwaps(menu);
  const detectedVulns = [...pCollisions, ...sideCar, ...proteinSwaps];

  const sections = [
    { key: 'vulnerabilities_margin_leaks', title: 'Active Margin Leaks & Rule Vulnerabilities (Collisions, Side-Car, Protein Swaps)', findings: detectedVulns },
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
  const counts = { CRITICAL: 0, HIGH: 0, MEDIUM: 0, LOW: 0 };
  for (const f of all) { counts[f.severity || 'LOW'] = (counts[f.severity || 'LOW'] || 0) + 1; }

  const integrity = computeMenuIntegrity(menu, all);

  const critVulns = detectedVulns.filter(v => v.severity === 'CRITICAL');
  const highVulns = detectedVulns.filter(v => v.severity === 'HIGH');
  const medVulns = detectedVulns.filter(v => v.severity === 'MEDIUM');

  const vulnerabilities = {
    critical: critVulns,
    high: highVulns,
    medium: medVulns,
    total: detectedVulns.length,
    items: detectedVulns,
  };

  return {
    report_type: 'MenuFlow Full Menu Audit',
    system: 'canonical (portable across platforms)',
    generated_by: 'Signal F Holdings LLC — menuflow-pos audit engine (parity: heartland-pos audit scripts)',
    scanned: { total_items: menu.items.length, categories: menu.categories.length, modifier_groups: menu.modifierGroups.length },
    summary: {
      total_findings: all.length,
      critical: counts.CRITICAL,
      high: counts.HIGH,
      medium: counts.MEDIUM,
      low: counts.LOW,
      integrity_score: integrity.score,
      integrity_rating: integrity.rating,
      vulnerabilities_count: detectedVulns.length,
      action_required: (counts.HIGH + counts.MEDIUM + counts.CRITICAL) > 0,
      isolation_violations: iso.length,
    },
    integrity_score: integrity,
    vulnerabilities,
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
  if (report.integrity_score) {
    L.push(`## Menu Integrity Score: ${report.integrity_score.score}/100 [${report.integrity_score.rating}]`);
    L.push(`- **Integrity Status:** ${report.integrity_score.label}`);
    if (report.vulnerabilities) {
      L.push(`- **Active Margin Leaks:** ${report.vulnerabilities.total} detected (CRITICAL ${report.vulnerabilities.critical.length} / HIGH ${report.vulnerabilities.high.length} / MEDIUM ${report.vulnerabilities.medium.length})`);
    }
    L.push('');
  }
  L.push(`**Items scanned:** ${report.scanned.total_items} · **Total Findings:** ${report.summary.total_findings} ` +
    `(CRITICAL ${report.summary.critical || 0} / HIGH ${report.summary.high} / MEDIUM ${report.summary.medium} / LOW ${report.summary.low})`);
  L.push('');
  L.push(`> ${report.protocol}`);
  L.push('');

  if (report.vulnerabilities && report.vulnerabilities.items && report.vulnerabilities.items.length) {
    L.push('## Active Margin Leaks & Detected Vulnerabilities');
    L.push('');
    for (const v of report.vulnerabilities.items) {
      L.push(`### [${v.severity}] ${v.type.replace(/_/g, ' ')} — ${v.item || v.signature_item || v.group || ''}`);
      if (v.margin_leak) L.push(`- **Margin Bleed Impact:** ${v.margin_leak}`);
      L.push(`- **Issue:** ${v.explanation}`);
      L.push(`- **Recommendation:** ${v.recommendation}`);
      if (v.patch) {
        L.push(`- **Recommended Patch:** ${v.patch.summary || JSON.stringify(v.patch)}`);
      }
      L.push('');
    }
  }

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
  priceCollisions, sideCarReconstruction, unrestrictedProteinSwaps, computeMenuIntegrity,
};

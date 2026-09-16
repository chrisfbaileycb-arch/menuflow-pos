/**
 * menu.js — canonical menu model helpers shared by skills, audits and import/export.
 *
 * Canonical model (single source of truth across platforms):
 * Menu = {
 *   name, version, updatedAt,
 *   categories:     [{ id, name }],
 *   items:          [{ id, name, category, price (cents), description,
 *                      modifierGroups: [groupId],
 *                      channels: [channelName],            // visibility by name
 *                      course: int|null, rush: bool, hold: bool,
 *                      halfAndHalf: bool, misc: bool,
 *                      unavailable: {pos: bool, reason, until} | null,
 *                      stock: {count} | null,
 *                      taxRateId: string|null, archived: bool }],
 *   modifierGroups: [{ id, name, minChoices, maxChoices, included,
 *                      shared: bool, halfAndHalfAllowed: bool,
 *                      options: [{ id, name, priceDelta (cents), default: bool }],
 *                      itemScope: [itemId] | null }],      // null = attached via item.modifierGroups only
 *   pricingRules:   [{ id, name, type: force|dollar|percent|multiplier,
 *                      value, appliesTo: {items:[id]}|{categories:[name]}|{all:true},
 *                      scope: { days:[0-6], timeRanges:[{startMin,endMin}], channel, room },
 *                      postTax: bool, priority: int, enabled: bool }],
 *   schedules:      [{ id, name, days:[0-6], startMin, endMin, appliesTo:[itemId],
 *                      splitFrom: id|null }],              // splitFrom => post-midnight twin
 *   channels:       [{ name, status: live|shadow|retired }],
 *   taxRates:       [{ id, name, ratePct }]
 * }
 *
 * All money is integer cents. All times are minutes-from-midnight integers.
 */

const normName = (s) => String(s || '').trim().toLowerCase().replace(/\s+/g, ' ');
const titleCase = (s) => normName(s).replace(/(^|[\s/&'-])([a-z])/g, (m, p, c) => p + c.toUpperCase());

function findItem(menu, idOrName) {
  const byId = menu.items.find(i => i.id === idOrName);
  if (byId) return byId;
  const n = normName(idOrName);
  return menu.items.find(i => normName(i.name) === n) || null;
}

function findGroup(menu, idOrName) {
  const byId = menu.modifierGroups.find(g => g.id === idOrName);
  if (byId) return byId;
  const n = normName(idOrName);
  return menu.modifierGroups.find(g => normName(g.name) === n) || null;
}

function ensureCategory(menu, name) {
  let cat = menu.categories.find(c => normName(c.name) === normName(name));
  if (!cat) {
    cat = { id: `cat_${normName(name).replace(/[^a-z0-9]+/g, '_')}`, name: titleCase(name) };
    menu.categories.push(cat);
  }
  return cat;
}

function itemsOfGroup(menu, group) {
  return menu.items.filter(i => (i.modifierGroups || []).includes(group.id));
}

/** Categories (by name) that a modifier group currently touches. */
function groupCategories(menu, group) {
  const cats = new Set();
  for (const it of itemsOfGroup(menu, group)) cats.add(it.category || 'Uncategorized');
  return [...cats].sort();
}

/** Parse "9:00 PM", "21:00", "11:59 PM" -> minutes from midnight. Returns null on garbage. */
function parseTime(str) {
  if (str == null) return null;
  if (typeof str === 'number') return str;
  const s = String(str).trim().toUpperCase();
  let m = s.match(/^(\d{1,2}):(\d{2})\s*(AM|PM)?$/);
  if (!m) return null;
  let h = parseInt(m[1], 10);
  const min = parseInt(m[2], 10);
  if (m[3] === 'PM' && h !== 12) h += 12;
  if (m[3] === 'AM' && h === 12) h = 0;
  if (h > 23 || min > 59) return null;
  return h * 60 + min;
}

function fmtTime(mins) {
  let h = Math.floor(mins / 60) % 24;
  const m = mins % 60;
  const ap = h >= 12 ? 'PM' : 'AM';
  h = h % 12 || 12;
  return `${h}:${String(m).padStart(2, '0')} ${ap}`;
}

/**
 * Midnight Rule (heartland.kb.midnight-rule): a range with endMin <= startMin
 * crosses midnight and MUST be split. Returns {legal, pre, post} —
 * pre = [start, 1439], post = [0, end] assigned to the NEXT day.
 */
function splitMidnight(startMin, endMin) {
  if (endMin > startMin) return { legal: true, ranges: [{ startMin, endMin, dayOffset: 0 }] };
  return {
    legal: false,
    ranges: [
      { startMin, endMin: 24 * 60 - 1, dayOffset: 0, label: 'pre-midnight' },
      { startMin: 0, endMin, dayOffset: 1, label: 'post-midnight (next calendar day)' },
    ],
  };
}

function money(cents) {
  if (typeof cents === 'string') {
    const s = cents.replace(/[$,\s]/g, '');
    const n = Number(s);
    if (!isFinite(n)) return null;
    return Math.round(n * 100);
  }
  if (typeof cents === 'number') return Math.round(cents * (cents > 1000 ? 1 : 100));
  return null;
}

function displayMoney(cents) {
  return '$' + (cents / 100).toFixed(2);
}

function newMenu(name) {
  return {
    name: name || 'Untitled menu',
    version: 1,
    updatedAt: new Date().toISOString(),
    categories: [], items: [], modifierGroups: [],
    pricingRules: [], schedules: [],
    channels: [
      { name: 'Dine-In', status: 'live' },
      { name: 'Carry-Out', status: 'live' },
      { name: 'Pick-Up', status: 'live' },
      { name: 'Online', status: 'live' },
    ],
    taxRates: [
      { id: 'tx_food', name: 'Food', ratePct: 0 },
      { id: 'tx_alc', name: 'Alcohol', ratePct: 0 },
    ],
  };
}

function touch(menu) {
  menu.version = (menu.version || 0) + 1;
  menu.updatedAt = new Date().toISOString();
}

module.exports = {
  normName, titleCase, findItem, findGroup, ensureCategory,
  itemsOfGroup, groupCategories, parseTime, fmtTime, splitMidnight,
  money, displayMoney, newMenu, touch,
};

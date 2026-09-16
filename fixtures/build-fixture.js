/**
 * build-fixture.js — generates fixtures/sample-menu.json (deterministic seed data).
 * Run: node fixtures/build-fixture.js
 *
 * The Heartland location deliberately contains the failure patterns the audit
 * layer must catch:
 *  - pepperoni shared across 5 categories on 25 items (the "pepperoni problem")
 *  - an empty "Kiosk Extras" modifier group (third-party sync breaker)
 *  - time ranges crossing midnight unsplit (10PM–2AM, 9PM–2AM)
 *  - two Force Price rules matching Draft Beer in the same window (dead config)
 *  - 4 overlapping pricing rules on Draft Beer (threshold is >3)
 *  - duplicate item name "House Salad"
 *  - full-service items sitting at Course 0
 *  - an item with Rush AND Hold set simultaneously
 * Other platform locations get a clean, fully-compliant menu (healthy control group).
 */
const fs = require('fs');
const path = require('path');

const cents = (n) => Math.round(n * 100);
const T = (s) => { // "9:00 PM" -> minutes
  const m = s.match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/i);
  let h = +m[1], min = +m[2], ap = m[3].toUpperCase();
  if (ap === 'PM' && h !== 12) h += 12;
  if (ap === 'AM' && h === 12) h = 0;
  return h * 60 + min;
};

// ───────────────────────────── dirty Heartland menu ─────────────────────────────
const menu = {
  name: 'Mario’s Pizzeria — Full Menu',
  version: 1,
  updatedAt: '2026-09-15T00:00:00.000Z',
  categories: [
    { id: 'cat_pizza', name: 'Pizza' },
    { id: 'cat_calzone', name: 'Calzone' },
    { id: 'cat_stromboli', name: 'Stromboli' },
    { id: 'cat_pasta', name: 'Pasta' },
    { id: 'cat_salads', name: 'Salads' },
    { id: 'cat_apps', name: 'Appetizers' },
    { id: 'cat_desserts', name: 'Desserts' },
    { id: 'cat_bev', name: 'Beverages' },
  ],
  channels: [
    { name: 'Dine-In', status: 'live' },
    { name: 'Carry-Out', status: 'live' },
    { name: 'Pick-Up', status: 'live' },
    { name: 'Online', status: 'live' },
    { name: 'Bar', status: 'live' },
  ],
  taxRates: [
    { id: 'tx_food', name: 'Food', ratePct: 3.9 },
    { id: 'tx_alc', name: 'Alcohol', ratePct: 12.0 },
  ],
  modifierGroups: [
    {
      id: 'mg_toppings', name: 'Toppings', minChoices: 0, maxChoices: 8, included: 0,
      shared: true, halfAndHalfAllowed: true, availableOnline: true,
      showNameOn: ['pos', 'kds', 'printers'],
      options: [
        { id: 'mo_pep', name: 'Pepperoni', priceDelta: cents(2.5), default: false },
        { id: 'mo_cheese', name: 'Extra Cheese', priceDelta: cents(2.0), default: false },
        { id: 'mo_sausage', name: 'Italian Sausage', priceDelta: cents(2.5), default: false },
        { id: 'mo_mush', name: 'Mushrooms', priceDelta: cents(1.5), default: false },
        { id: 'mo_pep2', name: 'pepperoni', priceDelta: cents(2.5), default: false },
        { id: 'mo_ham', name: 'Ham', priceDelta: cents(2.0), default: false },
        { id: 'mo_olives', name: 'Olives', priceDelta: cents(1.0), default: false },
        { id: 'mo_jalapeno', name: 'Jalapeños', priceDelta: cents(1.0), default: false },
      ],
      itemScope: null,
    },
    {
      id: 'mg_sides', name: 'Sides', minChoices: 0, maxChoices: 3, included: 1,
      shared: true, halfAndHalfAllowed: false, availableOnline: true,
      options: [
        { id: 'mo_garlic', name: 'Garlic Knots', priceDelta: cents(3.0), default: false },
        { id: 'mo_wings', name: 'Wings (6ct)', priceDelta: cents(6.0), default: false },
      ],
      itemScope: null,
    },
    {
      id: 'mg_sauce', name: 'Dipping Sauce', minChoices: 0, maxChoices: 2, included: 1,
      shared: true, halfAndHalfAllowed: false, availableOnline: true,
      options: [
        { id: 'mo_marinara', name: 'Marinara', priceDelta: 0, default: true },
        { id: 'mo_ranch', name: 'Ranch', priceDelta: 0, default: false },
        { id: 'mo_alfredo', name: 'Alfredo', priceDelta: cents(1.0), default: false },
      ],
      itemScope: null,
    },
    {
      id: 'mg_protein', name: 'Protein Add-ons', minChoices: 0, maxChoices: 2, included: 0,
      shared: true, halfAndHalfAllowed: false, availableOnline: true,
      options: [
        { id: 'mp_pep', name: 'Pepperoni', priceDelta: cents(2.0), default: false },
        { id: 'mp_chicken', name: 'Grilled Chicken', priceDelta: cents(3.5), default: false },
      ],
      itemScope: null,
    },
    {
      // Empty group — breaks third-party syncs (documented Toast rule).
      id: 'mg_kiosk', name: 'Kiosk Extras', minChoices: 0, maxChoices: 0, included: 0,
      shared: false, halfAndHalfAllowed: false, availableOnline: false,
      options: [], itemScope: [],
    },
    {
      id: 'mg_size', name: 'Size', minChoices: 1, maxChoices: 1, included: 1,
      shared: true, halfAndHalfAllowed: false, availableOnline: true,
      options: [
        { id: 'sz_s', name: 'Small', priceDelta: -cents(3.0), default: false },
        { id: 'sz_m', name: 'Medium', priceDelta: 0, default: true },
        { id: 'sz_l', name: 'Large', priceDelta: cents(3.0), default: false },
        { id: 'sz_xl', name: 'X-Large', priceDelta: cents(6.0), default: false },
      ],
      itemScope: null,
    },
  ],
  items: [],
  pricingRules: [
    {
      id: 'pr_hh_draft', name: 'Happy Hour Draft (Bar)', type: 'force', value: cents(3.0),
      appliesTo: { items: ['it_draft'] },
      scope: { days: [1, 2, 3, 4, 5], timeRanges: [{ startMin: T('4:00 PM'), endMin: T('6:00 PM') }], channel: null, room: 'Bar' },
      postTax: false, priority: 1, enabled: true,
    },
    {
      // DEAD CONFIG: second force price matching the same item in the same window, lower priority.
      id: 'pr_hh_draft_old', name: 'Happy Hour Draft (STALE)', type: 'force', value: cents(3.5),
      appliesTo: { items: ['it_draft'] },
      scope: { days: [1, 2, 3, 4, 5], timeRanges: [{ startMin: T('4:00 PM'), endMin: T('6:00 PM') }], channel: null, room: null },
      postTax: false, priority: 2, enabled: true,
    },
    {
      id: 'pr_emp', name: 'Employee Discount', type: 'percent', value: -20,
      appliesTo: { all: true }, scope: { days: null, timeRanges: null, channel: null, room: null },
      postTax: false, priority: 3, enabled: true,
    },
    {
      id: 'pr_latenight', name: 'Late Night Surcharge', type: 'dollar', value: cents(1.0),
      appliesTo: { all: true },
      scope: { days: null, timeRanges: [{ startMin: T('10:00 PM'), endMin: T('2:00 AM') }], channel: 'Online', room: null },
      postTax: true, priority: 4, enabled: true,
    },
  ],
  schedules: [
    {
      id: 'sch_latenight', name: 'Late-Night Menu (Fri/Sat 10PM–2AM)',
      days: [5, 6], startMin: T('10:00 PM'), endMin: T('2:00 AM'),
      appliesTo: ['it_wings', 'it_loaded_fries'], splitFrom: null,
    },
    {
      // VIOLATION: single crossing range, unsplit (midnight rule)
      id: 'sch_bar', name: 'Bar Happy Hour (daily 9PM–2AM)',
      days: [0, 1, 2, 3, 4, 5, 6], startMin: T('9:00 PM'), endMin: T('2:00 AM'),
      appliesTo: ['it_draft', 'it_wings'], splitFrom: null,
    },
    {
      id: 'sch_brunch', name: 'Weekend Brunch (Sat/Sun 10AM–2PM)',
      days: [6, 0], startMin: T('10:00 AM'), endMin: T('2:00 PM'),
      appliesTo: [], splitFrom: null,
    },
  ],
};

const pizzas = [
  ['Margherita', 12.0], ['Pepperoni', 14.5], ['Meat Lovers', 16.5], ['Veggie', 15.0],
  ['BBQ Chicken', 16.0], ['Hawaiian', 15.0], ['White Pie', 13.5], ['Sicilian Pepperoni', 17.0],
  ['Buffalo Chicken', 16.0], ['Supreme', 17.0],
];
for (const [name, price] of pizzas) {
  menu.items.push({
    id: `it_pz_${name.toLowerCase().replace(/[^a-z0-9]+/g, '_')}`,
    name: `${name} Pizza`, category: 'Pizza', price: cents(price),
    description: 'House-made dough, San Marzano tomatoes, fresh mozzarella.',
    modifierGroups: ['mg_toppings', 'mg_size'], channels: ['Dine-In', 'Carry-Out', 'Pick-Up', 'Online'],
    course: name === 'Margherita' ? 0 : 2, rush: false, hold: false,
    halfAndHalf: true, misc: false, unavailable: null, stock: null, taxRateId: 'tx_food', archived: false,
  });
}

const foldIns = (cat, list, groups) => {
  for (const [name, price] of list) {
    menu.items.push({
      id: `it_${cat}_${name.toLowerCase().replace(/[^a-z0-9]+/g, '_')}`,
      name, category: cat, price: cents(price), description: '',
      modifierGroups: groups, channels: ['Dine-In', 'Carry-Out', 'Pick-Up', 'Online'],
      course: 0, rush: false, hold: false, halfAndHalf: cat === 'Calzone' || cat === 'Stromboli',
      misc: false, unavailable: null, stock: null, taxRateId: 'tx_food', archived: false,
    });
  }
};
foldIns('Calzone', [['Classic Calzone', 11.0], ['Pepperoni Calzone', 12.5]], ['mg_toppings', 'mg_sauce']);
foldIns('Stromboli', [['Ham & Provolone Stromboli', 10.5], ['Pepperoni Stromboli', 11.5]], ['mg_toppings', 'mg_sauce']);
foldIns('Pasta', [['Baked Ziti', 10.0], ['Fettuccine Alfredo', 12.0], ['Penne Arrivata', 12.5], ['Spaghetti & Meatballs', 12.0]], ['mg_toppings', 'mg_sauce', 'mg_protein']);
foldIns('Salads', [['House Salad', 6.5], ['Caesar', 9.0], ['Greek', 9.5]], ['mg_protein']);

menu.items.push(
  {
    id: 'it_wings', name: 'Buffalo Wings (10pc)', category: 'Appetizers', price: cents(11.5),
    description: '', modifierGroups: ['mg_sauce', 'mg_sides'],
    channels: ['Dine-In', 'Carry-Out', 'Pick-Up', 'Online'],
    course: 1, rush: true, hold: true, halfAndHalf: false, misc: false,
    unavailable: null, stock: null, taxRateId: 'tx_food', archived: false,
    time_ranges: [{ start: '10:00 PM', end: '2:00 AM' }], // legacy flat field the redundancy checker reads
  },
  {
    id: 'it_loaded_fries', name: 'Loaded Fries', category: 'Appetizers', price: cents(8.0),
    description: '', modifierGroups: ['mg_toppings'],
    channels: ['Dine-In', 'Carry-Out', 'Online'],
    course: 1, rush: false, hold: false, halfAndHalf: false, misc: false,
    unavailable: null, stock: null, taxRateId: 'tx_food', archived: false,
  },
  {
    id: 'it_house_salad_dup', name: 'House Salad', category: 'Appetizers', price: cents(6.5),
    description: 'Side portion — typed a second time instead of reusing the Salads entry.',
    modifierGroups: [], channels: ['Dine-In'], course: 1, rush: false, hold: false,
    halfAndHalf: false, misc: false, unavailable: null, stock: null, taxRateId: 'tx_food', archived: false,
  },
  {
    id: 'it_tiramisu', name: 'Tiramisu', category: 'Desserts', price: cents(6.5),
    description: '', modifierGroups: [], channels: ['Dine-In', 'Carry-Out', 'Online'],
    course: 3, rush: false, hold: false, halfAndHalf: false, misc: false,
    unavailable: null, stock: null, taxRateId: 'tx_food', archived: false,
  },
  {
    id: 'it_lava', name: 'Chocolate Lava Cake', category: 'Desserts', price: cents(7.0),
    description: '', modifierGroups: [], channels: ['Dine-In', 'Carry-Out', 'Online'],
    course: 0, rush: false, hold: false, halfAndHalf: false, misc: false,
    unavailable: null, stock: null, taxRateId: 'tx_food', archived: false,
  },
  {
    id: 'it_draft', name: 'Draft Beer', category: 'Beverages', price: cents(6.0),
    description: '', modifierGroups: [], channels: ['Dine-In', 'Bar'], course: 0,
    rush: false, hold: false, halfAndHalf: false, misc: false,
    unavailable: null, stock: null, taxRateId: 'tx_alc', archived: false,
  },
  {
    id: 'it_soda', name: 'Fountain Soda', category: 'Beverages', price: cents(2.75),
    description: '', modifierGroups: ['mg_size'], channels: ['Dine-In', 'Carry-Out', 'Pick-Up', 'Online'],
    course: 0, rush: false, hold: false, halfAndHalf: false,
    misc: true, unavailable: null, stock: null, taxRateId: 'tx_food', archived: false,
  }
);

// Pad the pepperoni surface: extra pizzas referencing the shared toppings group,
// so "pepperoni" (case variants included) lands on 20+ items across 5 categories.
for (const [name, price] of [['Philly Steak', 17.5], ['Pesto Chicken', 16.5], ['Four Cheese', 14.0]]) {
  menu.items.push({
    id: `it_pz_${name.toLowerCase().replace(/[^a-z0-9]+/g, '_')}`,
    name: `${name} Pizza`, category: 'Pizza', price: cents(price), description: '',
    modifierGroups: ['mg_toppings', 'mg_size'], channels: ['Dine-In', 'Carry-Out', 'Pick-Up', 'Online'],
    course: 2, rush: false, hold: false, halfAndHalf: true, misc: false,
    unavailable: null, stock: null, taxRateId: 'tx_food', archived: false,
  });
}

// ───────────────────────────── clean control menu ─────────────────────────────
function buildCleanMenu(name) {
  return {
    name, version: 1,
    updatedAt: '2026-09-15T00:00:00.000Z',
    categories: [
      { id: 'cat_pizza', name: 'Pizza' },
      { id: 'cat_apps', name: 'Appetizers' },
      { id: 'cat_salads', name: 'Salads' },
      { id: 'cat_desserts', name: 'Desserts' },
      { id: 'cat_bev', name: 'Beverages' },
    ],
    channels: [
      { name: 'Dine-In', status: 'live' },
      { name: 'Carry-Out', status: 'live' },
      { name: 'Pick-Up', status: 'live' },
      { name: 'Online', status: 'live' },
      { name: 'Bar', status: 'live' },
    ],
    taxRates: [
      { id: 'tx_food', name: 'Food', ratePct: 3.9 },
      { id: 'tx_alc', name: 'Alcohol', ratePct: 12.0 },
    ],
    modifierGroups: [
      {
        id: 'mg_toppings', name: 'Pizza Toppings', minChoices: 0, maxChoices: 6, included: 0,
        shared: false, halfAndHalfAllowed: true, availableOnline: true,
        options: [
          { id: 'mo_pep', name: 'Pepperoni', priceDelta: cents(2.5), default: false },
          { id: 'mo_cheese', name: 'Extra Cheese', priceDelta: cents(2.0), default: false },
          { id: 'mo_sausage', name: 'Italian Sausage', priceDelta: cents(2.5), default: false },
        ],
        itemScope: null,
      },
      {
        id: 'mg_crust', name: 'Crust', minChoices: 1, maxChoices: 1, included: 1,
        shared: true, halfAndHalfAllowed: false, availableOnline: true,
        options: [
          { id: 'mo_hand', name: 'Hand Tossed', priceDelta: 0, default: true },
          { id: 'mo_thin', name: 'Thin', priceDelta: 0, default: false },
          { id: 'mo_stuffed', name: 'Stuffed', priceDelta: cents(2.0), default: false },
        ],
        itemScope: null,
      },
      {
        id: 'mg_size', name: 'Size', minChoices: 1, maxChoices: 1, included: 1,
        shared: true, halfAndHalfAllowed: false, availableOnline: true,
        options: [
          { id: 'sz_s', name: 'Small', priceDelta: -cents(3.0), default: false },
          { id: 'sz_m', name: 'Medium', priceDelta: 0, default: true },
          { id: 'sz_l', name: 'Large', priceDelta: cents(3.0), default: false },
        ],
        itemScope: null,
      },
    ],
    items: [
      { id: 'it_marg', name: 'Margherita Pizza', category: 'Pizza', price: cents(12.0), description: 'House-made dough; San Marzano; fresh mozzarella.', modifierGroups: ['mg_crust'], channels: ['Dine-In', 'Carry-Out', 'Pick-Up', 'Online'], course: 2, rush: false, hold: false, halfAndHalf: true, misc: false, unavailable: null, stock: null, taxRateId: 'tx_food', archived: false },
      { id: 'it_pep', name: 'Pepperoni Pizza', category: 'Pizza', price: cents(14.5), description: 'Classic.', modifierGroups: ['mg_toppings', 'mg_crust'], channels: ['Dine-In', 'Carry-Out', 'Pick-Up', 'Online'], course: 2, rush: false, hold: false, halfAndHalf: true, misc: false, unavailable: null, stock: null, taxRateId: 'tx_food', archived: false },
      { id: 'it_cheese', name: 'Cheese Pizza', category: 'Pizza', price: cents(12.5), description: '', modifierGroups: ['mg_toppings', 'mg_crust'], channels: ['Dine-In', 'Carry-Out', 'Pick-Up', 'Online'], course: 2, rush: false, hold: false, halfAndHalf: true, misc: false, unavailable: null, stock: null, taxRateId: 'tx_food', archived: false },
      { id: 'it_veg', name: 'Veggie Pizza', category: 'Pizza', price: cents(15.0), description: '', modifierGroups: ['mg_toppings', 'mg_crust'], channels: ['Dine-In', 'Carry-Out', 'Online'], course: 2, rush: false, hold: false, halfAndHalf: true, misc: false, unavailable: null, stock: null, taxRateId: 'tx_food', archived: false },
      { id: 'it_saus', name: 'Sausage Pizza', category: 'Pizza', price: cents(15.0), description: '', modifierGroups: ['mg_toppings', 'mg_crust'], channels: ['Dine-In', 'Carry-Out', 'Pick-Up', 'Online'], course: 2, rush: false, hold: false, halfAndHalf: true, misc: false, unavailable: null, stock: null, taxRateId: 'tx_food', archived: false },
      { id: 'it_wings', name: 'Buffalo Wings', category: 'Appetizers', price: cents(11.5), description: '', modifierGroups: [], channels: ['Dine-In', 'Bar'], course: 1, rush: false, hold: false, halfAndHalf: false, misc: false, unavailable: null, stock: null, taxRateId: 'tx_food', archived: false },
      { id: 'it_knots', name: 'Garlic Knots', category: 'Appetizers', price: cents(5.5), description: '', modifierGroups: [], channels: ['Dine-In', 'Carry-Out'], course: 1, rush: false, hold: false, halfAndHalf: false, misc: false, unavailable: null, stock: null, taxRateId: 'tx_food', archived: false },
      { id: 'it_caesar', name: 'Caesar', category: 'Salads', price: cents(9.0), description: '', modifierGroups: [], channels: ['Dine-In', 'Online'], course: 1, rush: false, hold: false, halfAndHalf: false, misc: false, unavailable: null, stock: null, taxRateId: 'tx_food', archived: false },
      { id: 'it_tira', name: 'Tiramisu', category: 'Desserts', price: cents(6.5), description: '', modifierGroups: [], channels: ['Dine-In', 'Carry-Out', 'Online'], course: 3, rush: false, hold: false, halfAndHalf: false, misc: false, unavailable: null, stock: null, taxRateId: 'tx_food', archived: false },
      { id: 'it_draft', name: 'Draft Beer', category: 'Beverages', price: cents(6.0), description: '', modifierGroups: ['mg_size'], channels: ['Dine-In', 'Bar'], course: 0, rush: false, hold: false, halfAndHalf: false, misc: false, unavailable: null, stock: null, taxRateId: 'tx_alc', archived: false },
      { id: 'it_soda', name: 'Fountain Soda', category: 'Beverages', price: cents(2.75), description: '', modifierGroups: ['mg_size'], channels: ['Dine-In', 'Carry-Out', 'Pick-Up', 'Online'], course: 0, rush: false, hold: false, halfAndHalf: false, misc: true, unavailable: null, stock: null, taxRateId: 'tx_food', archived: false },
    ],
    pricingRules: [
      { id: 'pr_hh', name: 'Happy Hour Draft', type: 'force', value: cents(3.0), appliesTo: { items: ['it_draft'] }, scope: { days: [1, 2, 3, 4, 5], timeRanges: [{ startMin: T('4:00 PM'), endMin: T('6:00 PM') }], channel: null, room: null }, postTax: false, priority: 1, enabled: true },
    ],
    schedules: [
      { id: 'sch_brunch', name: 'Weekend Brunch', days: [6, 0], startMin: T('10:00 AM'), endMin: T('2:00 PM'), appliesTo: [], splitFrom: null },
    ],
  };
}

const out = {
  organization: { id: 'org_signal_f', name: 'Signal F Holdings — Client: Mario’s Pizzeria' },
  locations: [
    { id: 'loc_marios', name: 'Mario’s Pizzeria (Main)', platform: 'heartland', timezone: 'America/Denver', menu },
    { id: 'loc_marios_square', name: 'Mario’s — Square Location', platform: 'square', timezone: 'America/Denver', menu: buildCleanMenu('Mario’s Square Menu') },
    { id: 'loc_marios_clover', name: 'Mario’s — Clover Location', platform: 'clover', timezone: 'America/Denver', menu: buildCleanMenu('Mario’s Clover Menu') },
    { id: 'loc_marios_lightspeed', name: 'Mario’s — Lightspeed Location', platform: 'lightspeed', timezone: 'America/Denver', menu: buildCleanMenu('Mario’s Lightspeed Menu') },
    { id: 'loc_marios_touchbistro', name: 'Mario’s — TouchBistro Location', platform: 'touchbistro', timezone: 'America/Denver', menu: buildCleanMenu('Mario’s TouchBistro Menu') },
    { id: 'loc_marios_aloha', name: 'Mario’s — Aloha Location', platform: 'aloha', timezone: 'America/Denver', menu: buildCleanMenu('Mario’s Aloha Menu') },
    { id: 'loc_marios_toast', name: 'Mario’s — Toast Migration Site', platform: 'toast', timezone: 'America/Denver', menu: buildCleanMenu('Mario’s Toast Migration Menu') },
  ],
};

const dest = path.join(__dirname, 'sample-menu.json');
fs.writeFileSync(dest, JSON.stringify(out, null, 2));
const pepCount = menu.items.filter(it => {
  for (const gId of it.modifierGroups) {
    const g = menu.modifierGroups.find(x => x.id === gId);
    for (const o of (g ? g.options : [])) if (/^pepperoni$/i.test(o.name)) return true;
  }
  return false;
}).length;
console.log(`wrote ${dest} | heartland items: ${menu.items.length} (pepperoni on ${pepCount}) | locations: ${out.locations.length}`);

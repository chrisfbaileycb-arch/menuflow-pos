/**
 * platforms/index.js — the POS platforms the console identifies (dropdown),
 * each with its documentation namespace (used to enforce that a workflow only
 * cites manuals belonging to its platform), portal names, capabilities, and
 * the live-API adapter id (sandbox mode never calls it; live mode requires keys).
 */
const PLATFORMS = {
  heartland: {
    id: 'heartland',
    name: 'Heartland (PocketSuite / Genius)',
    short: 'Heartland',
    vendor: 'Heartland / Fiserv',
    color: '#f26722',
    portal: 'Heartland Admin Console + POS (Genius)',
    docPrefixes: ['heartland', 'signalF'],
    capabilities: { csvImport: false, jsonImport: true, itemStockLimits: true, onlineOrdering: true, kds: true, apiAdapter: 'pocketsuite-rest' },
    notes: 'Signal F Holdings primary platform; ships with the full KB-derived audit suite and shadow-build doctrine.',
  },
  toast: {
    id: 'toast',
    name: 'Toast POS',
    short: 'Toast',
    vendor: 'Toast, Inc.',
    color: '#ff5339',
    portal: 'Toast Web (Back Office) + Toast Handheld/Flex',
    docPrefixes: ['toast', 'heartland.kb', 'signalF'],
    capabilities: { csvImport: false, jsonImport: true, inventory: true, onlineOrdering: true, kds: true, apiAdapter: 'toast-live-api' },
    notes: 'All edits require Save + "Publish all changes"; empty modifier groups break third-party syncs — the engine blocks them.',
  },
  square: {
    id: 'square',
    name: 'Square for Restaurants',
    short: 'Square',
    vendor: 'Block, Inc.',
    color: '#3e4347',
    portal: 'Square Dashboard (Library/Items) + Square POS',
    docPrefixes: ['square', 'heartland.kb', 'signalF'],
    capabilities: { csvImport: true, csvExport: true, jsonImport: true, soldOutAutoReturn: true, onlineOrdering: true, apiAdapter: 'square-catalog-api', undoImport: true },
    notes: 'CSV import has Modify vs Replace modes; Replace deletes the library first — the engine gates it. Undo Catalogue is wired as a recovery step.',
  },
  clover: {
    id: 'clover',
    name: 'Clover',
    short: 'Clover',
    vendor: 'Fiserv',
    color: '#00b049',
    portal: 'Clover Dashboard (Menu/Items) + Clover Station',
    docPrefixes: ['clover', 'heartland.kb', 'signalF'],
    capabilities: { csvImport: true, jsonImport: true, inventory: true, onlineOrdering: true, kds: true, apiAdapter: 'clover-menu-api' },
    notes: 'Sync semantics enforced in workflow guidance: price/availability ~10 min; structural changes ~4 h — force-sync before verification.',
  },
  lightspeed: {
    id: 'lightspeed',
    name: 'Lightspeed Restaurant (K-Series)',
    short: 'Lightspeed',
    vendor: 'Lightspeed',
    color: '#1f8fc4',
    portal: 'Lightspeed Back Office + K-Series POS',
    docPrefixes: ['lightspeed', 'heartland.kb', 'signalF'],
    capabilities: { csvImport: true, jsonImport: true, priceLists: true, archiveSemantics: true, onlineOrdering: true, kds: true, apiAdapter: 'lightspeed-urban-api' },
    notes: 'Archive removes from ALL menus at ALL locations — destructive gate applied.',
  },
  touchbistro: {
    id: 'touchbistro',
    name: 'TouchBistro',
    short: 'TouchBistro',
    vendor: 'TouchBistro',
    color: '#7a4bdb',
    portal: 'TouchBistro Menu/RMM + iPad POS',
    docPrefixes: ['touchbistro', 'heartland.kb', 'signalF'],
    capabilities: { jsonImport: true, hidePerChannel: true, courses: true, onlineOrdering: true, apiAdapter: null },
    notes: 'POS-hidden and Online-hidden toggles are independent per item — mapped 1:1 onto canonical channel visibility.',
  },
  aloha: {
    id: 'aloha',
    name: 'NCR Aloha',
    short: 'Aloha',
    vendor: 'NCR Voyix',
    color: '#b31942',
    portal: 'Aloha ADM (back office) + Aloha POS',
    docPrefixes: ['aloha', 'heartland.kb', 'signalF'],
    capabilities: { jsonImport: true, perShift86: true, eodReports: true, apiAdapter: null },
    notes: 'Legacy-manual platform: sections cite the ADM/EASE owner manual family; re-confirm against the client’s exact revision before portal work.',
  },
};

function listPlatforms() {
  return Object.values(PLATFORMS).map(p => ({
    id: p.id, name: p.name, short: p.short, vendor: p.vendor, color: p.color,
    portal: p.portal, capabilities: p.capabilities, notes: p.notes,
  }));
}

module.exports = { ...PLATFORMS, list: listPlatforms, ALL: PLATFORMS };

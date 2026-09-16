/**
 * registry.js — skill registry. Every `auto` workflow step maps to a handler here.
 * The verifier fails any workflow that references an unknown skill, so "all the
 * actions are actually built in" is enforced by construction.
 */
const menuOps = require('./skills/menu-ops');
const modifierOps = require('./skills/modifiers');
const pricingOps = require('./skills/pricing');
const channelOps = require('./skills/channels');
const auditOps = require('./skills/audit-ops');
const ioOps = require('./skills/io-ops');

const SKILLS = Object.assign({}, menuOps, modifierOps, pricingOps, channelOps, auditOps, ioOps);

function has(name) { return typeof SKILLS[name]?.handler === 'function'; }
function get(name) { return SKILLS[name] || null; }
function list() {
  return Object.entries(SKILLS).map(([name, s]) => ({
    name, title: s.title, description: s.description,
    destructive: Boolean(s.destructive), params: s.params || [],
  }));
}

module.exports = { SKILLS, has, get, list };

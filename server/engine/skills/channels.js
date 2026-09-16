/**
 * channels.js — Shadow Build methodology (heartland.kb.shadow-build):
 * v2 channels are built in parallel with live; the client verifies, then flips.
 */
const M = require('../menu');

const shadowName = (name) => / v2$/.test(name) ? name : `${name} v2`;

module.exports = {
  'channel.shadow_create': {
    title: 'Create v2 shadow channels for every live channel',
    description: 'Naming convention is exactly "[Original Channel Name] v2". Live channels keep processing orders; no customer sees v2 until cutover.',
    params: [],
    handler(ctx, args, menu) {
      const lives = menu.channels.filter(c => c.status === 'live');
      const created = [];
      for (const c of lives) {
        const base = c.name.replace(/ v2$/, ''); // strip promotion suffix → original fallback name
        const name = `${base} v2`;
        if (name === c.name) {
          // c IS the promoted v2 — re-arm the retired original as the next-cycle shadow
          const fallback = menu.channels.find(x => x.name === base && x.status === 'retired');
          if (fallback) {
            fallback.status = 'shadow';
            fallback.reArmedAt = new Date().toISOString();
            created.push(`${base} (re-armed fallback)`);
            continue;
          }
        }
        const existing = menu.channels.find(x => x.name === name);
        if (!existing) {
          menu.channels.push({ name, status: 'shadow', createdAt: new Date().toISOString() });
          // every item visible on the live channel is mirrored to its v2 for build/test
          for (const it of menu.items) {
            if ((it.channels || []).includes(c.name)) {
              it.channels = it.channels || [];
              if (!it.channels.includes(name)) it.channels.push(name);
            }
          }
          created.push(name);
        }
      }
      menu.shadowBuild = { startedAt: new Date().toISOString(), channels: created, status: 'building' };
      M.touch(menu);
      return {
        message: created.length ? `Shadow channels created: ${created.join(', ')}` : 'All live channels already have v2 shadows',
        notes: ['Pre-build checklist (KB shadow-build §checklist): audit delivered ✓, written client approval required at publish gate, clean export saved to exports/ (io.export.menu).'],
      };
    },
  },

  'channel.shadow_verify': {
    title: 'Verify each shadow channel (structure checks before cutover)',
    params: [],
    handler(ctx, args, menu) {
      const Audit = require('../audit');
      const findings = [];
      const shadows = menu.channels.filter(c => c.status === 'shadow');
      if (!shadows.length) throw new Error('No shadow channels exist — run channel.shadow_create first.');
      for (const sh of shadows) {
        const visible = menu.items.filter(i => !i.archived && (i.channels || []).includes(sh.name));
        if (!visible.length) findings.push({ type: 'SHADOW_EMPTY', channel: sh.name, severity: 'HIGH', explanation: 'Shadow channel has zero visible items.' });
        const empties = Audit.emptyModifierGroups(menu).filter(f => f.group);
        for (const it of visible) {
          for (const gid of it.modifierGroups || []) {
            const g = menu.modifierGroups.find(x => x.id === gid);
            if (!g || !g.options || !g.options.length) findings.push({ type: 'EMPTY_MODIFIER_GROUP', channel: sh.name, item: it.name, group: gid, severity: 'HIGH', explanation: `Item "${it.name}" references an empty/missing modifier group on ${sh.name}.` });
          }
          if (it.course == null && /entree|pizza|pasta/i.test(it.category || '')) {
            findings.push({ type: 'COURSE_UNASSIGNED', channel: sh.name, item: it.name, severity: 'LOW', explanation: 'Full-service item at Course 0 in shadow — confirm intended.' });
          }
        }
        void empties;
      }
      const high = findings.filter(f => f.severity === 'HIGH').length;
      menu.shadowBuild = menu.shadowBuild || {};
      menu.shadowBuild.status = high ? 'failed_verification' : 'verified';
      menu.shadowBuild.verifiedAt = high ? null : new Date().toISOString();
      M.touch(menu);
      return {
        message: high ? `Shadow verification FAILED: ${high} blocker(s)` : `All shadow channels verified — ready for client-controlled cutover`,
        findings,
      };
    },
  },

  'channel.cutover': {
    title: 'Cutover: promote v2 shadow channels to live, retire originals as fallback',
    description: 'Old channels remain available (status retired) until explicitly retired-deleted — zero downtime, ever.',
    destructive: true,
    params: [{ name: 'clientApprovalRef', required: true, type: 'string', example: 'signed-form id / email reference' }],
    handler(ctx, args, menu) {
      const shadows = menu.channels.filter(c => c.status === 'shadow');
      if (!shadows.length) throw new Error('No shadow channels to promote.');
      if (menu.shadowBuild && menu.shadowBuild.status !== 'verified') {
        return { blocked: true, message: 'Cutover blocked: run channel.shadow_verify and resolve HIGH findings first (shadow-build guide Phase 3).' };
      }
      const swaps = [];
      for (const sh of shadows) {
        const origName = sh.name.replace(/ v2$/, '');
        const orig = menu.channels.find(c => c.name === origName && c.status === 'live');
        if (!orig) {
          // re-armed fallback case: original is the retired→shadow record; its live twin is the v2 name
          const liveTwin = menu.channels.find(x => x.name === `${origName} v2` && x.status === 'live');
          if (liveTwin) {
            sh.status = 'live';
            liveTwin.status = 'retired';
            liveTwin.retainedAsFallback = true;
            swaps.push(`${liveTwin.name} → ${sh.name} (cycle 2)`);
          }
          continue;
        }
        orig.status = 'retired';
        orig.retiredAt = new Date().toISOString();
        orig.retainedAsFallback = true;
        sh.status = 'live';
        for (const it of menu.items) {
          const on = (it.channels || []).includes(origName);
          if (on && !it.channels.includes(sh.name)) it.channels.push(sh.name);
        }
        swaps.push(`${origName} → ${sh.name} (original kept as fallback)`);
      }
      menu.shadowBuild = menu.shadowBuild || {};
      menu.shadowBuild.status = 'cut-over';
      menu.shadowBuild.approvalRef = args.clientApprovalRef;
      menu.shadowBuild.cutOverAt = new Date().toISOString();
      M.touch(menu);
      return {
        message: `Cutover executed: ${swaps.join(' | ')}`,
        notes: [`Client approval reference recorded: ${args.clientApprovalRef}. Retire old channels only when the client signs off (rebuild/cutover-instructions.md).`],
      };
    },
  },

  'channel.retire': {
    title: 'Retire a fallback channel permanently (only after client sign-off)',
    destructive: true,
    params: [
      { name: 'channel', required: true, type: 'string' },
      { name: 'clientApprovalRef', required: true, type: 'string' },
    ],
    handler(ctx, args, menu) {
      const c = menu.channels.find(x => x.name === args.channel || x.name === shadowName(args.channel));
      if (!c) throw new Error(`Channel not found: ${args.channel}`);
      if (c.status === 'live') throw new Error(`Refusing to retire the LIVE channel "${c.name}" — there must be at least one live channel per name.`);
      menu.channels = menu.channels.filter(x => x !== c);
      for (const it of menu.items) it.channels = (it.channels || []).filter(n => n !== c.name);
      M.touch(menu);
      return { message: `Retired fallback channel "${c.name}" (approval: ${args.clientApprovalRef})` };
    },
  },
};

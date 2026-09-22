/* MenuFlow POS console — vanilla JS, every control wired to /api/* */
'use strict';
const $ = (q, el) => (el || document).querySelector(q);
const $$ = (q, el) => [...(el || document).querySelectorAll(q)];
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const money = (c) => c == null ? '—' : '$' + (c / 100).toFixed(2);

const state = {
  platform: 'heartland', location: null, locations: [], platforms: [],
  workflows: [], selected: null, catFilter: null, search: '',
  lastRunInputs: {}, approvals: {},
};

async function api(pathname, opts = {}) {
  const res = await fetch(pathname, opts.body ? { headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(opts.body), ...opts, method: opts.method || 'POST' } : opts);
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw Object.assign(new Error(data.error || `${res.status}`), { data, status: res.status });
  return data;
}
function toast(msg, cls = '') {
  const t = $('#toast'); t.textContent = msg; t.className = `toast show ${cls}`;
  clearTimeout(t._h); t._h = setTimeout(() => t.className = 'toast', 4200);
}

/* ───────────────── bootstrap ───────────────── */
async function boot() {
  const [pf, ov] = await Promise.all([api('/api/platforms'), api('/api/overview')]);
  state.platforms = pf.platforms; state.locations = ov.locations;
  renderPlatformSelect(); renderLocationSelect(); refreshVerify();
  $$('#tabs button').forEach(b => b.onclick = () => {
    $$('#tabs button').forEach(x => x.classList.remove('active')); b.classList.add('active');
    $$('.view').forEach(v => v.classList.remove('active'));
    $(`#view-${b.dataset.tab}`).classList.add('active');
    ({
      workflows: () => { loadWorkflows(); loadAuditOverview(); },
      menu: loadMenu,
      audit: loadAudit,
      io: loadFiles,
      runs: loadRuns,
      firebase: loadFirebaseDashboard,
      docs: loadDocs,
      skills: loadSkills,
    }[b.dataset.tab] || (() => { }))();
  });
  $('#platformSelect').onchange = (e) => { state.platform = e.target.value; state.selected = null; state.catFilter = null; loadWorkflows(); };
  $('#locationSelect').onchange = (e) => { state.location = e.target.value; state.approvals = {}; loadWorkflows(); loadMenu(); loadAuditOverview(); };
  $('#modeChip').onclick = toggleMode;
  $('#verifyAllBtn').onclick = refreshVerify;
  const expAuditBtn = $('#exportAuditBtn');
  if (expAuditBtn) expAuditBtn.onclick = exportAuditReport;

  // Firebase status chip & auth wiring
  const fbChip = $('#firebaseStatusChip');
  if (fbChip) fbChip.onclick = () => {
    const fbTab = $(`#tabs button[data-tab="firebase"]`);
    if (fbTab) fbTab.click();
  };

  const fbAuthBtn = $('#fbAuthBtn');
  if (fbAuthBtn) fbAuthBtn.onclick = async () => {
    if (!window.firebaseClient) return toast('Firebase initializing, please wait…');
    const u = window.firebaseClient.getUser();
    if (u) {
      await window.firebaseClient.logout();
      toast('Signed out from Firebase', 'good');
    } else {
      try {
        const user = await window.firebaseClient.loginWithGoogle();
        toast(`Signed in as ${user.displayName || user.email}`, 'good');
      } catch (err) {
        toast('Google sign-in cancelled or failed: ' + err.message, 'bad');
      }
    }
  };

  const fbSyncBtn = $('#fbSyncBtn');
  if (fbSyncBtn) fbSyncBtn.onclick = async () => {
    toast('Syncing state to Cloud Firestore…');
    try {
      if (window.firebaseClient) {
        await window.firebaseClient.syncDirectToCloud(state);
      }
      const res = await api('/api/firebase/sync', { method: 'POST' });
      toast(`Cloud sync complete! Synced ${res.synced?.locations || 0} locations, ${res.synced?.menus || 0} menus, ${res.synced?.runs || 0} runs.`, 'good');
      if ($('#view-firebase').classList.contains('active')) loadFirebaseDashboard();
    } catch (e) {
      toast('Cloud sync failed: ' + e.message, 'bad');
    }
  };

  // Listen to Firebase client state
  const checkFbInterval = setInterval(() => {
    if (window.firebaseClient) {
      clearInterval(checkFbInterval);
      window.firebaseClient.onStatusChange(updateFbStatusUi);
      window.firebaseClient.onUserChange(updateFbUserUi);
    }
  }, 200);
  await loadWorkflows();
  await loadAuditOverview();
}

function renderPlatformSelect() {
  const sel = $('#platformSelect');
  sel.innerHTML = state.platforms.map(p => `<option value="${p.id}" ${p.id === state.platform ? 'selected' : ''}>${esc(p.name)}</option>`).join('');
}
function renderLocationSelect() {
  const sel = $('#locationSelect');
  const matching = state.locations.filter(l => l.platform === state.platform);
  const list = matching.length ? matching : state.locations;
  sel.innerHTML = list.map(l => `<option value="${l.id}">${esc(l.name)} · ${esc(l.platform)}</option>`).join('');
  state.location = list[0]?.id || null;
  renderModeChip();
}
function renderModeChip() {
  const chip = $('#modeChip');
  const l = state.locations.find(x => x.id === state.location);
  const p = state.platforms.find(x => x.id === (l?.platform || state.platform));
  chip.innerHTML = `<span class="dot" style="background:${p?.color || '#888'}"></span> ${esc(p?.short || '')} · <b>${esc(state.mode || 'SANDBOX')}</b>`;
  const meta = $('#platMeta');
  if (meta) {
    meta.textContent = p?.bulkFile ? `bulk file: ${p.bulkFile}` : '';
    meta.title = p ? `modifiers — ${p.modifierEncoding}\nowner's manual — ${p.manual}` : '';
  }
}
async function refreshMode() {
  const s = await api('/api/health'); state.mode = (s.mode || 'sandbox').toUpperCase(); renderModeChip();
}
async function toggleMode() {
  const to = (state.mode || 'SANDBOX') === 'SANDBOX' ? 'live-api' : 'sandbox';
  if (to === 'live-api') {
    if (!confirm('Live-API mode routes portal-side steps to vendor API adapters (adapters are wired for: Toast Live API, Square Catalog API, Lightspeed Urban Menu API — API keys must be set server-side in data/state.json settings.apiKeys; sandbox remains the default for safety).\n\nSwitch to live-api mode?')) return;
  }
  await api('/api/settings', { body: { mode: to } });
  toast(to === 'live-api' ? 'Live-API mode ON (adapters require credentials)' : 'Sandbox mode', 'good');
  refreshMode();
}

/* ───────────────── verify banner ───────────────── */
async function refreshVerify() {
  const v = await api('/api/verify');
  const b = $('#verifyBanner');
  b.className = `verify-banner ${v.ok ? 'ok' : 'bad'}`;
  b.innerHTML = v.ok
    ? `✓ ${v.totals.workflows} workflows verified — ${v.totals.auto} executable steps, ${v.totals.citations} owner’s-manual citations, ${v.totals.checks} post-step checks, ${v.skills} skills.`
    : `✗ ${v.totals.errors} verification errors — see below.`;
}

/* ───────────────── workflows ───────────────── */
async function loadWorkflows() {
  const { workflows } = await api(`/api/workflows?platform=${state.platform}`);
  state.workflows = workflows;
  const cats = [...new Set(workflows.map(w => w.category))].sort();
  $('#catChips').innerHTML = cats.map(c => `<button class="c ${state.catFilter === c ? 'on' : ''}" data-c="${esc(c)}">${esc(c)}</button>`).join('');
  $$('#catChips .c').forEach(btn => btn.onclick = () => { state.catFilter = state.catFilter === btn.dataset.c ? null : btn.dataset.c; loadWorkflows(); });
  $('#wfSearch').oninput = (e) => { state.search = e.target.value.toLowerCase(); renderWfList(); };
  renderWfList();
  if (state.selected) selectWf(state.selected, true);
}
function renderWfList() {
  const list = state.workflows
    .filter(w => (!state.catFilter || w.category === state.catFilter) && (!state.search || (w.title + w.summary + w.id).toLowerCase().includes(state.search)))
    .map(w => `
    <div class="wf-item ${state.selected === w.id ? 'sel' : ''}" data-id="${esc(w.id)}">
      <div class="t">${esc(w.title)} <span class="badge ${w.risk}">${w.risk}</span></div>
      <div class="m"><span>${esc(w.category)}</span><span>${w.stepsTotal} steps</span><span>${w.gates} gate${w.gates !== 1 ? 's' : ''}</span><span>${w.citations} citations</span><span class="mono">${esc(w.id)}</span></div>
    </div>`).join('');
  $('#wfList').innerHTML = list || '<div class="empty">No workflows match.</div>';
  $$('#wfList .wf-item').forEach(el => el.onclick = () => selectWf(el.dataset.id));
}

async function selectWf(id, keepInputs) {
  state.selected = id;
  renderWfList();
  const { workflow: wf } = await api(`/api/workflows/${state.platform}/${id}`);
  const key = state.location + ':' + id;
  const saved = keepInputs ? state.lastRunInputs[key] : null;
  $('#wfDetail').innerHTML = `
    <div class="card">
      <div class="wf-head">
        <h2>${esc(wf.title)}</h2>
        <span class="badge ${wf.risk}">${wf.risk} risk</span>
        <span class="cat">${esc(wf.category)}</span>
        <span class="cat mono">${esc(wf.id)}</span>
        ${wf.validation.ok ? '<span class="badge ok">verified ✓</span>' : '<span class="badge fail">INVALID</span>'}
      </div>
      <p class="wf-sum">${esc(wf.summary)}</p>
      ${(wf.preconditions || []).length ? `<div class="wf-meta">⚑ ${wf.preconditions.map(esc).join(' · ')}</div>` : ''}
      <div class="wf-meta">${wf.steps.length} steps · ${wf.steps.filter(s => s.kind === 'auto').length} executable actions · ${wf.steps.filter(s => s.kind === 'manual').length} manual portal steps · ${wf.steps.filter(s => s.kind === 'gate').length} client gates</div>
      <div class="wf-inputs">${(wf.inputs || []).map(inp => `
        <label>${esc(inp.name)}${inp.required ? ' *' : ''} <span class="muted">(${esc(inp.type)})</span>
          ${inp.type === 'string[]' || inp.type === 'number[]'
        ? `<textarea rows="2" data-in="${esc(inp.name)}" placeholder="${esc(inp.example || '')}">${saved && saved[inp.name] != null ? esc(Array.isArray(saved[inp.name]) ? saved[inp.name].join(', ') : saved[inp.name]) : ''}</textarea>`
        : `<input data-in="${esc(inp.name)}" placeholder="${esc(inp.example || '')}" value="${saved && saved[inp.name] != null ? esc(saved[inp.name]) : ''}">`}
        ${inp.description ? `<span class="mini">${esc(inp.description)}</span>` : ''}
        </label>`).join('') || '<span class="muted mini">No inputs needed — runs against the selected location’s menu.</span>'}
      </div>
      <div class="wf-actions">
        <button class="btn" id="btnDry">▷ Dry-run (no writes)</button>
        <button class="btn primary" id="btnApply">▶ Run — stage to workbench</button>
        <button class="btn blue" id="btnValidate">Re-validate</button>
        <span class="mini muted" id="runHint"></span>
      </div>
      ${state.stagingNote ? `<div class="staging-banner">⚑ Staged changes pending on this location: ${esc(state.stagingNote)} — <b>Publish</b> in the Menu tab to apply to live.</div>` : ''}
      <div class="steps" id="wfSteps">${renderSteps(wf, null)}</div>
    </div>`;

  $('#btnDry').onclick = () => runWf(wf, 'dry');
  $('#btnApply').onclick = () => runWf(wf, 'apply');
  $('#btnValidate').onclick = async () => {
    const v = await api(`/api/workflows/${state.platform}/${wf.id}/validate`, { body: {} });
    toast(v.ok ? 'Workflow valid: schema, skills, citations, checks ✓' : 'INVALID: ' + v.errors.join('; '), v.ok ? 'good' : 'bad');
    refreshVerify();
  };
  $$('#wfDetail [data-in]').forEach(el => el.addEventListener('input', () => collect(wf)));
}
function collect(wf) {
  const inputs = {};
  $$('#wfDetail [data-in]').forEach(el => {
    const def = (wf.inputs || []).find(i => i.name === el.dataset.in);
    let v = el.value.trim();
    if (!v) return;
    if (def && (def.type === 'string[]')) v = v.split(',').map(x => x.trim()).filter(Boolean);
    else if (def && def.type === 'number[]') v = v.split(',').map(x => Number(x.trim())).filter(x => !isNaN(x));
    else if (def && def.type === 'number') v = Number(v);
    inputs[el.dataset.in] = v;
  });
  state.lastRunInputs[state.location + ':' + wf.id] = inputs;
  return inputs;
}
function renderSteps(wf, run) {
  const stepState = {};
  if (run) for (const rs of run.steps) stepState[rs.id] = rs;
  return wf.steps.map((st, i) => {
    const rs = stepState[st.id];
    const cls = rs ? `st-${rs.status}` : '';
    const kindLbl = st.kind === 'auto' ? 'executable' : st.kind === 'gate' ? 'client gate' : 'manual portal';
    const srcBadge = v => ({ 'official-doc': ' · verified', 'client-kb': ' · Signal F KB', 'legacy-manual': ' · legacy revision — confirm', 'access-limited': ' · login-gated source', 'compiled': ' · compiled mapping' })[v] || (v ? ` · ${v}` : '');
    const cites = (st.citations || []).map(c => `
      <a class="cite" href="${esc(c.url || '#')}" target="_blank" rel="noopener" title="${esc(c.excerpt || '')}${c.manual ? esc('\n\nlocal manual: ' + c.manual) : ''}">📖 ${esc(c.docId || c.doc)} § ${esc(c.section)}${srcBadge(c.verified)}</a>`).join('');
    const msg = rs ? `<div class="msg ${rs.status === 'failed' || rs.status === 'blocked' ? 'err' : (rs.status === 'awaiting_approval' || rs.status === 'awaiting_ack' || rs.status === 'soft-warning') ? 'warn' : 'good'}">${esc(rs.message || '')}</div>` : '';
    const findings = rs && rs.findings && rs.findings.length ? `<div class="findings">${rs.findings.slice(0, 8).map(f => `<div class="f"><span class="sev ${esc(f.severity || '')}">${esc(f.severity || '')}</span>${esc(f['86_risk'] || f.explanation || f.recommendation || f.type || '')}</div>`).join('')}${rs.findings.length > 8 ? `<span class="mini">+ ${rs.findings.length - 8} more</span>` : ''}</div>` : '';
    const checks = st.checks && st.checks.length ? `<div class="checks">✓ verifies: ${st.checks.map(c => esc(c.check)).join(' · ')}</div>` : '';
    const gateBtn = rs && (rs.status === 'awaiting_approval' || rs.status === 'awaiting_ack')
      ? `<div style="margin-top:8px"><button class="btn primary" onclick="openGate('${esc(run.id)}','${esc(st.id)}','${esc(st.title)}')">Approve this step</button> <span class="mini muted">Records an approval and resumes the run from the top with this gate satisfied.</span></div>` : '';
    return `<div class="step ${st.kind} ${cls}">
      <div class="head"><span class="n">${i + 1}</span><span class="title">${esc(st.title)}</span>
      ${rs ? `<span class="badge ${['ok', 'verified', 'approved'].includes(rs.status) ? 'ok' : rs.status === 'skipped' || rs.status === 'soft-warning' ? 'low' : 'fail'}">${esc(rs.status)}</span>` : ''}
      <span class="kind">${kindLbl}</span></div>
      <div class="body">
        ${st.skill ? `<span class="skill">${esc(st.skill)}</span>${st.skillTitle ? ` — ${esc(st.skillTitle)}` : ''}` : ''}
        ${st.instructions ? `<div class="mini" style="margin-top:4px">${esc(st.instructions)}</div>` : ''}
        ${cites}${checks}${msg}${findings}${gateBtn}
      </div>
    </div>`;
  }).join('');
}
window.openGate = function (runId, stepId, title) {
  $('#gateModal').classList.remove('hidden');
  $('#gmTitle').textContent = 'Gate: ' + title;
  $('#gmBody').textContent = `Recording approval for run ${runId} at step "${stepId}". Your note is attached to the run record as evidence.`;
  $('#gmCancel').onclick = () => $('#gateModal').classList.add('hidden');
  $('#gmApprove').onclick = async () => {
    const actor = $('#gmActor').value.trim() || 'web-operator';
    await api('/api/approve', { body: { runId, stepId, approved: true, actor, note: 'approved via console' } });
    $('#gateModal').classList.add('hidden');
    (state.approvals[runId] = state.approvals[runId] || new Set()).add(stepId);
    // resume: re-run with all approvals collected for this run lineage
    const wf = state.workflows.find(w => w.id === state.selected);
    const allApps = [...new Set(Object.values(state.approvals).flatMap(set => [...set]))];
    runWf(wf, lastMode, allApps);
  };
};
let lastMode = 'dry';
async function runWf(wf, mode, extraApprovals) {
  lastMode = mode;
  const inputs = collect(wf);
  const approvals = [...new Set([...(extraApprovals || []), ...((state.approvals[runKey(wf)] && [...state.approvals[runKey(wf)]]) || [])])];
  $('#runHint').innerHTML = '<span class="spin"></span> executing…';
  try {
    const { run } = await api(`/api/workflows/${state.platform}/${wf.id}/run`, { body: { location: state.location, mode, inputs, approvals, actor: 'web-operator' } });
    $('#runHint').textContent = `run ${run.id} → ${run.status}`;
    await afterRun(run);
  } catch (e) {
    $('#runHint').textContent = '';
    toast('Run error: ' + e.message, 'bad');
    if (e.data && e.data.run) await afterRun(e.data.run);
  }
}
function runKey(wf) { return state.location + ':' + wf.id; }
async function afterRun(run) {
  if (run.status === 'awaiting_approval' || run.status === 'awaiting_ack') {
    const pending = run.steps.find(s => s.status === 'awaiting_approval' || s.status === 'awaiting_ack');
    if (pending) {
      state.approvals[run.id] = new Set([pending.id]);
    }
    toast(`Run paused at gate "${pending?.id}" — approve in the timeline to continue.`, 'bad');
  } else if (run.status === 'ok') {
    toast(run.mode === 'apply' ? 'Workflow completed — workbench staged.' : 'Dry-run completed — all steps + checks passed.', 'good');
  } else {
    toast(`Run ${run.status} at ${run.stoppedAt}`, 'bad');
  }
  const { workflow: wf } = await api(`/api/workflows/${run.platform}/${run.workflowId}`);
  const host = $('#wfSteps');
  if (host) {
    host.innerHTML = `<div class="mini muted" style="margin-bottom:6px">Execution ${run.id} · ${run.mode} · ${run.status}</div>` + renderSteps(wf, run);
  }
  await loadMenu();
  refreshMode();
}

/* ───────────────── menu view ───────────────── */
async function loadMenu() {
  if (!state.location) return;
  const ov = await api('/api/overview');
  state.locations = ov.locations;
  const loc = ov.locations.find(l => l.id === state.location);
  state.stagingNote = loc?.hasStaging ? loc.stagingNote : null;
  const { menu } = await api(`/api/menu?location=${state.location}`);
  $('#menuSource').innerHTML = `<span class="dot" style="background:${menu.__source === 'staging' ? '#b9aaff' : '#41e0a0'}"></span> showing <b>${menu.__source}</b> · v${menu.version} · ${esc(loc?.name || '')}`;
  $('#publishBtn').disabled = !loc?.hasStaging;
  $('#discardBtn').disabled = !loc?.hasStaging;

  const groups = new Map(menu.modifierGroups.map(g => [g.id, g]));
  const rows = menu.items.map(it => {
    const mods = (it.modifierGroups || []).map(gid => groups.get(gid)?.name).filter(Boolean);
    return `<tr class="${it.archived ? 'archived' : ''} ${it.unavailable ? 'unavail' : ''}">
      <td><b>${esc(it.name)}</b><div class="mini muted">${esc(it.description || '')}</div></td>
      <td>${esc(it.category)}</td>
      <td class="mono">${money(it.price)}</td>
      <td>${(it.channels || []).map(ch => `<span class="tag ${ch.endsWith(' v2') ? 'shadow' : ''}">${esc(ch)}</span>`).join('')}</td>
      <td>${mods.map(nm => `<span class="tag">${esc(nm)}</span>`).join('') || '<span class="mini muted">—</span>'}</td>
      <td>C${it.course ?? 0}${it.rush ? ' <span class="tag">rush</span>' : ''}${it.hold ? ' <span class="tag">hold</span>' : ''}${it.halfAndHalf ? ' <span class="tag">½&½</span>' : ''}${it.misc ? ' <span class="tag">misc</span>' : ''}</td>
      <td>${it.unavailable ? `<span class="tag eighty6">86 · ${esc(it.unavailable.reason || '')}</span>` : '<span class="pill">active</span>'}</td>
      <td>${it.archived ? '<span class="pill">archived</span>' : `<button class="btn small ${it.unavailable ? '' : 'warn'}" onclick="quick86('${esc(it.id)}',${it.unavailable ? 'false' : 'true'})">${it.unavailable ? 'un-86' : '86'}</button>`}</td>
    </tr>`;
  }).join('');

  const chans = menu.channels.map(c => `<span class="tag ${c.status}">${esc(c.name)} [${c.status}]</span>`).join('');
  const rules = (menu.pricingRules || []).map(r => `<div class="mini">P${r.priority}${r.enabled === false ? ' <span class="tag">disabled</span>' : ''} · <b>${esc(r.name)}</b> — ${esc(r.type)} ${r.type === 'percent' ? r.value + '%' : money(Math.abs(r.value)) / 1 * (r.type === 'percent' ? 1 : 1)}${r.type === 'percent' ? '' : ''}${r.scope?.room ? ` · ${esc(r.scope.room)}` : ''}${r.scope?.channel ? ` · ${esc(r.scope.channel)}` : ''}</div>`).map(x => x).join('') || '<span class="mini muted">none</span>';

  $('#menuBody').innerHTML = `
  <div class="hbar" style="margin-bottom:10px">
    <span class="stat"><b>${menu.items.filter(i => !i.archived).length}</b> items</span>
    <span class="stat"><b>${menu.modifierGroups.length}</b> modifier groups</span>
    <span class="stat"><b>${(menu.schedules || []).length}</b> schedules</span>
    <span class="stat"><b>${(menu.pricingRules || []).length}</b> pricing rules</span>
    <span class="stat"><b>${menu.channels.filter(c => c.status === 'shadow').length}</b> shadow channels</span>
    ${menu.shadowBuild ? `<span class="tag ${menu.shadowBuild.status === 'verified' ? 'live' : 'eighty6'}">shadow build: ${esc(menu.shadowBuild.status)}</span>` : ''}
  </div>
  <div class="card" style="margin-bottom:12px"><h3>Channels</h3><div>${chans}</div></div>
  <div class="card scroll">
    <table class="menu">
      <thead><tr><th>Item</th><th>Category</th><th>Price</th><th>Channels</th><th>Modifier groups</th><th>Kitchen</th><th>Status</th><th></th></tr></thead>
      <tbody>${rows}</tbody>
    </table>
  </div>
  <div class="grid2" style="margin-top:12px">
    <div class="card"><h3>Modifier groups</h3>
      ${menu.modifierGroups.map(g => `<div class="result-box"><b>${esc(g.name)}</b>
        ${g.shared ? '<span class="tag">shared</span>' : '<span class="tag live">isolated</span>'}
        ${g.options.length === 0 ? '<span class="tag eighty6">EMPTY — sync breaker</span>' : ''}
        <div class="mini muted">min ${g.minChoices ?? 0} · max ${g.maxChoices ?? 0} · included ${g.included ?? 0}${g.halfAndHalfAllowed ? ' · half&half' : ''}</div>
        <div>${(g.options || []).map(o => `<span class="tag">${esc(o.name)}${o.priceDelta ? ` ${o.priceDelta < 0 ? '-' : '+'}${money(Math.abs(o.priceDelta))}` : ''}</span>`).join('')}</div>
      </div>`).join('') || '<span class="mini muted">none</span>'}
    </div>
    <div class="card"><h3>Pricing rules & schedules</h3>
      <div class="mini muted" style="margin-bottom:6px">first match wins — most specific on top</div>${rules}
      <h4 style="margin-top:12px">Schedules</h4>
      ${(menu.schedules || []).map(s => `<div class="mini">${esc(s.name)} · days[${(s.days || []).join(',')}] · ${fmtT(s.startMin)}–${fmtT(s.endMin)}${s.dayOffset ? ' (next day)' : ''}${s.splitFrom ? ' <span class="tag">midnight-split twin</span>' : ''}</div>`).join('') || '<span class="mini muted">none</span>'}
    </div>
  </div>`;
  loadAuditLight();
}
function fmtT(mins) {
  if (mins == null) return '—';
  let h = Math.floor(mins / 60) % 24, m = mins % 60;
  return `${h % 12 || 12}:${String(m).padStart(2, '0')} ${h >= 12 ? 'PM' : 'AM'}`;
}
window.quick86 = async function (itemId, on) {
  let reason = '';
  if (on) { reason = prompt('86 reason (contact affected guests; disable is POS-side):', 'out of stock — service note') || 'out of stock'; }
  try {
    const r = await api('/api/quick', { body: { location: state.location, skill: on ? 'menu.item.86' : 'menu.item.un86', args: on ? { item: itemId, reason } : { item: itemId }, actor: 'web-operator' } });
    toast(r.message, 'good');
    loadMenu();
  } catch (e) { toast(e.message, 'bad'); }
};
$('#publishBtn').onclick = async () => {
  if (!confirm('Publish staged workbench to LIVE menu?\n\nThe engine re-runs integrity checks (empty groups, midnight ranges, dead force rules, isolation, rush+hold). Publish is blocked while HIGH-severity integrity blockers exist.')) return;
  try { await api('/api/publish', { body: { location: state.location, note: 'published from console' } }); toast('Published — live menu updated (backup export written first).', 'good'); loadMenu(); }
  catch (e) {
    if (e.status === 409 && confirm(e.message + '\n\nForce override? (not recommended — evidence is recorded.)')) {
      await api('/api/publish', { body: { location: state.location, override: true, note: 'FORCED override from console' } });
      toast('Published with override.', 'bad');
      loadMenu();
    } else toast(e.message, 'bad');
  }
};
$('#discardBtn').onclick = async () => {
  if (!confirm('Discard staged workbench? Live menu is untouched either way.')) return;
  await api('/api/publish/discard', { body: { location: state.location } });
  toast('Staging discarded.', 'good'); loadMenu();
};

/* ───────────────── audit & menu integrity gauge ───────────────── */
let currentAuditReport = null;
let currentVulnFilter = 'all';

function getGaugeColor(score) {
  if (score < 60) return '#ff5c5c'; // Red (<60)
  if (score < 85) return '#ffb454'; // Amber (60–84)
  return '#41e0a0';                 // Green (85–100)
}

function renderGaugeSvg(score, size = 150, stroke = 11) {
  const r = (size / 2) - (stroke / 2);
  const c = 2 * Math.PI * r;
  const clamped = Math.max(0, Math.min(100, Math.round(score || 0)));
  const offset = c * (1 - clamped / 100);
  const color = getGaugeColor(clamped);
  return `
    <div class="gauge-wrap" style="width:${size}px; height:${size}px">
      <svg class="gauge-svg" viewBox="0 0 ${size} ${size}" style="width:${size}px; height:${size}px">
        <circle class="gauge-track" cx="${size / 2}" cy="${size / 2}" r="${r}" stroke-width="${stroke}" />
        <circle class="gauge-fill" cx="${size / 2}" cy="${size / 2}" r="${r}"
          stroke="${color}" stroke-width="${stroke}"
          stroke-dasharray="${c.toFixed(2)}"
          stroke-dashoffset="${offset.toFixed(2)}"
          style="stroke-dashoffset:${offset.toFixed(2)}; stroke:${color};" />
      </svg>
      <div class="gauge-center">
        <span class="gauge-score" style="color:${color}">${clamped}</span>
        <span class="gauge-score-sub">Score</span>
      </div>
    </div>`;
}

function renderMiniDial(score) {
  const size = 56, stroke = 5;
  const r = (size / 2) - (stroke / 2);
  const c = 2 * Math.PI * r;
  const clamped = Math.max(0, Math.min(100, Math.round(score || 0)));
  const offset = c * (1 - clamped / 100);
  const color = getGaugeColor(clamped);
  return `
    <div class="overview-mini-dial">
      <svg viewBox="0 0 ${size} ${size}">
        <circle fill="none" stroke="#1b2432" stroke-width="${stroke}" cx="${size / 2}" cy="${size / 2}" r="${r}" />
        <circle fill="none" stroke="${color}" stroke-width="${stroke}" stroke-linecap="round" cx="${size / 2}" cy="${size / 2}" r="${r}"
          stroke-dasharray="${c.toFixed(2)}"
          stroke-dashoffset="${offset.toFixed(2)}"
          style="stroke-dashoffset:${offset.toFixed(2)}; stroke:${color};" />
      </svg>
      <span class="overview-mini-score" style="color:${color}">${clamped}</span>
    </div>`;
}

function renderVulnCard(v, idx) {
  const sev = (v.severity || 'MEDIUM').toLowerCase();
  const patch = v.patch;
  const bleedCents = v.marginBleedCents || 0;
  const leakBadge = bleedCents > 0 ? `<span class="vuln-leak">-$${(bleedCents / 100).toFixed(2)} margin bleed</span>` : '';
  const patchId = `patch_btn_${idx}`;

  return `
    <div class="vuln-card ${sev}">
      <div class="vuln-head">
        <span class="badge ${sev === 'critical' ? 'fail' : sev === 'high' ? 'medium' : 'ok'}">${esc(v.severity || 'MEDIUM')}</span>
        <span class="vuln-title">${esc(v.name || v.item || v.title || v.type)}</span>
        <span class="tag">${esc((v.type || 'vulnerability').replace(/_/g, ' '))}</span>
        ${leakBadge}
      </div>
      <div class="vuln-body">
        ${esc(v.explanation || v.detail || '')}
      </div>
      ${v.recommendation ? `
        <div class="vuln-rec">
          <span style="color:#7ae6b5">💡 <b>Recommended Fix:</b></span>
          <span>${esc(v.recommendation)}</span>
        </div>
      ` : ''}
      <div class="vuln-action-row">
        <div class="mini muted">
          ${v.category ? `Category: <b>${esc(v.category)}</b> · ` : ''}
          ${v.group ? `Modifier Group: <b>${esc(v.group)}</b>` : ''}
        </div>
        ${patch ? `
          <button class="patch-btn" id="${patchId}" onclick="applySinglePatch(${idx})">
            ⚡ Apply Recommended Price/Rule Patch
          </button>
        ` : `<span class="mini muted">Manual review recommended</span>`}
      </div>
    </div>
  `;
}

function renderIntegrityDashboard(report) {
  currentAuditReport = report;
  const int = report.integrity_score || { score: 100, rating: 'GREEN', label: 'Protected Margins' };
  const vulns = report.vulnerabilities || { critical: [], high: [], medium: [], total: 0, items: [] };
  const allItems = vulns.items || [];
  const filtered = currentVulnFilter === 'all' ? allItems : allItems.filter(v => (v.severity || '').toLowerCase() === currentVulnFilter);

  const container = $('#integrityGaugeSection');
  if (!container) return;

  const totalBleedCents = allItems.reduce((acc, v) => acc + (v.marginBleedCents || 0), 0);
  const bleedDisplay = totalBleedCents > 0 ? `$${(totalBleedCents / 100).toFixed(2)}/order` : '$0.00';

  container.innerHTML = `
    <div class="card" style="margin-bottom:20px; padding:24px">
      <div class="integrity-dashboard">
        ${renderGaugeSvg(int.score)}
        <div class="integrity-info">
          <div class="integrity-title">
            <span>Menu Integrity &amp; Vulnerability Score</span>
            <span class="badge ${int.rating === 'RED' ? 'fail' : int.rating === 'AMBER' ? 'medium' : 'ok'}">${esc(int.label)}</span>
          </div>
          <div class="integrity-desc">
            Rule-based vulnerability scanning detects price collisions (identical base prices on items with different underlying costs), side-car reconstruction loopholes (modifiers/sides reconstructing signature items at a discount), and unrestricted protein modifier swaps causing margin bleed.
          </div>
          <div class="integrity-stats">
            <span class="vuln-stat-pill critical"><b>${vulns.critical?.length || 0}</b> Critical</span>
            <span class="vuln-stat-pill high"><b>${vulns.high?.length || 0}</b> High</span>
            <span class="vuln-stat-pill medium"><b>${vulns.medium?.length || 0}</b> Medium</span>
            <span class="vuln-stat-pill bleed">Est. Margin Bleed: <b>${bleedDisplay}</b></span>
          </div>
          ${allItems.filter(v => v.patch).length > 0 ? `
            <div style="margin-top:6px; display:flex; justify-content:center">
              <button class="patch-btn" id="applyAllSafePatchesBtn">
                ⚡ Apply All ${allItems.filter(v => v.patch).length} Recommended Patches
              </button>
            </div>
          ` : ''}
        </div>
      </div>
    </div>

    <div class="card" style="margin-bottom:20px">
      <div style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:14px; margin-bottom:16px">
        <div>
          <h3 style="margin:0">Active Margin Leaks &amp; Rule Vulnerabilities <span class="muted">— ${allItems.length} detected</span></h3>
          <div class="mini muted" style="margin-top:3px">One-click patches stage safe corrections directly into your staging workbench without interrupting live sales.</div>
        </div>
        <div class="vuln-filter-row" style="margin-bottom:0">
          <button class="btn ${currentVulnFilter === 'all' ? 'primary' : 'ghost'} small" onclick="setVulnFilter('all')">All (${allItems.length})</button>
          <button class="btn ${currentVulnFilter === 'critical' ? 'primary' : 'ghost'} small" onclick="setVulnFilter('critical')">Critical (${vulns.critical?.length || 0})</button>
          <button class="btn ${currentVulnFilter === 'high' ? 'primary' : 'ghost'} small" onclick="setVulnFilter('high')">High (${vulns.high?.length || 0})</button>
          <button class="btn ${currentVulnFilter === 'medium' ? 'primary' : 'ghost'} small" onclick="setVulnFilter('medium')">Medium (${vulns.medium?.length || 0})</button>
        </div>
      </div>

      <div class="vuln-list-container">
        ${filtered.length ? filtered.map((v, idx) => renderVulnCard(v, idx)).join('') : `
          <div class="empty" style="padding:24px">
            <b>No active vulnerabilities in this category.</b><br>
            <span class="mini muted">Menu integrity rules are fully satisfied for current items.</span>
          </div>
        `}
      </div>
    </div>
  `;

  const applyAllBtn = $('#applyAllSafePatchesBtn');
  if (applyAllBtn) {
    applyAllBtn.onclick = () => applyAllPatches(allItems.filter(v => v.patch));
  }
}

function setVulnFilter(filter) {
  currentVulnFilter = filter;
  if (currentAuditReport) {
    renderIntegrityDashboard(currentAuditReport);
  }
}
window.setVulnFilter = setVulnFilter;

async function applySinglePatch(idx) {
  if (!currentAuditReport || !currentAuditReport.vulnerabilities) return;
  const allItems = currentAuditReport.vulnerabilities.items || [];
  const item = allItems[idx];
  if (!item || !item.patch) return;

  const btn = $(`#patch_btn_${idx}`);
  if (btn) { btn.disabled = true; btn.textContent = 'Applying patch…'; }

  try {
    const res = await api('/api/audit/patch', {
      body: {
        location: state.location,
        patch: item.patch,
      }
    });

    toast(res.message || 'Patch applied to staging workbench', 'good');
    currentAuditReport = res.report;
    renderIntegrityDashboard(res.report);
    renderAuditMetaAndSections(res.report, res.source, res.markdown);
    renderOverviewIntegrityBanner(res.report);
    loadMenu();
  } catch (e) {
    toast('Failed to apply patch: ' + e.message, 'bad');
    if (btn) { btn.disabled = false; btn.textContent = '⚡ Apply Recommended Price/Rule Patch'; }
  }
}
window.applySinglePatch = applySinglePatch;

async function applyAllPatches(itemsWithPatch) {
  if (!itemsWithPatch.length) return;
  const btn = $('#applyAllSafePatchesBtn');
  if (btn) { btn.disabled = true; btn.textContent = 'Applying all patches…'; }

  let applied = 0;
  for (const item of itemsWithPatch) {
    try {
      const res = await api('/api/audit/patch', {
        body: {
          location: state.location,
          patch: item.patch,
        }
      });
      applied++;
      currentAuditReport = res.report;
    } catch (e) {
      console.warn('Failed patching item', item, e);
    }
  }

  toast(`Applied ${applied} recommended patch(es) to staging workbench`, 'good');
  if (currentAuditReport) {
    renderIntegrityDashboard(currentAuditReport);
    renderAuditMetaAndSections(currentAuditReport, 'staging');
    renderOverviewIntegrityBanner(currentAuditReport);
  }
  loadMenu();
}

function renderOverviewIntegrityBanner(report) {
  const el = $('#overviewIntegrityBanner');
  if (!el) return;
  if (!report || !report.integrity_score) {
    el.style.display = 'none';
    return;
  }
  el.style.display = 'flex';
  const int = report.integrity_score;
  const vulns = report.vulnerabilities || { critical: [], high: [], medium: [], total: 0, items: [] };
  const totalBleedCents = (vulns.items || []).reduce((acc, v) => acc + (v.marginBleedCents || 0), 0);
  const bleedDisplay = totalBleedCents > 0 ? `$${(totalBleedCents / 100).toFixed(2)}/order` : '$0.00';

  el.innerHTML = `
    <div class="overview-integrity-left">
      ${renderMiniDial(int.score)}
      <div>
        <div style="font-weight:700; font-size:14px; display:flex; align-items:center; gap:8px">
          <span>Menu Integrity &amp; Vulnerability Score: ${int.score}/100</span>
          <span class="badge ${int.rating === 'RED' ? 'fail' : int.rating === 'AMBER' ? 'medium' : 'ok'}">${esc(int.label)}</span>
        </div>
        <div class="mini muted" style="margin-top:2px">
          ${vulns.total > 0 ? `${vulns.critical?.length || 0} critical, ${vulns.high?.length || 0} high, ${vulns.medium?.length || 0} medium vulnerabilities · Est. bleed: ${bleedDisplay}` : 'All margins protected · Zero rule vulnerabilities detected.'}
        </div>
      </div>
    </div>
    <div style="display:flex; align-items:center; gap:10px">
      <button class="btn small primary" id="overviewToAuditBtn">Inspect &amp; Remediate in Audit View →</button>
    </div>
  `;

  const toAuditBtn = $('#overviewToAuditBtn');
  if (toAuditBtn) {
    toAuditBtn.onclick = () => {
      const auditTabBtn = $('#tabs button[data-tab=audit]');
      if (auditTabBtn) auditTabBtn.click();
    };
  }
}

function renderAuditMetaAndSections(report, source, markdown) {
  const int = report.integrity_score;
  $('#auditMeta').textContent = `source: ${source || 'staging'} · ${report.scanned.total_items} items · Score: ${int?.score || 100}/100 (${int?.label || 'Clean'}) · ${report.summary.total_findings} findings (HIGH ${report.summary.high} / MED ${report.summary.medium} / LOW ${report.summary.low})`;
  $('#auditBody').innerHTML = `
    <div class="result-box" style="margin-bottom:12px"><b>Protocol:</b> ${esc(report.protocol)}</div>
    ${report.sections.map(s => `
      <div class="card" style="margin-bottom:10px">
        <h3>${esc(s.title)} <span class="muted">— ${s.findings.length}</span></h3>
        ${s.findings.length ? s.findings.map(f => `
          <div class="result-box"><span class="badge ${esc(f.severity || 'LOW')}">${esc(f.severity || 'INFO')}</span>
          <b>${esc(f.modifier || f.item || f.group || f.name || f.rule || f.type || '')}</b>
          <div class="mini">${esc(f['86_risk'] || f.explanation || f.maintenance_risk || f.recommendation || f.fix || '')}</div>
          ${f.recommendation ? `<div class="mini muted">→ ${esc(f.recommendation)}</div>` : ''}
          ${f.categories_affected ? `<div class="mini">categories: ${f.categories_affected.map(esc).join(', ')}</div>` : ''}</div>`).join('') : '<span class="mini muted">No findings — clean.</span>'}
      </div>`).join('')}
    <div class="field-row"><button class="btn" onclick="navigator.clipboard.writeText(window.reportMd || '').then(()=>toast('report copied','good'))">Copy markdown report</button>
    <span class="mini muted" style="align-self:center">also written to data/reports/ by the audit workflow</span></div>`;
  if (markdown) window.reportMd = markdown;
}

async function loadAudit() {
  const { report, source, markdown } = await api(`/api/audit?location=${state.location}`);
  renderIntegrityDashboard(report);
  renderAuditMetaAndSections(report, source, markdown);
  renderOverviewIntegrityBanner(report);
}

async function loadAuditOverview() {
  try {
    const { report } = await api(`/api/audit?location=${state.location}`);
    renderOverviewIntegrityBanner(report);
  } catch (e) {
    console.warn('loadAuditOverview error:', e);
  }
}

async function exportAuditReport() {
  try {
    const btn = $('#exportAuditBtn');
    if (btn) { btn.disabled = true; btn.textContent = 'Exporting…'; }
    const r = await api('/api/export', { body: { location: state.location, scope: 'audit-report' } });
    toast(`Audit report exported to data/reports/ (${r.filename})`, 'good');
    loadFiles();
    if (btn) { btn.disabled = false; btn.textContent = 'Export Audit Report'; }
  } catch (e) {
    toast('Failed to export audit report: ' + e.message, 'bad');
    const btn = $('#exportAuditBtn');
    if (btn) { btn.disabled = false; btn.textContent = 'Export Audit Report'; }
  }
}

$('#runAuditBtn').onclick = loadAudit;

/* ───────────────── import/export ───────────────── */
async function loadFiles() {
  const { exports, reports, imports } = await api('/api/files');
  const row = (f, dir) => `<a href="/api/download?dir=${dir}&file=${encodeURIComponent(f.name)}" download><span class="mono">${esc(f.name)}</span><span class="muted">${(f.bytes / 1024).toFixed(1)} KB · ${f.name.endsWith('.csv') ? 'CSV' : f.name.endsWith('.json') ? 'JSON' : 'MD'} · ${f.at.slice(0, 16).replace('T', ' ')}</span></a>`;
  $('#fileList').innerHTML = `
    <div class="mini muted">EXPORTS</div>${exports.map(f => row(f, 'exports')).join('') || '<span class="mini muted">none yet</span>'}
    <div class="mini muted" style="margin-top:8px">REPORTS</div>${reports.map(f => row(f, 'reports')).join('') || '<span class="mini muted">run an audit workflow to generate</span>'}
    ${imports.length ? `<div class="mini muted" style="margin-top:8px">data/imports (server-side files usable by path)</div>${imports.map(f => row(f, 'imports')).join('')}` : ''}`;
}
$('#doImport').onclick = async () => {
  const btn = $('#doImport'); btn.disabled = true; btn.innerHTML = '<span class="spin"></span> importing…';
  try {
    let body = { location: state.location, format: $('#impFormat').value, mode: $('#impMode').value };
    const fileInput = $('#impFile');
    const pasted = $('#impPaste').value.trim();
    if (fileInput.files.length) {
      const f = fileInput.files[0];
      body.filename = f.name;
      body.content = await f.text();
    } else if (pasted) { body.filename = 'pasted.csv'; body.content = pasted; }
    else throw new Error('Choose a file or paste contents.');
    const r = await api('/api/import', { body });
    $('#importResult').innerHTML = `<div class="result-box">
      <b>Imported</b> — format: ${esc(r.format)} · items: ${r.summary.items} · groups: ${r.summary.groups} · categories: ${r.summary.categories} · <span class="tag live">${r.summary.normalized} normalized fix(es)</span>
      <div class="mini muted">Post-import audit: HIGH ${r.auditSummary.high} / MED ${r.auditSummary.medium} / LOW ${r.auditSummary.low} — staged on the workbench (${esc(r.note)}).</div>
      ${r.warnings?.length ? `<div class="mini" style="color:var(--warn)">⚠ ${r.warnings.map(esc).join('<br>⚠ ')}</div>` : ''}
    </div>`;
    toast('Import staged to workbench — review, then publish from the Menu tab.', 'good');
    loadFiles(); loadMenu();
  } catch (e) { toast('Import failed: ' + e.message, 'bad'); }
  btn.disabled = false; btn.textContent = 'Import to staging';
};
$('#doExport').onclick = async () => {
  try {
    const scope = $('#expScope').value;
    const r = await api('/api/export', { body: { location: state.location, scope, format: $('#expFormat').value } });
    const dir = scope === 'audit-report' || scope === 'audit' ? 'reports' : 'exports';
    $('#exportResult').innerHTML = `<div class="result-box"><b>Exported ${scope}</b> <a href="/api/download?dir=${dir}&file=${encodeURIComponent(r.filename)}" download class="mono">${esc(r.filename)}</a> · ${(r.bytes / 1024).toFixed(1)} KB ${r.integrity_score ? `· Integrity Score: ${r.integrity_score.score}/100 (${r.integrity_score.label})` : ''} ${r.verified !== undefined ? '· workflows verified: ' + (r.verified ? '✓' : '✗') : ''}</div>`;
    toast('Export written to ' + (dir === 'reports' ? 'data/reports/' : 'data/exports/'), 'good');
    loadFiles();
  } catch (e) { toast('Export failed: ' + e.message, 'bad'); }
};

/* ───────────────── runs ───────────────── */
async function loadRuns() {
  const { runs } = await api('/api/runs');
  $('#runsBody').innerHTML = runs.length ? `<div class="list-cards">${runs.map(r => `
    <div class="run-row" data-run="${esc(r.id)}">
      <span class="mono muted">${esc(r.startedAt?.slice(5, 16).replace('T', ' ') || '')}</span>
      <b>${esc(r.summary?.title || r.workflowId)}</b>
      <span class="tag">${esc(r.platform)}</span>
      <span class="tag">${esc(r.mode)}</span>
      <span class="badge ${r.status === 'ok' ? 'ok' : r.status === 'failed' || r.status === 'blocked' ? 'fail' : 'medium'}">${esc(r.status)}</span>
      <span class="mini muted">${r.summary.ok}/${r.summary.total} steps · ${r.summary.findings} findings</span>
    </div>`).join('')}</div>` : '<div class="empty">No runs recorded on this location yet.</div>';
  $$('#runsBody .run-row').forEach(el => el.onclick = async () => {
    const { run } = await api(`/api/runs/${el.dataset.run}`);
    const plat = run.platform;
    const { workflow } = await api(`/api/workflows/${plat}/${run.workflowId}`);
    state.platform = plat; renderPlatformSelect();
    state.selected = run.workflowId;
    $('#tabs button[data-tab=workflows]').click();
    await selectWf(run.workflowId);
    $('#wfSteps').innerHTML = `<div class="mini muted" style="margin-bottom:6px">Execution ${run.id} · ${run.mode} · ${run.status}</div>` + renderSteps(workflow, run);
  });
}

/* ───────────────── docs ───────────────── */
async function loadDocs() {
  const { sources } = await api('/api/sources');
  const plats = state.platforms.map(p => { const md = sources[`${p.id}.manual`] || {}; return `
    <div class="plat-card"><b>${esc(p.name)}</b><div class="mini muted">${esc(p.vendor)}</div>
      <div class="bar" style="background:${esc(p.color)}"></div>
      <div class="mini">Portal: ${esc(p.portal)}</div>
      <div class="mini">Bulk file: ${esc(p.bulkFile || '—')}</div>
      <div class="mini">Modifiers: ${esc(p.modifierEncoding || '—')}</div>
      <div class="mini"><a href="${esc(md.url || '#')}" target="_blank" rel="noopener">manual: ${esc((md.title || "owner's manual").split('—')[0].trim())} ↗</a> · repo copy <code>${esc(p.manual || '—')}</code> · ${esc(md.verified || '')}${md.checked ? ' · ' + esc(String(md.checked).slice(0, 10)) : ''}</div>
      <div class="mini muted">${esc(p.notes)}</div>
      <div class="mini" style="margin-top:6px">${Object.entries(p.capabilities || {}).filter(([, v]) => v).map(([k]) => `<span class="tag">${esc(k)}</span>`).join('')}</div>
    </div>`; }).join('');
  const docs = Object.entries(sources).map(([id, d]) => `
    <div class="src-card">
      <div class="hbar"><b>${esc(d.title)}</b><span class="badge verify-${d.verified}">${esc(d.verified)}</span>
      <a class="mini" href="${esc(d.url)}" target="_blank" rel="noopener">open source ↗</a>
      <span class="mono mini muted" style="margin-left:auto">${esc(id)}</span></div>
      <div class="mini muted">${esc(d.publisher)}</div>
      <div class="secs">${Object.entries(d.sections).map(([k, v]) => `<div class="sec"><b>§ ${esc(k)}</b> — ${esc(v)}</div>`).join('')}</div>
    </div>`).join('');
  $('#docsBody').innerHTML = `<h3 style="margin-bottom:10px">Platforms</h3><div class="plat-grid">${plats}</div>
    <h3 style="margin:14px 0 10px">Owner’s manuals & verified sources (${Object.keys(sources).length} docs)</h3>${docs}`;
}

/* ───────────────── skills ───────────────── */
async function loadSkills() {
  const { skills, checks } = await api('/api/skills');
  $('#skillsBody').innerHTML = `
    <div class="card scroll">
      <h3>Executable skills (${skills.length}) — every "auto" workflow step runs one of these</h3>
      <table class="menu"><thead><tr><th>Skill</th><th>Action</th><th>Params</th><th>Risk</th></tr></thead><tbody>
      ${skills.map(s => `<tr><td class="mono">${esc(s.name)}</td><td>${esc(s.title)}<div class="mini muted">${esc(s.description || '')}</div></td>
      <td class="mini">${(s.params || []).map(p => `<span class="tag">${esc(p.name)}${p.required ? '*' : ''}</span>`).join('')}</td>
      <td>${s.destructive ? '<span class="badge high">destructive</span>' : '<span class="badge low">safe</span>'}</td></tr>`).join('')}
      </tbody></table>
    </div>
    <div class="card" style="margin-top:12px"><h3>Post-step verification checks (${checks.length})</h3>
      ${checks.map(c => `<div class="mini"><span class="mono">${esc(c.name)}</span> — ${esc(c.title)}</div>`).join('')}</div>`;
}

/* ───────────────── firebase cloud backend ───────────────── */
function updateFbStatusUi(st) {
  const dot = $('#fbDot');
  const txt = $('#fbChipText');
  if (!dot || !txt) return;
  if (st.connected) {
    dot.className = 'dot fb-dot connected';
    txt.textContent = 'Firebase Connected';
  } else if (st.testing) {
    dot.className = 'dot fb-dot';
    txt.textContent = 'Checking Cloud…';
  } else if (st.error) {
    dot.className = 'dot fb-dot error';
    txt.textContent = 'Firebase Offline';
  } else {
    dot.className = 'dot fb-dot connected';
    txt.textContent = 'Firebase Ready';
  }
}

function updateFbUserUi(user) {
  const btn = $('#fbAuthLabel');
  if (!btn) return;
  if (user) {
    const name = user.displayName || user.email?.split('@')[0] || 'User';
    btn.textContent = `${name} (Sign Out)`;
  } else {
    btn.textContent = 'Sign In';
  }
}

async function loadFirebaseDashboard() {
  const body = $('#firebaseBody');
  if (!body) return;
  body.innerHTML = '<div class="card"><div class="mini muted">Querying Firebase Cloud status…</div></div>';

  let srvStatus = {};
  try {
    srvStatus = await api('/api/firebase/status');
  } catch (e) {
    srvStatus = { ok: false, error: e.message };
  }

  const clientStatus = window.firebaseClient ? window.firebaseClient.getStatus() : {};
  const user = window.firebaseClient ? window.firebaseClient.getUser() : null;
  const cfg = window.firebaseClient ? window.firebaseClient.getConfig() : {};

  body.innerHTML = `
    <div class="fb-grid">
      <div class="fb-card">
        <h3><span class="dot fb-dot ${srvStatus.ok || clientStatus.connected ? 'connected' : 'error'}"></span> Cloud Firestore Status</h3>
        <div class="fb-prop-row">
          <span class="fb-prop-label">Connection State</span>
          <span class="fb-badge ${srvStatus.ok || clientStatus.connected ? 'green' : 'yellow'}">${srvStatus.ok || clientStatus.connected ? 'ONLINE / CONNECTED' : 'STANDBY'}</span>
        </div>
        <div class="fb-prop-row">
          <span class="fb-prop-label">Project ID</span>
          <span class="fb-prop-val">${esc(cfg?.projectId || srvStatus.projectId || 'gen-lang-client-0581891121')}</span>
        </div>
        <div class="fb-prop-row">
          <span class="fb-prop-label">Database ID</span>
          <span class="fb-prop-val">${esc(cfg?.firestoreDatabaseId || srvStatus.databaseId || 'ai-studio-menuflowpos-21bf5099-cf9c-49be-8621-e53deee1c4b5')}</span>
        </div>
        <div class="fb-prop-row">
          <span class="fb-prop-label">Security Rules</span>
          <span class="fb-badge green">ACTIVE · ABAC ENFORCED</span>
        </div>
        <div class="fb-prop-row">
          <span class="fb-prop-label">Last Ping</span>
          <span class="fb-prop-val">${esc(srvStatus.timestamp || new Date().toISOString())}</span>
        </div>
        <div style="margin-top:16px; display:flex; gap:10px;">
          <button class="btn primary btn-sm" id="fbTestPingBtn">Test Cloud Ping</button>
          <button class="btn blue btn-sm" id="fbDashSyncBtn">Force Cloud Sync</button>
        </div>
      </div>

      <div class="fb-card">
        <h3><svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor" style="color:#60a5fa"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 3c1.66 0 3 1.34 3 3s-1.34 3-3 3-3-1.34-3-3 1.34-3 3-3zm0 14.2c-2.5 0-4.71-1.28-6-3.22.03-1.99 4-3.08 6-3.08 1.99 0 5.97 1.09 6 3.08-1.29 1.94-3.5 3.22-6 3.22z"/></svg> Authentication & RBAC</h3>
        <div class="fb-prop-row">
          <span class="fb-prop-label">Auth Provider</span>
          <span class="fb-badge blue">GOOGLE IDENTITY</span>
        </div>
        <div class="fb-prop-row">
          <span class="fb-prop-label">Current User</span>
          <span class="fb-prop-val">${esc(user ? (user.displayName || user.email) : 'Unauthenticated (Viewer)')}</span>
        </div>
        <div class="fb-prop-row">
          <span class="fb-prop-label">User Email</span>
          <span class="fb-prop-val">${esc(user?.email || '—')}</span>
        </div>
        <div class="fb-prop-row">
          <span class="fb-prop-label">Assigned Role</span>
          <span class="fb-badge ${user?.email === 'chrisfbailey.CB@gmail.com' ? 'green' : 'yellow'}">${user?.email === 'chrisfbailey.CB@gmail.com' ? 'ADMIN (SUPERVISOR)' : (user ? 'OPERATOR' : 'VIEWER')}</span>
        </div>
        <div style="margin-top:16px;">
          <button class="btn ghost btn-sm" id="fbDashAuthBtn">${user ? 'Sign Out of Google' : 'Sign In with Google'}</button>
        </div>
      </div>
    </div>

    <div class="fb-card" style="margin-top:16px;">
      <h3>Cloud Firestore Collections Schema</h3>
      <p class="muted mini">Intermediate blueprint synchronized with ABAC zero-trust firestore.rules security gates:</p>
      <div class="fb-coll-grid">
        <div class="fb-coll-item">
          <div class="fb-coll-name">/locations/{id}</div>
          <div class="fb-coll-desc">Venue profile, POS platform assignment, and timezone metadata</div>
        </div>
        <div class="fb-coll-item">
          <div class="fb-coll-name">/menus/{locId}</div>
          <div class="fb-coll-desc">Live production and staging menu trees, version stamps, and publish notes</div>
        </div>
        <div class="fb-coll-item">
          <div class="fb-coll-name">/runs/{runId}</div>
          <div class="fb-coll-desc">Immutable audit trails and execution histories for multi-platform operations</div>
        </div>
        <div class="fb-coll-item">
          <div class="fb-coll-name">/approvals/{id}</div>
          <div class="fb-coll-desc">Gate authorization evidence for staging-to-live publish actions</div>
        </div>
        <div class="fb-coll-item">
          <div class="fb-coll-name">/audits/{id}</div>
          <div class="fb-coll-desc">Menu integrity dial evaluation scores and vulnerability breakdowns</div>
        </div>
        <div class="fb-coll-item">
          <div class="fb-coll-name">/users/{uid}</div>
          <div class="fb-coll-desc">User profiles and verified RBAC authority assignments</div>
        </div>
        <div class="fb-coll-item">
          <div class="fb-coll-name">/test/{docId}</div>
          <div class="fb-coll-desc">Heartbeat ping verification doc as required by Firebase skill</div>
        </div>
      </div>
    </div>
  `;

  $('#fbTestPingBtn').onclick = async () => {
    toast('Pinging Firestore heartbeat endpoint…');
    if (window.firebaseClient) {
      const ok = await window.firebaseClient.testConnection();
      toast(ok ? 'Firestore heartbeat ping succeeded!' : 'Firestore connection check failed.', ok ? 'good' : 'bad');
    } else {
      const st = await api('/api/firebase/status');
      toast(st.ok ? 'Backend Firestore connection confirmed!' : 'Firestore ping error: ' + st.error, st.ok ? 'good' : 'bad');
    }
    loadFirebaseDashboard();
  };

  $('#fbDashSyncBtn').onclick = async () => {
    $('#fbSyncBtn').click();
  };

  $('#fbDashAuthBtn').onclick = async () => {
    $('#fbAuthBtn').click();
    setTimeout(loadFirebaseDashboard, 1000);
  };
}

boot().then(refreshMode).catch(e => toast('Boot failed: ' + e.message, 'bad'));

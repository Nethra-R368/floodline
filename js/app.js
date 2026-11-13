import { extractRules } from './core/extract.js';
import { buildState, mergeEvents, eventId, followUpText, alreadyRescuedText } from './core/store.js';
import { fmtMinutes } from './core/priority.js';
import { generateNight, tripMinutes } from './core/sim.js';
import { splitMessages } from './core/input.js';
import { HARD_SET } from './core/hardset.js';
import { extractWithGemini } from './gemini.js';
import { createMap } from './map.js';
import { initBench } from './bench.js';
import { $, esc, store, toast, copyText } from './util.js';

const SEED = 2023;
const DEMO_START = 20 * 60; // the simulated night starts at 20:00
const NIGHT_END = 720;
const BOATS = 10;
const TAB = Math.random().toString(36).slice(2, 8);

const els = {
  workspace: $('workspace'), presence: $('presence'), meBtn: $('meBtn'), meName: $('meName'), themeBtn: $('themeBtn'),
  settingsBtn: $('settingsBtn'), settingsDialog: $('settingsDialog'), apiKey: $('apiKey'), rememberKey: $('rememberKey'), model: $('model'), useAi: $('useAi'),
  nameDialog: $('nameDialog'), nameInput: $('nameInput'),
  clock: $('clock'), clockLabel: $('clockLabel'), stats: $('stats'), replayCtl: $('replayCtl'), play: $('playBtn'), speed: $('speed'), autoBoats: $('autoBoats'), reset: $('resetBtn'),
  paste: $('pasteBox'), add: $('addBtn'), sampleBtn: $('sampleBtn'), inboxStatus: $('inboxStatus'), aiState: $('aiState'),
  offers: $('offers'), offerCount: $('offerCount'), feed: $('feed'),
  queue: $('queue'), emptyQueue: $('emptyQueue'), search: $('search'),
  drawer: $('drawer'), drawerBack: $('drawerBack'),
  exportBtn: $('exportBtn'), importFile: $('importFile'),
};

// ---------------- workspace (event log + replay state), persisted per browser ----------------
let ws = store.get('floodline.workspace') === 'live' ? 'live' : 'demo';
let W = loadWorkspace(ws);
let state = null;
let filter = 'action';
let query = '';
let openCaseId = null;
let timer = null;
let night = null;
const seenCases = new Set();
let firstRender = true;
const me = { name: store.get('floodline.me') || '' };
const ai = { key: store.get('floodline.key') || '', model: store.get('floodline.model') || 'gemini-2.5-flash', use: store.get('floodline.useAi') !== '0' };

function loadWorkspace(name) {
  try {
    const w = JSON.parse(store.get(`floodline.ws.${name}`) || 'null');
    if (w && Array.isArray(w.events)) return { clock: 0, cursor: 0, boats: null, ...w };
  } catch { /* corrupted: start fresh */ }
  return { events: [], clock: 0, cursor: 0, boats: null };
}
let saveTimer = null;
function saveWorkspace() {
  clearTimeout(saveTimer);
  saveTimer = setTimeout(() => store.set(`floodline.ws.${ws}`, JSON.stringify(W)), 300);
}
const nowMin = () => (ws === 'demo' ? W.clock : Date.now() / 60000);
const getNight = () => (night ||= generateNight({ seed: SEED }));

function fmtClock(min) {
  if (ws === 'demo') {
    const t = Math.floor(DEMO_START + min) % 1440;
    return `${String(Math.floor(t / 60)).padStart(2, '0')}:${String(t % 60).padStart(2, '0')}`;
  }
  return new Date(min * 60000).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

// ---------------- sync between volunteers (tabs/windows on this device) ----------------
let chan = null;
const peers = new Map();
function openChannel() {
  try { chan?.close(); } catch { /* ignore */ }
  try {
    chan = new BroadcastChannel(`floodline-${ws}`);
    chan.onmessage = ({ data }) => {
      if (!data || data.tab === TAB) return;
      if (data.type === 'events') { W.events = mergeEvents(W.events, data.events); saveWorkspace(); scheduleRender(); }
      else if (data.type === 'clock') { if (!timer && data.clock > W.clock) { W.clock = data.clock; W.cursor = data.cursor; scheduleRender(); } }
      else if (data.type === 'reset') { W = { events: [], clock: 0, cursor: 0, boats: null }; saveWorkspace(); scheduleRender(); }
      else if (data.type === 'hello') { peers.set(data.tab, { name: data.name, at: Date.now() }); renderPresence(); }
    };
  } catch { chan = null; }
}
const send = (msg) => { try { chan?.postMessage({ ...msg, tab: TAB }); } catch { /* ignore */ } };
function renderPresence() {
  const now = Date.now();
  for (const [k, p] of peers) if (now - p.at > 10000) peers.delete(k);
  const n = peers.size + 1;
  els.presence.textContent = `● ${n} volunteer${n === 1 ? '' : 's'} online`;
  els.presence.title = ['You', ...[...peers.values()].map((p) => p.name || 'Unnamed volunteer')].join(', ');
}
setInterval(() => { send({ type: 'hello', name: me.name }); renderPresence(); }, 4000);

function addEvents(evs) {
  if (!evs.length) return;
  W.events.push(...evs);
  saveWorkspace();
  send({ type: 'events', events: evs });
  scheduleRender();
}

// ---------------- replay of the simulated night ----------------
function setPlaying(on) {
  if (on && !timer) {
    if (W.clock >= NIGHT_END) { toast('The night is over. Press Reset to replay.'); return; }
    timer = setInterval(tick, 250);
  } else if (!on && timer) {
    clearInterval(timer);
    timer = null;
  }
  els.play.textContent = timer ? '⏸ Pause' : W.clock >= NIGHT_END ? '✓ Night over' : W.clock > 0 ? '▶ Resume' : '▶ Play the night';
}

function tick() {
  W.clock = Math.min(NIGHT_END, W.clock + Number(els.speed.value) / 4);
  const msgs = getNight().messages;
  const evs = [];
  while (W.cursor < msgs.length && msgs[W.cursor].at <= W.clock) {
    const m = msgs[W.cursor++];
    evs.push({ t: 'report', id: `d${m.id}`, at: m.at, text: m.text, source: 'WhatsApp group (simulated)', x: extractRules(m.text) });
  }
  if (evs.length) { W.events.push(...evs); send({ type: 'events', events: evs }); }
  if (els.autoBoats.checked) runBoats();
  send({ type: 'clock', clock: W.clock, cursor: W.cursor });
  saveWorkspace();
  if (W.clock >= NIGHT_END) { setPlaying(false); toast('Night over: open the Proof tab to compare with manual coordination.'); }
  scheduleRender();
}

/** Ten simulated boat teams take the top unassigned case whenever they are free. */
function runBoats() {
  if (!W.boats) W.boats = Array.from({ length: BOATS }, (_, i) => ({ name: `Boat ${i + 1}`, freeAt: 0, caseId: null, arriveAt: null }));
  const st = buildState(W.events, W.clock);
  const evs = [];
  for (const b of W.boats) {
    if (b.caseId && b.arriveAt <= W.clock) {
      const c = st.cases.find((k) => k.reportIds.includes(b.caseId));
      if (c && c.status === 'enroute' && c.owner === b.name) {
        evs.push({ t: 'status', id: eventId('s'), at: b.arriveAt, caseId: c.id, status: 'rescued', by: b.name, note: 'Family picked up' });
      }
      b.caseId = null;
    }
  }
  const taken = new Set();
  for (const b of W.boats) {
    if (b.caseId || b.freeAt > W.clock) continue;
    const c = st.cases.find((k) => k.status === 'new' && !k.flags.includes('says-safe') && !taken.has(k.id));
    if (!c) break;
    taken.add(c.id);
    const trip = c.lat != null ? tripMinutes({ lat: c.lat, lng: c.lng }) : 60;
    evs.push({ t: 'claim', id: eventId('c'), at: W.clock, caseId: c.id, by: b.name });
    evs.push({ t: 'status', id: eventId('s'), at: W.clock, caseId: c.id, status: 'enroute', by: b.name, note: `ETA ${Math.round(trip / 2)} min` });
    b.caseId = c.id;
    b.arriveAt = W.clock + trip / 2;
    b.freeAt = W.clock + trip;
  }
  if (evs.length) { W.events.push(...evs); send({ type: 'events', events: evs }); }
}

els.play.addEventListener('click', () => setPlaying(!timer));
els.reset.addEventListener('click', () => {
  if (W.events.length && !confirm('Clear this board and start the night again?')) return;
  setPlaying(false);
  W = { events: [], clock: 0, cursor: 0, boats: null };
  seenCases.clear();
  firstRender = true;
  closeDrawer();
  saveWorkspace();
  send({ type: 'reset' });
  setPlaying(false);
  scheduleRender();
});

// ---------------- inbox ----------------
async function addPasted() {
  const parts = splitMessages(els.paste.value);
  if (!parts.length) { els.inboxStatus.textContent = 'Paste at least one message first.'; return; }
  const at = nowMin();
  const evs = parts.map((p, i) => ({
    t: 'report', id: eventId('r'), at: at + i / 1000, text: p.text,
    source: p.sender ? `WhatsApp · ${p.sender}` : 'Pasted', x: extractRules(p.text),
  }));
  addEvents(evs);
  els.paste.value = '';
  const kinds = evs.reduce((m, e) => ({ ...m, [e.x.kind]: (m[e.x.kind] || 0) + 1 }), {});
  els.inboxStatus.textContent = `Added ${evs.length} message${evs.length > 1 ? 's' : ''}: ${Object.entries(kinds).map(([k, n]) => `${n} ${k}`).join(', ')}.`;
  if (ai.use && ai.key) {
    els.inboxStatus.textContent += ' Gemini is double-checking…';
    try {
      const xs = await extractWithGemini(evs.map((e) => e.text), ai.key, ai.model);
      const later = nowMin();
      addEvents(xs.map((x, i) => ({ t: 'extract', id: eventId('x'), at: later, reportId: evs[i].id, x })));
      const blocked = xs.reduce((s, x) => s + (x.guard ? x.guard.filter((g) => /Blocked|Ignored/.test(g)).length : 0), 0);
      const changed = xs.filter((x, i) => JSON.stringify([x.kind, x.areaId, x.people, x.water, x.vulnerable]) !== JSON.stringify([evs[i].x.kind, evs[i].x.areaId, evs[i].x.people, evs[i].x.water, evs[i].x.vulnerable])).length;
      els.inboxStatus.textContent = `Added ${evs.length}. Gemini checked them: improved ${changed}, guardrails blocked ${blocked} detail${blocked === 1 ? '' : 's'} not found in the text.`;
    } catch (err) {
      els.inboxStatus.textContent = `Added ${evs.length} with rules. AI check skipped: ${err.message}`;
    }
  }
}
els.add.addEventListener('click', addPasted);
els.paste.addEventListener('keydown', (e) => { if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) addPasted(); });
els.sampleBtn.addEventListener('click', () => {
  const pick = [4, 5, 0, 16, 22, 6, 7, 12];
  els.paste.value = pick.map((i) => HARD_SET[i].text).join('\n\n');
  els.paste.focus();
  els.inboxStatus.textContent = 'Real-world style messages loaded. Press "Add to board".';
});

// ---------------- rendering ----------------
let renderQueued = false;
function scheduleRender() {
  if (renderQueued) return;
  renderQueued = true;
  const run = () => { if (!renderQueued) return; renderQueued = false; render(); };
  // background tabs pause requestAnimationFrame; a timeout keeps hidden volunteers' boards current
  if (document.hidden) setTimeout(run, 50); else requestAnimationFrame(run);
}

const VULN_LABEL = { pregnant: '🤰 pregnant', medical: '🩺 medical', infant: '👶 baby', elderly: '👵 elderly', disabled: '♿ cannot walk' };
const WATER_LABEL = { knee: 'knee water', waist: 'waist water', neck: 'neck-deep', roof: 'on terrace' };
const STATUS_LABEL = { new: 'Unassigned', claimed: 'Claimed', enroute: 'On the way', rescued: 'Rescued', unreachable: 'Not reached' };
const FLAG_LABEL = { stale: '⚠ NO ONE ON IT', check: 'CHECK IN', reshared: 'RE-SHARED AFTER RESCUE', 'says-safe': 'SAYS SAFE NOW' };
const isDone = (c) => c.status === 'rescued' || c.status === 'unreachable';

function matchesFilter(c) {
  if (filter === 'action' && !(c.status === 'new' || c.flags.includes('check') || c.flags.includes('says-safe'))) return false;
  if (filter === 'assigned' && !(c.status === 'claimed' || c.status === 'enroute')) return false;
  if (filter === 'done' && !isDone(c)) return false;
  if (query) {
    const hay = `${c.areaName} ${c.address} ${c.phones.join(' ')} ${c.owner || ''} ${c.reports.map((r) => r.text).join(' ')}`.toLowerCase();
    if (!hay.includes(query)) return false;
  }
  return true;
}

function caseTitle(c) {
  return `${c.people ? `${c.people} ${c.people === 1 ? 'person' : 'people'}` : 'Household'} · ${esc(c.areaName)}`;
}

function caseHtml(c, rank) {
  const chips = [
    ...c.vulnerable.map((v) => `<span class="chip v">${VULN_LABEL[v]}</span>`),
    c.water ? `<span class="chip w">${WATER_LABEL[c.water]}</span>` : '',
    c.reportIds.length > 1 ? `<span class="chip rep">reported ${c.reportIds.length}×</span>` : '',
    ...c.needs.filter((n) => n !== 'rescue').map((n) => `<span class="chip">${n}</span>`),
  ].join('');
  const flags = c.flags.map((f) => `<span class="flag ${f}">${FLAG_LABEL[f]}</span>`).join('');
  const wait = c.status === 'new' ? `waiting ${fmtMinutes(c.waiting)}` : c.owner ? esc(c.owner) : '';
  const fresh = !firstRender && !seenCases.has(c.id) ? ' new-flash' : '';
  return `<li><button type="button" class="case t-${c.tier} s-${c.status}${fresh}" data-id="${esc(c.id)}">
    <span class="rank">${isDone(c) ? '✓' : `#${rank}`}<span class="score" style="color:var(--${isDone(c) ? 'done' : c.tier})">${c.score}</span></span>
    <span><h3>${caseTitle(c)}</h3><div class="addr">${esc(c.address || 'No street given')}${c.phones[0] ? ` · ${esc(c.phones[0])}` : ''}</div><div class="chips">${chips}</div></span>
    <span class="side"><span class="badge ${c.status}">${STATUS_LABEL[c.status]}</span><span class="wait">${wait}</span>${flags}</span>
  </button></li>`;
}

function render() {
  const now = nowMin();
  state = buildState(W.events, now);
  const s = state.stats;
  els.clock.textContent = fmtClock(now);
  els.clockLabel.textContent = ws === 'demo' ? `Simulated night · ${Math.round((W.clock / NIGHT_END) * 100)}%` : 'Live';
  els.stats.innerHTML = [
    ['Unassigned', s.unassigned, s.unassigned ? 'alert' : ''],
    ['Critical open', s.critical, s.critical ? 'alert' : ''],
    ['No one on it 45m+', s.stale, s.stale ? 'alert' : ''],
    ['Rescued', s.rescued, 'good'],
    ['Repeats merged', s.merged, ''],
    ['Messages', s.messages, ''],
  ].map(([label, v, cls]) => `<div class="stat ${cls}"><b>${v}</b><span>${label}</span></div>`).join('');

  const active = state.cases.filter((c) => !isDone(c));
  const rankOf = new Map(active.map((c, i) => [c.id, i + 1]));
  const shown = state.cases.filter(matchesFilter).slice(0, 200);
  els.queue.innerHTML = shown.map((c) => caseHtml(c, rankOf.get(c.id))).join('');
  els.emptyQueue.classList.toggle('hidden', shown.length > 0);
  $('fAction').textContent = state.cases.filter((c) => c.status === 'new' || c.flags.includes('check') || c.flags.includes('says-safe')).length;
  $('fAssigned').textContent = state.cases.filter((c) => c.status === 'claimed' || c.status === 'enroute').length;
  $('fDone').textContent = state.cases.filter(isDone).length;

  els.offerCount.textContent = state.offers.length;
  els.offers.innerHTML = state.offers.slice(-8).reverse().map((o) => `<li>${esc(o.text)}</li>`).join('') || '<li class="muted">Boat and food offers show up here.</li>';
  els.feed.innerHTML = [...state.reports].sort((a, b) => b.at - a.at).slice(0, 12)
    .map((r) => `<li><span class="kind k-${r.x.kind}">${r.x.kind}</span><span class="muted small">${fmtClock(r.at)}</span> ${esc(r.text.length > 140 ? `${r.text.slice(0, 140)}…` : r.text)}</li>`).join('') || '<li class="muted">Nothing yet.</li>';

  mapApi.update(state.cases);
  state.cases.forEach((c) => seenCases.add(c.id));
  firstRender = false;
  els.aiState.textContent = ai.key && ai.use ? '🤖 Gemini + rules' : 'rules only (offline)';
  if (openCaseId) renderDrawer();
}

els.queue.addEventListener('click', (e) => {
  const btn = e.target.closest('.case');
  if (btn) openDrawer(btn.dataset.id);
});
document.querySelectorAll('.filter').forEach((b) => b.addEventListener('click', () => {
  filter = b.dataset.filter;
  document.querySelectorAll('.filter').forEach((x) => x.classList.toggle('active', x === b));
  render();
}));
els.search.addEventListener('input', () => { query = els.search.value.trim().toLowerCase(); render(); });

// ---------------- case drawer ----------------
function findCase(id) {
  return state.cases.find((c) => c.id === id) || state.cases.find((c) => c.reportIds.includes(id));
}
function openDrawer(id) {
  openCaseId = id;
  els.drawer.classList.remove('hidden');
  els.drawerBack.classList.remove('hidden');
  renderDrawer();
  const c = findCase(id);
  if (c) mapApi.focus(c);
  els.drawer.querySelector('.close')?.focus();
}
function closeDrawer() {
  openCaseId = null;
  els.drawer.classList.add('hidden');
  els.drawerBack.classList.add('hidden');
}
els.drawerBack.addEventListener('click', closeDrawer);
document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && openCaseId) closeDrawer(); });

function renderDrawer() {
  const c = findCase(openCaseId);
  if (!c) { closeDrawer(); return; }
  openCaseId = c.id;
  const maxPts = 40;
  const why = c.reasons.map((r) => `<div class="why-row ${r.points < 0 ? 'neg' : ''}"><div>${esc(r.label)}<div class="bar"><i style="width:${Math.min(100, (Math.abs(r.points) / maxPts) * 100)}%"></i></div></div><b>${r.points > 0 ? '+' : ''}${r.points}</b></div>`).join('');
  const actBtn = (status, label, cls = 'secondary') => `<button type="button" class="${cls}" data-act="${status}">${label}</button>`;
  const actions = [];
  if (c.status === 'new') actions.push(actBtn('claim', '✋ I’ll take this', 'primary'));
  if (c.status === 'new' || c.status === 'claimed') actions.push(actBtn('enroute', '🛶 Boat on the way'));
  if (!isDone(c)) actions.push(actBtn('rescued', '✓ Rescued', 'rescued'), actBtn('unreachable', 'Couldn’t reach'));
  else actions.push(actBtn('open', '↺ Reopen'));
  const phones = c.phones.map((p) => `<a class="secondary file-btn" href="tel:+91${p}">📞 ${p.slice(0, 5)} ${p.slice(5)}</a><a class="secondary file-btn" href="https://wa.me/91${p}?text=${encodeURIComponent(followUpText(c, 'both'))}" target="_blank" rel="noopener">WhatsApp</a>`).join('');
  const follow = followUpText(c);
  const merges = c.merges.length ? `<div class="merge-note">🔗 ${c.reportIds.length} reports merged into this case: ${[...new Set(c.merges.map((m) => m.why))].join(', ')}.</div>` : '';
  const reports = c.reports.map((r) => `<div class="msg"><div class="meta"><span>${fmtClock(r.at)}</span><span>${esc(r.source || '')}</span><span>${r.x.lang}</span><span class="src ${r.x.source === 'ai' ? 'ai' : ''}">${r.x.source === 'ai' ? '🤖 AI-checked' : 'rules'}</span></div>${esc(r.text)}${(r.x.guard || []).filter((g) => /Blocked|Ignored/.test(g)).map((g) => `<div class="guard">🛡 ${esc(g)}</div>`).join('')}</div>`).join('');
  const safe = c.safeReports.length && !isDone(c) ? `<section><h4>Family says they are safe</h4>${c.safeReports.map((u) => `<div class="msg">${esc(u.text)}</div>`).join('')}<button type="button" class="rescued" data-act="rescued">✓ Confirm safe, close case</button></section>` : '';
  const reshared = c.reshared ? `<section><h4>Still being shared after rescue (${c.reshared}×)</h4><div class="copybox" id="rescuedText">${esc(alreadyRescuedText(c, fmtClock(c.resolvedAt)))}</div><div class="row"><button type="button" class="secondary" data-copy="rescuedText">Copy reply for the group</button></div></section>` : '';
  const history = c.history.map((h) => `<li><b>${fmtClock(h.at)}</b> ${esc(h.by || '')} ${h.t === 'claim' ? 'took the case' : `→ ${STATUS_LABEL[h.status] || h.status}`}${h.note ? ` · ${esc(h.note)}` : ''}</li>`).join('');

  els.drawer.innerHTML = `
    <button type="button" class="ghost close" aria-label="Close">✕</button>
    <span class="badge ${c.status}">${STATUS_LABEL[c.status]}</span> <span class="badge" style="color:var(--${c.tier})">${c.tier} · ${c.score} pts</span>
    ${c.flags.map((f) => `<span class="flag ${f}">${FLAG_LABEL[f]}</span>`).join(' ')}
    <h2>${caseTitle(c)}</h2>
    <div class="muted">${esc(c.address || 'No street given')}</div>
    <div class="small muted">First reported ${fmtClock(c.firstAt)} · ${c.status === 'new' ? `waiting ${fmtMinutes(c.waiting)} with no one assigned` : c.owner ? `with ${esc(c.owner)}` : ''}</div>
    <section><h4>What to do</h4><div class="actions">${actions.join('')}</div><div class="actions" style="margin-top:8px">${phones || '<span class="small muted">No phone number in any report. Ask the people who shared it.</span>'}</div></section>
    ${safe}
    <section><h4>Why it is ranked here</h4><div class="why">${why || '<span class="small muted">No urgency signals found.</span>'}</div></section>
    <section><h4>Details</h4><dl class="facts">
      <dt>Area</dt><dd>${esc(c.areaName)}</dd>
      <dt>Address</dt><dd>${esc(c.address || '—')}</dd>
      <dt>People</dt><dd>${c.people ?? 'not stated'}</dd>
      <dt>Vulnerable</dt><dd>${c.vulnerable.map((v) => VULN_LABEL[v]).join(', ') || 'none mentioned'}</dd>
      <dt>Water</dt><dd>${c.water ? WATER_LABEL[c.water] : 'not stated'}</dd>
      <dt>Needs</dt><dd>${c.needs.join(', ') || '—'}</dd>
      <dt>Contact</dt><dd>${esc(c.name || '')} ${c.phones.join(', ') || '—'}</dd>
    </dl></section>
    <section><h4>Follow-up message (closes the loop)</h4><div class="copybox" id="followText">${esc(follow)}</div><div class="row"><button type="button" class="secondary" data-copy="followText">Copy</button></div></section>
    ${reshared}
    <section><h4>Reports (${c.reportIds.length})</h4>${merges}${reports}</section>
    <section><h4>History</h4><ul class="timeline">${history || '<li class="muted">No actions yet.</li>'}</ul></section>`;

  els.drawer.querySelector('.close').addEventListener('click', closeDrawer);
  els.drawer.querySelectorAll('[data-act]').forEach((b) => b.addEventListener('click', () => act(c, b.dataset.act)));
  els.drawer.querySelectorAll('[data-copy]').forEach((b) => b.addEventListener('click', () => copyText($(b.dataset.copy).textContent)));
}

async function ensureName() {
  if (me.name) return true;
  els.nameInput.value = '';
  els.nameDialog.showModal();
  await new Promise((r) => els.nameDialog.addEventListener('close', r, { once: true }));
  return !!me.name;
}

async function act(c, what) {
  if (!(await ensureName())) { toast('Set your volunteer name first'); return; }
  const at = nowMin();
  if (what === 'claim') addEvents([{ t: 'claim', id: eventId('c'), at, caseId: c.id, by: me.name }]);
  else {
    const evs = [];
    if (c.status === 'new' && what !== 'open') evs.push({ t: 'claim', id: eventId('c'), at, caseId: c.id, by: me.name });
    evs.push({ t: 'status', id: eventId('s'), at, caseId: c.id, status: what, by: me.name });
    addEvents(evs);
  }
  toast(what === 'claim' ? 'Case is yours. Others can see it.' : `Marked: ${STATUS_LABEL[what] || 'reopened'}`);
}

// ---------------- settings, name, theme, workspace, export ----------------
function updateMe() { els.meName.textContent = me.name || 'Set name'; }
els.meBtn.addEventListener('click', () => { els.nameInput.value = me.name; els.nameDialog.showModal(); });
els.nameDialog.addEventListener('close', () => {
  const v = els.nameInput.value.trim();
  if (els.nameDialog.returnValue === 'ok' && v) { me.name = v; store.set('floodline.me', v); updateMe(); send({ type: 'hello', name: me.name }); }
});

els.settingsBtn.addEventListener('click', () => {
  els.apiKey.value = ai.key;
  els.rememberKey.checked = !!store.get('floodline.key');
  els.model.value = ai.model;
  els.useAi.checked = ai.use;
  els.settingsDialog.showModal();
});
els.settingsDialog.addEventListener('close', () => {
  if (els.settingsDialog.returnValue !== 'save') return;
  ai.key = els.apiKey.value.trim();
  ai.model = els.model.value.trim() || 'gemini-2.5-flash';
  ai.use = els.useAi.checked;
  if (els.rememberKey.checked && ai.key) store.set('floodline.key', ai.key); else store.remove('floodline.key');
  store.set('floodline.model', ai.model);
  store.set('floodline.useAi', ai.use ? '1' : '0');
  render();
});

els.exportBtn.addEventListener('click', () => {
  const blob = new Blob([JSON.stringify({ app: 'FloodLine', workspace: ws, exportedAt: new Date().toISOString(), events: W.events }, null, 1)], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `floodline-${ws}-${new Date().toISOString().slice(0, 16).replace(/[:T]/g, '-')}.json`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
});
els.importFile.addEventListener('change', async () => {
  const f = els.importFile.files[0];
  if (!f) return;
  try {
    const data = JSON.parse(await f.text());
    const evs = (Array.isArray(data) ? data : data.events || []).filter((e) => e && e.id && e.t && typeof e.at === 'number');
    W.events = mergeEvents(W.events, evs);
    saveWorkspace();
    send({ type: 'events', events: evs });
    toast(`Imported ${evs.length} events`);
    els.settingsDialog.close();
    render();
  } catch { toast('That file is not a FloodLine log'); }
  els.importFile.value = '';
});

const systemDark = window.matchMedia('(prefers-color-scheme: dark)');
const isDark = () => (document.documentElement.dataset.theme || (systemDark.matches ? 'dark' : 'light')) === 'dark';
function applyTheme(t) {
  if (t === 'dark' || t === 'light') document.documentElement.dataset.theme = t; else delete document.documentElement.dataset.theme;
  els.themeBtn.textContent = isDark() ? '☀️' : '🌙';
}
applyTheme(store.get('floodline.theme'));
els.themeBtn.addEventListener('click', () => { const t = isDark() ? 'light' : 'dark'; store.set('floodline.theme', t); applyTheme(t); render(); });
systemDark.addEventListener('change', () => { applyTheme(store.get('floodline.theme')); render(); });

function switchWorkspace(name) {
  setPlaying(false);
  closeDrawer();
  ws = name;
  store.set('floodline.workspace', ws);
  W = loadWorkspace(ws);
  seenCases.clear();
  firstRender = true;
  els.workspace.value = ws;
  els.replayCtl.classList.toggle('hidden', ws !== 'demo');
  openChannel();
  setPlaying(false);
  render();
}
els.workspace.addEventListener('change', () => switchWorkspace(els.workspace.value));
setInterval(() => { if (ws === 'live') scheduleRender(); }, 30000);

// tabs
document.querySelectorAll('.tab').forEach((t) => t.addEventListener('click', () => {
  document.querySelectorAll('.tab').forEach((x) => { x.classList.toggle('active', x === t); x.setAttribute('aria-selected', String(x === t)); });
  for (const v of ['board', 'bench', 'about']) $(`${v}View`).classList.toggle('hidden', v !== t.dataset.view);
  if (t.dataset.view === 'board') mapApi.resize();
  if (t.dataset.view === 'bench') bench.show();
}));

// mobile column switcher
document.querySelectorAll('.ms').forEach((b) => b.addEventListener('click', () => {
  document.querySelectorAll('.ms').forEach((x) => x.classList.toggle('active', x === b));
  document.querySelectorAll('.board .col').forEach((col) => col.classList.toggle('show', col.classList.contains(b.dataset.col)));
  if (b.dataset.col === 'map-col') mapApi.resize();
}));
document.querySelector('.queue-col').classList.add('show');

// ---------------- start ----------------
const mapApi = createMap($('map'), (id) => openDrawer(id));
const bench = initBench({ getAi: () => ai });
updateMe();
switchWorkspace(ws);
if (ws === 'demo' && W.clock > 0 && W.clock < NIGHT_END) els.play.textContent = '▶ Resume';
window.addEventListener('beforeunload', () => store.set(`floodline.ws.${ws}`, JSON.stringify(W)));

import { extractRules } from './core/extract.js';
import { guardAi } from './core/prompt.js';
import { buildState, mergeEvents, eventId, followUpText, alreadyRescuedText } from './core/store.js';
import { fmtMinutes } from './core/priority.js';
import { generateNight, tripMinutes } from './core/sim.js';
import { splitMessages } from './core/input.js';
import { HARD_SET } from './core/hardset.js';
import { REAL_STREAM } from './core/realstream.js';
import { STREAM_AI } from './core/realstream_ai.js';
import { isConfigured, deviceStatus, prepareDevice, readMessages, warmDevice, deviceWarmth } from './ai.js';
import { createMap } from './map.js';
import { initBench } from './bench.js';
import { $, esc, store, toast, copyText } from './util.js';
import { joinBoard, pushEvents, leaveBoard, sharedCode } from './sync.js';
import { newGroupCode } from './core/security.js';
import { scamCheck, maskPhone, maskText, chainHead, fingerprint, sealBoard, openBoard, verifyPlain } from './core/security.js';

const SEED = 2023;
const DEMO_START = 20 * 60; // the simulated night starts at 20:00
const NIGHT_END_DEMO = 720;
const REPLAY_START = 19 * 60 + 30; // the 2015 replay starts at 19:30 IST on 2 December
const NIGHT_END_2015 = Math.ceil(REAL_STREAM[REAL_STREAM.length - 1].at) + 10;
const isReplay = () => ws === 'demo' || ws === 'r2015';
const endOf = () => (ws === 'r2015' ? NIGHT_END_2015 : NIGHT_END_DEMO);
const BOATS = 10;
const TAB = Math.random().toString(36).slice(2, 8);

const els = {
  workspace: $('workspace'), presence: $('presence'), meBtn: $('meBtn'), meName: $('meName'), themeBtn: $('themeBtn'),
  settingsBtn: $('settingsBtn'), settingsDialog: $('settingsDialog'), aiMode: $('aiMode'), aiCloudState: $('aiCloudState'), aiDeviceState: $('aiDeviceState'), prepareBtn: $('prepareBtn'), netState: $('netState'),
  nameDialog: $('nameDialog'), nameInput: $('nameInput'),
  clock: $('clock'), clockLabel: $('clockLabel'), stats: $('stats'), replayCtl: $('replayCtl'), play: $('playBtn'), speed: $('speed'), autoBoats: $('autoBoats'), reset: $('resetBtn'),
  paste: $('pasteBox'), add: $('addBtn'), sampleBtn: $('sampleBtn'), inboxStatus: $('inboxStatus'), aiState: $('aiState'),
  offers: $('offers'), offerCount: $('offerCount'), feed: $('feed'),
  queue: $('queue'), emptyQueue: $('emptyQueue'), search: $('search'),
  drawer: $('drawer'), drawerBack: $('drawerBack'),
  exportBtn: $('exportBtn'), importFile: $('importFile'),
};

// ---------------- workspace (event log + replay state), persisted per browser ----------------
// First visit: open on the real 2015 flood replay.
let ws = ['live', 'r2015', 'demo'].includes(store.get('floodline.workspace')) ? store.get('floodline.workspace') : 'r2015';
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
const DEVICE = store.get('floodline.device') || (() => { const d = Array.from(crypto.getRandomValues(new Uint8Array(3)), (b) => 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'[b % 32]).join(''); store.set('floodline.device', d); return d; })();
const ai = { mode: ['auto', 'device', 'cloud', 'off'].includes(store.get('floodline.aiMode')) ? store.get('floodline.aiMode') : 'auto', device: 'checking' };

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
const nowMin = () => (isReplay() ? W.clock : Date.now() / 60000);
let night2015 = null;
const getNight = () => (ws === 'r2015'
  ? (night2015 ||= { messages: REAL_STREAM.map((m, i) => ({ id: `R${i}`, at: m.at, text: m.text })) })
  : (night ||= generateNight({ seed: SEED })));

function fmtClock(min) {
  if (isReplay()) {
    const t = Math.floor((ws === 'r2015' ? REPLAY_START : DEMO_START) + min) % 1440;
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
  els.presence.textContent = `${n} volunteer${n === 1 ? '' : 's'} here`;
  els.presence.title = ['You', ...[...peers.values()].map((p) => p.name || 'Unnamed volunteer')].join(', ');
}
setInterval(() => { send({ type: 'hello', name: me.name }); renderPresence(); }, 4000);

function addEvents(evs) {
  if (!evs.length) return;
  W.events.push(...evs);
  saveWorkspace();
  send({ type: 'events', events: evs });
  if (ws === 'live' && sharedCode()) pushEvents(evs).catch(() => {});
  scheduleRender();
}

// ---------------- replay of the simulated night ----------------
function setPlaying(on) {
  if (on && !timer) {
    if (W.clock >= endOf()) { toast('The practice night is over. Press Reset to run it again.'); return; }
    timer = setInterval(tick, 250);
  } else if (!on && timer) {
    clearInterval(timer);
    timer = null;
  }
  els.play.textContent = timer ? 'Pause' : W.clock >= endOf() ? 'Night finished' : W.clock > 0 ? 'Resume' : ws === 'r2015' ? 'Play the real night' : 'Start the night';
}

function tick() {
  W.clock = Math.min(endOf(), W.clock + Number(els.speed.value) / 4);
  const msgs = getNight().messages;
  const evs = [];
  while (W.cursor < msgs.length && msgs[W.cursor].at <= W.clock) {
    const m = msgs[W.cursor++];
    const rules = extractRules(m.text);
    const ai2015 = ws === 'r2015' ? STREAM_AI[Number(m.id.slice(1))] : null;
    const x = ai2015 ? { ...guardAi(ai2015, m.text, rules, 'cloud'), where: 'cloud' } : rules; // recorded raw Gemini answer + today's checks
    evs.push({ t: 'report', id: `d${m.id}`, at: m.at, text: m.text, source: ws === 'r2015' ? 'X (Twitter), 2 Dec 2015 · real, anonymised' : 'WhatsApp group (simulated)', x });
  }
  if (evs.length) { W.events.push(...evs); send({ type: 'events', events: evs }); }
  if (els.autoBoats.checked) runBoats();
  send({ type: 'clock', clock: W.clock, cursor: W.cursor });
  saveWorkspace();
  if (W.clock >= endOf()) { setPlaying(false); toast(ws === 'r2015' ? 'That was every rescue post in the archive, up to 12:30 on 3 December 2015.' : 'The practice night is over. The Results page compares it with manual coordination.'); }
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
  if (ai.mode !== 'off' && isConfigured()) {
    els.inboxStatus.textContent += ' Gemini is re-reading them…';
    try {
      const { xs, where } = await readMessages(evs.map((e) => e.text), ai.mode);
      const later = nowMin();
      addEvents(xs.map((x, i) => ({ t: 'extract', id: eventId('x'), at: later, reportId: evs[i].id, x })));
      const blocked = xs.reduce((n, x) => n + (x.guard ? x.guard.filter((g) => /Blocked|Ignored/.test(g)).length : 0), 0);
      const changed = xs.filter((x, i) => JSON.stringify([x.kind, x.areaId, x.people, x.water, x.vulnerable]) !== JSON.stringify([evs[i].x.kind, evs[i].x.areaId, evs[i].x.people, evs[i].x.water, evs[i].x.vulnerable])).length;
      const place = where.device && where.cloud ? 'partly on this device, partly in the cloud' : where.device ? 'on this device (Gemini Nano, no internet needed)' : 'in the cloud (Gemini)';
      els.inboxStatus.textContent = `Added ${evs.length}. Gemini re-read them ${place} and corrected ${changed}.${blocked ? ` ${blocked} detail${blocked === 1 ? '' : 's'} it gave ${blocked === 1 ? 'was' : 'were'} not in the messages, so ${blocked === 1 ? 'it was' : 'they were'} not used.` : ''}`;
    } catch (err) {
      els.inboxStatus.textContent = `Added ${evs.length}, read by rules only. ${err.message}`;
    }
  }
}
els.add.addEventListener('click', addPasted);
els.paste.addEventListener('keydown', (e) => { if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) addPasted(); });
els.sampleBtn.addEventListener('click', () => {
  const pick = [4, 5, 0, 16, 22, 6, 7, 12];
  els.paste.value = pick.map((i) => HARD_SET[i].text).join('\n\n');
  els.paste.focus();
  els.inboxStatus.textContent = 'Example messages loaded (made up, written like real ones). Press “Add to board”.';
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

const VULN = { pregnant: 'pregnant', medical: 'needs medical care', infant: 'baby', elderly: 'elderly', disabled: 'cannot walk' };
const WATER = { knee: 'water at knee', waist: 'water at waist', neck: 'water at neck', roof: 'on the terrace' };
const STATUS = { new: 'Unassigned', claimed: 'Taken', enroute: 'Boat on the way', rescued: 'Rescued', unreachable: 'Could not reach' };
const STATUS_TA = { new: 'யாரும் எடுக்கவில்லை', claimed: 'எடுக்கப்பட்டது', enroute: 'படகு வருகிறது', rescued: 'மீட்கப்பட்டனர்', unreachable: 'அடைய முடியவில்லை' };
const PRIO = { critical: 'Critical', high: 'High', medium: 'Medium', low: 'Low' };
const isDone = (c) => c.status === 'rescued' || c.status === 'unreachable';
let privacy = store.get('floodline.privacy') === '1';
const fmtPhone = (p) => (privacy ? maskPhone(p) : `${p.slice(0, 5)} ${p.slice(5)}`);
const showText = (t) => (privacy ? maskText(t) : t);
const scamMemo = new Map();
const scamOf = (t) => { if (!scamMemo.has(t)) scamMemo.set(t, scamCheck(t)); return scamMemo.get(t); };
function caseScam(c) {
  const all = c.reports.map((r) => scamOf(r.text)).filter((x) => x.level);
  return { level: all.some((x) => x.level === 'high') ? 'high' : all.length ? 'check' : null, reasons: [...new Set(all.flatMap((x) => x.reasons))] };
}
const scamBadge = (lvl) => (lvl ? `<span class="scam ${lvl}">⚠ ${lvl === 'high' ? 'Possible scam — verify first' : 'Check the link first'}</span>` : '');

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

function who(c) {
  const n = c.people ? `${c.people} ${c.people === 1 ? 'person' : 'people'}` : 'Household';
  return `${n}, ${c.areaId ? esc(c.areaName) : 'area not recognised'}`;
}

function factsLine(c) {
  const bits = [
    ...c.vulnerable.map((v) => `<span class="v">${VULN[v]}</span>`),
    c.water ? WATER[c.water] : '',
    ...c.needs.filter((n) => n !== 'rescue').map((n) => `needs ${n}`),
    c.reportIds.length > 1 ? `reported ${c.reportIds.length} times` : '',
  ].filter(Boolean);
  return bits.join(' · ');
}

function warnings(c) {
  const out = [];
  if (c.flags.includes('stale')) out.push('<span class="warnline stale">No one has taken this</span>');
  if (c.flags.includes('check')) out.push('<span class="warnline check">No update for 90 min</span>');
  if (c.flags.includes('says-safe')) out.push('<span class="warnline safe">Family says they are safe</span>');
  if (c.flags.includes('reshared')) out.push('<span class="warnline reshared">Still being shared</span>');
  if (c.flags.includes('double-claim')) out.push(`<span class="warnline stale">Taken by ${c.claimers.length} people — agree who goes</span>`);
  if (c.flags.includes('ai-doubt')) out.push('<span class="warnline check">AI: may be a helpline — check</span>');
  if (!isDone(c) && !c.locVerified && (c.loc === 'locality' || c.loc === 'unknown')) out.push(`<span class="warnline loc">📍 ${c.loc === 'unknown' ? 'place unknown' : 'area only'} — confirm address</span>`);
  return out.join('');
}

function caseHtml(c, rank) {
  const done = isDone(c);
  const since = c.status === 'new' ? `${fmtMinutes(c.waiting)} waiting` : c.owner ? esc(c.owner) : '';
  const fresh = !firstRender && !seenCases.has(c.id) ? ' fresh' : '';
  return `<li><button type="button" class="case p-${c.tier}${done ? ' closed' : ''}${fresh}" data-id="${esc(c.id)}">
    <span class="prio">${done ? 'Closed' : PRIO[c.tier]}<span class="mono">${done ? '' : `#${rank}`}</span><span class="mono">${done ? '' : `${c.score} pts`}</span></span>
    <span class="body">
      <span class="who">${who(c)}</span>
      <span class="where" style="display:block">${esc(c.address || 'no street given')}${c.phones[0] ? ` · ${fmtPhone(c.phones[0])}` : ''}</span>
      <span class="facts" style="display:block">${factsLine(c) || '<span class="muted">no details given</span>'}</span>
      ${scamBadge(caseScam(c).level)}
    </span>
    <span class="state"><span class="st ${c.status === 'new' ? 'new' : done ? 'closed' : ''}">${STATUS[c.status]}</span><span class="mono">${since}</span>${warnings(c)}</span>
  </button></li>`;
}

function render() {
  const now = nowMin();
  state = buildState(W.events, now);
  const s = state.stats;
  els.clock.textContent = fmtClock(now);
  els.clockLabel.textContent = ws === 'demo' ? `practice night, ${Math.round((W.clock / endOf()) * 100)}% through` : ws === 'r2015' ? `${W.clock >= 270 ? '3' : '2'} Dec 2015 · real replay, ${W.cursor} of ${REAL_STREAM.length} posts` : 'live';
  const part = (n, label, alert) => `<span class="${alert && n ? 'alert' : ''}"><b>${n}</b> ${label}</span>`;
  els.stats.innerHTML = s.messages
    ? [part(s.unassigned, 'unassigned', true), part(s.critical, 'critical still open', true), part(s.stale, 'with no one on them for 45+ min', true), part(s.rescued, 'rescued'),
      part(s.merged, 'repeat messages merged'), part(s.messages, 'messages read')].join('<span class="sep">/</span>')
    : '<span class="muted">No messages yet.</span>';

  const active = state.cases.filter((c) => !isDone(c));
  const rankOf = new Map(active.map((c, i) => [c.id, i + 1]));
  const shown = state.cases.filter(matchesFilter).slice(0, 200);
  els.queue.innerHTML = shown.map((c) => caseHtml(c, rankOf.get(c.id))).join('');
  els.emptyQueue.classList.toggle('hidden', shown.length > 0);
  $('fAction').textContent = state.cases.filter((c) => c.status === 'new' || c.flags.includes('check') || c.flags.includes('says-safe')).length;
  $('fAssigned').textContent = state.cases.filter((c) => c.status === 'claimed' || c.status === 'enroute').length;
  $('fDone').textContent = state.cases.filter(isDone).length;

  els.offerCount.textContent = state.offers.length || '';
  els.offers.innerHTML = state.offers.slice(-8).reverse().map((o) => `<li>${esc(showText(o.text))}${scamBadge(scamOf(o.text).level)}</li>`).join('') || '<li class="muted">Boats, vehicles and food offered by people show up here.</li>';
  els.feed.innerHTML = [...state.reports].sort((a, b) => b.at - a.at).slice(0, 12)
    .map((r) => `<li><span class="k ${r.x.kind}">${fmtClock(r.at)} ${r.x.kind}</span>${esc(showText(r.text.length > 150 ? `${r.text.slice(0, 150)}…` : r.text))}${scamBadge(scamOf(r.text).level)}</li>`).join('') || '<li class="muted">Nothing yet.</li>';

  mapApi.update(state.cases);
  updateFingerprint();
  state.cases.forEach((c) => seenCases.add(c.id));
  firstRender = false;
  els.aiState.textContent = aiStateText();
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

// ---------------- request drawer ----------------
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
  const done = isDone(c);
  const actBtn = (status, label, cls = 'btn') => `<button type="button" class="${cls}" data-act="${status}">${label}</button>`;
  const actions = [];
  if (c.status === 'new') actions.push(actBtn('claim', 'I’ll take this <span class="ta">நான் எடுத்துக்கொள்கிறேன்</span>', 'btn dark'));
  // Someone else has it (they may have gone quiet): another volunteer can join, after a warning, and both are shown.
  else if (!done && c.owner && c.owner !== me.name && !(c.claimers || []).includes(me.name)) actions.push(actBtn('claim', 'I’ll take this as well'));
  if (c.status === 'new' || c.status === 'claimed') actions.push(actBtn('enroute', 'Boat is on the way'));
  if (!done) actions.push(actBtn('rescued', 'Mark rescued', 'btn go'), actBtn('unreachable', 'Could not reach'));
  else actions.push(actBtn('open', 'Reopen'));
  const phones = c.phones.map((p) => `<a class="btn" href="tel:+91${p}">Call <span class="mono">${fmtPhone(p)}</span></a><a class="btn" href="https://wa.me/91${p}?text=${encodeURIComponent(followUpText(c, 'both'))}" target="_blank" rel="noopener">WhatsApp</a>`).join('');
  const total = c.reasons.reduce((s, r) => s + r.points, 0);
  const points = c.reasons.map((r) => `<tr><td>${esc(r.label)}</td><td>${r.points > 0 ? '+' : ''}${r.points}</td></tr>`).join('')
    + `<tr class="total"><td>Priority: ${PRIO[c.tier].toLowerCase()}</td><td>${total}</td></tr>`;
  const reports = c.reports.map((r) => `<div class="msg"><div class="meta">${fmtClock(r.at)} · ${esc(r.source || '')} · read by ${r.x.source !== 'ai' ? 'rules' : r.x.where === 'device' ? 'Gemini Nano on this device (checked)' : 'Gemini in the cloud (checked)'}</div>${esc(showText(r.text))}${(r.x.guard || []).filter((g) => /Blocked|Ignored/.test(g)).map((g) => `<div class="blocked">Not used: ${esc(g.replace(/^(Blocked|Ignored)\s*/, ''))}</div>`).join('')}</div>`).join('');
  const mergeWhy = [...new Set(c.merges.map((m) => m.why))];
  const history = c.history.map((h) => `<li><span class="mono">${fmtClock(h.at)}</span>${esc(h.by || '')}${h.dev ? ` <span class="muted mono">(device ${esc(h.dev)})</span>` : ''} ${h.t === 'claim' ? 'took this request' : h.t === 'verify' ? 'confirmed the address by phone' : `marked it “${STATUS[h.status] || 'reopened'}”`}${h.note ? ` — ${esc(h.note)}` : ''}</li>`).join('');
  const LOC = { exact: 'door / flat number and street given', street: 'street or landmark given, no door number', locality: 'area only — the pin is the centre of the area', unknown: 'place not recognised' };

  els.drawer.innerHTML = `
    <button type="button" class="textbtn close">Close</button>
    <div class="kicker" style="color:var(--${done ? 'green' : { critical: 'red', high: 'amber', medium: 'blue', low: 'grey' }[c.tier]})">${done ? 'Closed' : `${PRIO[c.tier]} priority`} · ${STATUS[c.status]} <span class="ta">${STATUS_TA[c.status]}</span></div>
    <h2>${who(c)}</h2>
    <div class="addr">${esc(c.address || 'no street given')}</div>
    <div class="sub">First reported at ${fmtClock(c.firstAt)}${c.status === 'new' ? `, waiting ${fmtMinutes(c.waiting)} with no one assigned` : c.owner ? `, with ${esc(c.owner)}` : ''}.</div>
    ${(() => { const sc = caseScam(c); return sc.level ? `<div class="scam-box ${sc.level}"><b>⚠ Check before acting.</b> This message ${sc.reasons.join('; ')}. Real rescue teams never ask for money, an OTP or a password, and never need you to install an app. Confirm on an official helpline (112, 1070) before you share it or send anyone.</div>` : ''; })()}
    ${c.flags.includes('stale') ? '<div class="alertbox">No one has taken this request for over 45 minutes.</div>' : ''}
    ${c.flags.includes('says-safe') ? `<div class="okbox">A later message says this family is safe: “${esc(showText(c.safeReports[0].text.slice(0, 160)))}” Call to confirm, then mark it rescued.</div>` : ''}

    <section><h3>Actions</h3><div class="row">${actions.join('')}</div>
      <div class="row">${phones || '<span class="note">No phone number in any of the messages. Ask the people who shared it.</span>'}</div></section>

    <section><h3>Why it is in this position</h3><table class="points">${points}</table>
      <p class="note muted">Points add up from the details in the messages. You can always take a lower one first if you know better.</p></section>

    <section><h3>Details</h3><dl class="kv">
      <dt>Area</dt><dd>${c.areaId ? esc(c.areaName) : 'not recognised'}</dd>
      <dt>Location</dt><dd>${c.locVerified ? '<b style="color:var(--green)">address confirmed by phone</b>' : `${LOC[c.loc]}. <b>Confirm the address on a call before sending a boat.</b> <button type="button" class="textbtn" data-act="verify-loc">Address confirmed</button>`}</dd>
      <dt>Address</dt><dd>${esc(c.address || '—')}</dd>
      <dt>People</dt><dd>${c.people ?? 'not stated'}</dd>
      <dt>Vulnerable</dt><dd>${c.vulnerable.map((v) => VULN[v]).join(', ') || 'none mentioned'}</dd>
      <dt>Water</dt><dd>${c.water ? WATER[c.water] : 'not stated'}</dd>
      <dt>Needs</dt><dd>${c.needs.join(', ') || '—'}</dd>
      <dt>Contact</dt><dd>${esc(c.name || '')} <span class="mono">${c.phones.map(fmtPhone).join(', ') || '—'}</span></dd>
    </dl></section>

    <section><h3>Message to check if they still need help</h3><div class="copybox" id="followText">${esc(followUpText(c))}</div><div class="row"><button type="button" class="btn" data-copy="followText">Copy</button></div></section>
    ${c.reshared ? `<section><h3>People are still sharing this after the rescue</h3><div class="copybox" id="rescuedText">${esc(alreadyRescuedText(c, fmtClock(c.resolvedAt)))}</div><div class="row"><button type="button" class="btn" data-copy="rescuedText">Copy reply for the group</button></div></section>` : ''}

    <section><h3>${c.reportIds.length} message${c.reportIds.length > 1 ? 's' : ''} about this household</h3>
      ${mergeWhy.length ? `<p class="note">Grouped together because they have the ${mergeWhy.map((w) => w.replace(/^same /, 'same ')).join(' or ')}.</p>` : ''}${reports}</section>

    <section><h3>What has happened</h3><ul class="timeline">${history || '<li class="muted">Nothing yet.</li>'}</ul></section>`;

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
  if (!(await ensureName())) { toast('Add your name first, so others know who has it'); return; }
  const at = nowMin();
  const who = { by: me.name, dev: DEVICE };
  if (what === 'verify-loc') { addEvents([{ t: 'verify', id: eventId('v'), at, caseId: c.id, what: 'location', ...who }]); toast('Address marked as confirmed'); return; }
  if (what === 'claim') {
    if (c.status !== 'new' && c.owner && c.owner !== me.name && !confirm(`${c.owner} has already taken this request. Take it as well? Agree with them who goes.`)) return;
    addEvents([{ t: 'claim', id: eventId('c'), at, caseId: c.id, ...who }]);
  } else {
    let note;
    // A person decides; for a critical household, closing it needs a confirmation from the family or the boat team.
    if ((what === 'rescued' || what === 'unreachable') && c.tier === 'critical') {
      note = prompt(what === 'rescued'
        ? `Close this critical request (${c.vulnerable.join(', ') || 'critical'})? Only if the family or the boat team confirmed it. How was it confirmed?`
        : 'Mark this critical request "could not reach"? It will leave the list. What did you try?', what === 'rescued' ? 'Family confirmed on a call' : 'Called 3 times, no answer');
      if (note == null || !note.trim()) return;
    }
    const evs = [];
    if (c.status === 'new' && what !== 'open') evs.push({ t: 'claim', id: eventId('c'), at, caseId: c.id, ...who });
    evs.push({ t: 'status', id: eventId('s'), at, caseId: c.id, status: what, ...who, ...(note ? { note: note.trim().slice(0, 140) } : {}) });
    addEvents(evs);
  }
  toast(what === 'claim' ? 'This request is yours now. Other volunteers can see that.' : `Marked “${STATUS[what] || 'reopened'}”`);
}

// ---------------- settings, name, theme, workspace, export ----------------
function updateMe() { els.meName.textContent = me.name || 'Set name'; }
els.meBtn.addEventListener('click', () => { els.nameInput.value = me.name; els.nameDialog.showModal(); });
els.nameDialog.addEventListener('close', () => {
  const v = els.nameInput.value.trim();
  if (els.nameDialog.returnValue === 'ok' && v) { me.name = v; store.set('floodline.me', v); updateMe(); send({ type: 'hello', name: me.name }); }
});

function aiStateText() {
  if (ai.mode === 'off') return 'Messages are read by rules only (AI switched off in Settings).';
  if (!isConfigured()) return 'Messages are read by rules, offline. AI reading is not set up on this copy.';
  if (ai.device === 'checking' && ai.mode !== 'cloud') return 'Checking for the on-device AI (Gemini Nano)…';
  if (ai.device === 'available' && ai.mode !== 'cloud') return deviceWarmth.state === 'warming'
    ? 'Gemini Nano is starting on this device (first start can take a minute; rules read messages meanwhile).'
    : 'Messages are read by rules, then by Gemini Nano on this device: works with no internet, nothing leaves this device.';
  if (ai.mode === 'device') return 'On-device AI is not ready on this browser yet (Settings), so messages are read by rules.';
  return navigator.onLine ? 'Messages are read by rules, then by Gemini in the cloud. Prepare the on-device model in Settings to read them with no internet.' : 'Offline: messages are read by rules. Prepare the on-device model in Settings to use AI with no internet.';
}

const DEVICE_TEXT = {
  available: 'Ready. Gemini Nano runs on this device.',
  downloadable: 'Can be downloaded to this device (one time, a few GB).',
  downloading: 'Downloading…',
  unavailable: 'Not ready on this device. In desktop Chrome, turn on chrome://flags/#prompt-api-for-gemini-nano-multimodal-input and restart; until then messages are read in the cloud.',
  unsupported: 'Not available in this browser. Use desktop Chrome 139+ and turn on chrome://flags/#prompt-api-for-gemini-nano-multimodal-input.',
};
async function refreshAiStatus() {
  els.aiCloudState.textContent = !isConfigured() ? 'Not set up on this copy of FloodLine.' : navigator.onLine ? 'Ready (Firebase AI Logic).' : 'Offline right now.';
  ai.device = await deviceStatus();
  els.aiDeviceState.textContent = DEVICE_TEXT[ai.device] || ai.device;
  if (ai.device === 'available' && ai.mode !== 'cloud' && ai.mode !== 'off' && isConfigured()) warmDevice(() => scheduleRender());
  els.aiCloudState.textContent = !isConfigured() ? 'Not set up on this copy of FloodLine.' : navigator.onLine ? 'Ready (Firebase AI Logic).' : 'Offline right now.';
  els.prepareBtn.disabled = !isConfigured() || !(ai.device === 'downloadable' || ai.device === 'downloading');
  els.netState.classList.toggle('hidden', navigator.onLine);
  scheduleRender();
}
els.settingsBtn.addEventListener('click', () => {
  els.aiMode.value = ai.mode;
  refreshAiStatus();
  els.settingsDialog.showModal();
});
els.aiMode.addEventListener('change', () => {
  ai.mode = els.aiMode.value;
  store.set('floodline.aiMode', ai.mode);
  scheduleRender();
});
els.prepareBtn.addEventListener('click', async () => {
  els.prepareBtn.disabled = true;
  els.aiDeviceState.textContent = 'Starting download…';
  try {
    await prepareDevice((pct) => { els.aiDeviceState.textContent = `Downloading Gemini Nano: ${pct}%`; });
    toast('On-device AI is ready');
  } catch (err) {
    els.aiDeviceState.textContent = `Could not prepare it: ${err.message}`;
  }
  refreshAiStatus();
});
window.addEventListener('online', refreshAiStatus);
window.addEventListener('offline', refreshAiStatus);
refreshAiStatus();
if ('serviceWorker' in navigator) navigator.serviceWorker.register('sw.js').catch(() => {});

let fpTimer = null;
function updateFingerprint() {
  clearTimeout(fpTimer);
  fpTimer = setTimeout(async () => {
    try {
      const fp = fingerprint(await chainHead(W.events));
      $('fpShort').textContent = fp; $('fpFull').textContent = `${fp} (${W.events.length} events)`;
    } catch { $('fpShort').textContent = '—'; }
  }, 250);
}
$('fpChip').addEventListener('click', () => { els.settingsDialog.showModal(); $('handoverPass').focus(); });

// ---------------- shared board across phones (end-to-end encrypted) ----------------
const shareSay = (msg, bad) => { const el = $('shareStatus'); el.textContent = msg; el.style.color = bad ? 'var(--red)' : 'var(--green)'; el.style.fontWeight = '600'; };
let shareNote = '';
async function startSharing(code, note = '') {
  shareNote = note;
  if (ws !== 'live') switchWorkspace('live');
  shareSay('Connecting…');
  try {
    const c = await joinBoard(code, (evs) => {
      if (ws !== 'live') { const L = loadWorkspace('live'); L.events = mergeEvents(L.events, evs); store.set('floodline.ws.live', JSON.stringify(L)); return; }
      W.events = mergeEvents(W.events, evs);
      saveWorkspace();
      send({ type: 'events', events: evs });
      scheduleRender();
    }, (st) => {
      if (st.state === 'error') shareSay(`Could not reach the shared board: ${st.error}`, true);
      else shareSay(`🔐 Shared board ${st.code} · ${st.state === 'live' ? 'live' : 'offline — changes will be sent when the network is back'} · ${st.count ?? 0} encrypted events on the server${st.pending ? ' · sending…' : ''}${shareNote}`);
    });
    store.set('floodline.shareCode', c);
    $('shareCode').value = c;
    $('shareChip').classList.remove('hidden');
    $('shareLeave').classList.remove('hidden');
    $('shareRotate').classList.remove('hidden');
    await pushEvents(W.events); // share what is already on this board
  } catch (err) { shareSay(err.message, true); }
}
$('shareCreate').addEventListener('click', () => startSharing(newGroupCode()));
$('shareJoin').addEventListener('click', () => startSharing($('shareCode').value));
$('shareRotate').addEventListener('click', async () => {
  if (!sharedCode()) return;
  if (!confirm('Move this board to a new group code? Everyone who should keep seeing it will need the new code.')) return;
  await startSharing(newGroupCode(), '. Moved to this new code: read it out to the volunteers who should stay; the old code gets no new updates.');
});
$('forgetBoard').addEventListener('click', () => {
  if (!confirm('Delete the live board and the group code from this device? Other volunteers keep their copies.')) return;
  leaveBoard(); store.remove('floodline.shareCode'); store.remove('floodline.ws.live');
  if (ws === 'live') { W = { events: [], clock: 0, cursor: 0, boats: null }; render(); }
  $('shareChip').classList.add('hidden'); $('shareLeave').classList.add('hidden'); $('shareRotate').classList.add('hidden');
  shareSay('This device no longer has the live board or the code.');
});
$('shareLeave').addEventListener('click', () => {
  leaveBoard(); store.remove('floodline.shareCode');
  $('shareChip').classList.add('hidden'); $('shareLeave').classList.add('hidden');
  shareSay('Stopped sharing. This board stays on this device.');
});

const privacyBox = $('privacyMode');
privacyBox.checked = privacy;
document.body.classList.toggle('privacy', privacy);
privacyBox.addEventListener('change', () => {
  privacy = privacyBox.checked;
  store.set('floodline.privacy', privacy ? '1' : '0');
  document.body.classList.toggle('privacy', privacy);
  render();
});

const handoverSay = (msg, bad) => { const el = $('handoverStatus'); el.textContent = msg; el.style.color = bad ? 'var(--red)' : 'var(--green)'; el.style.fontWeight = '600'; toast(msg); };
function download(name, obj) {
  const blob = new Blob([JSON.stringify(obj, null, 1)], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}
els.exportBtn.addEventListener('click', async () => {
  const pass = $('handoverPass').value;
  const stamp = new Date().toISOString().slice(0, 16).replace(/[:T]/g, '-');
  const board = { app: 'FloodLine', workspace: ws, exportedAt: new Date().toISOString(), events: W.events };
  try {
    if (pass) {
      const sealed = await sealBoard(board, pass);
      download(`floodline-${ws}-${stamp}.locked.json`, sealed);
      handoverSay(`🔒 Locked with AES-256-GCM. Fingerprint ${sealed.fingerprint}. Tell the next shift the passphrase by voice, not in the group.`);
    } else {
      const head = await chainHead(board.events);
      download(`floodline-${ws}-${stamp}.json`, { ...board, chainHead: head });
      handoverSay(`Downloaded, not locked. Fingerprint ${fingerprint(head)}.`);
    }
  } catch (err) { handoverSay(err.message, true); }
});
els.importFile.addEventListener('change', async () => {
  const f = els.importFile.files[0];
  if (!f) return;
  try {
    let data = JSON.parse(await f.text());
    let note = '';
    if (data && data.sealed) {
      const pass = $('handoverPass').value || window.prompt('This board file is locked. Passphrase:') || '';
      const opened = await openBoard(data, pass);
      data = opened.board;
      note = ` Unlocked and verified: fingerprint ${opened.fingerprint}.`;
    } else if (data && !Array.isArray(data)) {
      const v = await verifyPlain(data);
      if (v.ok === false) throw new Error('This file was changed after it was downloaded (fingerprint does not match). Not loaded.');
      note = v.ok ? ` Verified: fingerprint ${v.fingerprint}.` : ' (old file without a fingerprint)';
    }
    const evs = (Array.isArray(data) ? data : data.events || []).filter((e) => e && e.id && e.t && typeof e.at === 'number');
    W.events = mergeEvents(W.events, evs);
    saveWorkspace();
    send({ type: 'events', events: evs });
    handoverSay(`✓ Imported ${evs.length} events.${note}`);
    setTimeout(() => els.settingsDialog.close(), 2500);
    render();
  } catch (err) { handoverSay(`✗ ${err && err.message && !/JSON/.test(err.message) ? err.message : 'That file is not a FloodLine board'}`, true); }
  els.importFile.value = '';
});

const systemDark = window.matchMedia('(prefers-color-scheme: dark)');
const isDark = () => (document.documentElement.dataset.theme || (systemDark.matches ? 'dark' : 'light')) === 'dark';
function applyTheme(t) {
  if (t === 'dark' || t === 'light') document.documentElement.dataset.theme = t; else delete document.documentElement.dataset.theme;
  els.themeBtn.textContent = isDark() ? 'Light' : 'Dark';
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
  els.replayCtl.classList.toggle('hidden', !isReplay());
  $('practiceBanner').classList.toggle('hidden', ws !== 'demo');
  $('replayBanner').classList.toggle('hidden', ws !== 'r2015');
  els.autoBoats.checked = ws !== 'r2015';
  openChannel();
  setPlaying(false);
  render();
}
els.workspace.addEventListener('change', () => switchWorkspace(els.workspace.value));
$('goLive').addEventListener('click', () => switchWorkspace('live'));
$('goReal').addEventListener('click', () => switchWorkspace('r2015'));
$('replayPlay').addEventListener('click', () => { if (!timer) { els.speed.value = '12'; setPlaying(true); } });
$('replayStory').addEventListener('click', () => document.querySelector('.tab[data-view="case"]').click());
setInterval(() => { if (ws === 'live') scheduleRender(); }, 30000);

// tabs
document.querySelectorAll('.tab').forEach((t) => t.addEventListener('click', () => {
  document.querySelectorAll('.tab').forEach((x) => { x.classList.toggle('active', x === t); x.setAttribute('aria-selected', String(x === t)); });
  for (const v of ['board', 'case', 'bench', 'security', 'about']) $(`${v}View`).classList.toggle('hidden', v !== t.dataset.view);
  if (t.dataset.view === 'board') mapApi.resize();
  if (t.dataset.view === 'bench') bench.show();
  if (t.dataset.view === 'case') import('./case.js').then((m) => m.renderCase($('casePage'))).catch((e) => { $('casePage').textContent = e.message; });
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
if (ws === 'live' && store.get('floodline.shareCode')) startSharing(store.get('floodline.shareCode'));
if (isReplay() && W.clock > 0 && W.clock < endOf()) els.play.textContent = '▶ Resume';
window.addEventListener('beforeunload', () => store.set(`floodline.ws.${ws}`, JSON.stringify(W)));

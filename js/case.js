// "Real flood test": what FloodLine does with the real posts from the night of 2-3 December 2015.
import { REAL_STREAM } from './core/realstream.js';
import { REAL_SET } from './core/realset.js';
import { scoreRecorded, scoreRules } from './core/evaluate.js';
import { extractRules } from './core/extract.js';
import { guardAi } from './core/prompt.js';
import { buildState } from './core/store.js';
import { scoreHardSet } from './core/hardset.js';
import { scamCheck } from './core/security.js';
import { evaluateDedupe } from './core/sim.js';
import { esc } from './util.js';

const START = 19 * 60 + 30; // minutes after midnight, 2 Dec 2015 IST
const clock = (m) => { const t = Math.floor(START + m) % 1440; return `${String(Math.floor(t / 60)).padStart(2, '0')}:${String(t % 60).padStart(2, '0')}`; };
const VUL = { pregnant: 'pregnant / in labour', medical: 'needs medical care', infant: 'baby', elderly: 'elderly', disabled: 'cannot walk' };
const WATER = { knee: 'knee', waist: 'waist', neck: 'neck', roof: 'upper floor / terrace' };
const pct = (v) => (v == null ? '—' : `${v}%`);
let done = false;
let streamModel = '';

async function aiReads() {
  try { const m = await import('./core/realstream_ai.js'); streamModel = Object.keys(m.STREAM_MODELS || {}).join(', '); return m.STREAM_AI; } catch { return null; }
}

// The recorded answers are Gemini's raw output; FloodLine's current checks are applied here, exactly as in the live app.
export const withAi = (text, raw) => ({ ...guardAi(raw, text, extractRules(text), 'cloud'), where: 'cloud' });

function stateFor(xs) {
  const evs = REAL_STREAM.map((m, i) => ({ t: 'report', id: `R${i}`, at: m.at, text: m.text, source: 'X, 2 Dec 2015', x: xs ? withAi(m.text, xs[i]) : extractRules(m.text) }));
  return { evs, st: buildState(evs, Math.ceil(REAL_STREAM[REAL_STREAM.length - 1].at) + 10) }; // same moment the board's replay ends
}

function hourly(evs, st) {
  const bins = new Map();
  for (const e of evs) { const h = Math.floor((START + e.at) / 60); bins.set(h, (bins.get(h) || 0) + 1); }
  const firstOf = new Map();
  for (const c of st.cases) { const h = Math.floor((START + c.firstAt) / 60); firstOf.set(h, (firstOf.get(h) || 0) + 1); }
  const hours = [...bins.keys()].sort((a, b) => a - b);
  const all = []; for (let h = hours[0]; h <= hours[hours.length - 1]; h++) all.push(h);
  const max = Math.max(...all.map((h) => bins.get(h) || 0));
  const W = 760, H = 170, bw = W / all.length;
  const bars = all.map((h, i) => {
    const n = bins.get(h) || 0, k = firstOf.get(h) || 0;
    const y = H - 22 - (n / max) * (H - 40), y2 = H - 22 - (k / max) * (H - 40);
    return `<rect x="${i * bw + 3}" y="${y}" width="${bw - 6}" height="${H - 22 - y}" fill="var(--blue-bg)" stroke="var(--blue)"><title>${String(h % 24).padStart(2, '0')}:00 — ${n} posts</title></rect>
      <rect x="${i * bw + 3 + bw * 0.22}" y="${y2}" width="${(bw - 6) * 0.56}" height="${H - 22 - y2}" fill="var(--red)"><title>${k} new households</title></rect>
      ${i % 2 === 0 ? `<text x="${i * bw + bw / 2}" y="${H - 6}" text-anchor="middle" font-size="11" fill="var(--muted)">${String(h % 24).padStart(2, '0')}h</text>` : ''}`;
  }).join('');
  return `<svg viewBox="0 0 ${W} ${H}" class="chart" role="img" aria-label="Posts per hour and new households per hour">${bars}</svg>
    <p class="note"><span class="key" style="background:var(--blue-bg);border:1px solid var(--blue)"></span> real posts per hour &nbsp; <span class="key" style="background:var(--red)"></span> of them, households FloodLine had not seen before. After midnight, most posts are reposts of families already on the board or helpline numbers, not new families: that is when a hand-read chat buries the few new requests.</p>`;
}

function fieldCell(want, got, ok) {
  return `<td class="${ok ? 'ok' : 'bad'}">${ok ? '✓' : '✗'} ${esc(got)}</td>`;
}

export async function renderCase(el) {
  if (done) return; done = true;
  const xs = await aiReads();
  const { evs, st } = stateFor(xs);
  const clear = st.cases.filter((c) => !c.flags.includes('ai-doubt'));
  const doubt = st.cases.filter((c) => c.flags.includes('ai-doubt'));
  const posts = (cs) => cs.reduce((s, c) => s + c.reportIds.length, 0);
  const scams = evs.filter((e) => scamCheck(e.text).level).length;
  const crit = clear.filter((c) => c.tier === 'critical');
  const vul = (v) => clear.filter((c) => c.vulnerable.includes(v)).length;
  const firstCrit = [...crit].sort((a, b) => a.firstAt - b.firstAt)[0];
  const invented = evs.reduce((n, e) => n + (e.x.guard || []).filter((g) => g.startsWith('Blocked')).length, 0);
  const landlines = evs.reduce((n, e) => n + (e.x.guard || []).filter((g) => g.startsWith('Ignored phone')).length, 0);
  const loc = { exact: 0, street: 0, locality: 0, unknown: 0 }; for (const c of clear) loc[c.loc]++;
  const byArea = new Map(); for (const c of clear) byArea.set(c.areaName || 'place not recognised', (byArea.get(c.areaName || 'place not recognised') || 0) + 1);
  const areas = [...byArea.entries()].sort((a, b) => b[1] - a[1]).slice(0, 10);
  const reader = xs ? `Gemini in the cloud through Firebase AI Logic (${esc(streamModel)}), with FloodLine's checks` : 'FloodLine\'s rules (offline)';
  const at22 = buildState(evs.filter((e) => e.at <= 150), 150);
  const top = at22.cases.filter((c) => !c.flags.includes('ai-doubt')).slice(0, 8);
  const reposted = [...clear].sort((a, b) => b.reportIds.length - a.reportIds.length).slice(0, 5);

  const rules = scoreRules();
  const cloud = scoreRecorded('cloud'), device = scoreRecorded('device');
  const missSet = (r) => new Set((r?.misses || []).map((m) => `${m.i}:${m.field}`));
  const rm = missSet(rules), cm = missSet(cloud), dm = missSet(device);
  const F = ['kind', 'area', 'phones', 'people', 'vulnerable', 'water'];
  const cellFor = (set, i, has = true) => { if (!has) return '<td class="muted">—</td>'; const bad = F.filter((k) => set.has(`${i}:${k}`)); return `<td class="${bad.length ? 'bad' : 'ok'}">${bad.length ? `✗ ${bad.join(', ')}` : '✓ all'}</td>`; };
  const rows = REAL_SET.map((lab, i) => `<tr><td class="msgtext">${esc(lab.text)}</td>
      <td class="lab">${esc(lab.kind)}${lab.areaId ? ` · ${esc(lab.areaId)}` : ''}${lab.people ? ` · ${lab.people} ppl` : ''}${lab.vulnerable.length ? ` · ${esc(lab.vulnerable.join(', '))}` : ''}${lab.water ? ` · ${esc(lab.water)}` : ''}</td>
      ${cellFor(rm, i)}${cellFor(cm, i, !!cloud)}${cellFor(dm, i, !!device)}</tr>`).join('');
  const night = { messages: REAL_SET.map((x, i) => ({ id: `r${i}`, at: i, text: x.text, truth: { kind: x.kind, household: x.household } })) };
  const dd = evaluateDedupe(night);
  const col = (r, k) => (r ? pct(k === 'overall' ? r.overall : r.fields[k]) : '<span class="muted">not measured</span>');
  const LOCW = { exact: 'door no. given', street: 'street / landmark', locality: 'area only', unknown: 'place unknown' };

  el.innerHTML = `
    <h2>The real flood test: replaying Chennai, 2–3 December 2015</h2>
    <p class="lede">On 1–2 December 2015 Chennai had its heaviest rain in a century. Phone lines failed and people posted rescue requests on Twitter. A public archive kept 34,717 of those tweets. FloodLine takes every post that mentions being stuck, rescue, water or a vulnerable person <i>and</i> has a phone number — <b>${REAL_STREAM.length} real posts</b> from ${clock(REAL_STREAM[0].at)} on 2 December to ${clock(REAL_STREAM[REAL_STREAM.length - 1].at)} on 3 December — and plays them in the order and at the minute they were posted. Wording as people wrote it; names and numbers changed. Read by: ${reader}.</p>
    <p class="note"><b>What this is and isn't:</b> a replay of historical posts, to see what FloodLine would have put in front of volunteers. It is not a deployment — no rescue group has used FloodLine in a flood yet, and the archive doesn't say where boats actually went.</p>
    <div class="row"><button class="btn dark" type="button" id="caseReplay">▶ Watch the replay on the board</button></div>

    <div class="tiles">
      <div class="tile"><b>${REAL_STREAM.length}</b><span>real posts in ${Math.round((REAL_STREAM[REAL_STREAM.length - 1].at - REAL_STREAM[0].at) / 60)} hours</span></div>
      <div class="tile"><b>${clear.length}</b><span>requests for help on the list, from ${posts(clear)} posts</span></div>
      <div class="tile"><b>${posts(clear) - clear.length}</b><span>of those posts repeated a request already on the list</span></div>
      <div class="tile red"><b>${crit.length}</b><span>critical — ${vul('pregnant')} pregnant or in labour, ${vul('infant')} with a baby, ${vul('medical')} medical</span></div>
      <div class="tile"><b>${doubt.length}</b><span>groups (${posts(doubt)} posts) the AI thinks are helplines — kept at the bottom for a person to check, never hidden</span></div>
      <div class="tile"><b>${invented}</b><span>phone numbers invented by Gemini (${landlines} landlines it listed were set aside)</span></div>
      <div class="tile"><b>${loc.exact}</b><span>requests with a door number and street · ${loc.street} street or landmark · ${loc.locality} area only · ${loc.unknown} place unknown</span></div>
      <div class="tile"><b>${scams}</b><span>flagged as possible scams</span></div>
    </div>

    <h2>How the night unfolded</h2>
    ${hourly(evs, st)}
    <p class="note">The first critical request (${firstCrit ? esc(firstCrit.vulnerable.map((v) => VUL[v]).join(', ') || WATER[firstCrit.water] || 'critical') : '—'}${firstCrit && firstCrit.areaName ? `, ${esc(firstCrit.areaName)}` : ''}) was posted at ${firstCrit ? clock(firstCrit.firstAt) : '—'}.</p>

    <h2>What a volunteer would have seen at 22:00 on 2 December</h2>
    <p class="note">The top of the list in FloodLine's order. The order helps volunteers choose; a person decides whom to call and where to send a boat, after confirming the address on the phone.</p>
    <table class="cmp"><thead><tr><th>#</th><th>Priority</th><th>Where</th><th>Why it is here</th><th>Posts</th><th>First post (real wording)</th></tr></thead><tbody>
      ${top.map((c, i) => `<tr><td class="n">${i + 1}</td><td><span class="pill p-${c.tier}">${c.tier}</span></td><td>${esc(c.areaName || 'place not recognised')}<br><span class="muted">${LOCW[c.loc]}</span></td><td>${esc(c.reasons.slice(0, 3).map((r) => r.label).join(' · '))}</td><td class="n">${c.reportIds.length}</td><td class="msgtext">${esc(c.reports[0].text.slice(0, 140))}</td></tr>`).join('')}
    </tbody></table>

    <h2>The same request, posted again and again</h2>
    <p class="note">Grouped by phone number or by the same address. Not every group is a family: some "contact this number for rescue" posts are volunteer helplines that both the rules and the AI read as requests — the volunteer sees the repeated number and the wording.</p>
    <table class="cmp"><thead><tr><th>Times posted</th><th>Where</th><th>Grouped because</th><th>First post</th></tr></thead><tbody>
      ${reposted.map((c) => `<tr><td class="n"><b>${c.reportIds.length}×</b></td><td>${esc(c.areaName || '—')}</td><td>${esc([...new Set(c.merges.map((m) => m.why))].join(', ') || '—')}</td><td class="msgtext">${esc(c.reports[0].text.slice(0, 150))}</td></tr>`).join('')}
    </tbody></table>

    <h2>Which areas asked most</h2>
    <p class="note">${areas.map(([a, n]) => `${esc(a)} <b>${n}</b>`).join(' · ')}</p>

    <h2>How well did it understand them? (an initial check)</h2>
    <p class="lede">60 of these posts, picked at random, were labelled with the right answer for each field — kind of message, area, number of people, who is vulnerable, water level, phone numbers — and every reader is compared field by field (228 checks). <b>These labels were made by the AI assistant that helped build FloodLine</b>, so this is a first check, not independent proof; an independent human labelling is under way on <a href="label.html">the labelling page</a>. The scores below are computed now, in your browser, from the recorded answers in the repository and FloodLine's current checks.</p>
    <table class="cmp"><thead><tr><th>On 60 real posts</th><th>Rules (offline)</th><th>Gemini Nano on the device + checks</th><th>Gemini in the cloud + checks</th></tr></thead><tbody>
      ${[['All fields', 'overall'], ['Type of message', 'kind'], ['Area', 'area'], ['Phone numbers', 'phones'], ['Number of people', 'people'], ['Who is vulnerable', 'vulnerable'], ['Water level', 'water']].map(([label, k]) => `<tr><td>${k === 'overall' ? '<b>All fields</b>' : label}</td><td class="n">${pct(k === 'overall' ? rules.overall : rules.fields[k])}</td><td class="n">${col(device, k)}</td><td class="n">${k === 'overall' ? `<b>${col(cloud, k)}</b>` : col(cloud, k)}</td></tr>`).join('')}
      <tr><td>The AI's own reading, all fields <span class="muted">(before FloodLine keeps uncertain requests on the list — the rows above are what the board shows)</span></td><td class="n">—</td><td class="n">${device ? pct(device.own.overall) : '—'}</td><td class="n">${cloud ? pct(cloud.own.overall) : '—'}</td></tr>
      <tr><td>Phone numbers the AI invented (dropped)</td><td class="n">—</td><td class="n">${device ? device.invented : '—'}</td><td class="n">${cloud ? cloud.invented : '—'}</td></tr>
      <tr><td>Real requests the AI read as something else (kept on the list anyway)</td><td class="n">—</td><td class="n">${device ? device.wouldHide : '—'}</td><td class="n">${cloud ? cloud.wouldHide : '—'}</td></tr>
    </tbody></table>
    <p class="note">Models: cloud — ${esc(cloud?.model || '—')}; on the device — ${esc(device?.model || '—')}; recorded ${esc(cloud?.date || '')}. Grouping repeats on these 60: ${dd.reports} request posts were about ${dd.households} households; FloodLine made ${dd.clusters} groups (precision ${dd.precision}%, recall ${dd.recall}%). The rules improved after 26 localities the real posts kept naming were added, so the rules column is no longer a blind test.</p>

    <details class="assume"><summary>Every one of the 60 posts: what it said, the label, and what each reader got</summary>
      <div class="scrollx"><table class="cmp msgs"><thead><tr><th>Real post (anonymised)</th><th>Label</th><th>Rules</th><th>Cloud Gemini</th><th>Gemini Nano</th></tr></thead><tbody>${rows}</tbody></table></div>
    </details>

    <h2>Limits</h2>
    <ul class="note">
      <li>A replay, not a deployment; no outcomes (who was rescued, when) are known.</li>
      <li>The archive is a hashtag sample of mostly English tweets that include a phone number; Tamil and Tanglish are barely represented.</li>
      <li>Names, handles, door numbers and every phone number were replaced by a script (<code>scripts/</code>); a few first names written without a number nearby may remain.</li>
      <li>Locations are area centres unless a door number and street are given: confirm the address on a call before sending a boat.</li>
    </ul>`;
  el.querySelector('#caseReplay').addEventListener('click', () => {
    const sel = document.getElementById('workspace'); sel.value = 'r2015'; sel.dispatchEvent(new Event('change'));
    document.querySelector('.tab[data-view="board"]').click();
    setTimeout(() => document.getElementById('playBtn').click(), 300);
  });
}

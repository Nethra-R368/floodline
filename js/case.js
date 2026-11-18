// "Real flood test": what FloodLine does with the real posts from the night of 2-3 December 2015.
import { REAL_STREAM } from './core/realstream.js';
import { REAL_SET } from './core/realset.js';
import { MEASURED_REAL, MISSES_REAL } from './core/measured.js';
import { extractRules } from './core/extract.js';
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

async function aiReads() {
  try { return (await import('./core/realstream_ai.js')).STREAM_AI; } catch { return null; }
}

export const withAi = (r, a) => ({ ...r, ...a, areaId: a.areaId || r.areaId, phones: a.phones && a.phones.length ? a.phones : r.phones, source: 'ai' });

function stateFor(xs) {
  const evs = REAL_STREAM.map((m, i) => ({ t: 'report', id: `R${i}`, at: m.at, text: m.text, source: 'X, 2 Dec 2015', x: xs ? withAi(extractRules(m.text), xs[i]) : extractRules(m.text) }));
  return { evs, st: buildState(evs, REAL_STREAM[REAL_STREAM.length - 1].at + 1) };
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
    <p class="note"><span class="key" style="background:var(--blue-bg);border:1px solid var(--blue)"></span> real posts per hour &nbsp; <span class="key" style="background:var(--red)"></span> of them, households FloodLine had not seen before. Late at night most posts are reposts of families already on the board.</p>`;
}

function fieldCell(want, got, ok) {
  return `<td class="${ok ? 'ok' : 'bad'}">${ok ? '✓' : '✗'} ${esc(got)}</td>`;
}

export async function renderCase(el) {
  if (done) return; done = true;
  const xs = await aiReads();
  const { evs, st } = stateFor(xs);
  const rulesOnly = xs ? stateFor(null).st : st;
  const reqs = evs.filter((e) => e.x.kind === 'request').length;
  const offers = evs.filter((e) => e.x.kind === 'offer').length;
  const scams = evs.filter((e) => scamCheck(e.text).level).length;
  const multi = st.cases.filter((c) => c.reportIds.length > 1);
  const crit = st.cases.filter((c) => c.tier === 'critical');
  const vul = (v) => st.cases.filter((c) => c.vulnerable.includes(v)).length;
  const firstCrit = [...crit].sort((a, b) => a.firstAt - b.firstAt)[0];
  const merged = st.cases.reduce((s, c) => s + c.reportIds.length - 1, 0);
  const byArea = new Map(); for (const c of st.cases) byArea.set(c.areaName || 'place not recognised', (byArea.get(c.areaName || 'place not recognised') || 0) + 1);
  const areas = [...byArea.entries()].sort((a, b) => b[1] - a[1]).slice(0, 10);
  const reader = xs ? 'Gemini in the cloud (through Firebase AI Logic), checked by FloodLine' : 'FloodLine\'s rules (offline)';

  // Board at 22:00 on 2 Dec: what a volunteer would have been looking at.
  const at22 = buildState(evs.filter((e) => e.at <= 150), 150);
  const top = at22.cases.slice(0, 8);

  // Most reposted households.
  const reposted = [...st.cases].sort((a, b) => b.reportIds.length - a.reportIds.length).slice(0, 5);

  // Message by message, on the 60 labelled posts.
  const rules = scoreHardSet(extractRules, REAL_SET);
  const missOf = (who) => { const m = new Map(); for (const x of MISSES_REAL[who]) m.set(`${x.i}:${x.field}`, x.got); return m; };
  const cm = missOf('cloud'), dm = missOf('device');
  const rows = REAL_SET.map((lab, i) => {
    const r = extractRules(lab.text);
    const want = { kind: lab.kind, area: lab.areaId || '—', people: lab.people ?? '—', vulnerable: lab.vulnerable.join(', ') || '—', water: lab.water || '—' };
    const isReq = lab.kind === 'request';
    const f = (field, rv, ok) => fieldCell(want[field], rv, ok);
    const cloudBad = ['kind', 'area', 'phones', 'people', 'vulnerable', 'water'].filter((k) => cm.has(`${i}:${k}`));
    const devBad = ['kind', 'area', 'phones', 'people', 'vulnerable', 'water'].filter((k) => dm.has(`${i}:${k}`));
    return `<tr><td class="msgtext">${esc(lab.text)}</td>
      <td class="lab">${esc(lab.kind)}${lab.areaId ? ` · ${esc(lab.areaId)}` : ''}${lab.people ? ` · ${lab.people} ppl` : ''}${lab.vulnerable.length ? ` · ${esc(lab.vulnerable.join(', '))}` : ''}${lab.water ? ` · ${esc(lab.water)}` : ''}</td>
      ${f('kind', r.kind, r.kind === lab.kind)}
      ${lab.areaId ? f('area', r.areaId || 'none', r.areaId === lab.areaId) : '<td class="muted">not scored</td>'}
      ${isReq && lab.people != null ? f('people', r.people ?? 'none', r.people === lab.people) : '<td class="muted">—</td>'}
      <td class="${cloudBad.length ? 'bad' : 'ok'}">${cloudBad.length ? `✗ ${cloudBad.join(', ')}` : '✓ all'}</td>
      <td class="${devBad.length ? 'bad' : 'ok'}">${devBad.length ? `✗ ${devBad.join(', ')}` : '✓ all'}</td></tr>`;
  }).join('');
  const night = { messages: REAL_SET.map((x, i) => ({ id: `r${i}`, at: i, text: x.text, truth: { kind: x.kind, household: x.household } })) };
  const dd = evaluateDedupe(night);

  el.innerHTML = `
    <h2>The real flood test: Chennai, 2–3 December 2015</h2>
    <p class="lede">On 1–2 December 2015 Chennai had its heaviest rain in a century. Phone lines failed and people posted rescue requests on Twitter. A public archive kept 34,717 of those tweets. From it, FloodLine takes every post that mentions being stuck, rescue, water or a vulnerable person <i>and</i> has a phone number — <b>${REAL_STREAM.length} real posts</b> from ${clock(REAL_STREAM[0].at)} on 2 December to ${clock(REAL_STREAM[REAL_STREAM.length - 1].at)} on 3 December — and plays them in the order and at the minute they were posted. The wording is exactly as people wrote it; every name and phone number is changed. Read by: ${reader}.</p>
    <div class="row"><button class="btn dark" type="button" id="caseReplay">▶ Watch the replay on the board</button></div>

    <div class="tiles">
      <div class="tile"><b>${REAL_STREAM.length}</b><span>real posts in ${Math.round((REAL_STREAM[REAL_STREAM.length - 1].at - REAL_STREAM[0].at) / 60)} hours</span></div>
      <div class="tile"><b>${st.cases.length}</b><span>households needing help, after grouping repeats</span></div>
      <div class="tile"><b>${merged}</b><span>posts were repeats of a household already on the board</span></div>
      <div class="tile red"><b>${crit.length}</b><span>critical households — ${vul('pregnant')} pregnant or in labour, ${vul('infant')} with a baby, ${vul('medical')} medical</span></div>
      <div class="tile"><b>${offers || '—'}</b><span>posts were helplines or offers, kept off the request list</span></div>
      <div class="tile"><b>${scams}</b><span>flagged as possible scams (none of the real requests)</span></div>
    </div>

    <h2>How the night unfolded</h2>
    ${hourly(evs, st)}
    <p class="note">The first critical household (${firstCrit ? esc(firstCrit.vulnerable.map((v) => VUL[v]).join(', ') || WATER[firstCrit.water] || 'critical') : '—'}${firstCrit && firstCrit.areaName ? `, ${esc(firstCrit.areaName)}` : ''}) was posted at ${firstCrit ? clock(firstCrit.firstAt) : '—'}. ${multi.length} households were posted more than once; the most-posted one ${reposted[0].reportIds.length} times.</p>

    <h2>What a volunteer would have seen at 22:00 on 2 December</h2>
    <p class="note">${at22.cases.length} households were already on the board, built from ${evs.filter((e) => e.at <= 150).length} posts. The top of the list, in FloodLine's order:</p>
    <table class="cmp"><thead><tr><th>#</th><th>Priority</th><th>Where</th><th>Why it is here</th><th>Posts</th><th>First post (real wording)</th></tr></thead><tbody>
      ${top.map((c, i) => `<tr><td class="n">${i + 1}</td><td><span class="pill p-${c.tier}">${c.tier}</span></td><td>${esc(c.areaName || 'place not recognised')}</td><td>${esc(c.reasons.slice(0, 3).map((r) => r.label).join(' · '))}</td><td class="n">${c.reportIds.length}</td><td class="msgtext">${esc(c.reports[0].text.slice(0, 140))}</td></tr>`).join('')}
    </tbody></table>

    <h2>The same family, posted again and again</h2>
    <table class="cmp"><thead><tr><th>Times posted</th><th>Where</th><th>Grouped because</th><th>First post</th></tr></thead><tbody>
      ${reposted.map((c) => `<tr><td class="n"><b>${c.reportIds.length}×</b></td><td>${esc(c.areaName || '—')}</td><td>${esc([...new Set(c.merges.map((m) => m.why))].join(', ') || '—')}</td><td class="msgtext">${esc(c.reports[0].text.slice(0, 150))}</td></tr>`).join('')}
    </tbody></table>

    <h2>Which areas asked most</h2>
    <p class="note">${areas.map(([a, n]) => `${esc(a)} <b>${n}</b>`).join(' · ')}</p>

    <h2>How well did it understand them?</h2>
    <p class="lede">To measure it, I picked 60 of these posts at random and labelled each by hand — what kind of message, where, how many people, who is vulnerable, the water level, the phone numbers — and compared FloodLine's reading field by field (228 checks).</p>
    <table class="cmp"><thead><tr><th>On 60 real posts</th><th>Rules (offline)</th><th>Gemini Nano on the device + checks</th><th>Gemini in the cloud + checks</th></tr></thead><tbody>
      ${[['All fields', 'overall'], ['Type of message', 'kind'], ['Area', 'area'], ['Phone numbers', 'phones'], ['Number of people', 'people'], ['Who is vulnerable', 'vulnerable'], ['Water level', 'water']].map(([label, k]) => `<tr><td>${k === 'overall' ? '<b>All fields</b>' : label}</td><td class="n">${pct(k === 'overall' ? rules.overall : rules.fields[k])}</td><td class="n">${pct(k === 'overall' ? MEASURED_REAL.device.overall : MEASURED_REAL.device.fields[k])}</td><td class="n">${k === 'overall' ? `<b>${pct(MEASURED_REAL.cloud.overall)}</b>` : pct(MEASURED_REAL.cloud.fields[k])}</td></tr>`).join('')}
      <tr><td>Made-up details the checks dropped</td><td class="n">—</td><td class="n">${MEASURED_REAL.device.dropped}</td><td class="n">${MEASURED_REAL.cloud.dropped}</td></tr>
    </tbody></table>
    <p class="note">Grouping repeats on these 60: ${dd.reports} request posts were about ${dd.households} households; FloodLine made ${dd.clusters} groups (precision ${dd.precision}%, recall ${dd.recall}%). AI runs: ${esc(MEASURED_REAL.cloud.date)}. The rules column is live; it improved after I added 26 localities the real posts kept naming, so it is no longer a blind test (it was 78.1% before).</p>

    <details class="assume"><summary>Every one of the 60 posts: what it said, my label, and what each reader got</summary>
      <div class="scrollx"><table class="cmp msgs"><thead><tr><th>Real post (anonymised)</th><th>Correct answer</th><th>Rules: type</th><th>Rules: area</th><th>Rules: people</th><th>Cloud Gemini</th><th>Gemini Nano</th></tr></thead><tbody>${rows}</tbody></table></div>
    </details>

    <h2>What this does and doesn't show</h2>
    <ul class="note">
      <li>These are real posts, real timing, real repeats and real mess: helpline lists mixed with requests, typos, landmarks, Tamil.</li>
      <li>The archive has the posts, not what happened next. So this shows what FloodLine would have put in front of volunteers, and in what order — not where boats actually went that night.</li>
      <li>The archive is a hashtag sample, so the real volume was higher; that makes grouping repeats matter more, not less.</li>
      <li>Names, numbers, handles and door numbers were replaced automatically; a few names written without a phone number nearby may remain.</li>
    </ul>`;
  el.querySelector('#caseReplay').addEventListener('click', () => {
    const sel = document.getElementById('workspace'); sel.value = 'r2015'; sel.dispatchEvent(new Event('change'));
    document.querySelector('.tab[data-view="board"]').click();
    setTimeout(() => document.getElementById('playBtn').click(), 300);
  });
}

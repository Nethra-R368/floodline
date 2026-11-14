import { generateNight, simulate, evaluateExtraction, evaluateDedupe, DEFAULT_SIM } from './core/sim.js';
import { extractRules } from './core/extract.js';
import { HARD_SET, scoreHardSet } from './core/hardset.js';
import { fmtMinutes } from './core/priority.js';
import { isConfigured, readMessages } from './ai.js';
import { $, esc } from './util.js';

const METRICS = [
  { key: 'neverReached', label: 'Households no boat ever reached' },
  { key: 'criticalOver3h', label: 'Critical households (pregnant, medical, baby, neck-deep water) that waited over 3 hours or were never reached' },
  { key: 'duplicateTrips', label: 'Boat trips to a family that had already been rescued' },
  { key: 'wastedSelfRescued', label: 'Boat trips to a family that had already got out on their own' },
  { key: 'medianWaitCritical', label: 'Typical (median) wait for critical households that were reached', time: true },
  { key: 'medianWait', label: 'Typical (median) wait for everyone who was reached', time: true },
  { key: 'lostMessages', label: 'Messages that scrolled away before anyone read them' },
];

// Last recorded Gemini run on the hand-labelled set (README has the details).
const MEASURED = { date: '14 November 2026', model: 'gemini-3.6-flash', overall: 98.6, fields: { kind: 100, area: 96.7, phones: 100, people: 100, vulnerable: 95.7, water: 100 } };

const show = (v, time) => (v == null ? '—' : time ? fmtMinutes(v) : String(v));

function verdict(m, f, time) {
  if (m == null || f == null || m === f) return '<span class="muted">same</span>';
  const d = Math.abs(f - m);
  return f < m ? `<span class="better">${show(d, time)} fewer${time ? '' : ''}</span>`.replace(' fewer', time ? ' shorter' : ' fewer')
    : `<span class="worse">${show(d, time)} ${time ? 'longer' : 'more'}</span>`;
}

export function initBench({ getAi }) {
  const form = $('benchForm');
  const out = $('benchResults');
  let ran = false;
  let aiHard = null;

  function params() {
    const fd = new FormData(form);
    const n = (k) => Number(fd.get(k));
    return {
      seed: n('seed') || 2023,
      households: Math.max(20, Math.min(300, n('households') || 110)),
      sim: { boats: n('boats') || 10, volunteers: n('volunteers') || 3, minutesPerMessage: n('minutesPerMessage') || 2.5, manualRepeatCatch: Math.max(0, Math.min(1, n('manualRepeatCatch'))) },
    };
  }

  const assumptions = (p) => `<details class="assume"><summary>What the simulation assumes</summary><ul>
    <li><b>Today's way:</b> ${p.sim.volunteers} volunteers read the group chat from top to bottom. Each message takes ${p.sim.minutesPerMessage} minutes (read it, call back, post it in the boat group). A message left unread for ${DEFAULT_SIM.scrollAwayMin} minutes is treated as lost in the scroll. When a family is posted again, a volunteer recognises the repeat ${Math.round(p.sim.manualRepeatCatch * 100)}% of the time. An obviously critical message is moved to the front half the time.</li>
    <li><b>With FloodLine:</b> messages are pasted in within ${DEFAULT_SIM.floodlineDelayMin} minutes. FloodLine's own rule reader and repeat-matching code run on every message (no AI in this test). A free boat takes the highest-priority request nobody has taken.</li>
    <li><b>Boats:</b> a round trip is 20 minutes plus 10 minutes per km from the nearest of four depots. A boat that arrives after the family was rescued, or got out on their own, has made a wasted trip.</li>
    <li><b>Reading the medians:</b> they only include households that were reached. Today's way never reaches many households, and those are missing from its median, so read it next to "never reached".</li>
    <li>FloodLine serves critical households first, so lower-risk households can wait longer. That is a choice, and it shows in the numbers.</li>
    <li>This is a simulation with made-up households and messages. It shows what better coordination does under these assumptions. It is not a result from a real flood.</li>
  </ul></details>`;

  function runOne() {
    const p = params();
    const night = generateNight({ seed: p.seed, households: p.households });
    const m = simulate(night, 'manual', p.sim);
    const f = simulate(night, 'floodline', p.sim);
    const reqs = night.messages.filter((x) => x.truth.kind === 'request').length;
    out.innerHTML = `
      <p class="result-line">On this night, with the same ${p.sim.boats} boats, FloodLine reached <b>${m.neverReached - f.neverReached}</b> more households and made <b>${m.duplicateTrips - f.duplicateTrips}</b> fewer trips to families who were already rescued.</p>
      <p class="result-meta">Night ${p.seed}: ${night.households.length} households, ${night.messages.length} messages (${reqs} of them requests, many repeated), ${f.criticalTotal} critical households, 12 hours.</p>
      <table class="cmp"><thead><tr><th>Measure</th><th>Today's way</th><th>With FloodLine</th><th>Difference</th></tr></thead><tbody>
      ${METRICS.map((x) => `<tr><td>${x.label}</td><td class="n">${show(m[x.key], x.time)}</td><td class="n">${show(f[x.key], x.time)}</td><td class="n">${verdict(m[x.key], f[x.key], x.time)}</td></tr>`).join('')}
      </tbody></table>${assumptions(p)}`;
    renderAccuracy(night);
    ran = true;
  }

  async function runMany() {
    const p = params();
    out.innerHTML = '<p class="result-line">Running 20 different nights…</p>';
    const rows = [];
    for (let s = 1; s <= 20; s++) {
      const night = generateNight({ seed: s * 101, households: p.households });
      rows.push({ manual: simulate(night, 'manual', p.sim), floodline: simulate(night, 'floodline', p.sim) });
      if (s % 4 === 0) await new Promise((r) => setTimeout(r, 0));
    }
    const avg = (side, key) => {
      const xs = rows.map((r) => r[side][key]).filter((v) => v != null);
      return xs.length ? Math.round((xs.reduce((a, b) => a + b, 0) / xs.length) * 10) / 10 : null;
    };
    const count = (key, cmp) => rows.filter((r) => cmp(r.floodline[key], r.manual[key])).length;
    out.innerHTML = `<p class="result-line">Averages over 20 different simulated nights (${p.households} households each, ${p.sim.boats} boats).</p>
      <table class="cmp"><thead><tr><th>Measure</th><th>Today's way</th><th>With FloodLine</th><th>Nights FloodLine did better / worse</th></tr></thead><tbody>
      ${METRICS.map((x) => `<tr><td>${x.label}</td><td class="n">${show(avg('manual', x.key), x.time)}</td><td class="n">${show(avg('floodline', x.key), x.time)}</td><td class="n"><span class="better">${count(x.key, (a, b) => a < b)}</span> / <span class="worse">${count(x.key, (a, b) => a > b)}</span></td></tr>`).join('')}
      </tbody></table>${assumptions(p)}`;
  }

  function renderAccuracy(night) {
    const gen = evaluateExtraction(night);
    const dd = evaluateDedupe(night);
    const rules = scoreHardSet(extractRules);
    const fields = [['kind', 'Type of message (request, update, offer, other)'], ['area', 'Area'], ['phones', 'Phone numbers'], ['people', 'Number of people'], ['vulnerable', 'Who is vulnerable'], ['water', 'Water level']];
    const genMap = { kind: gen.kind, area: gen.area, phones: gen.phone, people: gen.people, vulnerable: gen.vulnerable, water: gen.water };
    const cell = (v) => (v == null ? '—' : `${v}%`);
    $('accuracy').innerHTML = `<table class="cmp"><thead><tr><th>Field</th><th>Generated night, rules</th><th>Hard set, rules</th><th>Hard set, Gemini + checks</th></tr></thead><tbody>
      ${fields.map(([k, label]) => `<tr><td>${label}</td><td class="n">${cell(genMap[k])}</td><td class="n">${cell(rules.fields[k])}</td><td class="n">${cell((aiHard || MEASURED).fields[k])}</td></tr>`).join('')}
      <tr><td><b>All fields</b></td><td class="n"></td><td class="n"><b>${rules.overall}%</b></td><td class="n"><b>${(aiHard || MEASURED).overall}%</b></td></tr>
      </tbody></table>
      <p class="note">${aiHard ? 'Gemini column: the run you just did.' : `Gemini column: measured on ${MEASURED.date} with ${MEASURED.model}. Its two mistakes: an Adyar river warning placed in Kotturpuram, and a woman in labour also marked as needing medical care. Press the button below to run it again with your own key.`}</p>
      <p class="note">Grouping repeats on the generated night: ${dd.reports} request messages became ${dd.clusters} households; there were really ${dd.households}. (Precision ${dd.precision}%, recall ${dd.recall}%.)</p>`;
    const src = aiHard || rules;
    $('misses').innerHTML = `<h2>What ${aiHard ? 'Gemini' : 'the rules'} still get wrong on the hard set</h2>
      <p class="note">${src.misses.length} mistakes out of ${src.checks} checks.</p>
      ${src.misses.slice(0, 14).map((m) => `<div class="miss"><b>${m.field}</b>: should be ${esc(JSON.stringify(m.want))}, got ${esc(JSON.stringify(m.got))}<br><span class="muted">${esc(m.text.slice(0, 130))}</span></div>`).join('')}`;
  }

  form.addEventListener('submit', (e) => { e.preventDefault(); runOne(); });
  $('seedsBtn').addEventListener('click', runMany);
  $('aiHardBtn').addEventListener('click', async () => {
    const ai = getAi();
    const status = $('aiHardStatus');
    if (!isConfigured()) { status.textContent = 'AI reading is not set up on this copy of FloodLine.'; return; }
    status.textContent = 'Gemini is reading the 30 messages…';
    try {
      const { xs, where } = await readMessages(HARD_SET.map((h) => h.text), ai.mode === 'off' ? 'auto' : ai.mode, (d, n, src) => { status.textContent = `Gemini has read ${d} of ${n} (${src === 'device' ? 'on this device' : 'in the cloud'})…`; });
      aiHard = scoreHardSet((t, i) => xs[i]);
      const blocked = xs.reduce((s, x) => s + (x.guard || []).filter((g) => /Blocked|Ignored/.test(g)).length, 0);
      status.textContent = `Done: ${where.device} read on this device, ${where.cloud} in the cloud. ${blocked} detail${blocked === 1 ? '' : 's'} not in the messages ${blocked === 1 ? 'was' : 'were'} not used.`;
      renderAccuracy(generateNight({ seed: params().seed, households: params().households }));
    } catch (err) {
      status.textContent = err.message;
    }
  });

  return { show() { if (!ran) runOne(); } };
}

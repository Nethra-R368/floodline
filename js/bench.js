import { generateNight, simulate, evaluateExtraction, evaluateDedupe, DEFAULT_SIM } from './core/sim.js';
import { extractRules } from './core/extract.js';
import { HARD_SET, scoreHardSet } from './core/hardset.js';
import { fmtMinutes } from './core/priority.js';
import { extractWithGemini } from './gemini.js';
import { $, esc } from './util.js';

const METRICS = [
  { key: 'neverReached', label: 'Households never reached', lower: true, fmt: (v) => v },
  { key: 'criticalOver3h', label: 'Critical cases (pregnant, medical, baby, neck-deep) waiting 3h+ or never reached', lower: true, fmt: (v) => v },
  { key: 'duplicateTrips', label: 'Boat trips wasted on a family already rescued', lower: true, fmt: (v) => v },
  { key: 'wastedSelfRescued', label: 'Boat trips to families who had already got out', lower: true, fmt: (v) => v },
  { key: 'medianWaitCritical', label: 'Median wait, critical cases', lower: true, fmt: (v) => (v == null ? '—' : fmtMinutes(v)) },
  { key: 'medianWait', label: 'Median wait, everyone reached', lower: true, fmt: (v) => (v == null ? '—' : fmtMinutes(v)) },
  { key: 'lostMessages', label: 'Messages that scrolled away unread', lower: true, fmt: (v) => v },
];

function delta(m, f, lower, isTime) {
  if (m == null || f == null) return '<div class="delta same">—</div>';
  if (m === f) return '<div class="delta same">same</div>';
  const better = lower ? f < m : f > m;
  const diff = Math.abs(f - m);
  return `<div class="delta ${better ? 'better' : 'worse'}">${better ? '▼' : '▲'} ${isTime ? fmtMinutes(diff) : diff} ${better ? 'better' : 'worse'} with FloodLine</div>`;
}

function headline(m, f) {
  const parts = [];
  if (m.neverReached > f.neverReached) parts.push(`reached <b>${m.neverReached - f.neverReached} more households</b>`);
  if (m.duplicateTrips > f.duplicateTrips) parts.push(`wasted <b>${f.duplicateTrips}</b> boat trips on repeats instead of <b>${m.duplicateTrips}</b>`);
  if (m.criticalOver3h > f.criticalOver3h) parts.push(`left <b>${f.criticalOver3h}</b> critical cases waiting 3h+ instead of <b>${m.criticalOver3h}</b>`);
  return parts.length ? `With the same boats, FloodLine ${parts.join(', ')}.` : 'On this night FloodLine did not beat manual coordination on the headline numbers.';
}

export function initBench({ getAi }) {
  const form = $('benchForm');
  const out = $('benchResults');
  let ran = false;

  function params() {
    const fd = new FormData(form);
    const n = (k) => Number(fd.get(k));
    return {
      seed: n('seed') || 2023,
      households: Math.max(20, Math.min(300, n('households') || 110)),
      sim: { boats: n('boats') || 10, volunteers: n('volunteers') || 3, minutesPerMessage: n('minutesPerMessage') || 2.5, manualRepeatCatch: Math.max(0, Math.min(1, n('manualRepeatCatch'))) },
    };
  }

  function runOne() {
    const p = params();
    const night = generateNight({ seed: p.seed, households: p.households });
    const m = simulate(night, 'manual', p.sim);
    const f = simulate(night, 'floodline', p.sim);
    const cards = METRICS.map((x) => `<div class="metric"><div class="label">${x.label}</div><div class="pair"><div class="m"><small>Manual</small><b>${x.fmt(m[x.key])}</b></div><div class="f"><small>FloodLine</small><b>${x.fmt(f[x.key])}</b></div></div>${delta(m[x.key], f[x.key], x.lower, x.key.startsWith('median'))}</div>`).join('');
    out.innerHTML = `<p class="headline">${headline(m, f)}</p>
      <p class="small muted">Night ${p.seed}: ${night.households.length} households, ${night.messages.length} messages (${night.messages.filter((x) => x.truth.kind === 'request').length} requests incl. reposts), ${f.criticalTotal} critical, ${p.sim.boats} boats, 12 hours.</p>
      <div class="results">${cards}</div>
      <details class="panel assumptions"><summary><b>Model assumptions (change them above)</b></summary>
        <ul>
          <li>Manual: ${p.sim.volunteers} volunteers read the chat in order; each message takes ${p.sim.minutesPerMessage} min (read, call back, post in boat group). Unread messages older than ${DEFAULT_SIM.scrollAwayMin} min are lost in the scroll. A repost of a household already sent a boat is recognised ${Math.round(p.sim.manualRepeatCatch * 100)}% of the time. Obviously critical messages jump the queue half the time.</li>
          <li>FloodLine: every message reaches it within ${DEFAULT_SIM.floodlineDelayMin} min (forwarded/pasted in batches). It runs the real rule extractor and duplicate matcher (no AI in this benchmark), and a free boat takes the highest-priority unassigned case.</li>
          <li>Boat round trip = 20 min + 10 min per km from the nearest of 4 depots. A boat arriving after the family was rescued or got out by themselves is a wasted trip.</li>
          <li>Median waits only count households that were reached. Manual coordination leaves many households unreached, and those never enter its median, so compare medians together with "never reached".</li>
          <li>FloodLine's median wait for <i>everyone</i> can be longer: it deliberately serves critical cases first, so low-risk households wait more. That trade-off is shown, not hidden.</li>
          <li>The night is simulated (fictional names and numbers). It shows the coordination effect, not a field result.</li>
        </ul></details>`;
    renderAccuracy(night);
    ran = true;
  }

  async function runMany() {
    const p = params();
    out.innerHTML = '<p class="headline">Running 20 different nights…</p>';
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
    const wins = (key) => rows.filter((r) => r.floodline[key] < r.manual[key]).length;
    const losses = (key) => rows.filter((r) => r.floodline[key] > r.manual[key]).length;
    out.innerHTML = `<p class="headline">Average over 20 simulated nights (${p.households} households each, ${p.sim.boats} boats)</p>
      <table class="acc-table"><thead><tr><th>Metric</th><th>Manual</th><th>FloodLine</th><th>FloodLine better / worse</th></tr></thead><tbody>
      ${METRICS.map((x) => `<tr><td>${x.label}</td><td class="num">${x.key.startsWith('median') ? fmtMinutes(avg('manual', x.key)) : avg('manual', x.key)}</td><td class="num">${x.key.startsWith('median') ? fmtMinutes(avg('floodline', x.key)) : avg('floodline', x.key)}</td><td class="num">better ${wins(x.key)}, worse ${losses(x.key)} of 20</td></tr>`).join('')}
      </tbody></table>`;
  }

  let aiHard = null;
  function renderAccuracy(night) {
    const gen = evaluateExtraction(night);
    const dd = evaluateDedupe(night);
    const rules = scoreHardSet(extractRules);
    const fields = ['kind', 'area', 'phones', 'people', 'vulnerable', 'water'];
    const genMap = { kind: gen.kind, area: gen.area, phones: gen.phone, people: gen.people, vulnerable: gen.vulnerable, water: gen.water };
    const cell = (v) => (v == null ? '—' : `${v}%`);
    $('accuracy').innerHTML = `<table class="acc-table"><thead><tr><th>Field</th><th>Generated night · rules</th><th>Hard set · rules</th><th>Hard set · Gemini + guardrails</th></tr></thead><tbody>
      ${fields.map((k) => `<tr><td>${k}</td><td class="num">${cell(genMap[k])}</td><td class="num">${cell(rules.fields[k])}</td><td class="num">${aiHard ? cell(aiHard.fields[k]) : '<span class="muted">run below</span>'}</td></tr>`).join('')}
      <tr><td><b>overall</b></td><td></td><td class="num"><b>${rules.overall}%</b> <span class="muted small">(${rules.checks} checks)</span></td><td class="num">${aiHard ? `<b>${aiHard.overall}%</b>` : ''}</td></tr>
      </tbody></table>
      <p class="small muted">Duplicate matching on the generated night: precision ${dd.precision}%, recall ${dd.recall}% (${dd.reports} reports → ${dd.clusters} cases for ${dd.households} real households).</p>`;
    const list = (aiHard || rules).misses.slice(0, 12);
    $('misses').innerHTML = `<h4 class="small muted">What ${aiHard ? 'Gemini' : 'the rules'} still get wrong on the hard set (${(aiHard || rules).misses.length} misses)</h4>${list.map((m) => `<div class="miss"><b>${m.field}</b>: wanted ${esc(JSON.stringify(m.want))}, got ${esc(JSON.stringify(m.got))} · <span class="muted">${esc(m.text.slice(0, 110))}</span></div>`).join('')}`;
  }

  form.addEventListener('submit', (e) => { e.preventDefault(); runOne(); });
  $('seedsBtn').addEventListener('click', runMany);
  $('aiHardBtn').addEventListener('click', async () => {
    const ai = getAi();
    const status = $('aiHardStatus');
    if (!ai.key) { status.textContent = 'Add a Gemini key in ⚙️ settings first.'; return; }
    status.textContent = 'Asking Gemini…';
    try {
      const xs = await extractWithGemini(HARD_SET.map((h) => h.text), ai.key, ai.model, 10, (d, n) => { status.textContent = `Gemini read ${d}/${n}…`; });
      aiHard = scoreHardSet((t, i) => xs[i]);
      const blocked = xs.reduce((s, x) => s + (x.guard || []).filter((g) => /Blocked|Ignored/.test(g)).length, 0);
      status.textContent = `Done. Guardrails blocked ${blocked} detail${blocked === 1 ? '' : 's'} that were not in the messages.`;
      renderAccuracy(generateNight({ seed: params().seed, households: params().households }));
    } catch (err) {
      status.textContent = err.message;
    }
  });

  return { show() { if (!ran) runOne(); } };
}

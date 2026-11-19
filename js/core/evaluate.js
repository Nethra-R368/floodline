// Scores recorded AI answers on the 60 labelled real posts with FloodLine's *current* checks, so every number on the
// Results and Real flood test pages is computed from data in this repository (nothing is typed in by hand).
import { REAL_SET } from './realset.js';
import { RAW_REAL } from './measured.js';
import { extractRules } from './extract.js';
import { guardAi } from './prompt.js';
import { scoreHardSet } from './hardset.js';

export function scoreRecorded(who) {
  const run = RAW_REAL[who];
  if (!run) return null;
  const xs = REAL_SET.map((p, i) => guardAi(run.raws[i] || {}, p.text, extractRules(p.text), who === 'device' ? 'device' : 'cloud'));
  const score = scoreHardSet((t, i) => xs[i], REAL_SET);
  const invented = xs.reduce((n, x) => n + x.guard.filter((g) => g.startsWith('Blocked')).length, 0);
  // Real requests the AI read as something else (FloodLine kept them on the list anyway).
  const wouldHide = REAL_SET.filter((p, i) => p.kind === 'request' && xs[i].aiKind).length;
  // The AI's own reading of the message type (before FloodLine's safety rule keeps uncertain requests on the list).
  const own = scoreHardSet((t, i) => ({ ...xs[i], kind: xs[i].aiKind || xs[i].kind }), REAL_SET);
  return { ...score, own, invented, wouldHide, model: Object.keys(run.models).join(', '), date: run.date };
}

export function scoreRules() {
  return scoreHardSet(extractRules, REAL_SET);
}

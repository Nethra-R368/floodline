// Explainable priority score: every point comes with a reason a volunteer can read.

export const WEIGHTS = {
  pregnant: 40, medical: 40, infant: 25, elderly: 20, disabled: 20,
  water: { neck: 35, roof: 20, waist: 15, knee: 0 },
  trapped: 10,
  perPerson: 3, maxPeople: 15,
  perTenMinWaiting: 1, maxWaiting: 30,
  perExtraReport: 3, maxReports: 9,
  suppliesOnly: -15,
};

const CRITICAL_FLOOR = 70;

const LABEL = {
  pregnant: 'Pregnant / in labour',
  medical: 'Medical need (dialysis, oxygen, injury…)',
  infant: 'Baby or small child',
  elderly: 'Elderly person',
  disabled: 'Cannot walk / disabled',
};

export function fmtMinutes(min) {
  const m = Math.max(0, Math.round(min));
  if (m < 60) return `${m}m`;
  return `${Math.floor(m / 60)}h ${String(m % 60).padStart(2, '0')}m`;
}

/**
 * Score a case. `waitingMin` counts only while nobody has claimed it.
 * Returns { score, tier, reasons: [{ label, points }] } with reasons sorted by weight.
 */
export function scoreCase(c, waitingMin = 0) {
  const reasons = [];
  const add = (label, points) => { if (points) reasons.push({ label, points }); };
  for (const v of ['pregnant', 'medical', 'infant', 'elderly', 'disabled']) {
    if (c.vulnerable.includes(v)) add(LABEL[v], WEIGHTS[v]);
  }
  if (c.water) add(c.water === 'roof' ? 'Stranded on upper floor / terrace' : `Water at ${c.water} level`, WEIGHTS.water[c.water]);
  if (c.trapped) add('Says they are trapped', WEIGHTS.trapped);
  if (c.people) add(`${c.people} ${c.people === 1 ? 'person' : 'people'}`, Math.min(WEIGHTS.maxPeople, c.people * WEIGHTS.perPerson));
  if (waitingMin >= 10) add(`Waiting ${fmtMinutes(waitingMin)} with no one assigned`, Math.min(WEIGHTS.maxWaiting, Math.floor(waitingMin / 10) * WEIGHTS.perTenMinWaiting));
  const extra = (c.reportIds ? c.reportIds.length : 1) - 1;
  if (extra > 0) add(`Reported ${extra + 1} times`, Math.min(WEIGHTS.maxReports, extra * WEIGHTS.perExtraReport));
  if (c.needs.length && !c.needs.includes('rescue') && !c.water && !c.trapped) add('Supplies only (no rescue asked)', WEIGHTS.suppliesOnly);
  // A household the ground rules call time-critical (pregnant / in labour, medical, baby, neck-deep water)
  // is never shown below "critical", however few other details the message gives.
  const raw = reasons.reduce((s, r) => s + r.points, 0);
  if (isCritical(c) && raw < CRITICAL_FLOOR) add('Time-critical: moved up to critical', CRITICAL_FLOOR - raw);
  reasons.sort((a, b) => b.points - a.points);
  const score = Math.max(0, reasons.reduce((s, r) => s + r.points, 0));
  const tier = score >= 70 ? 'critical' : score >= 45 ? 'high' : score >= 25 ? 'medium' : 'low';
  return { score, tier, reasons };
}

/** Truly time-critical by the ground rules (used for the benchmark metric). */
export function isCritical(c) {
  return c.vulnerable.includes('pregnant') || c.vulnerable.includes('medical') || c.vulnerable.includes('infant') || c.water === 'neck';
}

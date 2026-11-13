// Group reports that describe the same household into one "case".
// Deterministic and explainable: every merge records WHY (same phone, same address...).

import { addressTokens } from './extract.js';
import { areaById } from './gazetteer.js';

const WATER_RANK = { knee: 1, waist: 2, roof: 3, neck: 4 };

export function jaccard(a, b) {
  if (!a.length || !b.length) return 0;
  const A = new Set(a);
  const B = new Set(b);
  let inter = 0;
  for (const x of A) if (B.has(x)) inter++;
  return inter / (A.size + B.size - inter);
}

/** Why two extracted reports are the same household, or null if they are not. */
export function sameHousehold(x, y) {
  const px = new Set(x.phones && x.phones.length ? x.phones : x.phone ? [x.phone] : []);
  const py = y.phones && y.phones.length ? y.phones : y.phone ? [y.phone] : [];
  if (py.some((p) => px.has(p))) return 'same phone number';
  if (!x.areaId || x.areaId !== y.areaId) return null;
  const tx = x._tokens || addressTokens(x.address);
  const ty = y._tokens || addressTokens(y.address);
  const sim = jaccard(tx, ty);
  const numX = tx.find((w) => /^\d/.test(w));
  const numY = ty.find((w) => /^\d/.test(w));
  const doorClash = numX && numY && numX !== numY && tx.length > 1 && ty.length > 1 && tx.indexOf(numX) === 0 && ty.indexOf(numY) === 0;
  if (!doorClash && tx.length >= 2 && ty.length >= 2 && sim >= 0.6) return 'same address';
  if (x.name && y.name && x.name.toLowerCase() === y.name.toLowerCase() && sim >= 0.34) return 'same name and street';
  return null;
}

/**
 * Incremental clusterer: add reports one by one (in time order); each new report joins
 * every existing cluster it matches, merging clusters when it bridges two of them.
 */
export function createClusterer() {
  const parent = new Map();
  const reports = [];
  const reasons = new Map(); // root id -> [{a, b, why}]
  const find = (id) => {
    let r = id;
    while (parent.get(r) !== r) r = parent.get(r);
    let c = id;
    while (parent.get(c) !== r) { const n = parent.get(c); parent.set(c, r); c = n; }
    return r;
  };
  const byAt = new Map();
  const union = (a, b, why) => {
    let ra = find(a);
    let rb = find(b);
    if (ra === rb) return;
    // keep the earliest report as the case id, so ids stay stable as cases grow
    if (byAt.get(rb) < byAt.get(ra) || (byAt.get(rb) === byAt.get(ra) && rb < ra)) [ra, rb] = [rb, ra];
    parent.set(rb, ra);
    const merged = [...(reasons.get(ra) || []), ...(reasons.get(rb) || []), { a, b, why }];
    reasons.set(ra, merged);
    reasons.delete(rb);
  };
  return {
    add(report) {
      const x = report.x;
      x._tokens = addressTokens(x.address);
      parent.set(report.id, report.id);
      byAt.set(report.id, report.at);
      for (const other of reports) {
        const why = sameHousehold(other.x, x);
        if (why) union(other.id, report.id, why);
      }
      reports.push(report);
      return find(report.id);
    },
    root: find,
    clusters() {
      const groups = new Map();
      for (const r of reports) {
        const root = find(r.id);
        if (!groups.has(root)) groups.set(root, []);
        groups.get(root).push(r);
      }
      return [...groups.entries()].map(([id, rs]) => ({ id, reports: rs, merges: reasons.get(id) || [] }));
    },
  };
}

/** Combine the reports of one cluster into a single case description. */
export function mergeCase({ id, reports, merges }) {
  const sorted = [...reports].sort((a, b) => a.at - b.at);
  const xs = sorted.map((r) => r.x);
  const pick = (f) => xs.map(f).find((v) => v != null && v !== '') ?? null;
  const areaId = pick((x) => x.areaId);
  const area = areaById(areaId);
  const phones = [...new Set(xs.flatMap((x) => (x.phones && x.phones.length ? x.phones : x.phone ? [x.phone] : [])))];
  const water = xs.map((x) => x.water).filter(Boolean).sort((a, b) => WATER_RANK[b] - WATER_RANK[a])[0] || null;
  const people = Math.max(0, ...xs.map((x) => x.people || 0)) || null;
  const address = xs.map((x) => x.address || '').sort((a, b) => b.length - a.length)[0] || '';
  return {
    id,
    reportIds: sorted.map((r) => r.id),
    reports: sorted,
    firstAt: sorted[0].at,
    lastAt: sorted[sorted.length - 1].at,
    areaId,
    areaName: area ? area.name : 'Unknown area',
    lat: area ? area.lat : null,
    lng: area ? area.lng : null,
    address,
    name: pick((x) => x.name),
    phones,
    people,
    vulnerable: [...new Set(xs.flatMap((x) => x.vulnerable))],
    water,
    needs: [...new Set(xs.flatMap((x) => x.needs))],
    trapped: xs.some((x) => x.trapped),
    merges,
  };
}

export function clusterReports(reports) {
  const c = createClusterer();
  [...reports].sort((a, b) => a.at - b.at || (a.id < b.id ? -1 : 1)).forEach((r) => c.add(r));
  return c.clusters().map(mergeCase);
}

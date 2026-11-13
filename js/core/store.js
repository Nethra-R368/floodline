// Event-sourced state. Every action is an append-only event; the board is rebuilt from the log.
// That makes sync simple (volunteers exchange events), keeps a full audit trail, and makes
// the logic testable without a browser.
//
// Events:
//   { t: 'report', id, at, text, source, x }          a raw message + its extraction
//   { t: 'extract', id, at, reportId, x }              better extraction for a report (e.g. from AI)
//   { t: 'claim',  id, at, caseId, by }                a volunteer takes the case
//   { t: 'status', id, at, caseId, status, by, note }  enroute | rescued | unreachable | open
//
// Times are minutes (number). In live mode they are minutes since the epoch; in replay mode
// minutes since the start of the simulated night.

import { clusterReports, sameHousehold } from './dedupe.js';
import { scoreCase } from './priority.js';
import { addressTokens } from './extract.js';

export const STATUS = ['new', 'claimed', 'enroute', 'rescued', 'unreachable'];
export const STALE_UNCLAIMED_MIN = 45;
export const STALE_ASSIGNED_MIN = 90;
const DONE = new Set(['rescued', 'unreachable']);

let counter = 0;
export function eventId(prefix = 'e') {
  counter = (counter + 1) % 1e6;
  return `${prefix}${Date.now().toString(36)}${counter.toString(36)}${Math.random().toString(36).slice(2, 6)}`;
}

/** Merge two event logs (e.g. from two volunteers) without duplicates, in time order. */
export function mergeEvents(a, b) {
  const seen = new Map();
  for (const e of [...a, ...b]) if (e && e.id && !seen.has(e.id)) seen.set(e.id, e);
  return [...seen.values()].sort((x, y) => x.at - y.at || (x.id < y.id ? -1 : 1));
}

export function buildState(events, now) {
  const extractions = new Map();
  const reports = [];
  const actions = [];
  for (const e of events) {
    if (e.t === 'report') reports.push({ ...e });
    else if (e.t === 'extract') extractions.set(e.reportId, e.x);
    else if (e.t === 'claim' || e.t === 'status') actions.push(e);
  }
  for (const r of reports) if (extractions.has(r.id)) r.x = extractions.get(r.id);

  const requests = reports.filter((r) => r.x.kind === 'request');
  const updates = reports.filter((r) => r.x.kind === 'update');
  const offers = reports.filter((r) => r.x.kind === 'offer');
  const noise = reports.filter((r) => r.x.kind === 'noise');

  const cases = clusterReports(requests).map((c) => {
    const ids = new Set(c.reportIds);
    const mine = actions.filter((a) => ids.has(a.caseId)).sort((a, b) => a.at - b.at);
    let status = 'new';
    let owner = null;
    let lastActionAt = null;
    let resolvedAt = null;
    const history = [];
    for (const a of mine) {
      lastActionAt = a.at;
      history.push(a);
      if (a.t === 'claim') { owner = a.by; if (status === 'new') status = 'claimed'; }
      else if (a.status === 'open') { status = owner ? 'claimed' : 'new'; resolvedAt = null; }
      else { status = a.status; if (a.by && !owner) owner = a.by; resolvedAt = DONE.has(a.status) ? a.at : null; }
    }
    // Messages saying "we are safe now" for this household.
    const caseLike = { phones: c.phones, phone: c.phones[0], areaId: c.areaId, address: c.address, name: c.name, _tokens: addressTokens(c.address) };
    const safeReports = updates.filter((u) => sameHousehold(caseLike, u.x));
    const reshared = resolvedAt != null ? c.reports.filter((r) => r.at > resolvedAt).length : 0;
    const waiting = status === 'new' ? now - c.firstAt : 0;
    const prio = scoreCase(c, waiting);
    const flags = [];
    const saysSafe = safeReports.length > 0 && !DONE.has(status);
    if (status === 'new' && !saysSafe && now - c.firstAt >= STALE_UNCLAIMED_MIN) flags.push('stale');
    if ((status === 'claimed' || status === 'enroute') && now - (lastActionAt ?? c.firstAt) >= STALE_ASSIGNED_MIN) flags.push('check');
    if (reshared) flags.push('reshared');
    if (saysSafe) flags.push('says-safe');
    return { ...c, status, owner, lastActionAt, resolvedAt, history, safeReports, reshared, waiting, ...prio, flags };
  });

  const active = (c) => !DONE.has(c.status);
  // Order: open before closed; unassigned before taken; anyone still waiting before families who say they are safe; then points.
  const safe = (c) => c.flags.includes('says-safe');
  cases.sort((a, b) => (active(b) - active(a)) || (b.status === 'new') - (a.status === 'new') || safe(a) - safe(b) || b.score - a.score || a.firstAt - b.firstAt);

  const open = cases.filter(active);
  return {
    now,
    cases,
    reports,
    offers,
    noise,
    updates,
    stats: {
      messages: reports.length,
      requests: requests.length,
      cases: cases.length,
      merged: requests.length - cases.length,
      open: open.length,
      unassigned: open.filter((c) => c.status === 'new').length,
      critical: open.filter((c) => c.tier === 'critical').length,
      stale: open.filter((c) => c.flags.includes('stale')).length,
      rescued: cases.filter((c) => c.status === 'rescued').length,
      offers: offers.length,
      noise: noise.length + updates.length,
    },
  };
}

/** Text a volunteer can send to close the loop with a family. */
export function followUpText(c, lang = 'both') {
  const en = `FloodLine volunteer here about your help request${c.areaName ? ` in ${c.areaName}` : ''}. Do you still need rescue? Reply YES if still stuck, SAFE if you are out. How many people and is anyone sick or pregnant?`;
  const ta = 'FloodLine தன்னார்வலர். உங்களுக்கு இன்னும் மீட்பு தேவையா? இன்னும் மாட்டிக்கொண்டிருந்தால் YES, பாதுகாப்பாக இருந்தால் SAFE என்று பதில் அனுப்புங்கள்.';
  return lang === 'en' ? en : lang === 'ta' ? ta : `${ta}\n\n${en}`;
}

/** Reply for people who keep re-sharing a request that is already done. */
export function alreadyRescuedText(c, at) {
  const place = [c.address, c.areaName].filter(Boolean).join(', ');
  return `தகவல்: ${place} குடும்பம்${at ? ` ${at} மணிக்கு` : ''} மீட்கப்பட்டனர். இந்தக் கோரிக்கையை இனி பகிர வேண்டாம், படகுகள் காத்திருப்பவர்களுக்குச் செல்லட்டும். நன்றி.\n\n`
    + `Update: the family at ${place} was rescued${at ? ` at ${at}` : ''}. Please stop forwarding this request so the boats go to people who are still waiting. Thank you.`;
}

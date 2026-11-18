// Synthetic flood night + benchmark.
//
// generateNight() writes realistic, messy SOS messages (English / Tanglish / Tamil) for a set of
// households whose true details we know, including re-posts by relatives, forwards, missing
// numbers, "we are safe now" updates, boat offers and chatter.
//
// simulate() replays that night twice with the same boats:
//   'manual'    volunteers read the group chat in order, a message takes minutes to handle,
//               old messages scroll away, repeats are only sometimes recognised;
//   'floodline' every message goes through FloodLine's real extractor + duplicate matcher,
//               and a free boat always takes the highest-priority open case.
// All model assumptions are parameters and are shown in the UI next to the results.

import { AREAS, distanceKm } from './gazetteer.js';
import { extractRules } from './extract.js';
import { createClusterer, mergeCase } from './dedupe.js';
import { scoreCase, isCritical } from './priority.js';

export function rng(seed) {
  let a = seed >>> 0;
  const next = () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  return {
    next,
    int: (lo, hi) => lo + Math.floor(next() * (hi - lo + 1)),
    pick: (arr) => arr[Math.floor(next() * arr.length)],
    chance: (p) => next() < p,
    weighted: (pairs) => {
      const total = pairs.reduce((s, [, w]) => s + w, 0);
      let r = next() * total;
      for (const [v, w] of pairs) { r -= w; if (r <= 0) return v; }
      return pairs[pairs.length - 1][0];
    },
  };
}

// Flood-prone localities get more weight (based on where 2015/2023 requests clustered).
const AREA_WEIGHT = {
  velachery: 9, pallikaranai: 8, mudichur: 7, 'manali-new-town': 6, tambaram: 5, madipakkam: 6, medavakkam: 4,
  vyasarpadi: 5, pulianthope: 4, korattur: 3, saidapet: 4, kotturpuram: 4, adyar: 3, perungudi: 4, thoraipakkam: 4,
  semmencherry: 4, 'kannagi-nagar': 3, nanganallur: 3, ramapuram: 3, mugalivakkam: 3, porur: 2, ennore: 3, kolathur: 3,
  pallavaram: 2, chromepet: 2, taramani: 3, ekkatuthangal: 2, manali: 3,
};

const STREETS = ['Gandhi Street', 'Bharathi Nagar 2nd Street', 'Lake View Road', 'Kamaraj Salai', 'Anna Main Road', 'Periyar Nagar 3rd Street',
  'Nehru Colony 4th Cross Street', 'Vijaya Nagar 1st Main Road', 'Ram Nagar North Extension', 'Thiruvalluvar Street', 'Indira Nagar 5th Avenue',
  'Rajaji Street', 'Bajanai Kovil Street', 'VGP Selva Nagar 2nd Street', 'Sri Sai Nagar 6th Street', 'Balaji Nagar Main Road', 'Kalaignar Karunanidhi Salai',
  'Ambedkar Street', 'Sathya Nagar 7th Street', 'Mahalakshmi Nagar 3rd Cross Street', 'Ganesh Nagar 1st Street', 'Pillaiyar Kovil Street', 'Kannadasan Salai'];
const NAMES = ['Ravi', 'Lakshmi', 'Karthik', 'Priya', 'Senthil', 'Meena', 'Arun', 'Divya', 'Murugan', 'Kavitha', 'Suresh', 'Anitha', 'Vignesh', 'Revathi', 'Prakash', 'Saranya', 'Bala', 'Deepa', 'Ganesh', 'Malathi'];
const RELATIVES = ['aunt', 'uncle', 'cousin', 'friend', 'colleague', 'sister', 'brother'];
const RELATIVES_TG = ['chithi', 'mama', 'periyamma', 'friend', 'akka', 'anna'];

const tamilAlias = (area) => area.aliases.find((a) => /[஀-௿]/.test(a)) || area.name;

function phoneText(r, p) {
  return r.weighted([[p, 5], [`${p.slice(0, 5)} ${p.slice(5)}`, 3], [`+91 ${p.slice(0, 5)}-${p.slice(5)}`, 2], [`+91${p}`, 1]]);
}

const W_EN = { knee: 'water at knee level', waist: 'water till waist and rising', neck: 'water at neck level, rising fast', roof: 'ground floor fully under water, we are on the terrace' };
const W_TG = { knee: 'thanni muzhangal varaikum iruku', waist: 'thanni idupu varaikum iruku', neck: 'thanni kazhuthu varaikum vandhuduchu', roof: 'keela full thanni, maadi la irukom' };
const W_TA = { knee: 'தண்ணீர் முழங்கால் வரை உள்ளது', waist: 'தண்ணீர் இடுப்பு வரை உள்ளது', neck: 'தண்ணீர் கழுத்து வரை வந்துவிட்டது', roof: 'கீழே முழுவதும் தண்ணீர், மொட்டை மாடியில் இருக்கிறோம்' };

const V_EN = { pregnant: 'My sister is 8 months pregnant.', medical: 'Father is a dialysis patient, missed dialysis today.', infant: 'We have a 6 months old baby.', elderly: 'Elderly parents (78 yrs) with us.', disabled: 'One person uses a wheelchair.' };
const V_TG = { pregnant: 'Pregnant lady irukanga.', medical: 'Appa dialysis patient, oxygen venum.', infant: '6 maasa kozhandhai irukku.', elderly: 'Paati 80 vayasu.', disabled: 'Wheelchair user irukanga.' };
const V_TA = { pregnant: 'கர்ப்பிணி பெண் இருக்கிறார்.', medical: 'அப்பா டயாலிசிஸ் நோயாளி.', infant: 'கைக்குழந்தை இருக்கிறது.', elderly: 'வயதான பாட்டி இருக்கிறார்.', disabled: 'மாற்றுத்திறனாளி ஒருவர் இருக்கிறார்.' };

function firstPost(r, c, withPhone) {
  const ph = withPhone ? phoneText(r, c.phone) : '';
  const v = (dict) => c.vulnerable.map((k) => dict[k]).join(' ');
  const lang = r.weighted([['en', 4], ['tanglish', 4], ['ta', 2]]);
  const area = c.area;
  if (lang === 'en') {
    return { lang, text: r.pick([
      () => `URGENT!! ${c.people} people stuck at ${c.addr}, ${area.name}. ${W_EN[c.water]}. ${v(V_EN)} Please send boat. Call ${ph}`,
      () => `SOS ${area.name} - ${c.addr}. We are ${c.people} members trapped, ${W_EN[c.water]}. ${v(V_EN)} No food since morning. Contact ${c.name} ${ph}`,
      () => `Help needed in ${area.name}. ${c.addr}. ${c.people} people, ${W_EN[c.water]}, cannot get out. ${v(V_EN)} ${ph}`,
    ])() };
  }
  if (lang === 'tanglish') {
    return { lang, text: r.pick([
      () => `${area.name} la ${c.addr} ${c.people} per maattikittom. ${W_TG[c.water]}. ${v(V_TG)} Boat anuppunga pls ${ph}`,
      () => `Avasaram!! ${c.addr}, ${area.name.toLowerCase()}. ${c.people} members irukom, veliya vara mudiyala. ${W_TG[c.water]}. ${v(V_TG)} Contact ${c.name} ${ph}`,
    ])() };
  }
  return { lang, text: r.pick([
    () => `அவசரம்! ${tamilAlias(area)} ${c.addr} பகுதியில் ${c.people} பேர் மாட்டிக்கொண்டுள்ளோம். ${W_TA[c.water]}. ${v(V_TA)} படகு அனுப்புங்கள். ${ph}`,
    () => `உதவி தேவை. ${c.addr}, ${tamilAlias(area)}. ${c.people} பேர் உள்ளோம், வெளியே வர முடியவில்லை. ${W_TA[c.water]}. ${v(V_TA)} தொடர்புக்கு ${ph}`,
  ])() };
}

function repost(r, c, first) {
  const v = c.vulnerable.length ? V_EN[c.vulnerable[0]] : '';
  const mode = r.weighted([['forward', 3], ['relative', 4], ['still', 2], ['tanglish', 3], ['other-number', 2], ['no-phone', 2]]);
  const ph = phoneText(r, c.phone);
  switch (mode) {
    case 'forward': return { mode, text: `Forwarded as received: ${first}`, phone: true };
    case 'relative': return { mode, text: `Pls share!! My ${r.pick(RELATIVES)}'s family stuck in ${c.area.name}, ${c.addr}. ${c.people} people. ${v} Number: ${ph}`, phone: true };
    case 'still': return { mode, text: `Still no help!! ${c.addr} ${c.area.name}, ${W_EN[c.water]}. ${v} pls someone send boat ${ph}`, phone: true };
    case 'tanglish': return { mode, text: `Enga ${r.pick(RELATIVES_TG)} family ${c.area.name} la maattikitanga. ${c.addr}. ${c.people} per. ${ph} ku call pannunga. Pls share`, phone: true };
    case 'other-number': return { mode, text: `Please help my relatives at ${c.addr}, ${c.area.name}. ${c.people} people stuck, ${W_EN[c.water]}. Their phone is switched off, call me ${phoneText(r, c.relPhone)}`, phone: false };
    default: return { mode, text: `Anyone near ${c.area.name}?? ${c.addr} family still stuck, ${W_EN[c.water]}. ${v} Pls help`, phone: false };
  }
}

const NOISE = [
  'Stay safe everyone 🙏 Chennai will bounce back',
  'Is Velachery main road bridge open now? anyone?',
  'Power cut in Adyar since 6pm. EB not picking up',
  'IMD red alert for Chennai till tomorrow morning',
  'Fake news alert: Chembarambakkam lake NOT fully opened. Check official sources only',
  'Which route to Tambaram from Guindy is safe now?',
  'Mobile network down in Pallikaranai, only WhatsApp working sometimes',
  'Good morning all. Rain reduced a bit in Porur',
];
const OFFERS = [
  (r) => `We have 2 boats available near Saidapet. Volunteers contact ${phoneText(r, `98${r.int(10000000, 99999999)}`)}`,
  () => 'Free food available at Kotturpuram community hall, 500 packets ready. Come and collect',
  (r) => `Fishermen team from Kasimedu, boat available for Vyasarpadi side. Call ${phoneText(r, `97${r.int(10000000, 99999999)}`)}`,
];

/**
 * A synthetic night. Returns { households, messages } where every message carries its truth.
 * Defaults give ~110 households and ~330 messages over 8 hours.
 */
export function generateNight({ seed = 2023, households = 110, hours = 8, noiseRate = 0.12 } = {}) {
  const r = rng(seed);
  const areaPairs = AREAS.filter((a) => !a.extra).map((a) => [a, AREA_WEIGHT[a.id] || 2]);
  const usedPhones = new Set();
  const newPhone = () => {
    let p;
    do { p = `${r.pick(['9', '8', '7', '6'])}${r.int(100000000, 999999999)}`; } while (usedPhones.has(p));
    usedPhones.add(p);
    return p;
  };
  const span = hours * 60;
  const list = [];
  for (let i = 0; i < households; i++) {
    const area = r.weighted(areaPairs);
    const vulnerable = [];
    if (r.chance(0.06)) vulnerable.push('pregnant');
    if (r.chance(0.10)) vulnerable.push('medical');
    if (r.chance(0.12)) vulnerable.push('infant');
    if (r.chance(0.28)) vulnerable.push('elderly');
    if (r.chance(0.05)) vulnerable.push('disabled');
    // rain peaks in hours 1-4
    const start = Math.min(span - 30, Math.round(r.chance(0.65) ? r.int(40, 240) : r.int(0, span - 60)));
    const h = {
      id: `h${i + 1}`,
      area,
      addr: `No. ${r.int(1, 120)}, ${r.pick(STREETS)}`,
      name: r.pick(NAMES),
      phone: newPhone(),
      relPhone: newPhone(),
      people: r.weighted([[1, 1], [2, 3], [3, 4], [4, 5], [5, 4], [6, 3], [7, 1], [8, 1]]),
      vulnerable,
      water: r.weighted([['knee', 2], ['waist', 4], ['neck', 1.5], ['roof', 2.5]]),
      start,
      selfRescueAt: r.chance(0.12) ? start + r.int(60, 300) : null,
    };
    h.critical = isCritical({ vulnerable: h.vulnerable, water: h.water });
    list.push(h);
  }

  const messages = [];
  const truth = (h, kind) => ({ kind, household: h ? h.id : null });
  for (const h of list) {
    const withPhone = r.chance(0.9);
    const first = firstPost(r, h, withPhone);
    messages.push({ at: h.start, text: first.text, lang: first.lang, truth: { ...truth(h, 'request'), phone: withPhone ? h.phone : null, areaId: h.area.id, people: h.people, vulnerable: h.vulnerable, water: h.water } });
    const reposts = Math.min(6, Math.floor(-Math.log(1 - r.next()) * (h.critical ? 2.2 : 1.5)));
    for (let k = 0; k < reposts; k++) {
      const at = h.start + r.int(5, 240);
      if (at > span + 120) continue;
      const rp = repost(r, h, first.text);
      const phoneInMsg = rp.mode === 'forward' ? (withPhone ? h.phone : null) : rp.phone ? h.phone : rp.mode === 'other-number' ? h.relPhone : null;
      messages.push({ at, text: rp.text, lang: rp.mode === 'tanglish' ? 'tanglish' : 'en', truth: { ...truth(h, 'request'), phone: phoneInMsg, areaId: h.area.id, people: h.people, vulnerable: rp.mode === 'forward' ? h.vulnerable : (h.vulnerable.length && ['relative', 'still', 'no-phone'].includes(rp.mode) ? [h.vulnerable[0]] : []), water: null, repost: rp.mode } });
    }
    if (h.selfRescueAt) {
      messages.push({ at: h.selfRescueAt, text: r.pick([
        `Thanks all, ${h.addr} ${h.area.name} family is safe now, neighbours helped. Please stop sharing. ${phoneText(r, h.phone)}`,
        `${h.area.name} ${h.addr} family kaapathitanga, safe aa irukanga. Pls don't share anymore ${phoneText(r, h.phone)}`,
      ]), lang: 'en', truth: truth(h, 'update') });
    }
  }
  const extra = Math.round(messages.length * noiseRate);
  for (let k = 0; k < extra; k++) {
    const isOffer = r.chance(0.3);
    messages.push({ at: r.int(0, span), text: isOffer ? r.pick(OFFERS)(r) : r.pick(NOISE), lang: 'en', truth: truth(null, isOffer ? 'offer' : 'noise') });
  }
  messages.sort((a, b) => a.at - b.at);
  messages.forEach((m, i) => { m.id = `m${String(i + 1).padStart(4, '0')}`; });
  return { seed, hours, households: list, messages };
}

// ---------- accuracy of the extractor + duplicate matcher against the known truth ----------

const sameSet = (a, b) => a.length === b.length && a.every((x) => b.includes(x));

export function evaluateExtraction(night, extract = extractRules) {
  const rows = night.messages.map((m) => ({ m, x: extract(m.text) }));
  const reqs = rows.filter(({ m }) => m.truth.kind === 'request');
  const firsts = reqs.filter(({ m }) => !m.truth.repost);
  const pct = (n, d) => (d ? Math.round((1000 * n) / d) / 10 : null);
  const count = (arr, f) => arr.filter(f).length;
  const vulnTruth = reqs.filter(({ m }) => m.truth.vulnerable.length);
  return {
    messages: rows.length,
    kind: pct(count(rows, ({ m, x }) => (m.truth.kind === 'request') === (x.kind === 'request') && (m.truth.kind !== 'update' || x.kind === 'update')), rows.length),
    phone: pct(count(reqs.filter(({ m }) => m.truth.phone), ({ m, x }) => x.phones.includes(m.truth.phone)), count(reqs, ({ m }) => m.truth.phone)),
    area: pct(count(reqs, ({ m, x }) => x.areaId === m.truth.areaId), reqs.length),
    people: pct(count(firsts, ({ m, x }) => x.people === m.truth.people), firsts.length),
    water: pct(count(firsts, ({ m, x }) => x.water === m.truth.water), firsts.length),
    vulnerable: pct(count(vulnTruth, ({ m, x }) => m.truth.vulnerable.every((v) => x.vulnerable.includes(v))), vulnTruth.length),
    vulnerableExact: pct(count(firsts, ({ m, x }) => sameSet(x.vulnerable, m.truth.vulnerable)), firsts.length),
  };
}

/** Pairwise precision/recall of grouping reports into households. */
export function evaluateDedupe(night, extract = extractRules) {
  const c = createClusterer();
  const reqs = night.messages.filter((m) => m.truth.kind === 'request');
  const rows = reqs.map((m) => ({ id: m.id, at: m.at, x: extract(m.text), h: m.truth.household }));
  rows.filter((r) => r.x.kind === 'request').forEach((r) => c.add(r));
  const root = new Map(rows.filter((r) => r.x.kind === 'request').map((r) => [r.id, c.root(r.id)]));
  let tp = 0; let fp = 0; let fn = 0;
  for (let i = 0; i < rows.length; i++) {
    for (let j = i + 1; j < rows.length; j++) {
      const same = rows[i].h === rows[j].h;
      const pred = root.has(rows[i].id) && root.get(rows[i].id) === root.get(rows[j].id);
      if (same && pred) tp++; else if (!same && pred) fp++; else if (same && !pred) fn++;
    }
  }
  const clusters = new Set(root.values()).size;
  return {
    reports: rows.length,
    households: new Set(rows.map((r) => r.h)).size,
    clusters,
    precision: tp + fp ? Math.round((1000 * tp) / (tp + fp)) / 10 : 100,
    recall: tp + fn ? Math.round((1000 * tp) / (tp + fn)) / 10 : 100,
  };
}

// ---------- the night, replayed ----------

export const DEFAULT_SIM = {
  boats: 10,
  horizonMin: 720,
  volunteers: 3,
  minutesPerMessage: 2.5, // read, call back, note down, post in boat group
  scrollAwayMin: 120, // unread messages older than this are effectively lost in a busy chat
  manualRepeatCatch: 0.4, // chance a volunteer recognises a repost of a household already sent a boat
  manualUrgentFirst: 0.5, // chance an obviously critical message jumps the boat queue
  floodlineDelayMin: 5, // forwarding / batching delay before FloodLine sees a message
  depots: [{ lat: 13.0213, lng: 80.2231 }, { lat: 12.9249, lng: 80.1000 }, { lat: 13.1240, lng: 80.2120 }, { lat: 12.9654, lng: 80.2461 }],
};

export function tripMinutes(area, depots = DEFAULT_SIM.depots) {
  const d = Math.min(...depots.map((p) => distanceKm(p, area)));
  return Math.round(20 + 10 * d); // round trip through flooded streets
}

const median = (xs) => {
  if (!xs.length) return null;
  const s = [...xs].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return Math.round(s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2);
};

export function simulate(night, strategy, params = {}) {
  const P = { ...DEFAULT_SIM, ...params };
  const r = rng(night.seed * 31 + (strategy === 'manual' ? 1 : 2));
  const H = new Map(night.households.map((h) => [h.id, h]));
  const rescuedAt = new Map(); // household -> minute reached by a boat
  const boatsFreeAt = Array(P.boats).fill(0);
  let duplicateTrips = 0;
  let wastedSelfRescued = 0;
  let lostMessages = 0;
  let trips = 0;

  const sendBoat = (hid, t, b) => {
    const h = H.get(hid);
    const trip = tripMinutes(h.area, P.depots);
    boatsFreeAt[b] = t + trip;
    trips++;
    const arrive = t + Math.round(trip / 2);
    if (rescuedAt.has(hid) && rescuedAt.get(hid) <= arrive) duplicateTrips++;
    else if (h.selfRescueAt != null && h.selfRescueAt <= arrive) wastedSelfRescued++;
    else rescuedAt.set(hid, arrive);
  };
  const dispatched = new Set();

  if (strategy === 'manual') {
    const inbox = [...night.messages];
    let cursor = 0;
    let budget = 0;
    const boatQueue = [];
    for (let t = 0; t <= P.horizonMin; t++) {
      budget += P.volunteers / P.minutesPerMessage;
      while (budget >= 1 && cursor < inbox.length && inbox[cursor].at <= t) {
        const m = inbox[cursor++];
        if (t - m.at > P.scrollAwayMin) { lostMessages++; continue; }
        budget -= 1;
        if (m.truth.kind !== 'request') continue;
        const hid = m.truth.household;
        if ((dispatched.has(hid) || boatQueue.includes(hid)) && r.chance(P.manualRepeatCatch)) continue;
        const urgent = H.get(hid).critical && r.chance(P.manualUrgentFirst);
        if (urgent) boatQueue.unshift(hid); else boatQueue.push(hid);
      }
      if (budget > 1) budget = 1; // idle volunteers can't bank time
      for (let b = 0; b < P.boats && boatQueue.length; b++) {
        if (boatsFreeAt[b] <= t) { const hid = boatQueue.shift(); dispatched.add(hid); sendBoat(hid, t, b); }
      }
    }
  } else {
    const c = createClusterer();
    const truthOf = new Map();
    const sent = new Set(); // cluster roots already given a boat
    const safeFor = []; // extracted "we are safe" updates
    let cursor = 0;
    const inbox = night.messages;
    for (let t = 0; t <= P.horizonMin; t++) {
      while (cursor < inbox.length && inbox[cursor].at + P.floodlineDelayMin <= t) {
        const m = inbox[cursor++];
        const x = extractRules(m.text);
        if (x.kind === 'request') { c.add({ id: m.id, at: m.at, x }); truthOf.set(m.id, m.truth.household); }
        else if (x.kind === 'update') safeFor.push(x);
      }
      const free = boatsFreeAt.map((f, b) => (f <= t ? b : -1)).filter((b) => b >= 0);
      if (!free.length) continue;
      const open = c.clusters()
        .filter((cl) => !cl.reports.some((rep) => sent.has(rep.id)))
        .map((cl) => mergeCase(cl))
        .filter((cs) => !safeFor.some((u) => u.phones.some((p) => cs.phones.includes(p))))
        .map((cs) => ({ cs, s: scoreCase(cs, t - cs.firstAt).score }))
        .sort((a, b) => b.s - a.s || a.cs.firstAt - b.cs.firstAt);
      for (const b of free) {
        const next = open.shift();
        if (!next) break;
        next.cs.reportIds.forEach((id) => sent.add(id));
        // the boat goes to whichever household most of this case's reports describe
        const votes = new Map();
        next.cs.reportIds.forEach((id) => votes.set(truthOf.get(id), (votes.get(truthOf.get(id)) || 0) + 1));
        const hid = [...votes.entries()].sort((a, b2) => b2[1] - a[1])[0][0];
        dispatched.add(hid);
        sendBoat(hid, t, b);
      }
    }
  }

  const all = night.households;
  const crit = all.filter((h) => h.critical);
  const wait = (h) => rescuedAt.get(h.id) - h.start;
  const reached = all.filter((h) => rescuedAt.has(h.id));
  const needed = all.filter((h) => !(h.selfRescueAt != null && !rescuedAt.has(h.id)));
  return {
    strategy,
    households: all.length,
    reached: reached.length,
    neverReached: needed.filter((h) => !rescuedAt.has(h.id)).length,
    criticalTotal: crit.length,
    criticalNeverReached: crit.filter((h) => !rescuedAt.has(h.id) && h.selfRescueAt == null).length,
    criticalOver3h: crit.filter((h) => (rescuedAt.has(h.id) ? wait(h) > 180 : h.selfRescueAt == null)).length,
    medianWait: median(reached.map(wait)),
    medianWaitCritical: median(crit.filter((h) => rescuedAt.has(h.id)).map(wait)),
    trips,
    duplicateTrips,
    wastedSelfRescued,
    lostMessages,
  };
}

export function runBenchmark({ seed = 2023, households = 110, params = {} } = {}) {
  const night = generateNight({ seed, households });
  return {
    night,
    manual: simulate(night, 'manual', params),
    floodline: simulate(night, 'floodline', params),
    extraction: evaluateExtraction(night),
    dedupe: evaluateDedupe(night),
  };
}

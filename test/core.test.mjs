import { test } from 'node:test';
import assert from 'node:assert/strict';
import { findArea, resolveArea, distanceKm } from '../js/core/gazetteer.js';
import { extractRules, findPhones, phoneInText, findPeople, addressTokens } from '../js/core/extract.js';
import { sameHousehold, clusterReports, jaccard } from '../js/core/dedupe.js';
import { scoreCase, isCritical, fmtMinutes } from '../js/core/priority.js';
import { buildState, mergeEvents, followUpText } from '../js/core/store.js';
import { generateNight, simulate, evaluateExtraction, evaluateDedupe, rng } from '../js/core/sim.js';
import { guardAi, parseExtractReply, buildExtractPrompt } from '../js/core/prompt.js';
import { HARD_SET, scoreHardSet } from '../js/core/hardset.js';

// ---------- gazetteer ----------
test('areas are found in English, Tanglish and Tamil, longest name first', () => {
  assert.equal(findArea('stuck in Velachery 2nd street').id, 'velachery');
  assert.equal(findArea('velacheri la maatikitom').id, 'velachery');
  assert.equal(findArea('வேளச்சேரி பகுதியில்').id, 'velachery');
  assert.equal(findArea('Manali New Town, Ezhil nagar').id, 'manali-new-town');
  assert.equal(findArea('manali la iruku').id, 'manali');
  assert.equal(findArea('nothing here'), null);
  assert.equal(findArea('Madipakkamxyz'), null, 'no match inside a longer word');
  assert.equal(resolveArea('Pallikaranai').id, 'pallikaranai');
  assert.equal(resolveArea('Mumbai'), null);
  const d = distanceKm(resolveArea('velachery'), resolveArea('tambaram'));
  assert.ok(d > 10 && d < 15, `velachery-tambaram ${d}`);
});

// ---------- extraction ----------
test('phones: formats, +91, no partial numbers', () => {
  assert.deepEqual(findPhones('call 98410 22345 or +91 94450-12345 or +919176012345'), ['9841022345', '9445012345', '9176012345']);
  assert.deepEqual(findPhones('pincode 600042, year 2023, 12345678901'), []);
  assert.ok(phoneInText('9841022345', 'ph: 98410-22345'));
  assert.ok(!phoneInText('9841022399', 'ph: 98410-22345'));
});

test('people count from digits and words, not from phone numbers', () => {
  assert.equal(findPeople('5 people stuck'), 5);
  assert.equal(findPeople('family of four'), 4);
  assert.equal(findPeople('we r three ppl + dog'), 3);
  assert.equal(findPeople('6 பேர் உள்ளோம்'), 6);
  assert.equal(findPeople('call 9841022345 now'), null);
  assert.equal(findPeople('elderly people and 4 members'), 4);
});

test('extractRules reads an English SOS', () => {
  const x = extractRules('URGENT!! 4 people stuck at No. 12, Gandhi Street, Velachery. water at neck level. My sister is 8 months pregnant. Call 9840012345');
  assert.equal(x.kind, 'request');
  assert.equal(x.areaId, 'velachery');
  assert.equal(x.phone, '9840012345');
  assert.equal(x.people, 4);
  assert.equal(x.water, 'neck');
  assert.deepEqual(x.vulnerable, ['pregnant']);
  assert.ok(x.needs.includes('rescue'));
  assert.match(x.address, /12, Gandhi Street/);
});

test('extractRules reads Tanglish and Tamil', () => {
  const tg = extractRules('Pallikaranai la Lake View Road 3 per maattikittom. thanni idupu varaikum iruku. Paati 80 vayasu. Boat anuppunga pls 9444012345');
  assert.equal(tg.kind, 'request');
  assert.equal(tg.areaId, 'pallikaranai');
  assert.equal(tg.water, 'waist');
  assert.deepEqual(tg.vulnerable, ['elderly']);
  assert.equal(tg.lang, 'tanglish');
  const ta = extractRules('அவசரம்! முடிச்சூர் பகுதியில் 5 பேர் மாட்டிக்கொண்டுள்ளோம். தண்ணீர் கழுத்து வரை வந்துவிட்டது. கைக்குழந்தை இருக்கிறது. 7010012345');
  assert.equal(ta.kind, 'request');
  assert.equal(ta.areaId, 'mudichur');
  assert.equal(ta.people, 5);
  assert.equal(ta.water, 'neck');
  assert.deepEqual(ta.vulnerable, ['infant']);
  assert.equal(ta.lang, 'ta');
});

test('extractRules tells requests from updates, offers and noise', () => {
  assert.equal(extractRules('Thanks all, Adyar family is safe now, please stop sharing 9840012345').kind, 'update');
  assert.equal(extractRules('வியாசர்பாடி குடும்பம் மீட்கப்பட்டனர். பகிர வேண்டாம்.').kind, 'update');
  assert.equal(extractRules('We have 2 boats available near Saidapet. contact 9840012345').kind, 'offer');
  assert.equal(extractRules('Stay safe everyone 🙏').kind, 'noise');
  assert.equal(extractRules('IMD red alert for Chennai till tomorrow').kind, 'noise');
  assert.equal(extractRules('9 months pregnant, stuck in Tambaram 9840012345').vulnerable.includes('infant'), false);
});

// ---------- duplicates ----------
const rep = (id, at, text) => ({ id, at, text, x: extractRules(text) });

test('duplicates merge by phone or address, with a reason, but not across houses', () => {
  const a = rep('a', 0, 'URGENT 4 people stuck at No. 12, Gandhi Street, Velachery. Call 9840012345');
  const b = rep('b', 10, 'Pls share!! My aunt family stuck in Velachery. 4 people. Number: 98400 12345');
  const c = rep('c', 20, 'Anyone near Velachery?? No. 12, Gandhi Street family still stuck. Pls help');
  const d = rep('d', 30, 'No. 87, Gandhi Street, Velachery 2 people stuck. 9840099999');
  const e = rep('e', 40, 'No. 12, Gandhi Street, Tambaram 3 people stuck');
  assert.equal(sameHousehold(a.x, b.x), 'same phone number');
  assert.equal(sameHousehold(a.x, c.x), 'same address');
  assert.equal(sameHousehold(a.x, d.x), null, 'different door number');
  assert.equal(sameHousehold(a.x, e.x), null, 'different area');
  const cases = clusterReports([e, d, c, b, a]);
  assert.equal(cases.length, 3);
  const big = cases.find((k) => k.reportIds.length === 3);
  assert.equal(big.id, 'a', 'case id = earliest report');
  assert.equal(big.people, 4);
  assert.equal(big.merges.length, 2);
  assert.equal(jaccard([], ['x']), 0);
  assert.deepEqual(addressTokens('No. 4, Nehru Colony 2nd Cross Street'), ['4', 'nehru', '2']);
});

// ---------- priority ----------
test('priority is explainable and ranks the obvious emergencies first', () => {
  const base = { vulnerable: [], water: null, trapped: false, people: 2, reportIds: ['a'], needs: [] };
  const pregnantNeck = scoreCase({ ...base, vulnerable: ['pregnant'], water: 'neck', trapped: true });
  const kneeOnly = scoreCase({ ...base, water: 'knee' });
  const foodOnly = scoreCase({ ...base, needs: ['food'] });
  assert.equal(pregnantNeck.tier, 'critical');
  assert.ok(pregnantNeck.score > kneeOnly.score);
  assert.ok(foodOnly.reasons.some((r) => r.points < 0));
  assert.equal(pregnantNeck.reasons[0].points, 40);
  assert.equal(pregnantNeck.score, pregnantNeck.reasons.reduce((s, r) => s + r.points, 0));
  const waiting = scoreCase({ ...base, water: 'knee' }, 125);
  assert.ok(waiting.score > kneeOnly.score && waiting.reasons.some((r) => /Waiting 2h 05m/.test(r.label)));
  assert.ok(isCritical({ vulnerable: [], water: 'neck' }) && !isCritical({ vulnerable: ['elderly'], water: 'waist' }));
  assert.equal(fmtMinutes(59), '59m');
});

// ---------- event store ----------
test('board: claim, rescue, stale and re-shared flags, safe updates', () => {
  const ev = [
    { t: 'report', id: 'r1', at: 0, text: 'x', x: extractRules('URGENT 4 people stuck at No. 12, Gandhi Street, Velachery, water neck. 9840012345') },
    { t: 'report', id: 'r2', at: 5, text: 'x', x: extractRules('Knee water No. 3, Lake View Road, Tambaram, 2 people need food 9840055555') },
    { t: 'report', id: 'r3', at: 6, text: 'x', x: extractRules('Stay safe everyone') },
    { t: 'claim', id: 'c1', at: 10, caseId: 'r1', by: 'Nethra' },
  ];
  let s = buildState(ev, 60);
  assert.equal(s.stats.cases, 2);
  assert.equal(s.stats.noise, 1);
  const r1 = s.cases.find((c) => c.id === 'r1');
  const r2 = s.cases.find((c) => c.id === 'r2');
  assert.equal(r1.status, 'claimed');
  assert.equal(r1.owner, 'Nethra');
  assert.ok(r2.flags.includes('stale'), 'unclaimed for 55 minutes');
  assert.equal(s.cases[0].id, 'r2', 'unassigned cases are listed first');

  const ev2 = [...ev,
    { t: 'status', id: 's1', at: 70, caseId: 'r1', status: 'rescued', by: 'Nethra' },
    { t: 'report', id: 'r4', at: 80, text: 'x', x: extractRules('Pls share!! still stuck Velachery 9840012345') },
    { t: 'report', id: 'r5', at: 81, text: 'x', x: extractRules('Tambaram Lake View Road family is safe now, stop sharing 9840055555') },
  ];
  s = buildState(ev2, 120);
  const done = s.cases.find((c) => c.id === 'r1');
  assert.equal(done.status, 'rescued');
  assert.ok(done.flags.includes('reshared'));
  assert.equal(s.cases[s.cases.length - 1].id, 'r1', 'resolved cases sink to the bottom');
  assert.ok(s.cases.find((c) => c.id === 'r2').flags.includes('says-safe'));

  const claimed = buildState([...ev], 200).cases.find((c) => c.id === 'r1');
  assert.ok(claimed.flags.includes('check'), 'claimed long ago with no update');
  assert.ok(followUpText(done).includes('SAFE'));
});

test('event logs from two volunteers merge without duplicates', () => {
  const a = [{ id: 'x', at: 2 }, { id: 'y', at: 1 }];
  const b = [{ id: 'y', at: 1 }, { id: 'z', at: 3 }];
  assert.deepEqual(mergeEvents(a, b).map((e) => e.id), ['y', 'x', 'z']);
});

// ---------- AI guardrails ----------
test('AI answers are checked against the message', () => {
  const text = 'Near Phoenix mall, old couple stuck in 1st floor. 9840098400';
  const x = guardAi({ kind: 'request', area: 'velachery', phones: ['9840098400', '9999999999'], people: 2, vulnerable: ['elderly', 'astronaut'], water: 'roof', address: 'Phoenix mall', name: 'Ramesh', summary: 'Old couple on 1st floor' }, text);
  assert.equal(x.areaId, 'velachery', 'landmark resolved by AI is accepted when it is a known area');
  assert.deepEqual(x.phones, ['9840098400']);
  assert.ok(x.guard.some((g) => g.includes('9999999999')));
  assert.equal(x.people, 2);
  assert.deepEqual(x.vulnerable, ['elderly']);
  assert.equal(x.name, null, 'name not in message is dropped');
  const bad = guardAi({ kind: 'teleport', area: 'Mumbai', people: -3, water: 'ocean', address: 'Marine Drive' }, 'Stuck in Adyar 3 people waist water');
  assert.equal(bad.kind, 'request');
  assert.equal(bad.areaId, 'adyar');
  assert.equal(bad.people, 3);
  assert.equal(bad.water, 'waist');
  assert.ok(bad.guard.length >= 3);
});

test('parseExtractReply survives broken replies and fills gaps with rules', () => {
  const texts = ['Stuck in Adyar 3 people waist water 9840012345', 'Stay safe all'];
  const ok = parseExtractReply('```json\n{"items":[{"i":1,"kind":"noise"},{"i":0,"kind":"request","people":3}]}\n```', texts);
  assert.equal(ok[0].kind, 'request');
  assert.equal(ok[1].kind, 'noise');
  const broken = parseExtractReply('sorry, I cannot', texts);
  assert.equal(broken[0].areaId, 'adyar');
  assert.ok(broken[0].guard[0].includes('rules'));
  assert.ok(buildExtractPrompt(texts).includes('[1] Stay safe all'));
});

// ---------- benchmark ----------
test('generated night is deterministic and labelled', () => {
  const a = generateNight({ seed: 5, households: 30 });
  const b = generateNight({ seed: 5, households: 30 });
  assert.deepEqual(a.messages.map((m) => m.text), b.messages.map((m) => m.text));
  assert.equal(a.households.length, 30);
  assert.ok(a.messages.length > 30);
  assert.ok(a.messages.every((m) => m.truth && m.id));
  assert.ok(a.messages.some((m) => /[஀-௿]/.test(m.text)), 'contains Tamil');
  assert.ok(rng(1).next() !== rng(2).next());
});

test('simulation is reproducible and its numbers are consistent', () => {
  const night = generateNight({ seed: 11, households: 60 });
  const m1 = simulate(night, 'manual');
  const m2 = simulate(night, 'manual');
  assert.deepEqual(m1, m2);
  for (const r of [m1, simulate(night, 'floodline')]) {
    assert.equal(r.households, 60);
    assert.ok(r.reached + r.neverReached <= r.households);
    assert.ok(r.duplicateTrips <= r.trips);
    assert.ok(r.criticalNeverReached <= r.criticalTotal);
  }
  const few = simulate(night, 'floodline', { boats: 1 });
  assert.ok(few.reached < simulate(night, 'floodline').reached, 'fewer boats reach fewer people');
});

test('extractor + dedupe scored against generated truth and the hand-written hard set', () => {
  const night = generateNight({ seed: 3, households: 40 });
  const ex = evaluateExtraction(night);
  assert.ok(ex.area >= 90 && ex.phone >= 90, JSON.stringify(ex));
  const dd = evaluateDedupe(night);
  assert.ok(dd.precision >= 90 && dd.recall >= 80, JSON.stringify(dd));
  assert.equal(HARD_SET.length, 30);
  const perfect = scoreHardSet((t, i) => ({ ...HARD_SET[i], phones: HARD_SET[i].phones }));
  assert.equal(perfect.overall, 100);
  const rules = scoreHardSet(extractRules);
  assert.ok(rules.overall > 50 && rules.overall < 100, `rules on hard set: ${rules.overall}`);
});

import { splitMessages } from '../js/core/input.js';
test('pasted text splits into messages (blank lines or WhatsApp export)', () => {
  assert.equal(splitMessages('one\nstill one\n\ntwo\n\n\nthree').length, 3);
  const wa = splitMessages('[04/12/23, 9:41 pm] Ravi: Help Velachery 4 people\nsecond line\n[04/12/23, 9:42 pm] Meena: <Media omitted>\n04/12/2023, 21:43 - Arun K: Stay safe');
  assert.equal(wa.length, 2);
  assert.equal(wa[0].sender, 'Ravi');
  assert.ok(wa[0].text.includes('second line'));
  assert.equal(wa[1].text, 'Stay safe');
  assert.deepEqual(splitMessages('   '), []);
});

test('a family that says it is safe is listed after families still waiting', () => {
  const ev = [
    { t: 'report', id: 'a', at: 0, text: 'x', x: extractRules('URGENT 4 people stuck No. 12, Gandhi Street, Velachery, water neck, pregnant lady. 9840012345') },
    { t: 'report', id: 'b', at: 1, text: 'x', x: extractRules('2 people stuck No. 3, Lake View Road, Tambaram, knee water 9840055555') },
    { t: 'report', id: 'c', at: 2, text: 'x', x: extractRules('Velachery Gandhi Street family is safe now, stop sharing 9840012345') },
  ];
  const s = buildState(ev, 10);
  assert.deepEqual(s.cases.map((c) => c.id), ['b', 'a']);
  assert.ok(s.cases[1].flags.includes('says-safe'));
});

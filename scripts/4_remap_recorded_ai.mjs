// The first anonymisation turned many real numbers into made-up numbers that are not valid Indian mobiles
// (e.g. "+91 2548227549"), so FloodLine's phone check wrongly rejected numbers Gemini had read correctly.
// The stream was re-anonymised (scripts/2_build_stream.py, valid made-up numbers). This maps the numbers in the
// recorded Gemini output from the old made-up numbers to the new ones, one to one, and re-runs the phone check.
// Nothing else in the recorded output changes.
import fs from 'node:fs';
import { REAL_STREAM } from '../js/core/realstream.js';
import { STREAM_AI } from '../js/core/realstream_ai.js';
import { findPhones, phoneInText } from '../js/core/extract.js';
const MAP = JSON.parse(fs.readFileSync(new URL('./phonemap-v1-to-v2.json', import.meta.url)));
let mapped = 0, stillBlocked = 0;
const out = STREAM_AI.map((x, i) => {
  if (x.remapped) return x;
  const text = REAL_STREAM[i].text;
  const blocked = (x.guard || []).map((g) => (g.match(/^Blocked phone (\d{10})/) || [])[1]).filter(Boolean);
  const raw = [...new Set([...(x.phones || []), ...blocked])].map((p) => { const n = MAP[p]; if (n) mapped++; return n || p; });
  const ok = raw.filter((p) => phoneInText(p, text));
  const bad = raw.filter((p) => !ok.includes(p));
  stillBlocked += bad.length;
  const phones = [...new Set([...findPhones(text), ...ok])];
  const guard = [...(x.guard || []).filter((g) => !g.startsWith('Blocked phone')), ...bad.map((p) => `Blocked phone ${p}: not in the message`)];
  return { ...x, phones, phone: phones[0] || null, guard, remapped: 1 };
});
fs.writeFileSync(new URL('../js/core/realstream_ai.js', import.meta.url),
  '// What Gemini in the cloud (Firebase AI Logic) read from each post in realstream.js, in the same order, recorded on\n'
  + '// 19 November 2026 so the replay shows the same reading every time. Phone numbers re-mapped to the re-anonymised\n'
  + '// stream by scripts/4_remap_recorded_ai.mjs. FloodLine\'s checks are applied again when it is loaded.\n'
  + `export const STREAM_AI = ${JSON.stringify(out)};\n`);
console.log('numbers mapped', mapped, '| numbers still not in the post after mapping', stillBlocked);

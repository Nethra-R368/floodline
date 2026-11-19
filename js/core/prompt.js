// Gemini extraction prompt + guardrails.
// The model reads messy messages better than rules (landmarks, Tamil number words, loose phrasing),
// but in a rescue tool an invented phone number or place sends a boat to the wrong house.
// So every AI answer is checked against the original text and the gazetteer before use.

import { AREAS, resolveArea } from './gazetteer.js';
import { KINDS, VULNERABLE, WATER_LEVELS, NEEDS, extractRules, phoneInText, summarize, addressTokens } from './extract.js';

export function buildExtractPrompt(messages) {
  const areas = AREAS.map((a) => `${a.id} (${a.name})`).join(', ');
  const list = messages.map((m, i) => `[${i}] ${String(m).replace(/\s+/g, ' ').trim()}`).join('\n');
  return `You read emergency messages posted in Chennai flood WhatsApp/X groups (English, Tamil, Tanglish) and extract structured rescue data.

For EACH message return an object:
- "i": the message number
- "kind": "request" (someone needs rescue, food, water or medicine), "update" (says people are now safe/rescued or asks to stop sharing), "offer" (someone offering boats, vehicles, food, help), or "noise" (news, advisories, questions, chatter)
- "area": one id from this list, or "" if no locality can be identified: ${areas}
  Landmarks count if you are sure (e.g. Phoenix mall -> velachery). Never guess a far-away area.
- "address": street / door / landmark text exactly as written in the message, or ""
- "phones": 10-digit mobile numbers copied from the message (digits only). Never invent or complete numbers.
- "name": a contact person's name if written, else ""
- "people": number of people needing help as an integer, or 0 if not stated. Count words too ("three", "மூன்று", "old couple" = 2, "my amma alone" = 1). Families are not people: "10 families" -> 0.
- "vulnerable": subset of ${JSON.stringify(VULNERABLE)}. infant = baby under about 2 years ("kids"/"children" alone is NOT infant). elderly = 65+ or grandparents/old people. medical = needs medical care now (dialysis, oxygen, insulin, heart patient, bedridden, high fever, injury). disabled = cannot walk / wheelchair. pregnant includes labour.
- "water": one of ${JSON.stringify(WATER_LEVELS)}, or "none" if not stated. 1-2 ft/ankle/knee -> knee; 3-4 ft/hip/waist -> waist; chest/neck/5+ ft/head -> neck; on terrace / upper floor -> roof.
- "needs": subset of ${JSON.stringify(NEEDS)}
- "trapped": true if they say they cannot get out
- "summary": max 15 words in English for a rescue coordinator

Return ONLY JSON: {"items": [ ... one object per message, same order ... ]}

MESSAGES
${list}`;
}

const asArr = (v) => (Array.isArray(v) ? v : []);

/**
 * JSON schema both models must follow: Gemini in the cloud (responseSchema) and Gemini Nano
 * on the device (responseConstraint). No nulls, because a fixed list of choices on-device can't
 * include null; "unknown" is "", 0 or "none", which guardAi treats as "not stated".
 */
export const EXTRACT_SCHEMA = {
  type: 'object',
  properties: {
    items: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          i: { type: 'integer' },
          kind: { type: 'string', enum: KINDS },
          area: { type: 'string' },
          address: { type: 'string' },
          phones: { type: 'array', items: { type: 'string' } },
          name: { type: 'string' },
          people: { type: 'integer' },
          vulnerable: { type: 'array', items: { type: 'string', enum: VULNERABLE } },
          water: { type: 'string', enum: [...WATER_LEVELS, 'none'] },
          needs: { type: 'array', items: { type: 'string', enum: NEEDS } },
          trapped: { type: 'boolean' },
          summary: { type: 'string' },
        },
        required: ['i', 'kind', 'area', 'phones', 'people', 'vulnerable', 'water', 'needs', 'trapped', 'summary'],
      },
    },
  },
  required: ['items'],
};

/**
 * Combine an AI item with the rule-based extraction of the same text.
 * Returns the merged extraction plus `guard`: what was rejected and why.
 * `where` is 'device' for Gemini Nano: the small on-device model only fills gaps the rules left for
 * water level and vulnerable people (fields the rules read well), and is still trusted for area,
 * head counts and message type, where the rules are weak.
 */
export function guardAi(item, text, rules = extractRules(text), where = 'cloud') {
  const small = where === 'device';
  const guard = [];
  const ai = item && typeof item === 'object' ? item : {};
  // Safety: the AI may never take a request off the list. If the rules read a request and the AI disagrees,
  // it stays a request, marked for a person to check (aiKind), and the board sorts it below clear requests.
  let kind = KINDS.includes(ai.kind) ? ai.kind : rules.kind;
  let aiKind = null;
  if (rules.kind === 'request' && kind !== 'request') {
    aiKind = kind; kind = 'request';
    guard.push(`Check: the AI thinks this is ${aiKind === 'offer' ? 'a helpline or an offer' : aiKind === 'update' ? 'an update (they may be safe)' : 'not a request'}; it stays on the list until a person decides`);
  }

  const aiPhones = asArr(ai.phones).map((p) => String(p).replace(/\D/g, '').slice(-10)).filter((p) => p.length === 10);
  const okPhones = aiPhones.filter((p) => phoneInText(p, text));
  const digits = String(text).replace(/\D/g, '');
  aiPhones.filter((p) => !okPhones.includes(p)).forEach((p) => guard.push(digits.includes(p)
    ? `Ignored phone ${p}: it's in the message but is a landline or not a mobile number`
    : `Blocked phone ${p}: not in the message`));
  const phones = [...new Set([...rules.phones, ...okPhones])];

  let areaId = rules.areaId;
  if (ai.area) {
    const a = resolveArea(ai.area);
    if (a) areaId = a.id;
    else guard.push(`Ignored unknown area "${String(ai.area).slice(0, 40)}"`);
  }

  let people = rules.people;
  if (ai.people != null && ai.people !== 0 && ai.people !== '') {
    const n = Number(ai.people);
    if (Number.isInteger(n) && n > 0 && n <= 500) people = n;
    else guard.push(`Ignored people count "${String(ai.people).slice(0, 10)}"`);
  }

  // Safety first: a vulnerable flag found by either side is kept (missing one costs more than an extra one).
  const aiVul = small && rules.vulnerable.length ? [] : asArr(ai.vulnerable);
  const vulnerable = VULNERABLE.filter((v) => rules.vulnerable.includes(v) || aiVul.includes(v));
  const aiWater = WATER_LEVELS.includes(ai.water) ? ai.water : null;
  const water = small ? (rules.water || aiWater) : (aiWater || rules.water);
  const needs = NEEDS.filter((n) => rules.needs.includes(n) || asArr(ai.needs).includes(n));

  let address = rules.address;
  if (typeof ai.address === 'string' && ai.address.trim()) {
    const toks = addressTokens(ai.address);
    const lower = text.toLowerCase();
    const found = toks.filter((t) => lower.includes(t)).length;
    if (toks.length && found / toks.length >= 0.6) address = ai.address.trim().slice(0, 120);
    else guard.push('Ignored address not written in the message');
  }
  const name = typeof ai.name === 'string' && ai.name && text.toLowerCase().includes(ai.name.toLowerCase()) ? ai.name : rules.name;

  const x = {
    kind,
    aiKind,
    phone: phones[0] || null,
    phones,
    areaId,
    address,
    name,
    people,
    vulnerable,
    water,
    needs,
    trapped: !!ai.trapped || rules.trapped,
    lang: rules.lang,
    source: 'ai',
    guard,
  };
  x.summary = typeof ai.summary === 'string' && ai.summary.trim() ? ai.summary.trim().slice(0, 160) : summarize(x);
  return x;
}

/** Parse the model reply into one guarded extraction per message (rules fill any gaps). */
export function parseExtractReply(reply, texts, where = 'cloud') {
  let items = [];
  try {
    const body = String(reply || '');
    const start = body.indexOf('{');
    const end = body.lastIndexOf('}');
    const obj = JSON.parse(body.slice(start, end + 1));
    items = asArr(obj.items || obj);
  } catch {
    items = [];
  }
  return texts.map((t, i) => {
    const item = items.find((it) => it && Number(it.i) === i) || items[i];
    return item ? { ...guardAi(item, t, extractRules(t), where), raw: item } : { ...extractRules(t), guard: ['AI gave no answer for this message, used rules'] };
  });
}

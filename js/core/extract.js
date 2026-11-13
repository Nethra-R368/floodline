// Rule-based extraction of a rescue request from one raw message (English, Tanglish or Tamil).
// Works offline with no AI. The AI path (prompt.js) returns the same shape and is checked
// against these rules so it cannot invent phone numbers or places.

import { findArea } from './gazetteer.js';

export const VULNERABLE = ['pregnant', 'medical', 'infant', 'elderly', 'disabled'];
export const WATER_LEVELS = ['knee', 'waist', 'neck', 'roof']; // roof = stranded on terrace / upper floor
export const NEEDS = ['rescue', 'food', 'water', 'medicine'];
export const KINDS = ['request', 'update', 'offer', 'noise'];

const PHONE_RE = /(?<![\d])(?:\+?91[\s-]?)?([6-9]\d{4})[\s-]?(\d{5})(?![\d])/g;

/** All Indian mobile numbers in a text, as 10 digits. */
export function findPhones(text) {
  const out = [];
  for (const m of String(text || '').matchAll(PHONE_RE)) {
    const p = m[1] + m[2];
    if (!out.includes(p)) out.push(p);
  }
  return out;
}

/** True if the 10-digit number literally appears in the text (used to reject invented numbers). */
export function phoneInText(phone, text) {
  return !!phone && findPhones(text).includes(String(phone).replace(/\D/g, '').slice(-10));
}

const has = (re, t) => re.test(t);

const RE = {
  update: /\b(rescued|we are safe|we're safe|they are safe|safe now|now safe|reached safely|evacuated already|already evacuated|stop sharing|don'?t share|no need (of )?help|no more help needed|kaapathitanga|kapathitanga|kaapathitaanga|safe aa irukom|safe ah irukanga)\b|காப்பாற்றப்பட்ட|மீட்கப்பட்ட|பாதுகாப்பாக (உள்ளோம்|இருக்கிறோம்|உள்ளனர்)|பகிர வேண்டாம்/i,
  offer: /\b(boat available|boats available|have (a |one |two )?boats?|can (send|provide|help with) (a )?boat|volunteers? available|free food|food available|we can help|offering|padagu irukku|boat irukku)\b|படகு (உள்ளது|இருக்கிறது)|உதவ தயார்/i,
  ask: /\b(help|sos|urgent|stuck|trapped|stranded|rescue|save us|need|please send|pls send|anuppunga|maattikittom|maatikitom|mattikitom|maattikittanga|maatikitanga|maattikitanga|avasaram|kaapathunga|kapathunga)\b|உதவி|அவசரம்|மாட்டி|சிக்கி|காப்பாற்று|அனுப்புங்க|தேவை/i,
  trapped: /\b(stuck|trapped|stranded|can'?t (get )?out|cannot (get )?out|no way out|maattikittom|maatikitom|mattikitom|maattikittanga|maatikitanga|maattikitanga|veliya vara mudiyala|marooned)\b|மாட்டி|சிக்கி|வெளியே வர முடியவில்லை/i,
  pregnant: /\b(pregnant|pregnancy|garbini|garbhini|karpini|delivery (date|due)|due date|labou?r pain|in labou?r|9 months?)\b|கர்ப்பிணி|பிரசவ/i,
  medical: /\b(dialysis|oxygen|insulin|bed ?ridden|heart patient|cardiac|stroke|paralys|cancer|chemo|surgery|operated|ventilator|bp patient|epilep|seizure|unconscious|fever|injur|bleeding)\b|டயாலிசிஸ்|ஆக்ஸிஜன்|நோயாளி|அறுவை|மயக்க/i,
  infant: /\b(baby|infant|new ?born|toddler|kozhandhai|kuzhandhai|kolandhai|pappa|\d{1,2} ?(months?|maasa) ?(old|baby|kozhandhai|kuzhandhai|pappa))\b|கைக்குழந்தை|குழந்தை/i,
  elderly: /\b(elderly|old (man|woman|lady|people|parents?|couple)|senior citizens?|grand ?(ma|pa|mother|father)|paati|patti|thatha|thaatha|aged)\b|வயதான|முதியவர்|பாட்டி|தாத்தா/i,
  disabled: /\b(disabled|wheel ?chair|cannot walk|can'?t walk|handicap|blind|deaf|differently abled|nadakka mudiyadhu)\b|மாற்றுத்திறனாளி|நடக்க முடியாது|சக்கர நாற்காலி/i,
  roof: /\b(roof|terrace|top floor|first floor|1st floor|second floor|2nd floor|upstairs|maadi|madi)\b|மாடி|மொட்டை மாடி/i,
  neck: /\b(neck|chest|shoulder|kazhuthu|kaluthu|nenju|head level|over head|6 ?(ft|feet)|5 ?(ft|feet))\b|கழுத்து|நெஞ்சு|மார்பு/i,
  waist: /\b(waist|hip|idupu|iduppu|3 ?(ft|feet)|4 ?(ft|feet))\b|இடுப்பு/i,
  knee: /\b(knee|ankle|muzhangal|mulangal|1 ?(ft|feet)|2 ?(ft|feet))\b|முழங்கால்|கணுக்கால்/i,
  food: /\b(food|hungry|saapadu|sapadu|milk|paal|biscuit)\b|சாப்பாடு|உணவு|பால்/i,
  water: /\b(drinking water|kudi ?thanni|kudineer|no water to drink|water bottles?|thanni illa)\b|குடிநீர்|குடிக்க தண்ணீர்/i,
  medicine: /\b(medicines?|tablets?|insulin|marundhu|maathirai)\b|மருந்து|மாத்திரை/i,
  rescue: /\b(boat|rescue|evacuat|padagu|padhagu|take us out|shift us|airlift|ndrf)\b|படகு|மீட்க|வெளியேற்ற/i,
};

const WORD_NUM = { one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10, twelve: 12, fifteen: 15, twenty: 20, rendu: 2, moonu: 3, naalu: 4, anju: 5, aaru: 6 };

/** Number of people stuck, or null. */
export function findPeople(text) {
  const t = String(text || '').replace(PHONE_RE, ' ');
  const patterns = [
    /family of (\d{1,3}|[a-z]+)/i,
    /(\d{1,3}|[a-z]+)\s*(?:people|persons|ppl|members|family members|per\b|peru\b|pers\b|nabar|பேர்|நபர்)/i,
    /(?:we are|there are|totally|total)\s*(\d{1,3}|[a-z]+)\b/i,
  ];
  for (const re of patterns) {
    for (const m of t.matchAll(new RegExp(re.source, 'gi'))) {
      const raw = m[1].toLowerCase();
      const n = /^\d+$/.test(raw) ? Number(raw) : WORD_NUM[raw];
      if (n && n > 0 && n <= 300) return n;
    }
  }
  return null;
}

/** Street / door fragment used to match duplicate reports. */
export function findAddress(text) {
  const t = String(text || '').replace(/\n/g, ' ');
  const m = t.match(/(?<![A-Za-z])(?:(?:no\.?|door no\.?|flat|#)\s*)?\d{0,4}[a-z]?(?:\/\d+)?,?\s*(?:[A-Za-z][A-Za-z.]*\s+){0,4}(?:\d+(?:st|nd|rd|th)\s+)?(?:main road|street|st\b|road|rd\b|salai|nagar|colony|avenue|lane|cross|extension|layout|garden|enclave|apartments?)(?:\s+(?:\d+(?:st|nd|rd|th)\s+)?(?:street|cross|main road|extension))?/i)
    || t.match(/[஀-௿\s\d]{2,40}(?:தெரு|நகர்|சாலை|காலனி)/);
  if (!m) return '';
  return m[0].trim().replace(/\s+/g, ' ').replace(/^,|,$/g, '')
    .replace(/^(?:(?:pls|please|plz|help|urgent|sos|anyone|in|at|our|my|house|home|the|is)\b[\s,.:!-]*)+/i, '')
    .trim();
}

const STOP = new Set(['no', 'door', 'flat', 'the', 'near', 'opp', 'behind', 'st', 'street', 'road', 'rd', 'nagar', 'main', 'cross', 'salai', 'colony', 'lane', 'avenue', 'extension', 'தெரு', 'நகர்', 'சாலை']);
const ORDINAL = /^(\d+)(st|nd|rd|th)$/;

/** Normalised tokens of an address, for duplicate matching. Ordinals are kept ("2nd" -> "2"). */
export function addressTokens(addr) {
  return String(addr || '').toLowerCase()
    .replace(/[.,#/\\-]/g, ' ')
    .split(/\s+/)
    .map((w) => (ORDINAL.test(w) ? w.replace(ORDINAL, '$1') : w))
    .filter((w) => w && !STOP.has(w));
}

export function findName(text) {
  const m = String(text || '').match(/(?:contact|call|name|ph|phone|whatsapp|அழைக்க|பெயர்)\s*[:\-]?\s*(?:mr\.?|mrs\.?|ms\.?)?\s*([A-Z][a-z]{2,15})/)
    || String(text || '').match(/\b([A-Z][a-z]{2,15})\s*(?:\(|,\s*)(\d{2})\s*(?:yrs?|years?|vayasu|y\/o)?\)?/);
  return m ? m[1] : null;
}

function detectLang(text) {
  const t = String(text || '');
  const tamil = (t.match(/[஀-௿]/g) || []).length;
  const letters = (t.match(/[A-Za-z஀-௿]/g) || []).length || 1;
  if (tamil / letters > 0.3) return 'ta';
  if (/\b(la|iruku|irukku|irukom|irukanga|anuppunga|pls|thanni|vayasu|maattikittom|maatikitom|kozhandhai|paati|enga|inga|varaikum|vandhu)\b/i.test(t)) return 'tanglish';
  return 'en';
}

/** Highest water level mentioned. */
function findWater(t) {
  if (has(RE.neck, t)) return 'neck';
  if (has(RE.roof, t)) return 'roof';
  if (has(RE.waist, t)) return 'waist';
  if (has(RE.knee, t)) return 'knee';
  return null;
}

function elderlyByAge(t) {
  for (const m of t.matchAll(/(\d{2})\s*(?:yrs?|years?|year old|vayasu|வயது|y\/o|yo)\b/gi)) {
    if (Number(m[1]) >= 65) return true;
  }
  return false;
}

export function summarize(x) {
  const parts = [];
  if (x.people) parts.push(`${x.people} ${x.people === 1 ? 'person' : 'people'}`);
  if (x.vulnerable.length) parts.push(x.vulnerable.join(', '));
  if (x.water) parts.push(`water at ${x.water === 'roof' ? 'upper floor/terrace' : `${x.water} level`}`);
  if (x.needs.length) parts.push(`needs ${x.needs.join(', ')}`);
  return parts.join(' · ') || 'Help requested';
}

/** Extract a structured request from one message using rules only. */
export function extractRules(text) {
  const t = String(text || '');
  const area = findArea(t);
  const phones = findPhones(t);
  const vulnerable = VULNERABLE.filter((v) => has(RE[v], t) || (v === 'elderly' && elderlyByAge(t)));
  const needs = NEEDS.filter((n) => has(RE[n], t));
  const water = findWater(t);
  const trapped = has(RE.trapped, t);
  const asks = has(RE.ask, t);

  let kind = 'noise';
  if (has(RE.update, t)) kind = 'update';
  else if (has(RE.offer, t) && !trapped) kind = 'offer';
  else if ((asks || trapped || water || vulnerable.length || needs.length) && (area || phones.length)) kind = 'request';

  if (kind === 'request' && water && water !== 'knee' && !needs.includes('rescue')) needs.unshift('rescue');

  const x = {
    kind,
    phone: phones[0] || null,
    phones,
    areaId: area ? area.id : null,
    address: findAddress(t),
    name: findName(t),
    people: findPeople(t),
    vulnerable,
    water,
    needs,
    trapped,
    lang: detectLang(t),
    source: 'rules',
  };
  x.summary = summarize(x);
  return x;
}

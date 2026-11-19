// Security and privacy for a board that holds families' phone numbers and is fed from public, unverified posts.
//  1. Scam / phishing check on every incoming message (money, OTP, suspicious links).
//  2. Privacy mode: phone numbers masked on screen (for screen-sharing and photos of the board).
//  3. Board fingerprint: SHA-256 hash chain over the event log, so two volunteers can compare boards out loud.
//  4. Encrypted shift handover: AES-256-GCM with a key from PBKDF2-SHA-256 (310,000 rounds) and a passphrase.
// Everything runs in the browser with Web Crypto; nothing here needs a server or the network.

const MONEY = /\b(upi|g ?pay|google ?pay|phone ?pe|paytm|bhim|send (?:me )?(?:rs\.?|₹|money|cash)|transfer (?:rs|₹|money|amount)|donat(?:e|ion)s? (?:to|at|via)|account (?:no|number)|a\/c(?: no)?|ifsc|bank details|registration fee|advance (?:payment|amount))\b|₹\s?\d|\b(?:rs|inr)\.?\s?\d{2,6}(?!\d)/i;
// Tamil: rupees, send / pay money, fee. English amounts in words ("pay five hundred"), booking / registration fees.
const MONEY_TA = /(ரூபாய்|ரூ\.?\s?\d|பணம்\s*(அனுப்ப|கட்ட|செலுத்த)|கட்டணம்)/;
const MONEY_WORDS = /\b(pay|send|transfer|deposit)\b[^.\n]{0,40}\b(hundred|thousand|rupees|bucks|amount|fee)\b|\b(booking|registration|processing|slot)\s+(fee|charge|amount)\b/i;
const SECRET = /\b(otp|one time password|pin(?: number)?|cvv|password|aadhaar (?:no|number|otp)|card number)\b/i;
// Full links, and bare domains with a path ("tn-relief.in/form").
const URL_RE = /\b(?:https?:\/\/|www\.)[^\s<>"']+|\b[a-z0-9-]+(?:\.[a-z0-9-]+)*\.(?:in|com|org|net|app|info|xyz|online|site|top|live|link|me|co)\/[^\s<>"']*/gi;
// Free hosting and tunnels where anyone can put up a fake page in minutes.
const FREE_HOSTS = /(^|\.)(web\.app|firebaseapp\.com|netlify\.app|vercel\.app|github\.io|pages\.dev|glitch\.me|blogspot\.com|wixsite\.com|weebly\.com|000webhostapp\.com|ngrok(-free)?\.(io|app)|trycloudflare\.com|sites\.google\.com|forms\.gle)$/i;
const RELIEF_WORDS = /(relief|rescue|flood|ndrf|sdrf|govt|government|cm-?fund|donat)/i;
const SHORTENERS = /^(bit\.ly|tinyurl\.com|goo\.gl|is\.gd|cutt\.ly|rb\.gy|shorturl\.at|t\.ly|ow\.ly|tiny\.cc)$/i;
const TRUSTED = /(^|\.)(gov\.in|nic\.in|tn\.gov\.in|ndma\.gov\.in|chennaicorporation\.gov\.in|t\.co|twitter\.com|x\.com|google\.com|maps\.app\.goo\.gl|youtube\.com|youtu\.be)$/i;
const LOOKALIKE = /(gov[-_.]?in(?!$)|govt?-?tn|ndrf-|rescue-?(?:fund|pay)|relief-?(?:fund|pay)|cmprf(?!\.tn\.gov\.in))/i;

/**
 * Returns { level: 'high' | 'check' | null, reasons: [...] }.
 * 'high'  = asks for money or a secret (OTP, PIN, password) — a real rescue request never needs either.
 * 'check' = a link that hides where it goes or imitates an official site.
 */
export function scamCheck(text) {
  const t = String(text || '');
  const reasons = [];
  if (MONEY.test(t) || MONEY_TA.test(t) || MONEY_WORDS.test(t)) reasons.push('asks for money or bank / UPI details');
  if (SECRET.test(t)) reasons.push('asks for an OTP, PIN or password');
  for (const raw of t.match(URL_RE) || []) {
    let host = '';
    try { host = new URL(raw.startsWith('http') ? raw : `https://${raw}`).hostname.toLowerCase(); } catch { continue; }
    if (/^\d{1,3}(\.\d{1,3}){3}$/.test(host)) reasons.push(`link to a bare IP address (${host})`);
    else if (host.startsWith('xn--') || host.includes('.xn--')) reasons.push(`link with a disguised (punycode) name (${host})`);
    else if (SHORTENERS.test(host)) reasons.push(`shortened link that hides where it goes (${host})`);
    else if (/\.apk(\?|$)/i.test(raw)) reasons.push('link to an app file (.apk) to install');
    else if (LOOKALIKE.test(host) && !TRUSTED.test(host)) reasons.push(`link that imitates an official site (${host})`);
    else if (RELIEF_WORDS.test(host) && !TRUSTED.test(host)) reasons.push(`relief / rescue site that is not a government site (${host})`);
    else if (FREE_HOSTS.test(host) && !TRUSTED.test(host)) reasons.push(`page on free hosting that anyone can set up (${host})`);
    else if (raw.startsWith('http://') && !TRUSTED.test(host)) reasons.push(`link without https (${host})`);
  }
  const high = reasons.some((r) => /money|OTP/.test(r));
  return { level: reasons.length ? (high ? 'high' : 'check') : null, reasons: [...new Set(reasons)] };
}

/** 9840012345 -> 98•••••345 */
export const maskPhone = (p) => { const d = String(p || '').replace(/\D/g, ''); return d.length >= 8 ? `${d.slice(0, 2)}•••••${d.slice(-3)}` : '•••'; };
/** Masks every phone-like number inside free text. */
export const maskText = (t) => String(t || '').replace(/(?:\+?91[\s-]?|0)?\d{5}[\s-]?\d{5}(?!\d)/g, (m) => maskPhone(m));

const enc = new TextEncoder();
const hex = (buf) => [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('');
const b64 = (buf) => btoa(String.fromCharCode(...new Uint8Array(buf)));
const unb64 = (s) => Uint8Array.from(atob(s), (c) => c.charCodeAt(0));
const canon = (v) => (Array.isArray(v) ? `[${v.map(canon).join(',')}]` : v && typeof v === 'object'
  ? `{${Object.keys(v).sort().map((k) => `${JSON.stringify(k)}:${canon(v[k])}`).join(',')}}` : JSON.stringify(v));
const sortEvents = (events) => [...events].sort((a, b) => a.at - b.at || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));

/** Hash chain over the event log: h_i = SHA-256(h_{i-1} || canonical(event_i)). Same events in any order -> same head. */
export async function chainHead(events) {
  let h = '0'.repeat(64);
  for (const e of sortEvents(events || [])) h = hex(await crypto.subtle.digest('SHA-256', enc.encode(h + canon(e))));
  return h;
}
/** Short, readable fingerprint of a chain head, e.g. "4F2A-91C0-7B3E". */
export const fingerprint = (head) => String(head || '').slice(0, 12).toUpperCase().replace(/(.{4})(?=.)/g, '$1-');

export const KDF_ROUNDS = 310000;
async function keyFrom(passphrase, salt) {
  const base = await crypto.subtle.importKey('raw', enc.encode(passphrase), 'PBKDF2', false, ['deriveKey']);
  return crypto.subtle.deriveKey({ name: 'PBKDF2', salt, iterations: KDF_ROUNDS, hash: 'SHA-256' }, base, { name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt']);
}

/** Encrypts a board ({ events, ... }) for a shift handover. The chain head is sealed inside, so any change is caught. */
export async function sealBoard(board, passphrase) {
  if (!passphrase || passphrase.length < 8) throw new Error('Use a passphrase of at least 8 characters.');
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const head = await chainHead(board.events);
  const body = enc.encode(JSON.stringify({ ...board, chainHead: head }));
  const ct = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, await keyFrom(passphrase, salt), body);
  return { app: 'FloodLine', sealed: 1, cipher: 'AES-256-GCM', kdf: `PBKDF2-SHA256-${KDF_ROUNDS}`, salt: b64(salt), iv: b64(iv), data: b64(ct), fingerprint: fingerprint(head) };
}

/** Opens a sealed board. Throws on a wrong passphrase or a changed file (GCM tag), or a broken chain. */
export async function openBoard(file, passphrase) {
  let plain;
  try {
    plain = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: unb64(file.iv) }, await keyFrom(passphrase, unb64(file.salt)), unb64(file.data));
  } catch {
    throw new Error('Wrong passphrase, or the file was changed after it was sealed.');
  }
  const board = JSON.parse(new TextDecoder().decode(plain));
  const head = await chainHead(board.events);
  if (head !== board.chainHead) throw new Error('The event log inside does not match its fingerprint.');
  return { board, fingerprint: fingerprint(head) };
}

/** For an unsealed file: does the log still match the fingerprint written when it was exported? */
export async function verifyPlain(file) {
  if (!file.chainHead) return { ok: null, fingerprint: fingerprint(await chainHead(file.events)) };
  const head = await chainHead(file.events);
  return { ok: head === file.chainHead, fingerprint: fingerprint(head) };
}

// ---------- shared boards, end-to-end encrypted ----------
// A group code (e.g. "K7QM-2XDA-9PTV-C3HF", 80 random bits) is shared by voice. From it each device derives
//   boardId = first 32 hex of SHA-256("floodline-board:" + code)   -> where the encrypted log lives
//   key     = PBKDF2-SHA-256(code, salt = boardId, 310,000 rounds) -> AES-256-GCM key, never leaves the device
// The server stores only { c: ciphertext, iv }, so it never sees a family's name, place or number.
const B32 = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
export function newGroupCode() {
  const r = crypto.getRandomValues(new Uint8Array(16));
  return [...r].map((b) => B32[b % 32]).join('').replace(/(.{4})(?=.)/g, '$1-');
}
export const normaliseCode = (code) => String(code || '').toUpperCase().replace(/[^A-Z0-9]/g, '').replace(/(.{4})(?=.)/g, '$1-');
export async function boardKeys(code) {
  const c = normaliseCode(code);
  if (c.replace(/-/g, '').length < 16) throw new Error('A group code has 16 letters and digits.');
  const boardId = hex(await crypto.subtle.digest('SHA-256', enc.encode(`floodline-board:${c}`))).slice(0, 32);
  const key = await keyFrom(c, enc.encode(boardId));
  return { code: c, boardId, key };
}
export async function sealEvent(key, ev) {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ct = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, enc.encode(JSON.stringify(ev)));
  return { c: b64(ct), iv: b64(iv) };
}
export async function openEvent(key, doc) {
  const plain = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: unb64(doc.iv) }, key, unb64(doc.c));
  return JSON.parse(new TextDecoder().decode(plain));
}

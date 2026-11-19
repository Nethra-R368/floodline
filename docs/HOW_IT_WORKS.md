# How FloodLine works

A static web app (no build step) served from GitHub Pages. Everything runs in the browser; Firebase is used for the cloud AI (Firebase AI Logic) and, if a group chooses, for sharing one encrypted board across devices (Auth + Firestore).

## Pipeline for one message

| Step | Code | What happens |
|---|---|---|
| 1 | `splitMessages` (`js/core/input.js`) | Paste → separate messages (WhatsApp "Export chat" lines or blank lines). |
| 2 | `extractRules` (`js/core/extract.js`) | Offline, instant: kind (request / update / offer / noise), Indian mobile numbers (with +91 / 0 prefixes), area (54 Chennai localities, English / Tanglish / Tamil spellings), street and door, people, vulnerable (pregnant, medical, infant, elderly, disabled), water level, needs. |
| 3 | `report` event (`js/core/store.js`) | Message + extraction appended to the event log; the request appears at once. |
| 4 | `readMessages` (`js/ai.js`) | Optional. Firebase AI Logic `getGenerativeModel` with `InferenceMode.PREFER_ON_DEVICE` (or on-device only / cloud only from Settings): Gemini Nano when `LanguageModel.availability()` is "available" within 2.5 s, otherwise Gemini in the cloud (3.6 Flash → 3.5 Flash → 3.1 Flash-Lite, a model is skipped for 10 min after a quota error). One JSON schema both ways (`responseSchema` / `responseConstraint`). The model and `inferenceSource` are recorded. |
| 5 | `guardAi` (`js/core/prompt.js`) | Checks every AI answer against the message: a phone must be in the message (a landline the AI lists is set aside, an invented number is blocked); the area must be a known locality; an address must be ≥60% words from the message; a name must be in the message. **If the rules read a request and the AI disagrees, it stays a request** (`aiKind` records what the AI thought). On the device (Gemini Nano), water level and vulnerability only fill gaps the rules left. Vulnerable flags are the union of rules and AI. Result: an `extract` event. |
| 6 | `clusterReports` (`js/core/dedupe.js`) | Union-find: same phone → same group; same area + street/door tokens (Jaccard ≥ 0.6, different door numbers never merge); same name + street. Each group says why it was merged. |
| 7 | `scoreCase` (`js/core/priority.js`) | Points with labels (pregnant 40, medical 40, infant 25, elderly 20, disabled 20, neck water 35, terrace 20, waist 15, trapped 10, 3/person up to 15, +1 per 10 min unassigned up to 30, +3 per extra report up to 9, supplies-only −15). Time-critical (pregnant, medical, infant, neck-deep water) is raised to at least 70 = "critical". The order is advice for the volunteer. |
| 8 | `buildState` (`js/core/store.js`) | Applies `claim` / `status` / `verify` events. Flags: stale (unclaimed 45 min), check (no update 90 min), says-safe, reshared, **double-claim** (two volunteers took it), **ai-doubt** (most of its posts look like a helpline to the AI — kept, sorted to the bottom). Location precision: exact (door no. + street) / street / locality / unknown, and whether the address was confirmed. |

## Events and sync

Every action is an immutable event with an id and time (`report`, `extract`, `claim`, `status`, `verify`; actions carry the volunteer's name and a device id). The board is rebuilt from the log (`buildState(events, now)` is a pure function), so:

- **Same device:** windows share events over `BroadcastChannel`.
- **Across devices (optional):** `js/sync.js`. Volunteers enter the same group code (80 random bits). Each device derives `boardId = SHA-256("floodline-board:" + code)[0:32]` and `key = PBKDF2-SHA-256(code, salt = boardId, 310,000)` → AES-256-GCM. Every event is encrypted on the device and written to Firestore at `boards/{boardId}/events/{eventId}` after anonymous Firebase sign-in (App Check enforced); `onSnapshot` brings other volunteers' events, which are decrypted and merged by id. Offline writes queue in Firestore's local cache. `firestore.rules` allow only create (append-only), only with fields `c, iv, by, ts`, `by == auth.uid`, `ts == request.time`, size limits. "Move to a new group code" copies the board under a new key; "Forget" wipes it from the device.
- **Handover file:** download the log, optionally locked with a passphrase (AES-256-GCM, PBKDF2 310,000, random salt and IV). An unlocked file carries a SHA-256 hash-chain fingerprint, which detects accidental changes only.

What the server sees on a shared board: ciphertext, the board id, event ids (they encode a time), server timestamps and anonymous user ids. With cloud AI on, message text goes to the Gemini API in plain text.

## The 2015 data (`scripts/`)

1. `1_extract_candidates.py` — reads the RDF files of the CC0 archive, de-duplicates texts (34,717), keeps posts that mention being stuck / rescue / water / a vulnerable person **and** contain a phone number, and are not obvious offers (593).
2. `2_build_stream.py` — anonymises (phone numbers → made-up numbers in the same format, same input → same output; @handles, links, door numbers, names next to numbers or after contact / call / Dr / Mr, and a listed set of names) and keeps the real times → `js/core/realstream.js` (520 after removing identical copies).
3. `3_build_labelled_60.py` — random sample of 60 (seed 2015), anonymised with hand-written replacements, with the labels → `js/core/realset.js`.
4. Gemini's raw answers are recorded from the live app (`js/core/realstream_ai.js`, `js/core/measured.js`); `js/core/evaluate.js` scores them with the current checks.

## Reproduce the numbers

```bash
node --test test/core.test.mjs

# accuracy on the 60 real posts (rules live; AI from recorded raw answers)
node --input-type=module -e "
import { scoreRules, scoreRecorded } from './js/core/evaluate.js';
console.log('rules', scoreRules().overall);
for (const w of ['cloud','device']) { const s = scoreRecorded(w); console.log(w, s.model, s.overall, 'own reading', s.own.overall, 'invented', s.invented); }"

# the replay
node --input-type=module -e "
import { REAL_STREAM } from './js/core/realstream.js'; import { STREAM_AI } from './js/core/realstream_ai.js';
import { extractRules } from './js/core/extract.js'; import { guardAi } from './js/core/prompt.js'; import { buildState } from './js/core/store.js';
const evs = REAL_STREAM.map((m,i)=>({t:'report',id:'R'+i,at:m.at,text:m.text,x:guardAi(STREAM_AI[i],m.text,extractRules(m.text),'cloud')}));
const st = buildState(evs, Math.ceil(REAL_STREAM.at(-1).at)+10); const clear = st.cases.filter(c=>!c.flags.includes('ai-doubt'));
console.log('requests', clear.length, 'critical', clear.filter(c=>c.tier==='critical').length, 'check groups', st.cases.length-clear.length);"

# the simulation
node --input-type=module -e "
import { generateNight, simulate } from './js/core/sim.js';
const P={boats:10,volunteers:3,minutesPerMessage:2.5,manualRepeatCatch:0.4};
let m=0,f=0; for (let s=1;s<=20;s++){ const n=generateNight({seed:s*101,households:110}); m+=simulate(n,'manual',P).neverReached; f+=simulate(n,'floodline',P).neverReached; } console.log(m/20, f/20);"
```

Re-recording the AI answers needs the live site (App Check) — Results page → "Run Gemini on the real messages"; for Gemini Nano, desktop Chrome with the Prompt API and the model downloaded. Re-running `scripts/` needs the RDF files from the archive.

## What is real and what is simulated

| Real (verified) | Simulated or recorded |
|---|---|
| Reading, grouping, ranking, tracking on pasted messages | The Results-page boat comparison (`js/core/sim.js`) |
| Cloud Gemini through Firebase AI Logic + App Check | "10 simulated boat teams" on the practice board |
| Gemini Nano on the device, offline (tested on one laptop) | The 2015 replay uses *recorded* AI answers |
| Offline app (service worker) | No real rescue outcomes; no deployment yet |
| Encrypted shared board (tested with two browsers) | Locations are area centres unless an address is given |

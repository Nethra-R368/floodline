# How FloodLine works (for judge questions)

## Pipeline for one pasted message

| Step | Function (file) | What happens |
|---|---|---|
| 1 | `splitMessages` (core/input.js) | Paste → separate messages. Understands WhatsApp "Export chat" lines or blank-line separation. |
| 2 | `extractRules` (core/extract.js) | Instant, offline: kind (request / update / offer / noise), Indian mobile numbers, area (28 Chennai localities, English + Tanglish + Tamil script spellings), street/door, people count, vulnerable (pregnant, medical, infant, elderly, disabled), water level, needs, trapped. |
| 3 | `report` event (core/store.js) | Message + extraction appended to the event log; the case appears immediately. |
| 4 | `extractWithGemini` (gemini.js) + `guardAi` (core/prompt.js) | Optional. Gemini re-reads messages in batches of 10. Guardrails: phone kept only if its digits are in the message; area only if it is in the gazetteer; address only if ≥60% of its words are in the message; contact name only if written; vulnerable flags are the union of rules + AI (missing a pregnant woman costs more than an extra flag). Result is an `extract` event. |
| 5 | `clusterReports` (core/dedupe.js) | Union-find over reports: same phone → merge; same area + street/door tokens (Jaccard ≥ 0.6, different door numbers never merge) → merge; same name + street → merge. Case id = earliest report, so ids stay stable as cases grow. |
| 6 | `scoreCase` (core/priority.js) | Points with labels: pregnant 40, medical 40, infant 25, elderly 20, disabled 20, neck water 35, terrace 20, waist 15, trapped 10, 3/person (max 15), +1 per 10 min unassigned (max 30), +3 per extra report (max 9), supplies-only −15. Tiers: critical ≥70, high ≥45, medium ≥25. |
| 7 | `buildState` (core/store.js) | Applies claim/status events; flags: **stale** (unclaimed 45 min), **check** (claimed, no update 90 min), **says-safe** (an update message matches the household), **reshared** (reports after rescue). |

## Why an event log?

Every action (`report`, `extract`, `claim`, `status`) is an immutable event with an id and time. The board is rebuilt from the log, so:
- **sync is simple**: volunteers exchange events (`mergeEvents` de-duplicates by id). Today that's `BroadcastChannel` between windows on one device plus export/import; a tiny backend (e.g. Firebase) would carry the same events across phones;
- **nothing is lost or overwritten**: full audit trail for the after-action review;
- **testable**: `buildState(events, now)` is a pure function.

## The benchmark (core/sim.js)

`generateNight(seed)` creates households with known truth (area, street, phone, people, vulnerable, water, start time, maybe self-rescue) and writes their messages: a first post in English / Tanglish / Tamil, then re-posts by relatives (forwards, "still no help", a relative's own number, no number), "we are safe now" updates, boat/food offers and chatter.

`simulate(night, strategy)` runs 12 hours minute by minute with the same boats:
- **manual**: N volunteers read the chat in order, each message takes M minutes; unread messages older than 120 min are lost in the scroll; a repost is recognised 40% of the time; obviously critical messages jump the queue half the time; boats go in queue order.
- **floodline**: messages arrive within 5 min; the real `extractRules` + clusterer run; a free boat takes the highest-scoring open case; cases whose family says they're safe are skipped.
- Boat round trip = 20 min + 10 min/km from the nearest of 4 depots. Arriving after the family was rescued (or got out) = wasted trip.

`evaluateExtraction` / `evaluateDedupe` score the extractor against the generated truth; `scoreHardSet` scores any extractor (rules or Gemini) on 30 hand-labelled hard messages.

## Likely questions

| Q | A |
|---|---|
| Isn't this just AI translating messages? | No. Reading is step 2 of 7. The value is the shared state: merge repeats, rank with reasons, track ownership, flag what's forgotten, close the loop. It works with no AI at all. |
| What if the AI invents a phone number? | It is blocked: every AI phone must appear in the message digits (unit-tested). The board shows "🛡 Blocked phone … not in the message". |
| What if there's no internet for AI? | Rules work offline; AI only improves extractions later. |
| Is the benchmark rigged? | All assumptions are editable in the Proof tab; the 20-night table shows where FloodLine is worse (median wait for low-risk families). The extractor is not tuned on the hard set; on it rules score 90.3% and only 37.5% on people counts. |
| Why rules and AI, not just AI? | Speed (instant), offline, cost, and a check on the AI. |
| Privacy? | No FloodLine server. Data stays in the volunteer's browser; with Gemini on, message text goes to Google's API only. Demo data is fictional. |
| What's next? | Cross-device sync backend; SMS gateway intake for areas without data; street-level geocoding; Tamil voice-note transcription; a pilot with a volunteer group during the monsoon. |

# FloodLine

[![tests](https://github.com/Nethra-R368/floodline/actions/workflows/test.yml/badge.svg)](https://github.com/Nethra-R368/floodline/actions/workflows/test.yml) · MIT · no build step · **Live: https://nethra-r368.github.io/floodline/**

A rescue board for volunteer groups during Chennai floods. Volunteers paste the requests that pour in on WhatsApp, X and SMS; FloodLine reads them, groups repeats of the same family, orders them by urgency with the reasons written out, and keeps every request on the list until a person closes it. It keeps working when the network doesn't. **It helps people decide; it never decides who gets rescued.**

**Status, honestly:** a working web app, tested by replaying 520 real posts from the 2015 Chennai flood and with unit tests. It has **not** been used by a rescue group in a real flood yet. Most of the code was written by an AI coding assistant (Claude Code) working from my direction, design decisions and testing; see [Who built what](#who-built-what).

Demo video: https://youtu.be/2TtRTdWzyA0

| The real 2015 night, replayed | One family, posted 12 times |
|---|---|
| ![Board after replaying 520 real posts](docs/screenshots/board.jpg) | ![The Mudichur request, reported 12 times](docs/screenshots/request.jpg) |
| **Real flood test** | **How well it understood** |
| ![Real flood test page](docs/screenshots/case.jpg) | ![Accuracy on 60 labelled real posts](docs/screenshots/accuracy.jpg) |
| **Security** | **Phone** |
| ![Security page](docs/screenshots/security.jpg) | ![Phone layout](docs/screenshots/phone.jpg) |

## Why

In the 2015, 2023 (Michaung), 2024 (Fengal) and 2025 (Ditwah) floods, phone lines went down and rescue requests moved to social media. Volunteer groups read them by hand and passed them to boat teams. The same problems came up each time: one family posted many times by different relatives; helpline numbers mixed in with requests; requests that nobody picked up scrolling out of view. In the 2018 Kerala floods, volunteers built keralarescue.in, an open-source request site the state adopted; FloodLine is a smaller attempt at the same idea for the way requests arrive in Chennai — as free-text posts, not forms.

## What it does

- **Reads each message.** Rules (offline, instant) pull out the area, phone numbers, people, water level and who is vulnerable. Gemini then re-reads it through Firebase AI Logic — **on the device with Gemini Nano** when Chrome has it, **in the cloud** otherwise — and every AI answer is checked against the message.
- **Never lets the AI hide a request.** If the rules see a request and the AI thinks it's a helpline or an update, it stays on the list, marked "check", below the clear requests. A person decides.
- **Groups repeats** by the same phone number or the same address, and says why.
- **Orders by urgency, with points you can read:** pregnant or in labour +40, medical +40, neck-deep water +35, baby +25, elderly +20, cannot walk +20, terrace +20, plus waiting time and repeats. Time-critical households are never shown below "critical". The order is advice; volunteers can take any request.
- **Shows how precise the location is** — door number and street / street or landmark / area only / unknown — and asks for the address to be confirmed on a call before a boat goes ("Address confirmed" is recorded).
- **Keeps track:** unclaimed for 45 minutes, no update for 90 minutes, a later "we are safe" message, two volunteers taking the same family, people still sharing after a rescue — all flagged. Closing a *critical* request asks how it was confirmed.
- **Works as a team:** one board across devices with a group code, end-to-end encrypted (below); every action records the volunteer's name and device.
- Map (OpenStreetMap, area-level pins), call / WhatsApp buttons, a Tamil + English follow-up message, phone layout, dark mode, helplines 112 / 1070 / 1077 / 1913 always on top.

## Works when the network doesn't

- **Offline app:** after one visit, a service worker keeps the app on the device.
- **Hybrid AI:** Firebase AI Logic with `InferenceMode.PREFER_ON_DEVICE` — Gemini Nano in Chrome reads messages with no internet and the text never leaves the device; otherwise Gemini in the cloud (fallback chain: 3.6 Flash → 3.5 Flash → 3.1 Flash-Lite, each skipped for 10 minutes after it runs out of free quota). Same JSON schema both ways; each request says which one read it.
- **Rules always run**, so with no network and no model the board still fills.

On-device reading needs desktop Chrome with the Prompt API (Gemini Nano) enabled; press "Prepare" in Settings once.

## Tested on the real 2015 Chennai flood (a replay, not a deployment)

**Data.** A public CC0 archive of #ChennaiFloods tweets ([OpenLinkedSocialData/ChennaiFloods_tw](https://github.com/OpenLinkedSocialData/ChennaiFloods_tw), 34,717 unique texts, 2 Dec 14:13 UTC – 3 Dec 07:00 UTC 2015). The 593 that mention being stuck, rescue, water or a vulnerable person **and** contain a phone number; identical copies removed → **520 posts**, kept in the order and at the minute they were posted. Names, @handles, links, door numbers and every phone number are replaced by a script, keeping number formats valid (`scripts/`). The archive is a hashtag sample, mostly English, and the phone-number filter is a selection bias.

**Replay** (*Real replay* board and *Real flood test* page). All 520 posts read by Gemini 3.1 Flash-Lite in the cloud (recorded raw answers in `js/core/realstream_ai.js`; FloodLine's current checks are applied when the page loads):

- **216 requests on the list**, from 325 posts — 109 posts repeated a request already there (one pregnant woman in Mudichur posted 12 times).
- **68 critical**: 17 pregnant or in labour, 23 with a baby, 15 needing medical care.
- **59 groups (184 posts) the AI thinks are helplines** — kept at the bottom, marked "check", never hidden.
- **0 phone numbers invented** by Gemini (37 landline numbers it listed were set aside as not mobile).
- Location: 74 requests with a door number and street, 83 with a street or landmark, 36 area only, 23 place unknown.
- 0 posts flagged as scams.
- Known gap: some "contact this number for rescue" helpline posts are read as requests by both the rules and the AI (e.g. an 11-post group in Ashok Nagar).

The archive has the posts, not what happened next: this shows what FloodLine would have put in front of volunteers, not where boats went.

**Accuracy — an initial check, not proof.** 60 of the posts, sampled at random (seed 2015), were labelled field by field (228 checks). **The labels were made by the AI assistant that helped build FloodLine**, and the same assistant wrote the rules, so this is a first check; an independent human labelling is under way ([`label.html`](https://nethra-r368.github.io/floodline/label.html)). Scores are computed from recorded raw answers in this repository (`js/core/measured.js`, `js/core/evaluate.js`), 19 November 2026:

| On 60 real posts | Rules (offline) | Gemini Nano on the device + checks | Gemini 3.1 Flash-Lite, cloud + checks |
|---|---|---|---|
| All fields, as shown on the board | 81.1% | 79.8% | **89.9%** |
| The AI's own reading, all fields | — | 81.6% | 95.2% |
| Number of people | 10% | 50% | 95% |
| Area | 86.4% | 77.3% | 100% |
| Phone numbers invented | — | 1 | 0 |
| Real requests the AI read as something else (kept anyway) | — | 1 | 0 |

The board's "type of message" is deliberately pinned to the rules' "request" whenever the AI disagrees (safety over accuracy), which is why the board scores are below the AI's own reading. The rules column improved after 26 localities the real posts kept naming were added, so it is no longer a blind test. Repeats on these 60: 42 request posts about 37 households, grouped with 100% precision and recall.

**Also:** 30 messages written and labelled by the AI assistant to look like real ones (`js/core/hardset.js`): rules 90.3% (head counts 37.5%); Gemini 3.6 Flash 98.6% (14 Nov); Gemini Nano 88.3% (18 Nov, after a small-model policy chosen on this set — not held-out).

**Simulation (Results page).** The same synthetic night is played twice with 10 boats — today's way (volunteers read the chat in order) and with FloodLine. Over 20 synthetic nights: households never reached 26.8 → 1.2; boat trips to already-rescued families 26.7 → 0.4; critical households waiting over 3 hours 14.0 → 5.3; median waits slightly longer (2h 42m → 2h 47m). Every assumption is editable on the page. It is a model, not evidence from a flood.

## Security and privacy

What is protected, how, and how it was checked (details on the in-app *Security* tab and in [`docs/HOW_IT_WORKS.md`](docs/HOW_IT_WORKS.md)):

- **Shared board, end-to-end encrypted.** Each event is AES-256-GCM encrypted on the device with a key derived from an 80-bit random group code (PBKDF2-SHA-256, 310,000 rounds). Firestore stores ciphertext plus metadata (board id = SHA-256 of the code, event ids, server timestamps, anonymous user ids) — not names, places or numbers. [`firestore.rules`](firestore.rules): append-only, signed-in only, server timestamps, fixed fields. Tested live: editing or deleting an event, adding a plaintext field, posing as another user, a fake timestamp, listing boards, writing outside boards and writing while signed out are all denied; a signed-in user *can* add junk ciphertext to a board path they know, so sign-in now requires Firebase App Check (also enforced on the Gemini calls).
- **Leaked code / lost phone:** "Move to a new group code" copies the board under a new key (old-code devices stop getting updates); "Forget this board on this device". *Not yet:* the board in browser storage is not encrypted at rest.
- **Who did what:** every action records name and device; two volunteers taking the same request is flagged; closing a critical request needs a stated confirmation. *Not yet:* individual accounts and roles — anyone with the code can add events.
- **AI checks:** a phone number must be in the message, an area must be a known locality, an address must mostly be words from the message; the AI can't remove a request. Prompt-injection and XSS cases are unit-tested.
- **Scam and phishing flags:** money / UPI / OTP asks (English and Tamil, amounts in words), shortened, punycode, IP, `.apk`, look-alike and free-hosting links; flags none of the 520 real posts. Pattern-based: it says "verify first", never "safe".
- **Locked handover file** (AES-256-GCM, passphrase) — a wrong passphrase or one changed byte is refused. The fingerprint of an *unlocked* file only catches accidental changes.
- **Cloud AI and privacy:** with cloud reading on, message text (including phone numbers) goes to Google's Gemini API; choose "Only on this device" to keep it local. No API keys in the repo; CSP and Subresource Integrity on the page.

## Who built what

- **Nethra R** — the problem and the product, design decisions, what to measure and what to cut, testing direction, the voice-over; independent labelling of the real posts (in progress).
- **Claude Code (AI coding assistant)** — most of the code, the data-processing scripts, the labels on the 30 written and 60 real posts, the gazetteer coordinates (approximate, typed from general knowledge), and these docs.
- An independent engineering audit of the project (also AI-assisted) found and led to fixing: wrongly anonymised phone numbers that had inflated "AI made it up" counts, the AI being able to hide a request, simultaneous claims, and several overstated claims.

## Run it and reproduce the numbers

```bash
python -m http.server 8000      # then open http://localhost:8000
node --test test/core.test.mjs  # 33 unit tests
```

Every number above can be recomputed from the repository; commands are in [`docs/HOW_IT_WORKS.md`](docs/HOW_IT_WORKS.md#reproduce-the-numbers). The 2015 data pipeline is in [`scripts/`](scripts/).

## Limits

- Not yet used in a real flood or a drill with a rescue group.
- Locations are area centres unless a door number and street are given; coordinates are approximate.
- Reads text only — not voice notes or photos. Tamil and Tanglish are handled but barely evaluated.
- Shared boards: one code per group, no roles; local storage not encrypted.

Made by Nethra R. MIT licence. Map data © OpenStreetMap contributors.

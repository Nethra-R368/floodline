# FloodLine: submission text (copy-paste)

For **SLAY HACKS** (AI), **Arbiter Hacks** (General track) and **AI OpenBuild**. Solo project.

**Built Nov 13, 2026** during the event period. No pre-existing code.
- Live demo: https://nethra-r368.github.io/floodline/
- Code: https://github.com/Nethra-R368/floodline
- AI used: **Google Gemini** (`gemini-2.5-flash`, JSON mode) for reading messages, behind rule-based guardrails.

## Tagline
When a city floods, rescue requests drown in WhatsApp. FloodLine makes sure nobody gets forgotten.

## Inspiration
Chennai floods almost every northeast monsoon: 2015, Cyclone Michaung in 2023, Fengal in 2024, Ditwah in 2025. Each time phone lines fail and rescue requests move to WhatsApp, X and Instagram, and volunteers sort them by hand. The same family gets posted ten times, so boats double up while other requests scroll away. Old requests keep being shared after the family is safe. I live here; this happens every year.

## What it does
- **Paste anything**: one message or a whole WhatsApp chat export, in English, Tamil or Tanglish.
- **Extracts** area, phone, people, water level and who is vulnerable (pregnant, medical, baby, elderly, cannot walk), instantly and offline with rules; **Gemini** then re-reads landmarks and loose phrasing.
- **AI guardrails**: any AI detail not present in the message (an invented phone number, an unknown area, an address that wasn't written) is blocked and shown.
- **Merges repeats** into one case with the reason ("same phone number").
- **Ranks by urgency with reasons** a volunteer can check.
- **Nobody gets forgotten**: unclaimed 45 min turns red, silent 90 min asks for a check-in, "we are safe" messages and reposts after rescue are flagged with a ready reply.
- **Live map**, one-tap call and WhatsApp follow-up in Tamil + English, **team sync** via an event log, export/import for handover, phone layout, dark mode.
- **Proof tab**: replays a flood night with and without FloodLine, with every assumption editable.

## How I built it
- Plain JavaScript, no framework, GitHub Pages. Leaflet + OpenStreetMap for the map.
- **Event-sourced state**: every message and action is an immutable event; the board is a pure function of the log, which makes sync, audit and tests simple.
- **Rule extractor** with a gazetteer of 28 flood-prone Chennai localities in English, Tanglish and Tamil script.
- **Duplicate matching** with union-find over phone numbers and street/door tokens, with explainable merge reasons.
- **Gemini** in JSON mode, batched, with retries and model fallback; `guardAi` checks every field against the source text.
- **Simulation**: a deterministic generator of realistic multilingual SOS traffic with ground truth, and a minute-by-minute boat dispatch simulation comparing manual coordination with FloodLine.
- 16 unit tests (`node --test`).

## Results (from the Proof tab)
Average over 20 simulated nights, 110 households each, same 10 boats:
- Households never reached: **26.8 → 1.1** (better on 20/20 nights)
- Boat trips wasted on families already rescued: **26.7 → 0.4**
- Critical cases (pregnant, medical, baby, neck-deep water) waiting 3h+ or never reached: **14.0 → 6.7** (better on 18/20, worse on 2)
- Honest trade-off: low-risk families wait longer because critical cases go first, and the median wait for critical cases that *were* reached is about the same (1h 01m vs 1h 06m) because manual coordination simply never reaches ~27 households.

Reading accuracy on 30 hand-written hard messages the rules were never tuned on: rules alone **90.3%** overall but only **37.5%** on people counts; Gemini + guardrails: **[fill in after running "Run Gemini on the hard set" in the Proof tab]**.

## Built during the event vs. before
Everything was written on Nov 13, 2026. Libraries: Leaflet (map), OpenStreetMap tiles, Google Gemini API. The flood night and all names/numbers in the demo are simulated.

## One failure case and how I tested
**Failure case: messages with no locality name.** "Near Phoenix mall backside streets flooded, old couple stuck" has no area name, so the rules put it on the board as **Unknown area** with no map pin (it is still ranked and can be claimed). Gemini resolves the landmark to Velachery, but only because Velachery is in the gazetteer; a landmark in a locality outside the 28 known areas stays unknown. People counts written as words ("old couple", "my amma alone", Tamil "மூன்று பேர்") are also missed by rules (37.5% on the hard set). Next step: a larger gazetteer with landmarks and street-level geocoding.

**How I tested**
- 16 unit tests: phone formats (+91, spaces, no partial numbers), areas in three scripts, Tanglish/Tamil extraction, update/offer/noise detection, duplicate merging and non-merging (different door, different area), priority reasons, claim/rescue/stale/check-in/says-safe/re-shared flags, event-log merging, AI guardrails rejecting invented phones/areas/names, broken AI replies, deterministic simulation, extraction scoring.
- Measured the extractor on the generated night (100%, an easy upper bound) and on a separate hand-labelled hard set (90.3%), and did not tune the rules on the hard set.
- The benchmark found a real bug: numbers written "+919876543210" with no space were missed. Fixed and covered by a test.
- In the browser: played the full night, opened two windows as two volunteers and checked that a claim in one appears instantly in the other, phone layout at 375 px, dark mode, map resizing.
- Gemini on the hard set with my own key: [result].

## Challenges
- Making the AI safe for a rescue setting: guardrails against invented details.
- Writing realistic Tamil/Tanglish traffic and a hand-labelled hard set to measure honestly.
- Designing a fair benchmark and showing where FloodLine is worse.

## What's next
- Cross-device sync backend so volunteers on different phones share one board.
- SMS intake for areas where only SMS works.
- Street-level geocoding and a landmark gazetteer.
- Tamil voice-note transcription.
- Pilot with a Chennai volunteer group in the monsoon.

## Built with
javascript, html, css, gemini, google-ai-studio, leaflet, openstreetmap, github-pages

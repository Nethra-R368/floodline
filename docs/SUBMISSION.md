# FloodLine — submission text

For SLAY HACKS (AI), Arbiter Hacks (General track) and AI OpenBuild. Solo project.

Built November 13, 2026, during the event period. No code existed before.
- Live: https://nethra-r368.github.io/floodline/
- Code: https://github.com/Nethra-R368/floodline
- AI used: Google Gemini (gemini-2.5-flash) to read messages, with every answer checked against the original text.

> Before submitting: replace the two [brackets] below with your own words and the Gemini number from the Results page.

## Tagline
A rescue request tracker for volunteer groups during Chennai floods: paste the WhatsApp messages, see who needs help first, and make sure no request is forgotten.

## Inspiration
When Chennai floods — 2015, Michaung in 2023, Fengal in 2024, Ditwah in 2025 — phone lines go down and people ask for rescue on WhatsApp, X and Instagram. Volunteer groups read those messages by hand and pass them to boat teams. Reports from 2023 describe volunteers sorting requests from Velachery, Manali and Pallikaranai this way, picking out pregnant women and medical cases by eye.

[Your own reason, in two or three sentences: where you were during one of these floods, or someone you know who was stuck or volunteering, and what you saw go wrong.]

The same problems come up every time: one family posted ten times so two boats go to the same house, old requests forwarded after the family is safe, and requests nobody picked up scrolling away. In the 2018 Kerala floods volunteers built keralarescue.in for this, and the state adopted it. I wanted something like it for the way requests actually arrive in Chennai.

## What it does
- Volunteers paste messages — one at a time or a whole exported WhatsApp chat — in English, Tamil or Tanglish.
- It pulls out the area, phone, number of people, water level and who is vulnerable. Rules do this instantly and offline; Gemini re-reads each message to catch landmarks and loose wording.
- Anything Gemini returns that isn't in the message (a phone number, an area, an address) is not used, and the request shows what was dropped.
- Messages about the same household are grouped, with the reason shown (same phone number, same door and street).
- Requests are ordered by urgency using points you can see: pregnant +40, medical +40, neck-deep water +35, and so on.
- A request nobody takes for 45 minutes is flagged. So is a taken request with no update for 90 minutes, a family whose later message says they are safe, and a request people keep sharing after the rescue — with a ready reply in Tamil and English.
- Map, call and WhatsApp buttons, a message asking the family if they still need help, shift handover by downloading the board. The emergency numbers 112, 1070, 1077 and 1913 are always at the top, because FloodLine is a coordination tool, not an emergency service.

## How I built it
- Plain JavaScript, no framework, hosted on GitHub Pages; Leaflet and OpenStreetMap for the map.
- Every message and action is stored as an event; the board is calculated from the list of events. That makes syncing between volunteers, the history of each request and testing straightforward.
- A rule-based reader with a list of 28 flood-prone Chennai localities spelled in English, Tanglish and Tamil script.
- Repeat grouping by phone number and by door number + street words, with the reason recorded.
- Gemini in JSON mode, ten messages per call, with retries; a check function compares every field Gemini returns with the original message.
- A generator of realistic flood-night messages with known answers, and a minute-by-minute boat simulation comparing today's way with FloodLine.
- 17 unit tests.

## Results
I can't test this in a real flood, so I simulated one. The same night is played twice with the same ten boats: once the way groups work today, once with FloodLine, whose real code reads every message. Averages over 20 simulated nights of 110 households:
- Households no boat ever reached: 26.8 today, 1.2 with FloodLine (better on all 20 nights).
- Boat trips to a family already rescued: 26.7 → 0.4.
- Critical households (pregnant, medical, baby, neck-deep water) that waited over 3 hours or were never reached: 14.0 → 6.5 (better on 18 nights, worse on 2).
- The median wait is a little longer with FloodLine (1h 01m → 1h 06m for critical households that were reached), because today's way never reaches about 27 households and they aren't in its median, and because lower-risk households wait while critical ones go first.

Reading accuracy on 30 hand-written test messages I did not tune the rules on: rules alone get 90.3% of fields right but only 37.5% of head counts; with Gemini and the checks: [Gemini result]%.

## What was built during the event
All of it, on November 13, 2026. Libraries: Leaflet, OpenStreetMap tiles, the Google Gemini API. The practice night and all names and numbers in it are made up.

## A failure case, and how I tested
**Failure case:** a message with no area name, like "Near Phoenix mall backside streets flooded, old couple stuck in 1st floor". With rules only, it goes on the board as "area not recognised", with no pin and no head count. It is still listed and can be taken, but it ranks lower than it should. Gemini fixes this one because Velachery is in FloodLine's list of localities; a landmark in a locality outside the list would still not be recognised.

**Testing:**
- 17 unit tests: phone formats, areas in three scripts, Tamil and Tanglish messages, telling requests from updates, offers and chatter, grouping and not grouping (different door, different area), points, all the warning flags, merging two volunteers' boards, the checks that reject a phone number or area Gemini invented, broken Gemini replies, and that the simulation gives the same result every run.
- Measured the reader on generated messages (an easy upper bound) and on the separate hand-written set.
- The simulation found a real bug: numbers written "+919876543210" with no space were missed. Fixed, with a test.
- In the browser: ran the full practice night; opened two windows as two volunteers and checked that taking a request in one shows in the other immediately; phone size; dark mode.
- [Gemini on the hand-written set with my key: result.]

## Challenges
- Using AI where a wrong detail sends a boat to the wrong house: everything it says is checked against the message.
- Writing realistic Tamil and Tanglish messages, and a hand-labelled test set, so the accuracy numbers mean something.
- Making the comparison fair and showing where FloodLine does worse.

## What's next
- A small server so volunteers on different phones share one board.
- Taking requests by SMS for areas without mobile data.
- More localities and landmarks, and street-level locations.
- Reading Tamil voice notes.
- Trying it with a Chennai volunteer group in a monsoon.

## Built with
javascript, html, css, gemini, google-ai-studio, leaflet, openstreetmap, github-pages

# Stage 2 benchmark — written before any tuning (10 Oct 2026)

## Question
When the engine suggests replacing card X with card Y in a precon, do experienced players who upgraded that same precon agree?

## Evidence (independent of the engine)
Public Archidekt Commander decks with the precon's commander, fetched 10 Oct 2026 (`corpus/`, `corpus2/`).
A deck counts as an **upgraded copy of the precon** when it keeps at least 40% of the precon's nonland cards (excluding the commander)
and has changed at least 5 of them. Decks that keep everything carry no upgrade information; decks with under 40% overlap were
built some other way.

For each precon nonland card X: **keep rate K(X)** = share of upgraded copies that still run X.
For each other card Y: **add rate A(Y)** = share of upgraded copies that run Y.

## Metrics (per deck; nonland swaps of the Apex package)
- **Primary — consensus score** = Σ over suggested swaps of (A(add) − K(cut)). A swap players endorse adds; one they reject subtracts.
- Cut quality: mean K of the cards suggested for replacement (lower is better), against the precon's mean K.
- Add quality: mean A of the suggested additions (higher is better).
- Cut recall: share of the precon cards that fewer than 1 in 3 upgraders keep which the engine also suggests replacing.
- Uncertainty: 1,000 bootstrap resamples of the upgraded copies give a 90% interval for the consensus score.

## Split
- **Tuning set** (formula changes are judged here only): Giada, Font of Hope; Sai, Master Thopterist; Ghoulcaller Gisa;
  Lathliss, Dragon Queen; Invisible Woman (official Wizards decklists; live EDHREC data, 10 Oct).
- **Test set** (judged at milestones, never tuned against): the five retail decks — Avengers Assemble, Doom Prevails,
  Tramplesaurus Rex, Turtle Power!, Wakanda Forever (frozen 6 Oct snapshot).

## Pass marks for a change to be kept
1. Tuning-set consensus score improves in total and on at least 3 of 5 decks.
2. On the test set at the end: total consensus score better than the Stage 1 candidate, and better on at least 4 of 5 decks.
3. Never worse on the guards: 0 rule violations, all acceptance tests pass, job floors (ramp/draw/removal/wipes) kept.

## Known limits of this evidence
- Players' choices include budget; Apex ignores price, so a pricey card players skip can still be right. Reported separately.
- EDHREC's play data (an engine input) comes partly from the same population, so agreement is expected to be high for
  any engine that follows EDHREC; the benchmark measures how well the engine turns data into the right swaps.
- Crowd consensus is not proof of "best". Card-text claims are checked separately against Oracle text.

## Amendment 1 (10 Oct, after baseline measurement, before any tuning)
The summed consensus score rewards suggesting fewer swaps: players' additions are spread over many cards, so even a
perfect crowd-copier scores below zero with 21 swaps (Keen Engineering: −2.54), and suggesting nothing would score best.
Replaced as the primary metric by **agreement@10** = mean of (A(add) − K(cut)) over the engine's 10 highest-gain swaps
(fewer if it suggests fewer; the count is reported). Also reported: **cut keep@10** (mean K of those cuts, lower is better),
**add rate@10** (mean A of those adds), and the **crowd ceiling@10** (best 10 adds paired with the 10 least-kept cards).
Pass mark 1 becomes: tuning-set agreement@10 improves on average and on at least 3 of 5 decks. Pass mark 2 likewise with 4 of 5.

## Amendment 2 (10 Oct, before any data for these decks was looked at)
Owner asked for much higher confidence. Sixteen more recent precons were added, split in advance (alternating, spread over
colours and strategies), with decklists from EDHREC's precon pages:
- **Extra tuning set (tune2):** Abzan Armor, Temur Roar, Limit Break, Revival Trance, Animated Army, Squirreled Away,
  Grand Larceny, Death Toll.
- **Sealed holdout (8):** Jeskai Striker, Mardu Surge, Sultai Arisen, Counter Blitz, Scions & Spellcraft, Endless Punishment,
  Family Matters, Most Wanted. Scored **once**, after all tuning is frozen. Pass mark: Stage 3 beats Stage 1 on mean
  agreement@5 and @10 and on at least 6 of 8 decks at @5, with the per-deck bootstrap reported.
Changes are now judged on all 13 tuning decks (tune + tune2); the original 5 test decks are a second check.

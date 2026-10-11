# Deck Companion — Stage 1 report (correctness repairs)

**Status:** prototype only. Nothing is committed, pushed or deployed. Your checkout is still at Build 73 (`14daea8`) with no changes, and the live site, your Sheets and your decks have not been touched.

## The answer first

- **Correctness: fixed.** On all five retail decks and the five precon-loader replays, the candidate makes no rule-breaking recommendations and recognises every card name. In every one of those 10 runs, the all-Apex, all-Mid and all-Budget packages each produce a valid 100-card deck. Build 73 recommended cards you already had in 3 of the 5 precon replays, failed to recognise 17 card names, and its packages produced invalid decks.
- **Recommendation quality: not proven yet.** Stage 1 did not change how cards are valued, apart from removing the price bonus. That means the review cases are not resolved yet (Queen Mother Ramonda is still misread, for example). That work is Stage 2.
- **Tests:** acceptance tests are 37 passed, 0 failed, 1 not applicable; Build 73 scores 8 passed, 29 failed on the same tests. Browser tests are 13 of 13 passed, on desktop and phone.

## What changed (5 files, +250 / −292 lines)

| File | Change |
|---|---|
| `engine.js` (843 → 799 lines) | Each card is identified by its Oracle ID, so all 561 alternate printed names count as one card. The price bonus is removed from scoring. The four old upgrade engines (`recommend`/`autoSwaps`/`smartPaths`/`upgradePaths`, which chose Budget → Mid → Apex) are replaced by one Apex-first `upgradePaths`. Also new: held picks treated as hard rules, a package check, a rules validator that does not depend on scoring, commander eligibility (rule 903.3), "up to N copies" cards, and the Turtle commander fix. |
| `ui.js` | Exclusions and "add to deck" now match on identity. The button is relabelled "Don't suggest for this deck" and explained on the page, with a per-card "Allow …" to undo it. Every empty tier shows a reason. Every swap is checked before it is applied. Held picks are never released automatically. |
| `index.html`, `version.json`, `README.md` | Build 74 labels (proposed only) and the Mid/Budget limits ($12 / $3). |

The full diff is `out/candidate.diff`, and the file hashes are in `out/candidate.sha256`.

**How the tiers now work.** The **Apex** pick is the best card for the deck, whatever it costs. **Mid** and **Budget** are cheaper cards that do the same job: Mid must cost strictly under $12 and Budget strictly under $3. Each must cost less than the Apex card and still be an improvement on the card it replaces. If no card qualifies, the tier is left blank with a reason, such as "Apex is under the limit" or "No card under $3 does the same job as X and still improves on Y". The engine never offers a weaker card as Apex.

## Identity before / after (precon-loader path)

| Deck | Unknown names B73 → Candidate | Installed cards B73 recommended |
|---|---|---|
| Avengers Assemble | 3 → 0 | Herald's Horn, Raise the Palisade, Fellwar Stone |
| Doom Prevails | 3 → 0 | Spark Double, Containment Construct, Titan of Littjara |
| Tramplesaurus Rex | 0 → 0 | — |
| Turtle Power | 5 → 0 | — |
| Wakanda Forever | 6 → 0 | Hammer of Nazahn, Thran Dynamo, Sword of the Animist, Mind's Eye, Scourglass |

The candidate recommends no cards that are already installed.

## Run summary (retail input)

| Deck | Cards the app suggests replacing B73 → Cand | With an Apex pick B73 → Cand | Rule violations B73 → Cand | Time B73 → Cand |
|---|---|---|---|---|
| Avengers | 7 → 8 | 0 → 8 | 8 → 0 | 1168 → 817 ms |
| Doom | 8 → 10 | 3 → 10 | 8 → 0 | 664 → 201 ms |
| Tramplesaurus | 21 → 22 | 5 → 22 | 22 → 0 | 439 → 172 ms |
| Turtle (Leonardo) | 8 → 8 | 1 → 8 | 9 → 0 | 1091 → 336 ms |
| Wakanda | 6 → 8 | 1 → 8 | 8 → 0 | 634 → 192 ms |

For Build 73, the "rule violations" on retail input are rows offering a cheaper tier with no Apex pick. On the precon path, Build 73 also recommended installed cards. The card-by-card before/after tables are in `out/tables.md`.

## Acceptance tests

The independent checker uses only the handoff's legality snapshot, ban policy and name mappings, and none of the engine's code.

- **Candidate:** 37 passed, 0 failed, 1 not applicable. LEG-04, rejecting Lutri as a companion, does not apply because the app has no companion support.
- **Build 73:** 8 passed, 29 failed. Most of these failures are features that did not exist (validator, held-pick conflicts, tier reasons). The real behaviour failures were:
  - CNT-01: Turtle came out at 99 cards.
  - PRICE-01: Agent Phil Coulson was listed as Budget instead of Apex.
  - Tiers were shown without an Apex pick.
  - The rules for which cards can lead a deck were wrong (LEG-11/12).
- **Browser tests, 13 of 13 passed** (throwaway browser profile, desktop plus a 390 px phone with touch):
  - Precon identity check.
  - Exclusion tests EX-01…06: label, the deck stays unchanged, other decks are unaffected, alternate names, undo, and touch size (29 px against the 24 px minimum).
  - Phone layout.
  - Tier reasons.
  - Mixed apply.
  - A JavaScript error check.

**One bug I introduced and fixed during testing:** the new "Why it can go" note broke the card grid on phones, so Mid overlapped Apex. I wrapped the note and added two layout tests for it.

## Review cases (retail input)

| Card | B73 | Candidate | Assessment |
|---|---|---|---|
| Syphon Mind | cut | cut → M.O.D.O.K. (Apex), Avengers: Under Siege (Budget) | Same as before. |
| Endless Ranks of HYDRA | kept | **newly cut** → Reanimate | Questionable. It makes Villain tokens and keeps coming back for Doom. Stage 2 must teach the engine this. |
| Divine Visitation | cut | cut → Swiftfoot Boots | Defensible. Wakanda's Vibranium tokens are noncreature artifacts, so the Visitation does little in that deck. |
| Queen Mother Ramonda | cut | cut → Jhoira's Familiar | **Wrong for the wrong reason.** The engine doesn't recognise monarch, so the card scores as having no role. This is a Stage 2 fix. |

**The 9 historical pairs:**
- **Same card cut:** the candidate cuts the same card in 8 of 9 pairs. Tri-Sentinel is the exception.
- **Exact pair:** 2 of the candidate's pairs match exactly (Batroc → Leader; Fleecemane → Bronze Guardian). Build 73 matched 5.
- **Reading:** the candidate agrees on which cards are weak, but often picks a different replacement. That is a valuation question for Stage 2. ChatGPT pairs are evidence, not truth.

## Limitations (not done or not verified)

- **Valuation:**
  - Valuation is unchanged apart from removing the price bonus. The roles of monarch, Return of the Wildspeaker (non-Human) and Greater Good are still misread.
  - Mid and Budget are now often blank, because most Apex picks already cost under $3 or $12. That is correct under the new rule, but it looks emptier.
  - Nonbasic lands are never upgraded to better nonbasic lands.
- **Coverage:**
  - Commanders with little EDHREC data now run through the same pipeline as everyone else; Build 73 used its older engine for them.
  - Deck generation, the plan view, choosing partners before generation and the Generate button are not done (Stage 4).
  - On the precon-loader path, Turtle uses EDHREC's commander (Heroes in a Half Shell). The retail fixture uses Leonardo, the Balance.
- **Not verified:**
  - Prices come from 5 Oct card data.
  - I could not check the live site or the official Wizards decklists, because both domains are blocked here. The retail lists do match EDHREC's precon lists exactly.
- **Git:** on 9 Oct, before the no-Git rule, I reset this branch in your checkout. I have run no Git write commands since.

## What I need from you

Please choose one:
1. **Approve a local commit** of the candidate as Build 74 on `claude/deck-companion-upgrade-compare-46c7aa`, with no push.
2. **Approve commit + push** of that branch (it still would not go live until merged to main).
3. **Hold Build 74 and go to Stage 2**: card roles (monarch, tribes), commander profiles and a whole-deck evaluator, aimed at the four review cases. Before I compare results, we agree the pass/fail thresholds.
4. Changes to Stage 1 first.

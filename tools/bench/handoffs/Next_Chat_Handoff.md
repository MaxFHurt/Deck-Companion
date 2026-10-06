# Deck Companion — handoff for the next Claude chat

Written 6 October 2026. Paste or attach this at the start of a new conversation. It replaces the long previous session.

## 1. What this is

Deck Companion is a free, static Magic: The Gathering deck-builder web app. No server, no build step, no AI at runtime.

- **Live:** https://maxfhurt.github.io/Deck-Companion/ — currently **Build 71**
- **Repo:** MaxFHurt/Deck-Companion (GitHub Pages serves branch `main`)
- **Files:** `index.html`, `ui.js`, `engine.js`, `data.js`, `lists.js`, `version.json`, `manifest.json`, icons
- **Data at runtime:** Scryfall (cards, cheapest-printing prices) and EDHREC commander pages, fetched by the browser

The owner is new to Magic and is building the app so its upgrade recommendations can be trusted without an expert.

## 2. Rules the owner has set (follow these)

1. **Nothing goes live without the owner's say-so.** Build and test locally or on a branch, report, then wait. The owner has sometimes said "push it live"; treat that as covering that build only.
2. **Changes go in one at a time, each measured before the next**, then ship together.
3. **Don't add things that weren't asked for.** Propose first.
4. **Benchmark from the retail precon lists only**, never the owner's edited decks. Installed upgrades count as recommendations at the tier they were bought for.
5. **Matching ChatGPT is not the goal.** The goal is that every recommendation is defensible. ChatGPT's lists are evidence, not truth.
6. **Tiers are ceilings:** Budget under $3, Mid under $12, Apex any price. A cheap card can be the Mid or Apex pick.
7. **An upgrade must be an upgrade.** Mid is a full step at +10% over Budget; Apex at +10% over Mid and +20% over Budget. Better-but-short picks may show with a "Weak upgrade" chip. Not-better picks are not shown.
8. **The deck is built toward Apex.** The best card found for a slot is that slot's Apex card whatever it costs. No upgrade means the card is already Apex.
9. **No in-universe (Marvel/Spider-Man/TMNT) rule in the app.** That was the owner's personal preference; the Library and free swaps cover owned cards.
10. **Brackets are a label only**, never a cap.
11. **No AI layer yet.** Parked by the owner until the rule-based work is measured.
12. **Turtle Power's commander is Leonardo, the Balance** (Heroes in a Half Shell in the 99), to match ChatGPT's baseline.
13. The owner often uses voice. Keep replies plain, lead with the answer, and say clearly what was and wasn't tested.

## 3. What is live in Build 71

- Upgrade picks start from the cards most played with the commander (EDHREC), plus best-fitting cards with no play data; each swap is scored for the deck and only shown if it clears a minimum.
- Tiers as ceilings, stacked 10%/20% steps, weak-upgrade chip, "Apex card for this slot" when nothing higher exists; Apply all uses the best full pick per slot.
- Package check: a tier's swaps applied together; ramp, draw, removal, wipes and average mana value recounted; marginal swaps dropped; shown per tier.
- Tier and price recorded when a pick is first shown; held picks keep their slot; pop-up when a pick's price jumps 50% past its tier line or a deck card stops being legal.
- Regenerate picks (with summary and undo); creature-type and keyword filters (preferred or rule); basic lands grouped in one box; Library, free swaps, buy list, swap history, printing picker, export/import, two commanders, generate-from-cards build plan.
- Commanders with fewer than 60 cards of play data fall back to the older engine. A unified method was tried and tested worse.

## 4. Where the unshipped work is

Branch **`candidate-engine`** (pushed; does not affect the live site):

- `engine.js` there = candidate engine: **rewritten card tagging** (ready, measured) plus job-saturation / job-deficit / cut-pool rules that are present but **switched off** in the `SMART` settings because they tested worse.
- `tools/bench/` = everything needed to measure: the Node harness (`h.js`), verified retail lists and workbook picks (`workbook_pre.json`), ChatGPT's frozen picks (`frozen.json`), the adjudicated core (`core.json`), scoring scripts, the Build 71 engine for comparison, the official lists as read, and Playwright smoke tests. See `tools/bench/README.md`.

Branch **`card-data`** = test data published by the GitHub Action "Card data snapshot" (`.github/workflows/card-data.yml`, `tools/fetch-card-data.mjs`, `tools/commanders.txt`): Scryfall cards, EDHREC pages for listed commanders, alternate card names (`alt.json`), and Scryfall function tags (`truth.json`). The Scryfall card pull has been failing with rate-limit errors for days; the job keeps the previous card snapshot (prices from 4–5 October). EDHREC, alt names and tags refresh fine.

**Sandbox limits seen last session:** the shell cannot reach Scryfall or EDHREC; GitHub works; web fetch works for many public pages but needs the URL to have appeared in the conversation or a search result. Nothing has ever been tested in a real browser against live Scryfall/EDHREC.

## 5. The benchmark

Five retail precons: Avengers Assemble (Captain America, Team Leader), Doom Prevails (Doctor Doom, King of Latveria), Tramplesaurus Rex (Ghalta, Primal Hunger), Turtle Power (Leonardo, the Balance), Wakanda Forever (T'Challa, the Black Panther).

All five lists are now verified against published decklists. Doom Prevails had three wrong cards and Wakanda Forever one; both are fixed in `workbook_pre.json`.

**History of results (sheet = owner's ChatGPT workbook, 136 legal picks):** Build 65 found 27; Build 67 found 46; Builds 68–71 find about 30 with about 82 suggestions, because the "must be an upgrade" rule leaves Mid/Apex empty when the best card for a slot is cheap.

**ChatGPT round 1 (frozen list vs Build 71):** ChatGPT froze 37 slots before seeing Build 71's 52. It adjudicated a 31-swap "core". By Claude's count 25 of those were exact Build 71 pairs and 9 were ChatGPT's. Build 71 was judged clearly better on Avengers and Doom, badly over-upgrading on Tramplesaurus (24 slots, core is 6), both overreaching on Wakanda, split on Turtle Power.

**That core is partly invalid.** Three of the eight Doom swaps relied on Claude's wrong list (two recommend cards already in the retail deck). ChatGPT has been sent `Handoff_Benchmark_Round2.md` and `DeckCompanion_Build71_Five_Precons_v4.txt` and asked to re-judge Doom and Wakanda. **Its reply is the next input.** Until then the usable core is 28 swaps.

## 6. What is known to be wrong with the engine

1. **Slot assignment is unstable.** The right cards are found, but which card each replaces reshuffles with small scoring or data changes. Exact OUT→IN pairs are the wrong measure; score the set of cards leaving and the set coming in.
2. **Over-upgrading and ramp bias.** Tramplesaurus retail has 13 ramp (target 10) and Build 71 adds more. The package check stops a job falling below its floor but does not cap a job that is already full.
3. **Cuts chosen by pair score, not by what the deck loses.** Removal and draw get traded for ramp.
4. **New versus unplayed.** A card with no commander play data is valued near zero, so new precon cards get cut. Protecting all no-data cards also protects cards that should be cut (Commander's Sphere, Paradise Druid). Needs each card's first release date, which the card download does not store.
5. **No-data commanders** still use the older, weaker engine.
6. **Tagging gaps (Build 71).** Fixed on the candidate branch, see below.

## 7. Agreed order of work

1. Verify retail lists — **done**.
2. Tighten card tagging — **done on `candidate-engine`, not shipped.** Against Scryfall's function tags: removal found 52% → 70%, wipes 50% → 71%, tutors 22% → 48%, counterspells 84% → 89% (98% correct), protection correct 55% → 79%. With the new tags alone, Tramplesaurus removal is counted as 7 (was 4) and the engine stops cutting Monstrous Onslaught, Bite Down and Ezuri's Predation.
3. **Next: score the deck, not the pairs.** Measure sets of cuts and adds against the re-judged core. Then revisit saturation and deficit rules with the better tags.
4. Low-risk items: import by alternate printed name (the app does not recognise names like "Vibranium Dynamo"; `alt.json` has 576), and the starter deck's label "Example: Lathril elves (generated)".
5. Card first-release dates, on its own, because it changes the card download for every user.

Not built and not scheduled: showing separate failure reasons, "new cards since your picks" notice, deck generation on the full new method, the AI judgment layer.

## 8. How to work in the repo

- Bump together for any app build: `window.BUILD` and `?v=N` in `index.html`, the footer "Build N.", and `version.json`.
- Commit trailer used so far: `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.
- Pushing changes under `tools/` on `main` triggers the data job; that is safe and is not an app build.
- To ship the tagging: copy only the tagging changes (`ROLE_RE` and the role lines in `tags()`) from `candidate-engine` onto `main`'s `engine.js`. Do not copy the reworked slot-assignment loop without re-testing; with its settings off it behaves close to, but not identically to, Build 71.

## 9. Mistakes made last session, so they are not repeated

- Tested on the owner's post-upgrade decks instead of retail lists.
- Missed alternate printed names and called real cards unknown.
- Matched short names to the wrong card versions (Wakanda, Doom).
- Reported a commander's play-data size from the wrong field ("65 decks" for T'Challa; it is about 4,350).
- Twice told the owner ChatGPT had made an error when it had not.
- Shipped a change (price-band tiers) the owner had not asked for.

Check inputs against a published source before trusting a result, and say what is unverified.

## 10. First thing to do in the new chat

Ask the owner for ChatGPT's reply to the Round 2 handoff. If it has arrived, update `core.json` with the re-judged Doom and Wakanda results, then start step 3. If not, step 4's two low-risk items can proceed without it. Nothing ships until the owner approves.

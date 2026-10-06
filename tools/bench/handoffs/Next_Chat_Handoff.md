# Deck Companion — handoff for the next Claude chat

Written 6 October 2026, evening. Attach this at the start of a new conversation. It replaces the earlier handoff (Build 71).

## 1. What this is

Deck Companion is a free, static Magic: The Gathering deck-builder web app. No server, no build step, no AI at runtime.

- **Live:** https://maxfhurt.github.io/Deck-Companion/ — currently **Build 73**
- **Repo:** MaxFHurt/Deck-Companion (GitHub Pages serves branch `main`)
- **Files:** `index.html`, `ui.js`, `engine.js`, `data.js`, `lists.js`, `version.json`, `manifest.json`, icons
- **Data at runtime:** Scryfall (cards, cheapest-printing prices) and EDHREC commander pages, fetched by the browser

The owner is new to Magic and is building the app so its upgrade recommendations can be trusted without an expert.

## 2. Rules the owner has set (follow these)

1. **Nothing goes live without the owner's say-so.** Build and test on a branch, report, then wait. A "publish it" covers that build only.
2. **Changes go in one at a time, each measured before the next.**
3. **Don't add things that weren't asked for.** Propose first.
4. **Benchmark from the retail precon lists only**, never the owner's edited decks.
5. **Matching ChatGPT is not the goal.** Every recommendation must be defensible. ChatGPT's lists are evidence, not truth.
6. **Tiers are ceilings:** Budget under $3, Mid under $12, Apex any price.
7. **An upgrade must be an upgrade.** Mid is a full step at +10% over Budget; Apex at +10% over Mid and +20% over Budget. Better-but-short picks show a "Weak upgrade" chip.
8. **The deck is built toward Apex.** The best card found for a slot is that slot's Apex card whatever it costs.
9. **No in-universe (Marvel/Spider-Man/TMNT) rule in the app.**
10. **Brackets are a label only**, never a cap.
11. **No AI layer yet.**
12. **Turtle Power's commander is Leonardo, the Balance.**
13. The owner often uses voice. Keep replies plain, lead with the answer, say what was and wasn't tested.
14. **Explain every term the first time it is used.** The owner objected to "slots" and "saturation" being used without explanation. Say "cards the app suggests replacing", not "slots".

## 3. What is live

- **Build 72:** rewritten card tagging (removal, wipes, tutors, counterspells, protection).
- **Build 73:** import recognises 561 alternate printed names via `ALT_NAMES` in `lists.js` and `altName()` in `engine.js` (used in `parseDeckText`); example deck renamed "Example deck: Lathril Elves (auto-built)". Recommendations are identical to Build 72 on the benchmark.
- Known limits of Build 73: decks imported earlier that hold an unrecognised alternate name are not fixed automatically (export and re-import fixes them); the name list is a 6 October snapshot; the new label wording was Claude's choice and the owner has not commented on it.

## 4. Unshipped work

- **`candidate-engine`**: candidate engine. Its pick loop re-counts the deck's roles after every pick. Settings in `SMART`, all off: `sat` (saturation: adding to a role already over target costs more), `def` (deficit: giving up a short role costs more), `trim`, `unk` (protect cards with no play data), `poolN` (only the N weakest cards may be cut). Also `tools/bench/` with all measuring tools.
- **`experiment/package-utility`**: ChatGPT's package-utility idea behind `SMART.pkg` (off by default). Tested, did not help.
- **`card-data`**: daily snapshot. The Scryfall card pull was failing with rate limits; the job keeps the previous snapshot.

## 5. Benchmark

Five retail precons, all verified: Avengers Assemble, Doom Prevails, Tramplesaurus Rex, Turtle Power, Wakanda Forever.

The answer key ("core") is ChatGPT's 31 adjudicated swaps; **28 are valid** (three Doom swaps rested on a wrong list). Scoring is now by sets: which cards leave and which come in (`tools/bench/setbench.js`, `sweep.js`).

Run: clone `card-data` into `tools/bench/data`, then `WEB=<app folder> node setbench.js '{sat:2}'`.

| | Build 72/73 | Package-utility experiment | Saturation (`sat:2`) | `sat:2, poolN:20` |
|---|---|---|---|---|
| Core cuts found (of 28) | 25 | 27 | 26 | 26 |
| Core adds in the final deck | 15 | 15 | 18 | 18 |
| Cuts not in the core | 25 | 26 | 27 | 25 |
| Final adds not in the core | 34 | 38 | 34 | 32 |
| Cards replaced, all five decks | 50 | 53 | 53 | 51 |
| Tramplesaurus cards replaced (core 6) | 21 | 21 | 21 | 19 |
| Tramplesaurus ramp, final (retail 13) | 15 | 13 | 11 | 11 |

`def`, `trim` and `unk` did not help. `poolN:12` cuts Tramplesaurus to 12 but loses core cuts.

## 6. What is known to be wrong with the engine

1. **Over-upgrading.** Nearly every proposed swap scores as a real value gain, so the app replaces about 20 Tramplesaurus cards against a core of 6. A remove-only package check cannot fix this.
2. **Slot assignment is unstable.** Which card each pick replaces reshuffles with small changes. Score sets, not pairs.
3. **Ramp bias** in Build 72/73 (Tramplesaurus 13 → 15, Doom 12 → 14). Saturation fixes it but adds four doubtful Doom cuts.
4. **New versus unplayed.** Needs each card's first release date, which the card download does not store.
5. **Commanders with little play data** still use the older engine.

## 7. Next steps

1. **Waiting on ChatGPT's reply to `Handoff_Benchmark_Round3.md`**: re-judge Doom and Wakanda; say which Tramplesaurus cuts are defensible beyond its 6; choose the next experiment.
2. Candidate next experiments (one at a time): let the package step swap a pick for a different candidate; or require a bigger gain as more cards are already being replaced.
3. Card first-release dates, on its own, because it changes the card download for every user.

## 8. How to work in the repo

- For any app build, bump together: `window.BUILD` and the four `?v=N` in `index.html`, the footer "Build N.", and `version.json`.
- Commit trailer: `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.
- A new chat needs push access to the repo granted before it can push; reading works without it.
- The shell cannot reach Scryfall, EDHREC or the live site; web fetch can read the live `version.json`.
- Browser tests: Playwright with Chromium at `/opt/pw-browsers/chromium`, app served locally, card snapshot loaded with `useFull()`.

## 9. Mistakes so far, so they are not repeated

- Tested on the owner's post-upgrade decks instead of retail lists.
- Missed alternate printed names and called real cards unknown.
- Matched short names to the wrong card versions.
- Reported a commander's play-data size from the wrong field.
- Twice told the owner ChatGPT had made an error when it had not.
- Shipped a change the owner had not asked for.
- Used internal engine terms with the owner without explaining them.

## 10. First thing to do in the new chat

Ask the owner for ChatGPT's reply to the Round 3 handoff. Nothing ships until the owner approves.

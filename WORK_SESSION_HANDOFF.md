# Work session handoff

Read this first in a new Claude Code session. It replaces digging through old chats.
Last updated: 17 October 2026, Build 136 live.

## 1. What this is

**Deck Companion** is a Magic: The Gathering deck builder for Commander and Standard.
- **Live:** https://maxfhurt.github.io/Deck-Companion/ (GitHub Pages, served from `main`).
- **Repository:** `MaxFHurt/Deck-Companion`.
- **App files:** `index.html` (CSS, boot and build number), `ui.js` (screens and buttons), `engine.js` (all deck logic: scoring, upgrades, generation, evaluator), `data.js` and `lists.js` (static data), and `version.json`.
- **No build step and no runtime AI.** It's plain browser JavaScript.
- **Card data:** Scryfall, downloaded in the browser.
- **Play data:** EDHREC pages, fetched live.
- **Combos:** Commander Spellbook, from the `card-data` branch.

**Other files:**
- `ROADMAP.md`: the queue, the owner's decisions, standing rules and the Done list.
- `CHAT_TO_WORK_HANDOFF.md`: the message board with the planning chat.
- `tools/tests/suite/`: every test and benchmark script, plus `setup.sh`.

## 2. The owner and how to work with them

- **Replies:** plain English, short. Number questions whenever there are several. Every long reply ends with a **Summary** (✅ done / ⏳ needs the owner). Every question asked in a reply is repeated, reworded, as ❓ lines at the end of the summary. The owner multitasks and often reads only the summary.
- **Builds:** one feature per build. For each one, build it, run the full test suite, check for regressions, and go live only if everything passes. The owner has given standing permission to push bug-free builds live one at a time. Save work in progress often by pushing to the working branch, but never merge a half-built feature.
- **Usage:** the owner is often low on usage. Stay concise, don't re-explain, and when asked to just talk, don't build.
- **Standing rules:** these are in `ROADMAP.md` under "Standing rules from the owner". Key ones:
  - Don't change the upgrades engine without discussing it first. Once the owner approves, benchmark before and after.
  - Brackets are a label, not a cap. Budget means under $3 and Mid under $12; Apex has no price limit.
  - Popular picks lead, and the deck score must confirm every suggestion (no swap may lower it). On-theme cards win when about equal.
  - Every remove, delete, swap, add, or button that changes many cards asks first (`CONFIRM` map in `ui.js`).
  - Extra lands may only come out for other cards when the deck is over its land target, and never more than the surplus.
  - The MTG Commander Deck Manager spreadsheet must never supply benchmark inputs.
  - Phone layout changes must never affect the iPad.

## 3. How to ship a build (exact steps)

1. **Set up the test layout:** `sh tools/tests/suite/setup.sh /tmp/dc` builds `/tmp/dc/proto/{candidate,tests,snapshot,data2,...}` from this repo and the `test-data` branch. Edit the app in `proto/candidate`, then copy it back to the repo root when shipping.
2. **Bump the build number in three places:**
   - `index.html`: `window.BUILD = N;` and every `?v=N` on the script tags. The footer's `build-no` is filled from `window.BUILD` at boot.
   - `version.json`: `{"build": N}`. The live page reloads itself when this is newer.
3. **Test from `proto/tests`** (commands in `tools/tests/suite/README.md`):
   - **UI suite:** start the server with `(cd ../candidate && setsid nohup python3 -m http.server 8765 >/dev/null 2>&1 &)`. It sometimes dies; if a run prints nothing, restart it. Then run `PW=/opt/node22/lib/node_modules/playwright node ui-test.mjs 8765 bN`. It must pass every test (94 at Build 136). The test setup switches Upgrades to List view (`S.upView = 'list'`); Sheets is the app's default.
   - **Engine checks:** `node accept.js` (39 passed), `node claims.js ../candidate every` (FALSE 0), `node semantics.js ../candidate` (44 passed) and `node edge.js ../candidate` (no THROW).
   - **Engine changes also need the benchmark,** run in the background: `TIER=apex SCORECHECK=1 node bench.js ../candidate bN tuneall|test|holdout --quiet`. Current agreement@5 is tuneall 0.238, test 0.303, holdout 0.292 (Build 130), row@5 0.240 / 0.303 / 0.292. The owner's rule: no regression, ever; each build must gain.
   - **Deck-score changes also need the tournament comparison:** `node tourney.js ../candidate` (Build 118: match 57%, core 55%, raise 43/80, mid 50%). Its data is frozen in `tourney-data.json.gz`.
   - **Add one new UI test per build** in `ui-test.mjs`, inserted after the previous build's test.
4. **Ship:**
   1. `git fetch origin main && git checkout -B claude/deck-companion-upgrade-compare-46c7aa origin/main`
   2. Copy `engine.js ui.js index.html version.json` and `tools/tests/suite/ui-test.mjs`.
   3. Update `ROADMAP.md`: set "Live: Build N" and add a Done line.
   4. Commit, ending the message with the session's attribution lines.
   5. `git push -f -u origin <branch>`.
   6. Create the PR with the GitHub MCP tool `create_pull_request`, ending the body with "🤖 Generated with [Claude Code](https://claude.com/claude-code)".
   7. Merge it with `merge_pull_request`, `merge_method: rebase` and the full `expectedHeadSha`.
   8. Poll `https://maxfhurt.github.io/Deck-Companion/version.json` until it shows N.
5. **Gotchas:**
   - A `// comment` added at the end of a one-line function comments out the rest of that line. Always run `node -e "new Function(require('fs').readFileSync('ui.js','utf8'))"` after edits.
   - The tests use switches: `S.syncRecs` (run the score check synchronously), `S.autoYes` (auto-confirm swap-type actions in older tests), `S.noAsk` and `recsReady(d)`.
   - Screenshots: `dbg-ipad.mjs` (`PHONE=1` for a 390×844 portrait phone, `PORTRAIT=1` for an 820×1180 iPad, nothing for a 1366×1024 iPad) and `dbg-land.mjs` (`LAND=1` for an 844×390 sideways phone). Run them with `shot-home.js` or `shot-deck.js` and `OUT=<png>`.
   - The test container has no internet, so card pictures are blank and a "Scryfall dropped" banner shows. That's normal.

## 4. Engine map (where things live)

- **Upgrade list:**
  - `upgradePaths(d)` picks the rows. `scoreCheck(d, R, o)` then confirms every swap with `swapScore`, and does the ranking, alternatives (`L.alts`, Unpopular pick), the Highest score card (`L.top`) and the spare-land rows (`L.spare`, `UP.spare`).
  - Settings live in the `UP` object at the top of the scoring section: `rankPick:0` (popular picks lead), `gcN/gcB` (Game Changer rows, trimmed to Bracket 3 room in Build 115), `lf` (land formula in the generator) and `spare`.
- **Deck score:** `evaluateDeck(d, {games, apex, sim})` has 5 parts: synergy, balance, quality, routes and mana (practice games).
  - `swapScore` reuses the stored practice games, so for land changes use fresh games: `freshDelta` in ui.js, or the `landScore` closures.
- **Land target:**
  - `landTarget(A, d)` = 31.5 + 1.6×average MV − 0.32×cheap ramp + 0.72×landfall, from 30 to 42, applied in `analyze` for full decks. It was fitted by `tools/tests/suite/landfit.js`.
  - `spareLands(d)` lists the lands that can come out.
- **Fix menus (Show buttons):** `fixSwaps(d, kind, o)` in the engine and `fixList` / `openFix` in ui.js. They handle Mana (colour swaps plus adding lands only when under target), Lands (over target means spare lands for jobs), and ramp, draw, removal and wipes (spare lands allowed).
- **Generator:** `buildPlan(d, seeds, ownOnly, ownAll)`. Its mana base v2 sets the land count from `landTarget`.
- **Fit tip:** `evalFit(d, c)`. Plans are weighted 2 / 1.75 / 1.5, plus 1.25 per extra plan a card hits.
- **Main UI functions:** `viewHome`, `viewDecks`, `upPanel`, `wantHtml` (card window weighed against every cut), `openJobs` (Best by job), `openLands` (Lands helper), `openShare`/`checkShareLink`, `openDycb` (Decks you can build), `libStatsHtml`, `phHtml` (price history) and `continueHtml` (phones only).

## 5. Where things stand

- **Live:** Build 136 (visible practice games on the Build stats tab). **Build 135:** (fewer swaps where players keep the precon; jobless and weak slots get better alternatives). **Build 134:** (Unpopular pick chip only for a big gap; guide spot-check tools). **Build 133:** (customised Build panel folds to one-line headers and fits; upgrade list keeps its order). **Build 132:** (upgrade paths as folder tabs). **Build 131:** (Upgrades layout: one row of filter drop-downs, EDHREC chip in the stats module, colour-coded Budget/Mid/Apex marks with scores). **Build 130:** (deck score stage 2; Apex = best credible card, popular card kept as Most played; buy-list printings).
- **Before:** Build 129. The full history is the "Done" list in `ROADMAP.md`. Backup of Build 118: branch `backup/build-118`.
- **Builds 119-129 (17 Oct)** worked through the owner's Oct 17 master handoff: printed names, score/tip agreement, scroll sizing, source-aware mana check, deck power, Buy list page, Flip, Build stats tab, upgrade sheets, compact Build panel, Apex strongest. Owner's rules from that session: batch builds, quick bug checks per build, full test before each live push, no need to confirm each push; decks scoring below Budget are fine, Mid outscoring Apex is a bug.
- **Still open from that handoff:** the custom Build panel now fits (Build 133); the scroll lock after reload is fixed (owner confirmed on iPad, 17 Oct); the independent expert benchmark and Tramplesaurus cut accuracy (section 14); Buy list printing (done in 130); Apex as the outright highest-scoring card was measured and rejected (agreement 0.018).
- **Done in Build 118:** smarter deck score, stage 1 (tournament staples for Apex): `TOURNEY` lists and `tourneyOf` in engine.js, `UP.ts/tsk/tl/tr`. Still missed: tutors and win cards (Demonic Consultation, Tainted Pact, Thassa's Oracle), and Lumra/Vivi gain least.
- **Next:** not yet chosen by the owner (options: stage 2 of the deck score, the open decisions below).
- **Waiting on the owner:**
  - whether alternatives should be matched to the card going out rather than the pick (the remaining guide blind spots);
  - real-device check (phone and iPad screenshots).
- **No fourth tier:** the owner ruled that Apex is the best version of a deck; the "Tournament build" idea is dropped. Closing the tournament gap is Apex work.
- **Tried and rejected after Build 133 (see ROADMAP):** deck score stage 3 (test 0.303 -> 0.298) and closer plan weighting (test 0.303 -> 0.281 / 0.298). Engine unchanged.
- **Benchmark baseline (Build 135, SCORECHECK=1):** agreement@5 tuneall 0.238, test 0.303, holdout 0.292 (row@5 0.240 / 0.303 / 0.292; @10 0.124 / 0.198 / 0.205); with `WEIGHT=3,6` 0.268 / 0.322 / 0.318. Both must not drop. Note: without `SCORECHECK=1` the bench skips the Apex pick rule and reads 0.249 with gain 0 — wrong baseline.
- **Roadmap:** every buildable item is done. Left: the real-device check (needs the owner's phone and iPad) and the open question on matching alternatives to the card going out.
- **Known limits:**
  - Decks over their land target take a few seconds more to check upgrades.
  - The card window takes about half a second to open.
  - Price history starts at Build 110 and grows as card data refreshes.

## 6. Prompt for a new Claude Code session

> You're continuing work on Deck Companion (repo MaxFHurt/Deck-Companion, live at maxfhurt.github.io/Deck-Companion). Read `WORK_SESSION_HANDOFF.md`, then `ROADMAP.md` and `CHAT_TO_WORK_HANDOFF.md`, in the repo. Follow the owner's rules there exactly: plain English, a short summary at the end of every reply with questions repeated, one feature per build, the full test suite before going live, and no upgrades-engine change without the owner's approval and a benchmark. Set up the tests with `sh tools/tests/suite/setup.sh /tmp/dc`. Live is Build 118; ask the owner what's next. Confirm you've read the handoff, then ask me what to do first.

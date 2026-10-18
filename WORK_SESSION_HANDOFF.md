# Work session handoff

Read this first in a new Claude Code session. It replaces digging through old chats.
Last updated: 18 October 2026, Build 139 live.

## 0. Open questions for the owner (ask these first, numbered)

1. **Synergy ceiling.** 10 of 26 benchmark precons (and the owner's Symbiote Spider-Man deck) sit at the synergy part's
   maximum, so a better-fitting card can't raise the score (The Soul Stone and Aetherize both scored 0.00). The fix
   (`UP.unc` 0.25: compare swaps past the maximum, shown score unchanged) helps most sets but dips the tuning set:
   agreement@5 0.238 → 0.236, @10 0.124 → 0.120. Accept the dip as an exception, or keep searching for a version with
   no dip?
2. **Commander engine reasons.** Build 139 shows why a card fits the commander ("Doubles the tokens your commander
   makes", "Uses the cards your commander puts in your graveyard"). Does it read the owner's commanders correctly? Misreads
   reported here are what will let it count in the score.
3. **Over-budget warning.** Should the card window say clearly "Over your Budget limit ($3)" / "Over your Mid limit
   ($12)" when the open card is too expensive for the deck's tier? (The Soul Stone, $80, was offered in a Budget deck
   with only an "Apex only" price note.)
4. **Next engine fixes (owner said yes to the plan, then the keyword work came first).** Go ahead with:
   - reading cards like The Soul Stone properly (Harness/∞ recursion engines as recursion and a way to win);
   - capping ramp in generated decks at about target + 2, so tournament fast mana (Lotus Petal, Chrome Mox, Cabal
     Ritual) doesn't push out on-theme cards a quarter of the commander's players run (Soul Stone 31%, Living Death 35%);
   - then the whole-pool search (below)?
5. **Highest score in the background.** The whole-pool search would keep updating the "Highest score" cards for a few
   minutes on a phone after the list appears. Is that OK?
6. **Mana fix speed.** Fix: Mana now plays fresh practice games for every land swap it weighs: about 3 s on a desktop,
   maybe 6–8 s on an iPad (the window opens at once with "Checking land swaps…"). Acceptable, or weigh fewer swaps?
7. **Alternatives matched to the card going out?** Remaining guide blind spots (Swords to Plowshares for Turtle Power,
   Brightglass Gearhulk for Wakanda) beat our pick only in a slot whose pick is a different kind of card, because
   alternatives must do the same job as the pick. Match them to the card going out instead? (Benchmark first.)
8. **Real-device check.** Screenshots from the owner's phone and iPad of anything that looks wrong: decks list,
   Upgrades (List and Sheets), Build stats with Practice games open, Buy list, Library.

## 1. What this is

**Deck Companion** is a Magic: The Gathering deck builder for Commander and Standard.
- **Live:** https://maxfhurt.github.io/Deck-Companion/ (GitHub Pages, served from `main`).
- **Repository:** `MaxFHurt/Deck-Companion`. Work branch this session: `claude/smarter-deck-score-stage-1-3q4oyx`.
- **App files:** `index.html` (CSS, boot and build number), `ui.js` (screens and buttons), `engine.js` (all deck logic:
  scoring, upgrades, generation, evaluator, practice games), `data.js` and `lists.js` (static data), `version.json`.
- **No build step and no runtime AI.** Plain browser JavaScript. Card data from Scryfall, play data from EDHREC (fetched
  live), combos from Commander Spellbook (`card-data` branch).

**Other files:**
- `ROADMAP.md`: the queue, the owner's decisions, standing rules, tried-and-rejected experiments with numbers.
- `CHAT_TO_WORK_HANDOFF.md`: the message board with the planning chat.
- `tools/rules/`: the Comprehensive Rules (2026-09-25), `keywords.json` (264 keyword actions/abilities with rules text,
  61 ability words, 741 glossary terms) and `MECHANICS_NOTES.md` (how to read a commander, tokens, triggers and
  doublers, counters, graveyard, combo patterns, rules that change deck building). The owner asked for this: the engine
  must understand Magic and each commander.
- `tools/tests/suite/`: every test and benchmark script, plus `setup.sh`.

## 2. The owner and how to work with them

- **Replies:** plain English, short. **Number questions** whenever there are several. Every long reply ends with a
  **Summary** (✅ done / ⏳ needs the owner) that repeats the questions, numbered. The owner often reads only the summary.
- **Builds:** batch builds are fine; no confirmation needed per live push, but every live build must be complete and
  tested (full UI suite, benchmark for engine changes). Do the work, then stop. Push builds periodically so a live
  build exists if usage runs out.
- **"Regression is not an option."** Every engine build must match or beat the last benchmark on every set
  (agreement@5, row@5, @10; unweighted and `WEIGHT=3,6`). If a change regresses, keep it switched off and report the
  numbers.
- **Standing rules** (also in `ROADMAP.md`):
  - Brackets are labels. Budget < $3, Mid < $12, Apex has no price limit. Apex is the best version of the deck; no tier
    above it. Mid outscoring Apex means the recommendations are wrong; decks scoring below Budget are fine.
  - Never lose popular-vote cards, but the best card should be the Apex card. The app's purpose is to find the best
    cards, not just what others play.
  - On-theme cards win when about equal. Every swap, add, remove or many-card change asks first.
  - Understand the commander: build around what it makes and what sets it off (e.g. a token maker wants cards that use
    or double that token).
  - A spell may be cut for a land when the deck is short of mana (owner, 18 Oct).
  - The MTG Commander Deck Manager spreadsheet never supplies benchmark inputs. Phone layout changes must not affect
    the iPad. Never overwrite the backup (`backup/build-118`). The practice-game simulation may change only with the
    owner's OK (given for Build 137's land-colour fix).

## 3. How to ship a build

1. **Test layout:** `sh tools/tests/suite/setup.sh /tmp/dc3`. Edit in `/tmp/dc3/proto/candidate`; tests run from
   `/tmp/dc3/proto/tests`. EDHREC pages for extra commanders can be fetched into `proto/data2/edhrec/<slug>.json` and
   themes into `proto/data2/themes/<slug>__<theme>.json` (`json.edhrec.com/pages/commanders/<slug>[/<theme>].json`).
2. **Bump the build** in `index.html` (`window.BUILD = N`) and `version.json` (`{"build": N}`).
3. **Test:**
   - UI suite: `(cd ../candidate && setsid nohup python3 -m http.server 8765 >/dev/null 2>&1 &)` then
     `PW=/opt/node22/lib/node_modules/playwright node ui-test.mjs 8765 bN`. Must pass every test (97 at Build 139). If it
     prints `ERR_CONNECTION_REFUSED`, restart the server (don't rely on `pgrep -f`, it can match its own shell).
   - Benchmark (engine changes), all six must not drop:
     `SCORECHECK=1 [WEIGHT=3,6] node bench.js ../candidate x tuneall|test|holdout --quiet`.
     **Always set `SCORECHECK=1`**, otherwise the Apex pick rule is skipped and the numbers are wrong.
   - Add one UI test per build, inserted before the iPad reload test near the end of `ui-test.mjs`.
4. **Ship:** copy `engine.js ui.js index.html version.json` and `tools/tests/suite/ui-test.mjs` (plus new tools) into the
   repo, update `ROADMAP.md` and this file, commit with the session's attribution lines, then
   `git push origin <work branch>` and `git push origin HEAD:main` (fast-forward). Poll
   `https://maxfhurt.github.io/Deck-Companion/version.json` until it shows N, then load the live page in Playwright and
   check `window.BUILD` and zero page errors.
5. **Gotchas:** a `// comment` at the end of a one-line function comments out the rest of the line (syntax-check with
   `node -e "new (require('vm').Script)(require('fs').readFileSync('engine.js','utf8'))"`). The remote was renamed to
   `Deck-Companion`; if git says "unpushed commits", refresh the tracking ref
   (`git config remote.origin.fetch '+refs/heads/*:refs/remotes/origin/*' && git fetch origin`).

## 4. Benchmark baseline (Build 139, SCORECHECK=1)

| Set | agreement@5 | row@5 | @10 | whole-list sum | weighted @5 / @10 / sum |
|---|---|---|---|---|---|
| tuneall | 0.238 | 0.240 | 0.124 | 9.01 | 0.268 / 0.151 / 13.68 |
| test | 0.303 | 0.303 | 0.198 | 6.84 | 0.322 / 0.217 / 7.73 |
| holdout | 0.292 | 0.292 | 0.205 | 15.00 | 0.318 / 0.241 / 18.55 |

Helper tools: `guidecheck.js` (9 published guides, check only), `unpopcount.js`, `rowfeat.js` (per-row evidence),
`fullsearch.js` (scores every legal same-job card per slot), `wcheck.js` (weighted yardstick validity).

## 5. Engine map (where things live)

- **Upgrade list:** `upgradePaths(d)` picks rows; `scoreCheck(d, R, o)` confirms every swap with `swapScore`, ranks,
  builds alternatives (`L.alts`, Unpopular pick only for a big gap: `UP.unpopX/G/S/R`), `L.top`, spare-land rows, and at
  the end leaves out swaps players mostly disagree with (`R.trimOf`, `UP.trim/trimPa/trimCi`, precon cards only).
  Settings: the `UP` object.
- **Deck score:** `evaluateDeck(d, {games, apex, sim})`: synergy, balance, quality, routes, mana. Returns `exact` and
  `cmp` (past-the-maximum compare value, used only when `UP.unc` > 0; `cmpOf(e)`). Synergy maxes at raw 0.72
  (`EV_SUFF`), balance at 1, quality at the Apex reference.
- **Practice games:** `simulate(d, games, seed)`; `practiceGames` is a step-by-step copy for the Practice panel (a test
  checks they agree). Lands: `fetchReach`/`simLandCols` (`UP.lfix`): fetch lands make only what they can find;
  "choose a colour" lands make their colour plus the needed one.
- **Mana fixes:** `fixList`/`openFixSoon` (ui.js). Lands use `landRank` (shared with the card window): lands that keep
  every colour (`landCovers`) plus, when `manaStarved` (out of lands by turn 5 in `UP.starve` 8%+ of games or under
  target), weak spells; measured with `freshDelta` (fresh practice games, remembered).
- **Rules knowledge:** `KW_THEMES`/`KW_RE` (keywords → themes, `UP.kw`), `commanderEngine(cmds)` (token kinds, creature
  tokens and type, counters, fills graveyard, sacrifices, triggers), `engineFit(c, E)` (doubler 1 / payoff 0.8 / enabler
  0.6, with a reason). Shown on cards via `baseScore` reasons; scoring weight `UP.kwB`/`UP.kwS` = 0 (didn't pass yet).
- **Experiments left switched off:** `UP.unc` (synergy ceiling), `UP.kwB`/`kwS` (engine fit in score), `UP.stN`
  (Commander-wide staples per slot), `UP.rs3`, `UP.aw/aiw/amb` (plan weighting). Numbers in `ROADMAP.md`.
- **Generator:** `buildPlan(d, seeds, ownOnly, ownAll)`.
- **UI:** `viewDecks`, `upPanel` (Upgrades + Build stats, `practiceHtml`), `wantHtml` (card window), `openFix`,
  `openShare`/`checkShareLink` (share links decode with base64url + raw deflate; `shareRead`).

## 6. Where things stand

- **Live: Build 139** (rules knowledge base; keyword-aware themes; the commander's engine read and shown on cards).
  138: Mana fix and card window agree; a spell may go for a land when short of mana. 137: fetch and "choose a colour"
  lands count colours correctly; a mana fix never drops a colour. 136: visible practice games. 135: fewer swaps where
  players keep the precon; better alternatives in jobless/weak slots. 134: Unpopular pick only for big gaps.
- **Whole-pool finding (18 Oct):** scoring every legal same-job card finds a higher-scoring card than the app measured in
  62 of 80 slots (mean gap 0.4), nearly all run by under 10% of players. Many "winners" are wrong (Kozilek in Avengers,
  Quilled Greatwurm in Turtles, Nissa, Vital Force in 5 of 8 Ghalta slots) because the score credits any big creature
  as a way to win and stacks multi-job credit. Agreed plan: fix those score blind spots, then a background whole-pool
  search whose best find is always shown (Highest score / alternative); the Apex pick keeps score + popularity.
- **Owner's test deck:** Symbiote Spider-Man (generated), Budget tier, Marvel/Spider-Man sets only, themes reanimator,
  self-mill, graveyard. Share link in the chat of 18 Oct; decoded copy used for tests (synergy 30/30, balance 25/25,
  quality 20/20: at every ceiling).
- **Known limits:** Fix: Mana takes ~3 s on desktop; decks over their land target take a few seconds more for upgrades.

## 7. Prompt for a new Claude Code session

> You're continuing work on Deck Companion (repo MaxFHurt/Deck-Companion, live at maxfhurt.github.io/Deck-Companion).
> Read `WORK_SESSION_HANDOFF.md` (start with section 0, the open questions), then `ROADMAP.md`, `tools/rules/MECHANICS_NOTES.md`
> and `CHAT_TO_WORK_HANDOFF.md`. Follow the owner's rules exactly: plain English, numbered questions, a Summary at the end of
> every reply, complete and tested builds, and no engine change that regresses any benchmark number. Set up tests with
> `sh tools/tests/suite/setup.sh /tmp/dc3`. Live is Build 139. Ask the owner the open questions in section 0 first.

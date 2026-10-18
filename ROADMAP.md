# Deck Companion roadmap

Live: Build 140 (Build 141 built and tested, waiting for the owner's OK to push). Each item ships as its own build: build, run the full test suite
(`tools/tests/suite/README.md`), then go live only if nothing fails.

## Queue (smallest first)

Proposed order (12 October 2026): small items first, quickest first within each size.
Items marked "discuss first" need the owner's decision before they are built; the real-device check needs the owner's phone and iPad.

### Small

2. **Real-device check**
   - *You'll see:* nothing new: confirmation that card pictures, symbols and layout look right on a real phone and iPad.
   - *Builds on:* all screens.
   - *Size:* Small. *Upgrades engine:* no.
   - *Risks:* the test environment blocks the image server, so this needs the owner's phone and iPad or a test run with images allowed.
   - *Tested by:* screenshots on real devices of every main screen.


### Large

3. **Smarter deck score**
   - *You'll see:* better suggestions in every list, and fewer odd "Unpopular pick" chips.
   - *Builds on:* the deck score (synergy, balance, card quality, ways to win, practice games).
   - *Size:* Large. *Upgrades engine:* yes, discuss first.
   - *Risks:* any change moves every suggestion; it must be measured against real players (upgrade benchmark) and against top tournament decks (see findings below) before and after.
   - *Tested by:* the upgrade benchmark (must not drop), the tournament comparison below (should rise), and all suite checks.
   - *Findings, top tournament decks (October 2026):* 10 popular tournament commanders, our Apex "Best
     overall" deck compared with 20 top-16 tournament lists each (EDHTop16, events of 48+ players, last year).
     - About **half** our cards match the tournament lists (51% on average; best Tivit 69%, Thrasios/Tymna
       67%, Sisay 63%; worst Vivi 36%, K'rrik 37%, Yuriko 38%). We include 59% of the cards most lists share.
     - What we miss most: **lands** (fetch lands, original duals, Ancient Tomb, Urza's Saga, Cavern of Souls,
       Gemstone Caverns), **fast mana** (Mox Diamond, Chrome Mox, Mox Opal, Lotus Petal, rituals), **free
       interaction** (Force of Will, Mindbreak Trap, Pact of Negation) and **tutors and win cards** (Demonic
       Consultation, Tainted Pact, Thassa's Oracle).
     - What we include that they never play: protection equipment (Swiftfoot Boots, Lightning Greaves),
       slow mana rocks (Thought Vessel, Commander's Sphere, Mind Stone), board wipes and big creatures.
     - Why: two thirds of the cards we miss are played by under 30% of EDHREC decks for that commander, so
       popular picks don't lead to them; and the deck score doesn't favour them either (adding them in place
       of our weakest card raised our score only 17 times in 80).
     - Mid decks fall further behind (Winota 57% to 45%, Lumra 44% to 29%, Yuriko 38% to 32%), because many
       tournament staples cost far more than $12.
     - Note: tournament decks are the strongest level of play (Bracket 5). The owner ruled (17 Oct) that there is no
       tier above Apex: Apex is the best version of the deck, so closing this gap is Apex work.

## Decided by the owner (12 October 2026), to build in this order

1. ~~Our own land formula~~: done in Build 114.
2. ~~Game Changer rows: trim~~: done in Build 115.
3. ~~Phone layout~~: done in Build 116.
4. ~~Smarter deck score, stage 1~~: done in Build 118 (tournament comparison: match 49% to 57%, core 45% to 55%; benchmark unchanged).

## Done from the parked list

- ~~Visible practice games~~: done in Build 136 (owner: "finish the road map"). Build stats tab → Practice games:
  a 100-game summary (short of lands on turn 5, stuck on a colour, flooded, mulligan, commander turn), then one game's
  opening hand, mulligan and first 8 turns (draw, land, spells cast, mana used of available), with Deal another game /
  Previous. It uses `practiceGames`, a step-by-step copy of `simulate`; `simulate` is unchanged and a test checks the
  two agree game for game.

## Builds 137-139

- Owner's iPad report: Fix Mana offered Thriving Isle -> Wooded Foothills (+0.3) in the five-colour Turtle deck. Three bugs:
  in the practice games every fetch land made all the deck's colours (Wooded Foothills can only find Mountains and Forests);
  "choose a colour" lands counted as one colour (Thriving) or none (Big Apple, 3 a.m.); and the mana fix list never checked
  that the new land makes the colours the old one made. Fixed (UP.lfix): fetch lands make what they can find in this deck,
  chosen-colour lands make their colour plus the one the hand needs, and a mana fix must keep every colour (landCovers).
  Spell benchmark unchanged; of the benchmark precons only Turtle Power's practice games change (stuck on a colour 18% -> 16%).
- Build 138 (owner: the Mana fix offered a swap, but the card's window said its best swap was a different card): the card window
  measured a land swap with the old practice games (so the mana change was never measured) and weighed its own set of cuts.
  Now one method (landRank) serves both: lands that keep every colour (6 best by the quick guess) plus, when the deck runs short
  of lands (practice games out of lands by turn 5 in 8%+ of games, or under the land target), its 3 weakest spells; each measured
  with fresh practice games and remembered, so both show the same swap and the same number. The Mana fix opens at once and fills
  in when ready (about 3 s on a desktop).
- Full-pool measurement (`fullsearch.js`): scoring every legal same-job card finds a higher-scoring card than the app measured
  in 62 of 80 slots (mean gap 0.4), nearly all run by under 10% of players; many look wrong (Kozilek in Avengers, Quilled
  Greatwurm in Turtles, Nissa, Vital Force in 5 of 8 Ghalta slots) because the deck score credits any big creature as a way
  to win and stacks multi-job credit. Plan agreed with the owner: fix those score blind spots first, then a background full search
  whose best find is always shown (Highest score / alternative); the Apex pick keeps score + popularity.

- Build 139 (owner: "the engine must know every keyword and understand the commander"): `tools/rules/` holds the
  Comprehensive Rules (2026-09-25), `keywords.json` (all 264 keyword actions and abilities with their rules text, 61 ability
  words, 741 glossary terms) and `MECHANICS_NOTES.md` (how to read a commander; tokens; triggers and doublers; counters;
  graveyard; combo patterns; rules that change deck building). Engine: KW_THEMES maps theme-defining keywords to the app's
  themes (UP.kw, on: benchmark equal or better, tuneall sum 8.69 -> 9.01); commanderEngine reads what a commander makes (token
  kinds, creature tokens and their type, counters, cards into the graveyard), what sets it off and whether it sacrifices;
  engineFit judges a card as doubler / payoff / enabler and the reason is shown on the card. Using the fit in the score was
  benchmarked and does not pass yet (in the deck score: tuneall 0.238 -> 0.234; as a candidate bonus UP.kwB 0.5: @10 0.124 ->
  0.123, holdout sum 15.0 -> 14.5), so it stays a shown reason (UP.kwB 0, UP.kwS 0) until a version passes.
- Synergy ceiling (owner's Symbiote Spider-Man deck): 10 of 26 precons sit at the synergy part's maximum, where better-fitting
  cards cannot raise the score. Settled in Build 140 (owner: "find the best option; if this is it, so be it").

## Build 140 (18 October 2026)

Owner's answers to the open questions: 1 find the best ceiling version; 3 yes; 4 yes; 5 yes; 7 yes; 8 iPhone screenshots sent.
- **Synergy ceiling** (UP.unc 0.25, UP.uncTail 1): swaps are compared past the parts' maximum at a quarter of the rate, and a row
  whose gain shows only past the maximum goes after every row with a real gain on the shown score. Versions tried (benchmark,
  each alone): unc 0.1 / 0.25 / 0.5 / 1, uncPick, synergy part only, tail order, repairs on the shown score (uncR). The tail order
  removed the @5 dip (0.236 -> 0.238); unc 0.25 + tail was best: tuneall @10 0.124 -> 0.121, test sum 6.84 -> 6.69, holdout sum
  15.0 -> 15.75. Combined with the blind-spot fix below, every agreement number matches or beats Build 139; only test's whole-list
  sum stays lower (6.84 -> 6.69, weighted 7.73 -> 7.59), the exception the owner accepted.
- **Over-budget warning:** the card window says "Over your Budget limit ($3)" / "Over your Mid limit ($12)" once, at the top where
  the swap is offered (in the Price line when there is no swap box); never in an Apex deck. Price bands now use the owner's
  strict limits there too (Budget under $3, Mid under $12; it said "fits Budget" at exactly $3).
- **Reanimation engines** (UP.reF): The Soul Stone (once harnessed), Sheoldred, Whispering One and other every-turn reanimators,
  and mass reanimation (Living Death, Rise of the Dark Realms) count as recursion and a way to win. Benchmark equal or better
  (holdout sum 15.0 -> 15.05).
- **Score blind spots** (UP.bs, bsF 0.5, bsP 9; from the whole-pool measurement): a creature that is a finisher only for its size
  counts half of one that wins by what it does; a card costing 9 or more is not counted as protection (Kozilek's counter, Krang's
  indestructible); a planeswalker's ultimate (minus 5 or more) is not one of its jobs (Nissa, Vital Force is ramp, not card draw).
  Kozilek in Avengers: +0.89 -> +0.20 (Rhystic Study +0.34). Tuneall @5 0.238 -> 0.244, @10 0.124 -> 0.127; holdout sum 15.0 ->
  14.95. Versions tried: bsF 0.5 / 0.75, bsP 6 / 7 / 8 / 9 / off.
- **Alternatives matched to the card going out** (UP.altCut 2): a row's alternatives may do the pick's job or the job of the card
  coming out (Path to Exile for Palace Jailer); the pick itself is still chosen from cards doing the pick's job (letting the wider
  pool choose the pick cost test @5 0.303 -> 0.301). Guide check: guide cards offered 52 -> 55, popular guide cards missed 21 -> 16.
- **Ramp cap in generated decks** (UP.rcap 2): after the mana base, ramp over target + 2 gives way, weakest pure mana card first
  (not on theme, not a seed or owned), to the best spell that makes no mana. Generated decks: ramp over target 3.3 -> 1.7 on
  average; tournament comparison match 55% -> 55%, core 54% -> 53%, mid 50% -> 49%; strong-deck typicality 0.398 -> 0.396 (the
  owner asked for fewer fast-mana cards, which tournament lists run).
- **Whole-pool search** (UP.pool2, UP.poolN 250): after the list is checked, every legal card that does a row's job (up to 250
  per row, most-played first) is measured in the background, a few milliseconds at a time; Highest score updates in place and a
  note shows progress. It stops when the list changes. About 30 s on a desktop for a typical deck.
- **Speed:** comparing past the maximum measured every candidate twice (Build 139 code, switched off until now): the check took
  3.9 s instead of 2.6 s per deck. One evaluation now gives both numbers (swapScore2); benchmark identical, 2.5 s.
- **Tests:** UI-B81-03 now counts inline alternatives on every deck it visits, not only the last one (in the suite's altered
  Avengers deck the one row with alternatives, Hero's Blade -> Spectacular Spider-Man, no longer passes the score floor once a
  size-only finisher counts half; its other rows are spare lands, which have no alternatives).
- **iPhone (owner's screenshots):** upright phones scroll the page instead of a fixed-height deck box (with large text the box
  left the card list no room and buttons spilled past the frame); deck tabs take a second row instead of running off the panel;
  the card count stays on one line. iPad and desktop unchanged.

## Build 141 (18 October 2026; not pushed: the owner confirms every push from now on)

Owner: "Let them wait if that's what it takes... a loading style message with a small animation rather than shifting results";
"optimize every recommendation"; "a build by theme option in the deck builder"; tweak settings, no major system changes.
- **Thinking, not shifting:** Fix: Mana, a land's card window (now opens at once instead of freezing for a few seconds), the
  upgrade check and the card-quality line show a small spinner ("Thinking…") and fill in once, complete. Each row's Highest score
  says it is thinking until the whole-pool search is done, then every row fills at once (it used to update row by row).
- **Build by theme** (Generate window, "Or start from a theme"): pick one of the 16 themes (creature type: pick the type), and
  optionally colours; commanders are ranked by how much they build around it (their own text), how many strong cards for it
  exist in their colours, and how proven they are; More commanders shows 30 (less-known ones). Build loads the commander's
  play data, puts the theme first and the commander's matching EDHREC theme page next, at the chosen price level.
- **Obscure commanders** (little or no play data; UP.thP 0.3, thT 0.3, thS 1.5): generated with no play data at all, decks
  leaned on generic power (6.2 Game Changers, 6.6 tutors). Tournament-staple, Game Changer and tutor bonuses now count 0.3 and
  the most-played staples 1.5 when play data is thin. Against strong real decks: typicality 0.134 -> 0.176, core coverage 18% ->
  28%, deck score 81 -> 85. Tried: more weight on the detected mechanics (worse: 0.112), fewer staples (worse), power 0 (0.155).
  Decks with play data are unchanged (typicality 0.396, coverage 0.69).
- **One-colour mana bases** (rules): City of Brass, Mana Confluence, Exotic Orchard, Reflecting Pool, Forbidden Orchard and
  Command Tower are never better than a basic in a one-colour deck; they no longer go into generated mono-coloured decks or the
  Mana fix (Ghalta now gets Mosswort Bridge, Myriad Landscape, Gemstone Caverns instead). Two-colour and up unchanged.
- **Upgrades** (UP.rankN 12 -> 18: more of each slot's most-played candidates are measured): tuneall sum 9.12 -> 9.30 (weighted
  14.06 -> 14.19), every other number equal. Screened on tuneall (about 30 settings, each halved and raised by half): almost all
  flat. Game Changer / tutor bonus 1.5 -> 2.25 helped upgrades slightly (@10 0.126 -> 0.127) but made generated decks worse
  (typicality 0.396 -> 0.393), so it stays. Fewer trimmed rows (trimPa 0.2) raised the sum to 12.0 but lowered @10: rejected.
- **Card reading, tried and left off (UP.nmh 0):** "You have no maximum hand size" (Thought Vessel, Spellbook, Venser's
  Journal, Decanter of Endless Water) is read as card draw, which it is not; the correct reading lowers the test set (@10 0.199
  -> 0.197), so it stays off under the no-regression rule. A check of ramp, removal and board-wipe readings found no misreads.
- **Tests:** UI suite 103/103 (new: UI-B141-01 thinking not shifting, -02 Build by theme, -03 obscure commanders and one-colour
  lands). UI-B118-01 (Tivit with no play data loaded) now tests the stage-1 bonus with the obscure-commander multipliers at 1.
  New tools: `genstrong.js` takes NOEDH=1 (no play data), `landsof.js` (a generated deck's lands).
- **Benchmark (Build 141):** tuneall 0.244 / 0.245 / 0.126 / 9.30 (weighted 0.274 / 0.275 / 0.153 / 14.19); test 0.303 / 0.303
  / 0.199 / 6.69; holdout 0.292 / 0.292 / 0.205 / 15.74: equal to or better than Build 140 everywhere.

## Open decisions

- ~~EDHREC land count in the app~~: decided, our own land formula (see above). Found in Build 104's cleanup: the tests and
  benchmark set each commander's land target from EDHREC's average land count, but
  the app never reads it, so app targets can differ by a land (Wakanda: 37 in the
  app, 36 in tests). Hooking it up would change land targets, the Lands alert,
  spare lands and upgrades; needs the owner's go-ahead and a benchmark run.
- ~~Unpopular pick chip~~: decided (option B), done in Build 134. It shows only for a
  big gap: the alternative out-scores the pick by 0.2 and half again, and the pick is
  run by 3 times as many players (and 10% more of all decks). Alternatives carrying it:
  24% -> 9% over every benchmark precon. Its pop-up now gives both play rates.
- **Published-guides spot-check (17 Oct, Build 134 tools):** `node guidecheck.js ../candidate
  [--detail]` compares our rows with 9 written guides for the 5 test precons
  (`guides/guides.json`: Draftsim, EDHREC, Card Kingdom, Wargamer). A check only, never for
  tuning. Build 134: we offer 44% of the guides' adds somewhere (24% as the Apex pick); a
  guide also cuts 30 of our first 56 cuts. The guides' own swaps lower our deck score on
  average (-0.11; ours +0.57). Blind spots worth a look: Sheoldred, the Apocalypse and
  Yawgmoth for Doom (almost no Doom players run them, so never candidates), Swords to
  Plowshares for Turtle Power (18% of players add it, no removal slot), Brightglass Gearhulk
  for Wakanda.
- ~~Tramplesaurus cut accuracy~~: done in Build 135 (owner chose fix A, fewer swaps). Our cut order was
  right; we offered too many swaps. A swap is now left out when its card out is a precon card not among the
  10 players cut most and fewer than 15% of upgraders add its replacement (76 of 80 such swaps went against
  players). Ghalta: 26 swaps -> 17. The list says how many were left out. Benchmark: first 5 unchanged
  everywhere; @10 tuneall 0.119 -> 0.124, test 0.196 -> 0.198, holdout 0.199 -> 0.205; whole-list sums up
  on every set (tuneall -0.96 -> 8.69). `rowfeat.js` dumps the per-row evidence.
- **Guide blind spots (looked into 17 Oct, Build 135):**
  - Shipped: a slot whose pick does no core job may take a card that also does one (sjx), and a slot whose
    pick barely helps (under 0.2) may show off-theme cards as alternatives, never as its pick (weakD/weakA).
    Matches or beats every benchmark number.
  - Not closed: Sheoldred and Yawgmoth (Doom), Swords to Plowshares (Turtle Power), Brightglass Gearhulk
    (Wakanda). Each beats our pick only in a slot whose pick is a different kind of card (a creature slot
    for Swords; Sheoldred barely run by Doom players). Every version that showed them (a few top Commander
    staples measured per slot, stN; off-theme picks in weak slots) cost popular alternatives (row@5 0.240
    -> 0.239) or agreement (@10 0.124 -> 0.122), so they were rejected. Open question for the owner:
    should alternatives be matched to the card going out rather than to the pick?
- **Closer plan weighting: tried and rejected (17 Oct, after Build 133).** The
  fit tip's closer weights (2 / 1.75 / 1.5, plus a bonus per extra plan) were
  benchmarked in the engine. Main scorer 5/4.4/3.75: test 0.303 -> 0.281. Milder
  5/4/3.1: test 0.298. Extra-plan bonus +1: test 0.286 (+0.5: no change).
  Upgrade-theme weights alone: no change. Kept as is.
- **Deck score stage 3: tried and rejected (17 Oct).** Smoother protection,
  recursion and tutor credit, and part credit for a combo one card short: test
  0.303 -> 0.298 (weighted 0.322 -> 0.318). Code left in engine history, not shipped.
- **Strength-weighted yardstick (17 Oct):** `WEIGHT=3,6 node bench.js ...` counts
  bracket-3 decks 3x and bracket 4+ 6x. `wcheck.js` checked it: valid (overlap with
  strong-only decks 0.77 -> 0.82, same build ordering) but adds little. Used as a
  second must-not-drop check. Baseline: tuneall 0.268, test 0.322, holdout 0.318.
- **Deck-score ranking** (tried in Build 82, reverted in 83): ranking slots purely
  by the app's deck score cut agreement with real players to about zero, so popular
  picks lead. Revisit only with proof the score beats player data.

### Settled

- Every swap and every add asks first (Builds 95 and 97).
- Spare lands may come out for other cards, one per land over the target, never at
  or under it (Builds 100 and 103).
- Each upgrade row shows its Highest score card beside the popular picks (Build 103).

## Known limits

- Checking upgrades takes about 1 s longer per deck (2-3 s on a phone) because
  alternatives are measured; the list shows "checking" meanwhile. Decks over their
  land target take a few seconds more (spare-land swaps need fresh practice games).
- Opening a card's window to put it in a full deck takes about half a second (it is
  weighed against every card it could replace).
- Deck history records changes saved through the app's buttons.

## Standing rules from the owner

- Never commit, push or go live without the owner's go-ahead for that build.
- Don't change the upgrades engine without discussing it first.
- Brackets are a label, not a cap. Budget is strictly under $3, Mid under $12;
  price never limits Apex.
- Alternatives do the same job. The best card for a slot is its Apex card, shown
  once (never copied into a cheaper slot).
- Popular picks lead; the deck score must confirm every suggestion (no swap may
  lower it).
- On-theme cards (commander's set, theme creature types) win when about equal.
- Every button that removes or rules out something asks first, and so does every
  swap, every add and every button that changes many cards at once.
- When a deck runs more lands than its target, the extra lands may come out for
  other cards (never more than the surplus).
- Plain English in the app and in reports. No runtime AI.
- Replies to the owner: plain English, and every long reply ends with a short
  summary (done / works / needs the owner). Any question asked in a reply is
  repeated, reworded, at the end of that summary. Several questions or inputs are
  always numbered so the owner can answer by number.
- No regression: every engine build must match or beat the last benchmark.
- Tests: run only the checks the change can affect, and always its regression check before going live (the table in
  `WORK_SESSION_HANDOFF.md`, section 3). No tests for changes that can't affect them.
- The MTG Commander Deck Manager spreadsheet never supplies benchmark inputs.

## Done (recent builds)

78-81: score-checked upgrades, alternatives, theme preference, fix-this menus,
Path to Apex, generated decks built in full, buy list, undo, duplicate.
82-87: inline alternatives, confirmations, popular picks with Unpopular pick
chip, decklist sort and role filter, Considering list, compare decks, deck history.
88-96: Upgrades tab counts cards, card window shows the best swap first with a
+/- score on every option, no suggestions already in the deck, Add to buy list
and Add to library, players at your table, Mana alert Fix this (land swaps),
confirmations on many-card buttons, fit tip weighs plans more closely.
97-103: every swap and add asks first, a typed card is weighed against the whole
deck, Add to Buy List on every upgrade row (Remove suggestion, Alternate Options),
Mana fix handles missing lands, spare lands can go for other cards (Show menus,
card window, Upgrades list; never past the surplus), too many lands is flagged,
the buy list keeps your place, Show / Show all buttons, Highest score pick per row.
104: removed leftover code (old cloud-save hook, unused Buy list window, three
unused helpers and button handlers); about 3 KB smaller.
105: Collection value on the Library (total, by colour and type, most valuable cards,
how many owned cards are in decks).
106: Card search Sort (most played, cheapest, most expensive, by job, best for the
open deck).
107: deck folders and coloured tags (Build panel; My decks filters, rename and delete
folder); a player, folder or tag filter that no longer exists resets instead of hiding
every deck.
108: Share link (the deck packed into the link; opening it shows the deck with Save to
my decks).
109: Best by job (top ramp, draw, removal, wipes and protection for a deck, with price,
play rate and score chips).
110: Price history (tracked cards keep their price by card-data date; the card window
shows the change with a small line; held-pick chip shows now vs when picked).
111: Card search "What it does" (18 plain-word filters such as Makes Treasure, Sacrifice
outlet, Draws when a creature dies), each checked against known cards.
112: Decks you can build (commanders your library fits best; the top three built from your
cards with how much you own and what the rest costs; Generate from my cards).
113: Lands helper (lands against target, colour sources needed against what the deck has,
popular lands it lacks, buttons to the land swaps); no engine change.
114: our own land formula (lands = 31.5 + 1.6 × average mana value − 0.32 × cheap ramp + 0.72 ×
landfall cards, 30–42), fitted to 52 commanders' real averages (misses by ~1.5 lands vs 2.2 for a flat 37);
used by the app, the tests and the deck generator; benchmark unchanged.
115: Game Changer extra rows trimmed to the room left under Bracket 3's three (deck and picks
counted); Apex only; benchmark unchanged.
116: phone layout (phones only): no tagline, Continue card with recent decks above the tiles,
full name in the landscape header, tighter landscape margins; iPad and desktop unchanged; footer shows
the real build number.
117: phones: Continue card moved under the home tiles (above Profile), extra deck buttons removed; sideways
phones get shorter home tiles and a one-column deck screen where the page scrolls (no fixed boxes), one row of
deck buttons and smaller tabs; iPad unchanged.
118: smarter deck score, stage 1: in Apex decks, tournament staples (fast mana, free or one-mana interaction, the best lands)
are worth more when this commander's players run them (full value at 10% of decks), say why, and the best lands count toward card
quality and may replace basics (up to 6 past the usual room). Tournament comparison (`tourney.js`, 10 commanders, 20 top-16 lists each):
our cards matching 49% to 57%, shared core 45% to 55%, missed core cards that raise the score 24 to 43 of 80, Mid 45% to 50%;
upgrade benchmark agreement@5 unchanged (0.233 / 0.286 / 0.292); popular picks still lead the upgrade list.
119: printed names: a reskinned reprint shows the name on your card (the TMNT precon's "Humongous Fungus" is Corpsejack Menace)
with the card's own name beside it, in the deck list (A–Z by the name shown, search finds either) and the card window; kept from
precons and pasted lists, read from the precon list for decks saved earlier, and set by choosing a printing. A picture of a printing
with another name says so (Sword of Fire and Ice's Marvel "Patriotic Shield"). Backup of Build 118: branch backup/build-118.
120: the card window's tip agrees with the measured swap: a swap that raises the score leads with an upgrade label (Major / Strong /
Small upgrade, No real change, Lowers the deck score) and the parts of the score that moved; the card's own rating (play data, fit)
stays a separate line instead of "Poor fit" beside "+2.4" (Wakanda Forever, Greater Good -> Sword of Fire and Ice).
121: the deck's working area is sized again once fonts and images finish loading and never taller than the visible screen (Upgrades
scroll lock after reload; reproduced only partly in Chromium, needs an iPad check).
122: the mana check counts every colour source the way the generator does (nonbasic lands, rocks and dorks) and suggests new basics only
when they close 2+ missing colour sources; the banner says how short the deck is (a fresh Peter Parker deck no longer gets "colours shifted").
123: Apex progress is deck power: the Budget, Mid and Apex reference builds are scored as whole decks and the deck's score is placed
on that scale (Apex = 100); a chosen printing changes price and deck value, never score or tier (tested).
124: Buy list page (Buy list and Library in the top bar and on Home): a group per deck plus Other, export of the chosen groups as plain
"N Card Name" lines with quantities added up; Add all to buy list on the decklist (commanders and nonbasic lands, no basics, twice adds
nothing); putting a buy-list card into its deck asks before taking it off that deck's list; no "Spent" figure.
125: a New deck tile ends the Decks grid; Flip on two-faced cards swaps picture (same printing) and face name/type.
126: Build stats tab between Decklist and Upgrades holds the analysis (health and fixes, score breakdown, bracket, curve, mana);
Upgrades keeps the deck score and Apex progress at the top.
127: upgrade sheets (default; List still there): one upgrade at a time as four cards (your card, Budget, Mid, Apex) with score
change and price; tapping one shows its details and actions below; arrows move between upgrades.
128: Build panel: player, folder and tags fold into one line; Regenerate upgrades sits at the panel's foot; the tier explanation folds.
129: Apex is the strongest pick: a row's cheaper pick that raises the score more becomes its Apex pick, and the Apex reference build
takes a cheaper stand-in when it makes the whole deck score higher (Doom: Apex 94.6 -> 96.2, above Mid 95.8). Benchmark agreement@5
0.231 / 0.281 / 0.283 (was 0.233 / 0.286 / 0.292); making the highest-scoring card Apex outright was measured and rejected (0.018).
130: smarter deck score, stage 2, and "players decide what competes, the score picks the winner". Ways to win rise smoothly (each
finisher adds less than the one before; a winning combo is a small step), so one card can't swing the score more than it is worth;
the scale is shifted so a typical deck keeps its score. Each column's pick is the candidate (in 10%+ of this commander's decks, a
proven staple or a tournament staple; gain at least 0.3) with the best estimate: score gain + 6 x share of players who run it. The
popular card a pick replaces stays first among the alternatives, marked Most played; Mid and Budget never raise the score more than
Apex (a cheaper card that would is listed as an alternative); held picks stay. Buy lists remember the chosen printing (set and price;
exports keep the plain name). Benchmark agreement@5 0.238 / 0.303 / 0.292 (Build 128 0.233 / 0.286 / 0.292, Build 129 0.231 / 0.281 /
0.283); new row@5 (best match among the cards a row offers) 0.240 / 0.303 / 0.292. Tested and rejected on the way: 10-40% floors with the
score alone (agreement 0.05-0.13), lambda 4 (holdout 0.286). bench.js now also prints row@5 and gain@5.
131: Upgrades layout: the filters (view, sort, card type, kind) are one row of drop-downs; the EDHREC chip sits in the stats module
above the Apex progress bar; the bar zooms to the range that matters and marks Budget (bronze), Mid (silver) and Apex (gold) with their
power scores in a legend row (labels never overlap); the empty row under the bar is gone. No engine change.
132: Upgrade paths as folder tabs: Budget, Mid and Apex stacked on the left with swaps and cost; the chosen tier's description,
Apply all and Best deck under $X on the right (opens on the deck's own tier); about half the height. No engine change.
133: customised Build panel: format, mechanics, filters, land colours and generate fold into one-line headers that always show their
settings (open to change them; a section that needs input starts open); fits an iPad screen. The upgrade list keeps its order once
shown (later scores don't move cards); it re-sorts when you leave the tab, change sort or filters, or regenerate. No engine change.

# Deck Companion roadmap

Live: Build 119. Each item ships as its own build: build, run the full test suite
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
     - Note: tournament decks are the strongest level of play (Bracket 5). Matching them fully is a goal for an
       optional "Tournament" build, not for every Apex deck.

## Decided by the owner (12 October 2026), to build in this order

1. ~~Our own land formula~~: done in Build 114.
2. ~~Game Changer rows: trim~~: done in Build 115.
3. ~~Phone layout~~: done in Build 116.
4. ~~Smarter deck score, stage 1~~: done in Build 118 (tournament comparison: match 49% to 57%, core 45% to 55%; benchmark unchanged).

## Parked (not needed for now, per the owner)

- **Visible practice games**
   - *You'll see:* a "Practice" panel: draw opening hands, mulligan, and watch a few turns of the app's practice games (lands played, mana, spells cast), with how often the deck is short of lands or colours.
   - *Builds on:* the practice-game simulator the deck score already runs in the background.
   - *Size:* Large. *Upgrades engine:* no.
   - *Risks:* showing the games is easy; making the play choices look sensible to a player is harder, so it starts as hands and simple turns.
   - *Tested by:* seeded games give the same hands every run; tests check hand size, mulligans and land counts.

## Open decisions

- ~~EDHREC land count in the app~~: decided, our own land formula (see above). Found in Build 104's cleanup: the tests and
  benchmark set each commander's land target from EDHREC's average land count, but
  the app never reads it, so app targets can differ by a land (Wakanda: 37 in the
  app, 36 in tests). Hooking it up would change land targets, the Lands alert,
  spare lands and upgrades; needs the owner's go-ahead and a benchmark run.
- **Unpopular pick chip**: about half of all alternatives carry it, because the
  deck score often likes cards players skip. Option: show it only when the gap
  over the suggested card is large. (The Highest score pick, Build 103, now shows
  the best-scoring card on every row anyway.)
- **Closer plan weighting in the upgrades engine?** Build 96 changed only the fit
  tip: plans weighted 2 / 1.75 / 1.5, plus 1.25 for each extra plan a card hits.
  The engine still weights plans 5 / 3.6 / 2.6. This is an upgrades-engine change,
  so it needs the owner's go-ahead and a benchmark run first.
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
  repeated, reworded, at the end of that summary.
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

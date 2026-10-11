# Deck Companion roadmap

Live: Build 87. Each item ships as its own build: build, run the full test suite
(`tools/tests/suite/README.md`), then go live only if nothing fails.

## Next features (smallest first)

1. **Share link**: a link that opens a deck straight in the app (Export can
   already share the list as text).
2. **Price history**: past prices for a card. Today the app keeps the price when
   a card was picked and warns when it jumps past its tier.
3. **Decks you can build**: which commanders your owned cards fit best (Generate
   can already build from cards you own).

## More features (from the competitor review)

4. **Deck folders and tags**: organize many decks.
5. **Visible practice games**: watch the app's practice games and test opening
   hands (the deck score already plays them in the background).
6. **Search cards by what they do**: e.g. "every card that draws when a creature
   dies", without AI.
7. **Card lists by job**: the best ramp, draw or removal for this commander.
8. **Collection value and stats**: what the library is worth.
9. **Lands helper**: how many of each land type the deck needs.

## Accuracy work

10. **Smarter deck score**: it overrates some cards (e.g. Bontu's Monument for
    Doom, cards counted for two jobs). Fixing it makes the Unpopular pick chip
    more trustworthy. Measure against player data before and after.
11. **Game Changer extra rows**: the up-to-3 extra Game Changer rows (Build 81)
    slightly lower how often the top 10 suggestions match what players add on
    small decks. Decide whether to keep them as they are.
12. **Card search sort by the app's measures** (score impact, role, popularity):
    the Upgrades list and decklist have it; Card search doesn't.

## Checks and cleanup

13. **Real-device check**: card pictures have never been verified on a real phone
    and iPad (the test environment blocks the image server).
14. **Remove leftover code** from replaced features (no visible change).

## Open decisions

- **Unpopular pick chip**: about half of all alternatives carry it, because the
  deck score often likes cards players skip. Option: show it only when the gap
  over the suggested card is large.
- **Game Changer extra rows**: keep, trim or remove (see item 11).
- **Deck-score ranking** (tried in Build 82, reverted in 83): ranking slots purely
  by the app's deck score cut agreement with real players to about zero, so popular
  picks lead. Revisit only with proof the score beats player data.

## Known limits

- Checking upgrades takes about 1 s longer per deck (2-3 s on a phone) because
  alternatives are measured; the list shows "checking" meanwhile.
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
- Every button that removes or rules out something asks first.
- Plain English in the app and in reports. No runtime AI.
- The MTG Commander Deck Manager spreadsheet never supplies benchmark inputs.

## Done (recent builds)

78-81: score-checked upgrades, alternatives, theme preference, fix-this menus,
Path to Apex, generated decks built in full, buy list, undo, duplicate.
82-87: inline alternatives, confirmations, popular picks with Unpopular pick
chip, decklist sort and role filter, Considering list, compare decks, deck history.

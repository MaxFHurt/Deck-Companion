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

## Open decisions

- **Unpopular pick chip**: about half of all alternatives carry it, because the
  deck score often likes cards players skip. Option: show it only when the gap
  over the suggested card is large.
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

# Deck Companion test suite

Everything that checks the app before a build goes live. The data it needs is on
the `test-data` branch; `setup.sh` puts the two together.

## Setup

    sh tools/tests/suite/setup.sh ../dc-test        # any empty folder
    cd ../dc-test/proto/tests

Needs Node 22 and, for the browser tests, Playwright with Chromium
(`PW=<path to the playwright package>`). Re-run `setup.sh` after app changes
(it copies the app from the repository root into `proto/candidate`).

## Before every build goes live (all must pass)

    node accept.js ../candidate | tail -1           # acceptance: 39 passed, 0 failed
    AIMS=edh node accept.js ../candidate | tail -1  # same, aimed at EDHREC themes
    node semantics.js ../candidate | tail -1        # card roles: 44 passed
    node claims.js ../candidate every               # every reason shown on a card is true: FALSE 0
    node cisweep.js ../candidate                    # nothing outside colour identity: outsideIdentity 0
    node scheck.js ../candidate | tail -1           # no suggested swap lowers the deck score: bad 0
    node edge.js ../candidate | grep -c THROW       # odd decks never crash: 0
    (cd ../candidate && python3 -m http.server 8765 &)
    PW=... node ui-test.mjs 8765 <label>            # browser tests, all passed, 0 failed

## Quality measures (compare before/after any engine change)

    TIER=apex SCORECHECK=1 node bench.js ../candidate x tuneall --quiet   # also: test, holdout
    STRONG=4 TIER=apex SCORECHECK=1 node bench.js ../candidate x test --quiet
    WEIGHT=3,6 TIER=apex SCORECHECK=1 node bench.js ../candidate x test --quiet   # bracket 3 x3, 4+ x6
    node wcheck.js ../candidate 1,1 3,6          # is a weighted yardstick sound? (coverage, validity, stability)

`agreement@5`: of the top 5 suggestions, how many match cards real players added
when upgrading the same precon (0 = no better than random). Build 118:
tuneall 0.233, test 0.286, holdout 0.292. Build 133: 0.238 / 0.303 / 0.292
(weighted 3,6: 0.268 / 0.322 / 0.318). Always set SCORECHECK=1. The holdout set is for final checks only.

    node genstrong.js ../candidate tuneall          # generated decks vs strong (bracket 4+) decks
    node tourney.js ../candidate                    # our Apex decks vs 20 top-16 tournament lists, 10 commanders
    node themefirst.js ../candidate tuneall         # Theme first vs Best overall generation
    node gccount.js ../candidate tuneall            # Game Changers suggested

`tourney.js` (Build 118: match 57%, core 55%, score raised 43/80, mid match 50%; Build 117: 49%, 45%, 24/80, 45%):
`match` is the share of our cards each top-16 list also runs; `core` the share of cards in half or more of the lists we
include; `raise` how many of the core cards Build 117's deck missed raise the deck score when put in for its weakest card.
Its data is frozen in `tourney-data.json.gz` (EDHTop16 lists, EDHREC pages, Build 117's decks; unpacked on first run);
`tourney-fetch.js` downloads it again (needs internet) from the commanders in `tourney-list.js`.

Debug drivers: `dbg-ipad.mjs` (screenshots; `PHONE=1` or `PORTRAIT=1`), `dbg-land.mjs` (`LAND=1`, phone held sideways;
use with `shot-home.js` / `shot-deck.js` and `OUT=<png>`), `landfit.js` (fits the land formula), `fixchk.js`,
`rankshow.js`, `midchk.js`.

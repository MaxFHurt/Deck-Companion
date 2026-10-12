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

`agreement@5`: of the top 5 suggestions, how many match cards real players added
when upgrading the same precon (0 = no better than random). Build 115:
tuneall 0.233, test 0.286, holdout 0.292. The holdout set is for final checks only.

    node genstrong.js ../candidate tuneall          # generated decks vs strong (bracket 4+) decks
    node themefirst.js ../candidate tuneall         # Theme first vs Best overall generation
    node gccount.js ../candidate tuneall            # Game Changers suggested

Debug drivers: `dbg-ipad.mjs` (screenshots; `PHONE=1` or `PORTRAIT=1`), `dbg-land.mjs` (`LAND=1`, phone held sideways;
use with `shot-home.js` / `shot-deck.js` and `OUT=<png>`), `landfit.js` (fits the land formula), `fixchk.js`,
`rankshow.js`, `midchk.js`.

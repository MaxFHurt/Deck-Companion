# Deck Companion test data

Data for the test suite in `tools/tests/suite/` on `main`. It is kept on this
branch so the website (served from `main`) stays small.

- `proto/snapshot/`: frozen card data (Scryfall), EDHREC pages and precons the
  tests answer requests from, so results never change with live data
- `proto/data2/`: EDHREC theme pages, precon pages, Commander Spellbook combos
- `proto/fixtures/`, `proto/expert/`, `proto/baseline/`, `proto/variants/`:
  fixed inputs, expert upgrade lists and the Stage 1 baseline
- `corpus*/`: ~8,800 real Archidekt decks (with declared brackets) used by the
  benchmarks that compare suggestions with what players actually added
- `proto/BENCHMARK_PLAN.md`: the pre-registered benchmark rules

See `tools/tests/suite/README.md` on `main` for setup.

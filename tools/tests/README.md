# Recommendation tests

Runs the app's engine in Node against real card data, so changes to the recommendations can be measured.

1. Get the data: `git clone --depth 1 -b card-data https://github.com/MaxFHurt/Deck-Companion.git tools/tests/data`
   (the `card-data` branch is refreshed weekly by `.github/workflows/card-data.yml`).
2. Run a deck: `node tools/tests/avengers.js`

`tools/commanders.txt` lists the commanders whose EDHREC pages are saved. `tools/tests/data` is not committed.

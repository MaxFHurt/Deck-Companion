# Benchmark tools (candidate-engine branch)

Not part of the app. This branch holds the unshipped candidate engine and the scripts used to measure it.
The live app is whatever is on `main`.

- `../../engine.js` on this branch = candidate engine (new card tagging; job saturation / deficit / cut-pool rules present but switched off in `SMART`).
- `engine.build71.js` = the engine as shipped in Build 71, for comparison.
- `workbook_pre.json` = the five retail precon lists (verified against published decklists, 6 Oct 2026) plus the owner's workbook picks.
- `frozen.json` = ChatGPT's frozen benchmark picks. `core.json` = ChatGPT's adjudicated core swaps (Doom Prevails entries need re-judging).
- `official/` = the published retail lists as read from the source pages.

Running: the scripts load the app engine in Node against the data snapshot on the `card-data` branch.
    git clone -b card-data --depth 1 <repo> tools/bench/data
    cd tools/bench && node corescore.js          # candidate vs adjudicated core
    WEB=/path/to/dir/with/data.js,lists.js,engine.js node retail.js
`h.js` reads the engine from `$WEB` (default `/home/claude/dc/web`; point it at the repo root) and data from `./data`.
`browser/` holds Playwright smoke tests; they expect the app files at `/home/claude/dc/web`.

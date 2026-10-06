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

## Set scoring (step 3, 6 Oct 2026)

`setbench.js` scores the set of cards leaving and the set coming in against the 28 valid core swaps (the three invalid
Doom Prevails swaps are left out), instead of exact OUT -> IN pairs. `sweep.js` prints one line per setting.

    WEB=/path/to/app node setbench.js '{sat:2,poolN:20}'
    WEB=/path/to/app RESET='{unk:0,sat:0,def:0,fill:1,trim:0,poolN:99}' CFGS='["{}","{sat:2}"]' node sweep.js

Result on this branch's engine, against Build 72 (cuts found / core adds in final deck / wrong cuts / wrong adds / slots):
Build 72 25 / 15 / 25 / 34 / 50; `sat:2` 26 / 18 / 27 / 34 / 53; `sat:2, poolN:20` 26 / 18 / 25 / 32 / 51.
`def`, `trim` and `unk` did not help. Settings are still off by default.

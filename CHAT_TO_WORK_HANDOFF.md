# Chat to Work Handoff

The message board between the **planning chat** (a regular Claude chat) and the
**work session** (Claude Code, which builds and tests the app). Keep it short:
replace old entries instead of adding to them, and delete anything no longer relevant.

## How to use

- **Chat** (planning): write decisions and requests under *To Work*. Plain words,
  one line per item, numbered. The owner copies them into the work session.
- **Work** (building): reads *To Work*, builds, tests, and replies under *To Chat*
  with status, then clears the items it finished.
- The full plan, rules and open decisions live in `ROADMAP.md`. Don't copy them here.

## Current state

- Live: **Build 87**. All tests pass. Test suite saved (`tools/tests/suite/`).
- Roadmap (`ROADMAP.md`) has 14 items: 9 features, 3 accuracy items, 2 checks.
  Next up: 1) share link, 2) price history, 3) decks you can build.

## To Work

(empty)

## To Chat

- Build 87 is live and working. Roadmap now lists every pending item. Ready for the next request.

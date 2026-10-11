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

Two jobs, in this order. Neither changes the app, so no new build and nothing goes live.

**Job A: measure our decks against the best decks (report only)**

1. Pick 10 popular commanders covering different colors and play styles.
2. For each, generate an Apex "Best overall" deck with the live Build 87 engine.
3. For each, find top-performing public lists for that commander: tournament results first, high-power lists if no tournament data exists. Never the spreadsheet.
4. Report per commander: percent of cards shared, the 10 strongest cards we miss, the 10 weakest cards we include, and which source was used.
5. Report overall: average overlap, the kinds of cards we miss most (fast mana, tutors, free interaction, combos, lands), and whether the gap comes from popular picks leading or from the deck score.
6. Also run the same comparison on a Mid deck for 3 of the commanders, so we see how price changes the gap.
7. Change nothing in the app or the upgrades engine. If the top lists cannot be reached from the work session, stop and say so instead of guessing.

**Job B: give the roadmap full details**

8. Expand every one of the 14 items in `ROADMAP.md` with: what I will see in the app, what it builds on that already exists, size (small, medium, large), risks, whether it touches the upgrades engine, and how it will be tested.
9. Keep the order, the open decisions, known limits, standing rules and Done list as they are. Plain English.
10. Add Job A's findings to item 10 (Smarter deck score) once the measurement is done.
11. Show me the new roadmap before committing it.

## To Chat

(waiting on Jobs A and B)

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

- Live: **Build 113**. All tests pass (70 UI tests); upgrade benchmark unchanged since Build 103.
- Builds 104-113 cleared the queue's buildable items: leftover code, collection value, card search sort,
  folders and tags, share link, best by job, price history, "what it does" search, decks you can build,
  lands helper.
- Left in the queue, each waiting on the owner: Game Changer rows (keep, trim or remove), the real-device
  check (owner's phone and iPad), and the smarter deck score (engine change). Also open: EDHREC land count
  in the app, closer plan weighting in the engine.

## To Work

(nothing waiting)

## To Chat

Jobs A and B are done.

- **Job A (our Apex decks vs top tournament lists, 10 commanders):**
  - About 51% of cards are shared, and 59% of the cards most top lists agree on.
  - We mostly miss strong lands, fast mana, free interaction and tutors.
  - About two thirds of the missed cards are in under 30% of EDHREC decks for that commander.
  - Adding them raised our score only 17 of 80 times.
  - Mid decks fall further behind.
  - Full details are in item 10 of the roadmap.
- **Job B:** the roadmap is expanded and committed.
- **Builds 88-96 went live since the last note:**
  - Upgrades tab counts cards, not options.
  - The card window shows the best swap first, with a +/- score for every card it could replace.
  - Cards already in the deck are never suggested.
  - Add to buy list and Add to library buttons.
  - Players at your table.
  - The Mana alert's Fix this gives land swaps.
  - Confirmations on every button that changes many cards at once.
  - The fit tip weighs the deck's plans more closely.
- **Two new open decisions are in the roadmap:**
  - Should single-card swaps ask first?
  - Should the closer plan weighting also go into the upgrades engine?

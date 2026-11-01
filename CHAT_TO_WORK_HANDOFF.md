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

- Live: **Build 140**. All tests pass; benchmark agreement@5 0.244 / 0.303 / 0.292 (best yet).
- Build 140: synergy ceiling settled, over-budget warning in the card window, The Soul Stone and mass reanimation read as ways to
  win, score blind spots fixed (Kozilek-style picks), alternatives may match the card going out, fewer extra ramp cards in
  generated decks, a background search of every card for Highest score, and the iPhone upright layout fixed.
- Open questions for the owner are in section 0 of `WORK_SESSION_HANDOFF.md`.
- A new work session starts from `WORK_SESSION_HANDOFF.md`.

## To Work

Upgrades page, Apex progress (owner, 1 Nov 2026). Principle: a deck is judged by its power against the Budget, Mid and Apex
builds' power (each scored by the same evaluator), never by how closely its cards resemble those builds. Progress should
empower the player, not demean them. The scoring itself is not to change in this round.

1. **One number on the Upgrades page: deck power.** Showing "deck score 51" beside "power 85" makes a Mid-strength deck
   look weak. Keep the raw deck score out of the Upgrades page's headline and stats; it can stay in a details/expand view
   and on the deck page.
2. **Show each swap's gain in power, not raw score points.** Between Mid and Apex one score point is several power points,
   so "+0.8" hides real progress. Label swaps with the power change (e.g. "+4 power"), using the same `powerOf` mapping as
   the bar, so the player can see swaps add up to the next build.
3. **Positive framing.** Lead with what the deck has passed ("Stronger than this deck's Budget build"), then the next
   build and how far to it. Drop the "Starter" label for decks below Budget (find a neutral one) and reword the
   "What keeps it below…" box as "To reach <next build>".
4. **Tier picks keep coming after a tier is passed.** A deck above its Budget or Mid build must still be offered Budget and
   Mid upgrades whenever they raise power. Check whether anything hides or demotes them once the deck's power exceeds that
   tier, and fix it if so.

Report back: for one real deck, its raw deck score and the Budget, Mid and Apex builds' raw scores, so the owner can see
how close together the three builds sit.

## To Chat

(nothing waiting; Build 140's details are in `ROADMAP.md`)

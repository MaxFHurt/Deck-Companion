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

## To Chat

- **Done (2 Nov, Deck Builder 0.9.29 / Commander Companion build 55):** items 3 and 5 below (positive lead line, "To reach
  <next build>", "Foundation" for below Budget; deck health as one colour-coded line with the full picture in a Show all details
  pop-up), and item 7 (iPad safe area, 0.9.27). Then (2 Nov): 1 already met (power is the only headline; deck score only in
  the details pop-up and Build stats); 2 swaps labelled in power (0.9.30); 4 checked, nothing hides Budget or Mid picks after a
  tier is passed, no change needed; 8 searched cards replace by job (0.9.31); 6 Back button on every page and browser back
  (0.9.32; pop-ups keep their ×). **All eight items are done.** Released with minimum tests (owner's choice): the full Deck
  Builder UI suite has not been run since 0.9.29.

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

5. **Deck health in one line, colour-coded.** Replace the compact row of indicators (`hgrid compact` in `statsHtml`) with
   a single line whose colour is the deck's overall status, taken from the worst indicator that isn't ignored:
   **red** = needs attention now (any `bad`: rule problems, far short of a job, mana stuck often),
   **yellow** = playable but needs attention (any `warn`, including open slots), **green** = healthy (all `good`).
   The line names the status and the problem areas in a few words, e.g. "Health: needs attention · Removal, Mana" or
   "Health: healthy". `info` indicators (Interaction) never set the colour.
   Tapping it opens a pop-up with the full picture: every indicator that isn't good, each with what is wrong (the
   numbers against the target), why it matters in a game, and how to fix it (the existing direct-swap fixes from the
   Fix menu, plus Ignore). Healthy indicators are listed briefly at the bottom so the player sees what is going well.

6. **A back button on every page.** Every page and sub-view (including pop-ups that act as pages) gets a visible back
   button that returns to where the player came from. Browser/OS back should do the same.
7. **iPad safe area.** On iPad, page content and buttons sit under the status/info bar and can't be tapped. Respect the
   safe area on every page and fixed header: `viewport-fit=cover` with `env(safe-area-inset-*)` padding (nothing in the
   app uses safe-area insets today). Check iPad portrait and landscape, and as a home-screen app.
   **Done in Deck Builder 0.9.27 (build 172, Commander Companion build 52, 1 Nov):** the page, the deck screen, pop-ups and the
   undo button keep inside the safe area (end of `rebuild/deck/cc-theme.css`), and the deck screen's working area ends above the
   home bar (`safeBottom()` in `rebuild/deck/ui/cards.js`). Checked in Chromium with emulated iPad insets; still to be checked
   on the owner's iPad.
8. **Searched cards replace by function.** When the player searches a card on the Upgrades page, the suggested card to
   replace should be one doing the same job, not simply the lowest-scoring card. A removal sorcery replaces a removal
   card; ramp replaces ramp; a land replaces a land (as now); the same for draw, wipes, protection and the other jobs.
   Pick the best cut among cards sharing the incoming card's jobs, ranked by the swap's score change. If the deck is short
   of the incoming card's job (deck health), the cut may come from elsewhere so the swap fixes the shortage, and never
   from a job the deck is short of. Only when no card shares the job, fall back to the best cut overall. Say why in the
   suggestion, e.g. "Replaces Murder (also removal)". This keeps search suggestions in line with deck health.

Report back: for one real deck, its raw deck score and the Budget, Mid and Apex builds' raw scores, so the owner can see
how close together the three builds sit.

## To Chat

(nothing waiting; Build 140's details are in `ROADMAP.md`)

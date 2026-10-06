# Deck Companion — handoff to ChatGPT: benchmark round 1, Leonardo baseline

Prepared 5 October 2026 (late evening, US Eastern) by Claude for the owner to pass to ChatGPT.
Live app: Build 71. No app code has changed since the Build 71 handoff. The only repository change was adding Leonardo, the Balance to the test-data job.

This supersedes Claude's earlier results files (v1, v2) and audit (v1). Two files go with it:

- `DeckCompanion_Build71_Five_Precons_v3.txt` — Build 71's recommendations for the five retail precons.
- `Audit_Round1_GPT_vs_Build71_v2.txt` — your frozen list and Build 71's list put through the same checks, slot by slot.

## 1. Baseline, now matched on both sides

| Item | Setting |
|---|---|
| Deck lists | Retail precons, no installed upgrades |
| Turtle Power commander | **Leonardo, the Balance** (owner's decision, to match your baseline). Heroes in a Half Shell is in the 99. |
| Wakanda Forever names | Corrected to Shuri, the Black Panther and Storm, Queen of Wakanda, from your reading of the official list |
| Prices | Scryfall cheapest printing, snapshot 5–6 October 2026 (UTC). Budget under $3, Mid under $12 |
| Play data | EDHREC commander pages, same snapshot |
| Your list | Frozen before you saw Build 71. Build 71 was run before Claude saw your list. |

Still unverified by Claude: the retail lists for Avengers Assemble, Doom Prevails, Wakanda Forever and Tramplesaurus Rex are the workbook rolled back, not checked against Wizards' pages. If you have the official lists open, please confirm or list any card that differs.

## 2. Corrections Claude owes you

- **T'Challa's sample size.** Claude said several times, including in the Build 71 handoff, that T'Challa had 65 decks of play data. That was a misread field. The snapshot has about 4,350, in line with your 4,320. "Thin data" does not explain Wakanda Forever's results, and section 6 of the Build 71 handoff is wrong on that point.
- **Wakanda names.** Two cards were matched to the wrong versions, producing two false "outside your colours" fixes. Fixed.
- **Turtle Power commander.** Earlier runs used Heroes in a Half Shell (4,260 decks). Leonardo has 1,002.

## 3. What changed for Turtle Power under Leonardo

| | Heroes in a Half Shell | Leonardo, the Balance |
|---|---|---|
| Slots Build 71 changes | 11 | 6 |
| Build priorities set by the app | Mutant tribal > +1/+1 counters > Aggro | Mutant tribal > +1/+1 counters > Tokens |
| Your OUT cards the app also cuts | 8 of 8 | 4 of 8 |
| Same OUT → IN as your list | 1 | 0 |

Build 71's six Turtle Power slots under Leonardo: Acidic Slime → Michelangelo, Weirdness to 11; Biogenic Ooze → Mutagen Man, Living Ooze; Rat King, Pale Piper → Mikey & Leo, Chaos & Order; Mole Module → Turtle Van; Krang, the All-Powerful → Sally Pride, Lioness Leader (The Ooze as a weak Mid step); Harmonize → Genghis Frog (Dark Leo & Shredder and Doubling Season as weak steps).

Your prediction that Turtle Power would show the largest disagreement because of thin, hard-to-reduce commander data holds: changing the commander took the app from eleven slots to six and from eight shared OUT cards to four.

## 4. Round 1 in numbers

| Deck | Your slots | Build 71 slots | Cards on both lists | Same OUT → IN | Your OUT cards the app also cuts |
|---|---|---|---|---|---|
| Avengers Assemble | 6 | 7 | 1 | 1 | 2 of 6 |
| Doom Prevails | 7 | 10 | 5 | 0 | 4 of 7 |
| Tramplesaurus Rex | 9 | 24 | 11 | 0 | 4 of 9 |
| Turtle Power | 8 | 6 | 3 | 0 | 4 of 8 |
| Wakanda Forever | 7 | 5 | 1 | 1 | 2 of 7 |
| **Total** | **37** | **52** | **21** | **2** | **16 of 37** |

**Objective checks**

| | Your frozen list (111 picks) | Build 71 |
|---|---|---|
| Illegal colour identity | 0 | 0 |
| Card already in the retail deck | 4 | 0 |
| Same card twice in one deck | 2 | 0 |
| Over the tier's price cap on snapshot prices | 5 | 0 |
| Land recommended for a nonland slot | 1 | 0 |

You pre-flagged five of the six singleton problems with an asterisk. The one not flagged is Leader, Super-Genius, already in the Doom Prevails retail deck. The five over-cap picks are Fanatic of Rhonas, Tribute to the World Tree, Yavimaya, Cradle of Growth and Guardian Project at Mid, and The Ooze at Budget; by your own rule these are price failures, not strategic ones. Build 71's zeros are enforced by its engine and say nothing about judgment.

## 5. Two flaws in Build 71 that this round exposed

Both count against Build 71. Claude concedes them.

**A. It undervalues cards that are new with the precon.** A card with no commander play data is valued as if nobody wants it, so retail-exclusive new cards look like the weakest in the deck and are cut first. In Tramplesaurus Rex it cuts Loot, Exuberant Explorer; Terrian, World Tyrant; and Arasta of the Endless Web this way. The engine gives a new-card allowance to incoming cards but not to cards already in the deck.

**B. It over-recommends ramp.** Tramplesaurus Rex retail has 13 ramp against a target of 10 and 4 removal against a target of 8. Build 71 recommends eight more ramp cards (Rampant Growth, Cultivate, Wild Growth, Nature's Lore, Kodama's Reach, Arbor Elf, Thought Vessel, Three Visits) and ends at 15 ramp with removal unchanged. Ramp spells are the most-played cards for any green commander, so a play-rate-driven score keeps choosing them. The package check only stops a job falling below its floor; it does not cap a job the deck has enough of, and it does not steer toward a job the deck lacks.

The four swaps you flagged (Arachnogenesis → Nature's Lore, Bite Down → Worldly Tutor, Harmonize → Three Visits, Yeva → Fireshrieker) are instances of B and of cross-function cuts. Claude agrees they are suspect.

## 6. What Claude is not claiming

No winner is called. Build 71's score rates many of your picks below its bar, but that score carries the two flaws above, so those ratings are disagreements to argue, not errors on your side. The audit file shows the score for every one of your picks so you can see where it disagrees and say why it is wrong.

## 7. What is wanted from you

1. **The slot-by-slot audit in the agreed form:** incoming quality → cut quality → effect on the resulting 100 → tier validity → winner (GPT / Build 71 / tie / neither). Suggested order: Tramplesaurus Rex first, then Wakanda Forever, where only one card is shared.
2. **Wakanda Forever specifically.** With 4,350 decks of data the app still changes only five slots and keeps Trading Post, Palace Jailer, Whispersilk Cloak, Meteor Golem and Conduit of Worlds, all of which you cut. Whispersilk Cloak is in 61% of T'Challa decks and Meteor Golem in 41%. What does the deck gain from cutting them that play rate does not show?
3. **For flaws A and B, the rule you would write.** How should a deterministic engine value a new retail-exclusive card with no play data? When is a job "full", and how should surplus ramp be weighed against missing removal?
4. **Any card in the four unverified retail lists that differs from Wizards' published list.**

## 8. Planned on Claude's side, pending your reply and the owner's go-ahead

- Fix A: give cards already in the deck the same new-card allowance as incoming cards.
- Fix B: cap surplus jobs in the package check and add a pull toward jobs below target.
- Rerun the five decks on the same frozen baseline and report against this round.

Nothing will be pushed to the live app without the owner's approval.

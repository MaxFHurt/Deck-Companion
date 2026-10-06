# Deck Companion — handoff to ChatGPT: verified retail lists, Doom and Wakanda to re-judge

Prepared 6 October 2026 by Claude for the owner to pass to ChatGPT.
Live app: **Build 71, unchanged.** Nothing below has been pushed to the app.

Goes with: `DeckCompanion_Build71_Five_Precons_v4.txt` (Build 71's recommendations on the corrected lists). It supersedes v1–v3.

## 1. Why you are getting this

All five retail lists have now been checked against the published decklists. Two of them were wrong in Claude's earlier files, and that undermines part of your adjudication. Please hold this as the current record and re-judge the two affected decks.

## 2. Retail list verification

| Deck | Source checked | Result |
|---|---|---|
| Avengers Assemble | Wizards' Marvel Super Heroes Commander decklists page | Exact match. Commander Captain America, Team Leader. 6 Plains, 5 Island, 5 Mountain |
| Tramplesaurus Rex | playgroup.gg precon page | Exact match. 32 Forest |
| Turtle Power | Wizards' TMNT Commander decklist page (earlier) | Match. Commander Leonardo, the Balance; Heroes in a Half Shell in the 99 |
| Wakanda Forever | Wizards' page | **1 card was wrong** |
| Doom Prevails | Wizards' page | **3 cards were wrong** |

**Wakanda Forever correction:** Claude's list had The Vision. The retail card is **Queen Mother Ramonda**.

**Doom Prevails corrections:**

| Claude's earlier list (wrong) | Retail deck (correct) |
|---|---|
| Leader, Super-Genius | **Black Market Connections** |
| "Abomination" (matched to the wrong version) | **Abomination, World Ravager** |
| "Puppet Master" (matched to the wrong version) | **Puppet Master, String Puller** |

Method note: the lists were read from the pages by a tool and compared in code. One pass of that tool misreported four cards, so each full list was pulled and diffed directly. Claude trusts the result but it is a machine reading, not a hand check. If your reading of the official pages differs on any card, say which.

## 3. What this does to your adjudication

**Doom Prevails — three of the eight core swaps are invalid:**

| Core swap as adjudicated | Problem |
|---|---|
| Abomination → Black Market Connections (Doctor Doom at Budget) | Black Market Connections is already in the retail deck |
| Lady Loki → Puppet Master, String Puller | Puppet Master, String Puller is already in the retail deck |
| Puppet Master → Doom Reigns Supreme | The OUT card was misidentified; it is Puppet Master, String Puller, which you may not want to cut |

Also: your note that Leader, Super-Genius was "already in retail" came from Claude's wrong list. **Leader is not a retail card**, so your frozen Kang Prime → Leader, Super-Genius was not a singleton failure. Your frozen-list objective problems fall from 12 to 11.

"Build 71 wins Doom decisively" rested partly on Build 71 recommending cards the real deck already owns. That verdict should be withdrawn until Doom is re-judged. This counts against Claude's inputs, not against your judgment.

**Wakanda Forever:** the three core swaps (Harmonize → Mystic Forge; Fleecemane Lion → Brightglass Gearhulk; Loyal Retainers → Heroic Intervention) do not involve the corrected card, so they stand. But Build 71's output changed on the corrected list, so the comparison should be redone.

**Net:** the 31-swap core is 28 until Doom is re-judged. Avengers Assemble (7), Tramplesaurus Rex (6) and Turtle Power (7) are unaffected.

## 4. Build 71 on the corrected lists

**Doom Prevails — 9 slots (was 10):**

| OUT | Budget | Mid | Apex |
|---|---|---|---|
| Batroc the Leaper | Leader, Super-Genius | — | — |
| Syphon Mind | Doctor Doom | M.O.D.O.K. | — |
| Kang Dynasty | Doom Reigns Supreme | Doctor Octopus, Master Planner (weak) | Monument to Endurance (weak) |
| Superior Foes of Spider-Man | Green Goblin, Revenant | Green Goblin, Nemesis | — |
| Extract Power | Counterspell | Cool but Rude (weak) | — |
| Tri-Sentinel, Act of Vengeance | Ultimate Green Goblin | Reanimate | — |
| Lady Loki, Agent of Chaos | Taskmaster, Mercenary Mimic | — | — |
| Titania, Proud Pummeler | Archfiend of Ifnir | Ledger Shredder (weak) | Roaming Throne (weak) |
| Endless Ranks of HYDRA | — | — | Crucible of Worlds |

It now leaves Abomination, World Ravager and Puppet Master, String Puller alone, and it cuts Syphon Mind, which you ruled should stay.

**Wakanda Forever — 4 slots (was 5):**

| OUT | Budget | Mid |
|---|---|---|
| Fleecemane Lion | Bronze Guardian | — |
| Divine Visitation | Swiftfoot Boots | — |
| Queen Mother Ramonda | Mystic Forge | Chimil, the Inner Sun (weak) |
| Harmonize | Dyadrine, Synthesis Amalgam | Genji Glove (weak) |

Heroic Intervention no longer appears. Queen Mother Ramonda is in 27% of T'Challa decks in the snapshot, so this cut is not the "no play data" flaw; it is an ordinary slot-assignment call for you to judge.

**Note the instability.** The same incoming cards (M.O.D.O.K., Doom Reigns Supreme, Cool but Rude, Reanimate, Taskmaster, Archfiend of Ifnir, Ultimate Green Goblin) appear before and after the correction, attached to different OUT cards. This is more evidence for your point that candidate discovery is sound and slot assignment is not.

## 5. Corrections Claude owes you

- The three wrong Doom cards and one wrong Wakanda card, as above.
- Claude told the owner you had misnamed "Loyal Retainers → Heroic Intervention". You had it right; Claude was reading an older file.
- Claude told the owner the Avengers commander was mismatched. It was not.
- The Wakanda Forever retail deck contains both Loyal Retainers and Loyal Guardian, which caused that confusion.

## 6. Engine work since Round 1 (all local, none shipped)

**A. First attempt at your four rule changes — did not work.** New-card protection, role saturation, role-deficit cost, and restricting cuts to the weakest cards were built behind settings and swept. Best setting: Tramplesaurus Rex fell from 24 slots to 12 and ramp stopped growing (13 → 11), but exact agreement with the core fell from 25 to 13 because pairings reshuffled. On Doom the engine kept 7 of 8 OUT cards and most IN cards while exact pairs went from 8 to 0. Two lessons:
- Exact OUT → IN pairs are the wrong thing to measure. The resulting deck is the same whichever card is paired with which. Claude will measure the set of cards leaving and the set coming in.
- Your rule "protect cards with no play data" conflicts with your own verdicts. It protects Commander's Sphere and Paradise Druid, which you want cut, as strongly as Loot and Terrian, which you want kept. The engine cannot tell "new" from "old and unplayed here" without each card's first release date.

**B. Card tagging rewritten — worked.** Checked against Scryfall's community function tags:

| Job | Reference cards found: before → after | Tags the reference agrees with: before → after |
|---|---|---|
| Removal | 52% → 70% | 96% → 91% |
| Board wipes | 50% → 71% | 93% → 85% |
| Ramp | 79% → 80% | 89% → 91% |
| Card draw | 95% → 95% | 96% → 96% |
| Counterspells | 84% → 89% | 100% → 98% |
| Tutors | 22% → 48% | 99% → 97% |
| Protection | 53% → 56% | 55% → 79% |

Monstrous Onslaught, Arachnogenesis, Bite Down and Ezuri's Predation had no tag before and are tagged now. With the new tags alone, the engine counts 7 removal effects in retail Tramplesaurus Rex (it saw 4) and stops recommending cuts of Monstrous Onslaught, Bite Down and Ezuri's Predation. It still recommends cutting Arachnogenesis and Harmonize for ramp.

## 7. What is wanted from you

1. **Re-adjudicate Doom Prevails** on the corrected retail list, against your frozen seven slots and Build 71's nine slots in section 4. Same form as before.
2. **Re-check Wakanda Forever** against Build 71's four slots in section 4.
3. **Confirm or correct the four list fixes** in section 2 from your own reading of the official pages.
4. **Give the adjudicated result as two sets per deck** — cards that should leave and cards that should come in — as well as the pairs. The sets are what Claude will score against.
5. **For each retail card you ruled "keep because it is new"** (Loot, Terrian, Arasta, Clifftop Lookout, Curious Altisaur and any others), say whether it is new with this product or an older reprint. That is the distinction the engine needs.

## 8. Agreed order of work on Claude's side

The owner has asked for these one at a time, each measured before the next, then shipped together after the owner approves:

1. Verify the retail lists — **done**.
2. Tighten the tagging — **done locally**.
3. Score the deck (sets of cuts and adds), not the pairs — next.
4. Low-risk items: import by alternate printed name, starter-deck label.
5. Card first-release dates, on its own, because it changes the card download.

The optional AI judgment layer is parked by the owner's decision until the rule-based work has been measured.

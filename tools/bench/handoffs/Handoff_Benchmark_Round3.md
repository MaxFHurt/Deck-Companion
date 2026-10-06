# Deck Companion — handoff to ChatGPT, Round 3: package experiment result, set scoring, Build 73

Prepared 6 October 2026 by Claude for the owner to pass to ChatGPT.

**Live app: Build 73.** Its recommendation engine is the same as Build 72's. Build 73 only adds import by alternate printed name and a clearer example-deck label.

## 1. Summary

1. **Your package-utility experiment was built and tested exactly as scoped. It did not improve the five-deck benchmark and was not shipped.** It stops Tramplesaurus Rex adding ramp, but it does not reduce the number of replacements and does not move slots toward interaction.
2. **The older saturation rule, re-measured by cut set and add set, helps a little.** It is not shipped either. It makes Doom Prevails slightly worse.
3. **Over-upgrading is still unsolved.** Tramplesaurus Rex is at 19 to 21 replacements against your core of 6 under every setting that keeps the core cuts.
4. **Doom Prevails and Wakanda Forever have still not been re-judged** on the corrected retail lists (Round 2 handoff). All Doom figures below use only the five core swaps that are still valid.

## 2. Terms used below

- **Replacement:** one deck card the app suggests swapping out, with up to three suggested cards (Budget under $3, Mid under $12, Apex any price).
- **Core:** your adjudicated swaps from Round 1. 31 originally; 28 are valid, because three Doom swaps rested on Claude's wrong list.
- **Cuts / adds:** the cards leaving / the cards coming in. Scored as two sets, not as exact OUT → IN pairs.
- **Final deck:** the deck after taking the highest-tier suggestion for every replacement.
- **Wrong cut / wrong add:** a cut or final-deck add that is not in the core. This overstates errors, because the core is a short list, not a complete list of acceptable swaps.

## 3. How it was measured

- Retail lists only, all five verified against published decklists.
- Card data snapshot of 6 October 2026 (prices from 4–5 October). Run in Node against the snapshot, not in a browser against live Scryfall/EDHREC.
- Core adds with alternatives (for example Greater Good or The Great Henge) count as found if either is present.
- Valid Doom core: Batroc → M.O.D.O.K.; Tri-Sentinel → Ultimate Green Goblin; Kang Dynasty → Cool but Rude / Frantic Search; Extract Power → Archfiend of Ifnir / Reanimate; Superior Foes → Taskmaster.

## 4. Experiment 1: package utility (your proposal)

**What was built.** Only the package check changed. Candidate discovery, tagging, tier thresholds, held picks and new-card handling were untouched.

- Role health for ramp, draw, removal and wipes, measured against the app's targets (10 / 10 / 8 / 3):
  - below target: penalty 2 × d × (1 + d ÷ target), where d is the shortfall;
  - up to 20% over target: no penalty;
  - beyond that: penalty 3 × s² ÷ target, where s is the excess past the free 20%. No cap.
- Package utility = sum over swaps of (value of card in − value of card out + small fit bonus) + role health of the resulting deck.
- For each tier, the swap whose removal raises utility most is removed; repeat until no removal helps.
- The old floor rule and the old "challenge each swap" rule were replaced by this. The curve check was kept.
- The penalty weights and the 20% allowance were Claude's choices; your brief left them open.

**Result (28 valid core swaps):**

| | Build 72 | Experiment |
|---|---|---|
| Core cuts found | 25 | 27 |
| Core adds in the final deck | 15 | 15 |
| Core adds offered at any tier | 21 | 20 |
| Wrong cuts | 25 | 26 |
| Wrong adds (final deck) | 34 | 38 |
| Total replacements | 50 | 53 |

Role counts, retail → final deck (Build 72 / experiment):

| Deck | Replacements | Ramp | Draw | Removal | Wipes |
|---|---|---|---|---|---|
| Tramplesaurus Rex | 21 / 21 | 13→15 / 13→13 | 15→11 / 15→10 | 7→7 / 7→8 | 3→3 / 3→3 |
| Wakanda Forever | 6 / 7 | 12→12 / same | 11→10 / same | 10→9 / same | 3→3 / same |
| Avengers Assemble | 7 / 8 | 9→9 / same | 16→14 / same | 6→6 / 6→5 | 4→4 / same |
| Doom Prevails | 8 / 9 | 12→14 / 12→13 | 16→18 / 16→16 | 8→8 / 8→7 | 4→5 / 4→4 |
| Turtle Power | 8 / 8 | 10→10 / same | 13→12 / same | 10→9 / same | 5→4 / same |

- Gained: Make Your Move as a cut (Avengers); Tri-Sentinel → Ultimate Green Goblin (Doom); Kogla (Tramplesaurus).
- Lost: Heroic Intervention (Wakanda); M.O.D.O.K. and Cool but Rude (Doom).

**Sensitivity.** Seven weight settings were tried, from no role penalty to four times the default. Totals barely moved. At four times, Tramplesaurus dropped one replacement and ended at 12 ramp. Keeping the old floors alongside was slightly worse (13 core adds in the final deck).

**Why it falls short, as far as Claude can tell:**

1. The package check can only remove swaps. It cannot replace a ramp pick with a removal pick, so it cannot reallocate a slot.
2. Nearly every proposed swap carries a real value gain. Tramplesaurus swaps gain roughly 1.4 to 11 points each; the role-health change from one swap is usually under 2. Removing a swap therefore rarely raises utility.
3. Removing a higher-tier pick falls back to the cheaper pick for the same card, so the replacement survives.

The over-upgrading comes from the card-value scoring that says each swap is worth making, not from the package check.

## 5. Experiment 2: older rules re-measured by sets

These rules sit in an unshipped version of the engine whose pick loop re-counts the deck's roles after every pick. All are off by default.

- **Saturation:** adding to a role already at or over target costs more the further over it is.
- **Deficit:** giving up a role the deck is short of costs more.
- **Trim:** a bonus for cutting from a role that is over target.
- **No-data protection:** a bonus that protects deck cards with no play data for the commander.
- **Cut limit:** only the N weakest deck cards may be cut.

| | Build 72 | Saturation | Saturation + cut limit 20 | Cut limit 12 only |
|---|---|---|---|---|
| Core cuts found (of 28) | 25 | 26 | 26 | 24 |
| Core adds in the final deck | 15 | 18 | 18 | 15 |
| Wrong cuts | 25 | 27 | 25 | 18 |
| Wrong adds (final deck) | 34 | 34 | 32 | 26 |
| Total replacements | 50 | 53 | 51 | 42 |
| Tramplesaurus replacements | 21 | 21 | 19 | 12 |
| Tramplesaurus ramp, final | 15 | 11 | 11 | 13 |
| Tramplesaurus removal, final | 7 | 8 | 8 | 7 |

- Deficit alone: no change in totals; Tramplesaurus ramp rose to 16.
- Trim: worse (core cuts 24, wrong cuts 31 to 33).
- No-data protection: worse (core cuts fell to 23, then 20, as it was strengthened). Same conflict as Round 2: it protects Commander's Sphere and Paradise Druid.
- Cut limit 12 cuts Tramplesaurus to 12 replacements but finds only 3 of its 6 core cuts and none of its core adds in the final deck.
- Saturation strength between 1.5 and 3 gives nearly the same result.

**Saturation + cut limit 20 against Build 72, by deck:**

- Tramplesaurus Rex: Kogla, Zopandrel and Return of the Wildspeaker enter the final deck; Whiptongue Hydra and Collective Resistance are no longer cut; Greater Good drops to Budget only.
- Avengers Assemble: gains the Make Your Move cut; Captain America, Super-Soldier replaces Captain America's Shield in the final deck; cuts Patriot, Shield Wielder instead of Hawkeye, Avenging Archer.
- Doom Prevails: ramp stays at 12; Archfiend of Ifnir enters the final deck; no longer cuts Titania, Proud Pummeler; **newly cuts Puppet Master, String Puller, Damocles Base, Sword of Kang and Night's Whisper.**
- Wakanda Forever and Turtle Power: no change.

Caution: five decks and 28 swaps is a small sample. The cut limit of 20 is a small gain and may not hold.

## 6. Build 73 (live)

- Import now recognises 561 alternate printed names, for example "Vibranium Dynamo" → Thran Dynamo.
- The example deck is labelled "Example deck: Lathril Elves (auto-built)".
- Recommendations are identical to Build 72 on the benchmark.

## 7. What Claude would like from you

1. **Re-judge Doom Prevails and Wakanda Forever** on the corrected lists (Round 2 handoff), using the Build 72 tables in the appendix. In particular: are the four new Doom cuts in appendix B acceptable or wrong?
2. **Judge Tramplesaurus Rex as sets.** Of the 21 Build 72 cuts and the 19 in appendix B, which cuts are defensible beyond your 6? If many are, the core understates acceptable swaps and "wrong cuts" overstates the problem. If few are, the value scoring is the fault.
3. **Next experiment.** Claude's reading is that a remove-only package check cannot fix allocation. Two candidates, one at a time:
   - let the package step replace a pick with a different candidate for the same cut (touches slot assignment);
   - require a swap's value gain to grow as the number of replacements already accepted grows (touches thresholds, which you excluded this round).
   Which do you want tested first, or is there a third?
4. If you disagree with the role-health penalty shape in section 4, give the shape and weights you intended and Claude will rerun it.

## 8. Not tested

- Nothing was run in a browser against live Scryfall or EDHREC. Build 73's import was tested in Chromium against the saved card snapshot.
- Commanders with little play data (the older fallback engine) were not part of this round.

## Appendix: full recommendation tables

"Weak upgrade" markers are omitted. Role counts are retail → final deck.

### A. Build 72 (live engine; Build 73 gives the same picks)

**Tramplesaurus Rex** (21 replacements; ramp 13 → 15, draw 15 → 11, removal 7 → 7, wipes 3 → 3)

| OUT | Budget | Mid | Apex |
|---|---|---|---|
| Rishkar, Peema Renegade | Topiary Stomper | — | — |
| Challenger Troll | Ghalta the Unstoppable | Lightning Greaves | — |
| Loot, Exuberant Explorer | Frenzied Baloth | Wayward Swordtooth | — |
| Clifftop Lookout | Rampant Growth | Selvala, Heart of the Wilds | Ghalta, Stampede Tyrant |
| Whisperer of the Wilds | Cultivate | Heroic Intervention | — |
| Arasta of the Endless Web | Agonasaur Rex | The Skullspore Nexus | — |
| Scrapshooter | Reclamation Sage | — | Vaultborn Tyrant |
| Paradise Druid | Return of the Wildspeaker | Majestic Genesis | — |
| Dungrove Elder | Kodama's Reach | Defiler of Vigor | Fanatic of Rhonas |
| Whiptongue Hydra | — | Season of Gathering | — |
| Thickest in the Thicket | Greater Good | Railway Brawler | The Great Henge |
| Terrian, World Tyrant | Quakestrider Ceratops | — | — |
| Ripjaw Raptor | Arbor Elf | — | — |
| Curious Altisaur | Nature's Lore | — | — |
| Shamanic Revelation | Wild Growth | — | — |
| Yeva, Nature's Herald | Eternal Witness | — | — |
| Arachnogenesis | Garruk, Primal Hunter | Three Visits | Worldly Tutor |
| Commander's Sphere | Fireshrieker | — | — |
| Collective Resistance | — | Archdruid's Charm | — |
| Harmonize | Thought Vessel | Traverse the Outlands | — |
| Carnage Tyrant | — | Apex Altisaur | — |

**Wakanda Forever** (6 replacements; ramp 12 → 12, draw 11 → 10, removal 10 → 9, wipes 3 → 3)

| OUT | Budget | Mid | Apex |
|---|---|---|---|
| Fleecemane Lion | Bronze Guardian | — | — |
| Divine Visitation | Swiftfoot Boots | — | — |
| Palace Jailer | Jhoira's Familiar | Brightglass Gearhulk | — |
| Queen Mother Ramonda | Mystic Forge | Heroic Intervention | — |
| Harmonize | Dyadrine, Synthesis Amalgam | Chimil, the Inner Sun | — |
| Loyal Retainers | — | Lightning Greaves | Krang, Utrom Warlord |

**Avengers Assemble** (7 replacements; ramp 9 → 9, draw 16 → 14, removal 6 → 6, wipes 4 → 4)

| OUT | Budget | Mid | Apex |
|---|---|---|---|
| Tome of Legends | Agent Phil Coulson | — | — |
| Captain Mar-Vell, Space-Born | Captain America, Wings of Freedom | — | — |
| Love on the Battlefield | SP//dr, Piloted by Peni | — | — |
| Speed, Young Avenger | Daredevil, Man Without Fear | Spectacular Spider-Man | — |
| Hero's Blade | Captain America's Shield | — | — |
| Hawkeye, Avenging Archer | — | Hawkeye, Trick Shot | — |
| Bastion Protector | Matt Murdock, Justice Seeker | — | — |

**Doom Prevails** (8 replacements; ramp 12 → 14, draw 16 → 18, removal 8 → 8, wipes 4 → 5)

| OUT | Budget | Mid | Apex |
|---|---|---|---|
| Batroc the Leaper | Leader, Super-Genius | — | — |
| Syphon Mind | Doom Reigns Supreme | M.O.D.O.K. | — |
| Kang Dynasty | Doctor Doom | Doctor Octopus, Master Planner | Monument to Endurance |
| Superior Foes of Spider-Man | Green Goblin, Revenant | Green Goblin, Nemesis | — |
| Extract Power | Counterspell | Cool but Rude | — |
| Lady Loki, Agent of Chaos | Taskmaster, Mercenary Mimic | — | — |
| Klaw, Master of Sound | Archfiend of Ifnir | Ledger Shredder | Roaming Throne |
| Titania, Proud Pummeler | — | An Offer You Can't Refuse | Crucible of Worlds |

**Turtle Power** (8 replacements; ramp 10 → 10, draw 13 → 12, removal 10 → 9, wipes 5 → 4)

| OUT | Budget | Mid | Apex |
|---|---|---|---|
| Acidic Slime | Michelangelo, Weirdness to 11 | — | — |
| Biogenic Ooze | Mutagen Man, Living Ooze | — | — |
| Rat King, Pale Piper | Michelangelo, Mutant BFF | — | — |
| Harmonize | Mikey & Leo, Chaos & Order | — | — |
| Mole Module | Turtle Van | — | — |
| Krang, the All-Powerful | Sally Pride, Lioness Leader | The Ooze | — |
| Electric Seaweed | Genghis Frog | Dark Leo & Shredder | — |
| Roadkill Rodney | — | — | Doubling Season |

### B. Candidate engine with the saturation rule on and cuts limited to the 20 weakest cards (not shipped)

**Tramplesaurus Rex** (19 replacements; ramp 13 → 11, draw 15 → 13, removal 7 → 8, wipes 3 → 3)

| OUT | Budget | Mid | Apex |
|---|---|---|---|
| Rishkar, Peema Renegade | Topiary Stomper | — | — |
| Challenger Troll | Ghalta the Unstoppable | Lightning Greaves | — |
| Loot, Exuberant Explorer | Rampant Growth | Wayward Swordtooth | — |
| Clifftop Lookout | Eternal Witness | Majestic Genesis | Ghalta, Stampede Tyrant |
| Whisperer of the Wilds | Cultivate | Heroic Intervention | — |
| Arasta of the Endless Web | Frenzied Baloth | The Skullspore Nexus | — |
| Scrapshooter | Reclamation Sage | — | Vaultborn Tyrant |
| Paradise Druid | Kodama's Reach | Defiler of Vigor | — |
| Ripjaw Raptor | Agonasaur Rex | — | — |
| Curious Altisaur | Return of the Wildspeaker | — | — |
| Dungrove Elder | Quakestrider Ceratops | Railway Brawler | — |
| Commander's Sphere | Nature's Lore | Selvala, Heart of the Wilds | — |
| Terrian, World Tyrant | Fireshrieker | — | — |
| Thickest in the Thicket | Greater Good | — | Archdruid's Charm |
| Shamanic Revelation | Hunter's Insight | Momentous Fall | — |
| Arachnogenesis | — | Traverse the Outlands | Worldly Tutor |
| Yeva, Nature's Herald | Kogla, the Titan Ape | — | — |
| Harmonize | — | — | Finale of Devastation |
| Carnage Tyrant | — | — | Zopandrel, Hunger Dominus |

**Wakanda Forever** (6 replacements; ramp 12 → 12, draw 11 → 10, removal 10 → 9, wipes 3 → 3)

| OUT | Budget | Mid | Apex |
|---|---|---|---|
| Fleecemane Lion | Bronze Guardian | — | — |
| Divine Visitation | Swiftfoot Boots | — | — |
| Palace Jailer | Jhoira's Familiar | Brightglass Gearhulk | — |
| Queen Mother Ramonda | Mystic Forge | Heroic Intervention | — |
| Harmonize | Dyadrine, Synthesis Amalgam | Chimil, the Inner Sun | — |
| Loyal Retainers | — | — | Krang, Utrom Warlord |

**Avengers Assemble** (8 replacements; ramp 9 → 9, draw 16 → 15, removal 6 → 6, wipes 4 → 4)

| OUT | Budget | Mid | Apex |
|---|---|---|---|
| Tome of Legends | Agent Phil Coulson | — | — |
| Captain Mar-Vell, Space-Born | Captain America, Wings of Freedom | — | — |
| Love on the Battlefield | SP//dr, Piloted by Peni | — | — |
| Speed, Young Avenger | Daredevil, Man Without Fear | Spectacular Spider-Man | — |
| Make Your Move | — | Captain America, Super-Soldier | — |
| Hero's Blade | Captain America's Shield | Hawkeye, Trick Shot | — |
| Bastion Protector | Matt Murdock, Justice Seeker | — | — |
| Patriot, Shield Wielder | — | Araña, Heart of the Spider | — |

**Doom Prevails** (10 replacements; ramp 12 → 12, draw 16 → 16, removal 8 → 8, wipes 4 → 5)

| OUT | Budget | Mid | Apex |
|---|---|---|---|
| Syphon Mind | Leader, Super-Genius | — | — |
| Batroc the Leaper | Doom Reigns Supreme | — | — |
| Kang Dynasty | Doctor Doom | Doctor Octopus, Master Planner | — |
| Extract Power | Counterspell | Reanimate | — |
| Puppet Master, String Puller | — | Green Goblin, Nemesis | — |
| Superior Foes of Spider-Man | Taskmaster, Mercenary Mimic | — | — |
| Damocles Base, Sword of Kang | Green Goblin, Revenant | M.O.D.O.K. | — |
| Lady Loki, Agent of Chaos | — | — | Roaming Throne |
| Klaw, Master of Sound | — | — | Crucible of Worlds |
| Night's Whisper | — | Cool but Rude | — |

**Turtle Power** (8 replacements; ramp 10 → 10, draw 13 → 12, removal 10 → 9, wipes 5 → 4)

| OUT | Budget | Mid | Apex |
|---|---|---|---|
| Acidic Slime | Michelangelo, Weirdness to 11 | — | — |
| Biogenic Ooze | Mutagen Man, Living Ooze | — | — |
| Rat King, Pale Piper | Michelangelo, Mutant BFF | — | — |
| Harmonize | Mikey & Leo, Chaos & Order | — | — |
| Mole Module | Turtle Van | — | — |
| Krang, the All-Powerful | Sally Pride, Lioness Leader | The Ooze | — |
| Electric Seaweed | Genghis Frog | Dark Leo & Shredder | — |
| Roadkill Rodney | — | — | Doubling Season |

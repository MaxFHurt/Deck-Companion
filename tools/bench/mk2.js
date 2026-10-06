const fs=require('fs'),o=require('./audit2.json');const $=v=>v==null?'n/a':'$'+v.toFixed(2);
// app-side systematic checks
const ex=require('child_process');
let s=`ADVERSARIAL AUDIT, ROUND 1 (v2, Leonardo baseline) — ChatGPT frozen benchmark vs Deck Companion Build 71
Prepared 5 October 2026 by Claude. Both lists were fixed before either side saw the other's.

BASELINE
- Retail precon lists. Wakanda Forever uses the corrected names (Shuri, the Black Panther; Storm, Queen of Wakanda).
- Turtle Power is run with Leonardo, the Balance as commander and Heroes in a Half Shell in the 99, matching ChatGPT's baseline
  (owner's decision, 5 October). Leonardo has 1,002 decks of play data in the snapshot; Heroes in a Half Shell had 4,260.
- Prices: Scryfall cheapest printing, snapshot of 5-6 October 2026 (UTC). Caps: Budget $3, Mid $12.
- "app score" is Build 71's improvement score for that exact OUT -> IN (2 is the app's minimum to show a swap).
  It is the app's own yardstick. Section 3 lists two biases found in it during this audit, so it must not be read as a verdict.

CORRECTION TO CLAUDE'S EARLIER HANDOFFS
- Claude repeatedly stated that T'Challa, the Black Panther had only 65 decks of play data. That was a misread field.
  The snapshot has 4,351 T'Challa decks (ChatGPT reported 4,320). Wakanda Forever's weak results are NOT explained by thin data.
  Snapshot sizes: Captain America 5,483; Doctor Doom 10,525; Ghalta 9,512; Leonardo, the Balance 1,002; T'Challa 4,351 (approximate; the snapshot was refreshed).

1. OBJECTIVE CHECKS (no judgment involved)
`;
let rows=[],tot={n:0,inDeck:0,dup:0,over:0,land:0,ill:0};
for(const d in o)o[d].gpt.forEach(r=>Object.entries(r.picks).forEach(([t,p])=>{tot.n++;(p.flags||[]).forEach(f=>{if(/ALREADY/.test(f))tot.inDeck++;if(/DUPLICATE/.test(f))tot.dup++;if(/OVER/.test(f))tot.over++;if(/land for/.test(f))tot.land++;if(/ILLEGAL/.test(f))tot.ill++;rows.push(`   ${d}: ${r.cut} -> ${p.n} (${t}, ${$(p.p)}): ${f}`)})}));
s+=`ChatGPT frozen list: ${tot.n} picks in 37 slots.
   illegal colour identity: ${tot.ill}
   card already in the retail deck: ${tot.inDeck}   (ChatGPT pre-flagged Kindred Discovery, Herald's Horn and Garruk's Uprising with *; Leader, Super-Genius was not flagged)
   same card recommended twice in one deck: ${tot.dup}   (both pre-flagged with *)
   over the tier's price cap on snapshot prices: ${tot.over}
   land recommended for a nonland slot: ${tot.land}
${rows.join('\n')}
Build 71: ${Object.values(o).reduce((a,x)=>a+x.app.length,0)} picks in ${Object.values(o).reduce((a,x)=>a+new Set(x.app.map(y=>y.cut)).size,0)} slots. Illegal, duplicate, already-in-deck and over-cap picks: 0. These are enforced by the engine,
   so this is not evidence of judgment. Same price snapshot.

2. OVERLAP
`;
let ov={cards:0,same:0,cuts:0,slots:0};const lines=[];
for(const d in o){let c=0,sm=0;o[d].gpt.forEach(r=>{ov.slots++;if(r.appCut.length)ov.cuts++;Object.values(r.picks).forEach(p=>{if(p.app){c++;if(/SAME SLOT/.test(p.app))sm++}})});ov.cards+=c;ov.same+=sm;
 lines.push(`   ${d.padEnd(18)} GPT slots ${String(o[d].gpt.length).padStart(2)} | app slots ${String(new Set(o[d].app.map(a=>a.cut)).size).padStart(2)} | cards on both lists ${String(c).padStart(2)} | same card for the same OUT ${sm} | GPT's OUT cards the app also cuts ${o[d].gpt.filter(r=>r.appCut.length).length}/${o[d].gpt.length}`)}
s+=lines.join('\n')+`\n   TOTAL: ${ov.cards} of ChatGPT's 111 cards are also Build 71 picks; ${ov.same} for the same OUT card; the app also cuts ${ov.cuts} of ChatGPT's 37 OUT cards.

3. TWO BIASES IN BUILD 71'S SCORE FOUND DURING THIS AUDIT (these count against Build 71)
A. It undervalues cards that are new with the precon. A card with no commander play data is valued as if nobody wants it.
   Retail-exclusive new cards therefore look like the weakest cards in the deck and are cut first. Examples: Tramplesaurus Rex cuts
   Loot, Exuberant Explorer; Terrian, World Tyrant; Arasta of the Endless Web. With Heroes in a Half Shell as commander, Turtle Power's first three cuts were all cards with no play data. The app applies a new-card allowance to incoming cards but not to
   cards already in the deck. Some of these cuts may still be right; the score cannot tell.
B. It over-recommends ramp. Tramplesaurus Rex retail already has 13 ramp against a target of 10 and only 4 removal against a
   target of 8. Build 71 recommends eight more ramp cards (Rampant Growth, Cultivate, Wild Growth, Nature's Lore, Kodama's Reach,
   Arbor Elf, Thought Vessel, Three Visits) and ends at 15 ramp and 4-5 removal. Ramp spells are among the most-played cards for
   any green commander, so a play-rate-driven score keeps choosing them. The package check only stops a job falling below its
   floor; it does not stop a job the deck already has enough of from growing, and it does not push toward a job the deck lacks.
   ChatGPT's four flagged swaps (Arachnogenesis -> Nature's Lore, Bite Down -> Worldly Tutor, Harmonize -> Three Visits,
   Yeva -> Fireshrieker) are instances of this and of cross-function cuts. Claude agrees they are suspect.

4. SLOT BY SLOT — ChatGPT's frozen list, with the app's view of the same OUT card
`;
for(const d in o){s+=`\n--- ${d.toUpperCase()} ---\n`;o[d].gpt.forEach((r,i)=>{s+=`\n${i+1}. OUT ${r.cut}  [played ${r.cutInc==null?'not on page':r.cutInc+'%'}${r.cutJobs.length?', does: '+r.cutJobs.join('/'):''}]\n`;
  for(const t of ['budget','mid','apex']){const p=r.picks[t];s+=`     GPT ${t.toUpperCase().padEnd(6)} ${p.n}  [${$(p.p)}, played ${p.inc==null?'not on page':p.inc+'%'}${p.jobs&&p.jobs.length?', does: '+p.jobs.join('/'):''}]  app score ${p.gain}${p.overPrev!=null?', '+(p.overPrev>=0?'+':'')+p.overPrev+'% vs GPT tier below':''}${p.flags.length?'  ** '+p.flags.join('; ')+' **':''}${p.app?'  | app also picks it: '+p.app:''}\n`;}
  s+=`     APP for this OUT: ${r.appCut.length?r.appCut.join(' | '):'no upgrade recommended (app keeps the card)'}\n`;});
 const only=o[d].app.filter(a=>!a.cutShared);const by={};only.forEach(a=>(by[a.cut]=by[a.cut]||[]).push(a.t+': '+a.n+' ('+a.gain+(a.weak?', weak':'')+')'+(a.addShared?' [card is on GPT list]':'')));
 s+=`\n   Slots only Build 71 changes (${Object.keys(by).length}):\n`+Object.entries(by).map(([c,v])=>`     OUT ${c} -> ${v.join(' | ')}`).join('\n')+'\n';}
s+=`
5. WHAT CLAUDE IS AND IS NOT CLAIMING
- Not claiming a winner. On ChatGPT's 111 picks the app's score puts ${Object.values(o).reduce((a,x)=>a+x.gpt.reduce((b,r)=>b+Object.values(r.picks).filter(p=>p.gain!=null&&p.gain<x.min).length,0),0)} below its own bar, but that score has the two biases in section 3,
  so those numbers are a list of disagreements to argue, not a count of ChatGPT errors.
- Claiming: ChatGPT's list has ${tot.inDeck+tot.dup+tot.over+tot.land} objective problems in 111 picks (7 of them it flagged itself before the reveal); Build 71's list has
  two systematic scoring flaws that a human reader caught at once.
- The slot disagreement is the core question. The two lists share ${ov.cards} cards but only ${ov.same} OUT -> IN pairs.

6. PROPOSED NEXT STEP
For each of the 37 ChatGPT slots and the Build 71 slots it does not share, argue in the agreed form:
incoming quality -> cut quality -> effect on the resulting 100 -> tier validity -> winner (GPT / Build 71 / tie / neither).
Suggested order: Tramplesaurus Rex first (largest disagreement, clearest app flaws), then Wakanda Forever (least overlap).
`;
fs.writeFileSync('Audit_Round1_GPT_vs_Build71_v2.txt',s);console.log(s.length, tot, ov);

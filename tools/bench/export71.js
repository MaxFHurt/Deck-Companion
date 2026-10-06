const {run,ctx,edh,deck,fs}=require('./h.js');const WB=JSON.parse(fs.readFileSync(__dirname+'/workbook_pre.json'));
const order=['Turtle Power','Tramplesaurus Rex','Wakanda Forever','Avengers Assemble','Doom Prevails'];const $=v=>v==null?'no price':'$'+v.toFixed(2);
let out=`DECK COMPANION — BUILD 71 — UPGRADE RECOMMENDATIONS FOR FIVE RETAIL PRECONS (v4)
Generated 5 October 2026 by Claude for the owner to give to ChatGPT.

HOW THIS WAS PRODUCED
- Each deck is the retail precon list (the workbook rolled back through its "Original Card" column; alternate printed names
  replaced by real card names). No installed upgrades are in these lists.
- The recommendations come from the live app's own engine (Build 71, engine.js), run on a data snapshot: Scryfall cards and
  cheapest-printing prices, and each commander's EDHREC page, pulled 5-6 October 2026 (UTC). It was not run in a browser against live data.
- The app set each deck's build priorities automatically from its commander, as it does when a precon is loaded.

WHAT CHANGED IN v4
- All five retail lists are now checked against the published decklists (Wizards' Marvel Super Heroes Commander decklist page;
  playgroup.gg for Tramplesaurus Rex; Turtle Power checked earlier). Avengers Assemble and Tramplesaurus Rex matched exactly.
- DOOM PREVAILS had three wrong cards in v1-v3 and is corrected here: the retail deck has Black Market Connections (v3 wrongly had
  Leader, Super-Genius), Abomination, World Ravager and Puppet Master, String Puller (v3 had the wrong versions of both).
- WAKANDA FOREVER had one wrong card and is corrected: the retail deck has Queen Mother Ramonda (v3 wrongly had The Vision).
- Doom Prevails and Wakanda Forever recommendations below therefore differ from v3 and supersede it. The other three decks are unchanged.
- Turtle Power: Leonardo, the Balance is the commander; Heroes in a Half Shell is in the 99 (as in v3).
- Engine: live Build 71, unchanged.

HOW TO READ IT
- Each numbered entry is one card in the deck and what the app would replace it with.
- Budget = best card under $3. Mid = under $12. Apex = any price. Tiers are ceilings, so a cheap card can be the Mid or Apex pick.
- First step over the current card is rated Solid / Strong / Major (improvement score 2-4 / 4-7 / 7+).
- A Mid pick is a full step at +10% over Budget. An Apex pick is a full step at +10% over Mid and +20% over Budget.
- WEAK UPGRADE = better than the tier below, but short of a full step. Shown as an option; left out of the tier totals.
- When a tier has no pick, the best pick below it is that slot's card for that tier. The top full pick is the slot's APEX CARD.
- "score" is the app's improvement score for the swap. "played" is the share of that commander's EDHREC decks running the card.
- Cards not listed have no recommended upgrade: the app treats them as already Apex for this deck.
`;
for(const name of order){const w=WB[name],d=deck('Commander\n1 '+w.commander+'\n\nDeck\n'+w.deck.map(x=>x[0]+' '+x[1]).join('\n'));const n=edh(d.commander);ctx.__d=d;
 const r=run(`(()=>{const d=__d,R=upgradePaths(d),A=R.A||analyze(d),cx=A.ctx,K=['budget','mid','apex'];const inc=n=>{const x=cx.edh&&cx.edh.map.get(norm(n));return x?Math.round(x.inc*100):null};
  const real=p=>!!p&&!p.beaten&&!p.weak;
  const paths=R.paths.map(L=>{const c=find(L.cut);const o={};K.forEach((t,i)=>{const p=L.opts[t];if(!p)return;const a=find(p.add);let prev=null,pt='';for(let k=i-1;k>=0;k--){if(L.opts[K[k]]){prev=L.opts[K[k]];pt=K[k];break}}
    o[t]={n:p.add,p:a.p,gain:p.gain,weak:!!p.weak,why:p.why,inc:inc(p.add),ty:mainType(a),pct:prev?Math.round(100*(p.gain-prev.gain)/Math.max(2,p.cv+prev.gain)):null,over:pt}});
   let top=null;for(let k=2;k>=0;k--){if(real(L.opts[K[k]])){top=K[k];break}}
   return {cut:L.cut,cp:c.p,cinc:inc(L.cut),cty:mainType(c),o,top}});
  const sum={};K.forEach(t=>{let n=0,cost=0;R.paths.forEach(L=>{let b=null;for(let k=K.indexOf(t);k>=0;k--){if(real(L.opts[K[k]])){b=L.opts[K[k]];break}}if(!b)return;n++;cost+=(find(b.add).p||0)-(find(b.cut).p||0)});sum[t]={n,cost,pack:R.pack&&R.pack[t]}});
  return {smart:R.smart,aims:d.aims.map(a=>a==='tribal'?(cx.tribe+' tribal'):THEMES[a].label),ident:cx.ident.join(''),decks:EDH.decks,health:{lands:A.lands,ramp:A.roles.ramp,draw:A.roles.draw,removal:A.roles.removal,wipe:A.roles.wipe,avg:+A.avg.toFixed(2),price:Math.round(A.price)},T:A.T,
   fixes:R.fixes.map(p=>p.cut+' -> '+p.add+' ('+(p.fix?p.cutWhy[0]:p.why[0])+')'),drops:(R.drops||[]).map(x=>x.n+' ('+x.why[0]+')'),paths,sum,cards:d.cards.map(e=>{const c=find(e.n);return {n:e.n,q:e.q,ty:c?mainType(c):'?',p:c?c.p:null}})}})()`);
 out+=`\n${'='.repeat(100)}\n${name.toUpperCase()}\n${'='.repeat(100)}\nCommander: ${w.commander}   Colour identity: ${r.ident}\nBuild priorities set by the app: ${r.aims.join(' > ')||'none'}\nPlay data: ${r.decks.toLocaleString()} ${w.commander.split(',')[0]} decks on EDHREC (${n} cards on the page). Method used: ${r.smart?'play-data method':'older fallback engine'}\n`;
 out+=`Retail deck as the app sees it: lands ${r.health.lands} (target ${r.T.lands}), ramp ${r.health.ramp} (${r.T.ramp}), card draw ${r.health.draw} (${r.T.draw}), removal ${r.health.removal} (${r.T.removal}), board wipes ${r.health.wipe} (${r.T.wipe}), average mana value ${r.health.avg}, deck price about $${r.health.price}\n`;
 out+=`\nTIER TOTALS (best full pick per slot up to that tier)\n`;
 for(const t of ['budget','mid','apex']){const s=r.sum[t],k=s.pack;out+=`  ${t.toUpperCase().padEnd(7)} ${String(s.n).padStart(2)} swaps, ${s.cost>=0?'+':'-'}$${Math.abs(s.cost).toFixed(0)}`+(k?`   after applying all: ramp ${k.jobs.ramp.join('->')}, draw ${k.jobs.draw.join('->')}, removal ${k.jobs.removal.join('->')}, wipes ${k.jobs.wipe.join('->')}, avg mana value ${k.avg.join('->')}`+(k.removed?`; ${k.removed} swap(s) removed by the package check`:''):'')+'\n';}
 if(r.fixes.length||r.drops.length){out+=`\nFIXES THE APP SAYS THE RETAIL DECK NEEDS\n`+r.fixes.concat(r.drops).map(x=>'  '+x).join('\n')+'\n';}
 out+=`\nUPGRADES — ${r.paths.length} cards\n`;
 r.paths.forEach((L,i)=>{out+=`\n${String(i+1).padStart(2)}. REPLACE ${L.cut}  [${L.cty}, ${$(L.cp)}, played ${L.cinc==null?'not on page':L.cinc+'%'}]\n`;
  for(const t of ['budget','mid','apex']){const x=L.o[t];if(!x){let b=null;for(const k of ['budget','mid','apex'].slice(0,['budget','mid','apex'].indexOf(t)).reverse()){if(L.o[k]&&!L.o[k].weak){b=k;break}}out+=`      ${t.toUpperCase().padEnd(7)} ${b?'same as '+b.toUpperCase():'nothing under this ceiling improves on the card'}\n`;continue;}
   const tag=x.weak?`WEAK UPGRADE, +${Math.max(1,x.pct)}% over ${x.over}`:x.pct==null?(x.gain>=7?'Major upgrade':x.gain>=4?'Strong upgrade':'Solid upgrade')+' over current card':`+${x.pct}% over ${x.over}`;
   out+=`      ${t.toUpperCase().padEnd(7)} ${x.n}  [${x.ty}, ${$(x.p)}, played ${x.inc==null?'not on page':x.inc+'%'}, score ${x.gain}]  ${tag}${L.top===t?'  <- APEX CARD for this slot':''}\n`+(x.why&&x.why.length?`              why: ${x.why.join('; ')}\n`:'');}});
 const cutSet=new Set(r.paths.map(L=>L.cut));
 out+=`\nRETAIL DECKLIST (100 cards; * = has a recommended upgrade above)\n  1 ${w.commander} (commander)\n`+r.cards.slice().sort((a,b)=>a.ty.localeCompare(b.ty)||a.n.localeCompare(b.n)).map(c=>`  ${c.q} ${c.n}${cutSet.has(c.n)?' *':''}  [${c.ty}]`).join('\n')+'\n';
 console.log(name,r.smart,r.paths.length,JSON.stringify(Object.fromEntries(Object.entries(r.sum).map(([t,s])=>[t,s.n]))),'fixes',r.fixes.length,'drops',r.drops.length);}
fs.writeFileSync(__dirname+'/DeckCompanion_Build71_Five_Precons_v4.txt',out);console.log(out.length,'chars');

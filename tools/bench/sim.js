const {run,ctx,edh,deck,fs}=require('./h.js');const WB=JSON.parse(fs.readFileSync(__dirname+'/workbook_pre.json'));const out={};
run(`function __sum(R){const o=[];R.paths.forEach(L=>['budget','mid','apex'].forEach(t=>{const p=L.opts[t];if(p&&!p.beaten){const c=find(p.add);o.push({cut:L.cut,t,n:p.add,p:c.p,sc:c.sc,pair:JSON.parse(JSON.stringify(p))})}}));return o}
LOCK_MARGIN=${+process.env.LM||2};var __seed=${+process.env.SEED||7};var process_pin=${process.env.NOPIN?0:1};function __rnd(){__seed=(__seed*1103515245+12345)%2147483648;return __seed/2147483648}`);
for(const [name,w] of Object.entries(WB)){const d=deck('Commander\n1 '+w.commander+'\n\nDeck\n'+w.deck.map(x=>x[0]+' '+x[1]).join('\n'));edh(d.commander);ctx.__d=d;
 out[name]=run(`(()=>{const d=__d;const base=__sum(upgradePaths(d));if(typeof TIERS==='undefined'||!${process.env.SIM?1:0})return {base};
  // day 0: lock every Budget and Mid pick at today's price
  const recP={};base.forEach(x=>{if(x.t!=='apex')recP[norm(x.n)]={t:x.t,p:x.p,pair:process_pin?x.pair:undefined}});
  // market move: every non-land card drifts +/-10%; one in six recommended Budget/Mid picks spikes x2 to x4
  const old=new Map();LIB.forEach(c=>{if(c.p!=null){old.set(c,c.p);c.p=+(c.p*(0.9+0.2*__rnd())).toFixed(2)}});
  const spiked=[];base.forEach(x=>{if(x.t!=='apex'&&__rnd()<1/6){const c=find(x.n);c.p=+(old.get(c)*(2+2*__rnd())).toFixed(2);spiked.push(x.n)}});
  const where=(S,n)=>{const h=S.find(y=>y.n===n);return h?h.t:'gone'};const slot=(S,x)=>S.some(y=>y.n===x.n&&y.t===x.t&&y.cut===x.cut);
  delete d.recP;const noLock=__sum(upgradePaths(d));d.recP=recP;const RL=upgradePaths(d);const lock=__sum(RL);
  const bm=base.filter(x=>x.t!=='apex');
  const res={picks:bm.length,spiked:spiked.length,sameSlotNoLock:bm.filter(x=>slot(noLock,x)).length,sameSlot:bm.filter(x=>slot(lock,x)).length,unlock:(RL.unlock||[]).length,dupes:lock.length-new Set(lock.map(x=>x.n)).size,total:lock.length,
   noLock:{same:bm.filter(x=>where(noLock,x.n)===x.t).length,moved:bm.filter(x=>!['gone',x.t].includes(where(noLock,x.n))).length,gone:bm.filter(x=>where(noLock,x.n)==='gone').length},
   lock:{same:bm.filter(x=>where(lock,x.n)===x.t).length,moved:bm.filter(x=>!['gone',x.t].includes(where(lock,x.n))).length,gone:bm.filter(x=>where(lock,x.n)==='gone').length},
   drift:bm.filter(x=>{const c=find(x.n);return where(lock,x.n)===x.t&&c.p>TIERS[x.t].cap&&c.p<=TIERS[x.t].cap*1.5}).length,
   popups:bm.filter(x=>{const c=find(x.n);return where(lock,x.n)===x.t&&c.p>TIERS[x.t].cap*1.5}).map(x=>x.n+' ('+x.t+' $'+x.p+' -> $'+find(x.n).p+')'),
   lostLocked:bm.filter(x=>where(lock,x.n)!==x.t).map(x=>x.n+' ('+x.t+' -> '+where(lock,x.n)+', $'+x.p+' -> $'+find(x.n).p+')')};
  old.forEach((p,c)=>c.p=p);delete d.recP;return {base,res};})()`);}
fs.writeFileSync(__dirname+'/'+(process.env.O||'sim.json'),JSON.stringify(out,(k,v)=>k==='pair'?undefined:v));
const T={};for(const d in out){const b=out[d].base,c=t=>b.filter(x=>x.t===t).length;console.log(d.padEnd(18),'budget',c('budget'),'mid',c('mid'),'apex',c('apex'),'total',b.length,out[d].res?JSON.stringify(out[d].res,null,0):'')}

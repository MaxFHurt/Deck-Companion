process.env.WEB=__dirname+'/web71';const {run,ctx,edh,deck,fs}=require('./h.js');const WB=JSON.parse(fs.readFileSync(__dirname+'/workbook_pre.json')),FR=require('./frozen.json'),ALT=require('./data/alt.json');
const out={};
for(const name of Object.keys(FR)){const w=WB[name],d=deck('Commander\n1 '+w.commander+'\n\nDeck\n'+w.deck.map(x=>x[0]+' '+x[1]).join('\n'));edh(d.commander);ctx.__d=d;ctx.__f=FR[name].map(r=>Object.fromEntries(Object.entries(r).map(([k,v])=>[k,ALT[v]||v])));
 out[name]=run(`(()=>{const d=__d,R=upgradePaths(d),SP=__SP,cx=ctxOf(d),K=['budget','mid','apex'],cap={budget:3,mid:12,apex:Infinity};const inDeck=new Set(d.cards.map(e=>norm(e.n)));inDeck.add(norm(d.commander));
  const app=[];R.paths.forEach(L=>K.forEach(t=>{const p=L.opts[t];if(p)app.push({cut:L.cut,t,n:p.add,gain:p.gain,weak:!!p.weak})}));
  const seen=new Map();const inc=c=>{const e=SP.E(c);return e?Math.round(e.inc*100):null};
  const gpt=__f.map(r=>{const cu=SP.cuts.find(x=>norm(x.n)===norm(r.cut)),cc=find(r.cut);const row={cut:r.cut,cutFound:!!cc,cutInDeck:!!cc&&inDeck.has(cc._n),cutInc:cc?inc(cc):null,cutVal:cu?+cu.v.toFixed(2):null,cutJobs:cu?cu.jobs:[],appCut:app.filter(a=>norm(a.cut)===norm(r.cut)).map(a=>a.t+': '+a.n+(a.weak?' (weak)':'')),picks:{}};let prev=null,bud=null;
   K.forEach(t=>{const c=find(r[t]);if(!c){row.picks[t]={n:r[t],err:'card not found'};return;}const fl=[];if(!c.ci.every(k=>cx.ident.includes(k)))fl.push('ILLEGAL colour identity ('+c.ci.join('')+')');if(inDeck.has(c._n))fl.push('ALREADY IN RETAIL DECK');if(seen.has(c._n))fl.push('DUPLICATE (also for '+seen.get(c._n)+')');seen.set(c._n,r.cut);if(c.p!=null&&c.p>cap[t])fl.push('OVER '+t.toUpperCase()+' CAP');if(tags(c).land&&cc&&!tags(cc).land)fl.push('land for nonland');
    const a=SP.mk(c);const g=cu?+SP.delta(cu,a).toFixed(2):null;const ap=app.find(x=>norm(x.n)===c._n);
    const pct=(lo)=>lo==null||g==null?null:Math.round(100*(g-lo)/Math.max(2,cu.v+lo));
    row.picks[t]={n:c.n,p:c.p,inc:inc(c),jobs:a.jobs,gain:g,flags:fl,overPrev:pct(prev),overBudget:t==='apex'?pct(bud):null,app:ap?(ap.t+' for '+ap.cut+(norm(ap.cut)===norm(r.cut)?' [SAME SLOT]':'')):null};
    if(g!=null&&!fl.some(f=>/ILLEGAL|ALREADY|DUPLICATE/.test(f))){prev=g;if(t==='budget')bud=g;}});
   return row});
  const gcuts=new Set(__f.map(r=>norm(r.cut))),gadds=new Set(__f.flatMap(r=>K.map(t=>{const c=find(r[t]);return c?c._n:''})));
  return {gpt,app:app.map(a=>Object.assign(a,{cutShared:gcuts.has(norm(a.cut)),addShared:gadds.has(norm(a.n))})),min:SP.mMin}})()`);}
fs.writeFileSync(__dirname+'/audit2.json',JSON.stringify(out,null,1));
let T={picks:0,illegal:0,inDeck:0,dup:0,over:0,nf:0,belowBar:0,neg:0,found:0,same:0};
for(const d in out){const o=out[d];let t={picks:0,illegal:0,inDeck:0,dup:0,over:0,nf:0,belowBar:0,neg:0,found:0,same:0};o.gpt.forEach(r=>Object.values(r.picks).forEach(p=>{t.picks++;if(p.err){t.nf++;return}const f=p.flags.join();if(/ILLEGAL/.test(f))t.illegal++;if(/ALREADY/.test(f))t.inDeck++;if(/DUPLICATE/.test(f))t.dup++;if(/OVER/.test(f))t.over++;if(p.gain!=null&&p.gain<o.min)t.belowBar++;if(p.gain!=null&&p.gain<0)t.neg++;if(p.app)t.found++;if(p.app&&/SAME SLOT/.test(p.app))t.same++}));
 const cutsNot=o.gpt.filter(r=>!r.cutInDeck).map(r=>r.cut);console.log(d.padEnd(18),JSON.stringify(t),'| GPT cuts the app also cuts',o.gpt.filter(r=>r.appCut.length).length+'/'+o.gpt.length,cutsNot.length?'| cut not in retail list: '+cutsNot.join(', '):'','| app picks',o.app.length,'app adds GPT also has',o.app.filter(a=>a.addShared).length);for(const k in t)T[k]+=t[k];}
console.log('TOTAL',JSON.stringify(T));

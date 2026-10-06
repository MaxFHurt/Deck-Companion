// CUT SET / ADD SET benchmark against the valid adjudicated core (28 swaps; 3 invalid Doom swaps excluded).
const B=__dirname;const {run,ctx,edh,deck,fs}=require(B+'/h.js');const WB=JSON.parse(fs.readFileSync(B+'/workbook_pre.json')),CORE=JSON.parse(fs.readFileSync(B+'/core.json'));
CORE['Doom Prevails']=CORE['Doom Prevails'].filter(([c])=>!['Abomination','Puppet Master','Lady Loki'].includes(c));
const nm=x=>String(x).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g,'').replace(/[^a-z0-9]/g,'');const pre=(a,b)=>nm(a).startsWith(nm(b));
const TO=['budget','mid','apex'];
function go(P){run('Object.assign(SMART,{pkg:0,pkgFloor:0,hU:2,hO:3,hS:0.2},'+(P||'{}')+')');const out={};
 for(const name of Object.keys(CORE)){const w=WB[name],d=deck('Commander\n1 '+w.commander+'\n\nDeck\n'+w.deck.map(x=>x[0]+' '+x[1]).join('\n'));edh(d.commander);ctx.__d=d;
  const r=run(`(()=>{const R=upgradePaths(__d);return {paths:R.paths.map(L=>({cut:L.cut,o:Object.fromEntries(Object.entries(L.opts).map(([t,p])=>[t,p.add]))})),pack:R.pack&&R.pack.apex&&R.pack.apex.jobs}})()`);
  const C=CORE[name],cuts=r.paths.map(L=>L.cut),fin=r.paths.map(L=>{for(let k=2;k>=0;k--)if(L.o[TO[k]])return L.o[TO[k]]}),all=r.paths.flatMap(L=>Object.values(L.o));
  const cutHit=C.filter(([c])=>cuts.some(x=>pre(x,c))).map(x=>x[0]),addHit=C.filter(([c,ins])=>fin.some(a=>ins.some(i=>pre(a,i)))).map(x=>x[1][0]),addAny=C.filter(([c,ins])=>all.some(a=>ins.some(i=>pre(a,i)))).map(x=>x[1][0]);
  const fpCut=cuts.filter(x=>!C.some(([c])=>pre(x,c))),fpAdd=fin.filter(a=>!C.some(([c,ins])=>ins.some(i=>pre(a,i))));
  out[name]={core:C.length,slots:cuts.length,cutHit,addHit,addAny,fpCut,fpAdd,jobs:r.pack,cuts,fin,rows:r.paths};}
 return out;}
module.exports={go};
if(require.main===module){const cfgs=process.argv.slice(2);const base=go('{pkg:0}');
 const tot=o=>{const t={core:0,slots:0,cut:0,add:0,any:0,fpc:0,fpa:0};for(const k in o){const x=o[k];t.core+=x.core;t.slots+=x.slots;t.cut+=x.cutHit.length;t.add+=x.addHit.length;t.any+=x.addAny.length;t.fpc+=x.fpCut.length;t.fpa+=x.fpAdd.length}return t};
 const show=(lab,o)=>{console.log('\n== '+lab);for(const k in o){const x=o[k],j=x.jobs;console.log(k.padEnd(18),'core',x.core,'| slots',String(x.slots).padStart(2),'| cuts hit',x.cutHit.length,'| adds hit (final)',x.addHit.length,'(any tier '+x.addAny.length+')','| wrong cuts',String(x.fpCut.length).padStart(2),'| wrong adds',String(x.fpAdd.length).padStart(2),'| ramp',j.ramp.join('>'),'draw',j.draw.join('>'),'rem',j.removal.join('>'),'wipe',j.wipe.join('>'));
   if(o!==base){const b=base[k];const lc=b.cutHit.filter(c=>!x.cutHit.includes(c)),la=b.addAny.filter(c=>!x.addAny.includes(c)),gc=x.cutHit.filter(c=>!b.cutHit.includes(c)),ga=x.addAny.filter(c=>!b.addAny.includes(c));
    if(lc.length||la.length)console.log('     LOST  cuts:',lc.join(', ')||'-','| adds:',la.join(', ')||'-');if(gc.length||ga.length)console.log('     GAINED cuts:',gc.join(', ')||'-','| adds:',ga.join(', ')||'-');
    if(process.env.V){const dc=b.cuts.filter(c=>!x.cuts.includes(c)),nc=x.cuts.filter(c=>!b.cuts.includes(c));console.log('     slots dropped:',dc.join(', ')||'-');console.log('     slots new:',nc.join(', ')||'-');}}
   if(process.env.VV)x.rows.forEach(L=>console.log('        '+L.cut+' -> '+Object.entries(L.o).map(([t,n])=>t[0]+':'+n).join(' / ')));}
  const t=tot(o);console.log('TOTAL'.padEnd(18),'core',t.core,'| slots',t.slots,'| cuts hit',t.cut,'| adds hit (final)',t.add,'(any tier '+t.any+')','| wrong cuts',t.fpc,'| wrong adds',t.fpa);};
 show('Build 72 (switch off)',base);cfgs.forEach(c=>show(c,go(c)));}

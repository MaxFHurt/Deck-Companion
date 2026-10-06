const {run,ctx,edh,deck,fs}=require('./h.js');const WB=JSON.parse(fs.readFileSync(__dirname+'/workbook_pre.json')),CORE=require('./core.json');
const nm=x=>String(x).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g,'').replace(/[^a-z0-9]/g,'');const pre=(a,b)=>nm(a).startsWith(nm(b));
if(process.env.P)try{run('Object.assign(SMART,'+process.env.P+')')}catch(e){}
let T={core:0,pair:0,cut:0,add:0,slots:0,extra:0,picks:0};const V=process.env.V;
for(const name of Object.keys(CORE)){const w=WB[name],d=deck('Commander\n1 '+w.commander+'\n\nDeck\n'+w.deck.map(x=>x[0]+' '+x[1]).join('\n'));edh(d.commander);ctx.__d=d;
 const r=run(`(()=>{const R=upgradePaths(__d);return {paths:R.paths.map(L=>({cut:L.cut,o:Object.fromEntries(Object.entries(L.opts).map(([t,p])=>[t,p.add+(p.weak?' (weak)':'')])),adds:Object.values(L.opts).map(p=>p.add)})),pack:R.pack&&R.pack.apex&&R.pack.apex.jobs}})()`);
 const C=CORE[name];let pair=0,cut=0,add=0;const allAdds=r.paths.flatMap(L=>L.adds);const miss=[];
 C.forEach(([co,ins])=>{const L=r.paths.find(L=>pre(L.cut,co));const p=L&&L.adds.some(a=>ins.some(i=>pre(a,i)));if(p)pair++;else miss.push(co+' -> '+ins[0]+(L?' [app: '+Object.values(L.o).join(' / ')+']':allAdds.some(a=>ins.some(i=>pre(a,i)))?' [card found, other slot]':' [not found]'));if(L)cut++;if(allAdds.some(a=>ins.some(i=>pre(a,i))))add++;});
 const extra=r.paths.filter(L=>!C.some(([co])=>pre(L.cut,co)));
 T.core+=C.length;T.pair+=pair;T.cut+=cut;T.add+=add;T.slots+=r.paths.length;T.extra+=extra.length;T.picks+=allAdds.length;
 console.log(name.padEnd(18),'core',C.length,'| exact',pair,'| cut found',cut,'| card found',add,'| app slots',r.paths.length,'| extra slots',extra.length,r.pack?'| ramp '+r.pack.ramp.join('>')+' draw '+r.pack.draw.join('>')+' removal '+r.pack.removal.join('>'):'');
 if(V){miss.forEach(m=>console.log('     MISS  '+m));extra.forEach(L=>console.log('     EXTRA '+L.cut+' -> '+Object.entries(L.o).map(([t,n])=>t[0]+':'+n).join(' / ')))}}
console.log((process.env.P||'{}').padEnd(40),'EXACT',T.pair+'/'+T.core,'| cut',T.cut,'| card',T.add,'| slots',T.slots,'| EXTRA',T.extra,'| picks',T.picks);

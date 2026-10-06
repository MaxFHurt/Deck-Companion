const {run,ctx,edh,deck,fs}=require('./h.js');const WB=JSON.parse(fs.readFileSync(__dirname+'/workbook_pre.json')),A=require('./out9.json');
const P=JSON.parse(process.env.P||'{}');run(`Object.assign(SMART,${JSON.stringify(P)})`);
const nm=x=>x.toLowerCase().split(' // ')[0].replace(/[^a-z0-9]/g,'');const serves=x=>x.inc>=0.1||x.syn>=0.1||x.fit>=5,beats=x=>x.delta!=null&&x.delta>=2;
let T=[0,0,0,0,0,0,0,0,0,0];const t0=Date.now();
for(const [name,w] of Object.entries(WB)){const d=deck('Commander\n1 '+w.commander+'\n\nDeck\n'+w.deck.map(x=>x[0]+' '+x[1]).join('\n'));edh(d.commander);ctx.__d=d;
 const r=run(`(()=>{const R=upgradePaths(__d);const o=[];R.paths.forEach(L=>['budget','mid','apex'].forEach(t=>{const p=L.opts[t];if(p)o.push({cut:L.cut,t,n:p.add,why:p.why,nw:/New card/.test(p.why.join())})}));return {o,smart:R.smart,fix:R.fixes.length}})()`);
 const app=r.o,an=new Set(app.map(x=>nm(x.n)));const g=A[name].gpt.filter(x=>x.legal),hit=g.filter(x=>an.has(nm(x.add))),same=hit.filter(x=>app.some(y=>nm(y.n)===nm(x.add)&&nm(y.cut)===nm(x.cut)));
 const cuts=[...new Set(g.map(x=>nm(x.cut)))],ac=new Set(app.map(x=>nm(x.cut))),sc=cuts.filter(c=>ac.has(c)).length,ok=g.filter(x=>serves(x)&&beats(x)),okHit=ok.filter(x=>an.has(nm(x.add))).length;
 const c=t=>app.filter(x=>x.t===t).length;[app.length,hit.length,g.length,same.length,sc,cuts.length,okHit,ok.length,app.filter(x=>x.nw).length].forEach((v,i)=>T[i]+=v);
 if(!process.env.Q)console.log(name.padEnd(18),'smart',r.smart,'| B/M/A',c('budget')+'/'+c('mid')+'/'+c('apex'),'| found',hit.length+'/'+g.length,'| same slot',same.length,'| cuts',sc+'/'+cuts.length,'| provable',okHit+'/'+ok.length,'| new-card picks',app.filter(x=>x.nw).length);
 if(process.env.V)app.forEach(x=>console.log('    '+x.t.padEnd(7)+(x.cut+' -> '+x.n).padEnd(70)+x.why.join(' · ')));}
console.log((process.env.P||'{}').padEnd(28),'picks',T[0],'| found',T[1]+'/'+T[2],'('+Math.round(100*T[1]/T[2])+'%) | same slot',T[3],'| cuts',T[4]+'/'+T[5],'| provable',T[6]+'/'+T[7],'| new-card picks',T[8],'|',Math.round((Date.now()-t0)/5)+'ms/deck');

const {run,ctx,edh,deck,fs}=require('./h.js');const WB=JSON.parse(fs.readFileSync(__dirname+'/workbook_pre.json')),INS=require('./installed.json');
const nm=x=>String(x).toLowerCase().split(' // ')[0].replace(/[^a-z0-9]/g,'');const TT=['budget','mid','apex'];let G={};const lines=[];
for(const [name,w] of Object.entries(WB)){const d=deck('Commander\n1 '+w.commander+'\n\nDeck\n'+w.deck.map(x=>x[0]+' '+x[1]).join('\n'));edh(d.commander);const cxE=run('EDH');if(process.env.NOEDH)run("EDH={key:'',map:null,decks:0,state:'fail'}");try{if(process.env.P&&process.env.P[0]==='{')run('Object.assign(SMART,'+process.env.P+')')}catch(e){}ctx.__d=d;ctx.__w=w.recs;ctx.__E=cxE;
 const r=run(`(()=>{const R=upgradePaths(__d),cx=ctxOf(__d);const o=[];R.paths.forEach(L=>['budget','mid','apex'].forEach(t=>{const p=L.opts[t];if(p)o.push({cut:L.cut,t,n:p.add})}));
  const sheet=[];__w.forEach(r=>['budget','mid','apex'].forEach(t=>{if(!r[t])return;const c=find(r[t]);sheet.push({cut:r.cut,t,n:c?c.n:r[t],p:c?c.p:null,legal:!!c&&c.ci.every(k=>cx.ident.includes(k)),inc:c&&__E&&__E.map?((__E.map.get(c._n)||{}).inc||0):0})}));
  const pk=R.pack||{};return {o,sheet,thin:R.thin,smart:R.smart,pack:Object.fromEntries(Object.entries(pk).map(([t,x])=>[t,x.removed+' removed; '+Object.entries(x.jobs).map(([j,v])=>j+' '+v[0]+'>'+v[1]).join(' ')+' avg '+x.avg.join('>')])),size:__d.cards.reduce((s,x)=>s+x.q,0)+1,unk:analyze(__d).unknown}})()`);
 const app=r.o,ins=new Set(INS[name].map(x=>nm(x.new)));const where=n=>{const h=app.find(y=>nm(y.n)===nm(n));return h||null};
 const row={deck:name,app:app.length,bma:['budget','mid','apex'].map(t=>app.filter(x=>x.t===t).length).join('/'),thin:r.thin};if(process.env.V)console.log(r.pack);
 for(const grp of ['installed','other']){const S=r.sheet.filter(x=>x.legal&&(grp==='installed')===ins.has(nm(x.n)));const f=S.filter(x=>where(x.n));row[grp]={n:S.length,found:f.length,sameTier:f.filter(x=>where(x.n).t===x.t).length,sameSlot:f.filter(x=>nm(where(x.n).cut)===nm(x.cut)).length};
  if(grp==='installed')S.forEach(x=>{const h=where(x.n);lines.push('  '+name.padEnd(18)+(x.cut+' -> '+x.n).padEnd(64)+x.t.padEnd(7)+'$'+String(x.p).padEnd(6)+' played '+String(Math.round(x.inc*100)).padStart(2)+'% | app: '+(h?h.t+', for '+h.cut:'not suggested'))});}
 for(const t of TT){const S=r.sheet.filter(x=>x.legal&&x.t===t);row[t]=S.filter(x=>where(x.n)).length+'/'+S.length}
 console.log(JSON.stringify(row));}
if(process.env.L)console.log(lines.join('\n'));

const {run,ctx,edh,deck,fs}=require('./h.js');const WB=JSON.parse(fs.readFileSync(__dirname+'/workbook_pre.json'));
for(const [name,w] of Object.entries(WB)){const d=deck('Commander\n1 '+w.commander+'\n\nDeck\n'+w.deck.map(x=>x[0]+' '+x[1]).join('\n'));edh(d.commander);ctx.__d=d;
console.log(name.padEnd(18),run(`(()=>{const d=__d;d.recP={};const snap=R=>R.paths.flatMap(L=>Object.keys(L.opts).map(t=>L.cut+'|'+t+'|'+L.opts[t].add)).sort().join('\\n');let prev=null;const log=[];
for(let i=0;i<5;i++){const R=upgradePaths(d);(R.unlock||[]).forEach(k=>delete d.recP[k]);R.paths.forEach(L=>['budget','mid'].forEach(t=>{const q=L.opts[t];if(q&&!q.beaten){const k=norm(q.add);if(!d.recP[k])d.recP[k]={t,p:find(q.add).p,pair:JSON.parse(JSON.stringify(q))}}}));
 const s=snap(R);if(prev!==null){const a=new Set(prev.split('\\n')),b=new Set(s.split('\\n'));log.push([...b].filter(x=>!a.has(x)).length+'+/'+[...a].filter(x=>!b.has(x)).length+'-')}prev=s;}
return log.join('  ')})()`));}

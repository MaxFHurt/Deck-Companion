const {chromium}=require('playwright');const http=require('http'),fs=require('fs'),path=require('path');
const srv=http.createServer((q,r)=>{const f=path.join('/home/claude/dc/web',q.url==='/'?'index.html':q.url.split('?')[0]);fs.readFile(f,(e,d)=>{if(e){r.writeHead(404);r.end();}else{r.writeHead(200,{'content-type':f.endsWith('.js')||f.endsWith('.json')?'application/json':'text/html'});r.end(d);}})}).listen(8868);
(async()=>{const b=await chromium.launch({executablePath:'/opt/pw-browsers/chromium'});const errs=[];
const ctx=await b.newContext({viewport:{width:1366,height:1100}});await ctx.route(/scryfall|googleapis|json\.edhrec/,r=>r.abort());
const p=await ctx.newPage();p.on('pageerror',e=>{errs.push(e.message);console.log('ERR',e.message)});
await p.goto('http://localhost:8868/');await p.waitForTimeout(500);await p.click('.tile.big[data-v="decks"]');await p.click('.tile[data-act="open-deck"]');await p.waitForTimeout(700);
console.log(await p.evaluate(()=>{const d=cur(),c=find(d.commander);let i=0;const rows=LIB.filter(x=>x.cmd&&x.ci.every(k=>c.ci.includes(k))).slice(0,400).map(x=>[x.n,+(((i++*37)%100)/100).toFixed(2),+((((i*13)%60)-20)/100).toFixed(2)]);EDH={key:c.n,map:new Map(rows.map(r=>[norm(r[0]),{inc:r[1],syn:r[2]}])),decks:1234,state:'ok'};DBINFO.complete=true;DBINFO.source='live';S.tab='up';render();const R=recsFor(d);return JSON.stringify({smart:R.smart,paths:R.paths.length,count:R.count,fixes:R.fixes.length})}));
await p.waitForTimeout(1200);
console.log(await p.evaluate(()=>{const d=cur(),R=recsFor(d);return JSON.stringify({locks:Object.keys(d.recP||{}).length,withPair:Object.values(d.recP||{}).filter(r=>r.pair).length,held:R.paths.flatMap(L=>Object.values(L.opts)).filter(p=>p.held).length,paths:R.paths.length,opts:document.querySelectorAll('.paths .opt:not(.none)').length,modal:!document.querySelector('#modal').hidden})}));
await p.screenshot({path:'t67s.png'});
// swap one, buy list renders
await p.click('.paths [data-act="swap"]');await p.waitForTimeout(800);await p.click('[data-act="tab"][data-v="buy"]');await p.waitForTimeout(600);
console.log('buy groups',await p.evaluate(()=>document.querySelectorAll('.buygrp').length),'| swaps recorded',await p.evaluate(()=>cur().cards.filter(x=>x.hist&&x.hist.length).length));
console.log('errors',errs);await b.close();srv.close();})();

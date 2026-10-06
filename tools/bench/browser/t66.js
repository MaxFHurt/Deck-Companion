const {chromium}=require('playwright');const http=require('http'),fs=require('fs'),path=require('path');
const srv=http.createServer((q,r)=>{const f=path.join('/home/claude/dc/web',q.url==='/'?'index.html':q.url.split('?')[0]);fs.readFile(f,(e,d)=>{if(e){r.writeHead(404);r.end();}else{r.writeHead(200,{'content-type':f.endsWith('.js')||f.endsWith('.json')?'application/json':'text/html'});r.end(d);}})}).listen(8866);
(async()=>{const b=await chromium.launch({executablePath:'/opt/pw-browsers/chromium'});const errs=[];
const ctx=await b.newContext({viewport:{width:1366,height:1000}});await ctx.route(/scryfall|googleapis|json\.edhrec/,r=>r.abort());
const p=await ctx.newPage();p.on('pageerror',e=>{errs.push(e.message);console.log('ERR',e.message)});await p.goto('http://localhost:8866/');await p.waitForTimeout(500);await p.click('.tile.big[data-v="decks"]');await p.click('.tile[data-act="open-deck"]');await p.waitForTimeout(900);
console.log('popup with starter data (should be false):',await p.evaluate(()=>!document.querySelector('#modal').hidden));
const info=await p.evaluate(()=>{DBINFO.complete=true;DBINFO.source='live';const d=cur();const a0=watchAlerts(d);const k=Object.keys(d.recP);const R=recsFor(d);const t=['budget','mid'].find(t=>R.paths.some(L=>L.opts[t]&&!L.opts[t].beaten&&d.recP[norm(L.opts[t].add)]));if(!t)return {paths:R.paths.length,opts:R.paths.map(L=>Object.keys(L.opts).join()),locks:k.length};const L=R.paths.find(L=>L.opts[t]&&!L.opts[t].beaten&&d.recP[norm(L.opts[t].add)]);const n=L.opts[t].add;const c=find(n);const was=c.p;c.p=TIERS[t].cap*2.4;window.__t=t;const il=d.cards.find(e=>!isBasic(e.n)&&e.n!==n);return {first:a0.length,locks:k.length,n,was}});
console.log(info);
await p.evaluate(()=>{render()});await p.waitForTimeout(900);
console.log('popup after jump:',await p.evaluate(()=>({open:!document.querySelector('#modal').hidden,text:document.querySelector('#modal').innerText.replace(/\n+/g,' | ').slice(0,400)})));
await p.screenshot({path:'t66a.png'});
console.log('still budget in paths:',await p.evaluate((n)=>recsFor(cur()).paths.some(L=>L.opts[window.__t]&&L.opts[window.__t].add===n),info.n), '| chip:',await p.evaluate(()=>!!document.querySelector('.chip.warn[title^="The price it had"]')));
await p.click('[data-act="watch-keep"]');await p.waitForTimeout(900);
console.log('after keep: popup open',await p.evaluate(()=>!document.querySelector('#modal').hidden),'ack',await p.evaluate((n)=>cur().recP[norm(n)],info.n));
// move-up path
await p.evaluate((n)=>{delete cur().recP[norm(n)].ack;watchRun.seen.clear();render()},info.n);await p.waitForTimeout(900);await p.click('[data-act="watch-move"]');await p.waitForTimeout(900);
console.log('after move: lock gone',await p.evaluate((n)=>!cur().recP[norm(n)],info.n),'| now in',await p.evaluate((n)=>{const L=recsFor(cur()).paths.map(L=>Object.keys(L.opts).find(t=>L.opts[t].add===n)).find(Boolean);return L||'not shown'},info.n),'| popup',await p.evaluate(()=>!document.querySelector('#modal').hidden));
// not-legal installed card
const il=await p.evaluate(()=>{const d=cur();const e=d.cards.find(e=>!isBasic(e.n));const c=find(e.n);c.cmd=false;c.legal=c.legal&&{};watchRun.seen.clear();render();return {n:e.n,legal:legalIn(c,d.format)}});await p.waitForTimeout(900);
console.log(il,'popup:',await p.evaluate(()=>({open:!document.querySelector('#modal').hidden,text:document.querySelector('#modal').innerText.replace(/\n+/g,' | ').slice(0,260)})));
await p.screenshot({path:'t66b.png'});
if(await p.$('[data-act="watch-ok"]')){await p.click('[data-act="watch-ok"]');await p.waitForTimeout(900);console.log('after keep anyway: popup',await p.evaluate(()=>!document.querySelector('#modal').hidden))}
console.log('errors',errs);await b.close();srv.close();})();

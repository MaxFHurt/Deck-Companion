const {chromium}=require('playwright');const http=require('http'),fs=require('fs'),path=require('path');
const srv=http.createServer((q,r)=>{const f=path.join('/home/claude/dc/web',q.url==='/'?'index.html':q.url.split('?')[0]);fs.readFile(f,(e,d)=>{if(e){r.writeHead(404);r.end();}else{r.writeHead(200,{'content-type':f.endsWith('.js')||f.endsWith('.json')?'application/json':'text/html'});r.end(d);}})}).listen(8867);
(async()=>{const b=await chromium.launch({executablePath:'/opt/pw-browsers/chromium'});const errs=[];
const ctx=await b.newContext({viewport:{width:1366,height:1100}});await ctx.route(/scryfall|googleapis|json\.edhrec/,r=>r.abort());
const p=await ctx.newPage();p.on('pageerror',e=>{errs.push(e.message);console.log('ERR',e.message)});p.on('console',m=>{if(m.type()==='error'&&!/ERR_FAILED|Failed to load/.test(m.text()))console.log('console',m.text())});
await p.goto('http://localhost:8867/');await p.waitForTimeout(500);await p.click('.tile.big[data-v="decks"]');await p.click('.tile[data-act="open-deck"]');await p.waitForTimeout(700);
console.log('footer:',await p.evaluate(()=>document.querySelector('footer').innerText.match(/Build \d+/)[0]),'| filters group:',await p.evaluate(()=>!!document.querySelector('#type-add')&&!!document.querySelector('#key-add')));
// add a creature type and a keyword through the controls
await p.fill('#type-add','elf');await p.dispatchEvent('#type-add','change');await p.waitForTimeout(300);await p.selectOption('#key-add','stun');await p.waitForTimeout(300);
console.log('deck filters:',await p.evaluate(()=>JSON.stringify({types:cur().types,keys:cur().keys})));
await p.click('[data-act="types-must"]');await p.waitForTimeout(300);console.log('typesMust:',await p.evaluate(()=>cur().typesMust),'| note:',await p.evaluate(()=>[...document.querySelectorAll('.note')].map(x=>x.innerText).find(t=>/rule narrows/.test(t))||''));
await p.screenshot({path:'t67a.png'});
// upgrades tab: regenerate
await p.click('[data-act="tab"][data-v="up"]');await p.waitForTimeout(600);
console.log('regen button:',await p.evaluate(()=>!!document.querySelector('[data-act="regen"]')),'| paths',await p.evaluate(()=>recsFor(cur()).paths.length),'smart',await p.evaluate(()=>recsFor(cur()).smart));
await p.evaluate(()=>{cur().recP={'x':{t:'budget',p:1}}});await p.click('[data-act="regen"]');await p.waitForTimeout(300);await p.click('[data-act="regen-go"]');await p.waitForTimeout(2500);
console.log('regen result:',await p.evaluate(()=>document.querySelector('#modal').innerText.replace(/\n+/g,' | ').slice(0,300)));
await p.screenshot({path:'t67b.png'});await p.click('#modal [data-act="regen-undo"]');await p.waitForTimeout(400);console.log('undo restored:',await p.evaluate(()=>JSON.stringify(cur().recP)),'| modal hidden',await p.evaluate(()=>document.querySelector('#modal').hidden));
// build plan with basics box
await p.evaluate(()=>{const d=cur();d.typesMust=false;d.types=[];d.keys=[];const e=JSON.parse(JSON.stringify(d));e.cards=[];d.cards=[];d.plan=buildPlan(e,[],null,null);render()});await p.waitForTimeout(700);
console.log('plan:',await p.evaluate(()=>{const d=cur();const g=[...document.querySelectorAll('.grp .lab')].map(x=>x.innerText);return JSON.stringify({slots:d.plan.length,basics:d.plan.filter(x=>x.basic).map(x=>x.q+' '+x.a),labels:g.filter(t=>/Basic|Cards to add/i.test(t)),rowsBasicLabel:[...document.querySelectorAll('.paths.plan .chip')].filter(x=>x.innerText==='BASIC LAND'||x.innerText==='Basic land').length})}));
await p.evaluate(()=>{S.planShow=400;render()});await p.waitForTimeout(400);await p.evaluate(()=>document.querySelector('[data-act="plan-basics"]').scrollIntoView());await p.screenshot({path:'t67c.png'});
await p.click('[data-act="plan-basics"]');await p.waitForTimeout(500);
console.log('after add basics:',await p.evaluate(()=>{const d=cur();return JSON.stringify({inDeck:d.cards.filter(x=>isBasic(x.n)).map(x=>x.q+' '+x.n),left:(d.plan||[]).filter(x=>x.basic).length})}));
console.log('errors',errs);await b.close();srv.close();})();

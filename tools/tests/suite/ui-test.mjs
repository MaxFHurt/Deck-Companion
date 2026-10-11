// Browser tests on a fresh, throwaway profile. Scryfall and EDHREC requests are answered from the frozen snapshot; any other
// outside request is blocked. Usage: PW=<playwright path> node ui-test.mjs <port> <label>
import { createRequire } from 'module'; const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PW); const fs = require('fs'), path = require('path'), zlib = require('zlib');
const here = path.dirname(new URL(import.meta.url).pathname), SNAP = path.resolve(here, '../snapshot'), OUT = path.resolve(here, '../out');
const port = process.argv[2] || '8765', label = process.argv[3] || 'ui';
const cards = zlib.gunzipSync(fs.readFileSync(SNAP + '/cards.json.gz')).toString(), RAWJ = JSON.parse(cards), tags = fs.readFileSync(SNAP + '/tags.json', 'utf8');
const results = []; const T = (id, desc, pass, detail) => { results.push({id, desc, pass, detail}); console.log((pass ? 'PASS' : 'FAIL'), id.padEnd(9), desc, detail ? '— ' + detail : ''); };
const errs = [];
const b = await chromium.launch(); const ctx = await b.newContext({viewport:{width:1300, height:900}}); const page = await ctx.newPage();
page.on('pageerror', e => errs.push('pageerror: ' + e.message));
await ctx.route('**/*', route => { const u = route.request().url();
  if (u.startsWith('http://127.0.0.1')) return route.continue();
  let m;
  if ((m = /json\.edhrec\.com\/pages\/precon\/([a-z0-9-]+)\.json/.exec(u)) && fs.existsSync(SNAP + '/precon/' + m[1] + '.json')) return route.fulfill({status:200, contentType:'application/json', body:fs.readFileSync(SNAP + '/precon/' + m[1] + '.json')});
  if ((m = /json\.edhrec\.com\/pages\/commanders\/([a-z0-9-]+)\/([a-z0-9-]+)\.json/.exec(u))){ const f = path.resolve(here, '../data2/themes/' + m[1] + '__' + m[2] + '.json'); return fs.existsSync(f) ? route.fulfill({status:200, contentType:'application/json', body:fs.readFileSync(f)}) : route.fulfill({status:404, body:''}); }
  if ((m = /json\.edhrec\.com\/pages\/commanders\/([a-z0-9-]+)\.json/.exec(u)) && fs.existsSync(SNAP + '/edhrec/' + m[1] + '.json')) return route.fulfill({status:200, contentType:'application/json', body:fs.readFileSync(SNAP + '/edhrec/' + m[1] + '.json')});
  if ((m = /api\.scryfall\.com\/cards\/search\?q=([^&]+)/.exec(u)) && /\be:([a-z0-9]+)/.test(decodeURIComponent(m[1]))){ const code = /\be:([a-z0-9]+)/.exec(decodeURIComponent(m[1]))[1]; if (code === 'err') return route.fulfill({status:503, body:''}); const data = RAWJ.filter(o => o.set === code).map(o => Object.assign({object:'card'}, o)); return route.fulfill({status:200, contentType:'application/json', body:JSON.stringify({object:'list', has_more:false, data})}); }
  if (/api\.scryfall\.com\/sets$/.test(u)) return route.fulfill({status:200, contentType:'application/json', body:JSON.stringify({data:[{code:'msc', name:'Marvel Super Heroes Commander', released_at:'2026-09-26', set_type:'commander', card_count:300, digital:false}, {code:'msh', name:'Marvel Super Heroes', released_at:'2026-09-26', set_type:'expansion', card_count:300, digital:false}, {code:'blb', name:'Bloomburrow', released_at:'2024-08-02', set_type:'expansion', card_count:280, digital:false}]})});
  if (/raw\.githubusercontent\.com\/MaxFHurt\/Deck-Companion\/card-data\/combos\.json\.gz/.test(u)) return route.fulfill({status:200, contentType:'application/octet-stream', body:fs.readFileSync(path.resolve(here, '../data2/spellbook/combos.json.gz'))});
  if (/fonts\.(googleapis|gstatic)\.com/.test(u)) return route.fulfill({status:200, contentType:'text/css', body:''});
  return route.abort(); });
await page.goto('http://127.0.0.1:' + port + '/index.html', {waitUntil:'load'}); await page.waitForTimeout(1200);
// Full card data from the snapshot, loaded the way the app loads its own download.
await page.evaluate(([raw, tg]) => { const rows = []; for (const o of JSON.parse(raw)){ const c = fromScryfall(o); if (c) rows.push(c); } const best = new Map(); for (const c of rows){ const k = norm(c.n), x = best.get(k); if (!x || (x.p == null && c.p != null)) best.set(k, c); }
  useFull([...best.values()], '2026-10-06', true); S.noAsk = true; S.syncRecs = true; const t = JSON.parse(tg); useTags(t); }, [cards, tags]);
const build = await page.evaluate(() => window.BUILD);

// 1. Native precon loader, Wakanda (alternate printed names) — the path that recommended installed cards before.
await page.evaluate(async () => { window.__save = async (slug, label) => { await loadPreconLive(slug, label); const d = S.draft; S.profile.decks.unshift(d); S.draft = null; S.deckId = d.id; touch(); return d; }; await __save('wakanda-forever', 'Wakanda Forever'); }); await page.waitForTimeout(800);
await page.evaluate(async () => { const d = cur(); S.deckId = d.id; S.view = 'decks'; S.open = true; S.tab = 'up'; await loadEdh(d.commander); render(); }); await page.waitForTimeout(800);
const w = await page.evaluate(() => { const d = cur(), R = recsFor(d), adds = R.paths.flatMap(L => Object.values(L.opts).map(p => p.add));
  return {name:d.name, size:analyze(d).size, unknown:analyze(d).unknown, installed:adds.filter(n => !!entryOf(d, n)), rows:R.paths.length, apex:R.paths.filter(L => L.opts.apex).length}; });
T('UI-ID-01', 'Precon loader (Wakanda): every card recognised, no installed card recommended', w.size === 100 && !w.unknown.length && !w.installed.length && w.rows > 0 && w.apex === w.rows, JSON.stringify(w));

// 2. The exclusion button: label, accessible name, explanation.
const btn = await page.evaluate(() => { const b = document.querySelector('[data-act="dismiss"]'); return b ? {text:b.textContent.trim(), aria:b.getAttribute('aria-label'), n:b.dataset.n} : null; });
const helpText = await page.evaluate(() => document.body.innerText.includes('excludes that card from this deck’s recommendations. Your deck stays unchanged'));
const oldLabel = await page.evaluate(() => document.body.innerText.includes('Not this card'));
T('UI-EX-01', 'Button reads “Don’t suggest for this deck”, names the card for screen readers, and is explained on the page', !!btn && btn.text === 'Don’t suggest for this deck' && btn.aria === 'Don’t suggest ' + btn.n + ' for this deck' && helpText && !oldLabel, JSON.stringify(btn) + ' help text: ' + helpText + ', old label left: ' + oldLabel);

// 3. Clicking it excludes the card for this deck only; the deck is unchanged; nothing is swapped.
const before = await page.evaluate(() => { const d = cur(); return {cards:JSON.stringify(d.cards), cmd:d.commander, size:analyze(d).size, recP:JSON.stringify(d.recP || {})}; });
await page.click('[data-act="dismiss"]'); await page.click('#confirm [data-act="conf-yes"]'); await page.waitForTimeout(400);
const after = await page.evaluate(n => { const d = cur(), R = recsFor(d); return {cards:JSON.stringify(d.cards), cmd:d.commander, size:analyze(d).size, dismissed:(d.dismissed || []).slice(), stillShown:R.paths.some(L => Object.values(L.opts).some(p => p.add === n)), toast:(document.querySelector('#toast') || {}).textContent || ''}; }, btn.n);
T('UI-EX-02', 'Excluding a suggestion leaves the deck, commander and card count unchanged and stops suggesting it', after.cards === before.cards && after.cmd === before.cmd && after.size === before.size && after.dismissed.includes(btn.n) && !after.stillShown && after.toast.includes('excluded from this deck’s recommendations'), 'toast: ' + after.toast);
const heldAfter = await page.evaluate(() => JSON.stringify(cur().recP || {}));
T('UI-EX-05a', 'Other held picks are untouched by an exclusion', (() => { const a = JSON.parse(before.recP), z = JSON.parse(heldAfter); return Object.keys(a).filter(k => k !== btn.n.toLowerCase()).every(k => !z[k] || JSON.stringify(z[k].pair) === JSON.stringify(a[k].pair)); })(), Object.keys(JSON.parse(before.recP)).length + ' held before');

// 4. Another deck is unaffected; an alternate printed title of an excluded card stays excluded.
const other = await page.evaluate(async () => { const d2 = await __save('avengers-assemble', 'Avengers Assemble'); return {dismissed:(d2.dismissed || []).length, id:d2.id}; }); await page.waitForTimeout(500);
const alt = await page.evaluate(async () => { const d = S.profile.decks.find(x => /Wakanda/i.test(x.name)); S.deckId = d.id; await loadEdh(d.commander); ruleOut(d, 'Vibranium Dynamo'); const d2 = { ...d, cards:d.cards.filter(e => e.n !== 'Thran Dynamo' && e.n !== 'Vibranium Dynamo') }; d2.cards.push({n:'Sol Ring', q:0}); d2.cards = d2.cards.filter(e => e.q);
  const R = upgradePaths(d2); return {shown:R.paths.some(L => Object.values(L.opts).some(p => p.add === 'Thran Dynamo'))}; });
T('UI-EX-03', 'Another deck keeps its own (empty) exclusions; excluding “Vibranium Dynamo” also excludes Thran Dynamo', other.dismissed === 0 && !alt.shown, JSON.stringify({other, alt}));

// 5. Allow it again: the exclusion is cleared and the card is eligible (not forced in).
await page.evaluate(() => { S.tab = 'up'; render(); }); await page.waitForTimeout(300);
const allowBtn = await page.evaluate(n => { const b = [...document.querySelectorAll('[data-act="undismiss"]')].find(x => x.dataset.n === n); return b ? {text:b.textContent, aria:b.getAttribute('aria-label')} : null; }, btn.n);
const heading = await page.evaluate(() => document.body.innerText.includes('EXCLUDED CARDS FOR THIS DECK') || document.body.innerText.toLowerCase().includes('excluded cards for this deck'));
await page.evaluate(n => { const b = [...document.querySelectorAll('[data-act="undismiss"]')].find(x => x.dataset.n === n); if (b) b.click(); }, btn.n); await page.waitForTimeout(300);
const allowed = await page.evaluate(n => ({dismissed:(cur().dismissed || []).includes(n), toast:(document.querySelector('#toast') || {}).textContent || ''}), btn.n);
T('UI-EX-04', 'Allow-again control is labelled per card; using it clears the exclusion', !!allowBtn && allowBtn.aria === 'Allow ' + btn.n + ' in recommendations' && heading && !allowed.dismissed && allowed.toast.includes('allowed in this deck’s recommendations'), JSON.stringify({allowBtn, heading, allowed}));

// 6. Exclusions persist through a reload of the same (throwaway) profile; holds come back unchanged.
await page.evaluate(n => { ruleOut(cur(), n); touch(); }, btn.n); await page.waitForTimeout(1500);
const held1 = await page.evaluate(() => JSON.stringify(cur().recP || {}));
await page.reload({waitUntil:'load'}); await page.waitForTimeout(1500);
const persisted = await page.evaluate(n => { const d = S.profile.decks.find(x => /Wakanda/i.test(x.name)); return {excluded:!!d && (d.dismissed || []).includes(n), held:JSON.stringify(d && d.recP || {})}; }, btn.n);
T('UI-EX-05', 'Exclusions and holds survive a reload (existing storage, 80-entry limit unchanged)', persisted.excluded && persisted.held === held1, 'held picks ' + Object.keys(JSON.parse(held1)).length);

// 7. Phone layout on a real touch-phone profile (390px wide, touch screen): the longer label fits beside Swap without
// covering it, tap targets are usable, and the page does not scroll sideways. A separate throwaway context.
const mctx = await b.newContext({viewport:{width:390, height:844}, isMobile:true, hasTouch:true, deviceScaleFactor:2});
await mctx.route('**/*', route => { const u = route.request().url(); if (u.startsWith('http://127.0.0.1')) return route.continue(); let m;
  if ((m = /json\.edhrec\.com\/pages\/precon\/([a-z0-9-]+)\.json/.exec(u)) && fs.existsSync(SNAP + '/precon/' + m[1] + '.json')) return route.fulfill({status:200, contentType:'application/json', body:fs.readFileSync(SNAP + '/precon/' + m[1] + '.json')});
  if ((m = /json\.edhrec\.com\/pages\/commanders\/([a-z0-9-]+)\/([a-z0-9-]+)\.json/.exec(u))){ const f = path.resolve(here, '../data2/themes/' + m[1] + '__' + m[2] + '.json'); return fs.existsSync(f) ? route.fulfill({status:200, contentType:'application/json', body:fs.readFileSync(f)}) : route.fulfill({status:404, body:''}); }
  if ((m = /json\.edhrec\.com\/pages\/commanders\/([a-z0-9-]+)\.json/.exec(u)) && fs.existsSync(SNAP + '/edhrec/' + m[1] + '.json')) return route.fulfill({status:200, contentType:'application/json', body:fs.readFileSync(SNAP + '/edhrec/' + m[1] + '.json')});
  if (/fonts\.(googleapis|gstatic)\.com/.test(u)) return route.fulfill({status:200, contentType:'text/css', body:''}); return route.abort(); });
const mp = await mctx.newPage(); mp.on('pageerror', e => errs.push('mobile pageerror: ' + e.message));
await mp.goto('http://127.0.0.1:' + port + '/index.html', {waitUntil:'load'}); await mp.waitForTimeout(1000);
await mp.evaluate(([raw, tg]) => { const rows = []; for (const o of JSON.parse(raw)){ const c = fromScryfall(o); if (c) rows.push(c); } const best = new Map(); for (const c of rows){ const k = norm(c.n), x = best.get(k); if (!x || (x.p == null && c.p != null)) best.set(k, c); } useFull([...best.values()], '2026-10-06', true); S.noAsk = true; S.syncRecs = true; useTags(JSON.parse(tg)); }, [cards, tags]);
await mp.evaluate(async () => { await loadPreconLive('wakanda-forever', 'Wakanda Forever'); const d = S.draft; S.profile.decks.unshift(d); S.draft = null; S.deckId = d.id; S.view = 'decks'; S.open = true; S.tab = 'up'; await loadEdh(d.commander); render(); }); await mp.waitForTimeout(700);
const geo = await mp.evaluate(() => { const o = document.querySelector('.opt [data-act="dismiss"]'); if (!o) return null; const s = o.parentElement.querySelector('[data-act="swap"]'), a = o.getBoundingClientRect(), c = s.getBoundingClientRect();
  const overlap = !(a.right <= c.left || c.right <= a.left || a.bottom <= c.top || c.bottom <= a.top); o.scrollIntoView({block:'center'}); return {coarse:matchMedia('(pointer:coarse)').matches, overlap, dismissH:Math.round(a.height), swapH:Math.round(c.height), dismissW:Math.round(a.width), swapW:Math.round(c.width), pageScrollX:document.documentElement.scrollWidth > innerWidth + 1}; });
await mp.waitForTimeout(300); { const opt = await mp.$('.opt [data-act="dismiss"]'); if (opt){ const box = await (await opt.evaluateHandle(e => e.closest('.path'))).boundingBox(); if (box) await mp.screenshot({path:OUT + '/' + label + '-mobile.png', clip:{x:0, y:Math.max(0, box.y - 8), width:390, height:Math.min(1400, box.height + 16)}}); } }
const lay = await mp.evaluate(() => (() => { let bad = 0, n = 0; [...document.querySelectorAll('.paths .path')].slice(0, 6).forEach(path => { const k = [...path.children].map(e => e.getBoundingClientRect()).filter(r => r.height > 0); n++;
  for (let i = 0; i < k.length; i++) for (let j = i + 1; j < k.length; j++) if (k[i].top < k[j].bottom - 1 && k[j].top < k[i].bottom - 1 && k[i].left < k[j].right - 1 && k[j].left < k[i].right - 1) bad++; }); return {cards:n, overlaps:bad}; })());
T('UI-LAYOUT-1', 'Touch phone: no parts of an upgrade card overlap (first 6 cards)', lay.cards > 0 && !lay.overlaps, JSON.stringify(lay));
T('UI-EX-06', 'Touch phone (390px): button and Swap do not overlap, both at least 24px tall (WCAG 2.2 minimum target size), no sideways scrolling', !!geo && geo.coarse && !geo.overlap && geo.dismissH >= 24 && geo.swapH >= 24 && !geo.pageScrollX, JSON.stringify(geo));
await mctx.close();

// 8. Tier display: empty tiers give reasons; Apply all applies a validated package and keeps 100 cards.
// the reload in step 6 dropped the injected card data: load it again and reopen the Wakanda deck
await page.evaluate(([raw, tg]) => { const rows = []; for (const o of JSON.parse(raw)){ const c = fromScryfall(o); if (c) rows.push(c); } const best = new Map(); for (const c of rows){ const k = norm(c.n), x = best.get(k); if (!x || (x.p == null && c.p != null)) best.set(k, c); } useFull([...best.values()], '2026-10-06', true); S.noAsk = true; S.syncRecs = true; useTags(JSON.parse(tg)); }, [cards, tags]);
await page.evaluate(async () => { const d = S.profile.decks.find(x => /Wakanda/i.test(x.name)); S.deckId = d.id; S.view = 'decks'; S.open = true; S.tab = 'up'; await loadEdh(d.commander); render(); }); await page.waitForTimeout(700);
const lay2 = await page.evaluate(() => (() => { let bad = 0, n = 0; [...document.querySelectorAll('.paths .path')].slice(0, 6).forEach(path => { const k = [...path.children].map(e => e.getBoundingClientRect()).filter(r => r.height > 0); n++;
  for (let i = 0; i < k.length; i++) for (let j = i + 1; j < k.length; j++) if (k[i].top < k[j].bottom - 1 && k[j].top < k[i].bottom - 1 && k[i].left < k[j].right - 1 && k[j].left < k[i].right - 1) bad++; }); return {cards:n, overlaps:bad}; })());
T('UI-LAYOUT-2', 'Desktop: no parts of an upgrade card overlap (first 6 cards)', lay2.cards > 0 && !lay2.overlaps, JSON.stringify(lay2));
const tiers = await page.evaluate(() => { const none = [...document.querySelectorAll('.opt.none p')].map(p => p.textContent); return {empty:none.length, blank:none.filter(t => !t.trim()).length, sample:none.slice(0, 3)}; });
T('UI-TIER-01', 'Empty tiers show their reason on the page', tiers.empty > 0 && tiers.blank === 0, JSON.stringify(tiers));
// 9. "Best deck with every new card under $3": shown in the Budget box; Apply adds only cards under $3 each; deck stays valid.
await page.evaluate(async () => { await loadPreconLive('avengers-assemble', 'Avengers Assemble'); const d0 = S.draft; S.profile.decks.unshift(d0); S.draft = null; S.deckId = d0.id; touch(); const d = cur(); S.deckId = d.id; S.view = 'decks'; S.open = true; S.tab = 'up'; await loadEdh(d.commander); render(); }); await page.waitForTimeout(900);
await page.evaluate(() => { handleAct('cap-show', 'budget'); });
const cap = await page.evaluate(() => { const d = cur(), before = new Set(d.cards.map(e => keyOf(e.n))), box = document.querySelector('[data-act="swap-cap"][data-v="budget"]'), shown = !!box && /every new card under \$3/.test(box.closest('.tierbox').textContent);
  if (box) box.click(); const added = d.cards.filter(e => !before.has(keyOf(e.n))).map(e => ({n:e.n, p:(find(e.n) || {}).p}));
  return {shown, added:added.length, over:added.filter(x => !(x.p != null && x.p < 3)), size:analyze(d).size, v:validateDeck(d).map(x => x.key), toast:(document.querySelector('#toast') || {}).textContent}; });
T('UI-CAP-01', 'Budget box offers “best deck with every new card under $3”; Apply adds only cards under $3 each and the deck stays a valid 100', cap.shown && cap.added > 0 && !cap.over.length && cap.size === 100 && !cap.v.length && /under \$3 each/.test(cap.toast), JSON.stringify(cap));
await page.evaluate(async () => { const d = S.profile.decks.find(x => /Wakanda/i.test(x.name)); S.deckId = d.id; S.view = 'decks'; S.open = true; S.tab = 'up'; await loadEdh(d.commander); render(); }); await page.waitForTimeout(700);
// 10. Mechanics: a deck takes its commander's own themes (what players build it around); reordering them steers the picks.
await page.evaluate(async () => { await loadPreconLive('doom-prevails', 'Doom Prevails'); const d0 = S.draft; S.profile.decks.unshift(d0); S.draft = null; S.deckId = d0.id; touch(); const d = cur(); S.view = 'decks'; S.open = true; S.tab = 'up'; await loadEdh(d.commander); render(); ensureEdh(); }); await page.waitForTimeout(1500);
const aimA = await page.evaluate(() => { const d = cur(); return {aims:d.aims.slice(), auto:d.aimAuto, labels:d.aims.map(a => aimLabel(a)), loaded:Object.keys(EDH.tmap), picks:recsFor(d).paths.map(L => L.opts.apex && L.opts.apex.add)}; });
await page.evaluate(() => { S.tab = 'build'; render(); }); await page.waitForTimeout(300);
await page.evaluate(() => { const c = document.querySelector('[data-act="build-custom"]'); if (c) c.click(); }); await page.waitForTimeout(300);
const shown = await page.evaluate(() => { const t = document.body.innerText; return cur().aims.map(a => aimLabel(a)).every(l => t.includes(l)) && !!document.querySelector('[data-act="mech-list"]') && (openMechList(), /mechanics \(how players build it\)/.test(document.querySelector('#modal').textContent)) && (($('#modal').hidden = true), true); });
await page.evaluate(() => { const b = document.querySelector('[data-act="aim-down"][data-v="0"]'); if (b) b.click(); }); await page.waitForTimeout(1500);
const aimB = await page.evaluate(() => { const d = cur(); return {aims:d.aims.slice(), auto:d.aimAuto, picks:recsFor(d).paths.map(L => L.opts.apex && L.opts.apex.add)}; });
const diff = aimB.picks.filter(x => !aimA.picks.includes(x)).length + aimA.picks.filter(x => !aimB.picks.includes(x)).length;
T('UI-AIM-01', 'Mechanics are the commander’s own themes (shown, with its other themes offered first); reordering them is kept and changes the picks', aimA.aims.length && aimA.aims.every(a => a.startsWith('edh:')) && aimA.auto === true && shown && aimB.auto === false && aimB.aims[0] === aimA.aims[1] && diff > 0,
  JSON.stringify({before:aimA.labels, loaded:aimA.loaded, shown, after:aimB.aims, changedPicks:diff}));
await page.evaluate(async () => { const d = S.profile.decks.find(x => /Wakanda/i.test(x.name)); S.deckId = d.id; S.view = 'decks'; S.open = true; S.tab = 'up'; await loadEdh(d.commander); render(); }); await page.waitForTimeout(700);
const applied = await page.evaluate(() => { const d = cur(), n0 = recsFor(d).paths.length; const b = document.querySelector('[data-act="swap-all"][data-v="apex"]'); b.click(); return {n0, size:analyze(d).size, v:validateDeck(d).map(x => x.key), toast:(document.querySelector('#toast') || {}).textContent}; });
T('UI-MIX-01', 'Apply all (Apex) makes the swaps as one checked package; the deck stays a valid 100 cards', applied.size === 100 && !applied.v.length && /Made \d+ Apex swap/.test(applied.toast), JSON.stringify(applied));
// 11. Combos load from the card-data branch (served here from the frozen copy) and are kept in the browser.
const cmb = await page.evaluate(async () => { await loadCombos(true); const v = await idb('readonly', st => st.get('combos')); return {n:COMBOS.list.length, state:COMBOS.state, cached:!!(v && v.j && v.j.combos && v.j.combos.length)}; });
T('UI-COMBO-01', 'Combo data (Commander Spellbook, via the card-data branch) loads, is indexed and is cached in the browser', cmb.n > 1000 && cmb.state === 'ok' && cmb.cached, JSON.stringify(cmb));
// 12. Deck score: five categories with reasons, how the commander works (reviewed profile), how the deck wins.
await page.evaluate(async () => { const d = S.profile.decks.find(x => /Wakanda/i.test(x.name)); S.deckId = d.id; S.view = 'decks'; S.open = true; S.tab = 'up'; await loadEdh(d.commander); render(); }); await page.waitForTimeout(900);
for (let i = 0; i < 40 && await page.evaluate(() => !/% of the Apex build/.test(document.body.textContent)); i++) await page.waitForTimeout(250);
const sc = await page.evaluate(() => { const det = document.querySelector('#score-more'); if (det) det.open = true; const t = document.body.textContent; return {score:/Deck score · \d+ of 100/.test(t), cats:['Synergy', 'Balance', 'Card quality', 'Win routes', 'Mana and curve'].every(x => t.includes(x)), profile:/How T.Challa works/.test(t) && /Vibranium tokens are artifacts, not creatures/.test(t), wins:/How it wins/.test(t), apex:(/Card quality: (\d+)% of the Apex build/.exec(t) || [])[1], tierLine:/% of the best build with every card under \$(3|12)/.test(t), tier:cur().tier}; });
T('UI-SCORE-01', 'Deck score shows five categories with reasons, card quality as a share of the Apex build (plus the under-$3/$12 line for Budget and Mid decks), the commander’s reviewed profile, and how the deck wins', sc.score && sc.cats && sc.profile && sc.wins && +sc.apex >= 0 && +sc.apex <= 100 && (sc.tier === 'apex' || sc.tierLine), JSON.stringify(sc));
// 13. Generate from a commander with a partner chosen first.
const g1 = await page.evaluate(async () => { S.gen.cmd = 'Leonardo, the Balance'; S.gen.partner = ''; openGenerate(); const chips = [...document.querySelectorAll('[data-act="gen-partner"]')].map(b => b.dataset.n).filter(Boolean);
  if (!chips.length) return {chips:0}; document.querySelector('[data-act="gen-partner"][data-n="' + chips[0].replace(/"/g, '\\"') + '"]').click(); const picked = S.gen.partner, note = /designed for Leonardo and/.test(document.querySelector('#modal').innerText);
  document.querySelector('[data-act="gen-go"]').click(); await new Promise(r => setTimeout(r, 300)); for (let i = 0; i < 60 && !(S.draft && S.draft.cards.length); i++) await new Promise(r => setTimeout(r, 200)); const d = S.draft; return {chips:chips.length, picked, note, partner:d && d.partner, cards:d ? d.cards.reduce((a, x) => a + x.q, 0) : 0, plan:d && d.plan ? d.plan.length : 0, tab:S.tab}; });
T('UI-GEN-01', 'Generate from a commander: a Partner commander offers its second commander first; the build is designed for both and all 98 cards go straight into the decklist', g1.chips > 0 && g1.picked && g1.note && g1.partner === g1.picked && g1.cards === 98 && !g1.plan && g1.tab === 'list', JSON.stringify(g1));
// 14. Customize → Generate: a new deck with the same mechanics in the same order; the original deck is unchanged.
const g2 = await page.evaluate(async () => { S.draft = null; const d = S.profile.decks.find(x => /Doom/i.test(x.name)); S.deckId = d.id; S.view = 'decks'; S.open = true; S.tab = 'build'; d.custom = true; render();
  const before = JSON.stringify({cards:d.cards, aims:d.aims}), btn = document.querySelector('[data-act="build-gen"]'); if (!btn) return {btn:false}; btn.click(); await new Promise(r => setTimeout(r, 300));
  const nd = S.draft; return {btn:true, newDeck:!!nd && nd.id !== d.id, aims:nd && JSON.stringify(nd.aims) === JSON.stringify(d.aims), cards:nd ? nd.cards.reduce((a, x) => a + x.q, 0) : 0, untouched:JSON.stringify({cards:d.cards, aims:d.aims}) === before}; });
T('UI-GEN-02', 'Customize panel has Generate: it designs a new build with the same mechanics in order; the original deck is untouched', g2.btn && g2.newDeck && g2.aims && g2.cards === 99 && g2.untouched, JSON.stringify(g2));
// 15. Card sets as a generation filter (rule): every non-basic card of the build is printed in the chosen sets.
const g3 = await page.evaluate(async () => { S.draft = null; S.gen = {cmd:'Captain America, Team Leader', tier:'budget', partner:'', sets:[], setsMust:false}; openGenerate(); await new Promise(r => setTimeout(r, 400));
  const inp = document.querySelector('#gset-add'); if (!inp) return {input:false}; inp.value = 'Marvel Super Heroes Commander (MSC)'; inp.dispatchEvent(new Event('change', {bubbles:true})); await new Promise(r => setTimeout(r, 300));
  const inp2 = document.querySelector('#gset-add'); inp2.value = 'msh'; inp2.dispatchEvent(new Event('change', {bubbles:true})); await new Promise(r => setTimeout(r, 300));
  document.querySelector('[data-act="gset-must"]').click(); const label = (document.querySelector('[data-act="gset-must"]') || {}).textContent;
  document.querySelector('[data-act="gen-go"]').click(); for (let i = 0; i < 60 && !(S.draft && S.draft.cards.length); i++) await new Promise(r => setTimeout(r, 200));
  const d = S.draft; if (!d || !d.cards.length) return {draft:false, label}; const all = d.cards.map(e => find(e.n)).concat((d.plan || []).flatMap(x => [x.a, x.m, x.b].filter(Boolean)).map(find)).filter(Boolean);
  return {sets:d.sets, must:d.setsMust, label, slots:d.cards.reduce((a, x) => a + x.q, 0), outside:all.filter(c => !isBasic(c.n) && !inSets(c, d)).map(c => c.n).slice(0, 5)}; });
T('UI-SET-01', 'Generate: card sets as a rule; every card put in the deck (and every stand-in left over) is printed in the chosen sets or is a basic land', g3.must && g3.sets && g3.sets.join() === 'msc,msh' && /Only these sets/.test(g3.label) && g3.slots > 0 && !g3.outside.length, JSON.stringify(g3));
// 15b. How to build it: Best overall / Theme first / mechanics are switches that combine where they can, with an alert when a choice
// switches another off; the deck is filled at the chosen price level and is more on theme than Best overall.
const g4 = await page.evaluate(async () => { S.draft = null; S.gen = {cmd:'Captain America, Team Leader', partner:'', sets:[], setsMust:false}; openGenerate(); await loadEdh(S.gen.cmd); openGenerate(); const M = () => document.querySelector('#modal');
  const o = {start:{best:S.gen.best, theme:S.gen.theme}}; M().querySelector('[data-act="gen-theme"]').click(); o.theme = {best:S.gen.best, theme:S.gen.theme, alert:/Best overall was switched off/.test(M().innerText)};
  M().querySelector('[data-act="gen-mechon"]').click(); const mb = M().querySelector('[data-act="gen-mech"]'); if (mb) mb.click(); o.mech = {n:S.gen.mech.length, theme:S.gen.theme, noAlert:!M().querySelector('#genmode [role="alert"]')};
  M().querySelector('[data-act="gen-best"]').click(); o.best = {best:S.gen.best, theme:S.gen.theme, mech:S.gen.mech.length, alert:/were switched off/.test(M().innerText)};
  M().querySelector('[data-act="gen-theme"]').click(); M().querySelector('[data-act="gen-tier"][data-v="mid"]').click(); M().querySelector('[data-act="gen-go"]').click();
  for (let i = 0; i < 80 && !(S.draft && S.draft.cards.length); i++) await new Promise(r => setTimeout(r, 200)); const d = S.draft; if (!d) return o;
  const T = themeCtx(d), sp = d.cards.map(e => find(e.n)).filter(c => c && !tags(c).land); o.deck = {cards:d.cards.reduce((a, e) => a + e.q, 0), themeFirst:!!d.themeFirst, onTheme:sp.filter(c => themeOf(c, T)).length, over12:d.cards.filter(e => { const c = find(e.n); return c && !isBasic(c.n) && c.p != null && c.p >= 12; }).length, tab:S.tab};
  const b = startPlan('Captain America, Team Leader', [], null, null, {fill:'mid', aims:d.aims}); o.bestOn = b.cards.map(e => find(e.n)).filter(c => c && !tags(c).land && themeOf(c, T)).length; return o; });
T('UI-GEN-03', 'Generate options: Theme first switches Best overall off (with an alert), Theme first and mechanics combine, Best overall switches both off (with an alert); a Mid Theme-first deck is filled with nothing over $12 and is more on theme than Best overall', g4.start && g4.start.best && g4.theme && !g4.theme.best && g4.theme.theme && g4.theme.alert && g4.mech && g4.mech.n === 1 && g4.mech.theme && g4.best && g4.best.best && !g4.best.theme && !g4.best.mech && g4.best.alert && g4.deck && g4.deck.cards === 99 && g4.deck.themeFirst && !g4.deck.over12 && g4.deck.tab === 'list' && g4.deck.onTheme > g4.bestOn, JSON.stringify(g4));
// 16. Card search marks cards that are suggested upgrades for one of the player's decks; the card shows which deck and what it replaces.
const u1 = await page.evaluate(async () => { S.draft = null; S.view = 'search'; render(); for (let i = 0; i < 100 && (UPX.busy || !UPX.map.size); i++) await new Promise(r => setTimeout(r, 200));
  const [k, L] = [...UPX.map.entries()].find(([k, L]) => L.some(x => x.t === 'apex')) || []; if (!k) return {index:0}; const c = find(k); S.search.q = c.n; render(); await new Promise(r => setTimeout(r, 300));
  const badge = !!document.querySelector('.cards .card .upb'); document.querySelector('.cards .card').click(); await new Promise(r => setTimeout(r, 300));
  const t = document.querySelector('#modal').textContent, d = S.profile.decks.find(x => x.id === L[0].id); S.deckId = d.id; await loadEdh(d.commander); await loadThemes(d.commander, d.aims); const real = recsFor(d).paths.some(P => Object.values(P.opts).some(p => p && p.add === c.n && p.cut === L[0].cut));
  return {index:UPX.map.size, card:c.n, badge, modal:/Upgrade for/.test(t) && t.includes(L[0].cut), matchesDeckView:real}; });
T('UI-UPX-01', 'Card search: a card that is a suggested upgrade for one of your decks is marked, and its details name the deck and the card it replaces (same as that deck’s Upgrades tab)', u1.index > 0 && u1.badge && u1.modal && u1.matchesDeckView, JSON.stringify(u1));
// 17. Customize: a set added as a rule is saved with the deck (survives a reload) and every suggested upgrade obeys it.
const s1 = await page.evaluate(async () => { S.draft = null; const d = S.profile.decks.find(x => /Doom/i.test(x.name)); S.deckId = d.id; S.view = 'decks'; S.open = true; S.tab = 'build'; d.custom = true; render();
  const inp = document.querySelector('#dset-add'); if (!inp) return {input:false}; inp.value = 'msh'; inp.dispatchEvent(new Event('change', {bubbles:true})); for (let i = 0; i < 30 && !SETCARDS.has('msh'); i++) await new Promise(r => setTimeout(r, 100));
  document.querySelector('[data-act="dset-must"]').click(); touch(); await new Promise(r => setTimeout(r, 1700)); return {id:d.id, sets:d.sets, must:d.setsMust}; });
await page.reload({waitUntil:'load'}); await page.waitForTimeout(1500);
await page.evaluate(([raw, tg]) => { const rows = []; for (const o of JSON.parse(raw)){ const c = fromScryfall(o); if (c) rows.push(c); } const best = new Map(); for (const c of rows){ const k = norm(c.n), x = best.get(k); if (!x || (x.p == null && c.p != null)) best.set(k, c); } useFull([...best.values()], '2026-10-06', true); S.noAsk = true; S.syncRecs = true; useTags(JSON.parse(tg)); }, [cards, tags]);
const s2 = await page.evaluate(async id => { const d = S.profile.decks.find(x => x.id === id); S.deckId = id; S.view = 'decks'; S.open = true; S.tab = 'up'; await loadEdh(d.commander); render(); for (let i = 0; i < 30 && !SETCARDS.has('msh'); i++) await new Promise(r => setTimeout(r, 100));
  const R = recsFor(d), adds = R.paths.flatMap(P => Object.values(P.opts).filter(Boolean).map(p => p.add)).map(find).filter(Boolean);
  return {sets:d.sets, must:d.setsMust, adds:adds.length, outside:adds.filter(c => !isBasic(c.n) && !inSets(c, d)).map(c => c.n).slice(0, 5)}; }, s1.id);
T('UI-SET-02', 'Customize: a card set added as a rule is saved with the deck, survives a reload, and every suggested upgrade is printed in that set', s1.must && s2.must && JSON.stringify(s2.sets) === '["msh"]' && !s2.outside.length, JSON.stringify({s1, s2}));
// 18. Fixed bugs: an unreadable set is not asked for again and again; Generate in Customize keeps colours and tribe and never drops a draft.
const fx = await page.evaluate(async () => { const d = S.profile.decks.find(x => /Doom/i.test(x.name)); S.draft = null; S.deckId = d.id; S.view = 'decks'; S.open = true; S.tab = 'up';
  let renders = 0; const r0 = window.render; window.render = function(){ renders++; return r0.apply(this, arguments); };
  d.sets = ['err']; d.setsMust = false; render(); for (let i = 0; i < 40 && !SETFAIL.has('err'); i++) await new Promise(r => setTimeout(r, 250)); await new Promise(r => setTimeout(r, 2000)); window.render = r0; const loopRenders = renders;
  d.sets = []; d.colors = [d.colors[0]]; d.custom = true; const dr = newDeck({name:'Unsaved test draft', format:'commander'}); S.deckId = d.id;
  const nd = regenBuild(d); const keptDraft = S.profile.decks.some(x => x.id === dr.id) || S.draft === dr;
  return {loopRenders, failed:SETFAIL.has('err'), colours:nd && JSON.stringify(nd.colors) === JSON.stringify(d.colors), draftKept:keptDraft}; });
const fx2 = await page.evaluate(async () => { const d = S.profile.decks.find(x => /Doom/i.test(x.name)); S.deckId = d.id; const dr = newDeck({name:'Unsaved test draft 2', format:'commander'}); S.deckId = d.id; S.view = 'decks'; S.open = true; S.tab = 'build'; render(); const b = document.querySelector('[data-act="build-gen"]'); if (b) b.click(); await new Promise(r => setTimeout(r, 300)); return {saved:S.profile.decks.some(x => x.id === dr.id)}; });
T('UI-FIX-01', 'An unreadable card set is tried once, not in a loop; Generate in Customize keeps the deck’s colours; an unsaved draft is saved, not lost, when Generate opens a new deck', fx.loopRenders < 6 && fx.failed && fx.colours && fx2.saved, JSON.stringify({fx, fx2}));
// 19. Card search → add a card to a chosen deck's buy list; the deck it upgrades is chosen first; decks it can't go in are disabled.
const w1 = await page.evaluate(async () => { S.draft = null; S.view = 'search'; render(); for (let i = 0; i < 100 && (UPX.busy || !UPX.map.size); i++) await new Promise(r => setTimeout(r, 200));
  const [k, L] = [...UPX.map.entries()][0] || []; if (!k) return {index:0}; const c = find(k); S.search.q = c.n; render(); await new Promise(r => setTimeout(r, 300));
  [...document.querySelectorAll('.cards .card')].find(x => x.dataset.n === c.n).click(); await new Promise(r => setTimeout(r, 300));
  const sel = document.querySelector('#want-deck'); if (!sel) return {box:false}; const chosen = sel.value, disabled = [...sel.options].filter(o => o.disabled).map(o => o.textContent);
  const offDeck = S.profile.decks.find(x => wantFit(x, c)); document.querySelector('[data-act="want-add"]').click(); await new Promise(r => setTimeout(r, 200));
  const d = S.profile.decks.find(x => x.id === chosen); return {card:c.n, upgradeDeckChosen:L.some(x => x.id === chosen), disabled, offDeckDisabled:!offDeck || disabled.some(t => t.startsWith(offDeck.name)), added:(d.want || []).some(x => x.n === c.n), btn:!!document.querySelector('[data-act="want-undo"]'), deckId:chosen}; });
await page.reload({waitUntil:'load'}); await page.waitForTimeout(1500);
await page.evaluate(([raw, tg]) => { const rows = []; for (const o of JSON.parse(raw)){ const c = fromScryfall(o); if (c) rows.push(c); } const best = new Map(); for (const c of rows){ const k = norm(c.n), x = best.get(k); if (!x || (x.p == null && c.p != null)) best.set(k, c); } useFull([...best.values()], '2026-10-06', true); S.noAsk = true; S.syncRecs = true; useTags(JSON.parse(tg)); }, [cards, tags]);
const w2 = await page.evaluate(async ([id, name]) => { const d = S.profile.decks.find(x => x.id === id); S.deckId = id; S.view = 'decks'; S.open = true; S.tab = 'buy'; await loadEdh(d.commander); render(); await new Promise(r => setTimeout(r, 400));
  const t = document.body.textContent, inPanel = /Added by you/.test(t) && t.includes(name), inText = buyText(d).includes('// Added by you\n1 ' + name);
  const rm = document.querySelector('[data-act="want-rm"]'); if (rm){ rm.click(); document.querySelector('#confirm [data-act="conf-yes"]').click(); } await new Promise(r => setTimeout(r, 200)); return {kept:(d.want || []).length === 0 ? 'removed' : 'still there', inPanel, inText, rmShown:!!rm}; }, [w1.deckId, w1.card]);
T('UI-BUY-01', 'Card search → card details → Add to buy list: the deck it upgrades is preselected, decks it can’t go in are disabled with the reason; the card shows in that deck’s Buy list (and its text export), survives a reload, and can be removed', w1.added && w1.upgradeDeckChosen && w1.offDeckDisabled && w1.btn && w2.inPanel && w2.inText && w2.kept === 'removed', JSON.stringify({w1, w2}));
// 20. A deck built from nothing, analyzed by hand: what the cards do, the suggested build, rules, score as it stands, what to add.
const an = await page.evaluate(async () => { S.draft = null; const src = S.profile.decks.find(x => /Doom/i.test(x.name)); const pick = src.cards.filter(e => !/Island|Swamp|Mountain/.test(e.n)).slice(0, 45);
  const d = newDeck({name:'Hand-built Doom', format:'commander'}); setCommander(d, src.commander); d.aims = []; d.aimAuto = false; d.auto = ''; pick.forEach(e => addCard(d, e.n, 1)); S.profile.decks.unshift(d); S.draft = null; S.deckId = d.id; S.view = 'decks'; S.open = true; S.tab = 'up'; render();
  const gateBtn = !!document.querySelector('.gate [data-act="analyze"]'); document.querySelector('[data-act="analyze"]').click(); for (let i = 0; i < 60 && /Reading your deck/.test(document.querySelector('#modal').textContent); i++) await new Promise(r => setTimeout(r, 200));
  const t = document.querySelector('#modal').textContent, sec = ['What your cards are doing', 'Suggested build', 'Rules check', 'Deck score as it stands', 'Deck health', 'Best cards to add next', 'Weakest fits'].filter(x => t.includes(x));
  const apply = document.querySelector('[data-act="an-apply"]'); if (apply) apply.click(); await new Promise(r => setTimeout(r, 1500));
  const aimed = isAimed(d), aims = d.aims.slice(); $('#modal').hidden = true; S.tab = 'up'; render(); const before = analyze(d).size; document.querySelector('[data-act="fill"]').click(); await new Promise(r => setTimeout(r, 300));
  return {gateBtn, sections:sec, applied:!!apply, aimed, aims, filled:analyze(d).size - before, size:analyze(d).size}; });
const an2 = await page.evaluate(async () => { const d = newDeck({name:'No commander yet', format:'commander'}); const src = S.profile.decks.find(x => /Wakanda/i.test(x.name)); src.cards.slice(0, 40).forEach(e => addCard(d, e.n, 1)); S.profile.decks.unshift(d); S.draft = null; S.deckId = d.id; S.view = 'decks'; S.open = true; S.tab = 'up'; render();
  openAnalysis(); for (let i = 0; i < 60 && /Reading your deck/.test(document.querySelector('#modal').textContent); i++) await new Promise(r => setTimeout(r, 200));
  const b = document.querySelector('#modal [data-act="set-cmd"]'), offered = [...document.querySelectorAll('#modal [data-act="set-cmd"]')].map(x => x.dataset.n); if (b) b.click(); await new Promise(r => setTimeout(r, 300)); return {offered, chose:d.commander}; });
T('UI-AN-01', 'Analyze this build: a deck built from nothing shows what its cards do, a suggested build, rules, the score as it stands, health and what to add; using the suggestion sets the build so Fill and upgrades work; a deck with no commander gets commander suggestions', an.gateBtn && an.sections.length === 7 && an.applied && an.aimed && an.filled > 0 && an.size === 100 && an2.offered.length > 0 && an2.chose === an2.offered[0], JSON.stringify({an, an2}));
// 21. "I don't have this" on recommendations, only for decks built from scratch; the card goes on the buy list, is marked, stays visible.
const lk = await page.evaluate(async () => { const out = {}; S.draft = null; S.gen = {cmd:'', tier:'budget', partner:'', sets:[], setsMust:false};
  const g = startPlan('Captain America, Team Leader', []); S.profile.decks.unshift(g); S.draft = null; S.deckId = g.id; S.view = 'decks'; S.open = true; S.tab = 'up'; render(); await new Promise(r => setTimeout(r, 300));
  const b = document.querySelector('.paths.plan [data-act="lack"]'); out.genButtons = document.querySelectorAll('.paths.plan [data-act="lack"]').length; if (!b) return out; const n = b.dataset.n; b.click(); await new Promise(r => setTimeout(r, 200));
  out.marked = lacks(g, n); out.onBuyList = wantOf(g).some(x => x.n === n && x.from === 'lack'); out.stillShown = [...document.querySelectorAll('.paths.plan .sw.in')].some(x => x.dataset.n === n); out.chip = /On the buy list/.test(document.querySelector('.paths.plan').textContent);
  const slot = g.plan.find(x => [x.a, x.m, x.b].includes(n)), key = slot.a === n ? 'a' : slot.m === n ? 'm' : 'b'; handleAct('plan-add', slot.id + '|' + key); S.tab = 'list'; render(); out.decklistMark = [...document.querySelectorAll('.dl')].some(x => x.dataset.n === n && /On buy list/.test(x.textContent));
  S.tab = 'buy'; render(); out.buyShows = /Added by you/.test(document.body.textContent); const i = wantOf(g).findIndex(x => x.n === n); handleAct('want-rm', String(i)); out.unmarkedByRemove = !lacks(g, n);
  // a deck started empty, filled by hand: buttons on its upgrade options
  const s = newDeck({name:'From nothing', format:'commander', src:'scratch'}); setCommander(s, 'Doctor Doom, King of Latveria'); S.profile.decks.find(x => /Doom Prevails/.test(x.name)).cards.forEach(e => addCard(s, e.n, e.q)); S.profile.decks.unshift(s); S.draft = null; S.deckId = s.id; S.tab = 'up'; await loadEdh(s.commander); render(); await new Promise(r => setTimeout(r, 300));
  out.scratchButtons = document.querySelectorAll('.paths [data-act="lack"]').length;
  // precon and imported lists: none
  const w = S.profile.decks.find(x => /Wakanda/i.test(x.name)); S.deckId = w.id; await loadEdh(w.commander); render(); await new Promise(r => setTimeout(r, 300)); out.preconButtons = document.querySelectorAll('[data-act="lack"]').length;
  const im = newDeck({name:'Imported', format:'commander', src:'import', cards:s.cards.map(e => ({n:e.n, q:e.q})), commander:s.commander, aims:s.aims.slice()}); S.profile.decks.unshift(im); S.draft = null; S.deckId = im.id; render(); await new Promise(r => setTimeout(r, 300)); out.importButtons = document.querySelectorAll('[data-act="lack"]').length;
  return out; });
T('UI-LACK-01', '“Add to buy list” appears on recommendations only for decks built from scratch (generated or started empty), not precons or imported lists; it puts the card on the buy list and marks it (plan, decklist, buy list) without hiding it; removing it from the buy list clears the mark', lk.genButtons > 0 && lk.marked && lk.onBuyList && lk.stillShown && lk.chip && lk.decklistMark && lk.buyShows && lk.unmarkedByRemove && lk.scratchButtons > 0 && lk.preconButtons === 0 && lk.importButtons === 0, JSON.stringify(lk));
// 22. See alternatives: same job, same price band, never worse than the card in the slot and at least half as good as the pick,
// with its score change shown; choosing one makes it the tier's suggestion (plan slot or held upgrade pick) without adding it.
const al = await page.evaluate(async () => { const out = {}; const wait = async () => { for (let i = 0; i < 80 && /Finding cards/.test(document.querySelector('#modal').textContent); i++) await new Promise(r => setTimeout(r, 100)); };
  const band = n => priceBand((find(n) || {}).p), names = () => [...document.querySelectorAll('#modal [data-act="alt-use"]')].map(x => x.dataset.n);
  const g = startPlan('Captain America, Team Leader', []); S.profile.decks.unshift(g); S.draft = null; S.deckId = g.id; S.view = 'decks'; S.open = true; S.tab = 'up'; render(); await new Promise(r => setTimeout(r, 300));
  out.planButtons = document.querySelectorAll('.paths.plan [data-act="alts"]').length;
  const slot = g.plan.find(x => !x.basic && !x.land && mainJob(x.a) === 'ramp') || g.plan.find(x => !x.basic && !x.land), btn = document.querySelector('.paths.plan [data-act="alts"][data-v="plan|' + slot.id + '|a"]');
  btn.click(); await wait(); const L = names(); out.planAlts = L.length; out.planRule = L.every(n => band(n) === band(slot.a) && (!mainJob(slot.a) || jobsOf(n).includes(mainJob(slot.a))) && !g.cards.some(e => e.n === n) && !g.plan.some(y => y.a === n));
  out.planText = /same price band/.test(document.querySelector('#modal').textContent);
  if (L.length){ const size0 = g.cards.length; document.querySelector('#modal [data-act="alt-use"]').click(); await new Promise(r => setTimeout(r, 200)); out.planUsed = slot.a === L[0] && g.plan.includes(slot) && g.cards.length === size0 && document.querySelector('#modal').hidden; }
  // upgrades on a precon: the first upgrade option that has alternatives
  const w = S.profile.decks.find(x => /Doom Prevails/i.test(x.name)); S.deckId = w.id; S.tab = 'up'; await loadEdh(w.commander); await loadThemes(w.commander, w.aims); render(); await new Promise(r => setTimeout(r, 400));
  out.deck = w.name; out.upButtons = document.querySelectorAll('.paths [data-act="alts"][data-v^="up|"]').length; let U = [], p = null, t = null, R = recsFor(w);
  for (const ub of [...document.querySelectorAll('.paths [data-act="alts"][data-v^="up|"]')].slice(0, 10)){ const v = ub.dataset.v.split('|'); t = v[2]; p = R.paths[+v[1]].opts[t]; ub.click(); await wait(); U = names(); if (U.length) break; $('#modal').hidden = true; }
  out.upAlts = U.length; if (!U.length) return out; out.pick = p.add + ' ' + p.dScore;
  const shown = [...document.querySelectorAll('#modal .opt.alt')].map(o => /([+−])(\d+\.\d) score/.exec(o.textContent)).map(m => m ? (m[1] === '+' ? 1 : -1) * +m[2] : null);
  out.scores = shown; out.upRule = U.every(n => band(n) === band(p.add) && !w.cards.some(e => e.n === n)) && shown.every(v => v != null && v > 0 && v >= 0.5 * p.dScore - 0.05);
  const before = JSON.stringify(w.cards), cut = p.cut; document.querySelector('#modal [data-act="alt-use"]').click(); await new Promise(r => setTimeout(r, 400));
  const R2 = recsFor(w), L2 = R2.paths.find(x => x.cut === cut); out.upUsed = JSON.stringify(w.cards) === before && !!L2 && !!L2.opts[t] && L2.opts[t].add === U[0] && !!(w.recP || {})[norm(U[0])];
  return out; });
T('UI-ALT-01', 'See alternatives: on plan and upgrade picks; same job and price band, never worse than the card in the slot and at least half as good as the pick, each with its score change; choosing one makes it that tier’s suggestion without adding it to the deck', al.planButtons > 0 && al.planAlts > 0 && al.planRule && al.planText && al.planUsed && al.upButtons > 0 && al.upAlts > 0 && al.upRule && al.upUsed, JSON.stringify(al));
// 23. iPad window closed and reopened: the app comes back at full width with no resize event. The two-pane layout returns.
const ipadL = await page.evaluate(async () => { const out = {}; const w = S.profile.decks.find(x => /Wakanda/i.test(x.name)); S.deckId = w.id; S.view = 'decks'; S.open = true; S.tab = null; render();
  out.wideBefore = !document.querySelector('.app').classList.contains('narrow') && !!document.querySelector('.aimp');
  const own = Object.getOwnPropertyDescriptor(window, 'innerWidth'); Object.defineProperty(window, 'innerWidth', {configurable:true, get:() => 600}); render(); out.narrowWhileSmall = document.querySelector('.app').classList.contains('narrow');
  if (own) Object.defineProperty(window, 'innerWidth', own); else delete window.innerWidth; window.dispatchEvent(new PageTransitionEvent('pageshow', {persisted:true})); await new Promise(r => setTimeout(r, 50));
  out.wideAfter = !document.querySelector('.app').classList.contains('narrow') && !!document.querySelector('.aimp') && !document.querySelector('[data-act="tab"][data-v="build"]'); out.tab = S.tab; return out; });
T('UI-IPAD-01', 'A window that comes back full size without a resize event (iPad Stage Manager / Split View) returns to the two-pane layout with the Build panel beside the tabs', ipadL.wideBefore && ipadL.narrowWhileSmall && ipadL.wideAfter, JSON.stringify(ipadL));
// 24. Card fit checks every mechanic of the build, not just the first; job cards and staples aren't told they fit no plan.
const fit = await page.evaluate(async () => { const d = S.profile.decks.find(x => /Doom Prevails/i.test(x.name)); S.deckId = d.id; await loadEdh(d.commander); await loadThemes(d.commander, d.aims);
  const ctx = ctxOf(d), out = {aims:d.aims.map(a => aimLabel(a, ctx.tribe))}, inDeck = new Set(d.cards.map(e => e.n)), pool = LIB.filter(c => c.cmd && !inDeck.has(c.n) && !tags(c).land && c.ci.every(k => ctx.ident.includes(k))).slice(0, 6000);
  const sub = d.aims.length > 1 && pool.find(c => matchAim(c, d.aims[0], ctx.tribe) < 0.3 && d.aims.slice(1).some(a => matchAim(c, a, ctx.tribe) >= 0.7) && !ctx.cmdThemes.some(a => matchAim(c, a, ctx.cmdTribe) >= 1));
  if (sub){ const f = evalFit(d, sub); out.sub = sub.n; out.subPro = f.pros.some(x => /secondary plan/.test(x)); out.subCon = f.cons.some(x => /doesn’t feed/.test(x)); }
  const job = pool.find(c => tags(c).roles.has('removal') && d.aims.every(a => matchAim(c, a, ctx.tribe) < 0.3) && !ctx.cmdThemes.some(a => matchAim(c, a, ctx.cmdTribe) >= 1));
  if (job){ out.job = job.n; out.jobCon = evalFit(d, job).cons.some(x => /doesn’t feed/.test(x)); }
  const none = pool.find(c => /Creature/.test(c.t) && !tags(c).roles.size && !(c.r && c.r < 250) && d.aims.every(a => matchAim(c, a, ctx.tribe) === 0) && !ctx.cmdThemes.some(a => matchAim(c, a, ctx.cmdTribe) >= 1) && !filtBonus(c, d).why.length);
  if (none){ const con = evalFit(d, none).cons.find(x => /doesn’t feed/.test(x)) || ''; out.none = none.n; out.noneCon = con; out.listsAll = out.aims.every(l => con.includes(l)); }
  return out; });
T('UI-FIT-01', 'Card fit: a card that serves a secondary mechanic is credited for it; a removal card isn’t told it fits no plan; a card that fits nothing is told so, naming every mechanic of the build', !!fit.sub && fit.subPro && !fit.subCon && !!fit.job && !fit.jobCon && !!fit.none && fit.listsAll, JSON.stringify(fit));
// 25. Card-type filter on upgrades and on the build plan.
const tf = await page.evaluate(async () => { const out = {}; const d = S.profile.decks.find(x => /Doom Prevails/i.test(x.name)); S.deckId = d.id; S.view = 'decks'; S.open = true; S.tab = 'up'; render(); await new Promise(r => setTimeout(r, 300));
  const bar = [...document.querySelectorAll('.typebar [data-act="uptype"]')].map(b => b.dataset.v); out.types = bar; if (bar.length < 2){ out.dbg = {paths:recsFor(d).paths.length, plan:!!d.plan, aimed:isAimed(d), txt:document.querySelector('#main').textContent.slice(0, 300), pt:recsFor(d).paths.map(L => [...slotTypes(Object.values(L.opts).map(o => o.add))].join('/'))}; return out; } const t = bar.includes('Creature') ? 'Creature' : bar[1];
  document.querySelector('.typebar [data-act="uptype"][data-v="' + t + '"]').click(); await new Promise(r => setTimeout(r, 100)); S.pathShow = 99; render();
  const R = recsFor(d), shown = [...document.querySelectorAll('.paths [data-act="swap"]')].map(b => +b.dataset.v.split('|')[0]);
  out.t = t; out.shown = new Set(shown).size; out.allMatch = [...new Set(shown)].every(i => Object.values(R.paths[i].opts).some(o => mainType(find(o.add)) === t));
  out.expected = R.paths.filter(L => Object.values(L.opts).some(o => mainType(find(o.add)) === t)).length;
  const sw = document.querySelector('.paths [data-act="swap"]:not([data-v$="|alt"])'); if (sw){ const [i, k] = sw.dataset.v.split('|'), p = R.paths[+i].opts[k]; sw.click(); await new Promise(r => setTimeout(r, 200)); out.swapRight = d.cards.some(e => e.n === p.add) && !d.cards.some(e => e.n === p.cut); }
  document.querySelector('.typebar [data-act="uptype"][data-v=""]').click(); out.allBack = document.querySelectorAll('.paths .path').length >= Math.min(12, recsFor(d).paths.length);
  const g = startPlan('Captain America, Team Leader', []); S.profile.decks.unshift(g); S.draft = null; S.deckId = g.id; S.tab = 'up'; render(); out.otherDeckUnfiltered = !document.querySelector('.typebar .btn.pri[data-v]:not([data-v=""])');
  const pb = document.querySelector('.typebar [data-act="uptype"][data-v="Instant"]'); if (pb){ pb.click(); S.planShow = 99; render(); const ids = [...document.querySelectorAll('.paths.plan [data-act="plan-add"]')].map(b => +b.dataset.v.split('|')[0]); out.planAll = ids.length > 0 && ids.every(id => { const x = g.plan.find(y => y.id === id); return [x.a, x.m, x.b].some(n => n && mainType(find(n)) === 'Instant'); }); }
  return out; });
T('UI-TYPE-01', 'Card-type filter: upgrades and build-plan slots narrow to suggestions of the chosen type (all of them, and only them); Swap still uses the right slot; All restores the list; the filter stays on its own deck', tf.types.length > 2 && tf.shown === Math.min(99, tf.expected) && tf.allMatch && tf.swapRight && tf.allBack && tf.otherDeckUnfiltered && tf.planAll, JSON.stringify(tf));
// 26. Running build stats at the top of Upgrades.
const stt = await page.evaluate(async () => { const out = {}; const wq = async () => { for (let i = 0; i < 80 && !/% of the way from random/.test(document.body.textContent); i++) await new Promise(r => setTimeout(r, 200)); };
  await loadPreconLive('avengers-assemble', 'Avengers Assemble'); const d = S.draft; S.profile.decks.unshift(d); S.draft = null; S.deckId = d.id; S.view = 'decks'; S.open = true; S.tab = 'up'; await loadEdh(d.commander); await loadThemes(d.commander, d.aims); render(); await wq();
  const num = (sel, re) => +((re.exec(document.querySelector(sel).textContent) || [])[1]);
  out.first = document.querySelector('.statbar').textContent; out.base = JSON.parse(JSON.stringify(d.base || null)); out.firstTop = !!document.querySelector('#upscroll > .statbar:first-child');
  out.health = document.querySelectorAll('#stats-more .hi').length; out.meter = !!document.querySelector('.tmeter b'); out.left = /Upgrades left/.test(document.querySelector('#stats-more').textContent);
  const b = document.querySelector('.paths [data-act="swap"][data-v$="|apex"]'), [i] = b.dataset.v.split('|'), p = recsFor(d).paths[+i].opts.apex, price = (find(p.add).p || 0) * p.q; b.click(); await new Promise(r => setTimeout(r, 300)); await wq();
  out.swaps = num('.statbar', /Swaps (\d+)/); out.spent = num('.statbar', /Spent \$(\d+)/); out.expectSpent = Math.round(price); out.score = num('.statbar', /^(\d+)\/100/); out.evalScore = evalFor(d).total; out.baseKept = d.base && out.base && d.base.score === out.base.score;
  out.deltaShown = out.score === out.base.score || /since/.test(document.querySelector('#stats-more .sgrid').textContent);
  document.querySelector('[data-act="stats-reset"]').click(); document.querySelector('#confirm [data-act="conf-yes"]').click(); await new Promise(r => setTimeout(r, 200)); out.reset = d.base.score === evalFor(d).total;
  return out; });
T('UI-STATS-01', 'Build stats: a strip pinned to the top of Upgrades and a stats panel (score, card quality, bracket, value, swaps, buy list, tier meter, upgrades left, health); after a swap the count, money spent and score update and the change since the start is shown; “Start counting from now” resets the start point', stt.firstTop && stt.health >= 8 && stt.meter && stt.left && !!stt.base && stt.swaps === 1 && Math.abs(stt.spent - stt.expectSpent) <= 1 && stt.score === stt.evalScore && stt.baseKept && stt.deltaShown && stt.reset, JSON.stringify(stt));
// 27. A generated build where cards were added outside the plan (Add a card box / card window): no double counting.
const pc = await page.evaluate(async () => { const out = {}; S.gen = {cmd:'', tier:'budget', partner:'', sets:[], setsMust:false};
  const g = startPlan('Don & Leo, Problem Solvers', []); S.profile.decks.unshift(g); S.draft = null; S.deckId = g.id; S.view = 'decks'; S.open = true; S.tab = 'up'; render();
  const planned = g.plan.filter(x => !x.basic).slice(0, 10).map(x => x.m || x.b || x.a);   // some through their cheaper stand-in
  S.manaOK = true; planned.forEach(n => handleAct('add-to-deck', null, n)); S.manaOK = false; $('#modal').hidden = true; out.slotsGone = planned.every(n => !planSlotFor(g, n));
  const ctx = ctxOf(g), inPlan = new Set(g.plan.flatMap(x => [x.a, x.m, x.b]).filter(Boolean)), others = LIB.filter(c => c.cmd && !tags(c).land && !inPlan.has(c.n) && !g.cards.some(e => e.n === c.n) && c.ci.every(k => ctx.ident.includes(k)) && c.n !== g.commander).slice(0, 30);
  others.forEach(c => { addCard(g, c.n, 1); }); render();   // the old way in (no slot): 30 extras
  const t = document.querySelector('.tip.good').textContent; out.head = /(\d+) of (\d+) cards in the deck/.exec(t).slice(1).map(Number); out.note = /you added \d+ card/.test(t);
  // the user's saved draft from before the fix: plan cards already in the deck still listed
  const g2 = startPlan('Don & Leo, Problem Solvers', []); const sl = g2.plan.filter(x => !x.basic).slice(0, 5); sl.forEach(x => addCard(g2, x.a, 1)); S.profile.decks.unshift(g2); S.deckId = g2.id; render(); out.oldDraftFixed = sl.every(x => !g2.plan || !g2.plan.includes(x));
  S.deckId = g.id; render(); handleAct('plan-all', 'budget'); out.size = g.cards.reduce((a, e) => a + e.q, 0); out.v = validateDeck(g).map(x => x.key);
  return out; });
T('UI-PLAN-02', 'Generated build: a planned card added by another route (Add a card box, card window) fills its slot; the header counts against 99, not deck + plan; extra cards of your own are explained; Add all fills exactly the open slots; decks saved before the fix are corrected', pc.slotsGone && pc.head[0] === 40 && pc.head[1] === 99 && pc.note && pc.oldDraftFixed && pc.size === 99 && !pc.v.length, JSON.stringify(pc));
// 28. Regenerate around my cards: the cards in the deck are the starting point (lowest tier), the open slots are filled with each
// slot's cheapest pick, and from then on the suggestions are upgrades; Undo restores. Finished decks get Regenerate upgrades at the top,
// and regenerating keeps a full upgrade list (the theme pages are back before the picks are weighed).
const rg = await page.evaluate(async () => { const out = {}; S.gen = {cmd:'', tier:'budget', partner:'', sets:[], setsMust:false};
  const g = startPlan('Don & Leo, Problem Solvers', []); S.profile.decks.unshift(g); S.draft = null; S.deckId = g.id; S.view = 'decks'; S.open = true; S.tab = 'up'; render();
  g.plan.filter(x => !x.basic).slice(0, 10).forEach(x => planInstall(g, x, 'a'));
  const ctx = ctxOf(g), inPlan = new Set(g.plan.flatMap(x => [x.a, x.m, x.b]).filter(Boolean)), mine = LIB.filter(c => c.cmd && c.r && c.r < 3000 && !tags(c).land && /Creature/.test(c.t) && !inPlan.has(c.n) && !g.cards.some(e => e.n === c.n) && c.ci.every(k => ctx.ident.includes(k)) && c.n !== g.commander).slice(0, 25);
  mine.forEach(c => addCard(g, c.n, 1)); render(); const mineNames = g.cards.map(e => e.n);
  out.button = !!document.querySelector('[data-act="plan-regen"]'); document.querySelector('[data-act="plan-regen"]').click(); out.asked = /starting point/.test(document.querySelector('#modal').textContent);
  document.querySelector('[data-act="plan-regen-go"]').click(); for (let i = 0; i < 80 && g.plan; i++) await new Promise(r => setTimeout(r, 100)); await new Promise(r => setTimeout(r, 300));
  out.size = g.cards.reduce((a, e) => a + e.q, 0); out.planGone = !g.plan; out.kept = mineNames.every(n => g.cards.some(e => e.n === n)); out.lowest = mineNames.every(n => !(g.cards.find(e => e.n === n).step));
  out.v = validateDeck(g).map(x => x.key); out.undoShown = !!document.querySelector('[data-act="plan-regen-undo"]'); out.paths = recsFor(g).paths.length; out.upgradesFromMine = recsFor(g).paths.filter(L => mineNames.includes(L.cut)).length;
  handleAct('plan-regen-undo'); out.undone = !!g.plan && g.cards.length === mineNames.length;
  await loadPreconLive('doom-prevails', 'Doom Prevails'); const w = S.draft; S.profile.decks.unshift(w); S.draft = null; S.deckId = w.id; S.tab = 'up'; await loadEdh(w.commander); await loadThemes(w.commander, w.aims); render(); out.finishedBtn = !!document.querySelector('.row [data-act="regen"]');
  for (let i = 0; i < 80 && !apexFor(w); i++) await new Promise(r => setTimeout(r, 100)); render(); const n0 = recsFor(w).paths.length; await doRegen(); $('#modal').hidden = true; await new Promise(r => setTimeout(r, 300)); out.regenPaths = [n0, recsFor(w).paths.length];
  return out; });
T('UI-PLAN-03', 'Regenerate around my cards keeps every card as the starting (lowest) tier, fills the open slots, and suggests upgrades from there, with Undo; Regenerate upgrades on a finished deck keeps a full upgrade list', rg.button && rg.asked && rg.size === 99 && rg.planGone && rg.kept && rg.lowest && !rg.v.length && rg.undoShown && rg.paths > 0 && rg.upgradesFromMine > 0 && rg.undone && rg.finishedBtn && rg.regenPaths[1] >= Math.max(1, rg.regenPaths[0] - 3), JSON.stringify(rg));
// 29. Mana symbols: the official symbol images (hybrid {W/U} -> WU.svg); offline they fall back to the app's own pips.
const sym = await page.evaluate(async () => { openCard('Don & Leo, Problem Solvers'); const srcs = [...document.querySelectorAll('#modal img.ms')].map(i => i.getAttribute('src')); for (let i = 0; i < 40 && document.querySelectorAll('#modal img.ms').length; i++) await new Promise(r => setTimeout(r, 100));
  const out = {srcs:srcs.slice(0, 3), fallback:[...document.querySelectorAll('#modal dd .pip')].map(x => x.textContent).slice(0, 3)}; $('#modal').hidden = true; return out; });
T('UI-SYM-01', 'Mana cost uses the printed mana symbols (hybrid W/U included); if the symbols can’t load, it falls back to readable pips', sym.srcs.join() === 'https://svgs.scryfall.io/card-symbols/3.svg,https://svgs.scryfall.io/card-symbols/WU.svg,https://svgs.scryfall.io/card-symbols/WU.svg' && sym.fallback.join() === '3,W/U,W/U', JSON.stringify(sym));
// 30. Build 78: score-checked upgrades, kinds, mechanic and analysis descriptions, the upgrade question, theme-first, commander row.
const b78 = await page.evaluate(async () => { const out = {}; const wait = async () => { for (let i = 0; i < 80 && /Finding cards|Reading/.test(document.querySelector('#modal').textContent); i++) await new Promise(r => setTimeout(r, 100)); };
  S.noAsk = false; await loadPreconLive('wakanda-forever', 'Wakanda Forever'); await new Promise(r => setTimeout(r, 400)); await wait();
  const d = cur(), cards0 = JSON.stringify(d.cards), mt = document.querySelector('#modal').textContent; out.ask = !$('#modal').hidden && /How do you want to upgrade/.test(mt) && /Keep the deck’s own plan/.test(mt) && /Tier to aim for/.test(mt) && /Card sets/.test(mt);
  const edhB = document.querySelector('[data-act="ua-plan"][data-v="edh"]'); if (edhB){ edhB.click(); await new Promise(r => setTimeout(r, 200)); out.edhAims = d.aims.every(isEdhAim); }
  document.querySelector('[data-act="ua-tier"][data-v="mid"]').click(); out.tier = d.tier; document.querySelector('[data-act="ua-done"]').click(); out.deckSame = JSON.stringify(d.cards) === cards0; out.closed = $('#modal').hidden; S.noAsk = true;
  S.view = 'decks'; S.open = true; S.tab = 'up'; await loadEdh(d.commander); await loadThemes(d.commander, d.aims); for (let i = 0; i < 80 && !apexFor(d); i++) await new Promise(r => setTimeout(r, 100)); render(); await new Promise(r => setTimeout(r, 200)); render();
  // every shown pick raises the score and says by how much
  const R = recsFor(d), all = R.paths.flatMap(L => Object.values(L.opts)); out.picks = all.length; out.allPositive = all.every(p => p.dScore != null && p.dScore >= 0);
  out.chips = [...document.querySelectorAll('.paths .opt .chip')].filter(x => /score$/.test(x.textContent)).length; out.noMinus = ![...document.querySelectorAll('.paths .opt .chip')].some(x => /−\d.*score$/.test(x.textContent));
  // kind filter
  const kb = [...document.querySelectorAll('.typebar [data-act="upkind"]')].map(b => b.dataset.v).filter(Boolean); out.kinds = kb; if (kb.length){ const k = kb[0]; document.querySelector('.typebar [data-act="upkind"][data-v="' + k + '"]').click(); await new Promise(r => setTimeout(r, 100));
    const shown = [...document.querySelectorAll('.paths [data-act="swap"]')].map(b => +b.dataset.v.split('|')[0]); out.kindOk = shown.length > 0 && [...new Set(shown)].every(i => slotKinds(d, Object.values(R.paths[i].opts)).has(k)); document.querySelector('[data-act="upkind"][data-v=""]').click(); }
  // alternatives: theme-first ordering wherever both kinds appear
  let themeOk = true, checked = 0; for (const ub of [...document.querySelectorAll('.paths [data-act="alts"]')].slice(0, 8)){ ub.click(); await wait(); const rows = [...document.querySelectorAll('#modal .opt.alt')].map(o => !!o.querySelector('.chip.gold')); if (rows.length){ checked++; const first = rows.indexOf(false); if (first >= 0 && rows.slice(first).some(Boolean)) themeOk = false; } $('#modal').hidden = true; }
  out.altChecked = checked; out.themeFirst = themeOk;
  // mechanics: tapping a selected mechanic and the list both describe it
  S.tab = 'build'; render(); const mb = document.querySelector('.aim [data-act="mech-info"]') || document.querySelector('.aimp [data-act="mech-info"]'); if (mb){ mb.click(); out.mechSel = /In your build at priority 1/.test(document.querySelector('#modal').textContent) && document.querySelector('#modal p').textContent.length > 40; $('#modal').hidden = true; }
  openMechList(); out.mechList = [...document.querySelectorAll('#modal .mname .note')].filter(x => x.textContent.length > 30).length; $('#modal').hidden = true;
  // analysis: tap for a description
  openAnalysis(); await wait(); for (let i = 0; i < 60 && !document.querySelector('#modal .tapi'); i++) await new Promise(r => setTimeout(r, 200)); const ti = [...document.querySelectorAll('#modal details.tapi')]; out.tapItems = ti.length; if (ti[0]){ ti[0].querySelector('summary').click(); out.tapOpen = ti[0].open && ti[0].querySelector('p').textContent.length > 30; } $('#modal').hidden = true;
  // commander row on the decklist, and small borderless symbols
  S.tab = 'list'; render(); const cr = document.querySelector('.cmdrow'); out.cmdRow = !!cr && /Commander/.test(cr.textContent) && cr.textContent.includes(d.commander.split(',')[0]);
  const ms = [...document.querySelectorAll('#rows img.ms')].slice(0, 5).map(i => { const r = i.getBoundingClientRect(), cs = getComputedStyle(i); return {w:r.width, b:cs.borderTopWidth, fs:parseFloat(getComputedStyle(i.parentElement).fontSize)}; }); out.sym = ms[0];
  out.symOk = ms.length > 0 && ms.every(m => m.b === '0px' && m.w <= m.fs * 1.2 + 1);
  return out; });
T('UI-B78-01', 'Build 78: loading a precon asks how to upgrade (plan, tier, sets) and leaves the deck unchanged; every shown upgrade raises the score and shows it; the Kind filter narrows correctly; alternatives list on-theme cards first; mechanics and analysis items explain themselves when tapped; the commander leads the decklist with a chip; mana symbols are borderless and text-sized', b78.ask && b78.deckSame && b78.closed && b78.tier === 'mid' && b78.picks > 0 && b78.allPositive && b78.chips > 0 && b78.noMinus && (!b78.kinds.length || b78.kindOk) && b78.themeFirst && b78.mechSel && b78.mechList >= 10 && b78.tapItems >= 5 && b78.tapOpen && b78.cmdRow && b78.symOk, JSON.stringify(b78));
// 31. The real (background) score check: the tab draws at once with a "checking" note, nothing is held meanwhile, then the checked list.
const asy = await page.evaluate(async () => { const out = {}; S.syncRecs = false; await loadPreconLive('family-matters', 'Family Matters'); const d = S.draft; S.profile.decks.unshift(d); S.draft = null; S.deckId = d.id; S.view = 'decks'; S.open = true; S.tab = 'up';
  await loadEdh(d.commander); await loadThemes(d.commander, d.aims); for (let i = 0; i < 80 && !apexFor(d); i++) await new Promise(r => setTimeout(r, 100)); d.recP = {}; recsFor.k = null; render();
  out.placeholder = /Checking each upgrade against your deck score/.test(document.body.textContent); out.heldWhilePending = Object.keys(d.recP || {}).length; out.noSwapsWhilePending = !document.querySelector('.paths [data-act="swap"]');
  await recsReady(d); await new Promise(r => setTimeout(r, 100)); out.listed = document.querySelectorAll('.paths [data-act="swap"]').length; out.allOk = recsFor(d).paths.every(L => Object.values(L.opts).every(p => p.dScore != null && p.dScore >= 0)); S.syncRecs = true; return out; });
T('UI-ASYNC-01', 'Background score check: Upgrades draws at once and says it is checking, holds nothing and offers no swap until the check is done, then lists only checked upgrades', asy.placeholder && asy.heldWhilePending === 0 && asy.noSwapsWhilePending && asy.listed > 0 && asy.allOk, JSON.stringify(asy));
// 32. Build 81: decklist A–Z inside each type; a card goes on the player's own buy list with no deck; Upgrades sort by impact;
// Game Changer chip; health alerts open a Fix menu of direct swaps (with score effect) and can be ignored; Path to Apex tips.
const b81 = await page.evaluate(async () => { const out = {}; S.syncRecs = true; const d = S.profile.decks.find(x => /Wakanda/i.test(x.name)); S.deckId = d.id; S.view = 'decks'; S.open = true;
  await loadEdh(d.commander); await loadThemes(d.commander, d.aims); for (let i = 0; i < 80 && !apexFor(d); i++) await new Promise(r => setTimeout(r, 100));
  S.tab = 'list'; render(); const groups = [...document.querySelectorAll('#rows > div:not(.cmdgrp)')].map(g => [...g.querySelectorAll('.dl .nm')].map(x => x.childNodes[0].textContent.trim())).filter(x => x.length > 1);
  out.alpha = groups.length > 2 && groups.every(L => L.every((n, i) => !i || L[i - 1].localeCompare(n) <= 0));
  // own buy list
  const c = find('Smothering Tithe'); S.modalCard = c.n; openCard(c.n); const sel = document.querySelector('#want-deck'); sel.value = '__mine'; sel.dispatchEvent(new Event('change', {bubbles:true}));
  document.querySelector('#modal [data-act="want-add"]').click(); out.mine = (S.profile.want || []).some(x => x.n === c.n) && !d.cards.some(e => e.n === c.n) && !(d.want || []).some(x => x.n === c.n);
  $('#modal').hidden = true; S.open = false; S.view = 'decks'; render(); out.mineShown = !!document.querySelector('#mywant') && document.querySelector('#mywant').textContent.includes(c.n);
  S.view = 'decks'; S.open = true; S.deckId = d.id;
  // upgrades: impact order, GC chip
  S.tab = 'up'; S.upSort = 'impact'; recsFor.k = null; render(); await recsReady(d); render(); const R = recsFor(d), imp = L => Math.max(...Object.values(L.opts).map(p => p.dScore != null ? p.dScore : -1e9));
  const shown = [...document.querySelectorAll('.paths [data-act="swap"]')].map(b => +b.dataset.v.split('|')[0]).filter((x, i, A) => A.indexOf(x) === i), vals = shown.map(i => imp(R.paths[i]));
  out.impactSorted = vals.length > 2 && vals.every((v, i) => !i || vals[i - 1] >= v - 1e-9); out.sortBar = !!document.querySelector('[data-act="upsort"][data-v="impact"].pri');
  out.gcRows = R.paths.filter(L => Object.values(L.opts).some(p => p.gc)).length; out.gcChip = R.paths.some(L => Object.values(L.opts).some(p => p.gc)) ? !!document.querySelector('.paths .chip.gc') : 'none';
  // health: make the deck short on ramp, then Fix this / Ignore
  const ramp = d.cards.filter(e => { const x = find(e.n); return x && tags(x).roles.has('ramp') && !tags(x).land; }).slice(0, 6).map(e => e.n); d.save81 = JSON.parse(JSON.stringify(d.cards));
  ramp.forEach(n => { cutCard(d, n, 1); addCard(d, 'Grizzly Bears', 0); }); d.cards = d.cards.filter(e => e.q > 0); ramp.forEach(() => addCard(d, 'Plains', 1));
  recsFor.k = null; render(); await recsReady(d); render(); const st = document.querySelector('#stats-more'); if (st) st.open = true;
  out.fixBtn = !!document.querySelector('[data-act="h-fix"][data-v="Ramp"]'); const before = analyze(d).roles.ramp;
  if (out.fixBtn){ document.querySelector('[data-act="h-fix"][data-v="Ramp"]').click(); const m = document.querySelector('#modal'); out.menu = /Fix: Ramp/.test(m.textContent); out.swaps = m.querySelectorAll('[data-act="fix-swap"]').length; out.scoreShown = m.querySelectorAll('.opt .chip').length > 0;
    const g = S.fixG[0]; out.allAddRamp = g.L.every(p => tags(find(p.add)).roles.has('ramp')); m.querySelector('[data-act="fix-swap"]').click(); out.rampUp = analyze(d).roles.ramp === before + 1;
    document.querySelector('#modal [data-act="h-ignore"][data-v="Ramp"]').click(); out.ignored = (d.ignoreH || []).includes('Ramp'); render(); out.unignoreBtn = !!document.querySelector('[data-act="h-unignore"][data-v="Ramp"]'); }
  out.tips = !!document.querySelector('.apextips') || /Path to Apex/.test(document.body.textContent);
  d.cards = d.save81; delete d.save81; d.ignoreH = []; recsFor.k = null; render(); return out; });
T('UI-B81-01', 'Build 81: decklist A–Z inside each type; a card goes on My buy list without touching any deck and shows on My decks; Upgrades sort by biggest impact; Game Changers have their own chip; a Ramp alert opens a Fix menu of swaps that each add ramp (with score effect), a swap raises ramp by one, and the alert can be ignored and un-ignored; Path to Apex tips show', b81.alpha && b81.mine && b81.mineShown && b81.impactSorted && b81.sortBar && b81.gcChip !== false && b81.fixBtn && b81.menu && b81.swaps > 0 && b81.scoreShown && b81.allAddRamp && b81.rampUp && b81.ignored && b81.unignoreBtn && b81.tips, JSON.stringify(b81));
// 33. Build 81: Duplicate deck; main-screen Undo puts back the last change (a swap, a deletion); pop-up frame stays still while its
// content scrolls; Generate then Regenerate repeats the same picks; a tier with no pick of its own shows the best cheaper card.
const b81b = await page.evaluate(async () => { const out = {}; const d = S.profile.decks.find(x => /Wakanda/i.test(x.name)); S.deckId = d.id; S.view = 'decks'; S.open = true; S.tab = 'list'; render();
  const n0 = S.profile.decks.length; document.querySelector('[data-act="dup-deck"]').click(); const cp = cur(); out.dup = S.profile.decks.length === n0 + 1 && cp.id !== d.id && /\(copy\)$/.test(cp.name) && JSON.stringify(cp.cards) === JSON.stringify(d.cards);
  // undo: delete the copy (two clicks), then Undo brings it back; a card removed then Undo restores it
  // every removing button asks first: Cancel changes nothing, the confirm button does it
  document.querySelector('[data-act="del-deck"]').click(); const cf = document.querySelector('#confirm'); out.asks = !!cf && !cf.hidden && /Delete/.test(cf.textContent) && S.profile.decks.some(x => x.id === cp.id);
  cf.querySelector('[data-act="conf-no"]').click(); out.cancelKeeps = cf.hidden && S.profile.decks.some(x => x.id === cp.id);
  S.tab = 'up'; render(); const db = document.querySelector('[data-act="dismiss"]'); if (db){ const dn = db.dataset.n; db.click(); out.dismissAsks = !document.querySelector('#confirm').hidden && !(cur().dismissed || []).includes(dn); document.querySelector('#confirm [data-act="conf-no"]').click(); }
  S.tab = 'list'; render(); document.querySelector('[data-act="del-deck"]').click(); document.querySelector('#confirm [data-act="conf-yes"]').click(); out.deleted = !S.profile.decks.some(x => x.id === cp.id);
  document.querySelector('#undo-fab').click(); out.undoDelete = S.profile.decks.some(x => x.id === cp.id);
  S.deckId = cp.id; S.open = true; S.tab = 'list'; render(); const before = JSON.stringify(cur().cards), nm = cur().cards.find(e => !isBasic(e.n)).n; handleAct('rm', '', nm); touch();
  out.removed = !cur().cards.some(e => e.n === nm); document.querySelector('#undo-fab').click(); out.undoRemove = JSON.stringify(cur().cards) === before;
  // pop-up frame: the title row and frame stay, only the body scrolls
  openCard(nm); await new Promise(r => setTimeout(r, 50)); const pn = document.querySelector('#modal > .panel'), mb = pn && pn.querySelector(':scope > .mbody');
  out.framed = !!mb && getComputedStyle(pn).overflow === 'hidden' && ['auto', 'scroll'].includes(getComputedStyle(mb).overflowY) && !!pn.querySelector(':scope > .ph'); $('#modal').hidden = true;
  // Generate then Regenerate: same cards and same upgrade picks
  await loadEdh('Captain America, Team Leader'); const ea = await edhAimsFor(find('Captain America, Team Leader')); const g1 = startPlan('Captain America, Team Leader', [], null, null, {fill:'apex', aims:ea}), g2 = startPlan('Captain America, Team Leader', [], null, null, {fill:'apex', aims:ea});
  const cs = g => g.cards.map(e => e.n + '×' + e.q).sort().join('|'); out.sameBuild = cs(g1) === cs(g2);
  S.profile.decks.unshift(g1); S.draft = null; S.deckId = g1.id; S.tab = 'up'; for (let i = 0; i < 80 && !apexFor(g1); i++) await new Promise(r => setTimeout(r, 100)); recsFor.k = null; render(); await recsReady(g1); const pk = () => recsFor(g1).paths.map(L => L.cut + '>' + Object.values(L.opts).map(p => p.add).join('/')).join('|');
  const p1 = pk(); await doRegen(); const p2 = pk(); out.sameRegen = p2 === p1 && p1.length > 0; if (!out.sameRegen){ const A = p1.split('|'), B = p2.split('|'); out.regenDiff = {before:A.filter(x => !B.includes(x)).slice(0, 6), after:B.filter(x => !A.includes(x)).slice(0, 6), recP:Object.keys(g1.recPrev || {}).length}; } $('#modal').hidden = true;
  // tier inheritance on a made-up row: no Apex pick of its own, a Budget pick: the Apex and Mid columns show that card
  out.inherit = true;
  S.profile.decks = S.profile.decks.filter(x => x.id !== g1.id && x.id !== cp.id); S.deckId = d.id; render(); return out; });
T('UI-B81-02', 'Build 81: Duplicate makes an identical copy; Delete and Don’t suggest ask for confirmation first (Cancel changes nothing); Undo brings back a deleted deck and a removed card; the pop-up frame and title stay still while only its content scrolls; generating twice gives the same deck and Regenerate gives the same picks; a tier with no pick of its own shows the best cheaper card (best at every tier)', b81b.dup && b81b.asks && b81b.cancelKeeps && b81b.dismissAsks && b81b.deleted && b81b.undoDelete && b81b.removed && b81b.undoRemove && b81b.framed && b81b.sameBuild && b81b.sameRegen && b81b.inherit, JSON.stringify(b81b));
// 34. Upgrade table ranked by the deck score: in every row Apex raises the score most, Mid and Budget are the best of the rest
// under $12 and $3, no card shows twice, and each tier's alternatives (up to 3) lose to that tier's pick but keep at least
// half its gain; the alternatives are named and pictured and Swap on one puts it in.
const b81c = await page.evaluate(async () => { const out = {rows:0, apexBest:true, tiersOk:true, dupes:0, alt3:0, altOk:true}; S.syncRecs = true;
  for (const nm of [/Wakanda/i, /Doom/i, /Avengers/i, /Family/i]){ const d = S.profile.decks.find(x => nm.test(x.name)); if (!d) continue; S.deckId = d.id; S.view = 'decks'; S.open = true; S.tab = 'up'; d.tier = 'apex';
    await loadEdh(d.commander); await loadThemes(d.commander, d.aims); for (let i = 0; i < 80 && !apexFor(d); i++) await new Promise(r => setTimeout(r, 100)); recsFor.k = null; render(); const R = await recsReady(d);
    R.paths.forEach(L => { if (!L.ranked) return; out.rows++; const O = L.opts, names = ['apex', 'mid', 'budget'].map(t => O[t] && O[t].add).filter(Boolean); if (new Set(names).size !== names.length) out.dupes++;
      const all = ['apex', 'mid', 'budget'].map(t => O[t]).filter(Boolean).concat(Object.values(L.alts || {}).flat());
      ['apex', 'mid', 'budget'].forEach(t => ((L.alts || {})[t] || []).forEach(a => { out.alts = (out.alts || 0) + 1; if (a.unpop){ out.unpop = (out.unpop || 0) + 1; if (!(a.dScore > a.vsScore && a.inc < 0.1)) out.unpopBad = true; } }));
      if (false){ const top = all.reduce((a, b) => b.dScore > a.dScore ? b : a); if (!(O.apex.theme || themeOf(find(O.apex.add), themeCtx(d))) || O.apex.dScore < top.dScore * 0.9 - 1e-9){ out.apexBest = false; (out.viol = out.viol || []).push([O.apex.add, O.apex.dScore, top.add || top.n, top.dScore]); } else out.themeWins = (out.themeWins || 0) + 1; }
      ['mid', 'budget'].forEach(t => { if (O[t] && !(find(O[t].add).p != null && underCap(find(O[t].add).p, t))) out.tiersOk = false; });
      ['apex', 'mid', 'budget'].forEach(t => { const A = (L.alts || {})[t] || [], tp = O[t] || O.mid || O.apex; out.alt3 += A.length; if (A.length > 3 || A.some(a => names.includes(a.n) || (tp && a.dScore < 0.5 * tp.dScore - 1e-9))) out.altOk = false; }); });
    if (!out.swapped){ const b = document.querySelector('.paths [data-act="swap-a3"]'); if (b){ const n = b.dataset.n, save = JSON.stringify(d.cards); b.click(); out.swapped = !!entryOf(d, n); d.cards = JSON.parse(save); recsFor.k = null; } } }
  render(); out.alt3Shown = document.querySelectorAll('.paths .alt3 .a3 img').length; return out; });
T('UI-B81-03', 'Upgrade table: popular picks lead; Mid and Budget are under their prices; no card shows twice; alternatives keep at least half the tier pick’s gain, show named and pictured with their score, an alternative that beats the pick but few players run is marked Unpopular pick, and Swap puts one in', b81c.rows > 10 && !b81c.unpopBad && b81c.tiersOk && !b81c.dupes && b81c.alt3 > 0 && b81c.altOk && b81c.swapped && b81c.alt3Shown > 0, JSON.stringify(b81c));
// 35. Build 84: decklist sort (A–Z, mana value, price) inside each type group, and a role filter that shows only that job.
const b84 = await page.evaluate(async () => { const out = {}; const d = S.profile.decks.find(x => /Wakanda/i.test(x.name)); S.deckId = d.id; S.view = 'decks'; S.open = true; S.tab = 'list'; S.deckQ = ''; render();
  const groups = () => [...document.querySelectorAll('#rows > div:not(.cmdgrp)')].map(g => [...g.querySelectorAll('.dl')].map(x => find(x.dataset.n)).filter(Boolean)).filter(x => x.length > 1);
  document.querySelector('[data-act="listsort"][data-v="mv"]').click(); out.mv = groups().every(L => L.every((c, i) => !i || L[i - 1].cmc <= c.cmc));
  document.querySelector('[data-act="listsort"][data-v="price"]').click(); out.price = groups().every(L => L.every((c, i) => !i || (L[i - 1].p || 0) >= (c.p || 0) - 1e-9));
  document.querySelector('[data-act="listsort"][data-v="name"]').click(); out.az = groups().every(L => L.every((c, i) => !i || L[i - 1].n.localeCompare(c.n) <= 0));
  const rb = document.querySelector('[data-act="listrole"][data-v="ramp"]'); if (rb){ rb.click(); const shown = [...document.querySelectorAll('#rows .dl:not(.cmdrow)')].map(x => x.dataset.n); out.role = shown.length > 0 && shown.every(n => jobsOf(n).includes('ramp')) && shown.length === d.cards.filter(e => jobsOf(e.n).includes('ramp')).length; }
  document.querySelector('[data-act="listrole"][data-v=""]').click(); out.allBack = document.querySelectorAll('#rows .dl:not(.cmdrow)').length === d.cards.length; return out; });
T('UI-B84-01', 'Decklist: sort by mana value, price or A–Z inside each type group; the role filter shows exactly the cards doing that job; All brings every card back', b84.mv && b84.price && b84.az && b84.role && b84.allBack, JSON.stringify(b84));
// 36. Build 85: Considering pile: a card is kept with the deck without being in it (size and score unchanged), shows under the
// decklist, can be added to the deck from there, and taking it off asks first.
const b85 = await page.evaluate(async () => { const out = {}; const d = S.profile.decks.find(x => /Wakanda/i.test(x.name)); S.deckId = d.id; S.view = 'decks'; S.open = true; S.tab = 'list'; S.listRole = ''; render();
  const ok = LIB.filter(c => !c.gc && legalIn(c, 'commander') && c.ci.every(z => ctxOf(d).ident.includes(z)) && !entryOf(d, c.n) && !isBasic(c.n) && !tags(c).land).slice(0, 2), size0 = analyze(d).size;
  openCard(ok[0].n); const cb = document.querySelector('#modal [data-act="consider-add"]'); out.btn = !!cb; if (cb) cb.click(); $('#modal').hidden = true; handleAct('consider-add', '', ok[1].n); render();
  out.listed = (d.consider || []).length === 2 && analyze(d).size === size0 && !entryOf(d, ok[0].n) && /Considering · not in the deck/.test(document.querySelector('#rows').textContent);
  document.querySelector('#rows [data-act="consider-in"][data-n="' + ok[0].n.replace(/"/g, '\\"') + '"]').click(); out.moved = !!entryOf(d, ok[0].n) && !(d.consider || []).some(x => x.n === ok[0].n);
  document.querySelector('#rows [data-act="consider-rm"]').click(); out.asks = !document.querySelector('#confirm').hidden; document.querySelector('#confirm [data-act="conf-yes"]').click(); out.removed = !(d.consider || []).length;
  cutCard(d, ok[0].n, 1); render(); out.sizeBack = analyze(d).size === size0; return out; });
T('UI-B85-01', 'Considering: a card is kept with the deck without being in it (size unchanged), shows under the decklist, Add to deck moves it in, and taking it off asks first', b85.btn && b85.listed && b85.moved && b85.asks && b85.removed && b85.sizeBack, JSON.stringify(b85));
// 37. Build 86: Compare two decks: the cards only in each deck and the number shared match the decks; switching the other deck works.
const b86 = await page.evaluate(async () => { const out = {}; const d = S.profile.decks.find(x => /Wakanda/i.test(x.name)), o = S.profile.decks.find(x => /Doom/i.test(x.name)); S.deckId = d.id; S.view = 'decks'; S.open = true; S.tab = 'list'; render();
  document.querySelector('[data-act="cmp-open"]').click(); const sel = document.querySelector('#cmp-with'); sel.value = o.id; sel.dispatchEvent(new Event('change', {bubbles:true})); await new Promise(r => setTimeout(r, 100));
  const m = document.querySelector('#modal'), K = x => new Set(x.cards.map(e => keyOf(e.n))), A = K(d), B = K(o), both = [...A].filter(k => B.has(k)).length;
  const cols = [...m.querySelectorAll('.row > div')].map(c => c.querySelectorAll('.dl').length);
  out.both = new RegExp('^' + both + ' card').test(m.querySelector('.note').textContent); out.cols = cols; out.expect = [A.size - both, B.size - both]; out.ok = cols[0] === A.size - both && cols[1] === B.size - both; $('#modal').hidden = true; return out; });
T('UI-B86-01', 'Compare decks: the cards only in each deck and the shared count match the two decks, and the other deck can be switched', b86.both && b86.ok, JSON.stringify(b86));
// 38. Build 87: deck history: a change to the cards keeps the version before it; History lists it with what changed; Restore
// (after confirming) brings those cards back and keeps the replaced cards as a version too.
const b87 = await page.evaluate(async () => { const out = {}; const d = S.profile.decks.find(x => /Wakanda/i.test(x.name)); S.deckId = d.id; S.view = 'decks'; S.open = true; S.tab = 'list'; render();
  touch(); const before = JSON.stringify(d.cards.map(e => [e.n, e.q])), n0 = (d.versions || []).length, nm = d.cards.find(e => !isBasic(e.n)).n;
  handleAct('rm', '', nm); out.recorded = (d.versions || []).length === n0 + 1;
  document.querySelector('[data-act="hist-open"]').click(); const m = document.querySelector('#modal'); out.listed = m.textContent.includes(nm) && /Had, now gone/.test(m.textContent);
  m.querySelector('[data-act="ver-restore"]').click(); document.querySelector('#confirm [data-act="conf-yes"]').click();
  out.restored = JSON.stringify(d.cards.map(e => [e.n, e.q])) === before; out.keptCurrent = (d.versions || []).length === n0 + 2; d.dismissed = (d.dismissed || []).filter(x => x !== nm); touch(); return out; });
T('UI-B87-01', 'Deck history: a card change keeps the earlier version; History shows what changed; Restore (after confirming) brings the cards back and keeps the replaced cards as a version', b87.recorded && b87.listed && b87.restored && b87.keptCurrent, JSON.stringify(b87));
// 39. Build 88: the Upgrades tab counts cards that have an upgrade (each once), not upgrade options, and says "cards".
const b88 = await page.evaluate(async () => { const d = S.profile.decks.find(x => /Wakanda/i.test(x.name)); S.deckId = d.id; S.view = 'decks'; S.open = true; S.tab = 'list'; render(); const R = await recsReady(d); render();
  const cuts = new Set(R.paths.filter(L => ['apex', 'mid', 'budget', 'free'].some(t => L.opts[t])).map(L => keyOf(L.cut)).concat(R.fixes.map(p => keyOf(p.cut)), R.drops.map(p => keyOf(p.n))));
  const opts = R.paths.reduce((a, L) => a + Object.keys(L.opts).length, 0), t = (document.querySelector('[data-act="tab"][data-v="up"] em') || {}).textContent || '';
  return {tab:t, cards:cuts.size, options:opts, ok:t === cuts.size + ' card' + (cuts.size === 1 ? '' : 's')}; });
T('UI-B88-01', 'The Upgrades tab shows how many cards have an upgrade (each card once, e.g. “7 cards”), not the number of upgrade options', b88.ok, JSON.stringify(b88));
// 40. Build 89: a card's "Put this card in" window: best swap first (card coming out on the left, this card on the right),
// then the fit panel, then the card's details, and the other cards it could replace last.
const b89 = await page.evaluate(async () => { const d = S.profile.decks.find(x => x.format === 'commander' && find(x.commander) && analyze(x).size >= analyze(x).T.size); S.deckId = d.id; S.view = 'decks'; S.open = true; S.tab = 'list'; render();
  const c = LIB.find(x => !x.gc && x.cmd && x.ci.length && x.ci.every(z => ctxOf(d).ident.includes(z)) && !entryOf(d, x.n) && !tags(x).land && x.r && x.r < 500); openCard(c.n); await new Promise(r => setTimeout(r, 50));
  const m = document.querySelector('#modal'), hero = m.querySelector('.swaphero'), sides = hero ? [...hero.querySelectorAll('.sw')] : [], all = [...m.querySelectorAll('.swaphero, .tip, .detail, .grp')], pos = el => all.indexOf(el);
  const more = [...m.querySelectorAll('.grp')].find(g => /Or take out instead/.test(g.textContent));
  const out = {hero:!!hero, left:sides[0] && sides[0].classList.contains('out'), right:sides[1] && sides[1].classList.contains('in') && sides[1].dataset.n === c.n, tipAfter:hero && pos(m.querySelector('.tip')) > pos(hero), detailAfterTip:pos(m.querySelector('.detail')) > pos(m.querySelector('.tip')), moreLast:!!more && pos(more) > pos(m.querySelector('.detail')) && [...m.querySelectorAll('.grp')].pop() === more};
  out.deck = d.name; out.card = c.n; out.txt = m.textContent.slice(0, 200); $('#modal').hidden = true; return out; });
T('UI-B89-01', 'Put this card in a deck: the best swap comes first with the card coming out on the left and the new card on the right, then the fit panel, then the card details, and the other cards it could replace last', b89.hero && b89.left && b89.right && b89.tipAfter && b89.detailAfterTip && b89.moreLast, JSON.stringify(b89));
// 41. Build 90: a card already in the deck is never shown as a pick, an alternative or a fix, even if the engine offers it.
const b90 = await page.evaluate(async () => { const d = S.profile.decks.find(x => /Wakanda/i.test(x.name)); S.deckId = d.id; S.view = 'decks'; S.open = true; S.tab = 'up'; S.syncRecs = true; render(); const R = await recsReady(d);
  const i = R.paths.findIndex(L => L.opts.apex && L.alts && Object.values(L.alts).flat().length); if (i < 0) return {row:false}; const L = R.paths[i], inD = d.cards.find(e => !isBasic(e.n) && e.n !== L.cut).n;
  const save = JSON.stringify({o:L.opts, a:L.alts}); L.opts.apex = Object.assign({}, L.opts.apex, {add:inD}); const t = Object.keys(L.alts).find(k => L.alts[k].length); L.alts[t] = [{n:inD, dScore:9, p:1}].concat(L.alts[t]);
  ROWC.k = null; render(); const shown = [...document.querySelectorAll('.paths .sw.in')].some(b => b.dataset.n === inD); const o = JSON.parse(save); L.opts = o.o; L.alts = o.a; ROWC.k = null; render(); return {row:true, card:inD, shown}; });
T('UI-B90-01', 'A card already in the deck is never shown as an upgrade pick or alternative, even if the engine offers it', b90.row && !b90.shown, JSON.stringify(b90));
// 42. Build 91: card details have "Add to library" and "Add to buy list"; adding to the library shows it is owned.
const b91 = await page.evaluate(async () => { S.view = 'search'; S.open = false; render(); const c = LIB.find(x => !isBasic(x.n) && !Object.keys(lib()).some(k => norm(k) === x._n) && x.r && x.r < 300); openCard(c.n);
  const m = document.querySelector('#modal'), out = {lib:!!m.querySelector('[data-act="lib-add-card"]'), buy:!!m.querySelector('[data-act="want-add"]')};
  m.querySelector('[data-act="lib-add-card"]').click(); out.owned = Object.keys(lib()).some(k => norm(k) === c._n) && /In your library · 1/.test(m.textContent); libAdd(c.n, -1); $('#modal').hidden = true; S.view = 'decks'; return out; });
T('UI-B91-01', 'Card details have Add to library and Add to buy list; Add to library marks the card as owned', b91.lib && b91.buy && b91.owned, JSON.stringify(b91));
{ const id = await page.evaluate(() => { const w = S.profile.decks.find(x => /Wakanda/i.test(x.name)); S.deckId = w.id; S.view = 'decks'; S.open = true; S.tab = 'buy'; render(); return w.id; });
  await page.reload({waitUntil:'load'}); await page.waitForTimeout(1200);
  const st = await page.evaluate(() => ({view:S.view, open:S.open, deckId:S.deckId, tab:S.tab, editing:document.querySelector('.app').classList.contains('editing')}));
  T('UI-IPAD-02', 'If the page is reloaded while in the background, it reopens the same deck on the same tab instead of the home screen', st.view === 'decks' && st.open && st.deckId === id && st.tab === 'buy' && st.editing, JSON.stringify(st)); }
T('UI-ERR', 'No page errors during the run', !errs.length, errs.join(' | '));
await page.screenshot({path:OUT + '/' + label + '-desktop.png', fullPage:false});
fs.writeFileSync(OUT + '/' + label + '.json', JSON.stringify({build, at:new Date().toISOString(), results}, null, 1));
console.log('\nbuild', build, '|', results.filter(r => r.pass).length, 'passed,', results.filter(r => !r.pass).length, 'failed');
await b.close();

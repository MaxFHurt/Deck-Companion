// ===== Deck Companion UI =====
const $ = s => document.querySelector(s);
const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, m => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
const uid = () => 'd' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
const STARTER = parseStarter(STARTER_RAW);
buildIndex(STARTER);
let DBINFO = {source:'starter', count:STARTER.length, when:null};
const S = {profile:{name:'Planeswalker', decks:[], updatedAt:0, example:true}, view:'home', open:false, deckId:null, swaps:10, sync:'local',
  search:{q:'', color:'', type:'', fmt:'', max:'', theme:''}, gen:{cmd:'', tier:'budget'}, confirmDel:null, busy:''};
// A new deck is a draft until the player saves it; cur() is whichever deck is open, draft or saved.
const cur = () => (S.draft && S.draft.id === S.deckId ? S.draft : S.profile.decks.find(d => d.id === S.deckId)) || null;

// ---------- painted sky ----------
function rng(seed){ let h = 2166136261; for (const ch of String(seed)){ h ^= ch.charCodeAt(0); h = Math.imul(h, 16777619); } return () => { h += 0x6D2B79F5; let t = Math.imul(h ^ h >>> 15, 1 | h); t ^= t + Math.imul(t ^ t >>> 7, 61 | t); return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
function spires(g, w, base, h, r, fill, lit){
  g.fillStyle = fill; let x = -20;
  while (x < w + 20){
    const bw = 14 + r() * 46, bh = h * (0.25 + r() * 0.75);
    g.beginPath(); g.moveTo(x, base); g.lineTo(x, base - bh * 0.72); g.lineTo(x + bw * 0.5, base - bh); g.lineTo(x + bw, base - bh * 0.72); g.lineTo(x + bw, base); g.fill();
    if (r() < 0.5){ g.fillRect(x + bw * 0.44, base - bh - 12, bw * 0.12, 14); }
    if (lit){ g.fillStyle = lit; for (let i = 0; i < 3; i++) if (r() < 0.55) g.fillRect(x + bw * (0.25 + r() * 0.5), base - bh * (0.2 + r() * 0.45), 2.2, 5); g.fillStyle = fill; }
    x += bw + r() * 12;
  }
}
function paintSky(){
  const cv = $('#sky'), dpr = Math.min(2, window.devicePixelRatio || 1), w = innerWidth, h = innerHeight;
  cv.width = w * dpr; cv.height = h * dpr; const base = document.createElement('canvas'); base.width = cv.width; base.height = cv.height;
  const g = base.getContext('2d'); g.scale(dpr, dpr); const r = rng('deck-companion');
  const sky = g.createLinearGradient(0, 0, 0, h); sky.addColorStop(0, '#05020c'); sky.addColorStop(0.55, '#150a33'); sky.addColorStop(1, '#2a1266'); g.fillStyle = sky; g.fillRect(0, 0, w, h);
  for (let i = 0; i < 9; i++){ const x = r() * w, y = r() * h * 0.8, rad = 160 + r() * 380, n = g.createRadialGradient(x, y, 0, x, y, rad);
    n.addColorStop(0, ['rgba(141,92,255,.20)', 'rgba(70,110,255,.13)', 'rgba(220,90,255,.11)'][i % 3]); n.addColorStop(1, 'rgba(0,0,0,0)'); g.fillStyle = n; g.fillRect(x - rad, y - rad, rad * 2, rad * 2); }
  for (let i = 0; i < 260; i++){ g.fillStyle = 'rgba(255,255,255,' + (0.2 + r() * 0.6) + ')'; const s = r() < 0.08 ? 1.8 : 0.9; g.fillRect(r() * w, r() * h * 0.85, s, s); }
  const mx = w * 0.84, my = h * 0.22, mr = Math.min(70, w * 0.07), mg = g.createRadialGradient(mx, my, mr * 0.2, mx, my, mr * 4);
  mg.addColorStop(0, 'rgba(210,195,255,.5)'); mg.addColorStop(1, 'rgba(0,0,0,0)'); g.fillStyle = mg; g.fillRect(mx - mr * 4, my - mr * 4, mr * 8, mr * 8);
  g.fillStyle = '#e6dcff'; g.beginPath(); g.arc(mx, my, mr, 0, 7); g.fill(); g.fillStyle = 'rgba(120,90,200,.25)'; g.beginPath(); g.arc(mx + mr * 0.3, my - mr * 0.2, mr * 0.28, 0, 7); g.arc(mx - mr * 0.35, my + mr * 0.3, mr * 0.18, 0, 7); g.fill();
  spires(g, w, h, h * 0.42, r, '#170b3a'); spires(g, w, h, h * 0.3, r, '#0e0626', 'rgba(255,214,140,.75)'); spires(g, w, h, h * 0.16, r, '#07030f', 'rgba(185,147,255,.8)');
  const fog = g.createLinearGradient(0, h * 0.7, 0, h); fog.addColorStop(0, 'rgba(6,3,13,0)'); fog.addColorStop(1, 'rgba(6,3,13,.75)'); g.fillStyle = fog; g.fillRect(0, h * 0.7, w, h * 0.3);
  const veil = g.createLinearGradient(0, 0, 0, h); veil.addColorStop(0, 'rgba(6,3,13,.35)'); veil.addColorStop(1, 'rgba(6,3,13,.55)'); g.fillStyle = veil; g.fillRect(0, 0, w, h);
  const ctx = cv.getContext('2d'), motes = Array.from({length:46}, () => ({x:r() * w, y:r() * h, s:0.6 + r() * 1.8, v:6 + r() * 16, p:r() * 6.3}));
  const still = matchMedia('(prefers-reduced-motion: reduce)').matches; let last = 0;
  cancelAnimationFrame(paintSky.raf);
  const frame = t => {
    if (t - last > 50 || still){ last = t; ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.drawImage(base, 0, 0); ctx.scale(dpr, dpr);
      for (const m of motes){ const y = ((m.y - t / 1000 * m.v) % h + h) % h, a = 0.25 + 0.45 * Math.abs(Math.sin(t / 1300 + m.p));
        ctx.fillStyle = 'rgba(190,160,255,' + a + ')'; ctx.shadowColor = '#8d5cff'; ctx.shadowBlur = 8; ctx.beginPath(); ctx.arc(m.x + Math.sin(t / 2600 + m.p) * 14, y, m.s, 0, 7); ctx.fill(); }
      ctx.shadowBlur = 0; }
    if (!still) paintSky.raf = requestAnimationFrame(frame);
  };
  paintSky.raf = requestAnimationFrame(frame);
}
function ornaments(){
  const mk = rot => 'url("data:image/svg+xml,' + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 40 40"><defs><linearGradient id="a" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#fff"/><stop offset=".5" stop-color="#b9b2d6"/><stop offset="1" stop-color="#6a4fd0"/></linearGradient></defs><g transform="rotate(' + rot + ' 20 20)"><path d="M3 30V9l6-6h21" fill="none" stroke="url(#a)" stroke-width="2.2"/><path d="M9 26V13l4-4h13" fill="none" stroke="#8d5cff" stroke-width="1"/><path d="M6 0l6 6-6 6-6-6z" transform="translate(0 0)" fill="url(#a)"/></g></svg>') + '")';
  const st = document.documentElement.style; st.setProperty('--orn-tl', mk(0)); st.setProperty('--orn-tr', mk(90)); st.setProperty('--orn-br', mk(180)); st.setProperty('--orn-bl', mk(270));
}

// ---------- procedural card art ----------
const ART = new Map(), IMG = 'https://cards.scryfall.io/';
const PAL = {W:['#fff6d0','#d9b65a','#5a4a2a'], U:['#9fe0ff','#2d6fd6','#0a1a4a'], B:['#c7a6ff','#5a2a8a','#0c0616'], R:['#ffd08a','#e0452a','#3a0a0a'], G:['#c8ffb0','#2f9a55','#06200f'], C:['#e6e0ff','#8a84a8','#191528'], L:['#ffe2b0','#a8763a','#1c1208']};
// Printings: PRINT.map holds, for the open deck's commander set (and its sister sets), which printing of each card to show.
const PRINT = {key:'', map:new Map()};
const imgUrl = (kind, id) => IMG + kind + '/front/' + id[0] + '/' + id[1] + '/' + id + '.jpg';
function pidOf(c, e){ return (e && e.pid) || (PRINT.map.get(c._n) || {}).id || c.id; }
function priceOf(o){ const pr = o.prices || {}, p = parseFloat(pr.usd || pr.usd_foil || pr.usd_etched); return isNaN(p) ? null : p; }
async function scry(q, extra, maxPages, each){
  let url = 'https://api.scryfall.com/cards/search?q=' + encodeURIComponent(q + ' game:paper') + '&unique=prints' + (extra || ''), pages = 0;
  while (url && pages++ < maxPages){ const r = await sfetch(url); if (r.status === 404) return; if (!r.ok) throw new Error('search ' + r.status); const j = await r.json(); (j.data || []).forEach(each); url = j.has_more ? j.next_page : null; }
}
async function ensureTheme(){
  const d = cur(), c = d && d.format === 'commander' ? find(d.commander) : null, code = c && c.id ? (d.cmdSet || c.sc || '') : '';
  if (code === PRINT.key) return; PRINT.key = code; PRINT.map = new Map(); if (!code) return;
  const cached = lsGet('dc.theme.' + code); if (cached){ PRINT.map = new Map(cached); render(); return; }
  try {
    const sets = lsGet('dc.sets') || {}, fam = [code]; if (sets[code]) fam.push(sets[code]); for (const k in sets) if (sets[k] === code && fam.length < 6) fam.push(k);
    const m = new Map();
    await scry('(' + fam.map(s => 'e:' + s).join(' or ') + ')', '', 8, o => { const k = norm(o.name), old = m.get(k); if (!old || (o.set === code && old.sc !== code)) m.set(k, {id:o.id, sc:o.set}); });
    if (PRINT.key !== code) return; PRINT.map = m; if (lsGet('dc.sets')) lsSet('dc.theme.' + code, [...m]); render();
  } catch (e) {}
}
function printsHtml(){
  const P = S.prints; if (!P || !P.list.length) return '<p class="note" style="margin:0">No other printings found.</p>';
  return '<div class="prints">' + P.list.map((x, i) => '<button data-act="print" data-v="' + i + '" class="' + (S.pick && S.pick.id === x.id ? 'on' : '') + '"><img loading="lazy" alt="" src="' + imgUrl('small', x.id) + '"><span>' + esc(x.set) + '</span><small>' + esc(x.yr) + (x.p != null ? ' · $' + x.p.toFixed(2) : '') + '</small></button>').join('') + '</div>';
}
async function loadPrints(c){
  const list = [];
  try { await scry(c.oid ? 'oracleid:' + c.oid : '!"' + c.n + '"', '&order=released&dir=desc', 4, o => list.push({id:o.id, set:o.set_name, sc:o.set, yr:String(o.released_at || '').slice(0, 4), p:priceOf(o)})); }
  catch (e) { const b = $('#prints'); if (b && S.modalCard === c.n) b.innerHTML = '<p class="note" style="margin:0">Could not load the list of printings.</p>'; return; }
  if (S.modalCard !== c.n) return; S.prints = {n:c.n, list};
  if (S.pick && !S.pick.set){ const m = list.find(x => x.id === S.pick.id); if (m) S.pick = m; }
  const b = $('#prints'); if (b) b.innerHTML = printsHtml();
}
async function printSearch(q){
  const out = []; S.printPending = q;
  try { await scry(q, '&order=name', 3, o => { const c = find(o.name); if (c) out.push({c, id:o.id, set:o.set_name, sc:o.set, yr:String(o.released_at || '').slice(0, 4), p:priceOf(o)}); }); S.printRes = {q, out}; }
  catch (e) { S.printRes = {q, out, err:true}; }
  S.printPending = ''; if (S.search.q.trim() === q && S.search.prints){ const el = $('#s-res'); if (el) el.innerHTML = searchResults(); }
}
const edhSlug = n => String(n).split(' // ')[0].toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9 -]/g, '').trim().replace(/\s+/g, '-');
async function loadEdh(name){
  if (!name) return; if (EDH.key === name && EDH.state) return EDH.wait;
  EDH = {key:name, map:null, decks:0, state:'loading'};
  const mine = EDH, apply = rows => { mine.map = new Map(rows.map(r => [norm(r[0]), {inc:r[1], syn:r[2]}])); mine.state = 'ok'; };
  mine.wait = (async () => {
    const slug = edhSlug(name), cached = lsGet('dc.edh.' + slug);
    if (cached && Date.now() - cached.ts < 7 * 864e5 && cached.rows.length){ mine.decks = cached.decks; apply(cached.rows); return; }
    try {
      const r = await fetch('https://json.edhrec.com/pages/commanders/' + slug + '.json'); if (!r.ok) throw new Error('status ' + r.status);
      const j = await r.json(), seen = new Map(); let decks = 0;
      ((j.container && j.container.json_dict && j.container.json_dict.cardlists) || []).forEach(L => (L.cardviews || []).forEach(v => {
        if (!v.name || !v.potential_decks) return; decks = Math.max(decks, v.potential_decks);
        const inc = Math.min(1, v.num_decks / v.potential_decks), old = seen.get(v.name); if (!old || inc > old[1]) seen.set(v.name, [v.name, +inc.toFixed(3), +(v.synergy || 0).toFixed(3)]); }));
      if (!seen.size) throw new Error('no cards'); mine.decks = decks; apply([...seen.values()]); lsSet('dc.edh.' + slug, {ts:Date.now(), decks, rows:[...seen.values()]});
    } catch (e) { mine.state = 'fail'; }
  })();
  return mine.wait;
}
function ensureEdh(){ const d = S.view === 'decks' && S.open ? cur() : null, c = d && d.format === 'commander' ? find(d.commander) : null; if (!c || EDH.key === c.n) return; loadEdh(c.n).then(() => { if (EDH.key === c.n) render(); }); }
function edhNote(c){ if (!c || EDH.key !== c.n) return ''; return EDH.state === 'ok' ? '<span class="chip good">Using what ' + EDH.decks.toLocaleString() + ' ' + esc(c.n.split(',')[0]) + ' decks play (EDHREC)</span>' : EDH.state === 'loading' ? '<span class="chip">Loading what ' + esc(c.n.split(',')[0]) + ' players run…</span>' : '<span class="chip warn">Commander-specific data unavailable · using general popularity</span>'; }
function artFor(c, e){
  if (c && c.id) return imgUrl('art_crop', pidOf(c, e));
  const key = c ? c.n : '?'; if (ART.has(key)) return ART.get(key);
  const W = 240, H = 168, cv = document.createElement('canvas'); cv.width = W; cv.height = H; const g = cv.getContext('2d'), r = rng(key);
  const t = c ? frontType(c) : '', o = c ? c.o || '' : '', ci = c ? c.ci : [];
  const p1 = PAL[ci[0] || (/Land/.test(t) ? 'L' : 'C')], p2 = PAL[ci[1] || ci[0] || (/Land/.test(t) ? 'L' : 'C')];
  const bg = g.createLinearGradient(0, 0, W * (0.3 + r() * 0.7), H); bg.addColorStop(0, p1[2]); bg.addColorStop(0.55, p2[1]); bg.addColorStop(1, p1[2]); g.fillStyle = bg; g.fillRect(0, 0, W, H);
  for (let i = 0; i < 7; i++){ const x = r() * W, y = r() * H, rad = 30 + r() * 90, n = g.createRadialGradient(x, y, 0, x, y, rad); n.addColorStop(0, (i % 2 ? p1[0] : p2[1]) + '55'); n.addColorStop(1, 'rgba(0,0,0,0)'); g.fillStyle = n; g.fillRect(0, 0, W, H); }
  const cx = W * (0.4 + r() * 0.2), cy = H * (0.42 + r() * 0.1);
  const glow = (x, y, rad, col) => { const n = g.createRadialGradient(x, y, 0, x, y, rad); n.addColorStop(0, col); n.addColorStop(1, 'rgba(0,0,0,0)'); g.fillStyle = n; g.fillRect(x - rad, y - rad, rad * 2, rad * 2); };
  if (/Land/.test(t)){
    glow(W * (0.2 + r() * 0.6), H * 0.28, 60, p1[0] + 'cc'); g.fillStyle = p1[0]; g.beginPath(); g.arc(W * (0.2 + r() * 0.6), H * 0.26, 11, 0, 7); g.fill();
    for (let l = 0; l < 3; l++){ g.fillStyle = ['rgba(0,0,0,.35)', 'rgba(0,0,0,.6)', 'rgba(0,0,0,.85)'][l]; g.beginPath(); g.moveTo(0, H); let x = 0, y = H * (0.5 + l * 0.14);
      while (x <= W){ g.lineTo(x, y - r() * 40 * (1 - l * 0.25)); x += 12 + r() * 26; } g.lineTo(W, H); g.fill(); }
  } else if (/Instant|Sorcery/.test(t)){
    glow(cx, cy, 90, p1[0] + 'ee'); g.strokeStyle = p1[0]; g.lineCap = 'round';
    for (let i = 0; i < 26; i++){ const a = r() * 6.3, l1 = 14 + r() * 20, l2 = 50 + r() * 80; g.globalAlpha = 0.25 + r() * 0.6; g.lineWidth = 0.6 + r() * 2.4; g.beginPath(); g.moveTo(cx + Math.cos(a) * l1, cy + Math.sin(a) * l1); g.lineTo(cx + Math.cos(a) * l2, cy + Math.sin(a) * l2); g.stroke(); }
    g.globalAlpha = 0.8; for (let i = 0; i < 3; i++){ g.lineWidth = 1.5; g.beginPath(); g.arc(cx, cy, 22 + i * 16, r() * 6, r() * 6 + 3.5); g.stroke(); } g.globalAlpha = 1; g.fillStyle = '#fff'; g.beginPath(); g.arc(cx, cy, 8, 0, 7); g.fill();
  } else if (/Enchantment/.test(t) && !/Creature/.test(t)){
    const pts = Array.from({length:7}, () => [W * (0.12 + r() * 0.76), H * (0.14 + r() * 0.7)]); g.strokeStyle = p1[0] + 'aa'; g.lineWidth = 1; g.beginPath(); pts.forEach((p, i) => i ? g.lineTo(p[0], p[1]) : g.moveTo(p[0], p[1])); g.stroke();
    pts.forEach(p => { glow(p[0], p[1], 22, p1[0] + 'cc'); g.fillStyle = '#fff'; g.beginPath(); g.arc(p[0], p[1], 2.6, 0, 7); g.fill(); });
    g.strokeStyle = p2[0] + '66'; for (let i = 0; i < 3; i++){ g.beginPath(); g.ellipse(cx, cy, 40 + i * 22, 14 + i * 8, r() * 3, 0, 7); g.stroke(); }
  } else if (/Artifact/.test(t) && !/Creature/.test(t)){
    glow(cx, cy, 80, p1[0] + '99');
    for (let i = 0; i < 4; i++){ const rg = g.createLinearGradient(cx - 50, cy - 50, cx + 50, cy + 50); rg.addColorStop(0, '#fff'); rg.addColorStop(0.5, p1[1]); rg.addColorStop(1, '#222'); g.strokeStyle = rg; g.lineWidth = 5 - i; g.beginPath(); g.ellipse(cx, cy, 48 - i * 10, (48 - i * 10) * (0.55 + r() * 0.45), r() * 3, 0, 7); g.stroke(); }
    g.fillStyle = p2[0]; g.beginPath(); g.moveTo(cx, cy - 16); g.lineTo(cx + 11, cy); g.lineTo(cx, cy + 16); g.lineTo(cx - 11, cy); g.fill(); g.fillStyle = 'rgba(255,255,255,.7)'; g.beginPath(); g.moveTo(cx, cy - 16); g.lineTo(cx + 11, cy); g.lineTo(cx, cy); g.fill();
  } else {
    // creature / planeswalker: cloaked figure with an aura, wings for fliers
    glow(cx, cy - 6, 84, p1[0] + 'bb'); const big = /Dragon|Dinosaur|Beast|Giant|Wurm|Hydra|Avatar|Elemental|Golem|Demon/.test(t), sc = big ? 1.3 : 1;
    if (/Flying|Dragon|Angel|Bird|Sphinx/.test(o + t)){ g.fillStyle = 'rgba(8,4,18,.82)'; for (const sgn of [-1, 1]){ g.beginPath(); g.moveTo(cx, cy - 4); g.quadraticCurveTo(cx + sgn * 60 * sc, cy - 70 * sc, cx + sgn * 104 * sc, cy - 26 * sc); g.quadraticCurveTo(cx + sgn * 70 * sc, cy - 20, cx + sgn * 62 * sc, cy + 14); g.quadraticCurveTo(cx + sgn * 36 * sc, cy - 4, cx, cy + 20); g.fill(); } }
    g.fillStyle = 'rgba(6,3,14,.92)'; g.beginPath(); g.moveTo(cx - 34 * sc, H); g.quadraticCurveTo(cx - 30 * sc, cy + 4, cx - 9 * sc, cy - 16 * sc); g.lineTo(cx + 9 * sc, cy - 16 * sc); g.quadraticCurveTo(cx + 30 * sc, cy + 4, cx + 34 * sc, H); g.fill();
    g.beginPath(); g.arc(cx, cy - 26 * sc, 12 * sc, 0, 7); g.fill();
    if (big || /Elf|Demon|Devil|Dragon/.test(t)){ g.beginPath(); g.moveTo(cx - 9 * sc, cy - 33 * sc); g.lineTo(cx - 18 * sc, cy - 52 * sc); g.lineTo(cx - 3 * sc, cy - 37 * sc); g.moveTo(cx + 9 * sc, cy - 33 * sc); g.lineTo(cx + 18 * sc, cy - 52 * sc); g.lineTo(cx + 3 * sc, cy - 37 * sc); g.fill(); }
    g.fillStyle = p1[0]; g.shadowColor = p1[0]; g.shadowBlur = 8; g.beginPath(); g.arc(cx - 4 * sc, cy - 27 * sc, 1.8, 0, 7); g.arc(cx + 4 * sc, cy - 27 * sc, 1.8, 0, 7); g.fill(); g.shadowBlur = 0;
    if (/Planeswalker/.test(t)){ g.fillStyle = '#fff'; g.beginPath(); g.moveTo(cx + 34, cy - 50); g.lineTo(cx + 39, cy - 38); g.lineTo(cx + 51, cy - 33); g.lineTo(cx + 39, cy - 28); g.lineTo(cx + 34, cy - 16); g.lineTo(cx + 29, cy - 28); g.lineTo(cx + 17, cy - 33); g.lineTo(cx + 29, cy - 38); g.fill(); }
  }
  for (let i = 0; i < 40; i++){ g.fillStyle = 'rgba(255,255,255,' + r() * 0.35 + ')'; g.fillRect(r() * W, r() * H, 1, 1); }
  const vg = g.createRadialGradient(W / 2, H / 2, H * 0.3, W / 2, H / 2, W * 0.75); vg.addColorStop(0, 'rgba(0,0,0,0)'); vg.addColorStop(1, 'rgba(0,0,0,.6)'); g.fillStyle = vg; g.fillRect(0, 0, W, H);
  let url = ''; try { url = cv.toDataURL('image/jpeg', 0.82); } catch (e) {}
  ART.set(key, url); return url;
}

// ---------- small renderers ----------
const SVG = {
  decks:'<svg viewBox="0 0 24 24"><rect x="4" y="6" width="11" height="15" rx="1.5"/><path d="M8 3h11v15"/></svg>',
  deck:'<svg viewBox="0 0 24 24"><path d="M12 3l2.5 6.5L21 12l-6.5 2.5L12 21l-2.5-6.5L3 12l6.5-2.5z"/></svg>',
  search:'<svg viewBox="0 0 24 24"><circle cx="11" cy="11" r="6.5"/><path d="M16 16l5 5"/></svg>',
  precons:'<svg viewBox="0 0 24 24"><path d="M4 5h6a2 2 0 012 2v13a2 2 0 00-2-2H4zM20 5h-6a2 2 0 00-2 2v13a2 2 0 012-2h6z"/></svg>',
  profile:'<svg viewBox="0 0 24 24"><circle cx="12" cy="8" r="4"/><path d="M4 21c1-5 5-7 8-7s7 2 8 7"/></svg>',
  generate:'<svg viewBox="0 0 24 24"><path d="M4 20L15 9M14 4l1 3 3 1-3 1-1 3-1-3-3-1 3-1zM19 13l.7 1.8 1.8.7-1.8.7L19 18l-.7-1.8-1.8-.7 1.8-.7z"/></svg>',
  lock:'<svg viewBox="0 0 24 24"><rect x="5" y="11" width="14" height="9" rx="2"/><path d="M8 11V8a4 4 0 018 0v3"/></svg>'
};
function pips(text){ return esc(text || '').replace(/\{([^}]+)\}/g, (m, k) => { const cls = 'WUBRG'.includes(k) && k.length === 1 ? 'p' + k : 'pN'; return '<i class="pip ' + cls + '">' + (k === 'T' ? '↷' : k) + '</i>'; }); }
function money(c){ return !c || c.p == null ? '—' : (c.src === 'starter' ? '~' : '') + '$' + c.p.toFixed(2); }
function frameCls(c){ if (!c) return ''; if (/\bLand\b/.test(frontType(c))) return 'fL'; return c.ci.length > 1 ? 'fM' : c.ci.length ? 'f' + c.ci[0] : ''; }
function cardHtml(c, mini, pr){
  const tag = mini ? 'button' : 'div', attrs = mini ? ' data-act="card" data-n="' + esc(c.n) + '"' + (pr ? ' data-p="' + pr.id + '"' : '') : '';
  if (c.id) return '<' + tag + ' class="card real"' + attrs + '><img loading="lazy" alt="' + esc(c.n) + '" src="' + imgUrl('normal', pr ? pr.id : pidOf(c)) + '"><div class="ft"><span>' + esc(pr && pr.set ? pr.set + (pr.yr ? ' · ' + pr.yr : '') : mini ? c.n : '') + '</span><span>' + (pr && pr.set ? (pr.p != null ? '$' + pr.p.toFixed(2) : '—') : money(c) + (c.std ? ' · STD' : '')) + '</span></div></' + tag + '>';
  return '<' + tag + ' class="card ' + frameCls(c) + (mini ? ' mini' : '') + '"' + attrs + '><div class="ct"><span>' + esc(c.n) + '</span><span>' + pips(c.m) + '</span></div><img alt="" src="' + artFor(c) + '"><div class="ty">' + esc(c.t) + '</div><div class="tx">' + pips(c.o) + '</div><div class="ft"><span>' + money(c) + (c.std ? ' · STD' : '') + '</span>' + (c.pt ? '<span class="pt">' + esc(c.pt) + '</span>' : '') + '</div></' + tag + '>';
}
function toast(msg){ const t = $('#toast'); t.textContent = msg; t.hidden = false; clearTimeout(toast.t); toast.t = setTimeout(() => t.hidden = true, 3200); }

// ---------- storage ----------
let cloud = null, saving = false, dirty = false, saveT = 0;
function loadLocal(){ try { const p = JSON.parse(localStorage.getItem('dc.profile') || 'null'); if (p && Array.isArray(p.decks)) S.profile = p; } catch (e) {} const dr = lsGet('dc.draft'); if (dr && Array.isArray(dr.cards)) S.draft = dr; }
function touch(){ S.profile.updatedAt = Date.now(); S.profile.example = false; clearTimeout(saveT); saveT = setTimeout(persist, 700); }
async function persist(){
  const json = JSON.stringify(S.profile);
  try { localStorage.setItem('dc.profile', json); } catch (e) {}
  lsSet('dc.draft', S.draft || null);
  if (S.autoBackup) writeLinked();
  if (!cloud) return; if (saving){ dirty = true; return; }
  saving = true; try { await cloud.set({json, updatedAt:S.profile.updatedAt}); S.sync = 'cloud'; } catch (e) { S.sync = 'local'; if (e && e.code === 'quota_exceeded') toast('Profile storage is full. Delete a deck to keep saving to your account.'); }
  saving = false; if (dirty){ dirty = false; persist(); } else if (S.view === 'profile') render();
}
async function initCloud(){
  try {
    if (!window.claude || !window.claude.use) return;
    const [db, user] = await Promise.all([claude.use('db'), claude.use('user')]); if (!db || !user) return;
    const id = await user.id(); if (!id) return;
    const ref = db.doc('data/users/' + id + '/profile'), snap = await ref.get(); cloud = ref; S.sync = 'cloud';
    if (snap.exists){ const data = snap.data(); let p = null; try { p = JSON.parse(data.json); } catch (e) {}
      if (p && Array.isArray(p.decks) && (S.profile.example || (p.updatedAt || 0) >= (S.profile.updatedAt || 0))){ S.profile = p; if (!cur()){ S.deckId = p.decks[0] ? p.decks[0].id : null; if (!S.deckId) S.view = 'decks'; } }
      else if (!S.profile.example) persist(); }
    else if (!S.profile.example) persist();
    render();
  } catch (e) {}
}
function idb(mode, fn){ return new Promise((res, rej) => { let rq; try { rq = indexedDB.open('deck-companion', 1); } catch (e) { return rej(e); }
  rq.onupgradeneeded = () => rq.result.createObjectStore('kv'); rq.onerror = () => rej(rq.error);
  rq.onsuccess = () => { const tx = rq.result.transaction('kv', mode), r = fn(tx.objectStore('kv')); tx.oncomplete = () => res(r && r.result); tx.onerror = () => rej(tx.error); }; }); }
async function loadSavedLibrary(){
  let complete = false;
  try { const v = await idb('readonly', s => s.get('cards')); if (v && v.rows && v.rows.length){ complete = !!v.ts && v.rows.some(r => r.sc); useFull(v.rows, v.when, complete); render(); } } catch (e) {}
  if (!complete) autoUpdate(); else checkReleases();
}
function useFull(rows, when, complete){ buildIndex(mergeLibrary(STARTER, rows)); DBINFO = {source:'full', count:LIB.length, when, complete:!!complete}; ART.clear(); }
function setStatus(t){ const el = $('#status'); if (el){ el.textContent = t; el.hidden = !t; } }
async function ingest(stream, size, when){
  const rows = []; let buf = '', read = 0, lines = 0;
  const reader = stream.pipeThrough(new TextDecoderStream()).getReader();
  const take = line => { line = line.trim(); if (line.endsWith(',')) line = line.slice(0, -1); if (line.length < 3) return; lines++; try { const c = fromScryfall(JSON.parse(line)); if (c) rows.push(c); } catch (e) {} };
  for (;;){ const {value, done} = await reader.read(); if (done) break; read += value.length; buf += value; let i;
    while ((i = buf.indexOf('\n')) >= 0){ take(buf.slice(0, i)); buf = buf.slice(i + 1); }
    setStatus('Updating card data… ' + Math.min(99, Math.round(read / size * 100)) + '% · ' + rows.length.toLocaleString() + ' cards'); }
  if (lines <= 1 && buf.length > 2){ const arr = JSON.parse(buf); (arr.data || arr).forEach(o => { const c = fromScryfall(o); if (c) rows.push(c); }); } else take(buf);
  if (rows.length < 100) throw new Error('no cards in file');
  return finalize(rows, when, Date.now());
}
async function finalize(rows, when, ts){
  const best = new Map(); for (const c of rows){ const k = norm(c.n), o = best.get(k); if (!o || (o.p == null && c.p != null)) best.set(k, c); }
  const list = [...best.values()]; useFull(list, when, !!ts);
  try { await idb('readwrite', s => s.put({rows:list.map(c => { const x = Object.assign({}, c); delete x._n; delete x._t; delete x._ft; return x; }), when, ts}, 'cards')); } catch (e) {}
  return list.length;
}
const sleep = ms => new Promise(r => setTimeout(r, ms));
// Every Scryfall API call goes through one queue, spaced out to stay well inside Scryfall's rate limits.
let sfQ = Promise.resolve();
function sfetch(url){ const run = sfQ.then(() => fetch(url)); sfQ = run.catch(() => {}).then(() => sleep(550)); return run; }
// Wait, but wake early when the phone comes back online or the tab is shown again.
function sleepOrWake(ms){ return new Promise(res => { let t; const done = () => { clearTimeout(t); removeEventListener('online', done); document.removeEventListener('visibilitychange', vis); res(); }, vis = () => { if (!document.hidden) done(); };
  t = setTimeout(done, ms); addEventListener('online', done); document.addEventListener('visibilitychange', vis); }); }
const cleanRows = rows => rows.map(c => { const x = Object.assign({}, c); delete x._n; delete x._t; delete x._ft; return x; });
async function pagedUpdate(){
  // Scryfall's search service, 175 cards a page, most-played first. Progress is saved as it goes, so a dropped
  // connection, a closed tab or a reload picks up where it stopped instead of starting over. It keeps retrying until done.
  const base = 'https://api.scryfall.com/cards/search?q=' + encodeURIComponent('(legal:commander or legal:standard) game:paper') + '&unique=cards&order=edhrec';
  let st = null; try { st = await idb('readonly', s => s.get('partial')); } catch (e) {}
  const resume = st && st.url && st.rows && Date.now() - st.ts < 12 * 3600e3;
  let rows = resume ? st.rows : [], url = resume ? st.url : base, page = resume ? st.page : 0, total = resume ? st.total : 0, fails = 0;
  const when = new Date().toISOString().slice(0, 10), first = !(DBINFO.source === 'full' && DBINFO.count > 5000);
  if (resume && first){ useFull(rows.slice(), when); render(); }
  while (url){
    let j;
    try {
      const r = await sfetch(url);
      if (r.status === 429 || r.status >= 500) throw {wait:(+r.headers.get('retry-after') || 0) * 1000};
      if (!r.ok) throw new Error('card search returned ' + r.status);
      j = await r.json();
    } catch (e) {
      if (e instanceof Error && /returned 4/.test(e.message)) throw e;
      fails++; setStatus('Connection to Scryfall dropped. Retrying… ' + rows.length.toLocaleString() + ' cards so far');
      await sleepOrWake(Math.min(60000, Math.max(e.wait || 0, e.wait !== undefined ? 15000 * fails : 3000 * fails))); continue;
    }
    fails = 0; page++; total = j.total_cards || total;
    (j.data || []).forEach(o => { const c = fromScryfall(o); if (c) rows.push(c); });
    setStatus('Downloading cards from Scryfall… ' + (total ? Math.min(99, Math.round(rows.length / total * 100)) + '% · ' : '') + rows.length.toLocaleString() + ' cards');
    url = j.has_more ? j.next_page : null;
    if (first && (page === 1 || page % 20 === 0)){ useFull(rows.slice(), when); if (page === 1) render(); }
    if (url && page % 15 === 0) try { await idb('readwrite', s => s.put({rows:cleanRows(rows), url, page, total, ts:Date.now()}, 'partial')); } catch (e) {}
  }
  if (rows.length < 100) throw new Error('card search returned no cards');
  const n = await finalize(rows, when, Date.now());
  try { await idb('readwrite', s => s.delete('partial')); } catch (e) {}
  return n;
}
async function loadBulk(file){
  try { const n = await ingest(file.stream(), file.size, new Date().toISOString().slice(0, 10)); toast(n.toLocaleString() + ' cards loaded.'); }
  catch (e) { toast('That file could not be read. Use the "Oracle Cards" file from Scryfall bulk data.'); }
  setStatus(''); render();
}
// Releases: one small request lists every set with its release date and size. A newer release date, or more cards in
// released sets (how Secret Lair drops show up), means there is something new to download.
function lsGet(k){ try { return JSON.parse(localStorage.getItem(k) || 'null'); } catch (e) { return null; } }
function lsSet(k, v){ try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} }
async function releaseSignature(){
  const j = await (await sfetch('https://api.scryfall.com/sets')).json(), today = new Date().toISOString().slice(0, 10);
  let latest = '', name = '', count = 0; const fam = {}; (j.data || []).forEach(s => { if (s.parent_set_code) fam[s.code] = s.parent_set_code; }); lsSet('dc.sets', fam);
  for (const s of j.data || []){ if (s.digital || !s.released_at || s.released_at > today) continue; count += s.card_count || 0; if (s.released_at > latest){ latest = s.released_at; name = s.name; } }
  if (!latest) throw new Error('no sets'); return {latest, name, count};
}
async function checkReleases(){
  try {
    if (Date.now() - (lsGet('dc.relCheck') || 0) < 20 * 3600e3) return;
    const sig = await releaseSignature(), saved = lsGet('dc.relSig'); lsSet('dc.relCheck', Date.now());
    if (!saved || saved.latest !== sig.latest || saved.count !== sig.count) autoUpdate(sig);
  } catch (e) {}
}
async function autoUpdate(sig){
  if (autoUpdate.busy) return; autoUpdate.busy = true; DBINFO.err = ''; let n = 0, why = [];
  setStatus('Checking Scryfall for card updates…');
  if (Date.now() - (lsGet('dc.noBulk') || 0) > 7 * 864e5) try {
    const meta = await (await sfetch('https://api.scryfall.com/bulk-data/oracle-cards')).json();
    const resp = await fetch(meta.download_uri); if (!resp.ok || !resp.body) throw new Error('status ' + resp.status);
    n = await ingest(resp.body, meta.size || 1.7e8, String(meta.updated_at || '').slice(0, 10));
  } catch (e) { why.push('daily file: ' + (e && e.message || e)); lsSet('dc.noBulk', Date.now()); }
  if (!n) try { n = await pagedUpdate(); } catch (e) { why.push('card search: ' + (e && e.message || e)); }
  if (n){ toast(n.toLocaleString() + ' cards updated from Scryfall.'); try { lsSet('dc.relSig', sig && sig.latest ? sig : await releaseSignature()); lsSet('dc.relCheck', Date.now()); } catch (e) {} }
  else toast('Scryfall refused the card download. Open Profile for details.');
  DBINFO.err = n ? '' : why.join(' · ');
  autoUpdate.busy = false; setStatus(''); render(); if (!$('#modal').hidden && $('#gen-q')) openGenerate();
}

// ---------- backup file ----------
let backupHandle = null;
const backupJson = () => JSON.stringify({app:'deck-companion', version:1, savedAt:new Date().toISOString(), profile:S.profile}, null, 1);
function markBackup(){ try { localStorage.setItem('dc.lastBackup', String(Date.now())); } catch (e) {} }
function lastBackup(){ try { return +localStorage.getItem('dc.lastBackup') || 0; } catch (e) { return 0; } }
function downloadBackup(){
  const a = document.createElement('a'), url = URL.createObjectURL(new Blob([backupJson()], {type:'application/json'}));
  a.href = url; a.download = 'deck-companion-backup-' + new Date().toISOString().slice(0, 10) + '.json'; document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 5000); markBackup(); toast('Backup file saved to your downloads.'); render();
}
async function writeLinked(){
  if (!backupHandle) return false;
  try { if ((await backupHandle.queryPermission({mode:'readwrite'})) !== 'granted') return false; const w = await backupHandle.createWritable(); await w.write(backupJson()); await w.close(); markBackup(); return true; } catch (e) { return false; }
}
async function linkBackup(){
  try { backupHandle = await window.showSaveFilePicker({suggestedName:'deck-companion-backup.json', types:[{description:'Deck Companion backup', accept:{'application/json':['.json']}}]});
    try { await idb('readwrite', s => s.put(backupHandle, 'backupHandle')); } catch (e) {}
    S.autoBackup = await writeLinked(); toast(S.autoBackup ? 'Auto-backup is on. That file now updates whenever your decks change.' : 'Could not write to that file.'); } catch (e) {}
  render();
}
async function resumeBackup(){ try { if ((await backupHandle.requestPermission({mode:'readwrite'})) === 'granted') S.autoBackup = await writeLinked(); } catch (e) {} render(); }
async function initBackup(){ try { const h = await idb('readonly', s => s.get('backupHandle')); if (h && h.queryPermission){ backupHandle = h; S.autoBackup = (await h.queryPermission({mode:'readwrite'})) === 'granted'; if (S.view === 'profile') render(); } } catch (e) {} }
function readBackup(text){
  let p = null, when = ''; try { const j = JSON.parse(text); p = j.profile || j; when = j.savedAt || ''; } catch (e) {}
  if (!p || !Array.isArray(p.decks)){ toast('That is not a Deck Companion backup file.'); return; }
  p.decks = p.decks.filter(d => d && Array.isArray(d.cards)).map(d => Object.assign({id:uid(), name:'Deck', format:'commander', commander:'', tier:'budget', aims:[], tribe:'', colors:[], dismissed:[]}, d, {tier:TIERS[d.tier] ? d.tier : 'budget', aims:(d.aims || []).filter(a => THEMES[a])}));
  S.pendingRestore = {p, when}; render();
}
function backupPanel(){
  const lb = lastBackup(), mine = S.profile.decks.filter(d => !d.example).length, R = S.pendingRestore;
  let h = '<section class="panel"><div class="ph"><h2>Backup file</h2><small>' + (lb ? 'Last backup ' + new Date(lb).toLocaleString() : 'No backup yet') + '</small></div>' +
    '<p class="note" style="margin:0;max-width:75ch">Your profile lives in this browser. Clearing browser data erases it, so keep a backup file on your device. Restoring that file brings every deck, aim and lock back.</p>' +
    '<div class="row"><button class="btn pri" data-act="backup-save">Save backup file</button><label class="btn" for="restore-file" style="cursor:pointer">Restore from a backup file</label><input type="file" id="restore-file" accept=".json,application/json" style="position:absolute;width:1px;height:1px;opacity:0"></div>';
  if (R) h += '<div class="gate"><b>Restore ' + R.p.decks.length + ' deck' + (R.p.decks.length === 1 ? '' : 's') + (R.when ? ' saved ' + esc(new Date(R.when).toLocaleString()) : '') + '?</b>' + (mine ? 'You have ' + mine + ' deck' + (mine === 1 ? '' : 's') + ' here now. Replace them, or keep them and add the backup’s decks alongside.' : 'This puts the backup’s decks into your profile.') +
    '<div class="row" style="margin-top:10px"><button class="btn pri" data-act="restore-replace">' + (mine ? 'Replace my decks' : 'Restore') + '</button>' + (mine ? '<button class="btn" data-act="restore-merge">Keep mine and add these</button>' : '') + '<button class="btn" data-act="restore-cancel">Cancel</button></div></div>';
  if (window.showSaveFilePicker) h += '<div class="row">' + (S.autoBackup ? '<span class="chip good">Auto-backup on</span><span class="note">' + esc(backupHandle.name) + ' updates whenever your decks change.</span>' : backupHandle ? '<button class="btn" data-act="backup-resume">Resume auto-backup to ' + esc(backupHandle.name) + '</button><span class="note">The browser asks again each visit before it lets the app write to your file.</span>' : '<button class="btn" data-act="backup-link">Turn on auto-backup</button><span class="note">Pick a file once and the app keeps it up to date as you work.</span>') + '</div>';
  else h += '<p class="note" style="margin:0">Automatic backup to a file works in Chrome and Edge on a computer. In this browser, save a backup file after you make changes you want to keep.</p>';
  return h + '</section>';
}

// ---------- deck helpers ----------
function newDeck(o){ const d = Object.assign({id:uid(), name:'New deck', format:'commander', commander:'', tier:'budget', aims:[], tribe:'', colors:[], aimLocked:false, cards:[], dismissed:[]}, o); S.draft = d; S.deckId = d.id; S.view = 'decks'; S.open = true; S.pathShow = 0; return d; }
function makeShell(p){ const d = newDeck({name:p.name + ' starter', format:'commander', aims:p.aims.slice(), tribe:p.tribe || ''}); setCommander(d, p.cmd); if (p.tribe) d.tribe = p.tribe; fillDeck(d); return d; }
function exampleDeck(){ const d = makeShell(PRECONS.find(p => p.name === 'Elven Empire')); d.name = 'Example: Lathril elves (generated)'; d.example = true; d.tier = 'mid'; S.draft = null; S.profile.decks.unshift(d); return d; }
function doSwap(d, p, step){ const old = d.cards.find(x => x.n === p.cut), keep = step ? Math.max(step, old && old.step || 0) : (old && old.step || 0); cutCard(d, p.cut, p.q); addCard(d, p.add, p.q); const en = d.cards.find(x => x.n === p.add); if (en && keep) en.step = keep; }
function recsFor(d){ const key = JSON.stringify([d, S.swaps, DBINFO.count, EDH.key, EDH.state]); if (recsFor.k !== key){ recsFor.k = key; recsFor.v = upgradePaths(d); } return recsFor.v; }

// ---------- views ----------
function navHtml(){
  const b = (v, label) => '<button data-act="nav" data-v="' + v + '"' + (S.view === v ? ' aria-current="page"' : '') + '>' + SVG[v] + label + '</button>';
  $('#nav-l').innerHTML = b('decks', 'Decks') + b('deck', 'Builder') + b('search', '<span class="xs-hide">Card&nbsp;</span>Search');
  $('#nav-r').innerHTML = b('profile', 'Profile');
}
function viewHome(){
  const n = S.profile.decks.filter(d => !d.example).length;
  const tile = (v, icon, title, text, extra) => '<button class="tile big" data-act="nav" data-v="' + v + '"><div class="tb"><span class="hicon">' + SVG[icon] + '</span><h3>' + title + '</h3><p>' + text + '</p>' + (extra ? '<span class="chip gold">' + extra + '</span>' : '') + '</div></button>';
  return '<section class="hero"><h1>Bring a deck. See every way to make it better.</h1><p class="narrow">A Magic: The Gathering deck builder for Commander and Standard that shows each card’s upgrade path at three budgets.</p><p class="wide">Deck Companion is a deck builder for Magic: The Gathering, made for Commander and Standard. Start a deck or bring your own, tell it what the deck is about, and it lays out each card’s upgrade path at three budgets, without turning your deck into something else.</p></section>' +
    '<div class="tiles home3">' +
    tile('deck', 'deck', 'Builder', 'Start a new deck. Generate one from a commander, load a real precon, import a list you already have, or begin empty.') +
    tile('decks', 'decks', 'Decks', 'Open a saved deck to edit it, tune its build, and follow its Budget, Mid and Apex upgrade paths.', n ? n + ' saved deck' + (n === 1 ? '' : 's') : '') +
    tile('search', 'search', 'Card search', 'Look up any card with its full details, price and every printing.') +
    '</div><div class="row" style="justify-content:center"><button class="btn" data-act="nav" data-v="profile" style="display:inline-flex;gap:8px;align-items:center"><span class="hicon sm">' + SVG.profile + '</span>Profile and backups</button></div>' +
    '<ol class="steps"><li><b>Get a deck in.</b> Generate one, load a precon, or paste your own list.</li><li><b>Set the build.</b> Rank the mechanics that matter and pick your colors. For Commander, the deck follows what your commander does.</li><li><b>Follow the upgrade paths.</b> Every card shows what to swap it for at Budget (up to $3), Mid (up to $12) and Apex, and how far along it already is.</li></ol>';
}
function viewDecks(){
  const P = S.profile, od = S.open ? cur() : null;
  if (od){ const A = analyze(od), isDraft = od === S.draft;
    return '<div class="row"><button class="btn" data-act="deck-back">← All decks</button>' + (isDraft
      ? '<span class="chip warn">Not saved yet</span><button class="btn pri" data-act="draft-save" style="margin-left:auto">Save deck</button><button class="btn danger" data-act="draft-discard">Discard</button>'
      : '<span class="note" style="flex:1">Saved · changes to this deck save as you make them</span><button class="btn danger" data-act="del-deck" data-v="' + od.id + '">' + (S.confirmDel === od.id ? 'Confirm delete' : 'Delete deck') + '</button>') + '</div><div class="work">' + aimPanel(od, A.ctx) + listPanel(od, A) + upPanel(od, A) + '</div>'; }
  const tiles = P.decks.map(d => { const A = analyze(d), c = find(d.commander) || find((d.cards.find(e => find(e.n) && !tags(find(e.n)).land) || {}).n);
    return '<div class="tilewrap"><button class="tile" data-act="open-deck" data-v="' + d.id + '"><img alt="" src="' + artFor(c || {n:d.name, t:'Enchantment', o:'', ci:d.colors || []}) + '"><div class="tb"><h3>' + esc(d.name) + '</h3><p>' + (d.format === 'commander' ? esc(d.commander || 'No commander yet') : 'Standard · ' + (d.colors || []).map(x => '<i class="pip p' + x + '">' + x + '</i>').join('')) + '</p><div class="row"><span class="chip gold">' + TIERS[d.tier].label + '</span><span class="chip">' + d.format + '</span><span class="chip ' + (A.size === A.T.size ? 'good' : 'warn') + '">' + A.size + ' / ' + A.T.size + '</span>' + (d.example ? '<span class="chip">Example</span>' : '') + '</div></div></button><button class="btn sm danger" data-act="del-deck" data-v="' + d.id + '">' + (S.confirmDel === d.id ? 'Confirm delete' : 'Delete') + '</button></div>'; }).join('');
  return '<section class="panel"><div class="ph"><h2>' + esc(P.name) + '’s decks</h2><small>' + P.decks.length + ' saved</small></div>' +
    (S.draft ? '<div class="gate"><b>Unsaved deck: ' + esc(S.draft.name) + '</b>You started this deck but haven’t saved it to your profile.<div class="row" style="margin-top:10px"><button class="btn" data-act="draft-open">Keep editing</button><button class="btn pri" data-act="draft-save">Save deck</button><button class="btn danger" data-act="draft-discard">Discard</button></div></div>' : '') +
    (P.decks.some(d => !d.example) && Date.now() - lastBackup() > 7 * 864e5 ? '<p class="note" style="margin:0">' + (lastBackup() ? 'Your last backup file is over a week old.' : 'These decks are only stored in this browser.') + ' <button class="btn sm" data-act="backup-save">Save backup file</button></p>' : '') + (tiles ? '<p class="note" style="margin:0">Tap a deck to edit it and see its upgrade paths.</p><div class="tiles">' + tiles + '</div>' : '<p class="note">No decks yet. Create one on the Builder page.</p><div class="row"><button class="btn pri" data-act="nav" data-v="deck">Go to the Builder</button></div>') + '</section>';
}
function aimPanel(d, ctx){
  if (d.auto && !d.custom && isAimed(d)){
    return '<section class="panel aimp"><div class="ph"><h2>Build</h2><small>' + (d.auto === 'precon' ? 'Precon theme' : 'Set from the commander') + '</small></div>' +
      '<div class="grp"><label class="lab" for="deck-name">Deck name</label><input type="text" id="deck-name" value="' + esc(d.name) + '" maxlength="60"></div>' +
      (ctx.cmd ? '<div class="cmdbox"><img alt="" src="' + artFor(ctx.cmd, {pid:d.cmdPid}) + '"><div><b>' + esc(ctx.cmd.n) + '</b><span>' + pips(ctx.cmd.m) + '</span><div class="row" style="margin-top:4px"><button class="btn sm" data-act="card" data-n="' + esc(ctx.cmd.n) + '">View</button><button class="btn sm" data-act="cmd-find">Find a commander</button></div></div></div>' : '') +
      '<div class="grp"><span class="lab">This deck is built around</span><div class="row">' + d.aims.map((a, i) => '<span class="chip gold">' + (i + 1) + ' · ' + (a === 'tribal' ? esc(ctx.tribe) + ' tribal' : THEMES[a].label) + '</span>').join('') + '</div></div>' +
      '<p class="note" style="margin:0">' + (d.auto === 'precon' ? 'This precon already has a theme, so its upgrade paths are ready below.' : 'The build was set from what this commander does, so its upgrade paths are ready below.') + ' Change the mechanics, their order or the color focus only if you want to take the deck somewhere else.</p>' +
      '<div class="row"><button class="btn" data-act="build-custom">Customize the build</button></div></section>';
  }
  const lock = d.aimLocked, dis = lock ? ' disabled' : '', aimed = isAimed(d);
  let h = '<section class="panel aimp"><div class="ph"><h2>Build</h2><button class="ico' + (lock ? ' on' : '') + '" data-act="lock-aim" title="' + (lock ? 'Unlock the build settings' : 'Lock the build settings') + '" aria-pressed="' + lock + '">' + SVG.lock + '</button></div>';
  h += '<div class="grp"><label class="lab" for="deck-name">Deck name</label><input type="text" id="deck-name" value="' + esc(d.name) + '" maxlength="60"></div>';
  h += '<div class="grp"><span class="lab">Format</span><div class="seg">' + ['commander', 'standard'].map(f => '<button data-act="fmt" data-v="' + f + '" class="' + (d.format === f ? 'on' : '') + '"' + dis + '>' + f + '</button>').join('') + '</div></div>';
  if (d.format === 'commander'){
    h += '<div class="grp"><span class="lab">Commander</span>';
    if (ctx.cmd){ h += '<div class="cmdbox"><img alt="" src="' + artFor(ctx.cmd, {pid:d.cmdPid}) + '"><div><b>' + esc(ctx.cmd.n) + '</b><span>' + pips(ctx.cmd.m) + '</span><div class="row" style="margin-top:4px"><button class="btn sm" data-act="card" data-n="' + esc(ctx.cmd.n) + '">View</button>' + (lock ? '' : '<button class="btn sm" data-act="clear-cmd">Change</button><button class="btn sm" data-act="cmd-find">Find a commander</button>') + '</div></div></div>';
      h += '<div class="row">' + (ctx.cmdThemes.length ? ctx.cmdThemes.map(k => '<span class="chip gold">' + (k === 'tribal' ? ctx.cmdTribe + ' tribal' : THEMES[k].label) + '</span>').join('') : '<span class="note">No built-in strategy detected. Your aims decide the direction.</span>') + '</div>' +
        (ctx.cmdThemes.length ? '<p class="note" style="margin:0">Upgrades always lean toward what this commander does, on top of the aims you set.</p>' : ''); }
    else { const leg = d.cards.map(e => find(e.n)).filter(c => c && /Legendary/.test(c.t) && /Creature/.test(frontType(c))).slice(0, 6);
      h += (d.commander ? '<p class="note" style="margin:0"><span class="unk">' + esc(d.commander) + '</span> is not in the card library. Load the full card database in Profile, or pick another.</p>' : '') +
        '<div class="dd"><input type="search" id="cmd-q" placeholder="Search legendary creatures" autocomplete="off"><div class="ddl" id="cmd-res" hidden></div></div>' +
        (leg.length ? '<div class="row"><span class="note">From your list:</span>' + leg.map(c => '<button class="btn sm" data-act="set-cmd" data-n="' + esc(c.n) + '">' + esc(c.n) + '</button>').join('') + '</div>' : ''); }
    h += '</div>';
  }
  h += '<div class="grp"><span class="lab">Mechanics, in priority order</span>';
  h += d.aims.map((a, i) => '<div class="aim"><span class="n">' + (i + 1) + '</span><span class="t">' + (a === 'tribal' ? esc(ctx.tribe || 'Pick a creature type') + ' tribal' : THEMES[a].label) + (ctx.cmdThemes.includes(a) ? '<small>Commander strategy</small>' : '') + '</span><span class="row" style="gap:3px">' +
    (lock ? '' : '<button class="ico" data-act="aim-up" data-v="' + i + '" title="Raise priority"' + (i ? '' : ' disabled') + '>↑</button><button class="ico" data-act="aim-down" data-v="' + i + '" title="Lower priority"' + (i < d.aims.length - 1 ? '' : ' disabled') + '>↓</button><button class="ico" data-act="aim-rm" data-v="' + i + '" title="Remove">×</button>') + '</span></div>').join('');
  if (!lock && d.aims.length < 5) h += '<select id="aim-add" aria-label="Add a mechanic"><option value="">+ Add a mechanic…</option>' + Object.keys(THEMES).filter(k => !d.aims.includes(k)).map(k => '<option value="' + k + '">' + THEMES[k].label + '</option>').join('') + '</select>';
  if (d.aims.includes('tribal')) h += '<select id="tribe" aria-label="Creature type"' + dis + '><option value="">Creature type…</option>' + TRIBES.slice().sort().map(t => '<option' + (t === ctx.tribe ? ' selected' : '') + '>' + t + '</option>').join('') + '</select>';
  h += '</div>';
  const pool = d.format === 'commander' ? ctx.ident : ['W', 'U', 'B', 'R', 'G'];
  h += '<div class="grp"><span class="lab">Land colors to focus on' + (d.format === 'commander' && ctx.ident.length ? ' · ' + ctx.focus.length + ' of ' + ctx.ident.length : '') + '</span>';
  if (!pool.length) h += '<p class="note" style="margin:0">' + (d.format === 'commander' ? (ctx.cmd ? 'Colorless commander: the deck uses Wastes and colorless cards.' : 'Pick a commander to set the colors.') : '') + '</p>';
  else h += '<div class="row">' + pool.map(c => '<button class="pip p' + c + ((d.colors || []).includes(c) ? ' on' : '') + '" data-act="color" data-v="' + c + '" aria-pressed="' + (d.colors || []).includes(c) + '"' + dis + '>' + c + '</button>').join('') + '</div><p class="note" style="margin:0">' + (d.format === 'commander' ? 'Focus colors get most of the basic lands and first pick of upgrades. The rest become a light splash.' : 'Pick one to three colors. Every card must fit inside them.') + '</p>';
  h += '</div>';
  h += '<div class="row"><span class="chip ' + (aimed ? 'good' : 'warn') + '">' + (aimed ? 'Deck is aimed' : 'Not aimed yet') + '</span><span class="note">' + (S.sync === 'cloud' ? 'Saved to your profile' : 'Saved in this browser') + '</span></div></section>';
  return h;
}
const GROUPS = [['Creature', 'Creatures'], ['Planeswalker', 'Planeswalkers'], ['Instant', 'Instants'], ['Sorcery', 'Sorceries'], ['Artifact', 'Artifacts'], ['Enchantment', 'Enchantments'], ['Land', 'Lands']];
function listRows(d){
  const buckets = {}, unknown = [];
  for (const e of d.cards){ const c = find(e.n); if (!c){ unknown.push(e); continue; } const t = frontType(c), g = /\bLand\b/.test(t) ? 'Land' : (GROUPS.find(x => new RegExp(x[0]).test(t)) || ['Artifact'])[0]; (buckets[g] = buckets[g] || []).push([e, c]); }
  const rowH = (e, c) => '<button class="dl" data-act="card" data-n="' + esc(e.n) + '">' + (c ? '<img alt="" src="' + artFor(c, e) + '">' : '<span></span>') + '<span class="q">' + e.q + '×</span>' +
    '<span class="nm' + (c ? '' : ' unk') + '">' + esc(e.n) + '</span><span class="cost">' + (c ? pips(c.m) : '') + '</span><span class="lk">' + (e.l ? SVG.lock : '') + '</span>' +
    '<span class="pr">' + money(c) + '</span></button>';
  let h = '';
  if (!d.cards.length) h += '<p class="note">This deck is empty. Search for cards above, or set the build and fill the open slots.</p>';
  for (const [k, label] of GROUPS){ const b = buckets[k]; if (!b) continue; b.sort((x, y) => x[1].cmc - y[1].cmc || x[1].n.localeCompare(y[1].n));
    h += '<div><div class="gh"><span>' + label + '</span><span>' + b.reduce((s, x) => s + x[0].q, 0) + '</span></div>' + b.map(x => rowH(x[0], x[1])).join('') + '</div>'; }
  if (unknown.length) h += '<div><div class="gh"><span class="unk">Not in the card data yet</span><span>' + unknown.reduce((s, e) => s + e.q, 0) + '</span></div><p class="note" style="margin:6px 0">These stay in your list but can’t be analyzed until the full card data has loaded.</p>' + unknown.map(e => rowH(e, null)).join('') + '</div>';
  return h;
}
const deckStat = (d, A) => A.size + ' / ' + A.T.size + ' cards · ' + (A.price ? (DBINFO.source === 'starter' ? '~' : '') + '$' + A.price.toFixed(0) : '$0');
function listPanel(d, A){
  return '<section class="panel list"><div class="ph"><h2>Decklist</h2><small>' + deckStat(d, A) + '</small><button class="btn sm" data-act="list-all">View all</button></div>' +
    '<div class="row"><div class="dd" style="flex:1 1 190px;min-width:0"><input type="search" id="add-q" placeholder="Add a card by name or rules text" autocomplete="off"><div class="ddl" id="add-res" hidden></div></div>' +
    '<button class="btn" data-act="fill"' + (isAimed(d) && A.size < A.T.size ? '' : ' disabled') + ' title="Fill the open slots using your build">Fill ' + Math.max(0, A.T.size - A.size) + ' open</button><button class="btn" data-act="copy-list">Copy list</button></div>' +
    '<div class="rows" id="rows">' + listRows(d) + '</div></section>';
}
// Buy list: what to buy for each tier's upgrades, grouped by color then A–Z.
const BUY_GROUPS = [['W', 'White'], ['U', 'Blue'], ['B', 'Black'], ['R', 'Red'], ['G', 'Green'], ['M', 'Multicolor'], ['C', 'Colorless'], ['L', 'Land']];
function buyData(d){
  const R = recsFor(d), grp = c => !c ? 'C' : tags(c).land ? 'L' : c.ci.length > 1 ? 'M' : c.ci[0] || 'C', order = BUY_GROUPS.map(g => g[0]);
  return TIER_KEYS.map(t => {
    const m = new Map(), put = (n, q) => { if (isBasic(n)) return; const c = find(n); if (m.has(n)) m.get(n).q += q; else m.set(n, {n, q, p:c ? c.p : null, g:grp(c)}); };
    R.paths.forEach(L => { const p = L.opts[t]; if (p) put(p.add, p.q); }); if (t === 'budget') R.fixes.forEach(p => put(p.add, p.q));
    const items = [...m.values()].sort((a, b) => order.indexOf(a.g) - order.indexOf(b.g) || a.n.localeCompare(b.n));
    return {t, items, count:items.reduce((s, x) => s + x.q, 0), cost:items.reduce((s, x) => s + (x.p || 0) * x.q, 0)};
  });
}
function buyText(d){
  const L = ['// ' + d.name + ' · buy list'];
  buyData(d).forEach(T => { L.push('', '// ' + TIERS[T.t].label + ' (' + T.count + ' cards' + (T.count ? ', about $' + T.cost.toFixed(2) : '') + ')'); if (!T.items.length) L.push('// nothing to buy at this tier'); T.items.forEach(x => L.push(x.q + ' ' + x.n)); });
  return L.join('\n') + '\n';
}
function openBuy(){
  const d = cur(); if (!d) return; S.modalCard = null;
  let h = '<div class="panel" role="dialog" aria-label="Buy list"><div class="ph"><h2>Buy list</h2><small>' + esc(d.name) + '</small><button class="ico" data-act="close" aria-label="Close">×</button></div>';
  if (!isAimed(d)) h += '<p class="note" style="margin:0">Set up the build first. The buy list comes from the deck’s upgrade paths.</p>';
  else {
    const data = buyData(d);
    h += '<div class="row"><button class="btn pri" data-act="buy-copy">Copy as text</button><button class="btn" data-act="buy-save">Save text file</button></div>' +
      '<p class="note" style="margin:0">The cards each tier’s upgrades would add to this deck. Sorted by color, then A to Z.' + (DBINFO.complete ? '' : ' Card data is still downloading, so this list will grow.') + '</p>' +
      data.map(T => '<div class="grp"><div class="gh" style="font-size:15px"><span>' + TIERS[T.t].label + '</span><span>' + T.count + ' card' + (T.count === 1 ? '' : 's') + (T.count ? ' · ' + (DBINFO.source === 'starter' ? '~' : '') + '$' + T.cost.toFixed(2) : '') + '</span></div>' +
        (T.items.length ? BUY_GROUPS.map(([k, label]) => { const xs = T.items.filter(x => x.g === k); return xs.length ? '<div><span class="lab">' + label + '</span>' + xs.map(x => '<button class="dl buy" data-act="card" data-n="' + esc(x.n) + '"><span class="q">' + x.q + '×</span><span class="nm">' + esc(x.n) + '</span><span class="pr">' + money(find(x.n)) + '</span></button>').join('') + '</div>' : ''; }).join('') : '<p class="note" style="margin:0">Nothing to buy at this tier.</p>') + '</div>').join('');
  }
  $('#modal').innerHTML = h + '</div>'; $('#modal').hidden = false;
}
function saveText(name, text){
  const a = document.createElement('a'), url = URL.createObjectURL(new Blob([text], {type:'text/plain'}));
  a.href = url; a.download = name; document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(url), 5000);
}
function deckColors(d){ const s = new Set(); const c0 = find(d.commander); if (c0) c0.ci.forEach(x => s.add(x)); d.cards.forEach(e => { const c = find(e.n); if (c) c.ci.forEach(x => s.add(x)); }); return 'WUBRG'.split('').filter(x => s.has(x)); }
function openFindCmd(){
  const d = cur(); if (!d) return; S.modalCard = null; if (!S.fc || S.fc.id !== d.id) S.fc = {id:d.id, colors:deckColors(d)};
  const cols = S.fc.colors, res = findCommanders(d, cols, 12), now = find(d.commander);
  $('#modal').innerHTML = '<div class="panel" role="dialog" aria-label="Find a commander"><div class="ph"><h2>Find a commander</h2><button class="ico" data-act="close" aria-label="Close">×</button></div>' +
    '<p class="note" style="margin:0">Steer this deck toward a different commander. Pick the colors the commander must have: the deck’s current colors are selected, so add one to open the deck up to new cards. Results are ranked by how well they fit this deck’s build.</p>' +
    '<div class="grp"><span class="lab">Commander must include</span><div class="row">' + 'WUBRG'.split('').map(c => '<button class="pip p' + c + (cols.includes(c) ? ' on' : '') + '" data-act="fc-color" data-v="' + c + '" aria-pressed="' + cols.includes(c) + '">' + c + '</button>').join('') + '</div>' +
    (now ? '<p class="note" style="margin:0">Current commander: ' + esc(now.n) + ' ' + now.ci.map(x => '<i class="pip p' + x + '">' + x + '</i>').join('') + '</p>' : '') + '</div>' +
    '<div class="grp">' + (res.length ? res.map(x => { const c = find(x.n); return '<div class="pre"><img alt="" src="' + artFor(c) + '"><div style="min-width:0"><button class="nm" data-act="card" data-n="' + esc(c.n) + '" style="background:none;border:0;padding:0;color:inherit;font:inherit;font-weight:700;text-align:left">' + esc(c.n) + '</button> ' + c.ci.map(k => '<i class="pip p' + k + '">' + k + '</i>').join('') + '<div class="why">' + x.why.map(w => '<span class="chip">' + esc(w) + '</span>').join('') + (x.outside ? '<span class="chip warn">' + x.outside + ' of your cards would fall outside its colors</span>' : '<span class="chip good">Every card in the deck stays legal</span>') + '</div></div><div class="acts"><button class="btn pri sm" data-act="fc-pick" data-n="' + esc(c.n) + '">Use</button></div></div>'; }).join('')
      : '<p class="note">No legendary creature in the card data has all of those colors' + (DBINFO.complete ? '.' : ' yet. More appear when the card download finishes.') + '</p>') + '</div>' +
    (DBINFO.complete ? '' : '<p class="note" style="margin:0">Card data is still downloading, so this list is incomplete.</p>') + '</div>';
  $('#modal').hidden = false;
}
function openList(){
  const d = cur(); if (!d) return; const A = analyze(d); S.modalCard = null; S.listOpen = true;
  $('#modal').innerHTML = '<div class="panel" role="dialog" aria-label="Full decklist"><div class="ph"><h2>' + esc(d.name) + '</h2><small>' + deckStat(d, A) + '</small><button class="ico" data-act="close" aria-label="Close">×</button></div><div class="allrows">' + listRows(d) + '</div></div>';
  $('#modal').hidden = false;
}
const TIER_KEYS = ['budget', 'mid', 'apex'];
function upPanel(d, A){
  const T = A.T, meter = (label, have, want) => { const cls = have >= want ? 'good' : have >= want * 0.7 ? 'warn' : 'bad'; return want ? '<div class="meter ' + cls + '"><span>' + label + '</span><i><b style="width:' + Math.min(100, have / want * 100) + '%"></b></i><span>' + have + ' / ' + want + '</span></div>' : ''; };
  let h = '<section class="panel up"><div class="ph"><h2>Upgrades</h2><small>Budget · Mid · Apex</small><button class="btn sm" data-act="buy-open">Buy list</button></div>';
  if (A.ctx.cmd || !DBINFO.complete) h += '<div class="row">' + edhNote(A.ctx.cmd) + (DBINFO.complete ? '' : '<span class="chip warn">Card data still downloading · results will improve</span>') + '</div>';
  h += '<div class="grp"><span class="lab">Deck health</span>' + meter('Lands', A.lands, T.lands) + meter('Ramp', A.roles.ramp, T.ramp) + meter('Card draw', A.roles.draw, T.draw) + meter('Removal', A.roles.removal, T.removal) + meter('Board wipes', A.roles.wipe, T.wipe) + '</div>';
  h += '<div class="grp"><span class="lab">Card types</span><div class="row">' + TYPE_ORDER.filter(k => A.types[k]).map(k => '<span class="chip">' + (k === 'Sorcery' ? 'Sorceries' : k + 's') + ' · ' + A.types[k] + '</span>').join('') + '</div></div>';
  const mx = Math.max(1, ...A.curve);
  h += '<div class="grp"><span class="lab">Mana curve · average ' + A.avg.toFixed(2) + '</span><div class="curve">' + A.curve.map((v, i) => '<div><span>' + v + '</span><i style="height:' + (v / mx * 44) + 'px"></i><span>' + (i === 6 ? '6+' : i) + '</span></div>').join('') + '</div></div>';
  const flags = [];
  if (A.offColor.length) flags.push('<span class="chip bad">' + A.offColor.length + ' outside colors</span>');
  if (A.illegal.length) flags.push('<span class="chip bad">' + A.illegal.length + ' not ' + d.format + '-legal</span>');
  if (A.dupes.length) flags.push('<span class="chip bad">' + A.dupes.length + ' over copy limit</span>');
  if (A.unknown.length) flags.push('<span class="chip warn">' + A.unknown.length + ' unrecognized</span>');
  d.aims.forEach((a, i) => flags.push('<span class="chip">' + (a === 'tribal' ? esc(A.ctx.tribe || 'Tribal') : THEMES[a].label.split(' / ')[0]) + ' · ' + A.aim[i] + '</span>'));
  if (flags.length) h += '<div class="row">' + flags.join('') + '</div>';
  if (!isAimed(d)){
    const need = d.format === 'commander' && !A.ctx.cmd ? 'Choose your commander, then pick' : !d.aims.length ? 'Pick' : d.aims.includes('tribal') && !A.ctx.tribe ? 'Choose a creature type for your tribal aim. Then pick' : 'Choose your land colors, and pick';
    return h + '<div class="gate"><b>Set up the build first</b>' + need + ' at least one mechanic in the Build panel. Upgrade paths are built around your priorities, so two players with the same commander get different lists.</div></section>';
  }
  const R = recsFor(d), thumb = n => { const c = find(n); return c ? '<img alt="" src="' + artFor(c) + '">' : '<span></span>'; }, price = n => money(find(n));
  const side = (kind, n, q) => '<button class="sw ' + kind + '" data-act="card" data-n="' + esc(n) + '">' + thumb(n) + '<span><small>' + (kind === 'out' ? 'Remove' : 'Add') + '</small>' + (q > 1 ? q + '× ' : '') + esc(n) + '</span><em>' + price(n) + '</em></button>';
  if (R.fixes.length || R.drops.length){
    h += '<div class="grp"><span class="lab">Fixes this deck needs</span>' +
      R.fixes.map((p, i) => '<div class="path">' + side('out', p.cut, p.q) + side('in', p.add, p.q) + '<div class="row"><span class="chip warn">' + esc(p.fix ? p.cutWhy[0] : p.why[0]) + '</span><button class="btn pri sm" data-act="fix" data-v="' + i + '" style="margin-left:auto">Swap</button></div></div>').join('') +
      R.drops.map((c, i) => '<div class="path">' + side('out', c.n, c.q) + '<div class="row"><span class="chip warn">' + esc(c.why[0]) + '</span><button class="btn danger sm" data-act="drop" data-v="' + i + '" style="margin-left:auto">Remove</button></div></div>').join('') + '</div>';
  }
  const any = R.paths.length;
  h += '<div class="grp"><span class="lab">Upgrade paths' + (any ? ' · ' + any + ' card' + (any === 1 ? '' : 's') : '') + '</span>';
  if (!any) h += '<p class="note" style="margin:0">No card in this deck has a clear upgrade right now that keeps the deck’s identity' + (DBINFO.source === 'starter' ? '. More options appear once the full card data has finished downloading' : '') + '.</p>';
  else {
    h += '<div class="tiers">' + TIER_KEYS.map(t => '<div class="tierbox"><b>' + TIERS[t].label + '</b><span>' + (R.count[t] ? R.count[t] + ' swap' + (R.count[t] === 1 ? '' : 's') : 'none') + '</span><span>' + (R.count[t] ? (R.cost[t] >= 0 ? '+' : '−') + '$' + Math.abs(R.cost[t]).toFixed(0) : '') + '</span><button class="btn sm" data-act="swap-all" data-v="' + t + '"' + (R.count[t] ? '' : ' disabled') + '>Apply all</button><em>' + (R.count[t] ? (Object.keys(R.shift[t]).length ? TYPE_ORDER.filter(k => R.shift[t][k]).map(k => (R.shift[t][k] > 0 ? '+' : '−') + Math.abs(R.shift[t][k]) + ' ' + k.toLowerCase()).join(', ') : 'same card types') : '') + '</em></div>').join('') + '</div>' +
      '<p class="note" style="margin:0">Each card below shows what to swap it for at each tier. Budget options cost up to $3, Mid over $3 up to $12, Apex over $12. The bar marks how far along its path the card already is. Swaps keep the same card type where they can; one that changes type is marked, and each tier shows what applying it all would do to the deck’s mix.</p>';
    const show = S.pathShow || 12;
    h += '<div class="paths">' + R.paths.slice(0, show).map((L, i) => { const en = d.cards.find(x => x.n === L.cut), step = en && en.step || 0;
      return '<div class="path">' + side('out', L.cut, 1) +
        '<div class="prog" role="img" aria-label="Upgrade progress: ' + (step ? TIERS[TIER_KEYS[step - 1]].label : 'not started') + '">' + ['Now'].concat(TIER_KEYS.map(t => TIERS[t].label)).map((lab, k) => '<span class="' + (k <= step ? 'done' : '') + (k === step ? ' here' : '') + (k > 0 && L.opts[TIER_KEYS[k - 1]] ? ' has' : '') + '"><i></i>' + lab + '</span>').join('') + '</div>' +
        TIER_KEYS.map(t => { const p = L.opts[t]; return p ? '<div class="opt"><span class="chip gold">' + TIERS[t].label + '</span>' + side('in', p.add, p.q) + '<div class="row">' + (p.cross ? '<span class="chip warn">' + p.from + ' → ' + p.to + '</span>' : '') + p.why.slice(0, 2).map(w => '<span class="chip">' + esc(w) + '</span>').join('') + '<button class="btn pri sm" data-act="swap" data-v="' + i + '|' + t + '" style="margin-left:auto">Swap</button></div></div>' : ''; }).join('') + '</div>'; }).join('') + '</div>';
    if (any > show) h += '<button class="btn" data-act="path-more">Show ' + Math.min(12, any - show) + ' more</button>';
  }
  h += '</div>';
  return h + '</section>';
}
function viewDeck(){
  const opt = (act, v, title, text) => '<button class="tile" data-act="' + act + '"' + (v ? ' data-v="' + v + '"' : '') + '><div class="tb"><h3>' + title + '</h3><p>' + text + '</p></div></button>';
  return '<section class="panel"><div class="ph"><h2>Build a new deck</h2><small>Saved to Decks when created</small></div><div class="tiles">' +
    opt('gen-open', '', 'Generate from a commander', 'Pick a legendary creature and a tier. The app builds a full 100-card deck around what that commander does.') +
    opt('precon-open', '', 'Load a precon', 'Start from a real preconstructed Commander deck with its official card list.') +
    opt('import-open', '', 'Import a text list', 'Paste or load a decklist you already have, from Arena, Moxfield, Archidekt or a plain text file.') +
    opt('new-deck', 'commander', 'Empty Commander deck', 'Start from nothing: choose a commander, set the build, and add cards yourself.') +
    opt('new-deck', 'standard', 'Empty Standard deck', 'Start a 60-card Standard deck: pick colors and mechanics, then add cards or fill it.') +
    '</div></section>';
}
function searchResults(){
  const f = S.search, filt = {fmt:f.fmt, color:f.color, type:f.type, max:+f.max || 0, theme:f.theme}, q = f.q.trim();
  if (f.prints){
    if (DBINFO.source !== 'full') return '<p class="note" style="margin:0">Every-printing search needs the full card data, which is still downloading.</p>';
    if (q.length < 3) return '<p class="note" style="margin:0">Type at least three letters of a card name to see every printing.</p>';
    if (!S.printRes || S.printRes.q !== q){ if (S.printPending !== q) printSearch(q); return '<p class="note" style="margin:0">Searching Scryfall for every printing…</p>'; }
    const ok = new Set(searchCards('', filt, 1e6).cards.map(c => c._n));
    const rows = S.printRes.out.filter(x => ok.has(x.c._n) && (!filt.max || (x.p != null && x.p <= filt.max)))
      .sort((a, b) => (b.sc === PRINT.key) - (a.sc === PRINT.key) || a.c.n.localeCompare(b.c.n) || b.yr.localeCompare(a.yr));
    return '<p class="note" style="margin:0">' + (S.printRes.err ? 'Scryfall could not be reached. ' : '') + rows.length + ' printing' + (rows.length === 1 ? '' : 's') + (rows.length > 120 ? ' · showing the first 120' : '') + (PRINT.key && rows.some(x => x.sc === PRINT.key) ? ' · your commander’s set first' : '') + '</p><div class="cards">' + rows.slice(0, 120).map(x => cardHtml(x.c, true, x)).join('') + '</div>';
  }
  const r = searchCards(f.q, filt, 60);
  return '<p class="note" style="margin:0">' + r.total.toLocaleString() + ' card' + (r.total === 1 ? '' : 's') + (r.total > 60 ? ' · showing the first 60' : '') + ' · ' + (DBINFO.source === 'starter' ? 'starter library' : 'full database') + (PRINT.key && PRINT.map.size ? ' · showing your commander’s set printing where one exists' : '') + '</p><div class="cards">' + r.cards.map(c => cardHtml(c, true)).join('') + '</div>';
}
function viewSearch(){
  const f = S.search, opt = (v, l, curv) => '<option value="' + v + '"' + (v === curv ? ' selected' : '') + '>' + l + '</option>';
  return '<section class="panel"><div class="ph"><h2>Card search</h2><small>Tap a card for full details</small></div><div class="filters">' +
    '<input type="search" id="s-q" placeholder="Name, type or rules text" value="' + esc(f.q) + '" autocomplete="off">' +
    '<select id="s-prints" aria-label="Printings">' + opt('', 'One per card', f.prints ? '1' : '') + opt('1', 'Every printing', f.prints ? '1' : '') + '</select>' +
    '<select id="s-fmt" aria-label="Format">' + opt('', 'Any format', f.fmt) + opt('commander', 'Commander', f.fmt) + opt('standard', 'Standard', f.fmt) + '</select>' +
    '<select id="s-color" aria-label="Color">' + opt('', 'Any color', f.color) + [['W', 'White'], ['U', 'Blue'], ['B', 'Black'], ['R', 'Red'], ['G', 'Green'], ['C', 'Colorless']].map(x => opt(x[0], x[1], f.color)).join('') + '</select>' +
    '<select id="s-type" aria-label="Card type">' + opt('', 'Any type', f.type) + ['Creature', 'Instant', 'Sorcery', 'Artifact', 'Enchantment', 'Planeswalker', 'Land', 'Legendary'].map(x => opt(x, x, f.type)).join('') + '</select>' +
    '<select id="s-max" aria-label="Price">' + opt('', 'Any price', f.max) + opt('3', 'Budget ≤ $3', f.max) + opt('12', 'Mid ≤ $12', f.max) + '</select>' +
    '<select id="s-theme" aria-label="Mechanic">' + opt('', 'Any mechanic', f.theme) + Object.keys(THEMES).filter(k => k !== 'tribal').map(k => opt(k, THEMES[k].label, f.theme)).join('') + '</select>' +
    '</div><div id="s-res" class="grp">' + searchResults() + '</div></section>';
}
function loadPrecon(p){
  const cards = PRECON_LISTS[p.name].split(';').map(x => { const m = /^(\d+) (.+)$/.exec(x), n = m ? m[2] : x, c = find(n); return {n:c ? c.n : n, q:m ? +m[1] : 1, l:false}; });
  const d = newDeck({name:p.name, format:'commander', cards, aims:p.aims.slice(), tribe:p.tribe || '', auto:'precon'}); setCommander(d, p.cmd); if (p.tribe) d.tribe = p.tribe; return d;
}
// Precon picker: the 16 built-in decks are always there; the full catalogue and other decklists come live from EDHREC.
let PRE = {state:'', list:[]};
async function loadPreIndex(){
  if (PRE.state) return; PRE.state = 'loading';
  const c = lsGet('dc.preidx'); if (c && Date.now() - c.ts < 7 * 864e5 && c.list.length){ PRE = {state:'ok', list:c.list}; return; }
  try {
    const j = await (await fetch('https://json.edhrec.com/pages/precon.json')).json(), list = [], seen = new Set();
    ((j.container && j.container.json_dict && j.container.json_dict.cardlists) || []).forEach(L => (L.cardviews || []).forEach(v => { const slug = String(v.url || '').split('/').pop(); if (v.label && slug && !seen.has(slug)){ seen.add(slug); list.push([v.label, v.name || '', String(v.set || '').toUpperCase(), slug]); } }));
    if (!list.length) throw new Error('empty'); PRE = {state:'ok', list}; lsSet('dc.preidx', {ts:Date.now(), list});
  } catch (e) { PRE.state = 'fail'; }
}
function preRows(q){
  const nq = norm(q || ''), have = new Set(PRECONS.map(p => norm(p.name)));
  const all = PRECONS.map((p, i) => ({i, name:p.name, cmd:p.cmd, note:p.note, tag:p.level, set:p.set + ' · ' + p.year}))
    .concat(PRE.list.filter(x => !have.has(norm(x[0]))).map(x => ({slug:x[3], name:x[0], cmd:x[1], set:x[2]})))
    .filter(x => !nq || norm(x.name + ' ' + x.cmd + ' ' + x.set).includes(nq));
  const rows = all.slice(0, 50).map(x => { const c = find(x.cmd); return '<div class="pre"><img alt="" src="' + artFor(c || {n:x.name, t:'Creature', o:'', ci:[]}) + '"><div style="min-width:0"><b>' + esc(x.name) + '</b> ' + (c ? c.ci.map(k => '<i class="pip p' + k + '">' + k + '</i>').join('') : '') + '<div class="note">' + esc(x.cmd) + (x.note ? ' · ' + esc(x.note) : '') + '</div><div class="why">' + (x.tag ? '<span class="chip gold">' + esc(x.tag) + '</span>' : '') + '<span class="chip">' + esc(x.set) + '</span></div></div><div class="acts"><button class="btn pri sm" ' + (x.slug ? 'data-act="precon-live" data-v="' + esc(x.slug) + '" data-n="' + esc(x.name) + '"' : 'data-act="precon" data-v="' + x.i + '"') + '>Load</button></div></div>'; }).join('');
  const status = PRE.state === 'ok' ? all.length + ' of ' + (PRECONS.length + PRE.list.filter(x => !have.has(norm(x[0]))).length) + ' precons' + (all.length > 50 ? ' · showing 50, type to narrow down' : '') : PRE.state === 'loading' ? 'Loading the full precon catalogue…' : 'Showing the ' + PRECONS.length + ' built-in precons. The full catalogue could not be loaded.';
  return '<p class="note" style="margin:0">' + status + '</p>' + (rows || '<p class="note">No precon matches that search.</p>');
}
function openPrecons(){
  $('#modal').innerHTML = '<div class="panel" role="dialog" aria-label="Load a precon"><div class="ph"><h2>Load a precon</h2><button class="ico" data-act="close" aria-label="Close">×</button></div><input type="search" id="pre-q" placeholder="Search by deck name, commander or set code" autocomplete="off"><div class="grp" id="pre-list">' + preRows('') + '</div><p class="note" style="margin:0">Official decklists from EDHREC’s precon pages. Loading one adds it as a new deck.</p></div>';
  $('#modal').hidden = false;
  loadPreIndex().then(() => { const el = $('#pre-list'), q = $('#pre-q'); if (el && q) el.innerHTML = preRows(q.value); });
}
async function loadPreconLive(slug, label){
  toast('Loading ' + label + '…');
  try {
    const j = await (await fetch('https://json.edhrec.com/pages/precon/' + slug + '.json')).json(), dk = j.deck || {}, cmds = dk.commander || [], map = new Map();
    const put = (n, q) => { const c = find(n), name = c ? c.n : n, k = norm(name); if (map.has(k)) map.get(k).q += q; else map.set(k, {n:name, q, l:false}); };
    Object.values(dk.cards || {}).forEach(arr => (arr || []).forEach(t => { if (t && t[0]) put(t[0], +t[1] || 1); })); cmds.slice(1).forEach(n => put(n, 1));
    if (!map.size) throw new Error('empty');
    const d = newDeck({name:dk.name || label, format:'commander', cards:[...map.values()]});
    if (cmds[0]){ setCommander(d, cmds[0]); const v2 = (dk.commander_v2 || [])[0]; if (v2 && v2[2] && find(cmds[0])) d.cmdSet = v2[2]; }
    if (d.aims.length) d.auto = 'precon';
    touch(); render(); const unk = d.cards.filter(e => !find(e.n)).length;
    toast('Loaded ' + d.name + ' (' + analyze(d).size + ' cards).' + (unk ? ' ' + unk + ' need the full card data to show details.' : ''));
  } catch (e) { toast('That decklist could not be loaded from EDHREC.'); }
}
function openGenerate(){
  const g = S.gen, c = find(g.cmd), st = detectStrategy(c);
  let h = '<div class="panel" role="dialog" aria-label="Generate from a commander"><div class="ph"><h2>Generate from a commander</h2><button class="ico" data-act="close" aria-label="Close">×</button></div><p class="note" style="margin:0">Pick any legendary creature. Deck Companion reads what the commander does, sets the build to match, and makes a full 100-card list at the tier you choose. It is added as a new deck.</p>' +
    '<div class="grp"><label class="lab" for="gen-q">Commander</label><div class="dd"><input type="search" id="gen-q" placeholder="Search legendary creatures" autocomplete="off"><div class="ddl" id="gen-res" hidden></div></div></div>';
  if (c) h += '<div class="detail">' + cardHtml(c, false) + '<div class="grp"><span class="lab">Strategy it will follow</span><div class="row">' + (st.themes.length ? st.themes.map(k => '<span class="chip gold">' + (k === 'tribal' ? st.tribe + ' tribal' : THEMES[k].label) + '</span>').join('') : '<span class="note">No built-in strategy detected. The deck opens in the Builder so you can pick the mechanics, then fill it.</span>') + '</div>' +
    '<span class="lab">Tier</span><div class="seg">' + Object.keys(TIERS).map(k => '<button data-act="gen-tier" data-v="' + k + '" class="' + (g.tier === k ? 'on' : '') + '">' + TIERS[k].label + '<small>' + (TIERS[k].cap === Infinity ? 'no price cap' : 'cards ≤ $' + TIERS[k].cap) + '</small></button>').join('') + '</div>' +
    '<div class="row">' + edhNote(c) + '</div>' +
    (DBINFO.complete ? '<div class="row"><button class="btn pri" data-act="gen-go"' + (EDH.key === c.n && EDH.state === 'loading' ? ' disabled' : '') + '>Generate this deck</button></div>'
      : '<div class="gate"><b>Card data is still downloading</b>' + (DBINFO.source === 'full' ? 'Only ' + DBINFO.count.toLocaleString() + ' cards are loaded so far' : 'Only the ' + DBINFO.count + '-card starter list is loaded') + ', so a deck generated now would miss most of what fits this commander. This button unlocks by itself when the download finishes.<div class="row" style="margin-top:10px"><button class="btn pri" disabled>Generate this deck</button><button class="btn" data-act="gen-go">Generate anyway</button></div></div>') +
    '</div></div>';
  h += '<div class="grp"><span class="lab">Or a 60-card Standard deck from a theme</span>' + STD_STARTERS.map((p, i) => '<div class="pre" style="grid-template-columns:minmax(0,1fr) auto"><div style="min-width:0"><b>' + esc(p.name) + '</b> ' + p.colors.map(x => '<i class="pip p' + x + '">' + x + '</i>').join('') + '<div class="note">' + esc(p.note) + '</div></div><div><button class="btn pri sm" data-act="std-starter" data-v="' + i + '">Generate</button></div></div>').join('') + '</div></div>';
  $('#modal').innerHTML = h; $('#modal').hidden = false;
}
function viewProfile(){
  const P = S.profile;
  return '<section class="panel"><div class="ph"><h2>Profile</h2><small>' + 'Saved in this browser' + '</small></div>' +
    '<div class="grp" style="max-width:420px"><label class="lab" for="p-name">Player name</label><input type="text" id="p-name" value="' + esc(P.name) + '" maxlength="40"></div>' +
    '<div class="grp"><span class="lab">Saved decks · ' + P.decks.length + '</span>' + (P.decks.map(d => '<div class="row" style="border-bottom:1px solid var(--line);padding-bottom:6px"><b style="flex:1;min-width:140px">' + esc(d.name) + '</b><span class="chip">' + d.format + '</span><span class="chip gold">' + TIERS[d.tier].label + '</span><button class="btn sm" data-act="open-deck" data-v="' + d.id + '">Open</button><button class="btn sm danger" data-act="del-deck" data-v="' + d.id + '">' + (S.confirmDel === d.id ? 'Confirm delete' : 'Delete') + '</button></div>').join('') || '<p class="note">No decks saved.</p>') + '</div>' +
    '</section>' + backupPanel() +
    '<section class="panel"><div class="ph"><h2>Card database</h2><small>' + (DBINFO.source === 'full' ? DBINFO.count.toLocaleString() + ' cards · Scryfall data from ' + esc(DBINFO.when) : DBINFO.count + '-card starter library') + '</small></div>' +
    '<p class="note" style="margin:0;max-width:75ch">' + (DBINFO.source === 'full' ? 'Card text, prices, legality and artwork come from Scryfall. Once a day the app checks Magic’s release calendar and downloads fresh card data only when a new set or Secret Lair drop has released' + ((lsGet('dc.relSig') || {}).name ? ' (latest seen: ' + esc(lsGet('dc.relSig').name) + ', ' + esc(lsGet('dc.relSig').latest) + ')' : '') + '. Prices refresh at the same time; press Update now whenever you want today’s prices.' : 'The app downloads the full card list from Scryfall the first time it opens, then refreshes it whenever a new set or Secret Lair drop releases. Until that finishes it uses a small built-in starter library with estimated prices.') + (DBINFO.err ? ' <span class="unk">The last update failed (' + esc(DBINFO.err) + ').</span>' : '') + '</p>' +
    '<div class="row"><button class="btn pri" data-act="db-update">Update card data now</button></div>' +
    '<p class="note" style="margin:0">If the automatic update keeps failing, download <b>Oracle Cards</b> from <a href="https://scryfall.com/docs/api/bulk-data" target="_blank" rel="noopener">scryfall.com/docs/api/bulk-data</a> and load the file here:</p><div class="row"><input type="file" id="db-file" accept=".json,application/json" style="max-width:340px"></div></section>';
}
function render(){
  const keepRows = $('#rows') ? $('#rows').scrollTop : 0;
  navHtml(); const m = $('#main');
  document.querySelector('.top').classList.toggle('home', S.view === 'home'); document.querySelector('.app').classList.toggle('home', S.view === 'home');
  m.innerHTML = S.view === 'home' ? viewHome() : S.view === 'decks' ? viewDecks() : S.view === 'search' ? viewSearch() :  S.view === 'profile' ? viewProfile() : viewDeck();
  m.style.display = 'flex'; m.style.flexDirection = 'column'; m.style.gap = S.view === 'home' ? '10px' : '16px';
  if (keepRows && $('#rows')) $('#rows').scrollTop = keepRows;
  ensureTheme(); ensureEdh();
}
function ctlHtml(n){
  const d = cur(), e = d && d.cards.find(x => x.n === n); if (!e) return '';
  return '<span class="lab">In this deck</span><div class="row"><span class="qty"><button data-act="dec" data-n="' + esc(n) + '" aria-label="Remove one copy">−</button><span>' + e.q + '</span><button data-act="inc" data-n="' + esc(n) + '" aria-label="Add one copy"' + (e.q >= copyLimit(d, find(n)) ? ' disabled style="opacity:.35"' : '') + '>+</button></span>' +
    '<button class="btn' + (e.l ? ' gold' : '') + '" data-act="lock" data-n="' + esc(n) + '" aria-pressed="' + !!e.l + '">' + (e.l ? 'Locked · tap to unlock' : 'Lock card') + '</button><button class="btn danger" data-act="rm" data-n="' + esc(n) + '">Remove from deck</button></div>' +
    '<p class="note" style="margin:0">' + (e.l ? 'Locked cards are never suggested as cuts.' : 'Lock a card to keep it out of the suggested cuts.') + '</p>';
}
function wantHtml(d, c){
  const A = analyze(d), open = A.T.size - A.size, warn = !legalIn(c, d.format) ? 'Not legal in ' + d.format : (A.ctx.ident.length || A.ctx.cmd) && !c.ci.every(x => A.ctx.ident.includes(x)) ? 'Outside this deck’s colors' : '';
  let h = '<div class="grp"><span class="lab">Put this card in ' + esc(d.name) + '</span>' + (warn ? '<div class="row"><span class="chip bad">' + warn + '</span></div>' : '');
  if (open > 0) return h + '<div class="row"><button class="btn pri" data-act="add-to-deck" data-n="' + esc(c.n) + '">Add it · ' + open + ' open slot' + (open === 1 ? '' : 's') + '</button></div></div>';
  const cuts = bestCuts(d, c.n, 3);
  if (!cuts.length) return h + '<p class="note" style="margin:0">Every card it could replace is locked.</p><div class="row"><button class="btn" data-act="add-to-deck" data-n="' + esc(c.n) + '">Add anyway</button></div></div>';
  h += '<p class="note" style="margin:0">The deck is full, so something has to come out. These are the cards it can best do without:</p>' +
    cuts.map((x, i) => { const cc = find(x.n); return '<div class="path"><button class="sw out" data-act="card" data-n="' + esc(x.n) + '">' + (cc ? '<img alt="" src="' + artFor(cc) + '">' : '<span></span>') + '<span><small>Take out</small>' + esc(x.n) + '</span><em>' + money(cc) + '</em></button><div class="row">' + (i === 0 ? '<span class="chip good">Best swap</span>' : '') + '<span class="chip">' + esc(x.why[0]) + '</span><button class="btn ' + (i === 0 ? 'pri ' : '') + 'sm" data-act="want" data-n="' + esc(c.n) + '" data-v="' + esc(x.n) + '" style="margin-left:auto">Swap in</button></div></div>'; }).join('');
  return h + '<div class="row"><button class="btn sm" data-act="add-to-deck" data-n="' + esc(c.n) + '">Add without removing anything</button></div></div>';
}
function openEntry(n){
  S.modalCard = n; S.prints = null; S.pick = null;
  $('#modal').innerHTML = '<div class="panel" role="dialog" aria-label="' + esc(n) + '"><div class="ph"><h2>' + esc(n) + '</h2><button class="ico" data-act="close" aria-label="Close">×</button></div><p class="note" style="margin:0">This card isn’t in the card data yet, so there are no details to show. It stays in your list.</p><div class="grp" id="ctl">' + ctlHtml(n) + '</div></div>';
  $('#modal').hidden = false;
}
function openCard(name, pid){
  const c = find(name); if (!c){ if (cur() && cur().cards.some(e => e.n === name)) openEntry(name); return; } const d = cur(), tg = tags(c), th = Object.keys(THEMES).filter(k => tg.th[k] === 1).map(k => THEMES[k].label), inDeck = d && d.cards.find(e => norm(e.n) === c._n);
  const legend = /Legendary/.test(c.t) && /Creature/.test(frontType(c)), isCmd = d && d.format === 'commander' && d.commander === c.n;
  S.modalCard = c.n; S.prints = null; S.pick = c.id ? {n:c.n, id:pid || (isCmd && d.cmdPid) || pidOf(c, inDeck)} : null;
  $('#modal').innerHTML = '<div class="panel" role="dialog" aria-label="' + esc(c.n) + '"><div class="ph"><h2>' + esc(c.n) + '</h2><button class="ico" data-act="close" aria-label="Close">×</button></div>' + (inDeck ? '<div class="grp" id="ctl">' + ctlHtml(inDeck.n) + '</div>' : d && !isCmd && (S.view === 'decks' && S.open) ? wantHtml(d, c) : '') + '<div class="detail">' + cardHtml(c, false, S.pick) + '<div class="grp"><dl class="kv">' +
    '<dt>Mana value</dt><dd>' + c.cmc + ' &nbsp;' + pips(c.m) + '</dd><dt>Color identity</dt><dd>' + (c.ci.length ? c.ci.map(x => '<i class="pip p' + x + '">' + x + '</i>').join('') : 'Colorless') + '</dd>' +
    '<dt>Price</dt><dd>' + money(c) + (c.src === 'starter' ? ' <span class="note">(estimate)</span>' : '') + ' · ' + (c.p == null ? 'no tier data' : c.p <= 3 ? 'fits Budget, Mid and Apex' : c.p <= 12 ? 'fits Mid and Apex' : 'Apex only') + '</dd>' +
    '<dt>Legal in</dt><dd>' + [c.cmd ? 'Commander' : '', c.std ? 'Standard' : ''].filter(Boolean).join(', ') + '</dd>' +
    (c.pt ? '<dt>' + (/Loyalty/.test(c.pt) ? 'Loyalty' : 'Power / toughness') + '</dt><dd>' + esc(c.pt.replace('Loyalty ', '')) + '</dd>' : '') + (c.r ? '<dt>EDHREC rank</dt><dd>#' + c.r.toLocaleString() + '</dd>' : '') + (c.set ? '<dt>Printing</dt><dd>' + esc(c.set) + '</dd>' : '') +
    '<dt>Does</dt><dd>' + ([...tg.roles].map(r => ROLE_LABEL[r] || ({counter:'Counterspell', tutor:'Tutor', protect:'Protection'})[r]).concat(tg.land ? ['Land'] : []).join(', ') || 'Threat / synergy piece') + '</dd>' +
    '<dt>Fits</dt><dd>' + (th.join(', ') || 'No specific mechanic') + '</dd><dt>Source</dt><dd>' + (c.src === 'starter' ? 'Starter library' : 'Scryfall file, ' + DBINFO.when) + '</dd></dl>' +
    '<div class="row">' + (d && d.format === 'commander' && legend && !d.aimLocked ? '<button class="btn" data-act="set-cmd" data-n="' + esc(c.n) + '">Make commander</button>' : '') +
    '<a class="btn" href="https://scryfall.com/search?q=' + encodeURIComponent('!"' + c.n + '"') + '" target="_blank" rel="noopener">Scryfall page</a></div></div></div></div>';
  $('#modal').hidden = false;
  if (c.id){ const p = $('#modal .panel'); p.insertAdjacentHTML('beforeend', '<div class="grp"><span class="lab">Printings' + (inDeck || isCmd ? ' · tap one to use it in this deck' : ' · tap one, then add it') + '</span><div id="prints"><p class="note" style="margin:0">Loading printings…</p></div></div>'); loadPrints(c); }
}
function openImport(preset){
  const d = cur();
  $('#modal').innerHTML = '<div class="panel" role="dialog" aria-label="Import a deck list"><div class="ph"><h2>Import a text list</h2><button class="ico" data-act="close" aria-label="Close">×</button></div>' +
    '<p class="note" style="margin:0">One card per line, like <code>1 Sol Ring</code> or <code>4x Llanowar Elves</code>. Lists exported from Arena, Moxfield, Archidekt and MTGO work, including a “Commander” heading. Sideboards are skipped.</p>' +
    '<div class="row"><input type="file" id="imp-file" accept=".txt,.dek,.dec,text/plain" style="max-width:300px"><select id="imp-fmt" style="width:auto" aria-label="Format"><option value="commander">Commander</option><option value="standard"' + (preset && preset.format === 'standard' ? ' selected' : '') + '>Standard</option></select></div>' +
    '<input type="text" id="imp-name" placeholder="Deck name" value="' + esc(preset && preset.name || '') + '" maxlength="60"><textarea id="imp-text" placeholder="Commander&#10;1 Lathril, Blade of the Elves&#10;&#10;Deck&#10;1 Sol Ring&#10;1 Elvish Archdruid&#10;12 Forest"></textarea>' +
    '<div class="row"><button class="btn pri" data-act="import-go" data-v="new">Import as a new deck</button></div></div>';
  $('#modal').hidden = false; openImport.preset = preset || null;
}
function dropdown(input, box, filter, act){
  const q = input.value.trim(); if (q.length < 2){ box.hidden = true; return; }
  const r = searchCards(q, filter, 8);
  box.innerHTML = r.cards.map(c => '<button data-act="' + act + '" data-n="' + esc(c.n) + '"><img alt="" src="' + artFor(c) + '"><span>' + esc(c.n) + '<small>' + esc(c.t) + '</small></span><span>' + pips(c.m) + '</span></button>').join('') || '<p class="note" style="margin:8px">No match in the ' + (DBINFO.source === 'starter' ? 'starter library' : 'database') + '.</p>';
  box.hidden = false;
}
async function copyText(text, msg){ try { await navigator.clipboard.writeText(text); toast(msg); } catch (e) { $('#modal').innerHTML = '<div class="panel"><div class="ph"><h2>Copy this text</h2><button class="ico" data-act="close" aria-label="Close">×</button></div><textarea id="copy-box" readonly></textarea></div>'; $('#modal').hidden = false; const t = $('#copy-box'); t.value = text; t.select(); } }

// ---------- events ----------
document.addEventListener('click', ev => {
  if (ev.target.id === 'modal'){ $('#modal').hidden = true; return; }
  const b = ev.target.closest('[data-act]'); if (!b) return; const act = b.dataset.act, v = b.dataset.v, n = b.dataset.n, d = cur(); let changed = true;
  switch (act){
    case 'nav': S.view = v; S.open = false; S.confirmDel = null; changed = false; break;
    case 'close': $('#modal').hidden = true; return;
    case 'card': openCard(n, b.dataset.p); return;
    case 'print': { const x = S.prints && S.prints.list[+v]; if (!x) return; S.pick = Object.assign({n:S.modalCard}, x);
      const im = $('#modal .card.real img'); if (im) im.src = imgUrl('normal', x.id); $('#prints').innerHTML = printsHtml();
      if (d){ const en = d.cards.find(e2 => e2.n === S.modalCard);
        if (en){ en.pid = x.id; en.ps = x.set; }
        if (d.format === 'commander' && d.commander === S.modalCard){ d.cmdPid = x.id; d.cmdSet = x.sc; }
        if (en || d.commander === S.modalCard){ touch(); render(); toast('Using the ' + x.set + ' printing.'); } }
      return; }
    case 'open-deck': S.deckId = v; S.view = 'decks'; S.open = true; S.pathShow = 0; changed = false; break;
    case 'deck-back': S.open = false; S.confirmDel = null; changed = false; break;
    case 'draft-open': if (S.draft){ S.deckId = S.draft.id; S.open = true; } changed = false; break;
    case 'draft-save': if (S.draft){ const nd = S.draft; S.profile.decks.unshift(nd); S.draft = null; S.deckId = nd.id; toast('Saved ' + nd.name + ' to your decks.'); } break;
    case 'draft-discard': if (S.draft){ const nm = S.draft.name; S.draft = null; S.open = false; S.deckId = (S.profile.decks[0] || {}).id || null; lsSet('dc.draft', null); toast('Discarded ' + nm + '.'); } changed = false; break;
    case 'new-deck': newDeck({format:v, name:v === 'commander' ? 'New Commander deck' : 'New Standard deck'}); break;
    case 'del-deck': if (S.confirmDel !== v){ S.confirmDel = v; changed = false; break; } S.profile.decks = S.profile.decks.filter(x => x.id !== v); if (S.deckId === v){ S.deckId = (S.profile.decks[0] || {}).id || null; S.open = false; } S.confirmDel = null; break;
    case 'fmt': if (d.format !== v){ d.format = v; if (v === 'standard'){ d.colors = (d.colors || []).slice(0, 3); } else if (find(d.commander)) d.colors = find(d.commander).ci.slice(); } break;
    case 'tier': d.tier = v; break;
    case 'build-custom': d.custom = true; break;
    case 'lock-aim': d.aimLocked = !d.aimLocked; break;
    case 'aim-up': { const i = +v; [d.aims[i - 1], d.aims[i]] = [d.aims[i], d.aims[i - 1]]; break; }
    case 'aim-down': { const i = +v; [d.aims[i + 1], d.aims[i]] = [d.aims[i], d.aims[i + 1]]; break; }
    case 'aim-rm': d.aims.splice(+v, 1); break;
    case 'color': { const s = new Set(d.colors || []); if (s.has(v)){ if (s.size > 1 || d.format === 'standard') s.delete(v); } else { if (d.format === 'standard' && s.size >= 3){ toast('Standard decks here focus on up to three colors.'); return; } s.add(v); } d.colors = 'WUBRG'.split('').filter(x => s.has(x)); break; }
    case 'clear-cmd': if (d.commander) d.prevCmd = d.commander; d.commander = ''; delete d.cmdPid; delete d.cmdSet; break;
    case 'set-cmd': if (d.commander && d.commander !== n) d.prevCmd = d.commander; delete d.cmdPid; delete d.cmdSet; setCommander(d, n); if (S.pick && S.pick.n === n && S.pick.sc){ d.cmdPid = S.pick.id; d.cmdSet = S.pick.sc; } $('#modal').hidden = true; toast(n + ' is now your commander.'); break;
    case 'inc': { const en = d.cards.find(x => x.n === n); if (en && en.q >= copyLimit(d, find(n))){ toast(d.format === 'commander' ? 'Commander decks run one copy of each card.' : 'Four copies is the limit.'); return; } addCard(d, n, 1); break; }
    case 'dec': cutCard(d, n, 1); break;
    case 'rm': cutCard(d, n, 999); break;
    case 'lock': { const e = d.cards.find(x => x.n === n); if (e) e.l = !e.l; break; }
    case 'pick-add': { const en0 = d.cards.find(x => x.n === n); if (en0 && en0.q >= copyLimit(d, find(n))){ toast(n + ' is already in this deck.'); return; } const A = analyze(d); if (A.size >= A.T.size){ document.querySelectorAll('.ddl').forEach(x => x.hidden = true); openCard(n); return; } addCard(d, n, 1); toast('Added ' + n + '.'); break; }
    case 'want': { cutCard(d, v, 1); addCard(d, n, 1); if (S.pick && S.pick.n === n && S.pick.set){ const en = d.cards.find(e2 => e2.n === n); if (en){ en.pid = S.pick.id; en.ps = S.pick.set; } } $('#modal').hidden = true; toast('Swapped ' + v + ' out for ' + n + '.'); break; }
    case 'add-to-deck': { const en0 = d.cards.find(x => x.n === n); if (en0 && en0.q >= copyLimit(d, find(n))){ toast('That card is already in the deck at its copy limit.'); return; } } addCard(d, n, 1); if (S.pick && S.pick.n === n && S.pick.set){ const en = d.cards.find(e2 => e2.n === n); if (en){ en.pid = S.pick.id; en.ps = S.pick.set; } } $('#modal').hidden = true; toast('Added ' + n + ' to ' + d.name + '.'); break;
    case 'swap': { const [i, t] = v.split('|'), L = recsFor(d).paths[+i], p = L && L.opts[t]; if (!p) return; doSwap(d, p, TIER_KEYS.indexOf(t) + 1); toast('Swapped ' + p.cut + ' for ' + p.add + '.'); break; }
    case 'swap-all': { const R = recsFor(d); let k = 0; R.paths.forEach(L => { const p = L.opts[v]; if (p && d.cards.some(x => x.n === p.cut) && !d.cards.some(x => x.n === p.add)){ doSwap(d, p, TIER_KEYS.indexOf(v) + 1); k++; } }); toast('Made ' + k + ' ' + TIERS[v].label + ' swap' + (k === 1 ? '' : 's') + '.'); break; }
    case 'fix': { const p = recsFor(d).fixes[+v]; if (!p) return; doSwap(d, p, 0); break; }
    case 'drop': { const c = recsFor(d).drops[+v]; if (!c) return; cutCard(d, c.n, c.q); break; }
    case 'path-more': S.pathShow = (S.pathShow || 12) + 12; changed = false; break;
    case 'fill': { const k = fillDeck(d); const left = analyze(d); toast(k ? 'Filled ' + k + ' slots.' + (left.size < left.T.size ? ' The card library ran out of fits for the last ' + (left.T.size - left.size) + '.' : '') : 'No fitting cards left in the library for this aim and tier.'); break; }
    case 'backup-save': downloadBackup(); return;
    case 'backup-link': linkBackup(); return;
    case 'backup-resume': resumeBackup(); return;
    case 'restore-cancel': S.pendingRestore = null; changed = false; break;
    case 'restore-replace': case 'restore-merge': { const R = S.pendingRestore; if (!R) return; const keep = act === 'restore-merge' ? S.profile.decks.filter(x => !x.example) : [], ids = new Set(keep.map(x => x.id));
      R.p.decks.forEach(x => { if (ids.has(x.id)) x.id = uid(); }); S.profile = Object.assign({name:'Planeswalker'}, R.p, {decks:keep.concat(R.p.decks)}); S.deckId = (S.profile.decks[0] || {}).id || null; S.pendingRestore = null; toast('Restored ' + R.p.decks.length + ' decks from your backup.'); break; }
    case 'db-update': if (autoUpdate.busy) toast('An update is already running.'); else autoUpdate(); return;
    case 'copy-list': copyText(deckToText(d), 'Deck list copied.'); return;
    case 'export-profile': copyText(JSON.stringify(S.profile), 'Profile backup copied.'); return;
    case 'import-open': openImport(); return;
    case 'list-all': openList(); return;
    case 'cmd-find': openFindCmd(); return;
    case 'fc-color': { const s = new Set(S.fc.colors); if (s.has(v)) s.delete(v); else s.add(v); S.fc.colors = 'WUBRG'.split('').filter(x => s.has(x)); openFindCmd(); return; }
    case 'fc-pick': { const old = d.commander; delete d.cmdPid; delete d.cmdSet; const keepAims = d.aims.slice(), keepTribe = d.tribe; setCommander(d, n); d.aims = keepAims.length ? keepAims : d.aims; if (keepTribe) d.tribe = keepTribe; const nc = find(n); if (nc) d.colors = nc.ci.slice();
      if (old && old !== n) d.prevCmd = old; S.fc = null; $('#modal').hidden = true; toast(n + ' is now the commander.' + (old && old !== n ? ' ' + old + ' can now be suggested as an upgrade.' : '')); break; }
    case 'buy-open': openBuy(); return;
    case 'buy-copy': copyText(buyText(d), 'Buy list copied.'); return;
    case 'buy-save': saveText(d.name.replace(/[^\w -]+/g, '').trim().replace(/\s+/g, '-').toLowerCase() + '-buy-list.txt', buyText(d)); toast('Buy list saved to your downloads.'); return;
    case 'precon-open': openPrecons(); return;
    case 'precon-live': $('#modal').hidden = true; loadPreconLive(v, n); return;
    case 'gen-open': openGenerate(); return;
        case 'precon': { $('#modal').hidden = true; const nd = loadPrecon(PRECONS[+v]), unk = nd.cards.filter(e => !find(e.n)).length; toast('Loaded the official ' + nd.name + ' list.' + (unk ? ' ' + unk + ' cards need the full card database to show details.' : '')); break; }
    case 'gen-pick': S.gen.cmd = n; openGenerate(); loadEdh(n).then(() => { if (!$('#modal').hidden && $('#gen-q') && S.gen.cmd === n) openGenerate(); }); return;
    case 'gen-tier': S.gen.tier = v; openGenerate(); return;
    case 'gen-go': { const c = find(S.gen.cmd); if (!c) return; $('#modal').hidden = true; const nd = newDeck({name:c.n.split(',')[0] + ' (generated)', format:'commander', tier:S.gen.tier, auto:'commander'}); setCommander(nd, c.n);
      if (nd.aims.length){ fillDeck(nd); toast('Generated a ' + TIERS[nd.tier].label + ' deck for ' + c.n + '.'); } else toast('Pick your mechanics in the Build panel, then press Fill.'); break; }
    case 'std-starter': { $('#modal').hidden = true; const p = STD_STARTERS[+v], nd = newDeck({name:p.name, format:'standard', aims:p.aims.slice(), tribe:p.tribe || '', colors:p.colors.slice()}); fillDeck(nd); toast('Standard deck generated.'); break; }
    case 'import-go': {
      const txt = $('#imp-text').value; if (!txt.trim()){ toast('Paste a list or choose a text file first.'); return; }
      const r = parseDeckText(txt), fmt = $('#imp-fmt').value, total = r.cards.reduce((s, e) => s + e.q, 0); if (!total && !r.commander){ toast('No cards found in that text.'); return; }
      const pre = openImport.preset && openImport.preset.precon; let t = d;
      if (v === 'merge' && d) r.cards.forEach(e => addCard(d, e.n, e.q));
      else t = newDeck({name:$('#imp-name').value.trim() || r.name || 'Imported deck', format:fmt, cards:r.cards, aims:pre ? pre.aims.slice() : [], tribe:pre && pre.tribe || ''});
      const cmdName = r.commander || (pre && pre.cmd); if (fmt === 'commander' && cmdName && !(v === 'merge' && t.commander)) setCommander(t, cmdName);
      if (fmt === 'standard' && !t.colors.length){ const s = new Set(); t.cards.forEach(e => { const c = find(e.n); if (c) c.ci.forEach(x => s.add(x)); }); t.colors = 'WUBRG'.split('').filter(x => s.has(x)).slice(0, 3); }
      const unk = t.cards.filter(e => !find(e.n)).length; $('#modal').hidden = true;
      toast('Imported ' + total + ' cards' + (r.side ? ', skipped ' + r.side + ' sideboard' : '') + (unk ? '. ' + unk + ' not recognized' : '') + '.'); break; }
    default: return;
  }
  if (changed) touch(); render();
  if (!$('#modal').hidden && S.modalCard && /^(inc|dec|lock|rm)$/.test(act)){ const box = $('#ctl'), still = cur() && cur().cards.some(e => e.n === S.modalCard); if (!still) $('#modal').hidden = true; else if (box) box.innerHTML = ctlHtml(S.modalCard); }
});
let st = 0;
document.addEventListener('input', ev => {
  const t = ev.target, d = cur();
  if (t.id === 's-q'){ S.search.q = t.value; clearTimeout(st); st = setTimeout(() => { const el = $('#s-res'); if (el) el.innerHTML = searchResults(); }, 160); }
  else if (t.id === 'add-q' && d){ const A = ctxOf(d); dropdown(t, $('#add-res'), {fmt:d.format, within:A.ident.length || A.cmd ? A.ident : null}, 'pick-add'); }
  else if (t.id === 'pre-q'){ const el = $('#pre-list'); if (el) el.innerHTML = preRows(t.value); }
  else if (t.id === 'gen-q') dropdown(t, $('#gen-res'), {fmt:'commander', legend:true}, 'gen-pick');
  else if (t.id === 'cmd-q') dropdown(t, $('#cmd-res'), {fmt:'commander', legend:true}, 'set-cmd');
});
document.addEventListener('change', ev => {
  const t = ev.target, d = cur();
  if (t.id === 'deck-name' && d){ d.name = t.value.trim() || 'Untitled deck'; d.example = false; touch(); }
  else if (t.id === 'p-name'){ S.profile.name = t.value.trim() || 'Planeswalker'; touch(); }
  else if (t.id === 'aim-add' && t.value && d){ d.aims.push(t.value); touch(); render(); }
  else if (t.id === 'tribe' && d){ d.tribe = t.value; touch(); render(); }
  else if (t.id === 'swaps'){ S.swaps = +t.value; render(); }
  else if (/^s-(fmt|color|type|max|theme|prints)$/.test(t.id)){ S.search[t.id.slice(2)] = t.value; $('#s-res').innerHTML = searchResults(); }
  else if (t.id === 'imp-file' && t.files[0]){ t.files[0].text().then(x => { $('#imp-text').value = x; if (!$('#imp-name').value) $('#imp-name').value = t.files[0].name.replace(/\.[^.]+$/, ''); }).catch(() => toast('That file could not be read as text.')); }
  else if (t.id === 'db-file' && t.files[0]) loadBulk(t.files[0]);
  else if (t.id === 'restore-file' && t.files[0]) t.files[0].text().then(readBackup).catch(() => toast('That file could not be read.'));
});
document.addEventListener('keydown', ev => { if (ev.key === 'Escape'){ $('#modal').hidden = true; document.querySelectorAll('.ddl').forEach(x => x.hidden = true); } });

addEventListener('pagehide', () => { clearTimeout(saveT); if (!S.profile.example) persist(); });
document.addEventListener('visibilitychange', () => { if (document.hidden && !S.profile.example){ clearTimeout(saveT); persist(); } });
// ---------- boot ----------
ornaments(); paintSky(); let rz = 0; addEventListener('resize', () => { clearTimeout(rz); rz = setTimeout(paintSky, 250); });
loadLocal();
if (!S.profile.decks.length){ exampleDeck(); S.profile.example = true; } else S.deckId = S.profile.decks[0].id;
S.view = 'home'; S.open = false;
render(); loadSavedLibrary(); initBackup();

// ===== Deck Companion engine: library, parsing, analysis, recommendations =====
const BASICS = {Plains:'W', Island:'U', Swamp:'B', Mountain:'R', Forest:'G', Wastes:''};
const COLOR_BASIC = {W:'Plains', U:'Island', B:'Swamp', R:'Mountain', G:'Forest'};
const TIERS = {budget:{label:'Budget', cap:3}, mid:{label:'Mid', cap:12}, apex:{label:'Apex', cap:Infinity}};
const TRIBES = ['Elf','Goblin','Zombie','Dragon','Vampire','Angel','Merfolk','Dinosaur','Wizard','Human','Soldier','Knight','Cat','Sliver','Elemental','Spirit','Pirate','Eldrazi','Squirrel','Rat','Bird','Beast','Demon','Warrior','Cleric','Rogue','Faerie','Giant','Hydra','Dwarf','Myr','Wolf','Werewolf','Skeleton','Insect','Fungus','Snake','Treefolk','Ninja','Samurai','Shaman','Druid','Artificer','Horror','Phyrexian','Kraken','Sphinx','Rabbit','Mouse','Otter','Lizard','Frog','Bat','Raccoon','Dog','Bear','Ooze','Plant','Rebel','Ally','Advisor','God','Construct','Thopter','Golem','Devil','Minotaur','Centaur','Kithkin','Vedalken','Kor','Orc','Halfling','Detective','Assassin','Scout','Monk','Berserker','Barbarian','Noble','Avatar','Shapeshifter','Illusion','Drake','Serpent','Octopus','Fish','Crab','Spider','Boar','Elk','Ox','Unicorn','Pegasus','Griffin','Phoenix','Hellion','Wurm','Leviathan','Turtle','Nightmare','Shade','Specter','Wraith','Imp','Gargoyle','Kobold','Ogre','Troll','Cyclops','Satyr','Dryad','Nymph','Naga','Djinn','Efreet','Archon','Praetor','Mutant','Robot','Astartes','Tyranid','Necron','Time Lord','Doctor'];

const THEMES = {
  tokens:      {label:'Tokens / go wide', re:/\bcreates?\b[^.]*\btokens?\b|tokens? you control|populate|(^|[.—] ?)(other )?creatures you control get \+/i},
  counters:    {label:'+1/+1 counters', re:/\+1\/\+1 counter|proliferate|number of (each kind of )?counters?/i},
  graveyard:   {label:'Graveyard / reanimator', re:/from (your|a|any) graveyard|\bmills?\b|in(to)? your graveyard|flashback|unearth|dredge|cards? in your graveyard/i},
  sacrifice:   {label:'Sacrifice / aristocrats', re:/sacrifice (a|an|another|two|three|ten) |whenever [^.]*\bdies\b|each (other )?(opponent|player) sacrifices/i},
  spells:      {label:'Spellslinger', re:/instant or sorcery|instant and sorcery|noncreature spell|magecraft|prowess|copy (target|that) (instant|sorcery|spell)/i, type:/Instant|Sorcery/},
  artifacts:   {label:'Artifacts', re:/\bartifacts?\b|treasure token|thopter|affinity|metalcraft/i, type:/Artifact/},
  enchantments:{label:'Enchantments', re:/\benchantments?\b|\bauras?\b|constellation/i, type:/Enchantment/},
  lifegain:    {label:'Lifegain / drain', re:/gains? [^.]{0,30}life|lifelink|whenever you gain life|loses? [^.]{0,30}life/i},
  lands:       {label:'Lands / landfall', re:/landfall|whenever a land|additional land|lands? (cards? )?from your (graveyard|hand)|for each land you control|land card from your hand onto/i},
  voltron:     {label:'Voltron (equipment / auras)', re:/equipped creature|enchanted creature|\bequip\b|\battach\b|aura,? (and|or) equipment|aura and equipment/i, type:/Equipment|Aura/},
  blink:       {label:'Enter-the-battlefield / blink', re:/then return (it|that card|those cards|them) to the battlefield|whenever (a|another|one or more)[^.]{0,40}creatures?[^.]{0,30}\benters?\b|when [^.]{1,45} enters,|triggers an additional time/i},
  burn:        {label:'Burn / direct damage', re:/deals? (\d+|x|that much) damage to (each opponent|any target|target player|each player|that player)|damage to each opponent|deals damage equal to [^.]* to any target/i},
  aggro:       {label:'Aggro / combat', re:/\bhaste\b|double strike|additional combat|whenever [^.]{0,50}\battacks?\b(?! you)|(^|[.—] ?)(other )?creatures you control get \+|\btrample\b/i},
  control:     {label:'Control / interaction', re:null},
  draw:        {label:'Card advantage engine', re:/draws? (a|an|two|three|four|seven|x|that many|up to two) (additional )?cards?|draw cards equal|draw a card for each|draw x cards|no maximum hand size/i},
  tribal:      {label:'Creature type (tribal)', re:null}
};
const ROLE_LABEL = {ramp:'Ramp', draw:'Card draw', removal:'Removal', wipe:'Board wipes'};
const LAND_WORDS = '(basic land|land|plains|island|swamp|mountain|forest)';
const ROLE_RE = {
  ramp: new RegExp('\\{T\\}[^.]{0,40}: Add |: Add \\{|adds? (an additional|one additional|\\{)|add (one|two|three|x) mana|search your library for [^.]*' + LAND_WORDS + ' cards?[^.]*onto the battlefield|land card from your hand onto the battlefield|(?<!controller )creates? [^.]*treasure token|additional land on each', 'i'),
  removal: /(destroy|exile) target (?!player|card|instant|sorcery|spell|non-|creature you control|creature card|artifacts, creatures)[^.]*(creature|permanent|artifact|enchantment|planeswalker)|deals? (\d+|x) damage to (any target|target creature)|target creature gets -\d|return target (nonland permanent|creature)[^.]*to its owner's hand|fights target|owner of target permanent shuffles|exile that creature/i,
  wipe: /(destroy|exile) all (creatures|nontoken|nonland|artifacts|permanents|other)|deals? (\d+|x) damage to each creature|all creatures get -|destroy all artifacts, creatures|return all (nonland|attacking)/i,
  counter: /counter target/i,
  tutor: /search your library for (a|an) (card|creature card|artifact or enchantment card|instant or sorcery card|equipment card)/i,
  protect: /hexproof|indestructible|phase out|protection from|\bshroud\b/i
};

let LIB = [], IDX = new Map();
// What players actually run with one commander (from EDHREC): key = commander name, map = card name -> {inc, syn}.
let EDH = {key:'', map:null, decks:0, state:''};
const norm = s => String(s).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, ' ').trim();
const frontType = c => (c.t || '').split(' // ')[0];
const isBasic = n => Object.prototype.hasOwnProperty.call(BASICS, n) || /^Snow-Covered /.test(n);

function costFmt(s){ return (s || '').replace(/(\d+|[WUBRGXC])/g, '{$1}'); }
function cmcOf(m){ let v = 0; (m.match(/\{([^}]+)\}/g) || []).forEach(x => { const k = x.slice(1, -1); if (/^\d+$/.test(k)) v += +k; else if (k !== 'X') v += 1; }); return v; }
function identityOf(text, type){
  const s = new Set(); (text.match(/\{[^}]*\}/g) || []).forEach(x => { for (const ch of x) if ('WUBRG'.includes(ch)) s.add(ch); });
  for (const b in COLOR_BASIC) if (new RegExp('\\b' + COLOR_BASIC[b] + '\\b').test(type)) s.add(b);
  return 'WUBRG'.split('').filter(c => s.has(c));
}
function parseStarter(raw){
  const out = raw.trim().split('\n').map(l => {
    const [n, cost, t, p, o, fl, pt] = l.split('|');
    const m = costFmt(cost), text = (o || '').replace(/~/g, n);
    return {n, m, t, o:text, ci:identityOf(m + text, t), cmc:cmcOf(m), p:+p, std:/S/.test(fl || ''), cmd:true, r:0, pt:pt || '', src:'starter'};
  });
  for (const b in BASICS) out.push({n:b, m:'', t:'Basic Land' + (b === 'Wastes' ? '' : ' — ' + b), o: b === 'Wastes' ? '{T}: Add {C}.' : '({T}: Add {' + BASICS[b] + '}.)', ci:BASICS[b] ? [BASICS[b]] : [], cmc:0, p:0.1, std:b !== 'Wastes', cmd:true, r:0, pt:'', src:'starter'});
  return out;
}
function fromScryfall(o){
  if (!o || o.object !== 'card') return null;
  if (/token|emblem|art_series|vanguard|scheme|planar/.test(o.layout || '')) return null;
  if (o.games && !o.games.includes('paper')) return null;
  const lg = o.legalities || {}, cmd = lg.commander === 'legal', std = lg.standard === 'legal';
  if (!cmd && !std) return null;
  const f = o.card_faces, f0 = f && f[0] || {};
  const pr = o.prices || {}, p = parseFloat(pr.usd || pr.usd_foil || pr.usd_etched);
  const pw = o.power != null ? o : f0;
  return {n:o.name, m:o.mana_cost || f0.mana_cost || '', t:o.type_line || f0.type_line || '',
    o:o.oracle_text != null ? o.oracle_text : (f || []).map(x => x.oracle_text || '').join(' // '),
    ci:o.color_identity || [], cmc:o.cmc || 0, p:isNaN(p) ? null : p, std, cmd, r:o.edhrec_rank || 0,
    pt:pw.power != null ? pw.power + '/' + pw.toughness : (o.loyalty ? 'Loyalty ' + o.loyalty : ''), set:o.set_name || '', id:o.id || '', sc:o.set || '', oid:o.oracle_id || '', src:'full'};
}
function buildIndex(cards){
  LIB = cards; IDX = new Map();
  for (const c of cards){ c._n = norm(c.n); IDX.set(c._n, c); }
  for (const c of cards) if (c.n.includes(' // ')){ const f = norm(c.n.split(' // ')[0]); if (!IDX.has(f)) IDX.set(f, c); }
}
function mergeLibrary(starter, full){
  const seen = new Set(full.map(c => norm(c.n)));
  return full.concat(starter.filter(c => !seen.has(norm(c.n))));
}
function find(name){ if (!name) return null; return IDX.get(norm(name)) || IDX.get(norm(String(name).split(' // ')[0])) || null; }

function tags(c){
  if (c._t) return c._t;
  const o = c.o || '', t = frontType(c), land = /\bLand\b/.test(t), th = {}, roles = new Set();
  for (const k in THEMES){ const T = THEMES[k]; if (!T.re) continue; th[k] = T.re.test(o) ? 1 : (T.type && T.type.test(t) ? 0.5 : 0); }
  if (!land){
    if (ROLE_RE.ramp.test(o)) roles.add('ramp');
    if (THEMES.draw.re.test(o) && !/each player draws|target opponent draws/i.test(o)) roles.add('draw');
    if (ROLE_RE.wipe.test(o)) roles.add('wipe');
    else if (ROLE_RE.removal.test(o)) roles.add('removal');
    if (ROLE_RE.counter.test(o)) roles.add('counter');
    if (ROLE_RE.tutor.test(o) && !roles.has('ramp')) roles.add('tutor');
    if (ROLE_RE.protect.test(o)) roles.add('protect');
  }
  return c._t = {land, th, roles};
}
function matchAim(c, key, tribe){
  if (key === 'tribal'){
    if (!tribe) return 0;
    const re = new RegExp('\\b' + tribe.replace(/[^A-Za-z ]/g, '') + '(s|es|ves)?\\b', 'i'), alt = tribe === 'Elf' ? /\bElves\b/i : null;
    if (re.test(frontType(c).split('—')[1] || '')) return 1;
    if (re.test(c.o || '') || (alt && alt.test(c.o || ''))) return 1;
    return /chosen type|shares a creature type|changeling/i.test(c.o || '') ? 0.7 : 0;
  }
  const tg = tags(c);
  if (key === 'control') return tg.roles.has('counter') || tg.roles.has('removal') || tg.roles.has('wipe') ? 1 : 0;
  return tg.th[key] || 0;
}
function detectStrategy(cmd){
  if (!cmd) return {themes:[], tribe:''};
  const tg = tags(cmd), o = (cmd.o || '').replace(new RegExp(cmd.n.split(',')[0], 'g'), '');
  let tribe = '';
  const o2 = o.replace(/[^.]*\bcreates?\b[^.]*tokens?[^.]*\./gi, ' ');
  for (const t of TRIBES){ if (new RegExp('\\b(' + t + (t === 'Elf' ? '|Elves' : '') + ')s?\\b').test(o2)){ tribe = t; break; } }
  const order = ['counters','tokens','graveyard','sacrifice','spells','artifacts','enchantments','lifegain','lands','voltron','blink','burn','aggro'];
  const themes = order.filter(k => tg.th[k] === 1 && (k !== 'blink' || /whenever (a|another|one or more)|then return/i.test(o)));
  return {themes: (tribe ? ['tribal'] : []).concat(themes), tribe};
}

// ----- deck text import -----
function parseDeckText(txt){
  const out = {cards:[], commander:'', side:0, name:''}; let section = 'main';
  const map = new Map();
  for (let line of String(txt).replace(/\r/g, '').split('\n')){
    line = line.trim(); if (!line) continue;
    let hm = line.replace(/^(\/\/|#)+\s*/, '');
    const head = /^(commander|commanders|deck|main|mainboard|main deck|sideboard|side|maybeboard|companion|about|lands?|creatures?|instants?|sorcer(y|ies)|artifacts?|enchantments?|planeswalkers?|spells?)\b\s*(\(\d+\))?:?$/i.exec(hm);
    if (head){ const h = head[1].toLowerCase(); section = /^commander/.test(h) ? 'commander' : /^(sideboard|side|maybeboard)$/.test(h) ? 'side' : h === 'about' ? 'about' : h === 'companion' ? 'side' : 'main'; continue; }
    if (/^(\/\/|#)/.test(line)) continue;
    if (section === 'about'){ const nm = /^name\s+(.+)/i.exec(line); if (nm) out.name = nm[1]; continue; }
    let sb = false; if (/^SB:\s*/i.test(line)){ sb = true; line = line.replace(/^SB:\s*/i, ''); }
    let q = 1, name = line; const m = /^(\d+)\s*x?\s+(.+)$/i.exec(line); if (m){ q = +m[1]; name = m[2]; }
    const isCmd = /\*CMDR\*/i.test(name);
    name = name.replace(/\*[A-Z]+\*/g, '').replace(/\s+#.*$/, '').replace(/\s*[\(\[][A-Za-z0-9]{2,6}[\)\]].*$/, '').replace(/\s+\d+[a-z★]?$/i, '').trim();
    if (!name || q < 1 || q > 250) continue;
    if (sb || section === 'side'){ out.side += q; continue; }
    const c = find(name); if (c) name = c.n;
    if ((section === 'commander' || isCmd) && !out.commander){ out.commander = name; continue; }
    const k = norm(name); if (map.has(k)) map.get(k).q += q; else { const e = {n:name, q, l:false}; map.set(k, e); out.cards.push(e); }
  }
  return out;
}
function deckToText(d){
  const L = []; if (d.format === 'commander' && d.commander) L.push('Commander', '1 ' + d.commander, '', 'Deck');
  d.cards.forEach(e => L.push(e.q + ' ' + e.n)); return L.join('\n');
}

// ----- analysis -----
function ctxOf(d){
  const cmd = d.format === 'commander' ? find(d.commander) : null;
  const ident = d.format === 'commander' ? (cmd ? cmd.ci : []) : (d.colors || []);
  let focus = (d.colors || []).filter(x => ident.includes(x)); if (!focus.length) focus = ident.slice();
  const strat = detectStrategy(cmd);
  return {cmd, ident, focus, edh:cmd && EDH.map && EDH.key === cmd.n ? EDH : null, cap:TIERS[d.tier || 'budget'].cap, cmdThemes:strat.themes, cmdTribe:strat.tribe, tribe:d.tribe || strat.tribe};
}
function isAimed(d){
  if (!d.aims || !d.aims.length) return false;
  if (d.aims.includes('tribal') && !(d.tribe || ctxOf(d).cmdTribe)) return false;
  return d.format === 'commander' ? !!find(d.commander) : (d.colors || []).length > 0;
}
function targetsOf(d, ctx){
  const a = d.aims || [];
  if (d.format === 'commander') return {size:100, lands:a[0] === 'lands' ? 39 : a[0] === 'aggro' ? 35 : 37, ramp:10, draw:10, removal:8, wipe:a.includes('control') ? 4 : 3};
  return {size:60, lands:a.includes('control') ? 26 : (a[0] === 'aggro' || a[0] === 'burn') ? 22 : 24, ramp:ctx.ident.includes('G') ? 4 : 0, draw:4, removal:6, wipe:a.includes('control') ? 2 : 0};
}
// Copies allowed: one in Commander (singleton), four in Standard; basics and "any number of cards named" cards are unlimited.
function copyLimit(d, c){ if (c && (isBasic(c.n) || /a deck can have any number of cards named/i.test(c.o || ''))) return Infinity; return d.format === 'commander' ? 1 : 4; }
const TYPE_ORDER = ['Creature', 'Planeswalker', 'Instant', 'Sorcery', 'Artifact', 'Enchantment', 'Land'];
function mainType(c){ const t = c ? frontType(c) : ''; if (/\bLand\b/.test(t) && !/Creature/.test(t)) return 'Land'; return TYPE_ORDER.find(k => new RegExp('\\b' + k + '\\b').test(t)) || 'Artifact'; }
function legalIn(c, fmt){ return fmt === 'commander' ? c.cmd : c.std; }
function analyze(d){
  const ctx = ctxOf(d), T = targetsOf(d, ctx);
  const A = {ctx, T, size:ctx.cmd || (d.format === 'commander' && d.commander) ? 1 : 0, lands:0, nonland:0, cmcSum:0, curve:[0,0,0,0,0,0,0], roles:{ramp:0, draw:0, removal:0, wipe:0},
    unknown:[], over:[], offColor:[], illegal:[], dupes:[], types:{}, aim:(d.aims || []).map(() => 0), price:0, priced:true};
  if (ctx.cmd && ctx.cmd.p != null) A.price += ctx.cmd.p;
  for (const e of d.cards){
    A.size += e.q; const c = find(e.n); if (!c){ A.unknown.push(e.n); continue; }
    const tg = tags(c); if (c.p != null) A.price += c.p * e.q; else A.priced = false;
    const mt = mainType(c); A.types[mt] = (A.types[mt] || 0) + e.q;
    if (tg.land) A.lands += e.q;
    else { A.nonland += e.q; A.cmcSum += c.cmc * e.q; A.curve[Math.min(6, Math.floor(c.cmc))] += e.q;
      for (const r in A.roles) if (tg.roles.has(r)) A.roles[r] += e.q;
      (d.aims || []).forEach((a, i) => { if (matchAim(c, a, ctx.tribe)) A.aim[i] += e.q; }); }
    if (!isBasic(c.n)){
      if (c.p != null && c.p > ctx.cap) A.over.push(c.n);
      if (ctx.ident.length || ctx.cmd) { if (!c.ci.every(x => ctx.ident.includes(x))) A.offColor.push(c.n); }
      if (!legalIn(c, d.format)) A.illegal.push(c.n);
      if (e.q > copyLimit(d, c)) A.dupes.push(c.n);
    }
  }
  A.avg = A.nonland ? A.cmcSum / A.nonland : 0;
  return A;
}

// ----- scoring & recommendations -----
const AIM_W = [5, 3.6, 2.6, 1.9, 1.4, 1];
const CORE = new Set(['sol ring','arcane signet','command tower']);
const TRIBE_SET = new Set(TRIBES);
function foreignTribe(c){
  if (c._ft !== undefined) return c._ft;
  const re = /(?<!non-)\b([A-Z][a-z]+?)(?:s|es)? (?:creatures? you control|creatures? get|spells?|you control|cards? in|on the battlefield|gain|creature spell)/g; let m, r = '';
  while ((m = re.exec(c.o || ''))){ const w = m[1] === 'Elv' ? 'Elf' : m[1]; if (TRIBE_SET.has(w)){ r = w; break; } }
  return c._ft = r;
}
function baseScore(c, d, ctx){
  let s = 0, hit = false, a0 = 0; const why = [];
  (d.aims || []).forEach((a, i) => { const m = matchAim(c, a, ctx.tribe); if (m){ s += (AIM_W[i] || 1) * m; if (m >= 0.7){ hit = true; why.push(a === 'tribal' ? ctx.tribe + ' synergy' : THEMES[a].label); } } });
  ctx.cmdThemes.forEach(a => { if (!(d.aims || []).includes(a) && matchAim(c, a, ctx.cmdTribe) >= 1){ s += 2; hit = true; why.push('Commander strategy'); } });
  if (ctx.edh){ const x = ctx.edh.map.get(c._n); if (x){ s += 4 * x.inc + 4 * Math.max(0, x.syn); hit = true; why.unshift('In ' + Math.round(x.inc * 100) + '% of ' + ctx.cmd.n.split(',')[0] + ' decks'); } }
  a0 = s;
  s += c.r ? 3 * (1 - Math.log(c.r + 1) / Math.log(40000)) : (c.src === 'starter' ? 1.6 : 0.2);
  if (ctx.cap === Infinity) s += Math.min(2.5, Math.log10((c.p || 0) + 1) * 1.5);
  else if (ctx.cap > 3) s += Math.min(1, Math.log10((c.p || 0) + 1));
  c.ci.forEach(x => { if (!ctx.focus.includes(x)) s -= 1.5; });
  const ft = foreignTribe(c); if (ft && ft !== ctx.tribe && !(ctx.cmd && new RegExp('\\b' + ft + '\\b').test(ctx.cmd.t))){ s -= 5; hit = false; a0 = 0; }
  if (CORE.has(c._n) || (c.r && c.r < 60)) s += 6;
  return {s, hit, why, a:a0};
}
function splitBasics(k, ctx){
  const cols = ctx.ident.length ? ctx.ident : []; if (!cols.length) return k > 0 ? [{n:'Wastes', q:k}] : [];
  const w = cols.map(c => ctx.focus.includes(c) ? 3 : 1), tot = w.reduce((a, b) => a + b, 0);
  const raw = w.map(x => k * x / tot), q = raw.map(Math.floor); let rest = k - q.reduce((a, b) => a + b, 0);
  raw.map((x, i) => [x - q[i], i]).sort((a, b) => b[0] - a[0]).forEach(([, i]) => { if (rest > 0){ q[i]++; rest--; } });
  return cols.map((c, i) => ({n:COLOR_BASIC[c], q:q[i]})).filter(x => x.q > 0);
}
function recommend(d, swaps, fillOnly){
  const A = analyze(d), ctx = A.ctx, T = A.T, std = d.format === 'standard';
  const have = new Map(d.cards.map(e => [norm(e.n), e])), dismissed = new Set((d.dismissed || []).map(norm));
  const open = T.size - A.size;
  let nAdd = Math.max(0, open) + (fillOnly ? 0 : swaps), nCut = Math.max(0, -open) + (fillOnly ? 0 : swaps);
  const adds = [], cuts = [], def = {}; for (const r in A.roles) def[r] = T[r] - A.roles[r];
  const okCard = c => legalIn(c, d.format) && c.ci.every(x => ctx.ident.includes(x)) && (ctx.cap === Infinity || (c.p != null && c.p <= ctx.cap)) && (!recommend.minP || (c.p != null && c.p > recommend.minP)) && !dismissed.has(c._n);

  // lands first
  let landNeed = Math.min(nAdd, Math.max(0, T.lands - A.lands));
  if (landNeed > 0){
    let nonbasic = 0; d.cards.forEach(e => { const c = find(e.n); if (c && tags(c).land && !isBasic(c.n)) nonbasic += e.q; });
    let room = std ? (ctx.ident.length > 1 ? 4 : 0) : Math.max(0, Math.min(12, 4 + ctx.ident.length * 3) - nonbasic);
    const pool = LIB.filter(c => tags(c).land && !isBasic(c.n) && okCard(c) && !have.has(c._n) && c.n !== d.commander)
      .map(c => ({c, b:baseScore(c, d, ctx)})).sort((x, y) => y.b.s - x.b.s);
    for (const p of pool){
      if (room <= 0 || landNeed <= 0) break;
      if (std && !/basic land card/.test(p.c.o)) continue;
      const q = std ? Math.min(4, room, landNeed) : 1;
      adds.push({n:p.c.n, q, kind:'land', why:[p.b.hit ? p.b.why[0] : 'Utility land'], s:p.b.s}); room -= q; landNeed -= q; nAdd -= q;
    }
    splitBasics(landNeed, ctx).forEach(b => { adds.push({n:b.n, q:b.q, kind:'land', why:['Reach ' + T.lands + ' lands'], s:99}); nAdd -= b.q; });
  }
  // spells
  if (nAdd > 0){
    const pool = LIB.filter(c => !tags(c).land && okCard(c) && !have.has(c._n) && c.n !== d.commander).map(c => ({c, b:baseScore(c, d, ctx), used:false}));
    const bonus = c => { let b = 0, w = null; tags(c).roles.forEach(r => { if (def[r] > 0){ b += 2 + Math.min(2, def[r] / 3); w = w || r; } }); return [b, w]; };
    let guard = 0;
    while (nAdd > 0 && guard++ < 400){
      let best = null, bs = -1e9, bw = null, strict = true;
      for (let pass = 0; pass < 2 && !best; pass++){
        strict = pass === 0;
        for (const p of pool){ if (p.used) continue; const [b, w] = bonus(p.c); if (strict && !p.b.hit && b === 0) continue; const s = p.b.s + b; if (s > bs){ bs = s; best = p; bw = w; } }
      }
      if (!best) break; best.used = true;
      const q = std ? Math.min(nAdd, /Legendary/.test(best.c.t) ? 2 : 4) : 1;
      const why = best.b.why.slice(0, 2); if (bw) why.push('Fills ' + ROLE_LABEL[bw].toLowerCase() + ' gap'); if (!why.length) why.push('Solid staple');
      adds.push({n:best.c.n, q, kind:'spell', why, s:bs, a:best.b.a}); nAdd -= q; tags(best.c).roles.forEach(r => { if (r in def) def[r] -= q; });
    }
  }
  // cuts
  if (nCut > 0){
    const landExcess = A.lands - T.lands;
    if (landExcess > 1){ let k = Math.min(landExcess, nCut);
      d.cards.filter(e => isBasic(e.n) && !e.l).sort((a, b) => b.q - a.q).forEach(e => { if (k > 0){ const q = Math.min(k, Math.max(0, e.q - 1)); if (q > 0){ cuts.push({n:e.n, q, why:['Above ' + T.lands + ' land target'], s:-10}); k -= q; nCut -= q; } } }); }
    const cand = [];
    for (const e of d.cards){
      if (e.l) continue; const c = find(e.n); if (!c || tags(c).land) continue;
      const b = baseScore(c, d, ctx); let s = b.s, why = [];
      tags(c).roles.forEach(r => { if (r in A.roles) s += A.roles[r] <= T[r] ? 2.5 : 0.6; });
      if (!c.ci.every(x => ctx.ident.includes(x))){ s = -80; why = ['Outside your colors']; }
      else if (!legalIn(c, d.format)){ s = -90; why = ['Not legal in ' + d.format]; }
      else if (c.p != null && c.p > ctx.cap && !recommend.paths){ s = -50; why = ['Over the $' + ctx.cap + ' cap']; }
      else if (!b.hit) why = ["Doesn't serve your aims"]; else why = ['Weakest fit for your aims'];
      cand.push({n:e.n, q:e.q, why, s, a:b.a});
    }
    cand.sort((a, b) => a.s - b.s);
    const cur = Object.assign({}, A.roles);
    for (const x of cand){ if (nCut <= 0) break; const q = Math.min(x.q, nCut), rs = [...tags(find(x.n)).roles].filter(r => r in cur);
      if (x.s > -40 && rs.some(r => cur[r] - q < T[r])) continue;
      rs.forEach(r => cur[r] -= q); cuts.push({n:x.n, q, why:x.why, s:x.s, a:x.a}); nCut -= q; }
  }
  // stop swapping when the deck's worst card already beats the best addition
  let tuned = false;
  if (!fillOnly && open === 0 && !recommend.raw){
    const sp = adds.filter(a => a.kind === 'spell'), opt = cuts.filter(c => c.s > -40);
    if (sp.length && opt.length){
      let keep = 0, ci = 0, ai = 0, cq = 0;
      for (; ai < sp.length && ci < opt.length; ai++){ if (opt[ci].s >= sp[ai].s) break; keep++; cq += sp[ai].q; while (ci < opt.length && cq >= opt[ci].q){ cq -= opt[ci].q; ci++; } }
      if (keep < sp.length){ tuned = true;
        const dropA = new Set(sp.slice(keep).map(a => a.n)); let removed = 0; sp.slice(keep).forEach(a => removed += a.q);
        for (let i = adds.length - 1; i >= 0; i--) if (dropA.has(adds[i].n)) adds.splice(i, 1);
        for (let i = cuts.length - 1; i >= 0 && removed > 0; i--){ if (cuts[i].s <= -40) continue; const q = Math.min(removed, cuts[i].q); cuts[i].q -= q; removed -= q; if (!cuts[i].q) cuts.splice(i, 1); }
      }
    }
  }
  return {adds, cuts, A, tuned};
}
// The app decides how many swaps to suggest. A swap must bring in a card that scores clearly higher than the one it
// replaces. The deck's identity is its #1 aim (for a Dinosaur deck, Dinosaurs): identity cards are normally replaced
// only by other identity cards. A few may give way to a standout card from outside the theme (one that fills a gap
// in ramp/draw/removal/wipes or beats the card it replaces by a wide margin), capped at about a tenth of the
// identity cards so the deck never drifts into a pile of same-mechanic cards.
// Fixes the deck needs anyway (open slots, too many cards, missing lands, over-cap / off-color / illegal cards) are always included.
function autoSwaps(d){
  const A0 = analyze(d), ctx = A0.ctx, open = A0.T.size - A0.size, landGap = Math.max(0, A0.T.lands - A0.lands), top = (d.aims || [])[0];
  const isId = n => { const c = find(n); return !!(top && c && matchAim(c, top, ctx.tribe) >= 0.7); };
  let outside = Math.max(2, Math.round((A0.aim[0] || 0) * 0.1));
  // Card-type balance: like-for-like swaps are preferred. A swap that changes type (a creature for an artifact, say)
  // needs a bigger improvement, and each type can lose only about a tenth of its cards that way (at least two).
  const typeOf = n => mainType(find(n)), lossRoom = {}; TYPE_ORDER.forEach(k => lossRoom[k] = Math.max(2, Math.round((A0.types[k] || 0) * 0.1)));
  recommend.raw = true; let R; try { R = recommend(d, 45, false); } finally { recommend.raw = false; }
  const pairs = [], fills = [], drops = [];
  const adds = [], cuts = [], put = (list, x, q) => { const e = list.find(y => y.n === x.n); if (e) e.q += q; else list.push(Object.assign({}, x, {q})); };
  let fill = Math.max(0, open), trim = Math.max(0, -open), swaps = 0;
  const pool = R.cuts.map(c => Object.assign({}, c, {id:isId(c.n), ty:typeOf(c.n)}));
  for (const c of pool){ if (trim <= 0) break; const q = Math.min(trim, c.q); put(cuts, c, q); put(drops, c, q); c.q -= q; trim -= q; }
  let landSwaps = open > 0 ? 0 : landGap;
  for (const a of R.adds){
    let need = a.q; const aId = a.kind !== 'land' && isId(a.n), gap = a.why.some(w => /^Fills /.test(w)), aTy = typeOf(a.n);
    if (fill > 0){ const q = Math.min(fill, need); put(adds, a, q); put(fills, a, q); fill -= q; need -= q; }
    if (a.kind === 'land'){ if (landSwaps <= 0) continue; need = Math.min(need, landSwaps); }
    while (need > 0 && swaps < 40){
      let star = false;
      const ok = (c, cross) => { if (c.q <= 0) return false; if (c.s <= -40 || a.kind === 'land') return !cross; if ((c.ty === aTy) === cross) return false;
        if (!(a.s > c.s + (cross ? 2.5 : 1))) return false; if (cross && !(lossRoom[c.ty] > 0)) return false;
        if (!c.id || aId) return true; return outside > 0 && (gap || a.s > c.s + 3); };
      const c = pool.find(c => ok(c, false)) || pool.find(c => ok(c, true));
      if (!c) break; const q = Math.min(need, c.q);
      if (c.id && !aId && c.s > -40 && a.kind !== 'land'){ outside -= q; star = true; }
      const cross = c.ty !== aTy && a.kind !== 'land' && c.s > -40; if (cross) lossRoom[c.ty] -= q;
      pairs.push({cut:c.n, add:a.n, q, from:c.ty, to:aTy, cross, why:star ? a.why.concat('Standout pick') : a.why, gain:a.s - c.s, land:a.kind === 'land', fix:c.s <= -40, cutWhy:c.why});
      put(adds, star ? Object.assign({}, a, {why:a.why.concat('Standout pick')}) : a, q); put(cuts, c, q); c.q -= q; need -= q; swaps += q; if (a.kind === 'land') landSwaps -= q;
    }
  }
  pool.forEach(c => { if (c.q > 0 && c.s <= -40){ put(cuts, c, c.q); put(drops, c, c.q); } });
  return {adds, cuts, A:R.A, swaps, pairs, fills, drops};
}
// "Here is my deck" -> every card's upgrade options at once, one per tier. Budget looks at cards up to $3, Mid at
// cards over $3 up to $12, Apex at cards over $12, so the three options for a card are genuinely different steps.
const TIER_STEPS = [['budget', 0], ['mid', 3], ['apex', 12]];
function upgradePaths(d){
  const by = new Map(), used = new Set(), out = {fixes:[], drops:[], fills:0, count:{budget:0, mid:0, apex:0}, cost:{budget:0, mid:0, apex:0}, shift:{budget:{}, mid:{}, apex:{}}};
  recommend.paths = true;
  try {
    TIER_STEPS.forEach(([t, minP], i) => {
      recommend.minP = minP; const R = autoSwaps(Object.assign({}, d, {tier:t}));
      if (i === 0){ out.A = R.A; out.drops = R.drops; out.fills = R.fills.reduce((s, a) => s + a.q, 0); }
      R.pairs.forEach(p => {
        if (used.has(p.add) && !isBasic(p.add)) return;   // a card is only ever suggested once
        if (p.land || p.fix){ if (i === 0){ out.fixes.push(p); used.add(p.add); } return; }
        let L = by.get(p.cut); if (!L){ L = {cut:p.cut, opts:{}, gain:0}; by.set(p.cut, L); }
        if (L.opts[t]) return; L.opts[t] = p; used.add(p.add);
        if (p.cross){ out.shift[t][p.from] = (out.shift[t][p.from] || 0) - p.q; out.shift[t][p.to] = (out.shift[t][p.to] || 0) + p.q; } L.gain = Math.max(L.gain, p.gain); out.count[t] += p.q;
        const a = find(p.add), c = find(p.cut); out.cost[t] += ((a && a.p || 0) - (c && c.p || 0)) * p.q;
      });
    });
  } finally { recommend.paths = false; recommend.minP = 0; }
  for (const [k, L] of by) if (!Object.keys(L.opts).length) by.delete(k);
  // singleton / copy-limit breaches are fixes too
  const dupDrops = []; d.cards.forEach(en => { const c = find(en.n), lim = copyLimit(d, c); if (c && en.q > lim) dupDrops.push({n:en.n, q:en.q - lim, s:-95, why:[d.format === 'commander' ? 'Commander allows one copy' : 'More than four copies']}); });
  if (dupDrops.length){ // removing the extra copies comes first; only trim other cards if the deck is still over size after that
    let spare = dupDrops.reduce((s, x) => s + x.q, 0); const dupNames = new Set(dupDrops.map(x => x.n)), rest = [];
    out.drops.forEach(x => { if (dupNames.has(x.n)) return; if (x.s > -40 && spare > 0){ const q = Math.min(spare, x.q); spare -= q; if (x.q - q > 0) rest.push(Object.assign({}, x, {q:x.q - q})); } else rest.push(x); });
    out.drops = dupDrops.concat(rest);
  }
  out.paths = [...by.values()].sort((a, b) => b.gain - a.gain);
  return out;
}
// "I want this card in my deck": rank what the deck can best do without. A land replaces a land, a spell a spell.
// Cards that would leave ramp/draw/removal/wipes short, or identity cards making way for an off-theme card, are
// held back; a card with a similar mana cost is preferred so the curve stays put. Locked cards are never offered.
function bestCuts(d, addName, k){
  const add = find(addName); if (!add) return [];
  const A = analyze(d), ctx = A.ctx, T = A.T, top = (d.aims || [])[0], addLand = tags(add).land, roles = Object.assign({}, A.roles);
  if (!addLand) tags(add).roles.forEach(r => { if (r in roles) roles[r]++; });
  const isId = c => !!(top && matchAim(c, top, ctx.tribe) >= 0.7), addId = !addLand && isId(add), out = [];
  for (const e of d.cards){
    if (e.l || norm(e.n) === add._n) continue; const c = find(e.n); if (!c) continue; const land = tags(c).land; if (land !== addLand) continue;
    if (land){ out.push(isBasic(c.n) ? {n:e.n, s:-e.q, why:['You run ' + e.q + ' of these']} : {n:e.n, s:baseScore(c, d, ctx).s + 3, why:['Least useful land']}); continue; }
    const b = baseScore(c, d, ctx); let s = b.s, why = b.hit ? 'Weakest fit for the build' : "Doesn't serve the build";
    tags(c).roles.forEach(r => { if (r in roles) s += roles[r] - 1 < T[r] ? 2.5 : 0.6; });
    s += 0.2 * Math.abs(c.cmc - add.cmc); if (isId(c) && !addId) s += 2; if (mainType(c) !== mainType(add)) s += 1.5;
    if (!legalIn(c, d.format)){ s = -90; why = 'Not legal in ' + d.format; } else if (!c.ci.every(x => ctx.ident.includes(x))){ s = -80; why = 'Outside your colors'; }
    out.push({n:e.n, s, why:[why]});
  }
  return out.sort((a, b) => a.s - b.s).slice(0, k || 3);
}
// Find a commander for an existing deck: legendary creatures that include the colors the player asks for, ranked by
// how well they fit the deck's build, how popular they are, and how few of the deck's cards they would strand.
function findCommanders(d, colors, k){
  const ctx = ctxOf(d), out = [];
  for (const c of LIB){
    if (!c.cmd || c.n === d.commander || !/Legendary/.test(c.t) || !/Creature/.test(frontType(c))) continue;
    if (!colors.every(x => c.ci.includes(x))) continue;
    const b = baseScore(c, d, Object.assign({}, ctx, {focus:c.ci, ident:c.ci, edh:null}));
    let outside = 0; d.cards.forEach(en => { const x = find(en.n); if (x && !x.ci.every(y => c.ci.includes(y))) outside += en.q; });
    out.push({n:c.n, s:b.s - 1.2 * (c.ci.length - colors.length) - 0.6 * outside, why:b.why.slice(0, 2), outside});
  }
  return out.sort((a, b) => b.s - a.s).slice(0, k || 12);
}
function addCard(d, n, q){ const k = norm(n), e = d.cards.find(x => norm(x.n) === k); if (e) e.q += q; else d.cards.push({n, q, l:false}); }
function cutCard(d, n, q){ const k = norm(n), i = d.cards.findIndex(x => norm(x.n) === k); if (i < 0) return; d.cards[i].q -= q; if (d.cards[i].q <= 0) d.cards.splice(i, 1); }
function fillDeck(d){ const r = recommend(d, 0, true); r.adds.forEach(a => addCard(d, a.n, a.q)); return r.adds.reduce((s, a) => s + a.q, 0); }
function setCommander(d, name){
  const c = find(name); d.commander = c ? c.n : name; cutCard(d, d.commander, 99);
  if (c && !d.aimLocked){ const st = detectStrategy(c); d.tribe = st.tribe || d.tribe || ''; if (!d.aims.length) d.aims = st.themes.slice(0, 3); d.colors = c.ci.slice(); }
}
function searchCards(q, f, limit){
  const nq = norm(q || ''), lq = (q || '').toLowerCase().trim(), res = [];
  for (const c of LIB){
    let rank = 3;
    if (nq){ if (c._n.startsWith(nq)) rank = 0; else if (c._n.includes(nq)) rank = 1; else if (lq.length >= 3 && ((c.o || '').toLowerCase().includes(lq) || (c.t || '').toLowerCase().includes(lq))) rank = 2; else continue; }
    if (f){
      if (f.fmt && !legalIn(c, f.fmt)) continue;
      if (f.color && (f.color === 'C' ? c.ci.length : !c.ci.includes(f.color))) continue;
      if (f.within && !c.ci.every(x => f.within.includes(x))) continue;
      if (f.type && !new RegExp('\\b' + f.type + '\\b').test(c.t)) continue;
      if (f.legend && !(/Legendary/.test(c.t) && /Creature/.test(frontType(c)))) continue;
      if (f.max && !(c.p != null && c.p <= f.max)) continue;
      if (f.theme && !(matchAim(c, f.theme, f.tribe) >= 0.7)) continue;
    }
    res.push([rank, c]);
  }
  res.sort((a, b) => a[0] - b[0] || ((a[1].r || 1e6) - (b[1].r || 1e6)) || a[1].n.localeCompare(b[1].n));
  return {total:res.length, cards:res.slice(0, limit || 60).map(x => x[1])};
}


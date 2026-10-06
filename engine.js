// ===== Deck Companion engine: library, parsing, analysis, recommendations =====
const BASICS = {Plains:'W', Island:'U', Swamp:'B', Mountain:'R', Forest:'G', Wastes:''};
const COLOR_BASIC = {W:'Plains', U:'Island', B:'Swamp', R:'Mountain', G:'Forest'};
const TIERS = {budget:{label:'Budget', cap:3}, mid:{label:'Mid', cap:12}, apex:{label:'Apex', cap:Infinity}};
// Commander Brackets (Wizards of the Coast). Which cards are Game Changers comes from Scryfall with the card data
// (c.gc), and the mass land denial and extra-turn cards come from Scryfall's card tags (BTAGS), so both stay current
// on their own. Only the limits live here: Game Changers allowed, whether mass land denial belongs, and how many
// extra-turn cards still count as "a few" (Brackets 2-3 allow some, not chained).
const BRACKETS = {1:{label:'Exhibition', gc:0, mld:false, turns:0}, 2:{label:'Core', gc:0, mld:false, turns:2}, 3:{label:'Upgraded', gc:3, mld:false, turns:2},
  4:{label:'Optimized', gc:Infinity, mld:true, turns:Infinity}, 5:{label:'cEDH', gc:Infinity, mld:true, turns:Infinity}};
let BTAGS = {mld:new Set(), turns:new Set(), v:0};
// Universes Beyond families. A deck led by a commander from one of these is an "in-universe" deck: its Budget upgrades
// come only from that family's sets, and at Mid and Apex an in-universe card wins ties but never beats a clearly better card.
const UNIVERSES = [['msh','msc','spm','spe','tmt','tmc'], ['ltr','ltc'], ['fin','fic','fca'], ['who'], ['pip'], ['40k'], ['acr'], ['bot']];
function universeOf(c){ const g = c && c.sc ? UNIVERSES.find(x => x.includes(c.sc)) : null; return g ? new Set(g) : null; }
// Where a deck sits: no Game Changers is Bracket 2, one to three is Bracket 3, more (or any mass land denial) is Bracket 4.
// Brackets 1 and 5 are about how the deck is meant to be played, which the card list alone can't show.
function bracketOf(gc, mld){ return mld > 0 || gc > 3 ? 4 : gc > 0 ? 3 : 2; }
const TRIBES = ['Elf','Goblin','Zombie','Dragon','Vampire','Angel','Merfolk','Dinosaur','Wizard','Human','Soldier','Knight','Cat','Sliver','Elemental','Spirit','Pirate','Eldrazi','Squirrel','Rat','Bird','Beast','Demon','Warrior','Cleric','Rogue','Faerie','Giant','Hydra','Dwarf','Myr','Wolf','Werewolf','Skeleton','Insect','Fungus','Snake','Treefolk','Ninja','Samurai','Shaman','Druid','Artificer','Horror','Phyrexian','Kraken','Sphinx','Rabbit','Mouse','Otter','Lizard','Frog','Bat','Raccoon','Dog','Bear','Ooze','Plant','Rebel','Ally','Advisor','God','Construct','Thopter','Golem','Devil','Minotaur','Centaur','Kithkin','Vedalken','Kor','Orc','Halfling','Detective','Assassin','Scout','Monk','Berserker','Barbarian','Noble','Avatar','Shapeshifter','Illusion','Drake','Serpent','Octopus','Fish','Crab','Spider','Boar','Elk','Ox','Unicorn','Pegasus','Griffin','Phoenix','Hellion','Wurm','Leviathan','Turtle','Nightmare','Shade','Specter','Wraith','Imp','Gargoyle','Kobold','Ogre','Troll','Cyclops','Satyr','Dryad','Nymph','Naga','Djinn','Efreet','Archon','Praetor','Mutant','Robot','Astartes','Tyranid','Necron','Time Lord','Doctor','Hero','Villain'];

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
    pt:pw.power != null ? pw.power + '/' + pw.toughness : (o.loyalty ? 'Loyalty ' + o.loyalty : ''), set:o.set_name || '', id:o.id || '', sc:o.set || '', oid:o.oracle_id || '', rar:o.rarity || '', cn:o.collector_number || '', gc:!!o.game_changer, src:'full'};
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
    // Creature types are capitalised in rules text; a named Role token ("Young Hero Role") is not the type.
    const re = new RegExp('\\b' + tribe.replace(/[^A-Za-z ]/g, '') + '(s|es|ves)?\\b'), alt = tribe === 'Elf' ? /\bElves\b/ : null;
    if (re.test(frontType(c).split('—')[1] || '')) return 1;
    const o = (c.o || '').replace(/\b(?:[A-Z][\w']* )+Role\b/g, '');
    if (re.test(o) || (alt && alt.test(o))) return 1;
    return /chosen type|shares a creature type|changeling/i.test(c.o || '') ? 0.7 : 0;
  }
  const tg = tags(c);
  if (key === 'control') return tg.roles.has('counter') || tg.roles.has('removal') || tg.roles.has('wipe') ? 1 : 0;
  return tg.th[key] || 0;
}
const subtypes = c => ((frontType(c).split('—')[1]) || '').trim().split(/\s+/).filter(Boolean);
// The creature type a deck is built around. If the commander's text names types ("Mutants, Ninjas, and/or Turtles"),
// the one the deck runs most wins. If it names none, the commander's own type counts once the deck is full of it
// (a Dinosaur commander leading a pile of Dinosaurs, a Hero leading Heroes). Human is too common to mean anything.
function deckTribe(d, cmd, named){
  const cnt = {}; ((d && d.cards) || []).forEach(e => { const c = find(e.n); if (c && /Creature/.test(frontType(c))) subtypes(c).forEach(t => cnt[t] = (cnt[t] || 0) + e.q); });
  if (named.length) return named.slice().sort((a, b) => (cnt[b] || 0) - (cnt[a] || 0))[0];
  let best = '', n = 9; (cmd ? subtypes(cmd) : []).forEach(t => { if (TRIBE_SET.has(t) && t !== 'Human' && (cnt[t] || 0) > n){ n = cnt[t]; best = t; } });
  return best;
}
function detectStrategy(cmd, d){
  if (!cmd) return {themes:[], tribe:''};
  const tg = tags(cmd), o = (cmd.o || '').replace(new RegExp(cmd.n.split(',')[0], 'g'), '');
  const o2 = o.replace(/[^.]*\bcreates?\b[^.]*tokens?[^.]*\./gi, ' ');
  const tribe = deckTribe(d, cmd, TRIBES.filter(t => new RegExp('\\b(' + t + (t === 'Elf' ? '|Elves' : '') + ')s?\\b').test(o2)));
  // Read the plan, not the payoff: counters a commander only puts on itself are growth, not a counters deck, and
  // making Treasure-style artifact tokens is an artifact plan, not going wide.
  const self = cmd.n.split(',')[0].replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const plan = (cmd.o || '').replace(new RegExp('put (a|an|one|two|three|four|x|that many) \\+1/\\+1 counters? on ' + self + '\\b', 'gi'), '')
    .replace(/\bcreates? [^.]*\b(Treasure|Clue|Food|Blood|Map|Powerstone|Vibranium|Gold|Junk|Incubator) tokens?/gi, ' artifact ');
  const order = ['counters','tokens','graveyard','sacrifice','spells','artifacts','enchantments','lifegain','lands','voltron','blink','burn','aggro'];
  const themes = order.filter(k => (THEMES[k].re ? THEMES[k].re.test(plan) : tg.th[k] === 1) && (k !== 'blink' || /whenever (a|another|one or more)|then return/i.test(o)));
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
    const pm = /[\(\[]([A-Za-z0-9]{2,6})[\)\]]\s*([A-Za-z0-9★-]{1,8})?/.exec(name);   // "(SET) 123": the printing
    name = name.replace(/\*[A-Z]+\*/g, '').replace(/\s+#.*$/, '').replace(/\s*[\(\[][A-Za-z0-9]{2,6}[\)\]].*$/, '').replace(/\s+\d+[a-z★]?$/i, '').trim();
    if (!name || q < 1 || q > 250) continue;
    if (sb || section === 'side'){ out.side += q; continue; }
    const c = find(name); if (c) name = c.n;
    if ((section === 'commander' || isCmd) && !out.commander){ out.commander = name; continue; }
    if ((section === 'commander' || isCmd) && !out.partner){ out.partner = name; continue; }
    const k = norm(name); if (map.has(k)) map.get(k).q += q; else { const e = {n:name, q, l:false}; if (pm){ e.psc = pm[1].toLowerCase(); if (pm[2]) e.pcn = pm[2]; } map.set(k, e); out.cards.push(e); }
  }
  return out;
}
function deckToText(d){
  const L = []; if (d.format === 'commander' && d.commander){ L.push('Commander', '1 ' + d.commander); if (d.partner) L.push('1 ' + d.partner); L.push('', 'Deck'); }
  d.cards.forEach(e => L.push(e.q + ' ' + e.n)); return L.join('\n');
}

// ----- analysis -----
function ctxOf(d){
  const cmd = d.format === 'commander' ? find(d.commander) : null, par = cmd && d.partner ? find(d.partner) : null;
  const ident = d.format === 'commander' ? (cmd ? 'WUBRG'.split('').filter(k => cmd.ci.includes(k) || (par && par.ci.includes(k))) : []) : (d.colors || []);
  let focus = (d.colors || []).filter(x => ident.includes(x)); if (!focus.length) focus = ident.slice();
  const strat = detectStrategy(cmd, d);
  if (par){ const ps = detectStrategy(par, d); strat.themes = strat.themes.concat(ps.themes.filter(t => !strat.themes.includes(t))); if (!strat.tribe) strat.tribe = ps.tribe; }
  // Bracket: a label only. It is worked out from what is in the deck (Game Changers, mass land denial) and never limits
  // what the deck may hold or what is recommended; gcCap stays unlimited so no gate downstream ever closes.
  let gcIn = (cmd && cmd.gc ? 1 : 0) + (par && par.gc ? 1 : 0); let mldIn = 0; if (d.format === 'commander') (d.cards || []).forEach(e => { const c = find(e.n); if (c && c.gc) gcIn += e.q; if (c && BTAGS.mld.has(c._n)) mldIn += e.q; });
  const bracket = d.format !== 'commander' ? 0 : bracketOf(gcIn, mldIn);
  return {cmd, par, ident, focus, edh:cmd && EDH.map && EDH.key === cmd.n ? EDH : null, cap:TIERS[d.tier || 'budget'].cap, cmdThemes:strat.themes, cmdTribe:strat.tribe, tribe:d.tribe || strat.tribe,
    bracket, gcIn, mldIn, gcCap:Infinity, uni:universeOf(cmd) || universeOf(par)};
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
  const A = {ctx, T, size:(ctx.cmd || (d.format === 'commander' && d.commander) ? 1 : 0) + (ctx.par ? 1 : 0), lands:0, nonland:0, cmcSum:0, curve:[0,0,0,0,0,0,0], roles:{ramp:0, draw:0, removal:0, wipe:0},
    unknown:[], over:[], offColor:[], illegal:[], dupes:[], gc:[], mld:[], turns:[], types:{}, aim:(d.aims || []).map(() => 0), price:0, priced:true};
  if (ctx.cmd && ctx.cmd.p != null) A.price += ctx.cmd.p;
  if (ctx.par && ctx.par.p != null) A.price += ctx.par.p;
  [ctx.cmd, ctx.par].forEach(c => { if (c && c.gc) A.gc.push(c.n); });
  for (const e of d.cards){
    A.size += e.q; const c = find(e.n); if (!c){ A.unknown.push(e.n); continue; }
    const tg = tags(c), pp = e.pp != null ? e.pp : c.p; if (pp != null) A.price += pp * e.q; else A.priced = false;   // the chosen printing's price when one is set
    const mt = mainType(c); A.types[mt] = (A.types[mt] || 0) + e.q;
    if (tg.land) A.lands += e.q;
    else { A.nonland += e.q; A.cmcSum += c.cmc * e.q; A.curve[Math.min(6, Math.floor(c.cmc))] += e.q;
      for (const r in A.roles) if (tg.roles.has(r)) A.roles[r] += e.q;
      (d.aims || []).forEach((a, i) => { if (matchAim(c, a, ctx.tribe)) A.aim[i] += e.q; }); }
    if (c.gc) A.gc.push(c.n); if (BTAGS.mld.has(c._n)) A.mld.push(c.n); if (BTAGS.turns.has(c._n)) A.turns.push(c.n);
    if (!isBasic(c.n)){
      if (c.p != null && c.p > ctx.cap) A.over.push(c.n);
      if (ctx.ident.length || ctx.cmd) { if (!c.ci.every(x => ctx.ident.includes(x))) A.offColor.push(c.n); }
      if (!legalIn(c, d.format)) A.illegal.push(c.n);
      if (e.q > copyLimit(d, c)) A.dupes.push(c.n);
    }
  }
  A.avg = A.nonland ? A.cmcSum / A.nonland : 0;
  // An aggro aim means fewer lands only when the spells are cheap; a deck of big creatures still needs its mana.
  if (d.format === 'commander' && (d.aims || [])[0] === 'aggro' && A.avg > 3.2) T.lands = 37;
  return A;
}

// ----- scoring & recommendations -----
// Tuning weights: how much what the commander's players actually run counts against theme-word matching.
let EDH_MISS = 3, W_INC = 10, W_SYN = 4, AIM_K = 1, STAPLE_K = 1, POP_K = 1;
const AIM_W = [5, 3.6, 2.6, 1.9, 1.4, 1];
const CORE = new Set(['sol ring','arcane signet','command tower']);
const TRIBE_SET = new Set(TRIBES);
function foreignTribe(c){
  if (c._ft !== undefined) return c._ft;
  const re = /(?<!non-)\b([A-Z][a-z]+?)(?:s|es)? (?:creatures? you control|creatures? get|spells?|you control|cards? in|on the battlefield|gain|creature spell)/g; let m, r = '';
  while ((m = re.exec(c.o || ''))){ const w = m[1] === 'Elv' ? 'Elf' : m[1]; if (TRIBE_SET.has(w)){ r = w; break; } }
  return c._ft = r;
}
// ----- build filters: creature types and keywords -----
// A filter is either a preference (matching cards score higher) or a rule. A creature-type rule applies to creature slots
// only; a keyword rule applies to theme slots only, so the deck still gets its lands, ramp, card draw and removal.
const KEYWORDS = {
  stun:{label:'Stun', re:/stun counter/i}, tap:{label:'Tap / freeze', re:/\btap (?:target|up to|all)|doesn.t untap/i}, flying:{label:'Flying', re:/\bflying\b/i},
  trample:{label:'Trample', re:/\btrample\b/i}, haste:{label:'Haste', re:/\bhaste\b/i}, deathtouch:{label:'Deathtouch', re:/\bdeathtouch\b/i}, lifelink:{label:'Lifelink', re:/\blifelink\b/i},
  vigilance:{label:'Vigilance', re:/\bvigilance\b/i}, menace:{label:'Menace', re:/\bmenace\b/i}, strike:{label:'First / double strike', re:/\b(?:first|double) strike\b/i},
  hexproof:{label:'Hexproof / ward', re:/\bhexproof\b|\bward\b/i}, indestructible:{label:'Indestructible', re:/\bindestructible\b/i}, flash:{label:'Flash', re:/\bflash\b/i},
  proliferate:{label:'Proliferate', re:/\bproliferate/i}, goad:{label:'Goad', re:/\bgoad/i}, mill:{label:'Mill', re:/\bmills?\b/i}, treasure:{label:'Treasure', re:/\bTreasure token/},
  food:{label:'Food', re:/\bFood token/}, clue:{label:'Clues / investigate', re:/\binvestigate|\bClue token/i}, scry:{label:'Scry / surveil', re:/\bscry \d|\bsurveil \d/i},
  bounce:{label:'Bounce', re:/return (?:target|up to|each|all)[^.]*to (?:its|their) owner(?:'|’)s? hands?/i}, exile:{label:'Exile effects', re:/\bexile (?:target|up to|each|all)/i},
  copy:{label:'Copy effects', re:/\bcopy (?:target|that|it|of)\b|create a token that.s a copy/i}, sneak:{label:'Ninjutsu / unblockable', re:/\bninjutsu\b|can.t be blocked/i}};
function creatureTypes(){
  if (creatureTypes.n === LIB.length && creatureTypes.v) return creatureTypes.v; const m = new Map();
  for (const c of LIB){ if (!/\bCreature\b/.test(c.t)) continue; c.t.split(' // ').forEach(f => { if (!/\bCreature\b/.test(f)) return; (f.split('—')[1] || '').trim().split(/\s+/).forEach(w => { if (/^[A-Z][A-Za-z'’-]+$/.test(w)) m.set(w, (m.get(w) || 0) + 1); }); }); }
  creatureTypes.n = LIB.length; return creatureTypes.v = [...m.entries()].filter(x => x[1] >= 2).map(x => x[0]).sort();
}
function hasCType(c, t){ if (!/\bCreature\b/.test(c.t)) return false; if (/\bChangeling\b/.test(c.o || '')) return true; return c.t.split(' // ').some(f => new RegExp('\\b' + t + '\\b').test(f.split('—')[1] || '')); }
function hasKey(c, k){ const K = KEYWORDS[k]; return !!K && K.re.test(c.o || ''); }
function mustOk(c, d){
  if (d.typesMust && d.types && d.types.length && /\bCreature\b/.test(frontType(c)) && !d.types.some(t => hasCType(c, t))) return false;
  if (d.keysMust && d.keys && d.keys.length && !tags(c).land){ const r = tags(c).roles; if (!['ramp', 'draw', 'removal', 'wipe'].some(j => r.has(j)) && !d.keys.some(k => hasKey(c, k))) return false; }
  return true;
}
let FILT_W = 6, FILT_MUST = 10;
function filtBonus(c, d){
  let s = 0; const why = [], wt = 4, wk = d.keysMust ? FILT_MUST : FILT_W;   // a type rule already narrows the creatures, so it needs no extra push
  (d.types || []).forEach(t => { if (hasCType(c, t)){ s += wt; why.push(t); } else if (new RegExp('\\b' + t + 's?\\b').test(c.o || '')) s += wt / 2; });
  (d.keys || []).forEach(k => { if (hasKey(c, k)){ s += wk; why.push(KEYWORDS[k].label); } });
  return {s, why};
}
function baseScore(c, d, ctx){
  let s = 0, hit = false, a0 = 0; const why = [];
  (d.aims || []).forEach((a, i) => { const m = matchAim(c, a, ctx.tribe); if (m){ s += AIM_K * (AIM_W[i] || 1) * m; if (m >= 0.7){ hit = true; why.push(a === 'tribal' ? ctx.tribe + ' synergy' : THEMES[a].label); } } });
  ctx.cmdThemes.forEach(a => { if (!(d.aims || []).includes(a) && matchAim(c, a, ctx.cmdTribe) >= 1){ s += 2; hit = true; why.push('Commander strategy'); } });
  if (ctx.edh){ const x = ctx.edh.map.get(c._n); if (x){ s += W_INC * x.inc + W_SYN * Math.max(0, x.syn); hit = true; why.unshift('In ' + Math.round(x.inc * 100) + '% of ' + ctx.cmd.n.split(',')[0] + ' decks'); }
    // When there is plenty of data for this commander, a card none of its players run needs a better reason to be here.
    else if (ctx.edh.map.size >= 100 && !(c.r && c.r < 400) && !CORE.has(c._n)) s -= EDH_MISS; }
  if ((d.types && d.types.length) || (d.keys && d.keys.length)){ const fb = filtBonus(c, d); if (fb.s){ s += fb.s; if (fb.why.length){ hit = true; fb.why.forEach(w => why.unshift(w)); } } }
  if (d.prevCmd && d.prevCmd === c.n){ s += 3; hit = true; why.unshift('Your previous commander'); }
  a0 = s;
  s += POP_K * (c.r ? 3 * (1 - Math.log(c.r + 1) / Math.log(40000)) : (c.src === 'starter' ? 1.6 : 0.8));   // no rank usually means a new card, not a bad one
  if (ctx.cap === Infinity) s += Math.min(2.5, Math.log10((c.p || 0) + 1) * 1.5);
  else if (ctx.cap > 3) s += Math.min(1, Math.log10((c.p || 0) + 1));
  c.ci.forEach(x => { if (!ctx.focus.includes(x)) s -= 1.5; });
  const ft = foreignTribe(c); if (ft && ft !== ctx.tribe && !(ctx.cmd && new RegExp('\\b' + ft + '\\b').test(ctx.cmd.t))){ s -= 5; hit = false; a0 = 0; }
  // Proven staples: the most-played cards anywhere (Rhystic Study, Teferi's Protection, Swords to Plowshares) earn their
  // slot in any deck, tapering off by about #400. The top ~250 count as a fit even when they touch no aim.
  if (CORE.has(c._n) || (c.r && c.r < 60)) s += 6 * STAPLE_K;
  else if (c.r && c.r < 400) s += STAPLE_K * 6 * Math.log(400 / c.r) / Math.log(400 / 60);
  if (!hit && (CORE.has(c._n) || (c.r && c.r < 250)) && !(ft && ft !== ctx.tribe)){ hit = true; why.push('Proven staple'); }
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
  // Below Bracket 4 mass land denial is never suggested, nor extra-turn cards in Bracket 1. Game Changers are suggested
  // only while the bracket has room (autoSwaps also lets one Game Changer replace another).
  const BR = null, gcGate = false; let gcLeft = Infinity;   // brackets are a label, not a limit
  const brOk = c => !BR || ((BR.mld || !BTAGS.mld.has(c._n)) && (BR.turns > 0 || !BTAGS.turns.has(c._n)));
  // A card keeps the tier it was first recommended in for this deck, even if its price has since risen past that tier's line.
  const lockOk = c => { const r = recommend.lock && recommend.lock[c._n]; return !!r && TIERS[r.t] && TIERS[r.t].cap <= ctx.cap; };
  const okCard = c => brOk(c) && mustOk(c, d) && legalIn(c, d.format) && c.ci.every(x => ctx.ident.includes(x)) && (ctx.cap === Infinity || (c.p != null && (c.p <= ctx.cap || lockOk(c)))) && (!recommend.minP || (c.p != null && c.p > recommend.minP)) && !(recommend.usedN && recommend.usedN.has(c._n)) && (!recommend.own || recommend.own.has(c._n)) && (!recommend.skip || !recommend.skip.has(c._n)) && !dismissed.has(c._n);

  // lands first
  let landNeed = Math.min(nAdd, Math.max(0, T.lands - A.lands));
  if (landNeed > 0){
    let nonbasic = 0; d.cards.forEach(e => { const c = find(e.n); if (c && tags(c).land && !isBasic(c.n)) nonbasic += e.q; });
    let room = std ? (ctx.ident.length > 1 ? 4 : 0) : Math.max(0, Math.min(12, 4 + ctx.ident.length * 3) - nonbasic);
    const pool = LIB.filter(c => tags(c).land && !isBasic(c.n) && okCard(c) && !have.has(c._n) && c.n !== d.commander && c.n !== d.partner)
      .map(c => ({c, b:baseScore(c, d, ctx)})).sort((x, y) => y.b.s - x.b.s);
    for (const p of pool){
      if (room <= 0 || landNeed <= 0) break;
      if (std && !/basic land card/.test(p.c.o)) continue;
      if (gcGate && p.c.gc){ if (gcLeft <= 0) continue; gcLeft--; }
      const q = std ? Math.min(4, room, landNeed) : 1;
      adds.push({n:p.c.n, q, kind:'land', why:[p.b.hit ? p.b.why[0] : 'Utility land'], s:p.b.s}); room -= q; landNeed -= q; nAdd -= q;
    }
    splitBasics(landNeed, ctx).forEach(b => { adds.push({n:b.n, q:b.q, kind:'land', why:['Reach ' + T.lands + ' lands'], s:99}); nAdd -= b.q; });
  }
  // spells
  if (nAdd > 0){
    const pool = LIB.filter(c => !tags(c).land && okCard(c) && !have.has(c._n) && c.n !== d.commander && c.n !== d.partner).map(c => ({c, b:baseScore(c, d, ctx), used:false}));
    if (recommend.raw) recommend.lastPool = pool;
    const bonus = c => { let b = 0, w = null; tags(c).roles.forEach(r => { if (def[r] > 0){ b += 2 + Math.min(2, def[r] / 3); w = w || r; } }); return [b, w]; };
    let guard = 0;
    while (nAdd > 0 && guard++ < 400){
      let best = null, bs = -1e9, bw = null, strict = true;
      for (let pass = 0; pass < 2 && !best; pass++){
        strict = pass === 0;
        for (const p of pool){ if (p.used || (gcGate && p.c.gc && gcLeft <= 0)) continue; const [b, w] = bonus(p.c); if (strict && !p.b.hit && b === 0) continue; const s = p.b.s + b; if (s > bs){ bs = s; best = p; bw = w; } }
      }
      if (!best) break; best.used = true; if (best.c.gc) gcLeft--;
      const q = std ? Math.min(nAdd, /Legendary/.test(best.c.t) ? 2 : 4) : 1;
      const why = best.b.why.slice(0, 2); if (bw) why.push('Fills ' + ROLE_LABEL[bw].toLowerCase() + ' gap'); if (!why.length) why.push('Solid staple');
      adds.push({n:best.c.n, q, kind:'spell', why, s:bs, a:best.b.a}); nAdd -= q; tags(best.c).roles.forEach(r => { if (r in def) def[r] -= q; });
    }
  }
  // cuts
  if (nCut > 0){
    const landExcess = A.lands - T.lands;
    if (landExcess > 2){ let k = Math.min(landExcess, nCut);
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
    // A deck set below its Game Changers' bracket must lose the extras: the weakest ones go first.
    let gcOver = BR ? ctx.gcIn - ctx.gcCap : 0;
    if (gcOver > 0) d.cards.forEach(e => { const c = find(e.n); if (c && c.gc && tags(c).land && !e.l) cand.push({n:e.n, q:e.q, why:[], s:baseScore(c, d, ctx).s, a:0}); });   // Gaea's Cradle and co.
    if (gcOver > 0) cand.filter(x => x.s > -40 && (find(x.n) || {}).gc).sort((a, b) => a.s - b.s).forEach(x => { if (gcOver > 0){ x.s = -60; x.why = ['Game Changer: Bracket ' + ctx.bracket + ' allows ' + ctx.gcCap]; gcOver -= x.q; } });
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
// A card that does a job (ramp, draw, removal, wipes, protection, counterspells, tutors) is replaced by one that does
// the same job, the way a hand-built upgrade list keeps each slot's purpose; only a much stronger card may take a
// job-holding slot without doing that job.
// Fixes the deck needs anyway (open slots, too many cards, missing lands, over-cap / off-color / illegal cards) are always included.
const JOBS = ['ramp', 'draw', 'removal', 'wipe', 'protect', 'counter', 'tutor'];
const JOB_LABEL = {ramp:'ramp', draw:'card draw', removal:'removal', wipe:'a board wipe', protect:'protection', counter:'a counterspell', tutor:'a tutor'};
function jobsOf(n){ const c = find(n); if (!c || tags(c).land) return []; const j = [...tags(c).roles].filter(r => JOBS.includes(r)), t = frontType(c); if (/\bEquipment\b/.test(t)) j.push('gear'); else if (/\bAura\b/.test(t)) j.push('aura'); else if (/\bVehicle\b/.test(t)) j.push('vehicle'); return j; }
function autoSwaps(d){
  const A0 = analyze(d), ctx = A0.ctx, open = A0.T.size - A0.size, landGap = Math.max(0, A0.T.lands - A0.lands), top = (d.aims || [])[0];
  const isId = n => { const c = find(n); return !!(top && c && matchAim(c, top, ctx.tribe) >= 0.7); };
  // Budget stays close to the theme. Mid and Apex may leave it more often, but only for a big step up (see ok() below).
  const loose = (d.tier || 'budget') !== 'budget';
  let outside = Math.max(2, Math.round((A0.aim[0] || 0) * (loose ? 0.3 : 0.1)));
  // Card-type balance: like-for-like swaps are preferred. A swap that changes type (a creature for an artifact, say)
  // needs a bigger improvement, and each type can lose only about a tenth of its cards that way (at least two).
  const typeOf = n => mainType(find(n)), lossRoom = {}; TYPE_ORDER.forEach(k => lossRoom[k] = Math.max(2, Math.round((A0.types[k] || 0) * (loose ? 0.2 : 0.1))));
  recommend.raw = true; let R; try { R = recommend(d, 45, false); } finally { recommend.raw = false; }
  const pairs = [], fills = [], drops = [];
  const adds = [], cuts = [], put = (list, x, q) => { const e = list.find(y => y.n === x.n); if (e) e.q += q; else list.push(Object.assign({}, x, {q})); };
  let fill = Math.max(0, open), trim = Math.max(0, -open), swaps = 0;
  const pool = R.cuts.map(c => Object.assign({}, c, {id:isId(c.n), ty:typeOf(c.n), jobs:jobsOf(c.n), r:(find(c.n) || {}).r || 0, gc:!!(find(c.n) || {}).gc, inc:ctx.edh ? ((ctx.edh.map.get(norm(c.n)) || {}).inc || 0) : 0}));
  // The candidate list is the best cards overall, which in a tribal deck is nearly all creatures. So that gear can be
  // upgraded with gear and removal with removal, the best few candidates for each job the weak cards do are added too.
  { const have = new Set(R.adds.map(x => norm(x.n))), sp = recommend.lastPool || [], jobs = new Set(); pool.slice(0, 20).forEach(c => c.jobs.forEach(j => jobs.add(j)));
    jobs.forEach(j => { sp.filter(p => !have.has(p.c._n) && p.b.s > 0 && jobsOf(p.c.n).includes(j)).sort((x, y) => y.b.s - x.b.s).slice(0, 3).forEach(p => { have.add(p.c._n); R.adds.push({n:p.c.n, q:1, kind:'spell', why:p.b.why.slice(0, 2), s:p.b.s, a:p.b.a}); }); }); recommend.lastPool = null; }
  let gcRoom = ctx.bracket ? ctx.gcCap - ctx.gcIn : Infinity;
  for (const c of pool){ if (trim <= 0) break; const q = Math.min(trim, c.q); put(cuts, c, q); put(drops, c, q); c.q -= q; trim -= q; if (c.gc) gcRoom += q; }
  let landSwaps = open > 0 ? 0 : landGap;
  // Two passes: first every add is offered the cuts that do the same job (removal for removal, draw for draw, gear for
  // gear); only then do the remaining adds take whatever is weakest. A deck with open slots skips the first pass.
  const needOf = new Map();
  for (const pass of (fill > 0 ? [2] : [1, 2])) for (const a of R.adds){
    let need = needOf.has(a) ? needOf.get(a) : a.q; if (need <= 0) continue; const aId = a.kind !== 'land' && isId(a.n), gap = a.why.some(w => /^Fills /.test(w)), aTy = typeOf(a.n), aJobs = jobsOf(a.n), aR = (find(a.n) || {}).r || 0, aGc = !!(find(a.n) || {}).gc;
    if (pass === 1 && (a.kind === 'land' || !aJobs.length)) continue;
    if (fill > 0){ const q = Math.min(fill, need); put(adds, a, q); put(fills, a, q); fill -= q; need -= q; }
    if (a.kind === 'land'){ if (landSwaps <= 0) continue; need = Math.min(need, landSwaps); }
    while (need > 0 && swaps < 40){
      let star = false;
      const ok = (c, cross) => { if (c.q <= 0) return false; if (aGc && gcRoom + (c.gc ? c.q : 0) <= 0) return false; if (c.s <= -40 && c.ty === 'Land' && a.kind !== 'land') return false; if (c.s <= -40 || a.kind === 'land') return !cross; if ((c.ty === aTy) === cross) return false;
        const lost = c.jobs.length && !c.jobs.some(j => aJobs.includes(j));
        // Being on-theme never excuses a weaker card: the add must hold up on its own merits too, and a widely played
        // card is not traded for one that hardly anyone runs.
        if (c.s > -40 && a.kind !== 'land' && (a.s - (a.a || 0)) < (c.s - (c.a || 0)) - 1) return false;
        if (c.s > -40 && c.r && c.r < 2500 && aR && aR > c.r * 8) return false;   // an unranked add is usually just new, so it isn't blocked
        const power = loose && c.s > -40 && a.kind !== 'land' && !lost && c.inc < 0.4 && (a.s - (a.a || 0)) - (c.s - (c.a || 0)) >= 5 && a.s >= c.s - 5;   // "a huge upgrade"
        if (!(a.s > c.s + (cross ? 2.5 : 1) + (lost ? 4 : 0)) && !power) return false; if (cross && !(lossRoom[c.ty] > 0)) return false;
        if (!c.id || aId) return true; return outside > 0 && (gap || a.s > c.s + 3 || power); };
      const sameJob = c => aJobs.length > 0 && c.jobs.some(j => aJobs.includes(j));
      // Take the cut that gains the most. Keeping the card type and the job are preferred by a margin, not absolutely.
      const pick = same => { let best = null, bv = -1e9; for (const c of pool){ if (same && !sameJob(c)) continue; const cross = c.ty !== aTy; if (!ok(c, cross && c.s > -40 && a.kind !== 'land')) continue; const v = (a.s - c.s) - (cross ? 2.5 : 0) + (sameJob(c) ? 2 : 0); if (v > bv + 1e-9){ bv = v; best = c; } } return best; };
      const c = pick(true) || (pass === 1 ? null : pick(false));
      if (!c) break; const q = Math.min(need, c.q);
      if (c.id && !aId && c.s > -40 && a.kind !== 'land'){ outside -= q; star = true; }
      const cross = c.ty !== aTy && a.kind !== 'land' && c.s > -40; if (cross) lossRoom[c.ty] -= q;
      if (aGc) gcRoom -= q; if (c.gc) gcRoom += q;
      const qGain = (a.s - (a.a || 0)) - (c.s - (c.a || 0)), strong = a.s - c.s < (cross ? 4 : 2.5) && qGain >= 5;   // accepted for raw strength, not fit
      pairs.push({cut:c.n, add:a.n, q, from:c.ty, to:aTy, cross, why:(star ? a.why.concat('Standout pick') : a.why).concat(strong ? ['Much stronger card'] : []), gain:strong ? Math.max(a.s - c.s, qGain * 0.7) : a.s - c.s, aq:a.s - (a.a || 0), land:a.kind === 'land', fix:c.s <= -40, cutWhy:c.why, gc:aGc, gcOut:c.gc});
      put(adds, star ? Object.assign({}, a, {why:a.why.concat('Standout pick')}) : a, q); put(cuts, c, q); c.q -= q; need -= q; swaps += q; if (a.kind === 'land') landSwaps -= q;
    }
    needOf.set(a, a.kind === 'land' ? 0 : need);
  }
  // A land that has to go (outside the colors, or a Game Changer past the bracket) makes way for a basic, so the land count holds.
  const basic = (splitBasics(1, ctx)[0] || {}).n;
  pool.forEach(c => { if (c.q > 0 && c.s <= -40 && c.ty === 'Land' && basic){ pairs.push({cut:c.n, add:basic, q:c.q, from:'Land', to:'Land', cross:false, why:['Basic land in its place'], gain:-c.s, aq:0, land:true, fix:true, cutWhy:c.why, gc:false, gcOut:c.gc});
    put(adds, {n:basic, kind:'land', why:['Basic land in its place'], s:0}, c.q); put(cuts, c, c.q); c.q = 0; } });
  pool.forEach(c => { if (c.q > 0 && c.s <= -40){ put(cuts, c, c.q); put(drops, c, c.q); if (c.gc) gcRoom += c.q; } });
  return {adds, cuts, A:R.A, swaps, pairs, fills, drops};
}
// "Here is my deck" -> every card's upgrade options at once, one per tier. Budget looks at cards up to $3, Mid at
// cards over $3 up to $12, Apex at cards over $12, so the three options for a card are genuinely different steps.
// Tiers are steps up in strength under a price ceiling (Budget $3, Mid $12, Apex none), not price bands: a $1 card can be
// the Mid pick if it clearly beats the Budget pick. A card already suggested at a cheaper tier is left out of the next.
// ----- upgrade picks built from what this commander's players run -----
// Candidates are the cards most played with the commander that the deck is missing, plus the best-fitting cards with no play
// data (new cards are not punished for being new). Each candidate and each card in the deck gets a value from play rate,
// commander synergy and fit with the build. A swap is scored on the whole deck: what comes in, minus what leaves, minus the
// hole it leaves in a job the deck is thin on, plus the gap it fills. The best pair is taken first, so every pick is the best
// in both directions among what is left. A swap that does not clearly improve the deck is not offered.
const SMART = {wi:10, ws:4, wf:0.4, wd:3, wk:1.5, T:8, m:2, fn:0.3, pool:300, extra:120, prior:0.15, fitMin:5};
function smartOK(d, ctx){ return d.format === 'commander' && !!ctx.edh && ctx.edh.map.size >= 60; }
function smartPaths(d, o){
  const dd = Object.assign({}, d, {tier:'apex'}), ctx = ctxOf(dd), K = SMART, unlock = [], rows = new Map(); o = o || {};
  const E = c => ctx.edh.map.get(c._n), isNew = c => !E(c) && !c.r;
  const fit = c => { if (c._sf !== undefined && c._sfk === smartPaths.k) return c._sf; const a = W_INC, b = W_SYN, p = POP_K; W_INC = 0; W_SYN = 0; POP_K = 0; let s; try { s = baseScore(c, dd, ctx).s; } finally { W_INC = a; W_SYN = b; POP_K = p; } if (isNew(c)) s += EDH_MISS; c._sf = s; c._sfk = smartPaths.k; return s; };
  smartPaths.k = (smartPaths.k || 0) + 1;
  const val = c => { const e = E(c); return K.wi * (e ? e.inc : isNew(c) ? K.prior : 0) + K.ws * (e ? e.syn : 0) + K.wf * fit(c); };
  const have = new Set(d.cards.map(x => norm(x.n))); have.add(norm(d.commander || '')); if (d.partner) have.add(norm(d.partner));
  const dis = new Set((d.dismissed || []).map(norm)), skip = o.skip || new Set(), own = o.own || null;
  const usable = c => c && !have.has(c._n) && !dis.has(c._n) && !tags(c).land && !isBasic(c.n) && legalIn(c, d.format) && c.ci.every(z => ctx.ident.includes(z)) && c.p != null && mustOk(c, d);
  const okNew = c => usable(c) && !skip.has(c._n) && !(own && own.has(c._n));
  const mk = c => ({c, jobs:jobsOf(c.n), v:val(c)});
  const seen = new Set(), C = [];
  [...ctx.edh.map.entries()].map(([k, v]) => ({c:IDX.get(k), inc:v.inc})).filter(x => okNew(x.c)).sort((a, b) => b.inc - a.inc).slice(0, K.pool).forEach(x => { seen.add(x.c._n); C.push(mk(x.c)); });
  if (K.extra) LIB.filter(c => !seen.has(c._n) && okNew(c)).map(c => ({c, f:fit(c)})).filter(x => x.f >= K.fitMin).sort((a, b) => b.f - a.f).slice(0, K.extra).forEach(x => C.push(mk(x.c)));
  const tierOf = c => c.p <= TIERS.budget.cap ? 'budget' : c.p <= TIERS.mid.cap ? 'mid' : 'apex';
  const noCut = o.noCut || new Set();
  const cuts = d.cards.map(e => ({e, c:find(e.n)})).filter(x => x.c && !tags(x.c).land && !x.e.l && !noCut.has(norm(x.e.n))).map(x => ({n:x.e.n, c:x.c, jobs:jobsOf(x.e.n), v:val(x.c)}));
  const cnt = {}; d.cards.forEach(e => jobsOf(e.n).forEach(j => cnt[j] = (cnt[j] || 0) + 1));
  const th = c => Object.keys(tags(c).th).filter(k => tags(c).th[k] === 1 && k !== 'aggro');
  const fn = (a, b) => 2 * th(a).filter(k => th(b).includes(k)).length + (mainType(a) === mainType(b) ? 1 : 0);
  const delta = (cut, add) => { let x = add.v - cut.v;
    cut.jobs.forEach(j => { if (!add.jobs.includes(j)) x -= K.wd * Math.max(0, (K.T - (cnt[j] - 1)) / K.T); });
    add.jobs.forEach(j => { if (!cut.jobs.includes(j)) x += K.wk * Math.max(0, (K.T - (cnt[j] || 0)) / K.T); });
    return x + K.fn * fn(add.c, cut.c); };
  // Play rate is evidence, not a gate: a card also qualifies on synergy, on fit with the build, or by being too new to have data.
  const ev = a => { const e = E(a.c); return (e && (e.inc >= 0.1 || e.syn >= 0.1)) || fit(a.c) >= K.fitMin || isNew(a.c); };
  const pair = (cu, a, v) => { const why = (isNew(a.c) ? ['New card · not enough play data yet'] : []).concat(baseScore(a.c, dd, ctx).why); const gap = a.jobs.find(j => !cu.jobs.includes(j) && (cnt[j] || 0) < K.T * 0.75); if (gap && why.length < 2 && JOB_LABEL[gap]) why.push('Adds ' + JOB_LABEL[gap]);
    return {cut:cu.n, add:a.c.n, q:1, gain:+v.toFixed(2), aq:+a.v.toFixed(2), why:why.slice(0, 2), cutWhy:[], gc:!!a.c.gc, gcOut:!!cu.c.gc, smart:true}; };
  const put = (cu, t, p) => { let r = rows.get(cu.n); if (!r){ r = {cut:cu.n, opts:{}, gain:0}; rows.set(cu.n, r); } r.opts[t] = p; r.gain = Math.max(r.gain, p.gain); };
  const held = new Map(); (o.locks || []).forEach(x => held.set(x.k, x));
  for (const t of ['apex', 'mid', 'budget']){
    const L = C.filter(x => !held.has(x.c._n) && tierOf(x.c) === t), uc = new Set(), ua = new Set(), M = [];
    cuts.forEach((cu, i) => L.forEach((a, k) => { const v = delta(cu, a); if (v >= K.m && ev(a)) M.push([v, i, k]); })); M.sort((a, b) => b[0] - a[0]);
    // Picks the player has already been shown hold their slot unless a clearly better card has turned up for it.
    (o.locks || []).filter(x => x.t === t).forEach(x => { const i = cuts.findIndex(cu => cu.n === x.pair.cut), c = find(x.pair.add); if (i < 0 || !usable(c)) return;
      const a = mk(c), now = delta(cuts[i], a), ch = M.find(m => m[1] === i);
      if (ch && ch[0] >= now + LOCK_MARGIN){ unlock.push(x.k); return; }
      uc.add(i); put(cuts[i], t, Object.assign(pair(cuts[i], a, now), {held:true})); });
    for (const [v, i, k] of M){ if (uc.has(i) || ua.has(k)) continue; uc.add(i); ua.add(k); put(cuts[i], t, pair(cuts[i], L[k], v)); }
  }
  return {rows, unlock};
}
const TIER_STEPS = [['budget', 0], ['mid', 0], ['apex', 0]];
const LOCK_MARGIN = 2;   // how much better a new card must be before it takes a slot from a pick the player has already been shown
function upgradePaths(d){
  const by = new Map(), used = new Set(), out = {fixes:[], drops:[], fills:0, count:{free:0, budget:0, mid:0, apex:0}, cost:{free:0, budget:0, mid:0, apex:0}, shift:{free:{}, budget:{}, mid:{}, apex:{}}};
  // Free swaps come first: cards the player already owns (their library). Paid tiers never suggest an owned card,
  // and must beat the free swap for the same slot to be shown at all.
  const usedN = new Set();
  const own = upgradePaths.own && upgradePaths.own.size ? upgradePaths.own : null, smart = smartOK(d, ctxOf(d)), steps = (own ? [['free', 0]] : []).concat(smart ? [['budget', 0]] : TIER_STEPS);
  out.smart = smart;
  recommend.paths = true; recommend.lock = d.recP || null;
  // Picks already shown for this deck hold their slot and tier: ordinary price drift must not reshuffle them. A held pick
  // gives way only to a clearly better card for the same slot, or when it stops being usable (swapped in, ruled out, owned, illegal).
  out.unlock = []; const locks = [];
  { const inDeck = new Set(d.cards.map(x => norm(x.n))), dis = new Set((d.dismissed || []).map(norm)), ident = ctxOf(d).ident;
    for (const k in (d.recP || {})){ const r = d.recP[k], p = r && r.pair, c = p && find(p.add); if (!p || !TIERS[r.t]) continue;
      if (!c || !inDeck.has(norm(p.cut)) || inDeck.has(k) || dis.has(k) || (own && own.has(k)) || !legalIn(c, d.format) || !c.ci.every(x => ident.includes(x))) continue;
      locks.push({k, t:r.t, pair:p}); usedN.add(k); } }
  try {
    steps.forEach(([t, minP]) => {
      recommend.minP = minP; recommend.usedN = usedN; recommend.own = t === 'free' ? own : null; recommend.skip = t !== 'free' ? own : null;
      const R = autoSwaps(Object.assign({}, d, {tier:t === 'free' ? 'apex' : t}));
      if (t === 'budget'){ out.A = R.A; out.drops = R.drops; out.fills = R.fills.reduce((s, a) => s + a.q, 0); }
      const take = (p, forced) => {
        if (used.has(p.add) && !isBasic(p.add)) return;   // a card is only ever suggested once
        if (p.land || p.fix){ if (t === 'budget'){ out.fixes.push(p); used.add(p.add); if (!isBasic(p.add)) usedN.add(norm(p.add)); } return; }
        if (smart && t !== 'free') return;   // the paid tiers come from smartPaths below
        let L = by.get(p.cut); if (!L){ L = {cut:p.cut, opts:{}, gain:0}; by.set(p.cut, L); }
        if (L.opts[t]) return;
        // Don't force an upgrade: it must clearly beat the card it replaces, and beat the cheaper tier's pick for the same card,
        // either as a better fit or, the way a pricier tier should, as a clearly stronger card (Rhystic Study over a budget
        // draw spell) that fits nearly as well.
        // A paid pick that an owned card already beats is still shown (marked), so the player can force it if the library is wrong;
        // it is left out of the tier totals and the buy list.
        const lower = Object.keys(L.opts).filter(k => k !== 'free' && !L.opts[k].beaten).map(k => L.opts[k]);
        const prev = Math.max(0, ...lower.map(o => o.gain)), prevQ = Math.max(-1e9, ...lower.map(o => o.aq));
        if (!forced && (p.gain < (p.cross ? 4 : 2.5) || (p.gain < prev + 1 && !(p.gain >= prev - 1.5 && p.aq >= prevQ + 2)))) return;
        if (t !== 'free' && L.opts.free && p.gain < L.opts.free.gain + 1){ L.opts[t] = Object.assign({}, p, {beaten:true}); used.add(p.add); if (!isBasic(p.add)) usedN.add(norm(p.add)); return; }
        L.opts[t] = p; used.add(p.add); if (!isBasic(p.add)) usedN.add(norm(p.add));
        if (p.cross){ out.shift[t][p.from] = (out.shift[t][p.from] || 0) - p.q; out.shift[t][p.to] = (out.shift[t][p.to] || 0) + p.q; } L.gain = Math.max(L.gain, p.gain); out.count[t] += p.q;
        const a = find(p.add), c = find(p.cut); out.cost[t] += ((a && a.p || 0) - (c && c.p || 0)) * p.q;
      };
      if (!smart) locks.filter(x => x.t === t).forEach(x => { const ch = R.pairs.find(p => !p.land && !p.fix && p.cut === x.pair.cut);
        if (ch && ch.add !== x.pair.add && ch.gain >= x.pair.gain + LOCK_MARGIN){ out.unlock.push(x.k); return; }
        take(x.pair, true); });
      R.pairs.forEach(p => take(p));
    });
    if (smart){
      const lk = new Set(locks.map(x => x.k)), skip = new Set([...usedN].filter(k => !lk.has(k))), noCut = new Set(out.fixes.map(p => norm(p.cut)).concat((out.drops || []).map(x => norm(x.n))));
      const S2 = smartPaths(d, {skip, own, locks, noCut}); out.unlock = S2.unlock;
      for (const [cut, r] of S2.rows){ let L = by.get(cut); if (!L){ L = {cut, opts:{}, gain:0}; by.set(cut, L); }
        TIER_STEPS.forEach(([t]) => { const p = r.opts[t]; if (!p) return;
          if (L.opts.free && p.gain < L.opts.free.gain + 1){ L.opts[t] = Object.assign({}, p, {beaten:true}); return; }
          L.opts[t] = p; L.gain = Math.max(L.gain, p.gain); out.count[t] += p.q; const a = find(p.add), c = find(p.cut); out.cost[t] += ((a && a.p || 0) - (c && c.p || 0)) * p.q; }); }
    }
  } finally { recommend.paths = false; recommend.minP = 0; recommend.usedN = null; recommend.lock = null; recommend.own = null; recommend.skip = null; }
  for (const [k, L] of by) if (!Object.keys(L.opts).length) by.delete(k);
  // singleton / copy-limit breaches are fixes too
  const dupDrops = []; d.cards.forEach(en => { const c = find(en.n), lim = copyLimit(d, c); if (c && en.q > lim) dupDrops.push({n:en.n, q:en.q - lim, s:-95, why:[d.format === 'commander' ? 'Commander allows one copy' : 'More than four copies']}); });
  if (dupDrops.length){ // removing the extra copies comes first; only trim other cards if the deck is still over size after that
    let spare = dupDrops.reduce((s, x) => s + x.q, 0); const dupNames = new Set(dupDrops.map(x => x.n)), rest = [];
    out.drops.forEach(x => { if (dupNames.has(x.n)) return; if (x.s > -40 && spare > 0){ const q = Math.min(spare, x.q); spare -= q; if (x.q - q > 0) rest.push(Object.assign({}, x, {q:x.q - q})); } else rest.push(x); });
    out.drops = dupDrops.concat(rest);
  }
  { const cx = ctxOf(d); out.bracket = cx.bracket; out.gcIn = cx.gcIn; out.mldIn = cx.mldIn; out.gcCap = cx.gcCap; }
  out.paths = [...by.values()].sort((a, b) => (b.opts.free ? 1 : 0) - (a.opts.free ? 1 : 0) || b.gain - a.gain);
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
// Player tip for a card being added by hand: how well does it fit this deck, and why?
function evalFit(d, c){
  const A = analyze(d), ctx = A.ctx, T = A.T, tg = tags(c), b = baseScore(c, d, ctx), pros = [], cons = [], cmdName = ctx.cmd ? ctx.cmd.n.split(',')[0] : '';
  let pts = 0;
  if (!legalIn(c, d.format)) return {level:'bad', title:'Not legal here', pros, cons:[c.n + ' is not legal in ' + (d.format === 'commander' ? 'Commander' : 'Standard') + ', so the deck could not be played with it.']};
  if (tg.land){
    if (A.lands < T.lands){ pts += 2; pros.push('The deck has ' + A.lands + ' lands and wants about ' + T.lands + ', so another land helps.'); }
    else cons.push('The deck already has ' + A.lands + ' lands (target ' + T.lands + '), so it should replace one of them rather than a spell.');
    if (!isBasic(c.n)){ if (c.r && c.r < 1500){ pts += 2; pros.push('A widely played land.'); } else pts += 1; }
    if (/enters (the battlefield )?tapped/i.test(c.o || '')) cons.push('It enters tapped, which slows you down a turn.');
  } else {
    const aims = [];
    (d.aims || []).forEach(a => { if (matchAim(c, a, ctx.tribe) >= 0.7) aims.push(a === 'tribal' ? ctx.tribe + ' tribal' : THEMES[a].label); });
    const ft = foreignTribe(c), wrongTribe = ft && ft !== ctx.tribe && !(ctx.cmd && new RegExp('\\b' + ft + '\\b').test(ctx.cmd.t));
    if (wrongTribe){ pts -= 3; cons.push('It rewards ' + ft + ' cards' + (ctx.tribe ? ', and this is a ' + ctx.tribe + ' deck' : ', which this deck is not built around') + ', so most of its text would do nothing.'); }
    else if (aims.length){ pts += 2; pros.push('Supports what the deck is built to do: ' + aims.slice(0, 3).join(', ') + '.'); }
    else if (ctx.cmdThemes.some(a => matchAim(c, a, ctx.cmdTribe) >= 1)){ pts += 2; pros.push('Works with ' + cmdName + '’s own strategy.'); }
    else if ((d.aims || []).length || ctx.cmdThemes.length) { pts -= 1; cons.push('It doesn’t feed the deck’s main plan' + ((d.aims || []).length ? ' (' + (d.aims[0] === 'tribal' ? ctx.tribe + ' tribal' : THEMES[d.aims[0]].label) + ')' : '') + '.'); }
    if (ctx.edh){ const x = ctx.edh.map.get(c._n);
      if (x){ const pc = Math.round(x.inc * 100); if (x.inc >= 0.25){ pts += 2; pros.push('Played in ' + pc + '% of ' + cmdName + ' decks.'); } else { pts += 1; pros.push('Shows up in ' + Math.max(1, pc) + '% of ' + cmdName + ' decks' + (x.syn > 0.1 ? ', far more than in other decks' : '') + '.'); } }
      else if (ctx.edh.map.size > 80){ pts -= 1; cons.push(cmdName + ' players rarely run it.'); } }
    const RN = {ramp:'mana ramp', draw:'card draw', removal:'removal', wipe:'board wipes'}; let filled = false;
    for (const r in RN) if (tg.roles.has(r)){
      if (A.roles[r] < T[r]){ if (!filled) pts += 2; filled = true; pros.push('The deck is short on ' + RN[r] + ' (' + A.roles[r] + ' of about ' + T[r] + ') and this adds one.'); }
      else pros.push('Adds ' + RN[r] + '; the deck already has enough (' + A.roles[r] + ').'); }
    if (CORE.has(c._n) || (c.r && c.r < 300)){ pts += 1; pros.push('A staple that is good in almost any deck.'); }
    if (ctx.bracket && c.gc){ const nb = bracketOf(ctx.gcIn + 1, ctx.mldIn);
      cons.push(nb > ctx.bracket ? 'A Game Changer. Adding it moves the deck from Bracket ' + ctx.bracket + ' to Bracket ' + nb + '.' : 'A Game Changer: it would be number ' + (ctx.gcIn + 1) + (ctx.bracket === 3 ? ' of the 3 that Bracket 3 allows.' : ' in the deck.')); }
    if (ctx.bracket && ctx.bracket < 4 && BTAGS.mld.has(c._n)) cons.push('Mass land denial. Adding it moves the deck from Bracket ' + ctx.bracket + ' to Bracket 4.');
    const big = A.curve[5] + A.curve[6], bigMax = Math.round(A.nonland * 0.18);
    if (c.cmc >= 5 && A.nonland >= 20 && big >= bigMax){ pts -= 1; cons.push('The deck already has ' + big + ' cards costing 5 or more; another expensive card makes slow hands more likely.'); }
    else if (c.cmc <= 2 && A.avg > 3.4) pros.push('Cheap to cast, which helps a deck whose average cost is ' + A.avg.toFixed(1) + '.');
    const offF = c.ci.filter(x => !ctx.focus.includes(x) && ctx.ident.includes(x));
    if (offF.length) cons.push('It needs ' + offF.map(k => ({W:'white', U:'blue', B:'black', R:'red', G:'green'})[k]).join(' and ') + ' mana, which is not one of your focus colors.');
    const sc = []; d.cards.forEach(en => { const x = find(en.n); if (x && !tags(x).land) sc.push(baseScore(x, d, ctx).s); });
    if (sc.length >= 10){ const below = sc.filter(v => v < b.s).length, pc = below / sc.length;
      if (pc >= 0.6){ pts += 1; pros.push('By my scoring it beats ' + below + ' of the ' + sc.length + ' spells already in the deck.'); }
      else if (pc <= 0.15){ pts -= 1; cons.push('By my scoring it ranks below nearly every spell already in the deck.'); } }
  }
  const level = pts >= 4 ? 'great' : pts >= 2 ? 'good' : pts >= -1 ? 'ok' : 'poor';
  if (!pros.length && !cons.length) cons.push('Nothing in its text connects to the deck’s plan, but nothing clashes with it.');
  return {level, title:{great:'Great fit', good:'Good fit', ok:'Playable, not a natural fit', poor:'Poor fit'}[level], pros, cons};
}
// Two commanders: which cards may share the command zone. Covers Partner, "Partner with", named partner variants
// (both cards must have the same one), Friends forever, Choose a Background and Doctor's companion.
function pairKind(c){
  if (!c) return ''; if (c._pk !== undefined) return c._pk; const o = c.o || '', t = c.t || ''; let m, k = '';
  if ((m = /(^|\n)Partner with ([^\n(]+?)\s*(\(|\n|$)/.exec(o))) k = 'with:' + norm(m[2]);
  else if ((m = /(^|\n)Partner\s*[—–-]\s*([^\n(]+?)\s*(\(|\n|$)/.exec(o))) k = 'var:' + m[2].trim().toLowerCase();
  else if (/(^|\n)Partner\b/.test(o)) k = 'partner';
  else if (/(^|\n)Friends forever/i.test(o)) k = 'friends';
  else if (/Choose a Background/i.test(o)) k = 'bg';
  else if (/Doctor’s companion|Doctor's companion/i.test(o)) k = 'companion';
  else if (/Legendary/.test(t) && /\bBackground\b/.test(t)) k = 'isbg';
  else if (/Time Lord Doctor/.test(t)) k = 'doctor';
  return c._pk = k;
}
function pairLabel(c){ const k = pairKind(c); return k === 'partner' ? 'Partner' : k.startsWith('var:') ? 'Partner—' + k.slice(4).replace(/^./, x => x.toUpperCase()) : k.startsWith('with:') ? 'Partner with' : k === 'friends' ? 'Friends forever' : k === 'bg' || k === 'isbg' ? 'Choose a Background' : k ? 'Doctor’s companion' : ''; }
function canPair(a, b){
  const x = pairKind(a), y = pairKind(b); if (!x || !y || a.n === b.n) return false;
  if (x.startsWith('with:') || y.startsWith('with:')) return x === 'with:' + b._n || y === 'with:' + a._n;
  if (x === 'bg' || y === 'bg') return x === 'isbg' || y === 'isbg';
  if (x === 'companion' || y === 'companion') return x === 'doctor' || y === 'doctor';
  if (x === 'isbg' || x === 'doctor' || y === 'isbg' || y === 'doctor') return false;
  return x === y;
}
// Make a card the deck's second commander if the rules allow the pairing; otherwise it stays an ordinary card.
function setPartner(d, name){
  const c = find(name), cmd = find(d.commander);
  if (!c || !cmd || !canPair(cmd, c)){ if (name && norm(name) !== norm(d.commander || '')) addCard(d, c ? c.n : name, 1); return false; }
  d.partner = c.n; cutCard(d, c.n, 99); const st = detectStrategy(c, d); if (!d.aimLocked){ st.themes.forEach(a => { if (d.aims.length < 3 && !d.aims.includes(a)) d.aims.push(a); }); if (!d.tribe) d.tribe = st.tribe || ''; d.colors = ctxOf(d).ident.slice(); }
  return true;
}
function canLead(c){ return !!(c && c.cmd && /Legendary/.test(c.t) && /Creature/.test(frontType(c))); }
// Commander pairs that together cover a set of colors, ranked by fit.
function findPairs(d, colors, k){
  const ctx = ctxOf(d), X = LIB.filter(c => c.cmd && pairKind(c)).map(c => ({c, s:baseScore(c, d, Object.assign({}, ctx, {focus:c.ci, ident:c.ci, edh:null})).s})), out = [];
  for (let i = 0; i < X.length; i++) for (let j = i + 1; j < X.length; j++){
    const a = X[i], b = X[j]; if (!canPair(a.c, b.c) || (!canLead(a.c) && !canLead(b.c))) continue;
    const ci = 'WUBRG'.split('').filter(z => a.c.ci.includes(z) || b.c.ci.includes(z)); if (!colors.every(z => ci.includes(z))) continue;
    const lead = canLead(a.c) && (a.s >= b.s || !canLead(b.c)) ? a : b, other = lead === a ? b : a;
    out.push({n:lead.c.n, p:other.c.n, ci, s:a.s + b.s - 1.2 * (ci.length - colors.length)});
  }
  return out.sort((x, y) => y.s - x.s).slice(0, k || 4);
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
// Mana balance: split the deck's basic lands in proportion to the colored mana symbols its spells actually need.
// One blue card means a couple of Islands, not a third of the land base.
function manaPlan(d){
  const ctx = ctxOf(d), pips = {W:0, U:0, B:0, R:0, G:0}, have = {W:0, U:0, B:0, R:0, G:0}; let basics = 0;
  const count = (c, w) => (c.m.match(/\{[^}]+\}/g) || []).forEach(s => { for (const k of 'WUBRG') if (s.includes(k)) pips[k] += w; });
  d.cards.forEach(e => { const c = find(e.n); if (!c) return; if (tags(c).land){ if (BASICS[c.n]){ have[BASICS[c.n]] += e.q; basics += e.q; } return; } count(c, e.q); });
  const spell = Object.assign({}, pips);   // what the 99 need, before the commander's own cost is weighed in
  if (ctx.cmd) count(ctx.cmd, 2); if (ctx.par) count(ctx.par, 2);
  const cols = 'WUBRG'.split('').filter(k => pips[k] > 0 && (d.format !== 'commander' || !ctx.cmd || ctx.ident.includes(k))), tot = cols.reduce((s, k) => s + pips[k], 0), want = {W:0, U:0, B:0, R:0, G:0};
  if (basics && tot){
    const min = basics >= 20 && cols.length <= 4 ? 2 : 1, f = cols.map(k => basics * pips[k] / tot); cols.forEach((k, i) => want[k] = Math.max(min, Math.floor(f[i])));
    let left = basics - cols.reduce((s, k) => s + want[k], 0);
    cols.map((k, i) => [f[i] - Math.floor(f[i]), k]).sort((a, b) => b[0] - a[0]).forEach(([, k]) => { if (left > 0){ want[k]++; left--; } });
    while (left > 0){ const k = cols.slice().sort((a, b) => pips[b] - pips[a])[0]; want[k]++; left--; }
    while (left < 0){ const k = cols.filter(x => want[x] > min).sort((a, b) => want[b] - want[a])[0]; if (!k) break; want[k]--; left++; }
  }
  const changes = basics && tot ? 'WUBRG'.split('').filter(k => want[k] !== have[k]).map(k => ({n:COLOR_BASIC[k], k, delta:want[k] - have[k]})) : [];
  return {pips, spell, have, want, basics, changes, off:changes.reduce((s, x) => s + Math.max(0, x.delta), 0)};
}
function applyMana(d, plan){ plan.changes.forEach(x => { if (x.delta > 0) addCard(d, x.n, x.delta); else cutCard(d, x.n, -x.delta); }); }
function addCard(d, n, q){ const k = norm(n), e = d.cards.find(x => norm(x.n) === k); if (d.dismissed && d.dismissed.length) d.dismissed = d.dismissed.filter(x => norm(x) !== k); if (e) e.q += q; else d.cards.push({n, q, l:false}); }
function cutCard(d, n, q){ const k = norm(n), i = d.cards.findIndex(x => norm(x.n) === k); if (i < 0) return; d.cards[i].q -= q; if (d.cards[i].q <= 0) d.cards.splice(i, 1); }
// A generated deck starts as a plan, not a decklist. The plan is the strongest (Apex) build, one slot per card; each
// expensive slot also gets a Mid (up to $12) and Budget (up to $3) stand-in that does the same job. Nothing is in the
// deck until the player installs it. Owned cards are marked so they cost nothing.
function buildPlan(d, seeds, ownOnly, ownAll){
  const tmp = JSON.parse(JSON.stringify(d)); tmp.tier = 'apex'; tmp.cards = []; delete tmp.plan;
  const cmd = find(d.commander), id0 = ctxOf(d).ident, okC = c => !cmd || c.ci.every(k => id0.includes(k));
  (seeds || []).forEach(c => { if (c.n !== d.commander && c.n !== d.partner && okC(c)) addCard(tmp, c.n, 1); });
  const seedSet = new Set(tmp.cards.map(x => norm(x.n)));
  if (ownOnly && ownOnly.size){ recommend.own = ownOnly; try { recommend(tmp, 0, true).adds.forEach(a => { if (!isBasic(a.n)) addCard(tmp, a.n, a.q); }); } finally { recommend.own = null; } }
  fillDeck(tmp);
  const ctx = ctxOf(tmp), used = new Set(tmp.cards.map(x => norm(x.n))); used.add(norm(d.commander)); if (d.partner) used.add(norm(d.partner));
  const pool = LIB.filter(c => c.p != null && c.p <= 12 && legalIn(c, d.format) && c.ci.every(x => ctx.ident.includes(x)) && !used.has(c._n) && !isBasic(c.n) && mustOk(c, d))
    .map(c => ({c, s:baseScore(c, tmp, ctx).s, land:tags(c).land, ty:mainType(c)}));
  const alt = (x, cap) => { const tx = tags(x), ty = mainType(x); let best = null, bs = -1e9;
    for (const p of pool){ if (p.used || p.c.p > cap || p.land !== tx.land) continue; let s = p.s + (p.ty === ty ? 3 : 0), share = 0; tags(p.c).roles.forEach(r => { if (tx.roles.has(r)) share++; }); s += share * 2; if (tx.roles.size && !share) s -= 3; if (s > bs){ bs = s; best = p; } }
    if (best) best.used = true; return best ? best.c.n : null; };
  const basic = (splitBasics(1, ctx)[0] || {}).n || null, own = ownAll || new Set();
  return tmp.cards.map((en, i) => {
    const c = find(en.n), S0 = {id:i + 1, a:en.n, q:en.q}; if (!c) return S0;
    if (isBasic(c.n)){ S0.basic = true; S0.land = true; return S0; }
    if (tags(c).land) S0.land = true;
    if (seedSet.has(c._n)){ S0.seed = true; if (own.has(c._n)) S0.own = true; return S0; }
    if (own.has(c._n)){ S0.own = true; return S0; }
    if (c.p == null || c.p <= 3) return S0;
    if (c.p > 12){ const m = alt(c, 12), mc = m && find(m); if (mc && mc.p <= 3) S0.b = m; else { if (m) S0.m = m; S0.b = alt(c, 3); } }
    else S0.b = alt(c, 3);
    if (!S0.b && S0.land && basic) S0.b = basic;
    if (!S0.b) delete S0.b; return S0;
  });
}
function planPick(s, t){ return t === 'apex' ? s.a : t === 'mid' ? (s.m || s.a) : (s.b || s.m || s.a); }
function fillDeck(d){ const r = recommend(d, 0, true); r.adds.forEach(a => addCard(d, a.n, a.q)); return r.adds.reduce((s, a) => s + a.q, 0); }
function setCommander(d, name){
  const c = find(name); d.commander = c ? c.n : name; cutCard(d, d.commander, 99);
  if (d.partner){ const p = find(d.partner); if (!p || !c || !canPair(c, p)) delete d.partner; }
  if (c && !d.aimLocked){ const st = detectStrategy(c, d); d.tribe = st.tribe || d.tribe || ''; if (!d.aims.length) d.aims = st.themes.slice(0, 3); d.colors = c.ci.slice(); }
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


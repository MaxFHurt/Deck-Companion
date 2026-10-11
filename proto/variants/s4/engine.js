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
  ramp: new RegExp('\\{T\\}[^.]{0,40}: Add |: Add \\{|adds? (an additional|one additional|\\{)|add (one|two|three|x) mana|search your library for [^.]*' + LAND_WORDS + ' cards?[^.]*onto the battlefield|land card from your hand onto the battlefield|(?<!controller )creates? [^.]*treasure token|additional land on each|play (an|one|two|three|x) additional lands?|untap target (forest|land)|produces? (twice|three times) as much|(lands?|permanents?) for mana, (add|it produces)', 'i'),
  // one card or a few: destroy, exile, bounce, shrink, fight, bite, edict, lock down, turn into something harmless
  removal: /(destroy|exile) (up to (one|two|three|x) )?(other |another )?target (?!player|card|instant|sorcery|spell|non-|creature you control|creature card|artifacts, creatures|land\b)[^.]*(creature|permanent|artifact|enchantment|planeswalker|battle)|deals? (\d+|x|that much|twice that much) damage to (any target|(up to (one|two|three) )?(other |another )?target (attacking |blocking |tapped )?(creature|permanent|planeswalker))|damage equal to (its|their|that creature's|x|the number)[^.]{0,40} to (any target|(up to one |another |each of up to \w+ )?target (creature|permanent|planeswalker))|deals damage equal to its power to (any target|(another |up to one )?target|each of)|target creature gets -(\d+|x)|gets? -(\d+|x)\/-(\d+|x) until|return (up to (one|two) )?(another )?target (spell or )?(nonland permanent|creature|permanent)[^.]*to its owner's hand|fights? (up to one |another |a different |target )|owner of target permanent shuffles|exile that creature|target (player|opponent) sacrifices (a|an|two) (creature|permanent|nonland)|each (other )?(opponent|player) sacrifices (a|an|two|three|that many) (nontoken )?(creatures?|permanents?|nonland)|put (a|an|two|three|x) -1\/-1 counters? on (up to one )?target creature(?! you control)|enchanted (creature|permanent)[^.]* loses all other (abilities|card types)|enchanted (creature|permanent) is a colorless (land|forest)|put target (creature|nonland permanent|permanent)[^.]*(top|bottom) of its owner's library|enchanted (creature|permanent) (can't attack or block|can't attack, block|loses all abilities|doesn't untap)|target creature[^.]*loses all abilities|gain control of target (creature|permanent|artifact)/i,
  wipe: /(destroy|exile) (all|each) (?!lands)(creatures?|nontoken|nonland|artifacts?|enchantments?|permanents?|other|non)|deals? (\d+|x|that much) damage to each (creature|other creature|non|attacking|blocking)|damage to each creature|(all|each) (other )?creatures? gets? -|creatures your opponents control get -(\d+|x)\/-|destroy all artifacts, creatures|return (all|each) (nonland|attacking|creature|other)[^.]*to (its|their) owner(s|'s|s')? hands?|(destroy|exile) (all|each) (?!lands?\b)([\w-]+ ){1,3}?(creatures|permanents|artifacts|enchantments)\b|put (x|a|an|two|three) -1\/-1 counters? on each creature|damage to each opponent and each creature|then sacrifices the rest|each player sacrifices (all|\w+ creatures)|sacrifices? all (creatures|permanents|nonland)|damage divided as you choose among any number of target creatures|each of those[^.]*fights a different|(destroy|exile|damage|return|gets -)[^]*\boverload\b/i,
  counter: /counter (up to one |another )?target|counter (that|the) (spell|ability)(?! unless (that player|its controller) pays)/i,   // ward's reminder text is not a counterspell
  tutor: /search your library (and\/or graveyard )?for (a|an|up to (one|two|three|four|x)|two|three|four|x) (?!basic|land|plains|island|swamp|mountain|forest|gate)[^.]*cards?/i,
  // protects what you control (grants, fogs, blinks, phasing); a creature that is merely hard to kill itself does not count
  protect: /(creatures?|permanents?|artifacts?) you control[^.]{0,45}(gain|gains|have|has)[^.]{0,35}(hexproof|indestructible|protection from|shroud|ward)|(target|another target|equipped|enchanted|each|that) (creature|permanent|artifact)[^.]{0,60}(gains?|has|have)[^.]{0,40}(hexproof|indestructible|protection from|shroud|ward)|you (gain|have) (hexproof|protection from|shroud)|phases? out|prevent all (combat )?damage|(totem|umbra) armor|regenerate (target|each|enchanted|equipped)|can't be the targets? of spells or abilities your opponents control|gains? "when this creature dies, return it to the battlefield|when enchanted (creature|permanent) dies or is put into exile, return|change (a|the) target of target (spell|instant)|(those|target) creatures? (you control )?gains? (indestructible|hexproof)|exile (two |any number of )?target [^.]*you control, then return/i,
  blink: /exile (up to one |another |any number of )?target (creature|permanent|nonland permanent)s? you control[^.]*(then )?return/i
};

let LIB = [], IDX = new Map();
// What players actually run with one commander (from EDHREC): key = commander name, map = card name -> {inc, syn}.
let EDH = {key:'', map:null, decks:0, state:'', pre:null, tags:[], tmap:{}};
// EDHREC's page for the precon a commander leads: its decklist, the cards its owners cut most (in order) and the cards they
// add (share of the decks built from it). Plain arrays, so the loader can cache it. Used only for decks that still hold
// most of that precon.
// A commander's own mechanics, as players build them (EDHREC theme tags, most-built first), and the play data inside one theme.
// A theme aim is stored as 'edh:<slug>' in d.aims; EDH.tags lists the commander's themes, EDH.tmap[slug] the theme's cards.
function parseLands(j){ const p = (((j && j.panels) || {}).piechart || {}).content || [], L = p.find(x => x.label === 'Land'); return L ? +L.value : 0; }
function parseTags(j){ return (((j && j.panels) || {}).taglinks || []).filter(t => t && t.slug && t.value).map(t => ({slug:t.slug, label:t.value, count:t.count || 0})); }
function parseTheme(j){ const m = new Map(); (((j && j.container && j.container.json_dict) || {}).cardlists || []).forEach(L => (L.cardviews || []).forEach(v => { if (!v.name || !v.potential_decks) return;
  const inc = Math.min(1, v.num_decks / v.potential_decks), k = norm(v.name), o = m.get(k); if (!o || inc > o.inc) m.set(k, {inc, syn:+(v.synergy || 0)}); })); return m; }
const isEdhAim = a => typeof a === 'string' && a.startsWith('edh:');
function aimLabel(a, tribe){ if (isEdhAim(a)){ const t = (EDH.tags || []).find(x => 'edh:' + x.slug === a); return t ? t.label : a.slice(4).replace(/-/g, ' '); } return a === 'tribal' ? (tribe || 'Creature type') + ' tribal' : (THEMES[a] || {label:a}).label; }
// "Heroes: in 84% of Heroes decks" — the share of the commander's decks built around that theme that run the card.
function themeWhy(a, c){ const m = EDH.tmap && EDH.tmap[a.slice(4)], x = m && edhOf(m, c), L = aimLabel(a); return x ? L + ': in ' + Math.round(x.inc * 100) + '% of ' + L + ' decks' : L; }
function parsePrecon(j){
  const jd = (j && j.container && j.container.json_dict) || {}, dk = (j && j.deck) || {}, L = t => ((jd.cardlists || []).find(x => x.tag === t) || {}).cardviews || [];
  const list = []; Object.values(dk.cards || {}).forEach(a => (a || []).forEach(t => { if (t && t[0]) list.push(t[0]); }));
  return {name:dk.name || (jd.card && jd.card.precon) || '', decks:(jd.card && jd.card.num_decks) || 0, list,
    cut:L('cardstocut').map(v => v.name).filter(Boolean), lcut:L('landstocut').map(v => v.name).filter(Boolean),
    add:L('cardstoadd').concat(L('landstoadd')).filter(v => v.name && v.potential_decks).map(v => [v.name, Math.min(1, v.num_decks / v.potential_decks), +(v.synergy || 0)])};
}
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
// ----- card identity -----
// Every comparison between cards uses one identity: the Scryfall Oracle ID (c._k). Display names stay as the player or the
// source wrote them. The name index resolves, in order: the exact card name; a face of a double-faced or split card (only
// if no real card has that name); then an alternate printed name (ALT_NAMES in lists.js, e.g. "Vibranium Dynamo" is Thran
// Dynamo). A printed name that is also a different real card's name is ambiguous and is never used (listed in ALT_CLASH).
let ALT_CLASH = [];
function buildIndex(cards){
  LIB = cards; IDX = new Map(); ALT_CLASH = [];
  for (const c of cards){ c._n = norm(c.n); c._k = c.oid || ('n:' + c._n); if (!IDX.has(c._n)) IDX.set(c._n, c); }
  for (const c of cards) if (c.n.includes(' // ')) c.n.split(' // ').forEach(f => { const k = norm(f); if (!IDX.has(k)) IDX.set(k, c); });
  if (typeof ALT_NAMES !== 'undefined') for (const a in ALT_NAMES){ const k = norm(a), real = IDX.get(norm(ALT_NAMES[a])); if (!real) continue;
    if (IDX.has(k)){ if (IDX.get(k) !== real) ALT_CLASH.push(a); continue; } IDX.set(k, real); }
}
function mergeLibrary(starter, full){
  const seen = new Set(full.map(c => norm(c.n)));
  return full.concat(starter.filter(c => !seen.has(norm(c.n))));
}
function find(name){ if (!name) return null; return IDX.get(norm(name)) || IDX.get(norm(String(name).split(' // ')[0])) || null; }
// The identity key for a name: the card's Oracle identity when it resolves, otherwise the normalised text (unresolved names
// still never match a different card).
function keyOf(name){ const c = find(name); return c ? c._k : 'u:' + norm(name || ''); }
// The deck entry holding a card, whatever name or printing it was entered under.
function entryOf(d, name){ const k = keyOf(name); return (d.cards || []).find(x => keyOf(x.n) === k) || null; }
// Alternate printed names (see ALT_NAMES in lists.js): the real card name for a name printed on a reskinned card, or ''.
let ALT_IDX = null;
function altName(name){ if (typeof ALT_NAMES === 'undefined' || !name) return ''; if (!ALT_IDX){ ALT_IDX = new Map(); for (const k in ALT_NAMES) ALT_IDX.set(norm(k), ALT_NAMES[k]); } const k = norm(name); return k ? ALT_IDX.get(k) || ALT_IDX.get(norm(String(name).split(' // ')[0])) || '' : ''; }

function tags(c){
  if (c._t) return c._t;
  const o = c.o || '', t = frontType(c), land = /\bLand\b/.test(t), th = {}, roles = new Set();
  // a spell with a land on its back face is judged for jobs by its front face only
  const ro = / \/\/ [^/]*\bLand\b/.test(c.t || '') ? o.split(' // ')[0] : o;
  for (const k in THEMES){ const T = THEMES[k]; if (!T.re) continue; th[k] = T.re.test(o) ? 1 : (T.type && T.type.test(t) ? 0.5 : 0); }
  if (!land){
    if (ROLE_RE.ramp.test(ro)) roles.add('ramp');
    if ((THEMES.draw.re.test(ro) && !/each player draws|target opponent draws/i.test(ro)) || /you become the monarch|take the initiative/i.test(ro)) roles.add('draw');   // the monarch draws a card every end step
    // Each sentence or mode is judged on its own: a wipe clause makes a wipe, and a separate one-target clause on the same
    // card (Ugin's Binding, a planeswalker's minus) still counts as removal. Blink text ("exile ..., then return it") is not removal.
    const parts = ro.replace(/exile[^.]*\.?( then,?)? ?return[^.]*(to|onto) the battlefield[^.]*\./gi, '').split(/(?<=\.)\s+|•|\n/);
    if (parts.some(x => ROLE_RE.wipe.test(x)) || (/\bOverload\b/.test(ro) && ROLE_RE.wipe.test(ro))) roles.add('wipe');   // overload: one target, or all of them
    if (parts.some(x => ROLE_RE.removal.test(x) && !ROLE_RE.wipe.test(x))) roles.add('removal');
    if (ROLE_RE.counter.test(ro)) roles.add('counter');
    if (ROLE_RE.tutor.test(ro) && !roles.has('ramp')) roles.add('tutor');
    if (ROLE_RE.protect.test(ro) || (/\bInstant\b/.test(t) && ROLE_RE.blink.test(ro))) roles.add('protect');   // an instant-speed blink saves a creature; a blink engine does not count
  }
  return c._t = {land, th, roles};
}
function matchAim(c, key, tribe){
  if (isEdhAim(key)){ const m = EDH.tmap && EDH.tmap[key.slice(4)], x = m && edhOf(m, c), all = EDH.map && edhOf(EDH.map, c); return x && x.inc >= 0.2 && x.inc >= (all ? all.inc : 0) + 0.05 ? 1 : 0; }
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
// Official decklists write some names differently: "and" for "&" (Bebop, Skull and Crossbones), and a deck label after a
// reprint's name ("Sol Ring Avengers", "Command Tower (Villains)"). Only tried when the name as typed is no card; a label
// must be capitalised words, so a misspelling ("Sol Rings") or a different card ("Sword of Fire and Ice") never resolves.
function labelled(name){
  const s = String(name).trim(), a = s.replace(/ and /g, ' & '), b = s.replace(/ & /g, ' and ');
  for (const x of [a, b]) if (x !== s && find(x)) return find(x).n;
  const p = /^(.+?)\s*\(([^()]+)\)$/.exec(s); if (p && find(p[1])) return find(p[1]).n;
  const w = s.split(/\s+/);
  for (let k = 1; k <= 3 && k < w.length - 1; k++){ const rest = w.slice(-k); if (!rest.every(x => /^[A-Z][A-Za-z']*$/.test(x))) break; const c = find(w.slice(0, -k).join(' ')); if (c) return c.n; }
  return '';
}
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
    name = name.replace(/\*[A-Z]+\*/g, '').replace(/\s+#.*$/, '').replace(/\s*[\(\[][A-Za-z0-9]{2,6}[\)\]].*$/, '').trim();
    if (!find(name) && !altName(name)) name = name.replace(/\s+\d+[a-z★]?$/i, '').trim();   // a trailing collector number, unless it is part of the name
    if (!name || q < 1 || q > 250) continue;
    if (sb || section === 'side'){ out.side += q; continue; }
    let c = find(name); if (!c){ const real = altName(name) || labelled(name); if (real){ c = find(real); name = real; } } if (c) name = c.n;
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
// What this commander's players run: the sum of play rates of the ramp (draw, removal, wipe) cards on its EDHREC page, scaled
// for the cards the page leaves out (checked against ~4,000 real decks: within about one card), and its average land count.
function roleNeeds(E){
  if (!E || !E.map || E.map.size < 60) return null; if (E._needs && E._needs.m === E.map) return E._needs.v;
  const t = {ramp:0, draw:0, removal:0, wipe:0}; E.map.forEach((x, k) => { const c = IDX.get(k); if (!c || tags(c).land) return; tags(c).roles.forEach(r => { if (r in t) t[r] += x.inc; }); });
  const F = {ramp:1.15, draw:1.25, removal:1.25, wipe:1.2}, lim = {ramp:[5, 22], draw:[6, 22], removal:[4, 12], wipe:[1, 5]}, v = {};
  for (const r in t) v[r] = Math.max(lim[r][0], Math.min(lim[r][1], Math.round(t[r] * F[r])));
  if (E.lands) v.lands = Math.max(33, Math.min(40, Math.round(E.lands)));
  E._needs = {m:E.map, v}; return v;
}
function targetsOf(d, ctx){
  const a = d.aims || [];
  if (d.format === 'commander'){ const N = UP.roleT && ctx && ctx.edh ? roleNeeds(ctx.edh) : null, base = {size:100, lands:a[0] === 'lands' ? 39 : a[0] === 'aggro' ? 35 : 37, ramp:10, draw:10, removal:8, wipe:a.includes('control') ? 4 : 3};
    return N ? Object.assign(base, N) : base; }
  return {size:60, lands:a.includes('control') ? 26 : (a[0] === 'aggro' || a[0] === 'burn') ? 22 : 24, ramp:ctx.ident.includes('G') ? 4 : 0, draw:4, removal:6, wipe:a.includes('control') ? 2 : 0};
}
// Copies allowed: one in Commander (singleton), four in Standard; basics and "any number of cards named" cards are unlimited.
function copyLimit(d, c){ if (c && (isBasic(c.n) || /a deck can have any number of cards named/i.test(c.o || ''))) return Infinity;
  const m = c && /a deck can have up to (\w+) cards named/i.exec(c.o || ''), W = {two:2, three:3, four:4, five:5, six:6, seven:7, eight:8, nine:9, ten:10};
  if (m) return W[m[1].toLowerCase()] || +m[1] || 1; return d.format === 'commander' ? 1 : 4; }
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
// EDHREC lists a double-faced, adventure or split card under its front face; the card data uses the full name. Look up both.
function edhOf(map, c){ return map && c ? map.get(c._n) || map.get(norm(String(c.n).split(' // ')[0])) : undefined; }
let EDH_MISS = 3, W_INC = 10, W_SYN = 4, AIM_K = 1, STAPLE_K = 1, POP_K = 1;
const AIM_W = [5, 3.6, 2.6, 1.9, 1.4, 1];
const CORE = new Set(['sol ring','arcane signet','command tower']);
const TRIBE_SET = new Set(TRIBES);
function foreignTribe(c){
  if (c._ft !== undefined) return c._ft;
  // "Non-Human creatures" is not a Human card, and a card that makes its own tokens of a type (Myr Battlesphere) brings its tribe with it.
  const re = /(?<![Nn]on-)\b([A-Z][a-z]+?)(?:s|es)? (?:creatures? you control|creatures? get|spells?|you control|cards? in|on the battlefield|gain|creature spell)/g, o = c.o || ''; let m, r = '';
  while ((m = re.exec(o))){ const w = m[1] === 'Elv' ? 'Elf' : m[1]; if (TRIBE_SET.has(w) && !new RegExp('\\b[Cc]reates? [^.]*\\b' + w + '\\b').test(o)){ r = w; break; } }
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
  (d.aims || []).forEach((a, i) => { const m = matchAim(c, a, ctx.tribe); if (m){ s += AIM_K * (AIM_W[i] || 1) * m; if (m >= 0.7){ hit = true; why.push(a === 'tribal' ? ctx.tribe + ' synergy' : isEdhAim(a) ? themeWhy(a, c) : aimLabel(a, ctx.tribe)); } } });
  ctx.cmdThemes.forEach(a => { if (!(d.aims || []).includes(a) && matchAim(c, a, ctx.cmdTribe) >= 1){ s += 2; hit = true; why.push('Commander strategy'); } });
  if (ctx.edh){ const x = edhOf(ctx.edh.map, c); if (x){ s += W_INC * x.inc + W_SYN * Math.max(0, x.syn); hit = true; why.unshift('In ' + Math.round(x.inc * 100) + '% of ' + ctx.cmd.n.split(',')[0] + ' decks'); }
    // When there is plenty of data for this commander, a card none of its players run needs a better reason to be here.
    else if (ctx.edh.map.size >= 100 && !(c.r && c.r < 400) && !CORE.has(c._n)) s -= EDH_MISS; }
  if ((d.types && d.types.length) || (d.keys && d.keys.length)){ const fb = filtBonus(c, d); if (fb.s){ s += fb.s; if (fb.why.length){ hit = true; fb.why.forEach(w => why.unshift(w)); } } }
  if (d.prevCmd && d.prevCmd === c.n){ s += 3; hit = true; why.unshift('Your previous commander'); }
  a0 = s;
  s += POP_K * (c.r ? 3 * (1 - Math.log(c.r + 1) / Math.log(40000)) : (c.src === 'starter' ? 1.6 : 0.8));   // no rank usually means a new card, not a bad one
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
  const have = new Map(d.cards.map(e => [keyOf(e.n), e])), dismissed = new Set((d.dismissed || []).map(keyOf));
  const open = T.size - A.size;
  let nAdd = Math.max(0, open) + (fillOnly ? 0 : swaps), nCut = Math.max(0, -open) + (fillOnly ? 0 : swaps);
  const adds = [], cuts = [], def = {}; for (const r in A.roles) def[r] = T[r] - A.roles[r];
  // Used to fill open slots and to generate decks; upgrades use upgradePaths(). Brackets are a label, never a limit here.
  const okCard = c => mustOk(c, d) && legalIn(c, d.format) && c.ci.every(x => ctx.ident.includes(x)) && (ctx.cap === Infinity || underCap(c.p, d.tier || 'budget')) && (!recommend.own || recommend.own.has(c._n)) && !dismissed.has(c._k);

  // lands first
  let landNeed = Math.min(nAdd, Math.max(0, T.lands - A.lands));
  if (landNeed > 0){
    let nonbasic = 0; d.cards.forEach(e => { const c = find(e.n); if (c && tags(c).land && !isBasic(c.n)) nonbasic += e.q; });
    let room = std ? (ctx.ident.length > 1 ? 4 : 0) : Math.max(0, Math.min(12, 4 + ctx.ident.length * 3) - nonbasic);
    const pool = LIB.filter(c => tags(c).land && !isBasic(c.n) && okCard(c) && !have.has(c._k) && c._k !== keyOf(d.commander) && (!d.partner || c._k !== keyOf(d.partner)))
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
    const pool = LIB.filter(c => !tags(c).land && okCard(c) && !have.has(c._k) && c._k !== keyOf(d.commander) && (!d.partner || c._k !== keyOf(d.partner))).map(c => ({c, b:baseScore(c, d, ctx), used:false}));
    const bonus = c => { let b = 0, w = null, over = 0; tags(c).roles.forEach(r => { if (def[r] > 0){ b += 2 + Math.min(2, def[r] / 3); w = w || r; } else if (r in def && def[r] < 0) over = Math.max(over, -def[r]); });
      if (over && !b) b -= UP.over * Math.min(4, over); return [b, w]; };   // past the target, another card of the same role is worth less
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
    if (landExcess > 2){ let k = Math.min(landExcess, nCut);
      d.cards.filter(e => isBasic(e.n) && !e.l).sort((a, b) => b.q - a.q).forEach(e => { if (k > 0){ const q = Math.min(k, Math.max(0, e.q - 1)); if (q > 0){ cuts.push({n:e.n, q, why:['Above ' + T.lands + ' land target'], s:-10}); k -= q; nCut -= q; } } }); }
    const cand = [];
    for (const e of d.cards){
      if (e.l) continue; const c = find(e.n); if (!c || tags(c).land) continue;
      const b = baseScore(c, d, ctx); let s = b.s, why = [];
      tags(c).roles.forEach(r => { if (r in A.roles) s += A.roles[r] <= T[r] ? 2.5 : 0.6; });
      if (!c.ci.every(x => ctx.ident.includes(x))){ s = -80; why = ['Outside your colors']; }
      else if (!legalIn(c, d.format)){ s = -90; why = ['Not legal in ' + d.format]; }
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
  if (!fillOnly && open === 0){
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
// ===== Upgrade recommendations: one pipeline, Apex first =====
// 1. Fixes the deck needs anyway: cards outside the colours or not legal, extra copies, too many or too few cards.
// 2. Every possible addition and every card that could leave gets a value: how often this commander's players run it, its
//    synergy with the commander, and its fit with the deck's build. Price is never part of a card's value.
// 3. Apex: for each card worth replacing, the strongest fitting card, whatever it costs (a $0.50 card can be Apex). Cuts and
//    additions are paired best-first so no card is used twice. Held picks stay exactly where they are.
// 4. The Apex package is checked as a whole: a swap that leaves a job the deck relies on short, or pushes the curve up, is
//    dropped (held picks are never dropped).
// 5. Mid and Budget are cheaper alternatives for the same slot: strictly under $12 / $3, strictly cheaper than the Apex card,
//    doing the same job as the Apex card, and still an improvement on the card being replaced. Otherwise the tier is left
//    empty and says why. A card appears only once in the whole list.
// A card that does a job (ramp, draw, removal, wipes, protection, counterspells, tutors; gear, auras and vehicles) is what an
// alternative has to match.
const JOBS = ['ramp', 'draw', 'removal', 'wipe', 'protect', 'counter', 'tutor'];
const JOB_LABEL = {cost:'a cost reducer', ramp:'ramp', draw:'card draw', removal:'removal', wipe:'a board wipe', protect:'protection', counter:'a counterspell', tutor:'a tutor', gear:'equipment', aura:'an aura', vehicle:'a vehicle'};
const JOB_ORDER = ['wipe', 'removal', 'counter', 'tutor', 'draw', 'ramp', 'protect', 'cost', 'gear', 'aura', 'vehicle'];   // a card's main job, when it has several
// Beyond the deck's core jobs: card types and cost reducers (Medallions, Urza's Incubator) — used to match like with like,
// never counted toward the ramp/draw/removal/wipe minimums.
const COST_RE = /\bspells?\b[^.]{0,60}\bcosts? \{\d+\} less\b|\bcosts? \{\d+\} less to (cast|activate)\b/i;
// The colours of mana a land can make (for land upgrades: a new land must make every colour of the deck the old one made).
const LTYPE = {Plains:'W', Island:'U', Swamp:'B', Mountain:'R', Forest:'G'};
function landColors(c){
  if (c._lc) return c._lc; const o = (c.o || '').split(' // ')[0], t = frontType(c), out = new Set();
  Object.keys(LTYPE).forEach(k => { if (new RegExp('\\b' + k + '\\b').test(t)) out.add(LTYPE[k]); });
  // Only mana that can cast anything counts: "Spend this mana only to cast a creature spell" (Cavern of Souls, the Villages) and
  // copies of what your other lands make (Reflecting Pool) are not a source of that colour.
  const sent = o.split(/(?<=\.)\s+/);
  sent.forEach((x, i) => { if (!/\badd\b/i.test(x) || /^Spend this mana only/i.test(sent[i + 1] || '') || /a land you control could produce/i.test(x)) return;
    (x.match(/\{([WUBRG])\}/g) || []).forEach(y => out.add(y[1])); if (/mana of any (one )?colou?r|any colou?r|mana of any type/i.test(x)) 'WUBRG'.split('').forEach(z => out.add(z)); });
  const f = /search your library for (an? |up to \w+ )?(basic land|[^.]*?(Plains|Island|Swamp|Mountain|Forest)[^.]*?) cards?/i.exec(o);
  if (f){ if (/basic land/i.test(f[2])) 'WUBRG'.split('').forEach(x => out.add(x)); else Object.keys(LTYPE).forEach(k => { if (new RegExp('\\b' + k + '\\b').test(f[2])) out.add(LTYPE[k]); }); }
  return c._lc = out;
}
// How a land enters: 'tapped' always, 'cond' tapped only sometimes (check, snarl, shock, fast lands), 'untapped' otherwise.
// A land that fetches puts its land in tapped (Evolving Wilds) counts as tapped.
function landSpeed(c){
  const o = (c.o || '').split(' // ')[0];
  if (/enters tapped unless|if you don't[^.]*enters tapped|if you control (two|three) or (more|fewer) other lands[^.]*enters tapped|you may pay \d life\. if you don't/i.test(o)) return 'cond';
  if (/(this land|it|~|\bthis) enters tapped\.|enters the battlefield tapped\.|onto the battlefield tapped/i.test(o)) return 'tapped';
  return 'untapped';
}
function jobsOf(n){ const c = find(n); if (!c || tags(c).land) return []; const j = [...tags(c).roles].filter(r => JOBS.includes(r)), t = frontType(c);
  if (COST_RE.test((c.o || '').replace(/this spell costs[^.]*\./gi, '')) && !/^(Instant|Sorcery)/.test(t)) j.push('cost');
  if (/\bEquipment\b/.test(t)) j.push('gear'); else if (/\bAura\b/.test(t)) j.push('aura'); else if (/\bVehicle\b/.test(t)) j.push('vehicle'); return j; }
const mainJob = n => { const j = jobsOf(n); return JOB_ORDER.find(x => j.includes(x)) || ''; };
const TIER_KEYS_UP = ['apex', 'mid', 'budget'];
// Tier ceilings are strict: Budget is under $3 and Mid under $12; exactly $3 or $12 does not qualify.
const underCap = (p, t) => t === 'apex' || (p != null && p < TIERS[t].cap);
// The card a tier's package uses for one slot: the Apex card when it already fits the tier's price, otherwise the tier's own
// alternative (Mid falls back to the Budget pick). Unknown prices never count as fitting a cap.
function tierPick(L, t){
  const a = L.opts.apex; if (!a) return null; if (t === 'apex') return a;
  const ap = (find(a.add) || {}).p; if (a.own || underCap(ap, t)) return a;
  return t === 'mid' ? (L.opts.mid || L.opts.budget || null) : (L.opts.budget || null);
}
// Tuning carried over from Build 72/73 unchanged (wi: play rate, ws: synergy, wf: fit with the build, wd/wk: jobs lost/gained,
// T: job count treated as enough, m: smallest gain worth offering, fn: same-theme/type bonus). Thin = little play data.
const UP = {roleT:1, over:2, lt:0.5, wa:0, wo:0, pbDyn:0, pk:7.5, lslack:1, lfast:1, inflate:0, pb:0.25, pc:3, preMin:0.4, wi:15, ws:4, wf:0.1, wd:3, wk:0.75, T:8, m:2, fn:0.3, pool:300, extra:120, prior:0.15, fitMin:5, wfThin:1, mThin:5, fitMinThin:6, extraThin:400, curve:0.25};
// opt.cap: the "best deck with every new card under $cap" package (per card; a card you own counts as free). The same engine,
// with dearer additions left out from the start instead of being replaced afterwards; held picks belong to the tier rows, not here.
function upgradePaths(d, opt){
  opt = opt || {};
  const ctx = ctxOf(d), K = UP, A0 = analyze(d), std = d.format === 'standard';
  const thin = !ctx.edh || ctx.edh.map.size < 60, wf = thin ? K.wfThin : K.wf, mMin = thin ? K.mThin : K.m;
  const E = c => ctx.edh ? edhOf(ctx.edh.map, c) : undefined, isNew = c => !E(c) && !c.r;
  const dd = Object.assign({}, d, {tier:'apex'});
  const fitCache = new Map(), fit = c => { if (fitCache.has(c._k)) return fitCache.get(c._k); const a = W_INC, b = W_SYN, p = POP_K; W_INC = 0; W_SYN = 0; if (!thin) POP_K = 0; let s; try { s = baseScore(c, dd, ctx).s; } finally { W_INC = a; W_SYN = b; POP_K = p; } if (isNew(c)) s += EDH_MISS; fitCache.set(c._k, s); return s; };
  // Precon evidence: when the deck still holds most of the precon its commander comes from, what that precon's owners do
  // counts too. A card they add often gains (its rate among their decks is blended with the commander-wide rate); a card on
  // their most-cut list loses, most for the top of the list.
  const pre = ctx.edh && ctx.edh.pre && ctx.edh.pre.list && ctx.edh.pre.list.length ? ctx.edh.pre : null;
  const preNL = pre ? [...new Set(pre.list.map(n => find(n)).filter(c => c && !tags(c).land && !isBasic(c.n)).map(c => c._k))] : [];
  const have = new Set(d.cards.map(x => keyOf(x.n))), preShare = preNL.length ? preNL.filter(k => have.has(k)).length / preNL.length : 0;
  const preOn = !!pre && preShare >= K.preMin, preCut = new Map(), preAdd = new Map();
  const preLCut = new Map();
  if (preOn){ pre.cut.forEach((n, i) => { const k = keyOf(n); if (!preCut.has(k)) preCut.set(k, i); }); (pre.lcut || []).forEach((n, i) => { const k = keyOf(n); if (!preLCut.has(k)) preLCut.set(k, i); }); pre.add.forEach(r => preAdd.set(keyOf(r[0]), {inc:r[1], syn:r[2]})); }
  // Unchanged precons inflate the play rate of every precon card: a precon card is "in" every untouched copy. The least-played
  // precon cards show roughly how many copies are untouched (u). Taking those out puts precon cards and outside cards on the same
  // footing: the share of players who changed the deck that kept a card, against the share that added one.
  const preAll = preOn ? new Set(pre.list.map(n => keyOf(n))) : new Set();
  const preU = (() => { if (!preOn || !K.inflate) return 0; const v = [...preAll].map(k => LIB.find(c => c._k === k)).filter(Boolean).map(c => E(c)).filter(Boolean).map(e => e.inc).sort((a, b) => a - b);
    return v.length >= 20 ? Math.min(0.6, v[Math.floor(v.length * 0.05)]) : 0; })();
  // When the precon's owners are only part of the commander's EDHREC population (Eshki: 1,370 of 14,841 decks), the
  // commander-wide numbers describe other builds with other plans. Then a precon card its own owners do not list among their
  // most-cut cards is protected, in proportion to how little of the population the precon is — the deck keeps its plan.
  const preOther = preOn && ctx.edh && ctx.edh.decks && pre.decks ? Math.max(0, 1 - Math.min(1, pre.decks / ctx.edh.decks)) : 0;
  const PA = c => preOn ? preAdd.get(c._k) : null, PCL = c => preOn ? preLCut.get(c._k) : undefined, PC = c => preOn ? (tags(c).land ? preLCut.get(c._k) : preCut.get(c._k)) : undefined;
  // The player's ranked mechanics steer the build: a card that does the first mechanic counts most, the next less, and so
  // on, so reordering them changes the picks. A spell that does none of them and no core job needs a stronger case.
  const AW = [1, 0.75, 0.55, 0.4, 0.3], aims = (d.aims || []).slice(0, 5);
  const aimV = c => { if (tags(c).land || !aims.length) return 0; let v = 0; aims.forEach((a, i) => { const m = matchAim(c, a, ctx.tribe); if (m >= 0.7) v += AW[i] * m; });
    return v ? K.wa * v : (jobsOf(c.n).some(j => JOBS.includes(j)) ? 0 : -K.wo); };
  // Ranked commander themes: the play rate is blended with the rate among decks built for each chosen theme (first counts most).
  const TA = aims.map((a, i) => isEdhAim(a) && ctx.edh && ctx.edh.tmap && ctx.edh.tmap[a.slice(4)] ? {m:ctx.edh.tmap[a.slice(4)], w:AW[i], a} : null).filter(Boolean), TW = TA.reduce((s, t) => s + t.w, 0);
  const themeInc = c => TA.reduce((s, t) => { const x = edhOf(t.m, c); return s + t.w * (x ? x.inc : 0); }, 0) / (TW || 1);
  const val = c => { const e = E(c), pa = PA(c), ci = PC(c); let inc = e ? e.inc : isNew(c) ? K.prior : 0;
    // Themes judge the precon's own cards only as far as the theme's players are the precon's players (Eshki: barely at all).
    if (TA.length && !tags(c).land){ const lt = preAll.has(c._k) ? K.lt * (1 - preOther) : K.lt; inc = (1 - lt) * inc + lt * themeInc(c); } if (preU && e) inc = preAll.has(c._k) ? Math.max(0, inc - preU) / (1 - preU) : inc / (1 - preU); const pb = K.pbDyn ? Math.max(K.pb, preOther) : K.pb; if (pa) inc = e ? (1 - pb) * inc + pb * pa.inc : pa.inc;
    return K.wi * inc + K.ws * (e ? e.syn : 0) + wf * fit(c) + aimV(c) - (ci != null ? K.pc * (1 - ci / Math.max(1, (tags(c).land ? preLCut : preCut).size)) : (preOther && preAll.has(c._k) ? -K.pk * preOther : 0)); };
  const own = upgradePaths.own && upgradePaths.own.size ? upgradePaths.own : null, owned = c => !!own && own.has(c._n);
  const capOk = c => !opt.cap || owned(c) || (c.p != null && c.p < opt.cap);
  const installed = new Set(d.cards.map(x => keyOf(x.n)).concat([keyOf(d.commander || '')]).concat(d.partner ? [keyOf(d.partner)] : []));
  const dis = new Set((d.dismissed || []).map(keyOf));
  const legalHere = c => legalIn(c, d.format) && c.ci.every(z => ctx.ident.includes(z));
  const usable = c => c && !installed.has(c._k) && !dis.has(c._k) && !tags(c).land && !isBasic(c.n) && legalHere(c) && mustOk(c, d) && capOk(c);
  const out = {paths:[], fixes:[], drops:[], fills:Math.max(0, A0.T.size - A0.size), count:{free:0, budget:0, mid:0, apex:0}, cost:{free:0, budget:0, mid:0, apex:0}, shift:{free:{}, budget:{}, mid:{}, apex:{}}, unlock:[], conflicts:[], smart:true, thin, A:A0};
  const taken = new Set();   // every card shown anywhere in this list (Apex, alternatives, fixes)

  // --- 1. fixes ---
  const fixCut = new Set();
  const repl = (x, want) => { let best = null, bv = -1e9; for (const c of LIB){ if (!usable(c) || taken.has(c._k)) continue; const v = val(c) + (want && jobsOf(c.n).includes(want) ? 2 : 0); if (v > bv){ bv = v; best = c; } } return best; };
  const basic = (splitBasics(1, ctx)[0] || {}).n;
  d.cards.forEach(e => { const c = find(e.n); if (!c || e.l) return; let why = '';
    if (!c.ci.every(z => ctx.ident.includes(z)) && (ctx.ident.length || ctx.cmd)) why = 'Outside your colors'; else if (!legalIn(c, d.format)) why = 'Not legal in ' + d.format;
    if (!why || isBasic(c.n)) return; fixCut.add(c._k);
    if (tags(c).land){ if (basic) out.fixes.push({cut:e.n, add:basic, q:e.q, land:true, fix:true, why:['Basic land in its place'], cutWhy:[why]}); return; }
    const a = repl(c, mainJob(e.n)); if (!a){ out.drops.push({n:e.n, q:e.q, s:-80, why:[why]}); return; } taken.add(a._k);
    out.fixes.push({cut:e.n, add:a.n, q:e.q, fix:true, why:baseScore(a, dd, ctx).why.slice(0, 2), cutWhy:[why], gc:!!a.gc}); });
  d.cards.forEach(e => { const c = find(e.n), lim = copyLimit(d, c); if (c && e.q > lim) out.drops.push({n:e.n, q:e.q - lim, s:-95, why:[d.format === 'commander' ? 'Commander allows one copy' : 'More than four copies']}); });
  { let over = A0.size - A0.T.size - out.drops.reduce((s, x) => s + x.q, 0);
    if (over > 0) d.cards.map(e => ({e, c:find(e.n)})).filter(x => x.c && !x.e.l && !tags(x.c).land && !fixCut.has(x.c._k)).map(x => ({n:x.e.n, q:x.e.q, v:val(x.c)})).sort((a, b) => a.v - b.v)
      .forEach(x => { if (over > 0){ const q = Math.min(over, x.q); out.drops.push({n:x.n, q, s:-10, why:['The deck has ' + A0.size + ' cards; it needs ' + A0.T.size]}); over -= q; fixCut.add(keyOf(x.n)); } }); }

  // --- 2. values ---
  const mk = c => ({c, jobs:jobsOf(c.n), v:val(c)});
  const seen = new Set(), C = [];
  [...(ctx.edh ? ctx.edh.map.entries() : [])].map(([k, v]) => ({c:IDX.get(k), inc:v.inc})).filter(x => usable(x.c) && !taken.has(x.c._k)).sort((a, b) => b.inc - a.inc).slice(0, K.pool).forEach(x => { if (seen.has(x.c._k)) return; seen.add(x.c._k); C.push(mk(x.c)); });
  LIB.filter(c => !seen.has(c._k) && usable(c) && !taken.has(c._k)).map(c => ({c, f:fit(c)})).filter(x => x.f >= (thin ? K.fitMinThin : K.fitMin)).sort((a, b) => b.f - a.f).slice(0, thin ? K.extraThin : K.extra).forEach(x => { seen.add(x.c._k); C.push(mk(x.c)); });
  const cuts = d.cards.map(e => ({e, c:find(e.n)})).filter(x => x.c && !tags(x.c).land && !x.e.l && !fixCut.has(x.c._k)).map(x => ({n:x.e.n, q:std ? x.e.q : 1, c:x.c, jobs:jobsOf(x.e.n), v:val(x.c)}));
  const cnt = {}; d.cards.forEach(e => jobsOf(e.n).forEach(j => cnt[j] = (cnt[j] || 0) + e.q));
  const th = c => Object.keys(tags(c).th).filter(k => tags(c).th[k] === 1 && k !== 'aggro');
  const fn = (a, b) => 2 * th(a).filter(k => th(b).includes(k)).length + (mainType(a) === mainType(b) ? 1 : 0);
  // How much a swap improves the deck: value in minus value out, minus the hole it leaves in a job the deck is thin on, plus
  // the gap it fills, plus a little for staying on the same theme and card type.
  // Each job is measured against what the deck needs of it (about 10 ramp, 10 draw, 8 removal, 3 wipes; 8 for the rest).
  const tj = j => (A0.T && A0.T[j] != null && ['ramp', 'draw', 'removal', 'wipe'].includes(j)) ? A0.T[j] : K.T;
  const delta = (cut, add, N) => { let x = add.v - cut.v; N = N || cnt;
    cut.jobs.forEach(j => { if (j !== 'cost' && !add.jobs.includes(j)) x -= K.wd * Math.max(0, (tj(j) - ((N[j] || 0) - 1)) / tj(j)); });
    add.jobs.forEach(j => { if (j !== 'cost' && !cut.jobs.includes(j)) x += K.wk * Math.max(0, (tj(j) - (N[j] || 0)) / tj(j)); });
    return x + K.fn * fn(add.c, cut.c); };
  // Some evidence the card belongs: played or synergistic with this commander, a strong fit with the build, or too new for data.
  const ev = a => { const e = E(a.c), pa = PA(a.c); return (pa && pa.inc >= 0.1) || (e && (e.inc >= 0.1 || e.syn >= 0.1)) || fit(a.c) >= (thin ? K.fitMinThin : K.fitMin) || isNew(a.c); };
  const aimsOf = c => { const s = new Set(); (d.aims || []).forEach(a => { if (matchAim(c, a, ctx.tribe) >= 0.7) s.add(a === 'tribal' ? 'tribal:' + ctx.tribe : a); }); ctx.cmdThemes.forEach(a => { if (matchAim(c, a, ctx.cmdTribe) >= 1) s.add(a === 'tribal' ? 'tribal:' + ctx.cmdTribe : a); }); return s; };
  const pct = x => Math.round(x * 100), cmdShort = ctx.cmd ? ctx.cmd.n.split(',')[0] : '';
  const preName = pre ? pre.name : '', preDecks = pre && pre.decks ? pre.decks.toLocaleString('en-US') + ' ' : '';
  const whyAdd = (a, cu) => { const pa = PA(a.c), why = (pa ? ['Added in ' + pct(pa.inc) + '% of ' + preDecks + 'decks built from ' + preName] : []).concat(isNew(a.c) ? ['New card · not enough play data yet'] : []).concat(baseScore(a.c, dd, ctx).why);
    const gap = a.jobs.find(j => !cu.jobs.includes(j) && (cnt[j] || 0) < K.T * 0.75); if (gap && why.length < 2 && JOB_LABEL[gap]) why.push('Adds ' + JOB_LABEL[gap]); return why.slice(0, 2); };
  // Why the card leaving is the one to go: its own evidence, and what happens to the job it does.
  const whyCut = (cu, a) => { const e = E(cu.c), w = [], ci = PC(cu.c);
    if (ci != null) w.push((tags(cu.c).land ? 'One of the lands most often cut from ' : 'One of the cards most often cut from ') + preName + ' (#' + (ci + 1) + ' of ' + (tags(cu.c).land ? preLCut : preCut).size + ')');
    w.push(e ? 'In ' + pct(e.inc) + '% of ' + cmdShort + ' decks' : ctx.edh ? 'Rarely run with ' + cmdShort : 'Weakest fit for the build');
    if (!aimsOf(cu.c).size) w.push('Does little for the deck’s plan');
    const lost = cu.jobs.filter(j => !a.jobs.includes(j)), kept = cu.jobs.filter(j => a.jobs.includes(j));
    if (kept.length) w.push('Its ' + (JOB_LABEL[kept[0]] || kept[0]) + ' role is kept'); else if (lost.length) w.push('Gives up ' + (JOB_LABEL[lost[0]] || lost[0]) + '; the deck keeps ' + Math.max(0, (cnt[lost[0]] || 0) - 1));
    return w.slice(0, 2); };
  const pair = (cu, a, v, t) => ({cut:cu.n, add:a.c.n, q:cu.q, t, gain:+v.toFixed(2), aq:+a.v.toFixed(2), cv:+cu.v.toFixed(2), why:whyAdd(a, cu), cutWhy:whyCut(cu, a), gc:!!a.c.gc, gcOut:!!cu.c.gc, own:owned(a.c), smart:true});

  // --- held picks: kept exactly, never displaced by a higher score. A hold whose card can no longer go in is reported. ---
  const held = new Map();   // cut name -> {tier -> pair}
  for (const k in (opt.cap ? {} : (d.recP || {}))){ const r = d.recP[k], p = r && r.pair; if (!p || !TIERS[r.t]) continue;
    const c = find(p.add), cutE = entryOf(d, p.cut);
    if (!cutE || (c && installed.has(c._k)) || (c && dis.has(c._k))) continue;   // the player swapped it in, or ruled it out: the hold is done
    if (!c || !legalHere(c)){ out.conflicts.push({k, cut:p.cut, add:p.add, t:r.t, why:!c ? 'Card not found in the card data' : !legalIn(c, d.format) ? 'No longer legal in ' + d.format : 'Outside this deck’s colors'}); continue; }
    if (!held.has(cutE.n)) held.set(cutE.n, {}); held.get(cutE.n)[r.t] = {p, c}; taken.add(c._k); }

  // --- 3. Apex: strongest fitting card per slot ---
  const T = A0.T, floor = {ramp:T.ramp, draw:T.draw, removal:T.removal, wipe:T.wipe};
  const flo = j => floor[j] != null ? Math.min(floor[j], cnt[j] || 0) : Math.min(cnt[j] || 0, 2);   // a job may not fall below what the deck needs (or has)
  const rows = new Map(), cutIdx = new Map(cuts.map((cu, i) => [cu.n, i]));
  const apexPick = new Map();   // cut index -> {a, v, held}
  for (const [cutN, H] of held){ const i = cutIdx.get(cutN); if (i == null || !H.apex) continue; const a = mk(H.apex.c); apexPick.set(i, {a, v:delta(cuts[i], a), held:true}); }
  { const L = C.filter(x => !taken.has(x.c._k)), M = [];
    cuts.forEach((cu, i) => { if (apexPick.has(i)) return; L.forEach((a, k) => { const v = delta(cu, a); if (v >= mMin && ev(a)) M.push([v, i, k]); }); });
    M.sort((a, b) => b[0] - a[0] || a[1] - b[1] || a[2] - b[2]); const ua = new Set();
    // The deck's skeleton is kept while pairing, not after: a swap that would take ramp, draw, removal or wipes below what the
    // deck needs is skipped, so a weak removal spell is paired with a better removal spell instead of losing its upgrade.
    const run = Object.assign({}, cnt); apexPick.forEach((x, i) => { cuts[i].jobs.forEach(j => run[j] = (run[j] || 0) - 1); x.a.jobs.forEach(j => run[j] = (run[j] || 0) + 1); });
    for (const [v, i, k] of M){ if (apexPick.has(i) || ua.has(k)) continue; const a = L[k], lost = cuts[i].jobs.filter(j => !a.jobs.includes(j));
      if (lost.some(j => JOBS.includes(j) && (run[j] || 0) - 1 < flo(j))) continue;   // card types (equipment, auras, vehicles) are not floors
      lost.forEach(j => run[j]--); a.jobs.forEach(j => { if (!cuts[i].jobs.includes(j)) run[j] = (run[j] || 0) + 1; });
      ua.add(k); apexPick.set(i, {a, v, held:false}); } }
  // --- 4. package check on the Apex package (held picks are never removed) ---
  const nonland = d.cards.map(e => find(e.n)).filter(c => c && !tags(c).land), avg0 = nonland.reduce((s, c) => s + (c.cmc || 0), 0) / Math.max(1, nonland.length);
  let removed = 0, after = Object.assign({}, cnt), avg = avg0;
  for (let pass = 0; pass < 8; pass++){
    const act = [...apexPick.entries()];
    after = Object.assign({}, cnt); let sum = nonland.reduce((s, c) => s + (c.cmc || 0), 0);
    act.forEach(([i, x]) => { cuts[i].jobs.forEach(j => after[j] = (after[j] || 0) - 1); x.a.jobs.forEach(j => after[j] = (after[j] || 0) + 1); sum += (x.a.c.cmc || 0) - (cuts[i].c.cmc || 0); });
    avg = sum / Math.max(1, nonland.length);
    const mine = act.filter(([, x]) => !x.held); let drop = null;
    for (const j of JOBS){ const fl = flo(j); if ((after[j] || 0) < fl){ const z = mine.filter(([i, x]) => cuts[i].jobs.includes(j) && !x.a.jobs.includes(j)).sort((a, b) => a[1].v - b[1].v)[0]; if (z){ drop = z; break; } } }
    if (!drop && avg > avg0 + K.curve) drop = mine.map(z => ({z, up:(z[1].a.c.cmc || 0) - (cuts[z[0]].c.cmc || 0)})).filter(y => y.up > 0).sort((a, b) => b.up / Math.max(0.5, b.z[1].v) - a.up / Math.max(0.5, a.z[1].v)).map(y => y.z)[0] || null;
    if (!drop){ let worst = null, wv = 1e9; mine.forEach(z => { const N = Object.assign({}, after); cuts[z[0]].jobs.forEach(j => N[j] = (N[j] || 0) + 1); z[1].a.jobs.forEach(j => N[j] = (N[j] || 0) - 1); const v = delta(cuts[z[0]], z[1].a, N); if (v < mMin * 0.75 && v < wv){ wv = v; worst = z; } }); drop = worst; }
    if (!drop) break; apexPick.delete(drop[0]); removed++;
  }
  out.pre = pre ? {name:pre.name, decks:pre.decks, share:+preShare.toFixed(2), on:preOn, untouched:+preU.toFixed(3), otherBuilds:+preOther.toFixed(2)} : null;
  out._dbg = {cuts:cuts.map(cu => ({n:cu.n, k:cu.c._k, v:+cu.v.toFixed(2), jobs:cu.jobs})), pool:C.map(x => ({k:x.c._k, v:+x.v.toFixed(2)})), cnt, floor};   // diagnostics for tests only
  out.pack = {apex:{removed, jobs:Object.fromEntries(['ramp', 'draw', 'removal', 'wipe'].map(j => [j, [cnt[j] || 0, after[j] || 0]])), avg:[+avg0.toFixed(2), +avg.toFixed(2)]}};
  apexPick.forEach(x => taken.add(x.a.c._k));

  // --- 5. Mid and Budget alternatives, strongest Apex slots first ---
  const order = [...apexPick.entries()].sort((a, b) => b[1].v - a[1].v);
  // Same job as the Apex card: its main job, or (for a card with no job, a threat or synergy piece) the same card type and at
  // least one shared part of the deck's plan. A shared theme or type alone is not enough for a card that does a job.
  const sameFn = (A, X) => { const j = mainJob(A.c.n); if (j) return X.jobs.includes(j); if (X.jobs.length || mainType(X.c) !== mainType(A.c)) return false; const s = aimsOf(A.c); return [...aimsOf(X.c)].some(x => s.has(x)); };
  const buildRow = (cu, x, sameF, C) => {
    const A = x.a, ap = A.c.p, H = held.get(cu.n) || {}, row = {cut:cu.n, opts:{}, none:{}, gain:0};
    row.opts.apex = Object.assign(pair(cu, A, x.v, 'apex'), x.held ? {held:true} : {}); row.gain = x.v;
    const fits = X => X.c._k !== A.c._k && X.c.p != null && ap != null && X.c.p < ap && sameF(A, X);
    const pool = C.filter(X => !taken.has(X.c._k) && fits(X)).map(X => ({X, v:delta(cu, X)})).filter(y => y.v >= mMin && ev(y.X)).sort((a, b) => b.v - a.v || a.X.c.p - b.X.c.p);
    // Same-job cheaper cards that are already suggested elsewhere in this deck (each card is suggested once), for an honest reason.
    const elsewhere = C.filter(X => taken.has(X.c._k) && fits(X)).map(X => ({X, v:delta(cu, X)})).filter(y => y.v >= mMin && ev(y.X));
    for (const t of ['budget', 'mid']){
      if (H[t]){ const a = mk(H[t].c); row.opts[t] = Object.assign(pair(cu, a, delta(cu, a), t), {held:true}); continue; }
      if (ap == null){ row.none[t] = 'The Apex card’s price is unknown, so no cheaper option can be confirmed'; continue; }
      if (underCap(ap, t)){ row.none[t] = 'The Apex card already costs under $' + TIERS[t].cap; continue; }
      const floorV = t === 'mid' && row.opts.budget ? row.opts.budget.gain : -1e9;
      const y = pool.find(y => !taken.has(y.X.c._k) && underCap(y.X.c.p, t) && y.v > floorV);
      if (!y){ const z = elsewhere.filter(y => underCap(y.X.c.p, t) && y.v > floorV).map(y => y.X.c.n.split(' // ')[0]);
        row.none[t] = t === 'mid' && row.opts.budget ? 'The Budget pick is the best option under $12'
          : z.length ? 'The cards under $' + TIERS[t].cap + ' that do the same job (' + z.slice(0, 2).join(', ') + ') are already suggested elsewhere in this deck'
          : 'No card under $' + TIERS[t].cap + ' does the same job as ' + A.c.n.split(' // ')[0] + ' and still improves on ' + cu.n.split(' // ')[0]; continue; }
      taken.add(y.X.c._k); row.opts[t] = pair(cu, y.X, y.v, t);
    }
    const ownPick = ['apex', 'mid', 'budget'].map(t => row.opts[t]).find(p => p && p.own); if (ownPick) row.opts.free = Object.assign({}, ownPick, {t:'free'});
    rows.set(cu.n, row);
  };
  for (const [i, x] of order) buildRow(cuts[i], x, sameFn, C);

  // --- 6. Lands: a nonbasic land may give way to a better nonbasic land — never a basic, never a spell, land count kept
  //     (APP-040). The new land must make every colour of the deck that the old one made, and needs play evidence.
  if (!std){
    const deckCols = ctx.ident, covers = (a, b) => [...landColors(b)].filter(x => deckCols.includes(x)).every(x => landColors(a).has(x));
    const isLandUp = c => c && tags(c).land && !isBasic(c.n) && !/\bBasic\b/.test(frontType(c));
    const lcuts = d.cards.map(e => ({e, c:find(e.n)})).filter(x => isLandUp(x.c) && !x.e.l && !fixCut.has(x.c._k)).map(x => ({n:x.e.n, q:1, c:x.c, jobs:[], v:val(x.c)}));
    const lk = new Set(); const LP = [];
    (ctx.edh ? [...ctx.edh.map.keys()].map(k => IDX.get(k)) : []).concat(preOn ? [...preAdd.keys()].map(k => LIB.find(c => c._k === k)) : [])
      .forEach(c => { if (isLandUp(c) && capOk(c) && !lk.has(c._k) && !installed.has(c._k) && !dis.has(c._k) && !taken.has(c._k) && legalHere(c)){ lk.add(c._k); LP.push({c, jobs:[], v:val(c)}); } });
    const evL = a => { const e = E(a.c), pa = PA(a.c); return (pa && pa.inc >= 0.05) || (e && e.inc >= 0.1); };
    // Lands are compared on play rates with untouched precons taken out (see preU): a precon land is otherwise "in" every
    // unchanged copy. A land that always enters tapped may give way to an untapped one making the same colours when the two
    // are about as well played; anything else needs the usual clear gain.
    const lv = c => { const e = E(c); if (!e || !preU) return val(c); const inc = preAll.has(c._k) ? Math.max(0, e.inc - preU) / (1 - preU) : e.inc / (1 - preU); return val(c) + K.wi * (inc - e.inc) * (1 - (PA(c) && e ? K.pb : 0)); };
    lcuts.forEach(cu => cu.v = lv(cu.c)); LP.forEach(a => a.v = lv(a.c));
    const faster = (a, cu) => landSpeed(cu.c) === 'tapped' && landSpeed(a.c) !== 'tapped';
    const ldelta = (cu, a) => a.v - cu.v;
    const lok = (cu, a, v) => v >= mMin || (faster(a, cu) && v >= -K.lslack);
    const lpick = new Map();
    lcuts.forEach((cu, i) => { const H = held.get(cu.n); if (H && H.apex){ const a = {c:H.apex.c, jobs:[], v:val(H.apex.c)}; lpick.set(i, {a, v:ldelta(cu, a), held:true}); taken.add(a.c._k); } });
    const M = []; lcuts.forEach((cu, i) => { if (lpick.has(i)) return; LP.forEach((a, k) => { const v = ldelta(cu, a); if (lok(cu, a, v) && evL(a) && covers(a.c, cu.c)) M.push([v + (faster(a, cu) ? K.lfast : 0), i, k]); }); });
    M.sort((a, b) => b[0] - a[0] || a[1] - b[1] || a[2] - b[2]); const ua = new Set();
    for (const [v, i, k] of M){ if (lpick.has(i) || ua.has(k) || taken.has(LP[k].c._k)) continue; ua.add(k); lpick.set(i, {a:LP[k], v, held:false}); }
    lpick.forEach(x => taken.add(x.a.c._k));
    // A cheaper land stands in for an expensive one when it makes at least the same deck colours.
    const sameLand = (A, X) => covers(X.c, A.c);
    const sameLandAlt = (A, X) => covers(X.c, A.c) && (landSpeed(A.c) === 'tapped' || landSpeed(X.c) !== 'tapped');   // a stand-in is never slower than its Apex land
    [...lpick.entries()].sort((a, b) => b[1].v - a[1].v).forEach(([i, x]) => { buildRow(lcuts[i], x, sameLandAlt, LP.filter(evL).map(y => Object.assign({}, y, {jobs:[]})));
      const row = rows.get(lcuts[i].n); if (!row) return; Object.values(row.opts).forEach(p => { const a = find(p.add); if (a && faster({c:a}, lcuts[i])){ p.cutWhy = ['Always enters tapped'].concat(p.cutWhy).slice(0, 2); p.why = ['Makes the same colours and can enter untapped'].concat(p.why).slice(0, 2); } }); });
    // A land hold with no Apex pick (only a Mid or Budget hold) still shows, exactly as held.
    lcuts.forEach(cu => { const H = held.get(cu.n); if (!H || rows.has(cu.n)) return; const row = {cut:cu.n, opts:{}, none:{}, gain:0};
      for (const t of TIER_KEYS_UP) if (H[t]){ const a = {c:H[t].c, jobs:[], v:val(H[t].c)}, v = ldelta(cu, a); row.opts[t] = Object.assign(pair(cu, a, v, t), {held:true}); row.gain = Math.max(row.gain, v); }
      rows.set(cu.n, row); });
  }
  // Holds whose slot has no Apex pick (its Apex was a different hold, or the slot dropped out) still show, exactly as held.
  for (const [cutN, H] of held){ if (rows.has(cutN)) continue; const i = cutIdx.get(cutN); if (i == null) continue; const cu = cuts[i], row = {cut:cutN, opts:{}, none:{}, gain:0};
    for (const t of TIER_KEYS_UP) if (H[t]){ const a = mk(H[t].c), v = delta(cu, a); row.opts[t] = Object.assign(pair(cu, a, v, t), {held:true}); row.gain = Math.max(row.gain, v); }
    rows.set(cutN, row); }
  out.paths = [...rows.values()].sort((a, b) => (b.opts.free ? 1 : 0) - (a.opts.free ? 1 : 0) || b.gain - a.gain);
  for (const t of ['free'].concat(TIER_KEYS_UP)) out.paths.forEach(L => { const p = t === 'free' ? L.opts.free : tierPick(L, t); if (!p) return; out.count[t] += p.q; const a = find(p.add), c = find(p.cut); out.cost[t] += ((p.own ? 0 : a && a.p || 0) - (c && c.p || 0)) * p.q; });
  out.bracket = ctx.bracket; out.gcIn = ctx.gcIn; out.mldIn = ctx.mldIn; out.gcCap = ctx.gcCap;
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
    (d.aims || []).forEach(a => { if (matchAim(c, a, ctx.tribe) >= 0.7) aims.push(aimLabel(a, ctx.tribe)); });
    const ft = foreignTribe(c), wrongTribe = ft && ft !== ctx.tribe && !(ctx.cmd && new RegExp('\\b' + ft + '\\b').test(ctx.cmd.t));
    if (wrongTribe){ pts -= 3; cons.push('It rewards ' + ft + ' cards' + (ctx.tribe ? ', and this is a ' + ctx.tribe + ' deck' : ', which this deck is not built around') + ', so most of its text would do nothing.'); }
    else if (aims.length){ pts += 2; pros.push('Supports what the deck is built to do: ' + aims.slice(0, 3).join(', ') + '.'); }
    else if (ctx.cmdThemes.some(a => matchAim(c, a, ctx.cmdTribe) >= 1)){ pts += 2; pros.push('Works with ' + cmdName + '’s own strategy.'); }
    else if ((d.aims || []).length || ctx.cmdThemes.length) { pts -= 1; cons.push('It doesn’t feed the deck’s main plan' + ((d.aims || []).length ? ' (' + aimLabel(d.aims[0], ctx.tribe) + ')' : '') + '.'); }
    if (ctx.edh){ const x = edhOf(ctx.edh.map, c);
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
function canLead(c){ if (!c || !c.cmd) return false; const t = frontType(c); return (/Legendary/.test(t) && (/Creature/.test(t) || (/\b(Vehicle|Spacecraft)\b/.test(t) && /\d|\*/.test(c.pt || '')))) || /can be your commander/i.test(c.o || '') || (/Legendary/.test(t) && /isn.t on the battlefield, it.s an? [^.]*\bcreature\b/i.test(c.o || '')); }
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
function addCard(d, n, q){ const k = keyOf(n), e = d.cards.find(x => keyOf(x.n) === k); if (d.dismissed && d.dismissed.length) d.dismissed = d.dismissed.filter(x => keyOf(x) !== k); if (e) e.q += q; else d.cards.push({n, q, l:false}); }
function cutCard(d, n, q){ const k = keyOf(n), i = d.cards.findIndex(x => keyOf(x.n) === k); if (i < 0) return; d.cards[i].q -= q; if (d.cards[i].q <= 0) d.cards.splice(i, 1); }
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
  const pool = LIB.filter(c => c.p != null && c.p < 12 && legalIn(c, d.format) && c.ci.every(x => ctx.ident.includes(x)) && !used.has(c._n) && !isBasic(c.n) && mustOk(c, d))
    .map(c => ({c, s:baseScore(c, tmp, ctx).s, land:tags(c).land, ty:mainType(c)}));
  // A stand-in is strictly under the tier's price and does the same job as the card it stands in for (its main job; for a
  // card with no job, the same card type), the same rule as upgrade alternatives.
  const alt = (x, cap) => { const tx = tags(x), ty = mainType(x), j = mainJob(x.n); let best = null, bs = -1e9;
    for (const p of pool){ if (p.used || !(p.c.p < cap) || !(x.p == null || p.c.p < x.p) || p.land !== tx.land) continue;
      if (!p.land && (j ? !jobsOf(p.c.n).includes(j) : (p.ty !== ty || jobsOf(p.c.n).some(r => JOBS.includes(r))))) continue;
      if (p.land && ![...landColors(x)].filter(k => ctx.ident.includes(k)).every(k => landColors(p.c).has(k))) continue;
      let s = p.s + (p.ty === ty ? 3 : 0), share = 0; tags(p.c).roles.forEach(r => { if (tx.roles.has(r)) share++; }); s += share * 2; if (s > bs){ bs = s; best = p; } }
    if (best) best.used = true; return best ? best.c.n : null; };
  const basic = (splitBasics(1, ctx)[0] || {}).n || null, own = ownAll || new Set();
  return tmp.cards.map((en, i) => {
    const c = find(en.n), S0 = {id:i + 1, a:en.n, q:en.q}; if (!c) return S0;
    if (isBasic(c.n)){ S0.basic = true; S0.land = true; return S0; }
    if (tags(c).land) S0.land = true;
    if (seedSet.has(c._n)){ S0.seed = true; if (own.has(c._n)) S0.own = true; return S0; }
    if (own.has(c._n)){ S0.own = true; return S0; }
    if (c.p == null || c.p < 3) return S0;
    if (c.p >= 12){ const m = alt(c, 12), mc = m && find(m); if (mc && mc.p < 3) S0.b = m; else { if (m) S0.m = m; S0.b = alt(c, 3); } }
    else S0.b = alt(c, 3);
    if (!S0.b && S0.land && basic) S0.b = basic;
    if (!S0.b) delete S0.b; return S0;
  });
}
function planPick(s, t){ return t === 'apex' ? s.a : t === 'mid' ? (s.m || s.a) : (s.b || s.m || s.a); }
function fillDeck(d){ const r = recommend(d, 0, true); r.adds.forEach(a => addCard(d, a.n, a.q)); return r.adds.reduce((s, a) => s + a.q, 0); }
function setCommander(d, name){
  const c = find(name), old = d.commander, fromDeck = !!entryOf(d, name), next = c ? c.n : name;
  if (old && keyOf(old) !== keyOf(next) && fromDeck) addCard(d, old, 1);
  d.commander = next; cutCard(d, next, 1);
  if (d.partner){ const p = find(d.partner); if (!p || !c || !canPair(c, p)) delete d.partner; }
  if (c && !d.aimLocked){ const st = detectStrategy(c, d); d.tribe = st.tribe || d.tribe || ''; if (!d.aims.length) d.aims = st.themes.slice(0, 3); d.colors = c.ci.slice(); }
}
// ----- independent deck validator -----
// Checks a deck against the Commander construction rules and the app's own rules. It shares nothing with the
// recommendation scoring: a high score can never make an invalid deck pass. Returns [{key, card, note}].
function validateDeck(d){
  const v = [], push = (key, card, note) => v.push({key, card:card || '', note:note || ""}); if (d.format !== 'commander'){ return v; }
  const cmd = find(d.commander), par = d.partner ? find(d.partner) : null;
  if (!d.commander) push('commander_missing'); else if (!cmd) push('unresolved_identity', d.commander); else { if (!cmd.cmd) push('format_not_legal', cmd.n); if (!canLead(cmd)) push('commander_ineligible', cmd.n); }
  if (d.partner){ if (!par) push('unresolved_identity', d.partner); else if (!cmd || !canPair(cmd, par)) push('commander_pair_invalid', par.n); }
  const ident = new Set((cmd ? cmd.ci : []).concat(par ? par.ci : [])), BT = {Plains:'W', Island:'U', Swamp:'B', Mountain:'R', Forest:'G'};
  let total = (d.commander ? 1 : 0) + (d.partner ? 1 : 0); const seen = new Map();
  for (const e of d.cards){ total += e.q; const c = find(e.n); if (!c){ push('unresolved_identity', e.n); continue; }
    if (!c.cmd) push('format_not_legal', c.n);
    if (!c.ci.every(x => ident.has(x))) push('off_color_identity', c.n);
    ((frontType(c).split('—')[1]) || '').trim().split(/\s+/).forEach(t => { if (BT[t] && !ident.has(BT[t])) push('land_type_color_invalid', c.n, t); });
    seen.set(c._k, (seen.get(c._k) || 0) + e.q); if (seen.get(c._k) > copyLimit(d, c)) push('singleton_conflict', c.n); }
  [cmd, par].forEach(c => { if (c && seen.has(c._k)) push('singleton_conflict', c.n, 'also in the deck'); });
  if (total !== 100) push('wrong_deck_size', '', total + ' cards');
  return v;
}
// A package of swaps applied to a copy of the deck: every cut must be in the deck, no addition may already be there (under
// any name or printing), held picks must be the ones the player holds, and the result must still be a valid deck.
function validatePackage(d, pairs){
  const v = [], copy = JSON.parse(JSON.stringify(d));
  for (const p of pairs){ if (!entryOf(copy, p.cut)) { v.push({key:'cut_absent', card:p.cut}); continue; }
    if (entryOf(copy, p.add) && !isBasic(p.add)) v.push({key:'installed_addition', card:p.add});
    cutCard(copy, p.cut, p.q || 1); addCard(copy, p.add, p.q || 1); }
  // Only active holds count, the same ones upgradePaths keeps: a hold whose card was excluded, installed, or whose cut card
  // has left the deck is not active (allowing an excluded card again brings its hold back).
  const dis = new Set((d.dismissed || []).map(keyOf));
  for (const k in (d.recP || {})){ const r = d.recP[k]; if (!r || !r.pair || dis.has(keyOf(r.pair.add)) || entryOf(d, r.pair.add) || !entryOf(d, r.pair.cut)) continue;
    const P = pairs.find(p => keyOf(p.cut) === keyOf(r.pair.cut)); if (P && keyOf(P.add) !== keyOf(r.pair.add) && P.t === r.t) v.push({key:'held_pick_changed', card:r.pair.add}); }
  const before = new Set(validateDeck(d).map(x => x.key + '|' + x.card));
  validateDeck(copy).forEach(x => { if (!before.has(x.key + '|' + x.card)) v.push(x); });
  return v;
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


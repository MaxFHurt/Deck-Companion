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

// Version 0.9.2 (19 Oct): token doublers worded as a replacement ("If one or more tokens would be created"), damage doublers
// and power doublers are read too (found by tools/tests/suite/misread.js).
const THEMES = {
  tokens:      {label:'Tokens / go wide', re:/\bcreates?\b[^.]*\btokens?\b|tokens? you control|populate|(^|[.—] ?)(other )?creatures you control get \+|tokens? would be created/i},
  // counters a card keeps or moves count too, even when the text never says +1/+1 (The Ozolith, Fate Transfer, Nexus Mentality; owner, 19 Oct)
  counters:    {label:'+1/+1 counters', re:/\+1\/\+1 counter|proliferate|number of (each kind of )?counters?|\bmove (all |any number of |one or more |a |one |those |the )?counters?\b|\bput (those|its|the same) counters on\b|\bhad counters on (it|them)\b|\bwith (one or more )?counters on (it|them)\b/i},
  graveyard:   {label:'Graveyard / reanimator', re:/from (your|a|any) graveyard|\bmills?\b|in(to)? your graveyard|flashback|unearth|dredge|cards? in your graveyard/i},
  sacrifice:   {label:'Sacrifice / aristocrats', re:/sacrifice (a|an|another|two|three|ten) |whenever [^.]*\bdies\b|each (other )?(opponent|player) sacrifices/i},
  spells:      {label:'Spellslinger', re:/instant or sorcery|instant and sorcery|noncreature spell|magecraft|prowess|copy (target|that) (instant|sorcery|spell)/i, type:/Instant|Sorcery/},
  artifacts:   {label:'Artifacts', re:/\bartifacts?\b|treasure token|thopter|affinity|metalcraft/i, type:/Artifact/},
  enchantments:{label:'Enchantments', re:/\benchantments?\b|\bauras?\b|constellation/i, type:/Enchantment/},
  lifegain:    {label:'Lifegain / drain', re:/gains? [^.]{0,30}life|lifelink|whenever you gain life|loses? [^.]{0,30}life/i},
  lands:       {label:'Lands / landfall', re:/landfall|whenever a land|additional land|lands? (cards? )?from your (graveyard|hand)|for each land you control|land card from your hand onto/i},
  voltron:     {label:'Voltron (equipment / auras)', re:/equipped creature|enchanted creature|\bequip\b|\battach\b|aura,? (and|or) equipment|aura and equipment/i, type:/Equipment|Aura/},
  blink:       {label:'Enter-the-battlefield / blink', re:/then return (it|that card|those cards|them) to the battlefield|whenever (a|another|one or more)[^.]{0,40}creatures?[^.]{0,30}\benters?\b|when [^.]{1,45} enters,|triggers an additional time/i},
  burn:        {label:'Burn / direct damage', re:/deals? (double|triple) that damage|deals? (\d+|x|that much) damage to (each opponent|any target|target player|each player|that player)|damage to each opponent|deals damage equal to [^.]* to any target/i},
  aggro:       {label:'Aggro / combat', re:/deals? (double|triple) that damage|double (the|its|this creature's|target creature's) power|\bhaste\b|double strike|additional combat|whenever [^.]{0,50}\battacks?\b(?! you)|(^|[.—] ?)(other )?creatures you control get \+|\btrample\b/i},
  control:     {label:'Control / interaction', re:null},
  draw:        {label:'Card advantage engine', re:/draws? (a|an|two|three|four|seven|x|that many|up to two) (additional )?cards?|draw cards equal|draw a card for each|draw x cards|no maximum hand size/i},
  tribal:      {label:'Creature type (tribal)', re:null}
};
// Keywords and ability words (Comprehensive Rules 701, 702, 207.2c; tools/rules/keywords.json) mapped to the themes they
// belong to (Build 139, UP.kw). A card with the word in its text counts for the theme even when its wording differs.
const KW_THEMES = {graveyard:['from their graveyard','from each graveyard','dredge','flashback','unearth','escape','embalm','eternalize','disturb','retrace','jump-start','aftermath','delve','scavenge','encore','recover','threshold','delirium','fathomless descent','descend 4','descend 8','undergrowth','harness','∞','collect evidence','gravestorm'],
  tokens:['populate','amass','incubate','fabricate','myriad','mobilize'],
  counters:['proliferate','adapt','bolster','support','evolve','graft','modular','outlast','mentor','reinforce','increment'],
  sacrifice:['exploit','casualty','emerge','devour','morbid','revolt'],
  spells:['prowess','magecraft','storm','cascade','splice','replicate','rebound','spell mastery','paradox'],
  artifacts:['affinity','improvise','metalcraft','living metal','craft'],
  enchantments:['constellation','bestow','eerie'],
  lifegain:['extort'],
  lands:['landfall','domain','awaken'],
  voltron:['reconfigure','for mirrodin!','living weapon','job select'],
  blink:['encore'],
  aggro:['battle cry','exalted','melee','raid','dash','annihilator','myriad','afflict','enlist','mobilize','pack tactics'],
  burn:['spectacle'],
  draw:['connive','hideaway']};
const KW_RE = (() => { const m = {}; for (const k in KW_THEMES) m[k] = new RegExp('(^|[^a-z])(' + KW_THEMES[k].map(w => w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|') + ')($|[^a-z])', 'i'); return m; })();
// A commander's engine (Build 139, UP.kw): what it makes (token kinds, counters), what sets it off (its triggers) and what it
// counts. Cards are then judged by how they feed it (see MECHANICS_NOTES.md, section 1): doublers, payoffs for what it makes,
// enablers of its triggers.
const TOKEN_KINDS = ['Treasure', 'Food', 'Clue', 'Blood', 'Map', 'Gold', 'Powerstone', 'Incubator', 'Junk', 'Shard', 'Walker', 'Role', 'Lander', 'Mutagen', 'Vibranium'];
function commanderEngine(cmds){ const E = {tokens:new Set(), creatureTokens:false, counters:false, fillsGY:false, trig:new Set(), types:new Set()};
  cmds.filter(Boolean).forEach(cmd => { const o = (cmd.o || '').replace(new RegExp(cmd.n.split(',')[0].replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g'), 'CARDNAME');
    (o.match(/\bcreates? [^.]*?tokens?\b|[^.]*\btokens?\b[^.]*\bcreated\b[^.]*/gi) || []).forEach(m => { TOKEN_KINDS.forEach(k => { if (new RegExp('\\b' + k + '\\b').test(m)) E.tokens.add(k); }); if (/creature tokens?/i.test(m)){ E.creatureTokens = true; (m.match(/\b[A-Z][a-z]+(?= (creature )?tokens?| [A-Z][a-z]+ creature token)/g) || []).filter(w => TRIBES.includes(w)).forEach(w => E.types.add(w)); } });
    if (/put (a|an|one|two|three|x|that many) \+1\/\+1 counters?|proliferate/i.test(o)) E.counters = true;
    if (/sacrifice (x|a|an|another|one or more|two|three)( other)? (creatures?|permanents?|artifacts?|tokens?)/i.test(o)) E.sacs = true;
    if (/\bmills?\b|into your graveyard|surveil|discard (a|two|that many) cards?/i.test(o) && !/from your graveyard to (your hand|the battlefield)/i.test(o.split(/\n/).find(l => /into your graveyard|\bmills?\b/i.test(l)) || '')) E.fillsGY = true;
    const T = [['cast-spell', /whenever you cast (an|a) (instant|sorcery)|whenever you cast (an|a) noncreature|magecraft|prowess/i], ['cast-creature', /whenever you cast a creature/i],
      ['etb', /whenever (a|another|one or more) [^.]{0,40}\benters\b/i], ['dies', /whenever (a|another|one or more)[^.]{0,40}\b(dies|die)\b|whenever you sacrifice|\bdying\b/i],
      ['attack', /whenever CARDNAME attacks|whenever (a|one or more) creatures? you control attack|deals combat damage to a player/i], ['life', /whenever you gain life/i],
      ['land', /landfall|whenever a land (you control )?enters/i], ['draw', /whenever you draw/i], ['discard', /whenever you discard/i], ['mill', /whenever [^.]{0,40}(put into your graveyard|mill)/i],
      ['token', /whenever you create a token|whenever one or more tokens/i], ['counter', /whenever (one or more )?\+1\/\+1 counters? (is|are) put/i]];
    T.forEach(([k, re]) => { if (re.test(o)) E.trig.add(k); }); });
  return E; }
// How a card fits the commander's engine: 1 a doubler of what it makes or of its triggers, 0.8 a payoff for what it makes,
// 0.6 an enabler of one of its triggers; with the reason shown.
function engineFit(c, E){ if (!E || !c) return {v:0}; const o = c.o || '', t = frontType(c), tg = tags(c);
  if (tags(c).land) return {v:0};
  const tokDouble = /(twice that many|that many plus one|create (twice|an additional|one additional))[^.]*tokens?|tokens? [^.]{0,40}(instead|twice that many)/i, cntDouble = /(twice that many|that many plus one|an additional)[^.]*counters?/i, trigDouble = /triggers? an additional time/i;
  if ((E.creatureTokens || E.tokens.size) && tokDouble.test(o)) return {v:1, why:'Doubles the tokens your commander makes'};
  if (E.counters && cntDouble.test(o)) return {v:1, why:'Doubles the counters your commander puts'};
  if (E.trig.size && trigDouble.test(o)) return {v:1, why:'Makes your commander’s abilities trigger twice'};
  for (const k of E.tokens) if (new RegExp('\\b' + k + '\\b').test(o)) return {v:0.8, why:'Uses the ' + k + ' tokens your commander makes'};
  if (E.creatureTokens && (/tokens? you control|whenever one or more (creature )?tokens|populate|creatures you control get \+|for each creature you control|sacrifice (a|another) creature[^.]*:/i.test(o))) return {v:0.8, why:'Pays off the creature tokens your commander makes'};
  for (const ty of E.types) if (new RegExp('\\b' + ty + 's?\\b').test(o) || new RegExp('\\b' + ty + '\\b').test(t)) return {v:0.8, why:'Works with your commander’s ' + ty + ' tokens'};
  if (E.counters && (/\+1\/\+1 counters? on|for each \+1\/\+1 counter|proliferate|with a \+1\/\+1 counter/i.test(o) || THEMES.counters.re.test(o))) return {v:0.8, why:'Uses the +1/+1 counters your commander puts'};
  if ((E.sacs || E.creatureTokens) && /whenever [^.]{0,30}\b(a|another|one or more)( other)?( nontoken)? creatures?( you control)?( die| dies)|whenever you sacrifice/i.test(o)) return {v:0.8, why:E.sacs ? 'Pays off the creatures your commander sacrifices' : 'Pays off the creature tokens your commander makes'};
  if (E.fillsGY && (tg.th.graveyard === 1 || /from (your|their|a|any|each) graveyards?|graveyard to the battlefield|cards? in your graveyard/i.test(o)) && !/exile (all|each|target player's) graveyards?|exile all cards from/i.test(o)) return {v:0.8, why:'Uses the cards your commander puts in your graveyard'};
  const en = {'cast-spell':() => /Instant|Sorcery/.test(t) && (c.cmc || 0) <= 3, 'cast-creature':() => /Creature/.test(t) && (c.cmc || 0) <= 3, etb:() => /Creature/.test(t) && (c.cmc || 0) <= 3 || /\bcreates? [^.]*creature tokens?/i.test(o) || ROLE_RE.blink.test(o),
    dies:() => /sacrifice (a|another|one or more) (creatures?|permanents?|artifacts?)[^.:]*:|each (opponent|player) sacrifices/i.test(o) || /\bcreates? [^.]*creature tokens?/i.test(o), attack:() => /\b(flying|menace|trample|can't be blocked|haste|additional combat|untap all creatures)\b/i.test(o),
    life:() => /gain [^.]{0,20}life|lifelink/i.test(o), land:() => /search your library for [^.]*land|play an additional land|additional land|lands? from your graveyard/i.test(o), draw:() => tg.roles.has('draw'),
    discard:() => /discard (a|one|two|that) cards?|connive/i.test(o), mill:() => /\bmills?\b|surveil|put the top [^.]* into your graveyard/i.test(o), token:() => /\bcreates?\b[^.]*\btokens?\b/i.test(o), counter:() => /\+1\/\+1 counters?|proliferate/i.test(o)};
  for (const k of E.trig) if (en[k] && en[k]()) return {v:0.6, why:'Sets off your commander (' + {'cast-spell':'casting spells', 'cast-creature':'casting creatures', etb:'creatures entering', dies:'creatures dying', attack:'attacking', life:'gaining life', land:'lands entering', draw:'drawing', discard:'discarding', mill:'cards going to your graveyard', token:'making tokens', counter:'+1/+1 counters'}[k] + ')'};
  return {v:0}; }
const ROLE_LABEL = {ramp:'Ramp', draw:'Card draw', removal:'Removal', wipe:'Board wipes'};
const LAND_WORDS = '(basic land|land|plains|island|swamp|mountain|forest)';
const ROLE_RE = {
  ramp: new RegExp('\\{T\\}[^.]{0,40}: Add |: Add \\{|adds? (an additional|one additional|\\{)|add (one|two|three|x) mana|search your library for [^.]*' + LAND_WORDS + ' cards?[^.]*onto the battlefield|land card from your hand onto the battlefield|(?<!controller )creates? [^.]*treasure token|additional land on each|play (an|one|two|three|x) additional lands?|untap target (forest|land)|produces? (twice|three times) as much|(lands?|permanents?) for mana, (add|it produces)|^(?![^\\n]*(its controller|that player|each opponent|their library))[^\\n]*search your library for [^.\\n]*land cards?[^.\\n]*\\.\\s*put (those|them|it|that card|one|the) [^.\\n]*onto the battlefield|(you may )?put (a|up to (one|two)|any number of|those) land cards? (from among them |from your graveyard )?onto the battlefield|land cards? are put into your graveyard[^.]*put them onto the battlefield|creature or land card[^.]*put it onto the battlefield tapped if it.s a land', 'im'),
  // one card or a few: destroy, exile, bounce, shrink, fight, bite, edict, lock down, turn into something harmless
  removal: /(destroy|exile) (up to (one|two|three|x) |x |two |three )?(other |another )?target (?!player|card|instant|sorcery|spell|non-|creature you control|creature card|artifacts, creatures|land\b)[^.]*(creature|permanent|artifact|enchantment|planeswalker|battle)|deals? (\d+|x|that much|twice that much) damage to (any target|(up to (one|two|three) )?(other |another )?target (attacking or blocking |attacking |blocking |tapped )?(creature|permanent|planeswalker))|damage equal to (its|their|that creature's|x|the number)[^.]{0,40} to (any target|(up to one |another |each of up to \w+ )?target (creature|permanent|planeswalker))|deals damage equal to its power to (any target|(another |up to one )?target|each of)|target creature gets -(\d+|x)|gets? -(\d+|x)\/-(\d+|x) until|return (up to (one|two) )?(another )?target (spell or )?(nonland permanent|creature|permanent)[^.]*to its owner's hand|fights? (up to one |another |a different |target )|owner of target permanent shuffles|exile that creature|target (player|opponent) sacrifices (a|an|two) (creature|permanent|nonland)|each (other )?(opponent|player) sacrifices (a|an|two|three|that many) (nontoken )?(creatures?|permanents?|nonland)|put (a|an|two|three|x) -1\/-1 counters? on (up to one )?target creature(?! you control)|enchanted (creature|permanent)[^.]* loses all other (abilities|card types)|enchanted (creature|permanent) is a colorless (land|forest)|put target (creature|nonland permanent|permanent)[^.]*(top|bottom) of its owner's library|enchanted (creature|permanent) (can't attack or block|can't attack, block|loses all abilities|doesn't untap)|target creature[^.]*loses all abilities|gain control of target (creature|permanent|artifact)/i,
  wipe: /(destroy|exile) (all|each) (?!lands)(creatures?|nontoken|nonland|artifacts?|enchantments?|permanents?|other|non)|deals? (\d+|x|that much) damage to each (creature|other creature|non|attacking|blocking)|damage to each creature|(all|each) (other )?creatures? gets? -|creatures (your opponents control|you don't control) get -(\d+|x)\/-|destroy all artifacts, creatures|return (all|each) (nonland|attacking|creature|other)[^.]*to (its|their) owner(s|'s|s')? hands?|(destroy|exile) (all|each) (?!lands?\b)([\w-]+ ){1,3}?(creatures|permanents|artifacts|enchantments)\b|put (x|a|an|two|three) -1\/-1 counters? on each creature|damage to each opponent and each creature|then sacrifices the rest|each player sacrifices (all|\w+ creatures)|sacrifices? all (creatures|permanents|nonland)|damage divided as you choose among any number of target creatures|each of those[^.]*fights a different|(destroy|exile|damage|return|gets -)[^]*\boverload\b/i,
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
// Fallback play data (Build 145): a commander with no EDHREC page of its own (or very little data) is built from EDHREC's theme
// pages instead: what decks of its creature type and its themes run in its colours ("In 41% of Zombies decks"). fallTags lists
// the pages: its tribe first, then its first theme (from its text, detectStrategy). parseTag reads one, leaving out the list
// of top commanders.
const TAG_OF = {tokens:'tokens', counters:'plus-1-plus-1-counters', graveyard:'graveyard', sacrifice:'aristocrats', spells:'spellslinger', artifacts:'artifacts', enchantments:'enchantress', lifegain:'lifegain', lands:'landfall', voltron:'voltron', blink:'blink', burn:'burn', aggro:'aggro', control:'control', draw:'card-draw'};
const COLOR_PAGE = {'':'colorless', W:'mono-white', U:'mono-blue', B:'mono-black', R:'mono-red', G:'mono-green', WU:'azorius', UB:'dimir', BR:'rakdos', RG:'gruul', WG:'selesnya', WB:'orzhov', UR:'izzet', BG:'golgari', WR:'boros', UG:'simic',
  WUB:'esper', UBR:'grixis', BRG:'jund', WRG:'naya', WUG:'bant', WBG:'abzan', WUR:'jeskai', UBG:'sultai', WBR:'mardu', URG:'temur', WUBR:'yore-tiller', UBRG:'glint-eye', WBRG:'dune-brood', WURG:'ink-treader', WUBG:'witch-maw', WUBRG:'five-color'};
const TRIBE_PL = {merfolk:'merfolk', myr:'myr', eldrazi:'eldrazi', kor:'kor', treefolk:'treefolk', samurai:'samurai', kithkin:'kithkin', vedalken:'vedalken', fish:'fish', elk:'elk', mouse:'mice', ox:'oxen', hero:'heroes', fungus:'fungi', pegasus:'pegasi', cyclops:'cyclopes', octopus:'octopuses', elf:'elves', wolf:'wolves', dwarf:'dwarves', werewolf:'werewolves'};
const tribeSlug = t => { const l = t.toLowerCase().replace(/ /g, '-'); return TRIBE_PL[l] || (/[^aeiou]y$/.test(l) ? l.slice(0, -1) + 'ies' : /(x|s|ch|sh)$/.test(l) ? l + 'es' : l + 's'); };
function fallTags(cmdName, partner){ const cmd = find(cmdName); if (!cmd) return []; const d = {format:'commander', commander:cmd.n, partner:partner || '', cards:[], aims:[]}, s = detectStrategy(cmd, d, true), par = partner && find(partner);
  const id = 'WUBRG'.split('').filter(k => cmd.ci.includes(k) || (par && par.ci.includes(k))).join(''), col = COLOR_PAGE[id] || '', out = [];
  if (s.tribe) out.push({slug:tribeSlug(s.tribe), label:s.tribe + ' decks'}); const th = s.themes.find(t => TAG_OF[t]); if (th) out.push({slug:TAG_OF[th], label:THEMES[th].label + ' decks'});
  return out.slice(0, 2).map(x => Object.assign(x, {col, path:x.slug + (col ? '/' + col : '')})); }
function parseTag(j){ const m = new Map(); (((j && j.container && j.container.json_dict) || {}).cardlists || []).forEach(L => { if (L.tag === 'topcommanders') return; (L.cardviews || []).forEach(v => { if (!v.name || !v.potential_decks) return;
  const inc = Math.min(1, v.num_decks / v.potential_decks), k = norm(v.name), o = m.get(k); if (!o || inc > o.inc) m.set(k, {inc, syn:+(v.synergy || 0)}); }); }); return m; }
const isEdhAim = a => typeof a === 'string' && a.startsWith('edh:');
function aimLabel(a, tribe){ if (isEdhAim(a)){ const t = (EDH.tags || []).find(x => 'edh:' + x.slug === a); return t ? t.label : a.slice(4).replace(/-/g, ' '); } return a === 'tribal' ? (tribe || 'Creature type') + ' tribal' : (THEMES[a] || {label:a}).label; }
// "Heroes: in 84% of Heroes decks" — the share of the commander's decks built around that theme that run the card.
function themeWhy(a, c){ const m = EDH.tmap && EDH.tmap[a.slice(4)], x = m && edhOf(m, c), L = aimLabel(a); return x ? L + ': in ' + Math.round(x.inc * 100) + '% of ' + L + ' decks' : L; }
// ----- goldfish simulator -----
// Plays seeded solo games (no opponents) to measure what a deck's mana and curve allow: when the commander comes down, how
// much mana gets used, how often colours strand spells, how often it floods or runs short of lands. It reads the cards'
// own text for mana (lands' colours and whether they enter tapped, rocks, creatures that tap for mana, land searches) and
// one-shot card draw; everything else is just a spell with a cost. These are resource measures, not win rates.
function rng32(seed){ let a = seed >>> 0; return () => { a = (a + 0x6D2B79F5) >>> 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
const NUMW = {a:1, an:1, one:1, two:2, three:3, four:4, five:5, six:6, seven:7};
function simCard(c, ident){
  if (c._sim) return c._sim; const t = frontType(c), o = (c.o || '').split(' // ')[0], land = tags(c).land, x = {land, cmc:c.cmc || 0, pips:{}, mana:0, cols:[], tapped:false, sick:false, ramp:0, draw:0,
    perm:!/^(Instant|Sorcery)/.test(t), creature:/Creature/.test(t), artifact:/Artifact/.test(t), power:/Creature/.test(t) ? (parseInt(String(c.pt || '0').split('/')[0], 10) || 0) : 0};
  // cost reductions the simulator can follow: total power of your creatures (Ghalta), one less per creature or artifact you control
  if (/costs \{X\} less to cast, where X is the total power of creatures you control/i.test(o)) x.redPower = true;
  { const m = /costs \{1\} less to cast for each (creature|artifact) you control/i.exec(o); if (m) x.redEach = m[1].toLowerCase(); }
  ((c.m || '').match(/\{[^}]+\}/g) || []).forEach(p => { const k = p.slice(1, -1); if (/^[WUBRG]$/.test(k)) x.pips[k] = (x.pips[k] || 0) + 1; else if (/^[WUBRG]\/[WUBRG]$/.test(k)) x.pips[k] = (x.pips[k] || 0) + 1; });
  if (land){ x.mana = 1; x.cols = [...landColors(c)]; const sp = landSpeed(c); x.tapped = sp === 'tapped'; x.cond = sp === 'cond'; if (!x.cols.length && /\{C\}/.test(o)) x.cols = ['C'];
    if (/search your library for/i.test(o) && /sacrifice/i.test(o)){ x.fetch = true; x.tapped = x.tapped || /tapped/i.test(o); x.fetchBasic = /basic land/i.test(o); x.fetchTypes = Object.keys(LTYPE).filter(k => new RegExp('\\b' + k + '\\b').test(o)); }
    if (/choose a colou?r/i.test(o) && /chosen colou?r/i.test(o)){ x.chosen = true; x.fixed = ((/Add ([^.]*)/i.exec(o) || [])[1] || '').match(/\{[WUBRG]\}/g) || []; x.fixed = x.fixed.map(q => q[1]); } }
  else {
    const add = /\{T\}[^.]{0,40}: Add ([^.]*)/i.exec(o);
    if (add && !/Spend this mana only/i.test(o)){ const sy = (add[1].match(/\{[WUBRGC]\}/g) || []); x.mana = Math.max(1, sy.length > 1 && !/ or /.test(add[1]) ? sy.length : 1);
      x.cols = /any colou?r|any type/i.test(add[1]) ? 'WUBRG'.split('') : [...new Set(sy.map(q => q[1]))]; x.sick = /Creature/.test(t) && !/\bhaste\b/i.test(o); x.tappedRock = /enters tapped/i.test(o); }
    const srch = /search your library for (up to (one|two|three) |an? |two |three )?(basic land|basic|land|[A-Z][a-z]+ or [A-Z][a-z]+|Forest|Plains|Island|Swamp|Mountain)[^.]*?cards?[^.]*?onto the battlefield/i.exec(o);
    if (srch){ x.ramp = /up to two|two /i.test(srch[0]) && !/one onto the battlefield|put one/i.test(o) ? 2 : 1; x.rampHand = /into your hand/i.test(o) ? 1 : 0; }
    const dr = /draws? (a|an|one|two|three|four|five|six|seven|\d+) cards?/i.exec(o); if (dr && !/whenever|at the beginning|each player/i.test(o.slice(Math.max(0, dr.index - 60), dr.index))) x.draw = NUMW[dr[1].toLowerCase()] || +dr[1] || 0;
  }
  return c._sim = x;
}
// Can these pips be paid from these sources (each source: list of colours it can make)? Generic is paid from the rest.
function payable(pips, generic, srcs){
  const need = []; Object.entries(pips).forEach(([k, n]) => { for (let i = 0; i < n; i++) need.push(k.split('/')); }); if (need.length + generic > srcs.length) return null;
  const used = new Array(srcs.length).fill(false), order = srcs.map((s, i) => i).sort((a, b) => srcs[a].length - srcs[b].length);
  for (const opts of need){ const i = order.find(j => !used[j] && opts.some(k => srcs[j].includes(k))); if (i == null) return null; used[i] = true; }
  let g = generic; for (const j of order){ if (g <= 0) break; if (!used[j]){ used[j] = true; g--; } } return g > 0 ? null : used;
}
// Lands in practice games (Build 137, UP.lfix): a fetch land makes only the colours of the lands it can find in this deck (Wooded
// Foothills: Mountains and Forests, so red and green, or a dual with those types), and a "choose a colour" land makes its fixed
// colour plus the one colour chosen as it enters (the colour the hand needs most).
function fetchReach(lib0, ident){ const basics = new Set(), typed = {}; lib0.forEach(c => { if (!tags(c).land) return; const t = frontType(c);
  Object.keys(LTYPE).forEach(k => { if (new RegExp('\\b' + k + '\\b').test(t)){ const cols = [...landColors(c)].filter(z => ident.includes(z)); (typed[k] = typed[k] || new Set()); cols.forEach(z => typed[k].add(z)); if (/Basic/.test(t)) basics.add(LTYPE[k]); } }); });
  return {basics, typed}; }
function simLandCols(c, s, ident, reach, needCol, have, colsOf){
  if (s.fetch){ const out = new Set(); if (s.fetchBasic) reach.basics.forEach(z => out.add(z)); (s.fetchTypes || []).forEach(k => (reach.typed[k] || []).forEach(z => out.add(z))); const v = [...out].filter(z => ident.includes(z)); return v.length ? v : ['C']; }
  if (s.chosen){ const fx = (s.fixed || []).filter(z => ident.includes(z)), want = ident.filter(z => !fx.includes(z)), pick = want.find(z => needCol.has(z) && !have.has(z)) || want.find(z => !have.has(z)) || want[0]; return fx.concat(pick ? [pick] : []).length ? fx.concat(pick ? [pick] : []) : ['C']; }
  return colsOf(s); }
function simulate(d, games, seed){
  const ctx = ctxOf(d), ident = ctx.ident.length ? ctx.ident : ['C'], cmds = [d.commander, d.partner].filter(Boolean).map(find).filter(Boolean);
  const lib0 = []; d.cards.forEach(e => { const c = find(e.n); if (c) for (let i = 0; i < e.q; i++) lib0.push(c); }); const reach = UP.lfix ? fetchReach(lib0, ident) : null;
  const R = {games:games || 500, cmdTurn:[], spent:[0, 0, 0, 0, 0, 0, 0, 0], colourStuck:0, screw:0, flood:0, landsT4:[], noPlayT3:0, mull:0}, rnd = rng32(seed || 1);
  const colsOf = s => s.cols.length ? s.cols.filter(k => k === 'C' || ident.includes(k)) : ['C'];
  for (let g = 0; g < R.games; g++){
    let lib = lib0.slice(), hand = []; const shuffle = () => { for (let i = lib.length - 1; i > 0; i--){ const j = Math.floor(rnd() * (i + 1)); [lib[i], lib[j]] = [lib[j], lib[i]]; } };
    shuffle(); hand = lib.splice(0, 7); const nl = () => hand.filter(c => simCard(c, ident).land).length;
    if (nl() < 2 || nl() > 5){ R.mull++; lib = lib.concat(hand); shuffle(); hand = lib.splice(0, 7); const h = hand.map(c => simCard(c, ident)); // keep 7, bottom the worst one (a spare land or the costliest spell)
      const spare = nl() > 4 ? hand.findIndex(c => simCard(c, ident).land) : hand.reduce((b, c, i) => simCard(c, ident).land ? b : (b < 0 || c.cmc > hand[b].cmc ? i : b), -1); if (spare >= 0) lib.push(hand.splice(spare, 1)[0]); }
    const bf = [], cz = cmds.slice(); let cmdT = 0, stuckAny = false, ramped = 0;
    for (let turn = 1; turn <= 10; turn++){
      if (turn > 1 || true) { if (lib.length) hand.push(lib.shift()); }   // multiplayer Commander: everyone draws on turn 1
      bf.forEach(s => { s.sickNow = false; if (s.wake === turn) s.tappedNow = false; });
      // land: the untapped one adding a colour the hand needs, else any
      const lands = hand.map((c, i) => [c, i]).filter(([c]) => simCard(c, ident).land);
      if (lands.length){ const needCol = new Set(); hand.forEach(c => Object.keys(simCard(c, ident).pips).forEach(k => k.split('/').forEach(z => needCol.add(z))));
        const have = new Set(bf.flatMap(s => colsOf(s)));
        const score = ([c]) => { const s = simCard(c, ident); return colsOf(s).filter(k => needCol.has(k) && !have.has(k)).length * 2 + (s.tapped ? 0 : 1) + (s.cond && bf.length >= 2 ? 1 : 0); };
        const [c, i] = lands.sort((a, b) => score(b) - score(a))[0], s = simCard(c, ident); hand.splice(i, 1);
        const tap = s.tapped || (s.cond && bf.filter(z => z.land).length < 2); bf.push(Object.assign({}, s, {tappedNow:tap, land:true, cols:UP.lfix ? simLandCols(c, s, ident, reach, needCol, have, colsOf) : s.fetch ? ident.slice() : colsOf(s)})); }
      // spend mana: commander first, then mana sources, then card draw, then the costliest castable spell
      let spent = 0;
      for (let k = 0; k < 12; k++){
        const srcs = bf.filter(s => s.mana && !s.tappedNow && !s.sickNow && !s.used), pool = []; srcs.forEach(s => { for (let m = 0; m < s.mana; m++) pool.push({s, cols:s.cols.length ? s.cols : ['C']}); });
        const red = x => x.redPower ? bf.reduce((a, s) => a + (s.power || 0), 0) : x.redEach ? bf.filter(s => x.redEach === 'creature' ? s.creature : s.artifact).length : 0;
        const costOf = c => { const x = simCard(c, ident), pp = Object.values(x.pips).reduce((a, b) => a + b, 0); return pp + Math.max(0, c.cmc - pp - red(x)); };
        const can = c => { const x = simCard(c, ident), pp = Object.values(x.pips).reduce((a, b) => a + b, 0), gen = Math.max(0, c.cmc - pp - red(x)); return payable(x.pips, gen, pool.map(p => p.cols)); };
        let pick = null, from = null, use = null;
        for (const c of cz){ const u = can(c); if (u){ pick = c; from = 'cz'; use = u; break; } }
        if (!pick){ const opts = hand.map((c, i) => ({c, i, x:simCard(c, ident)})).filter(o => !o.x.land).map(o => Object.assign(o, {u:can(o.c)})).filter(o => o.u);
          const pri = o => (o.x.mana || o.x.ramp ? 100 : 0) + (o.x.draw ? 50 : 0) + costOf(o.c); opts.sort((a, b) => pri(b) - pri(a)); if (opts.length){ pick = opts[0].c; from = opts[0].i; use = opts[0].u; } }
        if (!pick){   // stuck on colour: enough mana sources for a spell, but a colour it needs is made by none of them
          const have = new Set(bf.filter(z => z.mana).flatMap(z => z.cols.length ? z.cols : ['C'])), nSrc = bf.filter(z => z.mana).reduce((a, z) => a + z.mana, 0);
          if (hand.some(c => { const x = simCard(c, ident); return !x.land && c.cmc <= nSrc && Object.keys(x.pips).some(k => !k.split('/').some(z => have.has(z))); })) stuckAny = stuckAny || turn <= 6; break; }
        use.forEach((u, j) => { if (u) pool[j].s.usedCount = (pool[j].s.usedCount || 0) + 1; }); srcs.forEach(s => { if ((s.usedCount || 0) >= s.mana) s.used = true; s.usedCount = s.usedCount || 0; });
        spent += costOf(pick); const x = simCard(pick, ident);
        if (from === 'cz'){ cz.splice(cz.indexOf(pick), 1); if (!cmdT) cmdT = turn; } else hand.splice(from, 1);
        if (x.mana) bf.push(Object.assign({}, x, {sickNow:x.sick, tappedNow:!!x.tappedRock, cols:x.cols.length ? x.cols.filter(k => ident.includes(k)) : ['C']}));
        else if (x.perm) bf.push({mana:0, cols:[], power:x.power, creature:x.creature, artifact:x.artifact});
        if (x.ramp){ ramped += x.ramp; for (let r = 0; r < x.ramp; r++) bf.push({land:true, mana:1, cols:ident.slice(), tappedNow:true, wake:turn + 1}); if (x.rampHand) hand.push({n:'(basic)', cmc:0, m:'', t:'Basic Land', o:'', _sim:{land:true, mana:1, cols:ident.slice(), pips:{}, cmc:0}, ci:[]}); }
        for (let q = 0; q < (x.draw || 0); q++) if (lib.length) hand.push(lib.shift());
      }
      bf.forEach(s => { s.used = false; s.usedCount = 0; s.tappedNow = false; });
      if (turn <= 8) R.spent[turn - 1] += spent;
      const L = bf.filter(s => s.land).length; if (turn === 4) R.landsT4.push(L); if (turn === 3 && !spent && !cmdT) R.noPlayT3++;
      if (turn === 5 && L < 4) R.screw++; if (turn === 8 && L + hand.filter(c => simCard(c, ident).land).length - ramped >= 9) R.flood++;   // flood: 9+ of the ~15 cards seen by turn 8 are lands
    }
    R.cmdTurn.push(cmdT || 11); if (stuckAny) R.colourStuck++;
  }
  const n = R.games, med = a => a.slice().sort((x, y) => x - y)[a.length >> 1];
  return {games:n, cmdMedianTurn:med(R.cmdTurn), cmdByT4:R.cmdTurn.filter(t => t <= 4).length / n, cmdByT6:R.cmdTurn.filter(t => t <= 6).length / n,
    manaSpentT1to8:R.spent.map(v => +(v / n).toFixed(2)), manaUsedBy6:+(R.spent.slice(0, 6).reduce((a, b) => a + b, 0) / n).toFixed(1),
    colourStuck:+(R.colourStuck / n).toFixed(3), screwT5:+(R.screw / n).toFixed(3), floodT8:+(R.flood / n).toFixed(3), mulligan:+(R.mull / n).toFixed(3), landsT4:+(R.landsT4.reduce((a, b) => a + b, 0) / n).toFixed(2)};
}
// Visible practice games (Build 136): the same games as simulate(), step by step, for the Practice panel. A copy that also
// records each turn, so simulate() (the deck score's 300 games) stays exactly as it is; a test checks both agree game for game.
function practiceGames(d, games, seed){
  const ctx = ctxOf(d), ident = ctx.ident.length ? ctx.ident : ['C'], cmds = [d.commander, d.partner].filter(Boolean).map(find).filter(Boolean);
  const lib0 = []; d.cards.forEach(e => { const c = find(e.n); if (c) for (let i = 0; i < e.q; i++) lib0.push(c); }); const reach = UP.lfix ? fetchReach(lib0, ident) : null;
  const R = {games:games || 500, cmdTurn:[], spent:[0, 0, 0, 0, 0, 0, 0, 0], colourStuck:0, screw:0, flood:0, landsT4:[], noPlayT3:0, mull:0}, rnd = rng32(seed || 1), logs = [], nm = c => c ? c.n : '';
  const colsOf = s => s.cols.length ? s.cols.filter(k => k === 'C' || ident.includes(k)) : ['C'];
  for (let g = 0; g < R.games; g++){
    let lib = lib0.slice(), hand = []; const shuffle = () => { for (let i = lib.length - 1; i > 0; i--){ const j = Math.floor(rnd() * (i + 1)); [lib[i], lib[j]] = [lib[j], lib[i]]; } };
    shuffle(); hand = lib.splice(0, 7); const G = {hand0:hand.map(nm), mull:false, bottom:'', turns:[]}; logs.push(G); const nl = () => hand.filter(c => simCard(c, ident).land).length;
    if (nl() < 2 || nl() > 5){ R.mull++; lib = lib.concat(hand); shuffle(); hand = lib.splice(0, 7); const h = hand.map(c => simCard(c, ident)); // keep 7, bottom the worst one (a spare land or the costliest spell)
      const spare = nl() > 4 ? hand.findIndex(c => simCard(c, ident).land) : hand.reduce((b, c, i) => simCard(c, ident).land ? b : (b < 0 || c.cmc > hand[b].cmc ? i : b), -1); if (spare >= 0){ G.bottom = nm(hand[spare]); lib.push(hand.splice(spare, 1)[0]); } G.mull = true; G.hand1 = hand.map(nm); }
    const bf = [], cz = cmds.slice(); let cmdT = 0, stuckAny = false, ramped = 0;
    for (let turn = 1; turn <= 10; turn++){
      const T = {turn, draw:'', land:'', tapped:false, cast:[], mana:0, spent:0}; G.turns.push(T);
      if (turn > 1 || true) { if (lib.length){ T.draw = nm(lib[0]); hand.push(lib.shift()); } }   // multiplayer Commander: everyone draws on turn 1
      bf.forEach(s => { s.sickNow = false; if (s.wake === turn) s.tappedNow = false; });
      // land: the untapped one adding a colour the hand needs, else any
      const lands = hand.map((c, i) => [c, i]).filter(([c]) => simCard(c, ident).land);
      if (lands.length){ const needCol = new Set(); hand.forEach(c => Object.keys(simCard(c, ident).pips).forEach(k => k.split('/').forEach(z => needCol.add(z))));
        const have = new Set(bf.flatMap(s => colsOf(s)));
        const score = ([c]) => { const s = simCard(c, ident); return colsOf(s).filter(k => needCol.has(k) && !have.has(k)).length * 2 + (s.tapped ? 0 : 1) + (s.cond && bf.length >= 2 ? 1 : 0); };
        const [c, i] = lands.sort((a, b) => score(b) - score(a))[0], s = simCard(c, ident); hand.splice(i, 1); T.land = c.n;
        const tap = s.tapped || (s.cond && bf.filter(z => z.land).length < 2); bf.push(Object.assign({}, s, {tappedNow:tap, land:true, cols:UP.lfix ? simLandCols(c, s, ident, reach, needCol, have, colsOf) : s.fetch ? ident.slice() : colsOf(s)})); T.tapped = !!tap; }
      // spend mana: commander first, then mana sources, then card draw, then the costliest castable spell
      let spent = 0; T.mana = bf.filter(s => s.mana && !s.tappedNow && !s.sickNow).reduce((a, s) => a + s.mana, 0);
      for (let k = 0; k < 12; k++){
        const srcs = bf.filter(s => s.mana && !s.tappedNow && !s.sickNow && !s.used), pool = []; srcs.forEach(s => { for (let m = 0; m < s.mana; m++) pool.push({s, cols:s.cols.length ? s.cols : ['C']}); });
        const red = x => x.redPower ? bf.reduce((a, s) => a + (s.power || 0), 0) : x.redEach ? bf.filter(s => x.redEach === 'creature' ? s.creature : s.artifact).length : 0;
        const costOf = c => { const x = simCard(c, ident), pp = Object.values(x.pips).reduce((a, b) => a + b, 0); return pp + Math.max(0, c.cmc - pp - red(x)); };
        const can = c => { const x = simCard(c, ident), pp = Object.values(x.pips).reduce((a, b) => a + b, 0), gen = Math.max(0, c.cmc - pp - red(x)); return payable(x.pips, gen, pool.map(p => p.cols)); };
        let pick = null, from = null, use = null;
        for (const c of cz){ const u = can(c); if (u){ pick = c; from = 'cz'; use = u; break; } }
        if (!pick){ const opts = hand.map((c, i) => ({c, i, x:simCard(c, ident)})).filter(o => !o.x.land).map(o => Object.assign(o, {u:can(o.c)})).filter(o => o.u);
          const pri = o => (o.x.mana || o.x.ramp ? 100 : 0) + (o.x.draw ? 50 : 0) + costOf(o.c); opts.sort((a, b) => pri(b) - pri(a)); if (opts.length){ pick = opts[0].c; from = opts[0].i; use = opts[0].u; } }
        if (!pick){   // stuck on colour: enough mana sources for a spell, but a colour it needs is made by none of them
          const have = new Set(bf.filter(z => z.mana).flatMap(z => z.cols.length ? z.cols : ['C'])), nSrc = bf.filter(z => z.mana).reduce((a, z) => a + z.mana, 0);
          if (hand.some(c => { const x = simCard(c, ident); return !x.land && c.cmc <= nSrc && Object.keys(x.pips).some(k => !k.split('/').some(z => have.has(z))); })) stuckAny = stuckAny || turn <= 6; break; }
        use.forEach((u, j) => { if (u) pool[j].s.usedCount = (pool[j].s.usedCount || 0) + 1; }); srcs.forEach(s => { if ((s.usedCount || 0) >= s.mana) s.used = true; s.usedCount = s.usedCount || 0; });
        spent += costOf(pick); const x = simCard(pick, ident); T.cast.push({n:pick.n, cmd:from === 'cz', cost:costOf(pick)});
        if (from === 'cz'){ cz.splice(cz.indexOf(pick), 1); if (!cmdT) cmdT = turn; } else hand.splice(from, 1);
        if (x.mana) bf.push(Object.assign({}, x, {sickNow:x.sick, tappedNow:!!x.tappedRock, cols:x.cols.length ? x.cols.filter(k => ident.includes(k)) : ['C']}));
        else if (x.perm) bf.push({mana:0, cols:[], power:x.power, creature:x.creature, artifact:x.artifact});
        if (x.ramp){ ramped += x.ramp; for (let r = 0; r < x.ramp; r++) bf.push({land:true, mana:1, cols:ident.slice(), tappedNow:true, wake:turn + 1}); if (x.rampHand) hand.push({n:'(basic)', cmc:0, m:'', t:'Basic Land', o:'', _sim:{land:true, mana:1, cols:ident.slice(), pips:{}, cmc:0}, ci:[]}); }
        for (let q = 0; q < (x.draw || 0); q++) if (lib.length) hand.push(lib.shift());
      }
      bf.forEach(s => { s.used = false; s.usedCount = 0; s.tappedNow = false; });
      T.spent = spent; if (turn <= 8) R.spent[turn - 1] += spent;
      const L = bf.filter(s => s.land).length; if (turn === 4) R.landsT4.push(L); if (turn === 3 && !spent && !cmdT) R.noPlayT3++;
      if (turn === 5 && L < 4) R.screw++; if (turn === 8 && L + hand.filter(c => simCard(c, ident).land).length - ramped >= 9) R.flood++;   // flood: 9+ of the ~15 cards seen by turn 8 are lands
    }
    R.cmdTurn.push(cmdT || 11); if (stuckAny) R.colourStuck++; G.cmdTurn = cmdT || 0; G.stuck = stuckAny;
  }
  const n = R.games, med = a => a.slice().sort((x, y) => x - y)[a.length >> 1];
  return {logs, games:n, cmdMedianTurn:med(R.cmdTurn), cmdByT4:R.cmdTurn.filter(t => t <= 4).length / n, cmdByT6:R.cmdTurn.filter(t => t <= 6).length / n,
    manaSpentT1to8:R.spent.map(v => +(v / n).toFixed(2)), manaUsedBy6:+(R.spent.slice(0, 6).reduce((a, b) => a + b, 0) / n).toFixed(1),
    colourStuck:+(R.colourStuck / n).toFixed(3), screwT5:+(R.screw / n).toFixed(3), floodT8:+(R.flood / n).toFixed(3), mulligan:+(R.mull / n).toFixed(3), landsT4:+(R.landsT4.reduce((a, b) => a + b, 0) / n).toFixed(2)};
}
// ----- combos (Commander Spellbook, via the card-data job; see tools/build-combos.mjs) -----
// COMBOS.list: {keys, names, ci, win, what, decks, bt, note}; COMBOS.by: card key -> combos it is in.
let COMBOS = {list:[], by:new Map(), at:'', state:''};
function useCombos(j){ const list = [], by = new Map();
  ((j && j.combos) || []).forEach(r => { const names = r[0].map(i => j.cards[i]), cs = names.map(n => find(n)); if (cs.some(c => !c)) return;
    const x = {keys:cs.map(c => c._k), names:cs.map(c => c.n), ci:r[1], win:r[2] === 'w', what:r[3], decks:r[4], bt:r[5], note:r[6] || ''}; list.push(x); x.keys.forEach(k => { if (!by.has(k)) by.set(k, []); by.get(k).push(x); }); });
  COMBOS = {list, by, at:(j && j.at) || '', state:list.length ? 'ok' : 'empty'}; return list.length; }
// Combos a deck has (every card present, the commanders included) and is one card short of (the missing card legal here).
function combosOf(d, ident){
  const have = new Set((d.cards || []).map(e => keyOf(e.n)).concat([d.commander, d.partner].filter(Boolean).map(keyOf))), full = [], near = [], seen = new Set();
  have.forEach(k => (COMBOS.by.get(k) || []).forEach(x => { if (seen.has(x)) return; seen.add(x); const miss = x.keys.filter(q => !have.has(q));
    if (!miss.length) full.push(x); else if (miss.length === 1 && x.ci.split('').every(z => z === 'C' || (ident || []).includes(z))) near.push({x, miss:x.names[x.keys.indexOf(miss[0])]}); }));
  return {full, near};
}
// ----- card effects: structured reading of Oracle text -----
// Each sentence (or mode of a modal spell) is read into an effect with its trigger, cost, timing, condition and limits.
// Patterns the reader does not support stay in `unknown`: they are never given an invented role. The Oracle text hash
// (`hash`) marks which text an effect list was read from, so changed text invalidates it.
const NUM = {a:1, an:1, one:1, two:2, three:3, four:4, five:5, six:6, seven:7, x:'X', that:'X'};
const NONCREATURE_TOKENS = /\b(Treasure|Food|Clue|Blood|Map|Powerstone|Gold|Shard|Incubator|Junk|Vibranium|Lander|Mutagen|Role|Walker|Aura)\b token/i;
function oracleHash(s){ let h = 2166136261 >>> 0; for (let i = 0; i < s.length; i++){ h ^= s.charCodeAt(i); h = Math.imul(h, 16777619) >>> 0; } return h.toString(36); }
function effectsOf(c){
  if (!c) return null; if (c._fx && c._fxSrc === c.o) return c._fx;   // same text object: same reading
  const o0 = (c.o || '').split(' // ')[0], hash = oracleHash(o0); if (c._fx && c._fx.hash === hash){ c._fxSrc = c.o; return c._fx; }
  const t = frontType(c), creature = /Creature/.test(t), instant = /Instant/.test(t) || /\bFlash\b/.test(o0), out = {hash, effects:[], unknown:[], modal:/Choose (one|two|any number|one or more|up to)/i.test(o0)};
  const haste = /\bhaste\b/i.test(o0), push = (kind, x, src) => out.effects.push(Object.assign({kind, text:src.trim().slice(0, 140)}, x));
  // reminder text explains keywords; quoted token abilities are kept (the token's own mana ability matters)
  const body = o0.replace(/\((?![^)]*"\{T\})[^)]*\)/g, '').replace(/[ \t]+/g, ' ');
  const lines = body.split(/\n/).flatMap(l => /^•/.test(l.trim()) ? [l.trim().slice(1).trim()] : l.split(/(?<=\.)\s+(?=[A-Z{])/)).map(x => x.trim()).filter(Boolean);
  for (let i = 0; i < lines.length; i++){
    const s = lines[i], next = lines[i + 1] || '', n0 = out.effects.length;
    const trig = /^(Whenever|When|At the beginning)/i.test(s) ? 'trigger' : /^[^"]*:\s/.test(s) && !/^Choose/i.test(s) ? 'activated' : 'static';
    const cost = trig === 'activated' ? s.slice(0, s.indexOf(':')) : '', cond = (/^(Whenever|When|At the beginning of)[^,]*,/i.exec(s) || [''])[0].replace(/,$/, '');
    if (/^(Flying|Trample|Haste|Vigilance|Lifelink|Deathtouch|Menace|Reach|First strike|Double strike|Indestructible|Hexproof|Defender|Flash|Ward|Partner|Changeling|Prowess|Convoke|Equip|Enchant|Crew|Affinity|Landfall —$)[^.]*\.?$/i.test(s) || /^(Choose one|Choose two|Choose any)/i.test(s)) continue;
    // mana: "{T}: Add …", quoted token abilities, Treasure; with any restriction on what the mana can cast
    let m;
    if (!/\bTreasure token/i.test(s) && (m = /(\{T\}[^:"]*|[^":]*\{T\}[^:"]*): Add ([^."]*)/i.exec(s))){
      const syms = (m[2].match(/\{[WUBRGC]\}/g) || []), any = /any (one )?colou?r|any combination of colou?rs|any type/i.test(m[2]), amt = /\bX mana\b|X mana in any/i.test(m[2]) ? 'X' : (NUM[(/\b(one|two|three|four|five) mana\b/i.exec(m[2]) || [])[1]] || (/ or /.test(m[2]) ? 1 : Math.max(1, syms.length)));
      const rs = /can't be spent to cast (a |an )?non(\w+) spell/i.exec(s + ' ' + next) || /Spend this mana only (?:to cast|on) (?:a |an )?(\w+)/i.exec(s + ' ' + next), restrict = rs ? (rs[2] || rs[1]).toLowerCase().replace(/s$/, '') : '';
      const token = /create[^"]*token[^"]*"/i.test(s);
      push('mana', {amount:amt, colors:any ? 'WUBRG'.split('') : [...new Set(syms.map(x => x[1]))], restrict, source:token ? 'token' : creature ? 'creature' : 'permanent', sick:creature && !haste && !token, cost:m[1].replace(/\{T\}/, '').replace(/^,\s*/, '').trim(), tapped:/create a tapped/i.test(s)}, s);
    }
    if (/\bTreasure token/i.test(s) && /\bcreates?\b/i.test(s)) push('mana', {amount:1, colors:'WUBRG'.split(''), restrict:'', source:'treasure', once:true, cond}, s);
    if ((m = /search your library for (?:up to (\w+) |an? |(\w+) )?([^.]*?)(lands?|Plains|Island|Swamp|Mountain|Forest)( cards?)?[^.]*?(onto the battlefield|into your hand)/i.exec(s)) && !/creature card/i.test(s)) { const n = NUM[(m[1] || m[2] || 'a').toLowerCase()] || 1, split = /put one onto the battlefield[^.]*and the other into your hand/i.test(s); push('landramp', {n:split ? 1 : m[6] === 'into your hand' ? 0 : n, toHand:split ? 1 : m[6] === 'into your hand' ? n : 0, tapped:/tapped/.test(s)}, s); }
    // card flow: draw (with net, symmetry and condition), filtering (loot, rummage, connive), monarch, top-library play
    m = null; if (!/discard (a|one|two) cards?, then draw/i.test(s)) { m = /\b(you |each player |its controller |target player |that player |each opponent )?(?:may )?draws? (a|an|one|two|three|four|five|six|seven|x|that many|\d+) (?:additional )?cards?|draw cards equal to ([^.,]+)/i.exec(s); if (m && m.index < cond.length) m = null; }
    if (m){
      const who = (m[1] || 'you ').trim(), n = m[3] ? 'X' : (NUM[(m[2] || '').toLowerCase()] || +m[2] || 'X'), dis = /then discard (a|an|one|two|three|\d+) cards?/i.exec(s), dn = dis ? NUM[dis[1].toLowerCase()] || +dis[1] : 0;
      const symmetric = /^(each player|its controller)$/i.test(who) && !/each opponent/i.test(who);
      if (dn && dn >= (typeof n === 'number' ? n : 99)) push('filter', {n, discard:dn, cond, cost}, s);
      else push('draw', {n, who, symmetric, discard:dn, net:typeof n === 'number' ? n - dn : 'X', cond, cost, scale:m[3] ? m[3].trim() : '', repeat:trig !== 'static'}, s);
    }
    if (/\bconnives?\b/i.test(s)) push('filter', {n:1, discard:1, connive:true, cond}, s);
    if (/discard (a|one|two) cards?, then draw/i.test(s)) push('filter', {n:1, discard:1, rummage:true, cond, cost}, s);
    if (/you become the monarch/i.test(s)) push('monarch', {cond}, s);
    if (/you take the initiative|take the initiative/i.test(s)) push('initiative', {cond}, s);
    if ((m = /(?:cast|play) ([^.]*?) from the top of your library/i.exec(s))) push('topcast', {filter:m[1].replace(/^(the top card of your library if it's an? )/, '').trim()}, s);
    else if (/look at the top card of your library (at )?any time/i.test(s)) push('peek', {}, s);
    if (/exile the top (\w+ )?cards? of your library[^.]*\.?/i.test(s) && /(you may (play|cast)|until (the )?end of (your next )?turn)/i.test(s + ' ' + next)) push('impulse', {cond, cost}, s);
    else if (/exile the top card of your library/i.test(s) && trig === 'activated') push('mill-self', {cost}, s);
    if (ROLE_RE.tutor.test(s) && !/onto the battlefield tapped/.test(s) && !/(lands?|Plains|Island|Swamp|Mountain|Forest)( cards?)? [^.]*(onto the battlefield|into your hand)/i.test(s)) push('tutor', {cond, cost}, s);
    if (/return [^.]*from (your|a) graveyard to (the battlefield|your hand)/i.test(s)) push('recursion', {to:/battlefield/.test(s) ? 'battlefield' : 'hand', cond, cost}, s);
    // interaction: one target or many, what it hits, and when it can be used
    if ((m = /(destroy|exile) (x|up to (?:one|two|three|x)|one|two|three)? ?(?:other |another )?target ([^.]*?)(creatures?|permanents?|artifacts?(?: and\/or enchantments?)?|enchantments?|planeswalkers?|lands?)\b/i.exec(s)) && !/you control/i.test(m[3]))
      push('removal', {how:m[1].toLowerCase(), count:(m[2] || 'one').toLowerCase().replace('up to ', ''), hits:m[4].toLowerCase(), speed:instant || trig === 'activated' ? 'instant' : trig === 'trigger' ? 'trigger' : 'sorcery', cond, cost}, s);
    else if (ROLE_RE.removal.test(s)) push('removal', {how:'other', count:'one', hits:'', speed:instant || trig === 'activated' ? 'instant' : trig === 'trigger' ? 'trigger' : 'sorcery', cond, cost}, s);
    if (ROLE_RE.wipe.test(s)) push('wipe', {speed:instant ? 'instant' : 'sorcery', cond}, s);
    if (ROLE_RE.counter.test(s)) push('counter', {cond, cost}, s);
    if (ROLE_RE.protect.test(s)) push('protect', {cond, cost}, s);
    // board: team pumps (and who they include), tokens (creature or not), cost reductions, sacrifice outlets
    if ((m = /((?:other |non-?\w+ |\w+ )?)creatures you control get \+(\d+|x)\/\+(\d+|x)/i.exec(s))) push('pump', {who:m[1].trim() || 'all', p:m[2], until:/until end of turn/i.test(s) ? 'turn' : 'static', cond}, s);
    if ((m = /creates? ([^.]*?)\btokens?\b([^.]*)/i.exec(s))){ const tx = m[0], copyCr = /copy of (equipped|enchanted|target|another target|that|it|a|each)[^.]*creature|copy of (equipped|enchanted) /i.test(tx);
      const cr = copyCr || (!/\bcopy\b/i.test(m[1]) && (/creature token/i.test(tx) || /\d+\/\d+/.test(tx) || (!NONCREATURE_TOKENS.test(tx) && /\b[A-Z][a-z]+ (?:and \w+ )?tokens?/.test(tx) && !/Treasure|Food|Clue|Vibranium|Map|Blood|Powerstone|Gold/.test(tx))));
      // a token given to someone else (Beast Within, Generous Gift: "its controller creates") is not yours
      const theirs = /(its controller|that player|target player|target opponent|each opponent|each other player|that creature's controller|that permanent's controller) creates?/i.test(s.slice(Math.max(0, m.index - 40), m.index + 8));
      push('token', {creature:cr, mine:!theirs, what:tx.replace(/^creates? /i, '').slice(0, 60), once:trig === 'static' && /Instant|Sorcery/.test(t), cond, cost}, s); }
    if (/costs? \{(\d+|X)\} less to cast/i.test(s)) push('cost', {how:/total power/i.test(s) ? 'total power' : /for each/i.test(s) ? 'per permanent' : 'flat'}, s);
    if ((m = /^Sacrifice (a|another) (creature|artifact|permanent)[^:]*:/i.exec(s))) push('sac-outlet', {what:m[2].toLowerCase(), cost}, s);
    if ((m = /put (a|an|one|two|three|x|\d+) \+1\/\+1 counters? on (each (?:other )?creature you control|target creature|each of up to|that (?:creature|Hero|\w+)|it|~|[A-Z][^.,]*)/i.exec(s))) push('counters', {n:NUM[m[1].toLowerCase()] || +m[1] || 'X', on:/each/.test(m[2]) ? 'team' : 'one', cond, limit:/only once each turn/i.test(next) ? 'once per turn' : ''}, s);
    if (/^If one or more (creature )?tokens would be created/i.test(s)) push('token-replace', {creatureOnly:/creature tokens/i.test(s)}, s);
    if (/gains? (twice )?(\d+|x|that much) life|you gain \d+ life/i.test(s)) push('lifegain', {cond}, s);
    if (/each opponent loses (\d+|x|that much) life/i.test(s)) push('drain', {cond, repeat:trig === 'trigger'}, s);
    if (out.effects.length === n0 && !/^(This spell|As long as|If |~|Activate only|Spend this mana|This mana|This ability|It's an? |Partner|Choose a Background|Do this only|\{[^}]+\}:? *$)/i.test(s) && !/can't (attack|block|be blocked)|has |have |gains? (vigilance|haste|menace|flying|trample|lifelink)/i.test(s)) out.unknown.push(s.slice(0, 160));
  }
  c._fxSrc = c.o; return c._fx = out;
}
// What a card depends on to work, read from its text: creature tokens, non-Human creatures, artifact spells, a creature
// type, land discards, instants and sorceries, +1/+1 counters, equipment. Each need says how to count support in a deck.
const NEEDS = {
  // a one-shot token spell counts half; a card that keeps making them counts fully
  creatureTokens:{label:'creature tokens', min:6, test:/creature tokens? would be created|whenever (one or more |a )?creature tokens?|creature tokens? you control/i, count:c => { const t = effectsOf(c).effects.filter(e => e.kind === 'token' && e.creature && e.mine); return !t.length ? 0 : t.some(e => !e.once) ? 1 : 0.5; }},
  tokens:{label:'tokens', min:6, test:/whenever (one or more |a )?tokens? (you control )?enters?|tokens? would be created/i, count:c => { const t = effectsOf(c).effects.filter(e => e.kind === 'token' && e.mine); return !t.length ? 0 : t.some(e => !e.once) ? 1 : 0.5; }},
  nonHuman:{label:'non-Human creatures', min:0.5, share:true, test:/non-Human creatures? you control/i, count:c => /Creature/.test(frontType(c)) ? (/\bHuman\b/.test((c.t || '').split(' // ')[0]) && !/Changeling/.test(c.o || '') ? 0 : 1) : null},
  artifactSpells:{label:'artifact spells', min:15, test:/whenever you cast an artifact spell|artifact spells? you cast|cast artifact spells/i, count:c => /Artifact/.test(frontType(c)) && !tags(c).land ? 1 : 0},
  bigArtifacts:{label:'artifacts with mana value 4 or more', min:8, test:/artifact spell with (mana value|converted mana cost) 4 or greater/i, count:c => /Artifact/.test(frontType(c)) && (c.cmc || 0) >= 4 ? 1 : 0},
  landDiscard:{label:'ways to discard lands', min:6, test:/whenever you discard one or more land cards|whenever you discard a land/i, count:c => effectsOf(c).effects.some(e => e.kind === 'filter' || (e.kind === 'draw' && e.discard)) || /\bdiscard (a|one|two|any number of) (land )?cards?\b|landcycling|cycling \{/i.test(c.o || '') ? 1 : 0},
  spells:{label:'instants and sorceries', min:15, test:/whenever you cast (an|your) instant or sorcery|instant (and|or) sorcery spells? you cast|magecraft/i, count:c => /Instant|Sorcery/.test(frontType(c)) ? 1 : 0},
  topPower:{label:'creatures with power 4 or more', min:6, test:/greatest power among (non-\w+ )?creatures you control/i, count:c => /Creature/.test(frontType(c)) && (parseInt(String(c.pt || '0').split('/')[0], 10) || 0) >= 4 ? 1 : 0},
  bigPower:{label:'creatures with power 4 or more', min:12, test:/total power of creatures you control|sacrificed creature's power/i, count:c => /Creature/.test(frontType(c)) && (parseInt(String(c.pt || '0').split('/')[0], 10) || 0) >= 4 ? 1 : 0},
  counters:{label:'ways to put +1/+1 counters', min:8, test:/creatures? (you control )?with (a |one or more )?\+1\/\+1 counters? on (it|them)|for each \+1\/\+1 counter on (creatures|permanents) you control/i, count:c => /\+1\/\+1 counters?\b/.test(c.o || '') && /\bput\b|enters with|proliferate/i.test(c.o || '') ? 1 : 0}
};
function needsOf(c){
  if (!c) return []; if (c._nd) return c._nd; const o = (c.o || '').split(' // ')[0], out = [];
  for (const k in NEEDS) if (NEEDS[k].test.test(o)) out.push(k);
  // a free sacrifice outlet that mills (Altar of Dementia) is a sacrifice outlet and self-mill first: it works with any creature
  // (UP.altar, Build 143), unlike a payoff that needs big ones (Fling, Greater Good)
  if (UP.altar && /mills cards equal to the sacrificed creature's power/i.test(o)){ const i = out.indexOf('bigPower'); if (i >= 0) out.splice(i, 1); }
  // a creature type the card rewards (Heroes, Villains, Dinosaurs…), the same reading the tribe checks use
  const m = /(?:whenever (?:another |a |one or more (?:other )?)|other |each )(\w+?)s? (?:you control|creatures? you control)/i.exec(o);
  if (m){ const tr = m[1].replace(/^./, x => x.toUpperCase()); if (TRIBE_SET.has(tr) && !new RegExp('\\bcreates? [^.]*\\b' + tr + '\\b').test(o)) out.push('tribe:' + tr); }
  return c._nd = out;
}
// Support for each need in a deck: count of cards (or share of creatures) that feed it.
function supportOf(d, key){
  const cards = []; d.cards.forEach(e => { const c = find(e.n); if (c) for (let i = 0; i < e.q; i++) cards.push(c); }); [d.commander, d.partner].filter(Boolean).map(find).filter(Boolean).forEach(c => cards.push(c));
  if (key.startsWith('tribe:')){ const tr = key.slice(6); let have = cards.filter(c => hasCType(c, tr)).length;
    // creature tokens of the type count too (UP.ttok, Build 143): a card that keeps making them (Teval's Zombie Druids) counts as
    // three of the type, a one-time maker as one. The commander is always there, so its tokens are dependable support.
    if (UP.ttok){ const re = new RegExp('\\b' + tr + '\\b'); cards.forEach(c => { const fx = effectsOf(c).effects.filter(x => x.kind === 'token' && x.creature && x.mine && re.test(x.what || '')); if (fx.length) have += fx.some(x => !x.once) ? 3 : 1; }); }
    return {have, min:10}; }
  const N = NEEDS[key]; if (!N) return {have:0, min:0};
  if (N.share){ const v = cards.map(N.count).filter(x => x != null); return {have:v.length ? +(v.reduce((a, b) => a + b, 0) / v.length).toFixed(2) : 0, min:N.min, share:true}; }
  return {have:cards.reduce((a, c) => a + (N.count(c) || 0), 0), min:N.min};
}
// ----- analyze a build by hand -----
// What a deck's own cards are doing, whatever its build is set to: the commander's EDHREC themes (when loaded) and the general
// mechanics, each with the spells that support it, and the most common creature type. Ranked by how many cards back each.
function buildThemes(d){
  const ctx = ctxOf(d), spells = []; d.cards.forEach(e => { const c = find(e.n); if (c && !tags(c).land) for (let i = 0; i < e.q; i++) spells.push(c); });
  const edh = [], gen = [], E = ctx.edh;
  // A theme is ranked by the cards backing it and by how many of the commander's players build that way (broad themes
  // such as Legends touch many cards without being the plan).
  const top = E && E.tags && E.tags.length ? Math.max(1, ...E.tags.slice(0, 10).map(t => t.count || 0)) : 1;
  if (E && E.tags) E.tags.slice(0, 10).forEach(t => { if (!E.tmap || !E.tmap[t.slug]) return; const cs = spells.filter(c => matchAim(c, 'edh:' + t.slug) >= 1); if (cs.length >= 3) edh.push({key:'edh:' + t.slug, label:t.label, n:cs.length, cards:cs.map(c => c.n), r:cs.length * Math.sqrt((t.count || 0) / top)}); });
  Object.keys(THEMES).filter(k => THEMES[k].re && k !== 'draw').forEach(k => { const cs = spells.filter(c => matchAim(c, k, ctx.tribe) >= 0.7); if (cs.length >= 4) gen.push({key:k, label:THEMES[k].label, n:cs.length, cards:cs.map(c => c.n)}); });
  const cnt = {}; spells.forEach(c => { if (/Creature/.test(frontType(c))) subtypes(c).forEach(t => { if (TRIBE_SET.has(t) && t !== 'Human') cnt[t] = (cnt[t] || 0) + 1; }); });
  const tt = Object.entries(cnt).sort((a, b) => b[1] - a[1])[0]; if (tt && tt[1] >= 8) gen.push({key:'tribal', tribe:tt[0], label:tt[0] + ' tribal', n:tt[1], cards:[]});
  edh.sort((a, b) => b.r - a.r); gen.sort((a, b) => b.n - a.n);
  // the suggested build: the commander's own themes when it has play data, otherwise the general mechanics
  const pick = (edh.length ? edh : gen).slice(0, 3);
  return {edh, gen, suggest:pick.map(x => x.key), tribe:(pick.find(x => x.key === 'tribal') || {}).tribe || '', spells:spells.length};
}
// The colours a commander-less deck's cards ask for (for suggesting a commander).
function deckColors(d){ const s = new Set(); d.cards.forEach(e => { const c = find(e.n); if (c && !tags(c).land) c.ci.forEach(k => s.add(k)); }); return 'WUBRG'.split('').filter(k => s.has(k)); }
// Commander profiles for the five benchmark decks, written from their current Oracle text (hash: the text they were reviewed
// against; a changed text drops the profile until it is reviewed again). A profile describes how the commander works and
// what it depends on, not a list of preferred cards. Other commanders get the needs read from their text (needsOf).
const PROFILES = {
  'Captain America, Team Leader':{hash:'4m2l4y', needs:['tribe:Hero'], plan:'Each other Hero entering gets vigilance, haste and a +1/+1 counter, and Captain America gets one too. The deck wants a steady stream of Hero creatures; Heroes that are good on their own and cheap keep the triggers coming.', wins:'Wide, hasty Hero attacks growing with counters; team pumps close games.'},
  'Doctor Doom, King of Latveria':{hash:'ddb1m5', needs:['landDiscard'], plan:'Each time you discard one or more land cards, each opponent loses 2 life. Only your own discards count (opponents discarding does nothing). Each combat Doom makes a Villain you control connive, which is a free discard. Ways to discard lands repeatedly are the engine; more Villains give the connive more targets.', wins:'Repeated land discards draining the table, backed by menace attackers.'},
  'Ghalta, Primal Hunger':{hash:'4uq0b1', needs:['bigPower'], plan:'Ghalta costs {X} less, where X is the total power of your creatures, down to its {G}{G}. Big creatures and ramp make it cheap early; it then attacks with trample. Dinosaurs are not required: any large creatures lower the cost.', wins:'Big tramplers and team pumps; Ghalta arriving early.'},
  'Leonardo, the Balance':{hash:'l1f65y', needs:['tokens'], plan:'Once each turn, when a token you control enters (any token: a Treasure or Food counts), you may put a +1/+1 counter on each creature you control. For {W}{U}{B}{R}{G}, your creatures gain menace, trample and lifelink until end of turn.', wins:'A wide board grown by counters, then the five-colour menace/trample/lifelink alpha strike.'},
  "T'Challa, the Black Panther":{hash:'y9rmeh', needs:['artifactSpells', 'bigArtifacts'], plan:'T\u2019Challa makes a tapped, indestructible Vibranium token when it enters or attacks. Vibranium mana can only cast artifact spells, so it is ramp for artifacts only. Casting an artifact with mana value 4 or more puts two +1/+1 counters on T\u2019Challa. Vibranium tokens are artifacts, not creatures: they do not feed creature-token cards such as Divine Visitation.', wins:'Large artifacts and a growing T\u2019Challa; artifact-creature threats.'}
};
function profileOf(c){ if (!c) return null; const p = PROFILES[c.n]; if (p && p.hash === effectsOf(c).hash) return Object.assign({reviewed:true}, p); const n = needsOf(c); return n.length ? {reviewed:false, needs:n} : null; }
// Cards whose condition this deck barely meets: each with what it needs, how much the deck has, and the usual minimum.
function weakHere(d){
  const out = [], cache = {}; d.cards.forEach(e => { const c = find(e.n); if (!c || tags(c).land) return;
    needsOf(c).forEach(k => { const s = cache[k] || (cache[k] = supportOf(d, k)); const self = !s.share && (k.startsWith('tribe:') ? hasCType(c, k.slice(6)) : (NEEDS[k] && NEEDS[k].count(c))) ? 1 : 0, have = s.share ? s.have : s.have - self;
      if (have < s.min) out.push({n:c.n, need:k, label:k.startsWith('tribe:') ? k.slice(6) + ' creatures' : NEEDS[k].label, have, min:s.min, share:!!s.share}); }); });
  return out;
}
// ----- whole-deck evaluator -----
// Five scores out of 100, weighted into one: synergy 30, balance 25, card quality 20, win routes and resilience 15, mana
// and curve 10. Each part says what drove it. It judges a finished list; it does not choose cards. Raw measures are mapped
// to 0–100 by anchors fitted on ~6,700 real player decks (EV_ANCHOR: the raw value of a typical deck → 60, of a top-tenth
// deck → 85), so 60 means "like a typical real deck for its commander" and 85 "like the best tenth".
const EV_W = {synergy:30, balance:25, quality:20, routes:15, mana:10};
let EV_ANCHOR = {synergy:[0.642, 0.793], balance:[0.818, 0.967], quality:[0.344, 0.401], routes:[0.675, 0.880], mana:[0.745, 0.824]};
const FINISH_RE = /you win the game|(target player|each opponent|that player) loses the game|creatures you control get \+([2-9]|x)\/|(other )?creatures you control (gain|have) (double strike|trample|flying)|additional combat phase|takes? an extra turn|double (the )?(damage|power)|deals? (double|twice|triple) th|deals? (x|\d+|that much) damage to each opponent|each opponent loses (x|[2-9]|\d\d|that much|half)|(whenever|at the beginning)[^.]*,[^.]*each opponent loses \d+ life|\binfect\b/i;
const RECUR_RE = /return (target|up to (one|two)|a|all|each|it|that card)[^.]*from (your|a) graveyard to (the battlefield|your hand)|(cast|play) [^.]*from your graveyard|shuffle your graveyard into/i;
// Synergy, balance and mana are health checks: past "enough" (about the top quarter of real decks) more does not make a
// deck stronger, so they saturate. Card quality and win routes keep rising: among healthy decks they separate strong from weak.
let EV_SUFF = {synergy:0.72, balance:1, mana:0.81};
function evScale(v, a){ const [mid, top] = a, s = top > mid ? (v - mid) / (top - mid) : 0; return Math.max(0, Math.min(100, 60 + 25 * s)); }
// Reanimation engines (owner, 18 Oct): a card that brings creatures back every turn (The Soul Stone once harnessed, Sheoldred) or
// all at once (Living Death, Rise of the Dark Realms) is recursion and, with UP.reF, a way to win.
const REANIM_EVERY = /(at the beginning of|whenever)[^.]*return (target|a|up to one target) creature card from your graveyard to the battlefield/i, REANIM_ALL = /(puts all cards they exiled this way|returns? all creature cards from (your|all|their) graveyards?|put all creature cards from all graveyards) (onto|to) the battlefield/i;
function isReanimEngine(c){ const o = c && c.o || ''; return REANIM_EVERY.test(o) || REANIM_ALL.test(o); }
// Score blind spots (UP.bs, owner's plan of 18 Oct): a creature that is a finisher only for its size counts UP.bsF of one that closes
// the game by what it does, and a card costing UP.bsP or more is not counted as protection (it can't be held up).
function finByText(c){ const o = c.o || ''; return (FINISH_RE.test(o) && !/^Extort/m.test(o)) || (!!UP.reF && isReanimEngine(c)); }
function isFinisher(c){ if (c._fin !== undefined) return c._fin; const o = c.o || '', t = frontType(c), pw = parseInt(String(c.pt || '').split('/')[0], 10) || 0;
  return c._fin = (FINISH_RE.test(o) && !/^Extort/m.test(o)) || (/Creature/.test(t) && pw >= 6 && /flying|trample|can't be blocked|haste|menace/i.test(o)) || (/Creature/.test(t) && pw >= 8) || (!!UP.reF && isReanimEngine(c)); }
// Card quality against the Apex build. The Apex build for this deck (same commander or pair, mechanics in order, filters,
// colours) is the 100% mark; a deck of random playable cards in its colours is 0%. A card's value is the one generation and
// upgrades use (baseScore: what this commander's players run, its fit with the mechanics, how proven it is). Spells only:
// lands are judged under mana and curve. Also the best build with every card under $12 and under $3 (Mid and Budget), so
// a budget deck is measured against what its price limit allows. The reference depends on the build settings, not on the
// deck's cards, so it is worked out once per settings (apexKey) and reused while cards change.
// (LIB.full: a helper core holds only a slice of the library and is told the whole library's size, so its keys match; Build 144)
function apexKey(d){ return JSON.stringify([d.commander, d.partner || '', d.aims, d.tribe || '', d.colors, d.types || [], d.keys || [], d.typesMust, d.keysMust, d.sets || [], d.setsMust, EDH.key, EDH.state, Object.keys(EDH.tmap || {}).length, LIB.full || LIB.length]); }
// A spell's value for card quality: baseScore, with the commander's play rates counted among players who changed the deck
// (untouched precon copies taken out, preDeflate), so a precon card is not "great" merely because the precon ships with it.
// How much raw card power (how widely played across all of Commander) adds to a card's quality value. 40 orders real decks
// by declared power bracket and by price (checked on ~280 bracket-labelled decks); without it typical-for-the-commander wins.
let QPOW = 40;
function qualVal(c, d, ctx){ let v = baseScore(c, d, ctx).s; const E = ctx.edh, x = E && edhOf(E.map, c); if (x){ const D = preDeflate(E); v += W_INC * (D.inc(c, x.inc) - x.inc); }
  if (QPOW) v += QPOW * (CORE.has(c._n) ? 1 : c.r ? Math.max(0, 1 - Math.log(c.r + 1) / Math.log(40000)) : 0.35); return v; }
function spellMean(cards, d, ctx, vf){ let t = 0, n = 0; cards.forEach(e => { const c = typeof e === 'string' ? find(e) : find(e.n), q = typeof e === 'string' ? 1 : e.q; if (!c || (tags(c).land && !(UP.tl && tourneyOf(c, d) === 'land'))) return; t += (vf ? vf(c) : qualVal(c, d, ctx)) * q; n += q; }); return n ? t / n : 0; }
function apexRef(d){
  if (d.format !== 'commander' || !find(d.commander)) return null;
  // the same settings give the same reference build: kept for the last few (polishing asks for it again; Build 141)
  // (Build 145) everything the build reads goes in the key: the settings, combos, bracket lists, set lists and fallback pages too
  const ck = apexKey(d) + '|' + LIB.length + '|' + ((EDH && EDH.key) || '') + '|' + ((EDH && EDH.map && EDH.map.size) || 0) + '|' + Object.keys((EDH && EDH.tmap) || {}).join(',') + '|' + ((EDH && EDH.fall) || []).map(f => f.slug).join(',') + '|' + COMBOS.list.length + '|' + COMBOS.at + '|' + BTAGS.v + '|' + [...SETCARDS].map(([k, v]) => k + ':' + v.size).join() + '|' + JSON.stringify(UP); apexRef.cache = apexRef.cache || new Map();
  if (apexRef.cache.has(ck)) return apexRef.cache.get(ck); const out = apexRef0(d); apexRef.cache.set(ck, out); if (apexRef.cache.size > 4) apexRef.cache.delete(apexRef.cache.keys().next().value); return out; }
function apexRef0(d){
  const nd = JSON.parse(JSON.stringify(d)); nd.cards = []; nd.tier = 'apex'; delete nd.plan; nd.recP = {};
  const was = buildPlan.inRef; buildPlan.inRef = true; let plan; try { plan = buildPlan(nd, [], null, new Set()); } finally { buildPlan.inRef = was; }   // the reference build is never polished
  const ctx = ctxOf(d), pick = t => plan.map(x => ({n:planPick(x, t), q:x.q}));
  const pool = LIB.filter(c => !tags(c).land && c.r && legalIn(c, 'commander') && c.ci.every(z => ctx.ident.includes(z)) && mustOk(c, d) && c.n !== d.commander && c.n !== d.partner), r = rng32(7), sample = [];
  for (let i = 0; i < Math.min(400, pool.length); i++) sample.push(pool[Math.floor(r() * pool.length)].n);
  return {key:apexKey(d), cards:{apex:pick('apex'), mid:pick('mid'), budget:pick('budget'), floor:sample.map(n => ({n, q:1}))}};
}
// Deck power of the reference builds: the Budget, Mid and Apex builds for this deck's settings, each scored as a whole deck by
// evaluateDeck (the same score the player's deck gets). Apex progress places the player's deck on this scale, Apex = 100.
function refScores(d, AR){ if (!AR || !AR.cards) return null; const out = {};
  for (const t of ['budget', 'mid', 'apex']){ const u = JSON.parse(JSON.stringify(d)); delete u.plan; u.tier = t; u.cards = AR.cards[t].filter(x => x && x.n).map(x => ({n:x.n, q:x.q, l:false}));
    try { out[t] = +evaluateDeck(u, {apex:AR, games:100}).exact.toFixed(2); } catch (e) { return null; } }
  return out; }
// The reference means for a deck, with a value function (the deck's own upgrade values when given).
// The reference builds' card values depend only on the deck's settings and the card values used, never on the deck's own cards,
// so they are kept per reference build and settings (Build 142, speed): a swap being measured reuses them. Same numbers, less work.
function apexMeans(AR, d, ctx, vf){ const C = apexMeans.C || (apexMeans.C = new WeakMap()); let M = C.get(AR); if (!M){ M = new Map(); C.set(AR, M); }
  const vid = vf ? (vf.__id || (vf.__id = ++apexMeans.n)) : 0, k = JSON.stringify([vid, d.format, d.tier, d.aims, d.types, d.keys, d.typesMust, d.keysMust, d.sets, d.setsMust, d.themeFirst, d.prevCmd, d.commander, d.partner, ctx.tribe, ctx.cmdTribe, ctx.focus, ctx.ident, ctx.cmdThemes, ctx.edh ? [ctx.edh.key, ctx.edh.decks, ctx.edh.map && ctx.edh.map.size, Object.keys(ctx.edh.tmap || {})] : 0, UP, W_INC, W_SYN, POP_K, AIM_K, STAPLE_K, QPOW]);
  if (M.has(k)) return M.get(k); const m = L => spellMean(L, d, ctx, vf), out = {apex:m(AR.cards.apex), mid:m(AR.cards.mid), budget:m(AR.cards.budget), floor:m(AR.cards.floor)}; if (M.size > 50) M.clear(); M.set(k, out); return out; }
apexMeans.n = 0;
// Share of the way from the floor (random playable cards) to a reference build, 0–100.
function qualityPct(mean, ref, floor){ return ref > floor ? Math.max(0, Math.min(100, Math.round(100 * (mean - floor) / (ref - floor)))) : 0; }
function evaluateDeck(d, opt){
  opt = opt || {}; const A = analyze(d), ctx = A.ctx, E = ctx.edh, why = {}, spells = [];
  d.cards.forEach(e => { const c = find(e.n); if (c && !tags(c).land) for (let i = 0; i < e.q; i++) spells.push(c); });
  const n = Math.max(1, spells.length);
  // Synergy: how much this commander's players (and, for chosen EDHREC themes, that theme's players) run each spell, plus
  // EDHREC's synergy (how much more than in other decks). Without play data: share of spells that fit a chosen mechanic.
  let syn = 0; const aims = (d.aims || []).filter(isEdhAim).map((a, i) => ({m:E && E.tmap && E.tmap[a.slice(4)], w:AIM_W[i] || 1})).filter(x => x.m);
  const pre = E && E.pre && E.pre.list && E.pre.list.length ? E.pre : null, PD = preDeflate(E), u = PD.u, preK = PD.preK;   // see preDeflate
  const preCut = new Map(pre ? pre.cut.map((n, i) => [keyOf(n), i]) : []);
  const incOf = c => { const x = edhOf(E.map, c); if (!x) return null; const pc = preK.has(c._k); let inc = pc ? Math.max(0, x.inc - u) / (1 - u) : Math.min(1, x.inc / (1 - u)), sy = pc ? x.syn - u : x.syn;
    if (preCut.has(c._k)) inc *= 0.5 + 0.5 * preCut.get(c._k) / Math.max(1, preCut.size); return {inc, syn:sy}; };
  // Per spell: the best of (a) it does one of the chosen mechanics (first counts most) or the commander's own strategy, and
  // (b) EDHREC synergy, how much more this commander's players run it than other decks of its colours. Popularity alone
  // is not synergy: a precon card is "popular" because the precon ships with it.
  const AWv = [1, 0.85, 0.7, 0.6, 0.5], aimL = (d.aims || []).slice(0, 5), hasE = !!(E && E.map && E.map.size >= 40);
  const fitOf = c => { let f = 0; aimL.forEach((a, i) => { if (matchAim(c, a, ctx.tribe) >= 0.7) f = Math.max(f, AWv[i]); }); if (!f && ctx.cmdThemes.some(a => matchAim(c, a, ctx.cmdTribe) >= 1)) f = 0.7; if (ctx.engine) f = Math.max(f, UP.kwS * engineFit(c, ctx.engine).v); return f; };
  const synOf = c => { const x = hasE ? incOf(c) : null, l = x ? Math.max(0, Math.min(1, 3 * x.syn + 0.25 * x.inc)) : 0; let t = 0;
    if (aims.length){ let tw = 0, tv = 0; aims.forEach(a => { const y = edhOf(a.m, c); tw += a.w; tv += a.w * (y ? Math.min(1, y.inc * 1.5) : 0); }); t = tv / tw; }
    return Math.max(fitOf(c), l, t); };
  spells.forEach(c => syn += synOf(c)); syn /= n;
  why.synergy = spells.filter(c => synOf(c) >= 0.5).length + ' of ' + n + ' spells work with ' + (ctx.cmd ? ctx.cmd.n.split(',')[0] : 'the deck') + '’s plan' + (aimL.length ? ' (' + aimL.slice(0, 3).map(a => aimLabel(a, ctx.tribe)).join(', ') + ')' : '');
  // Balance: the deck's jobs against what this commander's players run (roleNeeds), and lands against the target. A short
  // role costs per missing card; an overfull one costs a little (those slots could do something else).
  const short = [], over = []; let pen = 0;
  // Targets are what this commander's players run, so one card either side is normal; past that, each missing card costs.
  // The targets are what this commander's players run, with untouched precon copies taken out (roleNeeds with UP.rdef on):
  // judged by the players who changed the deck. The upgrade engine keeps its own targets (rdef off measured better there).
  const T = Object.assign({}, A.T); if (hasE && d.format === 'commander'){ const sv = UP.rdef; UP.rdef = 1; try { const N = roleNeeds(E); if (N) ['ramp', 'draw', 'removal', 'wipe'].forEach(r => T[r] = N[r]); } finally { UP.rdef = sv; } }
  ['ramp', 'draw', 'removal', 'wipe'].forEach(r => { const have = A.roles[r], want = T[r], tol = r === 'wipe' ? 0 : 1; if (have < want - tol){ pen += (want - tol - have) / Math.max(3, want) * (r === 'wipe' ? 0.6 : 1); short.push(ROLE_LABEL[r] + ' ' + have + '/' + want); }
    else if (have > want * 1.8 + 2){ pen += 0.1; over.push(ROLE_LABEL[r] + ' ' + have); } });
  const ramp = A.roles.ramp - T.ramp, ld = A.lands - T.lands + (ramp > 2 ? Math.min(2, (ramp - 2) / 3) : 0);   // extra ramp stands in for a land or two
  // UP.rld 2 (Build 143): extra ramp makes up for missing lands, but does not count as flood: whether ramp floods the deck is
  // what the mana part's practice games measure, and counting it here too marked down the cheap ramp players add
  if (ld < -1) pen += (-ld - 1) * 0.15; else if ((UP.rld === 2 ? A.lands - T.lands : ld) > 2) pen += ((UP.rld === 2 ? A.lands - T.lands : ld) - 2) * 0.06;
  const inter = spells.filter(c => { const r = tags(c).roles; return r.has('removal') || r.has('wipe') || r.has('counter'); }).length; if (inter < 8) pen += (8 - inter) * 0.03;
  // Cards whose condition the deck barely meets (Divine Visitation without creature tokens, a Dinosaur lord with few Dinosaurs).
  const weak = weakHere(d), dead = [...new Set(weak.map(w => w.n))]; pen += Math.min(0.4, dead.length * 0.06);
  const bal = Math.max(0, 1 - pen / 2.5); why.balance = (short.length ? 'Short against what players who changed the deck run: ' + short.join(', ') : 'Every job covered') + (over.length ? '; heavy: ' + over.join(', ') : '') + '; lands ' + A.lands + '/' + T.lands + (dead.length ? '; ' + dead.length + ' card' + (dead.length > 1 ? 's' : '') + ' the deck barely supports' : '');
  // Card quality: how widely each spell is played across all of Commander (EDHREC rank), staples counting fully.
  const q = c => CORE.has(c._n) ? 1 : c.r ? Math.max(0, 1 - Math.log(c.r + 1) / Math.log(40000)) : 0.35;
  let qual = spells.reduce((a, c) => a + q(c), 0) / n, qPct = null, qExact = null, qTier = null, qOver = 0; why.quality = spells.filter(c => c.r && c.r < 400).length + ' proven staples (top 400 cards in Commander)';
  // With the Apex reference: card quality is how far the spells are from random playable cards (0%) to the Apex build (100%).
  const AR = opt.apex && opt.apex.key === apexKey(d) ? opt.apex : null;
  if (AR){ const vf = opt.valOf || null, M = apexMeans(AR, d, ctx, vf), m = spellMean(d.cards, d, ctx, vf); Object.assign(AR, {apex:M.apex, mid:M.mid, budget:M.budget, floor:M.floor}); qPct = qualityPct(m, AR.apex, AR.floor); qExact = AR.apex > AR.floor ? Math.max(0, Math.min(100, 100 * (m - AR.floor) / (AR.apex - AR.floor))) : 0; qOver = AR.apex > AR.floor ? Math.max(0, 100 * (m - AR.floor) / (AR.apex - AR.floor) - 100) : 0;
    why.quality = qPct + '% of the way from random playable cards to the Apex build (the best cards for this deck at any price)';
    if (d.tier === 'budget' || d.tier === 'mid'){ const ref = d.tier === 'budget' ? AR.budget : AR.mid; qTier = {tier:d.tier, pct:qualityPct(m, ref, AR.floor)}; why.quality += '; ' + qTier.pct + '% of the best build with every card under $' + (d.tier === 'budget' ? 3 : 12); } }
  // Win routes and resilience: complete combos that win, cards that close a game, ways to protect or rebuild, card flow.
  const cb = COMBOS.list.length ? combosOf(d, ctx.ident) : {full:[], near:[]}, wins = cb.full.filter(x => x.win), fin = spells.filter(isFinisher), prot = spells.filter(c => (tags(c).roles.has('protect') || tags(c).roles.has('counter')) && !(UP.bs && c.cmc >= UP.bsP)).length,
    rec = spells.filter(c => RECUR_RE.test(c.o || '') || (UP.reF && REANIM_ALL.test(c.o || ''))).length, tut = spells.filter(c => tags(c).roles.has('tutor')).length;
  // Smarter deck score, stage 2 (UP.rs): ways to win rise smoothly, so one card can't swing the score more than it is worth. Each
  // finisher adds less than the one before (1 - e^(-n/UP.rfn)), and winning combos count by how many there are (the first 60% of UP.rc).
  const finN = UP.bs ? fin.reduce((a, c) => a + (finByText(c) ? 1 : UP.bsF), 0) : fin.length, finV = UP.rs ? 1 - Math.exp(-finN / UP.rfn) : Math.min(1, finN / 6), cbV = UP.rs ? (wins.length ? UP.rc * (0.6 + 0.4 * Math.min(1, (wins.length - 1) / 3)) : cb.full.length ? UP.rc * 0.5 : 0) : (wins.length ? 0.25 : cb.full.length ? 0.12 : 0);
  const routes = Math.min(1, (UP.rs ? UP.rf : 0.45) * finV + cbV + 0.15 * Math.min(1, prot / 5) + 0.1 * Math.min(1, rec / 3) + 0.05 * Math.min(1, tut / 2) + 0.1 * Math.min(1, A.roles.draw / Math.max(6, T.draw)));
  why.routes = fin.length + ' finishers' + (wins.length ? ', ' + wins.length + ' winning combo' + (wins.length > 1 ? 's' : '') + ' (' + wins.slice(0, 2).map(x => x.names.join(' + ')).join('; ') + ')' : '') + ', ' + prot + ' protection/counters, ' + rec + ' recursion';
  // Mana and curve: goldfish games (seeded, so the same deck always gets the same score).
  // An unfinished deck (opt.partial) is not played out: practice games with a part of a deck say nothing about its mana.
  const S = opt.partial ? null : opt.sim || simulate(d, opt.games || 300, opt.seed || 7);
  // Running short of lands and drawing too many cost the same; mana spent counts up to about a land a turn plus a little ramp.
  let mana = 0;
  if (S){ mana = Math.max(0, Math.min(1, 0.3 * Math.min(1, S.manaUsedBy6 / 19) + 0.15 * S.cmdByT6 + 0.55 * (1 - 0.6 * S.colourStuck - 1.5 * S.screwT5 - S.floodT8)));
  why.mana = 'commander out by turn ' + S.cmdMedianTurn + ' (median), ' + S.manaUsedBy6 + ' mana used by turn 6, stuck on colour ' + Math.round(100 * S.colourStuck) + '%, short of lands ' + Math.round(100 * S.screwT5) + '%, flooded ' + Math.round(100 * S.floodT8) + '%'; }
  else why.mana = 'available once the deck has its full 100 cards';
  const raw = {synergy:syn, balance:bal, quality:qual, routes, mana}, parts = {}; let total = 0;
  // parts are shown as whole numbers; exact keeps the unrounded parts, so a small real gain (a better card) is not lost to rounding
  // Comparing swaps (Build 139, UP.unc): the shown parts stop at their maximum, but a deck already at the maximum can still get
  // better; cmp lets each part keep rising past its maximum at UP.unc of the rate, so a stronger, on-theme card still scores
  // above a weak one in a strong deck. Only differences in cmp are used (swap gains); the score shown is unchanged.
  let cmp = 0; const pastMax = k => { if (!UP.unc || (UP.uncK && UP.uncK !== k)) return 0; if (k === 'quality') return qOver; if (EV_SUFF[k]) return Math.max(0, raw[k] / EV_SUFF[k] - 1) * 100; const a = k === 'routes' && UP.rs ? UP.ra : EV_ANCHOR[k], top = a[1] > a[0] ? 60 + 25 * (raw[k] - a[0]) / (a[1] - a[0]) : 0; return Math.max(0, top - 100); };
  let wsum = 0, exact = 0; const contrib = {}; for (const k in EV_W){ if (k === 'mana' && !S){ parts[k] = null; continue; } const pe = k === 'quality' && qExact != null ? qExact : EV_SUFF[k] ? 100 * Math.min(1, raw[k] / EV_SUFF[k]) : evScale(raw[k], k === 'routes' && UP.rs ? UP.ra : EV_ANCHOR[k]); cmp += (pe + UP.unc * pastMax(k)) * EV_W[k] / 100;   // stage 2: the smoother ways-to-win, shifted so a typical deck keeps its score
    parts[k] = k === 'quality' && qPct != null ? qPct : Math.round(pe); total += parts[k] * EV_W[k] / 100; exact += pe * EV_W[k] / 100; contrib[k] = pe * EV_W[k] / 100; wsum += EV_W[k]; }
  if (wsum && wsum < 100){ total = total * 100 / wsum; exact = exact * 100 / wsum; cmp = cmp * 100 / wsum; for (const k in contrib) contrib[k] *= 100 / wsum; }   // the parts that could be judged, weighted as usual
  const onPlan = spells.filter(c => (d.aims || []).some(a => matchAim(c, a, ctx.tribe) >= 0.7) || ctx.cmdThemes.some(a => matchAim(c, a, ctx.cmdTribe) >= 1)).length;
  const feat = {lands:A.lands, tLands:T.lands, avg:+A.avg.toFixed(2), ramp:A.roles.ramp, draw:A.roles.draw, removal:A.roles.removal, wipe:A.roles.wipe, tRamp:T.ramp, tDraw:T.draw, tRem:T.removal, tWipe:T.wipe, inter, fin:fin.length, prot, rec, tut, wins:wins.length, combos:cb.full.length,
    onPlan:onPlan / n, synPos:E && E.map ? spells.filter(c => { const x = incOf(c); return x && x.syn >= 0.1; }).length / n : 0, cheap:spells.filter(c => c.cmc <= 2).length, big:spells.filter(c => c.cmc >= 6).length, gc:A.gc.length, weak:dead.length};
  const prof = profileOf(ctx.cmd), needs = prof ? prof.needs.map(k => Object.assign({key:k, label:k.startsWith('tribe:') ? k.slice(6) + ' creatures' : NEEDS[k].label}, supportOf(d, k))) : [];
  return {total:Math.round(total), exact:+exact.toFixed(3), cmp:+cmp.toFixed(3), parts, contrib, raw, why, sim:S, u, feat, weak, profile:prof, needs, quality:{vsApex:qPct, tier:qTier, pending:qPct == null, marks:AR && AR.apex != null ? {budget:qualityPct(AR.budget, AR.apex, AR.floor), mid:qualityPct(AR.mid, AR.apex, AR.floor)} : null}, combos:{win:wins, all:cb.full, near:cb.near.slice(0, 5)}, finishers:fin.map(c => c.n)};
}
function parsePrecon(j){
  const jd = (j && j.container && j.container.json_dict) || {}, dk = (j && j.deck) || {}, L = t => ((jd.cardlists || []).find(x => x.tag === t) || {}).cardviews || [];
  const list = []; Object.values(dk.cards || {}).forEach(a => (a || []).forEach(t => { if (t && t[0]) list.push(t[0]); }));
  return {name:dk.name || (jd.card && jd.card.precon) || '', decks:(jd.card && jd.card.num_decks) || 0, list,
    cut:L('cardstocut').map(v => v.name).filter(Boolean), lcut:L('landstocut').map(v => v.name).filter(Boolean),
    add:L('cardstoadd').concat(L('landstoadd')).filter(v => v.name && v.potential_decks).map(v => [v.name, Math.min(1, v.num_decks / v.potential_decks), +(v.synergy || 0)])};
}
const norm0 = s => String(s).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, ' ').trim();
// The same names are normalised many thousands of times while a deck is built, so each result is kept (Build 143; same answers).
const NORM_C = new Map(); const norm = s => { let v = NORM_C.get(s); if (v === undefined){ if (NORM_C.size > 200000) NORM_C.clear(); v = norm0(s); NORM_C.set(s, v); } return v; };
const frontType = c => { const t = c.t || ''; return t.indexOf(' // ') < 0 ? t : t.split(' // ')[0]; };
const isBasic = n => Object.prototype.hasOwnProperty.call(BASICS, n) || String(n).startsWith('Snow-Covered ');

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
    pt:pw.power != null ? pw.power + '/' + pw.toughness : (o.loyalty ? 'Loyalty ' + o.loyalty : ''), set:o.set_name || '', id:o.id || '', sc:o.set || '', oid:o.oracle_id || '', rar:o.rarity || '', cn:o.collector_number || '', gc:!!o.game_changer, fn:o.flavor_name || f0.flavor_name || '', src:'full', df:!!(f && f.length === 2 && f[0].image_uris && f[1].image_uris),
    fc:f && f.length === 2 && f[0].image_uris ? f.map(x => ({n:x.name || '', m:x.mana_cost || '', t:x.type_line || '', pt:x.power != null ? x.power + '/' + x.toughness : (x.loyalty ? 'Loyalty ' + x.loyalty : (x.defense ? 'Defense ' + x.defense : ''))})) : null};
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
  let ro = / \/\/ [^/]*\bLand\b/.test(c.t || '') ? o.split(' // ')[0] : o;
  // a planeswalker's ultimate (minus 5 or more) is not one of its jobs (UP.bs): Nissa, Vital Force is not card draw
  if (UP.bs && /Planeswalker/.test(t)) ro = ro.split('\n').filter(l => !/^[−-]([5-9]|\d\d|X):/.test(l)).join('\n');
  for (const k in THEMES){ const T = THEMES[k]; if (!T.re) continue; th[k] = T.re.test(o) ? 1 : (T.type && T.type.test(t) ? 0.5 : 0); }
  if (UP.kw) for (const k in KW_RE) if (th[k] !== 1 && KW_RE[k].test(o) && !(k === 'tokens' && !/\btokens?\b|populate|amass|incubate|fabricate|investigate|treasure|food|clue/i.test(o))) th[k] = 1;   // keywords (Build 139)
  if (!land){
    if (ROLE_RE.ramp.test(ro)) roles.add('ramp');
    // A permanent that makes the spells you cast cheaper (Ruby Medallion, Dragonspeaker Shaman) gives that mana every turn: it is
    // ramp for those spells (UP.costR, Build 143). One-time reductions and taxes on opponents are not.
    if (UP.costR && !roles.has('ramp') && !/^(Instant|Sorcery)/.test(t) && /\bspells? you cast\b[^.]{0,40}\bcosts? \{\d+\} less\b/i.test(ro.replace(/this spell costs[^.]*\./gi, ''))) roles.add('ramp');
    // Card draw is drawing more cards than you discard, for you: looting and conniving (draw one, discard one) only filter,
    // and a draw any player may get (Selvala) is not yours. The monarch and the initiative draw every turn.
    { const fx = UP.fx ? effectsOf(c).effects : null, real = fx && fx.some(e => (e.kind === 'draw' && !e.symmetric && e.who !== 'each opponent') || e.kind === 'monarch' || e.kind === 'initiative') && (!UP.bs || ro === o || THEMES.draw.re.test(ro) || /you become the monarch|take the initiative/i.test(ro)), only = fx && !real && fx.some(e => e.kind === 'filter' || (e.kind === 'draw' && e.symmetric));
      // Rules audit (Build 141): cycling ("Discard this card: Draw a card", in its reminder text) replaces itself, so it is not card draw;
      // "target player draws" can target you (Peer into the Abyss)
      const rd = ro.replace(/\([^()]*discard this card: draw a card\.?\)/gi, ''), rd2 = UP.nmh ? rd.replace(/you have no maximum hand size\.?/gi, '') : rd;
      if ((real && (rd === ro || THEMES.draw.re.test(rd2) || /you become the monarch|take the initiative/i.test(rd2))) || (((THEMES.draw.re.test(rd2) && !/each player draws|target opponent draws/i.test(ro)) || /you become the monarch|take the initiative|target player draws (cards|\w+ cards)/i.test(rd2)) && !(UP.fx && only))) roles.add('draw'); }
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
  if (isEdhAim(key)){ const m = EDH.tmap && EDH.tmap[key.slice(4)], x = m && edhOf(m, c), all = EDH.map && edhOf(EDH.map, c); if (!x || x.inc < 0.2) return 0;
    // A card that is a core piece of the theme (in UP.dom of its decks or more) fits it even when it is just as common across
    // all of this commander's decks (Zombie lords for Gisa, whose players mostly build Zombies anyway).
    if (UP.dom && x.inc >= UP.dom && x.inc >= (all ? all.inc : 0)) return 1;
    return x.inc >= (all ? all.inc : 0) + 0.05 ? 1 : 0; }
  if (key === 'tribal'){
    if (!tribe) return 0;
    // the answer depends only on the card's text and the type, so it is kept on the card (Build 143; same answers)
    const M = c._mt || (c._mt = {}), h = M[tribe]; if (h && h.t === c.t && h.o === c.o) return h.v;
    const v = tribeMatch(c, tribe); M[tribe] = {t:c.t, o:c.o, v}; return v;
  }
  const tg = tags(c);
  if (key === 'control') return tg.roles.has('counter') || tg.roles.has('removal') || tg.roles.has('wipe') ? 1 : 0;
  return tg.th[key] || 0;
}
function tribeMatch(c, tribe){
  // Creature types are capitalised in rules text; a named Role token ("Young Hero Role") is not the type.
  const re = new RegExp('\\b' + tribe.replace(/[^A-Za-z ]/g, '') + '(s|es|ves)?\\b'), alt = tribe === 'Elf' ? /\bElves\b/ : null;
  if (re.test(frontType(c).split('—')[1] || '')) return 1;
  const o = (c.o || '').replace(/\b(?:[A-Z][\w']* )+Role\b/g, '');
  if (re.test(o) || (alt && alt.test(o))) return 1;
  return /chosen type|shares a creature type|changeling/i.test(c.o || '') ? 0.7 : 0;
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
function detectStrategy(cmd, d, thin){
  if (!cmd) return {themes:[], tribe:''};
  const tg = tags(cmd), o = (cmd.o || '').replace(new RegExp(cmd.n.split(',')[0], 'g'), '');
  // (Build 145, UP.cbec) what the commander turns other things into ("are 4/4 Elemental creatures") is not a creature type it rewards
  const o2 = o.replace(/[^.]*\bcreates?\b[^.]*tokens?[^.]*\./gi, ' ').replace(UP.cbec ? /\b(is|are|becomes?)\s+(an?\s+)?(\d+\/\d+\s+)?([a-z]+\s+)*?([A-Z][a-z]+\s+)+(artifact\s+)?creatures?\b/g : /$^/, ' ');
  // (UP.ctok) a commander that keeps making creature tokens of one type (Ghoulcaller Gisa's Zombies) leads that type's deck; only once its play data is known to be missing or thin:
  // with data of its own, the players' choices say whether it does (measured: the data alone matches them better)
  const tokT = !UP.ctok || !(thin || (EDH.key === cmd.n && EDH.state !== 'loading' && (!EDH.map || EDH.map.size < 60))) ? [] : effectsOf(cmd).effects.filter(x => x.kind === 'token' && x.creature && x.mine && !x.once).flatMap(x => TRIBES.filter(t => t !== 'Human' && new RegExp('\\b' + t + '\\b').test(x.what || '')));
  const tribe = deckTribe(d, cmd, TRIBES.filter(t => new RegExp('\\b(' + t + (t === 'Elf' ? '|Elves' : '') + ')s?\\b').test(o2) || tokT.includes(t)));
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
    const typed = name; let c = find(name); if (!c){ const real = altName(name) || labelled(name); if (real){ c = find(real); name = real; } } if (c) name = c.n;
    const pn = c && norm(typed) !== c._n && altName(typed) ? typed : '';   // printed under another name (Humongous Fungus is Corpsejack Menace)
    if ((section === 'commander' || isCmd) && !out.commander){ out.commander = name; continue; }
    if ((section === 'commander' || isCmd) && !out.partner){ out.partner = name; continue; }
    const k = norm(name); if (map.has(k)) map.get(k).q += q; else { const e = {n:name, q, l:false}; if (pn) e.pn = pn; if (pm){ e.psc = pm[1].toLowerCase(); if (pm[2]) e.pcn = pm[2]; } map.set(k, e); out.cards.push(e); }
  }
  return out;
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
  return {engine:UP.kw ? commanderEngine([cmd, par]) : null, cmd, par, ident, focus, edh:cmd && EDH.map && EDH.key === cmd.n ? EDH : null, fall:cmd && UP.fbW && EDH.key === cmd.n && (EDH.fall || []).length && (!EDH.map || EDH.map.size < 60) ? EDH.fall : null, cap:TIERS[d.tier || 'budget'].cap, cmdThemes:strat.themes, cmdTribe:strat.tribe, tribe:d.tribe || strat.tribe,
    bracket, gcIn, mldIn, gcCap:Infinity, uni:universeOf(cmd) || universeOf(par)};
}
function isAimed(d){
  if (!d.aims || !d.aims.length) return false;
  if (d.aims.includes('tribal') && !(d.tribe || ctxOf(d).cmdTribe)) return false;
  return d.format === 'commander' ? !!find(d.commander) : (d.colors || []).length > 0;
}
// Untouched precon copies count every precon card as "played". The least-played precon cards show roughly how many copies
// are untouched (u); taking that share out judges precon cards and outside cards by the players who built the deck.
function preDeflate(E){
  if (!E || !E.map) return {u:0, preK:new Set(), inc:x => x}; if (E._pd && E._pd.m === E.map && E._pd.p === E.pre) return E._pd.v;
  const pre = E.pre && E.pre.list && E.pre.list.length ? E.pre : null, preK = new Set(pre ? pre.list.map(keyOf) : []);
  const vv = pre ? [...new Set(pre.list)].map(find).filter(c => c && !tags(c).land).map(c => edhOf(E.map, c)).filter(Boolean).map(x => x.inc).sort((a, b) => a - b) : [];
  const u = vv.length >= 20 ? Math.min(0.6, vv[Math.floor(vv.length * 0.05)]) : 0;
  const v = {u, preK, inc:(c, inc) => !u ? inc : preK.has(c._k) ? Math.max(0, inc - u) / (1 - u) : Math.min(1, inc / (1 - u))}; E._pd = {m:E.map, p:E.pre, v}; return v;
}
// What this commander's players run: the sum of play rates of the ramp (draw, removal, wipe) cards on its EDHREC page, scaled
// for the cards the page leaves out (checked against ~4,000 real decks: within about one card), and its average land count.
function roleNeeds(E){
  if (!E || !E.map || E.map.size < 60) return null; if (E._needs && E._needs.m === E.map && E._needs.r === UP.rdef && E._needs.p === E.pre) return E._needs.v;
  const D = UP.rdef ? preDeflate(E) : null, t = {ramp:0, draw:0, removal:0, wipe:0}; E.map.forEach((x, k) => { const c = IDX.get(k); if (!c || tags(c).land) return; const inc = D ? D.inc(c, x.inc) : x.inc; tags(c).roles.forEach(r => { if (r in t) t[r] += inc; }); });
  const F = {ramp:1.15, draw:1.25, removal:1.25, wipe:1.2}, lim = {ramp:[5, 22], draw:[6, 22], removal:[4, 12], wipe:[1, 5]}, v = {};
  for (const r in t) v[r] = Math.max(lim[r][0], Math.min(lim[r][1], Math.round(t[r] * F[r])));
  E._needs = {m:E.map, v, r:UP.rdef, p:E.pre}; return v;
}
// How many finishers (cards that close a game: mass pumps, extra combats, drains, big evasive threats, "win the game") and how
// many protection pieces this commander's players run: the sum of those cards' play rates, as for roleNeeds.
function routeNeeds(E){
  if (!E || !E.map || E.map.size < 60) return null; if (E._rn && E._rn.m === E.map) return E._rn.v; let fin = 0, prot = 0;
  E.map.forEach((x, k) => { const c = IDX.get(k); if (!c || tags(c).land) return; if (isFinisher(c)) fin += x.inc; const r = tags(c).roles; if (r.has('protect') || r.has('counter')) prot += x.inc; });
  const v = {fin:Math.max(2, Math.min(14, Math.round(fin * 1.1))), prot:Math.max(1, Math.min(10, Math.round(prot * 1.2)))}; E._rn = {m:E.map, v}; return v;
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
// Lands = 31.5 + 1.6 × average mana value of the spells − 0.32 × cheap ramp (mana value 2 or less) + 0.72 × landfall cards,
// between 30 and 42. Commander decks with at least 40 spells; otherwise null (the starting target is used).
function landTarget(A, d){ if (!d || d.format !== 'commander' || A.nonland < 40) return null;
  return Math.max(30, Math.min(42, Math.round(31.5 + 1.6 * A.avg - 0.32 * A.cheapRamp + 0.72 * A.landfall))); }
function legalIn(c, fmt){ return fmt === 'commander' ? c.cmd : c.std; }
function analyze(d){
  const ctx = ctxOf(d), T = targetsOf(d, ctx);
  const A = {ctx, T, size:(ctx.cmd || (d.format === 'commander' && d.commander) ? 1 : 0) + (ctx.par ? 1 : 0), lands:0, nonland:0, cmcSum:0, curve:[0,0,0,0,0,0,0], roles:{ramp:0, draw:0, removal:0, wipe:0},
    unknown:[], over:[], offColor:[], illegal:[], dupes:[], gc:[], mld:[], turns:[], types:{}, aim:(d.aims || []).map(() => 0), price:0, priced:true, cheapRamp:0, landfall:0};
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
      if (tg.roles.has('ramp') && (c.cmc || 0) <= 2) A.cheapRamp += e.q; if (THEMES.lands.re.test(c.o || '')) A.landfall += e.q;
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
  // The land target comes from the deck's own spells (owner's decision, Build 114): our formula, fitted to how many lands
  // players run with 52 commanders (EDHREC averages; misses by about 1.5 lands on commanders it was not fitted to, against
  // 2.2 for a flat 37). Until the deck has most of its spells, the starting target stands.
  { const t = landTarget(A, d); if (t != null) T.lands = t; else if (d.format === 'commander' && (d.aims || [])[0] === 'aggro' && A.avg > 3.2) T.lands = 37; }
  return A;
}

// ----- scoring & recommendations -----
// Tuning weights: how much what the commander's players actually run counts against theme-word matching.
// EDHREC lists a double-faced, adventure or split card under its front face; the card data uses the full name. Look up both.
function edhOf(map, c){ if (!map || !c) return undefined; const v = map.get(c._n); if (v !== undefined) return v; if (c._f === undefined) c._f = String(c.n).includes(' // ') ? norm(String(c.n).split(' // ')[0]) : c._n || norm(c.n); return c._f === c._n ? undefined : map.get(c._f); }
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
// Card sets as a filter: SETCARDS holds, per set code, the cards printed in that set (every printing, read from Scryfall by
// the app). A set is a preference (matching cards score higher) or a rule (only cards printed in the chosen sets; basic
// lands always allowed). A set whose card list has not loaded yet matches only by each card's own shown printing.
let SETCARDS = new Map();
function inSets(c, d){ const ss = d.sets || []; return ss.some(code => c.sc === code || (SETCARDS.has(code) && SETCARDS.get(code).has(c._n))); }
function mustOk(c, d){
  if (d.setsMust && (d.sets || []).length && !isBasic(c.n) && !inSets(c, d)) return false;
  if (d.typesMust && d.types && d.types.length && /\bCreature\b/.test(frontType(c)) && !d.types.some(t => hasCType(c, t))) return false;
  if (d.keysMust && d.keys && d.keys.length && !tags(c).land){ const r = tags(c).roles; if (!['ramp', 'draw', 'removal', 'wipe'].some(j => r.has(j)) && !d.keys.some(k => hasKey(c, k))) return false; }
  return true;
}
let FILT_W = 6, FILT_MUST = 10;
function filtBonus(c, d){
  let s = 0; const why = [], wt = 4, wk = d.keysMust ? FILT_MUST : FILT_W;   // a type rule already narrows the creatures, so it needs no extra push
  (d.types || []).forEach(t => { if (hasCType(c, t)){ s += wt; why.push(t); } else if (new RegExp('\\b' + t + 's?\\b').test(c.o || '')) s += wt / 2; });
  (d.keys || []).forEach(k => { if (hasKey(c, k)){ s += wk; why.push(KEYWORDS[k].label); } });
  if ((d.sets || []).length && !d.setsMust && inSets(c, d)){ s += FILT_W; why.push('From your chosen set'); }
  // Theme first (a generation choice): cards from the commander's own set family or of its creature types are pushed up
  // like a preferred set, so the deck is built from the theme and the rest of the card pool tops it up.
  if (d.themeFirst && d.format === 'commander' && !isBasic(c.n) && themeOf(c, themeCtxC(d))) s += UP.tf;
  return {s, why};
}
const FAST_MANA = new Set(['Sol Ring', 'Mana Crypt', 'Mana Vault', 'Chrome Mox', 'Mox Diamond', 'Jeweled Lotus', 'Lotus Petal', 'Mox Opal', 'Mox Amber', 'Grim Monolith', 'Ancient Tomb', 'Arcane Signet', 'Fellwar Stone', 'Mind Stone', 'Simian Spirit Guide', 'Elvish Spirit Guide', 'Dark Ritual', 'Cabal Ritual', 'Culling the Weak', 'Jeska\'s Will', 'Gemstone Caverns'].map(n => norm(n)));
// Tournament staples (smarter deck score, stage 1): what top-16 tournament lists run that our Apex builds missed (EDHTop16,
// October 2026): fast mana, free or one-mana interaction, and the best lands. Apex only: each is worth UP.ts to a card's
// value (generation, card quality), the lands also count toward card quality, and the mana base may pick them past its usual room.
const TOURNEY = {fast:['Mana Vault', 'Chrome Mox', 'Mox Diamond', 'Mox Opal', 'Mox Amber', 'Jeweled Lotus', 'Lotus Petal', 'Lion\'s Eye Diamond', 'Grim Monolith', 'Dark Ritual', 'Cabal Ritual', 'Rite of Flame', 'Desperate Ritual', 'Pyretic Ritual', 'Seething Song', 'Culling the Weak', 'Jeska\'s Will', 'Simian Spirit Guide', 'Elvish Spirit Guide', 'Springleaf Drum', 'Carpet of Flowers', 'Birds of Paradise', 'Noble Hierarch', 'Ignoble Hierarch', 'Llanowar Elves', 'Elvish Mystic', 'Fyndhorn Elves', 'Arbor Elf', 'Delighted Halfling', 'Avacyn\'s Pilgrim', 'Elves of Deep Shadow', 'Deathrite Shaman'],
  free:['Force of Will', 'Force of Negation', 'Pact of Negation', 'Mindbreak Trap', 'Fierce Guardianship', 'Deflecting Swat', 'Deadly Rollick', 'Flawless Maneuver', 'Obscuring Haze', 'Snuff Out', 'Misdirection', 'Commandeer', 'Subtlety', 'Solitude', 'Endurance', 'Grief', 'Fury', 'Daze', 'Gut Shot', 'Mental Misstep', 'Flusterstorm', 'Spell Pierce', 'Swan Song', 'An Offer You Can\'t Refuse', 'Stern Scolding', 'Veil of Summer', 'Silence', 'Orim\'s Chant', 'Dispel', 'Spell Snare'],
  land:['Ancient Tomb', 'City of Traitors', 'Urza\'s Saga', 'Cavern of Souls', 'Gemstone Caverns', 'Gaea\'s Cradle', 'Mana Confluence', 'City of Brass', 'Otawara, Soaring City', 'Boseiju, Who Endures', 'Tundra', 'Underground Sea', 'Badlands', 'Taiga', 'Savannah', 'Scrubland', 'Volcanic Island', 'Bayou', 'Plateau', 'Tropical Island',
    'Flooded Strand', 'Polluted Delta', 'Bloodstained Mire', 'Wooded Foothills', 'Windswept Heath', 'Marsh Flats', 'Scalding Tarn', 'Verdant Catacombs', 'Arid Mesa', 'Misty Rainforest']};
const TOURNEY_OF = new Map(); for (const k in TOURNEY) TOURNEY[k].forEach(n => TOURNEY_OF.set(norm(n), k));
const TOURNEY_WHY = {fast:'Tournament staple: fast mana', free:'Tournament staple: free or one-mana interaction', land:'Tournament staple: one of the best lands'};
// (UP.tsMid, Build 145) a Mid build counts the tournament staples under its price too: the strongest decks' cheap cards
function tourneyOf(c, d){ return UP.ts && c && d && d.format === 'commander' && (d.tier === 'apex' || !d.tier || (UP.tsMid && d.tier === 'mid' && c.p != null && underCap(c.p, 'mid'))) ? TOURNEY_OF.get(c._n) || '' : ''; }
function baseScore(c, d, ctx){
  let s = 0, hit = false, a0 = 0; const why = [];
  // Little or no play data for this commander (obscure or new; UP.th*): the deck's own mechanics count more and generic power
  // (tournament staples, Game Changers, tutors, the most-played staples) less, so the build follows the commander's plan.
  const thinE = d.format === 'commander' && (!ctx.edh || !ctx.edh.map || ctx.edh.map.size < 60), kA = thinE ? UP.thA : 1, kP = thinE ? UP.thP : 1, kT = thinE ? UP.thT : 1, kS = thinE ? UP.thS : 1;
  (d.aims || []).forEach((a, i) => { const m = matchAim(c, a, ctx.tribe); if (m){ s += kA * AIM_K * (AIM_W[i] || 1) * m; if (m >= 0.7){ hit = true; why.push(a === 'tribal' ? ctx.tribe + ' synergy' : isEdhAim(a) ? themeWhy(a, c) : aimLabel(a, ctx.tribe)); } } });
  ctx.cmdThemes.forEach(a => { if (!(d.aims || []).includes(a) && matchAim(c, a, ctx.cmdTribe) >= 1){ s += 2; hit = true; why.push('Commander strategy'); } });
  // the commander's engine (Build 139): shown as the reason; it adds to the value only with UP.kwB (benchmark: not yet)
  if (ctx.engine){ const f = engineFit(c, ctx.engine); if (f.v){ s += UP.kwB * f.v; if (UP.kwB) hit = true; if (f.v >= 0.8) why.unshift(f.why); else why.push(f.why); } }
  // with no play data of its own, the commander's tribe and theme pages (UP.fbW of the weight its own data would have)
  if (ctx.fall){ let best = null; for (const F of ctx.fall){ const x = edhOf(F.map, c); if (x){ s += UP.fbW * (W_INC * x.inc + W_SYN * Math.max(0, x.syn)) / ctx.fall.length; if (!best || x.inc > best.x.inc) best = {x, F}; } }
    if (best && best.x.inc >= 0.1){ hit = true; why.unshift('In ' + Math.round(best.x.inc * 100) + '% of ' + best.F.label); } }
  if (ctx.edh){ const x = edhOf(ctx.edh.map, c); if (x){ s += W_INC * x.inc + W_SYN * Math.max(0, x.syn); hit = true; why.unshift('In ' + Math.round(x.inc * 100) + '% of ' + ctx.cmd.n.split(',')[0] + ' decks'); }
    // When there is plenty of data for this commander, a card none of its players run needs a better reason to be here.
    else if (ctx.edh.map.size >= 100 && !(c.r && c.r < 400) && !CORE.has(c._n)) s -= EDH_MISS; }
  if ((d.types && d.types.length) || (d.keys && d.keys.length) || (d.sets && d.sets.length && !d.setsMust) || d.themeFirst){ const fb = filtBonus(c, d); if (fb.s){ s += fb.s; if (fb.why.length){ hit = true; fb.why.forEach(w => why.unshift(w)); } } }
  if (d.prevCmd && d.prevCmd === c.n){ s += 3; hit = true; why.unshift('Your previous commander'); }
  a0 = s;
  s += POP_K * (c.r ? 3 * (1 - Math.log(c.r + 1) / Math.log(40000)) : (c.src === 'starter' ? 1.6 : 0.8));   // no rank usually means a new card, not a bad one
  c.ci.forEach(x => { if (!ctx.focus.includes(x)) s -= 1.5; });
  const ft = foreignTribe(c); if (ft && ft !== ctx.tribe && !(ctx.cmd && new RegExp('\\b' + ft + '\\b').test(ctx.cmd.t))){ s -= 5; hit = false; a0 = 0; }
  // Proven staples: the most-played cards anywhere (Rhystic Study, Teferi's Protection, Swords to Plowshares) earn their
  // slot in any deck, tapering off by about #400. The top ~250 count as a fit even when they touch no aim.
  if (CORE.has(c._n) || (c.r && c.r < 60)) s += 6 * STAPLE_K * kS;
  else if (c.r && c.r < 400) s += kS * STAPLE_K * 6 * Math.log(400 / c.r) / Math.log(400 / 60);
  if (!hit && (CORE.has(c._n) || (c.r && c.r < 250)) && !(ft && ft !== ctx.tribe)){ hit = true; why.push('Proven staple'); }
  // Apex power: what the strongest real decks (bracket 4–5) run that average decks skip. Wizards' Game Changer list (the
  // cards that warp games most), tutors and fast mana. Only for the Apex build (d.tier apex), so Budget and Mid are unchanged.
  if ((UP.pw || UP.pt || UP.pf) && (d.tier === 'apex' || !d.tier || (UP.pwMid && d.tier === 'mid')) && d.format === 'commander' && !(ft && ft !== ctx.tribe)){ const r = tags(c).roles;
    if (c.gc && UP.pw){ s += kP * UP.pw; why.push('Game Changer: among the strongest cards in Commander'); }
    if (r.has('tutor') && UP.pt) s += kP * UP.pt;
    if (UP.pf && FAST_MANA.has(c._n)) s += UP.pf; }
  // a staple this commander's players rarely run is worth less here (full value at UP.tsk of decks; all of it without play data)
  { const tk = !(ft && ft !== ctx.tribe) && tourneyOf(c, d); if (tk){ const x = ctx.edh && ctx.edh.map && ctx.edh.map.size >= 100 ? edhOf(ctx.edh.map, c) : null, f = !UP.tsk || !(ctx.edh && ctx.edh.map && ctx.edh.map.size >= 100) ? 1 : x ? Math.min(1, x.inc / UP.tsk) : 0;
    if (f > 0){ s += kT * UP.ts * f; if (f >= 0.5) why.push(TOURNEY_WHY[tk]); } } }
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
  // Filling or generating a Commander deck: it also needs ways to win and to protect them (see routeNeeds).
  const RN = fillOnly && UP.fin && d.format === 'commander' && ctx.edh ? routeNeeds(ctx.edh) : null, rdef = {fin:0, prot:0};
  if (RN){ const cs = d.cards.map(e => find(e.n)).filter(c => c && !tags(c).land); rdef.fin = RN.fin - cs.filter(isFinisher).length; rdef.prot = RN.prot - cs.filter(c => tags(c).roles.has('protect') || tags(c).roles.has('counter')).length; }
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
    // Seeded variation (generation benchmark and multistart): each card's value moves by a fixed random amount.
    if (recommend.noise && recommend.noise.amp){ const r = rng32(recommend.noise.seed); pool.forEach(p => { p.b = Object.assign({}, p.b, {s:p.b.s + (r() - 0.5) * recommend.noise.amp}); }); }
    // Per-card facts read once; each card's largest possible bonus bounds the search (deficits only shrink as cards are added).
    pool.forEach((p, i) => { p.i = i; p.roles = tags(p.c).roles; p.fin = RN ? isFinisher(p.c) : false; p.prot = p.roles.has('protect') || p.roles.has('counter');
      let mb = 0; p.roles.forEach(r => { if (r in def) mb += 4; }); if (RN){ if (p.fin) mb += 2 * UP.fin; if (p.prot) mb += UP.fin * 0.75; } p.ub = p.b.s + mb; });
    const order = pool.slice().sort((x, y) => y.ub - x.ub || x.i - y.i);
    const bonus = c => { let b = 0, w = null, over = 0; tags(c).roles.forEach(r => { if (def[r] > 0){ b += 2 + Math.min(2, def[r] / 3); w = w || r; } else if (r in def && def[r] < 0) over = Math.max(over, -def[r]); });
      if (over && !b) b -= UP.over * Math.min(4, over);
      if (RN){ if (rdef.fin > 0 && isFinisher(c)){ b += UP.fin * (1 + Math.min(1, rdef.fin / 3)); w = w || 'fin'; } const r = tags(c).roles; if (rdef.prot > 0 && (r.has('protect') || r.has('counter'))){ b += UP.fin * 0.75; w = w || 'prot'; } }
      return [b, w]; };   // past the target, another card of the same role is worth less
    let guard = 0;
    while (nAdd > 0 && guard++ < 400){
      let best = null, bs = -1e9, bw = null, strict = true;
      for (let pass = 0; pass < 2 && !best; pass++){
        strict = pass === 0;
        for (const p of order){ if (p.ub < bs) break; if (p.used) continue; const [b, w] = bonus(p.c); if (strict && !p.b.hit && b === 0) continue; const s = p.b.s + b; if (s > bs || (s === bs && best && p.i < best.i)){ bs = s; best = p; bw = w; } }
      }
      if (!best) break; best.used = true;
      const q = std ? Math.min(nAdd, /Legendary/.test(best.c.t) ? 2 : 4) : 1;
      const why = best.b.why.slice(0, 2); if (bw) why.push(bw === 'fin' ? 'A way to win' : bw === 'prot' ? 'Protects your plan' : 'Fills ' + ROLE_LABEL[bw].toLowerCase() + ' gap'); if (!why.length) why.push('Solid staple');
      adds.push({n:best.c.n, q, kind:'spell', why, s:bs, a:best.b.a}); nAdd -= q; tags(best.c).roles.forEach(r => { if (r in def) def[r] -= q; });
      if (RN){ if (isFinisher(best.c)) rdef.fin -= q; const r = tags(best.c).roles; if (r.has('protect') || r.has('counter')) rdef.prot -= q; }
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
  // "As it enters, choose a color … Add one mana of the chosen color" (Thriving lands, Big Apple): any colour, picked as it enters.
  if (UP.lfix && /choose a colou?r/i.test(o) && /chosen colou?r/i.test(o)) 'WUBRG'.split('').forEach(z => out.add(z));
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
function jobsOf(n){ const c = find(n); if (!c || tags(c).land) return []; if (c._jb) return c._jb.slice(); return (c._jb = jobsOf0(c)).slice(); }
function jobsOf0(c){ const j = [...tags(c).roles].filter(r => JOBS.includes(r)), t = frontType(c);
  if (COST_RE.test((c.o || '').replace(/this spell costs[^.]*\./gi, '')) && !/^(Instant|Sorcery)/.test(t)) j.push('cost');
  if (/\bEquipment\b/.test(t)) j.push('gear'); else if (/\bAura\b/.test(t)) j.push('aura'); else if (/\bVehicle\b/.test(t)) j.push('vehicle'); return j; }
const mainJob = n => { const j = jobsOf(n); return JOB_ORDER.find(x => j.includes(x)) || ''; };
const TIER_KEYS_UP = ['apex', 'mid', 'budget'];
// Tier ceilings are strict: Budget is under $3 and Mid under $12; exactly $3 or $12 does not qualify.
const underCap = (p, t) => t === 'apex' || (p != null && p < TIERS[t].cap);
// The card a tier's package uses for one slot: the Apex card when it already fits the tier's price, otherwise the tier's own
// alternative (Mid falls back to the Budget pick). Unknown prices never count as fitting a cap.
// Score check: every swap shown is played out on the whole-deck evaluator (synergy, balance, card quality, win routes, mana
// from the deck's own practice games). A swap that does not raise the deck score is never recommended: it is dropped and the
// tier says why. Each kept pick carries dScore, the score change it makes, which the app shows instead of a value guess.
const SCORE_MIN = 0.05;   // a swap counts as raising the score from here
function scoreFloor(){ return UP.smin != null ? UP.smin : SCORE_MIN; }   // every suggestion must raise the deck score by a margin the practice games cannot undo
// The value swaps are compared on: past the parts' maximum when UP.unc is on (Build 139).
function cmpOf(e){ return UP.unc && e && e.cmp != null ? e.cmp : e.exact; }
// Both measures of one swap from a single evaluation (Build 140): [past the maximum (or exact when UP.unc is off), exact].
function swapScore2(d, base, apex, cut, add, q){ const u = JSON.parse(JSON.stringify(d)); delete u.plan; cutCard(u, cut, q || 1); addCard(u, add, q || 1); try { const a = evaluateDeck(u, {apex, sim:base.sim}), ex = +(a.exact - base.exact).toFixed(2); return [UP.unc && a.cmp != null && base.cmp != null ? +(a.cmp - base.cmp).toFixed(2) : ex, ex]; } catch (e) { return [null, null]; } }
function swapScore(d, base, apex, cut, add, q, exactOnly){ const u = JSON.parse(JSON.stringify(d)); delete u.plan; cutCard(u, cut, q || 1); addCard(u, add, q || 1); try { const a = evaluateDeck(u, {apex, sim:base.sim}); return +(!exactOnly && UP.unc && a.cmp != null && base.cmp != null ? a.cmp - base.cmp : a.exact - base.exact).toFixed(2); } catch (e) { return null; } }
function recount(out){ out.count = {free:0, budget:0, mid:0, apex:0}; out.cost = {free:0, budget:0, mid:0, apex:0};
  for (const t of ['free'].concat(TIER_KEYS_UP)) out.paths.forEach(L => { const p = t === 'free' ? L.opts.free : tierPick(L, t); if (!p) return; out.count[t] += p.q; const a = find(p.add), c = find(p.cut); out.cost[t] += ((p.own ? 0 : a && a.p || 0) - (c && c.p || 0)) * p.q; }); }
// The score check is a generator (Build 144): where it has a batch of swaps to measure, it hands the batch out (yield) and gets
// the measurements back, so a batch can be spread across helper cores (work.js). scoreCheck runs it here, measuring each batch
// itself with measureBatch, the same function the helpers run, so the result is the same either way.
function scoreCheck(d, R, o){ return runSync(scoreCheckG(d, R, o)); }
function runSync(g){ let r = g.next(); while (!r.done){ let v, err = null; try { v = measureBatch(r.value); } catch (e) { err = e; } r = err ? g.throw(err) : g.next(v); } return r.value; }   // a measurement that fails fails where it was asked for
// A batch: kind 'swap' gives swapScore2 for each [cut, add, q] on the deck's stored practice games; kind 'fresh' gives the
// value compared (cmpOf) of each swapped deck on its own fresh practice games.
function measureBatch(b){ return b.keys.map(([cut, add, q]) => { if (b.kind === 'swap') return swapScore2(b.d, b.base, b.apex, cut, add, q);
  const u = JSON.parse(JSON.stringify(b.d)); delete u.plan; if (cut){ cutCard(u, cut, q || 1); addCard(u, add, q || 1); } return cmpOf(evaluateDeck(u, {apex:b.apex, games:b.games})); }); }
function* scoreCheckG(d, R, o){
  o = o || {}; if (!R || d.format !== 'commander' || !find(d.commander)) return R;
  let base; try { base = o.base || evaluateDeck(d, {apex:o.apex, games:300}); } catch (e) { return R; } if (!base || base.exact == null) return R;
  const memo = new Map(), mk = p => p.cut + '>' + p.add + '>' + (p.q || 1), both = p => { const k = mk(p); if (!memo.has(k)) memo.set(k, swapScore2(d, base, o.apex, p.cut, p.add, p.q)); return memo.get(k); },
    // the swaps of a batch not measured yet (each once), as a batch to hand out
    batch = ps => { const seen = new Set(), keys = []; ps.forEach(p => { const k = mk(p); if (memo.has(k) || seen.has(k)) return; seen.add(k); keys.push([p.cut, p.add, p.q || 1]); }); return keys.length ? {kind:'swap', d, base, apex:o.apex, keys} : null; },
    took = (b, v) => b.keys.forEach((k, i) => memo.set(k[0] + '>' + k[1] + '>' + k[2], v[i])), dOf = p => both(p)[0];
  // the main pick keeps the shown score's own measure (Build 139): lifting the parts' maximum changes the numbers shown and the
  // alternatives, not which card is picked
  const dOfE = p => !UP.unc || UP.uncPick ? dOf(p) : both(p)[1];
  // repairs, refills and theme swaps on a row (UP.uncR) are judged on the shown score, so lifting the maximum only adds rows
  const dOfR = p => UP.uncR ? dOfE(p) : dOf(p);
  // Unpopular pick (owner, option B): only when the gap is big: the alternative raises the score more, few players run it, and
  // the suggested card is run by at least UP.unpopX times as many (and UP.unpopG more of all decks), and the alternative clearly
  // scores more (by UP.unpopS, and UP.unpopR times the pick's gain), so the chip is rare and means something.
  const incN = n => { const c = find(n), e = c && ctx0.edh && edhOf(ctx0.edh.map, c); return e ? e.inc : 0; };
  const unpopOf = (w, inc, tp) => { if (!(w > tp.dScore && inc < UP.unpop)) return false; if (!UP.unpopX) return true; if (w - tp.dScore < UP.unpopS || w < UP.unpopR * tp.dScore) return false; const pi = incN(tp.add); return pi >= UP.unpopX * inc && pi - inc >= UP.unpopG; };
  // Players' choice (owner, 18 Oct; UP.plc): a card at least UP.plc of this commander's players run (and clearly more than run the
  // card going out) stays suggested when the deck score sees the swap as about even (no worse than UP.plcS, within the practice
  // games' noise), labelled with its play rate. Only with enough decks behind the numbers (UP.plcD); the rules still apply, since
  // only cards the engine already found legal, in colour and in price are kept this way.
  const pcOk = (p, v) => { const ac = find(p.add); return !!UP.plc && !!ac && !tags(ac).land && v != null && v >= UP.plcS && !!ctx0.edh && (ctx0.edh.decks || 0) >= UP.plcD && incN(p.add) >= UP.plc && incN(p.add) - incN(p.cut) >= UP.plcG; };   // not a land: the stored practice games can't measure a land swap, so its 0 is not "about even"
  const LAB = {apex:'Apex', mid:'Mid', budget:'Budget'}; let dropped = 0, refilled = 0, themed = 0, repaired = 0; const extra = [];
  const T = themeCtx(d), VM = new Map(), ctx0 = ctxOf(d), dis0 = new Set((d.dismissed || []).map(norm)); let TP = null; const own = upgradePaths.own, inUse = () => new Set(R.paths.concat(extra).flatMap(L => Object.values(L.opts).map(p => p.add)));   // the rows the repairs made too (Build 146: a card was suggested on two rows)
  const swapTo = (p, n, v, why) => { const c = find(n); return Object.assign({}, p, {add:c.n, dScore:v, held:false, own:!!(own && own.has(c._n)), gc:!!c.gc, why:(why ? [why] : []).concat((p.why || []).filter(w => !/^From |theme$/.test(w))).slice(0, 2), alt:p.add}); };
  { const b = batch(R.paths.flatMap(L => ['apex', 'mid', 'budget', 'free'].map(t => L.opts[t]).filter(Boolean))); if (b) took(b, yield b); }
  for (const L of R.paths) for (const t of ['apex', 'mid', 'budget', 'free']){ const p = L.opts[t]; if (!p) continue; const v = dOf(p); p.dScore = v;
    if (v != null && v < scoreFloor()){
      // the pick would not raise the score: the strongest close card for the same job and price band that does takes its place
      let rep = null;
      // first: the same card against another weak card in the deck (the cut, not the card, was the problem)
      if (t !== 'free' && o.repair !== false && R.valOf){ const cutsInUse = new Set(R.paths.map(x => x.cut).concat(extra.map(x => x.cut))), addC = find(p.add), addLand = addC && !!tags(addC).land;
        const pool = d.cards.filter(e => !e.l && !cutsInUse.has(e.n) && !isBasic(e.n) && e.n !== p.cut).map(e => ({e, c:find(e.n)})).filter(x => x.c && !!tags(x.c).land === addLand && !x.c.gc === !p.gcOut).map(x => ({n:x.e.n, v:R.valOf(x.c)})).sort((a, b) => a.v - b.v).slice(0, 6);
        { const b = batch(pool.map(x => ({cut:x.n, add:p.add, q:1}))); if (b) took(b, yield b); }
        let best = null; for (const x of pool){ const w = dOfR({cut:x.n, add:p.add, q:1}); if (w != null && w >= SCORE_MIN && (!best || w > best.w)) best = {n:x.n, w}; }
        if (best){ delete L.opts[t]; extra.push({after:L, cut:best.n, opts:{[t]:Object.assign({}, p, {cut:best.n, q:1, dScore:best.w, cutWhy:['Weakest fit for the build'], repaired:p.cut})}, none:{}, gain:p.gain}); repaired++; if (LAB[t]) (L.none = L.none || {})[t] = p.add.split(' // ')[0] + ' is suggested in place of ' + best.n.split(' // ')[0] + ' instead, where it raises the deck score'; continue; } }
      if (t !== 'free' && o.refill !== false){ const used = inUse(); for (const a of altsFor(d, p.add, {cut:p.cut, val:R.valOf, skip:[...used], n:3, vmemo:VM})){ const w = dOfR({cut:p.cut, add:a.n, q:p.q}); if (w != null && w >= SCORE_MIN){ rep = swapTo(p, a.n, w, a.theme); break; } } }
      if (rep){ L.opts[t] = rep; refilled++; continue; }
      if (pcOk(p, v)){ L.opts[t] = Object.assign({}, p, {pc:true, pcInc:+incN(p.add).toFixed(3)}); continue; }
      delete L.opts[t]; dropped++; if (LAB[t]) (L.none = L.none || {})[t] = 'No ' + LAB[t] + ' card for this slot raises the deck score (' + p.add.split(' // ')[0] + ' would not), so none is suggested'; continue; }
    // AT ALL TIMES: an on-theme card (the commander's set or theme creature types) that is about as strong is the suggestion
    if (t !== 'free' && !p.held && o.theme !== false && !themeOf(find(p.add), T) && v != null){
      const pc = find(p.add), vc = R.valOf ? R.valOf(pc) : null, vcu = R.valOf ? R.valOf(find(p.cut)) : null, used = new Set([...inUse()].map(norm)), band = priceBand(pc.p), same = sameJobAs(pc, d, ctx0);
      if (!TP) TP = LIB.filter(x => !isBasic(x.n) && legalIn(x, d.format) && x.ci.every(k => ctx0.ident.includes(k)) && mustOk(x, d) && themeOf(x, T) && !entryOf(d, x.n) && !dis0.has(x._n));
      const cand = TP.filter(x => !used.has(x._n) && priceBand(x.p) === band && (x.p != null || band === 'apex') && same(x)).map(x => ({n:x.n, theme:themeOf(x, T), v:vc == null ? 0 : R.valOf(x)}))
        .filter(a => vc == null || (a.v > vcu && a.v >= vc - 0.25 * Math.max(0, vc - vcu))).sort((a, b) => b.v - a.v);
      for (const a of cand.slice(0, 2)){
        const w = dOfR({cut:p.cut, add:a.n, q:p.q}); if (w != null && w >= SCORE_MIN && w >= 0.75 * v){ L.opts[t] = swapTo(p, a.n, w, a.theme); themed++; break; } } } }
  // The deck score decides every slot (the owner's rule). Among the cards that do the same job as the slot's pick, measured
  // against the same card going out: the one that raises the deck score most is the Apex card, whatever it costs; the best
  // of the rest under $12 is Mid and the best of the rest under $3 is Budget. A card that raises the score but loses to its
  // own price tier's pick is an alternative there (at least half that pick's gain, best three). Nothing else is suggested.
  // An on-theme card counts as equal when it is within RANK_THEME of the best (the "on theme, within reason" rule).
  if (o.rank !== false && UP.rank){ const used = new Set(), rows = R.paths.concat(extra);
    rows.forEach(L => ['apex', 'mid', 'budget', 'free'].forEach(t => { if (L.opts[t]) used.add(norm(L.opts[t].add)); }));
    const inDeck = new Set(d.cards.map(e => norm(e.n)).concat([norm(d.commander)], d.partner ? [norm(d.partner)] : []));
    // the deck's playable cards, each with a quick strength guess (play rate with this commander, then popularity) used only
    // to choose which cards are measured; the deck score then decides
    const U = LIB.filter(x => !isBasic(x.n) && legalIn(x, d.format) && x.ci.every(k => ctx0.ident.includes(k)) && mustOk(x, d) && !inDeck.has(x._n) && !dis0.has(x._n))
      .map(x => { const e = ctx0.edh && edhOf(ctx0.edh.map, x); return {c:x, g:(e ? 10 * e.inc + 4 * Math.max(0, e.syn) : 0) + (x.r ? Math.max(0, 1 - Math.log(x.r + 1) / Math.log(40000)) : 0)}; }).sort((a, b) => b.g - a.g);
    // the cards measured for a row: its picks and the strongest cards that do the same job, as of the cards already used on the list
    const sel = L => { const O = L.opts, ref = O.apex || O.mid || O.budget; if (!ref) return null; const rc = find(ref.add); if (!rc) return null;
      const mine = new Set(['apex', 'mid', 'budget'].map(t => O[t] && norm(O[t].add)).filter(Boolean)), weak = !!(UP.weakD && ref.dScore != null && ref.dScore < UP.weakD), sameP = sameJobAs(rc, d, ctx0, weak ? 2 : undefined), cc = UP.altCut && find(L.cut), sameC = cc && !!tags(cc).land === !!tags(rc).land ? sameJobAs(cc, d, ctx0, weak ? 2 : undefined) : null, same = !sameC ? sameP : x => sameP(x) || sameC(x), strict = weak && UP.weakA ? sameJobAs(rc, d, ctx0) : null, land = !!tags(rc).land;   // a slot whose pick barely helps may take an off-theme card (owner: on-theme wins when about equal)
      const pool = [], nb = {budget:0, mid:0}; for (const y of U){ const x = y.c; if (!!tags(x).land !== land || (used.has(x._n) && !mine.has(x._n)) || x.p == null || (R.cap && !(x.p < R.cap) && !(own && own.has(x._n))) || !same(x)) continue;
        const b = underCap(x.p, 'budget'), m = underCap(x.p, 'mid'); if (pool.length >= UP.rankP && !(b && nb.budget < UP.rankB * 2) && !(m && nb.mid < UP.rankB * 2)) { if (nb.budget >= UP.rankB * 2 && nb.mid >= UP.rankB * 2) break; continue; }
        pool.push(x); if (b) nb.budget++; if (m) nb.mid++; }
      // Blind spots (Build 135): a few of Commander's most-played cards that do the same job are measured too, even when this
      // commander's players barely run them (Sheoldred for Doom). The deck score decides; popular picks still lead.
      if (UP.stN && (!UP.stW || weak)){ const inP = new Set(pool.map(x => x._n)); U.filter(y => y.c.r && y.c.r < UP.stR && !inP.has(y.c._n) && !!tags(y.c).land === land && !(used.has(y.c._n) && !mine.has(y.c._n)) && y.c.p != null && !(R.cap && !(y.c.p < R.cap)) && same(y.c))
        .sort((a, b) => a.c.r - b.c.r).slice(0, UP.stN).forEach(y => pool.push(y.c)); }
      const vv = x => { if (!VM.has(x._k)) VM.set(x._k, R.valOf ? R.valOf(x) : 0); return VM.get(x._k); };
      const byV = pool.slice().sort((a, b) => vv(b) - vv(a)), pick = new Map();
      byV.slice(0, UP.rankN).forEach(x => pick.set(x._n, x)); if (UP.stN && UP.stM) pool.filter(x => x.r && x.r < UP.stR && !pick.has(x._n)).sort((a, b) => a.r - b.r).slice(0, UP.stN).forEach(x => pick.set(x._n, x)); ['budget', 'mid'].forEach(t => byV.filter(x => underCap(x.p, t)).slice(0, UP.rankB).forEach(x => pick.set(x._n, x)));
      mine.forEach(k => { const c = pool.find(x => x._n === k) || LIB.find(x => x._n === k); if (c) pick.set(k, c); });
      return {O, ref, rc, mine, weak, sameP, cc, sameC, same, strict, land, pool, vv, byV, pick}; };
    // With helper cores (Build 144: measureBatch.par), every row's candidates are measured up front in one batch they share,
    // instead of a small batch per row; each row then finds its measurements already made (any it lacks are measured as before).
    if ((measureBatch.par || 0) > 1){ const ps = []; for (const L of rows){ const s = sel(L); if (s) s.pick.forEach(c => ps.push({cut:L.cut, add:c.n, q:s.ref.q})); } const b = batch(ps); if (b) took(b, yield b); }
    for (const L of rows){ const s = sel(L); if (!s) continue; const {O, ref, rc, mine, weak, sameP, cc, sameC, same, strict, land, pool, vv, byV, pick} = s;
      { const b = batch([...pick.values()].map(c => ({cut:L.cut, add:c.n, q:ref.q}))); if (b) took(b, yield b); }
      const C0 = [...pick.values()].map(c => ({c, w:dOf({cut:L.cut, add:c.n, q:ref.q}), we:dOfE({cut:L.cut, add:c.n, q:ref.q}), th:themeOf(c, T), rx:!!(strict && !strict(c)), oc:!!(sameC && !sameP(c))})), C = C0.filter(x => x.w != null && x.w >= Math.max(scoreFloor(), UP.rankMin)).sort((a, b) => b.w - a.w || vv(b.c) - vv(a.c));
      { const b = C[0], e = b && ctx0.edh && edhOf(ctx0.edh.map, b.c); L.top = b ? {n:b.c.n, p:b.c.p, dScore:b.w, inc:e ? +e.inc.toFixed(3) : 0} : null; }   // the highest score measured for this slot
      const take = (list, t) => { if (!list.length) return null; const top = list[0], th = list.find(x => x.th && x.w >= top.w - Math.abs(top.w) * RANK_THEME); return th || top; };
      // a held pick (the player has seen it and it holds its place until swapped, ruled out or regenerated) keeps its tier
      const out = {}, left = C.slice(); ['apex', 'mid', 'budget'].forEach(t => { const p = O[t]; if (!p || (UP.rankPick && !p.held)) return; const i = left.findIndex(y => y.c._n === norm(p.add)); out[t] = Object.assign({}, p, {dScore:i >= 0 ? left[i].w : p.dScore}); if (i >= 0) left.splice(i, 1); });
      for (const t of ['apex', 'mid', 'budget']){ if (out[t] || !UP.rankPick) continue; const x = take(t === 'apex' ? left : left.filter(y => underCap(y.c.p, t)), t); if (!x) continue; left.splice(left.indexOf(x), 1);
        const old = ['apex', 'mid', 'budget'].map(k => O[k]).find(p => p && norm(p.add) === x.c._n); out[t] = old ? Object.assign({}, old, {dScore:x.w, t}) : Object.assign(swapTo(ref, x.c.n, x.w, x.th), {t}); }
      if (!UP.rankPick) for (let k = left.length - 1; k >= 0; k--) if (mine.has(left[k].c._n)) left.splice(k, 1);   // the slot's own picks are not their own alternatives
      // Alternatives, by price tier: cards that raise the deck score by at least half as much as that tier's pick. With
      // popular picks leading, one may raise the score more than the pick; when few of this commander's players run it,
      // it is marked an unpopular pick, with the numbers behind it.
      const alts = {apex:[], mid:[], budget:[]}; left.forEach(x => { const t = x.c.p != null && underCap(x.c.p, 'budget') ? 'budget' : x.c.p != null && underCap(x.c.p, 'mid') ? 'mid' : 'apex', tp = out[t] || out.mid || out.apex;
        if (!tp || alts[t].length >= 3 || (UP.rankPick && x.w > tp.dScore) || x.w < Math.max(scoreFloor(), 0.5 * tp.dScore)) return;
        const e = ctx0.edh && edhOf(ctx0.edh.map, x.c), inc = e ? e.inc : 0;
        alts[t].push({n:x.c.n, p:x.c.p, dScore:x.w, theme:x.th, inc:+inc.toFixed(3), decks:ctx0.edh ? ctx0.edh.decks || 0 : 0, vs:tp.add, vsScore:tp.dScore, vsInc:+incN(tp.add).toFixed(3), unpop:unpopOf(x.w, inc, tp)}); });
      if (UP.rankPick) ['apex', 'mid', 'budget'].forEach(t => { if (out[t]) O[t] = out[t]; else if (O[t] && O[t].pc && !['apex', 'mid', 'budget'].some(k => out[k] && norm(out[k].add) === norm(O[t].add))){ /* a Players' choice pick holds when no card raises the score */ } else if (O[t]){ delete O[t]; (L.none = L.none || {})[t] = 'No card under $' + TIERS[t].cap + ' that does this job raises the deck score enough after the cards above it'; } });
      // Players decide what competes, the deck score picks the winner (UP.cand): the candidates are cards this commander's players
      // run in at least UP.cand of decks, proven staples and tournament staples. In each column the highest-scoring candidate at
      // that price is the pick (each card once on the row); the popular pick it replaces stays first among the alternatives, marked
      // Most played, so the popular vote is never lost.
      if (UP.cand > 0){ const thin = !ctx0.edh || !ctx0.edh.map || ctx0.edh.map.size < 100, cred = x => thin || CORE.has(x.c._n) || (x.c.r && x.c.r < (UP.stC || 400)) || !!tourneyOf(x.c, d) || ((ctx0.edh && edhOf(ctx0.edh.map, x.c)) || {inc:0}).inc >= UP.cand;
        // the players' vote counts as evidence of strength the score can't see: each candidate's value is its score gain plus
        // UP.candL times the share of this commander's players who run it (UP.candL 0: the score alone decides)
        const incOf = x => ((ctx0.edh && edhOf(ctx0.edh.map, x.c)) || {inc:0}).inc, est = x => (x.we != null ? x.we : x.w) + (UP.candL || 0) * incOf(x);
        const CR = C.filter(x => cred(x) && !x.rx && !x.oc && (x.we != null ? x.we : x.w) >= UP.candMin).sort((a, b) => est(b) - est(a)), taken = new Set(), pop = {};   // a new pick clears practice-game noise
        for (const t of ['apex', 'mid', 'budget']){ let cur = O[t]; if (cur && (cur.held || (UP.gcT && t === 'apex' && cur.gcPick && L.gcPick))){ taken.add(norm(cur.add)); continue; }   // a pick the player chose holds its place, and so does an Apex Game Changer row's (UP.gcT)
          if (cur && taken.has(norm(cur.add))){ cur = null; delete O[t]; }
          const b = (t === 'apex' ? CR : CR.filter(x => x.c.p != null && underCap(x.c.p, t))).find(x => !taken.has(x.c._n));
          const curEst = cur ? (cur.dScore != null ? cur.dScore : -1e9) + (UP.candL || 0) * ((ctx0.edh && edhOf(ctx0.edh.map, find(cur.add))) || {inc:0}).inc : -1e9;
          if (b && (!cur || (est(b) > curEst + Math.max(SCORE_MIN, UP.candM || 0) && b.w > (cur.dScore != null ? cur.dScore : -1e9))) && !(cur && norm(cur.add) === b.c._n)){ if (cur) pop[t] = cur; O[t] = Object.assign(swapTo(ref, b.c.n, b.w, b.th), {t, held:false, cut:L.cut, q:ref.q}); }
          if (O[t]) taken.add(norm(O[t].add)); else if (!(L.none && L.none[t])) (L.none = L.none || {})[t] = 'The Apex card already costs under $' + TIERS[t].cap; }
        const onRow = new Set(['apex', 'mid', 'budget'].map(t => O[t] && norm(O[t].add)).filter(Boolean));
        for (const t in pop){ const p0 = pop[t]; if (onRow.has(norm(p0.add))) continue; const c0 = find(p0.add), e0 = c0 && ctx0.edh && edhOf(ctx0.edh.map, c0);
          (L.pop = L.pop || {})[t] = p0; alts[t] = [{n:p0.add, p:c0 ? c0.p : null, dScore:p0.dScore, theme:themeOf(c0, T), inc:e0 ? +e0.inc.toFixed(3) : 0, decks:ctx0.edh ? ctx0.edh.decks || 0 : 0, vs:O[t] && O[t].add, vsScore:O[t] && O[t].dScore, most:true}].concat(alts[t].filter(x => norm(x.n) !== norm(p0.add))).slice(0, 3); onRow.add(norm(p0.add)); }
        // Mid and Budget never raise the deck score more than the Apex pick: a cheaper card that would is moved to the
        // alternatives (still on the row) and the column takes the best candidate that doesn't
        const ap = O.apex && O.apex.dScore != null ? O.apex.dScore : null;
        if (ap != null) for (const t of ['mid', 'budget']){ const p = O[t]; if (!p || p.held || p.dScore == null || p.dScore <= ap + SCORE_MIN) continue;
          const c0 = find(p.add), e0 = c0 && ctx0.edh && edhOf(ctx0.edh.map, c0); alts[t] = [{n:p.add, p:c0 ? c0.p : null, dScore:p.dScore, theme:themeOf(c0, T), inc:e0 ? +e0.inc.toFixed(3) : 0, decks:ctx0.edh ? ctx0.edh.decks || 0 : 0, vs:O.apex.add, vsScore:ap, unpop:false}].concat(alts[t]).slice(0, 3);
          onRow.delete(norm(p.add)); const b = CR.filter(x => x.c.p != null && underCap(x.c.p, t)).find(x => !onRow.has(x.c._n) && x.w <= ap + SCORE_MIN && x.c._n !== norm(p.add));
          if (b){ O[t] = Object.assign(swapTo(ref, b.c.n, b.w, b.th), {t, held:false, cut:L.cut, q:ref.q}); onRow.add(b.c._n); } else { delete O[t]; (L.none = L.none || {})[t] = 'The cheaper cards for this job would raise the score more than the Apex pick; they are listed as alternatives'; } }
        ['apex', 'mid', 'budget'].forEach(t => { const tp = O[t] || O.mid || O.apex; alts[t] = alts[t].filter(x => x.most || (!onRow.has(norm(x.n)) && (!tp || x.dScore >= Math.max(scoreFloor(), 0.5 * tp.dScore) || x.dScore > tp.dScore))); }); }
      // Apex is the strongest pick on the row: a cheaper pick (or, with UP.apexMax 2, the row's highest-scoring card) that raises the
      // deck score more becomes the Apex pick, and is not repeated in its cheaper column.
      if (UP.apexMax){ let best = O.apex, bw = O.apex && O.apex.dScore != null ? O.apex.dScore : -1e9;
        ['mid', 'budget'].forEach(t => { const p = O[t]; if (p && p.dScore != null && p.dScore > bw + SCORE_MIN){ best = p; bw = p.dScore; } });
        if (UP.apexMax > 1 && L.top && L.top.dScore > bw + SCORE_MIN && !(O.apex && norm(O.apex.add) === norm(L.top.n))){ const tc = find(L.top.n); if (tc){ best = Object.assign(swapTo(ref, tc.n, L.top.dScore, themeOf(tc, T)), {t:'apex'}); bw = L.top.dScore; } }
        if (best && best !== O.apex){ const nb = Object.assign({}, best, {t:'apex', held:false}); O.apex = nb; used.add(norm(nb.add));
          ['mid', 'budget'].forEach(t => { if (O[t] && norm(O[t].add) === norm(nb.add)){ delete O[t]; (L.none = L.none || {})[t] = 'The Apex card already costs under $' + TIERS[t].cap; } });
          // alternatives are measured against their tier's pick again (it may now be the stronger Apex card)
          ['apex', 'mid', 'budget'].forEach(t => { const tp = O[t] || O.mid || O.apex; alts[t] = alts[t].filter(x => norm(x.n) !== norm(nb.add) && tp && x.dScore >= Math.max(scoreFloor(), 0.5 * tp.dScore)).map(x => Object.assign(x, {vs:tp.add, vsScore:tp.dScore, vsInc:+incN(tp.add).toFixed(3), unpop:unpopOf(x.dScore, x.inc, tp)})); }); } }
      // Players' choice (UP.plc): a card at least UP.plc of this commander's players run (and clearly more than run the card going out)
      // that the deck score sees as about even here (no worse than UP.plcS) is listed among the alternatives, labelled with its play
      // rate, so the players' pick is never hidden. One per price column, after the cards that raise the score.
      if (UP.plc){ const onRow = new Set(['apex', 'mid', 'budget'].map(t => O[t] && norm(O[t].add)).concat(Object.values(alts).flat().map(a => norm(a.n))).filter(Boolean));
        C0.filter(x => x.w != null && x.w < Math.max(scoreFloor(), UP.rankMin) && !x.rx && !onRow.has(x.c._n) && !used.has(x.c._n) && pcOk({cut:L.cut, add:x.c.n}, x.w)).sort((a, b) => incN(b.c.n) - incN(a.c.n) || b.w - a.w).forEach(x => {
          const t = x.c.p != null && underCap(x.c.p, 'budget') ? 'budget' : x.c.p != null && underCap(x.c.p, 'mid') ? 'mid' : 'apex'; if (alts[t].some(a => a.pc) || onRow.has(x.c._n)) return; const tp = O[t] || O.mid || O.apex;
          const a = {n:x.c.n, p:x.c.p, dScore:x.w, theme:x.th, inc:+incN(x.c.n).toFixed(3), decks:ctx0.edh.decks || 0, vs:tp && tp.add, vsScore:tp && tp.dScore, pc:true};
          if (alts[t].length >= 3) alts[t][2] = a; else alts[t].push(a); onRow.add(x.c._n); }); }
      ['apex', 'mid', 'budget'].forEach(t => { if (O[t]) used.add(norm(O[t].add)); }); Object.values(alts).flat().forEach(a => used.add(norm(a.n))); L.alts = alts; L.ranked = true; } }
  // Spare lands (owner's rule): when the deck runs more lands than its target, each extra land is a slot that can go for a
  // stronger card, never more than the surplus and never when the deck is at or under target. Land changes are measured
  // with fresh practice games (the stored games can't show what losing a land does); each card must raise the score.
  if (o.spare !== false && UP.spare){ const rows0 = R.paths.concat(extra), cutting = new Set(rows0.map(L => norm(L.cut))), already = rows0.filter(L => { const c = find(L.cut); return c && tags(c).land && Object.values(L.opts).some(p => { const a = find(p.add); return a && !tags(a).land; }); }).length;
    // never more land-for-spell swaps than the surplus, counting any the list already has; a land already being cut is skipped
    const sp = spareLands(d).filter((n, i, a) => isBasic(n) || !cutting.has(norm(n))).slice(0, Math.max(0, spareLands(d).length - already)); if (sp.length){ try {
    const A = analyze(d);
    const used = new Set(R.paths.concat(extra).flatMap(L => Object.values(L.opts).map(p => norm(p.add)))), inDeck = new Set(d.cards.map(e => norm(e.n)).concat([norm(d.commander)], d.partner ? [norm(d.partner)] : []));
    const vv = x => { if (!VM.has(x._k)) VM.set(x._k, R.valOf ? R.valOf(x) : 0); return VM.get(x._k); };
    const P = LIB.filter(x => !tags(x).land && !isBasic(x.n) && legalIn(x, d.format) && x.ci.every(k => ctx0.ident.includes(k)) && mustOk(x, d) && !inDeck.has(x._n) && !dis0.has(x._n) && !used.has(x._n) && x.p != null && !(R.cap && !(x.p < R.cap) && !(own && own.has(x._n))))
      .sort((a, b) => vv(b) - vv(a)), pick = new Map(); P.slice(0, UP.spareN).forEach(x => pick.set(x._n, x)); ['budget', 'mid'].forEach(t => P.filter(x => underCap(x.p, t)).slice(0, 2).forEach(x => pick.set(x._n, x)));
    // measured on fresh practice games, as one batch: the deck itself first, then each spare land swapped for a candidate
    const PK = [...pick.values()], fv = yield {kind:'fresh', d, apex:o.apex, games:200, keys:[['', '', 0]].concat(PK.map(c => [sp[0], c.n, 1]))}, b0 = fv[0];
    const M = PK.map((c, i) => ({c, w:+(fv[i + 1] - b0).toFixed(2)})).filter(x => x.w != null && x.w >= Math.max(scoreFloor(), UP.rankMin)).sort((a, b) => b.w - a.w), taken = new Set();
    const why = 'Uses a spare land: the deck runs ' + A.lands + ' lands, about ' + A.T.lands + ' needed';
    const mk = (cut, x, t) => ({cut, add:x.c.n, q:1, t, why:[why], cutWhy:['Spare land (' + A.lands + ' lands, about ' + A.T.lands + ' needed)'], gc:!!x.c.gc, gcOut:false, own:!!(own && own.has(x.c._n)), dScore:x.w, spare:true});
    sp.forEach(cut => { const O = {}, nx = f => M.find(x => !taken.has(x.c._n) && f(x)); const a = nx(() => true); if (!a) return; taken.add(a.c._n); O.apex = mk(cut, a, 'apex');
      for (const t of ['mid', 'budget']){ if (underCap(a.c.p, t)) continue; const x = nx(y => underCap(y.c.p, t)); if (x){ taken.add(x.c._n); O[t] = mk(cut, x, t); } }
      extra.push({cut, opts:O, none:{}, gain:0, alts:{apex:[], mid:[], budget:[]}, ranked:true, spare:true}); });
  } catch (e) {} } }
  // re-paired picks follow the engine's own list (measured: better agreement with players than keeping their old place)
  extra.forEach(x => delete x.after); R.paths = R.paths.filter(L => ['apex', 'mid', 'budget', 'free'].some(t => L.opts[t])).concat(extra);
   // the engine's order (strongest upgrade first, checked against real players) is kept
  // Borderline swaps are confirmed (UP.conf, Build 141): a swap that raises the score by less than UP.conf on the stored practice
  // games is measured again on fresh ones, and left out unless it still raises the score; the floor is meant to be a margin the
  // practice games cannot undo, and near it they sometimes can.
  if (UP.conf){ let b1 = null; const fresh = new Map(), fr = p => { const k = p.cut + '>' + p.add + '>' + (p.q || 1); if (!fresh.has(k)){ try { if (b1 == null) b1 = evaluateDeck(d, {apex:o.apex, games:300}).exact; const u = JSON.parse(JSON.stringify(d)); delete u.plan; cutCard(u, p.cut, p.q || 1); addCard(u, p.add, p.q || 1); fresh.set(k, evaluateDeck(u, {apex:o.apex, games:300}).exact - b1); } catch (e) { fresh.set(k, 1); } } return fresh.get(k); };
    R.paths.forEach(L => { if (L.spare) return; for (const t in L.opts){ const p = L.opts[t]; if (!p || p.held || p.dScore == null || p.dScore >= UP.conf) continue; const c = find(p.cut), a = find(p.add); if ((c && tags(c).land) || (a && tags(a).land)) continue; if (fr(p) < UP.confT){ (R.confDrop = R.confDrop || []).push([L.cut, p.add, t, p.dScore, +fr(p).toFixed(2)]); delete L.opts[t]; } } });
    R.paths = R.paths.filter(L => Object.values(L.opts).some(Boolean)); }
  // Game Changers follow the rule of every other mechanic (owner, 18 Oct): an Apex Game Changer row stays only when the card is a
  // Good or Great fit for this deck (evalFit, the card window's own rating); up to UP.gcK of them, and more only when one is a
  // Strong upgrade or better (raises the deck score by UP.gcS or more).
  if (UP.gcF){ const G = R.paths.filter(L => L.gcPick && L.opts.apex && L.opts.apex.gcPick).sort((a, b) => (b.opts.apex.dScore || 0) - (a.opts.apex.dScore || 0)); let k = 0; const drop = new Set();
    for (const L of G){ const p = L.opts.apex, c = find(p.add); let f = 'poor'; try { f = evalFit(d, c, null).fit; } catch (e) {}
      if (!(f === 'great' || f === 'good') || (k >= UP.gcK && !((p.dScore || 0) >= UP.gcS))) drop.add(L); else k++; }
    if (drop.size){ R.paths = R.paths.filter(L => !drop.has(L)); R.gcDropped = (R.gcDropped || 0) + drop.size; } }
  if (R.trimOf){ const n0 = R.paths.length; R.paths = R.paths.filter(L => !R.trimOf(L)); R.trimN = (R.trimN || 0) + n0 - R.paths.length; } const trimmed = R.trimN || 0;
  // Past the maximum (UP.uncTail): a row whose gain shows only past the parts' maximum (its pick raises the shown score by less
  // than the floor) stays on the list but goes after every row with a gain on the shown score.
  if (UP.unc && UP.uncTail){ const ex = L => { const p = tierPick(L, 'apex') || L.opts.apex || Object.values(L.opts)[0]; if (!p || L.spare) return 1; const c = find(p.cut), a = find(p.add); if ((c && tags(c).land) || (a && tags(a).land)) return 1; const v = both(p)[1]; return v == null ? 1 : v; };
    const pcRow = L => { const p = tierPick(L, 'apex') || L.opts.apex || Object.values(L.opts)[0]; return !!(p && p.pc); };
    const lo = [], pcs = []; R.paths = R.paths.filter(L => { const v = ex(L); if (v >= scoreFloor()) return true; if (pcRow(L)){ L.pcRow = true; pcs.push(L); return false; } if (v >= 0){ L.pastMax = true; lo.push(L); } return false; }).concat(lo, pcs); }   // never a swap that lowers the shown score (owner's rule)   // scoreCheck can run twice on one list recount(R);   // picks changed above (and rows left out): the tier counts follow
  R.scored = {base:base.exact, dropped, refilled, themed, repaired, trimmed}; R.dOf = (cut, add, q) => swapScore(d, base, o.apex, cut, add, q);
  R.base = {sim:base.sim, exact:base.exact, cmp:base.cmp}; R.apexR = o.apex; return R;   // so the search can be measured on other cores (Build 146)
}
// Whole-pool search (owner, 18 Oct; UP.pool2): after the list is checked, every legal card that does the same job as a row's pick
// (the alternatives' rule) is measured as well, a few at a time while the app is idle, so a row's Highest score is the best of
// the whole pool, not only of the shortlist. poolQueue lists the work; poolStep does some of it and says which rows changed.
function poolQueue(d, R){ if (!R || !R.dOf || d.format !== 'commander') return null; const ctx = ctxOf(d), dis = new Set((d.dismissed || []).map(norm));
  const inDeck = new Set(d.cards.map(e => norm(e.n)).concat([norm(d.commander)], d.partner ? [norm(d.partner)] : [])), own = upgradePaths.own;
  const used = new Set(R.paths.flatMap(L => Object.values(L.opts).filter(Boolean).map(p => norm(p.add))));
  const U = LIB.filter(x => !isBasic(x.n) && !tags(x).land && legalIn(x, d.format) && x.ci.every(k => ctx.ident.includes(k)) && mustOk(x, d) && !inDeck.has(x._n) && !dis.has(x._n) && x.p != null && !(R.cap && !(x.p < R.cap) && !(own && own.has(x._n))))
    .map(x => { const e = ctx.edh && edhOf(ctx.edh.map, x); return {c:x, g:(e ? 10 * e.inc + 4 * Math.max(0, e.syn) : 0) + (x.r ? Math.max(0, 1 - Math.log(x.r + 1) / Math.log(40000)) : 0)}; }).sort((a, b) => b.g - a.g).map(y => y.c);
  const rows = []; R.paths.forEach((L, i) => { const p = L.opts.apex || L.opts.mid || L.opts.budget, rc = p && find(p.add), cc = find(L.cut); if (!rc || !cc || L.spare || tags(cc).land || tags(rc).land) return;
    const mine = new Set(Object.values(L.opts).filter(Boolean).map(o => norm(o.add))), same = sameJobAs(rc, d, ctx); rows.push({L, i, q:p.q || 1, mine, pool:U.filter(x => (!used.has(x._n) || mine.has(x._n)) && same(x)).slice(0, UP.poolN), k:0}); });
  return {rows, r:0, done:0, total:rows.reduce((a, x) => a + x.pool.length, 0), dOf:R.dOf, edh:ctx.edh}; }
function poolStep(Q, ms){ const t0 = Date.now(), changed = new Set(); if (!Q) return changed;
  while (Q.r < Q.rows.length && Date.now() - t0 < ms){ const x = Q.rows[Q.r]; if (x.k >= x.pool.length){ Q.r++; continue; } const c = x.pool[x.k++]; Q.done++;
    const L = x.L, v = Q.dOf(L.cut, c.n, x.q); if (v == null || v < Math.max(scoreFloor(), UP.rankMin) || (L.top && v <= L.top.dScore)) continue;
    const e = Q.edh && edhOf(Q.edh.map, c); L.top = {n:c.n, p:c.p, dScore:v, inc:e ? +e.inc.toFixed(3) : 0, pool:true}; changed.add(x.i); }
  return changed; }
// The whole search at once (Build 146): every swap it measures, in order, as one batch for the background cores (measureBatch
// 'swap': its first value is R.dOf's), then the results applied exactly as poolStep would, so the outcome is the same.
function poolKeys(Q){ return Q.rows.flatMap(x => x.pool.map(c => [x.L.cut, c.n, x.q])); }
function poolApply(Q, vals){ let i = 0; for (const x of Q.rows){ for (const c of x.pool){ const r = vals[i++], v = r && r[0] != null ? r[0] : null; const L = x.L;
    if (v == null || v < Math.max(scoreFloor(), UP.rankMin) || (L.top && v <= L.top.dScore)) continue;
    const e = Q.edh && edhOf(Q.edh.map, c); L.top = {n:c.n, p:c.p, dScore:v, inc:e ? +e.inc.toFixed(3) : 0, pool:true}; } x.k = x.pool.length; }
  Q.r = Q.rows.length; Q.done = Q.total; }
const RANK_THEME = 0.1;
function tierPick(L, t){
  const a = L.opts.apex; if (!a) return t === 'budget' ? (L.opts.budget || null) : (L.opts.mid || L.opts.budget || null);   // the Apex pick was dropped by the score check
  if (t === 'apex') return a;
  const ap = (find(a.add) || {}).p; if (a.own || underCap(ap, t)) return a;
  return t === 'mid' ? (L.opts.mid || L.opts.budget || null) : (L.opts.budget || null);
}
// Tuning carried over from Build 72/73 unchanged (wi: play rate, ws: synergy, wf: fit with the build, wd/wk: jobs lost/gained,
// T: job count treated as enough, m: smallest gain worth offering, fn: same-theme/type bonus). Thin = little play data.
const UP = {polP:0, polG:0.3, midOpen:0, budOpen:0, tsMid:0, pwMid:0, fbW:4, cbec:1, ctok:1, ttok:1, altar:1, rld:2, costR:1, plc:0.25, plcS:-0.1, plcG:0.1, plcD:100, conf:0, confT:0, polish:4, polishK:10, polishMin:0.1, gcT:1, gc3:0, nmh:1, thA:1, thP:0.3, thT:0.3, thS:1.5, reF:1, rcap:2, rs:1, rf:0.2, rfn:6, rc:0.05, ra:[0.399, 0.604], cand:0.10, candL:6, candMin:0.3, apexMax:0, planMax:1, msrc:1, ts:6, tsk:0.1, tl:1, tr:6, lf:1, spare:1, spareN:5, rank:1, rankPick:0, kw:1, kwB:0, kwS:0, unc:0.25, uncK:'', uncPick:0, uncTail:1, uncR:0, altCut:2, pool2:1, poolN:250, bs:1, bsF:0.5, bsP:9, starve:0.08, lfix:1, sjx:1, weakD:0.2, weakA:1, stW:1, stN:0, stR:1000, stM:1, stC:0, trim:1, trimPa:0.15, trimCi:10, unpop:0.1, unpopX:3, unpopG:0.1, unpopS:0.2, unpopR:1.5, rankN:18, rankB:4, rankP:30, rankMin:0.15, gv:0, gcN:6, gcB:10, gcK:3, gcS:1, gcF:1, tf:6, tfDrop:0.25, tfEval:2, dom:0.4, pw:1.5, pt:1.5, theme:1, jmu:0, jn:10, jk:8, weak:1, fx:1, rdef:0, mb:1, fin:2, cb:0.5, ck:3, roleT:1, over:2, lt:0.5, wa:0, wo:0, pbDyn:0, pk:7.5, lslack:1, lfast:1, inflate:0, pb:0.25, pc:3, preMin:0.4, wi:15, ws:4, wf:0.1, wd:1, wk:0.75, T:8, m:2, fn:0.3, pool:300, extra:120, prior:0.15, fitMin:5, wfThin:1, mThin:5, fitMinThin:6, extraThin:400, curve:0.25};
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
  // Game Changers (Wizards' list of the cards that most change games) are what lifts a deck into the top brackets; at Apex
  // they are pushed up the list. Budget and Mid lists are unchanged.
  const gcV0 = (d.tier === 'apex' || !d.tier) && d.format === 'commander', gcV = gcV0 ? (UP.gv || 0) : 0;
  const val = c => { const e = E(c), pa = PA(c), ci = PC(c); let inc = e ? e.inc : isNew(c) ? K.prior : 0;
    // Themes judge the precon's own cards only as far as the theme's players are the precon's players (Eshki: barely at all).
    if (TA.length && !tags(c).land){ const lt = preAll.has(c._k) ? K.lt * (1 - preOther) : K.lt; inc = (1 - lt) * inc + lt * themeInc(c); } if (preU && e) inc = preAll.has(c._k) ? Math.max(0, inc - preU) / (1 - preU) : inc / (1 - preU); const pb = K.pbDyn ? Math.max(K.pb, preOther) : K.pb; if (pa) inc = e ? (1 - pb) * inc + pb * pa.inc : pa.inc;
    return K.wi * inc + K.ws * (e ? e.syn : 0) + wf * fit(c) + aimV(c) + (c.gc ? gcV : 0) - (ci != null ? K.pc * (1 - ci / Math.max(1, (tags(c).land ? preLCut : preCut).size)) : (preOther && preAll.has(c._k) ? -K.pk * preOther : 0)); };
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
  // Combos (Commander Spellbook): a card that is part of a complete winning combo in the deck is kept unless something much
  // better comes; a card that completes one gets a small push (players add these only a little more than their play rate
  // says) and says which combo it completes.
  const CB = (K.cb || K.ck) && COMBOS.list.length && d.format === 'commander' ? combosOf(d, ctx.ident) : null, inWin = new Set(), completes = new Map();
  if (CB){ CB.full.filter(x => x.win).forEach(x => x.keys.forEach(k => inWin.add(k))); CB.near.forEach(n => { const c = find(n.miss); if (!c) return; const o = completes.get(c._k); if (!o || (n.x.win && !o.win) || (n.x.win === o.win && n.x.decks > o.decks)) completes.set(c._k, n.x); }); }
  const cbBonus = c => { const x = completes.get(c._k); return x && x.win ? K.cb : 0; };
  const mk = c => ({c, jobs:jobsOf(c.n), v:val(c) + cbBonus(c)});
  const seen = new Set(), C = [];
  [...(ctx.edh ? ctx.edh.map.entries() : [])].map(([k, v]) => ({c:IDX.get(k), inc:v.inc})).filter(x => usable(x.c) && !taken.has(x.c._k)).sort((a, b) => b.inc - a.inc).slice(0, K.pool).forEach(x => { if (seen.has(x.c._k)) return; seen.add(x.c._k); C.push(mk(x.c)); });
  LIB.filter(c => !seen.has(c._k) && usable(c) && !taken.has(c._k)).map(c => ({c, f:fit(c)})).filter(x => x.f >= (thin ? K.fitMinThin : K.fitMin)).sort((a, b) => b.f - a.f).slice(0, thin ? K.extraThin : K.extra).forEach(x => { seen.add(x.c._k); C.push(mk(x.c)); });
  if (CB) completes.forEach((x, k) => { if (!x.win || seen.has(k)) return; const c = LIB.find(z => z._k === k); if (c && usable(c) && !taken.has(k)){ seen.add(k); C.push(mk(c)); } });
  const cuts = d.cards.map(e => ({e, c:find(e.n)})).filter(x => x.c && !tags(x.c).land && !x.e.l && !fixCut.has(x.c._k)).map(x => ({n:x.e.n, q:std ? x.e.q : 1, c:x.c, jobs:jobsOf(x.e.n), v:val(x.c) + (inWin.has(x.c._k) ? K.ck : 0)}));
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
  const comboWhy = c => { const x = completes.get(c._k); if (!x || !x.win) return []; const others = x.names.filter(n => n !== c.n), ok = others.map(keyOf), src = ' (Commander Spellbook, ' + x.decks.toLocaleString('en-US') + ' decks)';
    // The deck may already have this combo with another card in this card's place: then it is a backup piece.
    const f = CB.full.find(y => y.win && ok.every(k => y.keys.includes(k)));
    if (f){ const inPlace = f.names.filter(n => !ok.includes(keyOf(n))); return ['Backup for your ' + f.names.join(' + ') + ' combo (' + x.what.toLowerCase() + '): it can take the place of ' + inPlace.join(' and ') + src]; }
    return ['Completes a combo with ' + others.join(' and ') + ': ' + x.what.toLowerCase() + src]; };
  const whyAdd = (a, cu) => { const pa = PA(a.c), why = comboWhy(a.c).concat(pa ? ['Added in ' + pct(pa.inc) + '% of ' + preDecks + 'decks built from ' + preName] : []).concat(isNew(a.c) ? ['New card · not enough play data yet'] : []).concat(baseScore(a.c, dd, ctx).why);
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
  // --- 4b. joint refinement of the top picks: the strongest swaps are chosen together, not one by one. A pick's addition or
  // its cut may be exchanged for another candidate when the swaps' value plus the whole-deck evaluator (synergy, balance,
  // quality, win routes; the mana practice games are the deck's own and are not re-run) rises. Held picks never move.
  if (K.jmu && d.format === 'commander' && apexPick.size >= 3){
    const S0 = simulate(d, 150, 7), top = () => [...apexPick.entries()].filter(([, x]) => !x.held).sort((a, b) => b[1].v - a[1].v).slice(0, K.jn);
    const evalOf = P => { const u = JSON.parse(JSON.stringify(d)); P.forEach(([i, x]) => { cutCard(u, cuts[i].n, 1); addCard(u, x.a.c.n, 1); }); try { return evaluateDeck(u, {sim:S0}).total; } catch (e) { return 0; } };
    const job = (cu, a) => { const N = Object.assign({}, after); return !cu.jobs.filter(j => !a.jobs.includes(j)).some(j => JOBS.includes(j) && (N[j] || 0) <= flo(j)); };
    let P = top(), cur = P.reduce((t, [, x]) => t + x.v, 0) + K.jmu * evalOf(P);
    const usedA = () => new Set([...apexPick.values()].map(x => x.a.c._k));
    const altA = C.filter(x => !taken.has(x.c._k) && !usedA().has(x.c._k) && ev(x)).sort((a, b) => b.v - a.v).slice(0, K.jk);
    const altC = cuts.map((cu, i) => i).filter(i => !apexPick.has(i) && !held.has(cuts[i].n)).sort((a, b) => cuts[a].v - cuts[b].v).slice(0, K.jk);
    for (let pass = 0; pass < 2; pass++){ let moved = false;
      for (let q = 0; q < P.length; q++){ const [i, x] = P[q];
        for (const a of altA){ if (usedA().has(a.c._k)) continue; const v = delta(cuts[i], a); if (v < mMin || !job(cuts[i], a)) continue; const P2 = P.slice(); P2[q] = [i, {a, v, held:false}];
          const o = P2.reduce((t, [, y]) => t + y.v, 0) + K.jmu * evalOf(P2); if (o > cur + 1e-6){ cur = o; P = P2; apexPick.set(i, {a, v, held:false}); moved = true; } }
        const [i1, x1] = P[q];
        for (const j of altC){ if (apexPick.has(j)) continue; const v = delta(cuts[j], x1.a); if (v < mMin || !job(cuts[j], x1.a)) continue; const P2 = P.slice(); P2[q] = [j, {a:x1.a, v, held:false}];
          const o = P2.reduce((t, [, y]) => t + y.v, 0) + K.jmu * evalOf(P2); if (o > cur + 1e-6){ cur = o; P = P2; apexPick.delete(i1); apexPick.set(j, {a:x1.a, v, held:false}); moved = true; break; } } }
      if (!moved) break; }
  }
  // --- 4c. Game Changers at Apex: a few more Game Changer upgrades are offered after the ranked picks, each paired with the
  // card it best replaces (job floors kept). They need not beat the ranked picks on play rates; the score check still has to
  // show each one raises the deck score, or it is not offered.
  // Trimmed (owner's decision, Build 115): only the deck's remaining room under Bracket 3's three Game Changers, counting
  // those already in the deck and among the picks above; a deck at or past three gets none (a Game Changer can still win a
  // normal row on its own merits).
  if (gcV0 && UP.gcN){ const usedA = new Set([...apexPick.values()].map(x => x.a.c._k)); let n = 0;
    const room = UP.gc3 ? Math.min(UP.gcN, Math.max(0, 3 - (ctxOf(d).gcIn || 0) - [...apexPick.values()].filter(x => x.a.c.gc).length)) : UP.gcN;
    const G = C.filter(x => x.c.gc && !taken.has(x.c._k) && !usedA.has(x.c._k) && ev(x)).sort((a, b) => b.v - a.v);
    for (const a of G){ if (n >= room) break; let best = null;
      cuts.forEach((cu, i) => { if (apexPick.has(i) || held.has(cu.n) || cu.c.gc) return; const lost = cu.jobs.filter(j => !a.jobs.includes(j)); if (lost.some(j => JOBS.includes(j) && (after[j] || 0) - 1 < flo(j))) return;
        const v = delta(cu, a); if (v + UP.gcB >= mMin && (!best || v > best.v)) best = {i, v}; });
      if (!best) continue; apexPick.set(best.i, {a, v:best.v, held:false, gcPick:true}); usedA.add(a.c._k); cuts[best.i].jobs.forEach(j => after[j] = (after[j] || 0) - 1); a.jobs.forEach(j => after[j] = (after[j] || 0) + 1); n++; } }
  out.pre = pre ? {name:pre.name, decks:pre.decks, share:+preShare.toFixed(2), on:preOn, untouched:+preU.toFixed(3), otherBuilds:+preOther.toFixed(2)} : null;
  out.valOf = c => val(c);   // the value this deck's upgrades are chosen by (card quality uses it too)
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
    row.opts.apex = Object.assign(pair(cu, A, x.v, 'apex'), x.held ? {held:true} : {}, x.gcPick ? {gcPick:true} : {}); row.gain = x.v; if (x.gcPick) row.gcPick = true;
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
      .forEach(c => { if (isLandUp(c) && capOk(c) && mustOk(c, d) && !lk.has(c._k) && !installed.has(c._k) && !dis.has(c._k) && !taken.has(c._k) && legalHere(c)){ lk.add(c._k); LP.push({c, jobs:[], v:val(c)}); } });
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
  out.paths = [...rows.values()].sort((a, b) => (b.opts.free ? 1 : 0) - (a.opts.free ? 1 : 0) || (a.gcPick ? 1 : 0) - (b.gcPick ? 1 : 0) || b.gain - a.gain);
  // Fewer swaps where players keep the precon (owner, Tramplesaurus fix A): a swap whose card out is not among the 10 cards players
  // cut most from this precon, for a card under 15% of them add, is one players mostly disagree with (76 of 80 such rows on the
  // benchmark decks). It is left out. Only the precon's own cards count (players' keep rates are about them); held swaps, your
  // own cards and lands are never left out.
  // The rows are left out at the end of scoreCheck, once every pick is final, so leaving them out changes no other row.
  out.trimOf = !(UP.trim && preOn) ? null : L => { const p = L.opts.apex; if (!p || p.held || (UP.gcT && L.gcPick && p.gcPick) || L.opts.free || Object.values(L.opts).some(x => x && x.held)) return false;
    const cc = find(L.cut), ca = find(p.add); if (!cc || !ca || tags(cc).land || tags(ca).land || !preAll.has(cc._k)) return false; const pa = PA(ca), ci = PC(cc);
    return (pa ? pa.inc : 0) < UP.trimPa && (ci == null || ci >= UP.trimCi); };
  recount(out);
  out.bracket = ctx.bracket; out.gcIn = ctx.gcIn; out.mldIn = ctx.mldIn; out.gcCap = ctx.gcCap; out.cap = opt.cap || 0;
  return out;
}
// Fix a health alert: direct swaps that remedy one shortfall (a job below its target, too few or too many lands, a heavy
// curve, no way to win). Each swap takes out a card the deck can best spare (never a held card, the commander, or a card
// whose job the deck is already short of) and puts in the strongest card that fixes the problem, at the deck's price level.
// o.val: the deck's own card values (the upgrade list's), o.n: how many swaps to offer.
const FIX_KINDS = {ramp:'Ramp', draw:'Card draw', removal:'Removal', wipe:'Board wipes', landsUp:'More lands', landsDown:'Fewer lands', curve:'Lower curve', wins:'A way to win', mana:'Better mana'};
// A land may replace another only if it makes every deck colour the old one made (Build 137): Thriving Isle (blue and one chosen
// colour) needs a land making blue and another colour; a basic needs its colour.
function landCovers(cut, add, ident){ if (!cut || !add) return false; const A = new Set([...landColors(add)].filter(z => ident.includes(z))), sc = simCard(cut, ident);
  if (sc.chosen){ const fx = (sc.fixed || []).filter(z => ident.includes(z)); return fx.every(z => A.has(z)) && A.size >= fx.length + 1; }
  return [...landColors(cut)].filter(z => ident.includes(z)).every(z => A.has(z)); }
function fixSwaps(d, kind, o){
  o = o || {}; if (d.format !== 'commander' || !find(d.commander)) return [];
  const ctx = ctxOf(d), A = analyze(d), T = A.T, val = o.val || (c => baseScore(c, d, ctx).s), n = o.n || 6;
  const inDeck = new Set(d.cards.map(e => keyOf(e.n)).concat([keyOf(d.commander)], d.partner ? [keyOf(d.partner)] : [])), dis = new Set((d.dismissed || []).map(keyOf));
  const priceOk = c => !d.tier || d.tier === 'apex' || c.p == null || underCap(c.p, d.tier);
  const addOk = c => c && !inDeck.has(c._k) && !dis.has(c._k) && !isBasic(c.n) && legalIn(c, d.format) && c.ci.every(z => ctx.ident.includes(z)) && mustOk(c, d) && priceOk(c);
  const short = j => (A.roles[j] || 0) <= (T[j] || 0);   // a job at or below its target is not given up
  const spells = d.cards.map(e => ({e, c:find(e.n)})).filter(x => x.c && !x.e.l && !tags(x.c).land).map(x => ({n:x.e.n, c:x.c, v:val(x.c), roles:tags(x.c).roles}));
  const cutsFor = keep => spells.filter(x => ![...x.roles].some(r => ['ramp', 'draw', 'removal', 'wipe'].includes(r) && (r === keep || short(r)))).sort((a, b) => a.v - b.v);
  const evid = c => { const e = ctx.edh && edhOf(ctx.edh.map, c); return (e && e.inc >= 0.05) || (c.r && c.r < 3000); };
  const best = (f, k) => LIB.filter(c => addOk(c) && f(c) && evid(c)).map(c => ({c, v:val(c)})).sort((a, b) => b.v - a.v).slice(0, k);
  // With o.score (the deck-score change of a swap), each fixing card is tried against the five cards the deck can best spare
  // and keeps the cut that leaves the deck strongest; the swaps are then listed best first.
  const pairUp = (adds, cuts, why) => { if (!o.score) return adds.slice(0, Math.min(n, cuts.length)).map((a, i) => ({cut:cuts[i].n, add:a.c.n, q:1, kind, why}));
    const spare = o.spareLands && o.landScore && !adds.some(a => tags(a.c).land) ? spareLands(d) : [], uL = [];
    const used = new Set(), out = []; for (const [ai, a] of adds.slice(0, n + 4).entries()){ let b = null; for (const cu of cuts.filter(x => !used.has(x.n)).slice(0, 5)){ const v = o.score(cu.n, a.c.n); if (v != null && (!b || v > b.v)) b = {cu, v}; }
      // a spare land (the deck runs more than its target) can go instead; land changes need fresh practice games to measure
      const ln = ai < 3 && spare.find((x, i) => !uL.includes(i)); if (ln){ const v = o.landScore(ln, a.c.n); if (v != null && (!b || v > b.v)) b = {cu:{n:ln}, v, land:spare.findIndex((x, i) => x === ln && !uL.includes(i))}; }
      if (b){ if (b.land != null) uL.push(b.land); else used.add(b.cu.n); out.push({cut:b.cu.n, add:a.c.n, q:1, kind, why:b.land != null ? why + ' · takes out a spare land' : why, dScore:b.v}); } }
    return out.sort((x, y) => y.dScore - x.dScore).slice(0, n); };
  if (['ramp', 'draw', 'removal', 'wipe'].includes(kind)) return pairUp(best(c => !tags(c).land && tags(c).roles.has(kind), n), cutsFor(kind), 'Adds ' + FIX_KINDS[kind].toLowerCase());
  if (kind === 'landsUp'){ const lands = best(c => tags(c).land && [...landColors(c)].some(z => ctx.ident.includes(z)) && landSpeed(c) !== 'tapped', n);
    const bas = splitBasics(Math.max(1, n - lands.length), ctx).map(x => ({c:find(x.n), v:0})).filter(x => x.c);
    return pairUp(lands.concat(bas), cutsFor(''), 'Adds a land'); }
  if (kind === 'landsDown'){ const L = d.cards.map(e => ({e, c:find(e.n)})).filter(x => x.c && !x.e.l && tags(x.c).land).map(x => ({n:x.e.n, v:isBasic(x.c.n) ? -1 : val(x.c) - (landSpeed(x.c) === 'tapped' ? 5 : 0)})).sort((a, b) => a.v - b.v);
    const need = ['ramp', 'draw', 'removal', 'wipe'].sort((a, b) => (A.roles[a] - T[a]) - (A.roles[b] - T[b]))[0];
    return pairUp(best(c => !tags(c).land && tags(c).roles.has(need), n), L, 'Swaps a land for ' + FIX_KINDS[need].toLowerCase()); }
  if (kind === 'mana'){ if (ctx.ident.length < 2) return [];   // one-colour decks can't be stuck on a colour
    const cols = c => [...landColors(c)].filter(z => ctx.ident.includes(z)).length;
    // in: lands that make two or more of the deck's colours and can enter untapped. Out: lands that always enter tapped, then
    // spare basics (from the most common type). Other lands may do something besides make mana, so they are left alone.
    const adds = best(c => tags(c).land && cols(c) >= 2 && landSpeed(c) !== 'tapped', n + 3);
    const basicsBy = {}; d.cards.forEach(e => { const c = find(e.n); if (c && isBasic(c.n)) basicsBy[c.n] = (basicsBy[c.n] || 0) + e.q; });
    const L = d.cards.map(e => ({e, c:find(e.n)})).filter(x => x.c && !x.e.l && tags(x.c).land && (landSpeed(x.c) === 'tapped' || isBasic(x.c.n)))
      .map(x => ({n:x.e.n, v:(landSpeed(x.c) === 'tapped' && !isBasic(x.c.n) ? 0 : 10) - (isBasic(x.c.n) ? basicsBy[x.c.n] || 0 : 0) * 0.1 + cols(x.c)}));
    const cuts = []; L.sort((a, b) => a.v - b.v).forEach(x => { if (isBasic(x.n)) { const k = cuts.filter(y => y.n === x.n).length; if (k < Math.min(3, (basicsBy[x.n] || 0) - 1)) for (let q = 0; q < 1; q++) cuts.push(x); } else cuts.push(x); });
    // a basic can be cut more than once: each pairing takes one copy
    const used = new Map(), out = []; for (const a of adds){ if (out.length >= n) break; const cu = cuts.find(x => (used.get(x.n) || 0) < (isBasic(x.n) ? Math.min(3, (basicsBy[x.n] || 0) - 1) : 1) && (!UP.lfix || landCovers(find(x.n), a.c, ctx.ident))); if (!cu) continue;
      used.set(cu.n, (used.get(cu.n) || 0) + 1); const v = o.landScore ? o.landScore(cu.n, a.c.n) : undefined; out.push({cut:cu.n, add:a.c.n, q:1, kind, why:landSpeed(find(cu.n)) === 'tapped' ? 'Replaces a land that enters tapped' : 'Replaces a basic with a land making more of your colours', dScore:v}); }
    return out.filter(x => x.dScore == null || x.dScore >= -0.05).sort((a, b) => (b.dScore || 0) - (a.dScore || 0)); }
  if (kind === 'curve'){ const hi = spells.filter(x => (x.c.cmc || 0) >= 5 && !short([...x.roles].find(r => JOBS.includes(r)) || 'x')).sort((a, b) => (a.v - (a.c.cmc || 0)) - (b.v - (b.c.cmc || 0)));
    const out = []; const used = new Set(); for (const h of hi){ if (out.length >= n) break; const j = [...h.roles].find(r => JOBS.includes(r));
      const a = LIB.filter(c => addOk(c) && !used.has(c._k) && !tags(c).land && (c.cmc || 0) <= 2 && (!j || tags(c).roles.has(j)) && evid(c)).map(c => ({c, v:val(c)})).sort((x, y) => y.v - x.v)[0];
      if (a){ used.add(a.c._k); out.push({cut:h.n, add:a.c.n, q:1, kind, why:'Mana value ' + (h.c.cmc || 0) + ' → ' + (a.c.cmc || 0), dScore:o.score ? o.score(h.n, a.c.n) : undefined}); } } return o.score ? out.sort((x, y) => (y.dScore || 0) - (x.dScore || 0)) : out; }
  if (kind === 'wins'){ const cb = COMBOS.list.length ? combosOf(d, ctx.ident) : {near:[]}, seen = new Set();
    const adds = cb.near.filter(x => x.x.win).map(x => find(x.miss)).filter(c => addOk(c) && !seen.has(c._k) && seen.add(c._k)).map(c => ({c, v:val(c)}));
    const fin = adds.length >= n ? [] : best(c => !tags(c).land && isFinisher(c) && !adds.some(a => a.c._k === c._k), n - adds.length);
    return pairUp(adds.concat(fin), cutsFor(''), 'Adds a way to win'); }
  return [];
}
// "I want this card in my deck": rank what the deck can best do without. A land replaces a land, a spell a spell.
// Cards that would leave ramp/draw/removal/wipes short, or identity cards making way for an off-theme card, are
// held back; a card with a similar mana cost is preferred so the curve stays put. Locked cards are never offered.
// Spare lands: when a deck runs more lands than its target, the extras may go for other cards (owner's rule). Lands that
// enter tapped first, then basics from the most common type; lands that do something besides make mana are kept. At most
// the surplus is offered (a basic can be named more than once, one copy each).
function spareLands(d){
  const A = analyze(d), extra = A.lands - A.T.lands; if (extra <= 0) return [];
  const L = d.cards.map(e => ({e, c:find(e.n)})).filter(x => x.c && !x.e.l && tags(x.c).land && (isBasic(x.c.n) || landSpeed(x.c) === 'tapped'));
  const out = []; L.filter(x => !isBasic(x.c.n)).forEach(x => out.push(x.e.n));
  L.filter(x => isBasic(x.c.n)).sort((a, b) => b.e.q - a.e.q).forEach(x => { for (let i = 0; i < Math.max(0, x.e.q - 1); i++) out.push(x.e.n); });
  return out.slice(0, extra);
}
// A deck is short of mana when its practice games run out of lands by turn 5 in UP.starve of games or more, or it runs fewer
// lands than its target: then a spell may make room for a land (owner, Build 138), if the deck score agrees.
function manaStarved(d, e){ const A = analyze(d); return A.lands < A.T.lands || !!(e && e.sim && e.sim.screwT5 >= UP.starve); }
// The lands the Mana fix offers: untapped lands making two or more of the deck's colours, then (short of mana) any untapped land
// making a deck colour.
function manaAdds(d, n, starved){ const ctx = ctxOf(d), inDeck = new Set(d.cards.map(e => keyOf(e.n))), dis = new Set((d.dismissed || []).map(keyOf)), val = c => baseScore(c, d, ctx).s;
  const ok = c => tags(c).land && !isBasic(c.n) && !monoJunkLand(c, ctx.ident) && !inDeck.has(c._k) && !dis.has(c._k) && legalIn(c, d.format) && c.ci.every(z => ctx.ident.includes(z)) && mustOk(c, d) && (!d.tier || d.tier === 'apex' || c.p == null || underCap(c.p, d.tier)) && landSpeed(c) !== 'tapped';
  const evid = c => { const e = ctx.edh && edhOf(ctx.edh.map, c); return (e && e.inc >= 0.05) || (c.r && c.r < 3000); }, cols = c => [...landColors(c)].filter(z => ctx.ident.includes(z)).length;
  return LIB.filter(c => ok(c) && evid(c) && (ctx.ident.length < 2 ? cols(c) >= 1 : cols(c) >= 2 || (starved && cols(c) >= 1))).map(c => ({c, v:val(c)})).sort((a, b) => b.v - a.v).slice(0, n).map(x => x.c); }
function bestCuts(d, addName, k, o){ o = o || {};
  const add = find(addName); if (!add) return [];
  const A = analyze(d), ctx = A.ctx, T = A.T, top = (d.aims || [])[0], addLand = tags(add).land, roles = Object.assign({}, A.roles);
  if (!addLand) tags(add).roles.forEach(r => { if (r in roles) roles[r]++; });
  const isId = c => !!(top && matchAim(c, top, ctx.tribe) >= 0.7), addId = !addLand && isId(add), out = [];
  for (const e of d.cards){
    if (e.l || norm(e.n) === add._n) continue; const c = find(e.n); if (!c) continue; const land = tags(c).land; if (land !== addLand && !(addLand && o.starved && !land)) continue;   // short of mana: a spell may go for a land (Build 138)
    if (land){ out.push(isBasic(c.n) ? {n:e.n, s:-e.q, why:['You run ' + e.q + ' of these']} : {n:e.n, s:baseScore(c, d, ctx).s + 3, why:['Least useful land']}); continue; }
    const b = baseScore(c, d, ctx); let s = b.s, why = addLand ? 'The deck runs short of lands: a weak spell can make room' : b.hit ? 'Weakest fit for the build' : "Doesn't serve the build";
    tags(c).roles.forEach(r => { if (r in roles) s += roles[r] - 1 < T[r] ? 2.5 : 0.6; });
    s += 0.2 * Math.abs(c.cmc - add.cmc); if (isId(c) && !addId) s += 2; if (mainType(c) !== mainType(add)) s += 1.5;
    if (!legalIn(c, d.format)){ s = -90; why = 'Not legal in ' + d.format; } else if (!c.ci.every(x => ctx.ident.includes(x))){ s = -80; why = 'Outside your colors'; }
    out.push(addLand ? {n:e.n, s:s + 4, spell:true, why:[why]} : {n:e.n, s, why:[why]});
  }
  if (!addLand) [...new Set(spareLands(d))].forEach(n => out.push({n, s:50, land:true, why:['Spare land: ' + A.lands + ' lands, about ' + T.lands + ' needed']}));
  return out.sort((a, b) => a.s - b.s).slice(0, k || 3);
}
// Player tip for a card being added by hand: how well does it fit this deck, and why?
// sw (optional): the measured best swap for this card, {cut, dScore, gain}. The tip then leads with what the swap does to the
// deck score, and the card's own rating (play data, fit) is kept as a separate signal instead of contradicting it.
const IMPACT = [[2, 'Major upgrade', 'great'], [1, 'Strong upgrade', 'good'], [SCORE_MIN, 'Small upgrade', 'ok'], [-SCORE_MIN + 1e-9, 'No real change', 'ok'], [-Infinity, 'Lowers the deck score', 'poor']];
const PART_LABEL = {synergy:'synergy', balance:'balance (jobs and lands)', quality:'card quality', routes:'ways to win', mana:'mana'};
function evalFit(d, c, sw){
  const A = analyze(d), ctx = A.ctx, T = A.T, tg = tags(c), b = baseScore(c, d, ctx), pros = [], cons = [], cmdName = ctx.cmd ? ctx.cmd.n.split(',')[0] : '';
  let pts = 0;
  if (!legalIn(c, d.format)) return {level:'bad', title:'Not legal here', pros, cons:[c.n + ' is not legal in ' + (d.format === 'commander' ? 'Commander' : 'Standard') + ', so the deck could not be played with it.']};
  if (tg.land){
    if (A.lands < T.lands){ pts += 2; pros.push('The deck has ' + A.lands + ' lands and wants about ' + T.lands + ', so another land helps.'); }
    else cons.push('The deck already has ' + A.lands + ' lands (target ' + T.lands + '), so it should replace one of them rather than a spell.');
    if (!isBasic(c.n)){ if (c.r && c.r < 1500){ pts += 2; pros.push('A widely played land.'); } else pts += 1; }
    if (/enters (the battlefield )?tapped/i.test(c.o || '')) cons.push('It enters tapped, which slows you down a turn.');
  } else {
    // Every mechanic of the build counts, not only the first: the main plan, the secondary plans, partial fits, the
    // commander's own strategy and the filters. A card that does a core job, or a staple, is never told it fits no plan.
    const aims = [], part = [], AL = (d.aims || []).map(a => aimLabel(a, ctx.tribe));
    (d.aims || []).forEach((a, i) => { const m = matchAim(c, a, ctx.tribe); if (m >= 0.7) aims.push({i, l:AL[i]}); else if (m >= 0.3) part.push(AL[i]); });
    const multi = aims.length >= 2, fb = filtBonus(c, d), jobby = ['ramp', 'draw', 'removal', 'wipe', 'protect', 'counter', 'tutor'].some(r => tg.roles.has(r)), staple = CORE.has(c._n) || (c.r && c.r < 250);
    const ft = foreignTribe(c), wrongTribe = ft && ft !== ctx.tribe && !(ctx.cmd && new RegExp('\\b' + ft + '\\b').test(ctx.cmd.t));
    if (wrongTribe){ pts -= 3; cons.push('It rewards ' + ft + ' cards' + (ctx.tribe ? ', and this is a ' + ctx.tribe + ' deck' : ', which this deck is not built around') + ', so most of its text would do nothing.'); }
    else if (aims.length){
      // Plans are weighted by rank but closely: the main plan 2, the second 1.75, the third 1.5, and each further plan a
      // card hits adds 1.25. A card that hits two secondary plans (3) outweighs one that only hits the main plan (2).
      const main = aims.find(x => x.i === 0), sub = aims.filter(x => x.i > 0).map(x => x.l), w = i => Math.max(1, 2 - 0.25 * i);
      pts += w(aims[0].i) + 1.25 * (aims.length - 1);
      pros.push(main ? 'Supports the deck’s main plan (' + main.l + ')' + (sub.length ? ' and also ' + sub.join(', ') : '') + '.' : 'Supports ' + (sub.length > 1 ? 'two of the deck’s secondary plans: ' + sub.join(' and ') : 'a secondary plan of the deck: ' + sub[0]) + '.');
      if (aims.length >= 2 && AL.length >= 2) pros.push('It hits ' + aims.length + ' of the deck’s ' + AL.length + ' plans.'); }
    else if (ctx.cmdThemes.some(a => matchAim(c, a, ctx.cmdTribe) >= 1)){ pts += 2; pros.push('Works with ' + cmdName + '’s own strategy.'); }
    else if (fb.why.length){ pts += 1; pros.push('Matches your filters: ' + fb.why.join(', ') + '.'); }
    else if (part.length){ pros.push('Loosely ties into ' + part.join(', ') + ', though it isn’t a core piece.'); }
    else if (jobby || staple){ /* a job card or a staple earns its slot without feeding a plan; its job is judged below */ }
    else if (AL.length || ctx.cmdThemes.length){ pts -= 1; cons.push('It doesn’t feed any of the deck’s plans' + (AL.length ? ' (' + AL.join(', ') + ')' : '') + (ctx.cmdThemes.length && cmdName ? ' or ' + cmdName + '’s own strategy' : '') + '.'); }
    if (ctx.edh){ const x = edhOf(ctx.edh.map, c);
      if (x){ const pc = Math.round(x.inc * 100); if (x.inc >= 0.25){ pts += 2; pros.push('Played in ' + pc + '% of ' + cmdName + ' decks.'); } else { pts += 1; pros.push('Shows up in ' + Math.max(1, pc) + '% of ' + cmdName + ' decks' + (x.syn > 0.1 ? ', far more than in other decks' : '') + '.'); } }
      else if (ctx.edh.map.size > 80){ pts -= multi ? 0.5 : 1; cons.push(cmdName + ' players rarely run it.'); } }
    const RN = {ramp:'mana ramp', draw:'card draw', removal:'removal', wipe:'board wipes'}; let filled = false;
    for (const r in RN) if (tg.roles.has(r)){
      if (A.roles[r] < T[r]){ if (!filled) pts += 2; filled = true; pros.push('The deck is short on ' + RN[r] + ' (' + A.roles[r] + ' of about ' + T[r] + ') and this adds one.'); }
      else if (!sw) pros.push('Adds ' + RN[r] + '; the deck already has enough (' + A.roles[r] + ').'); }   // with a measured swap, the score line says what it adds
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
      // that ranking already counts how rarely players run it, so a card hitting two or more plans isn't marked down twice
      else if (pc <= 0.15){ const up = sw && sw.dScore != null && sw.dScore >= SCORE_MIN;
        if (!multi && !up) pts -= 1; cons.push(up ? 'On play data and fit alone it rates below nearly every spell in the deck' + '; the score gain comes from the swap itself (see above).' : 'By my scoring it ranks below nearly every spell already in the deck.'); } }
  }
  const level = pts >= 4 ? 'great' : pts >= 2 ? 'good' : pts >= -1 ? 'ok' : 'poor';
  if (!pros.length && !cons.length) cons.push('Nothing in its text connects to the deck’s plan, but nothing clashes with it.');
  const fitT = {great:'Great fit', good:'Good fit', ok:'Playable, not a natural fit', poor:'Poor fit'}[level];
  if (sw && sw.dScore != null && !tags(c).land){ const im = IMPACT.find(x => sw.dScore >= x[0]), g = Object.entries(sw.gain || {}).filter(([, v]) => Math.abs(v) >= 0.05).sort((a, b) => Math.abs(b[1]) - Math.abs(a[1]));
    const s = (sw.dScore >= 0 ? '+' : '−') + Math.abs(sw.dScore).toFixed(1);
    pros.unshift('Swapping out ' + sw.cut + ' changes the deck score by ' + s + (g.length ? ': ' + g.slice(0, 3).map(([k, v]) => PART_LABEL[k] + ' ' + (v >= 0 ? '+' : '−') + Math.abs(v).toFixed(1)).join(', ') : '') + '.');
    return {level:im[2], title:im[1] + ' · ' + fitT.toLowerCase(), fit:level, impact:im[1], pros, cons}; }
  return {level, title:fitT, fit:level, pros, cons};
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
  // Commander (when no colour is short, a basic stays as it is): the basics are split the way the generator's mana base does it (manaBase): every colour source counts (nonbasic
  // lands fully, rocks and dorks at 0.75), each basic goes to the colour furthest below what its spells need (colourDemand).
  // Splitting basics by mana symbols alone ignored the other lands and told freshly built decks their colours had shifted.
  if (basics && tot && d.format === 'commander' && ctx.ident.length && UP.msrc){ const id = ctx.ident, req = colourDemand(d, ctx), src = {}; id.forEach(k => src[k] = 0);
    d.cards.forEach(e => { const c = find(e.n); if (!c || isBasic(c.n)) return; if (tags(c).land) [...landColors(c)].forEach(k => { if (k in src) src[k] += e.q; }); else { const sm = simCard(c, id); if (sm.mana) sm.cols.forEach(k => { if (k in src) src[k] += e.q * 0.75; }); } });
    const gap = k => req[k] ? Math.max(0, 1 - src[k] / req[k]) : 0;
    for (let i = 0; i < basics; i++){ const k = id.filter(x => COLOR_BASIC[x]).slice().sort((a, b) => (gap(b) - gap(a)) || ((want[b] < have[b]) - (want[a] < have[a])) || (req[b] - req[a]))[0]; if (!k) break; want[k]++; src[k] += 1; }
  }
  else if (basics && tot){
    const min = basics >= 20 && cols.length <= 4 ? 2 : 1, f = cols.map(k => basics * pips[k] / tot); cols.forEach((k, i) => want[k] = Math.max(min, Math.floor(f[i])));
    let left = basics - cols.reduce((s, k) => s + want[k], 0);
    cols.map((k, i) => [f[i] - Math.floor(f[i]), k]).sort((a, b) => b[0] - a[0]).forEach(([, k]) => { if (left > 0){ want[k]++; left--; } });
    while (left > 0){ const k = cols.slice().sort((a, b) => pips[b] - pips[a])[0]; want[k]++; left--; }
    while (left < 0){ const k = cols.filter(x => want[x] > min).sort((a, b) => want[b] - want[a])[0]; if (!k) break; want[k]--; left++; }
  }
  let changes = basics && tot ? 'WUBRG'.split('').filter(k => want[k] !== have[k]).map(k => ({n:COLOR_BASIC[k], k, delta:want[k] - have[k]})) : [], stuck = null;
  // A suggested rebalance must prove itself on the generator's own measure: the colour sources short of what the spells need
  // (Karsten's tables, colourDemand) must drop by at least 2. Otherwise nothing is suggested. (The practice games barely react
  // to basic lands, so they cannot be the judge here.)
  if (changes.length && d.format === 'commander' && UP.msrc){ const id = ctx.ident, req = colourDemand(d, ctx), src = {}; id.forEach(k => src[k] = 0);
    d.cards.forEach(e => { const c = find(e.n); if (!c || isBasic(c.n)) return; if (tags(c).land) [...landColors(c)].forEach(k => { if (k in src) src[k] += e.q; }); else { const sm = simCard(c, id); if (sm.mana) sm.cols.forEach(k => { if (k in src) src[k] += e.q * 0.75; }); } });
    const short = b => id.reduce((t, k) => t + Math.max(0, (req[k] || 0) - src[k] - (b[k] || 0)), 0);
    stuck = [+short(have).toFixed(1), +short(want).toFixed(1)]; if (!(stuck[1] <= stuck[0] - 2)){ changes = []; Object.assign(want, have); } }
  return {pips, spell, have, want, basics, changes, stuck, off:changes.reduce((s, x) => s + Math.max(0, x.delta), 0)};
}
function applyMana(d, plan){ plan.changes.forEach(x => { if (x.delta > 0) addCard(d, x.n, x.delta); else cutCard(d, x.n, -x.delta); }); }
function addCard(d, n, q){ const k = keyOf(n), e = d.cards.find(x => keyOf(x.n) === k); if (d.dismissed && d.dismissed.length) d.dismissed = d.dismissed.filter(x => keyOf(x) !== k); if (e) e.q += q; else d.cards.push({n, q, l:false}); }
function cutCard(d, n, q){ const k = keyOf(n), i = d.cards.findIndex(x => keyOf(x.n) === k); if (i < 0) return; d.cards[i].q -= q; if (d.cards[i].q <= 0) d.cards.splice(i, 1); }
// ----- mana base for a generated deck (spells first, then lands) -----
// How many sources of a colour a 99-card deck needs to cast a spell with p pips of it on curve about 90% of the time
// (after Frank Karsten's Commander tables; multiplayer, so a card is drawn on turn 1). Rows: pips 1–3; columns: mana value 1–7.
const KARSTEN = {1:[19, 19, 18, 16, 15, 14, 13], 2:[30, 30, 28, 26, 24, 22, 21], 3:[36, 36, 36, 34, 31, 29, 27]};
function pipNeed(c){ const x = {}; ((c.m || '').split(' // ')[0].match(/\{[^}]+\}/g) || []).forEach(p => { const k = p.slice(1, -1); if (/^[WUBRG]$/.test(k)) x[k] = (x[k] || 0) + 1; }); return x; }
// What each colour needs: the mean of its five most demanding spells (one odd card does not set the whole base), the
// commander counted twice since it is cast every game.
function colourDemand(d, ctx){
  const by = {}; ctx.ident.forEach(k => by[k] = []);
  const add = (c, w) => { const p = pipNeed(c), mv = Math.max(1, Math.min(7, Math.round(c.cmc || 1))); for (const k in p) if (by[k]) for (let i = 0; i < w; i++) by[k].push(KARSTEN[Math.min(3, p[k])][mv - 1]); };
  d.cards.forEach(e => { const c = find(e.n); if (c && !tags(c).land) add(c, 1); }); [ctx.cmd, ctx.par].forEach(c => { if (c) add(c, 2); });
  const req = {}; for (const k in by){ const v = by[k].sort((a, b) => b - a).slice(0, 5); req[k] = v.length ? v.reduce((a, b) => a + b, 0) / v.length : 0; } return req;
}
// Chooses n lands for the deck's spells. Each pick goes to the land that most helps the colours furthest below what they need
// (an untapped land counts fully, a sometimes-tapped one a bit less, an always-tapped one less again), plus how much this
// commander's players run it. Basics fill the rest, each to the colour furthest behind. Mana rocks and dorks count as sources.
// One-colour decks (rules, Build 141): a land whose only job is making a colour of your choice, or that hurts you or depends on an
// opponent's lands to do it (City of Brass, Mana Confluence, Exotic Orchard, Command Tower), is never better than a basic there.
function monoJunkLand(c, id){ if (id.length !== 1 || !c || isBasic(c.n)) return false; const o = (c.o || '').replace(/\([^)]*\)/g, '');
  if (!/any colou?r|could produce/i.test(o)) return false; if (/deals? \d+ damage to you|pay \d+ life|could produce|opponent creates/i.test(o)) return true;
  return !o.replace(/\{T\}[^.\n]*?:\s*Add [^.\n]*\.?/gi, '').trim(); }
function manaBase(d, n, keep){
  const ctx = ctxOf(d), id = ctx.ident.length ? ctx.ident : [], req = colourDemand(d, ctx), src = {}; id.forEach(k => src[k] = 0);
  d.cards.forEach(e => { const c = find(e.n); if (!c) return; const s = simCard(c, id); if (!s.land && s.mana) s.cols.forEach(k => { if (k in src) src[k] += e.q * 0.75; }); });
  (keep || []).forEach(e => { const c = find(e.n); if (c) [...landColors(c)].forEach(k => { if (k in src) src[k] += e.q; }); });
  const out = [], used = new Set(d.cards.map(e => keyOf(e.n)).concat((keep || []).map(e => keyOf(e.n)))); used.add(keyOf(d.commander || '')); if (d.partner) used.add(keyOf(d.partner));
  if (!id.length){ if (n > 0) out.push({n:'Wastes', q:n}); return out; }
  const gap = k => req[k] ? Math.max(0, 1 - src[k] / req[k]) : 0, room = Math.min(n, [0, 8, 14, 20, 23, 24][id.length]);
  const pool = LIB.filter(c => tags(c).land && !isBasic(c.n) && !monoJunkLand(c, id) && legalIn(c, d.format) && c.ci.every(x => id.includes(x)) && !used.has(c._k) && mustOk(c, d) && !(d.dismissed || []).some(x => keyOf(x) === c._k))
    .map(c => { const cols = [...landColors(c)].filter(k => id.includes(k)), sp = landSpeed(c); return {c, cols, sp, v:baseScore(c, d, ctx).s, spd:sp === 'untapped' ? 1 : sp === 'cond' ? 0.85 : 0.6, t:!!tourneyOf(c, d)}; });
  // Apex: the best lands (tournament staples) may come in past the usual room for nonbasics, up to UP.tr more
  let nb = 0; const roomT = Math.min(n, room + (UP.ts ? UP.tr : 0));
  while (nb < roomT){
    let best = null, bs = -1e9;
    for (const p of pool){ if (p.used || (nb >= room && !p.t)) continue; const fix = p.cols.reduce((a, k) => a + gap(k), 0) * p.spd, s = 6 * fix + 0.35 * p.v - (p.cols.length ? 0 : 2 + (id.length - 1) * 1.5); if (s > bs){ bs = s; best = p; } }
    // a basic of the neediest colour is worth 6 × its gap; a nonbasic must beat that
    const kb = id.slice().sort((a, b) => gap(b) - gap(a))[0], basicV = 6 * gap(kb) + 0.35 * 3;
    if (!best || bs <= basicV) break;
    best.used = true; nb++; out.push({n:best.c.n, q:1}); best.cols.forEach(k => src[k] += best.sp === 'tapped' ? 0.9 : 1);
  }
  const basics = {}; for (let i = nb; i < n; i++){ const k = id.slice().sort((a, b) => (gap(b) - gap(a)) || (req[b] - req[a]))[0]; basics[k] = (basics[k] || 0) + 1; src[k] += 1; }
  for (const k in basics) out.push({n:COLOR_BASIC[k], q:basics[k]});
  return out;
}
// A generated deck starts as a plan, not a decklist. The plan is the strongest (Apex) build, one slot per card; each
// expensive slot also gets a Mid (up to $12) and Budget (up to $3) stand-in that does the same job. Nothing is in the
// deck until the player installs it. Owned cards are marked so they cost nothing.
function buildPlan(d, seeds, ownOnly, ownAll){ return runSync(buildPlanG(d, seeds, ownOnly, ownAll)); }
function* buildPlanG(d, seeds, ownOnly, ownAll){
  const tmp = JSON.parse(JSON.stringify(d)); tmp.tier = 'apex'; tmp.cards = []; delete tmp.plan;
  const cmd = find(d.commander), id0 = ctxOf(d).ident, okC = c => !cmd || c.ci.every(k => id0.includes(k));
  (seeds || []).forEach(c => { if (c.n !== d.commander && c.n !== d.partner && okC(c)) addCard(tmp, c.n, 1); });
  const seedSet = new Set(tmp.cards.map(x => norm(x.n)));
  if (ownOnly && ownOnly.size){ recommend.own = ownOnly; try { recommend(tmp, 0, true).adds.forEach(a => { if (!isBasic(a.n)) addCard(tmp, a.n, a.q); }); } finally { recommend.own = null; } }
  fillDeck(tmp);
  // A card whose condition the finished deck barely meets (a lord with few of its type, a payoff without enablers) is swapped
  // for the next best card. The player's own seeds stay.
  if (UP.weak && d.format === 'commander') for (let i = 0; i < 8; i++){ const w = weakHere(tmp).filter(x => !seedSet.has(norm(x.n))); if (!w.length) break;
    const ctx0 = ctxOf(tmp), worst = [...new Set(w.map(x => x.n))].map(n => ({n, s:baseScore(find(n), tmp, ctx0).s})).sort((a, b) => a.s - b.s)[0];
    cutCard(tmp, worst.n, 1); (tmp.dismissed = tmp.dismissed || []).push(worst.n); if (!fillDeck(tmp)) break; }
  // On theme, at all times: a spell that is not from the commander's set family or of its theme creature types gives way to
  // one that is, when that card does the same job, sits in the same price band and scores within 10% of it for this deck.
  if (UP.theme && d.format === 'commander'){ const ctxT = ctxOf(tmp), T = themeCtx(tmp), inDeck = () => new Set(tmp.cards.map(x => norm(x.n)).concat(norm(d.commander), d.partner ? norm(d.partner) : ''));
    const TP = LIB.filter(c => !tags(c).land && !isBasic(c.n) && legalIn(c, d.format) && c.ci.every(k => ctxT.ident.includes(k)) && mustOk(c, d) && themeOf(c, T) && !(tmp.dismissed || []).some(n => norm(n) === c._n));
    // "within reason" is measured on the whole deck: a theme swap may cost at most 0.3 deck-score points
    let simT = null, cur = null; const ev = () => { try { if (!simT) simT = simulate(tmp, 150, 7); return evaluateDeck(tmp, {sim:simT}).exact; } catch (err) { return null; } };
    if (TP.length) for (const e of tmp.cards.slice()){ const c = find(e.n); if (!c || tags(c).land || seedSet.has(c._n) || (ownOnly && ownOnly.has(c._n)) || themeOf(c, T)) continue;
      const sc = baseScore(c, tmp, ctxT).s, need = sc - Math.abs(sc) * (d.themeFirst ? UP.tfDrop : 0.1), band = priceBand(c.p), same = sameJobAs(c, tmp, ctxT), used = inDeck();
      let best = null, bs = -1e9; for (const x of TP){ if (used.has(x._n) || priceBand(x.p) !== band || !same(x)) continue; const xs = baseScore(x, tmp, ctxT).s; if (xs >= need && xs > bs){ best = x; bs = xs; } }
      if (best){ if (cur == null) cur = ev(); cutCard(tmp, e.n, 1); addCard(tmp, best.n, 1); const nx = ev();
        if (cur != null && nx != null && nx < cur - (d.themeFirst ? UP.tfEval : 0.3)){ cutCard(tmp, best.n, 1); addCard(tmp, e.n, 1); } else if (nx != null) cur = nx; } } }
  // Mana base v2: the spells are chosen, so the lands are rebuilt for them. The player's own lands (seeds, owned) stay.
  if (UP.mb && d.format === 'commander'){ const keepL = [], drop = []; tmp.cards.forEach(e => { const c = find(e.n); if (!c || !tags(c).land) return; (seedSet.has(c._n) || (ownOnly && ownOnly.has(c._n)) ? keepL : drop).push(e); });
    let nL = drop.reduce((a, e) => a + e.q, 0); const keepN = keepL.reduce((a, e) => a + e.q, 0), t0 = landTarget(analyze(tmp), tmp);
    drop.forEach(e => cutCard(tmp, e.n, e.q));
    // the land count follows the land formula for the spells chosen: extra spells (the next best) or fewer (the weakest go)
    if (t0 != null && UP.lf){ const want = Math.max(0, t0 - keepN), diff = want - nL, ctxL = ctxOf(tmp);
      if (diff > 0){ tmp.cards.map(e => ({e, c:find(e.n)})).filter(x => x.c && !tags(x.c).land && !x.e.l && !seedSet.has(x.c._n) && !(ownOnly && ownOnly.has(x.c._n))).map(x => ({n:x.e.n, s:baseScore(x.c, tmp, ctxL).s})).sort((a, b) => a.s - b.s).slice(0, diff).forEach(x => cutCard(tmp, x.n, 1)); nL = want; }
      else if (diff < 0){ const used = new Set(tmp.cards.map(e => norm(e.n)).concat([norm(tmp.commander || '')], tmp.partner ? [norm(tmp.partner)] : [])), dis = new Set((tmp.dismissed || []).map(norm));
        const add = LIB.filter(c => !tags(c).land && !isBasic(c.n) && legalIn(c, tmp.format) && c.ci.every(k => ctxL.ident.includes(k)) && mustOk(c, tmp) && !used.has(c._n) && !dis.has(c._n) && (!tmp.tier || tmp.tier === 'apex' || (c.p != null && underCap(c.p, tmp.tier))) && (!ownOnly || ownOnly.has(c._n)))
          .map(c => ({c, s:baseScore(c, tmp, ctxL).s})).sort((a, b) => b.s - a.s).slice(0, -diff); add.forEach(x => addCard(tmp, x.c.n, 1)); nL -= add.length; } }
    manaBase(tmp, nL, keepL).forEach(x => addCard(tmp, x.n, x.q)); }
  // Ramp cap (owner, 18 Oct; UP.rcap): no more than UP.rcap ramp cards over the target, so extra fast mana doesn't push out
  // on-theme cards. The weakest card that only makes mana (not on theme, not a seed or owned) gives way to the best spell that
  // makes no mana.
  if (UP.rcap && d.format === 'commander') for (let i = 0; i < 12; i++){ const A = analyze(tmp); if (A.roles.ramp <= A.T.ramp + UP.rcap) break;
    const ctxR = ctxOf(tmp), TR = themeCtx(tmp), pure = tmp.cards.map(e => find(e.n)).filter(c => c && !tags(c).land && !seedSet.has(c._n) && !(ownOnly && ownOnly.has(c._n)) && tags(c).roles.size === 1 && tags(c).roles.has('ramp') && !themeOf(c, TR));
    if (!pure.length) break; const worst = pure.map(c => ({c, s:baseScore(c, tmp, ctxR).s})).sort((a, b) => a.s - b.s)[0];
    const used = new Set(tmp.cards.map(e => norm(e.n)).concat([norm(tmp.commander || '')], tmp.partner ? [norm(tmp.partner)] : [])), dis = new Set((tmp.dismissed || []).map(norm));
    let best = null, bs = -1e9; for (const c of LIB){ if (tags(c).land || tags(c).roles.has('ramp') || isBasic(c.n) || used.has(c._n) || dis.has(c._n) || !legalIn(c, tmp.format) || !c.ci.every(k => ctxR.ident.includes(k)) || !mustOk(c, tmp)) continue;
      const v = baseScore(c, tmp, ctxR).s; if (v > bs){ bs = v; best = c; } }
    if (!best) break; cutCard(tmp, worst.c.n, 1); (tmp.dismissed = tmp.dismissed || []).push(worst.c.n); addCard(tmp, best.n, 1); }
  // Polish (UP.polish rounds; Build 141): the finished Apex build is run through the upgrade engine itself, and every swap it
  // finds that raises the deck score is made, strongest first, until it finds none (or UP.polish rounds), so a generated deck
  // leaves no Apex upgrade on the table. The player's own seeds and owned cards stay. Not inside the Apex reference build.
  if (UP.polish && d.format === 'commander' && !buildPlan.inRef && tmp.cards.reduce((a, e) => a + e.q, 0) >= 90){ const ar = apexRef(tmp);
    for (let r = 0; r < UP.polish; r++){ let R; try { const e = evaluateDeck(tmp, {apex:ar, games:300}); R = upgradePaths(tmp); yield* scoreCheckG(tmp, R, {apex:ar, base:e}); } catch (err) { break; }
      const P = R.paths.map(L => L.opts.apex).filter(p => p && p.dScore != null && p.dScore >= Math.max(scoreFloor(), UP.polishMin) && polishOk(tmp, p) && !seedSet.has(norm(p.cut)) && !(ownOnly && ownOnly.has(norm(p.cut)))).sort((a, b) => b.dScore - a.dScore);
      const cutU = new Set(), addU = new Set(); let k = 0;
      for (const p of P){ if (k >= UP.polishK || cutU.has(norm(p.cut)) || addU.has(norm(p.add)) || !entryOf(tmp, p.cut) || tmp.cards.some(e => keyOf(e.n) === keyOf(p.add))) continue; cutCard(tmp, p.cut, p.q || 1); addCard(tmp, p.add, p.q || 1); cutU.add(norm(p.cut)); addU.add(norm(p.add)); k++; }
      if (!k) break; } }
  const ctx = ctxOf(tmp), TH = themeCtx(tmp), used = new Set(tmp.cards.map(x => norm(x.n))); used.add(norm(d.commander)); if (d.partner) used.add(norm(d.partner));
  const pool = LIB.filter(c => c.p != null && c.p < 12 && legalIn(c, d.format) && c.ci.every(x => ctx.ident.includes(x)) && !used.has(c._n) && !isBasic(c.n) && mustOk(c, d))
    .map(c => ({c, s:baseScore(c, tmp, ctx).s, land:tags(c).land, ty:mainType(c), th:!!themeOf(c, TH)}));
  // A stand-in is strictly under the tier's price and does the same job as the card it stands in for (its main job; for a
  // card with no job, the same card type), the same rule as upgrade alternatives.
  const alt = (x, cap) => { const tx = tags(x), ty = mainType(x), j = mainJob(x.n); let best = null, bs = -1e9;
    for (const p of pool){ if (p.used || !(p.c.p < cap) || !(x.p == null || p.c.p < x.p) || p.land !== tx.land) continue;
      if (!p.land && (j ? !jobsOf(p.c.n).includes(j) : (p.ty !== ty || jobsOf(p.c.n).some(r => JOBS.includes(r))))) continue;
      if (p.land && ![...landColors(x)].filter(k => ctx.ident.includes(k)).every(k => landColors(p.c).has(k))) continue;
      let s = p.s + (p.ty === ty ? 3 : 0) + (p.th ? 2 : 0), share = 0; tags(p.c).roles.forEach(r => { if (tx.roles.has(r)) share++; }); s += share * 2; if (s > bs){ bs = s; best = p; } }
    if (best) best.used = true; return best ? best.c.n : null; };
  const basic = (splitBasics(1, ctx)[0] || {}).n || null, own = ownAll || new Set();
  const out = tmp.cards.map((en, i) => {
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
  // The Apex build is the strongest one: where a slot's cheaper stand-in makes the whole Apex deck score higher, it becomes the
  // Apex card (and the cheaper tiers use it when it fits their price). Measured with the deck's own practice games.
  if (UP.planMax && d.format === 'commander' && tmp.cards.length >= 90){ try { const S1 = simulate(tmp, 150, 7); let base = evaluateDeck(tmp, {sim:S1}).exact;
    for (const S0 of out){ if (S0.seed || S0.own || S0.land || S0.basic) continue; for (const k of ['m', 'b']){ const alt = S0[k]; if (!alt) continue;
      const u = JSON.parse(JSON.stringify(tmp)); cutCard(u, S0.a, 1); addCard(u, alt, 1); const v = evaluateDeck(u, {sim:S1}).exact;
      if (v > base + SCORE_MIN){ cutCard(tmp, S0.a, 1); addCard(tmp, alt, 1); S0.a = alt; base = v; const ac = find(alt); if (ac && ac.p != null && ac.p < 12) delete S0.m; if (ac && ac.p != null && ac.p < 3) delete S0.b; break; } } } } catch (e) {} }
  return out;
}
// Polish a finished deck at its own price level (Build 141): the upgrade engine is run on it and every swap it finds for that
// level that raises the deck score is made, strongest first, round after round until none is left (UP.polish rounds). Locked
// cards stay. Used after a Mid or Budget build is filled (the Apex build is polished inside buildPlan).
// Polishing keeps the players' cards (UP.polP, Build 145): a card at least UP.polP of this commander's players run is swapped out
// only for a clear gain (UP.polG or more), unless the card coming in is run about as much.
function polishOk(d, p){ if (!UP.polP) return true; const E = ctxOf(d).edh; if (!E || !E.map || E.map.size < 100) return true; const inc = n => { const c = find(n), x = c && edhOf(E.map, c); return x ? x.inc : 0; };
  const ic = inc(p.cut); return ic < UP.polP || p.dScore >= UP.polG || inc(p.add) >= ic - 0.1; }
function polishDeck(d, rounds){ return runSync(polishDeckG(d, rounds)); }
function* polishDeckG(d, rounds){ if (!UP.polish || d.format !== 'commander' || !find(d.commander)) return 0; const t = d.tier || 'apex', ar = apexRef(d); let n = 0;
  for (let r = 0; r < (rounds || UP.polish); r++){ let R; try { const e = evaluateDeck(d, {apex:ar, games:300}); R = upgradePaths(d); yield* scoreCheckG(d, R, {apex:ar, base:e}); } catch (err) { break; }
    const keep = new Set(d.cards.filter(x => x.l).map(x => norm(x.n))), P = R.paths.map(L => tierPick(L, t)).filter(p => p && p.dScore != null && p.dScore >= Math.max(scoreFloor(), UP.polishMin) && polishOk(d, p) && !keep.has(norm(p.cut))).sort((a, b) => b.dScore - a.dScore);
    const cutU = new Set(), addU = new Set(); let k = 0;
    for (const p of P){ if (k >= UP.polishK || cutU.has(norm(p.cut)) || addU.has(norm(p.add)) || !entryOf(d, p.cut) || d.cards.some(x => keyOf(x.n) === keyOf(p.add))) continue; cutCard(d, p.cut, p.q || 1); addCard(d, p.add, p.q || 1); cutU.add(norm(p.cut)); addU.add(norm(p.add)); k++; }
    n += k; if (!k) break; }
  return n; }
// Price band by the owner's rule: Budget strictly under $3, Mid strictly under $12, Apex anything else (or unknown).
function priceBand(p){ return p == null ? 'apex' : p < 3 ? 'budget' : p < 12 ? 'mid' : 'apex'; }
// "See alternatives": cards that fill the same slot as a recommended card when the player doesn't have it. Each one does the
// same job (the stand-in rule above: its main job, or for a card with no job the same type and part of the deck's plan),
// sits in the same price band, and is among the strongest such cards for this deck: in the top ALT_TOP of every same-job,
// same-band card it could play. The pick itself was chosen as the best, so closeness is measured against that field, not
// against the pick's own score. Same card type and shared roles rank first. For an upgrade (o.cut) every alternative must
// still beat the card it replaces. An Apex-band alternative costs at most twice the pick, so it is no big step up in price.
const ALT_TOP = 0.2;
// Does card x do the same job as card c in this deck? Its main job; for a card with no job, the same card type and a shared
// part of the deck's plan; a land must make every deck colour the other land makes.
function sameJobAs(c, ref, ctx, lv){ const sx = lv != null ? lv : UP.sjx, land = !!tags(c).land, ty = mainType(c), j = mainJob(c.n);
  const aimSet = x => { const s = new Set(); (ref.aims || []).forEach(a => { if (matchAim(x, a, ctx.tribe) >= 0.7) s.add(a); }); return s; }, aims = aimSet(c);
  return x => { const t = tags(x); if (!!t.land !== land) return false;
    if (land) return [...landColors(c)].filter(k => ctx.ident.includes(k)).every(k => landColors(x).has(k));
    if (j) return jobsOf(x.n).includes(j);
    if (mainType(x) !== ty || (sx < 1 && jobsOf(x.n).some(r => JOBS.includes(r)))) return false;
    return sx >= 2 || !aims.size || [...aimSet(x)].some(a => aims.has(a)); }; }
function altsFor(d, name, o){
  o = o || {}; const c = find(name); if (!c) return [];
  const ref = JSON.parse(JSON.stringify(d)); delete ref.plan; if (o.deck) ref.cards = o.deck.map(x => ({n:x.n, q:x.q}));
  const ctx = ctxOf(ref), val = o.val || (x => baseScore(x, ref, ctx).s), band = priceBand(c.p), tc = tags(c), land = !!tc.land, ty = mainType(c), j = mainJob(c.n);
  const used = new Set(ref.cards.map(x => norm(x.n))); used.add(norm(d.commander)); if (d.partner) used.add(norm(d.partner)); used.add(c._n);
  (o.skip || []).forEach(n => used.add(norm(n))); const dis = new Set((d.dismissed || []).map(norm));
  const same = sameJobAs(c, ref, ctx);
  const vcut = o.cut && find(o.cut) ? val(find(o.cut)) : null;
  // The deck's playable pool (format, colours, filter rules) is the same for every search on this deck, so it is kept.
  const pk = [d.format, ctx.ident.join(''), JSON.stringify([d.setsMust && d.sets, d.typesMust && d.types, d.keysMust && d.keys]), LIB.length, SETCARDS.size].join('|');
  if (!altsFor.pool || altsFor.pool.k !== pk) altsFor.pool = {k:pk, L:LIB.filter(x => !isBasic(x.n) && legalIn(x, d.format) && x.ci.every(k => ctx.ident.includes(k)) && mustOk(x, d))};
  const vm = o.vmemo || new Map(), V = x => { if (!vm.has(x._k)) vm.set(x._k, val(x)); return vm.get(x._k); };
  const C = altsFor.pool.L.filter(x => !used.has(x._n) && !dis.has(x._n) && (x.p != null || band === 'apex') && priceBand(x.p) === band && (band !== 'apex' || c.p == null || x.p == null || x.p <= 2 * c.p) && same(x))
    .map(x => { let share = 0; tags(x).roles.forEach(r => { if (tc.roles.has(r)) share++; }); const v = V(x); return {c:x, v, fit:v + (mainType(x) === ty ? 3 : 0) + 2 * share}; });
  if (!C.length) return [];
  // Cards from the commander's own set (or franchise) and cards of its theme creature types come first, always; they need
  // half of the pick's gain over the card in the slot, where the rest need the top-of-field floor.
  const T = themeCtx(ref), vc = val(c), half = vcut != null ? vcut + 0.5 * (vc - vcut) : vc - Math.abs(vc) * 0.25;
  C.forEach(y => { y.theme = themeOf(y.c, T); });
  const vs = C.map(y => y.v).sort((a, b) => b - a), floor = vs[Math.min(vs.length - 1, Math.floor(vs.length * ALT_TOP))];
  const ok = C.filter(y => (vcut == null || y.v > vcut) && (o.all || y.v >= floor || (y.theme && y.v >= half)));
  return ok.sort((a, b) => (!!b.theme - !!a.theme) || b.fit - a.fit || (a.c.p || 0) - (b.c.p || 0)).slice(0, o.all ? 400 : o.n || 6)
    .map(y => ({n:y.c.n, p:y.c.p, v:+y.v.toFixed(2), band, job:j || '', type:mainType(y.c), theme:y.theme}));
}
// On theme: the commander's own set family (a Universes Beyond franchise counts as one: every Marvel set is Marvel), or a
// creature type the commander or the deck's tribe is built on. Class types every set uses (Human, Warrior, Wizard…) don't count.
const GENERIC_TYPES = new Set('Human Warrior Soldier Wizard Cleric Rogue Shaman Knight Noble Advisor Artificer Scout Citizen Peasant Monk Druid Assassin Berserker Archer Scientist Detective Spellshaper Mercenary Coward Performer Rebel Pilot Spirit Construct Avatar'.split(' '));
function franchiseOf(c){ const s = (c && c.set) || ''; if (/^Marvel/.test(s)) return 'Marvel'; return s.replace(/\s+(Commander|Eternal|Jumpstart.*|Art Series|Alchemy.*|Promos|Tokens)$/, '').trim(); }
function subtypesOf(c){ const t = c ? frontType(c) : ''; return /Creature|Kindred|Tribal/.test(t) && t.includes('—') ? t.split('—')[1].trim().split(/\s+/) : []; }
function themeCtx(d){ const cs = [find(d.commander), d.partner && find(d.partner)].filter(Boolean), fam = new Set(), types = new Set();
  cs.forEach(c => { const f = franchiseOf(c); if (f) fam.add(f); subtypesOf(c).forEach(t => { if (!GENERIC_TYPES.has(t)) types.add(t); }); }); if (d.tribe) types.add(d.tribe); return {fam, types}; }
function themeCtxC(d){ const k = [d.commander, d.partner || '', d.tribe || ''].join('|'); if (themeCtxC.k !== k){ themeCtxC.k = k; themeCtxC.v = themeCtx(d); } return themeCtxC.v; }
function themeOf(c, T){ if (!c || !T) return ''; const f = franchiseOf(c); if (f && T.fam.has(f)) return 'From ' + f; const st = subtypesOf(c).find(x => T.types.has(x)); return st ? 'Fits the ' + st + ' theme' : ''; }
function syncPlan(d){ if (!d.plan) return false; const inDeck = new Set(d.cards.filter(e => !isBasic(e.n)).map(e => keyOf(e.n))), n0 = d.plan.length;
  d.plan = d.plan.filter(x => x.basic || ![x.a, x.m, x.b].some(y => y && inDeck.has(keyOf(y)))); if (!d.plan.length) delete d.plan; return (d.plan ? d.plan.length : 0) !== n0; }
function planNeed(d){ return analyze(d).T.size - (d.format === 'commander' && d.commander ? 1 : 0) - (d.partner ? 1 : 0); }
// Add every plan slot at one price level (or only the cards you own), best picks first, as many as there is room for.
function planAll(d, v){ let k = 0, room = planNeed(d) - d.cards.reduce((a, e) => a + e.q, 0); const rk = x => x.seed ? 0 : x.own ? 1 : x.basic ? 4 : x.land ? 3 : 2;
  // Mid and Budget are strict price levels: a slot whose only pick is over the price (no same-job stand-in) is left open,
  // and the open slots are filled by the generator at that price level instead.
  const over = n => { const c = find(n); return (v === 'mid' || v === 'budget') && c && c.p != null && !underCap(c.p, v); };
  (d.plan || []).slice().sort((a, b) => rk(a) - rk(b) || a.id - b.id).forEach(x => { if (room <= 0 || (v === 'own' && !x.own)) return; if (x.q > room){ if (x.basic){ addCard(d, x.a, room); x.q -= room; k += room; room = 0; } return; } if (v === 'own'){ room -= x.q; if (planInstall(d, x, 'a')) k += x.q; return; } const n = x.own || x.seed || x.basic ? x.a : planPick(x, v); if (!x.own && !x.seed && over(n)) return;
    // (UP.midOpen, Build 145) at Mid (and Budget with UP.budOpen), a spell slot whose Apex card is over the price is left open for the
    // best card at that price overall, instead of the cheaper card that does the same job
    if (!x.own && !x.seed && !x.land && n !== x.a && ((v === 'mid' && UP.midOpen) || (v === 'budget' && UP.budOpen))) return; room -= x.q; if (planInstall(d, x, n === x.b ? 'b' : n === x.m ? 'm' : 'a')) k += x.q; });
  if ((v === 'mid' || v === 'budget') && room > 0){ const t0 = d.tier, n0 = d.cards.reduce((a, e) => a + e.q, 0); d.tier = v; try { fillDeck(d); } finally { d.tier = t0; } k += d.cards.reduce((a, e) => a + e.q, 0) - n0; syncPlan(d); }
  return k; }
function planInstall(d, x, key){
  const n = key === 'b' ? x.b : key === 'm' ? x.m : x.a; if (!n) return false;
  addCard(d, n, x.q); const en = d.cards.find(y => y.n === n); if (en && !x.basic){ en.step = key === 'b' ? 1 : key === 'm' ? 2 : 3; if (x.seed) en.l = true; }
  d.plan = d.plan.filter(y => y !== x); if (!d.plan.length) delete d.plan; return true;
}
// Fill a new deck from its generated plan (Build 143): the plan is designed, then, when a price level is chosen, the deck is built
// straight from it and polished at that level. The same function runs in the background worker (work.js) and on the page, so
// a deck comes out the same wherever it was built. ownAll: the player's owned cards; ownOnly: build from them first.
function genDeck(nd, seeds, ownOnly, ownAll, fill){ return runSync(genDeckG(nd, seeds, ownOnly, ownAll, fill)); }
function* genDeckG(nd, seeds, ownOnly, ownAll, fill){ const own0 = upgradePaths.own; upgradePaths.own = ownAll || new Set();
  try { nd.plan = yield* buildPlanG(nd, seeds || [], ownOnly, ownAll || new Set()); const n = nd.plan.reduce((s, x) => s + x.q, 0); let k = 0;
    if (fill){ k = planAll(nd, fill); delete nd.plan; nd.tier = fill; if (fill !== 'apex') yield* polishDeckG(nd); }
    return {n, k}; } finally { upgradePaths.own = own0; } }
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
      if (f.legend && !canLead(c)) continue;   // anything that may be a commander: legendary creatures, "can be your commander" cards, legendary vehicles with power
      if (f.max && !(c.p != null && c.p <= f.max)) continue;
      if (f.theme && !(matchAim(c, f.theme, f.tribe) >= 0.7)) continue;
    }
    res.push([rank, c]);
  }
  res.sort((a, b) => a[0] - b[0] || ((a[1].r || 1e6) - (b[1].r || 1e6)) || a[1].n.localeCompare(b[1].n));
  return {total:res.length, cards:res.slice(0, limit || 60).map(x => x[1])};
}


// ===== Deck Companion engine: library, parsing, analysis, recommendations =====
const BASICS = {Plains: 'W', Island: 'U', Swamp: 'B', Mountain: 'R', Forest: 'G', Wastes: ''};
const COLOR_BASIC = {W: 'Plains', U: 'Island', B: 'Swamp', R: 'Mountain', G: 'Forest'};
const TIERS = {budget: {label: 'Budget', cap: 3}, mid: {label: 'Mid', cap: 12}, apex: {label: 'Apex', cap: Infinity}};
// Commander Brackets (Wizards of the Coast). Which cards are Game Changers comes from Scryfall with the card data
// (c.gc), and the mass land denial and extra-turn cards come from Scryfall's card tags (BTAGS), so both stay current
// on their own. Only the limits live here: Game Changers allowed, whether mass land denial belongs, and how many
// extra-turn cards still count as "a few" (Brackets 2-3 allow some, not chained).
const BRACKETS = {
  1: {label: 'Exhibition', gc: 0, mld: false, turns: 0},
  2: {label: 'Core', gc: 0, mld: false, turns: 2},
  3: {label: 'Upgraded', gc: 3, mld: false, turns: 2},
  4: {label: 'Optimized', gc: Infinity, mld: true, turns: Infinity},
  5: {label: 'cEDH', gc: Infinity, mld: true, turns: Infinity}
};
let BTAGS = {mld: new Set(), turns: new Set(), v: 0};
// Universes Beyond families. A deck led by a commander from one of these is an "in-universe" deck: its Budget upgrades
// come only from that family's sets, and at Mid and Apex an in-universe card wins ties but never beats a clearly better card.
const UNIVERSES = [
  ['msh', 'msc', 'spm', 'spe', 'tmt', 'tmc'],
  ['ltr', 'ltc'],
  ['fin', 'fic', 'fca'],
  ['who'],
  ['pip'],
  ['40k'],
  ['acr'],
  ['bot']
];
function universeOf(c) {
  const g = c && c.sc ? UNIVERSES.find(x => x.includes(c.sc)) : null;
  return g ? new Set(g) : null;
}
// Where a deck sits: no Game Changers is Bracket 2, one to three is Bracket 3, more (or any mass land denial) is Bracket 4.
// Brackets 1 and 5 are about how the deck is meant to be played, which the card list alone can't show.
function bracketOf(gc, mld) {
  return mld > 0 || gc > 3 ? 4 : gc > 0 ? 3 : 2;
}
const TRIBES = [
  'Elf',
  'Goblin',
  'Zombie',
  'Dragon',
  'Vampire',
  'Angel',
  'Merfolk',
  'Dinosaur',
  'Wizard',
  'Human',
  'Soldier',
  'Knight',
  'Cat',
  'Sliver',
  'Elemental',
  'Spirit',
  'Pirate',
  'Eldrazi',
  'Squirrel',
  'Rat',
  'Bird',
  'Beast',
  'Demon',
  'Warrior',
  'Cleric',
  'Rogue',
  'Faerie',
  'Giant',
  'Hydra',
  'Dwarf',
  'Myr',
  'Wolf',
  'Werewolf',
  'Skeleton',
  'Insect',
  'Fungus',
  'Snake',
  'Treefolk',
  'Ninja',
  'Samurai',
  'Shaman',
  'Druid',
  'Artificer',
  'Horror',
  'Phyrexian',
  'Kraken',
  'Sphinx',
  'Rabbit',
  'Mouse',
  'Otter',
  'Lizard',
  'Frog',
  'Bat',
  'Raccoon',
  'Dog',
  'Bear',
  'Ooze',
  'Plant',
  'Rebel',
  'Ally',
  'Advisor',
  'God',
  'Construct',
  'Thopter',
  'Golem',
  'Devil',
  'Minotaur',
  'Centaur',
  'Kithkin',
  'Vedalken',
  'Kor',
  'Orc',
  'Halfling',
  'Detective',
  'Assassin',
  'Scout',
  'Monk',
  'Berserker',
  'Barbarian',
  'Noble',
  'Avatar',
  'Shapeshifter',
  'Illusion',
  'Drake',
  'Serpent',
  'Octopus',
  'Fish',
  'Crab',
  'Spider',
  'Boar',
  'Elk',
  'Ox',
  'Unicorn',
  'Pegasus',
  'Griffin',
  'Phoenix',
  'Hellion',
  'Wurm',
  'Leviathan',
  'Turtle',
  'Nightmare',
  'Shade',
  'Specter',
  'Wraith',
  'Imp',
  'Gargoyle',
  'Kobold',
  'Ogre',
  'Troll',
  'Cyclops',
  'Satyr',
  'Dryad',
  'Nymph',
  'Naga',
  'Djinn',
  'Efreet',
  'Archon',
  'Praetor',
  'Mutant',
  'Robot',
  'Astartes',
  'Tyranid',
  'Necron',
  'Time Lord',
  'Doctor',
  'Hero',
  'Villain'
];

// Version 0.9.2 (19 Oct): token doublers worded as a replacement ("If one or more tokens would be created"), damage doublers
// and power doublers are read too (found by tools/tests/suite/misread.js).
const THEMES = {
  tokens: {
    label: 'Tokens / go wide',
    re: /\bcreates?\b[^.]*\btokens?\b|tokens? you control|populate|(^|[.—] ?)(other )?creatures you control get \+|tokens? would be created/i
  },
  // counters a card keeps or moves count too, even when the text never says +1/+1 (The Ozolith, Fate Transfer, Nexus Mentality; owner, 19 Oct)
  counters: {
    label: '+1/+1 counters',
    re: /\+1\/\+1 counter|proliferate|number of (each kind of )?counters?|\bmove (all |any number of |one or more |a |one |those |the )?counters?\b|\bput (those|its|the same) counters on\b|\bhad counters on (it|them)\b|\bwith (one or more )?counters on (it|them)\b/i
  },
  graveyard: {
    label: 'Graveyard / reanimator',
    re: /from (your|a|any) graveyard|\bmills?\b|in(to)? your graveyard|flashback|unearth|dredge|cards? in your graveyard/i
  },
  sacrifice: {
    label: 'Sacrifice / aristocrats',
    re: /sacrifice (a|an|another|two|three|ten) |whenever [^.]*\bdies\b|each (other )?(opponent|player) sacrifices/i
  },
  spells: {
    label: 'Spellslinger',
    re: /instant or sorcery|instant and sorcery|noncreature spell|magecraft|prowess|copy (target|that) (instant|sorcery|spell)/i,
    type: /Instant|Sorcery/
  },
  artifacts: {label: 'Artifacts', re: /\bartifacts?\b|treasure token|thopter|affinity|metalcraft/i, type: /Artifact/},
  enchantments: {label: 'Enchantments', re: /\benchantments?\b|\bauras?\b|constellation/i, type: /Enchantment/},
  lifegain: {label: 'Lifegain / drain', re: /gains? [^.]{0,30}life|lifelink|whenever you gain life|loses? [^.]{0,30}life/i},
  lands: {
    label: 'Lands / landfall',
    re: /landfall|whenever a land|additional land|lands? (cards? )?from your (graveyard|hand)|for each land you control|land card from your hand onto/i
  },
  voltron: {
    label: 'Voltron (equipment / auras)',
    re: /equipped creature|enchanted creature|\bequip\b|\battach\b|aura,? (and|or) equipment|aura and equipment/i,
    type: /Equipment|Aura/
  },
  blink: {
    label: 'Enter-the-battlefield / blink',
    re: /then return (it|that card|those cards|them) to the battlefield|whenever (a|another|one or more)[^.]{0,40}creatures?[^.]{0,30}\benters?\b|when [^.]{1,45} enters,|triggers an additional time/i
  },
  burn: {
    label: 'Burn / direct damage',
    re: /deals? (double|triple) that damage|deals? (\d+|x|that much) damage to (each opponent|any target|target player|each player|that player)|damage to each opponent|deals damage equal to [^.]* to any target/i
  },
  aggro: {
    label: 'Aggro / combat',
    re: /deals? (double|triple) that damage|double (the|its|this creature's|target creature's) power|\bhaste\b|double strike|additional combat|whenever [^.]{0,50}\battacks?\b(?! you)|(^|[.—] ?)(other )?creatures you control get \+|\btrample\b/i
  },
  control: {label: 'Control / interaction', re: null},
  draw: {
    label: 'Card advantage engine',
    re: /draws? (a|an|two|three|four|seven|x|that many|up to two) (additional )?cards?|draw cards equal|draw a card for each|draw x cards|no maximum hand size/i
  },
  tribal: {label: 'Creature type (tribal)', re: null}
};
// Keywords and ability words (Comprehensive Rules 701, 702, 207.2c; tools/rules/keywords.json) mapped to the themes they
// belong to (Build 139, UP.kw). A card with the word in its text counts for the theme even when its wording differs.
const KW_THEMES = {
  graveyard: [
    'from their graveyard',
    'from each graveyard',
    'dredge',
    'flashback',
    'unearth',
    'escape',
    'embalm',
    'eternalize',
    'disturb',
    'retrace',
    'jump-start',
    'aftermath',
    'delve',
    'scavenge',
    'encore',
    'recover',
    'threshold',
    'delirium',
    'fathomless descent',
    'descend 4',
    'descend 8',
    'undergrowth',
    'harness',
    '∞',
    'collect evidence',
    'gravestorm'
  ],
  tokens: ['populate', 'amass', 'incubate', 'fabricate', 'myriad', 'mobilize'],
  counters: [
    'proliferate',
    'adapt',
    'bolster',
    'support',
    'evolve',
    'graft',
    'modular',
    'outlast',
    'mentor',
    'reinforce',
    'increment'
  ],
  sacrifice: ['exploit', 'casualty', 'emerge', 'devour', 'morbid', 'revolt'],
  spells: ['prowess', 'magecraft', 'storm', 'cascade', 'splice', 'replicate', 'rebound', 'spell mastery', 'paradox'],
  artifacts: ['affinity', 'improvise', 'metalcraft', 'living metal', 'craft'],
  enchantments: ['constellation', 'bestow', 'eerie'],
  lifegain: ['extort'],
  lands: ['landfall', 'domain', 'awaken'],
  voltron: ['reconfigure', 'for mirrodin!', 'living weapon', 'job select'],
  blink: ['encore'],
  aggro: [
    'battle cry',
    'exalted',
    'melee',
    'raid',
    'dash',
    'annihilator',
    'myriad',
    'afflict',
    'enlist',
    'mobilize',
    'pack tactics'
  ],
  burn: ['spectacle'],
  draw: ['connive', 'hideaway']
};
const KW_RE = (() => {
  const m = {};
  for (const k in KW_THEMES)
    m[k] = new RegExp(
      '(^|[^a-z])(' + KW_THEMES[k].map(w => w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|') + ')($|[^a-z])',
      'i'
    );
  return m;
})();
// A commander's engine (Build 139, UP.kw): what it makes (token kinds, counters), what sets it off (its triggers) and what it
// counts. Cards are then judged by how they feed it (see MECHANICS_NOTES.md, section 1): doublers, payoffs for what it makes,
// enablers of its triggers.
const TOKEN_KINDS = [
  'Treasure',
  'Food',
  'Clue',
  'Blood',
  'Map',
  'Gold',
  'Powerstone',
  'Incubator',
  'Junk',
  'Shard',
  'Walker',
  'Role',
  'Lander',
  'Mutagen',
  'Vibranium'
];
function commanderEngine(cmds) {
  const E = {tokens: new Set(), creatureTokens: false, counters: false, fillsGY: false, trig: new Set(), types: new Set()};
  cmds.filter(Boolean).forEach(cmd => {
    const o = (cmd.o || '').replace(new RegExp(cmd.n.split(',')[0].replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g'), 'CARDNAME');
    (o.match(/\bcreates? [^.]*?tokens?\b|[^.]*\btokens?\b[^.]*\bcreated\b[^.]*/gi) || []).forEach(m => {
      TOKEN_KINDS.forEach(k => {
        if (new RegExp('\\b' + k + '\\b').test(m)) E.tokens.add(k);
      });
      if (/creature tokens?/i.test(m)) {
        E.creatureTokens = true;
        (m.match(/\b[A-Z][a-z]+(?= (creature )?tokens?| [A-Z][a-z]+ creature token)/g) || [])
          .filter(w => TRIBES.includes(w))
          .forEach(w => E.types.add(w));
      }
    });
    if (/put (a|an|one|two|three|x|that many) \+1\/\+1 counters?|proliferate/i.test(o)) E.counters = true;
    if (/sacrifice (x|a|an|another|one or more|two|three)( other)? (creatures?|permanents?|artifacts?|tokens?)/i.test(o))
      E.sacs = true;
    if (
      /\bmills?\b|into your graveyard|surveil|discard (a|two|that many) cards?/i.test(o) &&
      !/from your graveyard to (your hand|the battlefield)/i.test(
        o.split(/\n/).find(l => /into your graveyard|\bmills?\b/i.test(l)) || ''
      )
    )
      E.fillsGY = true;
    const T = [
      ['cast-spell', /whenever you cast (an|a) (instant|sorcery)|whenever you cast (an|a) noncreature|magecraft|prowess/i],
      ['cast-creature', /whenever you cast a creature/i],
      ['etb', /whenever (a|another|one or more) [^.]{0,40}\benters\b/i],
      ['dies', /whenever (a|another|one or more)[^.]{0,40}\b(dies|die)\b|whenever you sacrifice|\bdying\b/i],
      [
        'attack',
        /whenever CARDNAME attacks|whenever (a|one or more) creatures? you control attack|deals combat damage to a player/i
      ],
      ['life', /whenever you gain life/i],
      ['land', /landfall|whenever a land (you control )?enters/i],
      ['draw', /whenever you draw/i],
      ['discard', /whenever you discard/i],
      ['mill', /whenever [^.]{0,40}(put into your graveyard|mill)/i],
      ['token', /whenever you create a token|whenever one or more tokens/i],
      ['counter', /whenever (one or more )?\+1\/\+1 counters? (is|are) put/i]
    ];
    T.forEach(([k, re]) => {
      if (re.test(o)) E.trig.add(k);
    });
  });
  return E;
}
// How a card fits the commander's engine: 1 a doubler of what it makes or of its triggers, 0.8 a payoff for what it makes,
// 0.6 an enabler of one of its triggers; with the reason shown.
function engineFit(c, E) {
  if (!E || !c) return {v: 0};
  const o = c.o || '',
    t = frontType(c),
    tg = tags(c);
  if (tags(c).land) return {v: 0};
  const tokDouble =
      /(twice that many|that many plus one|create (twice|an additional|one additional))[^.]*tokens?|tokens? [^.]{0,40}(instead|twice that many)/i,
    cntDouble = /(twice that many|that many plus one|an additional)[^.]*counters?/i,
    trigDouble = /triggers? an additional time/i;
  if ((E.creatureTokens || E.tokens.size) && tokDouble.test(o)) return {v: 1, why: 'Doubles the tokens your commander makes'};
  if (E.counters && cntDouble.test(o)) return {v: 1, why: 'Doubles the counters your commander puts'};
  if (E.trig.size && trigDouble.test(o)) return {v: 1, why: 'Makes your commander’s abilities trigger twice'};
  for (const k of E.tokens)
    if (new RegExp('\\b' + k + '\\b').test(o)) return {v: 0.8, why: 'Uses the ' + k + ' tokens your commander makes'};
  if (
    E.creatureTokens &&
    /tokens? you control|whenever one or more (creature )?tokens|populate|creatures you control get \+|for each creature you control|sacrifice (a|another) creature[^.]*:/i.test(
      o
    )
  )
    return {v: 0.8, why: 'Pays off the creature tokens your commander makes'};
  for (const ty of E.types)
    if (new RegExp('\\b' + ty + 's?\\b').test(o) || new RegExp('\\b' + ty + '\\b').test(t))
      return {v: 0.8, why: 'Works with your commander’s ' + ty + ' tokens'};
  if (
    E.counters &&
    (/\+1\/\+1 counters? on|for each \+1\/\+1 counter|proliferate|with a \+1\/\+1 counter/i.test(o) || THEMES.counters.re.test(o))
  )
    return {v: 0.8, why: 'Uses the +1/+1 counters your commander puts'};
  if (
    (E.sacs || E.creatureTokens) &&
    /whenever [^.]{0,30}\b(a|another|one or more)( other)?( nontoken)? creatures?( you control)?( die| dies)|whenever you sacrifice/i.test(
      o
    )
  )
    return {
      v: 0.8,
      why: E.sacs ? 'Pays off the creatures your commander sacrifices' : 'Pays off the creature tokens your commander makes'
    };
  if (
    E.fillsGY &&
    (tg.th.graveyard === 1 ||
      /from (your|their|a|any|each) graveyards?|graveyard to the battlefield|cards? in your graveyard/i.test(o)) &&
    !/exile (all|each|target player's) graveyards?|exile all cards from/i.test(o)
  )
    return {v: 0.8, why: 'Uses the cards your commander puts in your graveyard'};
  const en = {
    'cast-spell': () => /Instant|Sorcery/.test(t) && (c.cmc || 0) <= 3,
    'cast-creature': () => /Creature/.test(t) && (c.cmc || 0) <= 3,
    etb: () => (/Creature/.test(t) && (c.cmc || 0) <= 3) || /\bcreates? [^.]*creature tokens?/i.test(o) || ROLE_RE.blink.test(o),
    dies: () =>
      /sacrifice (a|another|one or more) (creatures?|permanents?|artifacts?)[^.:]*:|each (opponent|player) sacrifices/i.test(o) ||
      /\bcreates? [^.]*creature tokens?/i.test(o),
    attack: () => /\b(flying|menace|trample|can't be blocked|haste|additional combat|untap all creatures)\b/i.test(o),
    life: () => /gain [^.]{0,20}life|lifelink/i.test(o),
    land: () => /search your library for [^.]*land|play an additional land|additional land|lands? from your graveyard/i.test(o),
    draw: () => tg.roles.has('draw'),
    discard: () => /discard (a|one|two|that) cards?|connive/i.test(o),
    mill: () => /\bmills?\b|surveil|put the top [^.]* into your graveyard/i.test(o),
    token: () => /\bcreates?\b[^.]*\btokens?\b/i.test(o),
    counter: () => /\+1\/\+1 counters?|proliferate/i.test(o)
  };
  for (const k of E.trig)
    if (en[k] && en[k]())
      return {
        v: 0.6,
        why:
          'Sets off your commander (' +
          {
            'cast-spell': 'casting spells',
            'cast-creature': 'casting creatures',
            etb: 'creatures entering',
            dies: 'creatures dying',
            attack: 'attacking',
            life: 'gaining life',
            land: 'lands entering',
            draw: 'drawing',
            discard: 'discarding',
            mill: 'cards going to your graveyard',
            token: 'making tokens',
            counter: '+1/+1 counters'
          }[k] +
          ')'
      };
  return {v: 0};
}
const ROLE_LABEL = {ramp: 'Ramp', draw: 'Card draw', removal: 'Removal', wipe: 'Board wipes'};
const LAND_WORDS = '(basic land|land|plains|island|swamp|mountain|forest)';
const ROLE_RE = {
  ramp: new RegExp(
    '\\{T\\}[^.]{0,40}: Add |: Add \\{|adds? (an additional|one additional|\\{)|add (one|two|three|x) mana|search your library for [^.]*' +
      LAND_WORDS +
      ' cards?[^.]*onto the battlefield|land card from your hand onto the battlefield|(?<!controller )creates? [^.]*treasure token|additional land on each|play (an|one|two|three|x) additional lands?|untap target (forest|land)|produces? (twice|three times) as much|(lands?|permanents?) for mana, (add|it produces)|^(?![^\\n]*(its controller|that player|each opponent|their library))[^\\n]*search your library for [^.\\n]*land cards?[^.\\n]*\\.\\s*put (those|them|it|that card|one|the) [^.\\n]*onto the battlefield|(you may )?put (a|up to (one|two)|any number of|those) land cards? (from among them |from your graveyard )?onto the battlefield|land cards? are put into your graveyard[^.]*put them onto the battlefield|creature or land card[^.]*put it onto the battlefield tapped if it.s a land',
    'im'
  ),
  // one card or a few: destroy, exile, bounce, shrink, fight, bite, edict, lock down, turn into something harmless
  removal:
    /(destroy|exile) (up to (one|two|three|x) |x |two |three )?(other |another )?target (?!player|card|instant|sorcery|spell|non-|creature you control|creature card|artifacts, creatures|land\b)[^.]*(creature|permanent|artifact|enchantment|planeswalker|battle)|deals? (\d+|x|that much|twice that much) damage to (any target|(up to (one|two|three) )?(other |another )?target (attacking or blocking |attacking |blocking |tapped )?(creature|permanent|planeswalker))|damage equal to (its|their|that creature's|x|the number)[^.]{0,40} to (any target|(up to one |another |each of up to \w+ )?target (creature|permanent|planeswalker))|deals damage equal to its power to (any target|(another |up to one )?target|each of)|target creature gets -(\d+|x)|gets? -(\d+|x)\/-(\d+|x) until|return (up to (one|two) )?(another )?target (spell or )?(nonland permanent|creature|permanent)[^.]*to its owner's hand|fights? (up to one |another |a different |target )|owner of target permanent shuffles|exile that creature|target (player|opponent) sacrifices (a|an|two) (creature|permanent|nonland)|each (other )?(opponent|player) sacrifices (a|an|two|three|that many) (nontoken )?(creatures?|permanents?|nonland)|put (a|an|two|three|x) -1\/-1 counters? on (up to one )?target creature(?! you control)|enchanted (creature|permanent)[^.]* loses all other (abilities|card types)|enchanted (creature|permanent) is a colorless (land|forest)|put target (creature|nonland permanent|permanent)[^.]*(top|bottom) of its owner's library|enchanted (creature|permanent) (can't attack or block|can't attack, block|loses all abilities|doesn't untap)|target creature[^.]*loses all abilities|gain control of target (creature|permanent|artifact)/i,
  wipe: /(destroy|exile) (all|each) (?!lands)(creatures?|nontoken|nonland|artifacts?|enchantments?|permanents?|other|non)|deals? (\d+|x|that much) damage to each (creature|other creature|non|attacking|blocking)|damage to each creature|(all|each) (other )?creatures? gets? -|creatures (your opponents control|you don't control) get -(\d+|x)\/-|destroy all artifacts, creatures|return (all|each) (nonland|attacking|creature|other)[^.]*to (its|their) owner(s|'s|s')? hands?|(destroy|exile) (all|each) (?!lands?\b)([\w-]+ ){1,3}?(creatures|permanents|artifacts|enchantments)\b|put (x|a|an|two|three) -1\/-1 counters? on each creature|damage to each opponent and each creature|then sacrifices the rest|each player sacrifices (all|\w+ creatures)|sacrifices? all (creatures|permanents|nonland)|damage divided as you choose among any number of target creatures|each of those[^.]*fights a different|(destroy|exile|damage|return|gets -)[^]*\boverload\b/i,
  counter:
    /counter (up to one |another )?target|counter (that|the) (spell|ability)(?! unless (that player|its controller) pays)/i, // ward's reminder text is not a counterspell
  tutor:
    /search your library (and\/or graveyard )?for (a|an|up to (one|two|three|four|x)|two|three|four|x) (?!basic|land|plains|island|swamp|mountain|forest|gate)[^.]*cards?/i,
  // protects what you control (grants, fogs, blinks, phasing); a creature that is merely hard to kill itself does not count
  protect:
    /(creatures?|permanents?|artifacts?) you control[^.]{0,45}(gain|gains|have|has)[^.]{0,35}(hexproof|indestructible|protection from|shroud|ward)|(target|another target|equipped|enchanted|each|that) (creature|permanent|artifact)[^.]{0,60}(gains?|has|have)[^.]{0,40}(hexproof|indestructible|protection from|shroud|ward)|you (gain|have) (hexproof|protection from|shroud)|phases? out|prevent all (combat )?damage|(totem|umbra) armor|regenerate (target|each|enchanted|equipped)|can't be the targets? of spells or abilities your opponents control|gains? "when this creature dies, return it to the battlefield|when enchanted (creature|permanent) dies or is put into exile, return|change (a|the) target of target (spell|instant)|(those|target) creatures? (you control )?gains? (indestructible|hexproof)|exile (two |any number of )?target [^.]*you control, then return/i,
  blink:
    /exile (up to one |another |any number of )?target (creature|permanent|nonland permanent)s? you control[^.]*(then )?return/i
};

let LIB = [],
  IDX = new Map();
// What players actually run with one commander (from EDHREC): key = commander name, map = card name -> {inc, syn}.
let EDH = {key: '', map: null, decks: 0, state: '', pre: null, tags: [], tmap: {}};
// EDHREC's page for the precon a commander leads: its decklist, the cards its owners cut most (in order) and the cards they
// add (share of the decks built from it). Plain arrays, so the loader can cache it. Used only for decks that still hold
// most of that precon.
// A commander's own mechanics, as players build them (EDHREC theme tags, most-built first), and the play data inside one theme.
// A theme aim is stored as 'edh:<slug>' in d.aims; EDH.tags lists the commander's themes, EDH.tmap[slug] the theme's cards.
function parseLands(j) {
  const p = (((j && j.panels) || {}).piechart || {}).content || [],
    L = p.find(x => x.label === 'Land');
  return L ? +L.value : 0;
}
function parseTags(j) {
  return (((j && j.panels) || {}).taglinks || [])
    .filter(t => t && t.slug && t.value)
    .map(t => ({slug: t.slug, label: t.value, count: t.count || 0}));
}
function parseTheme(j) {
  const m = new Map();
  (((j && j.container && j.container.json_dict) || {}).cardlists || []).forEach(L =>
    (L.cardviews || []).forEach(v => {
      if (!v.name || !v.potential_decks) return;
      const inc = Math.min(1, v.num_decks / v.potential_decks),
        k = norm(v.name),
        o = m.get(k);
      if (!o || inc > o.inc) m.set(k, {inc, syn: +(v.synergy || 0)});
    })
  );
  return m;
}
// Fallback play data (Build 145): a commander with no EDHREC page of its own (or very little data) is built from EDHREC's theme
// pages instead: what decks of its creature type and its themes run in its colours ("In 41% of Zombies decks"). fallTags lists
// the pages: its tribe first, then its first theme (from its text, detectStrategy). parseTag reads one, leaving out the list
// of top commanders.
const TAG_OF = {
  tokens: 'tokens',
  counters: 'plus-1-plus-1-counters',
  graveyard: 'graveyard',
  sacrifice: 'aristocrats',
  spells: 'spellslinger',
  artifacts: 'artifacts',
  enchantments: 'enchantress',
  lifegain: 'lifegain',
  lands: 'landfall',
  voltron: 'voltron',
  blink: 'blink',
  burn: 'burn',
  aggro: 'aggro',
  control: 'control',
  draw: 'card-draw'
};
const COLOR_PAGE = {
  '': 'colorless',
  W: 'mono-white',
  U: 'mono-blue',
  B: 'mono-black',
  R: 'mono-red',
  G: 'mono-green',
  WU: 'azorius',
  UB: 'dimir',
  BR: 'rakdos',
  RG: 'gruul',
  WG: 'selesnya',
  WB: 'orzhov',
  UR: 'izzet',
  BG: 'golgari',
  WR: 'boros',
  UG: 'simic',
  WUB: 'esper',
  UBR: 'grixis',
  BRG: 'jund',
  WRG: 'naya',
  WUG: 'bant',
  WBG: 'abzan',
  WUR: 'jeskai',
  UBG: 'sultai',
  WBR: 'mardu',
  URG: 'temur',
  WUBR: 'yore-tiller',
  UBRG: 'glint-eye',
  WBRG: 'dune-brood',
  WURG: 'ink-treader',
  WUBG: 'witch-maw',
  WUBRG: 'five-color'
};
const TRIBE_PL = {
  merfolk: 'merfolk',
  myr: 'myr',
  eldrazi: 'eldrazi',
  kor: 'kor',
  treefolk: 'treefolk',
  samurai: 'samurai',
  kithkin: 'kithkin',
  vedalken: 'vedalken',
  fish: 'fish',
  elk: 'elk',
  mouse: 'mice',
  ox: 'oxen',
  hero: 'heroes',
  fungus: 'fungi',
  pegasus: 'pegasi',
  cyclops: 'cyclopes',
  octopus: 'octopuses',
  elf: 'elves',
  wolf: 'wolves',
  dwarf: 'dwarves',
  werewolf: 'werewolves'
};
const tribeSlug = t => {
  const l = t.toLowerCase().replace(/ /g, '-');
  return TRIBE_PL[l] || (/[^aeiou]y$/.test(l) ? l.slice(0, -1) + 'ies' : /(x|s|ch|sh)$/.test(l) ? l + 'es' : l + 's');
};
function fallTags(cmdName, partner) {
  const cmd = find(cmdName);
  if (!cmd) return [];
  const d = {format: 'commander', commander: cmd.n, partner: partner || '', cards: [], aims: []},
    s = detectStrategy(cmd, d, true),
    par = partner && find(partner);
  const id = 'WUBRG'
      .split('')
      .filter(k => cmd.ci.includes(k) || (par && par.ci.includes(k)))
      .join(''),
    col = COLOR_PAGE[id] || '',
    out = [];
  if (s.tribe) out.push({slug: tribeSlug(s.tribe), label: s.tribe + ' decks'});
  const th = s.themes.find(t => TAG_OF[t]);
  if (th) out.push({slug: TAG_OF[th], label: THEMES[th].label + ' decks'});
  return out.slice(0, 2).map(x => Object.assign(x, {col, path: x.slug + (col ? '/' + col : '')}));
}
function parseTag(j) {
  const m = new Map();
  (((j && j.container && j.container.json_dict) || {}).cardlists || []).forEach(L => {
    if (L.tag === 'topcommanders') return;
    (L.cardviews || []).forEach(v => {
      if (!v.name || !v.potential_decks) return;
      const inc = Math.min(1, v.num_decks / v.potential_decks),
        k = norm(v.name),
        o = m.get(k);
      if (!o || inc > o.inc) m.set(k, {inc, syn: +(v.synergy || 0)});
    });
  });
  return m;
}
const isEdhAim = a => typeof a === 'string' && a.startsWith('edh:');
function aimLabel(a, tribe) {
  if (isEdhAim(a)) {
    const t = (EDH.tags || []).find(x => 'edh:' + x.slug === a);
    return t ? t.label : a.slice(4).replace(/-/g, ' ');
  }
  return a === 'tribal' ? (tribe || 'Creature type') + ' tribal' : (THEMES[a] || {label: a}).label;
}
// "Heroes: in 84% of Heroes decks" — the share of the commander's decks built around that theme that run the card.
function themeWhy(a, c) {
  const m = EDH.tmap && EDH.tmap[a.slice(4)],
    x = m && edhOf(m, c),
    L = aimLabel(a);
  return x ? L + ': in ' + Math.round(x.inc * 100) + '% of ' + L + ' decks' : L;
}

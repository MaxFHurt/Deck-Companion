// ===== Deck Companion background worker (Build 143) =====
// Builds generated decks on a background core, so the page stays responsive (the thinking animation keeps moving) while a
// deck is designed. It runs the same engine files as the page, and the page sends it exactly what the page itself would
// use: the card library, the commander's play data, combos, bracket lists, set lists, owned cards and the engine settings.
// So a deck built here is the same deck the page would build. Anything it can't do, the page does itself (ui.js genRun).
const V = self.location.search || '';
importScripts('data.js' + V, 'lists.js' + V, 'engine.js' + V);
let SIG = {lib:'', combos:'', edh:''}, COMBO_J = null;
function useState(m){
  if (m.lib){ buildIndex(m.lib.rows); SIG.lib = m.lib.sig; SIG.combos = ''; }
  if (m.combos){ COMBO_J = m.combos.j; SIG.combos = ''; SIG.cwant = m.combos.sig; }
  if (SIG.cwant !== SIG.combos){ if (COMBO_J) useCombos(COMBO_J); else COMBOS = {list:[], by:new Map(), at:'', state:''}; SIG.combos = SIG.cwant; }
  if (m.edh){ EDH = m.edh.v; SIG.edh = m.edh.sig; }
  if (m.btags) BTAGS = m.btags;
  if (m.sets) SETCARDS = m.sets;
  if (m.up) Object.assign(UP, m.up);
}
onmessage = ev => { const m = ev.data || {};
  try {
    useState(m);
    if (m.kind === 'sync'){ postMessage({id:m.id, ok:true, sig:SIG}); return; }
    // Warm-up: the card reading every build uses is done once, while the app is idle, so the first deck is not slower here.
    if (m.kind === 'warm'){ const t0 = Date.now(); for (const c of LIB) tags(c); postMessage({id:m.id, ok:true, ms:Date.now() - t0}); return; }
    // The reference build for a deck's settings, designed ahead while the player is still choosing (kept for the build).
    if (m.kind === 'ref'){ const t0 = Date.now(); apexRef(m.nd); postMessage({id:m.id, ok:true, ms:Date.now() - t0}); return; }
    if (m.kind === 'gen'){ const t0 = Date.now(), J = m.job, nd = J.nd, seeds = (J.seeds || []).map(n => find(n)).filter(Boolean);
      if (J.refs && J.refs.length){ apexRef.cache = apexRef.cache || new Map(); J.refs.forEach(([k, v]) => { if (!apexRef.cache.has(k)) apexRef.cache.set(k, v); }); while (apexRef.cache.size > 4) apexRef.cache.delete(apexRef.cache.keys().next().value); }
      const r = genDeck(nd, seeds, J.ownOnly ? new Set(J.ownOnly) : null, new Set(J.ownAll || []), J.fill || null);
      postMessage({id:m.id, ok:true, nd, n:r.n, k:r.k, ms:Date.now() - t0, refs:apexRef.cache ? [...apexRef.cache] : []}); return; }
    postMessage({id:m.id, err:'unknown job'});
  } catch (e) { postMessage({id:m.id, err:String((e && e.stack) || e)}); }
};

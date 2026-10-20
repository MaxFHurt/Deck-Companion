// ---------- boot ----------
ornaments();
paintSky();
let rz = 0;
let wasNarrow = isNarrow();
addEventListener('resize', () => {
  clearTimeout(rz);
  rz = setTimeout(paintSky, 250);
  const nw = isNarrow();
  if (nw !== wasNarrow) {
    wasNarrow = nw;
    render();
  } else fitWork();
});
loadLocal();
if (!S.profile.decks.length) {
  exampleDeck();
  S.profile.example = true;
} else S.deckId = S.profile.decks[0].id;
S.view = 'home';
S.open = false;
restoreSpot();
{
  const bn = $('#build-no');
  if (bn) bn.textContent = (window.VERSION || '') + ' (build ' + window.BUILD + ')';
}
render();
loadSavedLibrary();
initBackup();
checkShareLink();
addEventListener('hashchange', checkShareLink);

/* ====================== Panneau de gauche : sections repliables ====================== */
// Clic sur le titre d'une section (data-acc) : la replie ou la rouvre ; repliée, elle affiche le résumé de ses réglages.
// État gardé dans le navigateur ; par défaut, Attaches et Options sont repliées (data-closed).
const ACC_KEY = 'atelier-cnc-panneaux';
const accState = (() => { try { return JSON.parse(localStorage.getItem(ACC_KEY)) || {}; } catch (e) { return {}; } })();
const SUMMARY = {
  brut: () => { const m = MATERIALS.find(x => x.id === S.material); return `${f3(S.stock.w)} × ${f3(S.stock.h)} × ${f3(S.stock.t)} mm · ${S.origin === 'center' ? 'origine au centre' : 'coin avant-gauche'} · ${m ? m.name : 'réglages manuels'}`; },
  fraise: () => { const T = tool(); return `${T.name} · ${T.feed} mm/min · ${String(T.doc).replace('.', ',')} mm/passe`; },
  dessin: () => D ? `${D.name} · ${D.shapes.length} forme${D.shapes.length > 1 ? 's' : ''} · ${f3(D.place.s)} %` : 'aucun dessin',
  attaches: () => S.tabs.on ? `${S.tabs.n} × ${String(S.tabs.w).replace('.', ',')} mm, ${String(S.tabs.h).replace('.', ',')} mm de haut` : 'pas d\'attaches',
  options: () => `${S.climb ? 'en avalant' : 'conventionnel'} · ${S.ramp.on ? 'rampe ' + S.ramp.angle + '°' : 'plongée verticale'}`
};
function refreshSummaries() {
  for (const sec of $$('aside#left section[data-acc]')) { const f = SUMMARY[sec.dataset.acc], el = sec.querySelector(':scope > .sum'); if (f && el) try { el.textContent = f(); } catch (e) {} }
}
for (const sec of $$('aside#left section[data-acc]')) {
  const k = sec.dataset.acc, h = sec.querySelector(':scope > h2'), sum = document.createElement('div');
  sum.className = 'sum'; h.after(sum);
  sec.classList.toggle('closed', k in accState ? accState[k] : sec.dataset.closed === '1');
  h.title = 'Cliquer pour replier ou déplier';
  h.addEventListener('click', e => {
    if (e.target.closest('button,select,input')) return; // boutons du titre (+ / − des fraises)
    accState[k] = sec.classList.toggle('closed');
    try { localStorage.setItem(ACC_KEY, JSON.stringify(accState)); } catch (er) {}
    refreshSummaries();
  });
}
// résumés tenus à jour à chaque saisie dans le panneau, et après chaque recalcul (dessin importé, déplacé, mis à l'échelle)
$('aside#left').addEventListener('change', () => setTimeout(refreshSummaries, 0));
$('aside#left').addEventListener('input', () => setTimeout(refreshSummaries, 0));

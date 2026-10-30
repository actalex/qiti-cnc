/* ====================== Fenêtre d'import ====================== */
// À l'import d'un SVG : « la page Inkscape est le brut » (taille du brut = page, dessin placé comme sur la page, formes
// entièrement hors page ignorées) et usinages d'après les couleurs (couleurs.js). Les profondeurs dépendant de
// l'épaisseur, elle est modifiable ici. D.pageOnly est enregistré avec le projet : le filtre est refait au rechargement.
const pageBox = page => ({ x0: 0, y0: 0, x1: page.w, y1: page.h });
const inBox = (b, p) => !(b.x1 < p.x0 || b.x0 > p.x1 || b.y1 < p.y0 || b.y0 > p.y1);
const insideBox = (b, p) => b.x0 >= p.x0 - 1e-6 && b.x1 <= p.x1 + 1e-6 && b.y0 >= p.y0 - 1e-6 && b.y1 <= p.y1 + 1e-6;
// formes gardées avec la page comme brut : celles qui touchent la page (les autres sont ignorées)
function pageShapes(shapes, page) { const p = pageBox(page); return shapes.filter(s => inBox(bboxOf([s]), p)); }
// placement : le coin bas-gauche de la page = coin avant-gauche du brut (y du dessin vers le bas)
function placeOnPage() { D.place = { x: D.bb.x0, y: D.page.h - D.bb.y1, s: 100 }; }
function askImport() {
  const page = D.page, paint = D.shapes.some(hasPaint);
  if (!page && !paint) return Promise.resolve({ page: false, colors: false });
  return new Promise(resolve => {
    const pg = $('#impPage');
    const show = () => {
      const usePage = page && pg.checked, shapes = usePage ? pageShapes(D.shapes, page) : D.shapes, th = S.stock.t;
      const out = D.shapes.length - shapes.length, over = usePage ? shapes.filter(s => !insideBox(bboxOf([s]), pageBox(page))).length : 0;
      $('#impPageInfo').textContent = !page ? '' : `${f3(page.w)} × ${f3(page.h)} mm` + (out ? ` — ${out} forme(s) hors de la page ignorée(s)` : ' — tout le dessin est dans la page') + (over ? ` ; ${over} dépasse(nt) du bord` : '');
      const sm = colorSummary(shapes, colorPlan(shapes, th), th);
      $('#colSum').innerHTML = paint ? sm.lines.map(l => '• ' + l.replace(/&/g, '&amp;').replace(/</g, '&lt;')).join('<br>') : 'Pas de couleurs à interpréter.';
      $('#colWarn').textContent = paint ? sm.warn.join(' ') : '';
    };
    $('#impPageRow').classList.toggle('hide', !page); pg.checked = !!page; pg.onchange = show;
    $('#colNo').classList.toggle('hide', !paint); $('#colOk').textContent = paint ? 'Appliquer les couleurs' : 'OK';
    $('#colT').value = S.stock.t; show();
    $('#colT').oninput = () => { const v = parseFloat(String($('#colT').value).replace(',', '.')); if (v > 0) { S.stock.t = v; show(); } };
    const done = colors => { $('#dlgColors').close(); saveSettings(); $('#stT').value = S.stock.t; resolve({ page: !!(page && pg.checked), colors: colors && paint }); };
    $('#colOk').onclick = () => done(true); $('#colNo').onclick = () => done(false);
    $('#dlgColors').oncancel = e => { e.preventDefault(); done(false); };
    $('#dlgColors').showModal();
  });
}

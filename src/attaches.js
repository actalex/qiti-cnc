/* ====================== Attaches à la main ====================== */
// sh.tabs = points du contour en coordonnées du dessin (ils suivent placement et échelle) ; vide = attaches réparties
// automatiquement. En mode édition (tabEdit = id de la forme), un clic près du contour ajoute une attache, un clic sur
// une attache la retire. La FAO projette chaque point sur le trajet de la fraise (loopWithTabs).
let tabEdit = null;
function fromStockFn() {
  const s = D.place.s / 100, b = D.bb, px = D.place.x, py = D.place.y;
  return q => [(q[0] - px) / s + b.x0, b.y1 - (q[1] - py) / s];
}
const tabbable = sh => sh && (sh.op === 'outside' || sh.op === 'inside') && sh.closed;
// point du contour le plus proche (coordonnées brut) et sa distance
function nearestOnShape(sh, x, y) {
  const tf = toStockFn(); let best = { d: Infinity, q: null };
  for (const s of sh.subpaths) {
    const P = s.pts.map(tf), n = P.length;
    for (let k = 1; k < n + (s.closed ? 1 : 0); k++) {
      const a = P[k - 1], b = P[k % n], dx = b[0] - a[0], dy = b[1] - a[1], l = dx * dx + dy * dy;
      const t = l ? Math.max(0, Math.min(1, ((x - a[0]) * dx + (y - a[1]) * dy) / l)) : 0, q = [a[0] + t * dx, a[1] + t * dy];
      const d = Math.hypot(x - q[0], y - q[1]); if (d < best.d) best = { d, q };
    }
  }
  return best;
}
function tabClick(sx, sy) {
  const sh = D && D.shapes.find(s => s.id === tabEdit); if (!tabbable(sh)) return endTabEdit();
  const [x, y] = S2W(sx, sy), tf = toStockFn(), tol = 8 / view.s;
  sh.tabs = sh.tabs || [];
  const hit = sh.tabs.findIndex(p => { const q = tf(p); return Math.hypot(q[0] - x, q[1] - y) < tol; });
  if (hit >= 0) sh.tabs.splice(hit, 1);
  else { const n = nearestOnShape(sh, x, y); if (n.d > 2 * tol) return; sh.tabs.push(fromStockFn()(n.q)); }
  refreshShapes(); invalidate();
}
function endTabEdit() { tabEdit = null; cv.style.cursor = 'crosshair'; refreshShapes(); draw(); }
function drawTabMarkers() {
  const tf = toStockFn();
  for (const sh of D.shapes) if (sh.tabs && sh.tabs.length && tabbable(sh)) {
    const big = sh.id === tabEdit, h = big ? 5 : 3.5;
    ctx.fillStyle = big ? '#e67e22' : 'rgba(230,126,34,.8)'; ctx.strokeStyle = '#fff'; ctx.lineWidth = 1;
    for (const p of sh.tabs) { const [a, b] = W2S(...tf(p)); ctx.fillRect(a - h, b - h, 2 * h, 2 * h); ctx.strokeRect(a - h, b - h, 2 * h, 2 * h); }
  }
}
// ligne « Attaches » du panneau Formes : une seule forme détourée sélectionnée
function refreshTabRow(ss) {
  const sh = ss.length === 1 ? ss[0] : null, ok = tabbable(sh);
  $('#rowTabs').classList.toggle('hide', !ok);
  if (!ok) { if (tabEdit !== null) { tabEdit = null; cv.style.cursor = 'crosshair'; } return; }
  const n = (sh.tabs || []).length, notes = [];
  if (!S.tabs.on) notes.push('désactivées dans « Attaches »');
  if (depthOf(sh) < S.stock.t - 1e-6) notes.push('seulement sur une découpe traversante');
  $('#tabInfo').textContent = (n ? `Attaches : ${n} placée${n > 1 ? 's' : ''} à la main` : `Attaches : automatiques (${S.tabs.n} réparties)`) + (notes.length ? ' — ' + notes.join(', ') : '');
  $('#bTabEdit').textContent = tabEdit === sh.id ? 'Terminer' : 'Placer à la main';
  $('#bTabEdit').classList.toggle('pri', tabEdit === sh.id);
  $('#bTabAuto').disabled = !n;
}
$('#bTabEdit').onclick = () => {
  const ss = D ? D.shapes.filter(s => sel.has(s.id)) : [];
  if (tabEdit !== null) return endTabEdit();
  if (ss.length !== 1 || !tabbable(ss[0])) return;
  tabEdit = ss[0].id; cv.style.cursor = 'copy';
  if (viewMode !== 'design') $('#viewbar [data-v=design]').click();
  log('Clique près du contour pour ajouter une attache, sur une attache pour la retirer, puis « Terminer ».', 'msg');
  refreshShapes(); draw();
};
$('#bTabAuto').onclick = () => { const sh = D && D.shapes.find(s => sel.has(s.id)); if (!sh) return; sh.tabs = []; refreshShapes(); invalidate(); };

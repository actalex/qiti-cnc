/* ====================== Édition sur le plan de travail ====================== */
// Chaque forme garde sa géométrie importée (sh.orig) et une matrice cumulée sh.m = [a, b, c, d, e, f] (convention SVG,
// coordonnées du dessin, y vers le bas) : sh.subpaths = m · orig. Après une modification, rebase() recalcule
// l'encombrement D.bb et compense D.place : les autres formes ne bougent pas sur le brut, et D.place reste le coin
// bas-gauche du dessin. Annuler / rétablir : un état par sauvegarde automatique (les gestes rapprochés n'en font qu'un).
const ID = [1, 0, 0, 1, 0, 0];
const mul = (M, m) => [M[0] * m[0] + M[2] * m[1], M[1] * m[0] + M[3] * m[1], M[0] * m[2] + M[2] * m[3], M[1] * m[2] + M[3] * m[3], M[0] * m[4] + M[2] * m[5] + M[4], M[1] * m[4] + M[3] * m[5] + M[5]];
const apply = (m, p) => [m[0] * p[0] + m[2] * p[1] + m[4], m[1] * p[0] + m[3] * p[1] + m[5]];
const applyM = (m, subs) => subs.map(s => ({ closed: s.closed, pts: s.pts.map(p => apply(m, p)) }));
function initShapeGeom(sh) { sh.orig = sh.subpaths.map(s => ({ closed: s.closed, pts: s.pts.map(p => p.slice()) })); sh.m = ID.slice(); }
function rebase() {
  const s = D.place.s / 100, old = D.bb, nb = bboxOf(D.shapes);
  D.place.x += (nb.x0 - old.x0) * s; D.place.y += (old.y1 - nb.y1) * s; D.bb = nb; // pas d'arrondi : il s'accumulerait à chaque geste
}
function transformShapes(shs, M) {
  for (const sh of shs) { sh.m = mul(M, sh.m); sh.subpaths = applyM(sh.m, sh.orig); if (sh.tabs) sh.tabs = sh.tabs.map(p => apply(M, p)); }
  rebase();
}
const selShapes = () => D ? D.shapes.filter(s => sel.has(s.id)) : [];
// rotation de la sélection autour du centre de son encombrement ; angle > 0 = sens inverse des aiguilles d'une montre à l'écran
function rotateSel(deg) {
  const ss = selShapes(); if (!ss.length || job) return;
  const b = bboxOf(ss), cx = (b.x0 + b.x1) / 2, cy = (b.y0 + b.y1) / 2, a = -deg * Math.PI / 180, c = Math.cos(a), s = Math.sin(a); // y vers le bas
  transformShapes(ss, [c, s, -s, c, cx - c * cx + s * cy, cy - s * cx - c * cy]);
  refreshPlace(); invalidate();
}
// déplacement à la souris (mm sur le brut) ; le calcul FAO attend le relâchement
function moveSel(dx, dy) { const s = D.place.s / 100; transformShapes(selShapes(), [1, 0, 0, 1, dx / s, -dy / s]); refreshPlace(); draw(); }
// historique
let hist = [], fut = [], lastState = null;
const stateOf = () => JSON.stringify({ place: D.place, shapes: D.shapes.map(s => ({ m: s.m, op: s.op, depth: s.depth, through: !!s.through, tool: s.tool || '', clear: s.clear || '', tabs: s.tabs || [] })) });
function resetHistory() { hist = []; fut = []; lastState = D ? stateOf() : null; refreshUndo(); }
function recordHistory() {
  if (!D) return; const st = stateOf();
  if (lastState !== null && st !== lastState) { hist.push(lastState); if (hist.length > 100) hist.shift(); fut = []; }
  lastState = st; refreshUndo();
}
function applyState(st) {
  const o = JSON.parse(st);
  o.shapes.forEach((x, k) => { const sh = D.shapes[k]; Object.assign(sh, { m: x.m, op: x.op, depth: x.depth, through: x.through, tool: x.tool, clear: x.clear, tabs: x.tabs }); sh.subpaths = applyM(sh.m, sh.orig); });
  D.bb = bboxOf(D.shapes); D.place = o.place; lastState = st;
  refreshShapes(); refreshPlace(); invalidate(); refreshUndo();
}
function undo() { if (!D || job) return; recordHistory(); if (!hist.length) return; fut.push(lastState); applyState(hist.pop()); }
function redo() { if (!D || job) return; recordHistory(); if (!fut.length) return; hist.push(lastState); applyState(fut.pop()); }
function refreshUndo() { $('#bUndo').disabled = !hist.length && !(D && lastState !== null && stateOf() !== lastState); $('#bRedo').disabled = !fut.length; }
$('#bUndo').onclick = undo; $('#bRedo').onclick = redo;
$('#bRotL').onclick = () => rotateSel(90); $('#bRotR').onclick = () => rotateSel(-90);
$('#bRot').onclick = () => { const v = parseFloat(String($('#sRot').value).replace(',', '.')); if (isFinite(v) && v) rotateSel(v); };
document.addEventListener('keydown', e => {
  if (e.target.matches('input,select,textarea') || document.querySelector('dialog[open]') || !(e.ctrlKey || e.metaKey)) return;
  const k = e.key.toLowerCase();
  if (k === 'z' && !e.shiftKey) { e.preventDefault(); undo(); } else if (k === 'y' || (k === 'z' && e.shiftKey)) { e.preventDefault(); redo(); }
});

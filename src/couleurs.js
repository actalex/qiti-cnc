/* ====================== Couleurs du SVG ====================== */
// À l'import, la couleur dit l'usinage (à la manière d'Easel) : blanc = dessus du brut, noir = traversant.
//   rempli, gris -> poche, profondeur = noirceur × épaisseur (figée en mm) ; rempli noir -> poche traversante
//   contour seul, gris -> sur la ligne ; contour seul noir fermé -> découpe traversante (intérieure si dans une autre)
//   blanc ou rien -> non usiné. L'épaisseur du trait est ignorée : seule la ligne centrale compte.
// « Traversant » (sh.through) suit l'épaisseur du brut si elle change ensuite.
const depthOf = sh => sh.through ? S.stock.t : sh.depth;
// noirceur 0 (blanc) … 1 (noir) d'une peinture calculée par le navigateur, transparence comprise ; null si aucune
// inv : couleur inversée (filtre Inkscape « Inverser » sur la forme ou un groupe parent, en nombre impair)
function darkness(paint, alpha, inv) {
  const m = /^rgba?\(([^)]+)\)$/.exec(paint || ''); if (!m) return null; // none, dégradé (url(…))
  const [r, g, b, a = 1] = m[1].split(/[\s,/]+/).filter(Boolean).map(Number);
  const k = a * alpha; if (!(k > 0)) return null;
  const L = (0.299 * r + 0.587 * g + 0.114 * b) / 255; // luma : gris 127 -> 50,2 %
  return k * (inv ? L : 1 - L);
}
// filtre « Inverser » d'Inkscape (Filtres › Couleur) : matrice qui remplace chaque composante par 1 − composante
function isInvertFilter(f) {
  return !!f && [...f.querySelectorAll('feColorMatrix')].some(m => /^-1\s+0\s+0\s+0\s+1\s+0\s+-1\s+0\s+0\s+1\s+0\s+0\s+-1\s+0\s+1\b/.test((m.getAttribute('values') || '').trim()));
}
function paintOf(el, svg) {
  const cs = getComputedStyle(el); let op = 1, inv = 0, other = 0;
  for (let p = el; p && p !== svg; p = p.parentElement) {
    const pc = getComputedStyle(p); op *= parseFloat(pc.opacity) || 0;
    const id = /url\("?#([^")]+)"?\)/.exec(pc.filter || ''); if (id) { if (isInvertFilter(svg.querySelector('#' + CSS.escape(id[1])))) inv++; else other++; }
  }
  const sw = parseFloat(cs.strokeWidth), odd = inv % 2 === 1;
  return {
    fill: darkness(cs.fill, op * (parseFloat(cs.fillOpacity) || 0), odd),
    stroke: sw > 0 ? darkness(cs.stroke, op * (parseFloat(cs.strokeOpacity) || 0), odd) : null,
    gradient: /url\(/.test(cs.fill + cs.stroke), inverted: inv > 0, filtered: other > 0
  };
}
const WHITE = 0.02, BLACK = 0.98;
// proposition d'usinage par forme d'après sa couleur, pour une épaisseur de brut th
function colorPlan(shapes, th) {
  const mm = d => Math.round(d * th * 10) / 10;
  const plan = shapes.map(sh => {
    // remplissage blanc = pas de remplissage : un contour noir sur fond blanc reste une découpe
    const P = sh.paint || {}, f = sh.closed && P.fill != null && P.fill >= WHITE ? P.fill : null, s = P.stroke;
    if (f != null) return f > BLACK ? { op: 'pocket', through: true } : mm(f) > 0 ? { op: 'pocket', depth: mm(f) } : { op: 'none' };
    if (s != null && s >= WHITE) {
      if (s > BLACK) return sh.closed ? { op: 'cut', through: true } : { op: 'on', through: true };
      return mm(s) > 0 ? { op: 'on', depth: mm(s) } : { op: 'none' };
    }
    return { op: 'none' };
  });
  // découpes noires : extérieure, ou intérieure si contenue dans un nombre impair d'autres découpes (trou dans une pièce)
  const cuts = shapes.map((sh, k) => plan[k].op === 'cut' ? sh : null);
  const area = sh => { const b = bboxOf([sh]); return (b.x1 - b.x0) * (b.y1 - b.y0); };
  const inside = (a, b) => { let c = false; for (const s of a.subpaths) if (pointInPoly(b.subpaths[0].pts[0][0], b.subpaths[0].pts[0][1], s.pts)) c = !c; return c; };
  cuts.forEach((b, k) => { if (!b) return; const n = cuts.filter(a => a && a !== b && area(a) > area(b) && inside(a, b)).length; plan[k].op = n % 2 ? 'inside' : 'outside'; });
  return plan;
}
function colorSummary(shapes, plan, th) {
  const n = op => plan.filter(p => p.op === op), rng = ps => { const d = ps.filter(p => !p.through).map(p => p.depth); return d.length ? (Math.min(...d) === Math.max(...d) ? `${f3(d[0])} mm` : `${f3(Math.min(...d))} à ${f3(Math.max(...d))} mm`) : ''; };
  const L = [], cut = [...n('outside'), ...n('inside')], po = n('pocket'), on = n('on'), no = n('none');
  if (cut.length) L.push(`${cut.length} découpe(s) traversante(s) : ${n('outside').length} extérieure(s), ${n('inside').length} intérieure(s)`);
  if (po.length) { const t = po.filter(p => p.through).length; L.push(`${po.length} poche(s)` + [t ? `${t} traversante(s)` : '', rng(po)].filter(Boolean).map((x, i) => (i ? ', ' : ' : ') + x).join('')); }
  if (on.length) { const t = on.filter(p => p.through).length; L.push(`${on.length} gravure(s) sur la ligne` + [t ? `${t} traversante(s)` : '', rng(on)].filter(Boolean).map((x, i) => (i ? ', ' : ' : ') + x).join('')); }
  if (no.length) L.push(`${no.length} non usinée(s) (blanches ou sans couleur)`);
  const warn = [];
  // SVG sans couleurs voulues (logo, clipart, formes noires par défaut) : tout deviendrait traversant
  if (po.filter(p => p.through).length >= 2 && !plan.some(p => p.op !== 'none' && !p.through)) warn.push('Toutes les formes remplies sont noires : elles seraient toutes traversantes. Si ce SVG n\'a pas été colorié pour l\'atelier (logo, clipart), choisis « Ignorer les couleurs ».');
  if (shapes.some(s => s.paint && s.paint.gradient)) warn.push('Les dégradés ne sont pas interprétés (formes concernées non usinées).');
  const inv = shapes.filter(s => s.paint && s.paint.inverted).length, flt = shapes.filter(s => s.paint && s.paint.filtered).length;
  if (inv) L.push(`filtre « Inverser » d'Inkscape pris en compte sur ${inv} forme(s) : couleurs lues comme affichées`);
  if (flt) warn.push(`${flt} forme(s) ont un autre filtre Inkscape : l'atelier lit leur couleur réelle, pas leur apparence (Filtres › Retirer les filtres).`);
  return { lines: L, warn };
}
function applyColors() {
  const plan = colorPlan(D.shapes, S.stock.t);
  D.shapes.forEach((sh, k) => { const p = plan[k]; sh.op = p.op; sh.through = !!p.through; sh.depth = p.through ? S.stock.t : (p.depth || 1); });
  D.stack = true;
  log('Usinages déduits des couleurs du SVG : profondeurs modifiables forme par forme.', 'msg');
}
const hasPaint = sh => sh.paint && (sh.paint.fill != null || sh.paint.stroke != null);
// Recouvrement (couleurs appliquées) : comme à l'écran, une forme remplie posée par-dessus (plus loin dans le fichier),
// même blanche, retire sa surface des poches et remplissages en V situés dessous.
function occluders(sh, tf) {
  if (!D.stack || (sh.op !== 'pocket' && sh.op !== 'vcarve')) return [];
  const k = D.shapes.indexOf(sh), out = [];
  for (const o of D.shapes.slice(k + 1)) if (o.closed && o.paint && o.paint.fill != null) for (const s of o.subpaths) if (s.closed) out.push(toC(s.pts.map(tf)));
  return out;
}

/* ====================== Relief 3D : calcul ====================== */
// Relief depuis une image en niveaux de gris : blanc = dessus du brut, noir = profondeur max (« Inverser » : l'inverse).
// Mode à part comme le surfaçage : tant que R3D.on, le plan est l'ébauche (option : fraise plate, paliers de sa
// profondeur de passe, surépaisseur laissée) puis la finition (fraise boule, lignes en X, option lignes croisées en Y).
// Hauteur de la fraise en chaque nœud : « drop cutter », elle descend jusqu'à toucher la surface voulue sous tout son
// profil (disque plat ou boule), donc n'entaille jamais le relief ; hors de l'image, le brut reste intact (Z0).
const R3D = { on: false, img: null, cache: null }; // img : { name, w, h, g (Float32Array, 0 noir … 1 blanc), url }
const R3D_TOL = 0.003; // simplification des points alignés (mm)
function r3dParams() {
  const ball = S.tools.find(isBall), flat = S.tools.find(isFlat);
  S.r3d = Object.assign({ x: 5, y: 5, w: 60, depth: 3, invert: false, rough: true, roughTool: flat ? flat.id : '', leave: 0.3, tool: ball ? ball.id : '', step: 0.3, cross: false }, S.r3d || {});
  const P = S.r3d;
  if (!isFlat(toolById(P.roughTool) || {})) P.roughTool = flat ? flat.id : '';
  if (!isBall(toolById(P.tool) || {})) P.tool = ball ? ball.id : '';
  return P;
}
const r3dHeight = P => R3D.img ? P.w * R3D.img.h / R3D.img.w : 0;
// surface voulue sur une grille carrée (pas res), bordée de nœuds à Z0 sur le rayon rMax (brut intact autour de l'image)
function r3dTarget(P, rMax) {
  const I = R3D.img, W = P.w, H = r3dHeight(P), res = Math.max(0.1, Math.sqrt(W * H / 400000)), pad = Math.ceil(rMax / res) + 2;
  const nx = Math.floor(W / res + 1e-9) + 1, ny = Math.floor(H / res + 1e-9) + 1, px = nx + 2 * pad, Tz = new Float32Array(px * (ny + 2 * pad));
  for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) {
    const u = i * res / W * (I.w - 1), v = (1 - j * res / H) * (I.h - 1); // image : ligne 0 en haut, brut : y vers le haut
    const i0 = Math.min(I.w - 2, Math.floor(u)), j0 = Math.min(I.h - 2, Math.floor(v)), fu = u - i0, fv = v - j0, g = I.g, k = j0 * I.w + i0;
    let gr = (g[k] * (1 - fu) + g[k + 1] * fu) * (1 - fv) + (g[k + I.w] * (1 - fu) + g[k + I.w + 1] * fu) * fv;
    if (P.invert) gr = 1 - gr;
    Tz[(j + pad) * px + i + pad] = -P.depth * (1 - gr);
  }
  return { res, nx, ny, pad, px, Tz };
}
// hauteur de la fraise T posée sur la surface au nœud (i, j) : max sur son disque de (surface + relèvement du profil)
function dropper(G, T) {
  const R = T.d / 2, n = Math.ceil(R / G.res), off = [], lift = [];
  for (let b = -n; b <= n; b++) for (let a = -n; a <= n; a++) {
    const d = Math.hypot(a, b) * G.res; if (d > R + 1e-9) continue;
    off.push(b * G.px + a); lift.push(isBall(T) ? R - Math.sqrt(Math.max(0, R * R - d * d)) : 0);
  }
  const O = Int32Array.from(off), L = Float32Array.from(lift), Tz = G.Tz, cache = new Map();
  return (i, j) => {
    const c = (j + G.pad) * G.px + i + G.pad; let z = cache.get(c);
    if (z !== undefined) return z;
    z = -Infinity; for (let k = 0; k < O.length; k++) { const h = Tz[c + O[k]] - L[k]; if (h > z) z = h; }
    cache.set(c, z); return z;
  };
}
// garde un point seulement s'il s'écarte de plus de R3D_TOL du segment qui le saute
function simplify3(pts) {
  if (pts.length < 3) return pts;
  const out = [pts[0]]; let a = 0;
  const dev = (p, q, r) => { const d = [r[0] - p[0], r[1] - p[1], r[2] - p[2]], L2 = d[0] * d[0] + d[1] * d[1] + d[2] * d[2];
    const u = L2 ? ((q[0] - p[0]) * d[0] + (q[1] - p[1]) * d[1] + (q[2] - p[2]) * d[2]) / L2 : 0;
    return Math.hypot(q[0] - p[0] - u * d[0], q[1] - p[1] - u * d[1], q[2] - p[2] - u * d[2]); };
  for (let k = 2; k < pts.length; k++) {
    let ok = k - a < 400;
    for (let m = a + 1; ok && m < k; m++) if (dev(pts[a], pts[m], pts[k]) > R3D_TOL) ok = false;
    if (!ok) { out.push(pts[k - 1]); a = k - 1; }
  }
  out.push(pts[pts.length - 1]); return out;
}
// balayage d'un palier : lignes parallèles à X (axis 'x') ou à Y, tous les sn nœuds, en zigzag ; z = max(palier, drop).
// Chaque ligne est réduite à ce qui reste à couper sous zPrev (± rayon) ; ligne sans rien : sautée. Chaque ligne commence par la
// liaison depuis la fin de la précédente, au drop aussi : les coupes s'enchaînent sans remonter (point de reprise à
// chaque ligne) ; liaison de plus de 10 mm : nouvelle coupe, avec remontée.
function rasterCuts(G, P, T, drop, axis, sn, zl, zPrev, extra) {
  const ax = axis === 'x', nL = ax ? G.ny : G.nx, nA = ax ? G.nx : G.ny, ext = Math.ceil(T.d / 2 / G.res);
  const lines = []; for (let l = 0; l < nL; l += sn) lines.push(l); if (lines[lines.length - 1] !== nL - 1) lines.push(nL - 1);
  const node = (l, a) => ax ? [a, l] : [l, a], xyz = (i, j) => [P.x + i * G.res, P.y + j * G.res, Math.min(0, Math.max(zl, drop(i, j) + extra))];
  const cuts = []; let last = null, fwd = true;
  for (const l of lines) {
    let a0 = 0, a1 = nA - 1;
    { // seulement là où il reste de la matière sous le palier précédent (± rayon)
      a0 = -1; for (let a = 0; a < nA; a++) if (xyz(...node(l, a))[2] < zPrev - 1e-4) { if (a0 < 0) a0 = a; a1 = a; }
      if (a0 < 0) continue; a0 = Math.max(0, a0 - ext); a1 = Math.min(nA - 1, a1 + ext);
    }
    const seq = []; for (let a = a0; a <= a1; a++) seq.push(node(l, a)); if (!fwd) seq.reverse(); fwd = !fwd;
    const pts = [];
    if (last) {
      const [i0, j0] = last, [i1, j1] = seq[0], n = Math.max(Math.abs(i1 - i0), Math.abs(j1 - j0));
      // liaison de plus de 10 mm : rien ici, buildGcode remonte et refait une approche
      if (n * G.res <= 10) for (let s = 0; s < n; s++) pts.push(xyz(Math.round(i0 + (i1 - i0) * s / n), Math.round(j0 + (j1 - j0) * s / n)));
    }
    for (const [i, j] of seq) pts.push(xyz(i, j));
    cuts.push({ pts: simplify3(pts), zTop: 0 }); last = seq[seq.length - 1];
  }
  return cuts;
}
// étapes du relief : [{ tool, title, groups }] ; mises en cache (image, réglages, fraises)
function r3dSteps(warns) {
  const P = r3dParams(), B = toolById(P.tool), F = P.rough ? toolById(P.roughTool) : null;
  if (!R3D.img) { warns.push('Relief 3D : aucune image choisie'); return []; }
  if (!B) { warns.push('Relief 3D : aucune fraise boule (ajoute-en une, type « Boule »)'); return []; }
  const H = r3dHeight(P);
  if (P.x < -1e-6 || P.y < -1e-6 || P.x + P.w > S.stock.w + 1e-6 || P.y + H > S.stock.h + 1e-6) warns.push('Relief 3D : l\'image dépasse du brut');
  if (P.depth > S.stock.t + 1e-6) warns.push(`Relief 3D : profondeur ${P.depth} mm > épaisseur du brut`);
  if (!F && P.depth > 2 * B.doc + 1e-6) warns.push(`Relief 3D : ${Math.ceil(P.depth / B.doc)} passes à la fraise boule ; une ébauche à la fraise plate serait plus rapide`);
  const key = JSON.stringify([R3D.img.id, P, B, F]);
  if (R3D.cache && R3D.cache.key === key) return R3D.cache.steps;
  const G = r3dTarget(P, Math.max(B.d, F ? F.d : 0) / 2), steps = [];
  if (F) {
    const drop = dropper(G, F), sn = Math.max(1, Math.round(F.d * soOf(F) / G.res)), groups = []; let zPrev = 0;
    for (const zl of depthPasses(P.depth, Math.max(0.05, F.doc))) {
      const cuts = rasterCuts(G, P, F, drop, 'x', sn, zl, zPrev, P.leave);
      if (cuts.length) groups.push({ shape: { name: 'ébauche' }, tool: F, rank: 1, cuts }); zPrev = zl;
    }
    if (groups.length) steps.push({ tool: F, title: `Relief 3D — ébauche (${R3D.img.name})`, groups });
  }
  const drop = dropper(G, B), sn = Math.max(1, Math.round(P.step / G.res)), groups = [];
  const levels = F ? [-P.depth] : depthPasses(P.depth, Math.max(0.05, B.doc));
  // lignes réduites à ce qui descend sous le palier précédent (le blanc, à Z0, n'est pas balayé) ; finition seule : paliers
  let zPrev = 0;
  for (const zl of levels) { const cuts = rasterCuts(G, P, B, drop, 'x', sn, zl, zPrev, 0); if (cuts.length) groups.push({ shape: { name: 'finition X' }, tool: B, rank: 1, cuts }); zPrev = zl; }
  if (P.cross) { const cuts = rasterCuts(G, P, B, drop, 'y', sn, -P.depth, 0, 0); if (cuts.length) groups.push({ shape: { name: 'finition Y' }, tool: B, rank: 1, cuts }); }
  if (!groups.length) { warns.push('Relief 3D : image entièrement blanche, rien à usiner'); return steps; }
  steps.push({ tool: B, title: `Relief 3D — finition (${R3D.img.name})`, groups });
  R3D.cache = { key, steps };
  return steps;
}

/* ====================== FAO ====================== */
const CL = window.ClipperLib, SC = 1000;
const toC = pts => pts.map(p => ({ X: Math.round(p[0] * SC), Y: Math.round(p[1] * SC) }));
const fromC = path => path.map(p => [p.X / SC, p.Y / SC]);
function unionEO(paths) {
  const c = new CL.Clipper(); c.AddPaths(paths, CL.PolyType.ptSubject, true);
  const sol = new CL.Paths(); c.Execute(CL.ClipType.ctUnion, sol, CL.PolyFillType.pftEvenOdd, CL.PolyFillType.pftEvenOdd); return sol;
}
function offsetPaths(paths, delta) {
  if (!paths.length) return [];
  const co = new CL.ClipperOffset(2, 0.01 * SC); co.AddPaths(paths, CL.JoinType.jtRound, CL.EndType.etClosedPolygon);
  const sol = new CL.Paths(); co.Execute(sol, delta * SC);
  return sol.filter(p => p.length > 2 && Math.abs(CL.Clipper.Area(p)) > (0.01 * SC) ** 2);
}
function depthPasses(depth, doc) {
  const n = Math.max(1, Math.ceil(depth / doc - 1e-9)), r = [];
  for (let k = 1; k <= n; k++) r.push(-depth * k / n);
  return r;
}
// Fait démarrer une boucle fermée au sommet le plus proche de « at » (liaisons courtes entre anneaux)
function rotateTo(loop, at) {
  let bi = 0, bd = Infinity;
  loop.forEach((p, k) => { const d = (p[0] - at[0]) ** 2 + (p[1] - at[1]) ** 2; if (d < bd) { bd = d; bi = k; } });
  return loop.slice(bi).concat(loop.slice(0, bi));
}
function segHit(a, b, c, d) {
  const rx = b[0] - a[0], ry = b[1] - a[1], sx = d[0] - c[0], sy = d[1] - c[1], den = rx * sy - ry * sx;
  if (!den) return null;
  const qx = c[0] - a[0], qy = c[1] - a[1], t = (qx * sy - qy * sx) / den, u = (qx * ry - qy * rx) / den;
  return t >= 0 && t <= 1 && u >= 0 && u <= 1 ? t : null;
}
// Le segment [a,b] reste-t-il dans la zone (pair-impair) ? a et b peuvent être sur le bord.
function segInArea(area, a, b) {
  const L = Math.hypot(b[0] - a[0], b[1] - a[1]); if (L < 2e-3) return true;
  const mx = (a[0] + b[0]) / 2, my = (a[1] + b[1]) / 2;
  const onEdge = () => area.some(P => P.some((q, i) => segDist(mx, my, P[i ? i - 1 : P.length - 1], q) < 1e-3));
  if (!(area.filter(P => pointInPoly(mx, my, P)).length % 2) && !onEdge()) return false; // le long du bord : autorisé
  for (const P of area) for (let i = 0, j = P.length - 1; i < P.length; j = i++) {
    const t = segHit(a, b, P[j], P[i]); if (t !== null && t * L > 1e-3 && (1 - t) * L > 1e-3) return false;
  }
  return true;
}
// Parties des tracés ouverts « paths » hors des polygones « clip » (ou dedans avec ctIntersection) (Clipper, entiers)
function clipOpen(paths, clip, ct = CL.ClipType.ctDifference) {
  const c = new CL.Clipper();
  for (const p of paths) c.AddPath(p, CL.PolyType.ptSubject, false);
  c.AddPaths(clip, CL.PolyType.ptClip, true);
  const tree = new CL.PolyTree(); c.Execute(ct, tree, CL.PolyFillType.pftEvenOdd, CL.PolyFillType.pftNonZero);
  return CL.Clipper.OpenPathsFromPolyTree(tree);
}
function polyDiff(a, b) {
  const c = new CL.Clipper(); c.AddPaths(a, CL.PolyType.ptSubject, true); c.AddPaths(b, CL.PolyType.ptClip, true);
  const sol = new CL.Paths(); c.Execute(CL.ClipType.ctDifference, sol, CL.PolyFillType.pftNonZero, CL.PolyFillType.pftNonZero); return sol;
}
// Recolle les morceaux qui se suivent (une boucle est coupée à son point de départ)
function joinPieces(ps) {
  for (let i = 0; i < ps.length; i++) for (let j = 0; ps[i] && j < ps.length; j++) {
    if (i === j || !ps[j]) continue;
    const a = ps[i][ps[i].length - 1], b = ps[j][0];
    if (Math.hypot(a[0] - b[0], a[1] - b[1]) < 2e-3) { ps[i] = ps[i].concat(ps[j].slice(1)); ps[j] = null; j = -1; }
  }
  return ps.filter(Boolean);
}
const polyLen = P => { let l = 0; for (let i = 1; i < P.length; i++) l += Math.hypot(P[i][0] - P[i - 1][0], P[i][1] - P[i - 1][1]); return l; };
// Remplissage en V. À la distance o du bord, la fraise descend à (o - pointe/2) / tan(angle/2) : le flanc du V tombe
// exactement sur le contour. Pour chaque passe de profondeur L : anneaux « de pente » tous les VSTEP jusqu'à
// oL = pointe/2 + L·tan(angle/2), puis fond plat à L avec un pas adapté à la largeur du V.
// Un point d'un anneau de pente est inutile si l'anneau suivant passe à dr de lui : le cône suivant, plus profond de
// dr/tan, contient le précédent. On ne garde que les morceaux non couverts (pointes, angles, parties étroites) ;
// le dernier anneau de pente de chaque passe (celui qui forme le flanc) reste entier.
// « cleared » : zone déjà creusée à zMax par une fraise plate ; le fond plat du V ne reprend que ce qu'elle n'a pas
// atteint (coins de rayon = celui de la fraise plate).
function vcarveCuts(region, reverse, T, zMax, doc, cleared) {
  const k = Math.tan((T.angle || 60) * Math.PI / 360), tip2 = (T.tip || 0) / 2, so = Math.min(0.95, Math.max(0.05, T.so / 100));
  const cuts = []; let prev = 0, at = [0, 0], flat = false;
  const ring = o => { const ps = offsetPaths(region, -o).map(p => reverse ? p.slice().reverse() : p); return ps.length ? { o, ps, area: ps.map(fromC) } : null; };
  const emitLoops = (rg, z) => { for (const p of rg.ps) { const q = rotateTo(fromC(p), at); at = q[0]; cuts.push({ pts: loopWithTabs(q, z, null), zTop: -prev, area: rg.area }); } };
  const emitPieces = (rg, clip, z, ct) => {
    const pieces = joinPieces(clipOpen(rg.ps.map(p => p.concat([p[0]])), clip, ct).map(fromC)).filter(P => polyLen(P) > 0.01);
    while (pieces.length) {
      let bi = 0, bd = Infinity;
      pieces.forEach((P, n) => { const d = Math.hypot(P[0][0] - at[0], P[0][1] - at[1]); if (d < bd) { bd = d; bi = n; } });
      const P = pieces.splice(bi, 1)[0]; at = P[P.length - 1];
      cuts.push({ pts: P.map(q => [q[0], q[1], z]), zTop: -prev, area: rg.area });
    }
  };
  const passes = depthPasses(zMax, doc);
  passes.forEach((lv, li) => {
    const L = -lv, oL = tip2 + L * k, slope = [], flats = [];
    for (let o = tip2 + prev * k; ;) { o = Math.min(o + VSTEP, oL); const rg = ring(o); if (!rg) break; slope.push(rg); if (o >= oL - 1e-9) break; }
    if (slope.length && slope[slope.length - 1].o >= oL - 1e-9) {
      // fond dégagé à la fraise plate : le V ne reprend que les coins, au pas fin (crêtes ≤ VSTEP/2/tan)
      const fs = cleared && li === passes.length - 1 ? VSTEP : Math.max(VSTEP, cutWidth(-L, T) * so);
      for (let o = oL + fs, guard = 0; guard++ < 2000; o += fs) { const rg = ring(o); if (!rg) break; flats.push(rg); }
    }
    if (flats.length && li === passes.length - 1) flat = true;
    slope.forEach((rg, i) => {
      const z = -Math.min(L, (rg.o - tip2) / k), nx = slope[i + 1];
      if (!nx) return emitLoops(rg, z);
      emitPieces(rg, offsetPaths(nx.ps, nx.o - rg.o + 0.01), z);
    });
    if (!cleared) for (const rg of flats) emitLoops(rg, -L);
    else {
      // fond plat de la passe non dégagé (sans les filets dus aux arrondis), élargi de la demi-empreinte du V
      const left = offsetPaths(offsetPaths(polyDiff(offsetPaths(region, -oL), cleared), -0.05), 0.05);
      const keep = offsetPaths(left, cutWidth(-L, T) / 2);
      if (keep.length) for (const rg of flats) emitPieces(rg, keep, -L, CL.ClipType.ctIntersection);
    }
    prev = L;
  });
  return { cuts, flat };
}
// Entrée en rampe : allers-retours le long du début du tracé en descendant de zFrom à zTo sous l'angle S.ramp.angle,
// sans jamais passer sous le profil du tracé (attaches) ; finit au point de départ. null si le tracé est trop court.
function rampPts(pts, zFrom, zTo) {
  const L = (zFrom - zTo) / Math.tan(Math.max(0.5, S.ramp.angle) * Math.PI / 180), cum = [0];
  for (let i = 1; i < pts.length; i++) cum.push(cum[i - 1] + Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]));
  const len = cum[cum.length - 1]; if (len < 1) return null;
  const n = Math.ceil(L / (2 * len) - 1e-9), a = L / (2 * n), out = [];
  const at = s => { let i = 1; while (i < pts.length - 1 && cum[i] < s) i++; const t = (s - cum[i - 1]) / ((cum[i] - cum[i - 1]) || 1), p = pts[i - 1], q = pts[i]; return [p[0] + (q[0] - p[0]) * t, p[1] + (q[1] - p[1]) * t, Math.max(p[2], q[2])]; };
  const push = (s, d) => { const q = at(s); out.push([q[0], q[1], Math.max(zFrom - (zFrom - zTo) * Math.min(1, d / L), q[2])]); };
  for (let k = 0; k < n; k++) {
    const d0 = 2 * a * k, inner = cum.filter(c => c > 1e-9 && c < a - 1e-9);
    inner.forEach(c => push(c, d0 + c)); push(a, d0 + a);
    inner.reverse().forEach(c => push(c, d0 + 2 * a - c)); push(0, d0 + 2 * a);
  }
  return out;
}
function loopWithTabs(pts, z, tab) {
  const P = pts.concat([pts[0]]);
  if (!tab || z >= tab.z - 1e-9) return P.map(p => [p[0], p[1], z]);
  const segL = []; let L = 0;
  for (let k = 1; k < P.length; k++) { const l = Math.hypot(P[k][0] - P[k - 1][0], P[k][1] - P[k - 1][1]); segL.push(l); L += l; }
  // centres des attaches le long de la boucle : placées à la main (points projetés sur cette boucle s'ils en sont
  // assez proches) ou réparties régulièrement
  let centers = [];
  if (tab.at && tab.at.length) {
    for (const q of tab.at) {
      let best = Infinity, sb = 0, s0 = 0;
      for (let k = 1; k < P.length; k++) {
        const a = P[k - 1], b = P[k], dx = b[0] - a[0], dy = b[1] - a[1], l2 = dx * dx + dy * dy;
        const t = l2 ? Math.max(0, Math.min(1, ((q[0] - a[0]) * dx + (q[1] - a[1]) * dy) / l2)) : 0;
        const d = Math.hypot(q[0] - a[0] - t * dx, q[1] - a[1] - t * dy); if (d < best) { best = d; sb = s0 + t * segL[k - 1]; }
        s0 += segL[k - 1];
      }
      if (best <= tab.reach) centers.push(sb);
    }
  } else {
    let n = tab.n; if (L < n * tab.w * 3) n = Math.floor(L / (tab.w * 3));
    for (let k = 0; k < n; k++) centers.push((k + 0.5) * L / n);
  }
  if (!centers.length) return P.map(p => [p[0], p[1], z]);
  const iv = [];
  for (const c of centers) { // une attache à cheval sur le début de la boucle est coupée en deux morceaux
    const a = c - tab.w / 2, b = c + tab.w / 2; iv.push([Math.max(0, a), Math.min(L, b)]);
    if (a < 0) iv.push([L + a, L]); if (b > L) iv.push([0, b - L]);
  }
  const inTab = s => iv.some(([a, b]) => s > a && s < b);
  const bps = iv.flat().sort((a, b) => a - b);
  const out = [[P[0][0], P[0][1], inTab(1e-6) ? tab.z : z]]; let s = 0;
  for (let k = 1; k < P.length; k++) {
    const l = segL[k - 1], a = P[k - 1], b = P[k];
    for (const bp of bps) if (bp > s + 1e-9 && bp < s + l - 1e-9) {
      const t = (bp - s) / l, q = [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];
      out.push([q[0], q[1], inTab(bp - 1e-6) ? tab.z : z]); out.push([q[0], q[1], inTab(bp + 1e-6) ? tab.z : z]);
    }
    s += l; out.push([b[0], b[1], inTab(s - 1e-6) ? tab.z : z]);
  }
  return out;
}
const VSTEP = 0.1; // pas radial du remplissage en V (mm)
const soOf = T => Math.min(0.95, Math.max(0.05, T.so / 100));
const toolById = id => id ? S.tools.find(t => t.id === id) : null;
// Fraise d'une forme : la sienne si elle en a une, sinon la fraise courante (panneau « Fraise »)
const shapeTool = sh => toolById(sh.tool) || tool();
// Anneaux de poche depuis la zone « start » (centre de fraise), du centre vers le bord
function pocketLoops(start, T, reverse) {
  const rings = []; let cur = start, guard = 0;
  while (cur.length && guard++ < 2000) { rings.push(...cur); cur = offsetPaths(cur, -T.d * soOf(T)); }
  return rings.reverse().map(p => { const q = fromC(p); return reverse ? q.reverse() : q; });
}
function pocketCuts(loops, passes, area) {
  const cuts = []; let zPrev = 0, at = [0, 0];
  for (const z of passes) { for (const lp of loops) { const q = rotateTo(lp, at); at = q[0]; cuts.push({ pts: loopWithTabs(q, z, null), zTop: zPrev, area }); } zPrev = z; }
  return cuts;
}
// Dégagement du fond d'un remplissage en V à la fraise plate C : poche à zMax là où le V atteint zMax
// (distance au bord ≥ oMax), sans en sortir. Renvoie les passes et la zone dégagée.
function clearCuts(region, reverse, C, zMax, oMax) {
  const start = offsetPaths(region, -(oMax + C.d / 2));
  if (!start.length) return null;
  const cuts = pocketCuts(pocketLoops(start, C, reverse), depthPasses(zMax, Math.max(0.05, C.doc)), start.map(fromC));
  return { cuts, cleared: offsetPaths(start, C.d / 2) };
}
// Groupes de passes d'une forme : [{ shape, tool, rank, cuts }] (deux groupes si le fond d'un V est dégagé)
function shapeGroups(sh, res) {
  const skip = msg => { res.warns.push(msg); res.skipped.add(sh.id); return []; };
  const T = shapeTool(sh), r = T.d / 2, th = S.stock.t, depth = depthOf(sh), tf = toStockFn();
  const doc = Math.max(0.05, T.doc), order = { on: 0, pocket: 1, vcarve: 1, inside: 2, outside: 3 };
  if (depth > th + 1e-6) res.warns.push(`« ${sh.name} » : profondeur ${depth} mm > épaisseur du brut`);
  const subs = sh.subpaths.map(s => ({ closed: s.closed, pts: s.pts.map(tf) }));
  const passes = depthPasses(depth, doc), cuts = [];
  const group = (cs, tl = T, rank = order[sh.op]) => cs.length ? [{ shape: sh, tool: tl, rank, cuts: cs }] : [];
  if (isV(T) && sh.op !== 'on' && sh.op !== 'vcarve') return skip(`« ${sh.name} » ignorée : avec une fraise en V, choisir « Sur la ligne » ou « Remplissage en V »`);
  if (!isV(T) && sh.op === 'vcarve') return skip(`« ${sh.name} » ignorée : le remplissage en V demande une fraise en V`);
  if (isV(T) && sh.op === 'on' && 2 * depth * Math.tan((T.angle || 60) * Math.PI / 360) + (T.tip || 0) > T.d) res.warns.push(`« ${sh.name} » : profondeur plus grande que la partie conique de la fraise`);
  if (sh.op === 'on') {
    for (const s of subs) {
      let zPrev = 0;
      for (const z of passes) {
        const pts = s.closed ? s.pts.concat([s.pts[0]]) : s.pts;
        cuts.push({ pts: pts.map(p => [p[0], p[1], z]), zTop: zPrev }); zPrev = z;
      }
    }
    return group(cuts);
  }
  const closedSubs = subs.filter(s => s.closed);
  if (!closedSubs.length) return skip(`« ${sh.name} » est un tracé ouvert : seul « Sur la ligne » est possible`);
  const region = unionEO(closedSubs.map(s => toC(s.pts)));
  const reverse = sh.op === 'outside' ? S.climb : !S.climb;
  if (sh.op === 'vcarve') {
    const k = Math.tan((T.angle || 60) * Math.PI / 360), tip2 = (T.tip || 0) / 2;
    const zCone = (T.d / 2 - tip2) / k, zMax = Math.min(depth, zCone);
    if (depth > zCone + 1e-6) res.warns.push(`« ${sh.name} » : profondeur limitée à ${f3(zCone)} mm (partie conique de la fraise)`);
    const C = toolById(sh.clear); let cc = null;
    if (C && isV(C)) res.warns.push(`« ${sh.name} » : la fraise de dégagement doit être plate`);
    else if (C) cc = clearCuts(region, reverse, C, zMax, tip2 + zMax * k);
    const vc = vcarveCuts(region, reverse, T, zMax, doc, cc && cc.cleared);
    if (!vc.cuts.length) return skip(`« ${sh.name} » : trop étroite pour la pointe de la fraise`);
    if (vc.flat && !cc) res.warns.push(C && !isV(C) ? `« ${sh.name} » : fraise de dégagement trop grosse pour le fond plat`
      : `« ${sh.name} » : fond plat à ${f3(zMax)} mm, la pointe en V y laisse des crêtes : choisir une fraise plate dans « Dégager le fond »`);
    return (cc ? group(cc.cuts, C, 1) : []).concat(group(vc.cuts));
  }
  if (sh.op === 'pocket') {
    const start = offsetPaths(region, -r);
    if (!start.length) return skip(`« ${sh.name} » : trop étroite pour la fraise de ${T.d} mm`);
    return group(pocketCuts(pocketLoops(start, T, reverse), passes, start.map(fromC)));
  }
  const loops = offsetPaths(region, sh.op === 'outside' ? r : -r).map(p => { const q = fromC(p); return reverse ? q.reverse() : q; });
  if (!loops.length) return skip(`« ${sh.name} » : trop petite pour la fraise de ${T.d} mm`);
  const through = depth >= th - 1e-6;
  const at = (sh.tabs || []).map(tf);
  const tab = (through && S.tabs.on) ? { z: -(th - S.tabs.h), n: Math.max(1, Math.round(S.tabs.n)), w: S.tabs.w + T.d, at, reach: T.d } : null;
  for (const lp of loops) { let zPrev = 0; for (const z of passes) { cuts.push({ pts: loopWithTabs(lp, z, tab), zTop: zPrev }); zPrev = z; } }
  return group(cuts);
}
// Ordre dans une étape : gravures, poches, intérieurs, puis extérieurs ; plus proche voisin dans chaque catégorie
function orderGroups(groups) {
  const sorted = []; let at = [0, 0];
  for (let rank = 0; rank <= 3; rank++) {
    const pool = groups.filter(g => g.rank === rank);
    while (pool.length) {
      let bi = 0, bd = Infinity;
      pool.forEach((g, k) => { const p = g.cuts[0].pts[0], dd = Math.hypot(p[0] - at[0], p[1] - at[1]); if (dd < bd) { bd = dd; bi = k; } });
      const g = pool.splice(bi, 1)[0]; sorted.push(g);
      const lc = g.cuts[g.cuts.length - 1].pts; at = lc[lc.length - 1];
    }
  }
  return sorted;
}
// Étapes : le travail de chaque fraise (plates de la plus grosse à la plus fine, puis V), puis les détourages en dernier
// (une fraise qui dégage un fond et détoure fait donc deux étapes). Étapes voisines de même fraise fusionnées.
function computeCAM() {
  const res = { steps: [], warns: [], skipped: new Set() };
  if (!D) return res;
  const byKey = new Map();
  for (const sh of D.shapes) if (sh.op !== 'none' && depthOf(sh) > 0) for (const g of shapeGroups(sh, res)) {
    const out = g.rank === 3 ? 1 : 0, key = g.tool.id + (out ? ':out' : '');
    if (!byKey.has(key)) byKey.set(key, { tool: g.tool, out, groups: [] }); byKey.get(key).groups.push(g);
  }
  const sorted = [...byKey.values()].sort((a, b) => a.out - b.out || (isV(a.tool) ? 1 : 0) - (isV(b.tool) ? 1 : 0) || b.tool.d - a.tool.d);
  for (const st of sorted) {
    const prev = res.steps[res.steps.length - 1];
    if (prev && prev.tool === st.tool) prev.groups.push(...st.groups); else res.steps.push({ tool: st.tool, groups: st.groups });
  }
  res.steps.forEach(st => { st.groups = orderGroups(st.groups); });
  if (new Set(sorted.filter(st => st.out).map(st => st.tool)).size > 1) res.warns.push('Plusieurs fraises détourent des formes : les pièces peuvent se libérer avant la dernière étape (attaches conseillées)');
  return res;
}
function buildGcode(step) {
  const T = step.tool, m = S.machine, safe = m.safeZ, L = [], moves = [], lineMove = [];
  const [gx, gy] = originOff();
  let x = gx, y = gy, z = safe, F = null, time = 0, zMin = 0;
  const push = s => { L.push(s); lineMove.push(moves.length); };
  const mv = (g, nx, ny, nz, feed) => {
    const parts = [g === 0 ? 'G0' : 'G1'];
    if (Math.abs(nx - x) > 5e-4) parts.push('X' + f3(nx - gx));
    if (Math.abs(ny - y) > 5e-4) parts.push('Y' + f3(ny - gy));
    if (Math.abs(nz - z) > 5e-4) parts.push('Z' + f3(nz));
    if (parts.length === 1) return;
    const dist = Math.hypot(nx - x, ny - y, nz - z);
    if (g === 1) { if (feed !== F) { parts.push('F' + Math.round(feed)); F = feed; } time += dist / feed * 60; }
    else time += dist / m.rapid * 60;
    moves.push({ g, f: g === 1 ? feed : m.rapid, x0: x, y0: y, z0: z, x: nx, y: ny, z: nz });
    x = nx; y = ny; z = nz; if (z < zMin) zMin = z;
    push(parts.join(' '));
  };
  push(`; Atelier CNC — ${step.title || (D ? D.name : '')} — ${T.name} (Ø${T.d} mm)`);
  push(`; Brut ${S.stock.w} x ${S.stock.h} x ${S.stock.t} mm — origine X0 Y0 ${S.origin === 'center' ? 'au centre du brut' : 'au coin avant-gauche'}, Z0 dessus du brut`);
  if (isV(T)) push(`; Fraise en V ${T.angle}°, pointe ${T.tip} mm`);
  push('G21 G90 G17 G94');
  push(`G0 Z${f3(safe)}`);
  push(`M3 S${Math.round(m.spindleS)}`);
  if (m.dwell > 0) { push(`G4 P${m.dwell}`); time += m.dwell; }
  let last = null;
  for (const g of step.groups) {
    push(`; ${g.shape.name}`);
    for (const c of g.cuts) {
      const p0 = c.pts[0];
      const here = Math.hypot(p0[0] - x, p0[1] - y) < 1e-3 && z <= c.zTop + 1e-6 && z < safe;
      // liaison dans la matière si elle est sûre et plus rapide que remonter, traverser en rapide et redescendre
      // approche rapide jusqu'à 0,5 mm au-dessus du brut seulement : le fond de la passe précédente n'est pas garanti vide
      // sous chaque point (élagage, dégagement) ; en dessous, descente en G1 à la vitesse de plongée
      const dl = Math.hypot(p0[0] - x, p0[1] - y), app0 = Math.min(safe, Math.max(0, c.zTop) + 0.5);
      const tRetract = (2 * safe - z - app0 + dl) / m.rapid + Math.max(0, app0 - z) / T.plunge;
      const link = !here && last && last.g === g && last.c.area && z < safe && dl / T.feed <= tRetract && segInArea(last.c.area, [x, y], p0);
      if (link) mv(1, p0[0], p0[1], z, T.feed);
      else if (!here) {
        if (z < safe) mv(0, x, y, safe);
        mv(0, p0[0], p0[1], safe);
        if (app0 < safe) mv(0, p0[0], p0[1], app0);
      }
      if (!isV(T) && S.ramp.on && p0[2] < z - 1e-6) {
        // fraise plate : descente verticale seulement jusqu'au-dessus de la matière, puis rampe
        const z0 = Math.min(z, c.zTop); if (z0 < z - 1e-6) mv(1, p0[0], p0[1], z0, T.plunge);
        const R = p0[2] < z0 - 1e-6 && rampPts(c.pts, z0, p0[2]);
        if (R) for (const q of R) mv(1, q[0], q[1], q[2], T.feed);
      }
      mv(1, p0[0], p0[1], p0[2], p0[2] < z ? T.plunge : T.feed);
      for (let k = 1; k < c.pts.length; k++) {
        const p = c.pts[k], vert = Math.abs(p[0] - x) < 5e-4 && Math.abs(p[1] - y) < 5e-4;
        mv(1, p[0], p[1], p[2], vert && p[2] < z ? T.plunge : T.feed);
      }
      last = { g, c };
    }
  }
  if (z < safe) mv(0, x, y, safe);
  push('M5');
  mv(0, gx, gy, safe);
  push('M2');
  if (m.plan) time = planTime(moves, m.plan) + Math.max(0, m.dwell); // accélérations lues sur la carte
  return { lines: L, moves, lineMove, time, zMin, tool: T };
}


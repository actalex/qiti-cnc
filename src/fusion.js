/* ====================== Fusion des poches ====================== */
// Dessins « modulaires » (formes qui se chevauchent, ponts blancs posés dessus) : au calcul, les poches et remplissages
// en V qui se touchent et ont les mêmes réglages (usinage, profondeur, fraise, dégagement, finition) sont usinés comme une
// seule forme, sans arrondi de fraise à chaque raccord. Les formes restent séparées dans la liste (déplaçables, réglables).
// Zone d'une forme (coordonnées brut, Clipper) : pair-impair dans la forme, moins ce qui est posé dessus (recouvrement)
function shapeRegion(sh, tf) {
  const closed = sh.subpaths.filter(s => s.closed); if (!closed.length) return [];
  const region = unionEO(closed.map(s => toC(s.pts.map(tf)))), occ = occluders(sh, tf);
  return occ.length ? polyDiff(region, unionEO(occ)) : region;
}
// union découpée en morceaux disjoints : un contour extérieur et ses trous (les îlots dans un trou forment leur morceau)
function components(paths) {
  const c = new CL.Clipper(); c.AddPaths(paths, CL.PolyType.ptSubject, true);
  const tree = new CL.PolyTree(); c.Execute(CL.ClipType.ctUnion, tree, CL.PolyFillType.pftNonZero, CL.PolyFillType.pftNonZero);
  const out = [], walk = n => { for (const o of n.Childs()) { const comp = [o.Contour()]; for (const h of o.Childs()) { comp.push(h.Contour()); walk(h); } out.push(comp); } };
  walk(tree); return out;
}
// formes à usiner : les poches / V fusionnables regroupées par morceau ; une forme virtuelle porte la zone fusionnée
function mergeShapes(shapes, tf) {
  const work = [], byKey = new Map();
  for (const sh of shapes) {
    if ((sh.op !== 'pocket' && sh.op !== 'vcarve') || !sh.closed) { work.push(sh); continue; }
    const key = [sh.op, depthOf(sh), shapeTool(sh).id, sh.clear || '', !!sh.finish].join('|');
    if (!byKey.has(key)) byKey.set(key, []); byKey.get(key).push(sh);
  }
  for (const list of byKey.values()) {
    if (list.length < 2) { work.push(...list); continue; }
    const regs = list.map(sh => ({ sh, reg: shapeRegion(sh, tf) }));
    work.push(...regs.filter(x => !x.reg.length).map(x => x.sh)); // entièrement recouvertes : signalées par shapeGroups
    const live = regs.filter(x => x.reg.length);
    // chaque morceau est usiné une fois avec sa zone exacte (une forme coupée en deux par un pont blanc donne deux morceaux)
    const inComp = (pt, comp) => CL.Clipper.PointInPolygon(pt, comp[0]) !== 0 && comp.slice(1).every(h => CL.Clipper.PointInPolygon(pt, h) !== 1);
    for (const comp of components(live.flatMap(x => x.reg))) {
      const mem = live.filter(x => x.reg.some(p => inComp(p[0], comp))).map(x => x.sh), f = mem[0] || list[0];
      work.push({ ...f, name: mem.length > 1 ? `${f.name} + ${mem.length - 1} forme(s)` : f.name, subpaths: [], members: mem.map(s => s.id), _region: comp });
    }
  }
  return work;
}

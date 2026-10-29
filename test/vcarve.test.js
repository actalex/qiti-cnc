// Remplissage en V et poches : profondeurs, absence d'entaille dans le contour, liaisons sans remontée.
const assert = require('assert');
const launch = require('./navigateur');

// Rectangle 20 × 4 mm (demi-largeur 2), disque Ø 30 mm (plus large que le V), crochet en C (non convexe)
const SVG = `<svg xmlns="http://www.w3.org/2000/svg" width="100mm" height="60mm" viewBox="0 0 100 60">
  <rect id="barre" x="5" y="5" width="20" height="4"/>
  <circle id="disque" cx="55" cy="20" r="15"/>
  <path id="crochet" d="M5 25 h20 v6 h-14 v10 h14 v6 h-20 z"/>
</svg>`;

(async () => {
  const b = await launch(); const p = await b.newPage();
  const errs = []; p.on('pageerror', e => errs.push(e.message));
  await p.goto('file://' + __dirname + '/../dist/atelier-cnc.html');
  await p.evaluate(svg => { localStorage.clear(); window.__atelier.loadDesign(svg, 'vcarve.svg'); }, SVG);

  // ops : { nom: [usinage, profondeur] }, les autres formes ne sont pas usinées
  const run = (toolSel, ops, doc = 10) => p.evaluate(([toolSel, ops, doc]) => {
    const A = window.__atelier, S = A.S;
    S.toolIdx = S.tools.findIndex(t => toolSel === 'flat' ? t.type !== 'v' : (t.type === 'v' && t.angle === 60));
    const T = S.tools[S.toolIdx]; T.tip = 0; T.doc = doc;
    A.D.shapes.forEach(s => { const o = ops[s.name] || ['none', 1]; s.op = o[0]; s.depth = o[1]; });
    A.recompute();
    const cam = A.CAM, G = A.G;
    const zs = {}; for (const g of cam.groups) zs[g.shape.name] = Math.min(...g.cuts.flatMap(c => c.pts.map(q => q[2])));
    // entaille : point de coupe plus proche du contour que le rayon de coupe à cette profondeur
    const k = Math.tan((T.angle || 60) * Math.PI / 360), rad = z => T.type === 'v' ? -z * k : T.d / 2;
    const tf = toStockFn(), segs = [];
    for (const sh of A.D.shapes) if (sh.op !== 'none') for (const s of sh.subpaths) { const P = s.pts.map(tf); for (let i = 1; i < P.length; i++) segs.push([P[i - 1], P[i]]); segs.push([P[P.length - 1], P[0]]); }
    // tolérance : les arrondis des décalages sont approchés par des segments (≈ 0,01-0,02 mm sur les petits rayons)
    let gouge = 0;
    if (segs.length < 2000) for (const m of G.moves) if (m.g === 1 && m.z < 0 && m.z0 < 0) {
      const n = Math.max(1, Math.ceil(Math.hypot(m.x - m.x0, m.y - m.y0) / 0.2));
      for (let i = 0; i <= n; i++) {
        const t = i / n, x = m.x0 + (m.x - m.x0) * t, y = m.y0 + (m.y - m.y0) * t, z = m.z0 + (m.z - m.z0) * t;
        let d = Infinity; for (const [a, c] of segs) d = Math.min(d, segDist(x, y, a, c));
        gouge = Math.max(gouge, rad(z) - d);
      }
    }
    const retracts = G.moves.filter(m => m.g === 0 && m.z > m.z0).length;
    // manque : sur une grille, profondeur obtenue (cônes de tous les mouvements) vs profondeur idéale du V
    let short = 0, shortFlat = 0;
    if (T.type === 'v' && segs.length < 2000) {
      const zMax = Math.min(...A.D.shapes.filter(s => s.op === 'vcarve').map(s => s.depth), T.d / 2 / k);
      const cutsM = G.moves.filter(m => m.g === 1 && m.z < 0 && Math.abs(m.z - m.z0) < 1e-6);
      const xs = segs.flatMap(s => [s[0][0], s[1][0]]), ys = segs.flatMap(s => [s[0][1], s[1][1]]);
      for (let x = Math.min(...xs); x <= Math.max(...xs); x += 0.2) for (let y = Math.min(...ys); y <= Math.max(...ys); y += 0.2) {
        let d = Infinity; for (const [a, c] of segs) d = Math.min(d, segDist(x, y, a, c));
        const inside = A.D.shapes.some(sh => sh.op === 'vcarve' && sh.subpaths.filter(s => pointInPoly(x, y, s.pts.map(tf))).length % 2);
        if (!inside) continue;
        const ideal = Math.min(zMax, d / k);
        let got = 0; for (const m of cutsM) { got = Math.max(got, -m.z - segDist(x, y, [m.x0, m.y0], [m.x, m.y]) / k); if (got >= ideal) break; }
        if (ideal < zMax - 0.01) short = Math.max(short, ideal - got); else shortFlat = Math.max(shortFlat, ideal - got);
      }
    }
    return { zs, warns: cam.warns, skipped: [...cam.skipped], T: { d: T.d }, gouge, short, shortFlat, retracts, time: G.time };
  }, [toolSel, ops, doc]);

  // V 60°, pointe 0 : profondeur = distance au bord / tan 30°
  const k = Math.tan(Math.PI / 6);
  let r = await run('v', { barre: ['vcarve', 10], disque: ['vcarve', 1] });
  assert.deepStrictEqual(r.skipped, [], 'aucune forme ignorée');
  assert.ok(Math.abs(-r.zs.barre - 2 / k) < 0.1 / k + 1e-6, `barre : ${-r.zs.barre} mm attendu ≈ ${2 / k}`);
  assert.ok(Math.abs(-r.zs.disque - 1) < 1e-6, `disque : fond plat à 1 mm, obtenu ${-r.zs.disque}`);
  assert.ok(r.warns.some(w => w.includes('fond plat')), 'avertissement fond plat');
  console.log('V 60° :', r.zs);

  // Profondeur demandée au-delà de la partie conique : limitée
  r = await run('v', { disque: ['vcarve', 50] });
  const zCone = r.T.d / 2 / k;
  assert.ok(Math.abs(-r.zs.disque - zCone) < 1e-6, `disque limité à ${zCone}, obtenu ${-r.zs.disque}`);
  assert.ok(r.warns.some(w => w.includes('partie conique')));

  // Liaisons dans la matière (quand elles sont plus rapides qu une remontée) : aucune entaille (y compris dans le C)
  r = await run('v', { barre: ['vcarve', 10] });
  console.log(`barre en V : ${r.retracts} remontées, ${Math.round(r.time)} s`);
  assert.ok(r.gouge < 0.03, `barre en V : entaille de ${r.gouge} mm`);
  for (const [tool, op, doc] of [['v', 'vcarve', 10], ['v', 'vcarve', 0.8], ['flat', 'pocket', 1]]) {
    r = await run(tool, { crochet: [op, 2] }, doc);
    assert.ok(r.gouge < 0.03, `crochet ${op} (passe ${doc}) : entaille de ${r.gouge} mm`);
    // pente : le V doit atteindre la profondeur idéale (au plus une petite arête près de l axe médian, pas de 0,1 mm)
    assert.ok(r.short < 0.2, `crochet ${op} (passe ${doc}) : il manque ${r.short} mm dans la pente`);
    console.log(`crochet ${op}, passe ${doc} mm : ${r.retracts} remontées, entaille max ${Math.max(0, r.gouge).toFixed(3)} mm, manque pente ${r.short.toFixed(3)} / fond ${r.shortFlat.toFixed(3)} mm, ${Math.round(r.time)} s`);
  }
  r = await run('flat', { barre: ['pocket', 2], disque: ['pocket', 2] }, 1);
  assert.ok(r.gouge < 0.03, `poches : entaille de ${r.gouge} mm`);
  assert.ok(r.retracts <= 4, `poches : ${r.retracts} remontées (2 formes × 2 passes au plus)`);

  // Fraise plate + remplissage en V, fraise en V + poche : formes signalées comme ignorées
  r = await run('flat', { barre: ['vcarve', 1], disque: ['pocket', 1] });
  assert.deepStrictEqual(r.skipped, [0]);
  r = await run('v', { barre: ['pocket', 1], disque: ['on', 0.5] });
  assert.deepStrictEqual(r.skipped, [0]);

  // Changement de fraise dans l'interface : conversion proposée et acceptée
  await p.evaluate(() => { const A = window.__atelier; A.S.toolIdx = A.S.tools.findIndex(t => t.type !== 'v'); A.D.shapes[0].op = 'pocket'; A.D.shapes[1].op = 'outside'; A.D.shapes[2].op = 'none'; });
  p.once('dialog', d => d.accept());
  const vIdx = await p.evaluate(() => window.__atelier.S.tools.findIndex(t => t.type === 'v'));
  await p.selectOption('#toolSel', String(vIdx)); await p.waitForTimeout(400);
  const ops = await p.evaluate(() => window.__atelier.D.shapes.map(s => s.op));
  assert.deepStrictEqual(ops, ['vcarve', 'on', 'none']);
  const lst = await p.$$eval('#shapeList small', e => e.map(x => x.textContent));
  assert.ok(!lst.some(t => t.includes('ignorée')), 'liste sans forme ignorée : ' + lst);

  // Sauvegarde automatique : placement et usinages retrouvés après rechargement de la page
  await p.fill('#pX', '12'); await p.dispatchEvent('#pX', 'change'); await p.waitForTimeout(800);
  await p.reload(); await p.waitForTimeout(400);
  const back = await p.evaluate(() => { const D = window.__atelier.D; return D && { name: D.name, x: D.place.x, ops: D.shapes.map(s => s.op) }; });
  assert.deepStrictEqual(back, { name: 'vcarve.svg', x: 12, ops: ['vcarve', 'on', 'none'] });

  assert.deepStrictEqual(errs, []);
  console.log('vcarve : OK');
  await b.close();
})().catch(e => { console.error(e); process.exit(1); });

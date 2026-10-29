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

  // ops : { nom: [usinage, profondeur, dégagement 'flat'?] }, les autres formes ne sont pas usinées
  const run = (toolSel, ops, doc = 10) => p.evaluate(([toolSel, ops, doc]) => {
    const A = window.__atelier, S = A.S;
    S.toolIdx = S.tools.findIndex(t => toolSel === 'flat' ? t.type !== 'v' : (t.type === 'v' && t.angle === 60));
    const T = S.tools[S.toolIdx]; T.tip = 0; T.doc = doc;
    const flat = S.tools.find(t => t.type !== 'v');
    A.D.shapes.forEach(s => { const o = ops[s.name] || ['none', 1]; s.op = o[0]; s.depth = o[1]; s.tool = ''; s.clear = o[2] === 'flat' ? flat.id : ''; });
    A.recompute();
    const cam = A.CAM, PLAN = A.PLAN;
    const zs = {}; for (const st of cam.steps) for (const g of st.groups) zs[g.shape.name] = Math.min(zs[g.shape.name] ?? 0, ...g.cuts.flatMap(c => c.pts.map(q => q[2])));
    // chaque mouvement avec la fraise de son étape
    const moves = PLAN.flatMap(P => P.moves.map(m => Object.assign({ T: P.tool }, m)));
    const kOf = t => Math.tan((t.angle || 60) * Math.PI / 360), k = kOf(T);
    // entaille : point de coupe plus proche du contour que le rayon de coupe à cette profondeur
    const rad = (t, z) => t.type === 'v' ? (t.tip || 0) / 2 - z * kOf(t) : t.d / 2;
    const tf = toStockFn(), segs = [];
    for (const sh of A.D.shapes) if (sh.op !== 'none') for (const s of sh.subpaths) { const P = s.pts.map(tf); for (let i = 1; i < P.length; i++) segs.push([P[i - 1], P[i]]); segs.push([P[P.length - 1], P[0]]); }
    // tolérance : les arrondis des décalages sont approchés par des segments (≈ 0,01-0,02 mm sur les petits rayons)
    let gouge = 0;
    if (segs.length < 2000) for (const m of moves) if (m.g === 1 && m.z < 0 && m.z0 < 0) {
      const n = Math.max(1, Math.ceil(Math.hypot(m.x - m.x0, m.y - m.y0) / 0.2));
      for (let i = 0; i <= n; i++) {
        const t = i / n, x = m.x0 + (m.x - m.x0) * t, y = m.y0 + (m.y - m.y0) * t, z = m.z0 + (m.z - m.z0) * t;
        let d = Infinity; for (const [a, c] of segs) d = Math.min(d, segDist(x, y, a, c));
        gouge = Math.max(gouge, rad(m.T, z) - d);
      }
    }
    const retracts = moves.filter(m => m.g === 0 && m.z > m.z0).length;
    // manque : sur une grille, profondeur obtenue (empreinte de tous les mouvements) vs profondeur idéale du V
    let short = 0, shortFlat = 0;
    if (T.type === 'v' && segs.length < 2000) {
      const zMax = Math.min(...A.D.shapes.filter(s => s.op === 'vcarve').map(s => s.depth), T.d / 2 / k);
      const cutsM = moves.filter(m => m.g === 1 && m.z < 0 && Math.abs(m.z - m.z0) < 1e-6);
      const removed = (m, d) => m.T.type === 'v' ? -m.z - Math.max(0, d - (m.T.tip || 0) / 2) / kOf(m.T) : (d <= m.T.d / 2 + 1e-6 ? -m.z : 0);
      const xs = segs.flatMap(s => [s[0][0], s[1][0]]), ys = segs.flatMap(s => [s[0][1], s[1][1]]);
      for (let x = Math.min(...xs); x <= Math.max(...xs); x += 0.2) for (let y = Math.min(...ys); y <= Math.max(...ys); y += 0.2) {
        let d = Infinity; for (const [a, c] of segs) d = Math.min(d, segDist(x, y, a, c));
        const inside = A.D.shapes.some(sh => sh.op === 'vcarve' && sh.subpaths.filter(s => pointInPoly(x, y, s.pts.map(tf))).length % 2);
        if (!inside) continue;
        const ideal = Math.min(zMax, d / k);
        let got = 0; for (const m of cutsM) { got = Math.max(got, removed(m, segDist(x, y, [m.x0, m.y0], [m.x, m.y]))); if (got >= ideal) break; }
        if (ideal < zMax - 0.01) short = Math.max(short, ideal - got); else shortFlat = Math.max(shortFlat, ideal - got);
      }
    }
    return { zs, warns: cam.warns, skipped: [...cam.skipped], T: { d: T.d }, gouge, short, shortFlat, retracts, time: PLAN.reduce((a, P) => a + P.time, 0), steps: PLAN.map(P => (P.tool.type || 'flat') + ':' + P.tool.d) };
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

  // Estimation de durée avec accélérations : valeurs calculées à la main
  const tp = await p.evaluate(() => {
    const plan = { acc: [100, 100, 50], rate: [6000, 6000, 600], jd: 0.01 }, mv = (x0, y0, x, y, f = 600) => ({ g: 1, f, x0, y0, z0: 0, x, y, z: 0 });
    const circle = []; for (let i = 0; i < 360; i++) { const a = i * Math.PI / 180, b = (i + 1) * Math.PI / 180; circle.push(mv(50 * Math.cos(a), 50 * Math.sin(a), 50 * Math.cos(b), 50 * Math.sin(b))); }
    return { line: planTime([mv(0, 0, 100, 0)], plan), back: planTime([mv(0, 0, 100, 0), mv(100, 0, 0, 0)], plan), circle: planTime(circle, plan),
      fast: planTime([mv(0, 0, 10, 0, 6000)], plan), z: planTime([{ g: 1, f: 6000, x0: 0, y0: 0, z0: 0, x: 0, y: 0, z: -20 }], plan) };
  });
  console.log('durées :', JSON.stringify(tp));
  const near = (a, b, msg) => assert.ok(Math.abs(a - b) < 1e-3, `${msg} : ${a} au lieu de ${b}`);
  near(tp.line, 10.1, 'ligne 100 mm à 10 mm/s, 100 mm/s²');      // 2 × 0,1 s d'accélération + 99 mm à 10 mm/s
  near(tp.back, 20.2, 'aller-retour : arrêt au demi-tour');
  near(tp.fast, 2 * Math.sqrt(10 / 100), 'trop court pour 100 mm/s : profil triangle');
  near(tp.z, 20 / 10 + 10 / 50, 'Z limité à 600 mm/min et 50 mm/s²');
  assert.ok(tp.circle > 2 * Math.PI * 50 / 10 && tp.circle < 2 * Math.PI * 50 / 10 + 0.5, `cercle presque à pleine vitesse : ${tp.circle}`);

  // Entrée en rampe (fraise plate) : aucune descente dans la matière plus raide que l'angle réglé ;
  // les seules descentes verticales s'arrêtent au-dessus de la matière (0, puis le fond de la passe précédente)
  const ramp = await p.evaluate(() => {
    const A = window.__atelier, S = A.S, res = {};
    for (const on of [true, false]) {
      S.ramp = { on, angle: 3 }; A.recompute();
      const d = A.PLAN.flatMap(P => P.moves).filter(m => m.g === 1 && m.z < m.z0 - 1e-6);
      const vert = d.filter(m => Math.hypot(m.x - m.x0, m.y - m.y0) < 1e-6), slant = d.filter(m => !vert.includes(m));
      res[on] = { vertEnds: [...new Set(vert.map(m => +m.z.toFixed(3)))].sort((a, b) => b - a), steep: Math.max(0, ...slant.map(m => (m.z0 - m.z) / Math.hypot(m.x - m.x0, m.y - m.y0))), n: slant.length };
    }
    S.ramp = { on: true, angle: 3 }; return res;
  });
  console.log('rampe :', JSON.stringify(ramp));
  assert.ok(ramp.true.n > 0 && ramp.true.steep <= Math.tan(3 * Math.PI / 180) + 1e-6, 'pente des rampes');
  assert.ok(ramp.true.vertEnds.every(z => z >= -1 - 1e-6), 'descentes verticales au-dessus de la matière : ' + ramp.true.vertEnds);
  assert.ok(ramp.false.vertEnds.includes(-2), 'sans rampe : plongée verticale jusqu\'au fond');

  // Fond du V dégagé à la fraise plate : deux étapes (plate puis V), sans entaille, fond creusé
  for (const doc of [10, 0.8]) {
    const sans = await run('v', { crochet: ['vcarve', 2] }, doc);
    r = await run('v', { crochet: ['vcarve', 2, 'flat'] }, doc);
    console.log(`crochet V + dégagement, passe ${doc} mm : étapes ${r.steps}, entaille ${Math.max(0, r.gouge).toFixed(3)} mm, manque pente ${r.short.toFixed(3)} / fond ${r.shortFlat.toFixed(3)} mm, ${Math.round(r.time)} s (sans dégagement ${Math.round(sans.time)} s)`);
    assert.deepStrictEqual(r.steps.map(s => s[0]), ['f', 'v'], 'fraise plate puis V');
    assert.ok(r.gouge < 0.03, `dégagement : entaille de ${r.gouge} mm`);
    assert.ok(r.short < 0.2, `dégagement : il manque ${r.short} mm dans la pente`);
    assert.ok(r.shortFlat < sans.shortFlat / 2, `dégagement : fond ${r.shortFlat} mm (sans : ${sans.shortFlat})`);
    assert.ok(!r.warns.some(w => w.includes('crêtes')), 'plus d\'avertissement de crêtes');
  }

  // Fraise par forme : la V grave, la plate détoure ; l'étape qui détoure passe en dernier
  const st = await p.evaluate(() => {
    const A = window.__atelier, S = A.S, v = S.tools.find(t => t.type === 'v'), f = S.tools.find(t => t.type !== 'v' && t.d >= 3);
    S.toolIdx = S.tools.indexOf(f);
    A.D.shapes.forEach(s => { s.op = 'none'; s.tool = ''; s.clear = ''; });
    Object.assign(A.D.shapes[0], { op: 'on', depth: 0.5, tool: v.id });
    Object.assign(A.D.shapes[1], { op: 'outside', depth: S.stock.t });
    Object.assign(A.D.shapes[2], { op: 'pocket', depth: 1, tool: v.id }); // poche en V : ignorée
    A.recompute();
    return { steps: A.PLAN.map(P => P.tool.name), v: v.name, f: f.name, skipped: [...A.CAM.skipped], sel: !$('#stepSel').classList.contains('hide'), btn: $('#bCarve').textContent };
  });
  assert.deepStrictEqual(st.steps, [st.v, st.f]);
  assert.deepStrictEqual(st.skipped, [2]);
  assert.ok(st.sel && st.btn === 'Graver l\'étape 1', JSON.stringify(st));

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

  // Ouverture d'un projet : fraise connue par son nom (id réaffecté), fraise inconnue ajoutée
  const flatName = await p.evaluate(() => window.__atelier.S.tools.find(t => t.type !== 'v' && t.d >= 3).name);
  const proj = { app: 'atelier-cnc', v: 2, name: 'proj.svg', svg: SVG, place: { x: 0, y: 0, s: 100 },
    ops: [{ op: 'none', depth: 1 }, { op: 'vcarve', depth: 2, tool: 'idV45', clear: 'idAutrePC' }, { op: 'none', depth: 1 }],
    tool: { name: flatName, d: 3.175, feed: 600, plunge: 150, doc: 0.8, so: 40, id: 'idAutrePC' },
    tools: [{ name: 'Ma V 45°', type: 'v', d: 6, angle: 45, tip: 0.1, feed: 400, plunge: 100, doc: 0.5, so: 40, id: 'idV45' }] };
  await p.setInputFiles('#fProj', { name: 'proj.cnc.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(proj)) });
  await p.waitForTimeout(500);
  const opened = await p.evaluate(() => { const A = window.__atelier, sh = A.D.shapes[1], byId = id => A.S.tools.find(t => t.id === id);
    return { tool: byId(sh.tool) && byId(sh.tool).name, clear: byId(sh.clear) && byId(sh.clear).name, steps: A.PLAN.map(P => P.tool.name) }; });
  assert.deepStrictEqual(opened, { tool: 'Ma V 45°', clear: flatName, steps: [flatName, 'Ma V 45°'] });

  // Sauvegarde automatique : placement et usinages retrouvés après rechargement de la page
  await p.fill('#pX', '12'); await p.dispatchEvent('#pX', 'change'); await p.waitForTimeout(800);
  await p.reload(); await p.waitForTimeout(400);
  const back = await p.evaluate(() => { const D = window.__atelier.D; return D && { name: D.name, x: D.place.x, ops: D.shapes.map(s => s.op) }; });
  assert.deepStrictEqual(back, { name: 'proj.svg', x: 12, ops: ['none', 'vcarve', 'none'] });

  // Matériau : refus = rien ne change ; acceptation = avance, plongée, profondeur par passe de toutes les fraises
  const toolsOf = () => p.evaluate(() => window.__atelier.S.tools.map(t => [t.name, t.feed, t.plunge, t.doc].join('|')));
  const before = await toolsOf();
  p.once('dialog', d => d.dismiss()); await p.selectOption('#matSel', 'dur'); await p.waitForTimeout(200);
  assert.deepStrictEqual(await toolsOf(), before, 'refus : fraises inchangées');
  assert.strictEqual(await p.$eval('#matSel', e => e.value), '');
  p.once('dialog', d => d.accept()); await p.selectOption('#matSel', 'dur'); await p.waitForTimeout(200);
  const mat = await p.evaluate(() => { const T = window.__atelier.S.tools, f = n => T.find(n), pick = t => [t.feed, t.plunge, t.doc];
    return { f3: pick(f(t => t.type !== 'v' && t.d === 3.175)), f1: pick(f(t => t.type !== 'v' && t.d === 1)), f6: pick(f(t => t.type !== 'v' && t.d === 6)), v: pick(f(t => t.type === 'v')) }; });
  assert.deepStrictEqual(mat, { f3: [500, 150, 0.95], f1: [200, 60, 0.3], f6: [500, 150, 1.2], v: [500, 150, 0.6] });
  // Vitesses max de la carte connues : avances plafonnées (bois tendre : 800 → 750, plongée 250 → 200)
  await p.evaluate(() => { window.__atelier.S.machine.plan = { acc: [400, 400, 400], rate: [750, 750, 200], jd: 0.01 }; });
  p.once('dialog', d => d.accept()); await p.selectOption('#matSel', 'tendre'); await p.waitForTimeout(200);
  const cap = await p.evaluate(() => { const T = window.__atelier.S.tools, t3 = T.find(t => t.type !== 'v' && t.d === 3.175), v = T.find(t => t.type === 'v');
    return { f3: [t3.feed, t3.plunge], v: [v.feed, v.plunge], log: $('#log').innerText.includes('avance 750, plongée 200 mm/min') }; });
  assert.deepStrictEqual(cap, { f3: [750, 200], v: [700, 200], log: true });
  await p.evaluate(() => { delete window.__atelier.S.machine.plan; });

  assert.deepStrictEqual(errs, []);
  console.log('vcarve : OK');
  await b.close();
})().catch(e => { console.error(e); process.exit(1); });

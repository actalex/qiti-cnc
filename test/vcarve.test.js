// Remplissage en V : vérifie les profondeurs calculées et le comportement au changement de fraise.
const assert = require('assert');
const launch = require('./navigateur');

// Rectangle 20 × 4 mm (demi-largeur 2) et disque Ø 30 mm (rayon 15, plus large que le V)
const SVG = `<svg xmlns="http://www.w3.org/2000/svg" width="80mm" height="40mm" viewBox="0 0 80 40">
  <rect id="barre" x="5" y="5" width="20" height="4"/>
  <circle id="disque" cx="55" cy="20" r="15"/>
</svg>`;

(async () => {
  const b = await launch(); const p = await b.newPage();
  const errs = []; p.on('pageerror', e => errs.push(e.message));
  await p.goto('file://' + __dirname + '/../dist/atelier-cnc.html');
  await p.evaluate(svg => { localStorage.clear(); window.__atelier.loadDesign(svg, 'vcarve.svg'); }, SVG);

  const run = (toolSel, ops) => p.evaluate(([toolSel, ops]) => {
    const A = window.__atelier, S = A.S;
    S.toolIdx = S.tools.findIndex(t => toolSel === 'flat' ? t.type !== 'v' : (t.type === 'v' && t.angle === 60));
    const T = S.tools[S.toolIdx]; T.tip = 0; T.doc = 10;
    A.D.shapes.forEach((s, k) => { s.op = ops[k][0]; s.depth = ops[k][1]; });
    const cam = A.computeCAM();
    const zs = {}; for (const g of cam.groups) zs[g.shape.name] = Math.min(...g.cuts.flatMap(c => c.pts.map(q => q[2])));
    return { zs, warns: cam.warns, skipped: [...cam.skipped], T: { d: T.d, angle: T.angle } };
  }, [toolSel, ops]);

  // V 60°, pointe 0 : profondeur = distance au bord / tan 30°
  const k = Math.tan(Math.PI / 6);
  let r = await run('v', [['vcarve', 10], ['vcarve', 1]]);
  assert.deepStrictEqual(r.skipped, [], 'aucune forme ignorée');
  assert.ok(Math.abs(-r.zs.barre - 2 / k) < 0.1 / k + 1e-6, `barre : ${-r.zs.barre} mm attendu ≈ ${2 / k}`);
  assert.ok(Math.abs(-r.zs.disque - 1) < 1e-6, `disque : fond plat à 1 mm, obtenu ${-r.zs.disque}`);
  assert.ok(r.warns.some(w => w.includes('fond plat')), 'avertissement fond plat');
  console.log('V 60° :', r.zs);

  // Profondeur demandée au-delà de la partie conique : limitée
  r = await run('v', [['vcarve', 1], ['vcarve', 50]]);
  const zCone = r.T.d / 2 / k;
  assert.ok(Math.abs(-r.zs.disque - zCone) < 1e-6, `disque limité à ${zCone}, obtenu ${-r.zs.disque}`);
  assert.ok(r.warns.some(w => w.includes('partie conique')));

  // Fraise plate + remplissage en V, fraise en V + poche : formes signalées comme ignorées
  r = await run('flat', [['vcarve', 1], ['pocket', 1]]);
  assert.deepStrictEqual(r.skipped, [0]);
  r = await run('v', [['pocket', 1], ['on', 0.5]]);
  assert.deepStrictEqual(r.skipped, [0]);

  // Changement de fraise dans l'interface : conversion proposée et acceptée
  await p.evaluate(() => { const A = window.__atelier; A.S.toolIdx = A.S.tools.findIndex(t => t.type !== 'v'); A.D.shapes[0].op = 'pocket'; A.D.shapes[1].op = 'outside'; });
  p.once('dialog', d => d.accept());
  const vIdx = await p.evaluate(() => window.__atelier.S.tools.findIndex(t => t.type === 'v'));
  await p.selectOption('#toolSel', String(vIdx)); await p.waitForTimeout(400);
  const ops = await p.evaluate(() => window.__atelier.D.shapes.map(s => s.op));
  assert.deepStrictEqual(ops, ['vcarve', 'on']);
  const lst = await p.$$eval('#shapeList small', e => e.map(x => x.textContent));
  assert.ok(!lst.some(t => t.includes('ignorée')), 'liste sans forme ignorée : ' + lst);

  assert.deepStrictEqual(errs, []);
  console.log('vcarve : OK');
  await b.close();
})().catch(e => { console.error(e); process.exit(1); });

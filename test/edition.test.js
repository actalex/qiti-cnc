// Édition sur le plan : glisser une forme (les autres ne bougent pas, ses attaches suivent), tourner, annuler / rétablir,
// et tout retrouver après rechargement (sauvegarde automatique).
const assert = require('assert');
const launch = require('./navigateur');

const SVG = `<svg xmlns="http://www.w3.org/2000/svg" width="100mm" height="60mm" viewBox="0 0 100 60">
  <rect id="A" x="10" y="10" width="10" height="20"/>
  <rect id="B" x="40" y="10" width="30" height="10"/>
</svg>`;

(async () => {
  const b = await launch(); const p = await b.newPage({ viewport: { width: 1400, height: 860 } });
  const errs = []; p.on('pageerror', e => errs.push(e.message));
  await p.goto('file://' + __dirname + '/../dist/atelier-cnc.html');
  await p.evaluate(svg => { localStorage.clear(); const A = window.__atelier; A.S.stock.w = 120; A.S.stock.h = 80; A.loadDesign(svg, 'edition.svg'); fitView(); }, SVG);
  // encombrement de chaque forme et de ses attaches sur le brut (mm, y vers le haut)
  const boxes = () => p.evaluate(() => {
    const tf = toStockFn(), r = v => +v.toFixed(3), out = {};
    for (const s of window.__atelier.D.shapes) { const P = s.subpaths.flatMap(sp => sp.pts.map(tf)); out[s.name] = [Math.min(...P.map(q => q[0])), Math.min(...P.map(q => q[1])), Math.max(...P.map(q => q[0])), Math.max(...P.map(q => q[1]))].map(r); out[s.name + ':tabs'] = (s.tabs || []).map(q => tf(q).map(r)); }
    return out;
  });
  await p.evaluate(() => { const A = window.__atelier, a = A.D.shapes[0]; a.op = 'outside'; a.depth = A.S.stock.t; a.tabs = [[10, 20]]; A.recompute(); });
  const b0 = await boxes();
  // glisser A de +10 mm en X et +5 mm en Y (à la souris, depuis l'intérieur de A)
  const scr = (x, y) => p.evaluate(([x, y]) => { const [a, b] = W2S(x, y), r = $('#cv').getBoundingClientRect(); return [r.x + a, r.y + b]; }, [x, y]);
  const c0 = [(b0.A[0] + b0.A[2]) / 2, (b0.A[1] + b0.A[3]) / 2], from = await scr(...c0), to = await scr(c0[0] + 10, c0[1] + 5);
  await p.mouse.move(...from); await p.mouse.down(); await p.mouse.move(from[0] + 5, from[1] - 3); await p.mouse.move(...to, { steps: 5 }); await p.mouse.up();
  await p.waitForTimeout(900); // calcul FAO + sauvegarde automatique (état d'annulation)
  const b1 = await boxes(), d = (x, y) => x.map((v, k) => +(v - y[k]).toFixed(2) || 0);
  console.log('glisser :', d(b1.A, b0.A), d(b1.B, b0.B), b1['A:tabs']);
  // la souris est arrondie au pixel : tolérance d'un pixel écran
  const px = await p.evaluate(() => 1.5 / view.s);
  d(b1.A, b0.A).forEach((v, k) => assert.ok(Math.abs(v - (k % 2 ? 5 : 10)) <= px, 'A déplacée de (10, 5) : ' + d(b1.A, b0.A)));
  assert.deepStrictEqual(d(b1.B, b0.B), [0, 0, 0, 0], 'B ne bouge pas');
  assert.ok(Math.abs(b1['A:tabs'][0][0] - b0['A:tabs'][0][0] - 10) <= px, 'l\'attache suit la forme');
  assert.ok(await p.evaluate(() => window.__atelier.G.lines.length > 0));
  // annuler / rétablir (Ctrl+Z, Ctrl+Y)
  await p.keyboard.press('Control+z'); await p.waitForTimeout(900);
  assert.deepStrictEqual((await boxes()).A, b0.A, 'annuler');
  await p.keyboard.press('Control+y'); await p.waitForTimeout(900);
  assert.deepStrictEqual((await boxes()).A, b1.A, 'rétablir');
  // tourner B de 90° : largeur et hauteur échangées, centre inchangé
  await p.click('#shapeList > div:nth-child(2)'); await p.click('#bRotL'); await p.waitForTimeout(900);
  const b2 = await boxes(), w = q => +(q[2] - q[0]).toFixed(3), h = q => +(q[3] - q[1]).toFixed(3), c = q => [+((q[0] + q[2]) / 2).toFixed(3), +((q[1] + q[3]) / 2).toFixed(3)];
  console.log('tourner B :', b2.B);
  assert.deepStrictEqual([w(b2.B), h(b2.B), ...c(b2.B)], [h(b0.B), w(b0.B), ...c(b0.B)]);
  assert.deepStrictEqual(b2.A, b1.A, 'A ne bouge pas quand B tourne');
  // rechargement : tout est retrouvé
  await p.reload(); await p.waitForTimeout(600);
  const b3 = await boxes();
  assert.deepStrictEqual(b3, b2, 'retrouvé après rechargement');
  // et l'annulation repart de zéro sur ce dessin
  assert.ok(await p.evaluate(() => $('#bUndo').disabled));
  assert.deepStrictEqual(errs, []);
  console.log('edition : OK');
  await b.close();
})().catch(e => { console.error(e); process.exit(1); });

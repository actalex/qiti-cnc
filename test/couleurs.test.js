// Usinages déduits des couleurs du SVG : rempli = poche, contour seul = ligne, contour noir fermé = découpe
// (intérieure si dans une autre), blanc = rien ; profondeur = noirceur × épaisseur, figée ; noir = traversant (suit l'épaisseur).
const assert = require('assert');
const launch = require('./navigateur');

const SVG = `<svg xmlns="http://www.w3.org/2000/svg" width="140mm" height="80mm" viewBox="0 0 140 80">
  <style>.gris { fill: #7f7f7f; }</style>
  <rect id="pocheGris" x="5" y="5" width="20" height="15" fill="rgb(127,127,127)"/>
  <rect id="pocheCss" x="30" y="5" width="20" height="15" class="gris"/>
  <rect id="pocheNoire" x="55" y="5" width="20" height="15" fill="#000"/>
  <rect id="pocheTransp" x="80" y="5" width="20" height="15" fill="#000" fill-opacity="0.5"/>
  <rect id="blanc" x="105" y="5" width="20" height="15" fill="#fff" stroke="none"/>
  <path id="ligneGrise" d="M5 40 L40 45" fill="none" stroke="#808080" stroke-width="3"/>
  <rect id="piece" x="50" y="30" width="60" height="45" fill="none" stroke="#000" stroke-width="0.5"/>
  <circle id="trouPiece" cx="80" cy="52" r="8" style="fill:#ffffff;stroke:#000000"/>
  <rect id="degrade" x="115" y="40" width="20" height="15" fill="url(#g)"/>
  <defs><linearGradient id="g"><stop offset="0" stop-color="#000"/><stop offset="1" stop-color="#fff"/></linearGradient></defs>
</svg>`;

(async () => {
  const b = await launch(); const p = await b.newPage({ viewport: { width: 1400, height: 860 } });
  const errs = []; p.on('pageerror', e => errs.push(e.message));
  await p.goto('file://' + __dirname + '/../dist/atelier-cnc.html');
  await p.evaluate(() => { localStorage.clear(); });
  await p.reload(); await p.evaluate(() => { window.__atelier.S.stock.t = 6; });
  const imp = async (svg, choice) => {
    await p.setInputFiles('#fSvg', { name: 'couleurs.svg', mimeType: 'image/svg+xml', buffer: Buffer.from(svg) });
    await p.waitForSelector('#dlgColors[open]');
    const sum = await p.evaluate(() => ({ sum: $('#colSum').innerText, warn: $('#colWarn').innerText }));
    await p.click(choice); await p.waitForTimeout(400);
    return sum;
  };
  const ops = () => p.evaluate(() => Object.fromEntries(window.__atelier.D.shapes.map(s => [s.name, s.op === 'none' ? 'none' : s.op + ':' + (s.through ? 'T' : s.depth)])));
  const sum = await imp(SVG, '#colOk');
  console.log(sum.sum, '|', sum.warn);
  const o = await ops(); console.log(o);
  assert.deepStrictEqual(o, { pocheGris: 'pocket:3', pocheCss: 'pocket:3', pocheNoire: 'pocket:T', pocheTransp: 'pocket:3', blanc: 'none',
    ligneGrise: 'on:3', piece: 'outside:T', trouPiece: 'inside:T', degrade: 'none' });
  assert.ok(sum.warn.includes('dégradés'));
  assert.ok(await p.evaluate(() => [...document.querySelectorAll('#shapeList small')].some(e => e.textContent.includes('traversant'))), 'affiché « traversant »');
  // l'épaisseur change : les traversants suivent, les profondeurs figées restent
  await p.fill('#stT', '8'); await p.dispatchEvent('#stT', 'change'); await p.waitForTimeout(500);
  const z = await p.evaluate(() => { const A = window.__atelier, zmin = {};
    for (const st of A.CAM.steps) for (const g of st.groups) zmin[g.shape.name] = Math.min(zmin[g.shape.name] ?? 0, ...g.cuts.flatMap(c => c.pts.map(q => q[2])));
    return Object.fromEntries(Object.entries(zmin).map(([k, v]) => [k, +v.toFixed(3)])); });
  console.log('épaisseur 8 :', z);
  assert.strictEqual(z.pocheNoire, -8); assert.strictEqual(z.piece, -8); assert.strictEqual(z.trouPiece, -8); assert.strictEqual(z.pocheGris, -3);
  // profondeur tapée : la forme quitte « traversant » ; bouton « Traversant » : elle y revient
  await p.click('#shapeList > div:nth-child(3)'); await p.fill('#sDepth', '2'); await p.dispatchEvent('#sDepth', 'change');
  assert.strictEqual((await ops()).pocheNoire, 'pocket:2');
  await p.click('#bThrough'); assert.strictEqual((await ops()).pocheNoire, 'pocket:T');
  // persistance : « traversant » retrouvé après rechargement
  await p.waitForTimeout(700); await p.reload(); await p.waitForTimeout(500);
  assert.strictEqual((await ops()).pocheNoire, 'pocket:T');
  // tout noir (clipart) : avertissement ; « Ignorer » garde l'import habituel
  const s2 = await imp(require('fs').readFileSync(__dirname + '/exemple.svg', 'utf8'), '#colNo');
  console.log('exemple.svg :', s2.warn);
  assert.ok(s2.warn.includes('Toutes les formes remplies sont noires'));
  assert.deepStrictEqual(Object.values(await ops()).filter(v => v.startsWith('pocket')), [], 'couleurs ignorées');
  // Page = brut, filtre « Inverser », recouvrement : page 100 × 50 ; « fond » noir avec un îlot blanc et une poche grise
  // posés dessus ; « inverse » blanc + Inverser = noir affiché ; « cadreInv » contour noir dans un groupe inversé = blanc ;
  // « dehors » entièrement hors page (ignoré), « bord » à cheval (gardé)
  const SVG2 = `<svg xmlns="http://www.w3.org/2000/svg" width="100mm" height="50mm" viewBox="0 0 100 50">
    <defs><filter id="inv"><feColorMatrix type="hueRotate" values="180"/><feColorMatrix values="-1 0 0 0 1 0 -1 0 0 1 0 0 -1 0 1 -0.21 -0.72 -0.07 2 0"/></filter></defs>
    <rect id="fond" x="10" y="10" width="40" height="30" fill="#000"/>
    <rect id="ilot" x="20" y="18" width="10" height="10" fill="#fff"/>
    <rect id="grise" x="35" y="18" width="10" height="10" fill="#7f7f7f"/>
    <rect id="inverse" x="60" y="10" width="15" height="10" fill="#fff" style="filter:url(#inv)"/>
    <g style="filter:url(#inv)"><rect id="cadreInv" x="60" y="30" width="15" height="10" fill="none" stroke="#000"/></g>
    <rect id="dehors" x="10" y="80" width="10" height="10" fill="#000"/>
    <rect id="bord" x="90" y="10" width="20" height="10" fill="#7f7f7f"/>
  </svg>`;
  await p.evaluate(() => { window.__atelier.S.stock.t = 6; });
  await p.setInputFiles('#fSvg', { name: 'page.svg', mimeType: 'image/svg+xml', buffer: Buffer.from(SVG2) });
  await p.waitForSelector('#dlgColors[open]');
  const pg = await p.evaluate(() => ({ checked: $('#impPage').checked, info: $('#impPageInfo').innerText, sum: $('#colSum').innerText }));
  console.log('page :', pg);
  assert.ok(pg.checked && pg.info.includes('100 × 50 mm') && pg.info.includes('1 forme(s) hors de la page') && pg.info.includes('1 dépasse'));
  assert.ok(pg.sum.includes('« Inverser »'));
  await p.click('#colOk'); await p.waitForTimeout(600);
  const o2 = await ops(); console.log(o2);
  assert.deepStrictEqual(o2, { fond: 'pocket:T', ilot: 'none', grise: 'pocket:3', inverse: 'pocket:T', cadreInv: 'none', bord: 'pocket:3' });
  const pl = await p.evaluate(() => { const A = window.__atelier, tf = toStockFn(), f = A.D.shapes.find(s => s.name === 'fond'), P = f.subpaths[0].pts.map(tf);
    const M = heightMap(A.PLAN), h = (x, y) => +M.H[Math.floor(y / M.res) * M.nx + Math.floor(x / M.res)].toFixed(2);
    return { stock: [A.S.stock.w, A.S.stock.h], fond: [Math.min(...P.map(q => q[0])), Math.min(...P.map(q => q[1]))].map(v => +v.toFixed(3)),
      ilot: h(25, 27), autourIlot: h(15, 27), grise: h(40, 27) }; });
  console.log('page = brut, recouvrement :', pl);
  // fond : x 10, bas à 50 − 40 = 10 ; îlot (dessus, blanc) intact ; poche grise posée dessus à 3 mm au lieu de traversant
  assert.deepStrictEqual(pl, { stock: [100, 50], fond: [10, 10], ilot: 0, autourIlot: -6, grise: -3 });
  // rechargement : page et recouvrement retrouvés
  await p.waitForTimeout(700); await p.reload(); await p.waitForTimeout(600);
  assert.deepStrictEqual(Object.keys(await ops()), Object.keys(o2), 'formes hors page toujours ignorées');
  assert.strictEqual(await p.evaluate(() => { const M = heightMap(window.__atelier.PLAN); return +M.H[Math.floor(27 / M.res) * M.nx + Math.floor(25 / M.res)].toFixed(2); }), 0, 'îlot après rechargement');

  assert.deepStrictEqual(errs, []);
  console.log('couleurs : OK');
  await b.close();
})().catch(e => { console.error(e); process.exit(1); });

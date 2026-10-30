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
  assert.deepStrictEqual(errs, []);
  console.log('couleurs : OK');
  await b.close();
})().catch(e => { console.error(e); process.exit(1); });

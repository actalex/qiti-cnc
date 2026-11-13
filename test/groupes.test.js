// Groupes Inkscape dans la liste des formes : calque enveloppe retiré, groupes repliés avec résumé, un clic sur un
// groupe sélectionne ses formes (réglage appliqué à toutes), Maj + clic ajoute, groupes retrouvés après rechargement.
const assert = require('assert');
const launch = require('./navigateur');

const SVG = `<svg xmlns="http://www.w3.org/2000/svg" xmlns:inkscape="http://www.inkscape.org/namespaces/inkscape" width="120mm" height="80mm" viewBox="0 0 120 80">
  <g inkscape:groupmode="layer" inkscape:label="Calque 1" id="layer1">
    <g id="g10" inkscape:label="Nord"><rect id="n1" x="5" y="5" width="10" height="10"/><rect id="n2" x="20" y="5" width="10" height="10"/></g>
    <g id="g12"><rect id="r1" x="5" y="30" width="8" height="8"/><rect id="r2" x="20" y="30" width="8" height="8"/><g id="g13"><rect id="r3" x="35" y="30" width="8" height="8"/></g></g>
    <g id="g14" inkscape:label="Étiquette"><path id="path99" d="M60 5h20v10h-20z"/></g>
    <circle id="seul" cx="90" cy="60" r="5"/>
  </g>
</svg>`;

(async () => {
  const b = await launch(); const p = await b.newPage({ viewport: { width: 1400, height: 860 } });
  const errs = []; p.on('pageerror', e => errs.push(e.message));
  await p.goto('file://' + __dirname + '/../dist/atelier-cnc.html');
  await p.evaluate(svg => { localStorage.clear(); window.__atelier.loadDesign(svg, 'groupes.svg'); fitView(); }, SVG);
  const rows = () => p.$$eval('#shapeList > div', d => d.map(x => x.firstChild.textContent.replace(/[▸▾]\s*/, '') + ' | ' + x.lastChild.textContent));
  const r0 = await rows();
  console.log('liste :', r0);
  assert.deepStrictEqual(r0.map(r => r.split(' | ')[0]), ['Nord', 'g12', 'Étiquette', 'seul'], 'calque retiré, groupes repliés, groupe nommé gardé autour d\'une forme sans nom');
  assert.ok(r0[1].includes('3 formes'), 'g13 (une seule forme) aplati dans g12');

  // clic sur « Nord » : ses deux formes sélectionnées, le réglage s'applique aux deux
  await p.click('#shapeList > div:nth-child(1)');
  assert.deepStrictEqual(await p.evaluate(() => [...sel].sort()), [0, 1]);
  await p.selectOption('#sOp', 'pocket'); await p.fill('#sDepth', '2'); await p.dispatchEvent('#sDepth', 'change');
  await p.waitForTimeout(300);
  const nord = await p.evaluate(() => window.__atelier.D.shapes.slice(0, 2).map(s => s.op + ':' + s.depth));
  assert.deepStrictEqual(nord, ['pocket:2', 'pocket:2']);
  assert.ok((await rows())[0].endsWith('2 formes · poche · 2 mm'), 'résumé du groupe');

  // Maj + clic ajoute « Étiquette » ; dépliage de g12 puis réglage d'une seule forme → résumé « mixtes »
  await p.click('#shapeList > div:nth-child(3)', { modifiers: ['Shift'] });
  assert.strictEqual(await p.evaluate(() => sel.size), 3);
  await p.click('#shapeList > div:nth-child(2) .tog');
  const r1 = await rows();
  assert.deepStrictEqual(r1.map(r => r.split(' | ')[0]), ['Nord', 'g12', 'r1', 'r2', 'r3', 'Étiquette', 'seul'], 'g12 déplié');
  await p.click('#shapeList > div:nth-child(4)'); await p.selectOption('#sOp', 'inside');
  await p.waitForTimeout(300);
  assert.ok((await rows())[1].endsWith('3 formes · réglages mixtes'));
  assert.ok(await p.evaluate(() => $('#shapeList > div:nth-child(2)').classList.contains('part')), 'groupe partiellement sélectionné');

  // rechargement : les groupes viennent du SVG enregistré, les réglages des formes suivent
  await p.waitForTimeout(700); await p.reload(); await p.waitForTimeout(500);
  const r2 = await rows();
  assert.deepStrictEqual(r2.map(r => r.split(' | ')[0]), ['Nord', 'g12', 'Étiquette', 'seul']);
  assert.ok(r2[0].endsWith('2 formes · poche · 2 mm') && r2[1].endsWith('réglages mixtes'), 'réglages retrouvés');
  await p.screenshot({ path: __dirname + '/shot-groupes.png', clip: { x: 0, y: 0, width: 420, height: 860 } });
  assert.deepStrictEqual(errs, [], 'erreurs de page : ' + errs.join(' ; '));
  console.log('groupes : OK');
  await b.close();
})().catch(e => { console.error(e); process.exit(1); });

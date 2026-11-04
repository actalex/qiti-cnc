// Réglages retenus par matériau + fraise (S.cuts), repère du variateur rappelé avant gravure, export puis import des
// réglages dans une page vierge (comme entre la page locale et la version en ligne).
const assert = require('assert');
const fs = require('fs');
const launch = require('./navigateur');

const SVG = `<svg xmlns="http://www.w3.org/2000/svg" width="60mm" height="40mm" viewBox="0 0 60 40"><rect id="poche" x="10" y="10" width="20" height="10"/></svg>`;

(async () => {
  const b = await launch(); const p = await b.newPage({ acceptDownloads: true });
  const errs = []; p.on('pageerror', e => errs.push(e.message)); p.on('dialog', d => d.accept());
  await p.goto('file://' + __dirname + '/../dist/atelier-cnc.html');
  await p.evaluate(() => { localStorage.clear(); });
  await p.reload();
  const set = async (sel, v) => { await p.fill(sel, String(v)); await p.dispatchEvent(sel, 'change'); };
  const pick = async v => { await p.selectOption('#matSel', v); };
  const T = () => p.evaluate(() => { const t = window.__atelier.S.tools[window.__atelier.S.toolIdx]; return { id: t.id, feed: t.feed, plunge: t.plunge, doc: t.doc }; });

  // 1. contreplaqué : valeurs de départ, puis réglages de l'utilisateur retenus
  await pick('cp'); const est = await T();
  assert.ok(await p.isVisible('#rowKnob') && (await p.textContent('#cutNote')).includes('estimées'), 'valeurs de départ signalées');
  await set('#tF', 550); await set('#tP', 180); await set('#tDoc', 1.2); await set('#tKnob', '4');
  assert.ok((await p.textContent('#cutNote')).includes('Tes réglages'), 'réglages retenus signalés');
  // 2. MDF : valeurs de départ ; retour au contreplaqué : les réglages de l'utilisateur reviennent
  await pick('mdf'); const mdf = await T();
  assert.ok(mdf.feed !== 550 && (await p.inputValue('#tKnob')) === '', 'MDF : pas les réglages du contreplaqué');
  await pick('cp'); const back = await T();
  assert.deepStrictEqual([back.feed, back.plunge, back.doc], [550, 180, 1.2], 'contreplaqué : réglages de l\'utilisateur repris');
  assert.strictEqual(await p.inputValue('#tKnob'), '4', 'repère du variateur repris');
  console.log('départ CP', est, '→ retenus', back, '; MDF', mdf);
  // 3. liste de vérification : repère du variateur rappelé
  const knob = await p.evaluate(svg => { const A = window.__atelier; A.loadDesign(svg, 'r.svg'); A.D.place = { x: 0, y: 0, s: 100 }; A.recompute(); $('#bCarve').onclick(); const t = $('#cKnob').textContent; $('#dlgCarve').close(); return t; }, SVG);
  assert.ok(knob.includes('repère noté pour ce matériau : 4'), 'variateur rappelé : ' + knob);
  // 4. réglages manuels : plus rien n'est retenu
  await pick(''); await set('#tF', 777);
  assert.ok(!(await p.isVisible('#rowKnob')), 'pas de repère en réglages manuels');
  assert.strictEqual(await p.evaluate(() => window.__atelier.S.cuts.cp[window.__atelier.S.tools[window.__atelier.S.toolIdx].id].feed), 550, 'réglages manuels : contreplaqué inchangé');

  // 5. export, puis import dans une page vierge
  await p.evaluate(() => $('#bMachine').click());
  const [dl] = await Promise.all([p.waitForEvent('download'), p.click('#bSetExport')]);
  const file = __dirname + '/out-reglages.json'; await dl.saveAs(file);
  const exp = JSON.parse(fs.readFileSync(file, 'utf8'));
  assert.ok(exp.app === 'atelier-cnc-reglages' && exp.cuts.cp[back.id].knob === '4', 'export : réglages par matériau');
  await p.evaluate(() => { localStorage.clear(); }); await p.reload();
  assert.ok(!(await p.evaluate(() => Object.keys(window.__atelier.S.cuts).length)), 'page vierge');
  await p.evaluate(() => $('#bMachine').click());
  await p.setInputFiles('#fSet', file); await p.waitForFunction(() => window.__atelier.S.cuts.cp);
  await pick('cp'); const imp = await T();
  assert.deepStrictEqual([imp.feed, imp.plunge, imp.doc], [550, 180, 1.2], 'import : réglages du contreplaqué retrouvés');
  assert.strictEqual(await p.inputValue('#tKnob'), '4', 'import : repère du variateur');
  fs.unlinkSync(file);
  assert.deepStrictEqual(errs, [], 'erreurs JS : ' + errs.join(' | '));
  console.log('reglages : OK'); await b.close();
})().catch(e => { console.error(e); process.exit(1); });

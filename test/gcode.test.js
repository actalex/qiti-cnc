// G-code relu comme par la machine (état modal) : sécurité des déplacements, profondeurs, décalages des contours, attaches.
const assert = require('assert');
const launch = require('./navigateur');

// Brut 100 × 60 × 6 ; plaque 60 × 40 (extérieur traversant, attaches), trou 10 × 8 (intérieur 3 mm),
// poche 16 × 10 (2 mm), trait ouvert (sur la ligne 0,5 mm), étoile (V, fond dégagé à la plate)
const SVG = `<svg xmlns="http://www.w3.org/2000/svg" width="100mm" height="60mm" viewBox="0 0 100 60">
  <rect id="plaque" x="20" y="10" width="60" height="40"/>
  <rect id="trou" x="25" y="15" width="10" height="8"/>
  <rect id="poche" x="40" y="15" width="16" height="10"/>
  <path id="trait" d="M25 40 L45 35 L60 42" fill="none"/>
  <path id="etoile" d="M68 20 L70 26 L76 26 L71 30 L73 36 L68 32 L63 36 L65 30 L60 26 L66 26 Z"/>
</svg>`;

// Relecture d'un G-code : renvoie les mouvements avec l'état modal, et les violations de sécurité
function relire(lines, safe) {
  const st = { x: null, y: null, z: null, f: null, g: null, spindle: false }, moves = [], bad = [];
  let ended = false, shape = '';
  lines.forEach((raw, i) => {
    const l = raw.replace(/;.*$/, '').trim(); if (raw.startsWith('; ')) shape = raw.slice(2);
    if (!l) return;
    if (ended) bad.push(`ligne ${i + 1} après la fin du programme : ${l}`);
    const w = {}; for (const m of l.matchAll(/([A-Z])(-?[\d.]+)/g)) (w[m[1]] ??= []).push(+m[2]);
    for (const m of w.M || []) { if (m === 3) st.spindle = true; if (m === 5) st.spindle = false; if (m === 2 || m === 30) ended = true; }
    for (const g of w.G || []) if (g === 0 || g === 1) st.g = g;
    if (w.F) st.f = w.F[0];
    if (!(w.X || w.Y || w.Z) || (w.G || []).some(g => g === 4 || g === 10 || g === 92)) return;
    const n = { x: w.X ? w.X[0] : st.x, y: w.Y ? w.Y[0] : st.y, z: w.Z ? w.Z[0] : st.z };
    const xy = n.x !== st.x || n.y !== st.y;
    if (xy && (st.z === null || st.z < safe - 1e-6) && st.g === 0) bad.push(`ligne ${i + 1} : déplacement rapide en XY à Z=${st.z} (< ${safe})`);
    if (xy && st.z === null) bad.push(`ligne ${i + 1} : déplacement XY avant tout dégagement en Z`);
    if (st.g === 0 && n.z < 0) bad.push(`ligne ${i + 1} : rapide dans la matière (Z=${n.z})`);
    if (st.g === 1 && st.f === null) bad.push(`ligne ${i + 1} : G1 sans avance`);
    if (st.g === 1 && Math.min(n.z, st.z ?? 0) < 0 && !st.spindle) bad.push(`ligne ${i + 1} : coupe broche arrêtée`);
    moves.push({ g: st.g, f: st.f, x0: st.x, y0: st.y, z0: st.z, ...n, shape, line: i + 1 });
    Object.assign(st, n);
  });
  if (!ended) bad.push('pas de M2/M30 final');
  if (st.spindle) bad.push('broche encore allumée à la fin');
  if (st.z < safe - 1e-6) bad.push(`fin à Z=${st.z}, sous le dégagement`);
  return { moves, bad };
}

(async () => {
  const b = await launch(); const p = await b.newPage();
  const errs = []; p.on('pageerror', e => errs.push(e.message));
  await p.goto('file://' + __dirname + '/../dist/atelier-cnc.html');
  const data = await p.evaluate(svg => {
    localStorage.clear(); const A = window.__atelier, S = A.S;
    Object.assign(S.stock, { w: 100, h: 60, t: 6 }); Object.assign(S.tabs, { on: true, n: 4, w: 5, h: 1.5 }); S.origin = 'corner';
    A.loadDesign(svg, 'gcode.svg'); A.D.place = { x: 0, y: 0, s: 100 };
    const flat = S.tools.find(t => t.type !== 'v' && t.d === 3.175), v = S.tools.find(t => t.type === 'v' && t.angle === 60);
    S.toolIdx = S.tools.indexOf(flat);
    const ops = { plaque: ['outside', 6], trou: ['inside', 3], poche: ['pocket', 2], trait: ['on', 0.5], etoile: ['vcarve', 3] };
    A.D.shapes.forEach(s => { const o = ops[s.name]; s.op = o[0]; s.depth = o[1]; s.tool = s.name === 'etoile' ? v.id : flat.id; s.clear = s.name === 'etoile' ? flat.id : ''; });
    A.recompute();
    const tf = toStockFn(), bb = {};
    for (const s of A.D.shapes) { const P = s.subpaths.flatMap(sp => sp.pts.map(tf)); bb[s.name] = [Math.min(...P.map(q => q[0])), Math.min(...P.map(q => q[1])), Math.max(...P.map(q => q[0])), Math.max(...P.map(q => q[1]))]; }
    // relief (carte de hauteurs) : quelques points dont la hauteur est connue
    const M = heightMap(A.PLAN), hAt = (x, y) => M.H[Math.floor(y / M.res) * M.nx + Math.floor(x / M.res)];
    const c = n => [(bb[n][0] + bb[n][2]) / 2, (bb[n][1] + bb[n][3]) / 2], r = flat.d / 2;
    const relief = { poche: hAt(...c('poche')), trouCentre: hAt(...c('trou')), trouBord: hAt(bb.trou[0] + 0.5, c('trou')[1]),
      plaqueBord: Math.min(...Array.from({ length: 30 }, (_, k) => hAt(bb.plaque[2] + r, bb.plaque[1] + 5 + k))), brut: hAt(95, 55) };
    return { relief, safe: S.machine.safeZ, bb, flat: { d: flat.d, doc: flat.doc, feed: flat.feed, plunge: flat.plunge }, v: { doc: v.doc, feed: v.feed, plunge: v.plunge },
      steps: A.PLAN.map(P => ({ tool: P.tool.name, type: P.tool.type || 'flat', lines: P.lines })), warns: $('#warns').textContent };
  }, SVG);
  console.log('étapes :', data.steps.map(s => `${s.tool} (${s.lines.length} lignes)`), data.warns || '(aucun avertissement)');
  assert.strictEqual(data.steps.length, 3, 'plate (poche, trou, trait, dégagement), V, plate (détourage)');

  const r = data.flat.d / 2, eps = 0.02, all = {};
  for (const st of data.steps) {
    const { moves, bad } = relire(st.lines, data.safe);
    assert.deepStrictEqual(bad, [], `${st.tool} : sécurité`);
    const T = st.type === 'v' ? data.v : data.flat;
    // Avances : jamais au-dessus de celles de la fraise ; descente pure en Z dans la matière à la vitesse de plongée
    for (const m of moves) if (m.g === 1) {
      assert.ok(m.f <= T.feed + 1e-9, `ligne ${m.line} : avance ${m.f} > ${T.feed}`);
      if (m.x === m.x0 && m.y === m.y0 && m.z < m.z0 && m.z < 0) assert.ok(m.f <= T.plunge + 1e-9, `ligne ${m.line} : plongée à ${m.f}`);
    }
    // Profondeur par passe : dans une forme, jamais plus d'une passe sous le plus profond déjà coupé
    let deepest = 0, shape = '';
    for (const m of moves) {
      if (m.shape !== shape) { shape = m.shape; deepest = 0; }
      if (m.g === 1 && m.z < deepest) { assert.ok(m.z >= deepest - T.doc - 1e-6, `${shape} ligne ${m.line} : passe de ${(deepest - m.z).toFixed(3)} mm > ${T.doc}`); deepest = m.z; }
    }
    for (const m of moves) (all[m.shape] ??= []).push(m);
  }
  // Profondeurs : chaque forme à sa profondeur, jamais plus bas (traversant = épaisseur exactement)
  const zMin = n => Math.min(...all[n].map(m => m.z));
  const depths = Object.fromEntries(['plaque', 'trou', 'poche', 'trait'].map(n => [n, +(-zMin(n)).toFixed(3)]));
  console.log('profondeurs :', depths, 'étoile', -zMin('etoile'));
  assert.deepStrictEqual(depths, { plaque: 6, trou: 3, poche: 2, trait: 0.5 });
  assert.ok(-zMin('etoile') <= 3 + 1e-6);
  // Décalages : boîte des trajets au fond = forme ± rayon (extérieur +r, intérieur et poche −r, ligne = forme)
  const boxAt = (n, z) => { const P = all[n].filter(m => m.g === 1 && Math.abs(m.z - z) < 1e-6); return [Math.min(...P.map(m => m.x)), Math.min(...P.map(m => m.y)), Math.max(...P.map(m => m.x)), Math.max(...P.map(m => m.y))]; };
  const grow = (bx, d) => [bx[0] - d, bx[1] - d, bx[2] + d, bx[3] + d];
  const near = (a, e, what) => a.forEach((v, k) => assert.ok(Math.abs(v - e[k]) < eps, `${what} : ${a.map(x => x.toFixed(3))} au lieu de ${e.map(x => x.toFixed(3))}`));
  near(boxAt('plaque', -6), grow(data.bb.plaque, r), 'extérieur');
  near(boxAt('trou', -3), grow(data.bb.trou, -r), 'intérieur');
  near(boxAt('poche', -2), grow(data.bb.poche, -r), 'poche (anneau extérieur)');
  near(boxAt('trait', -0.5), data.bb.trait, 'sur la ligne');
  // Attaches : sous la hauteur d'attache, chaque passe remonte 4 fois à −(6 − 1,5) ; le pont de matière fait 5 mm,
  // donc le centre de la fraise reste en haut sur 5 + diamètre le long du trajet
  const cut = all.plaque.filter(m => m.g === 1), tabZ = -4.5, runs = []; let cur = null;
  for (const m of cut) {
    const vert = m.x === m.x0 && m.y === m.y0;
    if (vert && m.z0 < tabZ - 1e-6 && Math.abs(m.z - tabZ) < 1e-6) runs.push(cur = { L: 0 });
    else if (cur && !vert && Math.abs(m.z - tabZ) < 1e-6) cur.L += Math.hypot(m.x - m.x0, m.y - m.y0);
    else cur = null;
  }
  const passes = new Set(cut.filter(m => m.z < tabZ - 1e-6 && m.z === m.z0).map(m => m.z)).size;
  console.log(`attaches : ${runs.length} plateaux sur ${passes} passes sous l'attache,`, runs.map(t => t.L.toFixed(2)).join(' '));
  assert.strictEqual(runs.length, 4 * passes, 'plateaux par attache et par passe');
  runs.forEach(t => assert.ok(Math.abs(t.L - (5 + data.flat.d)) < 0.05, `longueur d'attache ${t.L}`));

  // Relief : poche à −2, intérieur de 3 mm = anneau le long du bord (centre intact), extérieur traversant (−6), brut intact
  const rel = Object.fromEntries(Object.entries(data.relief).map(([k, v]) => [k, +v.toFixed(2)]));
  console.log('relief :', rel);
  assert.deepStrictEqual({ poche: rel.poche, trouCentre: rel.trouCentre, trouBord: rel.trouBord, plaqueBord: rel.plaqueBord, brut: rel.brut }, { poche: -2, trouCentre: 0, trouBord: -3, plaqueBord: -6, brut: 0 });

  assert.deepStrictEqual(errs, []);
  console.log('gcode : OK');
  await b.close();
})().catch(e => { console.error(e); process.exit(1); });

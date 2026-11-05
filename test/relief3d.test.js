// Relief 3D depuis une image : G-code sûr, jamais d'entaille sous la surface voulue (fraise balayée exactement, profil
// plat ou boule), ébauche qui laisse sa surépaisseur, brut intact hors de l'image, finition proche de la surface.
const assert = require('assert');
const launch = require('./navigateur');
const relire = require('./relire');

(async () => {
  const b = await launch(); const p = await b.newPage({ viewport: { width: 1400, height: 860 } });
  const errs = []; p.on('pageerror', e => errs.push(e.message));
  await p.goto('file://' + __dirname + '/../dist/atelier-cnc.html');
  const r = await p.evaluate(async () => {
    localStorage.clear(); const A = window.__atelier, S = A.S;
    Object.assign(S.stock, { w: 70, h: 50, t: 6 }); S.origin = 'corner';
    // image 200 × 120 px : fond blanc, cuvette sphérique (centre noir), carré gris à bords vifs (marche de 1,5 mm)
    const c = document.createElement('canvas'); c.width = 200; c.height = 120; const g = c.getContext('2d');
    g.fillStyle = '#fff'; g.fillRect(0, 0, 200, 120);
    const im = g.getImageData(0, 0, 200, 120);
    for (let y = 0; y < 120; y++) for (let x = 0; x < 200; x++) {
      const d = Math.hypot(x - 60, y - 60) / 45; let v = d < 1 ? Math.sqrt(1 - d * d) : 0; // profondeur relative 0…1
      if (x >= 130 && x < 180 && y >= 35 && y < 85) v = 0.5;
      const o = 4 * (y * 200 + x); im.data[o] = im.data[o + 1] = im.data[o + 2] = Math.round(255 * (1 - v));
    }
    g.putImageData(im, 0, 0);
    await r3dLoadImage(c.toDataURL('image/png'), 'test.png');
    S.r3d = Object.assign(r3dParams(), { x: 5, y: 5, w: 50, depth: 3, invert: false, rough: true, leave: 0.3, step: 0.3, cross: true });
    const t0 = performance.now(); setR3d(true); const ms = performance.now() - t0;
    const P = S.r3d, Gd = r3dTarget(P, 0), tgt = (x, y) => { // surface voulue (interpolée), Z0 hors de l'image
      const u = (x - P.x) / Gd.res, v = (y - P.y) / Gd.res; if (u < 0 || v < 0 || u > Gd.nx - 1 || v > Gd.ny - 1) return 0;
      const i = Math.min(Gd.nx - 2, Math.floor(u)), j = Math.min(Gd.ny - 2, Math.floor(v)), fu = u - i, fv = v - j, T = Gd.Tz, w = Gd.px;
      const at = (a, b2) => T[(b2 + Gd.pad) * w + a + Gd.pad];
      return (at(i, j) * (1 - fu) + at(i + 1, j) * fu) * (1 - fv) + (at(i, j + 1) * (1 - fu) + at(i + 1, j + 1) * fu) * fv; };
    // matière restante après chaque étape : fraise balayée par pas de 0,05 mm, profil exact, grille de 0,1 mm
    const res = 0.1, nx = Math.ceil(S.stock.w / res), ny = Math.ceil(S.stock.h / res), H = new Float32Array(nx * ny), out = [];
    for (const St of A.PLAN) {
      const T = St.tool, R = T.d / 2, ball = isBall(T), n = Math.ceil(R / res);
      for (const m of St.moves) {
        if (m.g !== 1 || (m.z >= 0 && m.z0 >= 0)) continue;
        const L = Math.hypot(m.x - m.x0, m.y - m.y0, m.z - m.z0), k = Math.max(1, Math.ceil(L / 0.05));
        for (let s = 0; s <= k; s++) {
          const cx = m.x0 + (m.x - m.x0) * s / k, cy = m.y0 + (m.y - m.y0) * s / k, cz = m.z0 + (m.z - m.z0) * s / k; if (cz >= 0) continue;
          const ci = Math.round(cx / res - 0.5), cj = Math.round(cy / res - 0.5);
          for (let j = Math.max(0, cj - n); j <= Math.min(ny - 1, cj + n); j++) for (let i = Math.max(0, ci - n); i <= Math.min(nx - 1, ci + n); i++) {
            const d = Math.hypot((i + 0.5) * res - cx, (j + 0.5) * res - cy); if (d > R) continue;
            const z = ball ? cz + R - Math.sqrt(R * R - d * d) : cz, q = j * nx + i; if (z < H[q]) H[q] = z;
          }
        }
      }
      // écarts à la surface voulue : entaille (sous la surface) et reste (au-dessus), dans l'image et hors de l'image.
      // Entaille jugée avec une tolérance de position de 0,15 mm (au pied d'une marche verticale de l'image, la surface
      // n'est définie qu'aux nœuds de la grille) : la fraise ne doit pas descendre sous la surface voulue la plus basse
      // à 0,15 mm près ; sur une pente douce, cela revient à une tolérance verticale de quelques centièmes.
      const dl = [-0.15, 0, 0.15], tLo = (x, y) => Math.min(...dl.flatMap(a => dl.map(c => tgt(x + a, y + c))));
      let gouge = -Infinity, outside = 0, sum = 0, cnt = 0, bowl = 0, gAt = null, eat = -Infinity;
      for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) {
        const x = (i + 0.5) * res, y = (j + 0.5) * res, h = H[j * nx + i], t = tgt(x, y);
        const inside = x >= P.x && y >= P.y && x <= P.x + P.w && y <= P.y + r3dHeight(P);
        if (!inside) { outside = Math.min(outside, h); continue; }
        if (tLo(x, y) - h > gouge) { gouge = tLo(x, y) - h; gAt = [x.toFixed(2), y.toFixed(2), t.toFixed(3), h.toFixed(3)]; } eat = Math.max(eat, Math.min(0, tLo(x, y) + P.leave) - h); sum += h - t; cnt++;
        if (Math.hypot(x - 20, y - 20) < 6) bowl = Math.max(bowl, h - t); // fond de la cuvette (courbure douce)
      }
      out.push({ gAt, eat, tool: T.name, ball, lines: St.lines, gouge, outside, mean: sum / cnt, bowl, rows: St.resume.length, time: St.time, plunge: T.plunge, feed: T.feed });
    }
    return { ms, out, safe: S.machine.safeZ, zp: ZPOINT, warns: $('#warns').textContent, leave: P.leave, view: viewMode, bar: !$('#r3dBar').classList.contains('hide') };
  });
  console.log(`relief 3D calculé en ${r.ms.toFixed(0)} ms, point de zéro Z ${r.zp}, avertissements : ${r.warns || 'aucun'}`);
  r.out.forEach(o => console.log(`${o.tool} : ${o.lines.length} lignes, ${o.rows} points de reprise, ${fmt(o.time)}, entaille ${o.gouge.toFixed(3)}, hors image ${o.outside.toFixed(3)}, reste moyen ${o.mean.toFixed(3)}, cuvette ${o.bowl.toFixed(3)} mm, entaille max en ${o.gAt}`));
  assert.strictEqual(r.out.length, 2, 'ébauche (plate) puis finition (boule)');
  assert.ok(!r.out[0].ball && r.out[1].ball);
  assert.ok(r.zp, 'point de zéro Z entre les deux fraises');
  assert.ok(r.bar && r.view === 'relief', 'bandeau du mode et vue Relief');
  for (const o of r.out) {
    const { moves, bad } = relire(o.lines, r.safe);
    assert.deepStrictEqual(bad, [], `${o.tool} : sécurité`);
    for (const m of moves) if (m.g === 1 && m.z < m.z0 && m.z < 0) {
      const L = Math.hypot(m.x - m.x0, m.y - m.y0, m.z - m.z0);
      assert.ok(m.f * (m.z0 - m.z) / L <= o.plunge + 1e-6, `ligne ${m.line} : descente à ${(m.f * (m.z0 - m.z) / L).toFixed(0)} mm/min`);
    }
    assert.ok(Math.abs(o.outside) < 1e-6, `${o.tool} : brut entamé hors de l'image (${o.outside})`);
    assert.ok(o.rows > 20, `${o.tool} : points de reprise sur les lignes`);
  }
  // tolérance : simplification (0,003) + interpolation de la grille ; l'ébauche garde sa surépaisseur
  assert.ok(r.out[0].eat < 0.03, `ébauche : surépaisseur entamée de ${r.out[0].eat.toFixed(3)} mm`);
  assert.ok(r.out[1].gouge < 0.03, `finition : entaille de ${r.out[1].gouge.toFixed(3)} mm`);
  assert.ok(r.out[1].bowl < 0.05, `finition : ${r.out[1].bowl.toFixed(3)} mm de reste au fond de la cuvette`);
  assert.ok(r.out[1].mean < 0.1, `finition : reste moyen ${r.out[1].mean.toFixed(3)} mm`);
  await p.screenshot({ path: __dirname + '/shot-relief3d.png' });
  assert.deepStrictEqual(errs, []);
  console.log('relief 3D : OK');
  await b.close();
})().catch(e => { console.error(e); process.exit(1); });
function fmt(s) { return `${Math.floor(s / 60)} min ${Math.round(s % 60)} s`; }

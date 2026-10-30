/* ====================== Relief ====================== */
// Carte de hauteurs du brut après usinage, calculée depuis le G-code de toutes les étapes : chaque coupe balaie la
// forme réelle de sa fraise (cylindre plat, ou cône en V avec sa pointe). Puis rendu éclairé (ombrage) vu de dessus.
// Mise en cache par plan : recalculée seulement quand le G-code change.
let RELIEF = null;
function heightMap(plan) {
  const w = S.stock.w, h = S.stock.h, t = S.stock.t;
  const res = Math.max(0.05, Math.sqrt(w * h / 600000)); // ≤ 600 000 cellules
  const nx = Math.ceil(w / res), ny = Math.ceil(h / res), H = new Float32Array(nx * ny); // 0 = dessus du brut
  for (const P of plan) {
    const T = P.tool, v = isV(T), k = v ? Math.tan(T.angle * Math.PI / 360) : 0, tip = v ? (T.tip || 0) / 2 : 0, rf = T.d / 2;
    for (const m of P.moves) {
      if (m.g !== 1 || (m.z >= 0 && m.z0 >= 0)) continue;
      const dx = m.x - m.x0, dy = m.y - m.y0, dz = m.z - m.z0, L2 = dx * dx + dy * dy;
      const R = v ? Math.min(rf, tip - Math.min(m.z, m.z0) * k) : rf; // rayon de coupe au plus profond du segment
      const i0 = Math.max(0, Math.floor((Math.min(m.x, m.x0) - R) / res)), i1 = Math.min(nx - 1, Math.ceil((Math.max(m.x, m.x0) + R) / res));
      const j0 = Math.max(0, Math.floor((Math.min(m.y, m.y0) - R) / res)), j1 = Math.min(ny - 1, Math.ceil((Math.max(m.y, m.y0) + R) / res));
      for (let j = j0; j <= j1; j++) {
        const py = (j + 0.5) * res;
        for (let i = i0; i <= i1; i++) {
          const px = (i + 0.5) * res;
          let u = L2 ? ((px - m.x0) * dx + (py - m.y0) * dy) / L2 : 0; u = u < 0 ? 0 : u > 1 ? 1 : u;
          const d = Math.hypot(px - m.x0 - u * dx, py - m.y0 - u * dy); if (d > R) continue;
          const zc = m.z0 + u * dz; if (zc >= 0) continue;
          const z = v ? zc + Math.max(0, d - tip) / k : zc; // cône : remonte de 1/k par mm d'écart à l'axe
          const c = j * nx + i; if (z < H[c]) H[c] = z < -t ? -t : z;
        }
      }
    }
  }
  return { nx, ny, res, H, t };
}
function reliefImage(map) {
  const { nx, ny, res, H, t } = map, cvs = document.createElement('canvas'); cvs.width = nx; cvs.height = ny;
  const g = cvs.getContext('2d'), img = g.createImageData(nx, ny), px = img.data;
  const L = [-0.55, 0.55, 0.63], ex = 1.5 / res; // lumière en haut à gauche ; pentes exagérées pour lire les faibles reliefs
  const top = [233, 205, 160], deep = [150, 104, 58];
  for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) {
    const c = j * nx + i, z = H[c], o = ((ny - 1 - j) * nx + i) * 4; // y vers le haut
    if (z <= -t + 1e-6) { px[o + 3] = 0; continue; } // traversé : on voit la table
    const zx = (H[j * nx + Math.min(nx - 1, i + 1)] - H[j * nx + Math.max(0, i - 1)]) * ex / 2;
    const zy = (H[Math.min(ny - 1, j + 1) * nx + i] - H[Math.max(0, j - 1) * nx + i]) * ex / 2;
    const n = Math.hypot(zx, zy, 1), lum = Math.max(0, (-zx * L[0] - zy * L[1] + L[2]) / n) / L[2];
    const f = Math.min(1, -z / Math.max(0.5, t)), s = 0.35 + 0.65 * Math.min(1.25, lum);
    for (let q = 0; q < 3; q++) px[o + q] = Math.min(255, (top[q] + (deep[q] - top[q]) * f) * s);
    px[o + 3] = 255;
  }
  g.putImageData(img, 0, 0);
  return cvs;
}
function drawRelief() {
  if (!RELIEF || RELIEF.plan !== PLAN || RELIEF.w !== S.stock.w || RELIEF.h !== S.stock.h || RELIEF.t !== S.stock.t) {
    const map = heightMap(PLAN);
    RELIEF = { plan: PLAN, w: S.stock.w, h: S.stock.h, t: S.stock.t, map, img: reliefImage(map) };
  }
  const { map, img } = RELIEF, [x0, y0] = W2S(0, map.ny * map.res), [x1, y1] = W2S(map.nx * map.res, 0);
  const [sx0, sy0] = W2S(0, S.stock.h), [sx1, sy1] = W2S(S.stock.w, 0);
  ctx.fillStyle = '#6b6457'; ctx.fillRect(sx0, sy0, sx1 - sx0, sy1 - sy0); // table, visible dans les découpes traversantes
  ctx.save(); ctx.beginPath(); ctx.rect(sx0, sy0, sx1 - sx0, sy1 - sy0); ctx.clip();
  ctx.imageSmoothingEnabled = true; ctx.drawImage(img, x0, y0, x1 - x0, y1 - y0); ctx.restore();
}

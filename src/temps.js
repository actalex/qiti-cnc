/* ====================== Estimation de durée ====================== */
// Durée d'un G-code à la manière du planificateur GRBL : vitesse de jonction par déviation ($11), accélération
// ($120-$122) et vitesse max ($110-$112) par axe, ramenées à la direction du mouvement ; arrêt au début et à la fin.
// plan = { acc: [x, y, z] mm/s², rate: [x, y, z] mm/min, jd: mm } ; moves[{ g, f (mm/min), x0, y0, z0, x, y, z }].
function planTime(moves, plan) {
  const segs = [];
  for (const m of moves) {
    const d = [m.x - m.x0, m.y - m.y0, m.z - m.z0], len = Math.hypot(d[0], d[1], d[2]); if (len < 1e-9) continue;
    const u = d.map(c => c / len); let a = Infinity, v = m.f / 60;
    u.forEach((c, k) => { if (Math.abs(c) > 1e-9) { a = Math.min(a, plan.acc[k] / Math.abs(c)); if (plan.rate[k] > 0) v = Math.min(v, plan.rate[k] / 60 / Math.abs(c)); } });
    segs.push({ len, u, a, v });
  }
  const n = segs.length; if (!n) return 0;
  const vj = new Array(n + 1).fill(0); // vitesse aux jonctions (0 au départ et à l'arrivée)
  for (let i = 1; i < n; i++) {
    const p = segs[i - 1], q = segs[i], cos = -(p.u[0] * q.u[0] + p.u[1] * q.u[1] + p.u[2] * q.u[2]);
    let lim = 0;
    if (cos < -0.999999) lim = Infinity; // tout droit
    else if (cos < 0.999999) { const s = Math.sqrt(0.5 * (1 - cos)); lim = Math.sqrt(Math.min(p.a, q.a) * (plan.jd || 0.01) * s / (1 - s)); }
    vj[i] = Math.min(lim, p.v, q.v);
  }
  for (let i = n - 1; i >= 0; i--) vj[i] = Math.min(vj[i], Math.sqrt(vj[i + 1] ** 2 + 2 * segs[i].a * segs[i].len));
  for (let i = 0; i < n; i++) vj[i + 1] = Math.min(vj[i + 1], Math.sqrt(vj[i] ** 2 + 2 * segs[i].a * segs[i].len));
  let t = 0;
  segs.forEach((s, i) => {
    const v0 = vj[i], v1 = vj[i + 1], a = s.a, v = s.v, da = (v * v - v0 * v0) / (2 * a), dd = (v * v - v1 * v1) / (2 * a);
    if (da + dd <= s.len) t += (v - v0) / a + (v - v1) / a + (s.len - da - dd) / v; // trapèze
    else { const vp = Math.sqrt((2 * a * s.len + v0 * v0 + v1 * v1) / 2); t += (vp - v0) / a + (vp - v1) / a; } // triangle
  });
  return t;
}

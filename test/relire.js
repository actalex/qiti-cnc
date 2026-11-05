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
module.exports = relire;

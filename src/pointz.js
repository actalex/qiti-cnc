/* ====================== Point de zéro Z ====================== */
// Entre deux fraises, seul Z change (la fraise remonte dans son collier), mais le dessus du brut sous la fraise a pu être
// usiné. La page choisit d'office un point du dessus du brut que rien n'usine, au plus près du coin avant-gauche : chaque
// étape sauf la dernière s'y termine, à Z sûr, et le zéro Z au papier s'y fait avec chaque fraise, sur la même surface.
// Écart au trajet : rayon de coupe + rayon de la plus grosse fraise + ZP_GAP ; aux bords du brut : ZP_EDGE + ce rayon.
const ZP_GAP = 2, ZP_EDGE = 5;
let ZPOINT = null; // [x, y] en coordonnées brut, null si une seule étape ou aucun point libre
function zeroPoint(plan) {
  if (plan.length < 2) return null;
  const w = S.stock.w, h = S.stock.h, res = Math.max(0.5, Math.sqrt(w * h / 200000));
  const nx = Math.ceil(w / res), ny = Math.ceil(h / res), busy = new Uint8Array(nx * ny);
  const rMax = Math.max(...plan.map(P => P.tool.d / 2)), edge = ZP_EDGE + rMax;
  for (const P of plan) {
    const T = P.tool, v = isV(T), k = v ? Math.tan(T.angle * Math.PI / 360) : 0, tip = v ? (T.tip || 0) / 2 : 0;
    for (const m of P.moves) {
      if (m.g !== 1 || (m.z >= 0 && m.z0 >= 0)) continue; // seulement ce qui entame le brut
      const rc = v ? Math.min(T.d / 2, tip - Math.min(m.z, m.z0) * k) : T.d / 2, R = rc + rMax + ZP_GAP + res;
      const dx = m.x - m.x0, dy = m.y - m.y0, L2 = dx * dx + dy * dy;
      const i0 = Math.max(0, Math.floor((Math.min(m.x, m.x0) - R) / res)), i1 = Math.min(nx - 1, Math.ceil((Math.max(m.x, m.x0) + R) / res));
      const j0 = Math.max(0, Math.floor((Math.min(m.y, m.y0) - R) / res)), j1 = Math.min(ny - 1, Math.ceil((Math.max(m.y, m.y0) + R) / res));
      for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) {
        const px = (i + 0.5) * res, py = (j + 0.5) * res;
        let u = L2 ? ((px - m.x0) * dx + (py - m.y0) * dy) / L2 : 0; u = u < 0 ? 0 : u > 1 ? 1 : u;
        if (Math.hypot(px - m.x0 - u * dx, py - m.y0 - u * dy) <= R) busy[j * nx + i] = 1;
      }
    }
  }
  let best = null, bd = Infinity;
  for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) {
    const px = (i + 0.5) * res, py = (j + 0.5) * res;
    if (busy[j * nx + i] || px < edge || py < edge || px > w - edge || py > h - edge) continue;
    const d = Math.hypot(px, py); if (d < bd) { bd = d; best = [px, py]; }
  }
  return best;
}
function drawZPoint() {
  if (!ZPOINT || !G) return;
  const [x, y] = W2S(...ZPOINT);
  ctx.strokeStyle = '#2471a3'; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(x, y, 6, 0, 7); ctx.moveTo(x - 10, y); ctx.lineTo(x + 10, y); ctx.moveTo(x, y - 10); ctx.lineTo(x, y + 10); ctx.stroke();
  ctx.fillStyle = '#2471a3'; ctx.font = '11px system-ui'; ctx.fillText('Zéro Z', x + 9, y - 8);
}
// Aller au point (avant le zéro Z de la première fraise, ou pour le refaire) : Z sûr d'abord si le zéro Z est connu
$('#bGoZP').onclick = () => {
  if (!ZPOINT) return;
  if (!machine.zeroed.X || !machine.zeroed.Y) return log('Fais d\'abord le zéro X/Y : le point de zéro Z se repère depuis lui.', 'err');
  if (!machine.zeroed.Z && !confirm('Le zéro Z n\'est pas fait : la fraise va se déplacer à sa hauteur actuelle.\nElle est bien au-dessus du brut et des brides ?')) return;
  const [gx, gy] = originOff(), safe = S.machine.safeZ;
  const z = machine.zeroed.Z && machine.wpos && machine.wpos[2] < safe ? [`G90 G0 Z${f3(safe)}`] : [];
  sendLines([...z, `G90 G0 X${f3(ZPOINT[0] - gx)} Y${f3(ZPOINT[1] - gy)}`]);
  log('Fraise au point de zéro Z : fais le zéro Z au papier ici.', 'msg');
};

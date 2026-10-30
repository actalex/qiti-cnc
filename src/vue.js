/* ====================== Vue ====================== */
const cv = $('#cv'), ctx = cv.getContext('2d');
let view = { s: 1, ox: 0, oy: 0 }, viewMode = 'design', job = null, G = null, CAM = null, PLAN = [], stepIdx = 0; // PLAN : une étape (G-code) par fraise ; G = étape choisie
const W2S = (x, y) => [view.ox + x * view.s, view.oy - y * view.s];
const S2W = (sx, sy) => [(sx - view.ox) / view.s, (view.oy - sy) / view.s];
function resize() { const r = cv.getBoundingClientRect(), d = devicePixelRatio || 1; cv.width = r.width * d; cv.height = r.height * d; ctx.setTransform(d, 0, 0, d, 0, 0); draw(); }
function fitView() {
  const r = cv.getBoundingClientRect(); let x0 = 0, y0 = 0, x1 = S.stock.w, y1 = S.stock.h;
  if (D) { const s = D.place.s / 100; x0 = Math.min(x0, D.place.x); y0 = Math.min(y0, D.place.y); x1 = Math.max(x1, D.place.x + (D.bb.x1 - D.bb.x0) * s); y1 = Math.max(y1, D.place.y + (D.bb.y1 - D.bb.y0) * s); }
  const m = 50; view.s = Math.min((r.width - 2 * m) / (x1 - x0), (r.height - 2 * m - 40) / (y1 - y0));
  view.ox = m + (r.width - 2 * m - (x1 - x0) * view.s) / 2 - x0 * view.s;
  view.oy = r.height - m - 40 - ((r.height - 2 * m - 40) - (y1 - y0) * view.s) / 2 + y0 * view.s;
  draw();
}
const OPCOL = { outside: '#1f6feb', inside: '#8e44ad', on: '#16a085', pocket: '#d35400', vcarve: '#b7950b', none: '#999' };
function depthColor(z) {
  const t = Math.min(1, Math.max(0, -z / Math.max(0.1, S.stock.t)));
  const a = [214, 180, 128], b = [92, 54, 24];
  return `rgb(${a.map((v, k) => Math.round(v + (b[k] - v) * t)).join(',')})`;
}
function draw() {
  const r = cv.getBoundingClientRect();
  ctx.clearRect(0, 0, r.width, r.height);
  ctx.fillStyle = '#ebe7df'; ctx.fillRect(0, 0, r.width, r.height);
  // zone machine
  const [mx0, my0] = W2S(0, S.machine.h), [mx1, my1] = W2S(S.machine.w, 0);
  ctx.strokeStyle = '#cfc8bb'; ctx.setLineDash([6, 4]); ctx.strokeRect(mx0, my0, mx1 - mx0, my1 - my0); ctx.setLineDash([]);
  // brut
  const [sx0, sy0] = W2S(0, S.stock.h), [sx1, sy1] = W2S(S.stock.w, 0);
  ctx.fillStyle = '#f3e4c4'; ctx.fillRect(sx0, sy0, sx1 - sx0, sy1 - sy0);
  ctx.strokeStyle = 'rgba(0,0,0,.06)'; ctx.lineWidth = 1; ctx.beginPath();
  for (let gx = 10; gx < S.stock.w; gx += 10) { const [a] = W2S(gx, 0); ctx.moveTo(a, sy0); ctx.lineTo(a, sy1); }
  for (let gy = 10; gy < S.stock.h; gy += 10) { const [, b] = W2S(0, gy); ctx.moveTo(sx0, b); ctx.lineTo(sx1, b); }
  ctx.stroke();
  if (viewMode === 'relief' && G) drawRelief();
  ctx.strokeStyle = '#b89a66'; ctx.strokeRect(sx0, sy0, sx1 - sx0, sy1 - sy0);
  // origine
  const [ox, oy] = W2S(...originOff());
  ctx.lineWidth = 2; ctx.strokeStyle = '#c0392b'; ctx.beginPath(); ctx.moveTo(ox, oy); ctx.lineTo(ox + 30, oy); ctx.stroke();
  ctx.strokeStyle = '#27ae60'; ctx.beginPath(); ctx.moveTo(ox, oy); ctx.lineTo(ox, oy - 30); ctx.stroke();
  ctx.fillStyle = '#22201c'; ctx.font = '11px system-ui'; ctx.fillText('X0 Y0', ox + 4, oy + 14);
  if (G && (viewMode === 'carve' || viewMode === 'paths')) drawMoves();
  if (D && viewMode !== 'carve' && !(viewMode === 'relief' && G)) drawShapes(viewMode === 'paths' ? 0.35 : 1);
  if (job && G) drawProgress();
  if (machine.wpos) {
    const [tx, ty] = W2S(machine.wpos[0] + originOff()[0], machine.wpos[1] + originOff()[1]);
    ctx.strokeStyle = '#c0392b'; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(tx, ty, 7, 0, 7); ctx.moveTo(tx - 11, ty); ctx.lineTo(tx + 11, ty); ctx.moveTo(tx, ty - 11); ctx.lineTo(tx, ty + 11); ctx.stroke();
  }
}
function drawShapes(alpha) {
  const tf = toStockFn(); ctx.globalAlpha = alpha; ctx.lineJoin = 'round';
  for (const sh of D.shapes) {
    const isSel = sel.has(sh.id);
    ctx.beginPath();
    for (const s of sh.subpaths) { s.pts.forEach((p, k) => { const [a, b] = W2S(...tf(p)); k ? ctx.lineTo(a, b) : ctx.moveTo(a, b); }); if (s.closed) ctx.closePath(); }
    if (sh.op === 'pocket') { ctx.fillStyle = 'rgba(211,84,0,.18)'; ctx.fill('evenodd'); }
    if (sh.op === 'vcarve') { ctx.fillStyle = 'rgba(183,149,11,.18)'; ctx.fill('evenodd'); }
    ctx.lineWidth = isSel ? 2.5 : 1.3; ctx.strokeStyle = isSel ? '#e74c3c' : OPCOL[sh.op]; ctx.setLineDash(sh.op === 'none' ? [4, 3] : []); ctx.stroke();
  }
  ctx.setLineDash([]); ctx.globalAlpha = 1;
  drawTabMarkers();
}
function drawMoves() {
  if (viewMode === 'carve') {
    ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    for (const P of PLAN) {
      const buckets = new Map();
      for (const m of P.moves) if (m.g === 1 && (m.z < 0 || m.z0 < 0)) { const zz = Math.round(Math.min(m.z, m.z0) * 100) / 100; if (!buckets.has(zz)) buckets.set(zz, []); buckets.get(zz).push(m); }
      for (const k of [...buckets.keys()].sort((a, b) => b - a)) {
        ctx.lineWidth = Math.max(1, cutWidth(k, P.tool) * view.s);
        ctx.strokeStyle = depthColor(k); ctx.beginPath();
        for (const m of buckets.get(k)) { const [a, b] = W2S(m.x0, m.y0), [c, d] = W2S(m.x, m.y); ctx.moveTo(a, b); ctx.lineTo(c + 0.01, d); }
        ctx.stroke();
      }
    }
    ctx.lineCap = 'butt';
  } else {
    const all = PLAN.flatMap(P => P.moves);
    ctx.lineWidth = 1;
    ctx.setLineDash([3, 3]); ctx.strokeStyle = 'rgba(120,120,120,.6)'; ctx.beginPath();
    for (const m of all) if (m.g === 0) { const [a, b] = W2S(m.x0, m.y0), [c, d] = W2S(m.x, m.y); ctx.moveTo(a, b); ctx.lineTo(c, d); }
    ctx.stroke(); ctx.setLineDash([]);
    let last = null;
    for (const m of all) if (m.g === 1) {
      const col = depthColor(Math.min(m.z, m.z0)); if (col !== last) { if (last) ctx.stroke(); ctx.strokeStyle = col; ctx.beginPath(); last = col; }
      const [a, b] = W2S(m.x0, m.y0), [c, d] = W2S(m.x, m.y); ctx.moveTo(a, b); ctx.lineTo(c, d);
    }
    if (last) ctx.stroke();
  }
}
function drawProgress() {
  const upto = G.lineMove[Math.min(job.acked, G.lineMove.length - 1)] || 0;
  ctx.strokeStyle = 'rgba(46,139,87,.9)'; ctx.lineWidth = 2; ctx.beginPath();
  for (let k = 0; k < upto; k++) { const m = G.moves[k]; if (m.g !== 1) continue; const [a, b] = W2S(m.x0, m.y0), [c, d] = W2S(m.x, m.y); ctx.moveTo(a, b); ctx.lineTo(c, d); }
  ctx.stroke();
}
// interactions
let drag = null;
cv.addEventListener('mousedown', e => { drag = { x: e.offsetX, y: e.offsetY, ox: view.ox, oy: view.oy, moved: false }; });
window.addEventListener('mousemove', e => {
  if (!drag) return; const r = cv.getBoundingClientRect(), dx = e.clientX - r.left - drag.x, dy = e.clientY - r.top - drag.y;
  if (Math.abs(dx) + Math.abs(dy) > 3) drag.moved = true;
  if (drag.moved) { view.ox = drag.ox + dx; view.oy = drag.oy + dy; cv.style.cursor = 'grabbing'; draw(); }
});
window.addEventListener('mouseup', e => {
  if (!drag) return; const d = drag; drag = null; cv.style.cursor = tabEdit !== null ? 'copy' : 'crosshair';
  if (!d.moved && e.target === cv) { if (tabEdit !== null) tabClick(e.offsetX, e.offsetY); else pick(e.offsetX, e.offsetY, e.shiftKey || e.ctrlKey || e.metaKey); }
});
cv.addEventListener('wheel', e => {
  e.preventDefault(); const k = Math.exp(-e.deltaY * 0.0015), [wx, wy] = S2W(e.offsetX, e.offsetY);
  view.s *= k; view.ox = e.offsetX - wx * view.s; view.oy = e.offsetY + wy * view.s; draw();
}, { passive: false });
function pointInPoly(x, y, pts) { let c = false; for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) { const [xi, yi] = pts[i], [xj, yj] = pts[j]; if ((yi > y) !== (yj > y) && x < (xj - xi) * (y - yi) / (yj - yi) + xi) c = !c; } return c; }
function segDist(px, py, a, b) { const dx = b[0] - a[0], dy = b[1] - a[1], l = dx * dx + dy * dy; let t = l ? ((px - a[0]) * dx + (py - a[1]) * dy) / l : 0; t = Math.max(0, Math.min(1, t)); return Math.hypot(px - a[0] - t * dx, py - a[1] - t * dy); }
function pick(sx, sy, add) {
  if (!D) return;
  const [x, y] = S2W(sx, sy), tf = toStockFn(), tolW = 6 / view.s; let hit = null, best = Infinity;
  for (const sh of D.shapes) {
    const subs = sh.subpaths.map(s => ({ closed: s.closed, pts: s.pts.map(tf) }));
    let dmin = Infinity;
    for (const s of subs) { const n = s.pts.length; for (let k = 1; k < n + (s.closed ? 1 : 0); k++) dmin = Math.min(dmin, segDist(x, y, s.pts[k - 1], s.pts[k % n])); }
    let inside = false; for (const s of subs) if (s.closed && pointInPoly(x, y, s.pts)) inside = !inside;
    const score = dmin < tolW ? dmin : (inside ? tolW + 1 : Infinity);
    if (score < best) { best = score; hit = sh; }
  }
  if (!add) sel.clear();
  if (hit) { if (add && sel.has(hit.id)) sel.delete(hit.id); else sel.add(hit.id); }
  refreshShapes(); draw();
}


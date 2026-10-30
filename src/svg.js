/* ====================== Import SVG ====================== */
const UNIT = { mm: 1, cm: 10, in: 25.4, pt: 25.4 / 72, pc: 25.4 / 6, px: 25.4 / 96, q: 0.25 };
function parseLength(v) {
  if (v == null) return null;
  const m = /^\s*([+-]?(?:\d+\.?\d*|\.\d+)(?:e[+-]?\d+)?)\s*(mm|cm|in|pt|pc|px|q)?\s*$/i.exec(v);
  if (!m) return null;
  return parseFloat(m[1]) * UNIT[(m[2] || 'px').toLowerCase()];
}
function matMul(A, B) {
  return [A[0] * B[0] + A[2] * B[1], A[1] * B[0] + A[3] * B[1], A[0] * B[2] + A[2] * B[3], A[1] * B[2] + A[3] * B[3],
    A[0] * B[4] + A[2] * B[5] + A[4], A[1] * B[4] + A[3] * B[5] + A[5]];
}
function cubicPts(p0, p1, p2, p3, tol, out) {
  const M = Math.max(Math.hypot(p0[0] - 2 * p1[0] + p2[0], p0[1] - 2 * p1[1] + p2[1]), Math.hypot(p1[0] - 2 * p2[0] + p3[0], p1[1] - 2 * p2[1] + p3[1]));
  const n = Math.max(1, Math.min(500, Math.ceil(Math.sqrt(0.75 * M / tol))));
  for (let k = 1; k <= n; k++) {
    const t = k / n, u = 1 - t;
    out.push([u * u * u * p0[0] + 3 * u * u * t * p1[0] + 3 * u * t * t * p2[0] + t * t * t * p3[0],
      u * u * u * p0[1] + 3 * u * u * t * p1[1] + 3 * u * t * t * p2[1] + t * t * t * p3[1]]);
  }
}
function quadPts(p0, p1, p2, tol, out) {
  const M = Math.hypot(p0[0] - 2 * p1[0] + p2[0], p0[1] - 2 * p1[1] + p2[1]);
  const n = Math.max(1, Math.min(500, Math.ceil(Math.sqrt(M / (4 * tol)))));
  for (let k = 1; k <= n; k++) {
    const t = k / n, u = 1 - t;
    out.push([u * u * p0[0] + 2 * u * t * p1[0] + t * t * p2[0], u * u * p0[1] + 2 * u * t * p1[1] + t * t * p2[1]]);
  }
}
function arcPts(x1, y1, rx, ry, phi, fa, fs, x2, y2, tol, out) {
  if (x1 === x2 && y1 === y2) return;
  rx = Math.abs(rx); ry = Math.abs(ry);
  if (!rx || !ry) { out.push([x2, y2]); return; }
  const cp = Math.cos(phi * Math.PI / 180), sp = Math.sin(phi * Math.PI / 180);
  const dx = (x1 - x2) / 2, dy = (y1 - y2) / 2;
  const x1p = cp * dx + sp * dy, y1p = -sp * dx + cp * dy;
  const lam = x1p * x1p / (rx * rx) + y1p * y1p / (ry * ry);
  if (lam > 1) { const s = Math.sqrt(lam); rx *= s; ry *= s; }
  const nu = rx * rx * ry * ry - rx * rx * y1p * y1p - ry * ry * x1p * x1p, de = rx * rx * y1p * y1p + ry * ry * x1p * x1p;
  let co = Math.sqrt(Math.max(0, nu / de)); if (fa === fs) co = -co;
  const cxp = co * rx * y1p / ry, cyp = -co * ry * x1p / rx;
  const cx = cp * cxp - sp * cyp + (x1 + x2) / 2, cy = sp * cxp + cp * cyp + (y1 + y2) / 2;
  const ang = (ux, uy, vx, vy) => Math.atan2(ux * vy - uy * vx, ux * vx + uy * vy);
  const t1 = ang(1, 0, (x1p - cxp) / rx, (y1p - cyp) / ry);
  let dt = ang((x1p - cxp) / rx, (y1p - cyp) / ry, (-x1p - cxp) / rx, (-y1p - cyp) / ry);
  if (!fs && dt > 0) dt -= 2 * Math.PI; else if (fs && dt < 0) dt += 2 * Math.PI;
  const r = Math.max(rx, ry), step = 2 * Math.acos(1 - Math.min(tol, r * 0.5) / r) || 0.2;
  const n = Math.max(2, Math.min(720, Math.ceil(Math.abs(dt) / step)));
  for (let k = 1; k < n; k++) {
    const t = t1 + dt * k / n, ex = rx * Math.cos(t), ey = ry * Math.sin(t);
    out.push([cp * ex - sp * ey + cx, sp * ex + cp * ey + cy]);
  }
  out.push([x2, y2]);
}
function parsePathD(d, tol) {
  let i = 0; const n = d.length;
  const ws = () => { while (i < n && /[\s,]/.test(d[i])) i++; };
  const re = /[+-]?(?:\d+\.?\d*|\.\d+)(?:[eE][+-]?\d+)?/y;
  const rd = () => { ws(); re.lastIndex = i; const m = re.exec(d); if (!m) throw new Error('chemin SVG illisible près de « ' + d.slice(i, i + 12) + ' »'); i = re.lastIndex; return parseFloat(m[0]); };
  const flag = () => { ws(); const c = d[i]; if (c !== '0' && c !== '1') throw new Error('drapeau d\'arc invalide'); i++; return c === '1'; };
  const subs = []; let cur = null, x = 0, y = 0, x0 = 0, y0 = 0, cmd = null, prev = null, lc = null, lq = null;
  const begin = () => { if (!cur || cur.closed) { cur = { pts: [[x, y]], closed: false }; subs.push(cur); } };
  while (true) {
    ws(); if (i >= n) break;
    const c = d[i];
    if (/[A-Za-z]/.test(c)) { cmd = c; i++; } else if (!cmd) throw new Error('chemin SVG invalide');
    const rel = cmd === cmd.toLowerCase(), C = cmd.toUpperCase();
    const ox = rel ? x : 0, oy = rel ? y : 0;
    switch (C) {
      case 'M': x = ox + rd(); y = oy + rd(); cur = { pts: [[x, y]], closed: false }; subs.push(cur); x0 = x; y0 = y; cmd = rel ? 'l' : 'L'; break;
      case 'L': { const nx = ox + rd(), ny = oy + rd(); begin(); x = nx; y = ny; cur.pts.push([x, y]); break; }
      case 'H': { const nx = ox + rd(); begin(); x = nx; cur.pts.push([x, y]); break; }
      case 'V': { const ny = oy + rd(); begin(); y = ny; cur.pts.push([x, y]); break; }
      case 'C': { const a = [ox + rd(), oy + rd()], b = [ox + rd(), oy + rd()], e = [ox + rd(), oy + rd()]; begin(); cubicPts([x, y], a, b, e, tol, cur.pts); lc = b; x = e[0]; y = e[1]; break; }
      case 'S': { const b = [ox + rd(), oy + rd()], e = [ox + rd(), oy + rd()]; const a = (prev && 'CS'.includes(prev)) ? [2 * x - lc[0], 2 * y - lc[1]] : [x, y]; begin(); cubicPts([x, y], a, b, e, tol, cur.pts); lc = b; x = e[0]; y = e[1]; break; }
      case 'Q': { const a = [ox + rd(), oy + rd()], e = [ox + rd(), oy + rd()]; begin(); quadPts([x, y], a, e, tol, cur.pts); lq = a; x = e[0]; y = e[1]; break; }
      case 'T': { const e = [ox + rd(), oy + rd()]; const a = (prev && 'QT'.includes(prev)) ? [2 * x - lq[0], 2 * y - lq[1]] : [x, y]; begin(); quadPts([x, y], a, e, tol, cur.pts); lq = a; x = e[0]; y = e[1]; break; }
      case 'A': { const rx = rd(), ry = rd(), ph = rd(), fa = flag(), fs = flag(), ex = ox + rd(), ey = oy + rd(); begin(); arcPts(x, y, rx, ry, ph, fa, fs, ex, ey, tol, cur.pts); x = ex; y = ey; break; }
      case 'Z': if (cur) cur.closed = true; x = x0; y = y0; break;
      default: throw new Error('commande de chemin inconnue : ' + cmd);
    }
    prev = C;
  }
  return subs;
}
function elementSubpaths(el, tol) {
  const tag = el.tagName.toLowerCase(), g = a => { const v = el[a]; return v && v.baseVal ? v.baseVal.value : parseFloat(el.getAttribute(a)) || 0; };
  if (tag === 'path') return parsePathD(el.getAttribute('d') || '', tol);
  if (tag === 'rect') {
    const x = g('x'), y = g('y'), w = g('width'), h = g('height');
    if (w <= 0 || h <= 0) return [];
    let rx = parseFloat(el.getAttribute('rx')), ry = parseFloat(el.getAttribute('ry'));
    if (!isFinite(rx) && isFinite(ry)) rx = ry; if (!isFinite(ry) && isFinite(rx)) ry = rx;
    rx = Math.min(rx || 0, w / 2); ry = Math.min(ry || 0, h / 2);
    if (!rx || !ry) return [{ pts: [[x, y], [x + w, y], [x + w, y + h], [x, y + h]], closed: true }];
    return parsePathD(`M${x + rx},${y}H${x + w - rx}A${rx},${ry} 0 0 1 ${x + w},${y + ry}V${y + h - ry}A${rx},${ry} 0 0 1 ${x + w - rx},${y + h}H${x + rx}A${rx},${ry} 0 0 1 ${x},${y + h - ry}V${y + ry}A${rx},${ry} 0 0 1 ${x + rx},${y}Z`, tol);
  }
  if (tag === 'circle' || tag === 'ellipse') {
    const cx = g('cx'), cy = g('cy'); let rx, ry;
    if (tag === 'circle') rx = ry = g('r'); else { rx = g('rx'); ry = g('ry'); }
    if (rx <= 0 || ry <= 0) return [];
    return parsePathD(`M${cx + rx},${cy}A${rx},${ry} 0 1 1 ${cx - rx},${cy}A${rx},${ry} 0 1 1 ${cx + rx},${cy}Z`, tol);
  }
  if (tag === 'line') return [{ pts: [[g('x1'), g('y1')], [g('x2'), g('y2')]], closed: false }];
  if (tag === 'polyline' || tag === 'polygon') {
    const v = (el.getAttribute('points') || '').trim().split(/[\s,]+/).map(Number), pts = [];
    for (let k = 0; k + 1 < v.length; k += 2) pts.push([v[k], v[k + 1]]);
    return [{ pts, closed: tag === 'polygon' }];
  }
  return [];
}
function importSVG(text, name) {
  const doc = new DOMParser().parseFromString(text, 'image/svg+xml');
  const root = doc.documentElement;
  if (doc.querySelector('parsererror') || root.nodeName.toLowerCase() !== 'svg') throw new Error('Ce fichier n\'est pas un SVG valide.');
  const host = document.createElement('div');
  host.style.cssText = 'position:absolute;left:-20000px;top:0;width:10px;height:10px;overflow:hidden;visibility:hidden';
  const svg = document.importNode(root, true); host.appendChild(svg); document.body.appendChild(host);
  const warns = [];
  try {
    let vb = null; const va = svg.getAttribute('viewBox');
    if (va) { const a = va.trim().split(/[\s,]+/).map(Number); if (a.length === 4 && a.every(isFinite) && a[2] > 0 && a[3] > 0) vb = a; }
    const wmm = parseLength(svg.getAttribute('width')), hmm = parseLength(svg.getAttribute('height'));
    let sx = 25.4 / 96, sy = sx, vx = 0, vy = 0;
    if (vb) { vx = vb[0]; vy = vb[1]; if (wmm) sx = wmm / vb[2]; if (hmm) sy = hmm / vb[3]; else if (wmm) sy = sx; if (!wmm && hmm) sx = sy; }
    const skip = 'defs,clipPath,mask,symbol,marker,pattern,metadata';
    const els = [...svg.querySelectorAll('path,rect,circle,ellipse,line,polyline,polygon')].filter(el => !el.closest(skip));
    if (svg.querySelectorAll('text').length) warns.push('Les textes sont ignorés : dans Inkscape, convertis-les en chemins (Chemin › Objet en chemin).');
    if (svg.querySelectorAll('use').length) warns.push('Les clones (<use>) sont ignorés : dans Inkscape, utilise Édition › Cloner › Délier le clone.');
    const shapes = [];
    els.forEach((el, idx) => {
      for (let p = el; p && p !== svg; p = p.parentElement) if (getComputedStyle(p).display === 'none') return;
      let M = [1, 0, 0, 1, 0, 0];
      for (let p = el; p && p !== svg; p = p.parentElement) {
        const t = p.transform && p.transform.baseVal;
        if (t && t.numberOfItems) { const m = t.consolidate().matrix; M = matMul([m.a, m.b, m.c, m.d, m.e, m.f], M); }
      }
      const scale = Math.sqrt(Math.abs(M[0] * M[3] - M[1] * M[2])) * Math.sqrt(sx * sy) || 1;
      let subs;
      try { subs = elementSubpaths(el, 0.02 / scale); } catch (e) { warns.push((el.id || el.tagName) + ' : ' + e.message); return; }
      const out = [];
      for (const s of subs) {
        let pts = s.pts.map(([x, y]) => [((M[0] * x + M[2] * y + M[4]) - vx) * sx, ((M[1] * x + M[3] * y + M[5]) - vy) * sy]);
        pts = pts.filter((p, k) => k === 0 || Math.hypot(p[0] - pts[k - 1][0], p[1] - pts[k - 1][1]) > 1e-4);
        let closed = s.closed;
        if (pts.length > 2 && Math.hypot(pts[0][0] - pts[pts.length - 1][0], pts[0][1] - pts[pts.length - 1][1]) < 0.01) { closed = true; pts.pop(); }
        if (pts.length >= 2 && !(closed && pts.length < 3)) out.push({ pts, closed });
      }
      if (!out.length) return;
      const closed = out.every(s => s.closed);
      shapes.push({ id: shapes.length, name: el.getAttribute('inkscape:label') || el.id || (el.tagName.toLowerCase() + ' ' + (idx + 1)), subpaths: out, closed, op: closed ? 'outside' : 'on', depth: 1 });
    });
    if (!shapes.length) throw new Error('Aucune forme exploitable dans ce SVG.' + (warns.length ? ' ' + warns.join(' ') : ''));
    return { shapes, warns };
  } finally { host.remove(); }
}


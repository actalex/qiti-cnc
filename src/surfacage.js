/* ====================== Surfaçage ====================== */
// Aplanir le dessus du brut ou la table (martyr) : balayage en zigzag d'une zone rectangulaire à la fraise plate,
// en passes de profondeur. Mode à part : tant que SURF est actif, le plan (PLAN) est le surfaçage au lieu du dessin ;
// aperçu, relief, liste de vérification, gravure et export servent tels quels. Réglages gardés dans S.surf.
let SURF = false;
const flatTools = () => S.tools.filter(t => !isV(t));
function surfParams() {
  const flats = flatTools(), big = flats.slice().sort((a, b) => b.d - a.d)[0];
  S.surf = Object.assign({ x: 0, y: 0, w: S.stock.w, h: S.stock.h, depth: 0.5, over: 40, tool: big ? big.id : '' }, S.surf || {});
  if (!toolById(S.surf.tool) || isV(toolById(S.surf.tool))) S.surf.tool = big ? big.id : '';
  return S.surf;
}
// Zone en coordonnées brut (coin avant-gauche) ; le centre de la fraise passe sur les bords : elle déborde de son rayon
// autour de la zone, pour que les bords soient aplanis aussi.
function surfaceStep() {
  const P = surfParams(), T = toolById(P.tool);
  const pitch = Math.max(0.1, T.d * (1 - Math.min(90, Math.max(5, P.over)) / 100));
  const rows = Math.max(1, Math.ceil(P.h / pitch - 1e-9)), dy = P.h / rows, cuts = []; let zPrev = 0;
  for (const z of depthPasses(P.depth, T.doc)) {
    const pts = [];
    for (let i = 0; i <= rows; i++) { const y = P.y + i * dy, a = [P.x, y, z], b = [P.x + P.w, y, z]; pts.push(...(i % 2 ? [b, a] : [a, b])); }
    cuts.push({ pts, zTop: zPrev }); zPrev = z;
  }
  return { tool: T, title: `Surfaçage ${P.w} × ${P.h} mm, ${P.depth} mm`, groups: [{ shape: { name: 'surfaçage' }, tool: T, rank: 1, cuts }] };
}
function surfaceWarns() {
  const P = surfParams(), T = toolById(P.tool), w = [];
  if (!T) return ['Surfaçage : aucune fraise plate'];
  if (P.w + T.d > S.machine.w || P.h + T.d > S.machine.h) w.push('Surfaçage : la zone (plus le diamètre de la fraise) dépasse la course de la machine');
  if (P.depth > T.doc * 4) w.push(`Surfaçage : ${Math.ceil(P.depth / T.doc)} passes, c'est beaucoup pour un surfaçage (en général 0,2 à 1 mm au total)`);
  return w;
}
function openSurf() {
  const P = surfParams(), sel = $('#sfTool'); sel.innerHTML = '';
  for (const t of flatTools()) { const o = document.createElement('option'); o.value = t.id; o.textContent = t.name; sel.appendChild(o); }
  sel.value = P.tool;
  [['#sfX', 'x'], ['#sfY', 'y'], ['#sfW', 'w'], ['#sfH', 'h'], ['#sfD', 'depth'], ['#sfO', 'over']].forEach(([id, k]) => $(id).value = P[k]);
  $('#dlgSurf').showModal();
}
function readSurf() {
  const P = surfParams(), v = (id, d) => { const x = parseFloat(String($(id).value).replace(',', '.')); return isFinite(x) ? x : d; };
  Object.assign(P, { x: v('#sfX', P.x), y: v('#sfY', P.y), w: Math.max(1, v('#sfW', P.w)), h: Math.max(1, v('#sfH', P.h)), depth: Math.max(0.05, v('#sfD', P.depth)), over: v('#sfO', P.over), tool: $('#sfTool').value });
}
function setSurf(on) {
  SURF = on; $('#surfBar').classList.toggle('hide', !on); stepIdx = 0;
  if (on) { const P = surfParams(); $('#surfTxt').textContent = `Surfaçage ${P.w} × ${P.h} mm à ${P.depth} mm — ${toolById(P.tool).name}`; }
  recompute(); draw();
}
$('#bSurf').onclick = () => { if (!job) openSurf(); };
$('#sfStock').onclick = () => { $('#sfX').value = 0; $('#sfY').value = 0; $('#sfW').value = S.stock.w; $('#sfH').value = S.stock.h; };
$('#sfCancel').onclick = () => $('#dlgSurf').close();
$('#sfOk').onclick = () => { readSurf(); saveSettings(); $('#dlgSurf').close(); setSurf(true); if (viewMode === 'design') $('#viewbar [data-v=paths]').click(); };
$('#surfEdit').onclick = () => { if (!job) openSurf(); };
$('#surfQuit').onclick = () => { if (!job) setSurf(false); };

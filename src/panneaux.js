/* ====================== Panneaux ====================== */
function bindNum(id, get, set) { const el = $(id); el.value = get(); el.addEventListener('change', () => { set(num(el, get())); saveSettings(); invalidate(); }); return el; }
function refreshTools() {
  const s = $('#toolSel'); s.innerHTML = '';
  S.tools.forEach((t, k) => { const o = document.createElement('option'); o.value = k; o.textContent = t.name; s.appendChild(o); });
  s.value = S.toolIdx; const T = tool();
  $('#tType').value = isV(T) ? 'v' : 'flat'; $('#tAng').value = T.angle || 60; $('#tTip').value = T.tip || 0;
  $$('.vonly').forEach(e => e.classList.toggle('hide', !isV(T))); $$('.flatonly').forEach(e => e.classList.toggle('hide', isV(T)));
  $('#lD').textContent = isV(T) ? 'Diamètre du corps (mm)' : 'Diamètre (mm)';
  if (isV(T)) $('#vNote').textContent = `Largeur de trait : ${f3(cutWidth(-0.5, T))} mm à 0,5 mm de profondeur, ${f3(cutWidth(-1, T))} mm à 1 mm, ${f3(cutWidth(-2, T))} mm à 2 mm. Utilisable en « Sur la ligne » et « Remplissage en V ».`;
  $('#tName').value = T.name; $('#tD').value = T.d; $('#tF').value = T.feed; $('#tP').value = T.plunge; $('#tDoc').value = T.doc; $('#tSo').value = T.so;
  refreshShapeTools();
}
// listes « Fraise » et « Dégager le fond » des formes ('' = fraise courante / pas de dégagement, '*' = valeurs mélangées)
function refreshShapeTools() {
  const fill = (el, first, list) => {
    const v = el.value; el.innerHTML = '';
    [['', first], ...list.map(t => [t.id, t.name])].forEach(([id, n]) => { const o = document.createElement('option'); o.value = id; o.textContent = n; el.appendChild(o); });
    el.value = v;
  };
  fill($('#sTool'), `Fraise courante (${tool().name})`, S.tools);
  fill($('#sClear'), 'Non', S.tools.filter(t => !isV(t)));
}
function refreshShapes() {
  const box = $('#shapeList');
  if (!D) return;
  const label = { outside: 'ext.', inside: 'int.', on: 'ligne', pocket: 'poche', vcarve: 'V', none: '—' };
  // mise à jour en place (reconstruire la liste ferait perdre le clic en cours)
  if (box.dataset.design !== String(D.uid)) {
    box.innerHTML = ''; box.dataset.design = String(D.uid);
    for (const sh of D.shapes) {
      const d = document.createElement('div'); d.innerHTML = '<span></span><small></small>'; d.firstChild.textContent = sh.name;
      d.onclick = e => { const mod = e.shiftKey || e.ctrlKey || e.metaKey; if (!mod) sel.clear(); if (mod && sel.has(sh.id)) sel.delete(sh.id); else sel.add(sh.id); refreshShapes(); draw(); };
      box.appendChild(d);
    }
  }
  D.shapes.forEach((sh, k) => {
    const d = box.children[k]; d.className = sel.has(sh.id) ? 'sel' : '';
    const skipped = CAM && CAM.skipped && CAM.skipped.has(sh.id);
    const sm = d.lastChild; sm.style.color = skipped ? '#c0392b' : OPCOL[sh.op];
    const own = toolById(sh.tool);
    sm.textContent = (skipped ? '⚠ ignorée · ' : '') + label[sh.op] + (sh.op !== 'none' ? ' · ' + (sh.through ? 'traversant' : sh.depth + ' mm') + (sh.finish && sh.op !== 'on' && sh.op !== 'vcarve' ? ' · finition' : '') + (own ? ' · ' + own.name : '') : '');
  });
  const ed = $('#selEdit');
  if (!sel.size) { ed.classList.add('hide'); refreshTabRow([]); return; }
  ed.classList.remove('hide');
  const ss = D.shapes.filter(s => sel.has(s.id));
  $('#selCount').textContent = ss.length === 1 ? ss[0].name : ss.length + ' formes sélectionnées';
  const ops = new Set(ss.map(s => s.op)), deps = new Set(ss.map(s => s.through ? 'T' : s.depth));
  $('#sOp').value = ops.size === 1 ? [...ops][0] : ''; $('#sDepth').value = deps.size === 1 && !deps.has('T') ? [...deps][0] : '';
  $('#sDepth').placeholder = deps.size === 1 && deps.has('T') ? 'traversant' : '';
  const tls = new Set(ss.map(s => s.tool || '')), cls = new Set(ss.map(s => s.clear || ''));
  $('#sTool').value = tls.size === 1 ? [...tls][0] : '*'; $('#sClear').value = cls.size === 1 ? [...cls][0] : '*';
  $('#rowClear').classList.toggle('hide', !ss.every(s => s.op === 'vcarve'));
  const fins = ss.filter(s => s.op === 'outside' || s.op === 'inside' || s.op === 'pocket');
  $('#rowFinish').classList.toggle('hide', fins.length !== ss.length);
  $('#sFinish').checked = fins.length > 0 && fins.every(s => s.finish); $('#sFinish').indeterminate = fins.some(s => s.finish) && !fins.every(s => s.finish);
  refreshTabRow(ss);
}
function refreshPlace() {
  if (!D) { $('#dSize').textContent = ''; return; }
  $('#pX').value = +D.place.x.toFixed(2); $('#pY').value = +D.place.y.toFixed(2); $('#pS').value = D.place.s;
  const s = D.place.s / 100; $('#dSize').textContent = `${f3((D.bb.x1 - D.bb.x0) * s)} × ${f3((D.bb.y1 - D.bb.y0) * s)} mm`;
}
let camTimer = null;
function invalidate() { clearTimeout(camTimer); camTimer = setTimeout(recompute, 120); refreshPlace(); draw(); scheduleAutosave(); }
// Sauvegarde automatique du dessin en cours (les réglages ont leur propre clé) : rechargé au démarrage
const AUTOSAVE = 'atelier-cnc-projet';
let saveTimer = null, autosaveFailed = false;
function scheduleAutosave() { clearTimeout(saveTimer); saveTimer = setTimeout(autosave, 500); }
function autosave() {
  recordHistory(); // un état d'annulation par sauvegarde (les gestes rapprochés n'en font qu'un)
  if (!D) return;
  try { localStorage.setItem(AUTOSAVE, JSON.stringify(designData())); autosaveFailed = false; }
  catch (e) { if (!autosaveFailed) log('Sauvegarde automatique impossible (dessin trop volumineux pour le navigateur) : pense à « Enregistrer le projet ».', 'err'); autosaveFailed = true; }
}
function designData() { return { name: D.name, svg: D.svgText, place: D.place, pageOnly: D.pageOnly, stack: D.stack, ops: D.shapes.map(s => ({ op: s.op, depth: s.depth, through: !!s.through, finish: !!s.finish, tool: s.tool || '', clear: s.clear || '', tabs: s.tabs || [], m: s.m })) }; }
function restoreAutosave() {
  let p = null; try { p = JSON.parse(localStorage.getItem(AUTOSAVE)); } catch (e) {}
  if (!p || !p.svg) return;
  try { loadDesign(p.svg, p.name, p); log('Dessin restauré : ' + p.name + '.', 'msg'); }
  catch (e) { localStorage.removeItem(AUTOSAVE); log('Dessin sauvegardé illisible, ignoré : ' + e.message, 'err'); }
}
function recompute() {
  if (job) return;
  const warns = [];
  try {
    if (SURF) { CAM = { steps: [], warns: [], skipped: new Set() }; PLAN = [buildGcode(surfaceStep())]; warns.push(...surfaceWarns()); }
    else { CAM = computeCAM(); warns.push(...CAM.warns); PLAN = CAM.steps.map(st => buildGcode(st)); }
  } catch (e) { PLAN = []; warns.push('Erreur de calcul : ' + e.message); console.error(e); }
  stepIdx = Math.min(stepIdx, Math.max(0, PLAN.length - 1)); G = PLAN[stepIdx] || null;
  if (D) {
    const s = D.place.s / 100, x1 = D.place.x + (D.bb.x1 - D.bb.x0) * s, y1 = D.place.y + (D.bb.y1 - D.bb.y0) * s;
    if (D.place.x < -1e-6 || D.place.y < -1e-6 || x1 > S.stock.w + 1e-6 || y1 > S.stock.h + 1e-6) warns.push('Le dessin dépasse du brut');
  }
  if (S.stock.w > S.machine.w || S.stock.h > S.machine.h) warns.push('Le brut dépasse la course de la machine');
  const sum = f => PLAN.reduce((a, g) => a + f(g), 0);
  $('#iTime').textContent = G ? fmtTime(sum(g => g.time)) + (PLAN.length > 1 ? ` (${PLAN.length} étapes)` : '') : '—';
  $('#iLines').textContent = G ? sum(g => g.lines.length).toLocaleString('fr') : '—';
  $('#iDepth').textContent = G ? f3(-Math.min(...PLAN.map(g => g.zMin))) + ' mm' : '—';
  refreshSteps();
  $('#warns').textContent = warns.length ? '⚠ ' + [...new Set(warns)].join(' · ') : '';
  refreshShapes(); updateButtons(); draw();
}
// Passage à une fraise en V : proposer de convertir les usinages qu'elle ne sait pas faire
function offerVConvert() {
  if (!D || !isV()) return;
  const dflt = D.shapes.filter(s => !toolById(s.tool)); // seules les formes qui suivent la fraise courante
  const pockets = dflt.filter(s => s.op === 'pocket'), contours = dflt.filter(s => s.op === 'inside' || s.op === 'outside');
  if (!pockets.length && !contours.length) return;
  const parts = [];
  if (pockets.length) parts.push(`${pockets.length} poche(s) → « Remplissage en V »`);
  if (contours.length) parts.push(`${contours.length} contour(s) → « Sur la ligne »`);
  if (!confirm('Une fraise en V ne fait ni contours décalés ni poches. Convertir :\n' + parts.join('\n') + ' ?\n\nSinon ces formes seront ignorées.')) return;
  pockets.forEach(s => s.op = 'vcarve'); contours.forEach(s => s.op = 'on');
  refreshShapes();
}
function refreshAll() {
  $('#stW').value = S.stock.w; $('#stH').value = S.stock.h; $('#stT').value = S.stock.t;
  const ms = $('#matSel'); ms.innerHTML = '';
  [['', '— réglages manuels'], ...MATERIALS.map(m => [m.id, m.name])].forEach(([id, n]) => { const o = document.createElement('option'); o.value = id; o.textContent = n; ms.appendChild(o); });
  ms.value = S.material || '';
  $('#tabOn').checked = S.tabs.on; $('#tabN').value = S.tabs.n; $('#tabW').value = S.tabs.w; $('#tabH').value = S.tabs.h;
  $('#climb').value = S.climb ? '1' : '0'; $('#origin').value = S.origin;
  $('#rampOn').checked = S.ramp.on; $('#rampA').value = S.ramp.angle;
  refreshTools(); refreshShapes(); refreshPlace(); invalidate();
}
// matériau
$('#matSel').addEventListener('change', e => {
  const id = e.target.value, mat = MATERIALS.find(m => m.id === id);
  if (mat && !confirm(`Appliquer les réglages « ${mat.name} » à toutes les fraises (avance, plongée, profondeur par passe) ?

Ce sont des valeurs de départ prudentes : fais un essai dans une chute et ajuste.`)) { e.target.value = S.material || ''; return; }
  S.material = id;
  if (mat) { const capped = applyMaterial(id); log(`Réglages « ${mat.name} » appliqués aux fraises.` + (capped ? ` Limités par la vitesse max de la carte : ${capped} mm/min.` : ''), 'msg'); }
  saveSettings(); refreshTools(); invalidate();
});
[['#stW', 'w'], ['#stH', 'h'], ['#stT', 't']].forEach(([id, k]) => $(id).addEventListener('change', e => { const v = num(e.target, S.stock[k]); if (v > 0) S.stock[k] = v; saveSettings(); invalidate(); }));
// fraise
$('#toolSel').addEventListener('change', e => { S.toolIdx = +e.target.value; saveSettings(); refreshTools(); offerVConvert(); invalidate(); });
[['#tD', 'd'], ['#tF', 'feed'], ['#tP', 'plunge'], ['#tDoc', 'doc'], ['#tSo', 'so']].forEach(([id, k]) => $(id).addEventListener('change', e => { const v = num(e.target, tool()[k]); if (v > 0) tool()[k] = v; saveSettings(); invalidate(); }));
$('#tType').addEventListener('change', e => { const T = tool(); T.type = e.target.value; if (T.type === 'v') { T.angle = T.angle || 60; T.tip = T.tip ?? 0.2; } saveSettings(); refreshTools(); offerVConvert(); invalidate(); });
$('#tAng').addEventListener('change', e => { const v = num(e.target, tool().angle); if (v > 0 && v < 180) tool().angle = v; saveSettings(); refreshTools(); invalidate(); });
$('#tTip').addEventListener('change', e => { const v = num(e.target, tool().tip); if (v >= 0) tool().tip = v; saveSettings(); refreshTools(); invalidate(); });
$('#origin').addEventListener('change', e => { S.origin = e.target.value; saveSettings(); invalidate(); });
$('#tName').addEventListener('change', e => { tool().name = e.target.value || 'Fraise'; saveSettings(); refreshTools(); });
$('#bToolAdd').onclick = () => { const t = clone(tool()); t.name += ' (copie)'; t.id = newId(); S.tools.push(t); S.toolIdx = S.tools.length - 1; saveSettings(); refreshTools(); };
$('#bToolDel').onclick = () => { if (S.tools.length < 2) return; S.tools.splice(S.toolIdx, 1); S.toolIdx = 0; saveSettings(); refreshTools(); invalidate(); };
// placement
[['#pX', 'x'], ['#pY', 'y'], ['#pS', 's']].forEach(([id, k]) => $(id).addEventListener('change', e => { if (!D) return; const v = num(e.target, D.place[k]); if (k !== 's' || v > 0) D.place[k] = v; invalidate(); }));
$('#bCenter').onclick = () => { centerDesign(); invalidate(); };
// formes
$('#bSelAll').onclick = () => { if (!D) return; sel = new Set(D.shapes.map(s => s.id)); refreshShapes(); draw(); };
$('#sOp').addEventListener('change', e => { if (!D || !e.target.value) return; for (const sh of D.shapes) if (sel.has(sh.id)) { if (!sh.closed && e.target.value !== 'on' && e.target.value !== 'none') continue; sh.op = e.target.value; } refreshShapes(); invalidate(); });
$('#sDepth').addEventListener('change', e => { if (!D) return; const v = num(e.target, NaN); if (!(v >= 0)) return; for (const sh of D.shapes) if (sel.has(sh.id)) { sh.depth = v; sh.through = false; } refreshShapes(); invalidate(); });
$('#sTool').addEventListener('change', e => { if (!D || e.target.value === '*') return; for (const sh of D.shapes) if (sel.has(sh.id)) sh.tool = e.target.value; refreshShapes(); invalidate(); });
$('#sClear').addEventListener('change', e => { if (!D || e.target.value === '*') return; for (const sh of D.shapes) if (sel.has(sh.id)) sh.clear = e.target.value; refreshShapes(); invalidate(); });
$('#sFinish').addEventListener('change', e => { if (!D) return; for (const sh of D.shapes) if (sel.has(sh.id)) sh.finish = e.target.checked; refreshShapes(); invalidate(); });
$('#bThrough').onclick = () => { if (!D) return; for (const sh of D.shapes) if (sel.has(sh.id)) { sh.depth = S.stock.t; sh.through = true; } refreshShapes(); invalidate(); };
// attaches & sens
$('#tabOn').addEventListener('change', e => { S.tabs.on = e.target.checked; saveSettings(); invalidate(); });
[['#tabN', 'n'], ['#tabW', 'w'], ['#tabH', 'h']].forEach(([id, k]) => $(id).addEventListener('change', e => { const v = num(e.target, S.tabs[k]); if (v > 0) S.tabs[k] = v; saveSettings(); invalidate(); }));
$('#climb').addEventListener('change', e => { S.climb = e.target.value === '1'; saveSettings(); invalidate(); });
$('#rampOn').addEventListener('change', e => { S.ramp.on = e.target.checked; saveSettings(); invalidate(); });
$('#rampA').addEventListener('change', e => { const v = num(e.target, S.ramp.angle); if (v >= 0.5 && v <= 30) S.ramp.angle = v; saveSettings(); invalidate(); });
// vue
$$('#viewbar [data-v]').forEach(b => b.onclick = () => { viewMode = b.dataset.v; $$('#viewbar [data-v]').forEach(x => x.classList.toggle('on', x === b)); draw(); });
$('#bFit').onclick = fitView;
// fichiers
$('#bImport').onclick = () => $('#fSvg').click();
// Nouveau : ferme le dessin et oublie la sauvegarde automatique ; machine, fraises et matériau restent
$('#bNew').onclick = () => {
  if (!D || job) return;
  if (!confirm(`Fermer « ${D.name} » et repartir d'une page vide ?

Les réglages (machine, fraises, matériau) sont conservés. Pour garder ce dessin, annule et utilise « Enregistrer le projet ».`)) return;
  clearTimeout(saveTimer); localStorage.removeItem(AUTOSAVE);
  D = null; sel = new Set(); stepIdx = 0; $('#designName').textContent = '';
  refreshAll(); log('Nouveau dessin : page vide.', 'msg');
};
$('#fSvg').addEventListener('change', async e => { const f = e.target.files[0]; e.target.value = ''; if (f) openSvgFile(f); });
async function openSvgFile(f) {
  let text;
  try { text = await f.text(); loadDesign(text, f.name); } catch (err) { return alert(err.message); }
  const r = await askImport();
  if (r.page) { // brut = page, puis réimport limité à la page et placé comme dessus
    S.stock.w = +f3(D.page.w); S.stock.h = +f3(D.page.h); saveSettings();
    try { loadDesign(text, f.name, { pageOnly: true }); } catch (err) { return alert(err.message); }
  }
  if (r.colors) applyColors();
  if (r.page || r.colors) { refreshAll(); fitView(); resetHistory(); }
  offerVConvert();
}
$('#bSave').onclick = () => {
  if (!D) return alert('Rien à enregistrer : importe d\'abord un SVG.');
  const used = new Set([tool().id, ...D.shapes.flatMap(s => [s.tool, s.clear])]);
  const data = { app: 'atelier-cnc', v: 2, ...designData(), stock: S.stock, tool: tool(), tools: S.tools.filter(t => used.has(t.id)), tabs: S.tabs, climb: S.climb, origin: S.origin };
  download(D.name.replace(/\.svg$/i, '') + '.cnc.json', JSON.stringify(data), 'application/json');
};
$('#bOpen').onclick = () => $('#fProj').click();
$('#fProj').addEventListener('change', async e => {
  const f = e.target.files[0]; e.target.value = ''; if (!f) return;
  try {
    const p = JSON.parse(await f.text()); if (p.app !== 'atelier-cnc') throw new Error('Ce fichier n\'est pas un projet Atelier CNC.');
    if (p.stock) S.stock = p.stock; if (p.origin) S.origin = p.origin; if (p.tabs) S.tabs = p.tabs; S.climb = !!p.climb;
    // fraises du projet : même id, sinon même nom (les formes sont réaffectées), sinon ajoutée
    const remap = {};
    const merge = pt => {
      let t = S.tools.find(x => pt.id && x.id === pt.id) || S.tools.find(x => x.name === pt.name);
      if (t) Object.assign(t, pt, { id: t.id }); else { t = Object.assign({}, pt, { id: pt.id || newId() }); S.tools.push(t); }
      if (pt.id) remap[pt.id] = t.id; return t;
    };
    (p.tools || []).forEach(merge);
    if (p.tool) S.toolIdx = S.tools.indexOf(merge(p.tool));
    (p.ops || []).forEach(o => { if (o) { o.tool = remap[o.tool] || ''; o.clear = remap[o.clear] || ''; } });
    saveSettings(); loadDesign(p.svg, p.name, p);
  } catch (err) { alert(err.message); }
});
function download(name, text, type) { const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([text], { type })); a.download = name; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 2000); }
$('#bExport').onclick = () => {
  if (!G) return;
  const suffix = PLAN.length > 1 ? `-etape${stepIdx + 1}-` + G.tool.name.replace(/[^\w.-]+/g, '_') : '';
  download((SURF ? 'surfacage' : D ? D.name.replace(/\.svg$/i, '') : 'projet') + suffix + '.nc', G.lines.join('\n') + '\n', 'text/plain');
};
// Étapes : une par fraise, gravées l'une après l'autre (changement de fraise et zéro Z entre deux)
function refreshSteps() {
  const s = $('#stepSel'); s.innerHTML = ''; s.classList.toggle('hide', PLAN.length < 2); s.disabled = !!job;
  PLAN.forEach((g, k) => { const o = document.createElement('option'); o.value = k; o.textContent = `Étape ${k + 1}/${PLAN.length} : ${g.tool.name} — ${fmtTime(g.time)}`; s.appendChild(o); });
  s.value = stepIdx;
  $('#bCarve').textContent = PLAN.length > 1 ? `Graver l'étape ${stepIdx + 1}` : 'Graver';
  $('#bExport').textContent = PLAN.length > 1 ? `Exporter le G-code (étape ${stepIdx + 1})` : 'Exporter le G-code';
}
$('#stepSel').addEventListener('change', e => { stepIdx = +e.target.value; G = PLAN[stepIdx]; refreshSteps(); updateButtons(); draw(); });
// glisser-déposer
const center = $('#center');
center.addEventListener('dragover', e => { e.preventDefault(); $('#drop').style.display = 'flex'; });
center.addEventListener('dragleave', e => { if (e.target === center || e.target === cv) $('#drop').style.display = 'none'; });
center.addEventListener('drop', e => { e.preventDefault(); $('#drop').style.display = 'none'; const f = e.dataTransfer.files[0]; if (f) openSvgFile(f); });
// réglages machine
const MF = [['#mName', 'name', 's'], ['#mW', 'w'], ['#mH', 'h'], ['#mZ', 'z'], ['#mBaud', 'baud'], ['#mSafe', 'safeZ'], ['#mS', 'spindleS'], ['#mDwell', 'dwell'], ['#mRapid', 'rapid'], ['#mJog', 'jogFeed'], ['#mProbe', 'probeT'], ['#mProbeDist', 'probeDist']];
$('#bMachine').onclick = () => { MF.forEach(([id, k]) => $(id).value = S.machine[k]); $('#dlgMachine').showModal(); };
$('#mCancel').onclick = () => $('#dlgMachine').close();
$('#mOk').onclick = () => { MF.forEach(([id, k, t]) => { if (t === 's') S.machine[k] = $(id).value; else { const v = parseFloat($(id).value); if (isFinite(v) && v >= 0) S.machine[k] = v; } }); saveSettings(); $('#dlgMachine').close(); invalidate(); };


/* ====================== Relief 3D : interface ====================== */
// Fenêtre « Relief 3D… » (image, placement, profondeur, fraises), bandeau du mode, image gardée dans le navigateur.
const R3D_IMG_KEY = 'atelier-cnc-relief-img', R3D_MAXPX = 800;
// image → niveaux de gris (transparent = blanc), réduite à R3D_MAXPX px au plus grand côté
function r3dLoadImage(url, name) {
  return new Promise((ok, ko) => {
    const im = new Image();
    im.onload = () => {
      const k = Math.min(1, R3D_MAXPX / Math.max(im.width, im.height)), w = Math.max(2, Math.round(im.width * k)), h = Math.max(2, Math.round(im.height * k));
      const c = document.createElement('canvas'); c.width = w; c.height = h; const g = c.getContext('2d');
      g.fillStyle = '#fff'; g.fillRect(0, 0, w, h); g.drawImage(im, 0, 0, w, h);
      const px = g.getImageData(0, 0, w, h).data, gr = new Float32Array(w * h);
      for (let i = 0; i < w * h; i++) gr[i] = (0.299 * px[4 * i] + 0.587 * px[4 * i + 1] + 0.114 * px[4 * i + 2]) / 255;
      R3D.img = { id: Date.now() + Math.random(), name, w, h, g: gr, url }; R3D.cache = null; ok(R3D.img);
    };
    im.onerror = () => ko(new Error('image illisible'));
    im.src = url;
  });
}
function r3dFill() {
  const P = r3dParams(), opt = (sel, list, v) => { sel.innerHTML = ''; list.forEach(t => { const o = document.createElement('option'); o.value = t.id; o.textContent = t.name; sel.appendChild(o); }); sel.value = v; };
  opt($('#r3RTool'), S.tools.filter(isFlat), P.roughTool); opt($('#r3Tool'), S.tools.filter(isBall), P.tool);
  [['#r3X', 'x'], ['#r3Y', 'y'], ['#r3W', 'w'], ['#r3D', 'depth'], ['#r3Leave', 'leave'], ['#r3Step', 'step']].forEach(([id, k]) => $(id).value = P[k]);
  $('#r3Inv').checked = P.invert; $('#r3Rough').checked = P.rough; $('#r3Cross').checked = P.cross;
  r3dInfo();
}
function r3dInfo() {
  const I = R3D.img, w = parseFloat($('#r3W').value) || 0;
  $('#r3Name').textContent = I ? `${I.name} (${I.w} × ${I.h} px)` : 'aucune image';
  $('#r3Size').textContent = I ? `Hauteur : ${f3(w * I.h / I.w)} mm (proportions de l'image).` : '';
  $('#r3Ok').disabled = !I || !S.tools.some(isBall);
}
function r3dRead() {
  const P = r3dParams(), v = (id, d) => { const x = parseFloat(String($(id).value).replace(',', '.')); return isFinite(x) ? x : d; };
  Object.assign(P, { x: v('#r3X', P.x), y: v('#r3Y', P.y), w: Math.max(1, v('#r3W', P.w)), depth: Math.max(0.05, v('#r3D', P.depth)), leave: Math.max(0, v('#r3Leave', P.leave)),
    step: Math.max(0.05, v('#r3Step', P.step)), invert: $('#r3Inv').checked, rough: $('#r3Rough').checked, cross: $('#r3Cross').checked, roughTool: $('#r3RTool').value, tool: $('#r3Tool').value });
}
function setR3d(on) {
  if (on && SURF) setSurf(false);
  R3D.on = on; $('#r3dBar').classList.toggle('hide', !on); stepIdx = 0;
  if (on) { const P = r3dParams(); $('#r3dTxt').textContent = `Relief 3D ${f3(P.w)} × ${f3(r3dHeight(P))} mm, ${f3(P.depth)} mm — ${R3D.img.name}`; }
  recompute(); draw();
  if (on) $('#viewbar [data-v=relief]').click(); // la pièce telle qu'elle sortira
}
$('#bR3d').onclick = () => { if (!job) { r3dFill(); $('#dlgR3d').showModal(); } };
$('#r3Pick').onclick = () => $('#fR3d').click();
$('#fR3d').onchange = e => {
  const f = e.target.files[0]; e.target.value = ''; if (!f) return;
  const rd = new FileReader();
  rd.onload = () => r3dLoadImage(rd.result, f.name).then(I => {
    const P = r3dParams(), m = 5, w = Math.max(1, Math.min(S.stock.w - 2 * m, (S.stock.h - 2 * m) * I.w / I.h));
    $('#r3X').value = m; $('#r3Y').value = m; $('#r3W').value = f3(Math.floor(w)); P.w = Math.floor(w); // placée dans le brut, marge 5 mm
    try { localStorage.setItem(R3D_IMG_KEY, JSON.stringify({ name: f.name, url: rd.result })); } catch (er) { log('Image trop lourde pour être gardée dans le navigateur : il faudra la rechoisir à la prochaine ouverture.', 'msg'); }
    r3dInfo();
  }).catch(er => alert('Image : ' + er.message));
  rd.readAsDataURL(f);
};
$('#r3W').addEventListener('input', r3dInfo);
$('#r3Cancel').onclick = () => $('#dlgR3d').close();
$('#r3Ok').onclick = () => { r3dRead(); saveSettings(); $('#dlgR3d').close(); setR3d(true); };
$('#r3dEdit').onclick = () => { if (!job) { r3dFill(); $('#dlgR3d').showModal(); } };
$('#r3dQuit').onclick = () => { if (!job) setR3d(false); };
(() => { try { const o = JSON.parse(localStorage.getItem(R3D_IMG_KEY)); if (o) r3dLoadImage(o.url, o.name).catch(() => {}); } catch (e) {} })();

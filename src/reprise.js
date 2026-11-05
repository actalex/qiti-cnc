/* ====================== Reprise d'une gravure interrompue ====================== */
// Points de reprise (G.resume, posés par buildGcode) : début d'une coupe abordée depuis la hauteur de dégagement.
// L'avancement de la gravure est noté chaque seconde dans le navigateur : après un arrêt, un câble débranché ou une
// coupure de l'ordinateur, la liste de vérification propose de repartir du dernier point de reprise sûrement passé.
// Le zéro pièce (G54) reste dans la carte tant qu'elle n'a pas été éteinte : c'est ce qui rend la reprise possible.
const RESUME_KEY = 'atelier-cnc-reprise';
const RESUME_MARGIN = 24; // lignes acquittées par GRBL mais peut-être pas encore exécutées (tampon du planificateur)
function gcodeSig(P) {
  let h = 5381;
  for (const l of P.lines) for (let i = 0; i < l.length; i++) h = (h * 33 + l.charCodeAt(i)) | 0;
  return P.lines.length + ':' + (h >>> 0).toString(36);
}
function savedProgress() { try { return JSON.parse(localStorage.getItem(RESUME_KEY)); } catch (e) { return null; } }
function noteProgress() {
  if (!job || !job.sig || job.acked <= job.pre) return;
  const done = job.off + job.acked - 1, old = savedProgress();
  if (old && old.sig === job.sig && old.done >= done) return;
  try { localStorage.setItem(RESUME_KEY, JSON.stringify({ sig: job.sig, step: job.step, done, t: Date.now() })); } catch (e) {}
}
function clearProgress() { localStorage.removeItem(RESUME_KEY); }
// points de reprise possibles pour l'étape P : ceux que la gravure interrompue a sûrement dépassés, le plus récent d'abord
function resumeChoices(P) {
  const sv = savedProgress();
  if (!sv || !P.resume || sv.sig !== gcodeSig(P)) return null;
  const pts = P.resume.filter(r => r.line > P.resume[0].line && r.line <= sv.done - RESUME_MARGIN);
  return pts.length ? { t: sv.t, pts: pts.reverse().slice(0, 40) } : null;
}
// programme repris : en-tête, dégagement, X/Y du point, broche, descente au Z du point (rapide jusqu'à 0,5 mm au-dessus
// du brut, puis à la vitesse de plongée dans la saignée déjà coupée), avance du point, puis la suite
function resumeLines(P, r) {
  const m = S.machine, safe = m.safeZ, pre = [
    `; Reprise à « ${r.name} » (ligne ${r.line + 1} sur ${P.lines.length})`, 'G21 G90 G17 G94 G54', `G0 Z${f3(safe)}`,
    `G0 X${r.x} Y${r.y}`, `M3 S${Math.round(m.spindleS)}`, ...(m.dwell > 0 ? [`G4 P${m.dwell}`] : [])];
  if (r.z < safe - 5e-4) {
    const app = Math.min(safe, Math.max(0, r.z) + 0.5);
    if (r.z >= app - 5e-4) pre.push(`G0 Z${f3(r.z)}`);
    else { if (app < safe - 5e-4) pre.push(`G0 Z${f3(app)}`); pre.push(`G1 Z${f3(r.z)} F${Math.round(P.tool.plunge)}`); }
  }
  if (r.f) pre.push('F' + Math.round(r.f));
  return { lines: pre.concat(P.lines.slice(r.line)), off: r.line - pre.length, pre: pre.length };
}
function fillResume() {
  const C = G && resumeChoices(G), box = $('#cResume');
  box.classList.toggle('hide', !C); if (!C) return;
  const d = new Date(C.t), when = d.toLocaleDateString('fr', { day: '2-digit', month: '2-digit' }) + ' à ' + d.toLocaleTimeString('fr', { hour: '2-digit', minute: '2-digit' });
  $('#cResumeWhen').textContent = `Cette étape a été interrompue le ${when}.`;
  const sel = $('#cFrom'); sel.innerHTML = '';
  const opt = (v, t) => { const o = document.createElement('option'); o.value = v; o.textContent = t; sel.appendChild(o); };
  opt('', 'Au début (tout refaire)');
  C.pts.forEach(r => opt(r.line, `« ${r.name} », passe à ${f3(Math.abs(r.zc)).replace('.', ',')} mm (${Math.round(r.line / G.lines.length * 100)} %)`));
  $('#cFrom').value = String(C.pts[0].line); syncResume();
}
function syncResume() {
  const on = !!$('#cFrom').value; $('#cResumeChk').classList.toggle('hide', !on);
  $('#cGo').textContent = on ? 'Reprendre la gravure' : 'Lancer la gravure'; checkCarveList();
}
$('#cFrom').onchange = syncResume;
const resumeFrom = () => { const v = $('#cFrom').value; return v && !$('#cResume').classList.contains('hide') ? G.resume.find(r => r.line === +v) : null; };
setInterval(noteProgress, 1000);

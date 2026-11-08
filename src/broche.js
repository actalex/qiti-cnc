/* ====================== Garde-fou broche ====================== */
// GRBL 1.1 indique les accessoires allumés dans les rapports d'état qui portent les corrections (« |Ov:…|A:S » :
// S = broche sens horaire, C = sens inverse ; Ov sans A = rien d'allumé). GRBL ne répond « ok » à M3 qu'une fois la
// broche commandée : pendant une gravure, un rapport Ov sans broche après un M3 acquitté = broche pas démarrée → pause
// immédiate (feed hold), avant que la fraise ne descende dans le bois.
// Actif seulement si la carte a déjà montré une fois la broche allumée (S.machine.spReport) : une carte qui ne donne pas
// cet état ne déclenche pas de fausse alerte. Limite : GRBL indique ce qu'il commande, pas la rotation réelle.
function spindleAck(line) { if (/^M[34]\b/.test(line)) machine.spOn = true; else if (/^(M5|M2|M30)\b/.test(line)) machine.spOn = false; }
function spindleReset() { machine.spOn = false; machine.spA = null; showSpindle(); }
function spindleReport(parts) {
  if (!parts.some(p => p.startsWith('Ov:'))) return;
  const on = /[SC]/.test((parts.find(p => p.startsWith('A:')) || '').slice(2));
  machine.spA = on; showSpindle();
  if (on && !S.machine.spReport) { S.machine.spReport = true; saveSettings(); }
  if (on || !machine.spOn || !job || job.stopping || job.pause || !S.machine.spReport) return;
  machine.spOn = false;
  abortJob('la carte indique la broche arrêtée alors qu\'elle devrait tourner (M3 envoyé). Vérifie la broche et le variateur avant de reprendre.');
}
function showSpindle() {
  const el = $('#spState'), on = machine.spA;
  el.textContent = on ? 'broche en marche' : 'broche arrêtée'; el.className = 'tag ' + (on ? 'Run' : 'off') + (on == null ? ' hide' : '');
}

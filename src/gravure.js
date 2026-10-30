/* ====================== Gravure ====================== */
function updateButtons() {
  const ready = machine.port && machine.state === 'Idle' && !job;
  $('#bCarve').disabled = !(G && ready);
  $('#bExport').disabled = !G;
  $('#bSurf').disabled = !!job;
  ['#bUnlock', '#bHome', '#bZeroXY', '#bZeroZ', '#bGoZero', '#bProbe', '#bSend'].forEach(id => $(id).disabled = !machine.port || !!job);
  $('#bUnlock').disabled = !machine.port || (!!job && machine.state !== 'Alarm');
  const noHome = machine.grbl[22] === 0;
  if (noHome) $('#bHome').disabled = true;
  $('#bHome').title = noHome ? 'Homing désactivé sur cette carte ($22=0)' : '$H — nécessite les fins de course';
  $('#bPause').disabled = $('#bStop').disabled = !!machine.stopWait;
  $('#bHalt').disabled = !machine.port || !!machine.stopWait;
  $$('[data-zero]').forEach(b => b.disabled = !machine.port || !!job);
  $$('[data-jog]').forEach(b => b.disabled = !machine.port || !!job || !canJog());
  $('#bCarve').title = !G ? 'Rien à graver' : !machine.port ? 'Connecte la machine' : machine.state !== 'Idle' ? 'La machine doit être prête (Idle)' : '';
}
$('#bCarve').onclick = () => {
  if (!G) return;
  const T = G.tool, warns = $('#warns').textContent;
  $('#cZ').textContent = stepIdx > 0 ? 'Le zéro Z est refait avec cette fraise, et le zéro X/Y n\'a pas bougé depuis l\'étape 1.' : 'Le zéro Z est fait sur le dessus du matériau (et la plaque de sonde est retirée).';
  $('#cSummary').innerHTML = (PLAN.length > 1 ? `<b>Étape ${stepIdx + 1}/${PLAN.length}</b> · ` : '') + `Durée estimée <b>${fmtTime(G.time)}</b> · profondeur max <b>${f3(-G.zMin)} mm</b> · ${G.lines.length.toLocaleString('fr')} lignes`;
  $('#cWarn').textContent = warns; $('#cTool').textContent = `La fraise « ${T.name} » (${isV(T) ? 'en V ' + T.angle + '°' : 'Ø ' + T.d + ' mm'}) est installée.`;
  $('#cOrigin').textContent = S.origin === 'center' ? 'Le zéro X/Y est placé au centre du brut.' : 'Le zéro X/Y est placé au coin avant-gauche du brut.';
  $$('#dlgCarve input[type=checkbox]').forEach(c => c.checked = false); $('#cGo').disabled = true;
  $('#dlgCarve').showModal();
};
$$('#dlgCarve input[type=checkbox]').forEach(c => c.addEventListener('change', () => { $('#cGo').disabled = !$$('#dlgCarve input[type=checkbox]').every(x => x.checked); }));
$('#cCancel').onclick = () => $('#dlgCarve').close();
$('#cGo').onclick = () => { $('#dlgCarve').close(); startJob(); };
function startJob() {
  if (!G || !machine.port || machine.state !== 'Idle') return;
  // lignes de dégagement (G0 seul en Z jusqu'à la hauteur de sécurité) : points où une pause peut couper la broche
  const safe = S.machine.safeZ, retracts = [];
  G.lines.forEach((l, k) => { const m = /^G0 Z(-?[\d.]+)$/.exec(l); if (m && +m[1] >= safe - 1e-6) retracts.push(k); });
  job = { lines: G.lines, total: G.lines.length, next: 0, acked: 0, t0: Date.now(), pause: null, retracts, step: stepIdx };
  refreshSteps();
  $('#job').classList.remove('hide'); refreshPauseBtn();
  log('Gravure lancée (' + job.total + ' lignes).', 'msg');
  feedJob(); pump(); updateButtons();
}
function updateJobUI() {
  if (!job) return;
  const p = job.total ? job.acked / job.total : 0;
  $('#pBar').style.width = (p * 100).toFixed(1) + '%';
  $('#pTxt').textContent = `${job.acked.toLocaleString('fr')} / ${job.total.toLocaleString('fr')} lignes (${(p * 100).toFixed(0)} %)`;
  const el = ((job.pause && job.pause.phase === 'paused' ? job.pause.t : Date.now()) - job.t0) / 1000; $('#pTime').textContent = fmtTime(el) + (p > 0.03 ? ' · reste ~' + fmtTime(el / p * (1 - p)) : '');
}
setInterval(() => { if (job) { updateJobUI(); } }, 1000);
// Pause propre (aspirer, refroidir, nettoyer la fraise) : on n'envoie plus rien après le prochain dégagement ; quand la
// machine s'y est arrêtée, broche coupée (M5). Reprise : broche relancée (+ temporisation), puis la suite du programme,
// qui repart de la hauteur de sécurité. En attendant le dégagement, « Pause immédiate » = arrêt sur place (feed hold).
$('#bPause').onclick = () => {
  if (!job || job.stopping) return;
  const P = job.pause;
  if (!P) {
    const first = machine.queue.find(q => q.meta === 'job'), from = first ? first.idx : job.next;
    const at = job.retracts.find(k => k >= from);
    if (at === undefined) { log('Plus de dégagement d\'ici la fin : utilise « Pause immédiate » si besoin.', 'msg'); job.pause = { phase: 'hold0' }; }
    else {
      machine.queue = machine.queue.filter(q => q.meta !== 'job' || q.idx <= at); job.next = Math.min(job.next, at + 1);
      job.pause = { phase: 'wait', at }; log('Pause demandée : la fraise va remonter au prochain dégagement, puis la broche s\'arrêtera…', 'msg');
    }
  } else if (P.phase === 'wait' || P.phase === 'hold0') { rt(0x21); job.pause = { phase: 'hold' }; log('Pause immédiate : machine arrêtée sur place, broche allumée.', 'msg'); }
  else if (P.phase === 'hold') { rt(0x7e); job.pause = null; feedJob(); pump(); }
  else if (P.phase === 'paused') {
    const m3 = job.lines.find(l => /^M3\b/.test(l)) || `M3 S${Math.round(S.machine.spindleS)}`;
    sendLines([m3, ...(S.machine.dwell > 0 ? [`G4 P${S.machine.dwell}`] : [])], 'pause');
    job.t0 += Date.now() - P.t; job.pause = null; log('Reprise : broche relancée.', 'msg'); feedJob(); pump();
  }
  refreshPauseBtn();
};
function pauseReached() {
  sendLines(['M5'], 'pause'); job.pause = { phase: 'paused', t: Date.now() };
  log('En pause : fraise relevée, broche arrêtée. Aspire ou nettoie, puis « Reprendre ».', 'msg'); refreshPauseBtn();
}
function refreshPauseBtn() {
  const P = job && job.pause;
  $('#bPause').textContent = !P ? 'Pause' : P.phase === 'wait' || P.phase === 'hold0' ? 'Pause immédiate' : 'Reprendre';
}
$('#bStop').onclick = () => { if (job && confirm('Arrêter la gravure maintenant ?')) stopJob(); };
function stopJob() { safeStop('Gravure arrêtée.'); }
// Arrêt sûr : feed hold, puis reset seulement quand GRBL signale l'arrêt complet (Hold:0).
// Un reset pendant un mouvement déclenche l'alarme 3 et fait perdre la position.
function safeStop(endMsg) {
  if (machine.stopWait) return;
  machine.queue = []; if (job) job.stopping = true; rt(0x21);
  machine.stopWait = { t0: Date.now(), endMsg };
  log('Arrêt : décélération en cours…', 'msg'); updateButtons();
}
function checkStop() {
  const w = machine.stopWait; if (!w) return;
  const moving = machine.state === 'Run' || machine.state === 'Jog' || (machine.state === 'Hold' && machine.sub !== '0');
  const late = Date.now() - w.t0 > 10000;
  if (moving && !late) return;
  machine.stopWait = null;
  if (w.endMsg) endJob(w.endMsg); // avant le reset : la bannière Grbl ne doit pas être prise pour un redémarrage en gravure
  rt(0x18); machine.queue = []; machine.inflight = []; machine.used = 0;
  if (late) log('Reset envoyé alors que la machine bougeait encore : la position peut être perdue, refais l\'origine machine et les zéros.', 'err');
  else log('Machine arrêtée, broche coupée.', 'msg');
  updateButtons();
}
function abortJob(why) {
  machine.queue = []; rt(0x21);
  const msg = 'Gravure interrompue : ' + why;
  endJob(msg);
  if (confirm(msg + '\n\nOK : arrêt complet (broche coupée).\nAnnuler : rester en pause, broche allumée, pour inspecter.')) safeStop(null);
  else log('Machine en pause, broche allumée. Bouton « Stop » du panneau Machine pour couper.', 'msg');
}
function finishJob() {
  const k = job.step, t = fmtTime((Date.now() - job.t0) / 1000);
  if (k >= PLAN.length - 1) return endJob(PLAN.length > 1 ? `Dernière étape terminée en ${t}.` : `Gravure terminée en ${t}.`);
  stepIdx = k + 1;
  endJob(`Étape ${k + 1} terminée en ${t}. Installe « ${PLAN[k + 1].tool.name} », refais le zéro Z (sans toucher au zéro X/Y), puis lance l'étape ${k + 2}.`);
}
function endJob(msg) {
  if (!job) return; job = null; log(msg, 'msg');
  $('#job').classList.add('hide'); updateButtons(); recompute();
}
window.addEventListener('beforeunload', e => { if (job) { e.preventDefault(); e.returnValue = ''; } });


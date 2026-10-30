/* ====================== GRBL / Web Serial ====================== */
const RX_BUF = 127;
const ALARMS = { 1: 'fin de course matériel déclenché', 2: 'déplacement hors limites logicielles', 3: 'reset pendant un mouvement : position perdue, refais l\'origine', 4: 'sonde déjà en contact au départ', 5: 'la sonde n\'a pas touché la plaque', 6: 'homing interrompu', 7: 'porte ouverte pendant le homing', 8: 'homing : impossible de dégager le fin de course', 9: 'homing : fin de course introuvable' };
const ERRORS = { 1: 'lettre de commande attendue', 2: 'valeur numérique invalide', 3: 'commande $ inconnue', 5: 'homing non activé ($22)', 8: 'commande refusée hors état Idle', 9: 'G-code verrouillé : alarme active (déverrouiller)', 10: 'limites logicielles sans homing', 15: 'jog hors limites', 16: 'commande de jog invalide', 20: 'commande G-code non supportée', 22: 'avance F non définie', 33: 'cible de mouvement invalide', 36: 'mots G-code inutilisés' };
const machine = { port: null, writer: null, reader: null, state: null, sub: null, stopWait: null, grbl: {}, quietSettings: false, settingsAsked: false, jogWarn: 0, noted: {}, wpos: null, mpos: null, wco: [0, 0, 0], ov: [100, 100, 100], queue: [], inflight: [], used: 0, wchain: Promise.resolve(), poll: null, onIdle: [] };
function log(text, cls) { const el = $('#log'), d = document.createElement('div'); if (cls) d.className = cls; d.textContent = text; el.appendChild(d); while (el.childNodes.length > 400) el.firstChild.remove(); el.scrollTop = el.scrollHeight; }
const enc = new TextEncoder();
function writeRaw(data) { if (!machine.writer) return; const bytes = typeof data === 'string' ? enc.encode(data) : data; machine.wchain = machine.wchain.then(() => machine.writer.write(bytes)).catch(e => { if (!machine.writeErr) log('Écriture impossible : ' + e.message + ' (le port ne répond plus : déconnecte).', 'err'); machine.writeErr = true; }); }
function rt(byte) { writeRaw(new Uint8Array([byte])); }
function cleanLine(l) { return l.replace(/\(.*?\)/g, '').replace(/;.*$/, '').trim().toUpperCase(); }
function sendLines(lines, meta) { for (const l of lines) { const c = cleanLine(l); if (c) machine.queue.push({ line: c, meta, echo: !meta }); } pump(); }
function pump() {
  while (machine.queue.length) {
    const q = machine.queue[0], len = q.line.length + 1;
    if (machine.used + len > RX_BUF && machine.inflight.length) break;
    machine.queue.shift(); machine.inflight.push({ len, q }); machine.used += len;
    if (q.echo) log('> ' + q.line, 'tx');
    writeRaw(q.line + '\n');
  }
}
function onAck(err) {
  const it = machine.inflight.shift(); if (it) machine.used -= it.len;
  if (err) {
    const code = +err; log(`error:${err} — ${ERRORS[code] || 'erreur GRBL'}${it ? ' (' + it.q.line + ')' : ''}`, 'err');
    if (job && it && it.q.meta === 'job') { abortJob('Erreur GRBL ' + err + ' sur la ligne « ' + it.q.line + ' »'); return; }
    machine.queue = machine.queue.filter(q => q.meta === 'job');
  }
  if (it && it.q.meta === 'settings') { machine.quietSettings = false; applyGrblSettings(); }
  if (job && it && it.q.meta === 'job') { job.acked++; if (!job.stopping) feedJob(); }
  pump();
}
function feedJob() {
  if (!job || job.stopping) return;
  const inQ = machine.queue.length;
  while (job.next < job.lines.length && machine.queue.length - inQ < 200 && machine.queue.length < 400) { const c = cleanLine(job.lines[job.next++]); if (c) machine.queue.push({ line: c, meta: 'job' }); else job.acked++; }
  updateJobUI();
}
function parseStatus(s) {
  const parts = s.slice(1, -1).split('|'); [machine.state, machine.sub] = parts[0].split(':');
  if (!machine.settingsAsked) readGrblSettings(); // pas de bannière reçue (tronquée, ou carte non redémarrée à l'ouverture)
  for (const p of parts.slice(1)) {
    const [k, v] = p.split(':'); const a = (v || '').split(',').map(Number);
    if (k === 'MPos') machine.mpos = a; else if (k === 'WPos') machine.wpos = a; else if (k === 'WCO') machine.wco = a; else if (k === 'Ov') machine.ov = a;
  }
  if (parts.some(p => p.startsWith('MPos'))) machine.wpos = machine.mpos.map((v, k) => v - (machine.wco[k] || 0));
  else if (machine.wpos) machine.mpos = machine.wpos.map((v, k) => v + (machine.wco[k] || 0));
  const st = $('#state'); st.textContent = { Idle: 'Prête', Run: 'En cours', Hold: 'Pause', Jog: 'Jog', Alarm: 'Alarme', Door: 'Porte', Check: 'Test', Home: 'Homing', Sleep: 'Veille' }[machine.state] || machine.state; st.className = 'tag ' + machine.state;
  if (machine.wpos) { $('#wx').textContent = machine.wpos[0].toFixed(2); $('#wy').textContent = machine.wpos[1].toFixed(2); $('#wz').textContent = machine.wpos[2].toFixed(2); }
  $('#ovF').textContent = ' ' + machine.ov[0] + ' %';
  if (machine.state === 'Idle') { const cbs = machine.onIdle.splice(0); cbs.forEach(f => f()); }
  checkStop();
  if (job && !job.stopping && job.acked >= job.total && machine.state === 'Idle' && !machine.inflight.length) finishJob();
  updateButtons(); if (machine.port) draw();
}
function handleLine(l) {
  if (!l) return;
  if (l[0] !== '<' && /<[^<>]*>$/.test(l)) l = l.slice(l.lastIndexOf('<')); // octets parasites avant un état (bannière tronquée à l'ouverture du port)
  if (l[0] === '<') return parseStatus(l);
  if (l === 'ok') return onAck(null);
  if (l.startsWith('error:')) return onAck(l.slice(6));
  if (l.startsWith('ALARM:')) { const c = +l.slice(6); log(`ALARME ${c} — ${ALARMS[c] || ''}`, 'err'); if (job) abortJob('Alarme ' + c + ' : ' + (ALARMS[c] || '')); return; }
  if (/^Grbl/i.test(l)) { machine.queue = []; machine.inflight = []; machine.used = 0; if (job) abortJob('La carte a redémarré pendant la gravure.'); log(l, 'msg'); readGrblSettings(); return; }
  if (/^\$\d+=/.test(l)) { const [k, v] = l.slice(1).split('='); machine.grbl[+k] = parseFloat(v); if (!machine.quietSettings) log(l); return; }
  if (l.startsWith('[PRB:')) { log(l, 'msg'); return; }
  log(l, l.startsWith('[MSG') ? 'msg' : '');
}
async function readLoop() {
  const dec = new TextDecoder(); let buf = '';
  try {
    while (machine.port && machine.port.readable) {
      machine.reader = machine.port.readable.getReader();
      try {
        while (true) {
          const { value, done } = await machine.reader.read(); if (done) break;
          machine.rx += value.length; buf += dec.decode(value, { stream: true }); let k;
          while ((k = buf.indexOf('\n')) >= 0) { handleLine(buf.slice(0, k).trim()); buf = buf.slice(k + 1); }
        }
      } finally { machine.reader.releaseLock(); }
      if (!machine.port) break;
    }
  } catch (e) { if (machine.port) log('Lecture interrompue : ' + e.message, 'err'); }
}
// Réglages de la carte ($$), lus à chaque démarrage : ils font foi pour la course ($130-$132), la valeur S max de la
// broche ($30, que M3 S doit respecter) et la vitesse rapide ; accélérations et vitesses max servent à l'estimation de durée.
function readGrblSettings() { machine.grbl = {}; machine.quietSettings = true; machine.settingsAsked = true; sendLines(['$$'], 'settings'); }
function applyGrblSettings() {
  const g = machine.grbl, M = S.machine, ch = [];
  if (!Object.keys(g).length) return;
  const set = (k, v, label) => { if (v > 0 && Math.abs((M[k] || 0) - v) > 1e-6) { ch.push(`${label} ${M[k]} → ${v}`); M[k] = v; } };
  set('w', g[130], 'course X'); set('h', g[131], 'course Y'); set('z', g[132], 'course Z'); set('spindleS', g[30], 'broche S max');
  if (g[110] > 0 && g[111] > 0) set('rapid', Math.min(g[110], g[111]), 'vitesse rapide');
  const plan = g[120] > 0 && g[121] > 0 && g[122] > 0 ? { acc: [g[120], g[121], g[122]], rate: [g[110], g[111], g[112]], jd: g[11] > 0 ? g[11] : 0.01 } : null;
  const planChanged = JSON.stringify(plan) !== JSON.stringify(M.plan || null); M.plan = plan;
  saveSettings();
  const note = (k, msg) => { if (!machine.noted[k]) { machine.noted[k] = 1; log(msg, 'msg'); } }; // une fois par connexion, pas à chaque reset
  if (ch.length) log('Réglages de la carte appliqués : ' + ch.join(', ') + '.', 'msg'); else note('read', 'Réglages de la carte lus.');
  if (planChanged && plan) log(`Estimation de durée avec les accélérations de la carte (${plan.acc.join(' / ')} mm/s²).`, 'msg');
  if (g[22] === 0) note('home', 'Homing désactivé ($22=0) : bouton « Origine » inactif, place les zéros à la main.');
  if (g[20] === 0) note('soft', 'Limites logicielles désactivées ($20=0) : vérifie que le dessin tient dans la course avant de graver.');
  if (ch.length || planChanged) invalidate();
}
// Carte muette (vu sur la TTC450 : ESP32 figé, qui répond après un redémarrage) : proposer de la redémarrer par les
// lignes du port USB, comme esptool : RTS seul = reset de l'ESP32, puis tout relâché = démarrage normal (DTR bas).
function watchSilence(port, afterReset) {
  setTimeout(async () => {
    if (machine.port !== port || machine.rx) return;
    $('#state').textContent = 'muette';
    if (afterReset || !port.setSignals) { log('La carte ne répond toujours pas. Vérifie que c\'est bien le port USB de la CNC (pas un port Bluetooth) et que la machine est sous tension ; sinon éteins et rallume la machine.', 'err'); return; }
    log('Aucune réponse de la carte sur ce port.', 'err');
    if (!confirm('La carte ne répond pas : elle est peut-être figée.\n\nLa redémarrer par l\'USB ? C\'est comme l\'éteindre et la rallumer : si elle bougeait, elle s\'arrête net, et les zéros sont à refaire.')) { log('Vérifie que c\'est bien le port USB de la CNC (pas un port Bluetooth), puis déconnecte et réessaie.', 'msg'); return; }
    try {
      await port.setSignals({ dataTerminalReady: false, requestToSend: true }); await new Promise(r => setTimeout(r, 150));
      await port.setSignals({ dataTerminalReady: false, requestToSend: false });
      log('Redémarrage de la carte demandé…', 'msg'); watchSilence(port, true);
    } catch (e) { log('Redémarrage impossible : ' + e.message, 'err'); }
  }, 4000);
}
async function connect() {
  if (machine.port) return disconnect();
  if (!('serial' in navigator)) return alert('Web Serial indisponible : ouvre la page dans Chrome ou Edge, via http://localhost.');
  try {
    const port = await navigator.serial.requestPort(), opts = { baudRate: +S.machine.baud || 115200 };
    try { await port.open(opts); }
    catch (e) { if (e.name !== 'InvalidStateError') throw e; await port.close(); await port.open(opts); } // resté ouvert par cette page : on le rouvre
    machine.port = port; machine.writer = port.writable.getWriter(); machine.queue = []; machine.inflight = []; machine.used = 0; machine.settingsAsked = false; machine.grbl = {}; machine.noted = {}; machine.writeErr = false;
    // Identité du port : un port sans identifiant USB (Bluetooth, port intégré) s'ouvre mais ne répond jamais
    const info = port.getInfo ? port.getInfo() : {}, hex = v => v.toString(16).padStart(4, '0');
    log('Port ouvert à ' + S.machine.baud + ' bauds' + (info.usbVendorId ? ` (USB ${hex(info.usbVendorId)}:${hex(info.usbProductId)}).` : ' (pas un port USB : Bluetooth ou port intégré ?).'), 'msg');
    machine.rx = 0;
    watchSilence(port);
    readLoop();
    setTimeout(() => { writeRaw('\r\n\r\n'); rt(0x3f); }, 1500);
    machine.poll = setInterval(() => rt(0x3f), 250);
    $('#bConnect').textContent = 'Déconnecter'; $('#bConnect').classList.remove('pri');
  } catch (e) {
    if (e.name === 'NotFoundError') return; // fenêtre de choix fermée sans port
    const why = e.name === 'NetworkError' || /open/i.test(e.message) ? 'Le port est sans doute utilisé par un autre programme : ferme les autres onglets de l\'Atelier, Easel Driver, UGS, LightBurn, Candle…, ou débranche et rebranche le câble USB.' : '';
    log('Connexion impossible : ' + e.message + (why ? ' ' + why : ''), 'err'); alert('Connexion impossible : ' + e.message + (why ? '\n\n' + why : ''));
  }
}
async function disconnect() {
  if (job) { if (!confirm('Une gravure est en cours. Arrêter et déconnecter ?')) return; stopJob(); }
  if (machine.stopWait) await new Promise(r => { const t = setInterval(() => { if (!machine.stopWait) { clearInterval(t); r(); } }, 100); });
  clearInterval(machine.poll); const port = machine.port; machine.port = null;
  try { await machine.wchain; } catch (e) {}
  try { await machine.reader?.cancel(); } catch (e) {}
  try { machine.writer?.releaseLock(); } catch (e) {}
  try { await port?.close(); } catch (e) {}
  Object.assign(machine, { settingsAsked: false, grbl: {}, writer: null, reader: null, state: null, sub: null, stopWait: null, wpos: null, queue: [], inflight: [], used: 0 });
  $('#state').textContent = 'déconnectée'; $('#state').className = 'tag off';
  ['#wx', '#wy', '#wz'].forEach(id => $(id).textContent = '—');
  $('#bConnect').textContent = 'Connecter (USB)'; $('#bConnect').classList.add('pri');
  updateButtons(); draw();
}
if ('serial' in navigator) navigator.serial.addEventListener('disconnect', e => { if (machine.port && e.target === machine.port) { log('La machine a été débranchée.', 'err'); disconnect(); } });
else $('#serialBanner').style.display = 'block';
$('#bConnect').onclick = connect;
$('#bUnlock').onclick = () => sendLines(['$X']);
$('#bHalt').onclick = () => job ? stopJob() : safeStop(null);
$('#bHome').onclick = () => sendLines(['$H']);
let jogStep = 1;
$$('#steps button').forEach(b => b.onclick = () => { jogStep = +b.dataset.s; $$('#steps button').forEach(x => x.classList.toggle('on', x === b)); });
const canJog = () => machine.state === 'Idle' || machine.state === 'Jog';
function jog(axis, dir) {
  if (!machine.port || job) return;
  if (!canJog()) { // GRBL refuserait (error:8) : un seul message, pas un par appui
    if (Date.now() - machine.jogWarn > 3000) log(machine.state === 'Alarm' ? 'Déplacement impossible : machine en alarme. Clique « Déverrouiller », puis refais les zéros si la position a été perdue.' : `Déplacement impossible : machine pas prête (${$('#state').textContent}).`, 'err');
    machine.jogWarn = Date.now(); return;
  }
  const f = axis === 'Z' ? Math.min(S.machine.jogFeed, 500) : S.machine.jogFeed; sendLines([`$J=G91 G21 ${axis}${f3(dir * jogStep)} F${Math.round(f)}`], 'jog'); }
$$('[data-jog]').forEach(b => b.onclick = () => jog(b.dataset.jog[0], b.dataset.jog[1] === '+' ? 1 : -1));
document.addEventListener('keydown', e => {
  if (e.target.matches('input,select,textarea') || !machine.port || job || document.querySelector('dialog[open]')) return;
  const map = { ArrowLeft: ['X', -1], ArrowRight: ['X', 1], ArrowUp: ['Y', 1], ArrowDown: ['Y', -1], PageUp: ['Z', 1], PageDown: ['Z', -1] };
  if (map[e.key]) { e.preventDefault(); if (!e.repeat) jog(...map[e.key]); } // touche maintenue : pas de répétition (les pas s'empileraient et la machine continuerait après relâchement)
});
$$('[data-zero]').forEach(b => b.onclick = () => sendLines([`G10 L20 P1 ${b.dataset.zero}0`]));
$('#bZeroXY').onclick = () => sendLines(['G10 L20 P1 X0 Y0']);
$('#bGoZero').onclick = () => { const z = machine.wpos && machine.wpos[2] < S.machine.safeZ ? [`G90 G0 Z${f3(S.machine.safeZ)}`] : []; sendLines([...z, 'G90 G0 X0 Y0']); };
$('#bProbe').onclick = () => {
  if (!confirm(`Place la plaque de sonde sous la fraise et connecte la pince.\nLa fraise va descendre lentement jusqu'à ${S.machine.probeDist} mm.\n\nÉpaisseur de plaque utilisée : ${S.machine.probeT} mm.`)) return;
  sendLines(['G91', `G38.2 Z-${f3(S.machine.probeDist)} F80`, 'G90', `G10 L20 P1 Z${f3(S.machine.probeT)}`, 'G91', 'G0 Z5', 'G90']);
  log('Sonde lancée. Pense à retirer la plaque une fois terminé.', 'msg');
};
$('#bSend').onclick = () => { const v = $('#cmd').value.trim(); if (!v || !machine.port) return; if (v === '?') rt(0x3f); else sendLines([v]); $('#cmd').value = ''; };
$('#cmd').addEventListener('keydown', e => { if (e.key === 'Enter') $('#bSend').click(); });
$$('[data-ov]').forEach(b => b.onclick = () => rt({ reset: 0x90, inc: 0x91, dec: 0x92 }[b.dataset.ov]));


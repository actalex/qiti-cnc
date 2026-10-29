const launch = require('./navigateur');
(async () => {
  const b = await launch(); const p = await b.newPage({ viewport: { width: 1400, height: 860 } });
  const errs = []; p.on('pageerror', e => errs.push(e.message)); p.on('console', m => { if (m.type()==='error') errs.push(m.text()); });
  await p.addInitScript(() => {
    // Faux GRBL
    const enc = new TextEncoder(), dec = new TextDecoder();
    let ctrl; const st = { s: 'Idle', pos: [0,0,0], wco:[0,0,0], hold:false, buf:'' , rx:[], maxUsed:0, lines:0};
    window.__grbl = st;
    const emit = t => ctrl && ctrl.enqueue(enc.encode(t + '\r\n'));
    const port = {
      async open() {}, getInfo: () => ({ usbVendorId: 0x1a86, usbProductId: 0x7523 }),
      readable: new ReadableStream({ start(c) { ctrl = c; setTimeout(() => emit('8ÿþ徍T|B<Idle|MPos:0.000,0.000,0.000|FS:0,0>'), 50); } }),
      writable: new WritableStream({ write(chunk) {
        for (const byte of chunk) {
          // « Run » tant que des lignes arrivent ; le hold met 600 ms à décélérer (Hold:1 → Hold:0)
          const state = () => st.s === 'Idle' && Date.now() - (st.lastT || 0) < 300 ? 'Run' : st.s;
          if (byte === 0x3f) { emit(`<${state()}|MPos:${st.pos.map(v=>v.toFixed(3)).join(',')}|FS:0,0|WCO:0.000,0.000,0.000>`); continue; }
          if (byte === 0x21) { if (state() === 'Run') { st.s = 'Hold:1'; setTimeout(() => { if (st.s === 'Hold:1') st.s = 'Hold:0'; }, 600); } continue; }
          if (byte === 0x7e) { st.s = 'Idle'; continue; }
          if (byte === 0x18) { st.resetIn = state(); if (st.resetIn === 'Run' || st.resetIn === 'Hold:1') { st.s = 'Alarm'; emit('ALARM:3'); } else st.s = 'Idle'; st.lastT = 0; emit("Grbl 1.1h ['$' for help]"); continue; }
          if (byte >= 0x80) continue;
          const ch = String.fromCharCode(byte);
          if (ch === '\n') { const l = st.buf.trim(); st.buf = ''; if (!l) continue; st.lines++; st.rx.push(l); if (!l.startsWith('$')) st.lastT = Date.now();
            const m = /X(-?[\d.]+)/.exec(l); if (m && !l.startsWith('$')) st.pos[0]=+m[1];
            const used = st.rx.length; // not exact
            const reglages = '$11=0.010 $20=0 $22=0 $30=1000 $110=3000 $111=3000 $112=600 $120=200 $121=200 $122=50 $130=450 $131=455 $132=80'.split(' ');
            setTimeout(() => { if (l === '$$') reglages.forEach(emit); emit(l === '$BAD' ? 'error:3' : 'ok'); }, 1); }
          else if (ch !== '\r') { st.buf += ch; st.maxUsed = Math.max(st.maxUsed, st.buf.length); }
        }
      } }),
      async close() {}
    };
    Object.defineProperty(navigator, 'serial', { value: { requestPort: async () => port, addEventListener() {} } });
  });
  await p.goto('file://' + __dirname + '/../dist/atelier-cnc.html');
  await p.setInputFiles('#fSvg', __dirname + '/exemple.svg');
  await p.waitForTimeout(400);
  const names = await p.$$eval('#shapeList > div', d => d.map(x => x.textContent));
  console.log('formes:', names);
  // réglages : plaque = extérieur traversant, anneau = poche 2mm, trou = intérieur traversant, vague = ligne 0.5
  const set = async (idx, op, depth) => { await p.click(`#shapeList > div:nth-child(${idx})`); await p.selectOption('#sOp', op); await p.fill('#sDepth', String(depth)); await p.dispatchEvent('#sDepth','change'); };
  await set(1, 'outside', 6); await set(2, 'pocket', 2); await set(3, 'inside', 6); await set(4, 'on', 0.5); await set(5, 'pocket', 1);
  await p.waitForTimeout(400);
  const info = await p.evaluate(() => ({ t: $('#iTime').textContent, n: $('#iLines').textContent, d: $('#iDepth').textContent, w: $('#warns').textContent }));
  console.log(info);
  const g = await p.evaluate(() => window.__atelier.G.lines);
  require('fs').writeFileSync(__dirname + '/out.nc', g.join('\n'));
  for (const v of ['design','carve','paths']) { await p.click(`#viewbar [data-v=${v}]`); await p.waitForTimeout(150); await p.screenshot({ path: __dirname + `/shot-${v}.png` }); }
  // connexion + gravure
  await p.click('#bConnect'); await p.waitForTimeout(2000);
  console.log('état:', await p.textContent('#state'), 'carve disabled:', await p.$eval('#bCarve', b => b.disabled));
  // réglages $$ lus à la connexion : course et vitesse appliquées, accélérations pour l'estimation, lignes $ non affichées
  const reg = await p.evaluate(() => ({ m: window.__atelier.S.machine, log: $('#log').innerText }));
  console.log('réglages :', reg.m.w, reg.m.h, reg.m.rapid, JSON.stringify(reg.m.plan));
  if (reg.m.w !== 450 || reg.m.h !== 455 || reg.m.rapid !== 3000 || !reg.m.plan || reg.m.plan.acc[2] !== 50 || !reg.log.includes('Réglages de la carte appliqués') || reg.log.includes('$120=') || !reg.log.includes('(USB 1a86:7523)') || reg.log.includes('Aucune réponse') || !(await p.$eval('#bHome', b => b.disabled))) { console.error('ÉCHEC réglages'); process.exitCode = 1; }
  await p.fill('#cmd', '$BAD'); await p.press('#cmd','Enter'); await p.waitForTimeout(200);
  await p.click('[data-jog="X+"]'); await p.waitForTimeout(100);
  await p.click('#bCarve'); for (const c of await p.$$('#dlgCarve input[type=checkbox]')) await c.check();
  await p.click('#cGo');
  await p.waitForTimeout(1500); await p.screenshot({ path: __dirname + '/shot-run.png' });
  for (let k=0;k<60;k++){ const j = await p.evaluate(()=>!!window.__atelier.job); if(!j) break; await p.waitForTimeout(500); }
  const log = await p.$eval('#log', e => e.innerText);
  console.log(log.split('\n').slice(-8).join('\n'));
  console.log('lignes reçues par GRBL:', await p.evaluate(() => __grbl.lines), 'G-code:', g.length);
  console.log('erreurs:', errs);
  if (errs.length || !log.includes('Gravure terminée')) { console.error('ÉCHEC'); process.exitCode = 1; }
  // « Arrêter » en pleine gravure : le reset ne doit partir qu'une fois la machine arrêtée (Hold:0), sans alarme 3
  await p.waitForTimeout(500);
  await p.click('#bCarve'); for (const c of await p.$$('#dlgCarve input[type=checkbox]')) await c.check();
  await p.click('#cGo'); await p.waitForTimeout(400);
  p.once('dialog', d => d.accept()); await p.click('#bStop');
  for (let k = 0; k < 30; k++) { if (await p.evaluate(() => !window.__atelier.job && !window.__atelier.machine.stopWait)) break; await p.waitForTimeout(200); }
  const stop = await p.evaluate(() => ({ resetIn: __grbl.resetIn, state: window.__atelier.machine.state, log: $('#log').innerText.split('\n').slice(-4) }));
  console.log('arrêt :', stop);
  if (stop.resetIn !== 'Hold:0' || stop.log.some(l => l.includes('ALARME')) || !stop.log.some(l => l.includes('broche coupée'))) { console.error('ÉCHEC arrêt'); process.exitCode = 1; }
  // Deux fraises : poches et intérieur à la plate, « vague » en V, puis détourage de la plaque à la plate (3 étapes)
  await p.waitForTimeout(500);
  await p.evaluate(() => { const A = window.__atelier, v = A.S.tools.find(t => t.type === 'v'); A.D.shapes[3].tool = v.id; A.recompute(); });
  const carveStep = async () => {
    await p.click('#bCarve'); const z = await p.textContent('#cZ');
    for (const c of await p.$$('#dlgCarve input[type=checkbox]')) await c.check();
    await p.click('#cGo'); await p.waitForTimeout(300);
    for (let k = 0; k < 60; k++) { if (await p.evaluate(() => !window.__atelier.job)) break; await p.waitForTimeout(250); }
    await p.waitForTimeout(400);
    return { z, btn: await p.textContent('#bCarve'), last: await p.evaluate(() => $('#log').innerText.split('\n').slice(-1)[0]) };
  };
  const steps = await p.evaluate(() => window.__atelier.PLAN.map(P => P.tool.name));
  const s1 = await carveStep(), s2 = await carveStep(), s3 = await carveStep();
  console.log('étapes :', steps, s1, s2, s3);
  if (steps.length !== 3 || !steps[1].includes('V') || steps[0] !== steps[2] || s1.btn !== 'Graver l\'étape 2' || !s1.last.includes('Installe') || !s2.z.includes('refait') || !s3.last.includes('Dernière étape')) { console.error('ÉCHEC étapes'); process.exitCode = 1; }
  // Alarme : les flèches ne doivent rien envoyer (GRBL répondrait error:8), un seul message même touche maintenue
  await p.evaluate(() => { __grbl.s = 'Alarm'; }); await p.waitForTimeout(400);
  const nRx = await p.evaluate(() => __grbl.rx.length);
  for (let k = 0; k < 5; k++) await p.keyboard.press('ArrowUp');
  await p.keyboard.down('ArrowDown'); await p.waitForTimeout(600); await p.keyboard.up('ArrowDown');
  await p.waitForTimeout(300);
  const al = await p.evaluate(n => ({ jogs: __grbl.rx.slice(n).filter(l => l.startsWith('$J')).length, msgs: $('#log').innerText.split('\n').filter(l => l.includes('machine en alarme')).length, err8: $('#log').innerText.includes('error:8'), btn: document.querySelector('[data-jog]').disabled }), nRx);
  console.log('alarme :', al);
  if (al.jogs || al.msgs !== 1 || al.err8 || !al.btn) { console.error('ÉCHEC jog en alarme'); process.exitCode = 1; }
  await b.close();
})();

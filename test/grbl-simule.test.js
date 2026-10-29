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
      async open() {},
      readable: new ReadableStream({ start(c) { ctrl = c; setTimeout(() => emit("Grbl 1.1h ['$' for help]"), 50); } }),
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
            setTimeout(() => emit(l === '$BAD' ? 'error:3' : 'ok'), 1); }
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
  await b.close();
})();

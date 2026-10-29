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
          if (byte === 0x3f) { emit(`<${st.s}|MPos:${st.pos.map(v=>v.toFixed(3)).join(',')}|FS:0,0|WCO:0.000,0.000,0.000>`); continue; }
          if (byte === 0x21) { st.s = 'Hold:0'; continue; } if (byte === 0x7e) { st.s = 'Idle'; continue; }
          if (byte === 0x18) { st.s='Idle'; emit("Grbl 1.1h ['$' for help]"); continue; }
          if (byte >= 0x80) continue;
          const ch = String.fromCharCode(byte);
          if (ch === '\n') { const l = st.buf.trim(); st.buf = ''; if (!l) continue; st.lines++; st.rx.push(l);
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
  await b.close();
})();

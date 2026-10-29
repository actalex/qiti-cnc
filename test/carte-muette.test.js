// Carte muette (ESP32 figé) : la page propose un redémarrage par RTS, puis la carte répond
const launch = require('./navigateur');
(async () => {
  const b = await launch(); const p = await b.newPage();
  const errs = []; p.on('pageerror', e => errs.push(e.message));
  await p.addInitScript(() => {
    const enc = new TextEncoder(); let ctrl, alive = false, rts = false; window.__sig = [];
    const emit = t => ctrl.enqueue(enc.encode(t + '\r\n'));
    const port = {
      async open() {}, async close() {}, getInfo: () => ({ usbVendorId: 0x1a86, usbProductId: 0x7523 }),
      async setSignals(s) { window.__sig.push(JSON.stringify(s)); if (s.requestToSend) rts = true; else if (rts) { rts = false; alive = true; setTimeout(() => emit("Grbl 1.1h ['$' for help]"), 100); } },
      readable: new ReadableStream({ start(c) { ctrl = c; } }),
      writable: new WritableStream({ write(chunk) { if (!alive) return; for (const byte of chunk) {
        if (byte === 0x3f) emit('<Idle|MPos:0.000,0.000,0.000|FS:0,0>');
        else if (byte === 0x0a) emit('ok');
      } } })
    };
    Object.defineProperty(navigator, 'serial', { value: { requestPort: async () => port, addEventListener() {} } });
  });
  await p.goto('file://' + __dirname + '/../dist/atelier-cnc.html');
  let asked = ''; p.on('dialog', d => { asked = d.message(); d.accept(); });
  await p.click('#bConnect'); await p.waitForTimeout(6500);
  const r = await p.evaluate(() => ({ state: $('#state').textContent, sig: window.__sig, log: $('#log').innerText }));
  console.log('carte muette :', r.state, r.sig, r.log.split('\n').slice(-5));
  const ok = asked.includes('figée') && r.sig.length === 2 && r.log.includes('Redémarrage de la carte demandé') && r.log.includes('Grbl 1.1h') && r.state === 'Prête' && !r.log.includes('toujours pas') && !errs.length;
  if (!ok) { console.error('ÉCHEC carte muette', errs); process.exitCode = 1; } else console.log('carte muette : OK');
  await b.close();
})();

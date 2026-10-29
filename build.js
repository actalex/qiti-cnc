// Construit dist/atelier-cnc.html : une page autonome avec Clipper intégré.
const fs = require('fs'), path = require('path');
const { minify } = require('terser');
(async () => {
  const src = fs.readFileSync(path.join(__dirname, 'src/atelier-cnc.src.html'), 'utf8');
  const raw = fs.readFileSync(require.resolve('clipper-lib/clipper.js'), 'utf8');
  const min = (await minify(raw, { compress: true, mangle: true })).code.replace(/<\/script/gi, '<\\/script');
  const lic = '/* Clipper 6.4.2 — (c) Angus Johnson 2010-2017 — Boost Software License 1.0 — http://www.angusj.com */\n';
  fs.mkdirSync(path.join(__dirname, 'dist'), { recursive: true });
  const out = path.join(__dirname, 'dist/atelier-cnc.html');
  fs.writeFileSync(out, src.replace('/*CLIPPER*/', () => lic + min));
  console.log('dist/atelier-cnc.html', fs.statSync(out).size, 'octets');
})();

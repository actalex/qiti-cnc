// Construit dist/atelier-cnc.html : une page autonome avec Clipper et les fichiers de src/ intégrés.
const fs = require('fs'), path = require('path');
const { minify } = require('terser');
(async () => {
  // /*INCLUDE:x.js*/ : insère src/x.js (le script reste découpé en fichiers courts, la page reste un seul fichier)
  const src = fs.readFileSync(path.join(__dirname, 'src/atelier-cnc.src.html'), 'utf8')
    .replace(/\/\*INCLUDE:([\w.-]+)\*\/\n/g, (_, f) => fs.readFileSync(path.join(__dirname, 'src', f), 'utf8'));
  const raw = fs.readFileSync(require.resolve('clipper-lib/clipper.js'), 'utf8');
  const min = (await minify(raw, { compress: true, mangle: true })).code.replace(/<\/script/gi, '<\\/script');
  const lic = '/* Clipper 6.4.2 — (c) Angus Johnson 2010-2017 — Boost Software License 1.0 — http://www.angusj.com */\n';
  fs.mkdirSync(path.join(__dirname, 'dist'), { recursive: true });
  const out = path.join(__dirname, 'dist/atelier-cnc.html');
  fs.writeFileSync(out, src.replace('/*CLIPPER*/', () => lic + min));
  console.log('dist/atelier-cnc.html', fs.statSync(out).size, 'octets');
})();

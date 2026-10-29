# QiTi-CNC — Atelier CNC

Une FAO 2,5D et le pilotage GRBL réunis dans **une seule page HTML autonome**, sans serveur et sans installation, dans l'esprit d'Easel. Elle est pensée pour la **TwoTrees TTC450 Pro**, mais fonctionne avec toute machine GRBL 1.1.

## Utilisation

1. Double-clique sur `lancer.bat` : il sert `dist/` sur `http://localhost:8000` et ouvre la page.
   La connexion USB (Web Serial) ne fonctionne que dans **Chrome ou Edge**, en `http://localhost` ou en https.
2. Importe un SVG ou glisse-le sur la zone de travail. Les textes doivent être convertis en chemins dans Inkscape.
3. Règle le matériau, l'origine (coin avant-gauche ou centre) et la fraise (plate ou en V).
4. Clique sur les formes pour choisir l'usinage : contour extérieur, contour intérieur, sur la ligne ou poche, avec la profondeur.
5. Vérifie avec « Aperçu fraisage » et « Trajectoires ».
6. Connecte la machine, fais les zéros (jog, « Zéro XY ici », sonde Z), puis clique sur **Graver**.

Les réglages (machine, fraises) sont conservés dans le navigateur. Un projet (SVG + usinages) s'enregistre dans un fichier `.cnc.json`.

## Développement

```bash
npm install
npx playwright install chromium   # une seule fois, pour les tests
npm run build                     # src/atelier-cnc.src.html -> dist/atelier-cnc.html
npm test                          # build + test complet avec un GRBL simulé
```

- On modifie toujours `src/atelier-cnc.src.html`. Le fichier `dist/atelier-cnc.html` est généré, mais il est versionné pour rester utilisable sans `npm`.
- Clipper (calcul des décalages) est minifié et intégré à la place du marqueur `/*CLIPPER*/`.

## Fonctions

- **Import SVG** : chemins, rect (y compris arrondis), cercle, ellipse, ligne, polyligne, polygone, transformations imbriquées, unités mm, cm, in et px.
- **Usinages** : contour extérieur et intérieur avec compensation du rayon, gravure sur la ligne, poche avec îlots, passes multiples, attaches sur les découpes traversantes, sens conventionnel ou en avalant.
- **Fraises en V** : gravure « sur la ligne » ; la largeur du trait selon la profondeur est affichée et prévisualisée.
- **Ordre d'usinage** : gravures, puis poches, puis contours intérieurs, puis contours extérieurs ; plus proche voisin dans chaque catégorie.
- **GRBL** : streaming par comptage de caractères (buffer de 127 octets), jog, zéros, sonde Z, déverrouillage, homing, pause, reprise, arrêt, réglage d'avance, console.

## Limites connues / à faire

- Une seule fraise par gravure. À faire : une fraise par forme, avec enchaînement de gravures et pause pour le changement d'outil et le zéro Z.
- Pas de V-carve à profondeur variable, pas d'entrée en rampe.
- `<text>` et `<use>` sont ignorés.
- Pas encore testé sur la vraie machine. Commencer par une passe à vide, avec le zéro Z environ 20 mm au-dessus du brut.

## Licences

Code du projet : © QiTi Atelier. Clipper 6.4.2 : © Angus Johnson, Boost Software License 1.0.

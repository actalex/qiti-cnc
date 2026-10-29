# QiTi-CNC — contexte pour Claude Code

Application « à la Easel », réécrite de zéro (aucun code d'Easel/Inventables ne doit être copié) : une page HTML **autonome** qui fait la FAO 2,5D à partir d'un SVG et pilote une CNC GRBL via **Web Serial**. Machine cible : TwoTrees TTC450 Pro (course 460×460×80 mm, GRBL 1.1, 115200 bauds, broche 775 pilotée par `M3 S`, $30=1000 par défaut).

## Règles
- Interface et messages **en français**.
- Éditer **`src/atelier-cnc.src.html`** uniquement, puis `npm run build` (régénère `dist/atelier-cnc.html`, à committer aussi).
- Tout reste dans un seul fichier (HTML + CSS + JS vanilla, pas de framework, pas de CDN : la page doit marcher hors ligne). Seule dépendance : Clipper, intégrée au build.
- Après chaque modification : `npm test` (Playwright + faux port série GRBL, voir `test/grbl-simule.test.js`) et vérifier les captures `test/shot-*.png`.
- Sécurité machine : ne jamais émettre de mouvement sans Z de dégagement, garder la liste de vérification avant gravure, arrêter le flux sur toute `error:` ou `ALARM:` pendant une gravure.

## Architecture (sections du script, dans l'ordre)
1. **Réglages persistants** — `S` (machine, brut, fraises, attaches, sens, origine) dans `localStorage` clé `atelier-cnc-v1`. Fraises : `{name, type:'flat'|'v', d, angle, tip, feed, plunge, doc, so}`.
2. **Import SVG** — `importSVG()` : parse le SVG dans un conteneur caché, cumule les `transform` des ancêtres, `parsePathD()` maison (tous les cmd + arcs), discrétisation à 0,02 mm, conversion en mm via viewBox/width/height. Résultat : `shapes[{name, subpaths[{pts, closed}], op, depth}]` en coordonnées SVG (y vers le bas).
3. **FAO** — `computeCAM()` : `toStockFn()` place/inverse en coordonnées brut (y vers le haut, origine coin avant-gauche). Clipper (échelle 1000) : union pair-impair, offsets ±r, poches par offsets successifs. Orientation des boucles inversée selon conventionnel/avalant. `loopWithTabs()` pour les attaches. Groupes ordonnés : on → pocket → inside → outside.
4. **G-code** — `buildGcode()` : coordonnées décalées par `originOff()` (centre ou coin), `moves[]` (pour l'aperçu, en coordonnées brut) et `lineMove[]` (ligne → mouvement, pour la progression).
5. **Vue** — canvas, vues « Dessin / Aperçu fraisage / Trajectoires », zoom molette, déplacement à la souris, sélection par clic (Maj = multi).
6. **GRBL / Web Serial** — objet `machine` : file `queue`, `inflight`, comptage de caractères (`RX_BUF = 127`), interrogation `?` toutes les 250 ms, `parseStatus()` (MPos/WPos/WCO/Ov), commandes temps réel (`!` `~` 0x18 0x90-0x92).
7. **Gravure** — `startJob/feedJob/stopJob/abortJob/finishJob`.

`window.__atelier` expose l'état pour les tests.

## Pistes suivantes (par priorité)
1. Fraise par forme + enchaînement de gravures avec pause changement d'outil et re-zéro Z (GRBL n'autorise pas le jog en Hold : découper en jobs séparés plutôt que `M0`).
2. Entrée en rampe pour les contours/poches.
3. V-carve à profondeur variable (axe médian).
4. Simulation 3D (carte de hauteurs) et estimation de temps tenant compte des accélérations ($120-$122).
5. Lecture des réglages `$$` à la connexion (limites logicielles, $30) pour pré-remplir la config machine.

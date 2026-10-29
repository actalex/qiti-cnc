# QiTi-CNC — contexte pour Claude Code

Application « à la Easel », réécrite de zéro (aucun code d'Easel/Inventables ne doit être copié) : une page HTML **autonome** qui fait la FAO 2,5D à partir d'un SVG et pilote une CNC GRBL via **Web Serial**. Machine cible : TwoTrees TTC450 Pro (course 460×460×80 mm, GRBL 1.1, 115200 bauds, broche 775 pilotée par `M3 S`, $30=1000 par défaut).

## Règles
- Interface et messages **en français**.
- Éditer **`src/atelier-cnc.src.html`** uniquement, puis `npm run build` (régénère `dist/atelier-cnc.html`, à committer aussi).
- Tout reste dans un seul fichier (HTML + CSS + JS vanilla, pas de framework, pas de CDN : la page doit marcher hors ligne). Seule dépendance : Clipper, intégrée au build.
- Après chaque modification : `npm test` (Playwright, ou Edge à défaut : `test/vcarve.test.js` vérifie les profondeurs, `test/grbl-simule.test.js` simule GRBL) et vérifier les captures `test/shot-*.png`.
- Sécurité machine : ne jamais émettre de mouvement sans Z de dégagement, garder la liste de vérification avant gravure, arrêter le flux sur toute `error:` ou `ALARM:` pendant une gravure.

## Architecture (sections du script, dans l'ordre)
1. **Réglages persistants** — `S` (machine, brut, fraises, attaches, sens, origine) dans `localStorage` clé `atelier-cnc-v1`. Fraises : `{name, type:'flat'|'v', d, angle, tip, feed, plunge, doc, so}`.
2. **Import SVG** — `importSVG()` : parse le SVG dans un conteneur caché, cumule les `transform` des ancêtres, `parsePathD()` maison (tous les cmd + arcs), discrétisation à 0,02 mm, conversion en mm via viewBox/width/height. Résultat : `shapes[{name, subpaths[{pts, closed}], op, depth}]` en coordonnées SVG (y vers le bas).
3. **FAO** — `computeCAM()` : `toStockFn()` place/inverse en coordonnées brut (y vers le haut, origine coin avant-gauche). Clipper (échelle 1000) : union pair-impair, offsets ±r, poches par offsets successifs. Orientation des boucles inversée selon conventionnel/avalant. `loopWithTabs()` pour les attaches. Remplissage en V (`vcarve`, fraise en V) : anneaux décalés vers l'intérieur tous les `VSTEP` = 0,1 mm, profondeur (o − pointe/2)/tan(angle/2), plafonnée (fond plat). Formes ignorées dans `CAM.skipped` (affichées dans la liste). Groupes ordonnés : on → pocket/vcarve → inside → outside.
4. **G-code** — `buildGcode()` : coordonnées décalées par `originOff()` (centre ou coin), `moves[]` (pour l'aperçu, en coordonnées brut) et `lineMove[]` (ligne → mouvement, pour la progression).
5. **Vue** — canvas, vues « Dessin / Aperçu fraisage / Trajectoires », zoom molette, déplacement à la souris, sélection par clic (Maj = multi).
6. **GRBL / Web Serial** — objet `machine` : file `queue`, `inflight`, comptage de caractères (`RX_BUF = 127`), interrogation `?` toutes les 250 ms, `parseStatus()` (MPos/WPos/WCO/Ov), commandes temps réel (`!` `~` 0x18 0x90-0x92).
7. **Gravure** — `startJob/feedJob/stopJob/abortJob/finishJob`. Arrêt sûr `safeStop()` / `checkStop()` : feed hold, reset seulement à `Hold:0` (sinon alarme 3), délai max 10 s ; bouton « Stop » du panneau Machine.

`window.__atelier` expose l'état pour les tests.

## Pistes suivantes (analyse du 2026-10-29, par priorité)
**1. Fiabilité**
- Découper la source en fichiers (import SVG, FAO, G-code, machine, interface) assemblés par `build.js` en une seule page.
- Sauvegarde automatique du projet (recharger la page perd le dessin non enregistré).
- Étendre les tests à assertions (offsets, attaches, G-code).

**2. Se rapprocher d'Easel**
- Fraise par forme + enchaînement de gravures avec pause changement d'outil et re-zéro Z (GRBL n'autorise pas le jog en Hold : découper en jobs séparés plutôt que `M0`).
- Réglages par matériau (essences, acrylique) : avance, plongée, profondeur par passe pré-remplies selon la fraise.
- Aperçu 3D réaliste (carte de hauteurs).
- Attaches placées à la main en cliquant sur le contour.
- Édition sur le plan de travail : déplacer, redimensionner, tourner, aligner, annuler.
- Texte avec polices intégrées (bibliothèque de lecture de polices intégrée au build, comme Clipper).

**3. Qualité d'usinage et machine**
- Poches et remplissage en V : rester dans la matière entre anneaux quand c'est sûr au lieu de remonter au Z de sécurité ; affiner le dernier anneau V sur l'axe médian.
- Entrée en rampe plutôt que plongée verticale.
- Lire `$$` à la connexion (course, $30) ; estimation de durée avec les accélérations ($120-$122).

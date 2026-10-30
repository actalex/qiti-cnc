# QiTi-CNC — Atelier CNC

**FAO 2,5D et pilotage GRBL réunis dans une seule page HTML**, sans serveur, sans installation, sans compte et hors ligne. Tu dessines dans Inkscape, tu importes le SVG, tu choisis les usinages, tu regardes le relief de la pièce, et tu graves en USB depuis le navigateur.

Pensé et testé sur une **TwoTrees TTC450 Pro**, il fonctionne avec toute machine **GRBL 1.1**.

> *English: try it at https://actalex.github.io/qiti-cnc/ (Edge or Chrome). A self-contained, offline web page that turns SVG drawings into 2.5D toolpaths (contours, pockets, V-carving, tabs, multi-tool jobs) and streams them to a GRBL 1.1 CNC over Web Serial. UI in French. GPL-3.0.*

Projet indépendant, sans lien avec Inventables (Easel) ni TwoTrees. L'ergonomie s'inspire d'Easel, mais le code est écrit de zéro.

## Démarrer

**En ligne, sans rien installer : [actalex.github.io/qiti-cnc](https://actalex.github.io/qiti-cnc/)**, à ouvrir dans Edge ou Chrome. La page fonctionne ensuite dans ton navigateur ; tes dessins et réglages ne quittent pas ton ordinateur.

Ou en local :

1. Télécharge le dépôt (bouton *Code › Download ZIP*) ou clone-le.
2. Sous Windows, double-clique sur `lancer.bat` : il sert `dist/` sur `http://localhost:8000` et ouvre la page. Ailleurs : `python -m http.server 8000 --directory dist`.
3. Utilise **Edge ou Chrome** : la liaison USB (Web Serial) n'existe que dans ces navigateurs. Sous Firefox, la préparation et l'export du G-code marchent, mais pas la connexion à la machine.

Toute l'application tient dans `dist/atelier-cnc.html` : ce fichier suffit.

## Utilisation en bref

1. **Importer un SVG.** Les couleurs peuvent décider des usinages (voir plus bas), et la page Inkscape peut servir de brut.
2. **Régler** le brut (dimensions, épaisseur, origine), le matériau et les fraises (plates ou en V).
3. **Choisir l'usinage de chaque forme** : contour extérieur ou intérieur, sur la ligne, poche, remplissage en V, avec sa profondeur, sa fraise, et en option une passe de finition.
4. **Vérifier** dans les vues *Aperçu fraisage*, *Relief* (la pièce telle qu'elle sortira) et *Trajectoires*.
5. **Connecter la machine**, faire les zéros (déplacements manuels, « Zéro XY ici », « Zéro Z ici (papier) »), cocher la liste de vérification, puis cliquer sur **Graver**.

Les réglages restent dans le navigateur, et le dessin en cours est sauvegardé automatiquement. Un projet complet (SVG, usinages, fraises) s'enregistre dans un fichier `.cnc.json`.

### Préparer le SVG dans Inkscape

À l'import, une fenêtre propose de déduire les usinages des couleurs :

| Dans Inkscape | Dans l'atelier |
|---|---|
| Forme remplie, gris | Poche (ou remplissage en V), profondeur = noirceur × épaisseur du brut |
| Forme remplie, noir | Poche **traversante**, qui suit l'épaisseur du brut |
| Contour seul, gris | Gravure sur la ligne |
| Contour seul, noir, forme fermée | Découpe : extérieure, ou intérieure si elle est dans une autre |
| Blanc, ou ni remplissage ni contour | Non usiné ; une forme blanche posée **par-dessus** une poche y fait un îlot |

Le filtre Inkscape « Inverser » est reconnu, et l'épaisseur du trait est ignorée : seule la ligne centrale compte. Les dessins « modulaires », faits de formes qui se chevauchent, sont fusionnés au calcul. Conseils :
- Passer Inkscape en boîte englobante **géométrique**.
- Convertir les textes en chemins.
- Utiliser *Chemin › Contour en chemin* pour une rainure plus large que la fraise.

## Fonctions

- **Import SVG** : chemins, rectangles (même arrondis), cercles, ellipses, lignes, polylignes et polygones, transformations imbriquées, unités, page Inkscape utilisée comme brut.
- **Usinages** :
  - contours avec compensation du rayon de la fraise, poches avec îlots, gravure sur la ligne ;
  - remplissage en V, avec dégagement du fond à la fraise plate ;
  - passes de profondeur, entrée en rampe, attaches automatiques ou placées à la main ;
  - passe de finition (0,2 mm, en avalant) ;
  - surfaçage du brut ou de la table.
- **Plusieurs fraises** : une étape par fraise, enchaînées avec changement de fraise et nouveau zéro Z.
- **Édition sur le plan** : déplacer, tourner, annuler et rétablir.
- **Aperçus** : relief calculé avec la forme réelle de chaque fraise, trajectoires, durée estimée avec les accélérations lues sur la carte.
- **Pilotage GRBL** (Web Serial) : lecture des réglages de la carte (`$$`), déplacements manuels, zéros, pause propre (fraise relevée, broche arrêtée), arrêt sans perte de position, réglage d'avance, console.
- **Préréglages matériaux** : bois tendre, bois dur, MDF, contreplaqué, acrylique. Ce sont des valeurs de départ, à valider dans une chute.

## Sécurité

Une CNC peut blesser et casser du matériel. L'atelier applique des garanties vérifiées par des tests automatiques, listées dans [`docs/securite.md`](docs/securite.md) :
- jamais de déplacement rapide dans la matière ;
- descente en Z jamais plus rapide que la vitesse de plongée ;
- liste de vérification obligatoire, avec une alerte si les zéros n'ont pas été refaits depuis le démarrage de la carte ;
- arrêt sans alarme, et envoi stoppé sur toute erreur.

Restent indispensables : **un arrêt d'urgence physique**, les protections (lunettes, audition, aspiration), et un premier essai à vide puis dans une chute. Le logiciel est fourni **sans aucune garantie** (voir la licence).

## Développement

```bash
npm install
npx playwright install chromium   # une fois ; à défaut, les tests utilisent Edge s'il est installé
npm run build                     # src/ -> dist/atelier-cnc.html
npm test                          # build + tests (géométrie, G-code, édition, couleurs, GRBL simulé)
```

- La source est dans `src/` : `atelier-cnc.src.html`, plus les fichiers JS insérés par `/*INCLUDE:x.js*/`. Le build y ajoute Clipper. `dist/atelier-cnc.html` est généré mais versionné, pour rester utilisable sans `npm`.
- L'architecture est décrite dans [`CLAUDE.md`](CLAUDE.md).
- Chaque push est construit et testé par GitHub Actions.

Les contributions sont bienvenues : rapports de bogues, essais sur d'autres machines GRBL, réglages matériaux validés, améliorations. Ouvre une *issue* ou une *pull request*. Garde chaque fichier court, l'interface en français, et `npm test` au vert.

## Licence

QiTi-CNC — Copyright © 2026 Gatto.

Ce programme est un logiciel libre : tu peux le redistribuer et le modifier selon les termes de la **GNU General Public License**, version 3 ou (à ton choix) toute version ultérieure, publiée par la Free Software Foundation. Il est distribué dans l'espoir qu'il sera utile, mais **sans aucune garantie**, sans même la garantie implicite de qualité marchande ou d'adéquation à un usage particulier. Voir [`LICENSE`](LICENSE).

Composant intégré : [Clipper](http://www.angusj.com) 6.4.2, © Angus Johnson, Boost Software License 1.0 (compatible GPL).

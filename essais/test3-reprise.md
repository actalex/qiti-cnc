# Reprise après le test 3 (préparé le 2026-11-02)

Fichier de reprise : à lire au début de la session qui suit le test 3. Il dit ce qui est attendu de l'utilisateur, comment lire ses retours et quoi faire ensuite.

## État au départ
- Test 3 préparé : `essais/test3-decoupe.svg` et `essais/test3-fiche.md` (commit 743e578).
- Vérifié dans la page, sans machine : une seule étape, aucun avertissement, environ 6 min 37 s, 1601 lignes, 8 passes de 0,75 mm pour 6 mm. Attaches du trou à Z −4,5 (6 − 1,5). Les durées et le nombre de lignes changent un peu avec l'épaisseur saisie (mesure + 0,2).
- Fraise : plate 3,175 mm, réglages par défaut (600 mm/min, plongée 150, 0,8 mm par passe), rampe 3°, attaches 4 × 5 mm × 1,5 mm sur la plaque et 2 placées à la main sur le trou.
- Rien de neuf dans le code depuis le test 2 : ce test valide l'existant (découpe, poche, attaches, rampe) avant toute nouvelle fonction.

## Retours attendus de l'utilisateur
| Retour | Valeur prévue | Ce qu'il vérifie |
|---|---|---|
| Console complète | pas d'`error:` ni d'`ALARM:` | flux GRBL, sécurités |
| Durée réelle | ≈ estimation affichée (test 1 : 3:11 estimé, 3:07 réel) | `src/temps.js` |
| Plaque X × Y | 70,0 × 46,0 mm | décalage extérieur, échelle |
| Trou, deux diamètres | 20,0 mm | décalage intérieur, ovalisation |
| Poche, côtés | 24,0 × 24,0 mm | décalage de poche |
| Poche, profondeur | 2,0 mm | zéro Z au papier |
| Traversée | nette partout, sans peau | épaisseur + 0,2, planéité |
| Attaches | 6 présentes, ≈ 1,5 mm | `loopWithTabs`, attaches à la main |
| Marques de rampe | aucune ou légère | `rampPts` |
| Fond et parois | état, stries, brûlures, éclats | avance, recouvrement |
| Bruit, broche qui peine | — | réglages matériau |
| Photo avec une règle | — | — |

Demander aussi la matière (MDF ou essence de bois), l'épaisseur mesurée et celle saisie, et s'il a fait la passe à l'air.

## Lecture des écarts
- Plaque plus petite **et** trou plus grand du même écart e : la fraise coupe plus large. Diamètre effectif ≈ 3,175 + e. Proposer de corriger le diamètre de la fraise, pas le code.
- Plaque et trou plus grands tous les deux (ou plus petits tous les deux) : échelle des axes ($100/$101 = 800 pas/mm relevés) ou jeu mécanique. Ne pas toucher au code ; vérifier sur un déplacement long mesuré.
- Écart sur un seul axe : jeu ou courroie de cet axe.
- Profondeur de poche fausse de plus de 0,1 mm : zéro Z (papier 0,1 mm, `S.machine.probeT`) ou planéité de la martyre. Mesurer en plusieurs points.
- Peau au fond de la découpe : martyre pas plane ou épaisseur sous-estimée. Ne pas ajouter de surcoupe automatique sans en parler : l'utilisateur veut peu d'options.
- Pastille du trou arrachée ou projetée : attaches trop faibles. Regarder la hauteur réelle avant de changer les valeurs par défaut.
- Alarme 1 ou `Pn:Z` : fin de course Z active, cause encore inconnue (vue aux tests 1 et 2). Demander le câblage, ne rien supposer.

## Ensuite, selon le résultat
1. **Test réussi** : noter les cotes mesurées dans la fiche (comme `fd03cb8` pour le test 2), corriger `src/materiaux.js` pour le matériau utilisé si l'utilisateur donne un avis sur la coupe, puis passer au **point de zéro Z au changement de fraise** (feuille de route de `CLAUDE.md`). Il sera validé par un test 4 à deux fraises : plate, puis V.
2. **Écart venant du code** : corriger, ajouter un test dans `test/gcode.test.js`, mettre à jour `docs/securite.md` s'il s'agit d'une garantie, puis refaire le test 3.
3. **Écart venant de la machine** (échelle, jeu, fins de course) : guider le réglage, sans changer le code.

Ordre ensuite (règle de l'utilisateur : pas de nouvelle fonction tant que la précédente n'est pas validée sur la machine) : point de zéro Z → reprise d'une gravure interrompue → relief 3D depuis une image en niveaux de gris (le vrai objectif de l'utilisateur) → chanfrein et marqueterie en V.

## Matériel de l'utilisateur
- Fraises boule : finalement présentes (livrées avec la machine, signalé le 2026-11-04) ; dimensions à relever (diamètre ou rayon du bout, cylindrique ou conique) avant le relief 3D.

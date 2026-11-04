# Reprise après le test 4 (préparé le 2026-11-04)

À lire au début de la session qui suit le test 4.

## État au départ
- Test 3 validé (résultats dans `test3-fiche.md`). Les cotes un peu courtes sont jugées suffisantes par l'utilisateur, qui ne veut pas de réglage d'échelle pour l'instant.
- Point de zéro Z codé dans `src/pointz.js` : `zeroPoint(PLAN)`, fin des étapes intermédiaires au point (`buildGcode(step, park)`), bouton « Aller au point de zéro Z », repère bleu. Testé dans `test/gcode.test.js` (point dans le brut, surface intacte, fins d'étape).
- Test 4 vérifié dans la page, sans machine : 2 étapes (plate ≈ 1:29, V 30° ≈ 7:06, épaisseur 5,2), aucun avertissement, point en (6,75 ; 6,75).

## Retours attendus
| Retour | Valeur prévue | Ce qu'il vérifie |
|---|---|---|
| Console | ni `error:` ni `ALARM:` | flux, sécurités |
| Fin de l'étape 1 | fraise au-dessus du point bleu, Z sûr | `park` dans `buildGcode` |
| Bouton « Aller au point de zéro Z » | déplacement sans descente | `#bGoZP` |
| Poche | 2,0 mm | zéro Z de la plate |
| Étoile | aucune marche fond plat / pentes V | concordance des deux zéros Z |
| Point de zéro Z | bois intact | choix du point (`ZP_GAP`, `ZP_EDGE`) |
| Durées | ≈ estimations | `temps.js` (fraise en V) |

## Lecture
- Marche dans l'étoile : écart entre les deux zéros Z (papier, fraise qui glisse dans la pince, ou surface pas plane entre les deux points, ce qui est impossible ici puisque le point est le même). Ce n'est pas le code, sauf si la fraise n'était pas au point bleu.
- Fraise pas au point à la fin de l'étape 1, ou trace de fraise sur le point : bug, à corriger avec un test dans `test/gcode.test.js`.

## Ensuite
Test réussi : noter les résultats dans `test4-fiche.md`, puis passer à la **reprise d'une gravure interrompue** (feuille de route de `CLAUDE.md`), puis au relief 3D (fraise boule à acheter avant l'essai sur la machine).

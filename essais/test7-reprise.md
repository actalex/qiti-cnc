# Reprise après le test 7 (préparé le 2026-11-08)

À lire au début de la session qui suit le test 7. Les fichiers `test3-reprise.md` et `test4-reprise.md` sont périmés : l'état réel est dans les sections « Résultats » des fiches.

## État au départ
- Test 6 (relief 3D) **validé** le 2026-11-08 : résultats dans `test6-fiche.md`. Commit ffea7c5, **pas poussé** : la page en ligne (GitHub Pages) n'a pas le garde-fou, le test 7 se fait avec `dist/atelier-cnc.html` en local.
- Garde-fou broche codé dans `src/broche.js`. Une étiquette `#spState` lit `A:` dans les rapports d'état qui portent `Ov`. Si une gravure est en cours, qu'un `M3` a été acquitté et qu'un rapport `Ov` arrive sans `A:S`, la page appelle `abortJob` (feed hold, puis question arrêt ou pause). Le garde-fou n'est actif qu'après avoir vu une fois la broche allumée (`S.machine.spReport`). Il est testé en simulation seulement (`test/grbl-simule.test.js`, `__grbl.spFail`).
- Ce qu'on ne sait pas : si la carte ESP32 « LaserBox_E » envoie bien `Ov`/`A:`, et à quelle fréquence. Cause de la broche pas relancée au test 6 : inconnue. Après le Stop, l'utilisateur n'avait pas touché au variateur ; le programme repris contenait bien `M3 S…`.

## Retours attendus
| Retour | Valeur prévue | Ce qu'il vérifie |
|---|---|---|
| Étiquette après `M3 S1000` | « broche en marche » en moins de 5 s | la carte envoie `A:S` |
| Étiquette après `M5` | « broche arrêtée » | `Ov` sans `A` |
| Gravure à l'air, broche qui tourne | aucune alerte | pas de fausse alerte |
| 3 reprises après Stop | broche relancée, ou pause automatique avec message | garde-fou sur la machine |
| Console | ni `error:` ni `ALARM:` | — |

## Lecture
- **Étiquette jamais affichée** : la carte n'envoie pas `A:` (ou pas `Ov`). Le garde-fou reste inactif. Il faudra une autre piste, à discuter, sans rien supposer sur la carte. On peut par exemple regarder les rapports d'état bruts : ajouter un affichage de diagnostic dans la console.
- **Étiquette affichée en retard (plus de 2 s)** : la carte n'envoie pas `Ov` dès que la broche change. Pendant une reprise, la pause arriverait après la temporisation de 2 s, pendant la descente. Proposer d'attendre le premier rapport `Ov` après le `M3` avant d'envoyer la suite du programme.
- **Fausse alerte broche qui tourne** : regarder ce que contient `A:` (peut-être `A:SF` ou autre). Corriger l'expression de `spindleReport` et ajouter le cas au test.
- **Défaut reproduit et garde-fou déclenché** : le garde-fou fonctionne. Chercher la cause avec la console : ce qui a été envoyé entre le reset et le `M3`.
- **Défaut reproduit, garde-fou silencieux** : la carte a dit « broche en marche » alors qu'elle ne tournait pas. Le problème est donc matériel (relais, variateur) ou propre à cette carte. Ne pas deviner, demander des observations.

## Ensuite
1. Test réussi : noter les résultats ici et dans `CLAUDE.md`, puis **pousser** après accord de l'utilisateur (Pages publie à chaque push).
2. **Page lente avec un gros relief** : l'utilisateur pense aux recalculs, ce que confirment les mesures (hors machine, PC de dev : activation du relief ≈ 1 s, `recompute` ≈ 0,5 s, `heightMap` de la vue Relief ≈ 0,4 s, `zeroPoint` ≈ 0,1 s ; au repos, moins d'1 ms par rapport d'état). Pistes : éviter les recalculs inutiles (après un Stop, en fin d'étape), réduire la résolution de la carte de la vue Relief, mettre en cache `zeroPoint`.
3. **Durées × 2 à 3 sur le relief** (≈ 14 lignes/s en finition, segments ≈ 0,2 mm). Les accélérations et le dessin sont écartés par calcul. Ajouter un relevé dans la console pendant la gravure : lignes par seconde, remplissage du tampon de GRBL (`Bf:` si la carte l'envoie). Cela montrera si la page envoie trop lentement ou si la carte limite.
4. Puis la feuille de route de `CLAUDE.md` : chanfrein, marqueterie en V.

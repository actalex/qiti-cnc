# Test 4 : deux fraises, zéro Z au point bleu

But : valider le **point de zéro Z** entre deux fraises. La page choisit un point du brut que rien n'usine (repère bleu « Zéro Z »). L'étape 1 s'y termine, et le zéro Z de chaque fraise se fait au même endroit. Si les deux zéros sont cohérents, le fond dégagé à la plate et les pentes en V se raccordent sans marche.
Fichier : `essais/test4-deux-fraises.svg` (page 80 × 50 mm = le brut) : une étoile (remplissage en V, fond dégagé à la plate), un carré de 16 × 16 mm (poche témoin) et un trait (gravure en V sur la ligne).
Deux étapes, environ **8 min 35 s** : étape 1 à la fraise plate 3,175 mm (≈ 1 min 30 s), puis étape 2 à la fraise en V 30° (≈ 7 min).

## Matériel
- Une chute plane d'au moins **100 × 70 mm** (le contreplaqué de 5 mm du test 3 convient). Rien ne traverse : pas besoin de martyre.
- La fraise plate 3,175 mm et la fraise en V 30° (pointe 0,1), une feuille de papier, le pied à coulisse.

## 1. Préparer dans la page
1. **Importer un SVG** → `test4-deux-fraises.svg`. Laisse cochée « La page Inkscape est le brut » (80 × 50), garde ton épaisseur, puis clique **Appliquer les couleurs**.
2. **Formes** : règle la liste ainsi.
   | Forme | Usinage | Fraise | Profondeur |
   |---|---|---|---|
   | etoile | Remplissage en V | Fraise en V 30° (pointe 0,1), **« Dégager le fond » : Fraise plate 3,175** | 2 |
   | poche | Poche | Fraise plate 3,175 | 2 |
   | trait | Sur la ligne | Fraise en V 30° (pointe 0,1) | 0,5 |
3. À vérifier sous l'aperçu : **2 étapes** (plate, puis V), **aucun avertissement ⚠**, et le **repère bleu « Zéro Z »** près du coin avant-gauche, hors du dessin. Dans le panneau Machine, le bouton **Aller au point de zéro Z** apparaît.

## 2. Étape 1 : fraise plate
1. Connecte la machine (Edge). Fixe la chute et installe la fraise plate.
2. **Zéro X/Y** au coin avant-gauche de la chute (« Zéro XY ici »).
3. Remonte un peu Z, puis clique **Aller au point de zéro Z**. La page demande une confirmation, puisque le zéro Z n'est pas encore fait : vérifie que la fraise est au-dessus du brut. La fraise se place sur le point bleu.
4. **Zéro Z au papier** à cet endroit.
5. Lance l'**étape 1**. À la fin, la fraise **s'arrête au-dessus du point bleu**, broche coupée (et non au coin X0 Y0). La console te dit de changer de fraise.

## 3. Étape 2 : fraise en V
1. Sans toucher à X/Y : remonte Z si la fraise en V dépasse plus que la plate, puis change de fraise.
2. **Zéro Z au papier**, au même endroit (la fraise n'a pas bougé en X/Y). Si besoin, « Aller au point de zéro Z » t'y ramène.
3. Lance l'**étape 2**. La liste de vérification doit dire « zéro Z refait… au point de zéro Z ».

## 4. À me renvoyer
- **Console** complète.
- **Fin de l'étape 1** : la fraise s'est-elle bien arrêtée au-dessus du point bleu ?
- **Durées réelles** des deux étapes (estimées ≈ 1:29 et ≈ 7:06 ; elles changent un peu avec l'épaisseur et tes vitesses).
- **Poche** : profondeur prévue **2,0 mm**, mesurée à la jauge du pied à coulisse.
- **Étoile** : y a-t-il une **marche** entre le fond plat (fraise plate) et le bas des pentes en V, ou dans les pointes ? Passe l'ongle dessus. Si oui, est-ce une marche vers le haut ou vers le bas, et de combien environ ?
- **Point de zéro Z** : le bois y est-il intact (aucune trace de fraise à part le papier) ?
- Une **photo** avec une règle.

### Lecture
- Pas de marche dans l'étoile et poche à 2,0 mm : les deux zéros Z concordent, le point de zéro Z est validé.
- Fond des pointes en V **plus bas** que le fond plat : le zéro Z de la fraise en V est trop bas, de la hauteur de la marche. Plus haut : trop haut. Vérifie que le papier est le même et que la fraise n'a pas glissé dans la pince.

## Résultats (2026-11-05)
Photo : `test4-resultat.jpg`, dessin réellement usiné : `test4-capture.png`. L'utilisateur a volontairement **posé le carré sur l'étoile** (au lieu de les séparer) pour comparer directement les deux profondeurs.

- **Console** : ni `error:` ni `ALARM:`.
- **Point de zéro Z** : « Aller au point de zéro Z » (G0 X6.75 Y6.75) puis zéro au papier ; fin de l'étape 1 au point bleu, zéro Z de la fraise en V refait au même endroit. Validé.
- **Raccord des deux fraises** : fond plat de l'étoile, pentes en V et fond de la poche au même niveau, « parfait » à l'œil et au toucher : les deux zéros Z concordent.
- **Coupure en cours d'étape 2** : batterie de l'ordinateur à plat. Pause, Stop, reconnexion, puis l'étape 2 relancée depuis le début : le zéro pièce (G54) est resté dans la carte, la reprise s'est faite sans défaut visible. Au rapport de l'utilisateur : « je n'y serais jamais arrivé aussi bien avec Easel ».
- **Durées** : étape 1 en 1 min 51 s (estimée ≈ 1:29), étape 2 en 9 min 14 s (estimée ≈ 7:06, relancée complète). Estimation trop courte de ≈ 25-30 % ici, alors qu'elle était juste au test 3 (10:40 pour 10:45) : à regarder (vitesses modifiées ? remplissage en V à petits segments ?).
- **Défaut constaté** : une fine **paroi** reste entre l'étoile et le carré. Cause : avec le recouvrement (`D.stack`), le carré retire sa surface de l'étoile, dont le contour suit alors le bord du carré ; le remplissage en V y remonte en pente jusqu'à la surface, face à la paroi verticale de la poche, d'où une arête de matière. N'apparaît que pour un V en contact avec une poche. Jugé **pas grave, laissé tel quel** (utilisateur). Correction possible plus tard : calculer les anneaux du V sur l'étoile entière, puis retirer seulement la surface du carré, quand la forme posée dessus est elle-même usinée au moins aussi profond.

### Conclusion
Test 4 validé : le point de zéro Z entre deux fraises fonctionne, et une gravure interrompue a pu être relancée.

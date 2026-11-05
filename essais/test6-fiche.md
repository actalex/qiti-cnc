# Test 6 : relief 3D (ébauche plate + finition boule)

But : premier relief 3D. On vérifie que la fraise boule suit la surface sans l'entailler, que l'ébauche laisse bien sa surépaisseur, que la finition est lisse, et on compare les durées.
Fichier : `essais/test6-relief.png` (400 × 240 px) : fond gris à 60 % (1,2 mm sous le dessus), un **dôme** qui remonte jusqu'au dessus du brut, une **cuvette** qui descend au fond (3 mm), une **rampe** en dégradé (du dessus au fond, pente régulière), un cadre blanc (bord au dessus du brut).
Deux étapes, environ **16 min** : ébauche à la fraise plate 3,175 (≈ 5 min 15 s), puis finition à la fraise boule 3,175 (≈ 10 min 40 s).

## Matériel
- Une chute plane d'au moins **80 × 50 mm** et 5 mm d'épaisseur ou plus. Le **bois massif** (hêtre, pin sans nœud) montre mieux le relief que le contreplaqué : à 3 mm, on traverse ses plis.
- La fraise plate 3,175 mm, la **fraise boule 3,175 mm** (livrée avec la machine), une feuille de papier, le pied à coulisse.

## 1. Préparer dans la page
1. Règle le brut : **80 × 50**, épaisseur de ta chute.
2. Vérifie dans **Fraise** que « Fraise boule 3,175 mm (R 1,59) » existe : la page l'ajoute d'office, avec 700 mm/min, plongée 150 et 1 mm par passe.
3. **Relief 3D…** → **Choisir une image** → `test6-relief.png`. Règle :
   | Réglage | Valeur |
   |---|---|
   | Position X / Y | **14 / 7** |
   | Largeur | **60** (hauteur 36 mm) |
   | Profondeur max | **3** |
   | Ébauche à la fraise plate | cochée, Fraise plate 3,175 mm, surépaisseur **0,3** |
   | Finition | Fraise boule 3,175 mm, pas **0,3** |
   | Lignes croisées | non cochée (première fois) |
4. **Préparer le relief**. La vue Relief s'ouvre : regarde le dôme, la cuvette et la rampe. Sous l'aperçu, il doit y avoir **2 étapes** (≈ 5:15 puis ≈ 10:40), **aucun avertissement**, et le **repère bleu « Zéro Z »** dans le coin avant-gauche (6,75 ; 6,75).

## 2. Étape 1 : ébauche (fraise plate)
1. Connecte la machine, fixe la chute, installe la fraise plate.
2. **Zéro X/Y** au coin avant-gauche, **Aller au point de zéro Z**, puis zéro Z au papier.
3. Lance l'**étape 1**. On voit des paliers, la surface en escalier, à 0,3 mm au-dessus de la forme finale.

## 3. Étape 2 : finition (fraise boule)
1. La fraise attend au point bleu. Change de fraise sans toucher à X/Y, puis zéro Z au papier au même endroit. La pointe de la boule touche le papier comme une fraise plate.
2. Lance l'**étape 2**. La boule balaie en lignes parallèles à X et suit le relief.
3. Si une coupure survient : la reprise propose de repartir d'une ligne (test 5).

## 4. À me renvoyer
- La **console** complète.
- Les **durées réelles** des deux étapes (estimées ≈ 5:15 et ≈ 10:40).
- **Profondeurs** à la jauge du pied à coulisse : **fond plat** autour des formes (prévu 1,2 mm), **fond de la cuvette** (prévu 3,0 mm), **sommet du dôme** (prévu 0, au ras du dessus).
- **État de surface** : stries visibles entre les lignes ? Marches de l'ébauche restées visibles après la finition ? Bois arraché (sens du fil) ?
- Le **bord du relief** (cadre blanc) : arête nette, le brut intact autour ?
- Une **photo** en lumière rasante, avec une règle.

### Lecture
- Fond plat et cuvette aux bonnes profondeurs, dôme au ras : les deux zéros Z concordent (comme au test 4).
- Marches d'ébauche encore visibles : la boule n'a pas atteint la surface, donc le zéro Z de la boule est trop haut, ou la surépaisseur est trop grande pour une seule passe.
- Stries trop marquées : réduire le pas (0,2 mm) ou cocher les lignes croisées.

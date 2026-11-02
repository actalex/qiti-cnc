# Test 3 : découpe traversante, trou et poche à la fraise plate

But : premier usinage à la fraise plate. On vérifie la découpe traversante avec attaches (automatiques et à la main), la découpe intérieure, la poche, l'entrée en rampe, les cotes obtenues et la durée estimée.
Fichier : `essais/test3-decoupe.svg` (page 100 × 70 mm = le brut). Il contient une plaque de 70 × 46 mm aux coins arrondis, un trou de Ø 20 mm et une poche carrée de 24 × 24 mm, profonde de 2 mm.
Une seule fraise : **fraise plate 3,175 mm** (1/8"). Une seule étape, environ **6 min 40 s** : 8 passes de 0,75 mm pour traverser 6 mm.

## Matériel
- Une chute plane de **6 mm** (MDF ou bois tendre), d'au moins **120 × 90 mm**, pour que les brides restent hors de la zone de 100 × 70 mm.
- Une **planche martyre** dessous : la fraise traverse et entame la planche de quelques dixièmes. Jamais directement sur la table.
- La fraise plate 3,175 mm, un pied à coulisse, une feuille de papier, un cutter ou un petit ciseau à bois pour couper les attaches.

## 1. Préparer dans la page
1. Mesure l'épaisseur réelle de la chute au pied à coulisse.
2. **Importer un SVG** → `test3-decoupe.svg`. Dans la fenêtre d'import :
   - laisse cochée « La page Inkscape est le brut » (100 × 70 mm) ;
   - dans **Épaisseur du brut**, mets l'épaisseur mesurée **+ 0,2 mm** (par exemple 6,2 pour 6,0 mesurés) : la découpe traverse franchement et entre de 0,2 mm dans la martyre ;
   - clique **Appliquer les couleurs**. Le résumé doit annoncer 1 découpe extérieure, 1 intérieure et 1 poche.
3. **Fraise** : choisis « Fraise plate 3,175 mm (1/8") ». Garde ses réglages (600 mm/min, plongée 150, 0,8 mm par passe). Ne choisis pas de préréglage « Matériau ».
4. **Formes** : vérifie dans la liste :
   | Forme | Usinage | Profondeur |
   |---|---|---|
   | piece | Découpe extérieure | traversant |
   | trou | Découpe intérieure | traversant |
   | poche | Poche | **2** (corrige à 2 si l'épaisseur saisie l'a changée) |
5. **Attaches** : laisse cochée « Ajouter des attaches » (4 attaches de 5 mm, hautes de 1,5 mm) : elles iront sur la plaque.
   Pour le trou, 4 attaches prendraient plus de la moitié du tour. Sélectionne **trou**, clique **Placer à la main**, clique sur le cercle **à gauche puis à droite**, puis **Terminer**. L'info doit indiquer « 2 placées à la main ».
6. Laisse cochée l'**Entrée en rampe (fraises plates)**, angle 3°.
7. À vérifier sous l'aperçu : **une seule étape**, **aucun avertissement ⚠**, profondeur max = l'épaisseur saisie. Vue « Trajectoires » : ordre poche, trou, plaque. Vue « Dessin » : les 2 attaches du trou en carrés orange.

## 2. Machine et zéros
1. Ouvre la page dans **Edge** et connecte-toi sur le port USB. L'état doit être **Prête** ; si c'est **Alarme**, clique « Déverrouiller ».
2. Fixe la martyre, puis la chute dessus (brides hors de la zone de 100 × 70, ou adhésif double face sur toute la surface). Installe la fraise plate, broche arrêtée.
3. **Zéro X/Y** : amène l'axe de la fraise au coin avant-gauche de la chute, puis clique « Zéro XY ici ». Le dessin tombe à 15 mm du bord gauche et à 12 mm du bord avant.
4. **Zéro Z au papier**, sur la chute : descends par pas de 0,1 jusqu'à pincer légèrement la feuille, puis clique **Zéro Z ici (papier)**.

## 3. Passe à l'air (facultative)
Le principe a déjà été validé aux tests 1 et 2. Si tu la fais, procède comme au test 2 (Z+10, bouton Z=0, gravure, puis zéro Z au papier refait).

## 4. Usinage
1. Broche au variateur, à la vitesse habituelle pour le bois.
2. Coche la liste de vérification et lance la gravure. Reste près de **Stop (arrêt sûr)**.
3. Surveille surtout la **première passe de la poche** (fraise engagée sur toute sa largeur) et la **fin du trou** (la pastille centrale ne tient plus que par les 2 attaches).
4. À la fin, aspire avant de retirer la pièce. Coupe les attaches au cutter, côté pièce, et ponce.

## 5. À mesurer et à me renvoyer
- **Console** : copie tout son contenu.
- **Durée réelle**, comparée à l'estimation.
- **Plaque** : largeur et hauteur, prévues **70,0 × 46,0 mm**.
- **Trou** : diamètre, prévu **20,0 mm** (mesure dans deux directions : un écart dit si le cercle est ovale).
- **Poche** : côté intérieur prévu **24,0 mm** dans les deux sens, et **profondeur prévue 2,0 mm** (jauge de profondeur du pied à coulisse). La profondeur vérifie le zéro Z.
- **Traversée** : la découpe a-t-elle traversé partout, ou reste-t-il une peau de bois au fond ?
- **Attaches** : présentes aux 6 endroits ? Épaisseur (prévue environ 1,5 mm) ?
- **Entrées en rampe** : vois-tu une marque sur les parois à l'endroit où la fraise est entrée ?
- **Fond de poche et parois** : stries, marches entre passes, brûlures, éclats (de quel côté ?).
- **Bruit, vibrations**, broche qui peine.
- Une **photo** avec une règle à côté.

### Lecture des cotes
- Plaque **plus petite** et trou **plus grand** du même écart : la fraise coupe plus large que 3,175 mm (faux-rond, ou diamètre réel différent). Diamètre effectif ≈ 3,175 + (trou mesuré − 20). On le corrige dans le diamètre de la fraise.
- Plaque **et** trou **tous les deux plus grands** (ou tous les deux plus petits) : ce n'est pas la fraise, c'est l'échelle des axes (pas/mm de la carte, $100/$101) ou du jeu mécanique.
- Écart seulement en X ou seulement en Y : jeu ou courroie de cet axe.

# Test 2 : gravure courte en V dans une chute

But : première vraie coupe. On vérifie le zéro Z, l'entrée de la fraise, la netteté des coins et la durée estimée.
Fichier : `essais/test2-gravure-v.svg` (66 × 36 mm : un cadre, une étoile, un T et un V).
Durée estimée : environ 7 min avec une fraise à 90°, 8 min à 60°.

## Matériel
- Une chute de bois plane, d'au moins 90 × 60 mm et 6 mm d'épaisseur. Un bois tendre ou du MDF est plus indulgent.
- Une fraise en V de **60° ou 90°**. Avec une 30°, la page signale des fonds plats : ça marche, mais c'est moins représentatif.
- De quoi fixer la chute solidement (brides ou adhésif double face), et une feuille de papier pour le zéro Z.

## 1. Préparer dans la page
1. **Importer un SVG** → `test2-gravure-v.svg`. Si la page propose de convertir les formes pour la fraise en V, accepte.
2. **Matériau** : mets les dimensions réelles de la chute (largeur, hauteur, épaisseur).
3. **Fraise** : choisis la fraise en V de la liste qui correspond à la tienne. Vérifie l'angle et le diamètre de pointe : s'il est inconnu, laisse 0,2. Corrige si besoin.
   Les avances par défaut conviennent (60° : 500 mm/min, plongée 120, 0,8 mm par passe). Tu peux aussi choisir un préréglage dans « Matériau » (la page limite à 750 mm/min).
4. **Formes** : clique chaque forme et règle :
   | Forme | Usinage | Profondeur | Fraise |
   |---|---|---|---|
   | cadre | Sur la ligne | 0,5 | ta fraise en V |
   | etoile, lettre-T, chevron | Remplissage en V (fraise en V) | 2,8 | ta fraise en V |
5. **Centrer sur le brut**.
6. À vérifier sous l'aperçu : **une seule étape**, **aucun avertissement ⚠**, environ 7 à 8 min. Vue « Trajectoires » : tout reste dans la chute.

## 2. Machine et zéros
1. Connecte. La console doit afficher « Réglages de la carte… », et l'état doit être **Prête**. Si l'état est **Alarme**, clique « Déverrouiller ».
2. Fixe la chute. Installe la fraise en V, broche arrêtée.
3. **Zéro X/Y** : amène la pointe au coin avant-gauche de la chute, puis clique « Zéro XY ici ».
4. **Zéro Z, méthode du papier** : pose la feuille sur la chute et descends par pas de 0,1 jusqu'à ce que la feuille frotte quand tu la bouges. Clique **Z=0** et retire la feuille.
5. Remonte de quelques mm (Z+).

## 3. Passe à l'air (conseillée, 7 min)
1. Monte de **10 mm exactement** (pas de 10, Z+ une fois), puis clique **Z=0** : le zéro est maintenant 10 mm au-dessus du bois.
2. Lance « Graver », broche à l'arrêt ou au ralenti. Regarde si le dessin tombe bien au milieu de la chute.
3. À la fin, descends de 10 mm exactement (Z− une fois avec le pas de 10), puis clique **Z=0** : tu retrouves le zéro du bois.
   Si une alarme apparaît entre-temps, la position est perdue : refais les zéros X/Y et Z.

## 4. Gravure
1. Règle la vitesse de broche au variateur : vitesse haute, celle que tu utilises d'habitude pour le bois.
2. Coche la liste de vérification et lance la gravure. Reste près du bouton **Stop (arrêt sûr)** : en cas de doute, arrête. La position reste bonne, sans alarme.

## 5. À observer et à me renvoyer
- **Console** : copie tout le contenu, du début à la fin.
- **Durée réelle**, comparée à l'estimation affichée.
- **Largeur de la rainure du cadre** (prévue pour 0,5 mm de profondeur) : c'est la mesure la plus fiable du zéro Z.
  Largeur prévue = pointe + 2 × 0,5 × tan(angle/2), soit **1,2 mm à 90°** et **0,78 mm à 60°** avec une pointe de 0,2.
  Une rainure plus large veut dire que la fraise est allée plus profond que prévu, plus étroite moins profond.
- **Coins** : les pointes de l'étoile et les angles du T et du V sont-ils nets, jusqu'au bout ?
- **Fond** : les lettres se terminent-elles en arête au milieu, sans crête ni marche ?
- **Bords** : y a-t-il des éclats ou des arrachements, et de quel côté ?
- **Entrées** : vois-tu des marques de plongée, ou des endroits où la fraise a « tapé » ?
- **Bruit et vibrations**, ou une broche qui peine sur certaines passes.
- Une **photo** de la pièce, si possible avec une règle à côté.

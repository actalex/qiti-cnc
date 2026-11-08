# Test 7 : garde-fou broche (à l'air)

But : vérifier que la carte indique l'état de la broche, puis essayer de reproduire la broche qui ne redémarre pas après un **Stop (arrêt sûr)** (vu au test 6). Tout se fait **fraise en l'air** : aucun bois n'est touché.
Durée : 10 à 15 min. Page : version du commit ffea7c5 (`dist/atelier-cnc.html` en local, pas encore en ligne).

## 1. L'étiquette « broche »
1. Ouvre la page locale `dist/atelier-cnc.html` dans Edge, puis connecte la machine.
2. Dans la console, tape `M3 S1000` puis Entrée. La broche tourne. En haut du panneau Machine, à côté de l'état, une étiquette doit afficher **« broche en marche »**, en moins de 5 s.
3. Tape `M5`. La broche s'arrête, et l'étiquette doit afficher **« broche arrêtée »**.

Si l'étiquette n'apparaît jamais, ta carte ne donne pas cette information et le garde-fou restera inactif. Arrête-toi là et renvoie-moi la console.

## 2. Stop puis reprise, à l'air
Avec le projet du test 6 (relief), étape 1 (ébauche, fraise plate), ou n'importe quel projet de plus de quelques minutes :
1. **Zéro X/Y** comme d'habitude. Pour le Z : zéro au papier, puis monte Z de **10 mm** (pas de 10), et clique **Z=0** pour refaire le zéro Z à cette hauteur. Toute la gravure se fait alors à 7 mm au-dessus du bois ou plus.
2. Lance la gravure. Vérifie que l'étiquette affiche **« broche en marche »** et qu'**aucune alerte** n'apparaît. Laisse tourner au moins 1 min.
3. Clique **Stop (arrêt sûr)**. La broche s'arrête et l'étiquette passe à « broche arrêtée ».
4. Clique **Graver** et choisis le point de reprise proposé (le plus récent), puis **Reprendre la gravure**. Regarde la broche et l'étiquette.
5. Refais les étapes 3 et 4 **trois fois** : on cherche à reproduire le défaut du test 6.

Deux cas possibles à chaque reprise :
- **La broche redémarre** : l'étiquette repasse à « broche en marche », la gravure continue. Normal.
- **La broche ne redémarre pas** : la page doit mettre la machine **en pause d'elle-même** et afficher « la carte indique la broche arrêtée alors qu'elle devrait tourner… ». Choisis OK (arrêt complet). Note combien de temps la fraise a bougé avant la pause.

À la fin, refais le zéro Z au papier normalement avant toute vraie gravure.

## 3. À me renvoyer
- Étiquette vue ou non à l'étape 1 (et le délai, environ).
- Pour chaque reprise : la broche a-t-elle redémarré ? Le garde-fou s'est-il déclenché ? Fausse alerte alors que la broche tournait ?
- La **console** complète.
- Si la page a ramé (flèches, boutons) : à quel moment (après un Stop, au lancement, en continu).

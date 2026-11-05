# Test 5 : reprise d'une gravure interrompue

But : valider la **reprise** après une interruption, sans tout refaire. On provoque deux interruptions : un **Stop**, puis une **page fermée** (comme la batterie à plat du test 4).
Fichier : `essais/test4-deux-fraises.svg`, mêmes réglages qu'au test 4. Une chute neuve, ou la même chute décalée de 60 mm en X.

## Préparer
1. Importe le SVG et règle les formes comme au test 4 (2 étapes).
2. Connecte la machine, fixe la chute, fraise plate.
3. **Zéro X/Y** au coin, puis **Aller au point de zéro Z**, et zéro Z au papier.

## Interruption 1 : Stop
1. Lance l'**étape 1**. Vers le milieu de la poche, clique **Arrêter**.
2. Clique **Graver**. Dans la liste de vérification, il doit y avoir :
   - **aucune alerte** « Zéro … pas refait » : un Stop ne fait plus perdre les zéros ;
   - l'encadré « Cette étape a été interrompue le … » avec **Repartir de** déjà réglé sur une passe un peu avant l'arrêt.
3. Coche les cases, y compris « Le brut n'a pas bougé… », puis **Reprendre la gravure**.
4. Regarde : la fraise remonte, va au-dessus du point, la broche démarre, la fraise redescend doucement dans la saignée, puis reprend.

## Interruption 2 : page fermée
1. Lance l'**étape 2** (fraise en V, zéro Z au point bleu). Pendant le remplissage de l'étoile, **ferme l'onglet** : la page demande une confirmation, accepte. La machine finit les quelques lignes qu'elle avait reçues, puis s'arrête, **broche allumée**.
2. Coupe la broche au variateur. Rouvre la page et reconnecte la machine. Si la carte **redémarre** (bannière « Grbl » dans la console), la position est perdue : arrête là et note-le.
3. **Aller à X0 Y0** puis **Aller au point de zéro Z** : la fraise doit tomber pile au coin et sur le point. Refais seulement le zéro Z au papier si tu as touché à la fraise.
4. **Graver** : l'alerte dit que les zéros ne sont pas refaits « depuis l'ouverture de la page ». Reprends depuis le point proposé.

## À me renvoyer
- La **console** complète.
- Si la carte a redémarré ou non à la reconnexion (interruption 2).
- La passe proposée dans « Repartir de » : était-elle bien **avant** l'endroit de l'arrêt ? Combien de temps à vide environ ?
- Une **marque** à l'endroit de la reprise (marche, trait, bois arraché) ? Une **photo** avec une règle.

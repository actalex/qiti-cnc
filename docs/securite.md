# Sécurités de l'Atelier CNC

Diagnostic du 2026-10-30 : risques connus d'un logiciel de FAO / pilotage GRBL, et comment l'atelier les couvre.
À tenir à jour : toute modification de `fao.js`, `grbl.js` ou `gravure.js` doit garder ces garanties (tests entre crochets).

## G-code
- Descente dans la matière : verticale à la vitesse de plongée ; rampes (3°) et liaisons : vitesse en Z ≤ plongée. [gcode.test]
- Approche rapide jusqu'à 0,5 mm au-dessus du brut seulement, jamais de G0 sous Z0 ; déplacements XY rapides à la hauteur de sécurité. [gcode.test]
- Profondeur par passe respectée ; profondeurs finales exactes ; décalages ±r. [gcode.test]
- En-tête `G21 G90 G17 G94 G54` (mm, absolu, plan XY, avance/min, repère des zéros). [gcode.test]
- Broche : `M3` + temporisation avant la première coupe, `M5` puis `M2` à la fin, fin au Z de sécurité. [gcode.test]
- Attaches sur les découpes traversantes ; intérieurs avant extérieurs. [gcode.test]
- Formes impossibles (trop étroites, mauvais type de fraise) ignorées et signalées ; fraise en V limitée à son cône.
- Passe de finition refusée dans un goulot (saignée pleine profondeur). [gcode.test]
- Avances plafonnées aux vitesses max de la carte ; conventionnel par défaut pour l'ébauche.

## Pilotage
- Arrêt : feed hold, reset seulement à `Hold:0` (pas d'alarme 3). [grbl-simule]
- `error:` / `ALARM:` / redémarrage de la carte pendant une gravure : envoi arrêté. [grbl-simule]
- Pause propre : arrêt au prochain dégagement, `M5`, reprise `M3` + temporisation. [grbl-simule]
- Câble USB perdu pendant une gravure : fin de la gravure, alerte « broche peut-être encore allumée ». [grbl-simule]
- Écran maintenu éveillé pendant une gravure (Wake Lock) : la veille couperait l'envoi.
- Jog : seulement en Idle/Jog, sans répétition de touche, Z ≤ 500 mm/min. [grbl-simule]
- À la connexion : réglages lus ; avertissements limites logicielles désactivées, homing absent, mode laser `$32=1`.

## Liste de vérification avant gravure
- Cases obligatoires : fixation, fraise, zéros X/Y et Z, brides sous la hauteur de dégagement, variateur, protections.
- Alertes : zéros pas refaits depuis le démarrage de la carte (sans homing, l'ancien zéro ne vaut plus) ou, pour le Z,
  depuis le changement de fraise ; fraise qui descend sous le brut (dans la table). [gcode.test, grbl-simule]

## Non couvert (décidé)
- Longueur de coupe des fraises (profondeur > longueur utile) : pas de champ pour l'instant.
- Test à vide intégré : remplacé par la méthode manuelle (petit bouton Z=0 10 mm plus haut, puis zéro au papier).
- Contrôle du contact de la sonde : l'utilisateur fait le zéro Z au papier.
- Hors logiciel : réglages matériaux non validés ; arrêt d'urgence physique indispensable (perte USB).

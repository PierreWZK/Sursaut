# Jour 6/30 — Sursaut, quatre réflexes que vous ne saviez pas avoir

> Stack : **HTML, CSS et JavaScript** (modules, sans framework ni dépendance), **Web Audio**, hébergement **Netlify**.
> Durée visée : **2 h 45** pour le MVP (section 4), les bonus ensuite.

Ce document est notre contrat : on le suit étape par étape, et toute décision qui s'en écarte est d'abord notée ici.

## 1. L'idée

Les jeux de réflexes se ressemblent tous : un carré devient vert, on clique, on lit son temps. **Sursaut** teste quatre réflexes qu'on ne mesure presque jamais, chacun avec sa propre épreuve :

| Épreuve | Réflexe | En une phrase |
| --- | --- | --- |
| 🎭 **Feinte** | l'inhibition | Être rapide sur le vrai signal… et **ne pas bouger** devant les leurres. |
| 🥁 **Contretemps** | le rythme | Une boucle joue, un temps manque : taper **exactement** là où il aurait dû tomber. |
| 🔦 **Pénombre** | l'œil | Une lueur s'allume une fraction de seconde dans le noir : cliquer **là où elle était**. |
| 🎧 **Tympan** | l'oreille | Au casque, un son part à gauche ou à droite : choisir le bon côté, **sans rien voir**. |

Le **Sursaut du jour** enchaîne les quatre épreuves en version courte, avec les **mêmes tirages pour tout le monde** ce jour-là. Il donne un **profil de réflexes** (quatre notes sur 100, dessinées sur quatre axes) et un résultat **à partager**.

## 2. MVP — ce qui doit fonctionner à la fin

1. Une **page d'accueil** qui présente les quatre épreuves, le Sursaut du jour et les records du joueur.
2. Les **quatre épreuves jouables** séparément, chacune avec au moins ses **deux premières phases** (voir section 3) et un écran de résultat : note sur 100, détail, record.
3. Le **Sursaut du jour** : les quatre épreuves en version courte, le même tirage pour tout le monde d'après la date, le profil sur quatre axes et le texte à partager.
4. La **calibration** de Contretemps (décalage du son et du toucher) et le **test du casque** de Tympan.
5. **Records et historique** sur l'appareil (`localStorage`), sans compte.
6. Jouable à la **souris, au tactile et au clavier**, sur mobile comme sur ordinateur.
7. En ligne sur Netlify, avec un README à jour.

### Périmètre volontairement limité

- Pas de compte, pas de serveur, pas de classement mondial : tout reste sur l'appareil.
- Pas de bibliothèque : le son est généré par Web Audio (aucun fichier audio), les graphiques en SVG.
- Le jeu mesure des **temps relatifs** pour s'amuser et progresser : ce n'est pas un test médical, et on ne le présente pas comme tel.

## 3. Cahier des charges fonctionnel

### Règles communes

- **Une manche = une série d'essais** (20 en jeu libre, 8 dans le Sursaut du jour). La difficulté monte par **phases** au fil de la manche.
- **Départ** : un compte à rebours 3-2-1. Un appui avant le signal est un **faux départ** : il compte comme une erreur, la manche continue.
- **Délais aléatoires** entre deux signaux (entre 0,8 et 2,5 s), pour qu'on ne puisse pas anticiper.
- **Note sur 100** à la fin de chaque manche, avec le détail : temps moyen, meilleur temps, erreurs.
- **Pause** automatique si la page passe en arrière-plan (l'essai en cours est annulé, pas compté).
- Chaque épreuve explique sa règle en **une phrase et une animation** avant le premier essai.

### A. 🎭 Feinte — le réflexe de ne pas réagir

Une consigne s'affiche, puis des signaux défilent au centre de l'écran. On appuie (clic, toucher ou Espace) **seulement sur ceux qui respectent la consigne**.

| Phase | Essais (sur 20) | Consigne et leurres |
| --- | --- | --- |
| 1. Couleur | 1-5 | « Touche quand c'est **rouge** » ; leurres : autres couleurs. |
| 2. Mot | 6-10 | « Touche quand le **mot** dit rouge » ; le mot et sa couleur se contredisent (effet Stroop). |
| 3. Son | 11-15 | Comme la phase 2, mais un « bip » de départ retentit **150 ms avant** le signal (60 % des leurres, 30 % des vrais signaux) : appuyer au son est un faux départ. |
| 4. Volte-face | 16-20 | La consigne s'**inverse** (« touche quand le mot ne dit PAS… »), puis se rétablit, plusieurs fois et sans prévenir (une bascule au plus tard tous les 3 signaux). Chaque bascule est criée (« Volte-face ! ») et le bandeau de consigne passe au rouge tant qu'elle est inversée. |

- Environ **40 % de vrais signaux**, 60 % de leurres. Un signal reste affiché **1,2 s** au plus.
- Vrai signal touché : temps de réaction. Vrai signal laissé passer : **raté**. Leurre touché : **feinte encaissée**.
- **Note** : 60 % pour la vitesse sur les vrais signaux (de 100 à 250 ms jusqu'à 0 à 900 ms), 40 % pour les feintes évitées. Un raté ou une feinte encaissée coûte des points.
- Daltonisme : chaque couleur a aussi sa **forme** (rond rouge, carré bleu, triangle vert, losange jaune) ; la consigne peut viser la forme.

### B. 🥁 Contretemps — le réflexe du silence

Une boucle rythmique joue (un temps fort, puis des temps faibles). Après quelques mesures, **un temps ne sonne pas** : on tape au moment où il aurait dû tomber.

| Phase | Silences (sur 10) | Rythme |
| --- | --- | --- |
| 1. Régulier | 1-3 | 4 temps, tempo stable mais très différent d'une boucle à l'autre (84, 112, 96, 124 bpm). |
| 2. Accelerando | 4-6 | 4 temps, le tempo **accélère pendant la boucle** (d'environ 90 à 130 bpm) : le silence tombe sur la courbe. |
| 3. Boiteux | 7-8 | 3 puis 5 temps par mesure. |
| 4. Syncopé | 9-10 | Contretemps (le silence tombe entre deux temps). |

- Un silence arrive après **2 ou 3 mesures** entendues (tiré au hasard ; 4 mesures rendaient la manche trop longue à tempo lent). Un seul tap compte par silence.
- **Écart** = moment du tap − moment attendu, corrigé par la calibration. Affiché en ms, avec « en avance » ou « en retard ».
- Fenêtre : **± 250 ms**. Au-delà, ou sans tap : silence **manqué**.
- **Note** : 100 points par silence si l'écart ne dépasse pas 15 ms, 0 point à 200 ms, de façon linéaire entre les deux ; moyenne des 10 silences.
- **Calibration** (une fois, refaisable) : taper 8 fois avec un métronome audible ; la moyenne des écarts devient le décalage de l'appareil (sortie audio, écran tactile). Elle est gardée sur l'appareil.
- Le visuel ne donne **aucun indice** du temps manquant : un simple pouls lumineux suit les temps joués, et s'éteint avec eux.

### C. 🔦 Pénombre — le réflexe de l'œil

L'écran de jeu est sombre. Une **lueur** s'allume un court instant à un endroit au hasard, puis s'éteint. On clique (ou touche) **là où elle était**, le plus vite et le plus près possible.

| Phase | Essais (sur 20) | Lueur |
| --- | --- | --- |
| 1. Franche | 1-5 | 250 ms, grande, bien visible. |
| 2. Furtive | 6-10 | De 150 à 80 ms, plus petite. |
| 3. Pâle | 11-15 | 80 ms, moins lumineuse, sur un fond qui ondule doucement. |
| 4. Mirage | 16-20 | Deux lueurs en même temps : la vraie a la couleur annoncée, l'autre est un leurre. |

- Le clic n'est accepté qu'**après** l'extinction (ou pendant) et dans les 2 s ; au-delà, l'essai est **manqué**.
- Mesures : **temps de réaction** (depuis l'allumage) et **écart** en pixels, rapporté au **plus petit côté** de la zone de jeu pour être juste sur mobile comme sur grand écran.
- **Note** : 60 % pour la précision (pleine note sous 4 % du plus petit côté, nulle au-delà de 25 %), 40 % pour la vitesse (pleine note jusqu'à 300 ms, nulle à 1 s). Cliquer sur le leurre de la phase 4 : essai à 0.
- Pénombre demande de **viser** : elle se joue à la souris ou au doigt, pas au clavier (c'est indiqué sur l'épreuve).
- **Épilepsie photosensible** : pas de flash plein écran, au plus **une lueur par seconde**, lueurs douces (dégradé, pas de blanc pur sur noir) ; un avertissement s'affiche avant la première partie.
- Avec `prefers-reduced-motion`, le fond ne bouge pas.

### D. 🎧 Tympan — le réflexe de l'oreille

Au casque. L'écran reste sombre et n'indique rien : un son part **à gauche ou à droite**, on choisit le côté (flèches ← →, touches Q/D ou moitié gauche / droite de l'écran tactile).

| Phase | Essais (sur 20) | Sons |
| --- | --- | --- |
| 1. Net | 1-5 | Tout à gauche ou tout à droite. |
| 2. Proche | 6-10 | De plus en plus près du centre (jusqu'à 15 % d'un côté). |
| 3. Écho | 11-15 | Un écho plus faible répond de l'autre côté : **le premier son a raison**. |
| 4. Croisé | 16-20 | Le son se déplace en jouant : c'est **là où il finit** qui compte. |

- Sons de timbres variés (clic, goutte, cloche), tous générés par Web Audio et spatialisés (`StereoPannerNode`, ou `PannerNode` en mode HRTF pour l'écho).
- Délai de réponse : **1,5 s** au plus. Mauvais côté : erreur ; pas de réponse : manqué.
- **Note** : 50 % pour les bonnes réponses, 50 % pour la vitesse des bonnes réponses (de 100 à 250 ms jusqu'à 0 à 1 s).
- **Test du casque** avant la première partie : un son à gauche, un son à droite, le joueur confirme qu'il les entend du bon côté (on rattrape ainsi un casque à l'envers). Sans casque, l'épreuve reste jouable mais un bandeau prévient que la note sera faussée.

### E. ⚡ Le Sursaut du jour

- Les quatre épreuves **dans un ordre fixe**, en version courte (8 essais chacune, phases 1 à 3), environ **3 minutes** en tout.
- Le **même tirage pour tout le monde** : délais, positions, consignes et côtés sont tirés par un générateur pseudo-aléatoire initialisé avec la date du jour (`AAAA-MM-JJ`, heure de Paris). Un nouveau Sursaut chaque jour à minuit.
- **Une seule tentative notée** par jour ; on peut rejouer pour s'entraîner, la première note reste celle du jour.
- Résultat : la **note globale** (moyenne des quatre), le **profil** (quatre axes en SVG : inhibition, rythme, œil, oreille) et un **titre** selon le profil (« Le chat », « Le métronome », « Le guetteur », « La chauve-souris », « L'intrépide »…).
- **Partage** : un texte court copié dans le presse-papiers (ou la feuille de partage du téléphone), sans données personnelles :

  ```
  Sursaut · 19 oct. · 77/100
  🎭 82  🥁 64  🔦 71  🎧 90
  « Le guetteur » · sursaut.projectp.fr
  ```

- Un **calendrier** des Sursauts joués (série de jours consécutifs).

### F. Interface attendue

| Page | Contenu |
| --- | --- |
| `index.html` | Accueil : l'accroche, les quatre épreuves en cartes, le Sursaut du jour, les records, le profil moyen |
| `jouer.html#feinte` (ou `#contretemps`, `#penombre`, `#tympan`) | Une épreuve en jeu libre : règle, calibration ou test si besoin, partie, résultat |
| `jour.html` | Le Sursaut du jour : enchaînement des quatre épreuves, profil et partage |

- **Identité** : sombre et nerveuse, chaque épreuve avec sa couleur (Feinte magenta, Contretemps ambre, Pénombre bleu nuit, Tympan turquoise). Une police d'affichage marquée pour les chiffres (temps en ms).
- Pendant une partie, **rien d'autre à l'écran** que le jeu : pas de menu, pas d'animation parasite, un bouton « Quitter » discret.
- **Retour immédiat** après chaque essai : le temps ou l'écart, une couleur (bien / moyen / raté), une vibration courte sur mobile (`navigator.vibrate`) quand c'est disponible.
- **Responsive** dès 360 px de large ; la zone de jeu prend l'écran entier sur mobile.
- **Accessibilité** : tout se joue au clavier sauf Pénombre (il faut viser), focus visible, textes de résultat lisibles par un lecteur d'écran (`aria-live`), contrastes AA. Pénombre et Feinte reposent sur la vue, Tympan et Contretemps sur l'ouïe : c'est dit sur chaque carte.

## 4. Cahier des charges technique

### Stack

- **HTML, CSS, JavaScript** en modules ES, sans build ni dépendance. Servi par n'importe quel serveur statique (`npx serve .`).
- **Web Audio** pour tous les sons, programmés sur l'horloge audio (`AudioContext.currentTime`) : c'est la seule façon d'avoir un rythme stable à la milliseconde pour Contretemps.
- **SVG** pour le profil sur quatre axes et les petits graphiques de résultat.
- **Netlify** pour l'hébergement (`netlify.toml`, en-têtes de sécurité, cache des fichiers statiques), sous-domaine `sursaut.projectp.fr`.

### Mesure du temps (le cœur du projet)

- Entrées lues sur **`pointerdown`** et **`keydown`** (pas `click`, qui arrive après le relâchement), avec `event.timeStamp`, comparable à `performance.now()`.
- **Signal visuel** : l'instant de référence est le **premier `requestAnimationFrame` qui suit l'affichage**, c'est-à-dire l'image qui le montre vraiment, pas le moment où le code l'a demandé.
- **Signal sonore** : l'instant de référence est l'heure de lecture programmée dans l'horloge audio, convertie en `performance.now()` (`getOutputTimestamp()`), plus la latence de sortie (`outputLatency`) quand le navigateur la donne. La calibration corrige le reste.
- Délais aléatoires et « ne pas anticiper » : un appui moins de **100 ms** après un signal visuel est compté comme anticipé.
- `touch-action: manipulation` et `user-select: none` sur les zones de jeu, pour éviter les délais et les sélections du navigateur mobile.

### Architecture

```
index.html, jouer.html, jour.html
css/
  style.css            Identité, mise en page, composants
js/
  app.js               Accueil : cartes, records, profil moyen
  play.js              Page d'une épreuve (jeu libre)
  daily.js             Sursaut du jour : enchaînement, profil, partage
  core/
    clock.js           Horloges : image affichée, horloge audio, conversion
    random.js          Générateur pseudo-aléatoire initialisable (mulberry32) et tirages
    audio.js           Contexte Web Audio, sons synthétiques, spatialisation
    input.js           Appuis (pointer, clavier), faux départs, pause en arrière-plan
    storage.js         Records, historique, calibration (localStorage, versionné)
    score.js           Notes sur 100, titres du profil
  games/
    feinte.js          Chaque épreuve exporte la même interface :
    contretemps.js       start(stage, { rng, trials, phases }) → Promise<résultat>
    penombre.js
    tympan.js
  ui/
    radar.js           Profil sur quatre axes (SVG)
    result.js          Écran de résultat commun
```

- Chaque épreuve est un **module indépendant** avec la même interface : la page de jeu libre et le Sursaut du jour s'en servent de la même façon.
- Le **tirage** passe toujours par `random.js` : en jeu libre il part d'une graine au hasard, dans le Sursaut du jour de la date. Rejouer la même graine redonne exactement la même partie.
- Les notes sont calculées par des **fonctions pures** (`score.js`), testables sans navigateur.

### Données sur l'appareil

`localStorage`, clé `sursaut.v1`, un seul objet JSON :

```json
{
  "records": { "feinte": 84, "contretemps": 71, "penombre": 66, "tympan": 92 },
  "history": [{ "date": "2026-10-19", "epreuve": "feinte", "note": 84, "detail": {} }],
  "daily": { "2026-10-19": { "notes": { "feinte": 82, "contretemps": 64, "penombre": 71, "tympan": 90 }, "titre": "Le guetteur" } },
  "calibration": { "contretempsMs": 42 },
  "headphonesChecked": true
}
```

Lecture et écriture protégées (`try/catch`) : le jeu marche même si le stockage est refusé (navigation privée), sans records.

### Tests

- **Unitaires** (`node --test`, sans dépendance) : générateur pseudo-aléatoire (même graine → même suite), tirage du jour, formules de note de chaque épreuve, choix du titre du profil.
- **À la main**, sur ordinateur et sur un téléphone : chaque épreuve jouée en entier, la calibration, le test du casque, le partage, la page en arrière-plan pendant une partie.

### Mise en ligne

- Dépôt GitHub dédié, déployé par Netlify à chaque push sur `main` ; sous-domaine `sursaut.projectp.fr`.
- En-têtes : `Content-Security-Policy` stricte (scripts du site seulement), `Referrer-Policy`, `Permissions-Policy`.

## 5. Planning minuté — 2 h 45 maximum

| Temps | Étape |
| --- | --- |
| 0:00 → 0:20 | Squelette des trois pages, identité visuelle, `core/` (horloges, tirage, entrées, stockage) |
| 0:20 → 0:50 | 🎭 Feinte, phases 1-2, écran de résultat commun |
| 0:50 → 1:20 | 🥁 Contretemps, phases 1-2, calibration |
| 1:20 → 1:45 | 🔦 Pénombre, phases 1-2 |
| 1:45 → 2:10 | 🎧 Tympan, phases 1-2, test du casque |
| 2:10 → 2:30 | ⚡ Sursaut du jour : tirage par date, profil, partage |
| 2:30 → 2:45 | Records sur l'appareil, mobile, README, mise en ligne |

Les phases 3 et 4 de chaque épreuve viennent ensuite (section 7), dans cet ordre : Feinte, Tympan, Pénombre, Contretemps.

## 6. Critères de réussite

- Les quatre épreuves se jouent du début à la fin, à la souris, au doigt et au clavier.
- Un appui sur un leurre, un faux départ ou un silence manqué est toujours compté, jamais ignoré.
- Contretemps garde un tempo stable (aucune dérive audible sur 2 minutes), et la calibration change bien l'écart affiché.
- Deux joueurs qui font le Sursaut du jour le même jour reçoivent **exactement** les mêmes tirages.
- Le jeu reste jouable sans stockage, et sans casque (avec l'avertissement).
- Aucune erreur dans la console, aucun appel réseau autre que les fichiers du site.
- Le site s'affiche correctement de 360 px à un grand écran, en mode sombre.

## 7. Bonus facultatifs

1. Phases 3 et 4 de chaque épreuve (si elles ne tiennent pas dans le MVP).
2. Graphique de progression par épreuve (les dix dernières notes).
3. Mode **« Formes »** pour Feinte, sans aucune couleur.
4. Défi entre amis : un lien avec une graine et une note à battre (`jouer.html#penombre?graine=…&a-battre=78`).
5. Mode « sans regarder » pour Contretemps (écran noir, comme Tympan).
6. Installation en application (PWA, hors ligne).

## 8. Définition du « terminé »

- Le MVP de la section 2 fonctionne en ligne, sur ordinateur et sur mobile.
- Les tests unitaires passent.
- Le README décrit les épreuves, leurs règles de note, le Sursaut du jour, le lancement en local et la mise en ligne, avec une capture.
- Le projet est ajouté au site du défi (carte, capture, lien, dépôt).

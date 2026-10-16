# Overseer

**Overseer** est un jeu de stratégie tactique / roguelite en navigateur : le joueur incarne une IA qui pilote une base de machines, oriente son attention pour en activer les bâtiments, produit des unités autonomes et survit à des vagues ennemies.

> **État du projet : prototype jouable, nouvelle direction en conception.** Les règles, ressources et visuels actuels ne représentent pas encore le nouveau design minimaliste. Voir [Direction de jeu](docs/GAME_DIRECTION.md).

## Jouer en local

Le jeu fonctionne **sans Utopixia**. Phaser et le serveur statique sont installés par npm ; les données de gameplay sont locales.

Prérequis : Node.js **22+** et npm.

```bash
npm install
npm test
npm start
```

Ouvrir **http://localhost:8097**.

Alternative Docker :

```bash
docker compose up --build
```

Pour tester une PR empilée, se placer sur **sa branche**, qui comprend les changements des PR précédentes. Vérifier l'état réel des PR avant de modifier ou merger.

## Sauvegarde locale VNext

Le menu propose **Continuer** lorsqu'une sauvegarde VNext valide existe. **Nouvelle partie** demande confirmation avant de remplacer cette sauvegarde unique.

- La partie (ECS, bâtiments, ressources, cartes, unités, vague, attention et récompenses) est stockée dans le `localStorage` du navigateur, sous la clé `overseer.vnext.save`, avec une version de format.
- Une sauvegarde est réalisée toutes les 20 secondes en temps réel, après les actions importantes, au retour au menu et lors de l'événement `pagehide` (fermeture / navigation).
- La destruction de la base termine la partie et efface uniquement sa sauvegarde, **pas** les talents ou les éclats de mémoire persistants.
- En cas de stockage désactivé / saturé, le retour au menu est retenu si la sauvegarde échoue. Une sauvegarde incompatible ou illisible ne propose pas Continuer.
- Le système est local à ce navigateur et cette origine : pas de compte, synchronisation, migrations automatiques ni garantie de conservation en mode privé.

## Boucle de jeu actuelle

1. Construire sur une **grille logique 5 × 5**.
2. Déplacer et orienter la vision de l'IA : les bâtiments observés sont actifs.
3. Produire des ressources, des unités ou des sorts selon les bâtiments.
4. Défendre la base sur un champ de bataille contre des vagues d'ennemis.
5. Choisir des récompenses et améliorer sa stratégie.

### Construction et fabrication dans VNext (état actuel)

Dans la scène **VNext**, **aucune ressource n'est dépensée pour placer un bâtiment**. Jouer une carte la retire simplement de la main. Les quantités indiquées pour les bâtiments militaires correspondent à la **fabrication de chaque unité**, et non à leur construction.

| Producteur | Unité | Composants par unité | Énergie par unité |
|---|---|---:|---:|
| Caserne | Soldat | **25** | **15** |
| Centre balistique | Tireur | 35 | 20 |
| Forge blindée | Tank | 60 | 35 |
| Centre médical | Drone soigneur | 40 | 25 |

**Nœud de calcul (VNext, valeurs provisoires) :** placement gratuit par carte ; un cycle observé de **6 s** consomme **2 Énergie + 1 Composant + 1 Matière** et produit **2 Données**. Hors vision, sa progression est conservée. Lorsque les ressources manquent, le cycle reste prêt sans débiter d'intrants. Les Données alimentent les améliorations de vision (3 → 6 cases). Le Laboratoire continue, séparément, à rechercher des technologies.

**Cadences militaires :** Caserne **5 s**, Centre balistique **8 s**, Forge blindée **12 s**, Centre médical **10 s** (temps de simulation, à vitesse ×1). Chaque bâtiment progresse uniquement lorsqu'il est observé ; sortir de la vision fige le cycle en cours, qui reprend à sa réactivation. Les ressources sont débitées **seulement lorsque l'unité est produite**. Un cycle achevé attend sans nouvelle dépense lorsque les ressources ou la capacité manquent ; la capacité est de **trois unités vivantes par bâtiment militaire**. Les sauvegardes conservent l'avancement du cycle.

Le jeu comprend également un système de talents et une progression entre les parties. **Ne pas présumer que l'ensemble de ces mécaniques est déjà migré dans le noyau ECS.**

### Améliorations de vision dans VNext

Le joueur débloque successivement **4, 5 puis 6 cases de vision** contre **30, 90 puis 240 Données** (360 au total). Le Nœud de calcul de la PR dédiée doit fournir les Données ; ce barème ne modifie ni la production de Données, ni la cadence des vagues. Les achats restent sauvegardés. Ces prix sont des valeurs d'équilibrage de prototype, à ajuster après des parties complètes.

### Vagues mixtes et assauts d'élite (réglage de prototype)

Les vagues 1–3 utilisent des ennemis de base, les vagues 4–6 introduisent les tireurs et les vagues 7+ ajoutent les percuteurs. Le nombre total d'ennemis des vagues ordinaires continue la progression historique (+2 tous les trois niveaux), mais les proportions changent. Les vagues multiples de **10** sont des assauts d'élite mixtes plus fournis et garantissent **un choix de bâtiment, puis un choix de technologie**, via le parcours de récompenses existant. Un boss authentique à la vague 20 n'est **pas encore implémenté** : ses règles sont à définir.

La timeline affiche **1 à 5 petits ronds** pour une **menace estimée** calculée à partir du nombre et du type d'ennemis (poids provisoires : base 1, distant 2, percuteur 4), avec une couleur ambre pour les assauts d'élite. C'est une indication relative, **pas** un calcul de la probabilité de victoire ni une mesure de la puissance du joueur. Survoler un marqueur affiche la composition et la menace correspondantes. Les temps d'arrivée ne changent pas.

### Diagnostiquer une partie longue (vagues)

La télémétrie VNext est **locale**, stockée dans le composant ECS `WaveTelemetry` (80 vagues maximum, également conservées par la sauvegarde). Elle n'envoie aucune donnée à un serveur et ne change ni les ennemis ni les récompenses. Une sauvegarde ancienne sans télémétrie reste chargeable ; l'historique antérieur n'est pas reconstitué.

Dans la console du navigateur, pendant une partie :

```js
console.table(game.scene.getScene('VNextScene').waveReport());
```

Chaque ligne indique composition, nombre d'ennemis apparus et morts, durée en **secondes de simulation**, dégâts réellement infligés au noyau, nombre d'alliés perdus pendant l'intervalle, effectifs, niveau de vision et différence de Données. **En cas de vagues simultanées**, une même perte alliée peut figurer dans plusieurs intervalles ; il ne s'agit pas d'une attribution causale. Le résultat ne mesure pas encore la performance réelle du joueur hors combat.

## Architecture du prototype

- `index.html`, `src/main.js` : chargement et démarrage Phaser.
- `src/scene/GameScene.js` : orchestration du jeu existant.
- `src/core/World.js` : registre ECS de données, entités, composants et hiérarchie.
- `src/core/CombatSystem.js` : première tranche de simulation de combat indépendante de Phaser.
- `src/scene/entities/` : éléments de gameplay et adaptateurs graphiques, encore partiellement historiques.
- `src/scene/managers/` : construction, ressources, talents, sorts, vagues et HUD.
- `assets/game_stats.json` : **configuration utilisée actuellement**, héritée de l'ancien contrat ; elle décrit huit ressources et 23 types de bâtiments, **pas** les cinq ressources proposées pour la refonte.
- `assets/game_texts_*.json` : textes localisés.
- `tests/` : tests Node exécutés par `npm test`.

**Principe architectural :** l'état du monde et les règles doivent progressivement devenir indépendants du rendu ; Phaser reflète la simulation et collecte les actions du joueur. Les chemins historiques sont migrés par petites tranches testées, sans interrompre la jouabilité.

## Direction en cours

La prochaine identité d'Overseer est **minimaliste, vectorielle et fonctionnelle** :

- Une grille sans contours décoratifs sur chaque case ; un cercle ou glyphe coloré par type de bâtiment.
- La vision représentée par **les connexions entre bâtiments observés**, pas par un rectangle de sélection lumineux.
- Une zone de combat visible, avec alliés, ennemis et projectiles géométriques.
- Cartes à gauche (glisser-déposer), base et combat au centre, ressources puis sorts à droite, vagues en bas.
- Une économie candidate à **cinq ressources** : Énergie, Matière, Refroidissement, Composants, Données.
- Peu d'archétypes d'unités ; des possibilités de spécialisations en discussion.

Ces directions **ne sont pas encore implémentées ni entièrement décidées**. Règles détaillées, incertitudes et première tranche de prototype : [docs/GAME_DIRECTION.md](docs/GAME_DIRECTION.md).

## Travailler sur Overseer

Les agents ou contributeurs doivent consulter [AGENT_SYSTEM_PROMPT.md](AGENT_SYSTEM_PROMPT.md) puis lire le code actuel.

Priorités : conserver un jeu jouable ; un invariant par PR ; tests automatisés et validation manuelle du gameplay ; éviter les refontes « big bang ». Si une réécriture de sous-système est justifiée, comparer son coût et ses effets à une migration progressive.

## Licence et contributions

Le dépôt ne précise pas ici de politique de contribution ou de licence d'exploitation ; ne présumez pas de droits de réutilisation externes. Demander l'accord du mainteneur avant toute publication ou réutilisation des assets existants.

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

## Boucle de jeu actuelle

1. Construire sur une **grille logique 5 × 5**.
2. Déplacer et orienter la vision de l'IA : les bâtiments observés sont actifs.
3. Produire des ressources, des unités ou des sorts selon les bâtiments.
4. Défendre la base sur un champ de bataille contre des vagues d'ennemis.
5. Choisir des récompenses et améliorer sa stratégie.

Le jeu comprend également un système de talents et une progression entre les parties. **Ne pas présumer que l'ensemble de ces mécaniques est déjà migré dans le noyau ECS.**

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

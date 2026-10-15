# Overseer

RTS / roguelite tactique avec Phaser : placez vos bâtiments sur une grille 5×5, activez-les grâce au champ de vision et défendez votre base contre les vagues ennemies.

## Mode local (sans Utopixia)

Toutes les données de jeu sont fournies par `assets/game_stats.json`. Le navigateur charge Phaser et les scripts du jeu depuis le serveur local. Aucun service Utopixia ni CDN n'est nécessaire au lancement.

Prérequis : Node.js 22+ et npm.

```bash
npm install
npm test
npm start
```

Ouvrez ensuite http://localhost:8097.

## Docker

```bash
docker compose up --build
```

Le jeu est servi sur http://localhost:8097.

## Données et tests

- `assets/game_stats.json` : configuration de référence (copie exacte des valeurs de l'ancien `GetGameStats`).
- `assets/game_texts_*.json` : textes localisés.
- `npm test` : tests du bootstrap et, sur les branches empilées, des systèmes ECS.

Les configurations `assets/game_data.json` et `assets/spells.json` sont historiques et ne sont pas chargées par la scène principale. Utilisez `assets/game_stats.json` pour modifier les statistiques du jeu.

## Prochaines étapes

Équilibrage des vagues, nouveaux artefacts, effets visuels et optimisation de l'interface.

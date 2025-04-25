# Overseer

**Overseer** est un prototype de jeu de stratégie en temps réel (**RTS**) tactique, développé avec **Phaser.js**.  
Vous incarnez une IA tacticienne chargée de construire une base robotique et de survivre face à des vagues d'ennemis organiques.

🧠 **Principes du gameplay** :
- **Construisez** des bâtiments sur une grille dynamique en utilisant des cartes.
- **Automatisez** la production de ressources, d'unités et de sorts.
- **Défendez** votre base grâce à vos unités autonomes.
- **Anticipez** les vagues ennemies via une timeline d'attaque.
- **Évoluez** en choisissant des artefacts stratégiques après chaque victoire.

---

## 🚀 Lancer le projet avec Docker

**Prérequis** :
- Docker
- Docker Compose

**Étapes** :

1. Clonez ce dépôt :
   ```bash
   git clone git@github.com:renaud-b/overseer.git && \
   cd overseer
   ```
2. Construisez l'image Docker :
   ```bash
   docker-compose up
   ```
3. Le jeu sera accessible à l’adresse :
```
http://localhost:8087
```

## 📋 TODOs

- Ajouter plus d'artefacts pour enrichir la stratégie.

- Travailler l’équilibrage dynamique des vagues.

- Enrichir les sprites et les effets visuels.

- Optimiser les performances mobiles.
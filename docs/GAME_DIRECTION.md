# Overseer — Direction de jeu VNext (document de travail)

**Statut : exploration validée sur l'intention générale, détails encore ouverts.**
Ce document sert à la discussion, au découpage des PR et à la continuité entre agents. **Il ne décrit pas le comportement actuel du code.**

## Pitch / boucle centrale

Une IA défend son installation sur une planète hostile. Le joueur ne contrôle pas directement chaque unité : il **déplace son attention**, activant une sélection de bâtiments sur une grille de **5 × 5**. Les bâtiments produisent des ressources, fabriquent des unités ou préparent des protocoles. Des unités autonomes combattent des vagues ennemies sur un champ de bataille **visible à côté de la base**.

**Arbitrage principal :** où consacrer les cycles d'attention maintenant pour survivre à la prochaine vague ?

```text
Attention du joueur
    ↓
Bâtiments activés (parmi 25 emplacements)
    ↓
Ressources / fabrication / protocoles
    ↓
Défense autonome de la base
    ↓
Vagues, récompenses, décisions de progression
```

Les cases non construites doivent rester repérables pour le placement même si aucune bordure décorative n'entoure la grille.

## Direction artistique

**Très minimaliste, sans sprites spécifiques obligatoires pour les bâtiments.**
Fond sombre uni, peu de panneaux, typographie claire, composants fonctionnels, contraste maîtrisé, formes vectorielles et couleurs significatives. Pas de néon gratuit, de textures lourdes, de surcharge de contours ou de pluie de particules.

- **Bâtiment** = nœud circulaire ou glyphe simple + couleur associée à sa fonction + signal d'activité.
- **Vision** = connexions discrètes entre les bâtiments actuellement observés, éventuellement issues d'un nœud d'attention. Une ligne signifie **« activé par la vision »** et **non** « connexion requise pour fonctionner ». Maintenir un contraste net actif/inactif même pour un bâtiment isolé, sans voisin.
- **Production** = animation sobre du nœud et un signal discret à la fin d'un cycle.
- **Unités alliées** = formes synthétiques claires ; **ennemis** = silhouettes distinctes, éventuellement plus organiques. Les tirs et dégâts doivent rester lisibles sans pollution visuelle.
- L'objectif est une **grammaire graphique reproductible** : ajouter un bâtiment courant sans commander une nouvelle illustration.

Palette indicative, non figée : fond `#08121C`, texte `#DFEAF0`, activité `#62E7E1`, danger `#FF6674`, ressource industrielle `#F5B94F`, données `#AA8CF6`.

## Disposition de l'interface

```text
┌────────┬─────────────────────┬──────────────────────┬─────────┐
│ CARDS  │ BASE 5×5            │ CHAMP DE BATAILLE    │ RESS.   │
│        │ symboles/connexions │ unités / ennemis     │ SORTS   │
│ drag   │                     │                      │         │
└────────┴─────────────────────┴──────────────────────┴─────────┘
│                        VAGUES / TIMELINE                       │
└────────────────────────────────────────────────────────────────┘
```

La barre supérieure, si nécessaire, ne contient que le strict minimum (vie de la base, vitesse, vision). Le champ de bataille ne doit pas disparaître derrière des panneaux HUD. Test visuel aux résolutions courantes, dont 1366 × 768. Cette esquisse est une **intention**, pas un layout pixel-perfect ; l'adaptation sur petits écrans reste à définir.

## Économie : cinq ressources proposées

| Ressource | Bâtiment | Rôle envisagé |
|---|---|---|
| **Énergie** | Réacteur | Alimenter machines, fabrication, sorts, processus de recherche |
| **Matière** | Extracteur | Fournir les matières premières |
| **Refroidissement** | Producteur à nommer (piste : cryopompe) | Modifier ou maintenir le rendement des bâtiments actifs |
| **Composants** | Fabrique | Transformer matière et énergie en intrants pour bâtiments et unités |
| **Données** | Laboratoire | Générer des sorts et des protocoles temporaires affectant la base |

Ces ressources remplaceraient les huit ressources **actuellement dans `assets/game_stats.json`**. Elles sont **une proposition de remplacement**, pas un renommage mécanique. La chaîne matière → composants doit apporter des décisions utiles ; sinon réexaminer sa raison d'être.

### Refroidissement : intention, pas protocole fixé

Hypothèse à tester : un bâtiment observé produit, chauffe éventuellement et peut être soutenu par le refroidissement ; hors vision, il pourrait dissiper sa chaleur. Mais nous n'avons **pas encore décidé** : stock ou débit, production conditionnée par la vision, chaleur par bâtiment, seuils, consommation, bonus/malus, surchauffe ni interaction avec ×2/×5. Ne pas inventer ces règles silencieusement.

### Données / protocoles

Le laboratoire produit des données utilisées pour lancer des **spells** ou **bonus temporaires** : accélérer la production, soutenir les défenses, activer momentanément quelques bâtiments hors vision, etc. Les exemples ne fixent pas de coûts, durées ou probabilités.

## Unités et roguelite

**Peu d'archétypes d'unités côté joueur**, capables d'évoluer de manières distinctes. Quelques possibilités envisagées : attaque corrosive/poison, soutien réparateur, protection. Le nombre d'unités et leurs capacités de départ ne sont pas encore fixés.

Question ouverte importante : une mutation de combat (ex. corrosion) est-elle :
- un choix de la **partie en cours**, temporaire jusqu'à la défaite ;
- un déblocage **persistant** de l'arbre de talents ;
- ou un déblocage persistant qui autorise un choix temporaire en partie ?

La troisième option a été proposée, **mais n'est pas encore une décision**. Séparer clairement cette question du système de données et des protocoles instantanés du laboratoire.

## Périmètre du premier prototype de refonte

1. **Conserver le prototype actuel jouable** et les tests existants, sans changer `main` par surprise.
2. Dessiner une tranche de la **DA** sur une grille logique 5 × 5 : nœuds, liens de vision, activité, un champ de bataille visuellement distinct. Pas besoin de redessiner tous les bâtiments.
3. Valider la lisibilité et le drag-and-drop avec des utilisateurs réels, notamment aux vitesses accélérées.
4. Définir séparément un **petit circuit économique** (réacteur, extracteur, fabrique et leur débouché) avant d'introduire tous les nouveaux types de bâtiments et les coûts.
5. Ne déployer refroidissement, laboratoire, mutations et nouvelles récompenses qu'une fois leurs invariants décidés.

**Ce que cela ne change pas :** grille 5 × 5, activation par l'attention, combat autonome, existence des vagues et progression roguelite. Aucune intégration Utopixia pour le moment.

## Réécriture : décision différée

L'idée d'une « V2 » est légitime, mais un big-bang rendrait les régressions difficiles à identifier. Comparer avant décision :
- **Migrations verticales** sur le dépôt existant : une mécanique à la fois, gameplay immédiatement comparé.
- **Tranche VNext isolée** réutilisant `World`, les tests et Phaser : nouvelle surface visuelle + boucle énergie/matière/unités, puis remplacement progressif.

Critère de réussite : une partie courte jouable où le joueur comprend l'activation par la vision, gère une petite chaîne de production et résiste à une vague, avec des tests indépendants du rendu pour les règles et un smoke test navigateur.

## Journal des décisions

- **Retenu :** local-only, Phaser, grille 5 × 5, vision comme activation, esthétique vectorielle minimaliste, champ de bataille visible, UI organisée par fonction.
- **Direction forte, non implémentée :** cinq ressources Énergie / Matière / Refroidissement / Composants / Données.
- **À trancher :** mécanique exacte du refroidissement ; coûts et cycles ; contrats producteurs/consommateurs ; familles d'unités ; mutations en partie vs persistantes ; détail responsive HUD ; migration progressive vs tranche VNext.
- **Hors périmètre :** blockchain, wallet, replays, snapshots, anti-triche, MMO, refonte réseau.

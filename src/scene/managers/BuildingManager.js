class BuildingManager {
    constructor(scene) {
        this.scene = scene;
        this.buildings = [];
        this.cards = [];

        this.buildingMap = {};
        scene.gameData.buildings.forEach(b => this.buildingMap[b.id] = b);

    }

    updateAll(delta) {
        this.buildings.forEach(b => b.update(delta));
    }

    checkCost(costObj) {
        for (let res in costObj) {
            if (!this.scene.resources[res] || this.scene.resources[res] < costObj[res]) {
                return false;
            }
        }
        return true;
    }

    payCost(costObj) {
        for (let res in costObj) {
            this.scene.resources[res] -= costObj[res];
        }
        this.scene.updateHUD();
    }

    addCardById(buildingId) {
        const building = this.buildingMap[buildingId];
        if (!building) return;

        const existing = this.cards.find(c => c.id === buildingId);

        if (existing && !building.unlimited) {
            existing.count++;
            existing.cardObj.setCount(existing.count);
            return;
        }

        const offsetX = 32 + this.cards.length * 120;
        const offsetY = 150 + this.scene.gridHeight * this.scene.tileSize;

        const cardData = {
            type: buildingId,
            color: parseInt(building.color.replace('#', '0x'))
        };

        const count = building.unlimited ? Infinity : 1;
        const card = new Card(this.scene, offsetX, offsetY, cardData, count);

        this.cards.push({ id: buildingId, count, cardObj: card });
    }

    reorganizeCards() {
        const offsetX = 32;
        const offsetY = 150 + this.scene.gridHeight * this.scene.tileSize;

        this.cards.forEach((entry, index) => {
            const card = entry.cardObj.card;
            const label = entry.cardObj.label;
            const countText = entry.cardObj.countText;

            const targetX = offsetX + index * 120;
            const targetY = offsetY;

            const cardWidth = card.displayWidth || 100;
            const cardHeight = card.displayHeight || 100;

            // 1. Mettre tout à la même origine
            card.setOrigin(0); // coin haut gauche
            label.setOrigin(0); // coin haut gauche
            countText.setOrigin(1, 1); // coin bas droit

            // 2. Appliquer positions
            this.scene.tweens.add({
                targets: [card, label, countText],
                x: targetX,
                y: targetY,
                duration: 200,
                ease: 'Power2'
            });

            // 3. Replacer manuellement les éléments si besoin (hors tween)
            label.setPosition(targetX + 10, targetY + 10); // coin haut gauche
            countText.setPosition(targetX + cardWidth - 8, targetY + cardHeight - 8); // coin bas droit

            // 4. Sauvegarde pour drag
            card.startX = targetX;
            card.startY = targetY;
        });
    }

    buildOnTile(tile, cardType) {
        const buildingData = this.buildingMap[cardType];
        if (!buildingData) return;

        const building = new Building(
            this.scene,
            tile.rect.x + this.scene.tileSize / 2,
            tile.rect.y + this.scene.tileSize / 2,
            tile,
            cardType
        );
        tile.building = building;
        this.buildings.push(building);

        // Gestion des cartes (stack/destroy/label)
        if (!buildingData.unlimited) {
            const cardStack = this.cards.find(c => c.id === cardType);
            if (cardStack) {
                cardStack.count--;
                cardStack.cardObj.setCount(cardStack.count);
                if (cardStack.count === 0) {
                    cardStack.cardObj.destroy();
                    this.cards = this.cards.filter(c => c !== cardStack);
                } else {
                    cardStack.cardObj.label.setText(`${cardStack.id} x${cardStack.count}`);
                }
                this.reorganizeCards();
            }
        }
    }

    getBuildingRuntimeInfo(building) {
        if (!building) return { name: '???', desc: 'Bâtiment inconnu.' };

        const type = building.type;
        const data = this.buildingMap[type];
        if (!data) return { name: type, desc: 'Aucune donnée.' };

        const name = data.name || type;
        let desc = data.desc || '';

        if (data.producesType === 'unit') {
            const unitData = this.scene.gameData.units.find(u => u.id === data.produces);
            const costText = unitData?.cost
                ? Object.entries(unitData.cost).map(([k, v]) => {
                    const res = this.scene.gameData.resources.find(r => r.id === k);
                    return `${res ? res.name : k}: ${v}`;
                }).join(', ')
                : 'Aucun coût';

            desc += `\nProduit: ${unitData?.name || data.produces} (${data.rate || 1})`;
            desc += `\nCoût unitaire: ${costText}`;
        } else if (data.producesType === 'resource') {
            const res = this.scene.gameData.resources.find(r => r.id === data.produces);
            desc += `\nProduit: ${res?.name || data.produces} (+${data.rate || 1})`;
        } else if (data.producesType === 'spell') {
            desc += `\nProduit: Protocole techno aléatoire (sort)`;
        }

        if (data.cooldown) {
            desc += `\nCycle: ${Math.round(data.cooldown / 1000)} sec`;
        }
        if (data.consumePerCycle) {
            const costText = Object.entries(data.consumePerCycle)
                .map(([k, v]) => {
                    const res = this.scene.gameData.resources.find(r => r.id === k);
                    return `${res ? res.name : k}: ${v}`;
                })
                .join(', ');
            desc += `\nConsomme par cycle: ${costText}`;
        }
        return { name, desc };
    }

    getDescription(type) {
        const building = this.buildingMap[type];
        if (!building) return { name: type || '???', desc: 'Aucune description disponible.' };

        let desc = building.desc || 'Aucune description.';
        if (building.cost) {
            const costText = Object.entries(building.cost)
                .map(([k, v]) => {
                    const res = this.scene.gameData.resources.find(r => r.id === k);
                    const name = res ? res.name : k;
                    return `${name}: ${v}`;
                })
                .join(', ');
            desc += `\nCoût:\n ${costText}`;
        }

        return {
            name: building.name || type,
            desc
        };
    }
}

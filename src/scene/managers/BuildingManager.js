class BuildingManager {
    constructor(scene) {
        this.scene = scene;
        this.buildings = [];
        this.cards = [];

        this.buildingMap = {};
        scene.gameData.buildings.forEach(b => this.buildingMap[b.id] = b);
        this.cardSlots = []; // <-- stockera les positions disponibles

        // draw a map of 5x2 and render image building_card_background on each tiles
        const tileHeight = 106;
        const tileWidth = 116;
        const offsetX = 200;
        const offsetY = 110 + scene.gridManager.offsetY + (scene.gridManager.height * scene.gridManager.tileSizeY);
        for (let j = 0; j < 3; j++) {
            for (let i = 0; i < 5; i++) {
                const x = offsetX + (i * tileWidth + 5 * i);
                const y = offsetY + (j * tileHeight + 5 * j);
                this.scene.add.image(x, y, 'building_card_background')
                    .setDisplaySize(tileWidth, tileHeight)
                    .setOrigin(0.5);
                this.cardSlots.push({ x: x - (tileWidth/2-7), y: y - (tileHeight/2-7) });
            }
        }
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

    updateCardStates() {
        this.cards.forEach(cardEntry => {
            const buildingData = this.buildingMap[cardEntry.id];
            const canAfford = this.scene.checkCost(buildingData.cost || {});
            const card = cardEntry.cardObj.card;

            if (!canAfford) {
                card.setAlpha(0.4); // Grisé
                card.disableDrag = true; // Flag custom pour bloquer le drag
            } else {
                card.setAlpha(1);
                card.disableDrag = false;
            }
        });
    }

    updateAllUnitCounters() {
        this.buildings.forEach(b => b.updateUnitCountText());
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

        const slot = this.cardSlots[this.cards.length];
        if (!slot) return; // plus de place

        const offsetX = slot.x;

        const offsetY = slot.y;

        const cardData = {
            type: buildingId,
            color: parseInt(building.color.replace('#', '0x')),
            img: building.img || undefined
        };

        const count = building.unlimited ? Infinity : 1;
        const card = new Card(this.scene, offsetX, offsetY, cardData, count);

        this.cards.push({ id: buildingId, count, cardObj: card });
    }

    reorganizeCards() {

        this.cards.forEach((entry, index) => {
            const card = entry.cardObj.card;
            const label = entry.cardObj.label;
            const countText = entry.cardObj.countText;

            if (!this.cardSlots[index]) return; // sécurité

            const slot = this.cardSlots[index];

            const targetX = slot.x//offsetX + index * 120;
            const targetY = slot.y

            const cardWidth = card.displayWidth || 100;
            const cardHeight = card.displayHeight || 100;

            // 1. Mettre tout à la même origine
            card.setOrigin(0); // coin haut gauche
            countText.setOrigin(1, 1); // coin bas droit

            let target = [card, countText]
            if(label){
                label.setOrigin(0); // coin haut gauche
                target.push(label)
                label.setPosition(targetX + 10, targetY + 10); // coin haut gauche
            }

            // 2. Appliquer positions
            this.scene.tweens.add({
                targets: [card, label, countText],
                x: targetX,
                y: targetY,
                duration: 200,
                ease: 'Power2'
            });

            countText.setPosition(targetX + cardWidth - 8, targetY + cardHeight - 8); // coin bas droit

            // 4. Sauvegarde pour drag
            card.startX = targetX;
            card.startY = targetY;
        });
    }

    getBuildingRuntimeInfo(building) {
        if (!building) {
            return {
                name: '???',
                desc: this.scene.translate('building_unknown')
            };
        }

        const type = building.type;
        const data = this.buildingMap[type];
        if (!data) {
            return {
                name: type,
                desc: this.scene.translate('building_no_data')
            };
        }

        const name = this.scene.translate(data.name) || type;
        let desc = this.scene.translate(data.desc) || '';

        // ➡️ Ajout ici : afficher coût de construction initial
        if (data.cost) {
            const costText = Object.entries(data.cost)
                .map(([k, v]) => {
                    const res = this.scene.gameData.resources.find(r => r.id === k);
                    return `  - ${this.scene.translate(res?.name) || k}: ${v}`;
                })
                .join('\n');
            desc += `\n\n${this.scene.translate('building_cost', { cost: costText })}`;
        }

        if (data.producesType === 'unit') {
            const unitData = this.scene.gameData.units.find(u => u.id === data.produces);
            const costText = unitData?.cost
                ? Object.entries(unitData.cost).map(([k, v]) => {
                    const res = this.scene.gameData.resources.find(r => r.id === k);
                    return `  - ${this.scene.translate(res?.name) || k}: ${v}`;
                }).join('\n')
                : this.scene.translate('building_no_unit_cost');

            desc += `\n` + this.scene.translate('building_product_unit', {
                unit: this.scene.translate(unitData?.name || data.produces),
                rate: data.rate || 1
            });
            desc += `\n` + this.scene.translate('building_unit_cost', { cost: costText });
        } else if (data.producesType === 'resource') {
            const res = this.scene.gameData.resources.find(r => r.id === data.produces);
            desc += `\n` + this.scene.translate('building_product_resource', {
                resource: this.scene.translate(res?.name || data.produces),
                rate: data.rate || 1
            });
        } else if (data.producesType === 'spell') {
            desc += `\n` + this.scene.translate('building_product_spell');
        }


        if (data.consumePerCycle) {
            let seconds = data.cooldown ? Math.round(data.cooldown / 1000) : 0;

            const costText = Object.entries(data.consumePerCycle)
                .map(([k, v]) => {
                    const res = this.scene.gameData.resources.find(r => r.id === k);
                    return `${this.scene.translate(res?.name) || k}: ${v}`;
                })
                .join(', ');
            desc += `\n` + this.scene.translate('building_cycle_consumption', { seconds: seconds, cost: costText });
        }

        return { name, desc };
    }

    getDescription(type) {
        const building = this.buildingMap[type];
        if (!building) {
            return {
                name: type || '???',
                desc: this.scene.translate('building_no_description')
            };
        }

        let desc = this.scene.translate(building.desc) || this.scene.translate('building_no_description');
        if (building.cost) {
            const costText = Object.entries(building.cost)
                .map(([k, v]) => {
                    const res = this.scene.gameData.resources.find(r => r.id === k);
                    const name = this.scene.translate(res?.name) || k;
                    return `${name}: ${v}`;
                })
                .join(', ');
            desc += `\n` + this.scene.translate('building_unit_cost', { cost: costText });
        }

        return {
            name: this.scene.translate(building.name) || type,
            desc
        };
    }
}

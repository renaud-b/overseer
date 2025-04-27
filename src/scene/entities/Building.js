class Building {
    constructor(scene, x, y, tile, type) {
        this.scene = scene;
        this.tile = tile;
        this.type = type;
        this.productionTimer = 0;
        this.cooldown = this.scene.buildingManager.buildingMap[type]?.cooldown || 1000; // en ms
        this.totalProduced = 0;

        this.sprite = scene.add.rectangle(x, y, scene.tileSize * 0.8, scene.tileSize * 0.8, 0xffffff)
            .setStrokeStyle(2, 0xffffff)
            .setOrigin(0.5)
            .setInteractive({ draggable: true }); // <- ici !

        this.sprite.cardType = type; // utile pour l’identification
        this.sprite.originTile = tile;
        this.scene.input.setDraggable(this.sprite);

        this.setColorByType(type);

        this.sprite.on('pointerover', () => {
            const info = this.scene.buildingManager.getBuildingRuntimeInfo(this);
            this.scene.hud.showInfoPanel(info.name, info.desc, this.sprite.x, this.sprite.y);
        });
        this.sprite.on('pointerout', () => {
            this.scene.hud.hideInfoPanel();
        });

        this.progressCircle = scene.add.graphics().setDepth(12);
        this.progressRadius = 10;

    }

    setColorByType(type) {
        const building = this.scene.buildingManager.buildingMap[type];
        if (building && building.color) {
            this.sprite.fillColor = Phaser.Display.Color.HexStringToColor(building.color).color;
        } else {
            this.sprite.fillColor = 0xffffff;
        }
    }


    update(delta) {
        if (!this.tile.isActive) return;
        this.updateCooldownVisual();

        this.productionTimer += delta;
        if (this.productionTimer < this.cooldown) return;

        this.productionTimer = 0;
        const data = this.scene.buildingManager.buildingMap[this.type];
        if (!data) return;

        const handlers = {
            unit: this.handleUnitProduction.bind(this),
            resource: this.handleResourceProduction.bind(this),
            spell: this.handleSpellProduction.bind(this)
        };

        handlers[data.producesType]?.(data);
    }

    handleUnitProduction(data) {
        const unitData = this.scene.gameData.units.find(u => u.id === data.produces);
        if (!unitData) return;

        const totalBuildings = this.scene.buildingManager.buildings.filter(b => b.type === this.type).length;
        const maxUnits = data.unitCap * totalBuildings;
        this.scene.unitCapMap[data.produces] = maxUnits;

        const currentUnits = this.scene.units[data.produces] || 0;

        if (currentUnits >= maxUnits) return;

        const cycleCost = data.consumePerCycle || unitData.cost || {};
        if (!this.scene.checkCost(cycleCost)) return;

        this.scene.payCost(cycleCost);
        this.scene.unitManager.addUnit(data.produces, data.rate || 1);
    }

    handleResourceProduction(data) {
        const consume = data.consumePerCycle || {};
        if (!this.scene.checkCost(consume)) return;

        let rate = data.rate || 1;
        const effectList = this.scene.artifactManager?.getAllActiveEffects() || [];

        if (effectList.includes('boost_condensor') && this.type === 'condensor') {
            rate *= 1.25;
        }
        if (effectList.includes('boost_refinery') && this.type === 'refinery') {
            rate *= 1.25;
        }
        if (effectList.includes('boost_decompiler') && this.type === 'decompiler') {
            rate += 1;
        }


        this.scene.payCost(consume);
        this.scene.addResource(data.produces, rate || 1);
        this.totalProduced += data.rate || 1;

        const max = data.max_produced;
        if (max && this.totalProduced >= max) {
            console.log(`💥 Le bâtiment ${this.type} s'est épuisé et est détruit.`);
            this.tile.building = null;
            this.scene.buildingManager.buildings = this.scene.buildingManager.buildings.filter(b => b !== this);
            this.destroy();
        }


    }

    handleSpellProduction() {
        const spell = Phaser.Utils.Array.GetRandom(this.scene.spellManager.spellData);
        console.log(`✨ Catalyseur génère : ${spell.name}`);
        this.scene.spellManager.addSpellToBar(spell);
    }


    updateCooldownVisual() {
        if (!this.tile.isActive || !this.cooldown) {
            this.progressCircle.clear();
            return;
        }

        const progress = Phaser.Math.Clamp(this.productionTimer / this.cooldown, 0, 1);

        const x = this.sprite.x - this.sprite.width / 2 + 12;
        const y = this.sprite.y - this.sprite.height / 2 + 12;

        // Ici : pas besoin de repositionner progressCircle (Graphics), on redessine directement
        this.progressCircle.clear();

        const producesType = this.scene.buildingManager.buildingMap[this.type]?.producesType;
        const color = {
            unit: 0x000000,
            resource: 0x000000,
            spell: 0x000000
        }[producesType] ?? 0xffffff;

        this.progressCircle.fillStyle(color, 0.2);
        this.progressCircle.slice(x, y, this.progressRadius, Phaser.Math.DegToRad(-90), Phaser.Math.DegToRad(-90 + 360 * progress), false);
        this.progressCircle.fillPath();
    }






    destroy() {
        [this.sprite, this.progressCircle].forEach(obj => obj?.destroy());
    }

}

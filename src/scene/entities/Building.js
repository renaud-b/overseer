class Building {
    constructor(scene, x, y, tile, type, buildingData) {
        this.scene = scene;
        this.tile = tile;
        this.type = type;
        this.buildingData = buildingData;
        this.productionTimer = 0;
        this.cooldown = scene.buildingManager.buildingMap[type]?.cooldown || 1000;

        this.scene.talentManager?.applyBehavioralTalentModifiers(this);

        this.totalProduced = 0;

        const sizeX = scene.tileSizeX * 0.8;
        const sizeY = scene.tileSizeY * 0.8;

        if (this.buildingData.img) {
            const buildingBackground = scene.add.image(0, 0, "building_card_background")
                .setOrigin(0.5)
                .setDisplaySize(scene.tileSizeX, scene.tileSizeY)
                .setDepth(2);
            this.buildingSprite = scene.add.image(0, 0, this.buildingData.img+"_on")
                .setOrigin(0.5)
                .setDisplaySize(sizeX, sizeY)
                .setDepth(2);
            this.buildingSpriteOff = scene.add.image(0, 0, this.buildingData.img+"_off")
                .setOrigin(0.5)
                .setDisplaySize(sizeX, sizeY)
                .setDepth(2)
                .setAlpha(0)

            this.sprite = scene.add.container(0, 0, [buildingBackground, this.buildingSprite, this.buildingSpriteOff])
                .setSize(sizeX, sizeY)
                .setDepth(2)

        } else {
            this.sprite = scene.add.rectangle(0, 0, sizeX, sizeY, 0xffffff)
                .setStrokeStyle(2, 0xffffff)
                .setDepth(10)
                .setOrigin(0.5);
            this.setColorByType(type, this.sprite, buildingData);
        }



        // Cercle de cooldown (graphics)
        const progressCircle = scene.add.graphics().setDepth(1);



        // Conteneur du bâtiment
        this.container = scene.add.container(x, y, [this.sprite, progressCircle])
            .setSize(sizeX, sizeY)
            .setDepth(10)
            .setInteractive(new Phaser.Geom.Rectangle(0, 0, sizeX, sizeY), Phaser.Geom.Rectangle.Contains);


        this.progressCircle = progressCircle;
        this.progressRadius = 10;

        this.container.cardType = type;
        this.container.originTile = tile;
        scene.input.setDraggable(this.container);

        this.container.on('pointerover', () => {
            const info = this.scene.buildingManager.getBuildingRuntimeInfo(this);
            this.scene.hud.showInfoPanel(info.name, info.desc, this.container.x, this.container.y);
        });
        this.container.on('pointerout', () => {
            this.scene.hud.hideInfoPanel();
        });
    }

    setColorByType(type, spriteRef = this.sprite, building) {
        if (building?.color) {
            spriteRef.fillColor = Phaser.Display.Color.HexStringToColor(building.color).color;
        } else {
            spriteRef.fillColor = 0xffffff;
        }
    }

    setActiveVisual(isActive) {
        if (this.sprite) {
            if(isActive){
                if(!this.buildingSprite || !this.buildingSpriteOff  ){
                    return
                }
                this.buildingSprite.setAlpha(1.0)
                this.buildingSpriteOff.setAlpha(0.0)
            } else {
                if(!this.buildingSprite || !this.buildingSpriteOff){
                    return
                }
                this.buildingSprite.setAlpha(0.0)
                this.buildingSpriteOff.setAlpha(1.0)
            }
        }
    }

    createFloatingResourceIcon(resourceId, amount = 1) {
        const iconKey = `icon_${resourceId}`;
        const tileCenterX = this.container.x; // Centre de la tuile
        const tileCenterY = this.container.y - (this.sprite.height / 2) + 10; // Légèrement au-dessus

        // ✅ Icône de ressource
        const icon = this.scene.add.image(tileCenterX, tileCenterY, iconKey)
            .setDisplaySize(24, 24)
            .setDepth(200)
            .setAlpha(1)
            .setOrigin(0.5);

        // ✅ Texte "+N"
        const text = this.scene.add.text(tileCenterX + 20, tileCenterY, `+${amount}`, {
            fontSize: '18px',
            fill: '#ffffff',
            fontFamily: 'monospace',
            stroke: '#000000',
            strokeThickness: 3
        }).setOrigin(0.5)
            .setDepth(200)
            .setAlpha(1);

        // ✅ Animation groupée
        this.scene.tweens.add({
            targets: [icon, text],
            y: tileCenterY - 40, // monte de 40px
            alpha: 0,
            duration: 1000, // 1s
            ease: 'Cubic.easeOut',
            onComplete: () => {
                icon.destroy();
                text.destroy();
            }
        });
    }



    update(delta) {
        this.setActiveVisual(this.tile.isActive);
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

    computeBonusRate() {
        const data = this
        let rate = data.rate || 1;
        rate *= this.scene.talentManager.getPlacementBonusMultiplier(this.tile, this.type);
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

        let bonusRate = rate || 1;

        if(this.tile.isResourceBoost){
            bonusRate *= this.tile.resourceBoost;
        }

        // Vérifie s'il y a un bonus
        if (this.scene.resourceBonusMultipliers && this.scene.resourceBonusMultipliers[data.produces]) {
            bonusRate *= this.scene.resourceBonusMultipliers[data.produces];
        }

        return bonusRate
    }

    handleResourceProduction(data) {
        const consume = data.consumePerCycle || {};
        if (!this.scene.checkCost(consume)) return;
        this.scene.payCost(consume);

        const bonusRate = this.computeBonusRate(data);
        this.currentRate = bonusRate;
        this.scene.addResource(data.produces, bonusRate);
        this.createFloatingResourceIcon(data.produces, bonusRate);

        this.totalProduced += data.rate || 1;

        const max = data.max_produced;
        if (max && this.totalProduced >= max) {
            this.tile.building = null;
            this.scene.buildingManager.buildings = this.scene.buildingManager.buildings.filter(b => b !== this);
            this.destroy();
        }
    }

    handleSpellProduction() {
        const spell = Phaser.Utils.Array.GetRandom(this.scene.spellManager.spellData);
        this.scene.spellManager.addSpellToBar(spell);
    }


    updateCooldownVisual() {
        const progress = Phaser.Math.Clamp(this.productionTimer / this.cooldown, 0, 1);
        this.progressCircle.clear();

        const color = 0x000000;
        this.progressCircle.fillStyle(color, 0.2);
        this.progressCircle.slice(-this.sprite.width / 2 + 12, -this.sprite.height / 2 + 12,
            this.progressRadius, Phaser.Math.DegToRad(-90), Phaser.Math.DegToRad(-90 + 360 * progress), false);
        this.progressCircle.fillPath();
    }

    getBaseRate() {
        const data = this.scene.buildingManager.buildingMap[this.type];
        return data?.rate || 1;
    }

    getEffectiveRate() {
        return this.currentRate || this.getBaseRate();
    }


    updateTalentVisualBadge() {
        // Supprimer le précédent si besoin
        if (this.talentBadge) {
            this.container.remove(this.talentBadge, true); // true = destroy
            this.talentBadge = null;
        }

        const rateBonus = this.getEffectiveRate() > this.getBaseRate();
        const hasBonus = this.attackSpeedMultiplier > 1 || rateBonus;

        if (hasBonus) {
            this.talentBadge = this.scene.add.text(
                20, -28, // position relative au container
                '+',
                {
                    fontSize: '16px',
                    fill: '#00ff00',
                    fontFamily: 'monospace',
                    fontStyle: 'bold'
                }
            );
            this.talentBadge.setOrigin(0.5).setDepth(21);
            this.container.add(this.talentBadge);
        }
    }

    destroy() {
        this.container?.destroy();
        this.talentBadge?.destroy();
    }

}

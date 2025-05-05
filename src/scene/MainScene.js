class MainScene extends Phaser.Scene {
    constructor() {
        super('MainScene');
        this.waveNumber = 0;
    }

    preload() {

        this.load.json('gameStats', '/ipfs/Qmavvk4HtB7cwrn3TVZ9RuspmahDAW3TjtMYcadAvYs1Ze'); // game_stats.json
        const lang = window.selectedLanguage || 'en';
        const assets = {
            'en': '/ipfs/QmZofYpipse1sKMx3XXZwmvMU4VHE5ofgGNbAdg17rHFGp', // game_texts_en.json
            'fr': '/ipfs/Qmdsk7ZTq4t6WmhTfUZrYzAmqVPeSwEVs84v2D4tzoToye', // game_texts_fr.json
            'es': '/ipfs/QmbACgTSvzUZhePYnANCz5wjDJotMfBPatCH4NpvpZgFgD', // game_texts_es.json
            'jp': '/ipfs/QmawNsDeTEbYcbfDRZFo8kMT2pit8fCcg1hGqQdKkfMbZR' // game_texts_jp.json
        }
        this.load.json('gameTexts', assets[lang]);


        this.load.image('droneSprite', 'assets/sprites/drone_01.png');
        this.load.image('cityWall', 'assets/city-wall.png');
        this.load.image('ground', 'assets/ground_02.png');

        // 🔽 Charge chaque icône de ressource
        const resources = [
            'hydronium', 'scrap', 'alloy', 'flux_crystal',
            'ion_field', 'bio_gel', 'compute_units', 'xeno_sample'
        ];
        resources.forEach(id => {
            this.load.image(`icon_${id}`, `assets/sprites/${id}.png`);
        });
    }


    create() {
        this.gameOverTriggered = false;
        this.cameras.main.fadeIn(500, 0, 0, 0);
        this.unlockedTalents = JSON.parse(localStorage.getItem('unlockedTalents') || '[]');


        this.globalGameTime = 0;
        this.timeScale = 1;
        this.tileSize = 100;

        const stats = this.cache.json.get('gameStats');
        const texts = this.cache.json.get('gameTexts');
        this.gameData = this.mergeStatsAndTexts(stats, texts);

        this.resources = {};
        this.gameData.resources.forEach((r) => {
                this.resources[r.id] = 0
        });

        this.unitCapMap = {};
        this.units = {};
        this.gameData.units.forEach(u => this.units[u.id] = 0);
        this.enemyUnits = [];
        this.playerUnits = [];
        this.projectiles = [];


        this.unitManager = new UnitManager(this, this.units)

        this.hud = new HUDManager(this, this.resources, this.units);
        this.buildingManager = new BuildingManager(this);
        this.spellManager = new SpellManager(this, this.gameData.spells)

        this.resourceBonusMultipliers = {}

        this.gridWidth = 5;
        this.gridHeight = 5;
        this.tileSize = 100;
        this.gridManager = new GridManager(this, this.gridWidth, this.gridHeight, this.tileSize);
        if (this.isTalentUnlocked('resource_node_scanner')) {
            const tile = Phaser.Utils.Array.GetRandom(this.gridManager.getAllTiles());
            tile.isResourceBoost = true;
            tile.rect.setFillStyle(0x00ff00, 0.2); // Visuel de tuile spéciale
        }

        this.zoneEffects = [];

        this.artifactManager = new ArtifactManager(this);


        this.createCardZone();
        this.vision = new Vision(this, this.tileSize, this.gridWidth, this.gridHeight, this.gridManager.tiles);

        if (this.isTalentUnlocked('vision_boost')) {
            console.log("Talent débloqué : Vision Boost");
            this.vision.level++;
            this.vision.updatePatternForLevel(); // Important ! Recalcule le pattern
            this.vision.updatePosition();        // Important ! Redessine la vision
        }

        this.createSpawnZones();

        if (this.isTalentUnlocked('starter_guard')) {
            this.unitManager.addUnit('unit_guard', 1);
        }
        if (this.isTalentUnlocked('starter_tech')) {
            this.buildingManager.addCardById('quantum_compressor');
        }
        if (this.isTalentUnlocked('starter_economy')) {
            this.resources['scrap'] += 20;
            this.resources['hydronium'] += 20;
        }
        if (this.isTalentUnlocked('extra_scrap')) {
            this.resourceBonusMultipliers['scrap'] = (this.resourceBonusMultipliers['scrap'] || 1) * 1.5;
        }
        if (this.isTalentUnlocked('extra_alloy')) {
            this.resourceBonusMultipliers['alloy'] = (this.resourceBonusMultipliers['alloy'] || 1) * 1.5;
        }
        if (this.isTalentUnlocked('vision_mastery')) {
            this.vision.level += 2;
            this.vision.updatePatternForLevel();
            this.vision.updatePosition();
        }
        if (this.isTalentUnlocked('spell_charge_boost')) {
            this.spellManager.globalCooldownMultiplier = 0.75;
        }


        let baseHp = 100;
        if (this.isTalentUnlocked('starter_base_hp')) {
            baseHp += 20;
        }

        this.baseTarget = this.add.rectangle(
            this.playerSpawnCircle.x-50,
            this.playerSpawnCircle.y,
            40, 40,
            0x00ff00,
            0.2
        ).setStrokeStyle(2, 0x00ff00).setDepth(11).setAlpha(0);


        this.baseTarget.hpText = this.add.text(
            this.baseTarget.x,
            this.baseTarget.y - 45,
            `PV: ${baseHp}`,
            {
                fontSize: '16px',
                fill: '#00ff00',
                fontFamily: 'monospace'
            }
        ).setOrigin(0.5).setDepth(11);

        this.baseTarget.hp = baseHp;
        this.baseTarget.maxHp = baseHp;

        this.timeline = new Timeline(this);
        this.waveManager = new WaveManager(this)


        this.input.keyboard.on('keydown-SPACE', () => {
            if (this.timeScale === 0) this.setTimeScale(this.lastTimeScale || 1);
            else { this.lastTimeScale = this.timeScale; this.setTimeScale(0); }
        });

        this.input.keyboard.on('keydown-ZERO', () => this.setTimeScale(0));
        this.input.keyboard.on('keydown-ONE', () => this.setTimeScale(1));
        this.input.keyboard.on('keydown-TWO', () => this.setTimeScale(3));
        this.input.keyboard.on('keydown-THREE', () => this.setTimeScale(5));

        this.add.sprite(-10, 50, 'cityWall')
            .setDisplaySize(this.tileSize*this.gridWidth+85, this.tileSize*this.gridHeight+100)
            .setOrigin(0)
            .setDepth(10);
        this.setupDragDrop();
    }


    mergeStatsAndTexts(stats, texts) {
        const merged = {};

        for (let category of Object.keys(stats)) {
            merged[category] = stats[category].map(item => {
                const textItem = (texts[category] || []).find(t => t.id === item.id);
                if (!textItem) {
                    console.warn(`⚠️ Texte manquant pour ${category}/${item.id}`);
                }
                return { ...item, ...(textItem || {}) };

            });
        }

        // Fusion spéciale pour les textes d'interface (ui)
        merged.ui = texts.ui || {};

        return merged;
    }

    translate(key, replacements = {}) {
        const text = this.gameData.ui[key] || key; // Si pas trouvé, retourne la clé brute

        return Object.entries(replacements).reduce((acc, [k, v]) => {
            return acc.replace(new RegExp(`{${k}}`, 'g'), v);
        }, text);
    }

    isTalentUnlocked(id) {
        return this.unlockedTalents.includes(id);
    }

    update(time, delta) {
        if (this.timeScale === 0) return;
        const scaledDelta = delta * this.timeScale;
        this.globalGameTime += scaledDelta;

        if (this.baseTarget.hp <= 0 && !this.gameOverTriggered) {
            console.log("base destroyed")
            this.baseTarget.hp = 0; // clamp visuel
            this.setTimeScale(0);
            this.triggerGameOver(); // isole le bloc dans une fonction
            return;
        } else if(this.baseTarget.hp <= 0) {
            console.log("target hp", this.baseTarget.hp)
            console.log("base destroyed", this.gameOverTriggered)
        }

        this.buildingManager.updateAll(scaledDelta);
        this.timeline.update(scaledDelta);
        this.projectiles.forEach(p => p.update(scaledDelta));
        this.enemyUnits.forEach(u => u.update(scaledDelta, this.playerUnits));
        this.playerUnits.forEach(u => u.update(scaledDelta, this.enemyUnits));

        this.enemyUnits = this.enemyUnits.filter(u => u.isAlive());
        this.waveManager.update(this.enemyUnits)
        this.unitManager.update()

        this.spellManager.updateSpellCooldowns();
        this.zoneEffects.forEach(z => z.update(scaledDelta));

        this.baseTarget.hp = Math.max(0, this.baseTarget.hp);
        this.baseTarget.hpText.setText(this.translate("base_hp")+`: ${Math.max(0, Math.floor(this.baseTarget.hp))}`);
        this.baseTarget.hpText.setFill(this.baseTarget.hp > 40 ? '#00ff00' : this.baseTarget.hp > 15 ? '#ffff00' : '#ff0000');


        this.artifactManager.update(scaledDelta)
    }

    triggerGameOver() {

        console.log("🛑 triggerGameOver called");
        try {
        this.gameOverTriggered = true;

        const wavesSurvived = this.waveManager.waveNumber || 0;
        const shardsEarned = Math.floor(wavesSurvived / 2);
        const currentShards = parseInt(localStorage.getItem('memoryShards') || '0');
        localStorage.setItem('memoryShards', "" + (currentShards + shardsEarned));

        this.gameOverOverlay = this.add.rectangle(
            0, 0, this.scale.width, this.scale.height,
            0x000000, 0.7
        ).setOrigin(0).setDepth(999);

        this.gameOverText = this.add.text(
            this.scale.width / 2, this.scale.height / 2 - 80,
            this.translate('base_destroyed_title'),
            {
                fontSize: '32px',
                fill: '#ffffff',
                align: 'center',
                fontFamily: 'monospace'
            }
        ).setOrigin(0.5).setDepth(1000);

        const btnX = this.scale.width / 2;
        const btnY = this.scale.height / 2 + 20;

        this.restartBtn = this.add.rectangle(btnX, btnY, 200, 50, 0x333333, 1)
            .setStrokeStyle(2, 0xffffff)
            .setOrigin(0.5)
            .setInteractive()
            .setDepth(1001);

        this.restartText = this.add.text(btnX, btnY, this.translate('restart_button'), {
            fontSize: '20px',
            fill: '#00ff00',
            fontFamily: 'monospace'
        }).setOrigin(0.5).setDepth(1002);

        this.restartBtn.on('pointerover', () => this.restartBtn.setFillStyle(0x555555));
        this.restartBtn.on('pointerout', () => this.restartBtn.setFillStyle(0x333333));
        this.restartBtn.on('pointerdown', () => {
            this.cameras.main.fadeOut(500, 0, 0, 0);
            this.time.delayedCall(500, () => {
                this.scene.start('OverseerCoreScene');
            });
        });
        }catch(e){
            console.error("❌ ERREUR dans triggerGameOver :", e);
        }
    }


    getDescription(type) {
        const building = this.buildingManager.buildingMap[type];
        if (building) {
            let desc = building.desc || 'Aucune description.';
            if (building.cost) {
                const costText = Object.entries(building.cost)
                    .map(([k, v]) => {
                        const res = this.gameData.resources.find(r => r.id === k);
                        const name = res ? res.name : k;
                        return `${name}: ${v}`;
                    })
                    .join(', ');
                desc += this.translate("building_cost", {cost: costText});
            }
            return {
                name: building.name || type,
                desc: desc
            };
        }
        return { name: type || '???', desc: 'Aucune description disponible.' };
    }


    createSpawnZones() {
        const playerSpawnRadius = 60;
        const enemySpawnRadius = 60;

        this.playerSpawnCircle = this.add.circle(
            600,
            350,
            playerSpawnRadius,
            0x00ff00,
            0.2
        ).setDepth(1).setVisible(false);

        this.enemySpawnCircle = this.add.circle(
            this.scale.width +enemySpawnRadius,
            this.scale.height / 2,
            enemySpawnRadius,
            0xff0000,
            0.2
        ).setDepth(1);
    }

    addResource(type, amount) {
        this.resources[type] += amount;
        this.hud.updateHUD(this.resources, this.units, this.unitCapMap);
    }


    createCardZone() {
        this.buildingManager.addCardById("condensor");
        this.buildingManager.addCardById("scrap_mine");
        this.buildingManager.addCardById("refinery");
        this.buildingManager.addCardById("drone_bay");
        //this.buildingManager.addCardById("god_sanctuary");
    }


    setupDragDrop() {
        this.input.on('drop', (pointer, gameObject, dropZone) => {
            const tile = dropZone.getData('tileRef');

            // ⚙️ Cas 1 : Placement depuis une carte
            if (gameObject.cardType && !gameObject.originTile) {
                if (!tile || tile.building) return;

                const buildingData = this.buildingManager.buildingMap[gameObject.cardType];
                if (!buildingData) return;

                const canAfford = this.checkCost(buildingData.cost || {});
                if (!canAfford && !buildingData.unlimited) {
                    // Repositionner la carte à son point d’origine
                    this.tweens.add({
                        targets: gameObject,
                        x: gameObject.startX || gameObject.input.dragStartX,
                        y: gameObject.startY || gameObject.input.dragStartY,
                        duration: 150,
                        ease: 'Back.easeOut'
                    });
                    return;
                }

                if (!buildingData.unlimited) {
                    this.payCost(buildingData.cost || {});
                }

                const building = new Building(
                    this,
                    tile.rect.x + this.tileSize / 2,
                    tile.rect.y + this.tileSize / 2,
                    tile,
                    gameObject.cardType
                );
                tile.building = building;
                this.buildingManager.buildings.push(building);

                // 🔁 Gère les cartes à usage limité
                if (!buildingData.unlimited) {
                    const cardStack = this.buildingManager.cards.find(c => c.id === gameObject.cardType);
                    if (cardStack) {
                        cardStack.count--;
                        cardStack.cardObj.setCount(cardStack.count);
                        if (cardStack.count === 0) {
                            cardStack.cardObj.destroy();
                            this.buildingManager.cards = this.buildingManager.cards.filter(c => c !== cardStack);
                        } else {
                            cardStack.cardObj.label.setText(`${cardStack.id} x${cardStack.count}`);
                        }
                        this.buildingManager.reorganizeCards();
                    }
                } else {
                    // repositionner proprement la carte
                    this.tweens.add({
                        targets: gameObject,
                        x: gameObject.startX || gameObject.input.dragStartX,
                        y: gameObject.startY || gameObject.input.dragStartY,
                        duration: 200,
                        ease: 'Back.easeOut'
                    });
                }
            }

            // ⚙️ Cas 2 : Déplacement d’un bâtiment existant (container)
            else if (gameObject.originTile) {
                const oldTile = gameObject.originTile;
                if (!tile) return;

                if (!tile.building) {
                    gameObject.setPosition(
                        tile.rect.x + this.tileSize / 2,
                        tile.rect.y + this.tileSize / 2
                    );

                    const building = oldTile.building;
                    oldTile.building = null;
                    tile.building = building;

                    building.tile = tile;
                    gameObject.originTile = tile;

                    console.log(`Déplacement du bâtiment ${gameObject.cardType} vers [${tile.x}, ${tile.y}]`);
                } else {
                    // retour à la position d’origine
                    gameObject.setPosition(
                        oldTile.rect.x + this.tileSize / 2,
                        oldTile.rect.y + this.tileSize / 2
                    );
                }
            }

            // ⚙️ Cas 3 : Sorts (inchangé)
            else if (gameObject.spellId) {
                const spell = this.spellManager.spellData.find(s => s.id === gameObject.spellId);
                if (!spell) return;

                const now = this.time.now;
                if (!gameObject.oneTime && this.spellManager.spellCooldowns[spell.id] > now) {
                    console.log("Sort en recharge.");
                    return;
                }

                const x = pointer.worldX;
                const y = pointer.worldY;
                this.spellManager.castSpellAt(spell, x, y);

                if (gameObject.oneTime) {
                    const index = this.spellManager.spellButtons.findIndex(s => s.btn === gameObject);
                    if (index !== -1) {
                        this.spellManager.spellButtons[index].btn.destroy();
                        this.spellManager.spellButtons[index].txt.destroy();
                        this.spellManager.spellButtons.splice(index, 1);
                        this.spellManager.reorganizeSpellBar();
                    }
                } else {
                    this.spellManager.spellCooldowns[spell.id] = now + spell.cooldown;
                }
            }
        });


        this.input.on('dragstart', (_, g) => g.setAlpha(0.5));
        this.input.on('drag', (_, g, x, y) => { g.setPosition(x, y) });
        this.input.on('drag', (pointer, gameObject, x, y) => {
            gameObject.setPosition(x, y)

            if (gameObject.spellId) {
                const spell = this.spellManager.spellData.find(s => s.id === gameObject.spellId);
                if (!spell) return;

                // Créer ou déplacer le cercle
                if (!this.spellManager.spellPreviewCircle) {
                    this.spellManager.spellPreviewCircle = this.add.circle(x, y, spell.radius, 0xffffff, 0.2)
                        .setStrokeStyle(2, 0xffffff)
                        .setDepth(4)
                        .setAlpha(0.6)
                        .setBlendMode(Phaser.BlendModes.ADD);
                } else {
                    this.spellManager.spellPreviewCircle.setPosition(x, y);
                }
            }
        });

        this.input.on('dragend', (pointer, gameObject, dropped) => {
            gameObject.setAlpha(1);

            // --- Cas 1 : Bâtiment déjà placé
            if (!dropped && gameObject.originTile) {
                this.tweens.add({
                    targets: gameObject,
                    x: gameObject.originTile.rect.x + this.tileSize / 2,
                    y: gameObject.originTile.rect.y + this.tileSize / 2,
                    duration: 200,
                    ease: 'Back.easeOut'
                });
            }

            // --- Cas 2 : Carte (non placée)
            if (!dropped && gameObject.startX !== undefined && gameObject.startY !== undefined) {
                this.tweens.add({
                    targets: gameObject,
                    x: gameObject.startX,
                    y: gameObject.startY,
                    duration: 200,
                    ease: 'Back.easeOut'
                });
            }

            // --- Cas 3 : Spell annulé → retour + suppression du preview
            if (gameObject.spellId) {
                this.tweens.add({
                    targets: gameObject,
                    x: gameObject.startX || gameObject.input.dragStartX,
                    y: gameObject.startY || gameObject.input.dragStartY,
                    duration: 200,
                    ease: 'Back.easeOut'
                });

                if (this.spellManager.spellPreviewCircle) {
                    this.spellManager.spellPreviewCircle.destroy();
                    this.spellManager.spellPreviewCircle = null;
                }
            }
        });

    }

    checkCost(costObj) {
        for (let res in costObj) {
            if (!this.resources[res] || this.resources[res] < costObj[res]) {
                return false;
            }
        }
        return true;
    }

    payCost(costObj) {
        for (let res in costObj) {
            this.resources[res] -= costObj[res];
        }
        this.hud.updateHUD(this.resources, this.units, this.unitCapMap);
    }

    getRandomPointInCircle(cx, cy, radius) {
        const angle = Phaser.Math.FloatBetween(0, 2 * Math.PI);
        const r = radius * Math.sqrt(Math.random()); // pour une distribution uniforme
        const x = cx + r * Math.cos(angle);
        const y = cy + r * Math.sin(angle);
        return { x, y };
    }

    setTimeScale(scale) {
        this.timeScale = scale;
        console.log(`⏱️ Temps réglé sur x${scale}`);

        const speedMap = { 0: 0, 1: 1, 3: 2, 5: 3 };
        const index = speedMap[scale] ?? 1;
        this.hud.highlightSelectedSpeed(index);
    }

}


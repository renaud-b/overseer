// Isolated VNext sandbox: ECS combat plus experimental, attention-driven production.
class VNextScene extends Phaser.Scene {
    constructor() { super({ key: 'VNextScene' }); }

    init(data = {}) {
        this.resumeRequested = data.resume === true;
    }

    saveStorage() {
        try { return typeof localStorage === 'undefined' ? null : localStorage; }
        catch (_) { return null; }
    }

    saveCurrentGame() {
        if (this.runFinished || !this.model) return false;
        const saved = OverseerVNextSave.write(this, this.saveStorage());
        if (!saved) this.note?.setText('Sauvegarde locale indisponible');
        return saved;
    }

    returnToMenu() {
        if (this.runFinished || this.saveCurrentGame()) this.scene.start('MainMenuScene');
    }

    finishRun() {
        if (this.runFinished) return;
        this.runFinished = true;
        OverseerVNextSave.clear(this.saveStorage()); // Never touch persistent talents.
        this.buildUi();
    }

    drawDefeatOverlay() {
        const w = this.scale.width, h = this.scale.height;
        const g = this.keep(this.add.graphics().setDepth(300));
        g.fillStyle(0x08121c, 0.92).fillRect(0, 0, w, h);
        g.fillStyle(0x0b1d2b, 1).fillRoundedRect(w / 2 - 220, h / 2 - 96, 440, 190, 8);
        g.lineStyle(1, 0xff6674, 0.7)
            .strokeRoundedRect(w / 2 - 220, h / 2 - 96, 440, 190, 8);
        this.keep(this.add.zone(w / 2, h / 2, w, h).setInteractive().setDepth(301));
        this.keep(this.add.text(w / 2, h / 2 - 53, 'BASE DÉTRUITE', {
            fontFamily: 'monospace', fontSize: '23px', color: '#ff6674'
        }).setOrigin(0.5).setDepth(302));
        this.keep(this.add.text(w / 2, h / 2 - 9, 'Fin de partie · sauvegarde effacée', {
            fontFamily: 'monospace', fontSize: '12px', color: '#9cb9c9'
        }).setOrigin(0.5).setDepth(302));
        g.fillStyle(0x143649).fillRoundedRect(w / 2 - 92, h / 2 + 31, 184, 39, 5);
        g.lineStyle(1, 0x62e7e1, 0.7).strokeRoundedRect(w / 2 - 92, h / 2 + 31, 184, 39, 5);
        this.keep(this.add.text(w / 2, h / 2 + 50, 'RETOUR AU MENU', {
            fontFamily: 'monospace', fontSize: '12px', color: '#e2eef3'
        }).setOrigin(0.5).setDepth(302));
        this.keep(this.add.zone(w / 2, h / 2 + 50, 184, 39)
            .setInteractive({ useHandCursor: true }).setDepth(303))
            .on('pointerdown', () => this.scene.start('MainMenuScene'));
    }

    preload() { this.load.json('vnextLegacyStats', 'assets/game_stats.json'); }

    create() {
        let restored = null;
        if (this.resumeRequested) {
            const saved = OverseerVNextSave.read(this.saveStorage());
            if (!saved) { this.scene.start('MainMenuScene'); return; }
            try { restored = OverseerVNextSave.restore(saved, OverseerECS.World); }
            catch (_) { this.scene.start('MainMenuScene'); return; }
        }
        this.model = restored ? restored.model : OverseerVNextPreview.createModel(OverseerECS.World);
        this.world = this.model.world;
        this.visionRules = Object.create(Vision.prototype);
        this.visionRules.level = restored?.visionLevel ?? 0;
        this.visionRules.createPatterns(); // Same L shape and rotations as the playable prototype.
        this.visionRules.patternIndex = restored?.patternIndex ?? this.visionRules.patternIndex;
        this.attention = restored?.attention ?? { x: 1, y: 1 };
        this.selectedType = null;
        this.movingId = null;
        this.speed = restored?.speed ?? 1;
        this.lastSpeed = restored?.lastSpeed ?? 1;
        this.baseHp = restored?.baseHp ?? 100;
        this.runFinished = false;
        this.autosaveElapsed = 0;
        this.ui = [];
        this.hitEffects = new OverseerHitEffects.HitEffects(); // Renderer-only state; never saved to ECS.
        this.actionEffects = new OverseerBattleActionEffects.BattleActionEffects();
        this.types = OverseerVNextBuildings.BUILDINGS;
        // The resource HUD borrows glyphs and colors from the corresponding buildings.
        // Cooling remains a placeholder; Data is produced by the compute node.
        this.resourceStyles = [
            { id: 'energy', label: 'Énergie', glyph: 'reactor', source: 'reactor', color: 0x35d8ef },
            { id: 'matter', label: 'Matière', glyph: 'extractor', source: 'extractor', color: 0x39dd92 },
            { id: 'cooling', label: 'Refroidissement', glyph: 'cooling', pending: true, color: 0x87b9e8 },
            { id: 'components', label: 'Composants', glyph: 'factory', source: 'factory', color: 0xf4ba58 },
            { id: 'data', label: 'Données', glyph: 'compute_node', source: 'compute_node', color: 0xb58aff }
        ];
        // Presentation-only throughput samples. Never persist or infer production from HUD state.
        this.resourceRateHistory = [];
        this.resourceRateClockMs = 0;
        this.productionPopups = []; // Presentation only.
        this.techDrag = null;
        this.zoneParticles=[];
        this.hoveredTile = null;
        this.tooltipObjects = [];
        this.technologyTooltipObjects = [];
        this.waveTooltipObjects = [];
        this.waveClock = restored?.waveClock ??
            { number: 0, elapsedMs: 0, seed: Math.floor(Math.random() * 0x100000000) };
        this.previewWaves = OverseerVNextWaves.preview(8, this.waveClock.seed, this.waveClock.number);
        this.waveMembers = restored?.waveMembers ?? new Map();
        this.rewardQueue = restored?.rewardQueue ?? [];
        this.activeReward = restored?.activeReward ?? null;
        this.rewardSerial = 0;

        if (restored) {
            OverseerVNextEconomy.initialize(this.model); // Backfill Data for old saves, preserve cycles.
            // No resetBattle(), production reset or re-grant: ECS is the restored truth.
            this.battleUnits = restored.battleUnits;
        } else {
            OverseerVNextCards.initialize(this.model);
            OverseerVNextTechnologies.inventory(this.model);
            OverseerVNextEconomy.initialize(this.model);
            this.applyAttention();
            this.resetBattle();
        }
        this.buildUi();
        this.input.keyboard.on('keydown', this.onKey, this);
        this.input.on('dragstart', this.onDragStart, this);
        this.input.on('drag', this.onDrag, this);
        this.input.on('dragend', this.onDragEnd, this);
        this.scale.on('resize', this.buildUi, this);
        this.onPageHide = () => this.saveCurrentGame();
        if (typeof window !== 'undefined') window.addEventListener?.('pagehide', this.onPageHide);
        this.events.once('shutdown', () => {
            this.hitEffects.clear();
            this.actionEffects.clear();
            this.battleMask?.destroy();
            this.battleMask = null;
            this.hideTechnologyTooltip();
            this.scale.off('resize', this.buildUi, this);
            if (typeof window !== 'undefined') window.removeEventListener?.('pagehide', this.onPageHide);
            this.input.keyboard.off('keydown', this.onKey, this);
            this.input.off('dragstart', this.onDragStart, this);
            this.input.off('drag', this.onDrag, this);
            this.input.off('dragend', this.onDragEnd, this);
        });
        if (!restored) this.saveCurrentGame();
    }

    keep(object) { this.ui.push(object); return object; }

    text(x, y, value, size = 14, color = '#dfeaf0') {
        return this.keep(this.add.text(x, y, value, {
            fontFamily: 'monospace', fontSize: `${size}px`, color
        }));
    }

    panel(g, x, y, w, h) {
        g.fillStyle(0x0a1a26, 0.75).fillRoundedRect(x, y, w, h, 7);
        g.lineStyle(1, 0x213b4a, 0.8).strokeRoundedRect(x, y, w, h, 7);
    }

    buildUi() {
        if (!this.model) return;
        if (this.dragGhost) { this.dragGhost.destroy(); this.dragGhost = null; }
        this.hideBuildingTooltip();
        this.hideTechnologyTooltip();
        this.hideResourceTooltip();
        this.hideWaveTooltip();
        this.battleMask?.destroy();
        this.battleMask = null;
        this.ui.forEach(object => object.destroy());
        this.clearProductionPopups();
        this.ui = [];
        const w = this.scale.width, h = this.scale.height;
        const m = 16, gap = 12, mainTop = 82, mainBottom = h - 86;
        const leftW = Math.min(244, Math.max(178, w * 0.18));
        const rightW = w >= 1160 ? 112 : 0;
        const centerX = m + leftW + gap;
        const centerRight = w - m - (rightW ? rightW + gap : 0);
        const centerW = centerRight - centerX;
        const boardW = Math.min(440, Math.max(205, centerW * 0.45));
        this.layout = {
            w, h, m, leftW, rightW, mainTop, mainBottom,
            centerX, centerRight, boardX: centerX, boardW,
            battleX: centerX + boardW + gap,
            battleW: centerW - boardW - gap,
            rightX: w - m - rightW
        };
        const g = this.keep(this.add.graphics());
        g.fillStyle(0x08121c).fillRect(0, 0, w, h);
        g.lineStyle(1, 0x1d3644, 0.9).lineBetween(m, 65, w - m, 65);
        this.text(m + 6, 19, OverseerVNextBrand.title, 23, OverseerVNextBrand.titleColor);
        this.text(m + 7, 49, OverseerVNextBrand.subtitle, 10, OverseerVNextBrand.subtitleColor);
        this.drawSpeedControls(w);
        this.panel(g, m, mainTop, leftW, mainBottom - mainTop);
        this.panel(g, centerX, mainTop, boardW, mainBottom - mainTop);
        this.panel(g, this.layout.battleX, mainTop, this.layout.battleW, mainBottom - mainTop);
        if (rightW) this.panel(g, this.layout.rightX, mainTop, rightW, mainBottom - mainTop);
        this.panel(g, m, h - 74, w - m * 2, 58);
        this.drawPalette();
        this.drawBoard();
        this.drawBattlePanel();
        this.resourceLabels = {};
        this.resourceStatusLabels = {};
        this.compactResources = null;
        this.compactResourceDeltas = null;
        if (rightW) this.drawRightPanel();
        else this.drawCompactResources();
        this.drawTechnologies();
        this.drawFooter();
        this.updateResourceHud();
        this.paintBoard();
        this.paintBattle();
        if (this.runFinished) this.drawDefeatOverlay();
        else if (this.activeReward) this.drawRewardOverlay();
        if (this.hoveredTile !== null) this.showBuildingTooltip(this.hoveredTile);
    }

    drawSpeedControls(w) {
        const labels = [0, 1, 2, 3, 5];
        const startX = Math.max(330, w - 472);
        labels.forEach((speed, i) => {
            const x = startX + 50 * i;
            const label = this.text(x, 23, speed === 0 ? 'Ⅱ' : `×${speed}`, 15,
                this.speed === speed ? '#64e9ee' : '#97b7c9');
            label.setPadding(11, 5, 11, 5).setInteractive({ useHandCursor: true });
            label.on('pointerdown', () => this.selectSpeed(speed));
        });
        const legacy = this.text(w - 183, 24, 'JEU ACTUEL ↗', 12, '#d4e4ee');
        legacy.setPadding(5).setInteractive({ useHandCursor: true });
        legacy.on('pointerdown', () => {
            if (this.saveCurrentGame()) this.scene.start('GameScene');
        });
        const menu = this.text(w - 59, 24, 'MENU', 12, '#7b9aad');
        menu.setPadding(5).setInteractive({ useHandCursor: true });
        menu.on('pointerdown', () => this.returnToMenu());
    }

    selectSpeed(speed) {
        if (this.activeReward) return; // A choice cannot unpause the simulation.
        if (speed === 0 && this.speed > 0) this.lastSpeed = this.speed;
        this.speed = speed;
        this.buildUi();
    }

    drawPalette() {
        const l = this.layout;
        this.text(l.m + 16, l.mainTop + 18, 'CONSTRUCTION', 15);
        this.text(l.m + 16, l.mainTop + 44, 'Déposer ou cliquer', 11, '#7da0b3');
        const g = this.keep(this.add.graphics());
        const cards = OverseerVNextCards.cards(this.model);
        cards.forEach((typeId, i) => {
            const type = OverseerVNextBuildings.getBuilding(typeId);
            const x = l.m + 12, y = l.mainTop + 76 + 75 * i;
            const cw = l.leftW - 24;
            this.text(x + 53, y + 19, type.label, 12);
            const recipe = OverseerVNextEconomy.PROTOTYPE_RECIPES[typeId];
            this.text(x + 53, y + 38, typeId === 'laboratory' ? 'RECHERCHE : 30 S / TECHNO' : recipe ? 'PRODUCTION EXPÉRIMENTALE' : 'À IMPLÉMENTER', 10, '#7393a8');
            const hit = this.keep(this.add.zone(x + cw / 2, y + 32, cw, 65).setInteractive({ useHandCursor: true }));
            hit.setData('palette', typeId);
            hit.on('pointerover', () => this.showCardTooltip(typeId, x + cw, y + 10));
            hit.on('pointerout', () => this.hideBuildingTooltip());
            hit.on('pointerdown', () => {
                if (this.activeReward) return;
                this.selectedType = this.selectedType === typeId ? null : typeId;
                this.movingId = null;
                this.paintBoard();
                this.refreshPaletteSelection();
            });
            this.input.setDraggable(hit);
        });
        if (!cards.length) this.text(l.m + 13, l.mainTop + 86, 'Aucune carte en main', 11, '#8ba9b9');
        this.paletteGraphics = g;
        this.refreshPaletteSelection();
        this.note = this.text(l.m + 13, l.mainBottom - 75, 'Économie ECS : test actif', 11, '#a5b8c6');
    }

    refreshPaletteSelection() {
        const g = this.paletteGraphics, l = this.layout;
        if (!g) return;
        g.clear();
        OverseerVNextCards.cards(this.model).forEach((typeId, i) => {
            const type = OverseerVNextBuildings.getBuilding(typeId);
            const x = l.m + 12, y = l.mainTop + 76 + 75 * i;
            const cw = l.leftW - 24;
            const chosen = this.selectedType === type.id;
            g.fillStyle(chosen ? 0x133448 : 0x0b1c29).fillRoundedRect(x, y, cw, 65, 5);
            g.lineStyle(1, chosen ? 0x55cce0 : 0x1b3c4d).strokeRoundedRect(x, y, cw, 65, 5);
            this.drawGlyph(g, type.id, x + 29, y + 32, type.color, 14);
        });
    }

    drawBoard() {
        const l = this.layout;
        this.text(l.boardX + 16, l.mainTop + 17, 'BASE  5 × 5', 15);
        this.drawVisionUpgrade();
        const usableH = l.mainBottom - l.mainTop;
        const gridSize = Math.max(110, Math.min(l.boardW - 26, usableH - 119));
        const cell = gridSize / 5;
        const x = l.boardX + (l.boardW - gridSize) / 2;
        const y = l.mainTop + 50 + Math.max(0, (usableH - 120 - gridSize) / 2);
        this.gridLayout = { x, y, size: gridSize, cell };
        this.boardGraphics = this.keep(this.add.graphics());
        for (let index = 0; index < 25; index++) {
            const cx = x + (index % 5 + 0.5) * cell;
            const cy = y + (Math.floor(index / 5) + 0.5) * cell;
            const hit = this.keep(this.add.zone(cx, cy, cell, cell).setInteractive({ useHandCursor: true }));
            hit.on('pointerdown', () => this.clickTile(index));
            hit.on('pointerover', () => {
                const building = OverseerVNextPreview.buildingAt(this.model, index);
                const name = building ? this.types.find(t => t.id === this.world.get(building, 'Building').type)?.label : null;
                const active = this.world.get(this.model.tiles[index], 'Watched').active;
                const production = building ? this.world.get(building, 'Production') : null;
                this.boardHint.setText(name ? `${name} · ${active ? (production?.blocked ? 'EN ATTENTE DE RESSOURCES' : 'ACTIF') : 'INACTIF'}` : 'Emplacement libre');
                this.showBuildingTooltip(index);
            });
            hit.on('pointerout', () => {
                this.hideBuildingTooltip();
                this.updateBoardHint();
            });
        }
        this.boardHint = this.text(l.boardX + 15, l.mainBottom - 42, '', 11, '#98b5c7');
        this.updateBoardHint();
    }

    drawVisionUpgrade() {
        const l = this.layout;
        // Keep it inside the base panel; the top HUD remains usable at 800px.
        const x = l.boardX + l.boardW - 15;
        this.visionUpgradeButton = this.text(x, l.mainTop + 16, '▲ VISION', 11)
            .setOrigin(1, 0).setInteractive({ useHandCursor: true });
        this.visionUpgradeButton.on('pointerdown', () => this.tryUpgradeVision());
        this.visionUpgradeCostLabel = this.text(x, l.mainTop + 35, '', 10)
            .setOrigin(1, 0);
        this.updateVisionUpgradeButton();
    }

    updateVisionUpgradeButton() {
        if (!this.visionUpgradeButton || !this.model) return;
        const level = this.visionRules.level;
        const cost = OverseerVNextVision.nextCost(level);
        if (cost === null) {
            this.visionUpgradeButton.setText('VISION MAX').setColor('#62e7e1');
            this.visionUpgradeCostLabel.setText('6 CASES').setColor('#819eaf');
            return;
        }
        const data = this.world.get(this.model.game, 'Resources')?.data ?? 0;
        const affordable = data >= cost && !this.activeReward && !this.runFinished;
        this.visionUpgradeButton.setText('▲ VISION').setColor(affordable ? '#b58aff' : '#7893a7');
        this.visionUpgradeCostLabel
            .setText(`${data}/${cost} DONNÉES`)
            .setColor(affordable ? '#b58aff' : '#7893a7');
    }

    tryUpgradeVision() {
        if (!this.model || this.runFinished || this.activeReward) return false;
        const level = this.visionRules.level;
        const nextPattern = this.visionRules.levelPatterns[level + 1]?.[this.visionRules.patternIndex];
        const resources = this.world.get(this.model.game, 'Resources');
        const result = OverseerVNextVision.purchase(level, resources, this.attention, nextPattern);
        if (!result) return false;
        this.visionRules.level = result.level;
        // Keep rotation even if the anchor must move to keep the new shape on the board.
        this.visionRules.visionPatterns = this.visionRules.levelPatterns[result.level];
        this.attention = result.attention;
        this.applyAttention();
        this.buildUi();
        this.saveCurrentGame();
        return true;
    }

    gridIndex(x, y) {
        const { x: gx, y: gy, size, cell } = this.gridLayout;
        if (x < gx || y < gy || x >= gx + size || y >= gy + size) return -1;
        return Math.floor((y - gy) / cell) * 5 + Math.floor((x - gx) / cell);
    }

    clickTile(index) {
        if (this.activeReward) return;
        let changed = false;
        const existing = OverseerVNextPreview.buildingAt(this.model, index);
        if (this.movingId !== null) {
            if (OverseerVNextPreview.moveBuilding(this.model, this.movingId, index)) {
                this.movingId = null;
                changed = true;
            }
        } else if (this.selectedType && !existing) {
            const placed = OverseerVNextCards.play(this.model, this.selectedType, index);
            if (placed !== null) {
                this.selectedType = null;
                changed = true;
                this.buildUi();
            }
        } else if (existing && !this.selectedType) {
            this.movingId = existing;
        }
        this.paintBoard();
        this.refreshPaletteSelection();
        this.updateBoardHint();
        if (this.hoveredTile !== null) this.showBuildingTooltip(this.hoveredTile);
        this.updateResourceHud();
        if (changed) this.saveCurrentGame();
    }

    updateBoardHint() {
        if (!this.boardHint) return;
        this.boardHint.setText(this.movingId !== null ? 'Déplacer : choisir une case libre' :
            this.selectedType ? 'Choisir une case libre' : 'ZQSD / WASD : vision   E : tourner');
    }

    hideBuildingTooltip() {
        for (const object of this.tooltipObjects || []) object.destroy();
        this.tooltipObjects = [];
        this.hoveredTile = null;
    }

    hideTechnologyTooltip() {
        for (const object of this.technologyTooltipObjects || []) object.destroy();
        this.technologyTooltipObjects = [];
    }

    showTechnologyTooltip(type, anchorX, anchorY, depth = 220) {
        this.hideTechnologyTooltip();
        // Keep displayed numbers in sync with the simulation, not HUD estimates.
        const { HEAL, BERSERK, STASIS, OVERCLOCK, OVERLOAD, EMP, REINFORCEMENTS } = OverseerVNextZones;
        const descriptions = {
            healing_field: {
                title: 'RÉGÉNÉRATION', color: 0x69d9a0,
                lines: [
                    'Soigne les alliés dans une zone',
                    `Rayon : ${HEAL.radius}`,
                    `+${HEAL.amount} PV toutes les ${HEAL.intervalMs / 1000} s`,
                    `Durée : ${HEAL.durationMs / 1000} s`
                ]
            },
            berserk: {
                title: 'BERSERK', color: 0xf4a261,
                lines: [
                    `Jusqu'à ${BERSERK.targets} alliés aléatoires`,
                    `Cadence d'attaque : +${Math.round((BERSERK.attackMultiplier - 1) * 100)} %`,
                    `Durée : ${BERSERK.durationMs / 1000} s`,
                    'Sans effet si aucun allié vivant'
                ]
            },
            stasis_field: {
                title: 'STASE', color: 0x87b9e8,
                lines: [
                    'Ralentit les ennemis dans la zone',
                    `Rayon : ${STASIS.radius}`,
                    `Vitesse : -${Math.round((1 - STASIS.speedMultiplier) * 100)} %`,
                    `Durée : ${STASIS.durationMs / 1000} s`
                ]
            },
            overclock: {
                title: 'SURCADENCEMENT', color: 0x62e7e1,
                lines: [
                    'Accélère tous les alliés',
                    `Déplacement : +${Math.round((OVERCLOCK.speedMultiplier - 1) * 100)} %`,
                    `Durée : ${OVERCLOCK.durationMs / 1000} s`,
                    'Sans bonus de cadence de tir'
                ]
            },
            overload: {
                title: 'SURCHARGE', color: 0xf5b94f,
                lines: [
                    'Bâtiments sous vision uniquement',
                    `Production : ×${OVERLOAD.productionMultiplier}`,
                    `Durée : ${OVERLOAD.durationMs / 1000} s`,
                    'Laboratoire exclu'
                ]
            },
            emp_field: {
                title: 'IMPULSION ÉLECTROMAGNÉTIQUE', color: 0xb5a7ff,
                lines: [
                    'Immobilise les ennemis dans la zone',
                    `Rayon : ${EMP.radius}`,
                    `Durée : ${EMP.durationMs / 1000} s`,
                    'Les ennemis peuvent toujours attaquer'
                ]
            },
            reinforcements: {
                title: 'RENFORTS', color: 0x44dc91,
                lines: [
                    'Invoque 1 soldat allié sur la zone',
                    `Durée : ${REINFORCEMENTS.durationMs / 1000} s`,
                    'Sans coût en ressources',
                    'Sans occuper une place de Caserne'
                ]
            }
        };
        const info = descriptions[type];
        if (!info) return;
        const width = 290, height = 176;
        const x = Math.max(8, Math.min(this.scale.width - width - 8, anchorX));
        const y = Math.max(72, Math.min(this.scale.height - height - 8, anchorY));
        const keep = object => { this.technologyTooltipObjects.push(object); return object; };
        const g = keep(this.add.graphics().setDepth(depth));
        g.fillStyle(0x0b1d2b, 0.98).fillRoundedRect(x, y, width, height, 6);
        g.lineStyle(1, info.color, 0.8).strokeRoundedRect(x, y, width, height, 6);
        const label = (tx, ty, value, size, color) =>
            keep(this.add.text(tx, ty, value, {
                fontFamily: 'monospace', fontSize: `${size}px`, color
            }).setDepth(depth + 1));
        label(x + 14, y + 13, info.title, 15, '#e3f0f5');
        info.lines.forEach((line, i) => label(x + 14, y + 44 + i * 23, line, 11, '#bed4df'));
        label(x + 14, y + 149, depth > 300 ?
            'CHOISIR POUR AJOUTER À L’INVENTAIRE' :
            (type === 'overload' ? 'GLISSER SUR LA BASE' : 'GLISSER SUR LE CHAMP DE BATAILLE'), 9, '#819eaf');
    }
    showBuildingTooltip(index) {
        this.hideBuildingTooltip();
        const id = OverseerVNextPreview.buildingAt(this.model, index);
        if (id === null) return;
        const type = this.world.get(id, 'Building').type;
        const { x: gx, y: gy, cell } = this.gridLayout;
        const cx = gx + (index % 5 + 0.5) * cell;
        const cy = gy + (Math.floor(index / 5) + 0.5) * cell;
        this.renderBuildingTooltip(type, cx + cell * 0.48, cy - 92);
    }

    showCardTooltip(type, x, y) {
        this.hideBuildingTooltip();
        this.renderBuildingTooltip(type, x + 12, y);
    }

    renderBuildingTooltip(type, anchorX, anchorY) {
        const info = OverseerVNextBuildings.getBuilding(type);
        if (!info) return;
        const recipe = OverseerVNextEconomy.PROTOTYPE_RECIPES[type];
        const width = 266, height = 185, pad = 13;
        const x = Math.max(8, Math.min(this.scale.width - width - 8, anchorX));
        const y = Math.max(72, Math.min(this.scale.height - height - 8, anchorY));
        const keepTip = object => { this.tooltipObjects.push(object); return object; };
        const g = keepTip(this.add.graphics().setDepth(210));
        g.fillStyle(0x0b1d2b, 0.98).fillRoundedRect(x, y, width, height, 6);
        g.lineStyle(1, info.color, 0.7).strokeRoundedRect(x, y, width, height, 6);
        this.drawGlyph(g, type, x + 22, y + 23, info.color, 11);
        const label = (tx, ty, content, size = 11, color = '#c7dce6') =>
            keepTip(this.add.text(tx, ty, content, { fontFamily: 'monospace', fontSize: `${size}px`, color }).setDepth(211));
        label(x + 41, y + 14, info.label, 15, '#e3f0f5');
        label(x + pad, y + 48, info.description, 11, '#a6bfce');
        if (!recipe) {
            if (type === 'laboratory') {
                label(x + pad, y + 105, 'PRODUIT : TECHNOLOGIE DE SOIN', 10, '#69d9a0');
                label(x + pad, y + 128, '1 TECHNOLOGIE / 30 S SOUS VISION', 10, '#b58aff');
                label(x + pad, y + 151, 'INVENTAIRE : PANNEAU DE DROITE', 9, '#819eaf');
            } else label(x + pad, y + 105, 'PRODUCTION NON SIMULÉE', 11, '#819eaf');
            return;
        }
        const drawItems = (title, entries, rowY) => {
            label(x + pad, rowY, title, 10, '#819eaf');
            let ix = x + 18;
            for (const [resource, quantity] of entries) {
                const style = this.resourceStyles.find(item => item.id === resource);
                if (!style) continue;
                this.drawResourceIcon(g, style, ix + 7, rowY + 27, 8);
                label(ix + 22, rowY + 19, String(quantity), 13, '#e3f0f5');
                ix += 76;
            }
        };
        const inputs = Object.entries(recipe.consumes);
        drawItems(OverseerVNextEconomy.MILITARY[type] ? 'COÛT PAR UNITÉ' : 'CONSOMME / CYCLE', inputs, y + 99);
        if (OverseerVNextEconomy.MILITARY[type]) {
            label(x + pad, y + 142, `CYCLE : ${recipe.cycleMs / 1000}s / UNITÉ`, 10, '#819eaf');
            label(x + 18, y + 162, `UNITÉS ${OverseerVNextEconomy.aliveUnits(this.model, type)}/${OverseerVNextEconomy.unitCapacity(this.model, type)}`, 11, '#62e7e1');
        } else {
            drawItems('PRODUIT / CYCLE', Object.entries(recipe.produces).filter(([key]) => !key.startsWith('unit_')), y + 138);
            label(x + width - 78, y + 168, `${recipe.cycleMs / 1000}s/cycle`, 9, '#819eaf');
        }
    }

    drawGlyph(g, type, x, y, color, r) {
        g.lineStyle(2, color, 1);
        if (type === 'reactor') g.strokeCircle(x, y, r * 0.75);
        else if (type === 'extractor') {
            g.strokeEllipse(x, y, r * 1.5, r * 0.95);
            g.lineBetween(x - r * 0.7, y + r * 0.7, x + r * 0.7, y - r * 0.7);
        } else if (type === 'factory') {
            const points = Array.from({ length: 6 }, (_, i) => ({
                x: x + Math.cos(Math.PI * i / 3) * r,
                y: y + Math.sin(Math.PI * i / 3) * r
            }));
            g.strokePoints(points, true);
        } else if (type === 'compute_node') {
            g.strokeRect(x - r * 0.65, y - r * 0.65, r * 1.3, r * 1.3);
            g.strokeCircle(x, y, r * 0.28);
            g.lineBetween(x - r, y, x - r * 0.65, y);
            g.lineBetween(x + r * 0.65, y, x + r, y);
        } else if (type === 'laboratory') {
            g.strokePoints([{ x, y: y - r }, { x: x + r, y }, { x, y: y + r }, { x: x - r, y }], true);
        } else {
            g.strokeRect(x - r * 0.7, y - r * 0.7, r * 1.4, r * 1.4);
        }
    }

    paintBoard() {
        if (!this.boardGraphics || !this.gridLayout) return;
        const g = this.boardGraphics;
        g.clear();
        const { x, y, size, cell } = this.gridLayout;
        if(OverseerVNextZones.active(this.model,'overload')) {
            const title=this.boardHint;
            if(title)title.setColor('#f5b94f');
        } else if(this.boardHint)this.boardHint.setColor('#8eaaba');
        g.lineStyle(1, 0x214052, 0.32);
        for (let i = 0; i <= 5; i++) {
            g.lineBetween(x + cell * i, y, x + cell * i, y + size);
            g.lineBetween(x, y + cell * i, x + size, y + cell * i);
        }
        const point = index => ({ x: x + (index % 5 + 0.5) * cell, y: y + (Math.floor(index / 5) + 0.5) * cell });
        for (let i = 0; i < 25; i++) {
            const p = point(i);
            const watched = this.world.get(this.model.tiles[i], 'Watched').active;
            // Attention must remain legible even when no building occupies the tile.
            // These markers are visual only: the Watched ECS component owns activation.
            if (watched && OverseerVNextPreview.buildingAt(this.model, i) === null) {
                g.fillStyle(0x75d8e6, 0.95).fillCircle(p.x, p.y, 5.5);
                g.lineStyle(1, 0x75d8e6, 0.5).strokeCircle(p.x, p.y, 11);
            } else if (!watched) {
                g.fillStyle(0x315269, 0.7).fillCircle(p.x, p.y, 2.5);
            }
        }
        g.lineStyle(2, 0x55d6e8, 0.75);
        OverseerVNextPreview.attentionLinks(this.model).forEach(([a, b]) => {
            const pa = point(a), pb = point(b);
            g.lineBetween(pa.x, pa.y, pb.x, pb.y);
        });
        this.world.query('Building', 'GridSlot').forEach(id => {
            const slot = this.world.get(id, 'GridSlot').index;
            const p = point(slot);
            const type = this.world.get(id, 'Building').type;
            const style = this.types.find(t => t.id === type);
            if (!style) return;
            const active = this.world.get(this.model.tiles[slot], 'Watched').active;
            g.fillStyle(0x08121c, 1).fillCircle(p.x, p.y, cell * 0.31);
            g.lineStyle(active ? 2.5 : 1.5, style.color, active ? 1 : 0.34);
            g.strokeCircle(p.x, p.y, cell * 0.29);
            if (active) {
                g.lineStyle(1, 0x67e5e7, 0.7).strokeCircle(p.x, p.y, cell * 0.36);
            }
            this.drawGlyph(g, type, p.x, p.y, active ? style.color : 0x5b7687, cell * 0.18);
            const progress = this.world.get(id, 'Production') || (type === 'laboratory' ? this.world.get(id, 'Research') : null);
            const progressDuration = type === 'laboratory' ? OverseerVNextTechnologies.RESEARCH_MS : progress?.cooldownMs;
            if (active && progress && progressDuration > 0) {
                // Small progress indicator, driven by ECS state, not a Phaser timer.
                const px = p.x - cell * 0.25, py = p.y + cell * 0.36, pw = cell * 0.5;
                g.fillStyle(0x294354, 0.8).fillRect(px, py, pw, 3);
                g.fillStyle(progress.blocked ? 0xff6674 : 0x62e7e1, 0.95)
                    .fillRect(px, py, pw * Math.min(1, progress.elapsedMs / progressDuration), 3);
            }
            if (id === this.movingId) g.lineStyle(2, 0xffffff, 0.9).strokeCircle(p.x, p.y, cell * 0.4);
        });
    }

    applyAttention() {
        const offsets = this.visionRules.visionPatterns[this.visionRules.patternIndex];
        const indices = offsets.map(({ x, y }) => (this.attention.y + y) * 5 + this.attention.x + x);
        return OverseerVNextPreview.setObserved(this.model, indices);
    }

    changeAttention(dx, dy, rotate = false) {
        if (this.activeReward) return false;
        const candidate = { x: this.attention.x + dx, y: this.attention.y + dy };
        const nextRotation = (this.visionRules.patternIndex + (rotate ? 1 : 0)) % 4;
        const pattern = this.visionRules.visionPatterns[nextRotation];
        if (!pattern.every(p => candidate.x + p.x >= 0 && candidate.x + p.x < 5 &&
                                  candidate.y + p.y >= 0 && candidate.y + p.y < 5)) return false;
        this.attention = candidate;
        this.visionRules.patternIndex = nextRotation;
        this.applyAttention();
        this.paintBoard();
        this.updateResourceHud();
        return true;
    }

    onKey(event) {
        if (this.activeReward) {
            if (event.code === 'Space') event.preventDefault();
            return;
        }
        if (event.code === 'Space') { event.preventDefault(); this.selectSpeed(this.speed === 0 ? (this.lastSpeed || 1) : 0); return; }
        if (['Digit1', 'Digit2', 'Digit3', 'Digit5'].includes(event.code)) {
            this.selectSpeed(Number(event.code.slice(-1))); return;
        }
        if (event.code === 'KeyE') { this.changeAttention(0, 0, true); return; }
        const key = event.key.toLowerCase();
        const azerty = window.keyboardLayout === 'azerty';
        const arrows = {
            arrowup: [0, -1], arrowdown: [0, 1], arrowleft: [-1, 0], arrowright: [1, 0]
        };
        const move = arrows[key] || (key === (azerty ? 'z' : 'w') ? [0, -1] :
            key === (azerty ? 'q' : 'a') ? [-1, 0] : key === 's' ? [0, 1] : key === 'd' ? [1, 0] : null);
        if (move) this.changeAttention(...move);
    }

    onDragStart(pointer, object) {
        if (this.activeReward) return;
        this.hideTechnologyTooltip();
        const technology=object.getData('technology');
        if(OverseerVNextTechnologies.TYPES.includes(technology)){this.techDrag=technology;this.dragGhost=this.add.graphics();this.dragGhost.lineStyle(2,0x69d9a0,1).strokeCircle(0,0,16);this.dragGhost.setPosition(pointer.x,pointer.y).setDepth(300);return;}
        const type = object.getData('palette');
        if (!type) return;
        this.dragType = type;
        this.dragGhost = this.add.graphics();
        this.drawGlyph(this.dragGhost, type, 0, 0, this.types.find(t => t.id === type).color, 21);
        this.dragGhost.setPosition(pointer.x, pointer.y).setDepth(300);
    }

    onDrag(pointer, object) {
        if ((object.getData('palette')||object.getData('technology')) && this.dragGhost) this.dragGhost.setPosition(pointer.x, pointer.y);
    }

    onDragEnd(pointer, object) {
        if (this.activeReward) {
            this.dragGhost?.destroy();
            this.dragGhost = null;
            this.dragType = null;
            return;
        }
        if(OverseerVNextTechnologies.TYPES.includes(object.getData('technology'))) {
            const technology=object.getData('technology');
            const target=technology==='overload' ? this.baseTechnologyTarget(pointer.x,pointer.y) : this.technologyTarget(pointer.x,pointer.y);
            if(target && OverseerVNextTechnologies.consume(this.model,technology)) {
                this.castTechnology(object.getData('technology'),target);
                this.saveCurrentGame();
            }
            this.dragGhost?.destroy();this.dragGhost=null;this.techDrag=null;this.buildUi();return;
        }
        if (!object.getData('palette')) return;
        const index = this.gridIndex(pointer.x, pointer.y);
        const placed = index !== -1 ? OverseerVNextCards.play(this.model, object.getData('palette'), index) : null;
        this.dragGhost?.destroy();
        this.dragGhost = null;
        this.dragType = null;
        this.selectedType = null;
        this.paintBoard();
        this.updateBoardHint();
        this.buildUi();
        if (placed !== null) this.saveCurrentGame();
    }

    clearProductionPopups() {
        for (const popup of this.productionPopups || []) {
            popup.icon.destroy();
            popup.label.destroy();
        }
        this.productionPopups = [];
    }

    showProductionPopup(event) {
        if (event.type !== 'production' || !this.world.has(event.building) || !this.gridLayout) return;
        const slot = this.world.get(event.building, 'GridSlot')?.index;
        if (!Number.isInteger(slot) || slot < 0 || slot >= 25) return;
        const recipe = OverseerVNextEconomy.PROTOTYPE_RECIPES[event.buildingType];
        if (!recipe) return;
        const { x, y, cell } = this.gridLayout;
        const cx = x + (slot % 5 + 0.5) * cell;
        const cy = y + (Math.floor(slot / 5) + 0.5) * cell;
        for (const [resource, amount] of Object.entries(recipe.produces)) {
            if (!amount || resource.startsWith('unit_')) continue;
            const style = this.resourceStyles.find(item => item.id === resource && !item.pending);
            if (!style) continue;
            const icon = this.add.graphics().setDepth(100);
            this.drawResourceIcon(icon, style, cx - 15, cy - cell * 0.29, 7);
            const label = this.add.text(cx - 4, cy - cell * 0.29 - 8, `+${amount}`, {
                fontFamily: 'monospace', fontSize: '12px',
                color: `#${style.color.toString(16).padStart(6, '0')}`
            }).setDepth(100);
            this.productionPopups.push({ icon, label, elapsedMs: 0, startY: cy - cell * 0.29 });
        }
        while (this.productionPopups.length > 24) {
            const oldest = this.productionPopups.shift();
            oldest.icon.destroy();
            oldest.label.destroy();
        }
    }

    updateProductionPopups(delta) {
        if (delta <= 0) return;
        for (const popup of this.productionPopups) {
            popup.elapsedMs += delta;
            const progress = Math.min(1, popup.elapsedMs / 850);
            const rise = progress * 24;
            const alpha = 1 - progress;
            popup.icon.setY(-rise).setAlpha(alpha);
            popup.label.setY(popup.startY - 8 - rise).setAlpha(alpha);
        }
        this.productionPopups = this.productionPopups.filter(popup => {
            if (popup.elapsedMs < 850) return true;
            popup.icon.destroy();
            popup.label.destroy();
            return false;
        });
    }

    drawResourceIcon(g, style, x, y, radius = 10) {
        if (style.glyph !== 'cooling') {
            this.drawGlyph(g, style.glyph, x, y, style.color, radius);
            return;
        }
        // Three crossing axes make a compact, recognizable cold/snow symbol.
        g.lineStyle(1.8, style.color, 0.9);
        for (const angle of [0, Math.PI / 3, 2 * Math.PI / 3]) {
            const dx = Math.cos(angle) * radius, dy = Math.sin(angle) * radius;
            g.lineBetween(x - dx, y - dy, x + dx, y + dy);
        }
    }

    hideResourceTooltip() {
        if (this.resourceTooltip) this.resourceTooltip.destroy();
        this.resourceTooltip = null;
    }

    showResourceTooltip(style, x, y) {
        this.hideResourceTooltip();
        const tipX = Math.max(8, Math.min(this.scale.width - 190, x));
        const tipY = Math.max(72, Math.min(this.scale.height - 35, y));
        this.resourceTooltip = this.add.text(tipX, tipY, style.label, {
            fontFamily: 'monospace', fontSize: '12px', color: '#e3f0f5',
            backgroundColor: '#0b1d2b', padding: { x: 9, y: 6 }
        }).setDepth(220);
    }

    drawCompactResources() {
        // Compact HUD lives under the grid, not on top of construction cards.
        const l = this.layout, x = l.boardX + 16;
        const startY = this.gridLayout.y + this.gridLayout.size + 12;
        const g = this.keep(this.add.graphics());
        this.compactResources = {};
        this.compactResourceDeltas = {};
        this.resourceStyles.filter(style => !style.pending).forEach((style, i) => {
            const y = startY + i * 21;
            this.drawResourceIcon(g, style, x + 8, y + 7, 8);
            const color = `#${style.color.toString(16).padStart(6, '0')}`;
            this.compactResources[style.id] = this.text(x + 25, y - 2, '0', 14, color);
            this.compactResourceDeltas[style.id] = this.text(l.boardX + l.boardW - 16, y, '—', 11, '#7898aa').setOrigin(1, 0);
            this.resourceHoverZone(style, x, y - 3, l.boardW - 32, 22, x + 7, y - 30);
        });
    }

    resourceHoverZone(style, x, y, w, h, tipX, tipY) {
        const zone = this.keep(this.add.zone(x + w / 2, y + h / 2, w, h).setInteractive());
        zone.setData('resource', style.id);
        zone.on('pointerover', () => this.showResourceTooltip(style, tipX, tipY));
        zone.on('pointerout', () => this.hideResourceTooltip());
        return zone;
    }

    castTechnology(type,target) {
        if(type==='reinforcements') {
            const config=this.cache.json.get('vnextLegacyStats')?.units?.find(unit=>unit.id==='unit_guard');
            const summoned=OverseerVNextZones.cast(this.model,type,target,{unitConfig:config});
            if(summoned!==null)this.battleUnits.push(summoned);
            return summoned;
        }
        return OverseerVNextZones.cast(this.model,type,target);
    }

    drawBattlePanel() {
        const l = this.layout;
        this.text(l.battleX + 15, l.mainTop + 17, 'CHAMP DE BATAILLE', 15);
        const { battleX, battleW, mainTop, mainBottom } = l;
        this.battleBounds = { x: battleX + 12, y: mainTop + 48, w: battleW - 24, h: mainBottom - mainTop - 96 };
        const g = this.keep(this.add.graphics());
        const b = this.battleBounds;
        g.lineStyle(1, 0x1c3949, 0.5).lineBetween(b.x + b.w * 0.52, b.y, b.x + b.w * 0.52, b.y + b.h);
        this.zoneGraphics = this.keep(this.add.graphics());
        this.battleGraphics = this.keep(this.add.graphics());
        this.battleParticleGraphics = this.keep(this.add.graphics());
        this.battleActionGraphics = this.keep(this.add.graphics());
        // A geometry mask clips every battlefield effect, including large detection rings.
        // Mask geometry is defined in screen coordinates and rebuilt on resize.
        this.battleMaskGraphic = this.keep(this.add.graphics());
        this.battleMaskGraphic.fillStyle(0xffffff, 1)
            .fillRect(b.x, b.y, b.w, b.h)
            .setVisible(false);
        this.battleMask = this.battleMaskGraphic.createGeometryMask();
        for (const graphics of [this.zoneGraphics, this.battleGraphics,
            this.battleParticleGraphics, this.battleActionGraphics]) {
            graphics.setMask(this.battleMask);
        }
        this.battleStatus = this.text(l.battleX + 15, mainBottom - 38, '', 11, '#8eabbc');
    }

    drawRightPanel() {
        const l = this.layout, x = l.rightX + 9;
        const g = this.resourceGraphics = this.keep(this.add.graphics());
        this.resourceLabels = {};
        this.resourceStatusLabels = {};
        this.resourceStyles.forEach((style, i) => {
            const y = l.mainTop + 24 + i * 34;
            this.drawResourceIcon(g, style, x + 8, y + 9, 8);
            this.resourceHoverZone(style, x - 4, y - 4, l.rightW - 10, 30, l.rightX - 190, y - 2);
            const color = style.pending ? '#67869b' : `#${style.color.toString(16).padStart(6, '0')}`;
            if (style.pending) {
                this.text(x + 21, y, '—', 15, color);
                return;
            }
            this.resourceLabels[style.id] = this.text(x + 21, y - 2, '0', 15, color);
            this.resourceStatusLabels[style.id] = this.text(l.rightX + l.rightW - 8, y + 1, '—', 10, '#7898aa').setOrigin(1, 0);
        });
    }

    // Statuses report real ECS activation/blockage. The rate indicator uses
    // actual balance changes over simulation time, not projected recipe output.
    drawTechnologies() {
        const l=this.layout, right=Boolean(l.rightW);
        const x=right?l.rightX+12:l.boardX+16;
        const y=right?l.mainTop+223:this.gridLayout.y+this.gridLayout.size+105;
        const items=OverseerVNextTechnologies.inventory(this.model).items;
        if(!right && l.leftW<165)return;
        this.text(x,y,'TECHNOLOGIES',12,'#b58aff');
        const styles=[['healing_field','✚ SOIN',0x69d9a0],['berserk','⚡ BERSERK',0xf4a261],['stasis_field','◌ STASE',0x87b9e8],['overclock','» SURCAD.',0x62e7e1],['overload','↑ SURCHARGE',0xf5b94f],['emp_field','◇ EMP',0xb5a7ff],['reinforcements','+ RENFORTS',0x44dc91]];
        let row=0;
        for(const [type,name,color] of styles){
            const count=items.filter(item=>item===type).length;
            if(!count)continue;
            const label=this.text(x+3,y+28+row*32,`${name} ×${count}`,11,`#${color.toString(16).padStart(6,'0')}`);
            label.setPadding(3,5,3,5).setInteractive({useHandCursor:true});
            label.setData('technology',type);
            label.on('pointerover', () => this.showTechnologyTooltip(type, right ? l.rightX - 298 : x + 110, label.y - 8));
            label.on('pointerout', () => this.hideTechnologyTooltip());
            this.input.setDraggable(label);row++;
        }
        if(!row)this.text(x,y+28,'Aucune disponible',10,'#7898aa');
    }

    // Coordinates in the simulation's 1000×600 battlefield space.
    technologyTarget(x,y) {
        const b=this.battleBounds;
        if(!b || x<b.x || y<b.y || x>b.x+b.w || y>b.y+b.h)return null;
        return {x:(x-b.x)*1000/b.w,y:(y-b.y)*600/b.h};
    }

    baseTechnologyTarget(x,y) {
        const l=this.layout;
        if(!l || x<l.boardX || x>l.boardX+l.boardW || y<l.mainTop || y>l.mainBottom)return null;
        return {x:500,y:300}; // Global base effect; no positional simulation target.
    }

    resourceActivity(source) {
        const buildings = this.world.query('Building', 'GridSlot')
            .filter(id => this.world.get(id, 'Building').type === source);
        if (!buildings.length) return 'AUCUN BÂTIMENT';
        const active = buildings.filter(id => {
            const slot = this.world.get(id, 'GridSlot').index;
            return this.world.get(this.model.tiles[slot], 'Watched').active;
        });
        if (!active.length) return 'HORS VISION';
        if (active.every(id => this.world.get(id, 'Production')?.blocked)) return 'EN ATTENTE';
        return 'PRODUCTION ACTIVE';
    }

    noteResourceChanges(previous, dt) {
        // Only samples taken around an actual economy step count. Card grants and
        // direct resource edits never become fake production or consumption rates.
        this.resourceRateClockMs += dt;
        const balance = this.world.get(this.model.game, 'Resources');
        const changes = {};
        for (const id of ['energy', 'matter', 'components', 'data']) {
            const change = balance[id] - previous[id];
            if (change) changes[id] = change;
        }
        if (Object.keys(changes).length) {
            this.resourceRateHistory.push({ atMs: this.resourceRateClockMs, changes });
        }
        const cutoff = this.resourceRateClockMs - 6000;
        while (this.resourceRateHistory.length && this.resourceRateHistory[0].atMs <= cutoff) {
            this.resourceRateHistory.shift();
        }
    }

    resourceRatePerSecond(id) {
        // Simulation seconds, so x1/x3/x5 change how fast time passes, not the units.
        const windowMs = Math.min(6000, this.resourceRateClockMs);
        if (windowMs <= 0) return 0;
        const net = this.resourceRateHistory.reduce((sum, item) =>
            sum + (item.changes[id] || 0), 0);
        return net * 1000 / windowMs;
    }

    updateResourceHud() {
        if (!this.model || !this.world.hasComponent(this.model.game, 'Resources')) return;
        const balance = this.world.get(this.model.game, 'Resources');
        this.updateVisionUpgradeButton();
        for (const style of this.resourceStyles) {
            if (style.pending) continue;
            this.resourceLabels[style.id]?.setText(String(balance[style.id]));
            this.compactResources?.[style.id]?.setText(String(balance[style.id]));
            const rate = Number(this.resourceRatePerSecond(style.id).toFixed(1));
            const delta = `${rate > 0 ? '+' : ''}${rate.toFixed(1)}/s`;
            const color = rate > 0 ? '#69e5ac' : rate < 0 ? '#ff6674' : '#7898aa';
            for (const status of [this.resourceStatusLabels[style.id], this.compactResourceDeltas?.[style.id]]) {
                status?.setText(delta);
                status?.setColor(color);
            }
        }
    }

    hideWaveTooltip() {
        for (const object of this.waveTooltipObjects || []) object.destroy();
        this.waveTooltipObjects = [];
    }

    showWaveTooltip(index, x, y) {
        this.hideWaveTooltip();
        const wave = this.previewWaves[index];
        if (!wave) return;
        const width = 214, height = 105;
        const tx = Math.max(8, Math.min(this.scale.width - width - 8, x - width / 2));
        const ty = Math.max(72, y - height - 15);
        const g = this.add.graphics().setDepth(230);
        g.fillStyle(0x0b1d2b, 0.98).fillRoundedRect(tx, ty, width, height, 6);
        g.lineStyle(1, 0xff6674, 0.7).strokeRoundedRect(tx, ty, width, height, 6);
        g.lineStyle(2, 0xff6674).strokeCircle(tx + 23, ty + 57, 8);
        this.waveTooltipObjects.push(g);
        const text = (dx, dy, str, size = 12, color = '#dfeaf0') =>
            this.waveTooltipObjects.push(this.add.text(tx + dx, ty + dy, str, {
                fontFamily: 'monospace', fontSize: `${size}px`, color
            }).setDepth(231));
        text(13, 12, `VAGUE ${wave.number}`, 15);
        text(42, 49, `×${wave.enemies[0].count} · Ennemi de base`, 11, '#e9b6bf');
        text(13, 80, 'Composition prévisionnelle', 10, '#819eaf');
    }

    updateWaveTimeline() {
        if (!this.waveCountdownLabel) return;
        const seconds = Math.ceil((this.previewWaves[0].dueAtMs - this.waveClock.elapsedMs) / 1000);
        this.waveCountdownLabel.setText(String(seconds));
        this.paintWaveTimeline();
    }

    spawnEnemyUnit(type, index, count, waveNumber = null) {
        const config = this.cache.json.get('vnextLegacyStats').enemies.find(unit => unit.id === type);
        if (!config) return;
        const id = this.world.create(this.model.game);
        // Fan out spawn positions without altering stats or attack behavior.
        const x = 800 + (index % 3) * 14, y = 100 + ((index * 47) % 400);
        this.world.set(id, 'Position', { x, y });
        this.world.set(id, 'Health', { hp: config.hp, maxHp: config.hp });
        this.world.set(id, 'Faction', { side: 'enemy' });
        this.world.set(id, 'Movement', { speed: config.speed });
        this.world.set(id, 'Combat', {
            damage: config.attack_damage, range: config.attack_range,
            attackType: config.attack_type, cooldownMs: config.attack_speed * 1000,
            elapsedMs: 0, detectionRadius: 220, behavior: config.behavior || null
        });
        this.world.set(id, 'PreviewUnit', { type });
        this.battleUnits.push(id);
        if (waveNumber !== null) {
            this.world.set(id, 'WaveMember', { number: waveNumber });
            this.waveMembers.get(waveNumber).push(id);
        }
    }

    triggerWave(wave) {
        this.waveMembers.set(wave.number, []);
        for (const group of wave.enemies) {
            for (let i = 0; i < group.count; i++) this.spawnEnemyUnit(group.type, i, group.count, wave.number);
        }
        // Preview markers slide forward; the wave plan itself remains deterministic.
        this.previewWaves = OverseerVNextWaves.preview(8, this.waveClock.seed, this.waveClock.number);
        this.buildUi();
        this.saveCurrentGame();
    }

    // Reward choices stay in the small, already-playable building catalog.
    // Generate once per cleared wave, never on each render.
    rewardOptions(number, kind = 'building') {
        return OverseerVNextRewards.options(number,this.waveClock.seed,kind,
            OverseerVNextCards.REWARD_CARDS,OverseerVNextTechnologies.TYPES);
    }
    rewardForWave(number) {
        return OverseerVNextRewards.create(number,this.waveClock.seed,
            OverseerVNextCards.REWARD_CARDS,OverseerVNextTechnologies.TYPES);
    }

    checkWaveClears() {
        let changed = false;
        for (const [number, members] of this.waveMembers) {
            if (!members.length) continue;
            if (!members.every(id => !this.world.has(id) || this.world.get(id, 'Health').hp <= 0)) continue;
            this.waveMembers.delete(number);
            this.rewardQueue.push(this.rewardForWave(number));
            changed = true;
        }
        if (!this.activeReward && this.rewardQueue.length) {
            this.activeReward = this.rewardQueue.shift();
            this.buildUi();
            changed = true;
        }
        if (changed) this.saveCurrentGame();
    }

    // Reclaim dead ECS entities only after wave completion has been resolved.
    // A living wave keeps exactly its living members; cleared waves are removed
    // by checkWaveClears(), which grants their rewards before references vanish.
    cleanupDeadUnits() {
        const dead = new Set(this.battleUnits.filter(id =>
            !this.world.has(id) || this.world.get(id, 'Health')?.hp <= 0));
        if (!dead.size) return false;
        this.battleUnits = this.battleUnits.filter(id => !dead.has(id));
        for (const id of dead) {
            if (this.world.has(id)) this.world.destroy(id);
        }
        for (const [number, members] of this.waveMembers) {
            const alive = members.filter(id => !dead.has(id));
            if (alive.length) this.waveMembers.set(number, alive);
            else this.waveMembers.delete(number);
        }
        this.saveCurrentGame();
        return true;
    }

    chooseReward(type) {
        if (!this.activeReward || !this.activeReward.options.includes(type)) return false;
        const current=OverseerVNextRewards.current(this.activeReward);
        if (current.kind==='building' && type.startsWith('tech:') || current.kind==='technology' && !type.startsWith('tech:')) return false;
        if (type.startsWith('tech:')) {
            const technology = type.slice(5);
            if (!OverseerVNextTechnologies.TYPES.includes(technology)) return false;
            OverseerVNextTechnologies.inventory(this.model).items.push(technology);
        } else if (!OverseerVNextCards.grant(this.model, type)) return false;
        if (!OverseerVNextRewards.advance(this.activeReward)) this.activeReward = this.rewardQueue.shift() || null;
        this.buildUi();
        this.saveCurrentGame();
        return true;
    }

    drawRewardOverlay() {
        const reward = this.activeReward;
        if (!reward) return;
        const w = this.scale.width, h = this.scale.height;
        const width = Math.min(590, w - 32), x = (w - width) / 2, y = Math.max(95, h / 2 - 115);
        const g = this.keep(this.add.graphics().setDepth(300));
        g.fillStyle(0x08121c, 0.88).fillRect(0, 0, w, h);
        g.fillStyle(0x0b1d2b, 1).fillRoundedRect(x, y, width, 245, 8);
        g.lineStyle(1, 0x62e7e1, 0.7).strokeRoundedRect(x, y, width, 245, 8);
        // Full-screen hit target above the HUD, below the reward choices.
        // Phaser's default topOnly input dispatch keeps pointer events off the game.
        this.keep(this.add.zone(w / 2, h / 2, w, h)
            .setInteractive().setDepth(301)).setData('rewardBlocker', true);
        this.keep(this.add.text(x + 20, y + 19, `VAGUE ${reward.number} TERMINÉE`, {
            fontFamily:'monospace',fontSize:'17px',color:'#dfeaf0'
        }).setDepth(301));
        this.keep(this.add.text(x + 20, y + 48, 'Choisissez une carte · simulation en pause', {
            fontFamily:'monospace',fontSize:'11px',color:'#8daabb'
        }).setDepth(301));
        const stage=OverseerVNextRewards.current(reward);
        const breadcrumb=reward.stages?.map((part,i)=>i===reward.index?'[ '+(part.kind==='building'?'BÂTIMENT':'TECHNOLOGIE')+' ]':(part.kind==='building'?'BÂTIMENT ✓':'TECHNOLOGIE')).join('   →   ') ||
            (stage.kind==='building'?'[ BÂTIMENT ]':stage.kind==='technology'?'[ TECHNOLOGIE ]':'[ CHOIX ]');
        this.keep(this.add.text(x+width/2,y+68,breadcrumb,{
            fontFamily:'monospace',fontSize:'11px',color:'#b58aff'
        }).setOrigin(0.5,0).setDepth(301));
        reward.options.forEach((type, i) => {
            const techStyles={
                'tech:healing_field':{color:0x69d9a0,label:'Régénération'},
                'tech:berserk':{color:0xf4a261,label:'Berserk'},
                'tech:stasis_field':{color:0x87b9e8,label:'Stase'},
                'tech:overclock':{color:0x62e7e1,label:'Surcadencement'},
                'tech:overload':{color:0xf5b94f,label:'Surcharge'},
                'tech:emp_field':{color:0xb5a7ff,label:'Impulsion EMP'},
                'tech:reinforcements':{color:0x44dc91,label:'Renforts'}
            };
            const building = techStyles[type] || OverseerVNextBuildings.getBuilding(type);
            const cardW = (width - 56) / 3, cx = x + 14 + i * (cardW + 14), cy = y + 113;
            g.fillStyle(0x123047).fillRoundedRect(cx, cy, cardW, 108, 5);
            g.lineStyle(1, building.color, 0.7).strokeRoundedRect(cx, cy, cardW, 108, 5);
            const iconG = this.keep(this.add.graphics().setDepth(301));
            if (type.startsWith('tech:')) {
                iconG.lineStyle(2, building.color, 1).lineBetween(cx + cardW / 2 - 7, cy + 27, cx + cardW / 2 + 7, cy + 27);
                iconG.lineBetween(cx + cardW / 2, cy + 20, cx + cardW / 2, cy + 34);
            } else this.drawGlyph(iconG, type, cx + cardW / 2, cy + 27, building.color, 13);
            this.keep(this.add.text(cx + cardW / 2, cy + 53, building.label, {
                fontFamily:'monospace',fontSize:'12px',color:'#dfeaf0'
            }).setOrigin(0.5, 0).setDepth(301));
            const zone = this.keep(this.add.zone(cx + cardW / 2, cy + 54, cardW, 108)
                .setInteractive({useHandCursor:true}).setDepth(302));
            zone.setData('reward', type);
            zone.on('pointerover', () => {
                if (type.startsWith('tech:')) {
                    this.showTechnologyTooltip(type.slice(5), cx + cardW / 2 - 145, cy - 185, 310);
                    return;
                }
                this.showCardTooltip(type, cx + cardW / 2, cy - 205);
                // Reward selection overlay is above the game HUD (depth 300).
                // Reuse the same building popup, but draw it over the overlay.
                this.tooltipObjects.forEach(object => object.setDepth(310));
            });
            zone.on('pointerout', () => {
                this.hideBuildingTooltip();
                this.hideTechnologyTooltip();
            });
            zone.on('pointerdown', () => this.chooseReward(type));
        });
    }

    paintWaveTimeline() {
        if (!this.waveGraphics || !this.waveMarkers) return;
        const g=this.waveGraphics, {x1,x2,y}=this.waveTimelineBounds, horizonMs=360000;
        g.clear();
        g.lineStyle(1,0x29495b,0.8).lineBetween(x1,y,x2,y);
        g.lineStyle(2,0xff6674,0.95).lineBetween(x1,y-13,x1,y+13);
        this.previewWaves.forEach((wave,i)=>{
            const x=x1+(wave.dueAtMs-this.waveClock.elapsedMs)/horizonMs*(x2-x1);
            const visible=x>=x1&&x<=x2, marker=this.waveMarkers[i];
            marker.zone.setPosition(visible?x:-100,visible?y:-100);
            marker.label.setPosition(visible?x-4:-100,visible?y-16:-100);
            if(visible){
                g.fillStyle(0xff6674,0.94).fillCircle(x,y,5);
                g.lineStyle(1,0xff6674,0.55).strokeCircle(x,y,9);
            }
        });
    }

    drawFooter() {
        const l = this.layout, y = l.h - 44;
        const x1 = l.m + 70, x2 = l.w - l.m - 18;
        this.waveTimelineBounds = { x1, x2, y };
        const clock = this.keep(this.add.graphics());
        clock.lineStyle(2, 0x62e7e1, 0.85).strokeCircle(l.m + 30, y, 21);
        this.waveCountdownLabel = this.text(l.m + 30, y, '', 15, '#e2eef3').setOrigin(0.5, 0.5);
        this.waveGraphics = this.keep(this.add.graphics());
        this.waveMarkers = this.previewWaves.map((wave, i) => {
            const label = this.text(-100, -100, String(wave.number), 10, '#e9b6bf');
            const zone = this.keep(this.add.zone(-100, -100, 25, 35).setInteractive({ useHandCursor: true }));
            zone.setData('wave', i);
            zone.on('pointerover', () => this.showWaveTooltip(i, zone.x, y));
            zone.on('pointerout', () => this.hideWaveTooltip());
            return { zone, label };
        });
        this.updateWaveTimeline();
    }

    resetBattle() {
        this.hitEffects.clear();
        this.actionEffects.clear();
        (this.battleUnits || []).forEach(id => { if (this.world.has(id)) this.world.destroy(id); });
        this.battleUnits = [];
        this.baseHp = 100;
        const stats = this.cache.json.get('vnextLegacyStats');
        const lineup = [
            ['player', 'unit_guard', 200, 185], ['player', 'unit_sniper', 260, 305],
            ['player', 'unit_dronoid', 230, 425]
        ];
        lineup.forEach(([side, type, x, y]) => {
            const config = (side === 'player' ? stats.units : stats.enemies).find(d => d.id === type);
            if (!config) return;
            const id = this.world.create(this.model.game);
            this.world.set(id, 'Position', { x, y });
            this.world.set(id, 'Health', { hp: config.hp, maxHp: config.hp });
            this.world.set(id, 'Faction', { side });
            this.world.set(id, 'Movement', { speed: config.speed });
            this.world.set(id, 'Combat', {
                damage: config.attack_damage, range: config.attack_range,
                attackType: config.attack_type, cooldownMs: config.attack_speed * 1000,
                elapsedMs: 0, detectionRadius: side === 'player' ? 400 : 220,
                behavior: config.behavior || null
            });
            this.world.set(id, 'PreviewUnit', { type });
            this.battleUnits.push(id);
        });
        this.paintBattle();
    }

    spawnFriendlyUnit(type) {
        const stats = this.cache.json.get('vnextLegacyStats');
        const config = stats.units.find(unit => unit.id === type);
        if (!config) return;
        const id = this.world.create(this.model.game);
        this.world.set(id, 'Position', { x: 195, y: 290 });
        this.world.set(id, 'Health', { hp: config.hp, maxHp: config.hp });
        this.world.set(id, 'Faction', { side: 'player' });
        this.world.set(id, 'Movement', { speed: config.speed });
        this.world.set(id, 'Combat', {
            damage: config.attack_damage, range: type === 'unit_dronoid' ? 65 : config.attack_range,
            attackType: config.attack_type, cooldownMs: config.attack_speed * 1000,
            elapsedMs: 0, detectionRadius: 400, behavior: type === 'unit_dronoid' ? 'healer' : config.behavior || null
        });
        this.world.set(id, 'PreviewUnit', { type });
        this.battleUnits.push(id);
    }

    battleUnitStyle(id) {
        const type = this.world.get(id, 'PreviewUnit')?.type;
        const side = this.world.get(id, 'Faction')?.side;
        return OverseerBattleUnitStyles.styleFor(type, side);
    }

    drawBattleUnit(g, style, x, y, r, color) {
        g.lineStyle(2, color, 0.98);
        if (style.shape === 'shield') {
            g.strokePoints([
                { x, y: y - r }, { x: x + r * 0.78, y: y - r * 0.52 },
                { x: x + r * 0.63, y: y + r * 0.4 }, { x, y: y + r },
                { x: x - r * 0.63, y: y + r * 0.4 }, { x: x - r * 0.78, y: y - r * 0.52 }
            ], true);
        } else if (style.shape === 'diamond') {
            g.strokePoints([
                { x, y: y - r }, { x: x + r * 0.65, y },
                { x, y: y + r }, { x: x - r * 0.65, y }
            ], true);
            g.lineStyle(1, color, 0.9).lineBetween(x - r, y, x + r, y);
        } else if (style.shape === 'hexagon') {
            g.strokePoints(Array.from({ length: 6 }, (_, i) => {
                const a = (i * Math.PI / 3) + Math.PI / 6;
                return { x: x + Math.cos(a) * r, y: y + Math.sin(a) * r };
            }), true);
            g.fillStyle(color, 0.62).fillRect(x - r * 0.32, y - r * 0.32, r * 0.64, r * 0.64);
        } else if (style.shape === 'drone') {
            g.strokeCircle(x, y, r * 0.75);
            g.lineStyle(1, color, 0.85).lineBetween(x - r * 0.34, y, x + r * 0.34, y);
            g.lineBetween(x, y - r * 0.34, x, y + r * 0.34);
        } else if (style.shape === 'triangle') {
            g.strokeTriangle(x, y - r, x + r, y + r, x - r, y + r);
        } else {
            g.strokeCircle(x, y, r * 0.8);
            g.fillStyle(color, 0.5).fillCircle(x, y, r * 0.26);
        }
    }

    paintTechnologyZones(dt=0) {
        const g=this.zoneGraphics,b=this.battleBounds;
        if(!g||!b)return;
        g.clear();
        const toScreen=(x,y)=>({x:b.x+x*b.w/1000,y:b.y+y*b.h/600});
        for(const id of this.world.query('TechnologyZone')) {
            const zone=this.world.get(id,'TechnologyZone'),p=toScreen(zone.x,zone.y);
            const r=zone.radius*b.w/1000;
            const stasis=zone.type==='stasis_field',emp=zone.type==='emp_field';
            const color=emp?0xb5a7ff:stasis?0x87b9e8:0x69d9a0;
            g.fillStyle(color,0.09).fillCircle(p.x,p.y,r);
            g.lineStyle(1.5,color,0.75).strokeCircle(p.x,p.y,r);
            if(emp){g.lineStyle(1,color,0.45).strokeCircle(p.x,p.y,r*0.72);}
            if(stasis||emp)continue;
            // Decorative plus particles are renderer-only, independent of healing ticks.
            if(dt>0 && this.zoneParticles.length<36) {
                const angle=Math.random()*Math.PI*2,rad=Math.sqrt(Math.random())*r;
                this.zoneParticles.push({x:p.x+Math.cos(angle)*rad,y:p.y+Math.sin(angle)*rad,life:700});
            }
        }
        this.zoneParticles=this.zoneParticles.filter(p=>p.life>0);
        for(const p of this.zoneParticles) {
            p.y-=dt*0.018;p.life-=dt;
            g.lineStyle(1,0x9ff3bb,Math.max(0,p.life/700));
            g.lineBetween(p.x-3,p.y,p.x+3,p.y);g.lineBetween(p.x,p.y-3,p.x,p.y+3);
        }
    }

    baseHealthColor() {
        // Three readable states, intentionally without pulsing or decorative animation.
        if (this.baseHp <= 25) return 0xff6674;
        if (this.baseHp <= 60) return 0xf0ba60;
        return 0x48b8c4;
    }

    paintBattle() {
        if (!this.battleGraphics || !this.battleBounds) return;
        const g = this.battleGraphics, b = this.battleBounds;
        this.paintTechnologyZones(this.zoneFrameMs||0);
        this.zoneFrameMs=0;
        g.clear();
        const p = (x, y) => ({ x: b.x + b.w * x / 1000, y: b.y + b.h * y / 600 });
        const base = p(65, 300);
        // Detection is measured in simulation units; the panel mask clips its visible edge.
        const detectionRadius = OverseerVNextThreats.RADIUS * b.w / 1000;
        g.lineStyle(1, 0x91ced1, 0.44).strokeCircle(base.x, base.y, detectionRadius);
        const coreColor = this.baseHealthColor();
        g.lineStyle(2, coreColor, 0.82).strokeCircle(base.x, base.y, 12);
        g.lineStyle(1, coreColor, 0.38).strokeCircle(base.x, base.y, 21);
        const healthWidth = Math.min(62, b.w - 6);
        const healthX = Math.max(b.x + 3, Math.min(base.x - healthWidth / 2,
            b.x + b.w - healthWidth - 3));
        const healthY = base.y - 37;
        g.fillStyle(0x203b49, 1).fillRect(healthX, healthY, healthWidth, 5);
        g.fillStyle(coreColor, 1).fillRect(healthX, healthY,
            healthWidth * Math.max(0, Math.min(1, this.baseHp / 100)), 5);
        for (const id of this.battleUnits) {
            if (!this.world.has(id)) continue;
            const hp = this.world.get(id, 'Health');
            if (hp.hp <= 0) continue;
            const pos = this.world.get(id, 'Position');
            const side = this.world.get(id, 'Faction').side;
            const q = p(pos.x, pos.y);
            const r = Math.min(12, Math.max(6, b.w * 0.024));
            // One shared, dimensionless reaction can move a 2D glyph or a future 3D model.
            const visual = this.hitEffects.view(id);
            q.x += visual.x * r;
            q.y += visual.y * r;
            const style = this.battleUnitStyle(id);
            const color = OverseerHitEffects.tintColor(style.color, visual.flash);
            const berserk=this.world.get(id,'TechnologyBuff')?.type==='berserk';
            if(side==='player' && OverseerVNextZones.active(this.model,'overclock')) {
                g.lineStyle(1,0x62e7e1,0.65).strokeCircle(q.x,q.y,r*1.45);
            }
            if(berserk){g.lineStyle(1,0xf4a261,0.8).strokeCircle(q.x,q.y,r*1.5);}
            this.drawBattleUnit(g, style, q.x, q.y,berserk?r*1.16:r, color);
            if(this.world.hasComponent(id,'TemporaryAlly')) {
                g.lineStyle(1,0x44dc91,0.7).strokeCircle(q.x,q.y,r*1.65);
            }
            if (side === 'enemy' && this.world.get(id, 'ThreatMark')) {
                g.lineStyle(1.5, 0xff6674, 0.92).strokeRect(
                    q.x - r - 4, q.y - r - 4, (r + 4) * 2, (r + 4) * 2);
            }
            g.fillStyle(0x23404e, 0.8).fillRect(q.x - 11, q.y - r - 9, 22, 3);
            g.fillStyle(side === 'player' ? 0x44dc91 : 0xff5e79, 1)
                .fillRect(q.x - 11, q.y - r - 9, 22 * Math.max(0, hp.hp / hp.maxHp), 3);
        }
        // Draw fragments separately from the unit loop so a killing hit can outlive its target.
        const fragments = this.battleParticleGraphics;
        if (fragments) {
            fragments.clear();
            for (const bit of this.hitEffects.fragments()) {
                const q = p(bit.x, bit.y);
                if (q.x < b.x || q.x > b.x + b.w || q.y < b.y || q.y > b.y + b.h) continue;
                fragments.fillStyle(bit.color, bit.alpha);
                fragments.fillRect(q.x - bit.size / 2, q.y - bit.size / 2, bit.size, bit.size);
            }
        }
        const actions = this.battleActionGraphics;
        if (actions) {
            actions.clear();
            const clamp = (v, min, max) => Math.max(min, Math.min(max, v));
            const within = point => ({
                x: clamp(point.x, b.x, b.x + b.w),
                y: clamp(point.y, b.y, b.y + b.h)
            });
            for (const effect of this.actionEffects.visuals()) {
                const start = within(p(effect.from.x, effect.from.y));
                const end = within(p(effect.to.x, effect.to.y));
                if (effect.kind === 'laser') {
                    actions.lineStyle(3, effect.color, effect.alpha * 0.27)
                        .lineBetween(start.x, start.y, end.x, end.y);
                    actions.lineStyle(1, 0xffffff, effect.alpha * 0.92)
                        .lineBetween(start.x, start.y, end.x, end.y);
                    actions.lineStyle(1, effect.color, effect.alpha)
                        .strokeCircle(end.x, end.y, 2.5);
                } else if (effect.kind === 'heal') {
                    // A repair is legible as support, never mistaken for damage recoil.
                    actions.lineStyle(2, effect.color, effect.alpha * 0.22)
                        .lineBetween(start.x, start.y, end.x, end.y);
                    actions.lineStyle(1, effect.color, effect.alpha * 0.9)
                        .lineBetween(start.x, start.y, end.x, end.y);
                    const radius = 5 + 9 * effect.progress;
                    actions.lineStyle(1, effect.color, effect.alpha * 0.9)
                        .strokeCircle(end.x, end.y, radius);
                    for (let i = 0; i < 3; i++) {
                        const angle = (i * Math.PI * 2 / 3) + effect.progress * 1.4;
                        const orbit = 15 * (1 - effect.progress) + 2;
                        actions.fillStyle(effect.color, effect.alpha * 0.8).fillCircle(
                            end.x + Math.cos(angle) * orbit,
                            end.y + Math.sin(angle) * orbit, 1.6);
                    }
                }
            }
        }
        if (this.battleStatus) {
            const alive = side => this.battleUnits.filter(id => this.world.has(id) &&
                this.world.get(id, 'Faction').side === side && this.world.get(id, 'Health').hp > 0).length;
            this.battleStatus.setText(`Alliés ${alive('player')}   Menaces ${alive('enemy')}`);
        }
    }

    update(time, delta) {
        if (!this.model || this.runFinished) return;
        if (this.baseHp <= 0) { this.finishRun(); return; }
        // Wall-clock autosave continues when gameplay pauses for a reward.
        this.autosaveElapsed += Math.max(0, delta);
        if (this.autosaveElapsed >= OverseerVNextSave.AUTOSAVE_MS) {
            this.autosaveElapsed %= OverseerVNextSave.AUTOSAVE_MS;
            this.saveCurrentGame();
        }
        if (this.speed === 0 || this.activeReward || !this.battleUnits) return;
        const dt = Math.min(delta, 60) * this.speed;
        for (const wave of OverseerVNextWaves.advance(this.waveClock, dt)) this.triggerWave(wave);
        this.updateWaveTimeline();
        const previousResources = { ...this.world.get(this.model.game, 'Resources') };
        const economyEvents = OverseerVNextEconomy.step(this.model, dt);
        const researchEvents=OverseerVNextTechnologies.step(this.model,dt);
        if(researchEvents.length)this.buildUi();
        for (const event of economyEvents) {
            if (event.type === 'unit-produced') this.spawnFriendlyUnit(event.unitType);
            if (event.type === 'production') this.showProductionPopup(event);
        }
        const zoneEvents=OverseerVNextZones.step(this.model,dt);
        for(const event of zoneEvents) this.actionEffects.heal({x:event.x,y:event.y},{x:event.x,y:event.y},0x69d9a0);
        this.zoneFrameMs=Math.min(60,Math.max(0,delta));
        this.noteResourceChanges(previousResources, dt);
        this.updateProductionPopups(Math.min(60, Math.max(0, delta)));
        this.updateResourceHud();
        this.paintBoard();
        const players = this.battleUnits.filter(id => this.world.has(id) && this.world.get(id, 'Faction').side === 'player' && this.world.get(id, 'Health').hp > 0);
        const enemies = this.battleUnits.filter(id => this.world.has(id) && this.world.get(id, 'Faction').side === 'enemy' && this.world.get(id, 'Health').hp > 0);
        OverseerVNextThreats.update(this.world, enemies, dt);
        const posts = new Map(players.map((id, index) =>
            [id, OverseerCombat.formationPosition(index, players.length)]));
        for (const id of [...players, ...enemies]) {
            if (this.world.get(id, 'Health').hp <= 0) continue;
            const side = this.world.get(id, 'Faction').side;
            const events = OverseerCombat.stepUnit(this.world, id, dt, {
                opponents: side === 'player' ? enemies : players,
                base: side === 'enemy' && this.baseHp > 0 ? { x: 65, y: 300 } : null,
                patrol: side === 'player' ? posts.get(id) : null,
                allies: side === 'player' ? players : [],
                centralDetection: side === 'player',
                allySpeedMultiplier: OverseerVNextZones.speedMultiplier(this.model)
            });
            for (const event of events) {
                if (event.type === 'base-attack') this.baseHp = Math.max(0, this.baseHp - event.damage);
                if (event.type === 'attack' && this.world.has(event.attacker) && this.world.has(event.target)) {
                    // Snapshot directions at impact time; simulation positions never receive recoil.
                    const attackerPosition = this.world.get(event.attacker, 'Position');
                    const targetPosition = this.world.get(event.target, 'Position');
                    const targetStyle = this.battleUnitStyle(event.target);
                    if (event.ranged) this.actionEffects.laser(
                        attackerPosition, targetPosition, this.battleUnitStyle(event.attacker).color);
                    this.hitEffects.hit(event.target,
                        attackerPosition, targetPosition, targetStyle.color);
                }
                if (event.type === 'heal' && event.amount > 0 &&
                    this.world.has(event.healer) && this.world.has(event.target)) {
                    this.actionEffects.heal(
                        this.world.get(event.healer, 'Position'),
                        this.world.get(event.target, 'Position'),
                        this.battleUnitStyle(event.healer).color);
                }
            }
        }
        if (this.baseHp <= 0) { this.finishRun(); return; }
        OverseerCombat.separateUnits(this.world, this.battleUnits);
        // Wall-clock duration makes impacts readable at x1/x3/x5. Pause freezes them.
        this.hitEffects.update(Math.min(60, Math.max(0, delta)));
        this.actionEffects.update(Math.min(60, Math.max(0, delta)));
        const expiredSummons=OverseerVNextZones.stepBuffs(this.model,dt);
        if(expiredSummons.length) {
            const removed=new Set(expiredSummons);
            this.battleUnits=this.battleUnits.filter(id=>!removed.has(id));
        }
        // Rewards must be computed before reclaiming dead ECS entities.
        this.checkWaveClears();
        this.cleanupDeadUnits();
        this.paintBattle();
    }
}

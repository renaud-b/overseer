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
        if (this.model) {
            OverseerVNextWaveTelemetry.casualties(this.model, this.battleUnits || []);
            OverseerVNextWaveTelemetry.endActive(this.model, this.waveClock.elapsedMs,
                this.baseHp, this.visionRules.level);
        }
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
        this.optionsModal = null;
        this.autosaveElapsed = 0;
        this.ui = [];
        this.hitEffects = new OverseerHitEffects.HitEffects(); // Renderer-only state; never saved to ECS.
        this.actionEffects = new OverseerBattleActionEffects.BattleActionEffects();
        this.types = OverseerVNextBuildings.BUILDINGS;
        // The resource HUD borrows glyphs and colors from the corresponding buildings.
        // Cooling is a live local service, never a storable Resources balance.
        this.resourceStyles = [
            { id: 'energy', label: 'Énergie', glyph: 'reactor', source: 'reactor', color: 0x35d8ef },
            { id: 'matter', label: 'Matière', glyph: 'extractor', source: 'extractor', color: 0x39dd92 },
            { id: 'cooling', label: 'Refroidissement', glyph: 'cooling', flow: true, color: 0x87b9e8 },
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
        this.artifactTooltipObjects = [];
        this.technologyTooltipObjects = [];
        this.waveTooltipObjects = [];
        this.battleHoverPointer = null;
        this.battleTooltipObjects = [];
        this.battleTooltipId = null;
        this.waveClock = restored?.waveClock ??
            { number: 0, elapsedMs: 0, seed: Math.floor(Math.random() * 0x100000000) };
        this.previewWaves = OverseerVNextWaves.preview(8, this.waveClock.seed, this.waveClock.number);
        this.waveMembers = restored?.waveMembers ?? new Map();
        this.rewardQueue = restored?.rewardQueue ?? [];
        this.activeReward = restored?.activeReward ?? null;
        this.rewardSerial = 0;
        // ECS-owned metrics are saved with the World. Previous saves can omit them.
        OverseerVNextWaveTelemetry.initialize(this.model);

        OverseerVNextArtifacts.collection(this.model); // Optional in pre-artifact saves.
        OverseerVNextArtifactEffects.state(this.model); // Timers live in ECS across Continue.
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
        this.reconcileArtifactRewards();
        this.buildUi();
        this.input.keyboard.on('keydown', this.onKey, this);
        this.input.on('dragstart', this.onDragStart, this);
        this.input.on('drag', this.onDrag, this);
        this.input.on('dragend', this.onDragEnd, this);
        this.scale.on('resize', this.buildUi, this);
        this.onPageHide = () => this.saveCurrentGame();
        if (typeof window !== 'undefined') window.addEventListener?.('pagehide', this.onPageHide);
        this.events.once('shutdown', () => {
            this.optionsModal?.close(true);
            this.optionsModal = null;
            this.hitEffects.clear();
            this.actionEffects.clear();
            this.releaseBattleView();
            this.hideTechnologyTooltip();
            this.hideBattleUnitTooltip();
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
        this.hideArtifactTooltip();
        this.hideBattleUnitTooltip();
        this.releaseBattleView();
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
        // Compact widths need a smaller title so the artifact slots stay visible.
        const titleSize = w < 1000 ? 16 : 23;
        const title = this.text(m + 6, 19, OverseerVNextBrand.title,
            titleSize, OverseerVNextBrand.titleColor);
        this.text(m + 7, 49, OverseerVNextBrand.subtitle, 10, OverseerVNextBrand.subtitleColor);
        // Phaser measures Text.width; the estimate is for lightweight test renderers.
        const titleRight = title.x + (title.width ??
            OverseerVNextBrand.title.length * titleSize * 0.61);
        this.drawArtifactSlots(w, titleRight);
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

    openOptions() {
        if (this.optionsModal || this.activeReward || this.runFinished) return;
        this.optionsModal = new OverseerOptionsModal(this, () => {
            this.optionsModal = null;
            this.buildUi();
        });
        this.optionsModal.open();
    }

    selectSpeed(speed) {
        if (this.optionsModal || this.activeReward) return; // A choice cannot unpause the simulation.
        if (speed === 0 && this.speed > 0) this.lastSpeed = this.speed;
        this.speed = speed;
        this.buildUi();
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





    castTechnology(type,target) {
        if(type==='reinforcements') {
            const config=this.cache.json.get('vnextLegacyStats')?.units?.find(unit=>unit.id==='unit_guard');
            const summoned=OverseerVNextZones.cast(this.model,type,target,{unitConfig:config});
            if(summoned!==null)this.battleUnits.push(summoned);
            return summoned;
        }
        return OverseerVNextZones.cast(this.model,type,target);
    }





    // Reward choices stay in the small, already-playable building catalog.
    // Generate once per cleared wave, never on each render.


    // Debug console: console.table(game.scene.getScene('VNextScene').waveReport())


    // Reclaim dead ECS entities only after wave completion has been resolved.
    // A living wave keeps exactly its living members; cleared waves are removed
    // by checkWaveClears(), which grants their rewards before references vanish.




    update(time, delta) {
        return OverseerVNextSimulation.step(this, time, delta);
    }

}

// Keep the existing scene method API while moving tooltip rendering outside the scene.
OverseerVNextTooltips.install(VNextScene);
OverseerVNextBoardView.install(VNextScene);
OverseerVNextBattleView.install(VNextScene);
OverseerVNextHudView.install(VNextScene);
OverseerVNextWaveView.install(VNextScene);
OverseerVNextRewardView.install(VNextScene);
OverseerVNextInput.install(VNextScene);
OverseerVNextRunFlow.install(VNextScene);

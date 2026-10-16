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

    drawArtifactSlots(w, titleRight) {
        const items = OverseerVNextArtifacts.list(this.model);
        const speedX = Math.max(330, w - 472);
        const size = Math.min(32, Math.max(18, Math.floor((speedX - 185 - 16 - 25) / 6)));
        const gap = size < 26 ? 4 : 6;
        const maxStart = speedX - 6 * size - 5 * gap - 12;
        // Give the brand 64px of breathing room where possible. On narrow
        // screens cap the offset to keep all six slots before speed controls.
        const start = Math.min(maxStart, titleRight + 64);
        this.artifactSlots = [];
        const graphics = this.keep(this.add.graphics());
        for (let i = 0; i < OverseerVNextArtifacts.CAPACITY; i++) {
            const x = start + i * (size + gap), y = 21;
            const artifact = OverseerVNextArtifacts.get(items[i]);
            graphics.fillStyle(artifact ? 0x153044 : 0x0a202d, 1).fillRoundedRect(x, y, size, size, 4);
            graphics.lineStyle(1, artifact ? artifact.color : 0x2d4858, 0.8)
                .strokeRoundedRect(x, y, size, size, 4);
            if (artifact) this.drawArtifactGlyph(graphics, artifact, x + size / 2, y + size / 2, size * 0.28);
            const zone = this.keep(this.add.zone(x + size / 2, y + size / 2, size, size).setInteractive());
            zone.setData('artifactSlot', i);
            zone.on('pointerover', () => this.showArtifactTooltip(items[i] || null, x, 68));
            zone.on('pointerout', () => this.hideArtifactTooltip());
            this.artifactSlots.push(zone);
        }
    }

    drawArtifactGlyph(g, artifact, x, y, r) {
        g.lineStyle(2, artifact.color, 0.95);
        if (artifact.symbol === 'triangle') g.strokeTriangle(x, y - r, x + r, y + r, x - r, y + r);
        else if (artifact.symbol === 'diamond') g.strokePoints([
            { x, y: y - r }, { x: x + r, y }, { x, y: y + r }, { x: x - r, y }
        ], true);
        else if (artifact.symbol === 'cross') {
            g.lineBetween(x - r, y, x + r, y).lineBetween(x, y - r, x, y + r);
        } else {
            g.strokeCircle(x, y, r);
            g.lineBetween(x - r * 1.4, y, x + r * 1.4, y);
        }
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
        this.hideBattleUnitTooltip();
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
        const y=right?l.mainTop+223:this.gridLayout.y+this.gridLayout.size+125;
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
            if(style.flow) {
                const coverage=OverseerVNextCooling.coverage(this.model);
                this.resourceLabels[style.id]?.setText(String(coverage.buildings));
                this.compactResources?.[style.id]?.setText(String(coverage.buildings));
                for(const status of [this.resourceStatusLabels[style.id],this.compactResourceDeltas?.[style.id]]) {
                    status?.setText(`${coverage.pumps} CRYO`);
                    status?.setColor('#87b9e8');
                }
                continue;
            }
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
        for (const event of OverseerVNextArtifactEffects.startWave(
            this.model, wave.number, this.waveClock.seed, this.baseHp, OverseerVNextEconomy)) {
            this.spawnFriendlyUnit(event.unitType);
        }
        OverseerVNextWaveTelemetry.begin(this.model, wave, this.waveClock.elapsedMs,
            this.baseHp, this.visionRules.level, this.waveMembers.get(wave.number).length);
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
            OverseerVNextCards.REWARD_CARDS,OverseerVNextTechnologies.TYPES,
            OverseerVNextArtifacts.available(this.model),OverseerVNextArtifacts.list(this.model));
    }

    reconcileArtifactRewards() {
        // Queued waves may have chosen their options before an earlier award was picked.
        // Avoid duplicate choices and skip artifact stages once the inventory is full.
        while (this.activeReward) {
            const stage = OverseerVNextRewards.current(this.activeReward);
            if (stage.kind !== 'artifact') break;
            const available = OverseerVNextArtifacts.available(this.model);
            if (!OverseerVNextArtifacts.hasCapacity(this.model) || !available.length) {
                if (!OverseerVNextRewards.advance(this.activeReward))
                    this.activeReward = this.rewardQueue.shift() || null;
                continue;
            }
            const fallback = OverseerVNextRewards.options(this.activeReward.number,
                this.waveClock.seed, 'artifact', [], [], available);
            const selections = [...new Set([...stage.options.filter(type =>
                available.includes(type.slice(9))), ...fallback])].slice(0, 3);
            stage.options = selections;
            this.activeReward.options = [...selections];
            break;
        }
    }

    // Debug console: console.table(game.scene.getScene('VNextScene').waveReport())
    waveReport() {
        return OverseerVNextWaveTelemetry.report(this.model);
    }

    checkWaveClears() {
        OverseerVNextWaveTelemetry.casualties(this.model, this.battleUnits);
        let changed = false;
        for (const [number, members] of this.waveMembers) {
            if (!members.length) continue;
            if (!members.every(id => !this.world.has(id) || this.world.get(id, 'Health').hp <= 0)) continue;
            OverseerVNextWaveTelemetry.end(this.model, number, this.waveClock.elapsedMs,
                this.baseHp, this.visionRules.level);
            this.waveMembers.delete(number);
            const recovered = OverseerVNextArtifactEffects.clearWave(this.model, number, this.baseHp);
            this.baseHp = recovered.hp;
            if (recovered.healed) this.actionEffects.heal(
                {x:65,y:300}, {x:65,y:300}, 0x69d9a0);
            const payout=OverseerVNextMemoryShards.grant(this.model,number,this.saveStorage());
            if(payout)this.shardLabel?.setText(`ÉCLATS DE MÉMOIRE  ${payout.balance}`);
            this.rewardQueue.push(this.rewardForWave(number));
            changed = true;
        }
        if (!this.activeReward && this.rewardQueue.length) {
            this.activeReward = this.rewardQueue.shift();
            this.reconcileArtifactRewards();
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
        OverseerVNextArtifactEffects.recycle(this.model, [...dead]);
        OverseerVNextArtifactEffects.propagate(this.model, [...dead]);
        for(const transfer of OverseerVNextArtifactEffects.vital(this.model,[...dead])) {
            this.actionEffects.heal(transfer.from,transfer.to,0x69d9a0);
        }
        this.battleUnits = this.battleUnits.filter(id => !dead.has(id));
        for (const id of dead) {
            if (this.world.has(id)) this.world.destroy(id);
        }
        for (const [number, members] of this.waveMembers) {
            const alive = members.filter(id => !dead.has(id));
            if (alive.length) this.waveMembers.set(number, alive);
            else this.waveMembers.delete(number);
        }
        this.updateResourceHud(); // Refunds from destroyed units are immediately visible.
        this.saveCurrentGame();
        return true;
    }

    chooseReward(type) {
        if (!this.activeReward || !this.activeReward.options.includes(type)) return false;
        const current=OverseerVNextRewards.current(this.activeReward);
        if (current.kind==='building' && (type.startsWith('tech:') || type.startsWith('artifact:')) ||
            current.kind==='technology' && !type.startsWith('tech:') ||
            current.kind==='artifact' && !type.startsWith('artifact:')) return false;
        if (type.startsWith('artifact:')) {
            if (!OverseerVNextArtifacts.add(this.model, type.slice(9))) return false;
        } else if (type.startsWith('tech:')) {
            const technology = type.slice(5);
            if (!OverseerVNextTechnologies.TYPES.includes(technology)) return false;
            OverseerVNextTechnologies.inventory(this.model).items.push(technology);
        } else if (!OverseerVNextCards.grant(this.model, type)) return false;
        if (!OverseerVNextRewards.advance(this.activeReward)) this.activeReward = this.rewardQueue.shift() || null;
        this.reconcileArtifactRewards();
        this.buildUi();
        this.saveCurrentGame();
        return true;
    }

    drawRewardOverlay() {
        this.hideBattleUnitTooltip();
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
        const paid=OverseerVNextMemoryShards.awarded(this.model,reward.number);
        const subtitle=paid ? `+${OverseerVNextMemoryShards.PER_WAVE} ÉCLAT DE MÉMOIRE · Choisissez une carte` :
            'Choisissez une carte · simulation en pause';
        this.keep(this.add.text(x + 20, y + 48, subtitle, {
            fontFamily:'monospace',fontSize:'11px',color:'#8daabb'
        }).setDepth(301));
        const stage=OverseerVNextRewards.current(reward);
        const stageNames = { building: 'BÂTIMENT', technology: 'TECHNOLOGIE', artifact: 'ARTEFACT' };
        const breadcrumb=reward.stages?.map((part,i)=>i===reward.index?'[ '+stageNames[part.kind]+' ]':stageNames[part.kind]+' ✓').join('   →   ') ||
            ('[ '+(stageNames[stage.kind]||'CHOIX')+' ]');
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
            const artifact = type.startsWith('artifact:') ? OverseerVNextArtifacts.get(type.slice(9)) : null;
            const building = artifact || techStyles[type] || OverseerVNextBuildings.getBuilding(type);
            const cardW = (width - 56) / 3, cx = x + 14 + i * (cardW + 14), cy = y + 113;
            g.fillStyle(0x123047).fillRoundedRect(cx, cy, cardW, 108, 5);
            g.lineStyle(1, building.color, 0.7).strokeRoundedRect(cx, cy, cardW, 108, 5);
            const iconG = this.keep(this.add.graphics().setDepth(301));
            if (artifact) this.drawArtifactGlyph(iconG, artifact, cx + cardW / 2, cy + 27, 13);
            else if (type.startsWith('tech:')) {
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
                if (artifact) {
                    this.showArtifactTooltip(artifact.id, cx + cardW / 2, cy - 130, 310);
                    return;
                }
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
                this.hideArtifactTooltip();
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
                const count=OverseerVNextWaves.danger(wave).level;
                const special=OverseerVNextWaves.elite(wave.number);
                const color=special?0xf4ba58:0xff6674;
                g.fillStyle(color,0.94);
                for(let n=0;n<count;n++)g.fillCircle(x+(n-(count-1)/2)*7,y,3);
                if(special)g.lineStyle(1.2,color,0.65)
                    .strokeCircle(x,y,19);
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
            const zone = this.keep(this.add.zone(-100, -100, 44, 36).setInteractive({ useHandCursor: true }));
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
        // No rendering here: create() calls resetBattle() before buildUi().
        // On a reused Phaser Scene, the previous Text/Graphics were destroyed
        // during shutdown; buildUi() recreates the panel and paints it safely.
    }

    spawnFriendlyUnit(type, productionEvent = null) {
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
        // Manufacturing provenance lives on the unit, not in the renderer.
        // No cost for spontaneous units, reinforcements or the starter lineup.
        if (productionEvent?.type === 'unit-produced' &&
            productionEvent.unitType === type && productionEvent.spent) {
            this.world.set(id, 'ManufacturedCost', {
                resources: { ...productionEvent.spent }
            });
        }
        this.battleUnits.push(id);
        return id;
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
        OverseerVNextCooling.step(this.model,dt);
        const coolingBonuses=OverseerVNextCooling.bonuses(this.model);
        const economyEvents = OverseerVNextArtifactEffects.production(this.model, dt, OverseerVNextEconomy,coolingBonuses);
        const researchEvents=OverseerVNextTechnologies.step(this.model,dt,
            OverseerVNextArtifactEffects.focusedBuilding(this.model,OverseerVNextEconomy),coolingBonuses);
        if(researchEvents.length)this.buildUi();
        for (const event of economyEvents) {
            if (event.type === 'unit-produced') this.spawnFriendlyUnit(event.unitType, event);
            if (event.type === 'production') this.showProductionPopup(event);
            if (event.type === 'artifact-network') this.showNetworkPopup(event);
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
        const pulseBonus=Math.max(0,...OverseerVNextThreats.amplifiers(this.model).map(id=>coolingBonuses[id]||0));
        OverseerVNextThreats.step(this.model, dt, 1+pulseBonus);
        OverseerVNextThreats.update(this.world, enemies, dt, OverseerVNextThreats.radius(this.model));
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
                if (event.type === 'base-attack') {
                    const previousHp = this.baseHp;
                    const result = OverseerVNextArtifactEffects.baseHit(this.model, previousHp, event.damage);
                    this.baseHp = result.hp;
                    OverseerVNextWaveTelemetry.baseHit(this.model, event.attacker, previousHp - this.baseHp);
                }
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
        const ray = OverseerVNextArtifactEffects.laser(this.model, dt, OverseerVNextThreats.radius(this.model));
        if (ray) {
            this.actionEffects.laser(ray.from, ray.to, 0x62e7e1);
            this.hitEffects.hit(ray.target, ray.from, ray.to, 0x62e7e1);
            for(const arc of ray.chains||[]) {
                this.actionEffects.laser(arc.from,arc.to,0x62e7e1);
                this.hitEffects.hit(arc.target,arc.from,arc.to,0x62e7e1);
            }
        }
        const deadAllies = this.battleUnits.filter(id => this.world.has(id) &&
            this.world.get(id, 'Faction').side === 'player' &&
            this.world.get(id, 'Health').hp <= 0);
        for (const burst of OverseerVNextArtifactEffects.deaths(this.model, deadAllies)) {
            this.actionEffects.laser(burst.from, burst.to, 0xff6674);
            this.hitEffects.hit(burst.target, burst.from, burst.to, 0xff6674);
        }
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

// Keep the existing scene method API while moving tooltip rendering outside the scene.
OverseerVNextTooltips.install(VNextScene);
OverseerVNextBoardView.install(VNextScene);
OverseerVNextBattleView.install(VNextScene);

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

    castTechnology(type,target) {
        if(type==='reinforcements') {
            const config=this.cache.json.get('vnextLegacyStats')?.units?.find(unit=>unit.id==='unit_guard');
            const summoned=OverseerVNextZones.cast(this.model,type,target,{unitConfig:config});
            if(summoned!==null)this.battleUnits.push(summoned);
            return summoned;
        }
        return OverseerVNextZones.cast(this.model,type,target);
    }

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
OverseerVNextHudView.install(VNextScene);
OverseerVNextWaveView.install(VNextScene);
OverseerVNextRewardView.install(VNextScene);

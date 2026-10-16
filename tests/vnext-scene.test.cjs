'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const fs = require('node:fs');
const path = require('node:path');
const { World } = require('../src/core/World.js');
const preview = require('../src/core/VNextPreview.js');
const catalog = require('../src/core/VNextBuildings.js');
const cards = require('../src/core/VNextCards.js');
const combat = require('../src/core/CombatSystem.js');
const hitEffects = require('../src/scene/effects/HitEffects.js');
const battleStyles = require('../src/scene/effects/BattleUnitStyles.js');
const battleActions = require('../src/scene/effects/BattleActionEffects.js');
const economy = require('../src/core/VNextEconomy.js');
const waves = require('../src/core/VNextWaves.js');
const telemetry = require('../src/core/VNextWaveTelemetry.js');
const shards = require('../src/core/VNextMemoryShards.js');
const technologies = require('../src/core/VNextTechnologies.js');
const rewards = require('../src/core/VNextRewards.js');
const artifacts = require('../src/core/VNextArtifacts.js');
const artifactEffects = require('../src/core/VNextArtifactEffects.js');
const zones = require('../src/core/VNextZones.js');
const threats = require('../src/core/VNextThreats.js');
const cooling = require('../src/core/VNextCooling.js');
const maintenance = require('../src/core/VNextMaintenance.js');
const saves = require('../src/core/VNextSave.js');
const visionUpgrades = require('../src/core/VNextVision.js');
const savedEntries = new Map();
const saveStorage = {
    getItem: key => savedEntries.get(key) ?? null,
    setItem: (key, value) => savedEntries.set(key, value),
    removeItem: key => savedEntries.delete(key)
};
const ROOT = path.resolve(__dirname, '..');
const brandSource = fs.readFileSync(path.join(ROOT, 'src/scene/VNextBrand.js'), 'utf8');
const visionSource = fs.readFileSync(path.join(ROOT, 'src/scene/entities/Vision.js'), 'utf8');
const tooltipSource = fs.readFileSync(path.join(ROOT, 'src/scene/VNextTooltips.js'), 'utf8');
const boardSource = fs.readFileSync(path.join(ROOT, 'src/scene/VNextBoardView.js'), 'utf8');
const battleViewSource = fs.readFileSync(path.join(ROOT, 'src/scene/VNextBattleView.js'), 'utf8');
const vNextHudViewSource = fs.readFileSync(path.join(ROOT, 'src/scene/VNextHudView.js'), 'utf8');
const vNextWaveViewSource = fs.readFileSync(path.join(ROOT, 'src/scene/VNextWaveView.js'), 'utf8');
const vNextRewardViewSource = fs.readFileSync(path.join(ROOT, 'src/scene/VNextRewardView.js'), 'utf8');
const vNextInputSource = fs.readFileSync(path.join(ROOT, 'src/scene/VNextInput.js'), 'utf8');
const vNextRunFlowSource = fs.readFileSync(path.join(ROOT, 'src/scene/VNextRunFlow.js'), 'utf8');
const vNextSimulationSource = fs.readFileSync(path.join(ROOT, 'src/scene/VNextSimulation.js'), 'utf8');
const sceneSource = fs.readFileSync(path.join(ROOT, 'src/scene/VNextScene.js'), 'utf8');

class Display {
    constructor(x = 0, y = 0) { this.x = x; this.y = y; this.handlers = {}; this.data = {}; this.drawCalls = []; }
    on(name, fn) { this.handlers[name] = fn; return this; }
    setInteractive() { this.interactive = true; return this; }
    setPadding() { return this; }
    setPosition(x, y) { this.x = x; this.y = y; return this; }
    setY(value) { this.y = value; return this; }
    setAlpha(value) { this.alpha = value; return this; }
    setVisible(value) { this.visible = value; return this; }
    setMask(mask) { this.mask = mask; return this; }
    createGeometryMask() { return { source: this, destroy() { this.destroyed = true; } }; }
    setDepth(value) { this.depth = value; return this; }
    setData(name, value) { this.data[name] = value; return this; }
    getData(name) { return this.data[name]; }
    setText(value) { this.value = value; return this; }
    setOrigin(x, y) { this.originX = x; this.originY = y; return this; }
    setColor(color) { this.color = color; return this; }
    fillStyle() { return this; }
    fillRoundedRect() { return this; }
    strokeRoundedRect() { return this; }
    lineStyle(width, color) { this.lineColor = color; return this; }
    lineBetween(x1, y1, x2, y2) { this.drawCalls.push({ type: 'lineBetween', x1, y1, x2, y2, color: this.lineColor }); return this; }
    fillCircle(x, y, r) { this.drawCalls.push({ type: 'fillCircle', x, y, r }); return this; }
    strokeCircle(x, y, r) { this.drawCalls.push({ type: 'strokeCircle', x, y, r, color: this.lineColor }); return this; }
    strokeEllipse(x, y, width, height) { this.drawCalls.push({type:'strokeEllipse',x,y,width,height,color:this.lineColor}); return this; }
    strokeRect() { return this; }
    strokePoints(points) { this.drawCalls.push({ type: 'strokePoints', points, color: this.lineColor }); return this; }
    fillRect(x,y,width,height) { this.drawCalls.push({type:'fillRect',x,y,width,height}); return this; }
    strokeTriangle() { return this; }
    fillTriangle() { return this; }
    clear() { this.drawCalls = []; return this; }
    destroy() { this.destroyed = true; }
}

class FakeScene {
    constructor() {
        this.scale = { width: 1366, height: 768, on() {}, off() {} };
        this.input = { keyboard: { on() {}, off() {} }, on() {}, off() {}, setDraggable() {} };
        this.events = { once() {} };
        this.add = {
            graphics: () => new Display(),
            text: (x, y, value, style) => { const d = new Display(x, y); d.setText(value); d.color = style?.color; return d; },
            zone: (x, y, width, height) => { const d = new Display(x, y); d.width = width; d.height = height; return d; }
        };
        this.scene = { start() {} };
        const units = ['unit_guard', 'unit_sniper', 'unit_dronoid', 'unit_mecha'].map(id => ({
            id, hp: 5, speed: 40, attack_damage: 1, attack_range: 30, attack_type: 'ranged', attack_speed: 1
        }));
        const enemies = ['basic_monster', 'ranged_monster', 'base_rusher'].map(id => ({
            id, hp: 5, speed: 30, attack_damage: 1, attack_range: 30, attack_type: 'melee', attack_speed: 1
        }));
        this.cache = { json: { get: () => ({ units, enemies }) } };
    }
}
const OverseerVNextBrand = vm.runInNewContext(brandSource + '\nOverseerVNextBrand;', {});
const Vision = vm.runInNewContext(visionSource + '\nVision;', {});
const VNextScene = vm.runInNewContext(tooltipSource + '\n' + boardSource + '\n' + battleViewSource + '\n' + vNextHudViewSource + '\n' + vNextWaveViewSource + '\n' + vNextRewardViewSource + '\n' + vNextInputSource + '\n' + vNextRunFlowSource + '\n' + vNextSimulationSource + '\n' + sceneSource + '\nVNextScene;', {
    Phaser: { Scene: FakeScene }, window: { keyboardLayout: 'azerty', selectedLanguage: 'fr' },
    OverseerECS: { World }, OverseerCombat: combat, OverseerHitEffects: hitEffects,
    OverseerBattleUnitStyles: battleStyles, OverseerBattleActionEffects: battleActions,
    OverseerVNextPreview: preview,
    OverseerVNextEconomy: economy, OverseerVNextBuildings: catalog, OverseerVNextCards: cards,
    OverseerVNextWaves: waves, OverseerVNextWaveTelemetry: telemetry, OverseerVNextMemoryShards: shards, OverseerVNextTechnologies: technologies, OverseerVNextRewards: rewards, OverseerVNextArtifacts: artifacts, OverseerVNextArtifactEffects: artifactEffects, OverseerVNextZones: zones, OverseerVNextThreats: threats, OverseerVNextCooling: cooling, OverseerVNextMaintenance: maintenance, OverseerVNextSave: saves, OverseerVNextVision: visionUpgrades,
    localStorage: saveStorage, Vision, OverseerVNextBrand
});

test('AI core health moves above the rings, changes color, and battlefield graphics are clipped', () => {
    const scene = new VNextScene();
    scene.create();
    assert.ok(scene.battleMask);
    for (const layer of [scene.zoneGraphics, scene.battleGraphics,
        scene.battleParticleGraphics, scene.battleActionGraphics]) {
        assert.equal(layer.mask, scene.battleMask);
    }
    for (const [hp, color] of [[100, 0x48b8c4], [52, 0xf0ba60], [14, 0xff6674]]) {
        scene.baseHp = hp;
        scene.paintBattle();
        const base = { x: scene.battleBounds.x + scene.battleBounds.w * 65 / 1000,
            y: scene.battleBounds.y + scene.battleBounds.h / 2 };
        assert.ok(scene.battleGraphics.drawCalls.some(call =>
            call.type === 'strokeCircle' && call.color === color &&
            Math.abs(call.x - base.x) < 0.01 && Math.abs(call.y - base.y) < 0.01));
    }
    assert.ok(!scene.battleStatus.value.includes('Base '));
    const previousMask = scene.battleMask;
    scene.buildUi();
    assert.equal(previousMask.destroyed, true);
    assert.notEqual(previousMask, scene.battleMask);
});

test('VNext vision upgrade spends ECS Data, exposes a disabled button and respects maximum', () => {
    savedEntries.clear();
    const scene = new VNextScene();
    scene.create();
    const resources = scene.world.get(scene.model.game, 'Resources');
    assert.equal(scene.visionRules.level, 0);
    assert.equal(scene.visionUpgradeButton.value, '▲ VISION');
    assert.equal(scene.visionUpgradeCostLabel.value, '0/30 DONNÉES');
    assert.equal(scene.tryUpgradeVision(), false);
    assert.equal(scene.visionRules.level, 0);
    assert.equal(scene.model.tiles.filter(id => scene.world.get(id, 'Watched').active).length, 3);

    resources.data = 360; // Test funding independent of the optional Data-producing building.
    for (const [level, remaining, nextCost] of [[1, 330, 90], [2, 240, 240], [3, 0, null]]) {
        const button = scene.visionUpgradeButton;
        scene.updateVisionUpgradeButton();
        assert.equal(button.color, '#b58aff');
        button.handlers.pointerdown();
        assert.equal(scene.visionRules.level, level);
        assert.equal(resources.data, remaining);
        if (nextCost !== null) assert.equal(scene.visionUpgradeCostLabel.value, `${remaining}/${nextCost} DONNÉES`);
        assert.equal(scene.model.tiles.filter(id => scene.world.get(id, 'Watched').active).length, level + 3);
        assert.equal(saves.read(saveStorage).attention.level, level);
    }
    assert.equal(scene.visionUpgradeButton.value, 'VISION MAX');
    assert.equal(scene.visionUpgradeCostLabel.value, '6 CASES');
    assert.equal(scene.tryUpgradeVision(), false);
    assert.equal(resources.data, 0);
    savedEntries.clear();
});

test('vision upgrade keeps rotation and clamps attention when the larger shape reaches an edge', () => {
    savedEntries.clear();
    const scene = new VNextScene();
    scene.create();
    const resources = scene.world.get(scene.model.game, 'Resources');
    resources.data = 360;
    assert.equal(scene.changeAttention(2, 2), true);
    assert.equal(scene.changeAttention(0, 0, true), true);
    assert.equal(scene.visionRules.patternIndex, 1);
    assert.equal(scene.tryUpgradeVision(), true); // 2x2 still fits at 3,3.
    assert.equal(scene.attention.x, 3);
    assert.equal(scene.attention.y, 3);
    assert.equal(scene.tryUpgradeVision(), true); // Rotated 5-tile footprint needs y <= 2.
    assert.equal(scene.attention.y, 2);
    assert.equal(scene.visionRules.patternIndex, 1);
    assert.equal(scene.tryUpgradeVision(), true);
    const observed = scene.model.tiles
        .map((id, i) => scene.world.get(id, 'Watched').active ? i : -1).filter(i => i >= 0);
    assert.equal(observed.length, 6);
    assert.ok(observed.every(i => i >= 0 && i < 25));
    const position = { ...scene.attention };
    const rotation = scene.visionRules.patternIndex;
    assert.equal(scene.changeAttention(0, -4), false);
    assert.deepEqual({ ...scene.attention }, position);
    assert.equal(scene.visionRules.patternIndex, rotation);
    savedEntries.clear();
});

test('Continue restores upgraded vision and old save files still restore level zero', () => {
    savedEntries.clear();
    const running = new VNextScene();
    running.create();
    running.world.get(running.model.game, 'Resources').data = 120;
    assert.equal(running.tryUpgradeVision(), true);
    assert.equal(running.tryUpgradeVision(), true);
    assert.equal(running.changeAttention(0, 0, true), true);
    assert.equal(running.saveCurrentGame(), true);
    const previouslyWatched = running.model.tiles.map(id =>
        running.world.get(id, 'Watched').active);
    const resumed = new VNextScene();
    resumed.init({ resume: true });
    resumed.create();
    assert.equal(resumed.visionRules.level, 2);
    assert.equal(resumed.visionRules.patternIndex, running.visionRules.patternIndex);
    assert.deepEqual(resumed.model.tiles.map(id => resumed.world.get(id, 'Watched').active), previouslyWatched);
    assert.equal(resumed.world.get(resumed.model.game, 'Resources').data, 0);

    const oldSave = saves.capture(running, 1720000000000);
    delete oldSave.attention.level;
    // The legacy format always had a 3-cell footprint.
    const legacy = new VNextScene();
    legacy.create();
    oldSave.world = legacy.world.serialize();
    oldSave.attention = { x: 1, y: 1, patternIndex: 0 };
    oldSave.model = { game: legacy.model.game, grid: legacy.model.grid, tiles: [...legacy.model.tiles] };
    oldSave.battleUnits = [...legacy.battleUnits];
    oldSave.waveClock = { ...legacy.waveClock };
    oldSave.waveMembers = [...legacy.waveMembers];
    oldSave.rewardQueue = [...legacy.rewardQueue];
    oldSave.activeReward = legacy.activeReward;
    savedEntries.set(saves.KEY, JSON.stringify(oldSave));
    const older = new VNextScene();
    older.init({ resume: true });
    older.create();
    assert.equal(older.visionRules.level, 0);
    assert.equal(older.visionRules.visionPatterns[0].length, 3);
    savedEntries.clear();
});

test('compute node shows Data stock, throughput, tooltip and floating production event', () => {
    const scene = new VNextScene();
    scene.create();
    assert.equal(scene.resourceLabels.data.value, '0');
    assert.equal(scene.resourceStatusLabels.data.value, '0.0/s');
    // The compute node is now reward-only, so grant it explicitly for this focused test.
    assert.equal(cards.grant(scene.model, 'compute_node'), true);
    scene.selectedType = 'compute_node';
    scene.clickTile(6);
    const id = preview.buildingAt(scene.model, 6);
    assert.equal(scene.world.get(id, 'Building').type, 'compute_node');
    scene.showBuildingTooltip(6);
    const labels = scene.tooltipObjects.filter(o => typeof o.value === 'string').map(o => o.value);
    for (const item of ['Nœud de calcul', 'CONSOMME / CYCLE', 'PRODUIT / CYCLE', '6.0s/cycle']) {
        assert.ok(labels.includes(item), `missing ${item}`);
    }
    const resources = scene.world.get(scene.model.game, 'Resources');
    resources.energy = 2; resources.components = 1; resources.matter = 1;
    for (let i = 0; i < 100; i++) scene.update(0, 60);
    assert.equal(resources.data, 2);
    assert.equal(scene.resourceLabels.data.value, '2');
    assert.equal(scene.resourceStatusLabels.data.value, '+0.3/s');
    assert.equal(scene.resourceStatusLabels.data.color, '#69e5ac');
    assert.ok(scene.productionPopups.some(effect =>
        effect.label.value === '+2' && effect.label.color === '#b58aff'));
    assert.equal(scene.visionUpgradeCostLabel.value, '2/30 DONNÉES');
    scene.scale.width = 800;
    scene.buildUi();
    assert.equal(scene.compactResources.data.value, '2');
    assert.equal(scene.compactResourceDeltas.data.value, '+0.3/s');
    assert.ok(scene.compactResources.data.x > scene.layout.boardX);
    assert.ok(scene.compactResources.data.y > scene.gridLayout.y + scene.gridLayout.size,
        'compact resources must not overlap the base grid or construction cards');
    const technologies = scene.ui.find(item => item.value === 'TECHNOLOGIES');
    assert.ok(technologies.y > scene.compactResources.data.y,
        'compact technology inventory appears below resource lines');
});

test('Data from compute-node cycles pays a vision upgrade and survives Continue', () => {
    savedEntries.clear();
    const running = new VNextScene();
    running.create();
    assert.equal(cards.grant(running.model, 'compute_node'), true);
    running.selectedType = 'compute_node';
    running.clickTile(6);
    const resources = running.world.get(running.model.game, 'Resources');
    resources.energy = 30; resources.matter = 15; resources.components = 15;
    // Speed up the ECS production only; the UI must still see its real Data balance.
    economy.step(running.model, 84000);
    for (let i = 0; i < 100; i++) running.update(0, 60);
    assert.equal(resources.data, 30);
    assert.equal(running.visionUpgradeButton.color, '#b58aff');
    assert.equal(running.tryUpgradeVision(), true);
    assert.equal(resources.data, 0);
    assert.equal(running.visionRules.level, 1);
    const resumed = new VNextScene();
    resumed.init({ resume: true });
    resumed.create();
    assert.equal(resumed.visionRules.level, 1);
    assert.equal(resumed.world.get(resumed.model.game, 'Resources').data, 0);
    savedEntries.clear();
});

test('scene begins with four unspent cards and empty base', () => {
    const scene = new VNextScene();
    scene.create();
    assert.equal(scene.world.query('Tile').length, 25);
    assert.equal(scene.world.query('Building').length, 0);
    assert.deepEqual(cards.cards(scene.model), ['reactor', 'extractor', 'factory', 'barracks']);
    assert.equal(scene.world.query('PreviewUnit').length, 3);
    scene.selectedType = 'reactor';
    scene.clickTile(6);
    assert.ok(preview.buildingAt(scene.model, 6));
    assert.deepEqual(cards.cards(scene.model), ['extractor', 'factory', 'barracks']);
    scene.clickTile(6);
    scene.clickTile(23);
    assert.equal(preview.buildingAt(scene.model, 6), null);
    assert.ok(preview.buildingAt(scene.model, 23));
    assert.deepEqual(cards.cards(scene.model), ['extractor', 'factory', 'barracks']);
    scene.scale.width = 800;
    scene.buildUi();
    scene.resetBattle();
    assert.equal(scene.world.query('PreviewUnit').length, 3);
});

test('observed empty tiles use a large bright marker and fine ring', () => {
    const scene = new VNextScene();
    scene.create();
    // Shift the legacy L-shaped attention to cover empty positions 8 and 12.
    assert.equal(scene.changeAttention(1, 0), true);
    const { x, y, cell } = scene.gridLayout;
    const at = index => ({ x: x + (index % 5 + 0.5) * cell, y: y + (Math.floor(index / 5) + 0.5) * cell });
    const callsAt = (index, type) => scene.boardGraphics.drawCalls.filter(c => c.type === type &&
        Math.abs(c.x - at(index).x) < 0.01 && Math.abs(c.y - at(index).y) < 0.01);
    assert.equal(preview.buildingAt(scene.model, 8), null);
    assert.ok(callsAt(8, 'fillCircle').some(c => c.r >= 5));
    assert.ok(callsAt(8, 'strokeCircle').some(c => c.r >= 10));
    assert.ok(callsAt(0, 'fillCircle').some(c => c.r < 3));
    assert.equal(callsAt(0, 'strokeCircle').length, 0);
});

test('starter economy runs with an extractor placed', () => {
    const scene = new VNextScene();
    scene.create();
    scene.selectedType = 'reactor';
    scene.clickTile(6);
    scene.selectedType = 'extractor';
    scene.clickTile(7);
    scene.selectedType = 'factory';
    scene.clickTile(11);
    const balance = scene.world.get(scene.model.game, 'Resources');
    for (let i = 0; i < 100; i++) scene.update(0, 60);
    assert.ok(balance.energy > 0);
    assert.ok(balance.components > 0, 'Factory converts energy and matter');
    const previous = { ...balance };
    scene.selectSpeed(0);
    for (let i = 0; i < 10; i++) scene.update(0, 60);
    assert.deepEqual(balance, previous);
});

test('resource glyphs and values remain available before construction', () => {
    const scene = new VNextScene();
    scene.create();
    assert.equal(scene.resourceLabels.energy.color, '#35d8ef');
    assert.equal(scene.resourceLabels.matter.color, '#39dd92');
    assert.equal(scene.resourceLabels.components.color, '#f4ba58');
    assert.equal(scene.resourceStatusLabels.energy.value, '0.0/s');
});

test('resource HUD updates when starter reactor is placed and observed', () => {
    const scene = new VNextScene();
    scene.create();
    scene.selectedType = 'reactor';
    scene.clickTile(6);
    for (let i = 0; i < 34; i++) scene.update(0, 60);
    assert.equal(scene.resourceLabels.energy.value, '2');
    assert.equal(scene.resourceStatusLabels.energy.value, '+1.0/s');
    scene.changeAttention(1, 0);
    for (let i = 0; i < 110; i++) scene.update(0, 60); // Rate window expires out of vision.
    assert.equal(scene.resourceStatusLabels.energy.value, '0.0/s');
    scene.scale.width = 800;
    scene.buildUi();
    assert.equal(scene.compactResources.energy.value, '2');
    assert.equal(scene.compactResourceDeltas.energy.value, '0.0/s');
});

test('starter factory displays waiting state without unearned resources', () => {
    const scene = new VNextScene();
    scene.create();
    scene.selectedType = 'factory';
    scene.clickTile(11);
    for (let i = 0; i < 60; i++) scene.update(0, 60);
    assert.equal(scene.resourceLabels.components.value, '0');
    assert.equal(scene.resourceStatusLabels.components.value, '0.0/s');
});

test('building tooltip distinguishes free placement from per-unit production costs', () => {
    const scene = new VNextScene();
    scene.create();
    scene.selectedType = 'factory';
    scene.clickTile(11);
    scene.selectedType = 'barracks';
    scene.clickTile(12);
    scene.showBuildingTooltip(11);
    const labels = scene.tooltipObjects.filter(o => typeof o.value === 'string').map(o => o.value);
    assert.ok(labels.includes('Fabrique'));
    assert.ok(!labels.some(text => /COÛT DE CONSTRUCTION|COÛT DE POSE|POSE :/.test(text)));
    assert.ok(labels.includes('3.0s/cycle'));
    assert.ok(!scene.ui.some(o => typeof o.value === 'string' && /COÛT DE POSE|POSE :/.test(o.value)));
    const old = [...scene.tooltipObjects];
    scene.showBuildingTooltip(12);
    assert.ok(old.every(o => o.destroyed));
    assert.ok(!scene.tooltipObjects.some(o => typeof o.value === 'string' && /COÛT DE CONSTRUCTION|COÛT DE POSE|POSE :/.test(o.value)));
    assert.ok(scene.tooltipObjects.some(o => o.value === 'COÛT PAR UNITÉ'));
    assert.ok(scene.tooltipObjects.some(o => o.value === 'CYCLE : 5.0s / UNITÉ'));
    assert.ok(scene.tooltipObjects.some(o => o.value === '25'));
    assert.ok(scene.tooltipObjects.some(o => o.value === '15'));
    assert.ok(scene.tooltipObjects.some(o => /^UNITÉS \d+\/\d+$/.test(o.value)));
    scene.hideBuildingTooltip();
    assert.equal(scene.tooltipObjects.length, 0);
});

test('tooltip cleanup survives viewport resize', () => {
    const scene = new VNextScene();
    scene.create();
    scene.selectedType = 'reactor';
    scene.clickTile(6);
    scene.showBuildingTooltip(6);
    const old = [...scene.tooltipObjects];
    scene.scale.width = 800;
    scene.buildUi();
    assert.ok(old.every(o => o.destroyed));
});

test('drag and drop consumes a single card only on valid target', () => {
    const scene = new VNextScene();
    scene.create();
    const dragged = { getData: () => 'barracks' };
    scene.onDragEnd({ x: -100, y: -100 }, dragged);
    assert.deepEqual(cards.cards(scene.model), ['reactor', 'extractor', 'factory', 'barracks']);
    const { x, y, cell } = scene.gridLayout;
    scene.onDragEnd({ x: x + cell * 0.5, y: y + cell * 0.5 }, dragged);
    assert.deepEqual(cards.cards(scene.model), ['reactor', 'extractor', 'factory']);
    assert.ok(preview.buildingAt(scene.model, 0));
});

test('barracks creates an autonomous player ECS unit after spending resources', () => {
    const scene = new VNextScene();
    scene.create();
    scene.selectedType = 'barracks';
    scene.clickTile(6);
    const balance = scene.world.get(scene.model.game, 'Resources');
    balance.energy = 15; balance.components = 25;
    const before = scene.world.query('PreviewUnit').length;
    for (let i = 0; i < 83; i++) scene.update(0, 60);
    scene.update(0, 19);
    assert.equal(scene.world.query('PreviewUnit').length, before, 'no soldier before five seconds');
    assert.equal(balance.components, 25);
    assert.equal(balance.energy, 15);
    scene.update(0, 1);
    assert.equal(scene.world.query('PreviewUnit').length, before + 1);
    assert.equal(balance.components, 0);
    assert.equal(balance.energy, 0);
    assert.equal(scene.world.query('Faction').filter(id => scene.world.get(id, 'Faction').side === 'player').length, 4);
});

test('card hover shares building recipe tooltip with grid hover', () => {
    const scene = new VNextScene();
    scene.create();
    scene.showCardTooltip('barracks', 180, 150);
    assert.ok(scene.tooltipObjects.some(object => object.value === 'Caserne'));
    assert.ok(scene.tooltipObjects.some(object => object.value === '25'));
    assert.ok(scene.tooltipObjects.some(object => object.value === '15'));
    assert.ok(scene.tooltipObjects.some(object => /^UNITÉS \d+\/\d+$/.test(object.value)));
    const previous = [...scene.tooltipObjects];
    scene.hideBuildingTooltip();
    assert.ok(previous.every(object => object.destroyed));
});

test('compact resource HUD shows icon, count and measured net rate per simulation second', () => {
    const scene = new VNextScene();
    scene.create();
    const allText = scene.ui.filter(o => typeof o.value === 'string').map(o => o.value);
    assert.equal(allText.includes('Énergie'), false);
    assert.equal(allText.includes('Matière'), false);
    assert.equal(allText.includes('Composants'), false);
    scene.selectedType = 'reactor';
    scene.clickTile(6);
    for (let i = 0; i < 34; i++) scene.update(0, 60);
    assert.equal(scene.resourceLabels.energy.value, '2');
    assert.equal(scene.resourceStatusLabels.energy.value, '+1.0/s');
    assert.equal(scene.resourceStatusLabels.energy.color, '#69e5ac');
    scene.scale.width = 800;
    scene.buildUi();
    assert.equal(scene.compactResources.energy.value, '2');
    assert.equal(scene.compactResourceDeltas.energy.value, '+1.0/s');
});

test('resource rates include real consumption, pause without decay and return to zero out of vision', () => {
    const scene = new VNextScene();
    scene.create();
    assert.equal(scene.resourceStatusLabels.energy.value, '0.0/s');
    assert.equal(scene.resourceStatusLabels.energy.color, '#7898aa');
    scene.selectedType = 'factory';
    scene.clickTile(6);
    const resources = scene.world.get(scene.model.game, 'Resources');
    resources.energy = 8;
    resources.matter = 8;
    for (let i = 0; i < 50; i++) scene.update(0, 60); // One 3-second cycle.
    assert.equal(scene.resourceStatusLabels.energy.value, '-0.7/s');
    assert.equal(scene.resourceStatusLabels.matter.value, '-0.7/s');
    assert.equal(scene.resourceStatusLabels.components.value, '+0.3/s');
    assert.equal(scene.resourceStatusLabels.energy.color, '#ff6674');
    assert.equal(scene.resourceStatusLabels.components.color, '#69e5ac');
    scene.selectSpeed(0);
    scene.update(0, 5000); // Pausing freezes the simulation-time window.
    assert.equal(scene.resourceStatusLabels.energy.value, '-0.7/s');
    scene.selectSpeed(1);
    assert.equal(scene.changeAttention(2, 0), true); // Move the factory outside vision.
    for (let i = 0; i < 110; i++) scene.update(0, 60);
    assert.equal(scene.resourceStatusLabels.energy.value, '0.0/s');
    assert.equal(scene.resourceStatusLabels.energy.color, '#7898aa');
});

test('production emits a colored icon and amount that rise, fade and expire', () => {
    const scene = new VNextScene();
    scene.create();
    scene.selectedType = 'reactor';
    scene.clickTile(6);
    for (let i = 0; i < 34; i++) scene.update(0, 60);
    assert.equal(scene.productionPopups.length, 1);
    const popup = scene.productionPopups[0];
    assert.equal(popup.label.value, '+2');
    assert.equal(popup.label.color, '#35d8ef');
    const startY = popup.label.y;
    scene.updateProductionPopups(350);
    assert.ok(popup.label.y < startY);
    assert.ok(popup.label.alpha < 1);
    scene.selectSpeed(0);
    const frozenY = popup.label.y;
    scene.update(0, 250);
    assert.equal(popup.label.y, frozenY);
    scene.updateProductionPopups(500);
    assert.equal(scene.productionPopups.length, 0);
    assert.ok(popup.icon.destroyed && popup.label.destroyed);
});

test('production popups are bounded and cleared on UI rebuild', () => {
    const scene = new VNextScene();
    scene.create();
    scene.selectedType = 'reactor';
    scene.clickTile(6);
    const id = preview.buildingAt(scene.model, 6);
    for (let i = 0; i < 40; i++) scene.showProductionPopup({ type: 'production', building: id, buildingType: 'reactor' });
    assert.equal(scene.productionPopups.length, 24);
    const old = [...scene.productionPopups];
    scene.buildUi();
    assert.equal(scene.productionPopups.length, 0);
    assert.ok(old.every(p => p.icon.destroyed && p.label.destroyed));
});

test('resource panel narrows and reveals each resource name only on hover', () => {
    const scene = new VNextScene();
    scene.create();
    assert.equal(scene.layout.rightW, 112);
    assert.ok(scene.layout.battleW > 0);
    const allText = scene.ui.filter(o => typeof o.value === 'string').map(o => o.value);
    assert.equal(allText.includes('Refroidissement'), false);
    const zone = scene.ui.find(o => o.getData?.('resource') === 'energy');
    assert.ok(zone);
    zone.handlers.pointerover();
    assert.equal(scene.resourceTooltip.value, 'Énergie');
    zone.handlers.pointerout();
    assert.equal(scene.resourceTooltip, null);
    scene.scale.width = 800;
    scene.buildUi();
    const compactZone = scene.ui.find(o => o.getData?.('resource') === 'energy');
    compactZone.handlers.pointerover();
    assert.equal(scene.resourceTooltip.value, 'Énergie');
});

test('right resource panel has no resource heading or protocols content', () => {
    const scene = new VNextScene();
    scene.create();
    const labels = scene.ui.filter(item => typeof item.value === 'string').map(item => item.value);
    for (const removed of ['RESSOURCES', 'PROTOCOLES', 'À définir avec l’économie', 'Aucun sort simulé ici']) {
        assert.equal(labels.includes(removed), false, removed);
    }
    assert.ok(scene.resourceLabels.energy);
    assert.ok(scene.resourceStatusLabels.components);
});

test('right panel reserves only a narrow resource strip for battle', () => {
    const scene = new VNextScene();
    scene.create();
    assert.equal(scene.layout.rightW, 112);
    const previous = scene.layout.battleW;
    scene.scale.width = 1600;
    scene.buildUi();
    assert.ok(scene.layout.battleW > previous);
    assert.equal(scene.layout.rightW, 112);
});

test('wave timeline exposes stable composition details on marker hover', () => {
    const scene = new VNextScene();
    scene.create();
    const zones = scene.ui.filter(o => Number.isInteger(o.getData?.('wave')));
    assert.equal(zones.length, 8);
    const index = 3, marker = zones[index];
    marker.handlers.pointerover();
    const labels = scene.waveTooltipObjects.filter(o => typeof o.value === 'string').map(o => o.value);
    assert.ok(labels.includes('VAGUE 4'));
    assert.ok(labels.some(s => s.includes('Ennemi de base')));
    assert.ok(labels.some(s => s.includes(String(scene.previewWaves[index].enemies[0].count))));
    const old = [...scene.waveTooltipObjects];
    marker.handlers.pointerout();
    assert.ok(old.every(o => o.destroyed));
    assert.equal(scene.waveTooltipObjects.length, 0);
    scene.showWaveTooltip(2, 400, 800);
    scene.scale.width = 800;
    scene.buildUi();
    assert.equal(scene.waveTooltipObjects.length, 0);
});

test('wave telemetry integrates with ECS spawns, death, actual base damage and rewards', () => {
    savedEntries.clear();
    const scene = new VNextScene();
    scene.create();
    scene.waveClock.number = 1;
    scene.waveClock.elapsedMs = 80000;
    const wave = waves.wave(1, scene.waveClock.seed);
    scene.triggerWave(wave);
    const ids = [...scene.waveMembers.get(1)];
    assert.equal(scene.waveReport()[0].spawned, ids.length);
    assert.equal(scene.waveReport()[0].alliesStart, 3);
    scene.world.get(ids[0], 'Health').hp = 0;
    scene.world.get(scene.battleUnits.find(id => scene.world.get(id, 'Faction').side === 'player'), 'Health').hp = 0;
    telemetry.baseHit(scene.model, ids[1], 7);
    scene.baseHp -= 7;
    scene.checkWaveClears();
    assert.deepEqual(scene.waveReport().map(row => [row.killed, row.allyDeathsDuring, row.coreDamage]), [[1, 1, 7]]);
    scene.checkWaveClears(); // Count dead units only once, even before reclamation.
    assert.equal(scene.waveReport()[0].killed, 1);
    ids.forEach(id => { scene.world.get(id, 'Health').hp = 0; });
    scene.waveClock.elapsedMs += 12000;
    scene.checkWaveClears();
    const record = scene.waveReport()[0];
    assert.equal(record.status, 'cleared');
    assert.equal(record.killed, ids.length);
    assert.equal(record.durationSeconds, 12);
    assert.equal(record.coreHpEnd, 93);
    assert.equal(scene.activeReward.number, 1, 'existing reward flow is unchanged');
    const snapshot = saves.capture(scene);
    const restored = saves.restore(snapshot, World);
    assert.deepEqual(telemetry.report(restored.model), scene.waveReport());
    savedEntries.clear();
});

test('wave telemetry tolerates multiple concurrent waves and resumed legacy runs', () => {
    savedEntries.clear();
    const scene = new VNextScene();
    scene.create();
    for (const n of [1, 2]) {
        scene.waveClock.number = n;
        scene.waveClock.elapsedMs = n * 90000;
        scene.triggerWave(waves.wave(n, scene.waveClock.seed));
    }
    const first = scene.waveMembers.get(1)[0];
    const second = scene.waveMembers.get(2)[0];
    scene.world.get(first, 'Health').hp = 0;
    scene.world.get(second, 'Health').hp = 0;
    const ally = scene.battleUnits.find(id => scene.world.get(id, 'Faction').side === 'player');
    scene.world.get(ally, 'Health').hp = 0;
    scene.checkWaveClears();
    assert.deepEqual(scene.waveReport().map(row => [row.killed, row.allyDeathsDuring]), [[1, 1], [1, 1]]);
    assert.equal(scene.activeReward, null);
    const saved = saves.capture(scene);
    const entity = saved.world.entities.find(e => e.id === scene.model.game);
    entity.components = entity.components.filter(([kind]) => kind !== 'WaveTelemetry');
    savedEntries.set(saves.KEY, JSON.stringify(saved));
    const resumed = new VNextScene();
    resumed.init({ resume: true });
    resumed.create();
    assert.deepEqual(resumed.waveReport(), [], 'old saves can lack metrics');
    assert.equal(resumed.waveMembers.size, 2, 'wave gameplay resumes regardless of metrics');
    savedEntries.clear();
});

test('timeline tooltip and spawner already accept multi-type wave descriptors', () => {
    const scene = new VNextScene();
    scene.create();
    const wave = {
        number: 1, dueAtMs: 90000,
        enemies: [{ type: 'basic_monster', count: 2 },
            { type: 'ranged_monster', count: 2 }, { type: 'base_rusher', count: 1 }]
    };
    scene.previewWaves[0] = wave;
    scene.showWaveTooltip(0, 500, 710);
    const labels = scene.waveTooltipObjects.filter(o => typeof o.value === 'string').map(o => o.value);
    assert.ok(labels.some(s => s.includes('×2') && s.includes('Ennemi de base')));
    assert.ok(labels.some(s => s.includes('×2') && s.includes('Tireur distant')));
    assert.ok(labels.some(s => s.includes('×1') && s.includes('Percuteur')));
    scene.waveClock.number = 1;
    scene.waveClock.elapsedMs = 90000;
    scene.triggerWave(wave);
    assert.equal(scene.waveMembers.get(1).length, 5);
    const types = scene.waveMembers.get(1).map(id => scene.world.get(id, 'PreviewUnit').type);
    assert.deepEqual(Array.from(types).sort(), [
        'basic_monster', 'basic_monster', 'ranged_monster', 'ranged_monster', 'base_rusher'
    ].sort());
    assert.equal(scene.waveReport()[0].spawned, 5);
});

test('wave markers show one to five threat dots, elite in amber, and honest tooltip', () => {
    const scene=new VNextScene();
    scene.create();
    scene.waveClock.elapsedMs=0;
    const seed=scene.waveClock.seed;
    scene.previewWaves=[waves.wave(1,seed),waves.wave(4,seed),waves.wave(7,seed),waves.wave(10,seed)];
    scene.waveClock.elapsedMs=waves.wave(1,seed).dueAtMs-20000;
    const due=[20000,50000,110000,180000];
    scene.previewWaves=scene.previewWaves.map((wave,i)=>({...wave,dueAtMs:scene.waveClock.elapsedMs+due[i]}));
    scene.waveMarkers=scene.waveMarkers.slice(0,4);
    scene.paintWaveTimeline();
    const visibleDots=scene.waveGraphics.drawCalls.filter(c=>c.type==='fillCircle');
    assert.equal(visibleDots.length,1+2+3+5);
    assert.equal(scene.waveGraphics.drawCalls.filter(c=>c.type==='strokeCircle').length,1,
        'only the elite wave gets a special outline');
    assert.deepEqual(scene.previewWaves.map(w=>waves.danger(w).level),[1,2,3,5]);
    scene.showWaveTooltip(3,500,650);
    const labels=scene.waveTooltipObjects.filter(o=>typeof o.value==='string').map(o=>o.value);
    assert.ok(labels.includes('VAGUE 10 · ÉLITE'));
    assert.ok(labels.some(s=>s.includes('MENACE ESTIMÉE')));
    assert.ok(labels.some(s=>s.includes('RÉCOMPENSE : BÂTIMENT + TECHNO')));
    assert.ok(labels.some(s=>s.includes('Percuteur')));
});

test('clearing tenth-wave elite guarantees two reward choices in existing journey', () => {
    savedEntries.clear();
    const scene=new VNextScene();scene.create();
    scene.waveClock.number=10;
    scene.waveClock.elapsedMs=waves.wave(10,scene.waveClock.seed).dueAtMs;
    const wave=waves.wave(10,scene.waveClock.seed);
    scene.triggerWave(wave);
    for(const id of scene.waveMembers.get(10))scene.world.get(id,'Health').hp=0;
    scene.checkWaveClears();
    const kinds = scene.activeReward.stages.map(stage => stage.kind);
    assert.deepEqual(kinds.slice(0,2), ['building','technology']);
    assert.ok(kinds.length === 2 || (kinds.length === 3 && kinds[2] === 'artifact'));
    const cardBefore=cards.cards(scene.model).length;
    assert.equal(scene.chooseReward(scene.activeReward.options[0]),true);
    assert.equal(cards.cards(scene.model).length,cardBefore+1);
    assert.equal(scene.activeReward.index,1);
    const saved=saves.capture(scene);
    assert.equal(saves.restore(saved,World).activeReward.index,1);
    const techBefore=technologies.inventory(scene.model).items.length;
    assert.equal(scene.chooseReward(scene.activeReward.options[0]),true);
    assert.equal(technologies.inventory(scene.model).items.length,techBefore+1);
    if (scene.activeReward) {
        assert.equal(rewards.current(scene.activeReward).kind, 'artifact');
        assert.equal(scene.chooseReward(scene.activeReward.options[0]), true);
    }
    assert.equal(scene.activeReward,null);
    savedEntries.clear();
});

test('wave timer spawns enemies at simulation interval and pauses', () => {
 const scene = new VNextScene();
 scene.create();
 const before = scene.world.query('Faction').filter(id => scene.world.get(id, 'Faction').side === 'enemy').length;
 scene.waveClock.elapsedMs = waves.wave(1, scene.waveClock.seed).dueAtMs - 60;
 scene.update(0, 60);
 assert.equal(scene.waveClock.number, 1);
 const enemies = scene.world.query('Faction').filter(id => scene.world.get(id, 'Faction').side === 'enemy').length;
 assert.equal(enemies, before + waves.wave(1, scene.waveClock.seed).enemies[0].count);
 scene.selectSpeed(0);
 scene.update(0, 60);
 assert.equal(scene.waveClock.number, 1);
 assert.ok(/^\d+$/.test(scene.waveCountdownLabel.value));
});
test('wave markers scroll, pause and accelerate with simulation speed',()=>{
 const scene=new VNextScene();scene.create();
 const x=scene.waveMarkers[0].zone.x;
 scene.update(0,60);assert.ok(scene.waveMarkers[0].zone.x<x);
 scene.selectSpeed(0);
 const stopped=scene.waveMarkers[0].zone.x;
 scene.update(0,60);assert.equal(scene.waveMarkers[0].zone.x,stopped);
 scene.selectSpeed(5);
 const before=scene.waveMarkers[0].zone.x;
 scene.update(0,60);assert.ok(scene.waveMarkers[0].zone.x<before);
});

test('timeline is compact and countdown stays numeric', () => {
 const scene = new VNextScene();
 scene.create();
 assert.equal(scene.layout.mainBottom, scene.scale.height - 86);
 assert.equal(scene.waveTimelineBounds.x1, scene.layout.m + 70);
 assert.ok(/^\d+$/.test(scene.waveCountdownLabel.value));
 const labels = scene.ui.filter(o => typeof o.value === 'string').map(o => o.value);
 assert.equal(labels.includes('VAGUES / TIMELINE'), false);
 assert.equal(labels.includes('↻ REJOUER LE COMBAT'), false);
 assert.equal(scene.waveMarkers.length, 8);
});

test('battle starts without enemies and first timeline wave adds them', () => {
 const scene = new VNextScene();
 scene.create();
 const enemies = () => scene.world.query('Faction').filter(id =>
   scene.world.get(id, 'Faction').side === 'enemy' && scene.world.get(id, 'Health').hp > 0);
 const allies = scene.world.query('Faction').filter(id => scene.world.get(id, 'Faction').side === 'player');
 assert.equal(enemies().length, 0);
 assert.equal(allies.length, 3);
 scene.waveClock.elapsedMs = waves.wave(1, scene.waveClock.seed).dueAtMs - 60;
 scene.update(0, 60);
 assert.equal(enemies().length, waves.wave(1, scene.waveClock.seed).enemies[0].count);
});

test('a defeated wave offers three unique cards and pauses until one is selected', () => {
    const scene = new VNextScene();
    scene.create();
    scene.waveClock.seed = Array.from({length:100},(_,i)=>i).find(seed=>rewards.mode(1,seed).join()==='building');
    const wave = waves.wave(1, scene.waveClock.seed);
    scene.triggerWave(wave);
    assert.equal(scene.activeReward, null);
    const members = scene.waveMembers.get(1);
    assert.equal(members.length, wave.enemies[0].count);
    members.forEach(id => { scene.world.get(id, 'Health').hp = 0; });
    scene.checkWaveClears();
    assert.equal(scene.activeReward.number, 1);
    assert.equal(new Set(scene.activeReward.options).size, 3);
    const options = [...scene.activeReward.options];
    const elapsed = scene.waveClock.elapsedMs;
    scene.selectSpeed(5);
    scene.update(0, 60);
    assert.equal(scene.waveClock.elapsedMs, elapsed);
    const before = cards.cards(scene.model).length;
    const technologiesBefore = technologies.inventory(scene.model).items.length;
    assert.equal(scene.chooseReward('not-a-card'), false);
    assert.equal(scene.chooseReward(options[0]), true);
    const technologyReward = options[0].startsWith('tech:');
    assert.equal(cards.cards(scene.model).length, before + (technologyReward ? 0 : 1));
    assert.equal(technologies.inventory(scene.model).items.length, technologiesBefore + (technologyReward ? 1 : 0));
    assert.equal(scene.activeReward, null);
    assert.equal(scene.chooseReward(options[1]), false);
});
test('two cleared overlapping waves queue rewards without duplication', () => {
    const scene = new VNextScene();
    scene.create();
    for (let n = 1; n <= 2; n++) {
        scene.triggerWave(waves.wave(n, scene.waveClock.seed));
        scene.waveMembers.get(n).forEach(id => { scene.world.get(id, 'Health').hp = 0; });
    }
    scene.checkWaveClears();
    assert.equal(scene.activeReward.number, 1);
    assert.equal(scene.rewardQueue.length, 1);
    scene.checkWaveClears();
    assert.equal(scene.rewardQueue.length, 1);
    while (scene.activeReward?.number===1) scene.chooseReward(scene.activeReward.options[0]);
    assert.equal(scene.activeReward.number, 2);
    while (scene.activeReward) scene.chooseReward(scene.activeReward.options[0]);
    assert.equal(scene.activeReward, null);
});

test('reward cards show and clean up existing building detail popup above overlay', () => {
    const scene = new VNextScene();
    scene.create();
    scene.activeReward = { number: 1, options: ['reactor', 'factory', 'barracks'] };
    scene.buildUi();
    const card = scene.ui.find(o => o.getData?.('reward') === 'barracks');
    assert.ok(card);
    card.handlers.pointerover();
    const labels = scene.tooltipObjects.filter(o => typeof o.value === 'string').map(o => o.value);
    assert.ok(labels.includes('Caserne'));
    assert.ok(labels.includes('COÛT PAR UNITÉ'));
    assert.ok(labels.includes('25'));
    assert.ok(labels.includes('15'));
    const objects = [...scene.tooltipObjects];
    card.handlers.pointerout();
    assert.equal(scene.tooltipObjects.length, 0);
    assert.ok(objects.every(o => o.destroyed));
    card.handlers.pointerover();
    scene.chooseReward('barracks');
    assert.equal(scene.tooltipObjects.length, 0);
});

test('military specialty rewards include all three new production cards', () => {
    const scene = new VNextScene();
    scene.create();
    const choices = new Set();
    for (let n = 1; n <= 60; n++) for (const type of scene.rewardOptions(n)) choices.add(type);
    assert.ok(choices.has('ballistics'));
    assert.ok(choices.has('armor_forge'));
    assert.ok(choices.has('medical_center'));
    scene.selectedType = null;
    for (const [type, slot] of [['ballistics',6],['armor_forge',7],['medical_center',11]]) {
        cards.grant(scene.model,type);
        scene.selectedType = type;
        scene.clickTile(slot);
        assert.equal(scene.world.get(preview.buildingAt(scene.model,slot),'Building').type,type);
    }
});

test('VNext shares its title with the menu and MENU returns there', () => {
    const scene = new VNextScene();
    scene.create();
    const labels = scene.ui.filter(o => typeof o.value === 'string').map(o => o.value);
    assert.ok(labels.includes(OverseerVNextBrand.title));
    assert.ok(labels.includes(OverseerVNextBrand.subtitle));
    let destination = null;
    scene.scene.start = key => { destination = key; };
    const menu = scene.ui.find(o => o.value === 'MENU');
    assert.ok(menu);
    menu.handlers.pointerdown();
    assert.equal(destination, 'MainMenuScene');
});


test('Continue restores exact ECS identities, battle entities and waves in progress', () => {
    savedEntries.clear();
    const running = new VNextScene();
    running.create();
    running.selectedType = 'reactor';
    running.clickTile(6);
    economy.initialize(running.model); // Production is normally attached on the next economy step.
    running.world.get(preview.buildingAt(running.model, 6), 'Production').elapsedMs = 851;
    const wave = waves.wave(1, running.waveClock.seed);
    running.waveClock.number = 1;
    running.waveClock.elapsedMs = wave.dueAtMs + 900;
    running.triggerWave(wave);
    const enemy = running.waveMembers.get(1)[0];
    running.world.get(enemy, 'Health').hp = 3;
    running.world.get(running.model.game, 'Resources').energy = 27;
    running.changeAttention(1, 0);
    running.selectSpeed(0);
    running.lastSpeed = 3;
    running.baseHp = 82;
    assert.equal(running.saveCurrentGame(), true);
    const worldBefore = running.world.serialize();
    const unitsBefore = [...running.battleUnits];
    const waveBefore = JSON.stringify(running.waveClock);

    const resumed = new VNextScene();
    resumed.init({ resume: true });
    resumed.create();
    assert.deepEqual(resumed.world.serialize(), worldBefore);
    assert.deepEqual(resumed.battleUnits, unitsBefore);
    assert.equal(JSON.stringify(resumed.waveClock), waveBefore);
    assert.equal(resumed.world.get(enemy, 'Health').hp, 3);
    assert.equal(resumed.world.get(resumed.model.game, 'Resources').energy, 27);
    assert.equal(resumed.baseHp, 82);
    assert.equal(resumed.speed, 0);
    assert.equal(resumed.lastSpeed, 3);
    assert.equal(resumed.visionRules.patternIndex, running.visionRules.patternIndex);
    assert.equal(resumed.attention.x, running.attention.x);
    assert.equal(JSON.stringify([...resumed.waveMembers]), JSON.stringify([...running.waveMembers]));
    assert.equal(resumed.previewWaves[0].number, 2);
    assert.equal(resumed.world.nextId, running.world.nextId);
    savedEntries.clear();
});

test('Continue preserves a military unit cycle without early resource debit', () => {
    savedEntries.clear();
    const running = new VNextScene();
    running.create();
    running.selectedType = 'barracks';
    running.clickTile(6);
    assert.equal(running.world.get(running.model.tiles[6], 'Watched').active, true);
    const barracks = preview.buildingAt(running.model, 6);
    const resources = running.world.get(running.model.game, 'Resources');
    resources.components = 25;
    resources.energy = 15;
    assert.deepEqual(economy.step(running.model, 2750), []);
    assert.equal(running.world.get(barracks, 'Production').elapsedMs, 2750);
    assert.equal(resources.components, 25);
    assert.equal(running.saveCurrentGame(), true);

    const resumed = new VNextScene();
    resumed.init({ resume: true });
    resumed.create();
    const restored = resumed.world.get(barracks, 'Production');
    assert.equal(restored.elapsedMs, 2750);
    assert.equal(restored.cooldownMs, 5000);
    const balance = resumed.world.get(resumed.model.game, 'Resources');
    assert.equal(balance.components, 25);
    assert.deepEqual(economy.step(resumed.model, 2249), []);
    assert.equal(balance.components, 25);
    const events = economy.step(resumed.model, 1);
    assert.equal(events.length, 1);
    assert.equal(events[0].unitType, 'unit_guard');
    assert.equal(balance.components, 0);
    assert.equal(balance.energy, 0);
    assert.equal(restored.elapsedMs, 0);
    savedEntries.clear();
});

test('pending reward is resumed without replaying the cleared wave', () => {
    savedEntries.clear();
    const running = new VNextScene();
    running.create();
    running.waveClock.seed = Array.from({length:100},(_,i)=>i).find(seed=>rewards.mode(1,seed).join()==='building');
    const wave = waves.wave(1, running.waveClock.seed);
    running.waveClock.number = 1;
    running.waveClock.elapsedMs = wave.dueAtMs;
    running.triggerWave(wave);
    running.waveMembers.get(1).forEach(id => { running.world.get(id, 'Health').hp = 0; });
    running.checkWaveClears();
    assert.equal(running.activeReward.number, 1);
    const options = [...running.activeReward.options];
    assert.doesNotThrow(() => saves.restore(saves.capture(running), World));

    const resumed = new VNextScene();
    resumed.init({ resume: true });
    resumed.create();
    assert.equal(resumed.activeReward.number, 1);
    assert.deepEqual([...resumed.activeReward.options], options);
    assert.equal(resumed.waveMembers.size, 0);
    const before = cards.cards(resumed.model).length;
    assert.equal(resumed.chooseReward(options[0]), true);
    assert.equal(cards.cards(resumed.model).length, before + 1);
    assert.equal(resumed.chooseReward(options[0]), false);
    const after = new VNextScene();
    after.init({ resume: true });
    after.create();
    assert.equal(after.activeReward, null);
    assert.equal(cards.cards(after.model).length, before + 1);
    savedEntries.clear();
});

test('autosave uses real time even while paused; menu return immediately saves', () => {
    savedEntries.clear();
    const scene = new VNextScene();
    scene.create();
    scene.selectSpeed(0);
    const timeBefore = scene.waveClock.elapsedMs;
    scene.world.get(scene.model.game, 'Resources').energy = 17;
    scene.update(0, saves.AUTOSAVE_MS);
    assert.equal(saves.read(saveStorage).world.entities
        .find(entity => entity.id === scene.model.game).components
        .find(([kind]) => kind === 'Resources')[1].energy, 17);
    assert.equal(scene.waveClock.elapsedMs, timeBefore);
    let next = null;
    scene.scene.start = key => { next = key; };
    scene.world.get(scene.model.game, 'Resources').energy = 39;
    scene.returnToMenu();
    assert.equal(next, 'MainMenuScene');
    assert.equal(saves.restore(saves.read(saveStorage), World)
        .model.world.get(scene.model.game, 'Resources').energy, 39);
    savedEntries.clear();
});

test('invalid Continue returns to menu instead of silently starting a fresh game', () => {
    savedEntries.clear();
    saveStorage.setItem(saves.KEY, '{"version":999}');
    const scene = new VNextScene();
    let destination = null;
    scene.scene.start = key => { destination = key; };
    scene.init({ resume: true });
    scene.create();
    assert.equal(destination, 'MainMenuScene');
    assert.equal(scene.model, undefined);
    savedEntries.clear();
});

test('reusing VNextScene after defeat starts a fresh world without returning to menu', () => {
    savedEntries.clear();
    const scene = new VNextScene();
    scene.init({ resume: false });
    scene.create();
    const firstWorld = scene.world;
    scene.baseHp = 0;
    scene.finishRun();
    assert.equal(scene.runFinished, true);
    assert.equal(saves.read(saveStorage), null);

    // Phaser destroys its display list on shutdown but reuses the Scene instance.
    // The old status Text has no backing frame anymore: touching setText must fail.
    const oldBattleStatus = scene.battleStatus;
    scene.ui.forEach(object => object.destroy());
    assert.equal(oldBattleStatus.destroyed, true);
    oldBattleStatus.setText = () => { throw new Error('setText on a destroyed Phaser Text'); };

    let redirectedToMenu = false;
    scene.scene.start = key => { if (key === 'MainMenuScene') redirectedToMenu = true; };
    scene.init({ resume: false }); // Payload sent by MainMenuScene after defeat.
    assert.doesNotThrow(() => scene.create()); // Same Phaser scene instance; no page refresh.
    assert.notEqual(scene.battleStatus, oldBattleStatus);
    assert.equal(scene.battleStatus.destroyed, undefined);
    assert.match(scene.battleStatus.value, /Alliés 3/);
    assert.equal(redirectedToMenu, false);
    assert.equal(scene.resumeRequested, false);
    assert.equal(scene.runFinished, false);
    assert.notEqual(scene.world, firstWorld);
    assert.equal(scene.baseHp, 100);
    assert.equal(scene.waveClock.number, 0);
    assert.ok(saves.read(saveStorage), 'the new run must have a valid fresh save');
    savedEntries.clear();
});

test('base destruction clears only the run and prevents another autosave', () => {
    savedEntries.clear();
    saveStorage.setItem('unlockedTalents', '["root"]');
    saveStorage.setItem('memoryShards', '8');
    const scene = new VNextScene();
    scene.create();
    assert.ok(saves.read(saveStorage));
    scene.baseHp = 0;
    scene.update(0, 16);
    assert.equal(scene.runFinished, true);
    assert.equal(saves.read(saveStorage), null);
    assert.equal(saveStorage.getItem('unlockedTalents'), '["root"]');
    assert.equal(saveStorage.getItem('memoryShards'), '8');
    assert.ok(scene.ui.some(object => object.value === 'BASE DÉTRUITE'));
    scene.update(16, saves.AUTOSAVE_MS);
    assert.equal(saves.read(saveStorage), null);
    savedEntries.clear();
});

test('combat hits drive a renderer-only recoil/flash and pause freezes the animation', () => {
    const scene = new VNextScene();
    scene.create();
    const defender = scene.battleUnits[0];
    scene.spawnEnemyUnit('basic_monster', 0, 1);
    const attacker = scene.battleUnits.at(-1);
    const defenderPos = scene.world.get(defender, 'Position');
    const attackerPos = scene.world.get(attacker, 'Position');
    attackerPos.x = defenderPos.x + 10;
    attackerPos.y = defenderPos.y;
    scene.world.get(attacker, 'Combat').elapsedMs = 1000;

    scene.update(0, 16);
    assert.ok(scene.world.get(defender, 'Health').hp < scene.world.get(defender, 'Health').maxHp);
    // Separation is an existing combat rule and may legitimately move ECS coordinates.
    // Only the presentation offset is held outside ECS.
    const reaction = scene.hitEffects.view(defender);
    assert.ok(reaction.x < 0, 'the defender recoils away from the attacker');
    assert.ok(reaction.flash > 0);

    scene.selectSpeed(0); // Rebuilds the Phaser Graphics panel, not transient FX state.
    scene.update(0, 200);
    assert.deepEqual(scene.hitEffects.view(defender), reaction);
    assert.ok(Number.isFinite(scene.world.get(defender, 'Position').x));
});

test('all allied unit types render distinctive colors and silhouettes, including spawned units', () => {
    const scene = new VNextScene();
    scene.create();
    scene.spawnFriendlyUnit('unit_mecha');
    scene.paintBattle();
    const types = ['unit_guard', 'unit_sniper', 'unit_mecha', 'unit_dronoid'];
    const observed = types.map(type => {
        const id = scene.battleUnits.find(id => scene.world.get(id, 'PreviewUnit')?.type === type);
        assert.ok(id, `Missing ${type}`);
        return scene.battleUnitStyle(id);
    });
    assert.equal(new Set(observed.map(x => x.color)).size, 4);
    assert.equal(new Set(observed.map(x => x.shape)).size, 4);
    for (const style of observed) {
        assert.ok(scene.battleGraphics.drawCalls.some(call => call.color === style.color),
            `No rendered stroke for ${style.shape}`);
    }
});

test('ranged attack emits a laser and HitEffects from one confirmed hit, without delayed damage', () => {
    const scene = new VNextScene();
    scene.create();
    scene.spawnEnemyUnit('basic_monster', 0, 1);
    const enemy = scene.battleUnits.at(-1);
    const sniper = scene.battleUnits.find(id =>
        scene.world.get(id, 'PreviewUnit')?.type === 'unit_sniper');
    const sniperPosition = scene.world.get(sniper, 'Position');
    Object.assign(scene.world.get(enemy, 'Position'), { x: sniperPosition.x + 20, y: sniperPosition.y });
    scene.world.get(sniper, 'Combat').elapsedMs = 5000;
    const before = scene.world.get(enemy, 'Health').hp;
    scene.update(0, 16);

    assert.ok(scene.world.get(enemy, 'Health').hp < before);
    const beam = scene.actionEffects.visuals().find(effect => effect.kind === 'laser');
    assert.ok(beam, 'the renderer receives a laser on a ranged attack');
    assert.equal(beam.color, battleStyles.styleFor('unit_sniper', 'player').color);
    assert.equal(scene.hitEffects.fragments()[0].color, battleStyles.styleFor('basic_monster', 'enemy').color);
    assert.ok(scene.battleActionGraphics.drawCalls.some(call => call.type === 'lineBetween'));
    const paused = scene.actionEffects.visuals();
    scene.selectSpeed(0);
    scene.update(0, 250);
    assert.deepEqual(scene.actionEffects.visuals(), paused);
});

test('reward overlay shields the whole game and rejects input until a reward is chosen', () => {
    const scene = new VNextScene();
    scene.create();
    const paletteBefore = scene.ui.find(o => o.getData?.('palette') === 'reactor');
    scene.onDragStart({ x: 20, y: 20 }, paletteBefore);
    assert.ok(scene.dragGhost, 'drag can begin before the reward appears');

    scene.activeReward = { number: 1, options: ['factory', 'barracks', 'extractor'] };
    scene.selectedType = 'reactor';
    scene.buildUi();
    const blocker = scene.ui.find(o => o.getData?.('rewardBlocker') === true);
    assert.ok(blocker, 'an interactive screen-sized zone shields the UI');
    assert.equal(blocker.interactive, true);
    assert.equal(blocker.depth, 301);
    assert.equal(blocker.width, scene.scale.width);
    assert.equal(blocker.height, scene.scale.height);
    const rewardZone = scene.ui.find(o => o.getData?.('reward') === 'barracks');
    assert.ok(rewardZone);
    assert.ok(rewardZone.depth > blocker.depth, 'reward cards remain clickable above the shield');

    const handBefore = cards.cards(scene.model);
    const attentionBefore = { ...scene.attention };
    const patternBefore = scene.visionRules.patternIndex;
    const speedBefore = scene.speed;
    const backgroundPalette = scene.ui.find(o => o.getData?.('palette') === 'reactor');
    scene.clickTile(6);
    backgroundPalette.handlers.pointerdown();
    scene.onKey({ code: 'KeyD', key: 'd' });
    scene.onKey({ code: 'KeyE', key: 'e' });
    scene.onKey({ code: 'Digit5', key: '5' });
    scene.onDragStart({ x: 20, y: 20 }, backgroundPalette);
    scene.onDragEnd({
        x: scene.gridLayout.x + scene.gridLayout.cell * 1.5,
        y: scene.gridLayout.y + scene.gridLayout.cell * 1.5
    }, backgroundPalette);
    assert.equal(preview.buildingAt(scene.model, 6), null);
    assert.deepEqual(cards.cards(scene.model), handBefore);
    assert.deepEqual({ ...scene.attention }, attentionBefore);
    assert.equal(scene.visionRules.patternIndex, patternBefore);
    assert.equal(scene.speed, speedBefore);
    assert.equal(scene.dragGhost, null, 'the pending drag must be cancelled');
    assert.equal(scene.activeReward.number, 1);

    rewardZone.handlers.pointerdown();
    assert.equal(scene.activeReward, null);
    assert.equal(cards.cards(scene.model).length, handBefore.length + 1);
    assert.equal(scene.ui.some(o => o.getData?.('rewardBlocker') === true), false);
    scene.selectedType = 'reactor';
    scene.clickTile(6);
    assert.ok(preview.buildingAt(scene.model, 6), 'construction works again after choosing');
});

test('dead combat units are reclaimed without losing wave rewards or resumable saves', () => {
    savedEntries.clear();
    const scene = new VNextScene();
    scene.create();
    scene.waveClock.seed = Array.from({length:100},(_,i)=>i).find(seed=>rewards.mode(1,seed).join()==='building');
    scene.waveClock.number = 1;
    scene.triggerWave(waves.wave(1, scene.waveClock.seed));
    const enemies = [...scene.waveMembers.get(1)];
    const ally = scene.battleUnits.find(id => scene.world.get(id, 'Faction').side === 'player');
    const originalUnitCount = scene.battleUnits.length;
    scene.world.get(enemies[0], 'Health').hp = 0;
    scene.world.get(ally, 'Health').hp = 0;

    scene.update(0, 16);
    assert.equal(scene.world.has(enemies[0]), false);
    assert.equal(scene.world.has(ally), false);
    assert.equal(scene.battleUnits.length, originalUnitCount - 2);
    assert.deepEqual([...scene.waveMembers.get(1)], enemies.slice(1));
    assert.equal(scene.activeReward, null, 'a partially defeated wave stays active');

    assert.equal(scene.saveCurrentGame(), true);
    const partialSave = saves.read(saveStorage);
    assert.ok(partialSave, 'dead units must not leave dangling IDs in the save');
    const partialRun = saves.restore(partialSave, World);
    assert.deepEqual(partialRun.waveMembers.get(1), enemies.slice(1));
    assert.equal(partialRun.model.world.has(enemies[0]), false);
    assert.equal(partialRun.model.world.has(ally), false);

    for (const id of enemies.slice(1)) scene.world.get(id, 'Health').hp = 0;
    scene.update(16, 16);
    assert.equal(scene.waveMembers.size, 0, 'empty membership means the wave is cleared');
    assert.equal(scene.activeReward.number, 1);
    assert.equal(scene.battleUnits.length, originalUnitCount - enemies.length - 1);
    const completeSave = saves.read(saveStorage);
    assert.ok(completeSave, 'the reward save contains no destroyed entity references');
    assert.equal(saves.restore(completeSave, World).activeReward.number, 1);
    scene.chooseReward(scene.activeReward.options[0]);
    assert.equal(scene.activeReward, null);
    savedEntries.clear();
});

test('a produced repair drone emits a healing beam and target halo, without hit recoil', () => {
    const scene = new VNextScene();
    scene.create();
    scene.spawnFriendlyUnit('unit_dronoid');
    const healer = scene.battleUnits.at(-1);
    assert.equal(scene.world.get(healer, 'Combat').behavior, 'healer');
    const guard = scene.battleUnits.find(id =>
        scene.world.get(id, 'PreviewUnit')?.type === 'unit_guard');
    scene.world.get(guard, 'Health').hp = 2;
    const healerPos = scene.world.get(healer, 'Position');
    Object.assign(scene.world.get(guard, 'Position'),
        { x: healerPos.x + 10, y: healerPos.y });
    scene.world.get(healer, 'Combat').elapsedMs = 5000;
    const before = scene.world.get(guard, 'Health').hp;
    scene.update(0, 16);

    assert.ok(scene.world.get(guard, 'Health').hp > before);
    const healing = scene.actionEffects.visuals().find(visual => visual.kind === 'heal');
    assert.ok(healing, 'the actual ECS heal event emits a visible effect');
    assert.equal(healing.color, battleStyles.styleFor('unit_dronoid', 'player').color);
    assert.ok(scene.battleActionGraphics.drawCalls.some(call =>
        call.type === 'strokeCircle' && call.color === healing.color));
    assert.deepEqual(scene.hitEffects.view(guard), { x: 0, y: 0, flash: 0 });
    assert.equal(scene.hitEffects.fragments().length, 0);
});

test('laboratory research appears as draggable one-shot card and invalid drop preserves inventory',()=>{
 const scene=new VNextScene();scene.create();
 const id=preview.placeBuilding(scene.model,'laboratory',6);
 preview.setObserved(scene.model,[6]);
 technologies.step(scene.model,technologies.RESEARCH_MS);
 scene.buildUi();
 const card=scene.ui.find(o=>o.getData?.('technology')==='healing_field');
 assert.ok(card,'researched card in technology panel');
 scene.onDragEnd({x:-4,y:-4},card);
 assert.equal(technologies.inventory(scene.model).items.length,1);
 const b=scene.battleBounds;
 scene.onDragEnd({x:b.x+b.w/2,y:b.y+b.h/2},card);
 assert.equal(technologies.inventory(scene.model).items.length,0);
 assert.equal(scene.world.query('TechnologyZone').length,1);
});

test('observed laboratory displays live research progress and a technology after one cycle', () => {
    const scene = new VNextScene(); scene.create();
    const laboratory = preview.placeBuilding(scene.model, 'laboratory', 6);
    preview.setObserved(scene.model, [6]);
    scene.update(0,60);
    assert.ok(scene.world.hasComponent(laboratory, 'Research'));
    scene.world.get(laboratory, 'Research').elapsedMs = technologies.RESEARCH_MS - 60;
    scene.update(0,60);
    assert.equal(technologies.inventory(scene.model).items.length,1);
    assert.ok(scene.ui.some(o => o.getData?.('technology') === 'healing_field'));
});



test('wave rewards mix one-shot technology and buildings, preserve save/restore',()=>{
 const scene=new VNextScene();scene.create();
 const choices=new Set();for(let n=1;n<=80;n++)for(const type of scene.rewardOptions(n))choices.add(type);
 assert.equal(scene.rewardOptions(1,'technology').length,3);
 assert.ok(scene.rewardOptions(1,'technology').every(type=>technologies.TYPES.includes(type.slice(5))));
  assert.ok(choices.has('reactor'));
 scene.waveClock.number=1;scene.activeReward={number:1,options:['reactor','factory','tech:healing_field']};
 assert.doesNotThrow(()=>saves.restore(saves.capture(scene),World));
 const before=technologies.inventory(scene.model).items.length;
 assert.equal(scene.chooseReward('tech:healing_field'),true);
 assert.equal(technologies.inventory(scene.model).items.length,before+1);
 assert.equal(scene.chooseReward('tech:healing_field'),false);
});


test('mixed legacy reward save can still choose either a building or a technology', () => {
    const scene = new VNextScene();
    scene.create();
    scene.waveClock.number = 1;
    scene.activeReward = { number: 1, options: ['reactor', 'factory', 'tech:healing_field'] };
    const legacy = saves.restore(saves.capture(scene), World);
    assert.deepEqual(legacy.activeReward.options, scene.activeReward.options);
    assert.equal(rewards.current(scene.activeReward).kind, 'mixed');
    const before = cards.cards(scene.model).length;
    assert.equal(scene.chooseReward('reactor'), true);
    assert.equal(cards.cards(scene.model).length, before + 1);
    assert.equal(scene.activeReward, null);
});

test('reward journey routes building then technology without resuming between stages',()=>{
 const scene=new VNextScene();scene.create();scene.waveClock.number=1;
 const reward={number:1,stages:[{kind:'building',options:['reactor','factory','barracks']},{kind:'technology',options:['tech:healing_field','tech:berserk','tech:stasis_field']}],index:0,options:['reactor','factory','barracks']};
 scene.activeReward=reward;
 const before=cards.cards(scene.model).length;
 assert.equal(scene.chooseReward('reactor'),true);
 assert.equal(cards.cards(scene.model).length,before+1);
 assert.equal(scene.activeReward.index,1);
 assert.equal(scene.chooseReward('factory'),false);
 const saved=saves.capture(scene);
 const restored=saves.restore(saved,World);
 assert.equal(restored.activeReward.index,1);
 assert.equal(restored.activeReward.options[0],'tech:healing_field');
 assert.equal(scene.chooseReward('tech:berserk'),true);
 assert.equal(scene.activeReward,null);
 assert.equal(technologies.inventory(scene.model).items.includes('berserk'),true);
});
test('reward distribution approximates 40/40/20 deterministically',()=>{
 const rewardSystem=require('../src/core/VNextRewards.js'),count={building:0,technology:0,both:0};
 for(let n=1;n<=1000;n++){if(n%10===0)continue;const mode=rewardSystem.mode(n,137);count[mode.length===2?'both':mode[0]]++;}
 assert.ok(Math.abs(count.building-360)<80);
 assert.ok(Math.abs(count.technology-360)<80);
 assert.ok(Math.abs(count.both-180)<70);
 for(const seed of [0,13,137,981,4294967295]) {
  assert.deepEqual(rewardSystem.mode(10,seed),['building','technology']);
  assert.deepEqual(rewardSystem.mode(20,seed),['building','technology']);
 }
});


test('technology inventory hover explains each effect and cleans up on drag and resize', () => {
    const scene = new VNextScene();
    scene.create();
    technologies.inventory(scene.model).items.push('healing_field', 'berserk', 'stasis_field');
    scene.buildUi();
    for (const [type, expected] of [
        ['healing_field', '+1 PV toutes les 2 s'],
        ['berserk', "Cadence d'attaque : +50 %"],
        ['stasis_field', 'Vitesse : -50 %']
    ]) {
        const card = scene.ui.find(o => o.getData?.('technology') === type);
        assert.ok(card, type + ' appears in inventory');
        card.handlers.pointerover();
        assert.ok(scene.technologyTooltipObjects.some(o => o.value === expected), expected);
        const previous = [...scene.technologyTooltipObjects];
        card.handlers.pointerout();
        assert.equal(scene.technologyTooltipObjects.length, 0);
        assert.ok(previous.every(o => o.destroyed));
    }
    const card = scene.ui.find(o => o.getData?.('technology') === 'berserk');
    card.handlers.pointerover();
    scene.onDragStart({ x: 15, y: 15 }, card);
    assert.equal(scene.technologyTooltipObjects.length, 0);
    scene.dragGhost.destroy(); scene.dragGhost = null;
    scene.showTechnologyTooltip('stasis_field', 900, 200);
    const old = [...scene.technologyTooltipObjects];
    scene.scale.width = 800;
    scene.buildUi();
    assert.ok(old.every(o => o.destroyed));
});

test('technology reward hover displays effect details above the reward overlay', () => {
    const scene = new VNextScene();
    scene.create();
    scene.activeReward = { number: 1, options: ['tech:healing_field', 'tech:berserk', 'tech:stasis_field'] };
    scene.buildUi();
    for (const [type, expected] of [
        ['tech:healing_field', 'RÉGÉNÉRATION'],
        ['tech:berserk', 'BERSERK'],
        ['tech:stasis_field', 'STASE']
    ]) {
        const card = scene.ui.find(o => o.getData?.('reward') === type);
        assert.ok(card);
        card.handlers.pointerover();
        assert.ok(scene.technologyTooltipObjects.some(o => o.value === expected && o.depth === 311));
        const old = [...scene.technologyTooltipObjects];
        card.handlers.pointerout();
        assert.ok(old.every(o => o.destroyed));
    }
    scene.ui.find(o => o.getData?.('reward') === 'tech:berserk').handlers.pointerover();
    const old = [...scene.technologyTooltipObjects];
    scene.chooseReward('tech:berserk');
    assert.ok(old.every(o => o.destroyed));
});


test('Surcharge uses a base drop and Surcadencement uses a battlefield drop without wasting invalid casts', () => {
    const scene = new VNextScene();
    scene.create();
    technologies.inventory(scene.model).items.push('overload', 'overclock');
    scene.buildUi();
    const overload = scene.ui.find(o => o.getData?.('technology') === 'overload');
    assert.ok(overload);
    scene.onDragEnd({x:-12,y:-12},overload);
    assert.ok(technologies.inventory(scene.model).items.includes('overload'));
    const l=scene.layout;
    scene.onDragEnd({x:l.boardX+l.boardW/2,y:l.mainTop+110},overload);
    assert.equal(zones.active(scene.model,'overload'),true);
    assert.ok(!technologies.inventory(scene.model).items.includes('overload'));
    const overclock=scene.ui.find(o => o.getData?.('technology') === 'overclock');
    assert.ok(overclock);
    const b=scene.battleBounds;
    scene.onDragEnd({x:b.x+b.w/2,y:b.y+b.h/2},overclock);
    assert.equal(zones.speedMultiplier(scene.model),1.5);
    assert.ok(!technologies.inventory(scene.model).items.includes('overclock'));
    const saved=saves.restore(saves.capture(scene),World);
    assert.equal(zones.speedMultiplier(saved.model),1.5);
});

test('new technologies show accurate tooltips in inventory and reward choice', () => {
    const scene = new VNextScene();
    scene.create();
    technologies.inventory(scene.model).items.push('overclock','overload');
    scene.buildUi();
    for(const [type,expected] of [['overclock','Déplacement : +50 %'],['overload','Production : ×2']]){
        const label=scene.ui.find(o=>o.getData?.('technology')===type);
        assert.ok(label);
        label.handlers.pointerover();
        assert.ok(scene.technologyTooltipObjects.some(o=>o.value===expected));
        label.handlers.pointerout();
    }
    scene.activeReward={number:1,options:['tech:overclock','tech:overload','tech:healing_field']};
    scene.buildUi();
    const reward=scene.ui.find(o=>o.getData?.('reward')==='tech:overload');
    reward.handlers.pointerover();
    assert.ok(scene.technologyTooltipObjects.some(o=>o.value==='SURCHARGE'));
});

test('EMP and Renforts show tooltips, cast through the battlefield and are saved',()=>{
    const scene=new VNextScene();scene.create();
    technologies.inventory(scene.model).items.push('emp_field','reinforcements');
    scene.buildUi();
    for(const [type,title] of [['emp_field','IMPULSION ÉLECTROMAGNÉTIQUE'],['reinforcements','RENFORTS']]){
        const label=scene.ui.find(o=>o.getData?.('technology')===type);
        assert.ok(label,type+' available');
        label.handlers.pointerover();
        assert.ok(scene.technologyTooltipObjects.some(o=>o.value===title));
        label.handlers.pointerout();
    }
    const b=scene.battleBounds;
    const p={x:b.x+b.w/2,y:b.y+b.h/2};
    const emp=scene.ui.find(o=>o.getData?.('technology')==='emp_field');
    scene.onDragEnd({x:-1,y:-1},emp);
    assert.equal(technologies.inventory(scene.model).items.length,2);
    scene.onDragEnd(p,emp);
    const zonesBefore=scene.world.query('TechnologyZone');
    assert.ok(zonesBefore.some(id=>scene.world.get(id,'TechnologyZone').type==='emp_field'));
    const reinforcements=scene.ui.find(o=>o.getData?.('technology')==='reinforcements');
    const before=scene.battleUnits.length;
    scene.onDragEnd(p,reinforcements);
    assert.equal(scene.battleUnits.length,before+1);
    const summoned=scene.battleUnits.find(id=>scene.world.hasComponent(id,'TemporaryAlly'));
    assert.ok(summoned);
    assert.equal(scene.world.get(summoned,'TemporaryAlly').remainingMs,25000);
    const saved=saves.restore(saves.capture(scene),World);
    assert.equal(saved.model.world.get(summoned,'TemporaryAlly').remainingMs,25000);
    // One simulated frame before expiry; no separate wall-clock life counter.
    scene.world.get(summoned,'TemporaryAlly').remainingMs=60;
    scene.update(0,60);
    assert.equal(scene.world.has(summoned),false);
    assert.ok(!scene.battleUnits.includes(summoned));
    assert.doesNotThrow(()=>saves.restore(saves.capture(scene),World));
});

test('seven technology types are eligible for laboratory research and wave rewards',()=>{
    assert.equal(technologies.TYPES.length,7);
    const scene=new VNextScene();scene.create();
    const collected=new Set();
    for(let n=1;n<=180;n++)
        for(const type of scene.rewardOptions(n,'technology'))collected.add(type);
    for(const type of technologies.TYPES)assert.ok(collected.has('tech:'+type),type+' is offered');
    scene.activeReward={number:1,options:['tech:emp_field','tech:reinforcements','tech:overclock']};
    scene.buildUi();
    for(const type of scene.activeReward.options){
        const card=scene.ui.find(o=>o.getData?.('reward')===type);
        assert.ok(card);
        card.handlers.pointerover();
        assert.ok(scene.technologyTooltipObjects.length>0);
        card.handlers.pointerout();
    }
});

test('six artifact slots appear between title and speed controls, including on narrow screens', () => {
    savedEntries.clear();
    const scene = new VNextScene(); scene.create();
    for (const width of [1366, 800]) {
        scene.scale.width = width; scene.buildUi();
        const slots = scene.ui.filter(object => Number.isInteger(object.getData?.('artifactSlot')));
        assert.equal(slots.length, 6);
        const title = scene.ui.find(o => o.value === OverseerVNextBrand.title);
        assert.ok(title);
        const titleSize = width < 1000 ? 16 : 23;
        const titleRight = title.x + (title.width ??
            OverseerVNextBrand.title.length * titleSize * 0.61);
        const firstLeft = slots[0].x - slots[0].width / 2;
        const lastRight = slots[5].x + slots[5].width / 2;
        const speedX = Math.max(330, width - 472);
        assert.ok(firstLeft > titleRight, 'artifact slots must not overlap the title');
        if (width >= 1000) assert.ok(firstLeft - titleRight >= 63, 'leave about 64px after the title');
        assert.ok(lastRight <= speedX - 12, 'artifact slots must not cover speed controls');
        slots[0].handlers.pointerover();
        assert.ok(scene.artifactTooltipObjects.some(item => item.value === 'Emplacement vide'));
        slots[0].handlers.pointerout();
        assert.equal(scene.artifactTooltipObjects.length, 0);
    }
    savedEntries.clear();
});

test('artifact reward follows building/technology, is saved, and remains offerable when full', () => {
    savedEntries.clear();
    const scene = new VNextScene(); scene.create();
    const seed = 812;
    const wave = Array.from({length:120}, (_,i)=>i+3).find(n=>rewards.artifactDrop(n, seed));
    scene.waveClock.seed = seed;
    scene.waveClock.number = wave;
    scene.activeReward = scene.rewardForWave(wave);
    assert.equal(scene.activeReward.stages.at(-1).kind, 'artifact');
    while(rewards.current(scene.activeReward).kind !== 'artifact')
        assert.equal(scene.chooseReward(scene.activeReward.options[0]), true);
    const type = scene.activeReward.options[0];
    const artifactId = type.slice(9);
    assert.equal(scene.chooseReward(type), true);
    assert.deepEqual(artifacts.list(scene.model), [artifactId]);
    const slot = scene.ui.find(item=>item.getData?.('artifactSlot')===0);
    slot.handlers.pointerover();
    assert.ok(scene.artifactTooltipObjects.some(item => item.value === artifacts.get(artifactId).label));
    assert.equal(scene.chooseReward(type), false);
    const resumed = new VNextScene();
    resumed.init({resume:true}); resumed.create();
    assert.deepEqual(artifacts.list(resumed.model), [artifactId]);

    for(const id of artifacts.IDS) artifacts.add(resumed.model,id);
    assert.equal(artifacts.list(resumed.model).length, 6);
    for(let n=3;n<130;n++) {
        const offered = resumed.rewardForWave(n).stages.some(s=>s.kind==='artifact');
        assert.equal(offered,rewards.artifactDrop(n,seed),
            'full inventory still gets an artifact offer at the usual rarity');
    }
    savedEntries.clear();
});

test('an artifact offered by queued rewards is replaced or skipped when previously collected', () => {
    savedEntries.clear();
    const scene = new VNextScene();scene.create();
    const seed = 813;
    scene.waveClock.seed=seed;
    const wavesWithArtifacts=Array.from({length:120}, (_,i)=>i+3).filter(n=>rewards.artifactDrop(n,seed));
    scene.waveClock.number=wavesWithArtifacts.at(-1);
    const first=scene.rewardForWave(wavesWithArtifacts[0]);
    const second=scene.rewardForWave(wavesWithArtifacts[1]);
    scene.activeReward=first;scene.rewardQueue=[second];
    while(scene.activeReward?.number===first.number)
        scene.chooseReward(scene.activeReward.options[0]);
    while(rewards.current(scene.activeReward).kind !== 'artifact')
        scene.chooseReward(scene.activeReward.options[0]);
    const options=scene.activeReward.options;
    assert.ok(options.every(type=>!artifacts.list(scene.model).includes(type.slice(9))));
    for(const id of artifacts.IDS) artifacts.add(scene.model,id);
    scene.reconcileArtifactRewards();
    assert.equal(rewards.current(scene.activeReward).kind,'artifact');
    assert.ok(scene.activeReward.options.every(type =>
        !artifacts.list(scene.model).includes(type.slice(9))));
    const chosen=scene.activeReward.options[0];
    assert.equal(scene.chooseReward(chosen),true);
    assert.equal(scene.activeReward.pendingArtifact,chosen.slice(9));
    assert.equal(scene.declineArtifactReward(),true);
    assert.equal(scene.activeReward,null);
    savedEntries.clear();
});

test('artifact timers persist through Continue, and pause cannot advance a ready laser', () => {
 savedEntries.clear();
 const scene=new VNextScene();scene.create();
 assert.equal(artifacts.add(scene.model,'core_laser'),true);
 artifactEffects.state(scene.model).laserMs=9000;
 assert.equal(scene.saveCurrentGame(),true);
 const resumed=new VNextScene();resumed.init({resume:true});resumed.create();
 assert.equal(artifactEffects.state(resumed.model).laserMs,9000);
 resumed.selectSpeed(0);
 resumed.update(0,4000);
 assert.equal(artifactEffects.state(resumed.model).laserMs,9000);
 savedEntries.clear();
});
test('laser artifact damages a detected enemy and displays a bounded combat effect', () => {
 savedEntries.clear();
 const scene=new VNextScene();scene.create();
 assert.equal(artifacts.add(scene.model,'core_laser'),true);
 artifactEffects.state(scene.model).laserMs=artifactEffects.LASER_MS;
 scene.spawnEnemyUnit('basic_monster',0,1);
 const enemy=scene.battleUnits.at(-1);
 scene.world.get(enemy,'Position').x=135;
 scene.world.get(enemy,'Position').y=300;
 scene.world.get(enemy,'Health').hp=20;
 scene.world.get(enemy,'Health').maxHp=20;
 const before=scene.world.get(enemy,'Health').hp;
 scene.update(0,60);
 assert.equal(scene.world.get(enemy,'Health').hp,before-3);
 assert.ok(scene.actionEffects.visuals().some(v=>v.kind==='laser'&&v.color===0x62e7e1));
 savedEntries.clear();
});
test('artifact shield ring is only visible when the shield has charge', () => {
 savedEntries.clear();
 const scene=new VNextScene();scene.create();
 artifacts.add(scene.model,'shield');
 artifactEffects.startWave(scene.model,1,120,35,economy);
 const damage=artifactEffects.baseHit(scene.model,35,10);
 scene.baseHp=damage.hp;
 scene.paintBattle();
 assert.ok(scene.battleGraphics.drawCalls.some(c=>
  c.type==='strokeCircle'&&c.color===0x69d9a0));
 artifactEffects.state(scene.model).shieldPoints=0;
 scene.paintBattle();
 assert.ok(!scene.battleGraphics.drawCalls.some(c=>
  c.type==='strokeCircle'&&c.color===0x69d9a0));
 savedEntries.clear();
});

test('manufactured soldiers record costs; Recyclage refunds exactly once while starter allies do not', () => {
 savedEntries.clear();
 const scene=new VNextScene();scene.create();
 scene.selectedType='barracks';scene.clickTile(6);
 const stock=scene.world.get(scene.model.game,'Resources');
 stock.energy=15;stock.components=25;
 for(let i=0;i<84;i++)scene.update(0,60);
 const paid=scene.battleUnits.find(id=>scene.world.hasComponent(id,'ManufacturedCost'));
 assert.ok(paid,'real military production must retain its paid provenance');
 assert.deepEqual({...scene.world.get(paid,'ManufacturedCost').resources},{components:25,energy:15});
 assert.equal(stock.components,0);
 assert.equal(artifacts.add(scene.model,'recycle'),true);
 scene.world.get(paid,'Health').hp=0;
 const count=scene.battleUnits.length;
 assert.equal(scene.cleanupDeadUnits(),true);
 assert.equal(scene.battleUnits.length,count-1);
 assert.equal(stock.components,6);
 assert.equal(stock.energy,4);
 assert.equal(scene.cleanupDeadUnits(),false);
 assert.equal(stock.energy,4);
 const starter=scene.battleUnits[0];
 scene.world.get(starter,'Health').hp=0;
 scene.cleanupDeadUnits();
 assert.equal(stock.components,6);
 savedEntries.clear();
});
test('a manufactured unit keeps its refund provenance through Continue', () => {
 savedEntries.clear();
 const scene=new VNextScene();scene.create();
 const id=scene.spawnFriendlyUnit('unit_guard',{type:'unit-produced',unitType:'unit_guard',
  spent:{components:25,energy:15}});
 assert.ok(scene.world.hasComponent(id,'ManufacturedCost'));
 artifacts.add(scene.model,'recycle');
 assert.equal(scene.saveCurrentGame(),true);
 const resumed=new VNextScene();resumed.init({resume:true});resumed.create();
 assert.deepEqual(resumed.world.get(id,'ManufacturedCost').resources,{components:25,energy:15});
 resumed.world.get(id,'Health').hp=0;
 resumed.cleanupDeadUnits();
 const resources=resumed.world.get(resumed.model.game,'Resources');
 assert.equal(resources.components,6);
 assert.equal(resources.energy,4);
 savedEntries.clear();
});
test('a marked enemy killed during combat transfers designation before ECS cleanup', () => {
 savedEntries.clear();
 const scene=new VNextScene();scene.create();
 artifacts.add(scene.model,'mark_chain');
 scene.spawnEnemyUnit('basic_monster',0,1);
 scene.spawnEnemyUnit('basic_monster',1,1);
 const [victim,next]=scene.battleUnits.filter(id=>scene.world.get(id,'Faction').side==='enemy');
 scene.world.get(victim,'Position').x=800;
 scene.world.get(next,'Position').x=810;
 scene.world.set(victim,'ThreatMark',{remainingMs:800});
 scene.world.get(victim,'Health').hp=0;
 scene.cleanupDeadUnits();
 assert.equal(scene.world.has(victim),false);
 assert.equal(scene.world.get(next,'ThreatMark').remainingMs,2000);
 savedEntries.clear();
});

test('network artefact visualises actual adjacent off-vision progress without granting materials', () => {
 savedEntries.clear();
 const scene=new VNextScene();scene.create();
 scene.selectedType='reactor';scene.clickTile(6);
 scene.selectedType='factory';scene.clickTile(7);
 preview.setObserved(scene.model,[6]); // Test the unobserved-neighbor state explicitly.
 assert.equal(artifacts.add(scene.model,'parasite_network'),true);
 for(let i=0;i<34;i++)scene.update(0,60);
 const factory=preview.buildingAt(scene.model,7);
 const progress=scene.world.get(factory,'Production');
 assert.ok(progress.elapsedMs>=600);
 assert.equal(scene.world.get(scene.model.game,'Resources').components,0);
 assert.ok(scene.productionPopups.some(p=>p.label.value.includes('%')));
 const before=progress.elapsedMs;
 scene.selectSpeed(0);
 scene.update(0,5000);
 assert.equal(progress.elapsedMs,before);
 savedEntries.clear();
});
test('terminal laser discharge adds only two visible bolts to living nearby enemies', () => {
 savedEntries.clear();
 const scene=new VNextScene();scene.create();
 artifacts.add(scene.model,'core_laser');artifacts.add(scene.model,'terminal_overload');
 const ids=[];
 for(let i=0;i<4;i++){
  scene.spawnEnemyUnit('basic_monster',i,4);
  const id=scene.battleUnits.at(-1);
  scene.world.get(id,'Position').x=230+i*12;
  scene.world.get(id,'Position').y=300;
  scene.world.get(id,'Health').hp=i===0?3:10;
  scene.world.get(id,'Health').maxHp=10;
  ids.push(id);
 }
 artifactEffects.state(scene.model).laserMs=artifactEffects.LASER_MS;
 scene.update(0,60);
 assert.equal(scene.world.has(ids[0]),false,'the victim has been reclaimed by the ECS');
 assert.equal(scene.world.get(ids[1],'Health').hp,8);
 assert.equal(scene.world.get(ids[2],'Health').hp,8);
 assert.equal(scene.world.get(ids[3],'Health').hp,10);
 assert.equal(scene.actionEffects.visuals().filter(v=>v.kind==='laser'&&v.color===0x62e7e1).length,3);
 savedEntries.clear();
});
test('vital transfer heals an injured ally through ECS death cleanup and draws support beam', () => {
 savedEntries.clear();
 const scene=new VNextScene();scene.create();
 artifacts.add(scene.model,'vital_transfer');
 const [victim,ally]=scene.battleUnits;
 const injured=scene.world.get(ally,'Health');
 injured.hp=injured.maxHp/2;
 scene.world.get(victim,'Health').hp=0;
 const before=injured.hp;
 assert.equal(scene.cleanupDeadUnits(),true);
 assert.equal(injured.hp,Math.min(injured.maxHp,before+injured.maxHp*0.3));
 assert.ok(scene.actionEffects.visuals().some(e=>e.kind==='heal'));
 assert.equal(scene.cleanupDeadUnits(),false);
 savedEntries.clear();
});
test('terminal overload is absent from reward proposals until core laser is equipped', () => {
 savedEntries.clear();
 const scene=new VNextScene();scene.create();
 const before=artifacts.available(scene.model);
 assert.equal(before.includes('terminal_overload'),false);
 const optionsBefore=new Set();
 for(let n=3;n<200;n++){
  const reward=scene.rewardForWave(n);
  for(const stage of reward.stages.filter(s=>s.kind==='artifact'))
   for(const opt of stage.options)optionsBefore.add(opt);
 }
 assert.equal(optionsBefore.has('artifact:terminal_overload'),false);
 artifacts.add(scene.model,'core_laser');
 const after=new Set();
 for(let n=3;n<200;n++){
  const reward=scene.rewardForWave(n);
  for(const stage of reward.stages.filter(s=>s.kind==='artifact'))
   for(const opt of stage.options)after.add(opt);
 }
 assert.equal(after.has('artifact:terminal_overload'),true);
 savedEntries.clear();
});

test('perception amplifier renders a circular radar centered on the core and hides the normal ring',()=>{
    savedEntries.clear();
    const scene=new VNextScene();scene.create();
    assert.equal(threats.radius(scene.model),350);
    assert.ok(cards.REWARD_CARDS.includes('perception_amplifier'));
    const id=preview.placeBuilding(scene.model,'perception_amplifier',6);
    preview.setObserved(scene.model,[6]);
    scene.buildUi();
    const b=scene.battleBounds;
    const graphics=()=>scene.battleGraphics;
    const baseX=b.x+b.w*65/1000,baseY=b.y+b.h*300/600;
    const tinted=scene.detectionColor();
    const rings=()=>graphics().drawCalls.filter(call=>call.type==='strokeCircle'&&call.color===tinted);
    const edge=Math.hypot(Math.max(baseX-b.x,b.x+b.w-baseX),
                          Math.max(baseY-b.y,b.y+b.h-baseY))+8;
    assert.equal(rings().length,0,'no permanent ring or radar wave at the start of a sweep');
    scene.world.set(scene.model.game,'PerceptionPulse',{phaseMs:2500});
    scene.paintBattle();
    assert.equal(rings().length,2,'one circle with a subtle glow, no second detection ring');
    assert.equal(graphics().drawCalls.filter(call=>call.type==='strokeEllipse').length,0);
    for(const ring of rings()){
        assert.ok(Math.abs(ring.x-baseX)<1e-6);
        assert.ok(Math.abs(ring.y-baseY)<1e-6);
        assert.ok(Math.abs(ring.r-edge/2)<1e-6);
    }
    assert.equal(graphics().mask,scene.battleMask,'the existing battlefield mask clips the circular wave');
    scene.world.set(scene.model.game,'PerceptionPulse',{phaseMs:4950});
    scene.paintBattle();
    assert.ok(rings().at(-1).r>Math.hypot(Math.max(baseX-b.x,b.x+b.w-baseX),
                Math.max(baseY-b.y,b.y+b.h-baseY)), 'the wave exits the panel at the end');
    scene.selectSpeed(0);
    const phase=scene.world.get(scene.model.game,'PerceptionPulse').phaseMs;
    scene.update(0,300);
    assert.equal(scene.world.get(scene.model.game,'PerceptionPulse').phaseMs,phase);
    scene.selectSpeed(1);
    preview.setObserved(scene.model,[]);
    scene.paintBattle();
    assert.equal(threats.radius(scene.model),350);
    assert.equal(rings().length,1,'the normal range reappears only when the amplifier is inactive');
    assert.ok(Math.abs(rings()[0].r-350*b.w/1000)<1e-6);
    assert.equal(scene.world.has(id),true);
    const saved=saves.restore(saves.capture(scene),World);
    assert.equal(saved.model.world.get(saved.model.game,'PerceptionPulse').phaseMs,phase);
    savedEntries.clear();
});

test('detection and radar rings follow a lighter version of the current core HP color',()=>{
    savedEntries.clear();
    const scene=new VNextScene();scene.create();
    const amp=preview.placeBuilding(scene.model,'perception_amplifier',6);
    preview.setObserved(scene.model,[]); // The initial attention may already cover slot 6.
    const colors=[[100,0x48b8c4],[55,0xf0ba60],[20,0xff6674]];
    const light=color=>{
        const channel=n=>Math.round(n+(255-n)*0.35);
        return (channel((color>>16)&255)<<16) |
            (channel((color>>8)&255)<<8) | channel(color&255);
    };
    for(const [hp,coreColor] of colors){
        scene.baseHp=hp;
        scene.paintBattle();
        assert.equal(scene.baseHealthColor(),coreColor);
        const lighter=light(coreColor);
        assert.equal(scene.detectionColor(),lighter);
        const passiveRadius=threats.radius(scene.model)*scene.battleBounds.w/1000;
        assert.ok(scene.battleGraphics.drawCalls.some(c=>
            c.type==='strokeCircle'&&c.color===lighter&&
            Math.abs(c.r-passiveRadius)<1e-6));
        preview.setObserved(scene.model,[6]);
        scene.world.set(scene.model.game,'PerceptionPulse',{phaseMs:2500});
        scene.paintBattle();
        assert.equal(scene.battleGraphics.drawCalls.filter(c=>
            c.type==='strokeCircle'&&c.color===lighter&&c.r>0).length,2);
        assert.equal(scene.battleGraphics.drawCalls.filter(c=>
            c.type==='strokeEllipse').length,0);
        preview.setObserved(scene.model,[]);
    }
    assert.equal(scene.world.has(amp),true);
    savedEntries.clear();
});

test('amplifier can be chosen in wave building rewards and describes the pulse',()=>{
    const scene=new VNextScene();scene.create();
    scene.waveClock.number=1;
    scene.activeReward={number:1,options:['reactor','perception_amplifier','factory']};
    scene.buildUi();
    const card=scene.ui.find(o=>o.getData?.('reward')==='perception_amplifier');
    assert.ok(card);
    card.handlers.pointerover();
    assert.ok(scene.tooltipObjects.some(o=>o.value==='RADAR : BALAYAGE DU CHAMP ENTIER'));
    card.handlers.pointerout();
    assert.equal(scene.chooseReward('perception_amplifier'),true);
    assert.ok(cards.cards(scene.model).includes('perception_amplifier'));
});

test('Cryopump shows immediate coverage and a cooling tooltip without heat',()=>{
 const scene=new VNextScene();scene.create();
 const pump=preview.placeBuilding(scene.model,'cryopump',7);
 const reactor=preview.placeBuilding(scene.model,'reactor',6);
 preview.setObserved(scene.model,[6,7]);
 scene.buildUi();
 const coverage=cooling.coverage(scene.model);
 assert.deepEqual(coverage,{pumps:1,buildings:1});
 assert.equal(scene.resourceLabels.cooling.value,'1');
 assert.equal(scene.resourceStatusLabels.cooling.value,'1 CRYO');
 cooling.step(scene.model,2000);
 scene.paintBoard();
 assert.equal(cooling.bonus(scene.model,reactor),0.2);
 assert.equal(scene.world.query('BuildingHeat').length,0);
 scene.showBuildingTooltip(7);
 assert.ok(scene.tooltipObjects.some(o=>o.value==='PORTÉE : 8 CASES VOISINES'));
 scene.hideBuildingTooltip();
 preview.setObserved(scene.model,[6]);
 scene.updateResourceHud();
 assert.equal(scene.resourceLabels.cooling.value,'0');
 assert.equal(scene.resourceStatusLabels.cooling.value,'0 CRYO');
 assert.equal(cooling.bonus(scene.model,reactor),0);
 scene.selectSpeed(0);
 scene.update(0,500);
 assert.equal(scene.world.query('BuildingHeat').length,0);
 const resumed=saves.restore(saves.capture(scene),World);
 assert.equal(resumed.model.world.query('BuildingHeat').length,0);
 assert.equal(cooling.bonus(resumed.model,reactor),0);
});

test('Cryopump appears in building reward choices but does not change the starter hand',()=>{
 const scene=new VNextScene();scene.create();
 assert.ok(cards.REWARD_CARDS.includes('cryopump'));
 assert.ok(!cards.STARTER_CARDS.includes('cryopump'));
 scene.waveClock.number=1;
 scene.activeReward={number:1,options:['cryopump','reactor','factory']};
 scene.buildUi();
 const item=scene.ui.find(o=>o.getData?.('reward')==='cryopump');
 assert.ok(item);
 assert.equal(scene.chooseReward('cryopump'),true);
 assert.ok(cards.cards(scene.model).includes('cryopump'));
});

test('Cryopump makes observed perception pulse faster without changing baseline detection',()=>{
 const scene=new VNextScene();scene.create();
 const pump=preview.placeBuilding(scene.model,'cryopump',7);
 const amp=preview.placeBuilding(scene.model,'perception_amplifier',6);
 preview.setObserved(scene.model,[6,7]);
 const old=threats.sweepRadius(scene.model);
 scene.update(0,60);
 const phase=scene.world.get(scene.model.game,'PerceptionPulse').phaseMs;
 assert.equal(phase,72);
 assert.ok(threats.sweepRadius(scene.model)>old);
 assert.equal(threats.radius(scene.model),350);
 preview.setObserved(scene.model,[6]);
 scene.update(0,60);
 assert.equal(scene.world.get(scene.model.game,'PerceptionPulse').phaseMs,132);
 assert.equal(scene.world.has(pump),true);
 assert.equal(scene.world.has(amp),true);
});

test('battlefield hover shows live ally and enemy ECS stats without changing simulation', () => {
    const scene = new VNextScene();
    scene.create();
    const ally = scene.battleUnits.find(id => scene.world.get(id,'PreviewUnit')?.type === 'unit_guard');
    const b = scene.battleBounds;
    const point = id => {
        const pos = scene.world.get(id,'Position');
        return {x:b.x + pos.x*b.w/1000, y:b.y + pos.y*b.h/600};
    };
    const before=scene.world.serialize();
    const zone=scene.battleHoverZone;
    assert.ok(zone.interactive);
    zone.handlers.pointerover(point(ally));
    assert.equal(scene.battleTooltipId,ally);
    assert.match(scene.battleTooltipTitle.value,/DÉFENSEUR.*ALLIÉ/);
    assert.match(scene.battleTooltipBody.value,/Type : unit_guard/);
    assert.match(scene.battleTooltipBody.value,/PV : 5 \/ 5/);
    assert.match(scene.battleTooltipBody.value,/Dégâts : 1.*distance/);
    assert.match(scene.battleTooltipBody.value,/Portée : 30/);
    assert.match(scene.battleTooltipBody.value,/Cadence : 1 s/);
    assert.match(scene.battleTooltipBody.value,/Vitesse : 40/);
    assert.deepEqual(scene.world.serialize(), before, 'hover must never write to ECS');
    const objects=[...scene.battleTooltipObjects];
    scene.world.get(ally,'Health').hp=3;
    scene.paintBattle();
    assert.match(scene.battleTooltipBody.value,/PV : 3 \/ 5/, 'PV are updated while the unit remains hovered');
    assert.equal(scene.battleTooltipObjects.length,objects.length);
    objects.forEach((object,i) => assert.strictEqual(scene.battleTooltipObjects[i],object,
        'a frame must reuse the existing tooltip display objects'));

    scene.spawnEnemyUnit('ranged_monster',0,1);
    const enemy=scene.battleUnits.at(-1);
    // The test fixture gives all enemies melee attacks; use ranged ECS values here.
    scene.world.get(enemy,'Combat').attackType='ranged';
    scene.world.get(enemy,'Combat').cooldownMs=2000;
    zone.handlers.pointermove(point(enemy));
    assert.equal(scene.battleTooltipId,enemy);
    assert.match(scene.battleTooltipTitle.value,/TIREUR DISTANT.*ENNEMI/);
    assert.match(scene.battleTooltipBody.value,/Type : ranged_monster/);
    assert.match(scene.battleTooltipBody.value,/distance/);
    assert.match(scene.battleTooltipBody.value,/Cadence : 2 s/);
    assert.ok(objects.every(o=>o.destroyed),'old tooltip destroyed when target changes');
    zone.handlers.pointerout();
    assert.equal(scene.battleTooltipId,null);
    assert.equal(scene.battleHoverPointer,null);
    assert.equal(scene.battleTooltipObjects.length,0);
});

test('battle unit tooltip shows real buffs, reinforcement lifetime, healing and death cleanup', () => {
    const scene = new VNextScene();
    scene.create();
    const id=scene.battleUnits.find(id => scene.world.get(id,'PreviewUnit')?.type==='unit_dronoid');
    const b=scene.battleBounds;
    const p=scene.world.get(id,'Position');
    const point={x:b.x+p.x*b.w/1000,y:b.y+p.y*b.h/600};
    scene.world.get(id,'Combat').behavior='healer';
    scene.world.set(id,'TechnologyBuff',{type:'berserk',remainingMs:5000});
    zones.cast(scene.model,'overclock',{x:500,y:300});
    scene.battleHoverZone.handlers.pointermove(point);
    assert.match(scene.battleTooltipBody.value,/Soin : 1 · soutien/);
    assert.match(scene.battleTooltipBody.value,/État : Berserk, Surcadencement/);
    assert.match(scene.battleTooltipBody.value,/Vitesse : 60/);
    const temporary=scene.spawnFriendlyUnit('unit_guard');
    scene.world.set(temporary,'TemporaryAlly',{remainingMs:11300});
    const details=scene.battleUnitDescription(temporary);
    assert.match(details.body,/Renfort 12 s/);
    const old=[...scene.battleTooltipObjects];
    scene.world.get(id,'Health').hp=0;
    scene.paintBattle();
    assert.equal(scene.battleTooltipId,null);
    assert.ok(old.every(o=>o.destroyed));
    assert.doesNotThrow(()=>scene.cleanupDeadUnits());
});

test('unit hit testing respects clipping, nearest glyph, overlays and scene rebuilds',()=>{
    const scene=new VNextScene();scene.create();
    const b=scene.battleBounds;
    assert.equal(scene.battleUnitAt(b.x-1,b.y+b.h/2),null);
    const first=scene.battleUnits[0],second=scene.battleUnits[1];
    const p=scene.world.get(first,'Position');
    Object.assign(scene.world.get(second,'Position'),p);
    const pointer={x:b.x+p.x*b.w/1000,y:b.y+p.y*b.h/600};
    assert.equal(scene.battleUnitAt(pointer.x,pointer.y),second,'topmost glyph on exact overlap');
    scene.battleHoverZone.handlers.pointermove(pointer);
    assert.equal(scene.battleTooltipId,second);
    const old=[...scene.battleTooltipObjects];
    scene.activeReward={number:1,options:['reactor']};
    scene.refreshBattleUnitTooltip();
    assert.equal(scene.battleTooltipId,null);
    assert.ok(old.every(o=>o.destroyed));
    scene.activeReward=null;
    scene.battleHoverZone.handlers.pointermove(pointer);
    assert.equal(scene.battleTooltipId,second);
    const before=[...scene.battleTooltipObjects],zone=scene.battleHoverZone;
    scene.buildUi();
    assert.ok(before.every(o=>o.destroyed));
    assert.equal(zone.destroyed,true);
    assert.equal(scene.battleHoverPointer,null);
    assert.notEqual(scene.battleHoverZone,zone);
    const rebuilt=scene.battleBounds;
    const rp={x:rebuilt.x+p.x*rebuilt.w/1000,y:rebuilt.y+p.y*rebuilt.h/600};
    scene.battleHoverZone.handlers.pointermove(rp);
    assert.equal(scene.battleTooltipId,second);
    const graphics=scene.battleTooltipGraphics;
    assert.ok(graphics.x>=rebuilt.x && graphics.x<rebuilt.x+rebuilt.w);
    assert.ok(graphics.y>=rebuilt.y && graphics.y<rebuilt.y+rebuilt.h);
    scene.battleHoverZone.handlers.pointermove({x:rebuilt.x+rebuilt.w-2,y:rebuilt.y+rebuilt.h-2});
    assert.equal(scene.battleTooltipId,null,'moving to empty field hides tooltip');
});

test('clearing a wave immediately grants exactly one persistent shard before the card choice',()=>{
    savedEntries.clear();
    saveStorage.setItem('memoryShards','4');
    const scene=new VNextScene();scene.create();
    const wave=waves.wave(1,scene.waveClock.seed);
    scene.waveClock.number=1;
    scene.triggerWave(wave);
    assert.equal(shards.balance(saveStorage),4,'wave spawn is not a payout');
    const enemyIds=[...scene.waveMembers.get(1)];
    scene.world.get(enemyIds[0],'Health').hp=0;
    scene.checkWaveClears();
    assert.equal(shards.balance(saveStorage),4,'partial wave cannot be credited');
    for(const id of enemyIds)scene.world.get(id,'Health').hp=0;
    scene.checkWaveClears();
    assert.equal(scene.activeReward.number,1);
    assert.equal(shards.balance(saveStorage),5);
    assert.equal(scene.shardLabel.value,'ÉCLATS DE MÉMOIRE  5');
    assert.ok(scene.ui.some(o=>typeof o.value==='string'&&o.value.includes('+1 ÉCLAT DE MÉMOIRE')));
    assert.equal(shards.awarded(scene.model,1),true);
    scene.checkWaveClears();
    assert.equal(shards.balance(saveStorage),5,'no second payout after another update');
    const saved=saves.read(saveStorage);
    assert.ok(saved);
    assert.deepEqual(saves.restore(saved,World).model.world.get(scene.model.game,'WaveShardRewards').claimed,[1]);
    const resumed=new VNextScene();resumed.init({resume:true});resumed.create();
    assert.equal(shards.balance(saveStorage),5);
    assert.equal(shards.awarded(resumed.model,1),true);
    resumed.checkWaveClears();
    assert.equal(shards.balance(saveStorage),5,'Continue cannot duplicate previous payout');
    assert.equal(resumed.shardLabel.value,'ÉCLATS DE MÉMOIRE  5');
    savedEntries.clear();
});
test('memory shards persist across defeat and fresh games without touching talent data',()=>{
    savedEntries.clear();
    saveStorage.setItem('memoryShards','13');
    saveStorage.setItem('unlockedTalents','["root","vision_boost"]');
    const defeated=new VNextScene();defeated.create();
    assert.equal(defeated.shardLabel.value,'ÉCLATS DE MÉMOIRE  13');
    defeated.baseHp=0;
    defeated.update(0,16);
    assert.equal(saves.read(saveStorage),null);
    assert.equal(shards.balance(saveStorage),13);
    assert.equal(saveStorage.getItem('unlockedTalents'),'["root","vision_boost"]');
    const fresh=new VNextScene();fresh.init({resume:false});fresh.create();
    assert.equal(fresh.shardLabel.value,'ÉCLATS DE MÉMOIRE  13');
    assert.equal(shards.balance(saveStorage),13);
    savedEntries.clear();
});


test('all six tooltip families are presentation-only and disposed on UI rebuild', () => {
    savedEntries.clear();
    const scene = new VNextScene();
    scene.create();
    const before = scene.world.serialize();

    scene.showCardTooltip('reactor', 260, 180);
    scene.showTechnologyTooltip('berserk', 330, 240);
    scene.showResourceTooltip(scene.resourceStyles[0], 450, 300);
    scene.showArtifactTooltip(null, 600, 100);
    scene.showWaveTooltip(0, 650, 680);

    const ally = scene.battleUnits.find(id =>
        scene.world.get(id, 'Faction')?.side === 'player');
    const position = scene.world.get(ally, 'Position');
    const bounds = scene.battleBounds;
    scene.onBattleUnitPointer({
        x: bounds.x + position.x * bounds.w / 1000,
        y: bounds.y + position.y * bounds.h / 600
    });
    const groups = [
        scene.tooltipObjects, scene.technologyTooltipObjects,
        scene.artifactTooltipObjects, scene.waveTooltipObjects,
        scene.battleTooltipObjects
    ].map(items => [...items]);
    const resourceTooltip = scene.resourceTooltip;
    assert.ok(groups.every(items => items.length), 'every graphics tooltip is visible');
    assert.ok(resourceTooltip, 'resource tooltip is visible');
    assert.deepEqual(scene.world.serialize(), before, 'hover must not alter ECS state');

    scene.scale.width = 900;
    scene.scale.height = 650;
    const oldMask = scene.battleMask;
    scene.buildUi();
    assert.ok(oldMask.destroyed, 'previous battlefield mask is released');
    assert.ok(groups.flat().every(object => object.destroyed), 'all tooltip displays are released');
    assert.ok(resourceTooltip.destroyed, 'resource tooltip is released');
    assert.deepEqual([
        scene.tooltipObjects.length, scene.technologyTooltipObjects.length,
        scene.artifactTooltipObjects.length, scene.waveTooltipObjects.length,
        scene.battleTooltipObjects.length
    ], [0, 0, 0, 0, 0]);
    assert.equal(scene.resourceTooltip, null);
    assert.equal(scene.battleHoverPointer, null);
    assert.deepEqual(scene.world.serialize(), before, 'UI rebuild must not alter ECS state');
    savedEntries.clear();
});

test('scene shutdown releases battle hover and rendering mask without touching the run', () => {
    savedEntries.clear();
    const scene = new VNextScene();
    const registered = {};
    scene.events.once = (name, callback) => { registered[name] = callback; };
    scene.create();
    assert.equal(typeof registered.shutdown, 'function');
    const before = scene.world.serialize();
    scene.showTechnologyTooltip('stasis_field', 500, 220);
    const techDisplays = [...scene.technologyTooltipObjects];
    const ally = scene.battleUnits.find(id =>
        scene.world.get(id, 'Faction')?.side === 'player');
    const position = scene.world.get(ally, 'Position');
    const bounds = scene.battleBounds;
    scene.onBattleUnitPointer({
        x: bounds.x + position.x * bounds.w / 1000,
        y: bounds.y + position.y * bounds.h / 600
    });
    const battleDisplays = [...scene.battleTooltipObjects];
    const oldMask = scene.battleMask;
    assert.ok(battleDisplays.length);

    registered.shutdown();
    assert.ok(oldMask.destroyed);
    assert.equal(scene.battleMask, null);
    assert.ok([...techDisplays, ...battleDisplays].every(object => object.destroyed));
    assert.equal(scene.battleHoverPointer, null);
    assert.deepEqual(scene.world.serialize(), before);
    savedEntries.clear();
});


test('extracted board view reads ECS and disposes replaced graphics during rebuild', () => {
    const scene = new VNextScene();
    scene.create();
    const before = scene.world.serialize();
    const oldBoard = scene.boardGraphics;
    const oldPalette = scene.paletteGraphics;
    scene.paintBoard();
    scene.refreshPaletteSelection();
    assert.deepEqual(scene.world.serialize(), before, 'board rendering must not change ECS');

    scene.scale.width = 1024;
    scene.scale.height = 720;
    scene.buildUi();
    assert.equal(oldBoard.destroyed, true);
    assert.equal(oldPalette.destroyed, true);
    assert.notStrictEqual(oldBoard, scene.boardGraphics);
    assert.notStrictEqual(oldPalette, scene.paletteGraphics);
    assert.ok(scene.gridLayout.size > 0);
    assert.equal(scene.world.query('Tile').length, 25);
    assert.deepEqual(scene.world.serialize(), before, 'rebuilding the board must not reset a run');
});


test('extracted battle view clips every layer and releases obsolete Phaser objects on resize', () => {
    const scene = new VNextScene();
    scene.create();
    const before = scene.world.serialize();
    scene.paintBattle();
    assert.deepEqual(scene.world.serialize(), before, 'painting must not mutate ECS');
    const oldMask = scene.battleMask;
    const oldLayers = [scene.zoneGraphics, scene.battleGraphics,
        scene.battleParticleGraphics, scene.battleActionGraphics];
    for (const layer of oldLayers) assert.strictEqual(layer.mask, oldMask);

    scene.scale.width = 940;
    scene.scale.height = 680;
    scene.buildUi();
    assert.ok(oldMask.destroyed, 'mask from previous viewport must be destroyed');
    assert.ok(oldLayers.every(layer => layer.destroyed), 'old graphics must be destroyed');
    assert.ok(scene.battleMask);
    assert.notStrictEqual(scene.battleMask, oldMask);
    for (const layer of [scene.zoneGraphics, scene.battleGraphics,
        scene.battleParticleGraphics, scene.battleActionGraphics])
        assert.strictEqual(layer.mask, scene.battleMask);
    assert.deepEqual(scene.world.serialize(), before, 'resizing must not reset combat ECS');

    const newMask = scene.battleMask;
    scene.releaseBattleView();
    assert.ok(newMask.destroyed);
    assert.equal(scene.battleMask, null);
    scene.releaseBattleView(); // Destruction is safe even when called twice.
});


test('extracted HUD and wave timeline repaint without rewriting the ECS world', () => {
    const scene = new VNextScene();
    scene.create();
    const before = scene.world.serialize();
    const previousResourceObjects = Object.values(scene.resourceLabels);
    scene.updateResourceHud();
    scene.updateWaveTimeline();
    scene.paintWaveTimeline();
    assert.deepEqual(scene.world.serialize(), before, 'HUD and timeline must be projections only');
    scene.scale.width = 1000;
    scene.scale.height = 710;
    scene.buildUi();
    assert.ok(previousResourceObjects.every(o => o.destroyed), 'HUD labels are disposed on resize');
    assert.deepEqual(scene.world.serialize(), before, 'HUD rebuild must not replace ECS state');
});

test('extracted reward view never chooses a reward while drawing choices', () => {
    const scene = new VNextScene();
    scene.create();
    scene.activeReward = scene.rewardForWave(1);
    const original = JSON.stringify(scene.activeReward);
    const before = scene.world.serialize();
    scene.buildUi();
    assert.equal(JSON.stringify(scene.activeReward), original);
    assert.deepEqual(scene.world.serialize(), before);
});


test('extracted simulation entry point preserves ECS world when paused and gameplay during play', () => {
    const scene = new VNextScene();
    scene.create();
    const before = scene.world.serialize();
    scene.selectSpeed(0);
    scene.update(0, 4000);
    assert.deepEqual(scene.world.serialize(), before, 'paused simulation must not advance ECS');
    scene.selectSpeed(1);
    scene.update(0, 40);
    assert.ok(scene.waveClock.elapsedMs > 0, 'running simulation still advances wave clock');
});

test('scene can restart on same Phaser instance with extracted run and input handlers', () => {
    const scene = new VNextScene();
    scene.create();
    assert.equal(typeof scene.onDragEnd, 'function');
    assert.equal(typeof scene.triggerWave, 'function');
    assert.equal(typeof scene.update, 'function');
    const oldWorld = scene.world;
    scene.finishRun();
    scene.create();
    assert.notStrictEqual(scene.world, oldWorld);
    assert.equal(scene.runFinished, false);
});

test('defective military production changes the fifth produced unit, not the starter lineup',()=>{
 savedEntries.clear();
 const scene=new VNextScene();scene.create();
 artifacts.add(scene.model,'defective');
 const starters=[...scene.battleUnits];
 for(let i=1;i<=5;i++){
  const id=scene.spawnFriendlyUnit('unit_guard',{type:'unit-produced',unitType:'unit_guard',
   spent:{components:25,energy:15}});
  const health=scene.world.get(id,'Health'),combat=scene.world.get(id,'Combat');
  assert.equal(Boolean(scene.world.get(id,'DefectiveUnit')),i===5);
  if(i===5){assert.equal(health.maxHp,4);assert.equal(combat.damage,2);}
 }
 for(const id of starters)assert.equal(scene.world.get(id,'DefectiveUnit'),undefined);
 assert.equal(scene.saveCurrentGame(),true);
 const restored=new VNextScene();restored.init({resume:true});restored.create();
 assert.equal(artifactEffects.state(restored.model).manufacturedCount,5);
 savedEntries.clear();
});
test('corrosion from enemy death renders a clipped battlefield zone and pauses with simulation',()=>{
 savedEntries.clear();
 const scene=new VNextScene();scene.create();
 artifacts.add(scene.model,'corrosion');
 scene.spawnEnemyUnit('basic_monster',0,1);
 const enemy=scene.battleUnits.at(-1);
 scene.world.get(enemy,'Health').hp=0;
 assert.equal(scene.cleanupDeadUnits(),true);
 assert.equal(artifactEffects.state(scene.model).corrosionZones.length,1);
 scene.paintBattle();
 assert.ok(scene.zoneGraphics.drawCalls.some(x=>x.type==='strokeCircle'&&x.color===0x91bb70));
 scene.selectSpeed(0);
 scene.update(0,4000);
 assert.equal(artifactEffects.state(scene.model).corrosionZones[0].remainingMs,4000);
 savedEntries.clear();
});

test('Distributed relay draws an unobtrusive violet connection, persists on Continue and pauses',()=>{
 savedEntries.clear();
 const scene=new VNextScene();scene.create();
 preview.placeBuilding(scene.model,'reactor',7);
 preview.setObserved(scene.model,[6]);artifacts.add(scene.model,'distributed');
 scene.update(0,60);
 const relay=artifactEffects.state(scene.model);
 assert.ok(relay.relayTarget!==null);
 assert.ok(scene.boardGraphics.drawCalls.some(c=>c.type==='lineBetween'&&c.color===0xb58aff));
 const before=relay.relayRemainingMs;
 scene.selectSpeed(0);scene.update(0,5000);
 assert.equal(relay.relayRemainingMs,before);
 assert.equal(scene.saveCurrentGame(),true);
 const resumed=new VNextScene();resumed.init({resume:true});resumed.create();
 assert.equal(artifactEffects.state(resumed.model).relayTarget,relay.relayTarget);
 assert.equal(artifactEffects.state(resumed.model).relayRemainingMs,before);
 savedEntries.clear();
});
test('Instinct evolution emits a heal visual after a perfect wave and survives Continue',()=>{
 savedEntries.clear();
 const scene=new VNextScene();scene.create();
 artifacts.add(scene.model,'evolution');
 const unit=scene.battleUnits[0],hp=scene.world.get(unit,'Health').maxHp;
 artifactEffects.startWave(scene.model,1,42,scene.baseHp,economy);
 const result=artifactEffects.clearWave(scene.model,1,scene.baseHp);
 assert.equal(result.evolved,unit);
 assert.equal(scene.world.get(unit,'Health').maxHp,hp+1);
 assert.equal(scene.saveCurrentGame(),true);
 const resumed=new VNextScene();resumed.init({resume:true});resumed.create();
 assert.equal(resumed.world.get(unit,'Health').maxHp,hp+1);
 savedEntries.clear();
});

test('full artifact inventory opens replacement overlay, keeps inventory unchanged until selection',()=>{
 savedEntries.clear();
 const scene=new VNextScene();scene.create();
 for(const id of artifacts.IDS.slice(0,6))artifacts.add(scene.model,id);
 const incoming=artifacts.IDS[6],wave=5;
 scene.waveClock.number=wave;
 scene.activeReward={number:wave,stages:[{kind:'artifact',options:['artifact:'+incoming]}],
  index:0,options:['artifact:'+incoming]};
 scene.buildUi();
 assert.equal(scene.chooseReward('artifact:'+incoming),true);
 assert.equal(scene.activeReward.pendingArtifact,incoming);
 assert.deepEqual(artifacts.list(scene.model),artifacts.IDS.slice(0,6));
 assert.equal(scene.ui.filter(o=>Number.isInteger(o.getData?.('artifactReplacementSlot'))).length,6);
 assert.equal(scene.ui.filter(o=>o.getData?.('declineArtifactReplacement')===true).length,1);
 assert.ok(scene.ui.some(o=>o.value?.includes('NOUVEL ARTEFACT')));
 const saved=saves.read(saveStorage);
 assert.equal(saved.activeReward.pendingArtifact,incoming);
 scene.update(0,2000);
 assert.deepEqual(artifacts.list(scene.model),artifacts.IDS.slice(0,6));
 const slot=scene.ui.find(o=>o.getData?.('artifactReplacementSlot')===2);
 slot.handlers.pointerover();
 assert.ok(scene.artifactTooltipObjects.some(o=>o.value===artifacts.get(artifacts.IDS[2]).label));
 slot.handlers.pointerout();
 slot.handlers.pointerdown();
 assert.equal(scene.activeReward,null);
 assert.equal(artifacts.list(scene.model).length,6);
 assert.equal(artifacts.list(scene.model)[2],incoming);
 assert.equal(artifacts.list(scene.model).includes(artifacts.IDS[2]),false);
 assert.deepEqual(artifacts.list(saves.restore(saves.read(saveStorage),World).model),
  artifacts.list(scene.model));
 savedEntries.clear();
});
test('declining an artifact replacement advances the reward without changing six equipped items',()=>{
 savedEntries.clear();
 const scene=new VNextScene();scene.create();
 for(const id of artifacts.IDS.slice(0,6))artifacts.add(scene.model,id);
 scene.waveClock.number=6;
 const before=artifacts.list(scene.model);
 scene.activeReward={number:6,stages:[{kind:'artifact',options:['artifact:'+artifacts.IDS[6]]}],
  index:0,options:['artifact:'+artifacts.IDS[6]]};
 scene.chooseReward('artifact:'+artifacts.IDS[6]);
 assert.equal(scene.chooseReward('artifact:'+artifacts.IDS[7]),false);
 const cancel=scene.ui.find(o=>o.getData?.('declineArtifactReplacement')===true);
 cancel.handlers.pointerdown();
 assert.equal(scene.activeReward,null);
 assert.deepEqual(artifacts.list(scene.model),before);
 savedEntries.clear();
});
test('Continue resumes the same replacement choice, not a new random reward',()=>{
 savedEntries.clear();
 const scene=new VNextScene();scene.create();
 for(const id of artifacts.IDS.slice(0,6))artifacts.add(scene.model,id);
 scene.waveClock.number=7;
 const offer='artifact:'+artifacts.IDS[6];
 scene.activeReward={number:7,stages:[{kind:'artifact',options:[offer]}],index:0,options:[offer]};
 scene.buildUi();
 scene.chooseReward(offer);
 const resumed=new VNextScene();resumed.init({resume:true});resumed.create();
 assert.equal(resumed.activeReward.pendingArtifact,artifacts.IDS[6]);
 assert.deepEqual(artifacts.list(resumed.model),artifacts.IDS.slice(0,6));
 assert.equal(resumed.ui.filter(o=>Number.isInteger(o.getData?.('artifactReplacementSlot'))).length,6);
 assert.equal(resumed.replaceArtifactReward(1),true);
 assert.equal(resumed.activeReward,null);
 assert.equal(artifacts.list(resumed.model)[1],artifacts.IDS[6]);
 savedEntries.clear();
});
test('replacement UI disables removing core laser while terminal overload is equipped',()=>{
 savedEntries.clear();
 const scene=new VNextScene();scene.create();
 for(const id of ['core_laser','terminal_overload','echo','shield','recovery','lingering'])
  artifacts.add(scene.model,id);
 scene.waveClock.number=8;
 scene.activeReward={number:8,stages:[{kind:'artifact',options:['artifact:hyperfocus']}],
  index:0,options:['artifact:hyperfocus']};
 scene.chooseReward('artifact:hyperfocus');
 const core=scene.ui.find(o=>o.getData?.('artifactReplacementSlot')===0);
 assert.equal(core.handlers.pointerdown,undefined);
 assert.equal(scene.replaceArtifactReward(0),false);
 assert.equal(scene.activeReward.pendingArtifact,'hyperfocus');
 assert.equal(scene.replaceArtifactReward(2),true);
 assert.deepEqual(artifacts.list(scene.model),[
  'core_laser','terminal_overload','hyperfocus','shield','recovery','lingering'
 ]);
 savedEntries.clear();
});
test('a full collection still gets rare artifact rewards after previous queued waves',()=>{
 savedEntries.clear();
 const scene=new VNextScene();scene.create();
 for(const id of artifacts.IDS.slice(0,6))artifacts.add(scene.model,id);
 scene.waveClock.seed=137;
 const lucky=Array.from({length:100},(_,i)=>i+3).find(n=>rewards.artifactDrop(n,137));
 scene.waveClock.number=lucky;
 const reward=scene.rewardForWave(lucky);
 assert.equal(reward.stages.at(-1).kind,'artifact');
 scene.activeReward=reward;
 while(rewards.current(scene.activeReward).kind!=='artifact')
  scene.chooseReward(scene.activeReward.options[0]);
 const option=scene.activeReward.options[0];
 assert.equal(scene.chooseReward(option),true);
 assert.equal(scene.activeReward.pendingArtifact,option.slice(9));
 savedEntries.clear();
});

test('radar marks distant targets in real scene simulation only when the ring crosses them',()=>{
 savedEntries.clear();
 const scene=new VNextScene();scene.create();
 preview.placeBuilding(scene.model,'perception_amplifier',6);
 preview.setObserved(scene.model,[6]);
 scene.spawnEnemyUnit('basic_monster',0,1);
 const id=scene.battleUnits.at(-1);
 scene.world.get(id,'Position').x=820;
 scene.world.get(id,'Position').y=300;
 scene.world.get(id,'Movement').speed=0;
 scene.world.get(id,'Health').hp=20;
 scene.world.get(id,'Health').maxHp=20;
 scene.world.get(id,'Combat').damage=0;
 assert.equal(scene.world.get(id,'ThreatMark'),undefined);
 for(let i=0;i<55;i++)scene.update(0,60); // radius ~673, still short of 755.
 assert.equal(scene.world.get(id,'ThreatMark'),undefined);
 for(let i=0;i<12;i++)scene.update(0,60); // radius ~820, passes the enemy.
 const remaining=scene.world.get(id,'ThreatMark')?.remainingMs;
 assert.ok(remaining>0&&remaining<=2000,'a distant enemy retains its radar mark after the sweep');
 assert.ok(remaining<2000,'mark memory already counts down after the crossing frame');
 assert.equal(threats.radius(scene.model),350);
 savedEntries.clear();
});

test('core secondary ring becomes a closed animated sine wave that gets noisier with damage',()=>{
    savedEntries.clear();
    const scene=new VNextScene();scene.create();
    const base={x:scene.battleBounds.x+scene.battleBounds.w*65/1000,
        y:scene.battleBounds.y+scene.battleBounds.h/2};
    const waveAt=(hp,phase)=>{
        scene.baseHp=hp;
        scene.waveClock.elapsedMs=phase;
        scene.paintBattle();
        const strokes=scene.battleGraphics.drawCalls.filter(call=>
            call.type==='strokePoints'&&call.color===scene.baseHealthColor());
        assert.equal(strokes.length,1,'exactly one signal contour around the central circle');
        assert.equal(scene.battleGraphics.drawCalls.filter(call=>
            call.type==='strokeCircle'&&call.color===scene.baseHealthColor()).length,1,
            'only the primary core circle remains');
        assert.equal(strokes[0].points.length,96,'bounded vector geometry');
        assert.ok(strokes[0].points.every(p=>Number.isFinite(p.x)&&Number.isFinite(p.y)));
        const radii=strokes[0].points.map(p=>Math.hypot(p.x-base.x,p.y-base.y));
        assert.ok(radii.every(r=>r>14&&r<27),'the contour does not overlap the core');
        return radii;
    };
    const healthy=waveAt(100,1000);
    const damaged=waveAt(55,1000);
    const critical=waveAt(12,1000);
    // Higher frequencies produce more local curvature than a smooth healthy sine.
    const roughness=r=>r.reduce((sum,v,i)=>sum+
        Math.abs(r[(i+1)%r.length]-2*v+r[(i+r.length-1)%r.length]),0);
    assert.ok(roughness(damaged)>roughness(healthy)*1.5);
    assert.ok(roughness(critical)>roughness(damaged)*1.3);
    const moving=waveAt(12,1480);
    assert.ok(critical.some((r,i)=>Math.abs(r-moving[i])>0.15),
        'the signal visibly moves with simulation time');
    savedEntries.clear();
});

test('core sine-wave animation freezes in pause and resumes without an extra timer',()=>{
    savedEntries.clear();
    const scene=new VNextScene();scene.create();
    scene.baseHp=20;
    scene.update(0,60);
    const before=scene.waveClock.elapsedMs;
    const outline=()=>scene.coreSignalPoints(100,100);
    const snapshot=outline();
    scene.selectSpeed(0);
    scene.update(0,2000);
    assert.equal(scene.waveClock.elapsedMs,before);
    assert.deepEqual(outline(),snapshot);
    scene.selectSpeed(1);
    scene.update(0,60);
    assert.ok(scene.waveClock.elapsedMs>before);
    assert.notDeepEqual(outline(),snapshot);
    const saved=saves.restore(saves.capture(scene),World);
    assert.equal(saved.waveClock.elapsedMs,scene.waveClock.elapsedMs,
        'the renderer reads the already persisted simulation clock');
    savedEntries.clear();
});

test('Intégrité préservée restores the core on real wave clear, plays healing effect and persists',()=>{
 savedEntries.clear();
 const scene=new VNextScene();scene.create();
 assert.equal(artifacts.add(scene.model,'pristine_repair'),true);
 scene.baseHp=91;scene.waveClock.number=1;
 scene.triggerWave(waves.wave(1,scene.waveClock.seed));
 const members=scene.waveMembers.get(1);
 members.forEach(id=>{scene.world.get(id,'Health').hp=0;});
 scene.checkWaveClears();
 assert.equal(scene.baseHp,96);
 assert.ok(scene.actionEffects.visuals().some(v=>v.kind==='heal'));
 scene.checkWaveClears();
 assert.equal(scene.waveMembers.has(1),false,'cleared waves are removed once');
 assert.equal(scene.baseHp,96,'wave completion is not paid twice');
 const snapshot=saves.restore(saves.capture(scene),World);
 assert.equal(snapshot.baseHp,96);
 assert.ok(artifacts.list(snapshot.model).includes('pristine_repair'));
 savedEntries.clear();
});

test('Centre de maintenance becomes a reward card and describes its limited repair',()=>{
 savedEntries.clear();
 const scene=new VNextScene();scene.create();
 assert.ok(cards.REWARD_CARDS.includes('maintenance'));
 assert.ok(!cards.STARTER_CARDS.includes('maintenance'));
 scene.waveClock.number=1;
 scene.activeReward={number:1,options:['maintenance','reactor','factory']};
 scene.buildUi();
 const card=scene.ui.find(o=>o.getData?.('reward')==='maintenance');
 assert.ok(card,'maintenance card offered in building reward');
 card.handlers.pointerover();
 assert.ok(scene.tooltipObjects.some(o=>o.value==='RÉPARE : +2 PV / 30 S D’ACTIVATION'));
 card.handlers.pointerout();
 assert.equal(scene.chooseReward('maintenance'),true);
 assert.ok(cards.cards(scene.model).includes('maintenance'));
 scene.selectedType='maintenance';
 scene.clickTile(6);
 assert.ok(preview.buildingAt(scene.model,6)!==null);
 savedEntries.clear();
});
test('maintenance heals exactly two HP at cycle end with a visible effect and resumable progress',()=>{
 savedEntries.clear();
 const scene=new VNextScene();scene.create();
 const building=preview.placeBuilding(scene.model,'maintenance',6);
 preview.setObserved(scene.model,[6]);
 scene.baseHp=87;
 maintenance.ensure(scene.model);
 scene.world.get(building,'MaintenanceCycle').elapsedMs=29500;
 scene.paintBoard();
 assert.ok(scene.boardGraphics.drawCalls.some(o=>o.type==='fillRect'),
  'progress bar uses the ECS timer');
 scene.update(0,60);
 assert.equal(scene.baseHp,87);
 assert.equal(scene.world.get(building,'MaintenanceCycle').elapsedMs,29560);
 scene.selectSpeed(0);scene.update(0,3000);
 assert.equal(scene.world.get(building,'MaintenanceCycle').elapsedMs,29560);
 scene.selectSpeed(1);
 for(let i=0;i<7;i++)scene.update(0,60);
 scene.update(0,20);
 assert.equal(scene.baseHp,89,'two actual HP after thirty seconds of observed progress');
 assert.ok(scene.actionEffects.visuals().some(v=>v.kind==='heal'));
 assert.equal(scene.world.get(building,'MaintenanceCycle').elapsedMs,0);
 scene.world.get(building,'MaintenanceCycle').elapsedMs=17200;
 assert.equal(scene.saveCurrentGame(),true);
 const resumed=new VNextScene();resumed.init({resume:true});resumed.create();
 assert.equal(resumed.world.get(building,'MaintenanceCycle').elapsedMs,17200);
 assert.equal(resumed.baseHp,89);
 savedEntries.clear();
});
test('maintenance will not store healing at full HP and stops after attention moves away',()=>{
 savedEntries.clear();
 const scene=new VNextScene();scene.create();
 const id=preview.placeBuilding(scene.model,'maintenance',6);
 maintenance.ensure(scene.model);
 preview.setObserved(scene.model,[6]);scene.baseHp=99;
 scene.world.get(id,'MaintenanceCycle').elapsedMs=29980;
 scene.update(0,60);
 assert.equal(scene.baseHp,100,'heal capped to missing HP');
 assert.equal(scene.world.get(id,'MaintenanceCycle').elapsedMs,0);
 scene.update(0,60);
 assert.equal(scene.world.get(id,'MaintenanceCycle').elapsedMs,0);
 scene.baseHp=93;preview.setObserved(scene.model,[]);
 scene.update(0,60);
 assert.equal(scene.world.get(id,'MaintenanceCycle').elapsedMs,0,'out of vision stays idle');
 savedEntries.clear();
});

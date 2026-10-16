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
const technologies = require('../src/core/VNextTechnologies.js');
const zones = require('../src/core/VNextZones.js');
const saves = require('../src/core/VNextSave.js');
const savedEntries = new Map();
const saveStorage = {
    getItem: key => savedEntries.get(key) ?? null,
    setItem: (key, value) => savedEntries.set(key, value),
    removeItem: key => savedEntries.delete(key)
};
const ROOT = path.resolve(__dirname, '..');
const brandSource = fs.readFileSync(path.join(ROOT, 'src/scene/VNextBrand.js'), 'utf8');
const visionSource = fs.readFileSync(path.join(ROOT, 'src/scene/entities/Vision.js'), 'utf8');
const sceneSource = fs.readFileSync(path.join(ROOT, 'src/scene/VNextScene.js'), 'utf8');

class Display {
    constructor(x = 0, y = 0) { this.x = x; this.y = y; this.handlers = {}; this.data = {}; this.drawCalls = []; }
    on(name, fn) { this.handlers[name] = fn; return this; }
    setInteractive() { this.interactive = true; return this; }
    setPadding() { return this; }
    setPosition(x, y) { this.x = x; this.y = y; return this; }
    setY(value) { this.y = value; return this; }
    setAlpha(value) { this.alpha = value; return this; }
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
    strokeEllipse() { return this; }
    strokeRect() { return this; }
    strokePoints(points) { this.drawCalls.push({ type: 'strokePoints', points, color: this.lineColor }); return this; }
    fillRect() { return this; }
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
const VNextScene = vm.runInNewContext(sceneSource + '\nVNextScene;', {
    Phaser: { Scene: FakeScene }, window: { keyboardLayout: 'azerty', selectedLanguage: 'fr' },
    OverseerECS: { World }, OverseerCombat: combat, OverseerHitEffects: hitEffects,
    OverseerBattleUnitStyles: battleStyles, OverseerBattleActionEffects: battleActions,
    OverseerVNextPreview: preview,
    OverseerVNextEconomy: economy, OverseerVNextBuildings: catalog, OverseerVNextCards: cards,
    OverseerVNextWaves: waves, OverseerVNextTechnologies: technologies, OverseerVNextZones: zones, OverseerVNextSave: saves, localStorage: saveStorage, Vision, OverseerVNextBrand
});

test('scene begins with exactly four unspent cards and empty base', () => {
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
    assert.ok(labels.includes('3s/cycle'));
    assert.ok(!scene.ui.some(o => typeof o.value === 'string' && /COÛT DE POSE|POSE :/.test(o.value)));
    const old = [...scene.tooltipObjects];
    scene.showBuildingTooltip(12);
    assert.ok(old.every(o => o.destroyed));
    assert.ok(!scene.tooltipObjects.some(o => typeof o.value === 'string' && /COÛT DE CONSTRUCTION|COÛT DE POSE|POSE :/.test(o.value)));
    assert.ok(scene.tooltipObjects.some(o => o.value === 'COÛT PAR UNITÉ'));
    assert.ok(scene.tooltipObjects.some(o => o.value === 'CYCLE : 5s / UNITÉ'));
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
    assert.equal(scene.chooseReward('not-a-card'), false);
    assert.equal(scene.chooseReward(options[0]), true);
    assert.equal(cards.cards(scene.model).length, before + 1);
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
    scene.chooseReward(scene.activeReward.options[0]);
    assert.equal(scene.activeReward.number, 2);
    scene.chooseReward(scene.activeReward.options[0]);
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
    const wave = waves.wave(1, running.waveClock.seed);
    running.waveClock.number = 1;
    running.waveClock.elapsedMs = wave.dueAtMs;
    running.triggerWave(wave);
    running.waveMembers.get(1).forEach(id => { running.world.get(id, 'Health').hp = 0; });
    running.checkWaveClears();
    assert.equal(running.activeReward.number, 1);
    const options = [...running.activeReward.options];

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

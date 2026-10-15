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
const economy = require('../src/core/VNextEconomy.js');
const waves = require('../src/core/VNextWaves.js');
const ROOT = path.resolve(__dirname, '..');
const visionSource = fs.readFileSync(path.join(ROOT, 'src/scene/entities/Vision.js'), 'utf8');
const sceneSource = fs.readFileSync(path.join(ROOT, 'src/scene/VNextScene.js'), 'utf8');

class Display {
    constructor(x = 0, y = 0) { this.x = x; this.y = y; this.handlers = {}; this.data = {}; this.drawCalls = []; }
    on(name, fn) { this.handlers[name] = fn; return this; }
    setInteractive() { return this; }
    setPadding() { return this; }
    setPosition(x, y) { this.x = x; this.y = y; return this; }
    setDepth() { return this; }
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
            zone: (x, y) => new Display(x, y)
        };
        this.scene = { start() {} };
        const units = ['unit_guard', 'unit_sniper', 'unit_dronoid'].map(id => ({
            id, hp: 5, speed: 40, attack_damage: 1, attack_range: 30, attack_type: 'ranged', attack_speed: 1
        }));
        const enemies = ['basic_monster', 'ranged_monster', 'base_rusher'].map(id => ({
            id, hp: 5, speed: 30, attack_damage: 1, attack_range: 30, attack_type: 'melee', attack_speed: 1
        }));
        this.cache = { json: { get: () => ({ units, enemies }) } };
    }
}
const Vision = vm.runInNewContext(visionSource + '\nVision;', {});
const VNextScene = vm.runInNewContext(sceneSource + '\nVNextScene;', {
    Phaser: { Scene: FakeScene }, window: { keyboardLayout: 'azerty', selectedLanguage: 'fr' },
    OverseerECS: { World }, OverseerCombat: combat, OverseerVNextPreview: preview, OverseerVNextEconomy: economy, OverseerVNextBuildings: catalog, OverseerVNextCards: cards, OverseerVNextWaves: waves, Vision
});

test('scene begins with exactly four unspent cards and empty base', () => {
    const scene = new VNextScene();
    scene.create();
    assert.equal(scene.world.query('Tile').length, 25);
    assert.equal(scene.world.query('Building').length, 0);
    assert.deepEqual(cards.cards(scene.model), ['reactor', 'extractor', 'factory', 'barracks']);
    assert.equal(scene.world.query('PreviewUnit').length, 7);
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
    assert.equal(scene.world.query('PreviewUnit').length, 7);
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
    assert.equal(scene.resourceStatusLabels.energy.value, '—');
});

test('resource HUD updates when starter reactor is placed and observed', () => {
    const scene = new VNextScene();
    scene.create();
    scene.selectedType = 'reactor';
    scene.clickTile(6);
    for (let i = 0; i < 34; i++) scene.update(0, 60);
    assert.equal(scene.resourceLabels.energy.value, '2');
    assert.equal(scene.resourceStatusLabels.energy.value, '+2');
    scene.changeAttention(1, 0);
    scene.lastResourceChanges.energy.remainingMs = 0;
    scene.updateResourceHud();
    assert.equal(scene.resourceStatusLabels.energy.value, '—');
    scene.scale.width = 800;
    scene.buildUi();
    assert.equal(scene.compactResources.energy.value, '2');
    assert.equal(scene.compactResourceDeltas.energy.value, '—');
});

test('starter factory displays waiting state without unearned resources', () => {
    const scene = new VNextScene();
    scene.create();
    scene.selectedType = 'factory';
    scene.clickTile(11);
    for (let i = 0; i < 60; i++) scene.update(0, 60);
    assert.equal(scene.resourceLabels.components.value, '0');
    assert.equal(scene.resourceStatusLabels.components.value, '—');
});

test('hover tooltip uses real factory recipe and barracks placeholder', () => {
    const scene = new VNextScene();
    scene.create();
    scene.selectedType = 'factory';
    scene.clickTile(11);
    scene.selectedType = 'barracks';
    scene.clickTile(12);
    scene.showBuildingTooltip(11);
    const labels = scene.tooltipObjects.filter(o => typeof o.value === 'string').map(o => o.value);
    assert.ok(labels.includes('Fabrique'));
    assert.ok(labels.includes('CONSTRUCTION : COÛT À DÉFINIR'));
    assert.ok(labels.includes('3s/cycle'));
    const old = [...scene.tooltipObjects];
    scene.showBuildingTooltip(12);
    assert.ok(old.every(o => o.destroyed));
    assert.ok(scene.tooltipObjects.some(o => o.value === 'PRODUCTION NON SIMULÉE'));
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
    balance.energy = 30; balance.components = 50;
    const before = scene.world.query('PreviewUnit').length;
    scene.update(0, 60);
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
    assert.ok(scene.tooltipObjects.some(object => object.value === '50'));
    assert.ok(scene.tooltipObjects.some(object => object.value === '30'));
    assert.ok(scene.tooltipObjects.some(object => object.value === '1 UNITÉ DE BASE'));
    const previous = [...scene.tooltipObjects];
    scene.hideBuildingTooltip();
    assert.ok(previous.every(object => object.destroyed));
});

test('compact resource HUD shows only icon, count and real recent delta', () => {
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
    assert.equal(scene.resourceStatusLabels.energy.value, '+2');
    scene.scale.width = 800;
    scene.buildUi();
    assert.equal(scene.compactResources.energy.value, '2');
    assert.equal(scene.compactResourceDeltas.energy.value, '+2');
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

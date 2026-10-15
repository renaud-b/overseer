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
    OverseerECS: { World }, OverseerCombat: combat, OverseerVNextPreview: preview, OverseerVNextEconomy: economy, OverseerVNextBuildings: catalog, OverseerVNextCards: cards, Vision
});

test('scene creates, resizes, places and simulates against existing ECS', () => {
    const scene = new VNextScene();
    scene.create();
    assert.equal(scene.world.query('Tile').length, 25);
    assert.equal(scene.world.query('PreviewUnit').length, 7);
    assert.equal(scene.world.query('Building').length, 4);
    scene.selectedType = 'reactor';
    scene.clickTile(24);
    assert.equal(preview.buildingAt(scene.model, 24) !== null, true);
    scene.clickTile(24);
    scene.clickTile(23);
    assert.equal(preview.buildingAt(scene.model, 24), null);
    assert.ok(preview.buildingAt(scene.model, 23));
    scene.changeAttention(1, 0, false);
    scene.changeAttention(0, 0, true);
    scene.update(0, 30);
    scene.selectSpeed(3);
    scene.update(0, 30);
    scene.scale.width = 1600;
    scene.buildUi();
    scene.scale.width = 800;
    scene.buildUi();
    assert.ok(preview.buildingAt(scene.model, 23));
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

test('VNext economy runs with scaled ECS ticks, pauses, and updates resource HUD', () => {
    const scene = new VNextScene();
    scene.create();
    const balance = scene.world.get(scene.model.game, 'Resources');
    assert.deepEqual(balance, { energy: 0, matter: 0, components: 0 });
    assert.equal(scene.resourceLabels.energy.value, '0');
    for (let i = 0; i < 100; i++) scene.update(0, 60);
    assert.ok(balance.components > 0, 'Factory should process watched producer outputs');
    assert.equal(scene.resourceLabels.components.value, String(balance.components));
    const amount = { ...balance };
    const production = preview.buildingAt(scene.model, 6);
    const previousProgress = scene.world.get(production, 'Production').elapsedMs;
    scene.selectSpeed(0);
    for (let i = 0; i < 10; i++) scene.update(0, 60);
    assert.deepEqual(balance, amount);
    assert.equal(scene.world.get(production, 'Production').elapsedMs, previousProgress);
    scene.selectSpeed(3);
    for (let i = 0; i < 20; i++) scene.update(0, 60);
    assert.ok(balance.energy + balance.matter + balance.components >= 0);
    assert.equal(scene.resourceLabels.energy.value, String(balance.energy));
});


test('resource HUD uses distinct building glyphs and colors, with right aligned values', () => {
    const scene = new VNextScene();
    scene.create();
    assert.deepEqual(Array.from(scene.resourceStyles, r => r.label),
        ['Énergie', 'Matière', 'Refroidissement', 'Composants', 'Données']);
    assert.equal(scene.resourceLabels.energy.color, '#35d8ef');
    assert.equal(scene.resourceLabels.matter.color, '#39dd92');
    assert.equal(scene.resourceLabels.components.color, '#f4ba58');
    assert.equal(scene.resourceLabels.energy.originX, 1);
    assert.equal(scene.resourceLabels.components.originX, 1);
    const calls = scene.resourceGraphics.drawCalls;
    assert.ok(calls.some(c => c.type === 'strokeCircle' && c.color === 0x35d8ef), 'reactor glyph');
    assert.ok(calls.some(c => c.type === 'strokePoints' && c.color === 0xf4ba58), 'factory hexagon');
    assert.ok(calls.some(c => c.type === 'strokePoints' && c.color === 0xb58aff), 'data diamond');
    assert.ok(calls.some(c => c.type === 'lineBetween' && c.color === 0x87b9e8), 'cooling snowflake');
    assert.equal(scene.world.get(scene.model.game, 'Resources').cooling, undefined);
    assert.equal(Object.hasOwn(scene.resourceLabels, 'cooling'), false);
    assert.equal(Object.hasOwn(scene.resourceLabels, 'data'), false);
    assert.equal(scene.resourceStatusLabels.energy.value, 'PRODUCTION ACTIVE');
});

test('resource HUD displays actual transient balance changes, pauses and reports visibility', () => {
    const scene = new VNextScene();
    scene.create();
    // The watched reactor and extractor complete a first 2-second cycle.
    for (let i = 0; i < 34; i++) scene.update(0, 60);
    assert.equal(scene.resourceLabels.energy.value, '2');
    assert.equal(scene.resourceLabels.matter.value, '2');
    assert.equal(scene.resourceStatusLabels.energy.value, '+2 · VARIATION RÉCENTE');
    assert.equal(scene.resourceStatusLabels.energy.color, '#69e5ac');
    const feedback = scene.lastResourceChanges.energy.remainingMs;
    scene.selectSpeed(0);
    for (let i = 0; i < 10; i++) scene.update(0, 60);
    assert.equal(scene.lastResourceChanges.energy.remainingMs, feedback);
    scene.changeAttention(1, 0); // Reactor out of vision, extractor still in vision.
    scene.lastResourceChanges.energy.remainingMs = 0;
    scene.updateResourceHud();
    assert.equal(scene.resourceStatusLabels.energy.value, 'HORS VISION');
    assert.equal(scene.resourceStatusLabels.matter.value, '+2 · VARIATION RÉCENTE');
    scene.scale.width = 800;
    scene.buildUi();
    assert.equal(scene.resourceLabels.energy, undefined);
    assert.equal(scene.compactResources.energy.value, '2');
    assert.equal(scene.compactResources.energy.color, '#35d8ef');
    assert.equal(scene.compactResources.components.originX, 1);
    scene.scale.width = 1600;
    scene.buildUi();
    assert.equal(scene.compactResources, null);
    assert.equal(scene.resourceLabels.energy.value, '2');
    assert.equal(scene.resourceStatusLabels.energy.value, 'HORS VISION');
});

test('factory displays negative input deltas and waiting status without inventing rates', () => {
    const scene = new VNextScene();
    scene.create();
    // All three machines are watched at startup. The factory first cycles after 3s.
    for (let i = 0; i < 50; i++) scene.update(0, 60);
    assert.equal(scene.resourceLabels.components.value, '1');
    assert.equal(scene.resourceStatusLabels.components.value, '+1 · VARIATION RÉCENTE');
    assert.equal(scene.resourceStatusLabels.energy.value, '-2 · VARIATION RÉCENTE');
    assert.equal(scene.resourceStatusLabels.energy.color, '#ff9e8c');
    const factory = preview.buildingAt(scene.model, 11);
    scene.world.get(factory, 'Production').blocked = true;
    scene.lastResourceChanges.components.remainingMs = 0;
    scene.updateResourceHud();
    assert.equal(scene.resourceStatusLabels.components.value, 'EN ATTENTE');
    assert.equal(scene.resourceStatusLabels.components.color, '#ff9e8c');
});

test('grid hover tooltip shows recipe inputs and outputs, not invented construction costs', () => {
    const scene = new VNextScene();
    scene.create();
    scene.showBuildingTooltip(11); // Factory
    assert.equal(scene.hoveredTile, 11);
    const labels = scene.tooltipObjects.filter(o => typeof o.value === 'string').map(o => o.value);
    assert.ok(labels.includes('Fabrique'));
    assert.ok(labels.includes('CONSTRUCTION : COÛT À DÉFINIR'));
    assert.ok(labels.includes('CONSOMME / CYCLE'));
    assert.ok(labels.includes('PRODUIT / CYCLE'));
    assert.ok(labels.includes('2'));
    assert.ok(labels.includes('1'));
    assert.ok(labels.includes('3s/cycle'));
    const graphics = scene.tooltipObjects[0];
    assert.ok(graphics, 'tooltip draws its own geometric resource icons');
    const previous = [...scene.tooltipObjects];
    scene.showBuildingTooltip(18); // Laboratory: no invented production
    assert.ok(previous.every(o => o.destroyed), 'previous tooltip is destroyed on hover change');
    assert.ok(scene.tooltipObjects.some(o => o.value === 'PRODUCTION NON SIMULÉE'));
    scene.hideBuildingTooltip();
    assert.equal(scene.tooltipObjects.length, 0);
    scene.showBuildingTooltip(24);
    assert.equal(scene.tooltipObjects.length, 0, 'empty cells have no card');
});

test('tooltip survives layout rebuild without stale display elements', () => {
    const scene = new VNextScene();
    scene.create();
    scene.showBuildingTooltip(6);
    const old = [...scene.tooltipObjects];
    scene.scale.width = 800;
    scene.buildUi();
    assert.ok(old.every(o => o.destroyed));
    assert.equal(scene.tooltipObjects.length, 0);
});

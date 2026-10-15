'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const fs = require('node:fs');
const path = require('node:path');
const { World } = require('../src/core/World.js');
const preview = require('../src/core/VNextPreview.js');
const combat = require('../src/core/CombatSystem.js');
const ROOT = path.resolve(__dirname, '..');
const visionSource = fs.readFileSync(path.join(ROOT, 'src/scene/entities/Vision.js'), 'utf8');
const sceneSource = fs.readFileSync(path.join(ROOT, 'src/scene/VNextScene.js'), 'utf8');

class Display {
    constructor(x = 0, y = 0) { this.x = x; this.y = y; this.handlers = {}; this.data = {}; }
    on(name, fn) { this.handlers[name] = fn; return this; }
    setInteractive() { return this; }
    setPadding() { return this; }
    setPosition(x, y) { this.x = x; this.y = y; return this; }
    setDepth() { return this; }
    setData(name, value) { this.data[name] = value; return this; }
    getData(name) { return this.data[name]; }
    setText(value) { this.value = value; return this; }
    fillStyle() { return this; }
    fillRoundedRect() { return this; }
    strokeRoundedRect() { return this; }
    lineStyle() { return this; }
    lineBetween() { return this; }
    fillCircle() { return this; }
    strokeCircle() { return this; }
    strokeEllipse() { return this; }
    strokePoints() { return this; }
    fillRect() { return this; }
    strokeTriangle() { return this; }
    fillTriangle() { return this; }
    clear() { return this; }
    destroy() { this.destroyed = true; }
}

class FakeScene {
    constructor() {
        this.scale = { width: 1366, height: 768, on() {}, off() {} };
        this.input = { keyboard: { on() {}, off() {} }, on() {}, off() {}, setDraggable() {} };
        this.events = { once() {} };
        this.add = {
            graphics: () => new Display(),
            text: (x, y, value) => { const d = new Display(x, y); d.setText(value); return d; },
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
    OverseerECS: { World }, OverseerCombat: combat, OverseerVNextPreview: preview, Vision
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

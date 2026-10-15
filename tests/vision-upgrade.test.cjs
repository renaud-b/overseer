'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const root = path.resolve(__dirname, '..');
const hudScript = fs.readFileSync(path.join(root, 'src/scene/managers/HUDManager.js'), 'utf8');
const visionScript = fs.readFileSync(path.join(root, 'src/scene/entities/Vision.js'), 'utf8');
const sceneScript = fs.readFileSync(path.join(root, 'src/scene/GameScene.js'), 'utf8');
const HUDManager = vm.runInNewContext(hudScript + '\nHUDManager;', {});
const Vision = vm.runInNewContext(visionScript + '\nVision;', {});

function displayObject(x, y) {
    return {
        x, y, handlers: {},
        setStrokeStyle() { return this; },
        setFillStyle(fill) { this.fill = fill; return this; },
        setInteractive() { return this; },
        setDepth() { return this; },
        setOrigin() { return this; },
        setText(value) { this.text = value; return this; },
        setColor(color) { this.color = color; return this; },
        on(name, callback) { this.handlers[name] = callback; return this; }
    };
}

function harness(balance = 0) {
    const info = [];
    const resources = { compute_units: balance };
    const texts = {
        upgrade_vision: '▲ Vision',
        upgrade_vision_title: 'Upgrade Vision',
        current_level_text: 'Current level: {level}',
        upgrade_cost_text: 'Cost: {cost} compute units',
        vision_max: 'Vision maxed'
    };
    const scene = {
        scale: { width: 800, height: 700 },
        resources,
        units: {},
        unitCapMap: {},
        add: {
            rectangle: (x, y) => displayObject(x, y),
            text: (x, y) => displayObject(x, y)
        },
        translate(key, vars = {}) {
            return (texts[key] || key).replace(/\{([^}]+)\}/g, (_, k) => vars[k] ?? '');
        }
    };
    const hud = Object.create(HUDManager.prototype);
    hud.scene = scene;
    hud.showInfoPanel = (...args) => info.push(args);
    hud.hideInfoPanel = () => info.push(['hidden']);
    hud.updateHUD = () => hud.updateVisionUpgradeButton();
    scene.hud = hud;
    const vision = Object.create(Vision.prototype);
    vision.scene = scene;
    vision.level = 0;
    vision.levelPatterns = [[], [], [], []];
    let refreshes = 0;
    vision.updatePatternForLevel = () => refreshes++;
    vision.updatePosition = () => refreshes++;
    scene.vision = vision;
    hud.createVisionUpgradeButton();
    return { scene, hud, vision, info, get refreshes() { return refreshes; } };
}

test('vision button is visible and shows required compute units', () => {
    const { hud } = harness(0);
    assert.ok(hud.visionUpgradeButton.x > 0);
    assert.equal(hud.visionUpgradeLabel.text, '▲ Vision');
    assert.match(hud.visionUpgradeCost.text, /20 CU/);
    assert.equal(hud.visionUpgradeLabel.color, '#a0afb8');
});

test('insufficient resources never upgrade vision', () => {
    const { hud, vision, scene } = harness(19);
    hud.visionUpgradeButton.handlers.pointerdown();
    assert.equal(vision.level, 0);
    assert.equal(scene.resources.compute_units, 19);
});

test('vision upgrade spends exact cost and refreshes patterns and HUD', () => {
    const run = harness(140);
    const { hud, scene, vision } = run;
    for (const [cost, level] of [[20, 1], [50, 2], [70, 3]]) {
        assert.match(hud.visionUpgradeCost.text, new RegExp(String(cost) + ' CU'));
        hud.visionUpgradeButton.handlers.pointerdown();
        assert.equal(vision.level, level);
    }
    assert.equal(scene.resources.compute_units, 0);
    assert.equal(run.refreshes, 6);
    assert.equal(hud.visionUpgradeCost.text, 'Vision maxed');
    assert.equal(hud.visionUpgradeLabel.color, '#a0afb8');
    hud.visionUpgradeButton.handlers.pointerdown();
    assert.equal(vision.level, 3);
    assert.equal(scene.resources.compute_units, 0);
});

test('vision button refreshes after external talent unlock, without spending resources', () => {
    const { hud, vision, scene } = harness(200);
    vision.level = 3;
    hud.updateVisionUpgradeButton();
    assert.equal(hud.visionUpgradeCost.text, 'Vision maxed');
    hud.visionUpgradeButton.handlers.pointerdown();
    assert.equal(scene.resources.compute_units, 200);
    assert.ok(sceneScript.includes('this.hud.updateVisionUpgradeButton();'));
});

test('vision tooltip shows localized level and upgrade cost', () => {
    const { hud, info } = harness(50);
    hud.visionUpgradeButton.handlers.pointerover();
    assert.equal(info[0][0], 'Upgrade Vision');
    assert.match(info[0][1], /Current level: 1/);
    assert.match(info[0][1], /Cost: 20 compute units/);
    hud.visionUpgradeButton.handlers.pointerout();
    assert.equal(info[1][0], 'hidden');
});

test('maximum-vision message is localized', () => {
    for (const lang of ['fr', 'en', 'es', 'jp']) {
        const texts = require(path.join(root, 'assets', 'game_texts_' + lang + '.json'));
        assert.ok(texts.ui.vision_max, 'Missing maximum vision label for ' + lang);
    }
});

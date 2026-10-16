'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const read = name => fs.readFileSync(path.join(root, name), 'utf8');
const brand = vm.runInNewContext(read('src/scene/VNextBrand.js') + '\nOverseerVNextBrand;', {});
const save = require('../src/core/VNextSave.js');
const { World } = require('../src/core/World.js');
const preview = require('../src/core/VNextPreview.js');
const cards = require('../src/core/VNextCards.js');
const economy = require('../src/core/VNextEconomy.js');
const items = new Map();
const localStorage = {
    getItem: key => items.get(key) ?? null,
    setItem: (key, value) => items.set(key, value),
    removeItem: key => items.delete(key)
};

function installValidSave() {
    const model = preview.createModel(World), world = model.world;
    cards.initialize(model);
    economy.initialize(model);
    return save.write({
        model, world, battleUnits: [], waveMembers: new Map(),
        waveClock: { number: 2, elapsedMs: 120000, seed: 12 },
        visionRules: { patternIndex: 0 }, attention: { x: 1, y: 1 },
        activeReward: null, rewardQueue: [], baseHp: 100, speed: 1, lastSpeed: 1
    }, localStorage, Date.now() - 12 * 60000);
}

class Display {
    constructor(x, y, value, style) {
        this.x = x; this.y = y; this.value = value; this.style = style;
        this.handlers = {};
    }
    setOrigin() { return this; }
    setInteractive() { return this; }
    setStrokeStyle(_width, color) { this.stroke = color; return this; }
    setFillStyle(color) { this.fill = color; return this; }
    setColor(color) { this.color = color; return this; }
    setDepth() { return this; }
    fillRoundedRect() { return this; }
    strokeRoundedRect() { return this; }
    on(event, callback) { this.handlers[event] = callback; return this; }
    fillStyle() { return this; }
    fillRect() { return this; }
    lineStyle() { return this; }
    lineBetween(x1, y1, x2, y2) {
        this.lines ||= [];
        this.lines.push({ x1, y1, x2, y2 });
        return this;
    }
    fillCircle(x, y, radius) {
        this.dots ||= [];
        this.dots.push({ x, y, radius });
        return this;
    }
    strokeCircle() { return this; }
    clear() {
        this.clears = (this.clears || 0) + 1;
        this.dots = [];
        return this;
    }
    destroy() { this.destroyed = true; }
}

class FakeScene {
    constructor(config) {
        this.key = config.key;
        this.scale = { width: 1366, height: 768, on() {}, off() {} };
        this.events = { once() {} };
        this.cameras = { main: { fadeIn() {}, fadeOut() {} } };
        this.time = { delayedCall: (_duration, callback) => callback() };
        this.scene = { start: (key, data) => { this.started = { key, data }; } };
        this.add = {
            graphics: () => new Display(),
            text: (x, y, value, style) => new Display(x, y, value, style),
            rectangle: (x, y) => new Display(x, y),
            zone: (x, y) => new Display(x, y)
        };
    }
}
const MainMenuScene = vm.runInNewContext(
    read('src/scene/MainMenuScene.js') + '\nMainMenuScene;',
    { Phaser: { Scene: FakeScene }, OverseerVNextBrand: brand,
        OverseerVNextSave: save, localStorage }
);

function buttonFor(scene, label) {
    const text = scene.objects.find(o => o.value === label);
    assert.ok(text, 'Missing button: ' + label);
    const candidates = scene.objects.filter(o => o.y === text.y && o.handlers.pointerdown);
    // Modal actions share a row: select the hit zone nearest its label.
    const button = candidates.sort((a, b) =>
        Math.abs(a.x - text.x) - Math.abs(b.x - text.x))[0];
    assert.ok(button);
    return { button, text };
}

test('MainMenu is first for returning and first-time players', () => {
    for (const lang of [null, 'fr']) {
        let config;
        const scenes = {
            MainMenuScene, VNextScene: class {}, GameScene: class {}, OptionsScene: class {},
            TalentScene: class {}, LegacyMainMenuScene: class {}, HomeScene: class {}
        };
        const context = {
            ...scenes,
            window: { innerWidth: 1366, innerHeight: 768, addEventListener() {} },
            navigator: { language: 'fr-FR' },
            localStorage: { getItem: key => key === 'selectedLanguage' ? lang : null, setItem() {} },
            Phaser: {
                AUTO: 1, Scale: { RESIZE: 2, CENTER_BOTH: 3 },
                Game: class { constructor(options) { config = options; this.scale = { resize() {} }; } }
            }
        };
        vm.runInNewContext(read('src/main.js'), context);
        assert.equal(config.scene[0], MainMenuScene);
        assert.equal(config.scene[1], scenes.VNextScene);
        assert.ok(config.scene.includes(scenes.LegacyMainMenuScene));
    }
});

test('title matches VNext branding and hover highlights the button', () => {
    const scene = new MainMenuScene();
    scene.create();
    const title = scene.objects.find(o => o.value === brand.title);
    const subtitle = scene.objects.find(o => o.value === brand.subtitle);
    assert.equal(title.style.fontFamily, 'monospace');
    assert.equal(title.style.color, brand.titleColor);
    assert.equal(subtitle.style.color, brand.subtitleColor);
    const { button, text } = buttonFor(scene, 'START A GAME');
    button.handlers.pointerover();
    assert.equal(text.color, '#e2eef3');
    assert.equal(button.stroke, 0x62e7e1);
    button.handlers.pointerout();
    assert.equal(text.color, '#c7dce6');
    assert.equal(button.stroke, 0x274457);
});

test('buttons go to VNext, talents and options and cannot double-transition', () => {
    for (const [label, target] of [
        ['START A GAME', 'VNextScene'], ['TALENTS', 'TalentScene'], ['OPTIONS', 'OptionsScene']
    ]) {
        const scene = new MainMenuScene();
        scene.create();
        buttonFor(scene, label).button.handlers.pointerdown();
        assert.equal(scene.started.key, target);
        if (label === 'TALENTS') assert.equal(scene.started.data.fromMenu, true);
        buttonFor(scene, 'START A GAME').button.handlers.pointerdown();
        assert.equal(scene.started.key, target);
    }
});

test('resize cleans old display objects without losing buttons', () => {
    const scene = new MainMenuScene();
    scene.create();
    const previous = [...scene.objects];
    scene.scale.width = 800;
    scene.scale.height = 600;
    scene.drawMenu();
    assert.ok(previous.every(object => object.destroyed));
    for (const label of ['START A GAME', 'TALENTS', 'OPTIONS']) buttonFor(scene, label);
});

test('legacy menu is kept under an independent scene key', () => {
    const source = read('src/scene/LegacyMainMenuScene.js');
    assert.match(source, /class LegacyMainMenuScene extends Phaser.Scene/);
    assert.match(source, /key: 'LegacyMainMenuScene'/);
    const html = read('index.html');
    assert.ok(html.indexOf('src/scene/VNextBrand.js') < html.indexOf('src/scene/MainMenuScene.js'));
    assert.ok(html.includes('src/scene/LegacyMainMenuScene.js'));
});


test('menu circuits are orthogonal, stay behind buttons and keep the center clear', () => {
    const scene = new MainMenuScene();
    scene.create();
    assert.equal(scene.circuitPaths.length, 19);
    assert.equal(scene.circuitSignals.length, 5);
    const title = scene.objects.find(o => o.value === brand.title);
    const signalLayer = scene.signalGraphics;
    assert.ok(scene.objects.indexOf(signalLayer) < scene.objects.indexOf(title));
    assert.ok(scene.circuitGraphics.lines.length > 45);
    for (const path of scene.circuitPaths) {
        for (const point of path.points) {
            assert.ok(point.x >= 0 && point.x <= scene.scale.width);
            assert.ok(point.y >= 0 && point.y <= scene.scale.height);
            assert.ok(point.x <= scene.scale.width * 0.20 ||
                point.x >= scene.scale.width * 0.80 ||
                point.y <= scene.scale.height * 0.15 ||
                point.y >= scene.scale.height * 0.85,
                'A circuit crossed the quiet central area');
        }
        for (let i = 1; i < path.points.length; i++) {
            const a = path.points[i - 1], b = path.points[i];
            assert.ok(a.x === b.x || a.y === b.y, 'Diagonals are not circuit tracks');
        }
    }
});

test('current pulses move slowly without redrawing the static background each frame', () => {
    const scene = new MainMenuScene();
    scene.create();
    const oldLines = scene.circuitGraphics.lines.length;
    const previous = scene.circuitSignals.map(signal => signal.distance);
    const previousClears = scene.signalGraphics.clears;
    scene.update(0, 20);
    assert.deepEqual(scene.circuitSignals.map(signal => signal.distance), previous);
    scene.update(20, 30);
    assert.ok(scene.signalGraphics.clears > previousClears);
    assert.deepEqual(scene.circuitGraphics.lines.length, oldLines);
    scene.circuitSignals.forEach((signal, i) => {
        assert.ok(signal.distance > previous[i]);
        assert.ok(signal.speed >= 20 && signal.speed <= 38);
    });
});

test('signals wrap with a delay; scene transition stops animation', () => {
    const scene = new MainMenuScene();
    scene.create();
    for (const signal of scene.circuitSignals) {
        signal.distance = scene.circuitPaths[signal.pathIndex].length + 6;
    }
    scene.update(0, 60);
    assert.ok(scene.circuitSignals.slice(0, 3).every(signal =>
        signal.distance >= 0 && signal.distance <= scene.circuitPaths[signal.pathIndex].length));
    assert.ok(scene.circuitSignals.slice(3).every(signal => signal.distance < 0));
    const clears = scene.signalGraphics.clears;
    scene.navigateTo('OptionsScene');
    scene.update(60, 60);
    assert.equal(scene.signalGraphics.clears, clears);
});

test('resizing repositions circuit paths and destroys both old graphics', () => {
    const scene = new MainMenuScene();
    scene.create();
    const oldStatic = scene.circuitGraphics, oldPulse = scene.signalGraphics;
    scene.scale.width = 800;
    scene.scale.height = 600;
    scene.drawMenu();
    assert.ok(oldStatic.destroyed);
    assert.ok(oldPulse.destroyed);
    assert.equal(scene.circuitPaths[0].points[1].x, Math.round(800 * .07));
    assert.equal(scene.circuitPaths[0].points[0].y, Math.round(600 * .12));
    assert.equal(scene.circuitSignals.length, 5);
});

test('reduced-motion preference disables animated pulses but keeps static traces', () => {
    class ReducedMotionMenu extends MainMenuScene {}
    // MainMenuScene is bound to the same FakeScene environment: explicit scene setting
    // is equivalent to a browser reporting prefers-reduced-motion.
    const scene = new ReducedMotionMenu();
    scene.create();
    scene.reducedMotion = true;
    const initial = scene.signalGraphics.clears;
    const distances = scene.circuitSignals.map(x => x.distance);
    scene.update(0, 60);
    assert.equal(scene.signalGraphics.clears, initial);
    assert.deepEqual(scene.circuitSignals.map(x => x.distance), distances);
    assert.ok(scene.circuitGraphics.lines.length > 0);
});

test('between three and five impulses remain visible, each with its own speed', () => {
    const scene = new MainMenuScene();
    scene.create();
    const speeds = scene.circuitSignals.map(signal => signal.speed);
    assert.equal(new Set(speeds).size, 5);
    assert.equal(scene.circuitSignals.filter(signal => signal.restartDelay > 0).length, 2);
    const activeCount = () => scene.circuitSignals.filter(signal =>
        scene.pointOnCircuit(scene.circuitPaths[signal.pathIndex], signal.distance) !== null).length;
    const observed = new Set([activeCount()]);
    for (let i = 0; i < 1800; i++) {
        scene.update(i * 80, 80);
        const visible = activeCount();
        assert.ok(visible >= 3 && visible <= 5);
        observed.add(visible);
    }
    assert.deepEqual([...observed].sort(), [3, 4, 5]);
});


test('Continue is offered only for a valid local save, with the current wave', () => {
    items.clear();
    assert.equal(new MainMenuScene().create(), undefined);
    assert.ok(installValidSave());
    const menu = new MainMenuScene();
    menu.create();
    const displayed = menu.objects.filter(o => typeof o.value === 'string').map(o => o.value);
    assert.ok(displayed.includes('CONTINUER'));
    assert.ok(displayed.includes('NOUVELLE PARTIE'));
    assert.ok(displayed.some(text => text.includes('VAGUE 2')));
    assert.ok(!displayed.includes('START A GAME'));
    buttonFor(menu, 'CONTINUER').button.handlers.pointerdown();
    assert.equal(menu.started.key, 'VNextScene');
    assert.equal(menu.started.data.resume, true);
    items.clear();
});

test('New game asks for confirmation and cancellation keeps the save', () => {
    items.clear();
    installValidSave();
    const before = localStorage.getItem(save.KEY);
    const menu = new MainMenuScene();
    menu.create();
    buttonFor(menu, 'NOUVELLE PARTIE').button.handlers.pointerdown();
    assert.equal(menu.confirmingNewGame, true);
    assert.equal(menu.started, undefined);
    assert.ok(menu.objects.some(o => o.value === 'La sauvegarde actuelle sera remplacée.'));
    buttonFor(menu, 'ANNULER').button.handlers.pointerdown();
    assert.equal(menu.confirmingNewGame, false);
    assert.equal(localStorage.getItem(save.KEY), before);
    buttonFor(menu, 'NOUVELLE PARTIE').button.handlers.pointerdown();
    buttonFor(menu, 'RECOMMENCER').button.handlers.pointerdown();
    assert.equal(menu.started.key, 'VNextScene');
    assert.equal(menu.started.data?.resume, false, 'confirmation must explicitly start fresh');
    assert.equal(localStorage.getItem(save.KEY), null);
    items.clear();
});

test('fresh game works without a save; invalid save hides Continue', () => {
    items.clear();
    localStorage.setItem(save.KEY, 'not json');
    const menu = new MainMenuScene();
    menu.create();
    assert.ok(!menu.objects.some(o => o.value === 'CONTINUER'));
    buttonFor(menu, 'START A GAME').button.handlers.pointerdown();
    assert.equal(menu.started.key, 'VNextScene');
    assert.equal(menu.started.data?.resume, false, 'fresh start must override a previous Continue');
    assert.equal(localStorage.getItem(save.KEY), null);
    items.clear();
});

test('after a defeat, START A GAME overrides stale Continue scene data without a reload', () => {
    items.clear();
    assert.equal(installValidSave(), true);
    const initial = new MainMenuScene();
    initial.create();
    buttonFor(initial, 'CONTINUER').button.handlers.pointerdown();
    assert.equal(initial.started.data.resume, true);

    // Defeat deletes the save while Phaser keeps the same VNextScene instance.
    assert.equal(save.clear(localStorage), true);
    const menu = new MainMenuScene();
    menu.create();
    assert.equal(menu.objects.some(o => o.value === 'CONTINUER'), false);
    let lastVNextData = initial.started.data;
    menu.scene.start = (key, data) => {
        if (key === 'VNextScene') lastVNextData = data === undefined ? lastVNextData : data;
        menu.started = { key, data };
    };
    buttonFor(menu, 'START A GAME').button.handlers.pointerdown();
    assert.equal(menu.started.key, 'VNextScene');
    assert.equal(lastVNextData.resume, false,
        'Phaser must not inherit the resume:true payload from the defeated run');
    assert.equal(localStorage.getItem(save.KEY), null);
    items.clear();
});

test('modal survives resize; New game never deletes persistent talents', () => {
    items.clear();
    installValidSave();
    localStorage.setItem('unlockedTalents', '["root"]');
    localStorage.setItem('memoryShards', '12');
    const menu = new MainMenuScene();
    menu.create();
    buttonFor(menu, 'NOUVELLE PARTIE').button.handlers.pointerdown();
    menu.scale.width = 800;
    menu.scale.height = 600;
    menu.drawMenu();
    assert.ok(menu.objects.some(o => o.value === 'RECOMMENCER'));
    buttonFor(menu, 'RECOMMENCER').button.handlers.pointerdown();
    assert.equal(localStorage.getItem('unlockedTalents'), '["root"]');
    assert.equal(localStorage.getItem('memoryShards'), '12');
    items.clear();
});

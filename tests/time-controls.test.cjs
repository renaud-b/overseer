'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const ROOT = path.resolve(__dirname, '..');
const hudSource = fs.readFileSync(path.join(ROOT, 'src/scene/managers/HUDManager.js'), 'utf8');
const gameSource = fs.readFileSync(path.join(ROOT, 'src/scene/GameScene.js'), 'utf8');
const HUDManager = vm.runInNewContext(hudSource + '\nHUDManager;', {});
const GameScene = vm.runInNewContext(gameSource + '\nGameScene;', { Phaser: { Scene: class {} } });

function displayObject(x, y) {
    return {
        x, y, handlers: {},
        setStrokeStyle() { return this; },
        setFillStyle(value) { this.fillColor = value; return this; },
        setInteractive() { return this; },
        setDepth() { return this; },
        setOrigin() { return this; },
        setDisplaySize() { return this; },
        setColor(value) { this.color = value; return this; },
        setText(value) { this.text = value; return this; },
        on(event, callback) { this.handlers[event] = callback; return this; }
    };
}

test('speed buttons stay in viewport and select x1, x2, x3, x5 and pause', () => {
    for (const viewportWidth of [800, 1366, 1920]) {
        const selected = [];
        const scene = {
            scale: { width: viewportWidth },
            timeScale: 1,
            add: {
                rectangle(x, y) { return displayObject(x, y); },
                image(x, y) { return displayObject(x, y); },
                text(x, y) { return displayObject(x, y); }
            },
            translate(key) { return key; },
            setTimeScale(speed) { selected.push(speed); },
            children: { bringToTop() {} }
        };
        const hud = Object.create(HUDManager.prototype);
        hud.scene = scene;
        const wavePosition = hud.createTimeControlButtons();
        hud.createWaveCounter(wavePosition);
        assert.equal(hud.timeButtons.length, 5);
        assert.ok(wavePosition.x >= 0);
        for (const button of hud.timeButtons) {
            assert.ok(button.background.x - 21 >= 0);
            assert.ok(button.background.x + 21 <= viewportWidth);
            button.background.handlers.pointerdown();
        }
        assert.deepEqual(selected, [1, 2, 3, 5, 0]);
        hud.highlightSelectedSpeed(3);
        assert.equal(hud.timeButtons[2].text.color, '#ffffff');
        hud.updateWaveCounter(3);
        assert.equal(hud.waveText.y, wavePosition.y + 13);
    }
});

test('pausing preserves the selected speed for resume', () => {
    const highlighted = [];
    const scene = { timeScale: 1, hud: { highlightSelectedSpeed(speed) { highlighted.push(speed); } } };
    GameScene.prototype.setTimeScale.call(scene, 5);
    GameScene.prototype.setTimeScale.call(scene, 0);
    assert.equal(scene.timeScale, 0);
    assert.equal(scene.lastTimeScale, 5);
    GameScene.prototype.setTimeScale.call(scene, scene.lastTimeScale);
    assert.equal(scene.timeScale, 5);
    assert.deepEqual(highlighted, [5, 0, 5]);
});

test('number key mappings match the visible speeds', () => {
    for (const [key, speed] of [['ONE', 1], ['TWO', 2], ['THREE', 3], ['FIVE', 5], ['ZERO', 0]]) {
        assert.ok(gameSource.includes(
            "this.input.keyboard.on('keydown-" + key + "', () => this.setTimeScale(" + speed + "));"
        ));
    }
});

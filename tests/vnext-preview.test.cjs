'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { World } = require('../src/core/World.js');
const preview = require('../src/core/VNextPreview.js');

const fresh = () => preview.createModel(World);

test('preview grid is ECS-backed and independent of Phaser', () => {
    const model = fresh();
    assert.equal(model.tiles.length, 25);
    assert.deepEqual(model.world.get(model.grid, 'Grid'), { width: 5, height: 5 });
    assert.deepEqual(model.world.get(model.tiles[24], 'Tile'), { index: 24, x: 4, y: 4 });
    assert.equal(model.world.query('Building').length, 0);
});

test('placement, occupancy and relocation have one ECS source of truth', () => {
    const model = fresh();
    const id = preview.placeBuilding(model, 'reactor', 6);
    assert.ok(id);
    assert.equal(preview.placeBuilding(model, 'factory', 6), null);
    assert.equal(preview.placeBuilding(model, 'factory', 25), null);
    assert.equal(preview.moveBuilding(model, id, -1), false);
    assert.equal(preview.moveBuilding(model, id, 7), true);
    assert.equal(preview.buildingAt(model, 6), null);
    assert.equal(preview.buildingAt(model, 7), id);
    assert.deepEqual(model.world.get(id, 'Building'), { type: 'reactor' });
});

test('observed buildings and links follow tile attention without implying dependency', () => {
    const model = fresh();
    const first = preview.placeBuilding(model, 'reactor', 6);
    const second = preview.placeBuilding(model, 'factory', 7);
    preview.placeBuilding(model, 'lab', 18);
    assert.equal(preview.setObserved(model, [6, 7, 11]), true);
    assert.deepEqual(preview.observedBuildings(model), [first, second]);
    assert.deepEqual(preview.attentionLinks(model), [[6, 7]]);
    assert.equal(preview.setObserved(model, [6, 99]), false);
    assert.deepEqual(preview.attentionLinks(model), [[6, 7]]);
    assert.equal(preview.setObserved(model, [6]), true);
    assert.deepEqual(preview.observedBuildings(model), [first]); // isolated nodes stay active
    assert.deepEqual(preview.attentionLinks(model), []);
});

test('main menu starts first, while VNext and legacy GameScene remain reachable', () => {
    const root = path.resolve(__dirname, '..');
    const bootstrap = fs.readFileSync(path.join(root, 'src/main.js'), 'utf8');
    const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
    const scene = fs.readFileSync(path.join(root, 'src/scene/VNextScene.js'), 'utf8');
    const hud = fs.readFileSync(path.join(root, 'src/scene/VNextHudView.js'), 'utf8');
    assert.match(bootstrap, /config\.scene\s*=\s*\[\s*MainMenuScene,\s*VNextScene/);
    assert.match(html, /src\/core\/VNextPreview\.js/);
    assert.match(html, /src\/scene\/VNextScene\.js/);
    assert.match(hud, /this\.scene\.start\('GameScene'\)/);
    const simulation = fs.readFileSync(path.join(root, 'src/scene/VNextSimulation.js'), 'utf8');
    assert.match(simulation, /OverseerCombat\.stepUnit/);
});

test('browser loads VNextVision before VNextScene references it', () => {
    const html = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
    const moduleIndex = html.indexOf('src/core/VNextVision.js');
    const sceneIndex = html.indexOf('src/scene/VNextScene.js');
    assert.ok(moduleIndex >= 0, 'vision module must be included');
    assert.ok(sceneIndex > moduleIndex, 'vision module must load before the scene');
});

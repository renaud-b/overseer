'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { validate } = require('../src/core/GameData.js');

const ROOT = path.resolve(__dirname, '..');

test('all runtime scripts are served locally and exist after npm install', () => {
    const html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
    const scripts = [...html.matchAll(/<script\s+src="([^"]+)"/g)];
    assert.ok(scripts.length > 0);
    for (const [, src] of scripts) {
        assert.doesNotMatch(src, /^https?:\/\//, 'Remote runtime script: ' + src);
        assert.ok(fs.existsSync(path.join(ROOT, src)), 'Missing script: ' + src);
    }
});

test('wave telemetry loads before VNextScene on the actual browser path', () => {
    const html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
    const scripts = [...html.matchAll(/<script\s+src="([^"]+)"/g)].map(match => match[1]);
    assert.ok(scripts.indexOf('src/core/VNextWaveTelemetry.js') > 0);
    assert.ok(scripts.indexOf('src/core/VNextWaveTelemetry.js') < scripts.indexOf('src/scene/VNextScene.js'));
});

test('VNext vision rules are loaded before the scene that uses them', () => {
    const html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
    const scripts = [...html.matchAll(/<script\s+src="([^"]+)"/g)].map(match => match[1]);
    const rules = 'src/core/VNextVision.js';
    const scene = 'src/scene/VNextScene.js';
    assert.ok(scripts.includes(rules), 'Missing VNextVision browser dependency');
    assert.ok(scripts.indexOf(rules) < scripts.indexOf(scene),
        'VNextVision must load before VNextScene');

    // The browser script must expose the global consumed by VNextScene,
    // not just exist on disk (scene unit tests inject this global themselves).
    const vm = require('node:vm');
    const context = {};
    vm.runInNewContext(fs.readFileSync(path.join(ROOT, rules), 'utf8'), context);
    assert.equal(typeof context.OverseerVNextVision?.purchase, 'function');
    assert.equal(typeof context.OverseerVNextVision?.nextCost, 'function');
});

test('static GameScene assets resolve in the repository', () => {
    const src = fs.readFileSync(path.join(ROOT, 'src/scene/GameScene.js'), 'utf8');
    const re = /this\.load\.(?:image|json)\(\s*['"][^'"]+['"]\s*,\s*['"]([^'"]+)['"]/g;
    for (const [, asset] of src.matchAll(re)) {
        assert.ok(fs.existsSync(path.join(ROOT, asset)), 'Missing asset: ' + asset);
    }
});

test('local GameStats is complete and well-formed', () => {
    const stats = require('../assets/game_stats.json');
    const result = validate(stats);
    assert.deepEqual(result.errors, []);
    assert.equal(result.ok, true);
    assert.ok(stats.buildings.length > 0);
    assert.ok(stats.enemies.length > 0);
    assert.ok(stats.units.length > 0);
});

test('GameScene loads local GameStats and never calls a remote contract', () => {
    const src = fs.readFileSync(path.join(ROOT, 'src/scene/GameScene.js'), 'utf8');
    assert.match(src, /this\.load\.json\('gameStats', 'assets\/game_stats\.json'\)/);
    assert.doesNotMatch(src, /Wormhole|executeContract|utopixia\.com/i);
});

test('bad GameStats fails validation instead of partially starting a game', () => {
    assert.equal(validate(null).ok, false);
    assert.equal(validate({ resources: [] }).ok, false);
    const stats = Object.fromEntries(
        ['resources', 'buildings', 'enemies', 'units', 'artifacts', 'spells'].map(k => [k, []])
    );
    stats.units = [{ id: 'duplicate' }, { id: 'duplicate' }];
    assert.equal(validate(stats).ok, false);
});

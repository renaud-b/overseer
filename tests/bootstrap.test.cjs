'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

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


test('VNext combat roster source remains locally available', () => {
    const stats = require('../assets/game_stats.json');
    assert.ok(Array.isArray(stats.enemies) && stats.enemies.length > 0);
    assert.ok(Array.isArray(stats.units) && stats.units.length > 0);
    const scene = fs.readFileSync(path.join(ROOT, 'src/scene/VNextScene.js'), 'utf8');
    assert.match(scene, /assets\/game_stats\.json/);
});




test('VNext tooltip presentation loads before the scene in the browser', () => {
    const html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
    const scripts = [...html.matchAll(/<script\s+src="([^"]+)"/g)].map(match => match[1]);
    const tooltip = 'src/scene/VNextTooltips.js';
    const scene = 'src/scene/VNextScene.js';
    assert.ok(scripts.includes(tooltip), 'Missing tooltip presentation script');
    assert.ok(scripts.indexOf(tooltip) < scripts.indexOf(scene),
        'Tooltip presentation must load before the scene installs its methods');
    const vm = require('node:vm');
    const context = {};
    vm.runInNewContext(fs.readFileSync(path.join(ROOT, tooltip), 'utf8'), context);
    assert.equal(typeof context.OverseerVNextTooltips?.install, 'function');
});


test('VNext board presentation loads before VNextScene', () => {
    const html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
    const scripts = [...html.matchAll(/<script\s+src="([^"]+)"/g)].map(match => match[1]);
    const tooltip = 'src/scene/VNextTooltips.js';
    const board = 'src/scene/VNextBoardView.js';
    const scene = 'src/scene/VNextScene.js';
    assert.ok(scripts.includes(board), 'Missing board presentation module');
    assert.ok(scripts.indexOf(tooltip) < scripts.indexOf(board));
    assert.ok(scripts.indexOf(board) < scripts.indexOf(scene));
    const vm = require('node:vm');
    const context = {};
    vm.runInNewContext(fs.readFileSync(path.join(ROOT, board), 'utf8'), context);
    assert.equal(typeof context.OverseerVNextBoardView?.install, 'function');
});


test('VNext battle presentation loads after board view and before VNextScene', () => {
    const html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
    const scripts = [...html.matchAll(/<script\s+src="([^"]+)"/g)].map(match => match[1]);
    const board = 'src/scene/VNextBoardView.js';
    const battle = 'src/scene/VNextBattleView.js';
    const scene = 'src/scene/VNextScene.js';
    assert.ok(scripts.includes(battle), 'Missing battlefield presentation module');
    assert.ok(scripts.indexOf(board) < scripts.indexOf(battle));
    assert.ok(scripts.indexOf(battle) < scripts.indexOf(scene));
    const vm = require('node:vm');
    const context = {};
    vm.runInNewContext(fs.readFileSync(path.join(ROOT, battle), 'utf8'), context);
    assert.equal(typeof context.OverseerVNextBattleView?.install, 'function');
});


test('VNext HUD, wave and reward presentations load after battle view, before scene', () => {
    const html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
    const scripts = [...html.matchAll(/<script\s+src="([^"]+)"/g)].map(match => match[1]);
    const relative = [
        'src/scene/VNextBattleView.js',
        'src/scene/VNextHudView.js',
        'src/scene/VNextWaveView.js',
        'src/scene/VNextRewardView.js',
        'src/scene/VNextScene.js'
    ];
    for (let i = 0; i < relative.length; i++) {
        assert.ok(scripts.includes(relative[i]), 'Missing script: ' + relative[i]);
        if (i) assert.ok(scripts.indexOf(relative[i-1]) < scripts.indexOf(relative[i]),
            'Incorrect load order: ' + relative[i]);
    }
    const vm = require('node:vm');
    for (const pathName of relative.slice(1,-1)) {
        const context = {};
        vm.runInNewContext(fs.readFileSync(path.join(ROOT, pathName), 'utf8'), context);
        const exported = 'Overseer' + pathName.split('/').pop().replace(/\.js$/, '');
        assert.equal(typeof context[exported]?.install, 'function', exported);
    }
});


test('VNext input, run flow and simulation modules load before VNextScene', () => {
    const html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
    const scripts = [...html.matchAll(/<script\s+src="([^"]+)"/g)].map(match => match[1]);
    const modules = ['src/scene/VNextInput.js', 'src/scene/VNextRunFlow.js',
        'src/scene/VNextSimulation.js'];
    const sceneIndex = scripts.indexOf('src/scene/VNextScene.js');
    for (const module of modules) {
        assert.ok(scripts.indexOf(module) !== -1 && scripts.indexOf(module) < sceneIndex,
            'Missing or late simulation dependency: ' + module);
    }
    const vm = require('node:vm');
    for (const module of modules) {
        const context = {};
        vm.runInNewContext(fs.readFileSync(path.join(ROOT, module), 'utf8'), context);
        const api = 'Overseer' + module.split('/').pop().replace(/\.js$/, '');
        const method = module.endsWith('Simulation.js') ? 'step' : 'install';
        assert.equal(typeof context[api]?.[method], 'function', api);
    }
});

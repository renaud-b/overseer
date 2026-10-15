'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { validate } = require('../src/core/GameData.js');

const ROOT = path.resolve(__dirname, '..');

test('local classic scripts referenced in index.html exist', () => {
    const html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
    const scripts = [...html.matchAll(/<script\s+src="([^"]+)"/g)];
    for (const [, src] of scripts) {
        if (/^https?:\/\//.test(src)) continue;
        assert.ok(fs.existsSync(path.join(ROOT, src)), 'Missing script: ' + src);
    }
});

test('static GameScene assets resolve in the repository', () => {
    const src = fs.readFileSync(path.join(ROOT, 'src/scene/GameScene.js'), 'utf8');
    const re = /this\.load\.(?:image|json)\(\s*['"][^'"]+['"]\s*,\s*['"]([^'"]+)['"]/g;
    for (const [, asset] of src.matchAll(re)) {
        assert.ok(fs.existsSync(path.join(ROOT, asset)), 'Missing asset: ' + asset);
    }
});

test('contract fixture contains complete and well-formed GameStats categories', () => {
    const src = fs.readFileSync(path.join(ROOT, 'src/smart-contracts/GameStats.js'), 'utf8');
    const stats = vm.runInNewContext(src + '\ncurrentGameStats', {});
    assert.equal(validate(stats).ok, true);
});

test('bad GameStats fails validation instead of partially starting a game', () => {
    assert.deepEqual(validate(null).ok, false);
    assert.deepEqual(validate({ resources: [] }).ok, false);
    const stats = Object.fromEntries(['resources','buildings','enemies','units','artifacts','spells'].map(k => [k, []]));
    stats.units = [{ id: 'duplicate' }, { id: 'duplicate' }];
    assert.equal(validate(stats).ok, false);
});

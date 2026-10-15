'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const waves = require('../src/core/VNextWaves.js');
test('wave plan always uses one enemy type with increasing randomized counts', () => {
    const a = waves.preview(30, 981);
    assert.equal(a.length, 30);
    assert.deepEqual(a, waves.preview(30, 981));
    assert.ok(a.every(w => w.enemies.length === 1 && w.enemies[0].type === 'basic_monster'));
    assert.ok(a.every((w, i) => i === 0 || w.enemies[0].count > a[i - 1].enemies[0].count));
    assert.ok(a.some((w, i) => w.enemies[0].count !== waves.preview(30, 13)[i].enemies[0].count));
    assert.ok(a.every(w => !('rewards' in w)));
});

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

test('wave clock triggers every 60 simulation seconds and respects pause by zero delta', () => {
 const state = { number: 0, elapsedMs: 0, seed: 137 };
 assert.equal(waves.advance(state, 59999).length, 0);
 assert.equal(waves.advance(state, 0).length, 0);
 assert.equal(waves.advance(state, 1).length, 1);
 assert.equal(state.number, 1);
 assert.equal(waves.advance(state, 120000).length, 2);
 assert.equal(state.number, 3);
 const fast = { number: 0, elapsedMs: 0, seed: 137 };
 for (let i=0;i<200;i++) waves.advance(fast, 60*5);
 assert.equal(fast.number, 1);
});

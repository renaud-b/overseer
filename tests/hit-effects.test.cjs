'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { HitEffects, tintColor } = require('../src/scene/effects/HitEffects.js');

test('recoil is away from attacker, relative to unit radius, and decays to rest', () => {
    const effects = new HitEffects();
    const attacker = { x: 100, y: 200 }, defender = { x: 100, y: 220 };
    effects.hit(42, attacker, defender);
    effects.update(55);
    const visual = effects.view(42);
    assert.ok(visual.y > 0 && visual.y <= 0.68);
    assert.equal(visual.x, 0);
    assert.deepEqual(attacker, { x: 100, y: 200 });
    assert.deepEqual(defender, { x: 100, y: 220 });
    effects.update(200);
    assert.deepEqual(effects.view(42), { x: 0, y: 0, flash: 0 });
});

test('overlapping positions get finite recoil and repeated hits do not stack', () => {
    const effects = new HitEffects();
    effects.hit(9, { x: 0, y: 0 }, { x: 0, y: 0 });
    effects.update(65);
    assert.ok(Number.isFinite(effects.view(9).x));
    assert.equal(effects.view(9).y, 0);
    effects.hit(9, { x: 5, y: 0 }, { x: 0, y: 0 });
    effects.update(40);
    assert.ok(effects.view(9).x < 0);
    assert.equal(effects.hits.size, 1);
});

test('a short double flash preserves source colors and clears independently of simulation', () => {
    const effects = new HitEffects();
    effects.hit(1, { x: 0, y: 0 }, { x: 5, y: 0 });
    assert.equal(tintColor(0x38d9f1, effects.view(1).flash), 0xffffff);
    effects.update(85);
    assert.equal(effects.view(1).flash, 0);
    effects.update(40);
    assert.ok(effects.view(1).flash > 0);
    assert.equal(tintColor(0x112233, 0), 0x112233);
    assert.equal(tintColor(0x112233, 1), 0xffffff);
    effects.update(105);
    assert.equal(effects.hits.size, 0);
    effects.hit(2, { x: 1, y: 0 }, { x: 0, y: 0 });
    effects.update(0);
    assert.equal(effects.view(2).flash, 1);
    effects.clear();
    assert.equal(effects.hits.size, 0);
});

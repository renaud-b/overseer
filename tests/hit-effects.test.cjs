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

test('impact fragments retain unit color and position even after a lethal impact', () => {
    const fx = new HitEffects();
    const attacker = { x: 0, y: 0 };
    const target = { x: 100, y: 120 };
    fx.hit(71, attacker, target, 0x38d9f1);
    target.x = -1000; // As if the target died or moved after impact.
    const initial = fx.fragments();
    assert.equal(initial.length, 5);
    assert.ok(initial.every(p => p.x === 100 && p.y === 120 && p.color === 0x38d9f1));
    fx.update(120);
    const airborne = fx.fragments();
    assert.ok(airborne.some((p, i) => p.x !== initial[i].x || p.y !== initial[i].y));
    assert.ok(airborne.every(p => p.alpha > 0 && p.alpha < 1));
    fx.update(500);
    assert.equal(fx.fragments().length, 0);
});

test('fragments are bounded under continuous simultaneous hits and freeze on pause', () => {
    const fx = new HitEffects();
    for (let id = 0; id < 500; id++)
        fx.hit(id, { x: id + 1, y: 0 }, { x: id, y: 0 }, 0xff5c79);
    assert.ok(fx.particles.length <= 180);
    const snapshot = fx.fragments();
    fx.update(0);
    assert.deepEqual(fx.fragments(), snapshot);
    fx.clear();
    assert.equal(fx.fragments().length, 0);
});

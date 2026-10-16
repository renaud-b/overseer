'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { styleFor } = require('../src/scene/effects/BattleUnitStyles.js');
const { BattleActionEffects } = require('../src/scene/effects/BattleActionEffects.js');

test('guards, snipers, mechas and drones have unique noncombat display identities', () => {
    const types = ['unit_guard', 'unit_sniper', 'unit_mecha', 'unit_dronoid'];
    const identities = types.map(type => styleFor(type, 'player'));
    assert.equal(new Set(identities.map(x => x.color)).size, 4);
    assert.equal(new Set(identities.map(x => x.shape)).size, 4);
    assert.equal(styleFor('unknown', 'player').shape, 'triangle');
    assert.equal(styleFor('basic_monster', 'enemy').shape, 'circle');
});

test('laser snapshots source and destination, fades and is bounded', () => {
    const actions = new BattleActionEffects();
    const from = { x: 12, y: 24 }, to = { x: 35, y: 66 };
    assert.equal(actions.laser(from, to, 0xf6bf69), true);
    from.x = 900; to.y = 900; // Moving or dying units cannot move existing effects.
    const initial = actions.visuals()[0];
    assert.deepEqual(initial.from, { x: 12, y: 24 });
    assert.deepEqual(initial.to, { x: 35, y: 66 });
    assert.equal(initial.kind, 'laser');
    actions.update(80);
    assert.ok(actions.visuals()[0].alpha < 1 && actions.visuals()[0].alpha > 0);
    actions.update(80);
    assert.equal(actions.visuals().length, 0);
    assert.equal(actions.laser(null, to, 0xff0000), false);
    for (let i = 0; i < 100; i++)
        actions.laser({ x: i, y: 0 }, { x: i, y: 5 }, 0xffffff);
    assert.ok(actions.entries.length <= 48);
    actions.clear();
    assert.equal(actions.visuals().length, 0);
});

test('healing creates a longer green reaction and never shares laser identity', () => {
    const actions = new BattleActionEffects();
    const from = { x: 10, y: 20 }, to = { x: 50, y: 30 };
    assert.equal(actions.heal(from, to), true);
    const visual = actions.visuals()[0];
    assert.equal(visual.kind, 'heal');
    assert.equal(visual.color, styleFor('unit_dronoid', 'player').color);
    to.x = 1000;
    actions.update(175);
    const middle = actions.visuals()[0];
    assert.deepEqual(middle.to, { x: 50, y: 30 });
    assert.ok(middle.alpha > 0 && middle.alpha < 1);
    assert.ok(middle.progress > 0 && middle.progress < 1);
    actions.update(175);
    assert.equal(actions.visuals().length, 0);
});

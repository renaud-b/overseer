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

test('six known enemy archetypes have distinguishable rendering identities', () => {
    const types = ['basic_monster', 'ranged_monster', 'base_rusher', 'stalker', 'mother_slime', 'baby_slime'];
    const identities = types.map(type => styleFor(type, 'enemy'));
    assert.equal(new Set(identities.map(style => style.color)).size, types.length);
    assert.equal(styleFor('basic_monster', 'enemy').shape, 'circle');
    assert.equal(styleFor('ranged_monster', 'enemy').shape, 'diamond');
    assert.equal(styleFor('base_rusher', 'enemy').shape, 'hexagon');
    assert.ok(styleFor('baby_slime', 'enemy').size < styleFor('mother_slime', 'enemy').size);
    assert.equal(styleFor('mystery', 'enemy').shape, 'circle');
    const labels = require('../src/scene/effects/BattleUnitStyles.js');
    assert.equal(labels.enemyLabel('base_rusher'), 'Percuteur');
    assert.equal(labels.enemyLabel('mystery'), 'mystery');
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

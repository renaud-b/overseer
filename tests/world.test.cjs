'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { World } = require('../src/core/World.js');

test('entities have stable identifiers and queryable components', () => {
    const world = new World();
    const a = world.create();
    const b = world.create();
    world.set(a, 'Position', { x: 1, y: 2 }).set(a, 'Health', { hp: 3 });
    world.set(b, 'Position', { x: 4, y: 5 });
    assert.deepEqual(world.query('Position'), [a, b]);
    assert.deepEqual(world.query('Position', 'Health'), [a]);
    assert.deepEqual(world.get(a, 'Health'), { hp: 3 });
    assert.equal(world.get(b, 'Health'), undefined);
});

test('parent and children are explicit scene graph relationships', () => {
    const world = new World();
    const game = world.create();
    const tile = world.create(game);
    const building = world.create(tile);
    assert.deepEqual(world.children(game), [tile]);
    assert.deepEqual(world.children(tile), [building]);
    world.destroy(tile);
    assert.equal(world.has(tile), false);
    assert.equal(world.has(building), false);
    assert.deepEqual(world.children(game), []);
});

test('unknown parents, entities and non-data components are rejected', () => {
    const world = new World();
    assert.throws(() => world.create(100));
    assert.throws(() => world.set(100, 'Health', { hp: 1 }));
    const id = world.create();
    assert.throws(() => world.set(id, 'Behavior', () => {}));
    assert.throws(() => world.set(id, '', { hp: 1 }));
});

test('systems can be written without importing Phaser', () => {
    const world = new World();
    const unit = world.create();
    world.set(unit, 'Position', { x: 1, y: 1 });
    world.set(unit, 'Velocity', { x: 2, y: 3 });
    const movement = (w, dt) => {
        for (const id of w.query('Position', 'Velocity')) {
            const p = w.get(id, 'Position'), v = w.get(id, 'Velocity');
            p.x += v.x * dt;
            p.y += v.y * dt;
        }
    };
    movement(world, 2);
    assert.deepEqual(world.get(unit, 'Position'), { x: 5, y: 7 });
});

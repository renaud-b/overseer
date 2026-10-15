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


test('ECS serialization retains entity ids, ownership, data and nextId', () => {
    const world = new World();
    const root = world.create();
    const child = world.create(root);
    const leaf = world.create(child);
    world.set(root, 'Resources', { energy: 3, matter: 2 });
    world.set(child, 'BuildingHand', { cards: ['reactor', 'reactor'] });
    world.set(leaf, 'Health', { hp: 7, maxHp: 10 });
    world.destroy(child);
    const later = world.create(root);
    world.set(later, 'Position', { x: 9, y: 8 });
    const json = JSON.parse(JSON.stringify(world.serialize()));
    const restored = World.restore(json);
    assert.deepEqual(restored.serialize(), json);
    assert.equal(restored.get(root, 'Resources').energy, 3);
    assert.deepEqual(restored.children(root), [later]);
    assert.equal(restored.create(root), world.nextId);
    restored.get(root, 'Resources').energy = 100;
    assert.equal(world.get(root, 'Resources').energy, 3);
});

test('invalid ownership and entity counters are rejected on restore', () => {
    const world = new World();
    const game = world.create();
    const child = world.create(game);
    const snapshot = world.serialize();
    assert.throws(() => World.restore({ ...snapshot, nextId: child }));
    assert.throws(() => World.restore({
        ...snapshot, entities: snapshot.entities.map(e => ({ ...e, parent: 1234 }))
    }));
    assert.throws(() => World.restore({
        ...snapshot, entities: [{ id: game, parent: child, components: [] }, { id: child, parent: game, components: [] }]
    }));
});

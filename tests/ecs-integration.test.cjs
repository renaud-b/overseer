'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { World } = require('../src/core/World.js');

test('a watched tile activates its child production node', () => {
    const w = new World();
    const game = w.create();
    const grid = w.create(game);
    w.set(grid, 'Grid', { width: 5, height: 5 });
    const tile = w.create(grid);
    w.set(tile, 'Tile', { index: 0, x: 0, y: 0 });
    w.set(tile, 'Watched', { active: false });
    const building = w.create(tile);
    w.set(building, 'Building', { type: 'condensor', produces: 'hydronium', producesType: 'resource' });
    w.set(building, 'Production', { elapsedMs: 0, cooldownMs: 1000 });

    const tick = (delta) => {
        for (const id of w.query('Building', 'Production')) {
            const parentTile = w.entity(id).parent;
            if (!w.get(parentTile, 'Watched').active) continue;
            w.get(id, 'Production').elapsedMs += delta;
        }
    };
    tick(500);
    assert.equal(w.get(building, 'Production').elapsedMs, 0);
    w.get(tile, 'Watched').active = true;
    tick(500);
    assert.equal(w.get(building, 'Production').elapsedMs, 500);
    w.get(tile, 'Watched').active = false;
    tick(500);
    assert.equal(w.get(building, 'Production').elapsedMs, 500);
});

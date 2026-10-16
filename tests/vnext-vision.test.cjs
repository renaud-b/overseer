'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const vision = require('../src/core/VNextVision.js');

test('vision purchases have explicit, provisional Data prices and stop at six cells', () => {
    assert.deepEqual(vision.DATA_COSTS, [10, 25, 50]);
    assert.equal(vision.nextCost(0), 10);
    assert.equal(vision.nextCost(3), null);
    const resources = { data: 10 };
    const attention = { x: 1, y: 1 };
    const expanded = vision.purchase(0, resources, attention,
        [{ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 0, y: 1 }, { x: 1, y: 1 }]);
    assert.deepEqual(expanded, { level: 1, attention, cost: 10 });
    assert.equal(resources.data, 0);
    assert.equal(vision.purchase(3, { data: 100 }, attention, [{ x: 0, y: 0 }]), null);
});

test('vision purchase is atomic without Data, valid coordinates or a next shape', () => {
    const resources = { data: 9 };
    assert.equal(vision.purchase(0, resources, { x: 1, y: 1 }, [{ x: 0, y: 0 }]), null);
    assert.equal(resources.data, 9);
    resources.data = 10;
    assert.equal(vision.purchase(0, resources, { x: 1, y: 1 }, []), null);
    assert.equal(resources.data, 10);
    assert.equal(vision.purchase(0, resources, { x: 1, y: 1 }, [{ x: 7, y: 0 }]), null);
    assert.equal(resources.data, 10);
});

test('attention anchor clamps to board without changing orientation', () => {
    assert.deepEqual(vision.fitAttention({ x: 4, y: 4 },
        [{ x: 0, y: 0 }, { x: -1, y: 0 }, { x: -1, y: 2 }]), { x: 4, y: 2 });
    assert.deepEqual(vision.fitAttention({ x: 0, y: 0 },
        [{ x: -1, y: 0 }, { x: 0, y: 2 }]), { x: 1, y: 0 });
    assert.equal(vision.fitAttention({ x: 2, y: 2 }, [{ x: 5, y: 0 }]), null);
});

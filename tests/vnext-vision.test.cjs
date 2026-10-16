'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const vision = require('../src/core/VNextVision.js');

test('vision purchases have explicit, provisional Data prices and stop at six cells', () => {
    assert.deepEqual(vision.DATA_COSTS, [30, 90, 240]);
    assert.equal(vision.nextCost(0), 30);
    assert.equal(vision.nextCost(1), 90);
    assert.equal(vision.nextCost(2), 240);
    assert.equal(vision.nextCost(3), null);
    const resources = { data: 30 };
    const attention = { x: 1, y: 1 };
    const expanded = vision.purchase(0, resources, attention,
        [{ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 0, y: 1 }, { x: 1, y: 1 }]);
    assert.deepEqual(expanded, { level: 1, attention, cost: 30 });
    assert.equal(resources.data, 0);
    assert.equal(vision.purchase(3, { data: 100 }, attention, [{ x: 0, y: 0 }]), null);
});

test('vision purchase is atomic without Data, valid coordinates or a next shape', () => {
    const resources = { data: 29 };
    assert.equal(vision.purchase(0, resources, { x: 1, y: 1 }, [{ x: 0, y: 0 }]), null);
    assert.equal(resources.data, 29);
    resources.data = 30;
    assert.equal(vision.purchase(0, resources, { x: 1, y: 1 }, []), null);
    assert.equal(resources.data, 30);
    assert.equal(vision.purchase(0, resources, { x: 1, y: 1 }, [{ x: 7, y: 0 }]), null);
    assert.equal(resources.data, 30);
});

test('each new tier requires its full Data price before any balance is deducted', () => {
    const square = [{ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 0, y: 1 }, { x: 1, y: 1 }];
    const at = { x: 1, y: 1 };
    for (const [level, price] of [[0, 30], [1, 90], [2, 240]]) {
        const resources = { data: price - 1 };
        assert.equal(vision.purchase(level, resources, at, square), null);
        assert.equal(resources.data, price - 1);
        resources.data = price;
        const purchase = vision.purchase(level, resources, at, square);
        assert.equal(purchase?.level, level + 1);
        assert.equal(purchase?.cost, price);
        assert.equal(resources.data, 0);
    }
});

test('attention anchor clamps to board without changing orientation', () => {
    assert.deepEqual(vision.fitAttention({ x: 4, y: 4 },
        [{ x: 0, y: 0 }, { x: -1, y: 0 }, { x: -1, y: 2 }]), { x: 4, y: 2 });
    assert.deepEqual(vision.fitAttention({ x: 0, y: 0 },
        [{ x: -1, y: 0 }, { x: 0, y: 2 }]), { x: 1, y: 0 });
    assert.equal(vision.fitAttention({ x: 2, y: 2 }, [{ x: 5, y: 0 }]), null);
});

'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { BUILDINGS, getBuilding } = require('../src/core/VNextBuildings.js');

test('VNext building catalog has 13 distinct named archetypes', () => {
    assert.equal(BUILDINGS.length, 13);
    assert.equal(new Set(BUILDINGS.map(b => b.id)).size, 13);
    assert.equal(BUILDINGS.filter(b => b.group === 'military').length, 4);
    for (const building of BUILDINGS) {
        assert.ok(building.label && building.description);
        assert.ok(Number.isInteger(building.color));
        assert.equal(getBuilding(building.id), building);
    }
});

test('undecided mechanics remain explicitly planned', () => {
    assert.equal(getBuilding('attention_relay').status, 'planned');
    assert.equal(getBuilding('jammer').status, 'planned');
    assert.equal(getBuilding('barracks').status, 'planned');
    assert.equal(getBuilding('absent'), null);
    assert.ok(!Object.hasOwn(getBuilding('cryopump'), 'recipe'));
    assert.ok(!Object.hasOwn(getBuilding('barracks'), 'constructionCost'));
});

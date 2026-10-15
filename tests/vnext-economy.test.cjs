'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { World } = require('../src/core/World.js');
const preview = require('../src/core/VNextPreview.js');
const economy = require('../src/core/VNextEconomy.js');

function make() {
    const model = preview.createModel(World);
    const reactor = preview.placeBuilding(model, 'reactor', 6);
    const extractor = preview.placeBuilding(model, 'extractor', 7);
    const factory = preview.placeBuilding(model, 'factory', 11);
    preview.placeBuilding(model, 'laboratory', 18);
    economy.initialize(model);
    preview.setObserved(model, [6, 7, 11]);
    return { model, reactor, extractor, factory, resources: model.world.get(model.game, 'Resources') };
}

test('reactor and extractor produce only after watched cycles; factory converts both into components', () => {
    const { model, reactor, extractor, factory, resources } = make();
    assert.equal(economy.step(model, 1999).length, 0);
    assert.deepEqual(resources, { energy: 0, matter: 0, components: 0 });
    const first = economy.step(model, 1);
    assert.deepEqual(first.map(e => e.building), [reactor, extractor]);
    assert.deepEqual(resources, { energy: 2, matter: 2, components: 0 });
    const next = economy.step(model, 1000);
    assert.deepEqual(next.map(e => e.building), [factory]);
    assert.deepEqual(resources, { energy: 0, matter: 0, components: 1 });
    assert.equal(model.world.get(factory, 'Production').elapsedMs, 0);
});

test('out of vision freezes production progress without catchup; paused delta changes nothing', () => {
    const { model, reactor, resources } = make();
    economy.step(model, 1200);
    const before = model.world.get(reactor, 'Production').elapsedMs;
    preview.setObserved(model, [11]);
    economy.step(model, 30000);
    assert.equal(model.world.get(reactor, 'Production').elapsedMs, before);
    assert.equal(resources.energy, 0);
    preview.setObserved(model, [6]);
    assert.deepEqual(economy.step(model, 0), []);
    economy.step(model, 800);
    assert.equal(resources.energy, 2);
    assert.equal(model.world.get(reactor, 'Production').elapsedMs, 0);
});

test('factory never spends incomplete inputs and retries when material becomes available', () => {
    const { model, factory, resources } = make();
    preview.setObserved(model, [11]);
    assert.deepEqual(economy.step(model, 3000), []);
    let progress = model.world.get(factory, 'Production');
    assert.equal(progress.blocked, true);
    assert.equal(progress.elapsedMs, 3000);
    resources.energy = 2;
    economy.step(model, 2000);
    assert.deepEqual(resources, { energy: 2, matter: 0, components: 0 });
    assert.equal(progress.elapsedMs, 3000);
    resources.matter = 2;
    assert.deepEqual(economy.step(model, 1).map(e => e.building), [factory]);
    assert.deepEqual(resources, { energy: 0, matter: 0, components: 1 });
    assert.equal(progress.blocked, false);
});

test('newly placed buildings get production; relocated buildings use current watched grid slot', () => {
    const { model, reactor, resources } = make();
    preview.setObserved(model, [12]);
    const added = preview.placeBuilding(model, 'reactor', 12);
    economy.step(model, 2000);
    assert.ok(model.world.hasComponent(added, 'Production'));
    assert.equal(resources.energy, 2);
    assert.equal(model.world.get(reactor, 'Production').elapsedMs, 0);
    assert.equal(preview.moveBuilding(model, added, 23), true);
    economy.step(model, 5000);
    assert.equal(resources.energy, 2);
    preview.setObserved(model, [23]);
    economy.step(model, 2000);
    assert.equal(resources.energy, 4);
});

test('simulated balance and production components survive repeated initialization', () => {
    const { model, reactor, resources } = make();
    economy.step(model, 4000);
    assert.equal(resources.energy, 2); // Four produced, two consumed by the factory.
    assert.equal(resources.components, 1);
    const production = model.world.get(reactor, 'Production');
    assert.equal(economy.initialize(model), resources);
    assert.equal(model.world.get(reactor, 'Production'), production);
    assert.equal(resources.energy, 2);
    assert.equal(model.world.query('Production').length, 3);
    assert.throws(() => economy.step(model, -1), /Invalid simulation delta/);
});

test('barracks only consumes 50 components and 30 energy when watched and affordable', () => {
    const model = preview.createModel(World);
    const id = preview.placeBuilding(model, 'barracks', 6);
    economy.initialize(model);
    const balance = model.world.get(model.game, 'Resources');
    balance.components = 49; balance.energy = 30;
    preview.setObserved(model, [6]);
    assert.deepEqual(economy.step(model, 60), []);
    assert.equal(model.world.get(id, 'Production').blocked, true);
    balance.components = 50;
    const events = economy.step(model, 60);
    assert.equal(events.length, 1);
    assert.equal(events[0].type, 'unit-produced');
    assert.equal(events[0].unitType, 'unit_guard');
    assert.equal(balance.components, 0);
    assert.equal(balance.energy, 0);
    assert.deepEqual(economy.step(model, 60), []);
});

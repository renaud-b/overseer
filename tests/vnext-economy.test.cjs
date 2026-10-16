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

test('barracks needs five observed seconds and spends resources only at completion', () => {
    const model = preview.createModel(World);
    const id = preview.placeBuilding(model, 'barracks', 6);
    economy.initialize(model);
    const balance = model.world.get(model.game, 'Resources');
    balance.components = 24; balance.energy = 15;
    preview.setObserved(model, [6]);
    assert.equal(economy.PROTOTYPE_RECIPES.barracks.cycleMs, 5000);
    assert.deepEqual(economy.step(model, 4999), []);
    assert.equal(model.world.get(id, 'Production').elapsedMs, 4999);
    assert.equal(model.world.get(id, 'Production').blocked, false);
    assert.deepEqual({ ...balance }, { energy: 15, matter: 0, components: 24 });

    assert.deepEqual(economy.step(model, 1), []);
    assert.equal(model.world.get(id, 'Production').elapsedMs, 5000);
    assert.equal(model.world.get(id, 'Production').blocked, true, 'finished work waits for materials');
    balance.components = 25;
    const events = economy.step(model, 1);
    assert.equal(events.length, 1);
    assert.equal(events[0].type, 'unit-produced');
    assert.equal(events[0].unitType, 'unit_guard');
    assert.equal(model.world.get(id, 'Production').elapsedMs, 0);
    assert.deepEqual({ ...balance }, { energy: 0, matter: 0, components: 0 });
    assert.deepEqual(economy.step(model, 60), [], 'cannot instantly produce another soldier');
});

test('military manufacturing pauses outside vision and resumes its saved progress', () => {
    const model = preview.createModel(World);
    const id = preview.placeBuilding(model, 'barracks', 6);
    economy.initialize(model);
    const balance = model.world.get(model.game, 'Resources');
    balance.components = 25; balance.energy = 15;
    preview.setObserved(model, [6]);
    assert.deepEqual(economy.step(model, 2300), []);
    preview.setObserved(model, []);
    assert.deepEqual(economy.step(model, 30000), []);
    assert.equal(model.world.get(id, 'Production').elapsedMs, 2300);
    assert.deepEqual(economy.step(model, 0), []);
    preview.setObserved(model, [6]);
    assert.deepEqual(economy.step(model, 2699), []);
    assert.deepEqual({ ...balance }, { energy: 15, matter: 0, components: 25 });
    assert.equal(economy.step(model, 1)[0].unitType, 'unit_guard');
    assert.deepEqual({ ...balance }, { energy: 0, matter: 0, components: 0 });
});

test('each barracks raises living guard cap by three, without spending resources at cap', () => {
    const model = preview.createModel(World);
    const barracks = preview.placeBuilding(model, 'barracks', 6);
    economy.initialize(model);
    preview.setObserved(model, [6]);
    const resources = model.world.get(model.game, 'Resources');
    resources.components = 200; resources.energy = 200;
    const spawn = () => {
        const id = model.world.create(model.game);
        model.world.set(id, 'PreviewUnit', { type: 'unit_guard' });
        model.world.set(id, 'Health', { hp: 7 });
        model.world.set(id, 'Faction', { side: 'player' });
        return id;
    };
    assert.equal(economy.unitCapacity(model, 'barracks'), 3);
    const initial = economy.step(model, 15000);
    assert.equal(initial.length, 3, 'large deltas may finish several cycles, never exceeding the cap');
    assert.ok(initial.every(e => e.unitType === 'unit_guard'));
    initial.forEach(spawn);
    assert.equal(economy.aliveUnits(model, 'barracks'), 3);
    assert.deepEqual({ ...resources }, { energy: 155, matter: 0, components: 125 });

    const before = { ...resources };
    assert.deepEqual(economy.step(model, 5000), []);
    assert.equal(model.world.get(barracks, 'Production').blocked, true);
    assert.equal(model.world.get(barracks, 'Production').elapsedMs, 5000);
    assert.deepEqual(resources, before);
    const second = preview.placeBuilding(model, 'barracks', 8);
    assert.ok(second);
    assert.equal(economy.unitCapacity(model, 'barracks'), 6);
    assert.equal(economy.step(model, 1).length, 1, 'completed cycle resumes when cap rises');
    spawn();

    const guard = model.world.query('PreviewUnit')[0];
    model.world.get(guard, 'Health').hp = 0;
    assert.equal(economy.aliveUnits(model, 'barracks'), 3);
    assert.deepEqual(economy.step(model, 1), [], 'free capacity does not skip a fresh cycle');
    assert.equal(economy.step(model, 4999).length, 1);
});

test('all specialized producers complete their own cadences before charging costs', () => {
    const models = [
        ['ballistics', 'unit_sniper', 35, 20, 8000],
        ['armor_forge', 'unit_mecha', 60, 35, 12000],
        ['medical_center', 'unit_dronoid', 40, 25, 10000]
    ];
    for (const [type, unit, components, energy, cycleMs] of models) {
        const model = preview.createModel(World);
        const id = preview.placeBuilding(model, type, 6);
        economy.initialize(model);
        preview.setObserved(model, [6]);
        const resources = model.world.get(model.game, 'Resources');
        resources.components = components; resources.energy = energy;
        assert.equal(economy.PROTOTYPE_RECIPES[type].cycleMs, cycleMs);
        assert.equal(model.world.get(id, 'Production').cooldownMs, cycleMs);
        assert.deepEqual(economy.step(model, cycleMs - 1), []);
        assert.deepEqual({ ...resources }, { energy, matter: 0, components });
        const events = economy.step(model, 1);
        assert.equal(events.length, 1);
        assert.equal(events[0].unitType, unit);
        assert.deepEqual({ ...resources }, { energy: 0, matter: 0, components: 0 });
        assert.equal(economy.unitCapacity(model, type), 3);
    }
});

test('legacy zero-cadence military production does not turn old elapsed time into free units', () => {
    const model = preview.createModel(World);
    const id = preview.placeBuilding(model, 'barracks', 6);
    economy.initialize(model);
    const prior = model.world.get(id, 'Production');
    prior.cooldownMs = 0;
    prior.elapsedMs = 63000; // Old implementation accumulated time without a cadence.
    prior.blocked = true;
    const restoredWorld = World.restore(model.world.serialize());
    const restoredModel = { ...model, world: restoredWorld };
    const resources = restoredWorld.get(model.game, 'Resources');
    resources.components = 50; resources.energy = 30;
    preview.setObserved(restoredModel, [6]);
    economy.initialize(restoredModel);
    const progress = restoredWorld.get(id, 'Production');
    assert.equal(progress.cooldownMs, 5000);
    assert.equal(progress.elapsedMs, 0);
    assert.equal(progress.blocked, false);
    assert.deepEqual(economy.step(restoredModel, 4999), []);
    assert.equal(economy.step(restoredModel, 1).length, 1);
    assert.equal(resources.components, 25);
});


'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { World } = require('../src/core/World.js');
const preview = require('../src/core/VNextPreview.js');
const cards = require('../src/core/VNextCards.js');
const economy = require('../src/core/VNextEconomy.js');
const save = require('../src/core/VNextSave.js');

function storage() {
    const items = new Map();
    return {
        getItem: key => items.get(key) ?? null,
        setItem: (key, value) => items.set(key, value),
        removeItem: key => items.delete(key),
        items
    };
}

function runningScene() {
    const model = preview.createModel(World);
    const world = model.world;
    cards.initialize(model);
    economy.initialize(model);
    preview.setObserved(model, [7, 12, 13]);
    const reactor = cards.play(model, 'reactor', 7);
    world.set(reactor, 'Production', { elapsedMs: 1285, cooldownMs: 2000, blocked: false });
    world.get(model.game, 'Resources').energy = 19;
    const unit = world.create(model.game);
    world.set(unit, 'Position', { x: 400, y: 120 });
    world.set(unit, 'Health', { hp: 6, maxHp: 12 });
    world.set(unit, 'Faction', { side: 'enemy' });
    world.set(unit, 'Movement', { speed: 35 });
    world.set(unit, 'Combat', { damage: 2, cooldownMs: 1000, elapsedMs: 250 });
    world.set(unit, 'PreviewUnit', { type: 'basic_monster' });
    world.set(unit, 'WaveMember', { number: 2 });
    return {
        world, model, attention: { x: 2, y: 1 }, visionRules: { patternIndex: 2 },
        waveClock: { number: 2, elapsedMs: 178020, seed: 4561 },
        waveMembers: new Map([[2, [unit]]]),
        rewardQueue: [{ number: 1, options: ['factory', 'barracks', 'extractor'] }],
        activeReward: { number: 2, options: ['reactor', 'factory', 'barracks'] },
        battleUnits: [unit], baseHp: 72, speed: 3, lastSpeed: 2
    };
}

test('save / restore is a JSON round trip, including combat, pending reward and ECS ids', () => {
    const scene = runningScene(), slot = storage();
    assert.equal(save.write(scene, slot, 1720000000000), true);
    const raw = save.read(slot);
    assert.equal(raw.version, 1);
    assert.equal(raw.savedAt, 1720000000000);
    const restored = save.restore(raw, World);
    assert.deepEqual(restored.model.world.serialize(), scene.world.serialize());
    assert.deepEqual([...restored.waveMembers], [[2, scene.battleUnits]]);
    assert.deepEqual(restored.rewardQueue, scene.rewardQueue);
    assert.deepEqual(restored.activeReward, scene.activeReward);
    assert.deepEqual(restored.waveClock, scene.waveClock);
    assert.deepEqual(restored.attention, scene.attention);
    assert.equal(restored.patternIndex, 2);
    assert.equal(restored.baseHp, 72);
    assert.equal(restored.speed, 3);
    assert.equal(restored.lastSpeed, 2);
    assert.deepEqual(restored.battleUnits, scene.battleUnits);
    const nextId = restored.model.world.create(restored.model.game);
    assert.equal(nextId, scene.world.nextId);
    restored.model.world.get(scene.battleUnits[0], 'Health').hp = 1;
    assert.equal(scene.world.get(scene.battleUnits[0], 'Health').hp, 6);
});

test('malformed, incompatible and incomplete saves never allow Continue', () => {
    const slot = storage();
    assert.equal(save.read(slot), null);
    for (const payload of ['not json', '{"version":99}', '{}']) {
        slot.setItem(save.KEY, payload);
        assert.equal(save.read(slot), null);
    }
    const scene = runningScene();
    save.write(scene, slot, 1720000000000);
    const data = JSON.parse(slot.getItem(save.KEY));
    data.world.entities[0].id = 9999;
    slot.setItem(save.KEY, JSON.stringify(data));
    assert.equal(save.read(slot), null);
    assert.throws(() => save.restore(data, World));
});

test('storage errors do not crash and never clear other persistent keys', () => {
    const slot = storage(), scene = runningScene();
    slot.setItem('unlockedTalents', '["root"]');
    slot.setItem('memoryShards', '19');
    assert.equal(save.write(scene, slot), true);
    assert.equal(save.clear(slot), true);
    assert.equal(slot.getItem(save.KEY), null);
    assert.equal(slot.getItem('memoryShards'), '19');
    assert.equal(slot.getItem('unlockedTalents'), '["root"]');
    const blocked = {
        getItem() { throw new Error('SecurityError'); },
        setItem() { throw new Error('QuotaExceededError'); },
        removeItem() { throw new Error('SecurityError'); }
    };
    assert.equal(save.write(scene, blocked), false);
    assert.equal(save.read(blocked), null);
    assert.equal(save.clear(blocked), false);
});

test('saving a finished run never replaces an existing live save', () => {
    const slot = storage();
    const scene = runningScene();
    assert.equal(save.write(scene, slot), true);
    const before = slot.getItem(save.KEY);
    scene.baseHp = 0;
    assert.equal(save.write(scene, slot), false);
    assert.equal(slot.getItem(save.KEY), before);
});


test('save accepts specialized VNext military rewards and cards in hand', () => {
    const scene = runningScene(), slot = storage();
    cards.grant(scene.model, 'ballistics');
    cards.grant(scene.model, 'armor_forge');
    cards.grant(scene.model, 'medical_center');
    scene.activeReward = { number: 2, options: ['ballistics', 'armor_forge', 'medical_center'] };
    assert.equal(save.write(scene, slot), true);
    const raw = save.read(slot);
    assert.ok(raw);
    const restored = save.restore(raw, World);
    assert.ok(cards.cards(restored.model).includes('armor_forge'));
    assert.deepEqual(restored.activeReward.options, ['ballistics', 'armor_forge', 'medical_center']);
});

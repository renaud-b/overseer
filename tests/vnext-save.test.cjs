'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { World } = require('../src/core/World.js');
const preview = require('../src/core/VNextPreview.js');
const cards = require('../src/core/VNextCards.js');
const economy = require('../src/core/VNextEconomy.js');
const save = require('../src/core/VNextSave.js');
const artifacts = require('../src/core/VNextArtifacts.js');
const artifactEffects = require('../src/core/VNextArtifactEffects.js');

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
    assert.equal(restored.visionLevel, 0);
    assert.equal(restored.baseHp, 72);
    assert.equal(restored.speed, 3);
    assert.equal(restored.lastSpeed, 2);
    assert.deepEqual(restored.battleUnits, scene.battleUnits);
    const nextId = restored.model.world.create(restored.model.game);
    assert.equal(nextId, scene.world.nextId);
    restored.model.world.get(scene.battleUnits[0], 'Health').hp = 1;
    assert.equal(scene.world.get(scene.battleUnits[0], 'Health').hp, 6);
});

test('vision level is optional for old saves and rejects malformed levels', () => {
    const slot = storage();
    const scene = runningScene();
    scene.visionRules.level = 2;
    const resources = scene.world.get(scene.model.game, 'Resources');
    resources.data = 123;
    assert.equal(save.write(scene, slot), true);
    const raw = save.read(slot);
    assert.equal(save.restore(raw, World).visionLevel, 2);
    assert.equal(save.restore(raw, World).model.world.get(scene.model.game, 'Resources').data, 123);
    delete raw.attention.level;
    assert.equal(save.restore(raw, World).visionLevel, 0);
    raw.attention.level = 4;
    assert.throws(() => save.restore(raw, World), /attention/);
    slot.setItem(save.KEY, JSON.stringify(raw));
    assert.equal(save.read(slot), null);
});

test('Data stock round-trips in saves and malformed Data is rejected', () => {
    const scene = runningScene(), slot = storage();
    scene.world.get(scene.model.game, 'Resources').data = 18;
    assert.equal(save.write(scene, slot), true);
    const raw = save.read(slot);
    assert.equal(save.restore(raw, World).model.world.get(scene.model.game, 'Resources').data, 18);
    const corrupt = JSON.parse(JSON.stringify(raw));
    const game = corrupt.world.entities.find(entity => entity.id === scene.model.game);
    const resources = game.components.find(([kind]) => kind === 'Resources')[1];
    resources.data = -1;
    assert.throws(() => save.restore(corrupt, World), /resources/);
    delete resources.data; // Old saves with three resources remain accepted.
    assert.equal(save.restore(corrupt, World).model.world.get(scene.model.game, 'Resources').data, undefined);
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

test('artifacts persist in ECS saves, reject invalid inventories and old saves remain valid', () => {
    const scene = runningScene(), slot = storage();
    assert.equal(artifacts.add(scene.model, 'echo'), true);
    assert.equal(artifacts.add(scene.model, 'core_laser'), true);
    scene.activeReward = { number: 2, stages: [
        { kind: 'building', options: ['factory', 'barracks', 'reactor'] },
        { kind: 'artifact', options: ['artifact:spontaneous', 'artifact:shield'] }
    ], index: 1, options: ['artifact:spontaneous', 'artifact:shield'] };
    assert.equal(save.write(scene, slot), true);
    const read = save.read(slot);
    assert.deepEqual(artifacts.list(save.restore(read, World).model), ['echo', 'core_laser']);
    const bad = JSON.parse(JSON.stringify(read));
    const game = bad.world.entities.find(entity => entity.id === scene.model.game);
    game.components.find(([kind]) => kind === 'ArtifactCollection')[1].ids.push('echo');
    assert.throws(() => save.restore(bad, World), /artifact collection/);
    assert.ok(save.restore(save.capture(runningScene()), World)); // Previous saves omit artifacts.
});

test('malformed persisted artifact effect timers cannot offer Continue', () => {
 const scene=runningScene(),slot=storage();
 artifactEffects.state(scene.model).laserMs=1234;
 assert.equal(save.write(scene,slot),true);
 const stored=save.read(slot);
 assert.equal(artifactEffects.state(save.restore(stored,World).model).laserMs,1234);
 const bad=JSON.parse(JSON.stringify(stored));
 const game=bad.world.entities.find(e=>e.id===scene.model.game);
 game.components.find(([type])=>type==='ArtifactEffects')[1].laserMs=-100;
 slot.setItem(save.KEY,JSON.stringify(bad));
 assert.equal(save.read(slot),null);
 assert.throws(()=>save.restore(bad,World),/artifact effects/);
});

'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { World } = require('../src/core/World.js');
const preview = require('../src/core/VNextPreview.js');
globalThis.OverseerVNextPreview = preview;
const hand = require('../src/core/VNextCards.js');
const make = () => preview.createModel(World);

test('a new game starts with one reactor, extractor, factory, barracks and laboratory card', () => {
    const model = make();
    assert.deepEqual(hand.cards(model), ['reactor', 'extractor', 'factory', 'barracks', 'laboratory', 'compute_node']);
    assert.equal(model.world.query('Building').length, 0);
    assert.deepEqual(hand.cards(model), ['reactor', 'extractor', 'factory', 'barracks', 'laboratory', 'compute_node']);
});
test('cards are removed only after successful placement', () => {
    const model = make();
    assert.equal(hand.play(model, 'reactor', 25), null);
    assert.equal(hand.play(model, 'unknown', 6), null);
    assert.deepEqual(hand.cards(model), ['reactor', 'extractor', 'factory', 'barracks', 'laboratory', 'compute_node']);
    assert.ok(hand.play(model, 'reactor', 6));
    assert.equal(hand.play(model, 'factory', 6), null);
    assert.deepEqual(hand.cards(model), ['extractor', 'factory', 'barracks', 'laboratory', 'compute_node']);
    assert.equal(hand.play(model, 'reactor', 7), null);
    const barracks = hand.play(model, 'barracks', 11);
    assert.ok(barracks);
    assert.deepEqual(hand.cards(model), ['extractor', 'factory', 'laboratory']);
    assert.equal(preview.moveBuilding(model, barracks, 12), true);
    assert.deepEqual(hand.cards(model), ['extractor', 'factory', 'laboratory']);
});
test('placing the barracks spends only its card; 25 components and 15 energy fund a soldier', () => {
    const economy = require('../src/core/VNextEconomy.js');
    const model = make();
    const resources = economy.initialize(model);
    resources.components = 25;
    resources.energy = 15;
    const placed = hand.play(model, 'barracks', 6);
    assert.ok(placed);
    assert.deepEqual({ ...resources }, { energy: 15, matter: 0, components: 25, data: 0 });
    assert.ok(!hand.cards(model).includes('barracks'));
    assert.deepEqual(economy.step(model, 60), [], 'out of vision, construction does not fabricate a unit');
    assert.deepEqual({ ...resources }, { energy: 15, matter: 0, components: 25, data: 0 });

    preview.setObserved(model, [6]);
    assert.deepEqual(economy.step(model, 4999), [], 'a placed barracks must finish its full cycle');
    assert.deepEqual({ ...resources }, { energy: 15, matter: 0, components: 25, data: 0 });
    const events = economy.step(model, 1);
    assert.equal(events.length, 1);
    assert.equal(events[0].type, 'unit-produced');
    assert.equal(events[0].unitType, 'unit_guard');
    assert.deepEqual({ ...resources }, { energy: 0, matter: 0, components: 0, data: 0 });
});

test('compute node is a free one-shot starter card and an available reward', () => {
    const model = make();
    const resources = require('../src/core/VNextEconomy.js').initialize(model);
    resources.energy = 2; resources.components = 1; resources.matter = 1;
    const previous = { ...resources };
    const id = hand.play(model, 'compute_node', 6);
    assert.ok(id);
    assert.deepEqual(resources, previous, 'placing is free');
    assert.equal(hand.play(model, 'compute_node', 7), null);
    assert.ok(hand.REWARD_CARDS.includes('compute_node'));
});

test('each game has an independent hand', () => {
    const a = make(), b = make();
    hand.play(a, 'reactor', 6);
    assert.deepEqual(hand.cards(b), ['reactor', 'extractor', 'factory', 'barracks', 'laboratory', 'compute_node']);
});

test('extractor is one-shot and enables the matter side of the starting economy', () => {
    const model = make();
    assert.ok(hand.play(model, 'extractor', 7));
    assert.equal(hand.play(model, 'extractor', 8), null);
    assert.equal(preview.buildingAt(model, 7) !== null, true);
    assert.deepEqual(hand.cards(model), ['reactor', 'factory', 'barracks', 'laboratory', 'compute_node']);
});

test('reward grants exactly one additional one-shot card', () => {
    const model = make();
    assert.equal(hand.grant(model, 'unknown'), false);
    assert.equal(hand.grant(model, 'factory'), true);
    assert.equal(hand.cards(model).filter(type => type === 'factory').length, 2);
    assert.ok(hand.play(model, 'factory', 6));
    assert.ok(hand.play(model, 'factory', 7));
    assert.equal(hand.play(model, 'factory', 8), null);
});

test('laboratory is a one-shot starter building card without construction cost', () => {
    const model = make();
    const laboratory = hand.play(model, 'laboratory', 9);
    assert.ok(laboratory);
    assert.equal(preview.buildingAt(model, 9), laboratory);
    assert.equal(hand.play(model, 'laboratory', 10), null);
    assert.deepEqual(hand.cards(model), ['reactor', 'extractor', 'factory', 'barracks', 'compute_node']);
});

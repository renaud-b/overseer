'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { World } = require('../src/core/World.js');
const preview = require('../src/core/VNextPreview.js');
globalThis.OverseerVNextPreview = preview;
const hand = require('../src/core/VNextCards.js');
const make = () => preview.createModel(World);

test('a new game starts with exactly one reactor, extractor, factory, barracks card', () => {
    const model = make();
    assert.deepEqual(hand.cards(model), ['reactor', 'extractor', 'factory', 'barracks']);
    assert.equal(model.world.query('Building').length, 0);
    assert.deepEqual(hand.cards(model), ['reactor', 'extractor', 'factory', 'barracks']);
});
test('cards are removed only after successful placement', () => {
    const model = make();
    assert.equal(hand.play(model, 'reactor', 25), null);
    assert.equal(hand.play(model, 'unknown', 6), null);
    assert.deepEqual(hand.cards(model), ['reactor', 'extractor', 'factory', 'barracks']);
    assert.ok(hand.play(model, 'reactor', 6));
    assert.equal(hand.play(model, 'factory', 6), null);
    assert.deepEqual(hand.cards(model), ['extractor', 'factory', 'barracks']);
    assert.equal(hand.play(model, 'reactor', 7), null);
    const barracks = hand.play(model, 'barracks', 11);
    assert.ok(barracks);
    assert.deepEqual(hand.cards(model), ['extractor', 'factory']);
    assert.equal(preview.moveBuilding(model, barracks, 12), true);
    assert.deepEqual(hand.cards(model), ['extractor', 'factory']);
});
test('each game has an independent hand', () => {
    const a = make(), b = make();
    hand.play(a, 'reactor', 6);
    assert.deepEqual(hand.cards(b), ['reactor', 'extractor', 'factory', 'barracks']);
});

test('extractor is one-shot and enables the matter side of the starting economy', () => {
    const model = make();
    assert.ok(hand.play(model, 'extractor', 7));
    assert.equal(hand.play(model, 'extractor', 8), null);
    assert.equal(preview.buildingAt(model, 7) !== null, true);
    assert.deepEqual(hand.cards(model), ['reactor', 'factory', 'barracks']);
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

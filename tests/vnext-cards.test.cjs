'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { World } = require('../src/core/World.js');
const preview = require('../src/core/VNextPreview.js');
globalThis.OverseerVNextPreview = preview;
const hand = require('../src/core/VNextCards.js');
const make = () => preview.createModel(World);

test('a new game starts with exactly one reactor, factory, barracks card', () => {
    const model = make();
    assert.deepEqual(hand.cards(model), ['reactor', 'factory', 'barracks']);
    assert.equal(model.world.query('Building').length, 0);
    assert.deepEqual(hand.cards(model), ['reactor', 'factory', 'barracks']);
});
test('cards are removed only after successful placement', () => {
    const model = make();
    assert.equal(hand.play(model, 'reactor', 25), null);
    assert.equal(hand.play(model, 'extractor', 6), null);
    assert.deepEqual(hand.cards(model), ['reactor', 'factory', 'barracks']);
    assert.ok(hand.play(model, 'reactor', 6));
    assert.equal(hand.play(model, 'factory', 6), null);
    assert.deepEqual(hand.cards(model), ['factory', 'barracks']);
    assert.equal(hand.play(model, 'reactor', 7), null);
    const barracks = hand.play(model, 'barracks', 11);
    assert.ok(barracks);
    assert.deepEqual(hand.cards(model), ['factory']);
    assert.equal(preview.moveBuilding(model, barracks, 12), true);
    assert.deepEqual(hand.cards(model), ['factory']);
});
test('each game has an independent hand', () => {
    const a = make(), b = make();
    hand.play(a, 'reactor', 6);
    assert.deepEqual(hand.cards(b), ['reactor', 'factory', 'barracks']);
});

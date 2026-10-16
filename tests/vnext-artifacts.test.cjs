'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { World } = require('../src/core/World.js');
const preview = require('../src/core/VNextPreview.js');
const artifacts = require('../src/core/VNextArtifacts.js');
const rewards = require('../src/core/VNextRewards.js');

test('six unique run-only artifacts, never seven or duplicates', () => {
    const model = preview.createModel(World);
    assert.deepEqual(artifacts.list(model), []);
    assert.equal(artifacts.add(model, 'missing'), false);
    for (const id of artifacts.IDS.slice(0, 6)) assert.equal(artifacts.add(model, id), true);
    assert.equal(artifacts.add(model, artifacts.IDS[0]), false);
    assert.equal(artifacts.add(model, artifacts.IDS[6]), false);
    assert.equal(artifacts.hasCapacity(model), false);
    assert.deepEqual(artifacts.list(model), artifacts.IDS.slice(0, 6));
    assert.equal(artifacts.valid(artifacts.list(model)), true);
    assert.equal(artifacts.valid([...artifacts.IDS.slice(0, 6), artifacts.IDS[6]]), false);
    assert.equal(artifacts.valid(['echo', 'echo']), false);
});

test('artifact rewards are deterministic, optional, independent of the existing reward mode', () => {
    const buildings = ['reactor', 'factory', 'barracks'], technologies = ['berserk', 'healing_field', 'stasis_field'];
    const waves = Array.from({ length: 60 }, (_, i) => i + 1);
    for (const wave of waves) {
        const seed = 191;
        const original = rewards.create(wave, seed, buildings, technologies);
        const updated = rewards.create(wave, seed, buildings, technologies, artifacts.IDS, []);
        assert.deepEqual(updated.stages.slice(0, original.stages.length), original.stages);
        assert.deepEqual(updated, rewards.create(wave, seed, buildings, technologies, artifacts.IDS, []));
        assert.ok(updated.stages.length <= 3);
        assert.ok(updated.stages.filter(stage => stage.kind === 'artifact').length <= 1);
        if (updated.stages.at(-1).kind === 'artifact') {
            assert.ok(updated.stages.at(-1).options.every(o => o.startsWith('artifact:')));
        }
    }
    assert.ok(waves.some(n => rewards.artifactDrop(n, 191)));
    const full = rewards.create(15, 191, buildings, technologies, artifacts.IDS, artifacts.IDS.slice(0, 6));
    assert.ok(full.stages.every(stage => stage.kind !== 'artifact'));
    // Five owned still leaves one free slot and three distinct choices.
    const scarce = artifacts.IDS.slice(0, 5);
    const lucky = waves.find(n => rewards.artifactDrop(n, 191));
    const almostAll = rewards.create(lucky, 191, buildings, technologies, artifacts.IDS, scarce);
    const options = almostAll.stages.at(-1).options;
    assert.equal(options.length, 3);
    assert.equal(new Set(options).size, 3);
    assert.ok(options.every(option => artifacts.IDS.slice(5).includes(option.slice(9))));
});

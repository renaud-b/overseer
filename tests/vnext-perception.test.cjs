'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const {World} = require('../src/core/World.js');
const preview = require('../src/core/VNextPreview.js');
const cards = require('../src/core/VNextCards.js');
const threats = require('../src/core/VNextThreats.js');

function makeEnemy(model,x) {
    const id=model.world.create(model.game);
    model.world.set(id,'Position',{x,y:300});
    model.world.set(id,'Faction',{side:'enemy'});
    model.world.set(id,'Health',{hp:5,maxHp:5});
    return id;
}

test('unobserved perception amplifier cannot shrink baseline detection or advance its pulse',()=>{
    const m=preview.createModel(World),id=preview.placeBuilding(m,'perception_amplifier',6);
    assert.ok(id);
    assert.equal(threats.radius(m),350);
    threats.step(m,2500);
    assert.equal(threats.radius(m),350);
    assert.equal(m.world.get(m.game,'PerceptionPulse'),undefined);
    preview.setObserved(m,[6]);
    assert.equal(threats.radius(m),350);
    assert.equal(m.world.get(m.game,'PerceptionPulse'),undefined,'render-time radius read is pure');
    threats.step(m,2500);
    assert.equal(threats.radius(m),500);
    preview.setObserved(m,[]);
    threats.step(m,10000);
    assert.equal(threats.radius(m),350);
    assert.equal(m.world.get(m.game,'PerceptionPulse').phaseMs,2500);
    preview.setObserved(m,[6]);
    assert.equal(threats.radius(m),500);
    threats.step(m,2500);
    assert.equal(threats.radius(m),350);
});

test('the expanding ECS detection field marks targets but retains the existing two second memory',()=>{
    const m=preview.createModel(World),amplifier=preview.placeBuilding(m,'perception_amplifier',6);
    const outside=makeEnemy(m,520);
    preview.setObserved(m,[6]);
    threats.update(m.world,[outside],1,threats.radius(m));
    assert.equal(m.world.get(outside,'ThreatMark'),undefined);
    threats.step(m,2500);
    threats.update(m.world,[outside],1,threats.radius(m));
    assert.equal(m.world.get(outside,'ThreatMark').remainingMs,2000);
    threats.step(m,2500);
    threats.update(m.world,[outside],1999,threats.radius(m));
    assert.equal(m.world.get(outside,'ThreatMark').remainingMs,1);
    threats.update(m.world,[outside],1,threats.radius(m));
    assert.equal(m.world.get(outside,'ThreatMark'),undefined);
    assert.equal(m.world.get(amplifier,'Building').type,'perception_amplifier');
});

test('observed pulse remains simulation-owned, survives save, pauses on zero delta and rejects invalid deltas',()=>{
    const m=preview.createModel(World);
    preview.placeBuilding(m,'perception_amplifier',12);
    preview.setObserved(m,[12]);
    threats.step(m,1250);
    const world=World.restore(m.world.serialize());
    const restored={...m,world};
    assert.equal(threats.radius(restored),425);
    threats.step(restored,0);
    assert.equal(threats.radius(restored),425);
    threats.step(restored,1250);
    assert.equal(threats.radius(restored),500);
    assert.throws(()=>threats.step(restored,-1),/Invalid perception delta/);
    assert.throws(()=>threats.step(restored,20,0.5),/Invalid perception delta/);
});

test('amplifier is obtainable as a reward, not an extra starter card',()=>{
    const m=preview.createModel(World);
    assert.ok(cards.REWARD_CARDS.includes('perception_amplifier'));
    assert.ok(!cards.STARTER_CARDS.includes('perception_amplifier'));
    assert.equal(cards.grant(m,'perception_amplifier'),true);
    assert.ok(cards.cards(m).includes('perception_amplifier'));
});

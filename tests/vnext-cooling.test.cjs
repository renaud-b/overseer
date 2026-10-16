'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const {World}=require('../src/core/World.js');
const preview=require('../src/core/VNextPreview.js');
const cooling=require('../src/core/VNextCooling.js');
const economy=require('../src/core/VNextEconomy.js');
const technology=require('../src/core/VNextTechnologies.js');
const threats=require('../src/core/VNextThreats.js');
const artifacts=require('../src/core/VNextArtifactEffects.js');

function setup(){
 const m=preview.createModel(World);
 const reactor=preview.placeBuilding(m,'reactor',6);
 const pump=preview.placeBuilding(m,'cryopump',7);
 const nearby=preview.placeBuilding(m,'laboratory',11);
 const far=preview.placeBuilding(m,'reactor',24);
 preview.setObserved(m,[6,7,11,24]);
 economy.initialize(m);
 return {m,reactor,pump,nearby,far};
}
test('Cryopump gives immediate observed-neighbor bonus with no temperature state',()=>{
 const {m,reactor,nearby,far}=setup();
 assert.equal(cooling.bonus(m,reactor),0.2);
 assert.equal(cooling.bonus(m,nearby),0.2);
 assert.equal(cooling.bonus(m,far),0);
 assert.equal(cooling.coverage(m).buildings,2);
 assert.equal(cooling.coverage(m).pumps,1);
 assert.equal(m.world.query('BuildingHeat').length,0);
 preview.setObserved(m,[6,11,24]);
 assert.equal(cooling.bonus(m,reactor),0);
 assert.equal(cooling.coverage(m).buildings,0);
 assert.equal(cooling.bonus(m,far),0);
});
test('Cooling is optional and cannot penalize production or research',()=>{
 const {m,reactor}=setup();preview.setObserved(m,[6,11]);
 const events=economy.step(m,2000,{},null,cooling.bonuses(m));
 assert.equal(events.filter(e=>e.building===reactor).length,1);
 assert.equal(m.world.get(m.game,'Resources').energy,2);
 assert.equal(technology.step(m,30000,null,cooling.bonuses(m)).length,1);
});

test('With a cold active Cryopump, production and Laboratory speed up, without changing recipes',()=>{
 const {m,reactor,nearby}=setup();
 cooling.step(m,0);
 const boosts=cooling.bonuses(m);
 assert.equal(boosts[reactor],0.2);
 assert.equal(boosts[nearby],0.2);
 assert.equal(economy.step(m,1600,{},null,boosts).filter(e=>e.building===reactor).length,0);
 assert.equal(economy.step(m,100,{},null,boosts).filter(e=>e.building===reactor).length,1);
 assert.equal(m.world.get(m.game,'Resources').energy,2);
 const researched=technology.step(m,25000,null,boosts);
 assert.equal(researched.length,1);
 assert.equal(technology.inventory(m).items.length,1);
});

test('Several Cryopumps never stack and old heat is erased',()=>{
 const {m,reactor}=setup();
 const pump2=preview.placeBuilding(m,'cryopump',5);
 preview.setObserved(m,[5,6,7,11,24]);
 m.world.set(reactor,'BuildingHeat',{percent:100,elapsedMs:100});
 cooling.step(m,2000);
 assert.equal(m.world.hasComponent(reactor,'BuildingHeat'),false);
 assert.equal(cooling.bonus(m,reactor),0.2);
 assert.equal(cooling.coverage(m).pumps,2);
 assert.equal(m.world.get(pump2,'Building').type,'cryopump');
});
test('Cooling accelerates the perception pulse and remains valid after ECS save',()=>{
 const {m}=setup();const amp=preview.placeBuilding(m,'perception_amplifier',8);
 preview.setObserved(m,[6,7,8,11,24]);
 const speed=1+cooling.bonus(m,amp);
 assert.equal(speed,1.2);
 threats.step(m,1000,speed);
 const resumed={...m,world:World.restore(m.world.serialize())};
 assert.equal(resumed.world.get(resumed.game,'PerceptionPulse').phaseMs,1200);
 assert.equal(cooling.bonus(resumed,amp),0.2);
 assert.throws(()=>cooling.step(resumed,-1),/Invalid cooling delta/);
});

test('Out-of-vision artifact grace is not boosted and cooling does not reserve energy',()=>{
 const {m,reactor}=setup();
 cooling.step(m,0);
 preview.setObserved(m,[7]);
 const balance=m.world.get(m.game,'Resources');
 const events=economy.step(m,2000,{[reactor]:2000},null,cooling.bonuses(m));
 assert.equal(events.length,1);
 assert.equal(balance.energy,2);
 assert.equal(m.world.query('BuildingHeat').length,0);
});

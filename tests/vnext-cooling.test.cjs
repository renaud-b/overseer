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
test('Cryopump cools nearby and diagonal buildings when observed, without storing a resource',()=>{
 const {m,reactor,pump,nearby,far}=setup();
 const resources={...m.world.get(m.game,'Resources')};
 cooling.step(m,2000);
 assert.equal(cooling.heat(m,reactor),0);
 assert.equal(cooling.heat(m,nearby),0);
 assert.equal(cooling.heat(m,far),5);
 assert.equal(cooling.heat(m,pump),0);
 assert.equal(cooling.coverage(m).buildings,2);
 assert.equal(cooling.coverage(m).pumps,1);
 assert.equal(cooling.bonus(m,reactor),0.2);
 assert.equal(cooling.bonus(m,far),0);
 assert.deepEqual(m.world.get(m.game,'Resources'),resources);
 preview.setObserved(m,[6,11,24]);
 assert.equal(cooling.bonus(m,reactor),0);
 cooling.step(m,2000);
 assert.equal(cooling.heat(m,reactor),5);
 assert.equal(cooling.heat(m,nearby),5);
 assert.equal(cooling.heat(m,far),10);
 assert.deepEqual(m.world.get(m.game,'Resources'),resources);
});

test('Heat cannot impair original production or research, even at 100 percent',()=>{
 const {m,reactor,nearby}=setup();
 preview.setObserved(m,[6,11]);
 cooling.step(m,40000);
 assert.equal(cooling.heat(m,reactor),100);
 assert.equal(cooling.bonus(m,reactor),0);
 const res=m.world.get(m.game,'Resources');
 const events=economy.step(m,2000,{},null,cooling.bonuses(m));
 assert.equal(events.filter(e=>e.building===reactor).length,1);
 assert.equal(res.energy,2);
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

test('Cooldown decreases heat but does not stack with multiple pumps',()=>{
 const {m,reactor}=setup();
 const pump2=preview.placeBuilding(m,'cryopump',5);
 preview.setObserved(m,[5,6,7,11,24]);
 cooling.ensure(m);
 m.world.get(reactor,'BuildingHeat').percent=100;
 cooling.step(m,2000);
 assert.equal(cooling.heat(m,reactor),90);
 assert.ok(cooling.bonus(m,reactor)>0);
 assert.ok(cooling.bonus(m,reactor)<=cooling.RULES.maxBonus);
 assert.ok(cooling.coverage(m).pumps===2);
 assert.equal(m.world.get(pump2,'Building').type,'cryopump');
});

test('Cooling and pulse timers use simulation time, survive ECS save and never exceed default speeds',()=>{
 const {m,reactor}=setup();
 const amplifier=preview.placeBuilding(m,'perception_amplifier',8);
 preview.setObserved(m,[6,7,8,11,24]);
 cooling.step(m,2000);
 const speed=1+cooling.bonus(m,amplifier);
 assert.equal(speed,1.2);
 threats.step(m,1000,speed);
 const resumed={...m,world:World.restore(m.world.serialize())};
 assert.equal(resumed.world.get(reactor,'BuildingHeat').elapsedMs,0);
 assert.equal(resumed.world.get(resumed.game,'PerceptionPulse').phaseMs,1200);
 const r=threats.radius(resumed);
 cooling.step(resumed,0);threats.step(resumed,0,1+cooling.bonus(resumed,amplifier));
 assert.equal(threats.radius(resumed),r);
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
 assert.equal(m.world.get(m.game,'BuildingHeat'),undefined);
});

'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const {World}=require('../src/core/World.js');
const preview=require('../src/core/VNextPreview.js');
const zones=require('../src/core/VNextZones.js');
const economy=require('../src/core/VNextEconomy.js');
const combat=require('../src/core/CombatSystem.js');
const research=require('../src/core/VNextTechnologies.js');

function unit(model,side,x=0){
 const w=model.world,id=w.create(model.game);
 w.set(id,'Faction',{side});w.set(id,'Position',{x,y:300});
 w.set(id,'Health',{hp:10,maxHp:10});w.set(id,'Movement',{speed:20});
 w.set(id,'Combat',{elapsedMs:0,cooldownMs:1000,damage:1,range:15,detectionRadius:200,attackType:'melee'});
 return id;
}
const center={x:500,y:300};

test('Surcadencement accelerates only allied movement, not attacks, expires and persists through ECS saves',()=>{
 const m=preview.createModel(World),ally=unit(m,'player'),enemy=unit(m,'enemy');
 assert.equal(zones.cast(m,'overclock',center),m.game);
 assert.equal(zones.speedMultiplier(m),1.5);
 const saved={...m,world:World.restore(m.world.serialize())};
 assert.equal(zones.speedMultiplier(saved),1.5);
 combat.stepUnit(saved.world,ally,1000,{patrol:{x:200,y:300},allySpeedMultiplier:zones.speedMultiplier(saved)});
 combat.stepUnit(saved.world,enemy,1000,{base:{x:200,y:300},allySpeedMultiplier:zones.speedMultiplier(saved)});
 assert.equal(saved.world.get(ally,'Position').x,30);
 assert.equal(saved.world.get(enemy,'Position').x,20);
 assert.equal(saved.world.get(ally,'Combat').elapsedMs,1000);
 zones.stepBuffs(saved,9999);
 assert.equal(zones.speedMultiplier(saved),1.5);
 zones.stepBuffs(saved,1);
 assert.equal(zones.speedMultiplier(saved),1);
 assert.equal(saved.world.get(ally,'Movement').speed,20);
 assert.equal(zones.cast(saved,'overclock',{x:-1,y:300}),null);
});

test('Surcharge doubles production for observed buildings, not research, and ends exactly at its timer',()=>{
 const m=preview.createModel(World),w=m.world;
 const reactor=preview.placeBuilding(m,'reactor',6),unwatched=preview.placeBuilding(m,'reactor',7),lab=preview.placeBuilding(m,'laboratory',8);
 preview.setObserved(m,[6,8]);
 economy.initialize(m);
 assert.equal(zones.cast(m,'overload',center),m.game);
 assert.equal(economy.step(m,1000).filter(e=>e.type==='production').length,1);
 assert.equal(w.get(m.game,'Resources').energy,2);
 assert.equal(w.get(unwatched,'Production').elapsedMs,0);
 research.step(m,1000);
 assert.equal(w.get(lab,'Research').elapsedMs,1000);
 zones.stepBuffs(m,7500);
 assert.equal(zones.active(m,'overload'),true);
 // 500 ms of boosted time remain: 1000 + 500 effective elapsed.
 economy.step(m,1000);
 assert.equal(w.get(reactor,'Production').elapsedMs,1500);
 zones.stepBuffs(m,1000);
 assert.equal(zones.active(m,'overload'),false);
 economy.step(m,500);
 assert.equal(w.get(m.game,'Resources').energy,4);
 assert.equal(w.get(reactor,'Production').elapsedMs,0);
 assert.equal(w.get(unwatched,'Production').elapsedMs,0);
});

test('Global technology recasting refreshes, never stacks, and time freezes at pause',()=>{
 const m=preview.createModel(World);
 zones.cast(m,'overload',center);zones.stepBuffs(m,4000);
 assert.equal(zones.cast(m,'overload',center),m.game);
 assert.equal(m.world.get(m.game,'TechnologyEffects').overloadMs,8000);
 zones.stepBuffs(m,0);
 assert.equal(m.world.get(m.game,'TechnologyEffects').overloadMs,8000);
 zones.stepBuffs(m,8000);
 assert.equal(zones.active(m,'overload'),false);
});

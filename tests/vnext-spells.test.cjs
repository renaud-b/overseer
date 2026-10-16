'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const {World}=require('../src/core/World.js'),preview=require('../src/core/VNextPreview.js'),zones=require('../src/core/VNextZones.js'),combat=require('../src/core/CombatSystem.js'),tech=require('../src/core/VNextTechnologies.js');
function unit(model,side,x){const id=model.world.create(model.game),w=model.world;w.set(id,'Faction',{side});w.set(id,'Health',{hp:10,maxHp:10});w.set(id,'Position',{x,y:300});w.set(id,'Movement',{speed:100});w.set(id,'Combat',{elapsedMs:0,cooldownMs:1000,damage:1,range:20,detectionRadius:500,attackType:'melee'});return id;}
test('research catalog exposes three independent one-shot types',()=>{assert.deepEqual(tech.TYPES,['healing_field','berserk','stasis_field']);});
test('berserk improves attack cadence, targets at most two allies and expires',()=>{
 const m=preview.createModel(World),a=unit(m,'player',100),b=unit(m,'player',110),c=unit(m,'player',120),enemy=unit(m,'enemy',120);
 zones.cast(m,'berserk',{x:400,y:300});
 assert.equal(m.world.query('TechnologyBuff').length,2);
 assert.equal(m.world.hasComponent(enemy,'TechnologyBuff'),false);
 const buffed=m.world.query('TechnologyBuff')[0],combatState=m.world.get(buffed,'Combat');
 combat.stepUnit(m.world,buffed,500,{opponents:[enemy]});
 assert.equal(combatState.elapsedMs,750);
 zones.stepBuffs(m,8000);assert.equal(m.world.query('TechnologyBuff').length,0);
});
test('stasis slows enemies within the field, not allies, expires after ten seconds',()=>{
 const m=preview.createModel(World),enemy=unit(m,'enemy',400),ally=unit(m,'player',400);
 zones.cast(m,'stasis_field',{x:400,y:300});
 combat.stepUnit(m.world,enemy,1000,{base:{x:800,y:300}});
 combat.stepUnit(m.world,ally,1000,{patrol:{x:800,y:300}});
 assert.equal(m.world.get(enemy,'Position').x,450);
 assert.equal(m.world.get(ally,'Position').x,500);
 zones.step(m,10000);assert.equal(m.world.query('TechnologyZone').length,0);
});

test('Berserk keeps central marked-target locking and Stase does not mutate movement stats',()=>{
 const m=preview.createModel(World),ally=unit(m,'player',100),near=unit(m,'enemy',160),marked=unit(m,'enemy',300);
 m.world.set(marked,'ThreatMark',{remainingMs:3000});
 zones.cast(m,'berserk',{x:100,y:300});
 assert.deepEqual(m.world.query('TechnologyBuff'),[ally]);
 combat.stepUnit(m.world,ally,100,{opponents:[near,marked],centralDetection:true});
 assert.equal(m.world.get(ally,'Combat').targetId,marked);
 assert.equal(m.world.get(ally,'Combat').elapsedMs,150);
 zones.cast(m,'stasis_field',{x:160,y:300});
 const before=m.world.get(near,'Position').x;
 combat.stepUnit(m.world,near,1000,{base:{x:800,y:300}});
 assert.equal(m.world.get(near,'Position').x,before+50);
 assert.equal(m.world.get(near,'Movement').speed,100);
});

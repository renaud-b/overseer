'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const {World}=require('../src/core/World.js'),preview=require('../src/core/VNextPreview.js'),zones=require('../src/core/VNextZones.js');
test('healing zone ticks every 2 seconds for 10 seconds, only alive injured allies inside radius',()=>{
 const model=preview.createModel(World),w=model.world;
 function make(x,side,hp=1){const id=w.create(model.game);w.set(id,'Position',{x,y:300});w.set(id,'Faction',{side});w.set(id,'Health',{hp,maxHp:7});return id;}
 const ally=make(500,'player'),enemy=make(505,'enemy'),far=make(800,'player'),dead=make(510,'player',0);
 const zone=zones.cast(model,'healing_field',{x:500,y:300});
 assert.ok(zone);assert.deepEqual(zones.step(model,1999),[]);
 assert.equal(w.get(ally,'Health').hp,1);
 assert.equal(zones.step(model,1).length,1);
 assert.equal(w.get(ally,'Health').hp,2);
 zones.step(model,8000);
 assert.equal(w.get(ally,'Health').hp,6);
 assert.equal(w.get(enemy,'Health').hp,1);assert.equal(w.get(far,'Health').hp,1);
 assert.equal(w.get(dead,'Health').hp,0);assert.equal(w.has(zone),false);
});
test('casting checks coordinates and paused simulation does not advance a zone',()=>{
 const m=preview.createModel(World);
 assert.equal(zones.cast(m,'healing_field',{x:-1,y:0}),null);
 const id=zones.cast(m,'healing_field',{x:300,y:300});
 zones.step(m,0);assert.equal(m.world.get(id,'TechnologyZone').remainingMs,10000);
 zones.step(m,10000);assert.equal(m.world.has(id),false);
});

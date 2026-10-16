'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const {World}=require('../src/core/World.js');
const preview=require('../src/core/VNextPreview.js');
const maintenance=require('../src/core/VNextMaintenance.js');
const artifacts=require('../src/core/VNextArtifacts.js');
const effects=require('../src/core/VNextArtifactEffects.js');
const economy=require('../src/core/VNextEconomy.js');
function setup(){
 const m=preview.createModel(World);
 const id=preview.placeBuilding(m,'maintenance',7);
 maintenance.ensure(m);
 return {m,id};
}
test('repair advances only under vision, preserves partial cycles off vision and pays at 30 s',()=>{
 const {m,id}=setup();
 assert.deepEqual(maintenance.step(m,30000,60),{hp:60,healed:0,building:null});
 preview.setObserved(m,[7]);
 assert.deepEqual(maintenance.step(m,15500,60),{hp:60,healed:0,building:id});
 assert.equal(m.world.get(id,'MaintenanceCycle').elapsedMs,15500);
 preview.setObserved(m,[]);
 assert.equal(maintenance.step(m,20000,60).hp,60);
 assert.equal(m.world.get(id,'MaintenanceCycle').elapsedMs,15500);
 preview.setObserved(m,[7]);
 const paid=maintenance.step(m,14500,60);
 assert.deepEqual(paid,{hp:62,healed:2,building:id});
 assert.equal(m.world.get(id,'MaintenanceCycle').elapsedMs,0);
});
test('multiple observed maintenance centers are capped to one active cycle and own their progress',()=>{
 const {m,id:seven}=setup(),six=preview.placeBuilding(m,'maintenance',6);
 preview.setObserved(m,[6,7]);
 const result=maintenance.step(m,30000,70);
 assert.equal(result.hp,72);
 assert.equal(result.building,six,'earliest grid slot takes precedence');
 assert.equal(m.world.get(six,'MaintenanceCycle').elapsedMs,0);
 assert.equal(m.world.get(seven,'MaintenanceCycle').elapsedMs,0,'no parallel work');
 preview.setObserved(m,[7]);
 maintenance.step(m,12500,72);
 preview.setObserved(m,[6]);maintenance.step(m,9000,72);
 assert.equal(m.world.get(six,'MaintenanceCycle').elapsedMs,9000);
 assert.equal(m.world.get(seven,'MaintenanceCycle').elapsedMs,12500);
 preview.setObserved(m,[7]);
 const resumed=maintenance.step(m,17500,72);
 assert.equal(resumed.hp,74);
 assert.equal(m.world.get(seven,'MaintenanceCycle').elapsedMs,0);
 assert.equal(m.world.get(six,'MaintenanceCycle').elapsedMs,9000);
});
test('repair never banks HP at 100 and cannot resurrect a destroyed core',()=>{
 const {m,id}=setup();preview.setObserved(m,[7]);
 maintenance.step(m,29500,95);
 assert.equal(m.world.get(id,'MaintenanceCycle').elapsedMs,29500);
 assert.deepEqual(maintenance.step(m,500,99),{hp:100,healed:1,building:id});
 assert.equal(m.world.get(id,'MaintenanceCycle').elapsedMs,0);
 assert.equal(maintenance.step(m,60000,100).healed,0);
 assert.equal(m.world.get(id,'MaintenanceCycle').elapsedMs,0);
 assert.equal(maintenance.step(m,1000,0).hp,0);
 assert.equal(m.world.get(id,'MaintenanceCycle').elapsedMs,0);
 assert.throws(()=>maintenance.step(m,-10,80),/Invalid maintenance/);
 assert.throws(()=>maintenance.step(m,60,150),/Invalid maintenance/);
});
test('distributed peripheral activation can power maintenance without expanding attention',()=>{
 const {m,id}=setup();
 artifacts.add(m,'distributed');
 preview.setObserved(m,[6]);
 const first=effects.relay(m,15000,economy);
 assert.equal(first[id],15000);
 assert.equal(m.world.get(m.tiles[7],'Watched').active,false);
 assert.equal(maintenance.step(m,15000,90,first).hp,90);
 const next=effects.relay(m,15000,economy);
 assert.equal(maintenance.step(m,15000,90,next).hp,92);
 assert.equal(m.world.get(id,'MaintenanceCycle').elapsedMs,0);
});
test('cycle state survives ECS world serialization without a new game-wide timer',()=>{
 const {m,id}=setup();preview.setObserved(m,[7]);
 maintenance.step(m,7800,73);
 const restored={...m,world:World.restore(m.world.serialize())};
 assert.equal(restored.world.get(id,'MaintenanceCycle').elapsedMs,7800);
 assert.equal(maintenance.step(restored,22200,73).hp,75);
});

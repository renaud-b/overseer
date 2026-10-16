'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const {World}=require('../src/core/World.js'),preview=require('../src/core/VNextPreview.js'),tech=require('../src/core/VNextTechnologies.js');
test('laboratory creates one-shot researched technologies only under vision, with persisted progress',()=>{
 const m=preview.createModel(World),id=preview.placeBuilding(m,'laboratory',6);
 preview.setObserved(m,[6]);assert.equal(tech.step(m,6000).length,0);
 preview.setObserved(m,[]);tech.step(m,30000);
 assert.equal(m.world.get(id,'Research').elapsedMs,6000);
 preview.setObserved(m,[6]);const events=tech.step(m,6000);
 assert.equal(events.length,1);assert.deepEqual(tech.inventory(m).items,['healing_field']);
 assert.equal(tech.consume(m,'healing_field'),true);assert.equal(tech.consume(m,'healing_field'),false);
 assert.deepEqual(tech.inventory(m).items,[]);
 assert.throws(()=>tech.step(m,-1),/Invalid technology delta/);
});

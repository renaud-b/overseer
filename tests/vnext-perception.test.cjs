'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const {World}=require('../src/core/World.js');
const preview=require('../src/core/VNextPreview.js');
const cards=require('../src/core/VNextCards.js');
const threats=require('../src/core/VNextThreats.js');
function enemy(model,x,y=300,side='enemy') {
 const id=model.world.create(model.game);
 model.world.set(id,'Position',{x,y});
 model.world.set(id,'Faction',{side});
 model.world.set(id,'Health',{hp:5,maxHp:5});
 return id;
}
function setup() {
 const m=preview.createModel(World);
 const amplifier=preview.placeBuilding(m,'perception_amplifier',6);
 return {m,amplifier};
}
test('amplifier emits a zero-to-edge sweep while the core keeps its 350-unit sensor',()=>{
 const {m}=setup();
 assert.equal(threats.radius(m),350);
 assert.equal(threats.sweepRadius(m),0);
 threats.step(m,2500);
 assert.equal(m.world.get(m.game,'PerceptionPulse'),undefined,'inactive state stays untouched');
 preview.setObserved(m,[6]);
 assert.equal(threats.radius(m),350);
 assert.equal(threats.sweepRadius(m),0,'the pure renderer read never creates ECS state');
 threats.step(m,2500);
 assert.equal(threats.radius(m),350);
 assert.equal(threats.sweepRadius(m),threats.PULSE.maxRadius/2);
 threats.step(m,2400);
 assert.ok(threats.sweepRadius(m)>950);
 threats.step(m,100);
 assert.equal(threats.sweepRadius(m),0,'one full sweep vanishes at the edge');
 preview.setObserved(m,[]);
 threats.step(m,2500);
 assert.equal(threats.sweepRadius(m),0);
 assert.equal(m.world.get(m.game,'PerceptionPulse').phaseMs,0);
});
test('sweep marks distant enemies precisely as the wavefront crosses, never before',()=>{
 const {m}=setup();
 const first=enemy(m,520),far=enemy(m,1000,600);
 const ignoredAlly=enemy(m,520,300,'player'),dead=enemy(m,540);
 m.world.get(dead,'Health').hp=0;
 preview.setObserved(m,[6]);
 // Distance of first from core is 455; the first 2 seconds reach only 408.
 threats.update(m.world,[first,far,ignoredAlly,dead],0);
 threats.step(m,2000,1,[first,far,ignoredAlly,dead]);
 assert.equal(m.world.get(first,'ThreatMark'),undefined);
 assert.equal(m.world.get(far,'ThreatMark'),undefined);
 threats.step(m,500,1,[first,far,ignoredAlly,dead]); // 510 radius
 assert.equal(m.world.get(first,'ThreatMark').remainingMs,2000);
 assert.equal(m.world.get(far,'ThreatMark'),undefined);
 assert.equal(m.world.get(ignoredAlly,'ThreatMark'),undefined);
 assert.equal(m.world.get(dead,'ThreatMark'),undefined);
 threats.update(m.world,[first,far],1000);
 assert.equal(m.world.get(first,'ThreatMark').remainingMs,1000);
 threats.step(m,2300,1,[first,far]); // Radar reaches 979: far corner not yet
 assert.equal(m.world.get(far,'ThreatMark'),undefined);
 threats.step(m,200,1,[first,far]); // Wave beyond the furthest corner, then resets
 assert.equal(m.world.get(far,'ThreatMark').remainingMs,2000);
 assert.equal(threats.sweepRadius(m),0);
 threats.update(m.world,[first,far],2000);
 assert.equal(m.world.get(first,'ThreatMark'),undefined);
 assert.equal(m.world.get(far,'ThreatMark'),undefined);
});
test('core sensor still marks nearby targets when no amplifier is active',()=>{
 const {m}=setup();
 const nearby=enemy(m,350),distant=enemy(m,900);
 threats.update(m.world,[nearby,distant],16);
 assert.equal(m.world.get(nearby,'ThreatMark').remainingMs,2000);
 assert.equal(m.world.get(distant,'ThreatMark'),undefined);
 preview.setObserved(m,[6]);threats.step(m,4300,1,[nearby,distant]);
 assert.equal(threats.radius(m),350);
 assert.equal(m.world.get(distant,'ThreatMark').remainingMs,2000);
 preview.setObserved(m,[]);
 threats.update(m.world,[nearby,distant],2000);
 assert.equal(m.world.get(nearby,'ThreatMark').remainingMs,2000);
 assert.equal(m.world.get(distant,'ThreatMark'),undefined);
});
test('radar remembers its phase across pause, lost vision and ECS save/Continue',()=>{
 const {m}=setup();
 preview.setObserved(m,[6]);
 threats.step(m,1250);
 const snapshot=World.restore(m.world.serialize()),restored={...m,world:snapshot};
 assert.equal(threats.sweepRadius(restored),255);
 threats.step(restored,0);
 assert.equal(threats.sweepRadius(restored),255);
 preview.setObserved(restored,[]);
 threats.step(restored,5000);
 assert.equal(restored.world.get(restored.game,'PerceptionPulse').phaseMs,1250);
 assert.equal(threats.sweepRadius(restored),0);
 preview.setObserved(restored,[6]);
 assert.equal(threats.sweepRadius(restored),255);
 threats.step(restored,1250);
 assert.equal(threats.sweepRadius(restored),510);
 assert.throws(()=>threats.step(restored,-1),/Invalid perception delta/);
 assert.throws(()=>threats.step(restored,20,0.5),/Invalid perception delta/);
});
test('cooling accelerates the entire traveling wave, including a sweep wrap',()=>{
 const {m}=setup(),e=enemy(m,600);
 preview.setObserved(m,[6]);
 threats.step(m,2000,1.2,[e]);
 assert.equal(m.world.get(e,'ThreatMark'),undefined);
 assert.equal(m.world.get(m.game,'PerceptionPulse').phaseMs,2400);
 threats.step(m,250,1.2,[e]);
 assert.equal(m.world.get(e,'ThreatMark').remainingMs,2000);
 threats.step(m,4000,1.2,[e]); // One full cycle crossed; no unbounded simulation loop.
 assert.ok(m.world.get(e,'ThreatMark'));
 assert.ok(threats.sweepRadius(m)>0);
});
test('the amplifier stays a reward building rather than a starter card',()=>{
 const m=preview.createModel(World);
 assert.ok(cards.REWARD_CARDS.includes('perception_amplifier'));
 assert.ok(!cards.STARTER_CARDS.includes('perception_amplifier'));
 assert.equal(cards.grant(m,'perception_amplifier'),true);
 assert.ok(cards.cards(m).includes('perception_amplifier'));
});

'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const {World}=require('../src/core/World.js');
const threats=require('../src/core/VNextThreats.js');
const combat=require('../src/core/CombatSystem.js');
function make(w,side,x,y=300,behavior=null){
 const id=w.create();w.set(id,'Position',{x,y});
 w.set(id,'Health',{hp:10,maxHp:10});w.set(id,'Faction',{side});
 w.set(id,'Movement',{speed:30});
 w.set(id,'Combat',{damage:1,range:20,attackType:'melee',cooldownMs:1000,
 elapsedMs:0,detectionRadius:400,behavior});return id;
}
test('AI detection marks entering enemies and forgets two seconds after exit',()=>{
 const w=new World(),e=make(w,'enemy',500);
 threats.update(w,[e],16);assert.equal(w.get(e,'ThreatMark'),undefined);
 w.get(e,'Position').x=350;threats.update(w,[e],16);
 assert.equal(w.get(e,'ThreatMark').remainingMs,2000);
 w.get(e,'Position').x=800;threats.update(w,[e],1999);
 assert.equal(w.get(e,'ThreatMark').remainingMs,1);
 threats.update(w,[e],1);assert.equal(w.get(e,'ThreatMark'),undefined);
});
test('allies hold position outside detection, pursue marked targets, then disengage',()=>{
 const w=new World(),a=make(w,'player',160),e=make(w,'enemy',560);
 combat.stepUnit(w,a,1000,{opponents:[e],centralDetection:true});
 assert.equal(w.get(a,'Position').x,160);
 w.get(e,'Position').x=330;threats.update(w,[e],16);
 combat.stepUnit(w,a,1000,{opponents:[e],centralDetection:true});
 assert.ok(w.get(a,'Position').x>160);
 w.get(e,'Position').x=800;threats.update(w,[e],2000);
 const x=w.get(a,'Position').x;
 combat.stepUnit(w,a,1000,{opponents:[e],centralDetection:true});
 assert.equal(w.get(a,'Position').x,x);
});
test('local defense remains available when no mark; healers never attack',()=>{
 const w=new World(),a=make(w,'player',160),e=make(w,'enemy',170),h=make(w,'player',150,300,'healer');
 const ev=combat.stepUnit(w,a,1000,{opponents:[e],centralDetection:true});
 assert.ok(ev.some(x=>x.type==='attack'));
 const hp=w.get(e,'Health').hp;
 combat.stepUnit(w,h,1000,{opponents:[e],allies:[a,h],centralDetection:true});
 assert.equal(w.get(e,'Health').hp,hp);
});

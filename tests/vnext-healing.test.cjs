'use strict';
const test=require('node:test'), assert=require('node:assert/strict');
const {World}=require('../src/core/World.js'), combat=require('../src/core/CombatSystem.js');
test('repair drone heals a damaged ally but never damages enemies or exceeds max HP',()=>{
 const w=new World();
 function unit(x,hp,maxHp,behavior){
  const id=w.create();w.set(id,'Position',{x,y:0});w.set(id,'Health',{hp,maxHp});
  w.set(id,'Faction',{side:'player'});w.set(id,'Movement',{speed:25});
  w.set(id,'Combat',{behavior,damage:2,range:65,attackType:'melee',cooldownMs:1000,elapsedMs:0,detectionRadius:400});
  return id;
 }
 const heal=unit(0,4,4,'healer'), ally=unit(10,2,5,null), enemy=unit(20,5,5,null);
 w.get(enemy,'Faction').side='enemy';
 const args={allies:[heal,ally],opponents:[enemy],patrol:{x:0,y:0}};
 const events=combat.stepUnit(w,heal,1000,args);
 assert.equal(events[0].type,'heal'); assert.equal(w.get(ally,'Health').hp,4);
 assert.equal(w.get(enemy,'Health').hp,5);
 combat.stepUnit(w,heal,1000,args);
 assert.equal(w.get(ally,'Health').hp,5);
 assert.equal(w.get(ally,'Health').maxHp,5);
});

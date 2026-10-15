'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const {World}=require('../src/core/World.js');
const {stepUnit}=require('../src/core/CombatSystem.js');
function unit(w,x,side,extras={}) { const id=w.create();w.set(id,'Position',{x,y:0});w.set(id,'Health',{hp:10,maxHp:10});w.set(id,'Faction',{side});w.set(id,'Movement',{speed:30});w.set(id,'Combat',{damage:2,range:20,attackType:'melee',cooldownMs:1000,elapsedMs:0,detectionRadius:100,behavior:null,...extras});return id;}
test('melee movement and attack, data only',()=>{const w=new World();let p=unit(w,0,'player'),e=unit(w,50,'enemy');stepUnit(w,p,1000,{opponents:[e]});assert.ok(w.get(p,'Position').x>0);assert.equal(w.get(e,'Health').hp,10);const ev=stepUnit(w,p,1000,{opponents:[e]});assert.equal(ev[0].type,'attack');assert.equal(w.get(e,'Health').hp,8);});
test('base rusher ignores opposing unit',()=>{const w=new World();let r=unit(w,0,'enemy',{behavior:'base_rusher'}),p=unit(w,5,'player');stepUnit(w,r,1000,{opponents:[p],base:{x:100,y:0}});assert.equal(w.get(p,'Health').hp,10);assert.equal(w.get(r,'Position').x,30);});
test('enemy attacking base reports damage without Phaser',()=>{const w=new World();let e=unit(w,0,'enemy');const ev=stepUnit(w,e,1000,{base:{x:10,y:0}});assert.deepEqual(ev.map(x=>x.type),['base-attack']);});

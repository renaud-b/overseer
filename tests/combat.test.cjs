'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const {World}=require('../src/core/World.js');
const {stepUnit}=require('../src/core/CombatSystem.js');
function unit(w,x,side,extras={}) { const id=w.create();w.set(id,'Position',{x,y:0});w.set(id,'Health',{hp:10,maxHp:10});w.set(id,'Faction',{side});w.set(id,'Movement',{speed:30});w.set(id,'Combat',{damage:2,range:20,attackType:'melee',cooldownMs:1000,elapsedMs:0,detectionRadius:100,behavior:null,...extras});return id;}
test('melee movement and attack, data only',()=>{const w=new World();let p=unit(w,0,'player'),e=unit(w,50,'enemy');stepUnit(w,p,1000,{opponents:[e]});assert.ok(w.get(p,'Position').x>0);assert.equal(w.get(e,'Health').hp,10);const ev=stepUnit(w,p,1000,{opponents:[e]});assert.equal(ev[0].type,'attack');assert.equal(w.get(e,'Health').hp,8);});
test('base rusher ignores opposing unit',()=>{const w=new World();let r=unit(w,0,'enemy',{behavior:'base_rusher'}),p=unit(w,5,'player');stepUnit(w,r,1000,{opponents:[p],base:{x:100,y:0}});assert.equal(w.get(p,'Health').hp,10);assert.equal(w.get(r,'Position').x,30);});
test('enemy attacking base reports damage without Phaser',()=>{const w=new World();let e=unit(w,0,'enemy');const ev=stepUnit(w,e,1000,{base:{x:10,y:0}});assert.deepEqual(ev.map(x=>x.type),['base-attack']);});

test('friendly units separate when overlapped, including exactly coincident positions', () => {
 const world = new World();
 const make = (side, x, y) => {
  const id = world.create();
  world.set(id,'Position',{x,y});
  world.set(id,'Faction',{side});
  world.set(id,'Health',{hp:10,maxHp:10});
  return id;
 };
 const a = make('player',100,100), b = make('player',100,100);
 const enemy = make('enemy',100,100);
 combat.separateUnits(world,[a,b,enemy],22);
 const pa = world.get(a,'Position'), pb = world.get(b,'Position'), pe = world.get(enemy,'Position');
 assert.ok(Math.hypot(pa.x-pb.x,pa.y-pb.y) >= 21.99);
 assert.equal(pe.x,100);
 assert.equal(pe.y,100);
 assert.ok(Number.isFinite(pa.x) && Number.isFinite(pb.x));
});
test('separation ignores dead units and leaves already spaced units alone', () => {
 const world = new World();
 const make = (x,hp) => {
  const id=world.create();
  world.set(id,'Position',{x,y:0});
  world.set(id,'Faction',{side:'player'});
  world.set(id,'Health',{hp,maxHp:10});
  return id;
 };
 const first=make(10,10), distant=make(100,10), corpse=make(10,0);
 combat.separateUnits(world,[first,distant,corpse]);
 assert.equal(world.get(first,'Position').x,10);
 assert.equal(world.get(distant,'Position').x,100);
});

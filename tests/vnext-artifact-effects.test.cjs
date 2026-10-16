'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { World } = require('../src/core/World.js');
const preview = require('../src/core/VNextPreview.js');
const economy = require('../src/core/VNextEconomy.js');
const artifacts = require('../src/core/VNextArtifacts.js');
const effects = require('../src/core/VNextArtifactEffects.js');

function model() {
 const m=preview.createModel(World);
 economy.initialize(m);artifacts.collection(m);effects.state(m);
 return m;
}
function resources(m){return m.world.get(m.game,'Resources');}
function unit(m,side,x,y,hp=10,type='unit_guard') {
 const id=m.world.create(m.game);
 m.world.set(id,'Faction',{side});
 m.world.set(id,'Position',{x,y});
 m.world.set(id,'Health',{hp,maxHp:hp});
 m.world.set(id,'PreviewUnit',{type});
 return id;
}
test('Écho consumes the real recipe once while unobserved and never bypasses resource scarcity', () => {
 const m=model(),id=preview.placeBuilding(m,'factory',6);
 artifacts.add(m,'echo');
 let out=effects.production(m,20000,economy);
 assert.deepEqual(out,[]);
 assert.equal(resources(m).components,0);
 resources(m).energy=2;resources(m).matter=2;
 out=effects.production(m,20000,economy);
 assert.equal(out.filter(e=>e.artifact==='echo').length,1);
 assert.equal(out[0].building,id);
 assert.deepEqual([resources(m).energy,resources(m).matter,resources(m).components],[0,0,1]);
 assert.equal(m.world.get(id,'Production').elapsedMs,0);
});

test('Écho cannot exceed military capacity and never creates a backlog of units', () => {
 const m=model();
 preview.placeBuilding(m,'barracks',6);
 artifacts.add(m,'echo');
 resources(m).components=300;resources(m).energy=180;
 for(let i=0;i<3;i++) {
  const id=unit(m,'player',10+i,20,5);
  m.world.get(id,'PreviewUnit').type='unit_guard';
 }
 assert.equal(economy.unitCapacity(m,'barracks'),3);
 assert.equal(effects.production(m,20000,economy).length,0);
 assert.equal(resources(m).components,300);
});
test('Mémoire résiduelle preserves fractional progress but works exactly three simulated seconds after exit', () => {
 const m=model(),id=preview.placeBuilding(m,'reactor',6);
 artifacts.add(m,'lingering');
 preview.setObserved(m,[6]);
 effects.syncAttention(m);
 effects.production(m,1000,economy);
 assert.equal(resources(m).energy,0);
 preview.setObserved(m,[]);
 const gained=effects.production(m,3000,economy);
 assert.equal(gained.length,2);
 assert.equal(resources(m).energy,4);
 effects.production(m,10000,economy);
 assert.equal(resources(m).energy,4);
 assert.equal(m.world.get(id,'Production').elapsedMs,0);
 preview.setObserved(m,[6]);
 effects.production(m,1000,economy);
 assert.equal(resources(m).energy,4);
});
test('Parallélisme duplique un seul résultat industriel sans reconsommer ni générer des unités', () => {
 const m=model(); preview.placeBuilding(m,'reactor',6);
 preview.setObserved(m,[6]);artifacts.add(m,'duplicate');
 let events=effects.production(m,30000,economy);
 assert.equal(events.filter(e=>e.artifact==='duplicate').length,1);
 assert.equal(resources(m).energy,32); // 15 ordinary cycles + 1 bonus.
 effects.production(m,2000,economy);
 assert.equal(resources(m).energy,34);
 const state=effects.state(m);
 assert.equal(state.duplicateMs,2000);
});
test('Génération spontanée follows deterministic 10% roll, requires capacity and costs nothing', () => {
 const m=model();preview.placeBuilding(m,'barracks',6);
 artifacts.add(m,'spontaneous');
 const before={...resources(m)};
 const successes=[];
 for(let seed=0;seed<1500;seed++) {
  const events=effects.startWave(m,1,seed,100,economy);
  if(events.length)successes.push([seed,events]);
 }
 assert.ok(successes.length>50 && successes.length<250);
 const [seed,events]=successes[0];
 assert.deepEqual(effects.startWave(m,1,seed,100,economy),events);
 assert.equal(events[0].unitType,'unit_guard');
 assert.deepEqual(resources(m),before);
 for(let i=0;i<3;i++)unit(m,'player',i,i);
 assert.equal(effects.startWave(m,1,seed,100,economy).length,0);
});
test('Jugement du noyau waits for an enemy in detection radius; timers are simulated and saved', () => {
 const m=model(); artifacts.add(m,'core_laser');
 const enemy=unit(m,'enemy',450,300,10);
 assert.equal(effects.laser(m,15000),null);
 assert.equal(effects.state(m).laserMs,15000);
 m.world.get(enemy,'Position').x=140;
 const shot=effects.laser(m,0);
 assert.equal(shot.target,enemy);
 assert.equal(shot.damage,3);
 assert.equal(m.world.get(enemy,'Health').hp,7);
 assert.equal(effects.laser(m,0),null);
 const saved=m.world.serialize(),copy=World.restore(saved);
 assert.equal(copy.get(m.game,'ArtifactEffects').laserMs,0);
 assert.equal(effects.valid(copy.get(m.game,'ArtifactEffects')),true);
});
test('Bouclier absorbs at threshold only once per wave; recovery requires damage during that wave', () => {
 const m=model(); artifacts.add(m,'shield');artifacts.add(m,'recovery');
 effects.startWave(m,2,12,42,economy);
 const first=effects.baseHit(m,42,18);
 assert.equal(first.activated,true);
 assert.equal(first.absorbed,15);
 assert.equal(first.hp,39);
 const second=effects.baseHit(m,39,20);
 assert.equal(second.activated,false);
 assert.equal(second.hp,19);
 assert.deepEqual(effects.clearWave(m,2,19),{hp:24,healed:5});
 assert.deepEqual(effects.clearWave(m,2,19),{hp:19,healed:0});
 effects.startWave(m,3,12,24,economy);
 assert.equal(effects.baseHit(m,24,2).activated,true);
 assert.equal(effects.clearWave(m,3,24).healed,0);
});
test('Dernière instruction hits only nearby living enemies, never chains from enemy deaths', () => {
 const m=model();artifacts.add(m,'death_burst');
 const dead=unit(m,'player',100,100,0);
 const close=unit(m,'enemy',130,100,5);
 const far=unit(m,'enemy',400,100,5);
 const deadEnemy=unit(m,'enemy',100,100,0);
 const hits=effects.deaths(m,[dead,deadEnemy]);
 assert.equal(hits.length,1);
 assert.equal(hits[0].target,close);
 assert.equal(m.world.get(close,'Health').hp,3);
 assert.equal(m.world.get(far,'Health').hp,5);
 assert.equal(m.world.get(deadEnemy,'Health').hp,0);
});
test('inventory and effect runtime survive ECS round-trip and corrupted effect state is rejected', () => {
 const m=model();artifacts.add(m,'echo');artifacts.add(m,'lingering');
 preview.placeBuilding(m,'reactor',6);preview.setObserved(m,[6]);effects.syncAttention(m);
 preview.setObserved(m,[]);effects.production(m,1250,economy);
 const snap=m.world.serialize();
 const restored=World.restore(snap);
 const other={...m,world:restored};
 assert.deepEqual(artifacts.list(other),['echo','lingering']);
 assert.equal(effects.state(other).echoMs,1250);
 assert.equal(effects.state(other).grace[28],1750);
 assert.equal(effects.valid(effects.state(other)),true);
 const corrupt=JSON.parse(JSON.stringify(effects.state(other)));
 corrupt.grace[28]=-5000;
 assert.equal(effects.valid(corrupt),false);
});

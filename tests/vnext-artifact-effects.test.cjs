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

test('Hyperfocalisation adds 40% progress only when one productive building is observed', () => {
 const m=model();const reactor=preview.placeBuilding(m,'reactor',6);
 preview.placeBuilding(m,'extractor',7);
 artifacts.add(m,'hyperfocus');
 preview.setObserved(m,[6,11,12]); // Two empty observed tiles do not break focus.
 assert.equal(effects.focusedBuilding(m,economy),reactor);
 assert.deepEqual(effects.production(m,1000,economy),[]);
 assert.equal(m.world.get(reactor,'Production').elapsedMs,1400);
 // A second observed producer cancels the boost immediately.
 preview.setObserved(m,[6,7]);
 assert.equal(effects.focusedBuilding(m,economy),null);
 effects.production(m,500,economy);
 assert.equal(m.world.get(reactor,'Production').elapsedMs,1900);
 // Focus resumes without any sudden catch-up.
 preview.setObserved(m,[6]);
 effects.production(m,100,economy);
 assert.equal(resources(m).energy,2);
 assert.ok(Math.abs(m.world.get(reactor,'Production').elapsedMs-40)<0.0001);
 preview.setObserved(m,[]);
 effects.production(m,2000,economy);
 assert.ok(Math.abs(m.world.get(reactor,'Production').elapsedMs-40)<0.0001);
});
test('Hyperfocalisation also accelerates research, not a separate unobserved lab', () => {
 const technologies=require('../src/core/VNextTechnologies.js');
 const m=model(),lab=preview.placeBuilding(m,'laboratory',6);
 artifacts.add(m,'hyperfocus');preview.setObserved(m,[6]);
 const focus=effects.focusedBuilding(m,economy);
 assert.equal(focus,lab);
 assert.deepEqual(technologies.step(m,20000,focus),[]);
 assert.equal(m.world.get(lab,'Research').elapsedMs,28000);
 assert.equal(technologies.step(m,0,focus).length,0);
 assert.equal(technologies.step(m,2000,focus).length,1);
 // Observing a second building removes the research multiplier.
 preview.placeBuilding(m,'reactor',7);preview.setObserved(m,[6,7]);
 assert.equal(effects.focusedBuilding(m,economy),null);
 const before=m.world.get(lab,'Research').elapsedMs;
 technologies.step(m,1000,effects.focusedBuilding(m,economy));
 assert.equal(m.world.get(lab,'Research').elapsedMs,before+1000);
});
test('Hyperfocalisation and Surcharge stack additively without accelerating grace time', () => {
 const m=model(),id=preview.placeBuilding(m,'reactor',6);
 artifacts.add(m,'hyperfocus');artifacts.add(m,'lingering');
 preview.setObserved(m,[6]);effects.syncAttention(m);
 m.world.set(m.game,'TechnologyEffects',{overloadMs:3000});
 effects.production(m,1000,economy);
 assert.equal(m.world.get(id,'Production').elapsedMs,400); // 2.4s work, one completed cycle.
 preview.setObserved(m,[]);
 effects.production(m,1000,economy);
 assert.equal(m.world.get(id,'Production').elapsedMs,1400); // Only 1s of grace work.
});
test('Recyclage neuronal returns 25% of a paid unit recipe only once', () => {
 const m=model();artifacts.add(m,'recycle');
 const dead=unit(m,'player',100,100,0);
 m.world.set(dead,'ManufacturedCost',{resources:{components:25,energy:15}});
 const free=unit(m,'player',110,100,0);
 assert.deepEqual(effects.recycle(m,[free,dead]),[{type:'artifact-recycle',unit:dead,refunded:{components:6,energy:4}}]);
 assert.equal(resources(m).components,6);
 assert.equal(resources(m).energy,4);
 assert.equal(m.world.hasComponent(dead,'ManufacturedCost'),false);
 assert.deepEqual(effects.recycle(m,[dead,free]),[]);
 assert.equal(resources(m).energy,4);
 const alive=unit(m,'player',120,100,6);
 m.world.set(alive,'ManufacturedCost',{resources:{components:25}});
 assert.deepEqual(effects.recycle(m,[alive]),[]);
 assert.equal(resources(m).components,6);
});
test('Recyclage refunds round to whole units on top of an existing balance', () => {
 const m=model();artifacts.add(m,'recycle');
 resources(m).energy=47;
 resources(m).components=44;
 const dead=unit(m,'player',100,100,0);
 m.world.set(dead,'ManufacturedCost',{resources:{energy:15,components:25}});
 const events=effects.recycle(m,[dead]);
 assert.deepEqual(events[0].refunded,{energy:4,components:6});
 assert.equal(resources(m).energy,51); // Not 50.75.
 assert.equal(resources(m).components,50); // Not 50.25.
 assert.ok(Number.isInteger(resources(m).energy));
 assert.ok(Number.isInteger(resources(m).components));
 assert.deepEqual(effects.recycle(m,[dead]),[]);
});

test('Propagation de conscience targets nearest LIVING enemy and expires outside detection', () => {
 const threats=require('../src/core/VNextThreats.js');
 const m=model();artifacts.add(m,'mark_chain');
 const victim=unit(m,'enemy',850,300,0);
 m.world.set(victim,'ThreatMark',{remainingMs:300});
 const deadNear=unit(m,'enemy',853,300,0);
 const closest=unit(m,'enemy',860,300,5);
 const far=unit(m,'enemy',930,300,5);
 assert.deepEqual(effects.propagate(m,[deadNear]),[]);
 const events=effects.propagate(m,[victim,deadNear]);
 assert.equal(events.length,1);
 assert.equal(events[0].target,closest);
 assert.equal(m.world.get(closest,'ThreatMark').remainingMs,effects.MARK_MS);
 assert.equal(m.world.get(far,'ThreatMark'),undefined);
 assert.equal(m.world.get(victim,'ThreatMark'),undefined);
 assert.deepEqual(effects.propagate(m,[victim]),[]);
 threats.update(m.world,[closest],1000);
 assert.equal(m.world.get(closest,'ThreatMark').remainingMs,1000);
 threats.update(m.world,[closest],1000);
 assert.equal(m.world.get(closest,'ThreatMark'),undefined);
});
test('Propagation keeps a longer pre-existing mark and ignores unmarked victims', () => {
 const m=model();artifacts.add(m,'mark_chain');
 const victim=unit(m,'enemy',700,100,0),target=unit(m,'enemy',705,100,10);
 assert.deepEqual(effects.propagate(m,[victim]),[]);
 m.world.set(victim,'ThreatMark',{remainingMs:100});
 m.world.set(target,'ThreatMark',{remainingMs:3500});
 const ev=effects.propagate(m,[victim]);
 assert.equal(ev.length,1);
 assert.equal(m.world.get(target,'ThreatMark').remainingMs,3500);
});
test('catalogue and deterministic artifact offerings include the three new ids', () => {
 const reward=require('../src/core/VNextRewards.js');
 for(const id of ['hyperfocus','recycle','mark_chain']){
  assert.ok(artifacts.IDS.includes(id));
  assert.ok(artifacts.get(id)?.description);
 }
 const offering=new Set();
 for(let n=3;n<180;n++){
  const r=reward.create(n,93,['reactor','factory','barracks'],['berserk','stasis_field','healing_field'],artifacts.IDS,[]);
  const stage=r.stages.find(s=>s.kind==='artifact');
  if(stage)for(const opt of stage.options)offering.add(opt);
 }
 for(const id of ['hyperfocus','recycle','mark_chain'])assert.ok(offering.has('artifact:'+id));
});

test('Réseau parasitaire grants only progress to one directly adjacent unobserved machine', () => {
 const m=model(),reactor=preview.placeBuilding(m,'reactor',6);
 const neighbor=preview.placeBuilding(m,'factory',7);
 preview.placeBuilding(m,'extractor',12); // Diagonal, not eligible.
 economy.initialize(m);
 artifacts.add(m,'parasite_network');
 preview.setObserved(m,[6]);
 const events=effects.production(m,2000,economy);
 const pulses=events.filter(e=>e.type==='artifact-network');
 assert.equal(events.filter(e=>e.type==='production').length,1);
 assert.equal(pulses.length,1);
 assert.equal(pulses[0].from,reactor);
 assert.equal(pulses[0].building,neighbor);
 assert.equal(pulses[0].gainedMs,600);
 assert.equal(m.world.get(neighbor,'Production').elapsedMs,600);
 assert.equal(resources(m).components,0);
 // Once observed, the neighbor is not aided, but its accumulated work is retained.
 preview.setObserved(m,[6,7]);
 const next=effects.production(m,2000,economy);
 assert.equal(next.filter(e=>e.type==='artifact-network').length,0);
 assert.equal(m.world.get(neighbor,'Production').elapsedMs,2600);
});
test('Réseau parasitaire never manufactures a unit, reserves resources or cascades from Echo', () => {
 const m=model(),reactor=preview.placeBuilding(m,'reactor',6);
 const barracks=preview.placeBuilding(m,'barracks',7);
 economy.initialize(m);
 artifacts.add(m,'parasite_network');
 preview.setObserved(m,[6]);
 const events=effects.production(m,20000,economy);
 assert.equal(events.filter(e=>e.type==='artifact-network').length,5);
 assert.equal(events.filter(e=>e.type==='unit-produced').length,0);
 assert.equal(m.world.get(barracks,'Production').elapsedMs,5000);
 assert.equal(resources(m).components,0);
 // Even a ready unobserved barracks waits until observed, then pays at completion.
 resources(m).components=25;resources(m).energy=15;
 preview.setObserved(m,[7]);
 const next=effects.production(m,1,economy);
 assert.equal(next.filter(e=>e.type==='unit-produced').length,1);
 assert.equal(resources(m).components,0);
 assert.equal(resources(m).energy,0);
 // Echo can produce off vision, but it never triggers the parasitic network.
 const isolated=model(),other=preview.placeBuilding(isolated,'extractor',6);
 preview.placeBuilding(isolated,'reactor',7);
 economy.initialize(isolated);
 artifacts.add(isolated,'echo');artifacts.add(isolated,'parasite_network');
 const echo=effects.production(isolated,20000,economy);
 assert.ok(echo.some(e=>e.artifact==='echo'));
 assert.equal(echo.filter(e=>e.type==='artifact-network').length,0);
 assert.equal(isolated.world.get(other,'Production').elapsedMs,0);
});
test('Surcharge terminale arcs to at most two nearby living enemies only on a killing laser hit', () => {
 const m=model();artifacts.add(m,'core_laser');artifacts.add(m,'terminal_overload');
 const victim=unit(m,'enemy',200,300,3),close=unit(m,'enemy',208,300,5);
 const closer=unit(m,'enemy',205,305,5),far=unit(m,'enemy',390,300,5);
 const hit=effects.laser(m,15000);
 assert.equal(hit.target,victim);
 assert.equal(m.world.get(victim,'Health').hp,0);
 assert.deepEqual(hit.chains.map(e=>e.target),[closer,close]);
 assert.equal(m.world.get(close,'Health').hp,3);
 assert.equal(m.world.get(closer,'Health').hp,3);
 assert.equal(m.world.get(far,'Health').hp,5);
 assert.equal(effects.laser(m,0),null); // No recursive or repeated discharge.
});
test('Surcharge terminale without a killing shot or without the core laser does nothing', () => {
 const m=model();artifacts.add(m,'core_laser');artifacts.add(m,'terminal_overload');
 const victim=unit(m,'enemy',150,300,10);
 unit(m,'enemy',160,300,10);
 assert.deepEqual(effects.laser(m,15000).chains,[]);
 assert.equal(m.world.get(victim,'Health').hp,7);
 const disabled=model();artifacts.add(disabled,'terminal_overload');
 unit(disabled,'enemy',150,300,2);
 assert.equal(effects.laser(disabled,50000),null);
});
test('Transfert vital heals nearest injured survivor by at most 30% max HP once', () => {
 const m=model();artifacts.add(m,'vital_transfer');
 const dead=unit(m,'player',200,200,0);
 const healthy=unit(m,'player',201,200,10);
 const target=unit(m,'player',205,200,10);
 m.world.get(target,'Health').hp=4;
 const far=unit(m,'player',275,200,10);
 m.world.get(far,'Health').hp=1;
 const events=effects.vital(m,[dead]);
 assert.equal(events.length,1);
 assert.equal(events[0].target,target);
 assert.equal(events[0].amount,3);
 assert.equal(m.world.get(target,'Health').hp,7);
 assert.equal(m.world.get(healthy,'Health').hp,10);
 assert.equal(m.world.get(far,'Health').hp,1);
 assert.deepEqual(effects.vital(m,[dead]),[]);
 const second=unit(m,'player',201,202,0);
 m.world.get(target,'Health').hp=9.5;
 assert.equal(effects.vital(m,[second])[0].amount,0.5);
 assert.equal(m.world.get(target,'Health').hp,10);
});
test('Transfert vital never revives dead allies or heals enemies', () => {
 const m=model();artifacts.add(m,'vital_transfer');
 const dead=unit(m,'player',100,100,0);
 const corpse=unit(m,'player',101,100,0);
 const foe=unit(m,'enemy',102,100,10);
 m.world.get(foe,'Health').hp=1;
 assert.deepEqual(effects.vital(m,[dead,corpse]),[]);
 assert.equal(m.world.get(corpse,'Health').hp,0);
 assert.equal(m.world.get(foe,'Health').hp,1);
});
test('the three new artefacts join rewards without changing the six-slot cap', () => {
 const rewards=require('../src/core/VNextRewards.js');
 for(const id of ['terminal_overload','parasite_network','vital_transfer']) {
  assert.ok(artifacts.IDS.includes(id));
  assert.ok(artifacts.get(id)?.description);
 }
 const m=model();
 assert.equal(artifacts.available(m).includes('terminal_overload'),false);
 artifacts.add(m,'core_laser');
 assert.equal(artifacts.available(m).includes('terminal_overload'),true);
 const observed=new Set();
 for(let wave=3;wave<200;wave++) {
  const r=rewards.create(wave,95,['reactor','factory','barracks'],
   ['berserk','healing_field','stasis_field'],artifacts.available(m),artifacts.list(m));
  for(const stage of r.stages.filter(s=>s.kind==='artifact'))
   for(const choice of stage.options)observed.add(choice);
 }
 for(const id of ['terminal_overload','parasite_network','vital_transfer'])
  assert.ok(observed.has('artifact:'+id));
 for(const id of artifacts.IDS)artifacts.add(m,id);
 assert.equal(artifacts.list(m).length,6);
 assert.deepEqual(artifacts.available(m).includes('terminal_overload'),false);
});

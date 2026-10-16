(function(root) {
'use strict';
// Small ECS-only repair system. Each station owns its cycle; at most one
// station can work per tick, regardless of how many are observed.
const CYCLE_MS=30000, HEAL_HP=2, MAX_HP=100;
function buildings(model) {
 const world=model.world;
 return world.query('Building','GridSlot').filter(id=>
  world.get(id,'Building').type==='maintenance');
}
function ensure(model) {
 for(const id of buildings(model)) {
  if(!model.world.hasComponent(id,'MaintenanceCycle'))
   model.world.set(id,'MaintenanceCycle',{elapsedMs:0});
 }
}
function active(model,dt,relayMs={}) {
 const world=model.world;
 return buildings(model).map(id=>{
  const index=world.get(id,'GridSlot').index;
  const watched=world.get(model.tiles[index],'Watched').active;
  return {id,index,ms:watched?dt:Math.min(dt,Math.max(0,relayMs[id]||0))};
 }).filter(x=>x.ms>0).sort((a,b)=>a.index-b.index||a.id-b.id)[0]||null;
}
function step(model,dt,baseHp,relayMs={}) {
 if(!Number.isFinite(dt)||dt<0||!Number.isFinite(baseHp)||
  baseHp<0||baseHp>MAX_HP)throw Error('Invalid maintenance delta or HP');
 ensure(model);
 if(!dt||baseHp<=0)return {hp:baseHp,healed:0,building:null};
 if(baseHp>=MAX_HP){
  // No healing is saved up while the base is already at full HP.
  for(const id of buildings(model))model.world.get(id,'MaintenanceCycle').elapsedMs=0;
  return {hp:baseHp,healed:0,building:null};
 }
 const current=active(model,dt,relayMs);
 if(!current)return {hp:baseHp,healed:0,building:null};
 const progress=model.world.get(current.id,'MaintenanceCycle');
 progress.elapsedMs+=current.ms;
 let hp=baseHp;
 while(progress.elapsedMs>=CYCLE_MS&&hp<MAX_HP) {
  progress.elapsedMs-=CYCLE_MS;
  hp=Math.min(MAX_HP,hp+HEAL_HP);
 }
 if(hp>=MAX_HP)progress.elapsedMs=0;
 return {hp,healed:hp-baseHp,building:current.id};
}
const api={CYCLE_MS,HEAL_HP,MAX_HP,buildings,ensure,active,step};
root.OverseerVNextMaintenance=api;
if(typeof module!=='undefined'&&module.exports)module.exports=api;
})(globalThis);

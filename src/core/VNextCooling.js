(function(root) {
'use strict';
// Provisional proximity cooling. Heat NEVER reduces baseline production or research.
// Cooling is a live, unstocked service supplied only by observed Cryopumps.
const RULES=Object.freeze({
 tickMs:2000,heatPerTick:5,coolPerTick:15,maxHeat:100,
 neighborRange:1,maxBonus:0.2
});
function buildings(model){return model.world.query('Building','GridSlot');}
function slot(model,id){return model.world.get(id,'GridSlot').index;}
function observed(model,id){return model.world.get(model.tiles[slot(model,id)],'Watched').active||
 root.OverseerVNextArtifactEffects?.relayActive(model,id)===true;}
function near(a,b){
 return Math.max(Math.abs(a%5-b%5),Math.abs(Math.floor(a/5)-Math.floor(b/5)))<=RULES.neighborRange;
}
function pumps(model){
 return buildings(model).filter(id=>model.world.get(id,'Building').type==='cryopump'&&observed(model,id));
}
function cooled(model,id,sources=pumps(model)) {
 if(!model.world.has(id)||!model.world.hasComponent(id,'GridSlot'))return false;
 return sources.some(pump=>near(slot(model,pump),slot(model,id)));
}
function ensure(model) {
 for(const id of buildings(model))
  if(!model.world.hasComponent(id,'BuildingHeat'))model.world.set(id,'BuildingHeat',{percent:0,elapsedMs:0});
}
function heat(model,id){return model.world.get(id,'BuildingHeat')?.percent||0;}
function step(model,dt) {
 if(!Number.isFinite(dt)||dt<0)throw Error('Invalid cooling delta');
 ensure(model);
 if(!dt)return;
 const sources=pumps(model);
 for(const id of buildings(model)){
  const status=model.world.get(id,'BuildingHeat');
  status.elapsedMs+=dt;
  const warming=observed(model,id),chilled=cooled(model,id,sources);
  while(status.elapsedMs>=RULES.tickMs){
   status.elapsedMs-=RULES.tickMs;
   status.percent=Math.max(0,Math.min(RULES.maxHeat,
    status.percent+(warming?RULES.heatPerTick:0)-(chilled?RULES.coolPerTick:0)));
  }
 }
}
function bonus(model,id,sources=pumps(model)){
 if(!model.world.has(id)||!model.world.hasComponent(id,'Building')||!observed(model,id)||
    !cooled(model,id,sources))return 0;
 return RULES.maxBonus*(1-heat(model,id)/RULES.maxHeat);
}
function bonuses(model){
 const values={},sources=pumps(model);
 for(const id of buildings(model))values[id]=bonus(model,id,sources);
 return values;
}
function coverage(model){
 const sources=pumps(model);
 const covered=buildings(model).filter(id=>
  model.world.get(id,'Building').type!=='cryopump'&&cooled(model,id,sources));
 return {pumps:sources.length,buildings:covered.length};
}
const api={RULES,buildings,observed,pumps,cooled,ensure,heat,step,bonus,bonuses,coverage};
root.OverseerVNextCooling=api;
if(typeof module!=='undefined'&&module.exports)module.exports=api;
})(globalThis);

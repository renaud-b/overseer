(function(root) {
'use strict';
// Direct proximity bonus. No temperature or delayed ramp-up.
// Cooling is a live, unstocked service supplied only by observed Cryopumps.
const RULES=Object.freeze({
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
function step(model,dt) {
 if(!Number.isFinite(dt)||dt<0)throw Error('Invalid cooling delta');
 // Older saves can contain BuildingHeat: discard obsolete state in place.
 for(const id of model.world.query('BuildingHeat'))model.world.remove(id,'BuildingHeat');
}
function bonus(model,id,sources=pumps(model)){
 if(!model.world.has(id)||!model.world.hasComponent(id,'Building')||!observed(model,id)||
    !cooled(model,id,sources))return 0;
 return RULES.maxBonus;
}
function bonuses(model){
 const values={},sources=pumps(model);
 for(const id of buildings(model))values[id]=bonus(model,id,sources);
 return values;
}
function coverage(model){
 const sources=pumps(model);
 const covered=buildings(model).filter(id=>
  model.world.get(id,'Building').type!=='cryopump'&&observed(model,id)&&cooled(model,id,sources));
 return {pumps:sources.length,buildings:covered.length};
}
const api={RULES,buildings,observed,pumps,cooled,step,bonus,bonuses,coverage};
root.OverseerVNextCooling=api;
if(typeof module!=='undefined'&&module.exports)module.exports=api;
})(globalThis);

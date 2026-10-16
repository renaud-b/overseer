(function(root) {
'use strict';
const TYPES=Object.freeze(['berserk', 'stasis_field', 'overclock', 'overload', 'emp_field', 'reinforcements', 'healing_field']); // Add more spells without changing inventory rules.
const RESEARCH_MS=30000; // Provisional, observed time.
function inventory(model) {
 if(!model.world.hasComponent(model.game,'Technologies')) model.world.set(model.game,'Technologies',{items:[],seed:137});
 return model.world.get(model.game,'Technologies');
}
function next(seed) {let x=seed>>>0;x^=x<<13;x^=x>>>17;x^=x<<5;return x>>>0;}
function step(model,dt) {
 if(!Number.isFinite(dt)||dt<0) throw Error('Invalid technology delta');
 const stock=inventory(model),events=[];
 if(!dt)return events;
 for(const id of model.world.query('Building','GridSlot')) {
  if(model.world.get(id,'Building').type!=='laboratory')continue;
  const slot=model.world.get(id,'GridSlot').index;
  if(!model.world.get(model.tiles[slot],'Watched').active)continue;
  if(!model.world.hasComponent(id,'Research'))model.world.set(id,'Research',{elapsedMs:0});
  const state=model.world.get(id,'Research');state.elapsedMs+=dt;
  while(state.elapsedMs>=RESEARCH_MS) {
   state.elapsedMs-=RESEARCH_MS;stock.seed=next(stock.seed);const kind=TYPES[stock.seed%TYPES.length];
   stock.items.push(kind);events.push({type:'technology-researched',building:id,technology:kind});
  }
 }
 return events;
}
function consume(model,type){const items=inventory(model).items;const at=items.indexOf(type);if(at<0)return false;items.splice(at,1);return true;}
const api={TYPES,RESEARCH_MS,inventory,step,consume};root.OverseerVNextTechnologies=api;if(typeof module!=='undefined'&&module.exports)module.exports=api;
})(globalThis);

(function(root) {
'use strict';
const HEAL=Object.freeze({durationMs:10000,intervalMs:2000,radius:105,amount:1}); // provisional radius/amount.
function cast(model,type,target) {
 if(type!=='healing_field'||!target||!Number.isFinite(target.x)||!Number.isFinite(target.y)||target.x<0||target.x>1000||target.y<0||target.y>600)return null;
 const id=model.world.create(model.game);
 model.world.set(id,'TechnologyZone',{type,x:target.x,y:target.y,radius:HEAL.radius,remainingMs:HEAL.durationMs,untilTickMs:HEAL.intervalMs});
 return id;
}
function step(model,delta) {
 if(!Number.isFinite(delta)||delta<0)throw Error('Invalid zone delta');
 const events=[];
 for(const id of model.world.query('TechnologyZone')) {
  const zone=model.world.get(id,'TechnologyZone');
  const effective=Math.min(delta,zone.remainingMs);
  zone.remainingMs-=effective;zone.untilTickMs-=effective;
  while(zone.untilTickMs<=0 && effective>0) {
   zone.untilTickMs+=HEAL.intervalMs;
   for(const ally of model.world.query('Position','Health','Faction')) {
    const pos=model.world.get(ally,'Position'),hp=model.world.get(ally,'Health');
    if(model.world.get(ally,'Faction').side!=='player'||hp.hp<=0||hp.hp>=hp.maxHp)continue;
    if(Math.hypot(pos.x-zone.x,pos.y-zone.y)>zone.radius)continue;
    const amount=Math.min(HEAL.amount,hp.maxHp-hp.hp);hp.hp+=amount;
    events.push({type:'zone-heal',zone:id,target:ally,amount,x:pos.x,y:pos.y});
   }
  }
  if(zone.remainingMs<=0)model.world.destroy(id);
 }
 return events;
}
const api={HEAL,cast,step};root.OverseerVNextZones=api;if(typeof module!=='undefined'&&module.exports)module.exports=api;
})(globalThis);

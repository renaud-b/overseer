(function(root) {
'use strict';
const BERSERK=Object.freeze({durationMs:8000,targets:2,attackMultiplier:1.5});
const STASIS=Object.freeze({durationMs:10000,radius:110,speedMultiplier:0.5});
const HEAL=Object.freeze({durationMs:10000,intervalMs:2000,radius:105,amount:1}); // provisional radius/amount.
const OVERCLOCK=Object.freeze({durationMs:10000,speedMultiplier:1.5});
const OVERLOAD=Object.freeze({durationMs:8000,productionMultiplier:2});
const EMP=Object.freeze({durationMs:3000,radius:110});
const REINFORCEMENTS=Object.freeze({durationMs:25000,unitType:'unit_guard'});
function validTarget(target){return target&&Number.isFinite(target.x)&&Number.isFinite(target.y)&&target.x>=0&&target.x<=1000&&target.y>=0&&target.y<=600;}
function effects(model){
 if(!model.world.hasComponent(model.game,'TechnologyEffects'))model.world.set(model.game,'TechnologyEffects',{overclockMs:0,overloadMs:0});
 return model.world.get(model.game,'TechnologyEffects');
}
function active(model,type){const state=model.world.get(model.game,'TechnologyEffects');return Boolean(state && state[type+'Ms']>0);}
function speedMultiplier(model){return active(model,'overclock')?OVERCLOCK.speedMultiplier:1;}
function summon(model,target,unitConfig){
 if(!unitConfig||unitConfig.id!==REINFORCEMENTS.unitType||!['hp','speed','attack_damage','attack_range','attack_speed'].every(key=>Number.isFinite(unitConfig[key])&&unitConfig[key]>0)||!['melee','ranged'].includes(unitConfig.attack_type))return null;
 const world=model.world,id=world.create(model.game);
 world.set(id,'Position',{x:target.x,y:target.y});
 world.set(id,'Health',{hp:unitConfig.hp,maxHp:unitConfig.hp});
 world.set(id,'Faction',{side:'player'});
 world.set(id,'Movement',{speed:unitConfig.speed});
 world.set(id,'Combat',{damage:unitConfig.attack_damage,range:unitConfig.attack_range,attackType:unitConfig.attack_type,cooldownMs:unitConfig.attack_speed*1000,elapsedMs:0,detectionRadius:400,behavior:unitConfig.behavior||null});
 world.set(id,'PreviewUnit',{type:REINFORCEMENTS.unitType});
 world.set(id,'TemporaryAlly',{remainingMs:REINFORCEMENTS.durationMs});
 return id;
}
function cast(model,type,target,options={}) {
 if(!['healing_field','stasis_field','berserk','overclock','overload','emp_field','reinforcements'].includes(type)||!validTarget(target))return null;
 if(type==='reinforcements')return summon(model,target,options.unitConfig);
 if(type==='overclock'||type==='overload') {
  const state=effects(model);state[type+'Ms']=type==='overclock'?OVERCLOCK.durationMs:OVERLOAD.durationMs;
  return model.game;
 }
 if(type==='berserk') {
  const allies=model.world.query('Faction','Health','Combat').filter(id=>model.world.get(id,'Faction').side==='player'&&model.world.get(id,'Health').hp>0);
  const stock=model.world.get(model.game,'Technologies');
  let seed=(stock?.seed??137)>>>0;
  for(let i=allies.length-1;i>0;i--){seed=(Math.imul(seed,1664525)+1013904223)>>>0;const j=seed%(i+1);[allies[i],allies[j]]=[allies[j],allies[i]];}
  for(const id of allies.slice(0,BERSERK.targets))model.world.set(id,'TechnologyBuff',{type:'berserk',remainingMs:BERSERK.durationMs});
  return allies.length?allies[0]:null;
 }
 const id=model.world.create(model.game);
 model.world.set(id,'TechnologyZone',{type,x:target.x,y:target.y,radius:type==='stasis_field'?STASIS.radius:type==='emp_field'?EMP.radius:HEAL.radius,remainingMs:type==='stasis_field'?STASIS.durationMs:type==='emp_field'?EMP.durationMs:HEAL.durationMs,untilTickMs:HEAL.intervalMs});
 return id;
}
function step(model,delta) {
 if(!Number.isFinite(delta)||delta<0)throw Error('Invalid zone delta');
 const events=[];
 for(const id of model.world.query('TechnologyZone')) {
  const zone=model.world.get(id,'TechnologyZone');
  const effective=Math.min(delta,zone.remainingMs);
  zone.remainingMs-=effective;zone.untilTickMs-=effective;
  if(zone.type==='stasis_field'||zone.type==='emp_field'){if(zone.remainingMs<=0)model.world.destroy(id);continue;}
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
function stepBuffs(model,dt) {
 if(!Number.isFinite(dt)||dt<0)throw Error('Invalid buff delta');
 const state=model.world.get(model.game,'TechnologyEffects');
 if(state){for(const key of ['overclockMs','overloadMs'])state[key]=Math.max(0,(state[key]||0)-dt);}
 const expired=[];
 for(const id of model.world.query('TemporaryAlly')) {
  const life=model.world.get(id,'TemporaryAlly');life.remainingMs-=dt;
  if(life.remainingMs<=0){model.world.destroy(id);expired.push(id);}
 }
 for(const id of model.world.query('TechnologyBuff')) {
  const buff=model.world.get(id,'TechnologyBuff');buff.remainingMs-=dt;
  if(buff.remainingMs<=0)model.world.remove(id,'TechnologyBuff');
 }
 return expired;
}
const api={HEAL,BERSERK,STASIS,OVERCLOCK,OVERLOAD,EMP,REINFORCEMENTS,cast,step,stepBuffs,active,speedMultiplier};root.OverseerVNextZones=api;if(typeof module!=='undefined'&&module.exports)module.exports=api;
})(globalThis);

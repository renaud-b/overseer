(function(root) {
'use strict';
// Pure simulation rules. The inventory is in ArtifactCollection; timers/live effects
// live in a separate ECS component so a saved run cannot reset passive cooldowns.
const ECHO_MS=20000, GRACE_MS=3000, LASER_MS=15000, DUPLICATE_MS=30000;
const CORE={x:65,y:300}, LASER_RADIUS=350, LASER_DAMAGE=3;
const BURST_RADIUS=80, BURST_DAMAGE=2, SHIELD_HP=15, RECOVERY_HP=5;
function owns(model,id){return model.world.get(model.game,'ArtifactCollection')?.ids.includes(id)===true;}
function observed(model) {
 return model.world.query('Building','GridSlot').filter(id=>{
  const slot=model.world.get(id,'GridSlot').index;
  return model.world.get(model.tiles[slot],'Watched').active;
 });
}
function state(model) {
 const world=model.world;
 if(!world.hasComponent(model.game,'ArtifactEffects')) {
  world.set(model.game,'ArtifactEffects',{
   echoMs:0,echoIndex:0,laserMs:0,duplicateMs:0,
   observed:observed(model),grace:{},waveHp:{},
   waveNumber:0,shieldUsedWave:-1,shieldPoints:0
  });
 }
 return world.get(model.game,'ArtifactEffects');
}
function valid(s) {
 const num=(v,min,max)=>Number.isFinite(v)&&v>=min&&v<=max;
 const obj=(v)=>v&&typeof v==='object'&&!Array.isArray(v);
 return obj(s)&&num(s.echoMs,0,ECHO_MS)&&Number.isSafeInteger(s.echoIndex)&&s.echoIndex>=0&&
  num(s.laserMs,0,LASER_MS)&&num(s.duplicateMs,0,DUPLICATE_MS)&&
  Array.isArray(s.observed)&&new Set(s.observed).size===s.observed.length&&
  s.observed.every(id=>Number.isSafeInteger(id)&&id>0)&&obj(s.grace)&&
  Object.entries(s.grace).every(([id,ms])=>/^[1-9]\d*$/.test(id)&&num(ms,0,GRACE_MS))&&
  obj(s.waveHp)&&Object.entries(s.waveHp).every(([wave,hp])=>/^[1-9]\d*$/.test(wave)&&num(hp,0,100))&&
  Number.isSafeInteger(s.waveNumber)&&s.waveNumber>=0&&
  Number.isSafeInteger(s.shieldUsedWave)&&s.shieldUsedWave>=-1&&
  num(s.shieldPoints,0,SHIELD_HP);
}
function syncAttention(model) {
 const s=state(model), now=observed(model), current=new Set(now);
 if(owns(model,'lingering')) {
  for(const id of s.observed)if(!current.has(id)&&model.world.has(id))
   s.grace[id]=GRACE_MS;
 }
 for(const id of Object.keys(s.grace))
  if(current.has(Number(id))||!model.world.has(Number(id)))delete s.grace[id];
 s.observed=now;
}
function production(model,dt,economy) {
 if(!Number.isFinite(dt)||dt<0)throw new Error('Invalid artifact delta');
 const s=state(model);
 syncAttention(model);
 const extra={};
 for(const [id,remaining] of Object.entries(s.grace)){
  if(!owns(model,'lingering')){delete s.grace[id];continue;}
  extra[id]=Math.min(dt,remaining);
  s.grace[id]=Math.max(0,remaining-dt);
  if(s.grace[id]===0)delete s.grace[id];
 }
 const events=economy.step(model,dt,extra);
 if(owns(model,'echo')) {
  s.echoMs+=dt;
  const pulses=Math.floor(s.echoMs/ECHO_MS);
  s.echoMs%=ECHO_MS;
  for(let i=0;i<pulses;i++){
   const inactive=model.world.query('Building','GridSlot')
    .filter(id=>economy.PROTOTYPE_RECIPES[model.world.get(id,'Building').type]&&
      !model.world.get(model.tiles[model.world.get(id,'GridSlot').index],'Watched').active);
   if(!inactive.length)continue;
   const start=s.echoIndex%inactive.length;
   s.echoIndex++;
   for(let j=0;j<inactive.length;j++) {
    const event=economy.forceCycle(model,inactive[(start+j)%inactive.length],events);
    if(event){events.push({...event,artifact:'echo'});break;}
   }
  }
 }
 if(owns(model,'duplicate')) {
  s.duplicateMs=Math.min(DUPLICATE_MS,s.duplicateMs+dt);
  if(s.duplicateMs>=DUPLICATE_MS) {
   // Only a real industrial production (including an echo) can be duplicated.
   // Free outputs never cause another duplication or a unit spawn.
   const event=events.find(e=>e.type==='production');
   if(event){
    const recipe=economy.PROTOTYPE_RECIPES[event.buildingType];
    const resources=model.world.get(model.game,'Resources');
    for(const [key,amount] of Object.entries(recipe.produces))resources[key]+=amount;
    events.push({type:'production',building:event.building,
     buildingType:event.buildingType,artifact:'duplicate'});
    s.duplicateMs=0;
   }
  }
 }
 return events;
}
function hash(n,seed,salt){
 let x=(Math.imul(n,0x9e3779b1)^seed^salt)>>>0;
 x=Math.imul(x^(x>>>16),0x7feb352d);x=Math.imul(x^(x>>>15),0x846ca68b);
 return (x^(x>>>16))>>>0;
}
function startWave(model,number,seed,baseHp,economy) {
 const s=state(model);
 s.waveNumber=number;
 s.waveHp[number]=baseHp;
 s.shieldPoints=0;
 const events=[];
 if(!owns(model,'spontaneous')||hash(number,seed,0x915d24af)%10!==0)return events;
 const eligible=Object.entries(economy.MILITARY)
  .filter(([type])=>economy.aliveUnits(model,type)<economy.unitCapacity(model,type));
 if(!eligible.length)return events;
 const index=hash(number,seed,0xba129feb)%eligible.length;
 events.push({type:'unit-produced',unitType:eligible[index][1].unitType,artifact:'spontaneous'});
 return events;
}
function baseHit(model,baseHp,damage) {
 const s=state(model);
 let activated=false;
 if(owns(model,'shield')&&s.shieldUsedWave!==s.waveNumber&&
     baseHp>0&&baseHp-damage<=30) {
  s.shieldUsedWave=s.waveNumber;s.shieldPoints=SHIELD_HP;activated=true;
 }
 const absorbed=Math.min(s.shieldPoints,damage);
 s.shieldPoints-=absorbed;
 return {hp:Math.max(0,baseHp-(damage-absorbed)),absorbed,activated};
}
function clearWave(model,number,baseHp) {
 const s=state(model),startingHp=s.waveHp[number];
 delete s.waveHp[number];
 if(!owns(model,'recovery')||startingHp===undefined||baseHp>=startingHp||baseHp<=0)
  return {hp:baseHp,healed:0};
 const healed=Math.min(RECOVERY_HP,100-baseHp);
 return {hp:baseHp+healed,healed};
}
function laser(model,dt) {
 if(!owns(model,'core_laser'))return null;
 const s=state(model);
 s.laserMs=Math.min(LASER_MS,s.laserMs+dt);
 if(s.laserMs<LASER_MS)return null;
 const world=model.world;
 const target=world.query('Faction','Position','Health').filter(id=>{
  const h=world.get(id,'Health'),p=world.get(id,'Position');
  return world.get(id,'Faction').side==='enemy'&&h.hp>0&&
   Math.hypot(p.x-CORE.x,p.y-CORE.y)<=LASER_RADIUS;
 }).sort((a,b)=>{
  const pa=world.get(a,'Position'),pb=world.get(b,'Position');
  return Math.hypot(pa.x-CORE.x,pa.y-CORE.y)-Math.hypot(pb.x-CORE.x,pb.y-CORE.y)||a-b;
 })[0];
 if(target===undefined)return null; // Remains ready until an enemy enters range.
 const pos={...world.get(target,'Position')};
 world.get(target,'Health').hp-=LASER_DAMAGE;
 s.laserMs=0;
 return {type:'artifact-laser',target,from:CORE,to:pos,damage:LASER_DAMAGE};
}
function deaths(model,deadIds) {
 if(!owns(model,'death_burst'))return [];
 const world=model.world,events=[];
 for(const id of deadIds){
  if(!world.has(id)||world.get(id,'Faction')?.side!=='player')continue;
  const origin=world.get(id,'Position');
  if(!origin)continue;
  for(const enemy of world.query('Faction','Health','Position')){
   if(world.get(enemy,'Faction').side!=='enemy'||world.get(enemy,'Health').hp<=0)continue;
   const pos=world.get(enemy,'Position');
   if(Math.hypot(pos.x-origin.x,pos.y-origin.y)>BURST_RADIUS)continue;
   world.get(enemy,'Health').hp-=BURST_DAMAGE;
   events.push({type:'artifact-burst',target:enemy,from:{...origin},to:{...pos},damage:BURST_DAMAGE});
  }
 }
 return events;
}
const api={state,valid,syncAttention,production,startWave,baseHit,clearWave,laser,deaths,
 ECHO_MS,GRACE_MS,LASER_MS,DUPLICATE_MS,SHIELD_HP,LASER_RADIUS};
root.OverseerVNextArtifactEffects=api;
if(typeof module!=='undefined'&&module.exports)module.exports=api;
})(globalThis);

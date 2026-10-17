(function(root) {
'use strict';
// Pure simulation rules. The inventory is in ArtifactCollection; timers/live effects
// live in a separate ECS component so a saved run cannot reset passive cooldowns.
const ECHO_MS=20000, GRACE_MS=3000, LASER_MS=15000, DUPLICATE_MS=30000;
const CORE={x:65,y:300}, LASER_RADIUS=350, LASER_DAMAGE=3;
const BURST_RADIUS=80, BURST_DAMAGE=2, SHIELD_HP=15, RECOVERY_HP=5;
const FOCUS_BONUS=0.4, RECYCLE_RATE=0.25, MARK_MS=2000;
const TERMINAL_DAMAGE=2, TERMINAL_RADIUS=110, NETWORK_RATE=0.2, VITAL_RATE=0.3;
const DEFENSE_MS=3000, DEFENSE_RADIUS=250, CORROSION_MS=4000, CORROSION_TICK_MS=1000;
const RELAY_MS=20000, ANTICIPATION_MS=5000, EVOLUTION_CAP=5;
const CORROSION_RADIUS=65, CORROSION_DAMAGE=1, MAX_CORROSION_ZONES=12, CORROSION_CHANCE=0.30;
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
   waveNumber:0,shieldUsedWave:-1,shieldPoints:0,
   manufacturedCount:0,corrosionZones:[],corrosionSeed:137,
   relayTarget:null,relayRemainingMs:RELAY_MS,relaySeed:137,
   anticipationMs:0,waveDamaged:{}
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
  obj(s.waveHp)&&Object.entries(s.waveHp).every(([wave,hp])=>/^[1-9]\d*$/.test(wave)&&num(hp,0,120))&&
  Number.isSafeInteger(s.waveNumber)&&s.waveNumber>=0&&
  Number.isSafeInteger(s.shieldUsedWave)&&s.shieldUsedWave>=-1&&
  num(s.shieldPoints,0,SHIELD_HP)&&
  (s.manufacturedCount===undefined||Number.isSafeInteger(s.manufacturedCount)&&s.manufacturedCount>=0)&&
  (s.corrosionSeed===undefined||Number.isSafeInteger(s.corrosionSeed)&&s.corrosionSeed>=0&&s.corrosionSeed<=0xffffffff)&&
  (s.corrosionZones===undefined||Array.isArray(s.corrosionZones)&&
   s.corrosionZones.length<=MAX_CORROSION_ZONES&&s.corrosionZones.every(z=>
    obj(z)&&Number.isFinite(z.x)&&Number.isFinite(z.y)&&
    num(z.remainingMs,0,CORROSION_MS)&&num(z.elapsedMs,0,CORROSION_TICK_MS)))&&
  (s.relayTarget===undefined||s.relayTarget===null||Number.isSafeInteger(s.relayTarget)&&s.relayTarget>0)&&
  (s.relayRemainingMs===undefined||num(s.relayRemainingMs,0,RELAY_MS))&&
  (s.relaySeed===undefined||Number.isSafeInteger(s.relaySeed)&&s.relaySeed>=0&&s.relaySeed<=0xffffffff)&&
  (s.anticipationMs===undefined||num(s.anticipationMs,0,ANTICIPATION_MS))&&
  (s.waveDamaged===undefined||obj(s.waveDamaged)&&Object.entries(s.waveDamaged).every(([n,v])=>/^[1-9]\d*$/.test(n)&&typeof v==='boolean'));
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
// Only one productive node watched: empty observed tiles do not break focus.
function focusedBuilding(model,economy) {
 if(!owns(model,'hyperfocus'))return null;
 const watched=observed(model).filter(id=>{
  const type=model.world.get(id,'Building').type;
  return Boolean(economy.PROTOTYPE_RECIPES[type])||type==='laboratory';
 });
 return watched.length===1?watched[0]:null;
}
// A successful observed production can fill (but never complete) one neighbouring
// inactive cycle. No resource is spent, no free unit is spawned and no chain fires.
function network(model,events,economy) {
 if(!owns(model,'parasite_network'))return [];
 const world=model.world,activated=[];
 for(const event of events) {
  if((event.type!=='production'&&event.type!=='unit-produced')||
    event.artifact||!world.has(event.building))continue;
  const donor=world.get(event.building,'GridSlot');
  if(!donor||!world.get(model.tiles[donor.index],'Watched').active)continue;
  const neighbors=world.query('Building','GridSlot','Production').filter(id=>{
   if(id===event.building)return false;
   const slot=world.get(id,'GridSlot').index;
   if(Math.abs(slot%5-donor.index%5)+Math.abs(Math.floor(slot/5)-Math.floor(donor.index/5))!==1)
    return false;
   if(world.get(model.tiles[slot],'Watched').active)return false;
   const recipe=economy.PROTOTYPE_RECIPES[world.get(id,'Building').type];
   const progress=world.get(id,'Production');
   return recipe && progress.elapsedMs<recipe.cycleMs;
  }).sort((a,b)=>world.get(a,'GridSlot').index-world.get(b,'GridSlot').index);
  const target=neighbors[0];
  if(target===undefined)continue;
  const progress=world.get(target,'Production');
  const cycleMs=economy.PROTOTYPE_RECIPES[world.get(target,'Building').type].cycleMs;
  const gained=Math.min(cycleMs-progress.elapsedMs,cycleMs*NETWORK_RATE);
  progress.elapsedMs+=gained;
  activated.push({type:'artifact-network',from:event.building,building:target,gainedMs:gained});
 }
 return activated;
}

function relayCandidates(model,economy) {
 const world=model.world,watched=[];
 model.tiles.forEach((tile,i)=>{if(world.get(tile,'Watched').active)watched.push(i);});
 return world.query('Building','GridSlot').filter(id=>{
  const type=world.get(id,'Building').type,index=world.get(id,'GridSlot').index;
  if(world.get(model.tiles[index],'Watched').active)return false;
  if(!economy.PROTOTYPE_RECIPES[type]&&
     !['laboratory','cryopump','perception_amplifier','maintenance'].includes(type))return false;
  return watched.some(other=>Math.abs(index%5-other%5)+
   Math.abs(Math.floor(index/5)-Math.floor(other/5))===1);
 }).sort((a,b)=>world.get(a,'GridSlot').index-world.get(b,'GridSlot').index);
}
function relayActive(model,id) {
 if(!owns(model,'distributed'))return false;
 const selected=state(model).relayTarget;
 if(selected!==id||!model.world.has(id))return false;
 const index=model.world.get(id,'GridSlot')?.index;
 if(!Number.isInteger(index)||model.world.get(model.tiles[index],'Watched').active)return false;
 return model.tiles.some((tile,other)=>model.world.get(tile,'Watched').active&&
  Math.abs(index%5-other%5)+Math.abs(Math.floor(index/5)-Math.floor(other/5))===1);
}
function relay(model,dt,economy) {
 if(!owns(model,'distributed'))return {};
 if(!Number.isFinite(dt)||dt<0)throw Error('Invalid relay delta');
 const s=state(model),active={};
 if(s.relayRemainingMs===undefined)s.relayRemainingMs=RELAY_MS;
 if(s.relaySeed===undefined)s.relaySeed=137;
 if(s.relayTarget===undefined)s.relayTarget=null;
 function choose(previous) {
  const candidates=relayCandidates(model,economy);
  if(!candidates.length)return null;
  const options=candidates.length>1?candidates.filter(id=>id!==previous):candidates;
  s.relaySeed=(Math.imul(s.relaySeed,1664525)+1013904223)>>>0;
  return options[s.relaySeed%options.length];
 }
 if(!relayCandidates(model,economy).includes(s.relayTarget))
  s.relayTarget=choose(s.relayTarget);
 let remaining=dt;
 while(remaining>0) {
  const chunk=Math.min(remaining,s.relayRemainingMs);
  if(s.relayTarget!==null)active[s.relayTarget]=(active[s.relayTarget]||0)+chunk;
  s.relayRemainingMs-=chunk;
  remaining-=chunk;
  if(s.relayRemainingMs===0){
   const previous=s.relayTarget;
   s.relayTarget=choose(previous);
   s.relayRemainingMs=RELAY_MS;
  }
 }
 return active;
}
function production(model,dt,economy,coolingBonuses={},relayMs={}) {
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
 for(const [id,ms] of Object.entries(relayMs))
  extra[id]=Math.max(extra[id]||0,ms); // Relay and residual memory do not double-count.
 const boosted=owns(model,'anticipation')?Math.min(dt,s.anticipationMs||0):0;
 const events=economy.step(model,dt,extra,focusedBuilding(model,economy),coolingBonuses,boosted);
 s.anticipationMs=Math.max(0,(s.anticipationMs||0)-dt);
 // Only genuine observed completions propagate, never echoes or duplicate outputs.
 const pulses=network(model,events,economy);
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
 return [...events,...pulses];
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
 if(!s.waveDamaged)s.waveDamaged={};
 s.waveDamaged[number]=false;
 if(owns(model,'anticipation'))s.anticipationMs=ANTICIPATION_MS;
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
 const hp=Math.max(0,baseHp-(damage-absorbed));
 if(hp<baseHp){
  if(!s.waveDamaged)s.waveDamaged={};
  for(const number of Object.keys(s.waveHp))s.waveDamaged[number]=true;
 }
 return {hp,absorbed,activated};
}
function clearWave(model,number,baseHp) {
 const s=state(model),startingHp=s.waveHp[number];
 const pristine=startingHp!==undefined&&!s.waveDamaged?.[number];
 delete s.waveHp[number];
 if(s.waveDamaged)delete s.waveDamaged[number];
 let evolved=null;
 if(owns(model,'evolution')&&pristine&&baseHp>0){
  const world=model.world,eligible=world.query('Faction','Health').filter(id=>
   world.get(id,'Faction').side==='player'&&world.get(id,'Health').hp>0&&
   (world.get(id,'Evolved')?.stacks||0)<EVOLUTION_CAP);
  if(eligible.length){
   evolved=eligible[(number-1)%eligible.length];
   const health=world.get(evolved,'Health');
   health.maxHp+=1;health.hp+=1;
   const stacks=(world.get(evolved,'Evolved')?.stacks||0)+1;
   world.set(evolved,'Evolved',{stacks});
  }
 }
 // The old recovery refunds a damaged wave; pristine repair rewards the
 // opposite outcome. A restored HP total never erases the waveDamaged flag.
 const recovery=owns(model,'recovery')&&startingHp!==undefined&&baseHp<startingHp&&baseHp>0?
  Math.min(RECOVERY_HP,(model.world.get(model.game,'DefenseTalents')?.reinforced?120:100)-baseHp):0;
 const pristineRepair=owns(model,'pristine_repair')&&pristine&&baseHp>0?
  Math.min(RECOVERY_HP,100-baseHp-recovery):0;
 const healed=recovery+pristineRepair;
 return evolved===null ? {hp:baseHp+healed,healed} : {hp:baseHp+healed,healed,evolved};
}
function laser(model,dt,perceptionRadius=LASER_RADIUS) {
 if(!owns(model,'core_laser'))return null;
 const s=state(model);
 s.laserMs=Math.min(LASER_MS,s.laserMs+dt);
 if(s.laserMs<LASER_MS)return null;
 const world=model.world;
 const target=world.query('Faction','Position','Health').filter(id=>{
  const h=world.get(id,'Health'),p=world.get(id,'Position');
  return world.get(id,'Faction').side==='enemy'&&h.hp>0&&
   Math.hypot(p.x-CORE.x,p.y-CORE.y)<=perceptionRadius;
 }).sort((a,b)=>{
  const pa=world.get(a,'Position'),pb=world.get(b,'Position');
  return Math.hypot(pa.x-CORE.x,pa.y-CORE.y)-Math.hypot(pb.x-CORE.x,pb.y-CORE.y)||a-b;
 })[0];
 if(target===undefined)return null; // Remains ready until an enemy enters range.
 const pos={...world.get(target,'Position')};
 world.get(target,'Health').hp-=LASER_DAMAGE;
 s.laserMs=0;
 const chains=[];
 if(owns(model,'terminal_overload')&&world.get(target,'Health').hp<=0) {
  const next=world.query('Faction','Position','Health').filter(id=>{
   if(id===target||world.get(id,'Faction').side!=='enemy'||world.get(id,'Health').hp<=0)return false;
   const p=world.get(id,'Position');
   return Math.hypot(p.x-pos.x,p.y-pos.y)<=TERMINAL_RADIUS;
  }).sort((a,b)=>{
   const p=world.get(a,'Position'),q=world.get(b,'Position');
   return Math.hypot(p.x-pos.x,p.y-pos.y)-Math.hypot(q.x-pos.x,q.y-pos.y)||a-b;
  }).slice(0,2);
  for(const id of next) {
   const to={...world.get(id,'Position')};
   world.get(id,'Health').hp-=TERMINAL_DAMAGE;
   chains.push({type:'artifact-terminal-chain',target:id,from:pos,to,damage:TERMINAL_DAMAGE});
  }
 }
 return {type:'artifact-laser',target,from:CORE,to:pos,damage:LASER_DAMAGE,chains};
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
// Transfer health only to living injured allies. A corpse is consumed exactly once.
function vital(model,deadIds) {
 if(!owns(model,'vital_transfer'))return [];
 const world=model.world,events=[];
 for(const id of deadIds) {
  if(!world.has(id)||world.get(id,'Faction')?.side!=='player'||
   world.get(id,'Health')?.hp>0||world.hasComponent(id,'VitalTransferred'))continue;
  world.set(id,'VitalTransferred',{done:true});
  const at=world.get(id,'Position');
  if(!at)continue;
  const closest=world.query('Faction','Position','Health').filter(other=>{
   if(other===id||world.get(other,'Faction').side!=='player')return false;
   const hp=world.get(other,'Health');
   return hp.hp>0&&hp.hp<hp.maxHp;
  }).sort((a,b)=>{
   const p=world.get(a,'Position'),q=world.get(b,'Position');
   return Math.hypot(p.x-at.x,p.y-at.y)-Math.hypot(q.x-at.x,q.y-at.y)||a-b;
  })[0];
  if(closest===undefined)continue;
  const hp=world.get(closest,'Health');
  const amount=Math.min(hp.maxHp-hp.hp,hp.maxHp*VITAL_RATE);
  hp.hp+=amount;
  events.push({type:'artifact-vital',from:{...at},to:{...world.get(closest,'Position')},
   unit:id,target:closest,amount});
 }
 return events;
}
// Only units that actually consumed resources carry ManufacturedCost. Starter,
 // summoned and spontaneously generated units never refund anything.
function recycle(model,deadIds) {
 if(!owns(model,'recycle'))return [];
 const world=model.world,resources=world.get(model.game,'Resources'),events=[];
 for(const id of deadIds){
  if(!world.has(id)||world.get(id,'Faction')?.side!=='player'||
    world.get(id,'Health')?.hp>0)continue;
  const provenance=world.get(id,'ManufacturedCost');
  if(!provenance)continue;
  const refunded={};
  for(const [resource,quantity] of Object.entries(provenance.resources)){
   if(!Object.hasOwn(resources,resource)||!Number.isFinite(quantity)||quantity<0)continue;
   // Refund full units so resource balances remain discrete.
   const amount=Math.round(quantity*RECYCLE_RATE);
   resources[resource]+=amount;
   refunded[resource]=amount;
  }
  world.remove(id,'ManufacturedCost'); // Idempotent even before entity cleanup.
  events.push({type:'artifact-recycle',unit:id,refunded});
 }
 return events;
}
// A marked victim passes its target designation to the closest living enemy.
 // Use the existing ThreatMark component: CombatSystem already understands it.
function propagate(model,deadIds) {
 if(!owns(model,'mark_chain'))return [];
 const world=model.world,events=[];
 for(const id of deadIds) {
  if(!world.has(id)||world.get(id,'Faction')?.side!=='enemy'||
   world.get(id,'Health')?.hp>0||!world.get(id,'ThreatMark'))continue;
  const at=world.get(id,'Position');
  if(!at)continue;
  const target=world.query('Faction','Health','Position').filter(other=>
   other!==id&&world.get(other,'Faction').side==='enemy'&&
   world.get(other,'Health').hp>0).sort((a,b)=>{
    const p=world.get(a,'Position'),q=world.get(b,'Position');
    return Math.hypot(p.x-at.x,p.y-at.y)-Math.hypot(q.x-at.x,q.y-at.y)||a-b;
   })[0];
  if(target===undefined)continue;
  const existing=world.get(target,'ThreatMark');
  world.set(target,'ThreatMark',{remainingMs:Math.max(existing?.remainingMs||0,MARK_MS)});
  world.remove(id,'ThreatMark'); // Exactly one transfer per corpse.
  events.push({type:'artifact-mark-transfer',from:id,target});
 }
 return events;
}

function manufactured(model,id,event) {
 if(!owns(model,'defective')||!event?.spent||!model.world.has(id))return false;
 const s=state(model);
 s.manufacturedCount=(s.manufacturedCount||0)+1;
 if(s.manufacturedCount%5!==0)return false;
 const world=model.world,h=world.get(id,'Health'),combat=world.get(id,'Combat');
 if(!h||!combat)return false;
 h.maxHp=Math.max(1,Math.round(h.maxHp*0.75));
 h.hp=Math.min(h.hp,h.maxHp);
 combat.damage=Math.max(1,Math.round(combat.damage*1.5));
 world.set(id,'DefectiveUnit',{unstable:true});
 return true;
}
function defense(model,attacker) {
 if(!owns(model,'defense_directive'))return false;
 const world=model.world;
 if(!world.has(attacker)||world.get(attacker,'Faction')?.side!=='enemy'||world.get(attacker,'Health')?.hp<=0)
  return false;
 world.set(attacker,'GuardPriority',{remainingMs:DEFENSE_MS});
 return true;
}
function combatTimers(model,dt) {
 if(!Number.isFinite(dt)||dt<0)throw Error('Invalid artifact combat delta');
 for(const id of model.world.query('GuardPriority')){
  const mark=model.world.get(id,'GuardPriority');
  mark.remainingMs=Math.max(0,mark.remainingMs-dt);
  if(mark.remainingMs===0)model.world.remove(id,'GuardPriority');
 }
}
function contamination(model,deadIds) {
 if(!owns(model,'corrosion'))return [];
 const world=model.world,s=state(model);
 if(!s.corrosionZones)s.corrosionZones=[];
 const events=[];
 for(const id of deadIds) {
  if(s.corrosionZones.length>=MAX_CORROSION_ZONES)break;
  if(!world.has(id)||world.get(id,'Faction')?.side!=='enemy'||world.get(id,'Health')?.hp>0)continue;
  const p=world.get(id,'Position');
  if(!p)continue;
  s.corrosionZones.push({x:p.x,y:p.y,remainingMs:CORROSION_MS,elapsedMs:0});
  events.push({type:'artifact-corrosion-zone',from:{x:p.x,y:p.y}});
 }
 return events;
}
function corrosionStep(model,dt) {
 if(!Number.isFinite(dt)||dt<0)throw Error('Invalid corrosion delta');
 const s=state(model),zones=s.corrosionZones||[];
 if(!zones.length||!dt)return [];
 const events=[],world=model.world;
 for(const z of zones) {
  const activeMs=Math.min(dt,z.remainingMs);
  z.elapsedMs+=activeMs;
  z.remainingMs=Math.max(0,z.remainingMs-dt);
  while(z.elapsedMs>=CORROSION_TICK_MS) {
   z.elapsedMs-=CORROSION_TICK_MS;
   for(const id of world.query('Faction','Position','Health')){
    if(world.get(id,'Faction').side!=='enemy')continue;
    const hp=world.get(id,'Health');
    if(hp.hp<=0)continue;
    const p=world.get(id,'Position');
    if(Math.hypot(p.x-z.x,p.y-z.y)>CORROSION_RADIUS)continue;
    hp.hp-=CORROSION_DAMAGE;
    events.push({type:'artifact-corrosion-hit',target:id,damage:CORROSION_DAMAGE,
     from:{x:z.x,y:z.y},to:{x:p.x,y:p.y}});
   }
  }
 }
 s.corrosionZones=zones.filter(z=>z.remainingMs>0);
 return events;
}
const api={state,valid,syncAttention,focusedBuilding,network,relayCandidates,relayActive,relay,production,startWave,baseHit,clearWave,laser,deaths,
 RELAY_MS,ANTICIPATION_MS,EVOLUTION_CAP,
 manufactured,defense,combatTimers,contamination,corrosionStep,DEFENSE_MS,DEFENSE_RADIUS,CORROSION_MS,CORROSION_RADIUS,CORROSION_CHANCE,
 recycle,propagate,vital,FOCUS_BONUS,RECYCLE_RATE,MARK_MS,TERMINAL_DAMAGE,TERMINAL_RADIUS,NETWORK_RATE,VITAL_RATE,
 ECHO_MS,GRACE_MS,LASER_MS,DUPLICATE_MS,SHIELD_HP,LASER_RADIUS};
root.OverseerVNextArtifactEffects=api;
if(typeof module!=='undefined'&&module.exports)module.exports=api;
})(globalThis);

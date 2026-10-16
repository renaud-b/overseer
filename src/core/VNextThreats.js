(function(root) {
'use strict';
// All detection and marking happen in simulation coordinates, never in Phaser.
const BASE=Object.freeze({x:65,y:300});
const RADIUS=350, MEMORY_MS=2000;
// A complete radar sweep travels beyond the furthest logical battlefield corner.
// Five-second cadence preserves the original amplifier's provisional pulse frequency.
const PULSE=Object.freeze({
 durationMs:5000, maxRadius:1020
});
function amplifiers(model) {
 return model.world.query('Building','GridSlot').filter(id=>
  model.world.get(id,'Building').type==='perception_amplifier' &&
  (model.world.get(model.tiles[model.world.get(id,'GridSlot').index],'Watched').active ||
   root.OverseerVNextArtifactEffects?.relayActive(model,id)===true));
}
function state(model) {
 if(!model.world.hasComponent(model.game,'PerceptionPulse'))
  model.world.set(model.game,'PerceptionPulse',{phaseMs:0});
 return model.world.get(model.game,'PerceptionPulse');
}
function active(model){return amplifiers(model).length>0;}
// The permanent core detection stays unchanged. The amplifier sends a separate wave.
function radius(){return RADIUS;}
function sweepRadius(model) {
 if(!active(model))return 0;
 return (model.world.get(model.game,'PerceptionPulse')?.phaseMs||0)/
  PULSE.durationMs*PULSE.maxRadius;
}
function markCrossed(world,enemies,fromPhase,toPhase) {
 if(toPhase<=fromPhase)return 0;
 const low=PULSE.maxRadius*fromPhase/PULSE.durationMs;
 const high=PULSE.maxRadius*toPhase/PULSE.durationMs;
 let marked=0;
 for(const id of enemies){
  if(!world.has(id)||world.get(id,'Faction')?.side!=='enemy'||
    world.get(id,'Health')?.hp<=0)continue;
  const p=world.get(id,'Position');
  if(!p)continue;
  const d=Math.hypot(p.x-BASE.x,p.y-BASE.y);
  if(d<=low||d>high)continue;
  const current=world.get(id,'ThreatMark');
  world.set(id,'ThreatMark',{remainingMs:Math.max(current?.remainingMs||0,MEMORY_MS)});
  marked++;
 }
 return marked;
}
// Simulation time only. Mark each enemy as the outward moving front crosses it.
// The caller decays existing marks before advancing the sweep to preserve full memory.
function step(model,dt,multiplier=1,enemies=[]) {
 if(!Number.isFinite(dt)||dt<0||!Number.isFinite(multiplier)||multiplier<1)
  throw Error('Invalid perception delta');
 if(!active(model)||dt===0)return radius();
 const pulse=state(model),elapsed=dt*multiplier;
 if(!Number.isFinite(elapsed))throw Error('Invalid perception delta');
 const duration=PULSE.durationMs;
 if(elapsed>=duration){
  // A full revolution necessarily passed every valid enemy; avoid unbounded loops.
  markCrossed(model.world,enemies,0,duration);
 }
 const remaining=elapsed%duration,finish=pulse.phaseMs+remaining;
 if(elapsed>=duration||finish>=duration){
  if(elapsed<duration)markCrossed(model.world,enemies,pulse.phaseMs,duration);
  markCrossed(model.world,enemies,0,finish%duration);
 } else {
  markCrossed(model.world,enemies,pulse.phaseMs,finish);
 }
 pulse.phaseMs=(pulse.phaseMs+elapsed)%duration;
 return radius();
}
// Permanent 350-unit sensor; the traveling radar grants temporary distant marks.
function update(world,enemies,dt,detectionRadius=RADIUS){
 for(const id of enemies){
  if(!world.has(id)||world.get(id,'Health')?.hp<=0)continue;
  const p=world.get(id,'Position');
  if(!p)continue;
  const inside=Math.hypot(p.x-BASE.x,p.y-BASE.y)<=detectionRadius;
  const marked=world.get(id,'ThreatMark');
  if(inside)world.set(id,'ThreatMark',{remainingMs:MEMORY_MS});
  else if(marked){
   marked.remainingMs-=dt;
   if(marked.remainingMs<=0)world.remove(id,'ThreatMark');
  }
 }
}
const api={BASE,RADIUS,MEMORY_MS,PULSE,amplifiers,state,active,radius,sweepRadius,step,update};
root.OverseerVNextThreats=api;
if(typeof module!=='undefined'&&module.exports)module.exports=api;
})(globalThis);

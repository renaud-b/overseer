(function(root){
'use strict';
function distance(a,b){return Math.hypot(a.x-b.x,a.y-b.y);}
function moveTowards(p,target,speed,dt,stop=0){const d=distance(p,target);if(d<=stop||d===0)return;const advance=Math.min(d-stop,speed*dt/1000);p.x+=(target.x-p.x)*advance/d;p.y+=(target.y-p.y)*advance/d;}
function stepUnit(world,id,delta,options={}){
 const position=world.get(id,'Position'),health=world.get(id,'Health'),combat=world.get(id,'Combat'),movement=world.get(id,'Movement'),faction=world.get(id,'Faction');
 if(!position||!health||!combat||!movement||!faction||health.hp<=0)return [];
 const berserk=world.get(id,'TechnologyBuff')?.type==='berserk';
 combat.elapsedMs+=delta*(berserk?1.5:1);
 const opponents=(options.opponents||[]).filter(other=>world.has(other)&&world.get(other,'Health')?.hp>0).map(other=>({id:other,position:world.get(other,'Position')})).filter(o=>o.position);
 let speed=movement.speed*(faction.side==='player'?(options.allySpeedMultiplier||1):1);
 if(faction.side==='enemy')for(const zoneId of world.query('TechnologyZone')) {
  const zone=world.get(zoneId,'TechnologyZone');
  if(zone.type==='stasis_field'&&distance(position,zone)<=zone.radius){speed*=0.5;break;}
 }
 const detection=combat.detectionRadius;
 const central=options.centralDetection && faction.side==='player';
 const eligible=opponents.filter(o=>central
   ? Boolean(world.get(o.id,'ThreatMark')) || distance(position,o.position)<=55
   : distance(position,o.position)<detection);
 // Retain the previous marked target until it disappears, not merely until a closer enemy arrives.
 const locked=central && eligible.find(o=>o.id===combat.targetId);
 const candidate=locked || eligible.sort((a,b)=>distance(position,a.position)-distance(position,b.position))[0];
 if (central) combat.targetId=candidate?.id ?? null;
 const target=combat.behavior==='base_rusher'?null:candidate;
 const events=[];
 if(combat.behavior==='healer' && faction.side==='player') {
   const allies=(options.allies||[]).filter(other=>world.has(other) && other!==id && world.get(other,'Health')?.hp>0 && world.get(other,'Health').hp<world.get(other,'Health').maxHp && world.get(other,'Position'));
   allies.sort((a,b)=>distance(position,world.get(a,'Position'))-distance(position,world.get(b,'Position')));
   const ally=allies[0];
   if(ally){const pos=world.get(ally,'Position');moveTowards(position,pos,speed,delta,combat.range);if(distance(position,pos)<=combat.range && combat.elapsedMs>=combat.cooldownMs){const h=world.get(ally,'Health');const amount=Math.min(combat.damage,h.maxHp-h.hp);h.hp+=amount;combat.elapsedMs=0;events.push({type:'heal',healer:id,target:ally,amount});}}
   else if(options.patrol)moveTowards(position,options.patrol,speed,delta,5);
   return events;
 }
 if(target){
   const stop=combat.attackType==='ranged'?combat.range:10;
   moveTowards(position,target.position,speed,delta,stop);
   if(distance(position,target.position)< (combat.attackType==='ranged'?combat.range:20) && combat.elapsedMs>=combat.cooldownMs){
     world.get(target.id,'Health').hp-=combat.damage;
     combat.elapsedMs=0;
     events.push({type:'attack',attacker:id,target:target.id,damage:combat.damage,ranged:combat.attackType==='ranged'});
   }
 }else if(faction.side==='enemy'&&options.base){
   const base=options.base;
   const d=distance(position,base);
   moveTowards(position,base,speed,delta,combat.range);
   if(d<=combat.range&&combat.elapsedMs>=combat.cooldownMs){combat.elapsedMs=0;events.push({type:'base-attack',attacker:id,damage:combat.damage});}
 }else if(faction.side==='player'&&options.patrol){
   moveTowards(position,options.patrol,speed,delta,5);
 }
 return events;
}
// Stable, bounded guard posts on the battlefield-facing (right) side of the AI.
function formationPosition(index, total, core = {x:65,y:300}) {
 if (!Number.isInteger(index) || !Number.isInteger(total) || total<=0 || index<0 || index>=total)
   throw new RangeError('Invalid formation slot');
 const perRing=7;
 const ring=Math.floor(index/perRing), slot=index%perRing;
 const count=Math.min(perRing,total-ring*perRing);
 const angle=count===1?0:-Math.PI/2+Math.PI*slot/(count-1);
 const radius=85+ring*28;
 return {x:core.x+Math.cos(angle)*radius+16,y:core.y+Math.sin(angle)*radius};
}
// Keep friendly units readable without changing attack decisions or combat stats.
// A single pairwise pass is enough for the small VNext battle; positions live in ECS.
function separateUnits(world, ids, minimumDistance = 22) {
 if (!Number.isFinite(minimumDistance) || minimumDistance <= 0) return;
 const units = ids.filter(id => world.has(id) && world.get(id,'Position') &&
   world.get(id,'Faction') && world.get(id,'Health')?.hp > 0);
 for (let i = 0; i < units.length; i++) {
  const a = units[i], pa = world.get(a,'Position'), fa = world.get(a,'Faction').side;
  for (let j = i + 1; j < units.length; j++) {
   const b = units[j], pb = world.get(b,'Position');
   if (fa !== world.get(b,'Faction').side) continue;
   let dx = pb.x - pa.x, dy = pb.y - pa.y;
   let d = Math.hypot(dx,dy);
   if (d >= minimumDistance) continue;
   // Stable fallback prevents NaN and resolves units spawning at identical coordinates.
   if (d < 0.00001) { dx = (a < b ? 1 : -1); dy = 0; d = 0; }
   const nx = d === 0 ? dx : dx / d, ny = d === 0 ? dy : dy / d;
   const shift = (minimumDistance - d) / 2;
   pa.x -= nx * shift; pa.y -= ny * shift;
   pb.x += nx * shift; pb.y += ny * shift;
  }
 }
}
const api={stepUnit,separateUnits,formationPosition};root.OverseerCombat=api;if(typeof module!=='undefined'&&module.exports)module.exports=api;
})(globalThis);

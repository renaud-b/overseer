(function(root){
'use strict';
function distance(a,b){return Math.hypot(a.x-b.x,a.y-b.y);}
function moveTowards(p,target,speed,dt,stop=0){const d=distance(p,target);if(d<=stop||d===0)return;const advance=Math.min(d-stop,speed*dt/1000);p.x+=(target.x-p.x)*advance/d;p.y+=(target.y-p.y)*advance/d;}
function stepUnit(world,id,delta,options={}){
 const position=world.get(id,'Position'),health=world.get(id,'Health'),combat=world.get(id,'Combat'),movement=world.get(id,'Movement'),faction=world.get(id,'Faction');
 if(!position||!health||!combat||!movement||!faction||health.hp<=0)return [];
 combat.elapsedMs+=delta;
 const opponents=(options.opponents||[]).filter(other=>world.has(other)&&world.get(other,'Health')?.hp>0).map(other=>({id:other,position:world.get(other,'Position')})).filter(o=>o.position);
 const detection=combat.detectionRadius;
 const candidate=opponents.filter(o=>distance(position,o.position)<detection).sort((a,b)=>distance(position,a.position)-distance(position,b.position))[0];
 const target=combat.behavior==='base_rusher'?null:candidate;
 const events=[];
 if(target){
   const stop=combat.attackType==='ranged'?combat.range:10;
   moveTowards(position,target.position,movement.speed,delta,stop);
   if(distance(position,target.position)< (combat.attackType==='ranged'?combat.range:20) && combat.elapsedMs>=combat.cooldownMs){
     world.get(target.id,'Health').hp-=combat.damage;
     combat.elapsedMs=0;
     events.push({type:'attack',attacker:id,target:target.id,damage:combat.damage,ranged:combat.attackType==='ranged'});
   }
 }else if(faction.side==='enemy'&&options.base){
   const base=options.base;
   const d=distance(position,base);
   moveTowards(position,base,movement.speed,delta,combat.range);
   if(d<=combat.range&&combat.elapsedMs>=combat.cooldownMs){combat.elapsedMs=0;events.push({type:'base-attack',attacker:id,damage:combat.damage});}
 }else if(faction.side==='player'&&options.patrol){
   moveTowards(position,options.patrol,movement.speed,delta,5);
 }
 return events;
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
   if (d < 0.00001) { dx = (a < b ? 1 : -1); dy = 0; d = 1; }
   const shift = (minimumDistance - d) / 2;
   const nx = dx / d, ny = dy / d;
   pa.x -= nx * shift; pa.y -= ny * shift;
   pb.x += nx * shift; pb.y += ny * shift;
  }
 }
}
const api={stepUnit,separateUnits};root.OverseerCombat=api;if(typeof module!=='undefined'&&module.exports)module.exports=api;
})(globalThis);

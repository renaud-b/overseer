(function(root) {
'use strict';
// VNext earns the same persistent Memory Shards the talent tree already spends.
const KEY='memoryShards', PER_WAVE=1;
function balance(storage) {
 try {
  const raw=storage?.getItem(KEY);
  if(raw===null||raw===undefined)return 0;
  const value=Number(raw);
  return Number.isSafeInteger(value)&&value>=0?value:0;
 } catch (_) {return 0;}
}
// Claimed-wave IDs live in the saved ECS run, not the persistent balance.
function state(model) {
 const world=model.world;
 if(!world.hasComponent(model.game,'WaveShardRewards'))
  world.set(model.game,'WaveShardRewards',{claimed:[]});
 return world.get(model.game,'WaveShardRewards');
}
function awarded(model,wave) {
 return model.world.get(model.game,'WaveShardRewards')?.claimed.includes(wave)||false;
}
function grant(model,wave,storage) {
 if(!Number.isSafeInteger(wave)||wave<=0)throw Error('Invalid wave payout');
 if(awarded(model,wave))return null;
 if(!storage)return null;
 try {
  const before=balance(storage);
  if(before>Number.MAX_SAFE_INTEGER-PER_WAVE)return null;
  const after=before+PER_WAVE;
  storage.setItem(KEY,String(after));
  state(model).claimed.push(wave);
  return {type:'memory-shards',wave,amount:PER_WAVE,balance:after};
 } catch (_) {return null;} // Cannot claim a payout that was not persisted.
}
const api={KEY,PER_WAVE,balance,state,awarded,grant};
root.OverseerVNextMemoryShards=api;
if(typeof module!=='undefined'&&module.exports)module.exports=api;
})(globalThis);

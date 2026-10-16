'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const {World}=require('../src/core/World.js');
const preview=require('../src/core/VNextPreview.js');
const shards=require('../src/core/VNextMemoryShards.js');
const save=require('../src/core/VNextSave.js');
function storage(){
 const data=new Map();
 return {data,getItem:key=>data.get(key)??null,setItem:(key,v)=>data.set(key,String(v)),removeItem:key=>data.delete(key)};
}
test('VNext uses existing talent shards, awarding one integer per cleared wave',()=>{
 const wallet=storage(),model=preview.createModel(World);
 wallet.setItem('memoryShards','8');
 assert.equal(shards.balance(wallet),8);
 const first=shards.grant(model,1,wallet);
 assert.equal(first.amount,1);
 assert.equal(first.balance,9);
 assert.equal(wallet.getItem('memoryShards'),'9');
 assert.equal(shards.awarded(model,1),true);
 assert.equal(shards.grant(model,1,wallet),null);
 assert.equal(shards.balance(wallet),9);
 assert.equal(shards.grant(model,2,wallet).balance,10);
 const resumed={...model,world:World.restore(model.world.serialize())};
 assert.equal(shards.awarded(resumed,1),true);
 assert.equal(shards.grant(resumed,2,wallet),null);
 assert.equal(shards.grant(resumed,3,wallet).balance,11);
 assert.equal(shards.balance(wallet),11);
});
test('No payout for unavailable storage, invalid wave or unsafe balance',()=>{
 const model=preview.createModel(World),wallet=storage();
 assert.equal(shards.grant(model,1,null),null);
 assert.equal(shards.awarded(model,1),false);
 const failing={getItem:()=> '7',setItem(){throw Error('blocked')}};
 assert.equal(shards.grant(model,1,failing),null);
 assert.equal(shards.awarded(model,1),false);
 assert.throws(()=>shards.grant(model,0,wallet),/Invalid wave payout/);
 wallet.setItem('memoryShards',String(Number.MAX_SAFE_INTEGER));
 assert.equal(shards.grant(model,1,wallet),null);
 assert.equal(shards.awarded(model,1),false);
 assert.equal(shards.balance(wallet),Number.MAX_SAFE_INTEGER);
 wallet.setItem('memoryShards','not a number');
 assert.equal(shards.balance(wallet),0);
 wallet.setItem('memoryShards','14');
 assert.equal(shards.grant(model,1,wallet).balance,15);
});
test('Persistent shards survive removing a VNext save, just like legacy talent unlocks',()=>{
 const wallet=storage();
 wallet.setItem(shards.KEY,'9');
 wallet.setItem('unlockedTalents','["root","vision_boost"]');
 wallet.setItem(save.KEY,'an old run');
 assert.equal(save.clear(wallet),true);
 assert.equal(wallet.getItem(shards.KEY),'9');
 assert.equal(wallet.getItem('unlockedTalents'),'["root","vision_boost"]');
});
test('Old run worlds without payout state remain playable',()=>{
 const model=preview.createModel(World),wallet=storage();
 assert.equal(model.world.get(model.game,'WaveShardRewards'),undefined);
 assert.equal(shards.grant(model,1,wallet).balance,1);
 assert.deepEqual(shards.state(model).claimed,[1]);
});

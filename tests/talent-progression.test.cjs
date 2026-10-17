const test=require('node:test');const assert=require('node:assert/strict');const p=require('../src/core/TalentProgression.js');const catalog=require('../src/core/TalentCatalog.js');function store(){const m=new Map();return {getItem:k=>m.has(k)?m.get(k):null,setItem:(k,v)=>m.set(k,v),removeItem:k=>m.delete(k)};}
test('purchases preserve historical keys and prerequisites',()=>{const s=store();s.setItem('memoryShards','30');assert.equal(p.purchase(s,catalog.get('starter_drone')).ok,false);assert.equal(p.purchase(s,catalog.get('starter_base_hp')).ok,true);assert.equal(p.read(s).shards,25);assert.equal(p.purchase(s,catalog.get('starter_drone')).ok,false);assert.equal(p.purchase(s,catalog.get('starter_reinforcement')).ok,true);assert.equal(p.read(s).shards,17);});
test('reset refunds historical purchases',()=>{const s=store();s.setItem('memoryShards','30');p.purchase(s,catalog.get('starter_base_hp'));p.purchase(s,catalog.get('starter_reinforcement'));assert.equal(p.reset(s,catalog).ok,true);assert.deepEqual(p.read(s),{unlocked:['root'],shards:30});});


test('production branch purchases are persistent and competing specializations cannot coexist',()=>{
 const s=store();s.setItem('memoryShards','100');
 assert.equal(p.purchase(s,catalog.get('production_components')).ok,false);
 assert.equal(p.purchase(s,catalog.get('production_extraction')).ok,true);
 assert.equal(p.purchase(s,catalog.get('production_components')).ok,true);
 assert.equal(p.purchase(s,catalog.get('production_efficiency')).ok,false);
 assert.equal(p.purchase(s,catalog.get('production_automation')).ok,true);
 assert.deepEqual(p.read(s).unlocked,['root','production_extraction','production_components','production_automation']);
 assert.equal(p.read(s).shards,75);
 assert.equal(p.reset(s,catalog).ok,true);
 assert.equal(p.read(s).shards,100);
});
test('historical economy purchases survive new catalog and reset remains refundable',()=>{
 const s=store();s.setItem('memoryShards','70');s.setItem('unlockedTalents',JSON.stringify(['root','starter_economy','extra_scrap','extra_alloy']));
 assert.deepEqual(p.read(s).unlocked,['root','starter_economy','extra_scrap','extra_alloy']);
 assert.equal(p.purchase(s,catalog.get('starter_economy')).ok,false);
 assert.equal(p.read(s).shards,70);
 assert.equal(p.reset(s,catalog).ok,true);
 assert.equal(p.read(s).shards,95);
});

test('old purchased defense nodes stay refundable without being sold to new players',()=>{
 const s=store();s.setItem('unlockedTalents',JSON.stringify(['root','starter_base_hp','starter_drone']));
 assert.equal(p.purchase(s,catalog.get('starter_drone')).ok,false);
 assert.equal(p.reset(s,catalog).ok,true);
 assert.equal(p.read(s).shards,13);
});

test('Foundation has distinct defense, vision, production and technology roots',()=>{
 const roots=catalog.trees.foundation.filter(t=>t.parent==='root'&&!t.legacy);
 for(const id of ['starter_base_hp','vision_boost','production_extraction','starter_tech'])assert.ok(roots.some(t=>t.id===id));
});

test('Defense specialization offers one persistent starter role and refunds correctly',()=>{
 const s=store();s.setItem('memoryShards','100');
 for(const id of ['starter_base_hp','starter_reinforcement','defense_marksman'])assert.equal(p.purchase(s,catalog.get(id)).ok,true,id);
 assert.equal(p.purchase(s,catalog.get('defense_medic')).ok,false);
 assert.equal(p.read(s).shards,75);
 assert.equal(p.reset(s,catalog).ok,true);
 assert.equal(p.purchase(s,catalog.get('starter_base_hp')).ok,true);
 assert.equal(p.purchase(s,catalog.get('starter_reinforcement')).ok,true);
 assert.equal(p.purchase(s,catalog.get('defense_medic')).ok,true);
 assert.equal(p.purchase(s,catalog.get('defense_marksman')).ok,false);
});

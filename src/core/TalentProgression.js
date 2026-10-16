// Persistent talent purchases, independent of Phaser and active runs.
(function(root){
'use strict';
const KEY='unlockedTalents', CURRENCY='memoryShards';
function read(storage){
 let unlocked=[],shards=0;
 try {const value=JSON.parse(storage?.getItem(KEY)||'[]');if(Array.isArray(value))unlocked=value.filter(x=>typeof x==='string');}catch(_){}
 try {const n=Number(storage?.getItem(CURRENCY)||0);if(Number.isSafeInteger(n)&&n>=0)shards=n;}catch(_){}
 return {unlocked:[...new Set(['root',...unlocked])],shards};
}
function canUnlock(state,talent){return !!talent&&!talent.planned&&!talent.legacy&&talent.id!=='root'&&!state.unlocked.includes(talent.id)&&(!talent.parent||state.unlocked.includes(talent.parent))&&(!talent.prerequisites||talent.prerequisites.every(id=>state.unlocked.includes(id)))&&(!talent.anyPrerequisites||talent.anyPrerequisites.some(id=>state.unlocked.includes(id)))&&(!talent.excludes||talent.excludes.every(id=>!state.unlocked.includes(id)))&&Number.isSafeInteger(talent.cost)&&talent.cost>=0&&state.shards>=talent.cost;}
function persist(storage,state){
 if(!storage)return false;
 try {const oldIds=storage.getItem(KEY),oldBalance=storage.getItem(CURRENCY);
 try{storage.setItem(KEY,JSON.stringify(state.unlocked));storage.setItem(CURRENCY,String(state.shards));return true;}
 catch(e){try{if(oldIds===null)storage.removeItem(KEY);else storage.setItem(KEY,oldIds);if(oldBalance===null)storage.removeItem(CURRENCY);else storage.setItem(CURRENCY,oldBalance);}catch(_){}return false;}}
 catch(_){return false;}
}
function purchase(storage,talent){const before=read(storage);if(!canUnlock(before,talent))return {ok:false,state:before};const next={unlocked:[...before.unlocked,talent.id],shards:before.shards-talent.cost};return persist(storage,next)?{ok:true,state:next}:{ok:false,state:before};}
function reset(storage,catalog){const state=read(storage);const byId=new Map(catalog.all().map(t=>[t.id,t]));let refund=0;for(const id of state.unlocked){if(id==='root')continue;const cost=byId.get(id)?.cost;if(Number.isSafeInteger(cost)&&cost>=0)refund+=cost;}if(!Number.isSafeInteger(refund)||state.shards>Number.MAX_SAFE_INTEGER-refund)return {ok:false,state};const next={unlocked:['root'],shards:state.shards+refund};return persist(storage,next)?{ok:true,state:next}:{ok:false,state};}
const api={KEY,CURRENCY,read,canUnlock,purchase,reset};root.OverseerTalentProgression=api;if(typeof module!=='undefined'&&module.exports)module.exports=api;
})(globalThis);

(function(root){'use strict';
const KINDS=Object.freeze(['building','technology','artifact']);
function mode(number,seed){
 // Guaranteed dual reward after every milestone assault; keep ordinary 40/40/20.
 if(Number.isInteger(number)&&number>0&&number%10===0)return ['building','technology'];
 let x=(Math.imul(number,0x9e3779b1)^seed^0x76eab43d)>>>0;
 x=Math.imul(x^(x>>>16),0x7feb352d);x=Math.imul(x^(x>>>15),0x846ca68b);x=(x^(x>>>16))>>>0;
 const roll=x%10;
 return roll<4?['building']:roll<8?['technology']:['building','technology'];
}
function options(number,seed,kind,buildings,technologies,artifacts=[]){
 const pool=kind==='building'?[...buildings]:kind==='technology'?technologies.map(type=>'tech:'+type):artifacts.map(id=>'artifact:'+id);
 let state=(seed^Math.imul(number,0x9e3779b1)^(kind==='technology'?0xa62195c7:kind==='artifact'?0x4c32b879:0x4f3d7a1b))>>>0;
 for(let i=pool.length-1;i>0;i--){state=(Math.imul(state,1664525)+1013904223)>>>0;const j=state%(i+1);[pool[i],pool[j]]=[pool[j],pool[i]];}
 return pool.slice(0,3);
}
function artifactDrop(number,seed){
 // Independent from the established 40/40/20 building/technology distribution.
 // Provisional rarity: 20% after wave 2.
 let x=(Math.imul(number,0x9e3779b1)^seed^0x3d0fc537)>>>0;
 x=Math.imul(x^(x>>>16),0x7feb352d);x=Math.imul(x^(x>>>15),0x846ca68b);
 return number>=3 && ((x^(x>>>16))>>>0)%5===0;
}
function create(number,seed,buildings,technologies,artifacts=[],owned=[]){
 const stages=mode(number,seed).map(kind=>({kind,options:options(number,seed,kind,buildings,technologies)}));
 const available=artifacts.filter(id=>!owned.includes(id));
 if(owned.length<6&&available.length&&artifactDrop(number,seed)){
  stages.push({kind:'artifact',options:options(number,seed,'artifact',buildings,technologies,available)});
 }
 return {number,stages,index:0,options:[...stages[0].options]};
}
function current(reward){
 if(reward.stages)return reward.stages[reward.index];
 // Legacy saves may contain both buildings and technologies in a single modal.
 const hasTech=reward.options.some(o=>o.startsWith('tech:'));
 const hasArtifact=reward.options.some(o=>o.startsWith('artifact:'));
 const hasBuilding=reward.options.some(o=>!o.startsWith('tech:')&&!o.startsWith('artifact:'));
 return {kind:hasBuilding&&(hasTech||hasArtifact)||hasTech&&hasArtifact?'mixed':hasArtifact?'artifact':hasTech?'technology':'building',options:reward.options};
}
function advance(reward){if(!reward.stages)return false;reward.index++;if(reward.index>=reward.stages.length)return false;reward.options=[...reward.stages[reward.index].options];return true;}
const api={KINDS,mode,options,artifactDrop,create,current,advance};root.OverseerVNextRewards=api;if(typeof module!=='undefined'&&module.exports)module.exports=api;
})(globalThis);
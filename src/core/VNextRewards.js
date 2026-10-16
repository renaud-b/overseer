(function(root){'use strict';
const KINDS=Object.freeze(['building','technology']);
function mode(number,seed){
 let x=(Math.imul(number,0x9e3779b1)^seed^0x76eab43d)>>>0;
 x=Math.imul(x^(x>>>16),0x7feb352d);x=Math.imul(x^(x>>>15),0x846ca68b);x=(x^(x>>>16))>>>0;
 const roll=x%10;
 return roll<4?['building']:roll<8?['technology']:['building','technology'];
}
function options(number,seed,kind,buildings,technologies){
 const pool=kind==='building'?[...buildings]:technologies.map(type=>'tech:'+type);
 let state=(seed^Math.imul(number,0x9e3779b1)^(kind==='technology'?0xa62195c7:0x4f3d7a1b))>>>0;
 for(let i=pool.length-1;i>0;i--){state=(Math.imul(state,1664525)+1013904223)>>>0;const j=state%(i+1);[pool[i],pool[j]]=[pool[j],pool[i]];}
 return pool.slice(0,3);
}
function create(number,seed,buildings,technologies){
 const stages=mode(number,seed).map(kind=>({kind,options:options(number,seed,kind,buildings,technologies)}));
 return {number,stages,index:0,options:[...stages[0].options]};
}
function current(reward){
 if(reward.stages)return reward.stages[reward.index];
 // Legacy saves may contain both buildings and technologies in a single modal.
 const hasTech=reward.options.some(o=>o.startsWith('tech:'));
 const hasBuilding=reward.options.some(o=>!o.startsWith('tech:'));
 return {kind:hasTech&&hasBuilding?'mixed':hasTech?'technology':'building',options:reward.options};
}
function advance(reward){if(!reward.stages)return false;reward.index++;if(reward.index>=reward.stages.length)return false;reward.options=[...reward.stages[reward.index].options];return true;}
const api={KINDS,mode,options,create,current,advance};root.OverseerVNextRewards=api;if(typeof module!=='undefined'&&module.exports)module.exports=api;
})(globalThis);
(function(root){
'use strict';
const ENEMY_TYPE='basic_monster', MIN_DELAY_MS=60000, MAX_DELAY_MS=120000;
// Visual threat score. Playtest-only heuristic, not a promise about win probability.
const THREAT_WEIGHTS=Object.freeze({basic_monster:1,ranged_monster:2,base_rusher:4});
const THREAT_THRESHOLDS=Object.freeze([6,11,18,25]);
function elite(number){return Number.isInteger(number)&&number>0&&number%10===0;}
function composition(number){
 const total=4+2*Math.floor((number-1)/3);
 if(number<4) return Object.freeze([Object.freeze({type:ENEMY_TYPE,count:total})]);
 const assault=elite(number);
 const target=assault?total+Math.max(4,Math.ceil(total/2)):total;
 const ranged=assault?Math.max(2,Math.ceil(total*0.4)):Math.max(1,Math.floor(total*0.2));
 const rushers=number<7?0:(assault?Math.max(2,Math.ceil(total*0.3)):Math.max(1,Math.floor(total*0.14)));
 return Object.freeze([
  Object.freeze({type:ENEMY_TYPE,count:target-ranged-rushers}),
  Object.freeze({type:'ranged_monster',count:ranged}),
  ...(rushers?[Object.freeze({type:'base_rusher',count:rushers})]:[])
 ]);
}
function danger(waveOrGroups){
 const groups=Array.isArray(waveOrGroups)?waveOrGroups:waveOrGroups.enemies;
 const score=groups.reduce((sum,group)=>sum+group.count*(THREAT_WEIGHTS[group.type]??1),0);
 const level=1+THREAT_THRESHOLDS.filter(threshold=>score>threshold).length;
 return Object.freeze({score,level});
}
function hash(n,seed,salt){let x=(Math.imul(n,0x9e3779b1)^seed^salt)>>>0;x=Math.imul(x^(x>>>16),0x7feb352d);x=Math.imul(x^(x>>>15),0x846ca68b);return(x^(x>>>16))>>>0;}
function wave(number,seed=137){
 if(!Number.isInteger(number)||number<1)throw Error('Invalid wave number');
 // Normal waves follow the prior total-count progression; multiples of ten
 // add an elite mixed assault without introducing unsupported boss mechanics.
 let dueAtMs=0;
 for(let i=1;i<=number;i++){dueAtMs+=MIN_DELAY_MS+hash(i,seed,2)%(MAX_DELAY_MS-MIN_DELAY_MS+1);}
 return Object.freeze({number,dueAtMs,enemies:composition(number)});
}
function preview(count=8,seed=137,after=0){return Array.from({length:count},(_,i)=>wave(after+i+1,seed));}
function advance(state,dt){
 if(!Number.isFinite(dt)||dt<0)throw Error('Invalid wave delta');
 state.elapsedMs+=dt;const triggered=[];
 while(state.elapsedMs>=wave(state.number+1,state.seed).dueAtMs){state.number++;triggered.push(wave(state.number,state.seed));}
 return triggered;
}
const api={ENEMY_TYPE,MIN_DELAY_MS,MAX_DELAY_MS,THREAT_WEIGHTS,elite,composition,danger,wave,preview,advance};
root.OverseerVNextWaves=api;if(typeof module!=='undefined'&&module.exports)module.exports=api;
})(globalThis);

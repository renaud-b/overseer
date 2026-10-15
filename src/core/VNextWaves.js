(function(root){
'use strict';
const ENEMY_TYPE='basic_monster', MIN_DELAY_MS=60000, MAX_DELAY_MS=120000;
function hash(n,seed,salt){let x=(Math.imul(n,0x9e3779b1)^seed^salt)>>>0;x=Math.imul(x^(x>>>16),0x7feb352d);x=Math.imul(x^(x>>>15),0x846ca68b);return(x^(x>>>16))>>>0;}
function wave(number,seed=137){
 if(!Number.isInteger(number)||number<1)throw Error('Invalid wave number');
 // Three waves at each difficulty tier: 1–3: 4, 4–6: 6, 7–9: 8, ...
 const count=4+2*Math.floor((number-1)/3);
 let dueAtMs=0;
 for(let i=1;i<=number;i++){dueAtMs+=MIN_DELAY_MS+hash(i,seed,2)%(MAX_DELAY_MS-MIN_DELAY_MS+1);}
 return Object.freeze({number,dueAtMs,enemies:Object.freeze([Object.freeze({type:ENEMY_TYPE,count})])});
}
function preview(count=8,seed=137,after=0){return Array.from({length:count},(_,i)=>wave(after+i+1,seed));}
function advance(state,dt){
 if(!Number.isFinite(dt)||dt<0)throw Error('Invalid wave delta');
 state.elapsedMs+=dt;const triggered=[];
 while(state.elapsedMs>=wave(state.number+1,state.seed).dueAtMs){state.number++;triggered.push(wave(state.number,state.seed));}
 return triggered;
}
const api={ENEMY_TYPE,MIN_DELAY_MS,MAX_DELAY_MS,wave,preview,advance};
root.OverseerVNextWaves=api;if(typeof module!=='undefined'&&module.exports)module.exports=api;
})(globalThis);

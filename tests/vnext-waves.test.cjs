'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const waves = require('../src/core/VNextWaves.js');
test('waves introduce ranged and rushers gradually; every tenth wave is an elite assault', () => {
    const a=waves.preview(30,981);
    assert.equal(a.length,30);
    assert.deepEqual(a,waves.preview(30,981));
    const groups=n=>a[n-1].enemies.map(g=>[g.type,g.count]);
    assert.deepEqual(groups(1),[['basic_monster',4]]);
    assert.deepEqual(groups(4),[['basic_monster',5],['ranged_monster',1]]);
    assert.deepEqual(groups(7),[['basic_monster',6],['ranged_monster',1],['base_rusher',1]]);
    assert.deepEqual(groups(10),[['basic_monster',8],['ranged_monster',4],['base_rusher',3]]);
    assert.equal(waves.elite(10),true);
    assert.equal(waves.elite(20),true);
    assert.equal(waves.elite(19),false);
    assert.ok(a.every(w=>w.enemies.every(g=>g.count>0)));
    assert.ok(a.every(w=>!('rewards' in w)), 'wave descriptors remain separate from rewards');
    for(let n=1;n<=30;n++){
        const w=a[n-1], total=w.enemies.reduce((sum,g)=>sum+g.count,0);
        const baseline=4+2*Math.floor((n-1)/3);
        assert.equal(total,baseline+(waves.elite(n)?Math.max(4,Math.ceil(baseline/2)):0));
        assert.deepEqual(w.enemies,waves.wave(n,123).enemies, 'composition independent of seed');
    }
});

test('estimated danger depends on enemy weights, not just the wave number', () => {
    const threat=n=>waves.danger(waves.wave(n));
    assert.deepEqual([1,4,7,10].map(n=>threat(n).level),[1,2,3,5]);
    assert.ok(threat(10).score>threat(9).score);
    assert.ok(threat(10).level>threat(11).level, 'elite peak is visible in timeline');
    assert.equal(waves.danger([{type:'base_rusher',count:3}]).level,3);
    assert.equal(waves.danger([{type:'basic_monster',count:3}]).level,1);
    assert.equal(waves.danger([{type:'basic_monster',count:1000}]).level,5);
});

test('wave gaps range from 60 to 120 simulated seconds',()=>{
 const plan=waves.preview(40,981);
 assert.ok(plan.every((w,i)=>w.dueAtMs-(i?plan[i-1].dueAtMs:0)>=60000&&w.dueAtMs-(i?plan[i-1].dueAtMs:0)<=120000));
 assert.deepEqual(plan,waves.preview(40,981));
 assert.ok(plan.some((w,i)=>w.dueAtMs!==waves.preview(40,13)[i].dueAtMs));
});
test('crossing each deadline triggers once; paused clock does not progress',()=>{
 const state={number:0,elapsedMs:0,seed:137},first=waves.wave(1).dueAtMs;
 assert.equal(waves.advance(state,first-1).length,0);
 assert.equal(waves.advance(state,0).length,0);
 assert.equal(waves.advance(state,1).length,1);
 assert.equal(waves.advance(state,0).length,0);
 const fast={number:0,elapsedMs:0,seed:137};
 for(let i=0;i<Math.ceil(first/300);i++)waves.advance(fast,300);
 assert.equal(fast.number,1);
 assert.equal(waves.advance(state,waves.wave(3).dueAtMs-state.elapsedMs).length,2);
});

test('timeline previews and triggered waves use identical counts after each tier boundary', () => {
 const state={number:0,elapsedMs:0,seed:19};
 for(let n=1;n<=10;n++){
  const expected=waves.preview(1,19,state.number)[0];
  assert.equal(expected.number,n);
  const triggered=waves.advance(state,expected.dueAtMs-state.elapsedMs);
  assert.deepEqual(triggered,[expected]);
  assert.equal(triggered[0].enemies.reduce((sum,g)=>sum+g.count,0),
   (4+2*Math.floor((n-1)/3))+(waves.elite(n)?Math.max(4,Math.ceil((4+2*Math.floor((n-1)/3))/2)):0));
 }
});

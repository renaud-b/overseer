'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const waves = require('../src/core/VNextWaves.js');
test('wave plan starts at four enemies and gains two every three waves', () => {
    const a = waves.preview(30, 981);
    assert.equal(a.length, 30);
    assert.deepEqual(a, waves.preview(30, 981));
    assert.ok(a.every(w => w.enemies.length === 1 && w.enemies[0].type === 'basic_monster'));
    assert.deepEqual(a.slice(0,10).map(w => w.enemies[0].count), [4,4,4,6,6,6,8,8,8,10]);
    assert.ok(a.every((w, i) => w.enemies[0].count === 4 + 2 * Math.floor(i / 3)));
    assert.deepEqual(a.map(w => w.enemies[0].count), waves.preview(30, 13).map(w => w.enemies[0].count));
    assert.ok(a.every(w => !('rewards' in w)));
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
  assert.equal(triggered[0].enemies[0].count,4+2*Math.floor((n-1)/3));
 }
});

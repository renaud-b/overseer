'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const waves = require('../src/core/VNextWaves.js');
test('wave plan always uses one enemy type with increasing randomized counts', () => {
    const a = waves.preview(30, 981);
    assert.equal(a.length, 30);
    assert.deepEqual(a, waves.preview(30, 981));
    assert.ok(a.every(w => w.enemies.length === 1 && w.enemies[0].type === 'basic_monster'));
    assert.ok(a.every((w, i) => i === 0 || w.enemies[0].count > a[i - 1].enemies[0].count));
    assert.ok(a.some((w, i) => w.enemies[0].count !== waves.preview(30, 13)[i].enemies[0].count));
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

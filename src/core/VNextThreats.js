(function(root) {
'use strict';
// Threat detection belongs to simulation space, not to the Phaser panel.
const BASE = Object.freeze({x: 65, y: 300});
const RADIUS = 350;
const MEMORY_MS = 2000;
// Experimental perceptual pulse: the unamplified core keeps its original range.
const PULSE = Object.freeze({durationMs:5000,maxRadius:500});
function amplifiers(model) {
    return model.world.query('Building','GridSlot').filter(id=>
        model.world.get(id,'Building').type==='perception_amplifier' &&
        model.world.get(model.tiles[model.world.get(id,'GridSlot').index],'Watched').active);
}
function state(model) {
    if(!model.world.hasComponent(model.game,'PerceptionPulse'))
        model.world.set(model.game,'PerceptionPulse',{phaseMs:0});
    return model.world.get(model.game,'PerceptionPulse');
}
function active(model){return amplifiers(model).length>0;}
function step(model,dt, multiplier=1) {
    if(!Number.isFinite(dt)||dt<0||!Number.isFinite(multiplier)||multiplier<1)throw Error('Invalid perception delta');
    if(!active(model)||dt===0)return radius(model);
    const pulse=state(model);
    pulse.phaseMs=(pulse.phaseMs+dt*multiplier)%PULSE.durationMs;
    return radius(model);
}
function radius(model) {
    if(!active(model))return RADIUS;
    const phase=(model.world.get(model.game,'PerceptionPulse')?.phaseMs||0)/PULSE.durationMs;
    return RADIUS+(PULSE.maxRadius-RADIUS)*(1-Math.cos(2*Math.PI*phase))/2;
}
function update(world, enemies, dt, radius = RADIUS) {
    for (const id of enemies) {
        if (!world.has(id) || world.get(id, 'Health')?.hp <= 0) continue;
        const p = world.get(id, 'Position');
        if (!p) continue;
        const inside = Math.hypot(p.x - BASE.x, p.y - BASE.y) <= radius;
        const marked = world.get(id, 'ThreatMark');
        if (inside) {
            world.set(id, 'ThreatMark', { remainingMs: MEMORY_MS });
        } else if (marked) {
            marked.remainingMs -= dt;
            if (marked.remainingMs <= 0) world.remove(id, 'ThreatMark');
        }
    }
}
const api = { BASE, RADIUS, MEMORY_MS, PULSE, active, amplifiers, state, step, radius, update };
root.OverseerVNextThreats = api;
if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(globalThis);

(function(root) {
'use strict';
// Threat detection belongs to simulation space, not to the Phaser panel.
const BASE = Object.freeze({x: 65, y: 300});
const RADIUS = 350;
const MEMORY_MS = 2000;
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
const api = { BASE, RADIUS, MEMORY_MS, update };
root.OverseerVNextThreats = api;
if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(globalThis);

(function(root) {
    'use strict';
    // Display-only wave plan, not a combat spawner. The seed keeps hover details
    // unchanged across renders; increasing counts add some reproducible variation.
    const ENEMY_TYPE = 'basic_monster';
    const INTERVAL_MS = 60000;
    function advance(state, dt) {
        if (!Number.isFinite(dt) || dt < 0) throw new Error('Invalid wave delta');
        state.elapsedMs += dt;
        const triggered = [];
        while (state.elapsedMs >= INTERVAL_MS) {
            state.elapsedMs -= INTERVAL_MS;
            state.number++;
            triggered.push(wave(state.number, state.seed));
        }
        return triggered;
    }
    function wave(number, seed = 137) {
        if (!Number.isInteger(number) || number < 1) throw new Error('Invalid wave number');
        let count = 2;
        for (let index = 1; index <= number; index++) {
            const mixed = (Math.imul(index, 1103515245) + seed) >>> 0;
            count += 2 + (mixed % 3);
        }
        return Object.freeze({
            number, enemies: Object.freeze([{ type: ENEMY_TYPE, count }])
        });
    }
    function preview(count = 8, seed = 137) {
        return Array.from({ length: count }, (_, i) => wave(i + 1, seed));
    }
    const api = { ENEMY_TYPE, INTERVAL_MS, wave, preview, advance };
    root.OverseerVNextWaves = api;
    if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(globalThis);

(function(root) {
    'use strict';
    // Display-only wave plan, not a combat spawner. The seed keeps hover details
    // unchanged across renders; increasing counts add some reproducible variation.
    const ENEMY_TYPE = 'basic_monster';
    function wave(number, seed = 137) {
        if (!Number.isInteger(number) || number < 1) throw new Error('Invalid wave number');
        const mixed = (Math.imul(number, 1103515245) + seed) >>> 0;
        const jitter = mixed % (number + 2);
        return Object.freeze({
            number, enemies: Object.freeze([{ type: ENEMY_TYPE, count: 2 + number * 2 + jitter }])
        });
    }
    function preview(count = 8, seed = 137) {
        return Array.from({ length: count }, (_, i) => wave(i + 1, seed));
    }
    const api = { ENEMY_TYPE, wave, preview };
    root.OverseerVNextWaves = api;
    if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(globalThis);

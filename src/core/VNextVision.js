(function (root) {
    'use strict';

    // Playtest-only prices; amounts are NOT a finalized economy decision.
    // Change this table once Data production and balancing are validated.
    const DATA_COSTS = Object.freeze([30, 90, 240]);

    function nextCost(level) {
        return Number.isInteger(level) && level >= 0 ? (DATA_COSTS[level] ?? null) : null;
    }

    function fitAttention(attention, pattern, gridSize = 5) {
        if (!attention || !Number.isInteger(attention.x) || !Number.isInteger(attention.y) ||
            !Array.isArray(pattern) || pattern.length === 0) return null;
        const xs = pattern.map(offset => offset.x);
        const ys = pattern.map(offset => offset.y);
        if (![...xs, ...ys].every(Number.isInteger)) return null;
        // The attention anchor itself is a grid cell and must remain in bounds,
        // even if a malformed future pattern could be translated onto the board.
        const minX = Math.max(0, -Math.min(...xs));
        const maxX = Math.min(gridSize - 1, gridSize - 1 - Math.max(...xs));
        const minY = Math.max(0, -Math.min(...ys));
        const maxY = Math.min(gridSize - 1, gridSize - 1 - Math.max(...ys));
        if (minX > maxX || minY > maxY) return null;
        // Keep the current rotation and move only as far as necessary.
        return {
            x: Math.max(minX, Math.min(maxX, attention.x)),
            y: Math.max(minY, Math.min(maxY, attention.y))
        };
    }

    function purchase(level, resources, attention, nextPattern) {
        const cost = nextCost(level);
        if (cost === null || !resources || !Number.isFinite(resources.data) ||
            resources.data < cost) return null;
        const nextAttention = fitAttention(attention, nextPattern);
        if (!nextAttention) return null;
        resources.data -= cost; // Atomic with successful validation; ECS balance owns the currency.
        return { level: level + 1, attention: nextAttention, cost };
    }

    const api = { DATA_COSTS, nextCost, fitAttention, purchase };
    root.OverseerVNextVision = api;
    if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(globalThis);

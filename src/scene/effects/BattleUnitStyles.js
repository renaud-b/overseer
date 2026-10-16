(function (root) {
    'use strict';

    // Rendering identity only. Geometry and color never change the ECS unit statistics.
    // Distinct silhouettes remain recognizable without color or future 3D models.
    const ALLIES = Object.freeze({
        unit_guard: Object.freeze({ shape: 'shield', color: 0x48d8ed }),
        unit_sniper: Object.freeze({ shape: 'diamond', color: 0xf6bf69 }),
        unit_mecha: Object.freeze({ shape: 'hexagon', color: 0xae90f5 }),
        unit_dronoid: Object.freeze({ shape: 'drone', color: 0x60dca4 })
    });
    const DEFAULT_ALLY = Object.freeze({ shape: 'triangle', color: 0x38d9f1 });
    const ENEMY = Object.freeze({ shape: 'circle', color: 0xff5c79 });

    function styleFor(type, side) {
        return side === 'player' ? (ALLIES[type] || DEFAULT_ALLY) : ENEMY;
    }

    const api = { styleFor };
    root.OverseerBattleUnitStyles = api;
    if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(globalThis);

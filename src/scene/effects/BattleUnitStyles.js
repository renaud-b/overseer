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
    const DEFAULT_ENEMY = Object.freeze({ shape: 'circle', color: 0xff5c79, size: 1 });
    // Visual identities for known stat archetypes; they do not implement special AI behaviors.
    const ENEMIES = Object.freeze({
        basic_monster: Object.freeze({ shape: 'circle', color: 0xff5c79, size: 1 }),
        ranged_monster: Object.freeze({ shape: 'diamond', color: 0xf5b94f, size: 1 }),
        base_rusher: Object.freeze({ shape: 'hexagon', color: 0xff8263, size: 1.2 }),
        stalker: Object.freeze({ shape: 'triangle', color: 0xaf8fe8, size: 0.95 }),
        mother_slime: Object.freeze({ shape: 'hexagon', color: 0xd77fb9, size: 1.3 }),
        baby_slime: Object.freeze({ shape: 'circle', color: 0xffa3ce, size: 0.72 })
    });
    const LABELS = Object.freeze({
        basic_monster: 'Ennemi de base',
        ranged_monster: 'Tireur distant',
        base_rusher: 'Percuteur',
        stalker: 'Traqueur',
        mother_slime: 'Slime mère',
        baby_slime: 'Petit slime'
    });
    function styleFor(type, side) {
        return side === 'player' ? (ALLIES[type] || DEFAULT_ALLY) : (ENEMIES[type] || DEFAULT_ENEMY);
    }
    function enemyLabel(type) { return LABELS[type] || type; }

    const api = { styleFor, enemyLabel };
    root.OverseerBattleUnitStyles = api;
    if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(globalThis);

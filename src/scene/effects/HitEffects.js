(function (root) {
    'use strict';

    // Presentation-only reactions: no ECS components, physics displacement or save state.
    const RECOIL_MS = 210;
    const FLASH_MS = 230;
    const REST = Object.freeze({ x: 0, y: 0, flash: 0 });

    function tintColor(color, amount) {
        const t = Math.max(0, Math.min(1, amount));
        const mix = channel => Math.round(channel + (255 - channel) * t);
        return (mix((color >> 16) & 255) << 16) |
            (mix((color >> 8) & 255) << 8) | mix(color & 255);
    }

    class HitEffects {
        constructor() {
            this.hits = new Map();
        }

        hit(targetId, attacker, defender) {
            if (!Number.isInteger(targetId) || !attacker || !defender ||
                ![attacker.x, attacker.y, defender.x, defender.y].every(Number.isFinite)) return;
            const dx = defender.x - attacker.x, dy = defender.y - attacker.y;
            const length = Math.hypot(dx, dy);
            // Equal positions are valid (overlapping units); never generate NaN.
            this.hits.set(targetId, {
                x: length > 0.00001 ? dx / length : 1,
                y: length > 0.00001 ? dy / length : 0,
                elapsedMs: 0
            }); // A second hit replaces, rather than stacks, the current reaction.
        }

        update(deltaMs) {
            if (!Number.isFinite(deltaMs) || deltaMs <= 0) return;
            for (const [id, hit] of this.hits) {
                hit.elapsedMs += deltaMs;
                if (hit.elapsedMs >= FLASH_MS) this.hits.delete(id);
            }
        }

        view(targetId) {
            const hit = this.hits.get(targetId);
            if (!hit) return REST;
            const progress = Math.min(1, hit.elapsedMs / RECOIL_MS);
            // Relative to the rendered unit radius, independent of camera/renderer.
            const recoil = hit.elapsedMs >= RECOIL_MS ? 0 :
                0.68 * Math.sin(Math.PI * progress) * (1 - 0.25 * progress);
            const t = hit.elapsedMs;
            const flash = t < 65 ? 1 : t < 115 ? 0 : t < 180 ? 0.75 : 0;
            return { x: hit.x * recoil, y: hit.y * recoil, flash };
        }

        clear() { this.hits.clear(); }
    }

    const api = { HitEffects, tintColor };
    root.OverseerHitEffects = api;
    if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(globalThis);

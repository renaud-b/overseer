(function (root) {
    'use strict';

    // Presentation-only reactions: no ECS components, physics displacement or save state.
    const RECOIL_MS = 210;
    const FLASH_MS = 230;
    const REST = Object.freeze({ x: 0, y: 0, flash: 0 });
    const MAX_PARTICLES = 180;
    const PARTICLES_PER_HIT = 5;
    const PARTICLE_MS = 420;

    function tintColor(color, amount) {
        const t = Math.max(0, Math.min(1, amount));
        const mix = channel => Math.round(channel + (255 - channel) * t);
        return (mix((color >> 16) & 255) << 16) |
            (mix((color >> 8) & 255) << 8) | mix(color & 255);
    }

    class HitEffects {
        constructor() {
            this.hits = new Map();
            this.particles = [];
            this.serial = 0;
        }

        hit(targetId, attacker, defender, color = 0xff5c79) {
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
            // Each fragment snapshots the location and facing at impact: lethal hits remain visible.
            // Units/cameras may move, but the fragments need no live entity references.
            for (let i = 0; i < PARTICLES_PER_HIT; i++) {
                const n = this.serial++;
                const angle = (n * 2.399963229728653 + i * 0.4) % (Math.PI * 2);
                const speed = 28 + (n % 4) * 12;
                this.particles.push({
                    x: defender.x, y: defender.y,
                    vx: Math.cos(angle) * speed + (length > 0.00001 ? dx / length : 1) * 18,
                    vy: Math.sin(angle) * speed - 32,
                    ageMs: 0, lifeMs: PARTICLE_MS - (n % 3) * 35,
                    targetId, color
                });
            }
            if (this.particles.length > MAX_PARTICLES)
                this.particles.splice(0, this.particles.length - MAX_PARTICLES);
        }

        update(deltaMs) {
            if (!Number.isFinite(deltaMs) || deltaMs <= 0) return;
            for (const [id, hit] of this.hits) {
                hit.elapsedMs += deltaMs;
                if (hit.elapsedMs >= FLASH_MS) this.hits.delete(id);
            }
            // Analytic integration, based only on lifetime, stays stable across x1/x5 and frame gaps.
            for (const fragment of this.particles) fragment.ageMs += deltaMs;
            this.particles = this.particles.filter(fragment => fragment.ageMs < fragment.lifeMs);
        }

        fragments() {
            return this.particles.map(p => {
                const t = p.ageMs / 1000;
                const life = p.ageMs / p.lifeMs;
                return {
                    x: p.x + p.vx * t,
                    y: p.y + p.vy * t + 0.5 * 175 * t * t,
                    alpha: Math.max(0, 1 - life),
                    size: 2.7 * (1 - 0.55 * life),
                    targetId: p.targetId,
                    color: p.color
                };
            });
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

        clear() {
            this.hits.clear();
            this.particles.length = 0;
        }
    }

    const api = { HitEffects, tintColor };
    root.OverseerHitEffects = api;
    if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(globalThis);

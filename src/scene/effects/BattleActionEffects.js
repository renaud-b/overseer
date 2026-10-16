(function (root) {
    'use strict';

    // Visual snapshots in world coordinates. The simulator already resolved the attack.
    const LASER_MS = 160;
    const MAX_ACTIONS = 48;

    function isPoint(p) {
        return !!p && Number.isFinite(p.x) && Number.isFinite(p.y);
    }

    class BattleActionEffects {
        constructor() { this.entries = []; }

        add(kind, from, to, color, durationMs) {
            if (!isPoint(from) || !isPoint(to) || !Number.isFinite(color)) return false;
            this.entries.push({
                kind, from: { x: from.x, y: from.y }, to: { x: to.x, y: to.y },
                color, elapsedMs: 0, durationMs
            });
            if (this.entries.length > MAX_ACTIONS)
                this.entries.splice(0, this.entries.length - MAX_ACTIONS);
            return true;
        }

        laser(from, to, color) {
            return this.add('laser', from, to, color, LASER_MS);
        }

        update(deltaMs) {
            if (!Number.isFinite(deltaMs) || deltaMs <= 0) return;
            for (const effect of this.entries) effect.elapsedMs += deltaMs;
            this.entries = this.entries.filter(effect => effect.elapsedMs < effect.durationMs);
        }

        visuals() {
            return this.entries.map(effect => ({
                kind: effect.kind,
                from: { ...effect.from }, to: { ...effect.to },
                color: effect.color,
                alpha: Math.max(0, 1 - effect.elapsedMs / effect.durationMs),
                progress: Math.min(1, effect.elapsedMs / effect.durationMs)
            }));
        }

        clear() { this.entries.length = 0; }
    }

    const api = { BattleActionEffects };
    root.OverseerBattleActionEffects = api;
    if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(globalThis);

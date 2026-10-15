(function (root) {
    'use strict';

    // Temporary playtest values, NOT decided Overseer economy rules.
    // Construction is deliberately free in the preview; cooling/data are not simulated.
    const PROTOTYPE_RECIPES = Object.freeze({
        reactor: Object.freeze({ cycleMs: 2000, produces: { energy: 2 }, consumes: {} }),
        extractor: Object.freeze({ cycleMs: 2000, produces: { matter: 2 }, consumes: {} }),
        factory: Object.freeze({ cycleMs: 3000, produces: { components: 1 }, consumes: { energy: 2, matter: 2 } }),
        // No cadence specified yet: immediately build one base unit when observed and affordable.
        barracks: Object.freeze({ cycleMs: 0, produces: { unit_guard: 1 }, consumes: { components: 50, energy: 30 } })
    });

    function ensureProduction(model) {
        for (const id of model.world.query('Building')) {
            const type = model.world.get(id, 'Building').type;
            const recipe = PROTOTYPE_RECIPES[type];
            if (recipe && !model.world.hasComponent(id, 'Production')) {
                model.world.set(id, 'Production', { elapsedMs: 0, cooldownMs: recipe.cycleMs, blocked: false });
            }
        }
    }

    function initialize(model) {
        if (!model.world.hasComponent(model.game, 'Resources')) {
            model.world.set(model.game, 'Resources', { energy: 0, matter: 0, components: 0 });
        }
        ensureProduction(model);
        return model.world.get(model.game, 'Resources');
    }

    function step(model, deltaMs) {
        if (!Number.isFinite(deltaMs) || deltaMs < 0) throw new Error('Invalid simulation delta');
        const resources = initialize(model);
        if (deltaMs === 0) return [];
        const events = [];
        for (const id of model.world.query('Building', 'GridSlot', 'Production')) {
            const type = model.world.get(id, 'Building').type;
            const recipe = PROTOTYPE_RECIPES[type];
            if (!recipe) continue;
            const slot = model.world.get(id, 'GridSlot').index;
            if (!model.world.get(model.tiles[slot], 'Watched').active) continue;
            const progress = model.world.get(id, 'Production');
            progress.elapsedMs += deltaMs;
            progress.blocked = false;
            if (type === 'barracks') {
                if (Object.entries(recipe.consumes).some(([key, qty]) => resources[key] < qty)) {
                    progress.blocked = true;
                    continue;
                }
                for (const [key, qty] of Object.entries(recipe.consumes)) resources[key] -= qty;
                events.push({ type: 'unit-produced', building: id, buildingType: type, unitType: 'unit_guard' });
                continue;
            }
            while (progress.elapsedMs >= recipe.cycleMs) {
                if (Object.entries(recipe.consumes).some(([key, qty]) => resources[key] < qty)) {
                    // The machine stays ready, then retries as soon as inputs are available.
                    progress.elapsedMs = recipe.cycleMs;
                    progress.blocked = true;
                    break;
                }
                for (const [key, qty] of Object.entries(recipe.consumes)) resources[key] -= qty;
                for (const [key, qty] of Object.entries(recipe.produces)) resources[key] += qty;
                progress.elapsedMs -= recipe.cycleMs;
                events.push({ type: 'production', building: id, buildingType: type });
            }
        }
        return events;
    }

    const api = { PROTOTYPE_RECIPES, initialize, step };
    root.OverseerVNextEconomy = api;
    if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(globalThis);

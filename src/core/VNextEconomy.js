(function (root) {
    'use strict';

    // Temporary playtest values, NOT decided Overseer economy rules.
    // Construction is deliberately free in the preview; cooling is not simulated.
    const PROTOTYPE_RECIPES = Object.freeze({
        reactor: Object.freeze({ cycleMs: 2000, produces: { energy: 2 }, consumes: {} }),
        extractor: Object.freeze({ cycleMs: 2000, produces: { matter: 2 }, consumes: {} }),
        factory: Object.freeze({ cycleMs: 3000, produces: { components: 1 }, consumes: { energy: 2, matter: 2 } }),
        // Under attention only; completion pays all three inputs atomically.
        compute_node: Object.freeze({ cycleMs: 6000, produces: { data: 2 }, consumes: { energy: 2, components: 1, matter: 1 } }),
        // One unit per completed observed cycle. Inputs are spent only when the unit exits.
        barracks: Object.freeze({ cycleMs: 5000, produces: { unit_guard: 1 }, consumes: { components: 25, energy: 15 } }),
        ballistics: Object.freeze({ cycleMs: 8000, produces: { unit_sniper: 1 }, consumes: { components: 35, energy: 20 } }),
        armor_forge: Object.freeze({ cycleMs: 12000, produces: { unit_mecha: 1 }, consumes: { components: 60, energy: 35 } }),
        medical_center: Object.freeze({ cycleMs: 10000, produces: { unit_dronoid: 1 }, consumes: { components: 40, energy: 25 } })
    });

    const MILITARY = Object.freeze({
        barracks: Object.freeze({ unitType: 'unit_guard', capacityPerBuilding: 3 }),
        ballistics: Object.freeze({ unitType: 'unit_sniper', capacityPerBuilding: 3 }),
        armor_forge: Object.freeze({ unitType: 'unit_mecha', capacityPerBuilding: 3 }),
        medical_center: Object.freeze({ unitType: 'unit_dronoid', capacityPerBuilding: 3 })
    });
    function unitCapacity(model, type) {
        if (!MILITARY[type]) return 0;
        return model.world.query('Building').filter(id => model.world.get(id, 'Building').type === type).length *
            MILITARY[type].capacityPerBuilding;
    }
    function aliveUnits(model, type) {
        const unitType = MILITARY[type]?.unitType;
        if (!unitType) return 0;
        return model.world.query('PreviewUnit', 'Health', 'Faction').filter(id =>
            model.world.get(id, 'Faction').side === 'player' &&
            !model.world.hasComponent(id, 'TemporaryAlly') &&
            model.world.get(id, 'PreviewUnit').type === unitType &&
            model.world.get(id, 'Health').hp > 0).length;
    }

    function ensureProduction(model) {
        for (const id of model.world.query('Building')) {
            const type = model.world.get(id, 'Building').type;
            const recipe = PROTOTYPE_RECIPES[type];
            if (!recipe) continue;
            if (!model.world.hasComponent(id, 'Production')) {
                model.world.set(id, 'Production', { elapsedMs: 0, cooldownMs: recipe.cycleMs, blocked: false });
            } else if (MILITARY[type]) {
                const progress = model.world.get(id, 'Production');
                if (progress.cooldownMs === 0) {
                    // Pre-cadence saves accumulated arbitrary elapsed time: do not award
                    // instant units from that legacy value when resuming a run.
                    progress.elapsedMs = 0;
                    progress.cooldownMs = recipe.cycleMs;
                    progress.blocked = false;
                }
            }
        }
    }

    function initialize(model) {
        if (!model.world.hasComponent(model.game, 'Resources')) {
            model.world.set(model.game, 'Resources', { energy: 0, matter: 0, components: 0, data: 0 });
        }
        const resources = model.world.get(model.game, 'Resources');
        // Old saves omit Data. Backfill once without resetting saved balances or cycles.
        if (resources.data === undefined) resources.data = 0;
        ensureProduction(model);
        return resources;
    }

    function forceCycle(model, id, pending = []) {
        const world = model.world, building = world.get(id, 'Building');
        const recipe = PROTOTYPE_RECIPES[building?.type];
        if (!recipe) return null;
        const resources = initialize(model);
        if (MILITARY[building.type] &&
            aliveUnits(model, building.type) + pending.filter(e =>
                e.type === 'unit-produced' && e.buildingType === building.type).length >= unitCapacity(model, building.type)) return null;
        if (Object.entries(recipe.consumes).some(([key, qty]) => resources[key] < qty)) return null;
        for (const [key, qty] of Object.entries(recipe.consumes)) resources[key] -= qty;
        if (MILITARY[building.type]) return {
            type: 'unit-produced', building: id, buildingType: building.type,
            unitType: MILITARY[building.type].unitType
        };
        for (const [key, qty] of Object.entries(recipe.produces)) resources[key] += qty;
        return { type: 'production', building: id, buildingType: building.type };
    }

    function step(model, deltaMs, extraActivationMs = {}) {
        if (!Number.isFinite(deltaMs) || deltaMs < 0) throw new Error('Invalid simulation delta');
        const resources = initialize(model);
        if (deltaMs === 0) return [];
        const events = [];
        for (const id of model.world.query('Building', 'GridSlot', 'Production')) {
            const type = model.world.get(id, 'Building').type;
            const recipe = PROTOTYPE_RECIPES[type];
            if (!recipe) continue;
            const slot = model.world.get(id, 'GridSlot').index;
            const watched = model.world.get(model.tiles[slot], 'Watched').active;
            const activeMs = watched ? deltaMs :
                Math.min(deltaMs, Math.max(0, extraActivationMs[id] || 0));
            if (!activeMs) continue;
            const progress = model.world.get(id, 'Production');
            // Surcharge accelerates only observed machines; the artifact grace is unboosted.
            const extra = watched ? model.world.get(model.game, 'TechnologyEffects')?.overloadMs || 0 : 0;
            const acceleratedMs = activeMs + Math.min(activeMs, Math.max(0, extra));
            progress.elapsedMs += acceleratedMs;
            progress.blocked = false;
            if (MILITARY[type]) {
                // A completed cycle waits for materials/capacity. No resource reservation,
                // no production while unobserved, and no backlog of blocked cycles.
                while (progress.elapsedMs >= recipe.cycleMs) {
                    const event = forceCycle(model, id, events);
                    if (!event) {
                        progress.elapsedMs = recipe.cycleMs;
                        progress.blocked = true;
                        break;
                    }
                    progress.elapsedMs -= recipe.cycleMs;
                    events.push(event);
                }
                continue;
            }
            while (progress.elapsedMs >= recipe.cycleMs) {
                const event = forceCycle(model, id, events);
                if (!event) {
                    // The machine stays ready, then retries as soon as inputs are available.
                    progress.elapsedMs = recipe.cycleMs;
                    progress.blocked = true;
                    break;
                }
                progress.elapsedMs -= recipe.cycleMs;
                events.push(event);
            }
        }
        return events;
    }

    const api = { PROTOTYPE_RECIPES, MILITARY, unitCapacity, aliveUnits, initialize, forceCycle, step };
    root.OverseerVNextEconomy = api;
    if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(globalThis);

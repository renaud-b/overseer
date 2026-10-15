(function (root) {
    'use strict';

    // Preview-only placement/attention model. No production or economy is simulated here.
    function createModel(World) {
        const world = new World();
        const game = world.create();
        const grid = world.create(game);
        world.set(grid, 'Grid', { width: 5, height: 5 });
        const tiles = Array.from({ length: 25 }, (_, index) => {
            const id = world.create(grid);
            world.set(id, 'Tile', { index, x: index % 5, y: Math.floor(index / 5) });
            world.set(id, 'Watched', { active: false });
            return id;
        });
        return { world, game, grid, tiles };
    }

    function buildingAt(model, index) {
        return model.world.query('Building', 'GridSlot')
            .find(id => model.world.get(id, 'GridSlot').index === index) ?? null;
    }

    function placeBuilding(model, type, index) {
        if (!Number.isInteger(index) || index < 0 || index >= 25 || !type || buildingAt(model, index) !== null) return null;
        const id = model.world.create(model.game);
        model.world.set(id, 'Building', { type });
        model.world.set(id, 'GridSlot', { index });
        return id;
    }

    function moveBuilding(model, id, target) {
        if (!model.world.has(id) || !model.world.hasComponent(id, 'Building') ||
            !Number.isInteger(target) || target < 0 || target >= 25 || buildingAt(model, target) !== null) return false;
        model.world.get(id, 'GridSlot').index = target;
        return true;
    }

    function setObserved(model, indices) {
        if (!indices.every(i => Number.isInteger(i) && i >= 0 && i < 25)) return false;
        const watched = new Set(indices);
        model.tiles.forEach((id, i) => { model.world.get(id, 'Watched').active = watched.has(i); });
        return true;
    }

    function observedBuildings(model) {
        return model.world.query('Building', 'GridSlot').filter(id => {
            const index = model.world.get(id, 'GridSlot').index;
            return model.world.get(model.tiles[index], 'Watched').active;
        });
    }

    function attentionLinks(model) {
        const watched = observedBuildings(model);
        const edges = [];
        watched.forEach((a, i) => {
            const ai = model.world.get(a, 'GridSlot').index;
            watched.slice(i + 1).forEach(b => {
                const bi = model.world.get(b, 'GridSlot').index;
                if (Math.abs(ai % 5 - bi % 5) + Math.abs(Math.floor(ai / 5) - Math.floor(bi / 5)) === 1) {
                    edges.push([ai, bi]);
                }
            });
        });
        return edges;
    }

    const api = { createModel, buildingAt, placeBuilding, moveBuilding, setObserved, observedBuildings, attentionLinks };
    root.OverseerVNextPreview = api;
    if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(globalThis);

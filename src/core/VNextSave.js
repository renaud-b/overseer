(function (root) {
    'use strict';

    // One local VNext run; persistent talents use separate, existing localStorage keys.
    const KEY = 'overseer.vnext.save';
    const VERSION = 1;
    const AUTOSAVE_MS = 20000;
    const SPEEDS = [0, 1, 2, 3, 5];
    function rewardTypes() {
        const cards = root.OverseerVNextCards ||
            (typeof require === 'function' ? require('./VNextCards.js') : null);
        const technologies = root.OverseerVNextTechnologies ||
            (typeof require === 'function' ? require('./VNextTechnologies.js') : null);
        return [...(cards?.REWARD_CARDS || cards?.STARTER_CARDS || []),
            ...(technologies?.TYPES || []).map(type => `tech:${type}`)];
    }

    function storageOrNull(storage) {
        if (storage !== undefined) return storage;
        try { return root.localStorage || null; } catch (_) { return null; }
    }

    function capture(scene, savedAt = Date.now()) {
        return {
            version: VERSION,
            savedAt,
            world: scene.world.serialize(),
            model: { game: scene.model.game, grid: scene.model.grid, tiles: [...scene.model.tiles] },
            attention: {
                x: scene.attention.x, y: scene.attention.y,
                patternIndex: scene.visionRules.patternIndex,
                level: scene.visionRules.level ?? 0
            },
            waveClock: { ...scene.waveClock },
            waveMembers: [...scene.waveMembers].map(([number, ids]) => [number, [...ids]]),
            rewardQueue: scene.rewardQueue.map(reward => ({ number: reward.number, options: [...reward.options] })),
            activeReward: scene.activeReward
                ? { number: scene.activeReward.number, options: [...scene.activeReward.options] } : null,
            battleUnits: [...scene.battleUnits],
            baseHp: scene.baseHp,
            speed: scene.speed,
            lastSpeed: scene.lastSpeed || 1
        };
    }

    function integer(value, min, max = Number.MAX_SAFE_INTEGER) {
        return Number.isSafeInteger(value) && value >= min && value <= max;
    }

    function number(value, min = 0, max = Infinity) {
        return typeof value === 'number' && Number.isFinite(value) && value >= min && value <= max;
    }

    function requireValid(ok, message) {
        if (!ok) throw new Error('Invalid VNext save: ' + message);
    }

    function restore(data, World) {
        requireValid(data && data.version === VERSION, 'version');
        requireValid(integer(data.savedAt, 0), 'timestamp');
        requireValid(data.model && typeof data.model === 'object', 'model');
        const world = World.restore(data.world);
        const { game, grid, tiles } = data.model;
        requireValid(integer(game, 1) && integer(grid, 1) &&
            world.has(game) && world.has(grid) &&
            world.entity(game).parent === null && world.entity(grid).parent === game, 'game / grid');
        requireValid(world.get(grid, 'Grid')?.width === 5 &&
            world.get(grid, 'Grid')?.height === 5, 'grid dimensions');
        requireValid(Array.isArray(tiles) && tiles.length === 25 &&
            new Set(tiles).size === 25, 'tile ids');
        tiles.forEach((id, i) => {
            requireValid(integer(id, 1) && world.has(id) &&
                world.entity(id).parent === grid &&
                world.get(id, 'Tile')?.index === i &&
                typeof world.get(id, 'Watched')?.active === 'boolean', 'tile');
        });
        const resources = world.get(game, 'Resources');
        requireValid(resources && ['energy', 'matter', 'components'].every(id =>
            number(resources[id])) &&
            (resources.data === undefined || number(resources.data)), 'resources');
        const hand = world.get(game, 'BuildingHand');
        requireValid(hand && Array.isArray(hand.cards) &&
            hand.cards.every(card => rewardTypes().includes(card)), 'building hand');

        const occupied = new Set();
        for (const id of world.query('Building', 'GridSlot')) {
            const slot = world.get(id, 'GridSlot').index;
            requireValid(integer(slot, 0, 24) && !occupied.has(slot) &&
                typeof world.get(id, 'Building').type === 'string', 'building');
            occupied.add(slot);
        }

        const attention = data.attention;
        requireValid(attention && integer(attention.x, 0, 4) &&
            integer(attention.y, 0, 4) && integer(attention.patternIndex, 0, 3) &&
            (attention.level === undefined || integer(attention.level, 0, 3)), 'attention');
        const waveClock = data.waveClock;
        requireValid(waveClock && integer(waveClock.number, 0) &&
            number(waveClock.elapsedMs) && integer(waveClock.seed, 0, 0xffffffff), 'wave clock');
        requireValid(number(data.baseHp, Number.EPSILON, 100) &&
            SPEEDS.includes(data.speed) && SPEEDS.includes(data.lastSpeed) &&
            data.lastSpeed > 0, 'base / speed');

        requireValid(Array.isArray(data.battleUnits) &&
            new Set(data.battleUnits).size === data.battleUnits.length, 'battle units');
        for (const id of data.battleUnits) {
            requireValid(integer(id, 1) && world.has(id) &&
                ['Position', 'Health', 'Faction', 'Combat', 'Movement', 'PreviewUnit'].every(kind =>
                    world.hasComponent(id, kind)), 'battle unit component');
        }
        requireValid(world.query('PreviewUnit').length === data.battleUnits.length,
            'battle unit ownership');
        requireValid(Array.isArray(data.waveMembers), 'wave membership');
        const waveMembers = new Map();
        for (const pair of data.waveMembers) {
            requireValid(Array.isArray(pair) && pair.length === 2 &&
                integer(pair[0], 1, waveClock.number) && !waveMembers.has(pair[0]) &&
                Array.isArray(pair[1]) && pair[1].every(id =>
                    data.battleUnits.includes(id) && world.get(id, 'Faction').side === 'enemy'),
            'wave membership');
            waveMembers.set(pair[0], [...pair[1]]);
        }

        function validatedReward(reward) {
            requireValid(reward && integer(reward.number, 1, waveClock.number) &&
                Array.isArray(reward.options) && reward.options.length === 3 &&
                new Set(reward.options).size === 3 &&
                reward.options.every(type => rewardTypes().includes(type)), 'reward');
            return { number: reward.number, options: [...reward.options] };
        }
        requireValid(Array.isArray(data.rewardQueue), 'reward queue');
        const rewardQueue = data.rewardQueue.map(validatedReward);
        const activeReward = data.activeReward === null ? null : validatedReward(data.activeReward);

        return {
            model: { world, game, grid, tiles: [...tiles] },
            attention: { x: attention.x, y: attention.y },
            patternIndex: attention.patternIndex,
            visionLevel: attention.level ?? 0,
            waveClock: { number: waveClock.number, elapsedMs: waveClock.elapsedMs, seed: waveClock.seed },
            waveMembers,
            rewardQueue,
            activeReward,
            battleUnits: [...data.battleUnits],
            baseHp: data.baseHp,
            speed: data.speed,
            lastSpeed: data.lastSpeed
        };
    }

    function worldClass() {
        return root.OverseerECS?.World ||
            (typeof require === 'function' ? require('./World.js').World : null);
    }

    // Validate *before* enabling Continue: incompatible or malformed saves never load.
    function read(storage = storageOrNull()) {
        try {
            const raw = storage?.getItem(KEY);
            if (!raw) return null;
            const parsed = JSON.parse(raw);
            restore(parsed, worldClass());
            return parsed;
        } catch (_) {
            return null;
        }
    }

    function write(scene, storage = storageOrNull(), now = Date.now()) {
        try {
            if (!storage || scene.baseHp <= 0 || !scene.battleUnits) return false;
            storage.setItem(KEY, JSON.stringify(capture(scene, now)));
            return true;
        } catch (_) {
            return false; // Quota/security failures must not destroy the previous save.
        }
    }

    function clear(storage = storageOrNull()) {
        try {
            if (!storage) return false;
            storage.removeItem(KEY);
            return true;
        } catch (_) {
            return false;
        }
    }

    const api = { KEY, VERSION, AUTOSAVE_MS, capture, restore, read, write, clear };
    root.OverseerVNextSave = api;
    if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(globalThis);

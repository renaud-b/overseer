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
        const artifacts = root.OverseerVNextArtifacts ||
            (typeof require === 'function' ? require('./VNextArtifacts.js') : null);
        return [...(cards?.REWARD_CARDS || cards?.STARTER_CARDS || []),
            ...(technologies?.TYPES || []).map(type => `tech:${type}`),
            ...(artifacts?.IDS || []).map(id => `artifact:${id}`)];
    }

    function storageOrNull(storage) {
        if (storage !== undefined) return storage;
        try { return root.localStorage || null; } catch (_) { return null; }
    }

    function capture(scene, savedAt = Date.now()) {
        const copyReward = reward => reward ? JSON.parse(JSON.stringify(reward)) : null;
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
            rewardQueue: scene.rewardQueue.map(copyReward),
            activeReward: copyReward(scene.activeReward),
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
        const payoutState=world.get(game,'WaveShardRewards');
        requireValid(!payoutState || (Array.isArray(payoutState.claimed) &&
            new Set(payoutState.claimed).size===payoutState.claimed.length &&
            payoutState.claimed.every(wave=>integer(wave,1,data.waveClock?.number))), 'wave shard payouts');
        const resources = world.get(game, 'Resources');
        requireValid(resources && ['energy', 'matter', 'components'].every(id =>
            number(resources[id])) &&
            (resources.data === undefined || number(resources.data)), 'resources');
        const artifacts = root.OverseerVNextArtifacts ||
            (typeof require === 'function' ? require('./VNextArtifacts.js') : null);
        // Optional run-scoped meta-progression snapshot. Fractional remainders
        // are simulation data and must survive Continue without rounding.
        const progression = world.get(game,'ProductionTalents');
        if (progression) {
            const validIds=['production_extraction','production_components','production_efficiency','production_automation'];
            requireValid(Array.isArray(progression.ids) &&
                new Set(progression.ids).size===progression.ids.length &&
                progression.ids.every(id=>validIds.includes(id)) &&
                progression.fractions && typeof progression.fractions==='object' &&
                !Array.isArray(progression.fractions), 'production talents');
            for (const [entityId,entry] of Object.entries(progression.fractions)) {
                requireValid(/^\d+$/.test(entityId) && world.has(Number(entityId)) &&
                    world.hasComponent(Number(entityId),'Building') &&
                    entry && typeof entry==='object' &&
                    ['inputs','outputs'].every(kind => entry[kind] &&
                        typeof entry[kind]==='object' && !Array.isArray(entry[kind]) &&
                        Object.entries(entry[kind]).every(([key,value]) =>
                            ['energy','matter','components','data'].includes(key) &&
                            number(value,0,1) && value < 1)), 'production fractions');
            }
        }
        const artifactCollection = world.get(game, 'ArtifactCollection');
        requireValid(!artifactCollection || artifacts.valid(artifactCollection.ids), 'artifact collection');
        const effectRules = root.OverseerVNextArtifactEffects ||
            (typeof require === 'function' ? require('./VNextArtifactEffects.js') : null);
        const effectState = world.get(game, 'ArtifactEffects');
        requireValid(!effectState || effectRules.valid(effectState), 'artifact effects');
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

        // Optional new per-building repair timers: legacy saves need no migration.
        for(const id of world.query('MaintenanceCycle')) {
            const status=world.get(id,'MaintenanceCycle');
            requireValid(world.get(id,'Building')?.type==='maintenance' &&
                number(status.elapsedMs,0,30000) && status.elapsedMs<30000,
                'maintenance cycle');
        }

        // Older saves may carry obsolete heat state. It no longer changes gameplay.
        for (const id of world.query('BuildingHeat')) {
            const heat = world.get(id, 'BuildingHeat');
            requireValid(world.hasComponent(id, 'Building') &&
                number(heat.percent, 0, 100) && number(heat.elapsedMs, 0, 2000) &&
                heat.elapsedMs < 2000, 'building heat');
            world.remove(id, 'BuildingHeat');
        }
        const perception = world.get(game, 'PerceptionPulse');
        requireValid(!perception || (number(perception.phaseMs, 0, 5000) &&
            perception.phaseMs < 5000), 'perception pulse');

        const attention = data.attention;
        requireValid(attention && integer(attention.x, 0, 4) &&
            integer(attention.y, 0, 4) && integer(attention.patternIndex, 0, 3) &&
            (attention.level === undefined || integer(attention.level, 0, 3)), 'attention');
        const waveClock = data.waveClock;
        requireValid(waveClock && integer(waveClock.number, 0) &&
            number(waveClock.elapsedMs) && integer(waveClock.seed, 0, 0xffffffff), 'wave clock');
        const visionTalents=world.get(game,'VisionTalents');
        requireValid(!visionTalents || typeof visionTalents.residual==='boolean', 'vision talents');
        const defense=world.get(game,'DefenseTalents');
        requireValid(!defense || (typeof defense.reinforced==='boolean' &&
            typeof defense.extraGuard==='boolean' &&
            (defense.extraMarksman===undefined||typeof defense.extraMarksman==='boolean') &&
            (defense.extraMedic===undefined||typeof defense.extraMedic==='boolean') &&
            !(defense.extraMarksman&&defense.extraMedic)), 'defense talents');
        requireValid(number(data.baseHp, Number.EPSILON, defense?.reinforced ? 120 : 100) &&
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
        // Refund provenance is saveable ECS data, never a renderer-derived cost.
        for (const id of world.query('ManufacturedCost')) {
            const spent = world.get(id, 'ManufacturedCost')?.resources;
            requireValid(data.battleUnits.includes(id) &&
                world.get(id, 'Faction')?.side === 'player' &&
                spent && typeof spent === 'object' && !Array.isArray(spent) &&
                Object.keys(spent).length > 0 &&
                Object.entries(spent).every(([key,amount]) =>
                    ['energy','matter','components','data'].includes(key) &&
                    number(amount, 0, 100000)), 'manufactured cost');
        }
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

        function validatedReward(reward, isActive = false) {
            requireValid(reward && integer(reward.number,1,waveClock.number) &&
                Array.isArray(reward.options) && reward.options.length>=1 && reward.options.length<=3 &&
                new Set(reward.options).size===reward.options.length &&
                reward.options.every(type=>rewardTypes().includes(type)),'reward');
            if(!reward.stages) {
                requireValid(reward.options.length===3 && !reward.options.some(type=>type.startsWith('artifact:')), 'legacy reward');
                return {number:reward.number,options:[...reward.options]}; // Older saves.
            }
            requireValid(Array.isArray(reward.stages) && reward.stages.length>=1 && reward.stages.length<=3 &&
                integer(reward.index,0,reward.stages.length-1),'reward journey');
            const seen=[];
            const stages=reward.stages.map(stage=>{
                requireValid(stage && ['building','technology','artifact'].includes(stage.kind) && !seen.includes(stage.kind) &&
                    Array.isArray(stage.options) && stage.options.length>=1 &&
                    stage.options.length<=(stage.kind==='artifact'?3:3) &&
                    (stage.kind==='artifact'||stage.options.length===3) &&
                    new Set(stage.options).size===stage.options.length &&
                    stage.options.every(type=>rewardTypes().includes(type) &&
                        (stage.kind==='technology')===type.startsWith('tech:') &&
                        (stage.kind==='artifact')===type.startsWith('artifact:')),'reward stage');
                seen.push(stage.kind);
                return {kind:stage.kind,options:[...stage.options]};
            });
            requireValid(stages.every((stage,i)=>i===0||['building','technology','artifact'].indexOf(stages[i-1].kind)<
                ['building','technology','artifact'].indexOf(stage.kind)),'reward order');
            requireValid(stages[reward.index].options.length===reward.options.length &&
                stages[reward.index].options.every((type,i)=>type===reward.options[i]),'reward current stage');
            const pending = reward.pendingArtifact;
            if (pending !== undefined) {
                requireValid(isActive && stages[reward.index].kind === 'artifact' &&
                    artifactCollection?.ids.length === artifacts.CAPACITY &&
                    typeof pending === 'string' &&
                    reward.options.includes('artifact:' + pending) &&
                    !artifactCollection.ids.includes(pending) &&
                    artifacts.get(pending) !== null, 'pending artifact replacement');
            }
            return {number:reward.number,stages,index:reward.index,options:[...reward.options],
                ...(pending === undefined ? {} : {pendingArtifact:pending})};
        }
        requireValid(Array.isArray(data.rewardQueue), 'reward queue');
        const rewardQueue = data.rewardQueue.map(validatedReward);
        const activeReward = data.activeReward === null ? null : validatedReward(data.activeReward,true);

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

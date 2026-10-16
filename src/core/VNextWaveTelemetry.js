(function (root) {
    'use strict';

    // Data-only diagnostic state: never decides spawns, rewards or damage.
    const MAX_RECORDS = 80;
    const KEYS = ['energy', 'matter', 'components', 'data'];
    function resources(model) {
        const balance = model.world.get(model.game, 'Resources') || {};
        return Object.fromEntries(KEYS.map(key => [key, balance[key] ?? 0]));
    }
    function allies(model) {
        const world = model.world;
        return world.query('Faction', 'Health').filter(id =>
            world.get(id, 'Faction').side === 'player' && world.get(id, 'Health').hp > 0).length;
    }
    function initialize(model) {
        if (!model.world.hasComponent(model.game, 'WaveTelemetry')) {
            model.world.set(model.game, 'WaveTelemetry', { records: [], seenDeaths: [] });
        }
        return model.world.get(model.game, 'WaveTelemetry');
    }
    function active(model, number) {
        return initialize(model).records.find(row => row.number === number && row.status === 'active');
    }
    function trim(state) {
        // Keep active waves even if waves overlap for a long time.
        while (state.records.length > MAX_RECORDS) {
            const index = state.records.findIndex(row => row.status !== 'active');
            if (index < 0) break;
            state.records.splice(index, 1);
        }
    }
    function begin(model, wave, clockMs, baseHp, visionLevel, spawned) {
        const state = initialize(model);
        if (state.records.some(row => row.number === wave.number)) return false;
        state.records.push({
            number: wave.number, status: 'active',
            composition: wave.enemies.map(e => ({ type: e.type, count: e.count })),
            spawned, killed: 0, allyDeathsDuring: 0, baseDamage: 0,
            startMs: clockMs, endMs: null,
            baseHpStart: baseHp, baseHpEnd: null,
            alliesStart: allies(model), alliesEnd: null,
            visionStart: visionLevel, visionEnd: null,
            resourcesStart: resources(model), resourcesEnd: null
        });
        trim(state);
        return true;
    }
    function baseHit(model, attacker, amount) {
        const wave = model.world.get(attacker, 'WaveMember')?.number;
        const row = wave === undefined ? null : active(model, wave);
        if (row && Number.isFinite(amount) && amount > 0) row.baseDamage += amount;
    }
    function casualties(model, unitIds) {
        const state = initialize(model), world = model.world;
        const seen = new Set(state.seenDeaths);
        for (const id of unitIds) {
            if (!world.has(id) || world.get(id, 'Health')?.hp > 0 || seen.has(id)) continue;
            seen.add(id);
            const faction = world.get(id, 'Faction')?.side;
            if (faction === 'enemy') {
                const wave = world.get(id, 'WaveMember')?.number;
                const row = wave === undefined ? null : active(model, wave);
                if (row) row.killed++;
            } else if (faction === 'player') {
                // A death during two overlapping waves appears in both intervals.
                // This deliberately does NOT claim either wave caused the loss.
                for (const row of state.records) {
                    if (row.status === 'active') row.allyDeathsDuring++;
                }
            }
        }
        // IDs are needed only until dead units are reclaimed from the ECS.
        state.seenDeaths = [...seen].filter(id => world.has(id));
    }
    function end(model, number, clockMs, baseHp, visionLevel, status = 'cleared') {
        const row = active(model, number);
        if (!row) return null; // Legacy saves may have ongoing, uninstrumented waves.
        row.status = status;
        row.endMs = clockMs;
        row.baseHpEnd = baseHp;
        row.alliesEnd = allies(model);
        row.visionEnd = visionLevel;
        row.resourcesEnd = resources(model);
        trim(initialize(model));
        return row;
    }
    function endActive(model, clockMs, baseHp, visionLevel, status = 'defeat') {
        for (const row of initialize(model).records.filter(row => row.status === 'active')) {
            end(model, row.number, clockMs, baseHp, visionLevel, status);
        }
    }
    function report(model) {
        return initialize(model).records.map(row => ({
            wave: row.number,
            status: row.status,
            enemies: row.composition.map(e => `${e.count} ${e.type}`).join(', '),
            spawned: row.spawned,
            killed: row.killed,
            allyDeathsDuring: row.allyDeathsDuring,
            coreDamage: row.baseDamage,
            coreHpStart: row.baseHpStart,
            coreHpEnd: row.baseHpEnd,
            alliesStart: row.alliesStart,
            alliesEnd: row.alliesEnd,
            visionStart: row.visionStart,
            visionEnd: row.visionEnd,
            dataDelta: row.resourcesEnd ? row.resourcesEnd.data - row.resourcesStart.data : null,
            durationSeconds: row.endMs === null ? null : +(Math.max(0, row.endMs - row.startMs) / 1000).toFixed(1)
        }));
    }
    const api = { MAX_RECORDS, initialize, begin, baseHit, casualties, end, endActive, report };
    root.OverseerVNextWaveTelemetry = api;
    if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(globalThis);

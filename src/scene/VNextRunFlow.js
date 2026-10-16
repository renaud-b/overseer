// VNext run lifecycle, ECS entity spawning and rewards.
// Methods preserve the VNextScene contract while simulation state remains ECS-owned.
(function (root) {
    'use strict';
    const methods = {
    spawnEnemyUnit(type, index, count, waveNumber = null) {
        const config = this.cache.json.get('vnextLegacyStats').enemies.find(unit => unit.id === type);
        if (!config) return;
        const id = this.world.create(this.model.game);
        // Fan out spawn positions without altering stats or attack behavior.
        const x = 800 + (index % 3) * 14, y = 100 + ((index * 47) % 400);
        this.world.set(id, 'Position', { x, y });
        this.world.set(id, 'Health', { hp: config.hp, maxHp: config.hp });
        this.world.set(id, 'Faction', { side: 'enemy' });
        this.world.set(id, 'Movement', { speed: config.speed });
        this.world.set(id, 'Combat', {
            damage: config.attack_damage, range: config.attack_range,
            attackType: config.attack_type, cooldownMs: config.attack_speed * 1000,
            elapsedMs: 0, detectionRadius: 220, behavior: config.behavior || null
        });
        this.world.set(id, 'PreviewUnit', { type });
        this.battleUnits.push(id);
        if (waveNumber !== null) {
            this.world.set(id, 'WaveMember', { number: waveNumber });
            this.waveMembers.get(waveNumber).push(id);
        }
    },

    triggerWave(wave) {
        this.waveMembers.set(wave.number, []);
        for (const group of wave.enemies) {
            for (let i = 0; i < group.count; i++) this.spawnEnemyUnit(group.type, i, group.count, wave.number);
        }
        for (const event of OverseerVNextArtifactEffects.startWave(
            this.model, wave.number, this.waveClock.seed, this.baseHp, OverseerVNextEconomy)) {
            this.spawnFriendlyUnit(event.unitType);
        }
        OverseerVNextWaveTelemetry.begin(this.model, wave, this.waveClock.elapsedMs,
            this.baseHp, this.visionRules.level, this.waveMembers.get(wave.number).length);
        // Preview markers slide forward; the wave plan itself remains deterministic.
        this.previewWaves = OverseerVNextWaves.preview(8, this.waveClock.seed, this.waveClock.number);
        this.buildUi();
        this.saveCurrentGame();
    },

    rewardOptions(number, kind = 'building') {
        return OverseerVNextRewards.options(number,this.waveClock.seed,kind,
            OverseerVNextCards.REWARD_CARDS,OverseerVNextTechnologies.TYPES);
    },

    rewardForWave(number) {
        return OverseerVNextRewards.create(number,this.waveClock.seed,
            OverseerVNextCards.REWARD_CARDS,OverseerVNextTechnologies.TYPES,
            OverseerVNextArtifacts.offerable(this.model),OverseerVNextArtifacts.list(this.model));
    },

    reconcileArtifactRewards() {
        // Queued waves may have chosen their options before an earlier award was picked.
        // A full inventory still offers a replacement, never an automatic discard.
        if (this.activeReward?.pendingArtifact) return;
        while (this.activeReward) {
            const stage = OverseerVNextRewards.current(this.activeReward);
            if (stage.kind !== 'artifact') break;
            const available = OverseerVNextArtifacts.offerable(this.model);
            if (!available.length) {
                if (!OverseerVNextRewards.advance(this.activeReward))
                    this.activeReward = this.rewardQueue.shift() || null;
                continue;
            }
            const fallback = OverseerVNextRewards.options(this.activeReward.number,
                this.waveClock.seed, 'artifact', [], [], available);
            const selections = [...new Set([...stage.options.filter(type =>
                available.includes(type.slice(9))), ...fallback])].slice(0, 3);
            stage.options = selections;
            this.activeReward.options = [...selections];
            break;
        }
    },

    waveReport() {
        return OverseerVNextWaveTelemetry.report(this.model);
    },

    checkWaveClears() {
        OverseerVNextWaveTelemetry.casualties(this.model, this.battleUnits);
        let changed = false;
        for (const [number, members] of this.waveMembers) {
            if (!members.length) continue;
            if (!members.every(id => !this.world.has(id) || this.world.get(id, 'Health').hp <= 0)) continue;
            OverseerVNextWaveTelemetry.end(this.model, number, this.waveClock.elapsedMs,
                this.baseHp, this.visionRules.level);
            this.waveMembers.delete(number);
            const recovered = OverseerVNextArtifactEffects.clearWave(this.model, number, this.baseHp);
            this.baseHp = recovered.hp;
            if (recovered.evolved && this.world.has(recovered.evolved)) {
                const pos=this.world.get(recovered.evolved,'Position');
                if(pos)this.actionEffects.heal(pos,pos,0x69d9a0);
            }
            if (recovered.healed) this.actionEffects.heal(
                {x:65,y:300}, {x:65,y:300}, 0x69d9a0);
            const payout=OverseerVNextMemoryShards.grant(this.model,number,this.saveStorage());
            if(payout)this.shardLabel?.setText(`ÉCLATS DE MÉMOIRE  ${payout.balance}`);
            this.rewardQueue.push(this.rewardForWave(number));
            changed = true;
        }
        if (!this.activeReward && this.rewardQueue.length) {
            this.activeReward = this.rewardQueue.shift();
            this.reconcileArtifactRewards();
            this.buildUi();
            changed = true;
        }
        if (changed) this.saveCurrentGame();
    },

    cleanupDeadUnits() {
        const dead = new Set(this.battleUnits.filter(id =>
            !this.world.has(id) || this.world.get(id, 'Health')?.hp <= 0));
        if (!dead.size) return false;
        OverseerVNextArtifactEffects.recycle(this.model, [...dead]);
        OverseerVNextArtifactEffects.propagate(this.model, [...dead]);
        OverseerVNextArtifactEffects.contamination(this.model,[...dead]);
        for(const transfer of OverseerVNextArtifactEffects.vital(this.model,[...dead])) {
            this.actionEffects.heal(transfer.from,transfer.to,0x69d9a0);
        }
        this.battleUnits = this.battleUnits.filter(id => !dead.has(id));
        for (const id of dead) {
            if (this.world.has(id)) this.world.destroy(id);
        }
        for (const [number, members] of this.waveMembers) {
            const alive = members.filter(id => !dead.has(id));
            if (alive.length) this.waveMembers.set(number, alive);
            else this.waveMembers.delete(number);
        }
        this.updateResourceHud(); // Refunds from destroyed units are immediately visible.
        this.saveCurrentGame();
        return true;
    },

    finishRewardStage() {
        if (!OverseerVNextRewards.advance(this.activeReward))
            this.activeReward = this.rewardQueue.shift() || null;
        this.reconcileArtifactRewards();
        this.buildUi();
        this.saveCurrentGame();
    },

    chooseReward(type) {
        if (!this.activeReward || this.activeReward.pendingArtifact ||
            !this.activeReward.options.includes(type)) return false;
        const current=OverseerVNextRewards.current(this.activeReward);
        if (current.kind==='building' && (type.startsWith('tech:') || type.startsWith('artifact:')) ||
            current.kind==='technology' && !type.startsWith('tech:') ||
            current.kind==='artifact' && !type.startsWith('artifact:')) return false;
        if (type.startsWith('artifact:')) {
            const id = type.slice(9);
            if (!OverseerVNextArtifacts.hasCapacity(this.model)) {
                // No changes until the player explicitly chooses an old slot or declines.
                this.activeReward.pendingArtifact = id;
                this.buildUi();
                this.saveCurrentGame();
                return true;
            }
            if (!OverseerVNextArtifacts.add(this.model, id)) return false;
        } else if (type.startsWith('tech:')) {
            const technology = type.slice(5);
            if (!OverseerVNextTechnologies.TYPES.includes(technology)) return false;
            OverseerVNextTechnologies.inventory(this.model).items.push(technology);
        } else if (!OverseerVNextCards.grant(this.model, type)) return false;
        this.finishRewardStage();
        return true;
    },

    replaceArtifactReward(index) {
        const reward = this.activeReward, incoming = reward?.pendingArtifact;
        if (!incoming || OverseerVNextRewards.current(reward).kind !== 'artifact' ||
            !OverseerVNextArtifacts.replace(this.model,index,incoming)) return false;
        delete reward.pendingArtifact;
        this.finishRewardStage();
        return true;
    },

    declineArtifactReward() {
        const reward = this.activeReward;
        if (!reward?.pendingArtifact ||
            OverseerVNextRewards.current(reward).kind !== 'artifact') return false;
        delete reward.pendingArtifact;
        this.finishRewardStage();
        return true;
    },

    resetBattle() {
        this.hitEffects.clear();
        this.actionEffects.clear();
        (this.battleUnits || []).forEach(id => { if (this.world.has(id)) this.world.destroy(id); });
        this.battleUnits = [];
        this.baseHp = 100;
        const stats = this.cache.json.get('vnextLegacyStats');
        const lineup = [
            ['player', 'unit_guard', 200, 185], ['player', 'unit_sniper', 260, 305],
            ['player', 'unit_dronoid', 230, 425]
        ];
        lineup.forEach(([side, type, x, y]) => {
            const config = (side === 'player' ? stats.units : stats.enemies).find(d => d.id === type);
            if (!config) return;
            const id = this.world.create(this.model.game);
            this.world.set(id, 'Position', { x, y });
            this.world.set(id, 'Health', { hp: config.hp, maxHp: config.hp });
            this.world.set(id, 'Faction', { side });
            this.world.set(id, 'Movement', { speed: config.speed });
            this.world.set(id, 'Combat', {
                damage: config.attack_damage, range: config.attack_range,
                attackType: config.attack_type, cooldownMs: config.attack_speed * 1000,
                elapsedMs: 0, detectionRadius: side === 'player' ? 400 : 220,
                behavior: config.behavior || null
            });
            this.world.set(id, 'PreviewUnit', { type });
            this.battleUnits.push(id);
        });
        // No rendering here: create() calls resetBattle() before buildUi().
        // On a reused Phaser Scene, the previous Text/Graphics were destroyed
        // during shutdown; buildUi() recreates the panel and paints it safely.
    },

    spawnFriendlyUnit(type, productionEvent = null) {
        const stats = this.cache.json.get('vnextLegacyStats');
        const config = stats.units.find(unit => unit.id === type);
        if (!config) return;
        const id = this.world.create(this.model.game);
        this.world.set(id, 'Position', { x: 195, y: 290 });
        this.world.set(id, 'Health', { hp: config.hp, maxHp: config.hp });
        this.world.set(id, 'Faction', { side: 'player' });
        this.world.set(id, 'Movement', { speed: config.speed });
        this.world.set(id, 'Combat', {
            damage: config.attack_damage, range: type === 'unit_dronoid' ? 65 : config.attack_range,
            attackType: config.attack_type, cooldownMs: config.attack_speed * 1000,
            elapsedMs: 0, detectionRadius: 400, behavior: type === 'unit_dronoid' ? 'healer' : config.behavior || null
        });
        this.world.set(id, 'PreviewUnit', { type });
        // Manufacturing provenance lives on the unit, not in the renderer.
        // No cost for spontaneous units, reinforcements or the starter lineup.
        if (productionEvent?.type === 'unit-produced' &&
            productionEvent.unitType === type && productionEvent.spent) {
            this.world.set(id, 'ManufacturedCost', {
                resources: { ...productionEvent.spent }
            });
        }
        OverseerVNextArtifactEffects.manufactured(this.model,id,productionEvent);
        this.battleUnits.push(id);
        return id;
    }
    };
    function install(Scene) { Object.assign(Scene.prototype, methods); }
    const api = Object.freeze({ install });
    root.OverseerVNextRunFlow = api;
    if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(globalThis);

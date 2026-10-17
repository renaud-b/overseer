// Simulation-time orchestration. ECS systems own rules; Phaser only receives display events.
// Preserve ordering: clear rewards before destroying dead ECS units; pause freezes simulation.
(function (root) {
    'use strict';
    function step(scene, time, delta) {
        if (!scene.model || scene.runFinished) return;
        if (scene.baseHp <= 0) { scene.finishRun(); return; }
        // Wall-clock autosave continues when gameplay pauses for a reward.
        scene.autosaveElapsed += Math.max(0, delta);
        if (scene.autosaveElapsed >= OverseerVNextSave.AUTOSAVE_MS) {
            scene.autosaveElapsed %= OverseerVNextSave.AUTOSAVE_MS;
            scene.saveCurrentGame();
        }
        if (scene.speed === 0 || scene.activeReward || scene.optionsModal || scene.pauseMenu || !scene.battleUnits) return;
        const dt = Math.min(delta, 60) * scene.speed;
        for (const wave of OverseerVNextWaves.advance(scene.waveClock, dt)) scene.triggerWave(wave);
        scene.updateWaveTimeline();
        const previousResources = { ...scene.world.get(scene.model.game, 'Resources') };
        const relayMs=OverseerVNextArtifactEffects.relay(scene.model,dt,OverseerVNextEconomy);
        OverseerVNextCooling.step(scene.model,dt);
        const coolingBonuses=OverseerVNextCooling.bonuses(scene.model);
        const economyEvents = OverseerVNextArtifactEffects.production(scene.model, dt, OverseerVNextEconomy,coolingBonuses,relayMs);
        const researchEvents=OverseerVNextTechnologies.step(scene.model,dt,
            OverseerVNextArtifactEffects.focusedBuilding(scene.model,OverseerVNextEconomy),coolingBonuses,relayMs);
        if(researchEvents.length)scene.buildUi();
        for (const event of economyEvents) {
            if (event.type === 'unit-produced') scene.spawnFriendlyUnit(event.unitType, event);
            if (event.type === 'production') scene.showProductionPopup(event);
            if (event.type === 'artifact-network') scene.showNetworkPopup(event);
        }
        const repair=OverseerVNextMaintenance.step(scene.model,dt,scene.baseHp,relayMs);
        scene.baseHp=repair.hp;
        if(repair.healed)scene.actionEffects.heal(
            {x:65,y:300},{x:65,y:300},0x69d9a0);
        const zoneEvents=OverseerVNextZones.step(scene.model,dt);
        for(const event of zoneEvents) scene.actionEffects.heal({x:event.x,y:event.y},{x:event.x,y:event.y},0x69d9a0);
        scene.zoneFrameMs=Math.min(60,Math.max(0,delta));
        scene.noteResourceChanges(previousResources, dt);
        scene.updateProductionPopups(Math.min(60, Math.max(0, delta)));
        scene.updateResourceHud();
        scene.paintBoard();
        for(const hit of OverseerVNextArtifactEffects.corrosionStep(scene.model,dt)) {
            if(scene.world.has(hit.target))
                scene.hitEffects.hit(hit.target,hit.from,hit.to,0x91bb70);
        }
        OverseerVNextArtifactEffects.combatTimers(scene.model,dt);
        const players = scene.battleUnits.filter(id => scene.world.has(id) && scene.world.get(id, 'Faction').side === 'player' && scene.world.get(id, 'Health').hp > 0);
        const enemies = scene.battleUnits.filter(id => scene.world.has(id) && scene.world.get(id, 'Faction').side === 'enemy' && scene.world.get(id, 'Health').hp > 0);
        const pulseBonus=Math.max(0,...OverseerVNextThreats.amplifiers(scene.model).map(id=>coolingBonuses[id]||0));
        // Decay previous designations first, then tag each distant target only
        // when the expanding radar wavefront reaches it.
        OverseerVNextThreats.update(scene.world,enemies,dt);
        OverseerVNextThreats.step(scene.model,dt,1+pulseBonus,enemies);
        const posts = new Map(players.map((id, index) =>
            [id, OverseerCombat.formationPosition(index, players.length)]));
        for (const id of [...players, ...enemies]) {
            if (scene.world.get(id, 'Health').hp <= 0) continue;
            const side = scene.world.get(id, 'Faction').side;
            const events = OverseerCombat.stepUnit(scene.world, id, dt, {
                opponents: side === 'player' ? enemies : players,
                base: side === 'enemy' && scene.baseHp > 0 ? { x: 65, y: 300 } : null,
                patrol: side === 'player' ? posts.get(id) : null,
                allies: side === 'player' ? players : [],
                centralDetection: side === 'player',
                allySpeedMultiplier: OverseerVNextZones.speedMultiplier(scene.model)
            });
            for (const event of events) {
                if (event.type === 'base-attack') {
                    OverseerVNextArtifactEffects.defense(scene.model,event.attacker);
                    const previousHp = scene.baseHp;
                    const result = OverseerVNextArtifactEffects.baseHit(scene.model, previousHp, event.damage);
                    scene.baseHp = result.hp;
                    OverseerVNextWaveTelemetry.baseHit(scene.model, event.attacker, previousHp - scene.baseHp);
                }
                if (event.type === 'attack' && scene.world.has(event.attacker) && scene.world.has(event.target)) {
                    // Snapshot directions at impact time; simulation positions never receive recoil.
                    const attackerPosition = scene.world.get(event.attacker, 'Position');
                    const targetPosition = scene.world.get(event.target, 'Position');
                    const targetStyle = scene.battleUnitStyle(event.target);
                    if (event.ranged) scene.actionEffects.laser(
                        attackerPosition, targetPosition, scene.battleUnitStyle(event.attacker).color);
                    scene.hitEffects.hit(event.target,
                        attackerPosition, targetPosition, targetStyle.color);
                }
                if (event.type === 'heal' && event.amount > 0 &&
                    scene.world.has(event.healer) && scene.world.has(event.target)) {
                    scene.actionEffects.heal(
                        scene.world.get(event.healer, 'Position'),
                        scene.world.get(event.target, 'Position'),
                        scene.battleUnitStyle(event.healer).color);
                }
            }
        }
        if (scene.baseHp <= 0) { scene.finishRun(); return; }
        const ray = OverseerVNextArtifactEffects.laser(scene.model, dt, OverseerVNextThreats.radius(scene.model));
        if (ray) {
            scene.actionEffects.laser(ray.from, ray.to, 0x62e7e1);
            scene.hitEffects.hit(ray.target, ray.from, ray.to, 0x62e7e1);
            for(const arc of ray.chains||[]) {
                scene.actionEffects.laser(arc.from,arc.to,0x62e7e1);
                scene.hitEffects.hit(arc.target,arc.from,arc.to,0x62e7e1);
            }
        }
        const deadAllies = scene.battleUnits.filter(id => scene.world.has(id) &&
            scene.world.get(id, 'Faction').side === 'player' &&
            scene.world.get(id, 'Health').hp <= 0);
        for (const burst of OverseerVNextArtifactEffects.deaths(scene.model, deadAllies)) {
            scene.actionEffects.laser(burst.from, burst.to, 0xff6674);
            scene.hitEffects.hit(burst.target, burst.from, burst.to, 0xff6674);
        }
        OverseerCombat.separateUnits(scene.world, scene.battleUnits);
        // Wall-clock duration makes impacts readable at x1/x3/x5. Pause freezes them.
        scene.hitEffects.update(Math.min(60, Math.max(0, delta)));
        scene.actionEffects.update(Math.min(60, Math.max(0, delta)));
        const expiredSummons=OverseerVNextZones.stepBuffs(scene.model,dt);
        if(expiredSummons.length) {
            const removed=new Set(expiredSummons);
            scene.battleUnits=scene.battleUnits.filter(id=>!removed.has(id));
        }
        // Rewards must be computed before reclaiming dead ECS entities.
        scene.checkWaveClears();
        scene.cleanupDeadUnits();
        scene.paintBattle();
    }
    const api = Object.freeze({ step });
    root.OverseerVNextSimulation = api;
    if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(globalThis);

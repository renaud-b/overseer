
class WaveManager {
    constructor(scene){
        this.scene = scene;
        this.currentWaveId = 0;
        this.waves = {};
        this.waveNumber = 0;
        this.scheduledWaves = [];
        this.selectedWaves  = [];
    }

    update(enemyUnits){
        if(this.scheduledWaves.length === 0){
            this.scheduleNextWaveFlagRealistic();
            return
        }
        while (this.scheduledWaves.length > 0 && this.scene.globalGameTime >= this.scheduledWaves[0].time) {
            const next = this.scheduledWaves.shift();
                this.scene.timeline.addFlag(0, next.composition, next.rewards);
        }


        const waveAlive = {};

        for (let unit of enemyUnits) {
            if (unit.waveId !== undefined) waveAlive[unit.waveId] = (waveAlive[unit.waveId] || 0) + 1;
        }
        for (let [waveIdStr, wave] of Object.entries(this.waves)) {
            if(!waveIdStr || !wave){
                continue
            }
            const waveId = parseInt(waveIdStr);
            const stillAlive = waveAlive[waveId] || 0;
            if (wave.alive > 0 && stillAlive === 0) {
                wave.alive = 0;
                this.handleWaveVictory(waveId);
            }
        }
    }

    scheduleNextWaveFlagRealistic(forcedDelay = undefined) {
        const delay = Phaser.Math.Between(25000, 40000);
        const when = this.scene.globalGameTime + (forcedDelay !== undefined ? forcedDelay : delay);

        const waveId = this.currentWaveId++;
        let composition, rewards;
        if(this.selectedWaves.length > 0){
            const selectedWave = this.selectedWaves.shift();
            composition = selectedWave.composition
            rewards = selectedWave.rewards
        } else {
            composition = this.generateWaveComposition(this.waveNumber);
            rewards = this.generateWaveRewards(this.waveNumber);
        }


        // Préparer une entrée pour cette vague
        this.waves[waveId] = { alive: -1, composition, rewards };

        const owned = this.scene.artifactManager.artifacts.map(a => a.id);
        const allArtifacts = this.scene.gameData.artifacts;
        const available = allArtifacts.filter(a => !owned.includes(a.id));


        const chance = this.scene.isTalentUnlocked('artifact_scanner') ? 0.4 : 0.2; // +20% si débloqué
        const selected = Math.random()
        if (available.length > 0 && selected < chance) {
            const options = Phaser.Utils.Array.Shuffle(available).slice(0, 3);
            rewards.artifactReward = options;
        }

        this.scheduledWaves.push({ time: when, waveId });
        this.scene.timeline.addFlag(0, composition, rewards, waveId);
    }



    generateWaveComposition(waveNumber) {
        const composition = {};
        const levelChances = [];

        // Définition dynamique des chances par niveau
        // Format : [niveau, chanceEnPourcent]
        if (waveNumber < 5) {
            levelChances.push([1, 100]);
        } else if (waveNumber < 10) {
            levelChances.push([1, 85], [2, 15]);
        } else if (waveNumber < 15) {
            levelChances.push([1, 65], [2, 25], [3, 10]);
        } else {
            levelChances.push([1, 45], [2, 30], [3, 20], [4, 5]);
        }

        // Création du tableau de choix pondéré
        const weighted = [];
        levelChances.forEach(([lvl, chance]) => {
            for (let i = 0; i < chance; i++) {
                weighted.push(lvl);
            }
        });

        const baseCount = 2 + Math.floor(waveNumber * 1.2); // vague 9 ≈ 12 ennemis
        for (let i = 0; i < baseCount; i++) {
            const lvl = Phaser.Utils.Array.GetRandom(weighted);
            const pool = this.scene.gameData.enemies.filter(e => e.level === lvl);
            const enemy = Phaser.Utils.Array.GetRandom(pool);
            if (enemy) {
                composition[enemy.id] = (composition[enemy.id] || 0) + 1;
            }
        }

        return composition;
    }



    handleWaveVictory(waveId) {
        const rewards = this.waves[waveId]?.rewards || this.generateWaveRewards(this.waveNumber);
        this.scene.talentManager?.applyOnWaveVictory();
        this.scene.hud.showRewardPopupWithChoices(rewards, (restoreTimeScale) => {
            if (this.waveNumber %5 === 0) {
                this.proposeWaveDraft(restoreTimeScale);
            } else {
                restoreTimeScale()
            }

        });
    }

    proposeWaveDraft(then = () => {}) {
        const generateComposition = (levelBias) => {
            const originalLevels = [[1, 80], [2, 20], [3, 0], [4, 0]];
            const harderLevels = [[1, 40], [2, 40], [3, 20], [4, 0]];
            const hardestLevels = [[2, 30], [3, 50], [4, 20]];

            const chances = levelBias === 'easy' ? originalLevels
                : levelBias === 'medium' ? harderLevels
                    : hardestLevels;

            const weighted = [];
            chances.forEach(([lvl, chance]) => {
                for (let i = 0; i < chance; i++) weighted.push(lvl);
            });

            const composition = {};
            const baseCount = Phaser.Math.Between(3, 6);
            for (let i = 0; i < baseCount; i++) {
                const lvl = Phaser.Utils.Array.GetRandom(weighted);
                const pool = this.scene.gameData.enemies.filter(e => e.level === lvl);
                const enemy = Phaser.Utils.Array.GetRandom(pool);
                if (enemy) {
                    composition[enemy.id] = (composition[enemy.id] || 0) + 1;
                }
            }
            return composition;
        };
        const generateCompositionAndReward = (levelBias, difficultyFactor) => {
            const composition = generateComposition(levelBias);
            const rewards = this.generateWaveRewards(this.waveNumber, 2, difficultyFactor);
            return { composition, rewards };
        };


        const choices = [
            {
                label: this.scene.translate('wave_choice_easy') || 'Facile',
                waves: [
                    generateCompositionAndReward('easy', 0.8),
                    generateCompositionAndReward('easy', 0.8)
                ]
            },
            {
                label: this.scene.translate('wave_choice_medium') || 'Moyen',
                waves: [
                    generateCompositionAndReward('medium', 1.0),
                    generateCompositionAndReward('medium', 1.0)
                ]
            },
            {
                label: this.scene.translate('wave_choice_hard') || 'Difficile',
                waves: [
                    generateCompositionAndReward('hard', 1.3),
                    generateCompositionAndReward('hard', 1.3)
                ]
            }
        ];
        this.scene.hud.showWaveDraftPopup(choices, then);
    }



    generateWaveRewards(waveNumber = 1, maxPacks = 2, difficultyFactor = 1.0) {
        const packs = [];

        const resourceIds = this.scene.gameData.resources.map(r => r.id);
        const buildingData = this.scene.gameData.buildings.filter(b => !b.unlimited);

        const getLevelWeights = (waveNumber) => {
            if (waveNumber <= 3) return [[1, 100]];
            if (waveNumber <= 6) return [[1, 80], [2, 20]];
            if (waveNumber <= 10) return [[1, 60], [2, 30], [3, 10]];
            if (waveNumber <= 14) return [[1, 30], [2, 50], [3, 20]];
            return [[1, 10], [2, 40], [3, 50]];
        };

        const buildWeightedLevelPool = () => {
            const weights = getLevelWeights(waveNumber);
            const result = [];
            weights.forEach(([lvl, count]) => {
                for (let i = 0; i < count; i++) result.push(lvl);
            });
            return result;
        };

        const weightedLevels = buildWeightedLevelPool();

        // Ajustement : bonus de talent
        if (this.scene.isTalentUnlocked('wave_reward_boost')) {
            maxPacks += 1;
        }

        const numPacks = Phaser.Math.Between(1, Math.ceil(maxPacks * difficultyFactor));

        for (let i = 0; i < numPacks; i++) {
            const type = Phaser.Math.Between(0, 1) === 0 ? 'resource' : 'building';

            if (type === 'resource') {
                const options = Phaser.Utils.Array.Shuffle(resourceIds).slice(0, 3);
                const base = 4;
                const scaling = 2;
                const quantity = Phaser.Math.Between(
                    base + waveNumber * scaling,
                    base + waveNumber * scaling * 2
                ) * difficultyFactor;

                packs.push({
                    type: 'resource',
                    options,
                    quantity
                });
            } else {
                const selectedLevel = Phaser.Utils.Array.GetRandom(weightedLevels);
                const candidates = buildingData.filter(b => b.level === selectedLevel);
                const options = Phaser.Utils.Array.Shuffle(candidates.map(b => b.id)).slice(0, 3);

                if (options.length > 0) {
                    packs.push({
                        type: 'building',
                        options
                    });
                }
            }
        }

        const rewards = { packs };

        // 💠 Artefacts (avec filtre anti-doublon)
        const owned = this.scene.artifactManager.artifacts.map(a => a.id);
        const allArtifacts = this.scene.gameData.artifacts;
        const available = allArtifacts.filter(a => !owned.includes(a.id));

        const baseChance = this.scene.isTalentUnlocked('artifact_scanner') ? 0.4 : 0.2;
        const chance = baseChance * difficultyFactor;

        if (available.length > 0 && Math.random() < chance) {
            rewards.artifactReward = Phaser.Utils.Array.Shuffle(available).slice(0, 3);
        }

        return rewards;
    }


    spawnWave(waveId) {
        const wave = this.waves[waveId];
        if (!wave) {
            console.warn("Aucune donnée pour waveId:", waveId);
            return;
        }
        const composition = wave.composition;
        this.waveNumber++; // 👈 important, incrémente le compteur
        this.waves[waveId].alive = Object.values(composition).reduce((a, b) => a + b, 0);

        for (let [enemyId, count] of Object.entries(composition)) {
            const enemyData = this.scene.gameData.enemies.find(e => e.id === enemyId);
            if (!enemyData) continue;

            for (let i = 0; i < count; i++) {
                const { x, y } = this.scene.getRandomPointInCircle(
                    this.scene.enemySpawnCircle.x,
                    this.scene.enemySpawnCircle.y,
                    this.scene.enemySpawnCircle.radius
                );
                const unit = new Unit(this.scene, x, y, 'enemy', waveId, enemyData);
                this.scene.enemyUnits.push(unit);
            }
        }
    }



}
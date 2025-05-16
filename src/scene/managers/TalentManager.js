class TalentManager {
    constructor(scene, unlockedTalentIds) {
        this.scene = scene;
        this.unlocked = new Set(unlockedTalentIds);
        this.handlers = this.createHandlers();
    }

    createHandlers() {
        return {
            starter_base_hp: () => {
                this.scene.baseTarget.hp += 20;
                this.scene.baseTarget.maxHp += 20;
            },
            starter_guard: () => this.scene.unitManager.addUnit('unit_guard', 1),
            starter_drone: () => this.scene.unitManager.addUnit('unit_dronoid', 1),
            starter_economy: () => {
                this.scene.addResource('scrap', 20);
                this.scene.addResource('hydronium', 20);
            },
            extra_scrap: () => {
                this.scene.resourceBonusMultipliers['scrap'] = 1.5;
            },
            extra_alloy: () => {
                this.scene.resourceBonusMultipliers['alloy'] = 1.5;
            },
            starter_tech: () => {
                this.scene.buildingManager.addCardById('flux_catalyst');
            },
            spell_charge_boost: () => {
                this.scene.spellManager.globalCooldownMultiplier = 0.75;
            },
            vision_boost: () => {
                this.scene.vision.level += 1;
                this.scene.vision.updatePatternForLevel();
                this.scene.vision.updatePosition();
            },
            vision_mastery: () => {
                this.scene.vision.level += 2;
                this.scene.vision.updatePatternForLevel();
                this.scene.vision.updatePosition();
            },
            // TODO: Ajouter les talents d’architecture + synergies unitaires/mutations plus tard.
        };
    }

    applyOnWaveVictory() {
        for (const id of this.unlocked) {

            // Exemple futur : gain de compute_units
            if (id === 'wave_reward_boost') {
                this.scene.addResource('compute_units', 5);
            }
        }
    }

    applyOnUnitDeath(unit) {
        for (const id of this.unlocked) {
            if (id === 'blood_adaptation') {
                // +1 bio_gel à chaque mort alliée
                if (unit.side === 'player') {
                    this.scene.addResource('bio_gel', 1);
                }
            }

            if (id === 'spiritual_salvage') {
                // 5% chance de rendre un sort gratuit à chaque mort
                if (unit.side === 'player' && Math.random() < 0.05) {
                    const available = this.scene.spellManager.spellData;
                    const spell = Phaser.Utils.Array.GetRandom(available);
                    this.scene.spellManager.addSpellToBar(spell);
                }
            }
        }
    }


    applyAll() {
        for (const id of this.unlocked) {
            if (this.handlers[id]) {
                this.handlers[id]();
            } else {
                console.warn(`[TalentManager] Talent inconnu ou non géré: ${id}`);
            }
        }
    }


    isUnlocked(id) {
        return this.unlocked.has(id);
    }

    getPlacementBonusMultiplier(tile, buildingType) {
        let multiplier = 1;

        const neighborTypes = this.getNeighborTypes(tile);

        // ➕ Scrap Mine adjacente
        if (this.isUnlocked('adjacency_bonus_scrap') && buildingType === 'scrap_mine') {
            if (neighborTypes.includes('scrap_mine')) multiplier *= 1.1;
        }

        // 🔄 Condensor + Refinery
        if (this.isUnlocked('resource_chain_hydronium_alloy') && buildingType === 'refinery') {
            if (neighborTypes.includes('condensor')) multiplier *= 1.2;
        }

        // 🌱 Bio Cuve + Scrap Mine
        if (this.isUnlocked('bio_cuve_growth') && buildingType === 'bio_cuve') {
            if (neighborTypes.includes('scrap_mine')) multiplier *= 2.0;
        }

        // ⚛️ Reactor fusionnés
        if (this.isUnlocked('fusion_node_reactor') && buildingType === 'reactor') {
            if (neighborTypes.includes('reactor')) multiplier *= 1.5;
        }

        return multiplier;
    }

    getNeighborTypes(tile, returnTiles = false) {
        const types = [];
        const tiles = [];
        const grid = this.scene.gridManager;
        const tileX = Math.floor((tile.rect.x - grid.offsetX) / grid.tileSize);
        const tileY = Math.floor((tile.rect.y - grid.offsetY) / grid.tileSize);

        const directions = [
            { dx: -1, dy: 0 }, { dx: 1, dy: 0 },
            { dx: 0, dy: -1 }, { dx: 0, dy: 1 }
        ];

        for (const { dx, dy } of directions) {
            const neighbor = grid.getTileByCoord(tileX + dx, tileY + dy);
            if (neighbor?.building) {
                types.push(neighbor.building.type);
                if (returnTiles) tiles.push(neighbor);
            }
        }

        return returnTiles ? tiles : types;
    }

    applyBehavioralTalentModifiers(building) {
        const tile = building.tile;
        const type = building.type;

        // ⏳ Talent: Réduction du cooldown via liens temporels
        if (this.isUnlocked('temporal_link')) {
            const neighborTypes = this.getNeighborTypes(tile);
            const uniqueTypes = [...new Set(neighborTypes)];
            if (uniqueTypes.length >= 2) {
                building.cooldown *= 0.9;
            }
        }

        // 🧠 Talent: Réseau de snipers ➝ accélère attaque (via effet secondaire)
        if (this.isUnlocked('defense_network_bonus') && type === 'sniper_tower') {
            const neighbors = this.getNeighborTypes(tile);
            const count = neighbors.filter(t => t === 'sniper_tower').length;
            if (count > 0) {
                building.attackSpeedMultiplier = 1.15; // 💡 À exploiter dans l’unité elle-même
            }
        }
    }
}

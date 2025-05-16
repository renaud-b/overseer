class UnitManager {
    constructor(scene, units){
        this.scene = scene;
        this.units = units;
    }

    addUnit(type, amount) {
        if (!(type in this.units)) this.units[type] = 0;
        this.units[type] += amount;

        // Crée les unités sur la carte
        for (let i = 0; i < amount; i++) {
            const { x, y } = this.scene.getRandomPointInCircle(
                this.scene.playerSpawnCircle.x,
                this.scene.playerSpawnCircle.y,
                this.scene.playerSpawnCircle.radius
            );

            const unitData = this.scene.gameData.units.find(u => u.id === type);
            const unit = new Unit(this.scene, x, y, 'player', null, unitData);
            unit.unitType = type;
            this.scene.playerUnits.push(unit);
        }

        this.scene.hud.updateHUD(this.scene.resources, this.units, this.scene.unitCapMap);
    }

    removeUnit(unit) {
        const type = unit.unitType;
        if (type && this.units[type] > 0) {
            this.units[type]--;
        }
        this.scene.hud.updateHUD(this.scene.resources, this.units, this.scene.unitCapMap);
    }

    update(){
        this.scene.playerUnits = this.scene.playerUnits.filter(unit => {
            if (!unit.isAlive()) {
                this.scene.talentManager?.applyOnUnitDeath(unit); // 🔥 Hook ici
                this.scene.artifactManager?.getAllActiveEffects().forEach(effect => {
                    if (effect === 'heal_random_on_death') {
                        const allies = this.scene.playerUnits.filter(u => u.isAlive());
                        const target = Phaser.Utils.Array.GetRandom(allies);
                        if (target) target.hp = Math.min(target.maxHp, target.hp + 1);
                    }
                    if (effect === 'damage_enemy_on_death') {
                        const target = Phaser.Utils.Array.GetRandom(this.scene.enemyUnits);
                        if (target) target.hp -= 2;
                    }
                    if (effect === 'heal_base_on_death') {
                        this.scene.baseTarget.hp = Math.min(
                            this.scene.baseTarget.maxHp,
                            this.scene.baseTarget.hp + 2
                        );
                    }
                });

                this.removeUnit(unit);
                return false;
            }
            return true;
        });

    }

}
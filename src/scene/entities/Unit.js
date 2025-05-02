class Unit {
    constructor(scene, x, y, side = 'enemy', waveId = null, unitData = null) {
        this.scene = scene;
        this.side = side;
        this.hp = unitData?.hp || 3;
        this.speed = unitData?.speed || 40;
        this.attackDamage = unitData?.attack_damage || 1;
        this.attackType = unitData?.attack_type || 'melee';
        this.attackRange = unitData?.attack_range || 30;
        this.attackCooldown = (unitData?.attack_speed || 1.0) * 1000; // en ms
        this.returnTarget = null;
        this.timeSinceLastAttack = 0;

        this.detectionRadius = 400;
        if(side === 'enemy') {
            this.detectionRadius = 100
        }

        const color = side === 'enemy' ? 0xff0000 : 0x00ff00;

        if(unitData != null && unitData.sprite !== undefined){
            this.sprite = scene.add.sprite(x, y, 'droneSprite')
                .setDisplaySize(20, 20)  // adapte ici la taille à ton gameplay
                .setOrigin(0.5)
                .setDepth(10);
        } else {
            this.sprite = scene.add.rectangle(x, y, 20, 20, color)
                .setOrigin(0.5)
                .setDepth(10);
        }

        this.isInvisible = unitData?.behavior === 'invisible_until_hit';
        if (this.isInvisible) {
            this.sprite.setAlpha(0.05);
        }

        this.waveId = waveId; // dans le constructeur
        if(side === 'enemy'){
            console.log("this.waveID", this.waveId);
        }

        // Pour debug visuel :
        if(this.waveId !== null){
            this.label = scene.add.text(this.sprite.x + 8, this.sprite.y - 8, `W${this.waveId}`, {
                fontSize: '10px',
                fill: '#fff',
                fontFamily: 'monospace'
            }).setDepth(11);
        }

        this.maxHp = this.hp; // stock la vie max pour le ratio

        this.hpBarBg = scene.add.rectangle(x, y - 16, 24, 4, 0x000000)
            .setOrigin(0.5)
            .setDepth(9);
        this.hpBar = scene.add.rectangle(x, y - 16, 24, 4, 0x00ff00)
            .setOrigin(0.5)
            .setDepth(10);
    }
    update(delta, opposingUnits) {
        if (!this.sprite.active) return;

        this.timeSinceLastAttack += delta;

        let closest = null;
        let minDist = Infinity;

        if (this.unitData?.behavior === 'base_rusher') {
            this.attackBaseDirectly(delta);
            this.updateHealthBar();
            if (this.hp <= 0) this.destroy();
            return;
        }

        for (let unit of opposingUnits) {
            if (!unit.isAlive()) continue;
            const dx = unit.sprite.x - this.sprite.x;
            const dy = unit.sprite.y - this.sprite.y;
            const dist = Math.sqrt(dx * dx + dy * dy);
            if (dist < this.detectionRadius && dist < minDist) {
                minDist = dist;
                closest = unit;
            }
        }


        if (closest) {
            const dx = closest.sprite.x - this.sprite.x;
            const dy = closest.sprite.y - this.sprite.y;
            const dist = Math.sqrt(dx * dx + dy * dy);

            if (this.attackType === 'melee') {
                if (dist > 10) {
                    this.sprite.x += (dx / dist) * this.speed * (delta / 1000);
                    this.sprite.y += (dy / dist) * this.speed * (delta / 1000);
                }
                if (dist < 20 && this.timeSinceLastAttack >= this.attackCooldown) {
                    closest.hp -= this.attackDamage;
                    this.timeSinceLastAttack = 0;

                    if (this.isInvisible) {
                        this.isInvisible = false;
                        this.sprite.setAlpha(1); // visible à l’attaque
                    }
                }

            } else if (this.attackType === 'ranged') {
                if (dist > this.attackRange) {
                    this.sprite.x += (dx / dist) * this.speed * (delta / 1000);
                    this.sprite.y += (dy / dist) * this.speed * (delta / 1000);
                }
                // Ne pas avancer, juste tirer
                if (dist < this.attackRange && this.timeSinceLastAttack >= this.attackCooldown) {
                    this.shootLaser(closest);
                    this.timeSinceLastAttack = 0;

                    if (this.isInvisible) {
                        this.isInvisible = false;
                        this.sprite.setAlpha(1); // visible à l’attaque
                    }
                }

                const { separation, cohesion } = this.computeCrowdForces(this.scene.playerUnits);
                const adjust = separation.clone().add(cohesion).scale(delta / 1000);
                this.sprite.x += adjust.x;
                this.sprite.y += adjust.y;
            }
        } else {
            this.patrolOrReturn(delta);
        }

        this.updateHealthBar();
        if (this.label) {
            this.label.setPosition(this.sprite.x + 8, this.sprite.y - 8);
        }

        if (this.hp <= 0 && this.sprite.active) this.destroy();
    }

    attackBaseDirectly(delta) {
        const target = this.scene.baseTarget;
        if (!target || target.hp <= 0) return;

        const dx = target.x - this.sprite.x;
        const dy = target.y - this.sprite.y;
        const dist = Math.sqrt(dx * dx + dy * dy);

        if (dist > this.attackRange) {
            const move = new Phaser.Math.Vector2(dx, dy).normalize().scale(this.speed * (delta / 1000));
            this.sprite.x += move.x;
            this.sprite.y += move.y;
        } else if (this.timeSinceLastAttack >= this.attackCooldown) {
            target.hp -= this.attackDamage;
            this.timeSinceLastAttack = 0;
        }
    }


    shootLaser(target) {
        const laserColor = this.side === 'enemy' ? 0xff4444 : 0x00ffff;

        const laser = this.scene.add.graphics().setDepth(50);
        laser.lineStyle(3, laserColor, 1);
        laser.beginPath();
        laser.moveTo(this.sprite.x, this.sprite.y);
        laser.lineTo(target.sprite.x, target.sprite.y);
        laser.strokePath();

        // Animation de glow en pulsation
        this.scene.tweens.add({
            targets: laser,
            alpha: { from: 1, to: 0 },
            duration: 150,
            onComplete: () => laser.destroy()
        });

        // Flash sur la cible
        const flash = this.scene.add.rectangle(target.sprite.x, target.sprite.y, 20, 20, laserColor)
            .setOrigin(0.5)
            .setAlpha(0.7)
            .setDepth(49)
            .setBlendMode(Phaser.BlendModes.ADD);

        this.scene.tweens.add({
            targets: flash,
            alpha: 0,
            duration: 120,
            onComplete: () => flash.destroy()
        });

        target.hp -= this.attackDamage;
    }


    patrolOrReturn(delta) {
        if (this.side === 'enemy') {
            const target = this.scene.baseTarget;
            const dx = target.x - this.sprite.x;
            const dy = target.y - this.sprite.y;
            const dist = Math.sqrt(dx * dx + dy * dy);

            if (dist > this.attackRange) {
                const move = new Phaser.Math.Vector2(dx, dy).normalize().scale(this.speed * (delta / 1000));
                const { separation, cohesion } = this.computeCrowdForces(this.scene.enemyUnits);
                move.add(separation.scale(delta / 1000));
                move.add(cohesion.scale(delta / 1000));
                this.sprite.x += move.x;
                this.sprite.y += move.y;
            } else if (this.timeSinceLastAttack >= this.attackCooldown) {
                target.hp -= this.attackDamage;
                this.timeSinceLastAttack = 0;
            }
        } else {
            // Retour au spawn
            if (!this.returnTarget) {
                this.returnTarget = this.scene.getRandomPointInCircle(
                    this.scene.playerSpawnCircle.x,
                    this.scene.playerSpawnCircle.y,
                    this.scene.playerSpawnCircle.radius
                );
            }

            const dx = this.returnTarget.x - this.sprite.x;
            const dy = this.returnTarget.y - this.sprite.y;
            const dist = Math.sqrt(dx * dx + dy * dy);

            let move = new Phaser.Math.Vector2(dx, dy).normalize().scale(this.speed * (delta / 1000));

            const { separation, cohesion } = this.computeCrowdForces(this.scene.playerUnits);
            move.add(separation.scale(delta / 1000));
            move.add(cohesion.scale(delta / 1000));

            if (dist > 5) {
                this.sprite.x += move.x;
                this.sprite.y += move.y;
            } else {
                this.returnTarget = null;
            }
        }
    }

    updateHealthBar() {
        const ratio = Phaser.Math.Clamp(this.hp / this.maxHp, 0, 1);
        this.hpBar.width = 24 * ratio;
        this.hpBar.setPosition(this.sprite.x, this.sprite.y - 16);
        this.hpBarBg.setPosition(this.sprite.x, this.sprite.y - 16);

        const color = Phaser.Display.Color.Interpolate.ColorWithColor(
            new Phaser.Display.Color(255, 0, 0),
            new Phaser.Display.Color(0, 255, 0),
            100,
            ratio * 100
        );
        this.hpBar.setFillStyle(Phaser.Display.Color.GetColor(color.r, color.g, color.b));
    }

    computeCrowdForces(alliedUnits) {
        const separation = new Phaser.Math.Vector2(0, 0);
        const cohesion = new Phaser.Math.Vector2(0, 0);
        let count = 0;

        for (let other of alliedUnits) {
            if (other === this || !other.isAlive()) continue;

            const dx = other.sprite.x - this.sprite.x;
            const dy = other.sprite.y - this.sprite.y;
            const dist = Math.sqrt(dx * dx + dy * dy);

            if (dist < 50 && dist > 1) {
                separation.x -= dx / dist;
                separation.y -= dy / dist;
                cohesion.x += other.sprite.x;
                cohesion.y += other.sprite.y;
                count++;
            }
        }

        if (count > 0) {
            cohesion.x = cohesion.x / count - this.sprite.x;
            cohesion.y = cohesion.y / count - this.sprite.y;
            separation.normalize().scale(30);
            cohesion.normalize().scale(10);
            return { separation, cohesion };
        }

        return { separation: new Phaser.Math.Vector2(0, 0), cohesion: new Phaser.Math.Vector2(0, 0) };
    }

    isAlive() {
        return this.sprite.active;
    }

    destroy() {
        if (this.unitData?.behavior === 'split_on_death') {
            const splitType = this.unitData.split_spawn;
            const count = this.unitData.split_count || 2;

            for (let i = 0; i < count; i++) {
                const { x, y } = this.scene.getRandomPointInCircle(this.sprite.x, this.sprite.y, 20);
                const unitData = this.scene.gameData.enemies.find(e => e.id === splitType);
                const baby = new Unit(this.scene, x, y, 'enemy', this.waveId, unitData);
                this.scene.enemyUnits.push(baby);
            }
        }

        this.sprite.destroy();
        if (this.hpBar) this.hpBar.destroy();
        if (this.hpBarBg) this.hpBarBg.destroy();
        if (this.label) this.label.destroy();

        this.label = null;


    }

}

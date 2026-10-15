class Unit {
    constructor(scene, x, y, side = 'enemy', waveId = null, unitData = null) {
        this.scene = scene;
        this.side = side;
        this.unitData = unitData;
        this.entity = scene.world.create(scene.gameEntity);
        scene.world.set(this.entity, 'Position', { x, y });
        scene.world.set(this.entity, 'Health', { hp: unitData?.hp || 3, maxHp: unitData?.hp || 3 });
        scene.world.set(this.entity, 'Faction', { side });
        scene.world.set(this.entity, 'Movement', { speed: unitData?.speed || 40 });
        scene.world.set(this.entity, 'Combat', {
            damage: unitData?.attack_damage || 1,
            range: unitData?.attack_range || 30,
            attackType: unitData?.attack_type || 'melee',
            cooldownMs: (unitData?.attack_speed || 1) * 1000,
            elapsedMs: 0,
            detectionRadius: side === 'enemy' ? 100 : 400,
            behavior: unitData?.behavior || null
        });
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

        this.maxHp = this.hp; // stock la vie max pour le ratio

        this.hpBarBg = scene.add.rectangle(x, y - 16, 24, 4, 0x000000)
            .setOrigin(0.5)
            .setDepth(9);
        this.hpBar = scene.add.rectangle(x, y - 16, 24, 4, 0x00ff00)
            .setOrigin(0.5)
            .setDepth(10);
    }
    get hp() {
        return this.scene.world.has(this.entity) ? this.scene.world.get(this.entity, 'Health').hp : 0;
    }

    set hp(value) {
        if (this.scene.world.has(this.entity)) this.scene.world.get(this.entity, 'Health').hp = value;
    }

    update(delta, opposingUnits) {
        if (!this.sprite.active) return;
        if (this.hp <= 0) { this.destroy(); return; }

        const world = this.scene.world;
        world.get(this.entity, 'Movement').speed = this.speed;
        const opposingIds = opposingUnits.filter(u => u.isAlive() && world.has(u.entity)).map(u => u.entity);

        // Keep the existing idle patrol target. The ECS simulation owns position.
        if (this.side === 'player' && !this.returnTarget) {
            this.returnTarget = this.scene.getRandomPointInCircle(
                this.scene.playerSpawnCircle.x,
                this.scene.playerSpawnCircle.y,
                this.scene.playerSpawnCircle.radius
            );
        }

        const base = this.scene.baseTarget;
        const events = OverseerCombat.stepUnit(world, this.entity, delta, {
            opponents: opposingIds,
            base: base ? { x: base.x, y: base.y } : null,
            patrol: this.returnTarget
        });

        const p = world.get(this.entity, 'Position');
        this.sprite.setPosition(p.x, p.y);
        if (this.returnTarget && Math.hypot(p.x - this.returnTarget.x, p.y - this.returnTarget.y) <= 5) {
            this.returnTarget = null;
        }

        for (const event of events) {
            if (event.type === 'base-attack' && base) base.hp -= event.damage;
            if (event.type === 'attack') {
                const target = opposingUnits.find(u => u.entity === event.target);
                if (event.ranged && target?.sprite?.active) this.shootLaser(target);
                if (this.isInvisible) {
                    this.isInvisible = false;
                    this.sprite.setAlpha(1);
                }
            }
        }
        this.updateHealthBar();
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

        // Damage has already been applied by OverseerCombat.
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

        if (this.scene.world.has(this.entity)) this.scene.world.destroy(this.entity);
        this.sprite.destroy();
        if (this.hpBar) this.hpBar.destroy();
        if (this.hpBarBg) this.hpBarBg.destroy();


    }

}

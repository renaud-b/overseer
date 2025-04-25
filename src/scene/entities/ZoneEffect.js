class ZoneEffect {
    constructor(scene, x, y, config) {
        this.scene = scene;
        this.x = x;
        this.y = y;
        this.radius = config.radius || 100;
        this.duration = config.duration || 10000;
        this.tickInterval = config.tickInterval || 1000;
        this.effectFn = config.effectFn; // Fonction à exécuter à chaque tick

        this.elapsed = 0;
        this.tickElapsed = 0;

        // Visuel de la zone
        this.sprite = scene.add.circle(x, y, this.radius, config.color || 0x00ff00, 0.2)
            .setStrokeStyle(2, config.color || 0x00ff00)
            .setDepth(2)
            .setAlpha(0.5)
            .setBlendMode(Phaser.BlendModes.ADD);


        // ✨ Particules
        this.emitter = scene.add.particles(0, 0, 'particle', {
            x: { min: x - this.radius, max: x + this.radius },
            y: { min: y - this.radius, max: y + this.radius },
            lifespan: 1200,
            speed: { min: 10, max: 30 },
            angle: { min: 0, max: 360 },
            scale: { start: 0.4, end: 0 },
            alpha: { start: 0.4, end: 0 },
            frequency: 120,
            tint: this.color,
            blendMode: 'ADD'
        }).setDepth(1);


        scene.zoneEffects.push(this);
    }

    update(delta) {
        this.elapsed += delta;
        this.tickElapsed += delta;

        if (this.tickElapsed >= this.tickInterval) {
            this.tickElapsed = 0;
            this.effectFn(this.scene, this.x, this.y, this.radius);
        }

        if (this.elapsed >= this.duration) this.destroy();
    }

    destroy() {
        this.sprite.destroy();
        this.emitter.destroy();
        this.scene.zoneEffects = this.scene.zoneEffects.filter(z => z !== this);
    }
}

class Projectile {
    constructor(scene, x, y, target, damage = 1, color = 0xffffff, speed = 300) {
        this.scene = scene;
        this.target = target;
        this.damage = damage;
        this.speed = speed;

        this.sprite = scene.add.rectangle(x, y, 4, 2, color)
            .setDepth(20)
            .setOrigin(0.5);

        const dx = target.sprite.x - x;
        const dy = target.sprite.y - y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        this.direction = { x: dx / dist, y: dy / dist };
    }

    update(delta) {
        if (!this.target || !this.target.isAlive()) {
            this.destroy();
            return;
        }

        this.sprite.x += this.direction.x * this.speed * (delta / 1000);
        this.sprite.y += this.direction.y * this.speed * (delta / 1000);

        const dist = Phaser.Math.Distance.Between(this.sprite.x, this.sprite.y, this.target.sprite.x, this.target.sprite.y);
        if (dist < 10) {
            this.target.hp -= this.damage;
            this.destroy();
        }
    }

    destroy() {
        if (this.sprite) this.sprite.destroy();
        this.scene.projectiles = this.scene.projectiles.filter(p => p !== this);
    }
}

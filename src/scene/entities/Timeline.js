class Timeline {
    constructor(scene) {
        this.scene = scene;
        this.flags = [];
        this.width = 700;
        this.offsetX = 500;
        this.offsetY = 30
        this.track = scene.add.rectangle(this.offsetX, this.offsetY, this.width, 10, 0x888888)
            .setOrigin(0);

        this.waveSpeed = 10; // px/s
    }

    addFlag(delayMs, composition, rewards = null, waveId = null) {
        const startX = this.width + this.offsetX;
        const y = this.offsetY-5;

        const flag = this.scene.add.rectangle(startX, y, 12, 20, 0xff0000)
            .setOrigin(0);
        flag.spawnTime = this.scene.time.now + delayMs;
        flag.composition = composition;
        flag.rewards = rewards;
        flag.waveId = waveId; // <-- nouveau
        this.flags.push(flag);

        flag.setInteractive();
        flag.on('pointerover', () => {
            this.scene.hud.showWavePreviewWithRewards(flag.composition, flag.rewards, flag.x, flag.y);
        });
        flag.on('pointerout', () => {
            this.scene.hud.hideWavePreview();
        });
    }



    update(delta) {
        const speed = this.waveSpeed * (delta / 1000);
        const now = this.scene.time.now;

        for (let flag of this.flags) {
            if (now < flag.spawnTime) continue; // ❗ attendre que le temps soit bon

            flag.x -= speed;

            if (flag.x <= this.offsetX && !flag.triggered) {
                flag.triggered = true;
                this.scene.waveManager.spawnWave(flag.waveId); // ✅ on transmet bien l’id exact
                flag.destroy();
            }
        }

        // Nettoyage des flags détruits
        this.flags = this.flags.filter(f => f.active);
    }

}

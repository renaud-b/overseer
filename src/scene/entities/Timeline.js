class Timeline {
    constructor(scene) {
        this.scene = scene;
        this.flags = [];
        this.width = 900;
        this.offsetX = 370;
        this.offsetY = 20
        this.track = scene.add.rectangle(this.offsetX, this.offsetY, this.width, 13, 0x143143)
            .setOrigin(0);

        this.waveSpeed = 10; // px/s
    }

    addFlag(delayMs, composition, rewards = null, waveId = null) {
        const startX = this.width + this.offsetX;
        const y = this.offsetY-5;

        let color = 0xff0000; // couleur par défaut
        if(waveId %5 === 0 && waveId > 0) {
            color = 0xffff00;
        }
        const flag = this.scene.add.image(startX, y, "incoming_wave")
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

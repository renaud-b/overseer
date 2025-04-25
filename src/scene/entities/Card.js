class Card {
    constructor(scene, x, y, data, count = 1) {
        this.scene = scene;
        this.cardType = data.type;
        this.count = count;

        this.card = scene.add.rectangle(x, y, 100, 100, data.color)
            .setStrokeStyle(2, 0xffffff)
            .setOrigin(0)
            .setInteractive({ draggable: true });
        this.card.startX = x;
        this.card.startY = y;

        if(!data.unlimited){
            this.label = scene.add.text(x + 10, y + 10, data.type, {
                fontSize: '16px',
                fill: '#fff',
                fontFamily: 'monospace'
            });

            // ➕ Affiche le compteur en bas à droite
            this.countText = scene.add.text(x + 90, y + 90, '', {
                fontSize: '14px',
                fill: '#ffff00',
                fontFamily: 'monospace'
            }).setOrigin(1, 1).setDepth(100);

            this.updateCountText();
        }

        this.card.associatedLabel = this.label;
        this.card.associatedCount = this.countText;
        this.card.cardType = data.type;

        scene.input.setDraggable(this.card);

        this.card.on('pointerover', () => {
            const info = this.scene.getDescription(this.cardType);
            this.scene.hud.showInfoPanel(info.name, info.desc, this.card.x, this.card.y);
        });
        this.card.on('pointerout', () => {
            this.scene.hud.hideInfoPanel();
        });
    }

    updateCountText() {
        if (this.count === Infinity) {
            this.countText.setText('∞');
        } else {
            this.countText.setText(`x${this.count}`);
        }
    }

    setCount(n) {
        this.count = n;
        this.updateCountText();
    }

    destroy() {
        this.card.destroy();
        this.label.destroy();
        this.countText.destroy();
    }
}

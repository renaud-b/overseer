const talentTree = [
    { id: 'root', label: 'Core Access', x: 400, y: 100, cost: 0, unlocked: true, description: 'Point de départ.' },
    { id: 'starter_drone', label: 'Starter Drone', x: 250, y: 250, cost: 5, parent: 'root', description: 'Commencer avec un drone.' },
    { id: 'vision_boost', label: 'Vision Boost', x: 550, y: 250, cost: 8, parent: 'root', description: 'Vision +1 tuile au départ.' },
    { id: 'resource_node_scanner', label: 'Resource Node Scanner', x: 350, y: 400, cost: 10, parent: 'vision_boost', description: 'Ajoute une tuile spéciale qui booste la production si construite dessus.' },
    { id: 'artifact_scanner', label: 'Artifact Scanner', x: 550, y: 400, cost: 12, parent: 'vision_boost', description: 'Augmente la chance d’obtenir un artefact après une vague.' }
];

class OverseerCoreScene extends Phaser.Scene {
    constructor() {
        super('OverseerCoreScene');
    }

    preload() {}

    create() {
        this.memoryShards = parseInt(localStorage.getItem('memoryShards') || '0');
        this.unlockedTalents = JSON.parse(localStorage.getItem('unlockedTalents') || '["root"]');

        // Forcer root à être débloqué
        if (!this.unlockedTalents.includes('root')) {
            this.unlockedTalents.push('root');
        }

        this.talentTree = talentTree;

        this.centerX = this.scale.width / 2;
        this.centerY = this.scale.height / 2;

        this.calculateTreeOffset();    // 🛠 D'ABORD : calcul offset
        this.createBackground();
        this.drawConnections();        // ✅ MAINTENANT offset prêt
        this.createNodes();
        this.createShardDisplay();
        this.createRestartButton();
        this.createResetButton();
    }

    createResetButton() {
        const centerX = this.scale.width / 2;
        const btnY = this.scale.height - 120; // au-dessus du bouton relancer

        const button = this.add.rectangle(centerX, btnY, 360, 50, 0x440000, 1)
            .setStrokeStyle(2, 0xff0000)
            .setOrigin(0.5)
            .setInteractive();

        const buttonText = this.add.text(centerX, btnY, '[ Réinitialiser l\'Overseer Core ]', {
            fontSize: '18px',
            fill: '#ff4444',
            fontFamily: 'monospace'
        }).setOrigin(0.5);

        button.on('pointerover', () => {
            button.setFillStyle(0x660000);
        });
        button.on('pointerout', () => {
            button.setFillStyle(0x440000);
        });

        button.on('pointerdown', () => {
            // Réinitialiser tout
            localStorage.setItem('memoryShards', '0');
            localStorage.setItem('unlockedTalents', JSON.stringify([]));
            this.scene.restart();
        });
    }

    createBackground() {
        this.add.text(this.centerX, 30, '🧠 Overseer Core', {
            fontSize: '32px',
            fill: '#00ffcc',
            fontFamily: 'monospace'
        }).setOrigin(0.5);
    }

    createRestartButton() {
        const centerX = this.scale.width / 2;
        const btnY = this.scale.height - 60;

        const button = this.add.rectangle(centerX, btnY, 290, 50, 0x333333, 1)
            .setStrokeStyle(2, 0xffffff)
            .setOrigin(0.5)
            .setInteractive();

        const buttonText = this.add.text(centerX, btnY, '[ Relancer une partie ]', {
            fontSize: '20px',
            fill: '#00ff00',
            fontFamily: 'monospace'
        }).setOrigin(0.5);

        // Effet visuel au survol
        button.on('pointerover', () => {
            button.setFillStyle(0x555555);
        });
        button.on('pointerout', () => {
            button.setFillStyle(0x333333);
        });

        // Au clic ➔ relancer MainScene
        button.on('pointerdown', () => {
            this.scene.start('MainScene');
        });
    }


    createShardDisplay() {
        this.shardText = this.add.text(20, 20, `Memory Shards: ${this.memoryShards}`, {
            fontSize: '20px',
            fill: '#ffffff',
            fontFamily: 'monospace'
        }).setOrigin(0, 0);
    }

    calculateTreeOffset() {
        let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;

        this.talentTree.forEach(talent => {
            minX = Math.min(minX, talent.x);
            maxX = Math.max(maxX, talent.x);
            minY = Math.min(minY, talent.y);
            maxY = Math.max(maxY, talent.y);
        });

        const treeWidth = maxX - minX;
        const treeHeight = maxY - minY;
        const offsetX = this.centerX - (treeWidth / 2) - minX;
        const offsetY = this.centerY - (treeHeight / 2) - minY;

        this.treeOffset = { x: offsetX, y: offsetY };
    }

    drawConnections() {
        this.connectionLines = []; // <- Stockage pour pouvoir les recolorer plus tard si besoin

        this.talentTree.forEach(talent => {
            if (talent.parent) {
                const parent = this.talentTree.find(t => t.id === talent.parent);
                if (!parent) return;

                const startX = parent.x + this.treeOffset.x;
                const startY = parent.y + this.treeOffset.y;
                const endX = talent.x + this.treeOffset.x;
                const endY = talent.y + this.treeOffset.y;

                const isUnlocked = this.unlockedTalents.includes(talent.id);



                const color = isUnlocked ? 0x00ff00 : 0xaaaaaa;

                const line = this.add.line(
                    0, 0,
                    startX, startY,
                    endX, endY,
                    color
                ).setOrigin(0, 0).setLineWidth(2).setAlpha(0.7);

                this.connectionLines.push(line);
            }
        });
    }


    createNodes() {
        this.talentTree.forEach(talent => {
            const isUnlocked = this.unlockedTalents.includes(talent.id) || talent.unlocked;

            console.log("isUnlocked", isUnlocked);
            console.log("node id", talent.id);

            const node = this.add.circle(
                talent.x + this.treeOffset.x,
                talent.y + this.treeOffset.y,
                30,
                isUnlocked ? 0x00ff00 : 0x555555
            )
                .setStrokeStyle(2, 0xffffff)
                .setInteractive();

            const label = this.add.text(
                talent.x + this.treeOffset.x,
                talent.y + this.treeOffset.y + 40,
                talent.label,
                {
                    fontSize: '14px',
                    fill: '#ffffff',
                    fontFamily: 'monospace'
                }
            ).setOrigin(0.5);

            node.on('pointerover', () => this.showTalentInfo(talent));
            node.on('pointerout', () => this.hideTalentInfo());
            node.on('pointerdown', () => this.tryUnlockTalent(talent));
        });
    }


    showTalentInfo(talent) {
        this.hideTalentInfo();

        const padding = 20;
        const maxWidth = 350;

        let infoString = `${talent.label}\n\n${talent.description}`;
        if (!this.unlockedTalents.includes(talent.id)) {
            infoString += `\n\n🧬 Coût: ${talent.cost} Shards`;
        } else {
            infoString += `\n\n✅ Débloqué`;
        }

        // Crée le texte
        this.infoText = this.add.text(this.centerX, this.scale.height - 200, infoString, {
            fontSize: '16px',
            fill: '#ffffff',
            fontFamily: 'monospace',
            align: 'center',
            wordWrap: { width: maxWidth }
        }).setOrigin(0.5, 0);

        const textBounds = this.infoText.getBounds();

        const panelWidth = textBounds.width + padding * 2;
        const panelHeight = textBounds.height + padding * 2;

        this.infoBox = this.add.rectangle(
            this.centerX,
            this.infoText.y + textBounds.height / 2,
            Math.max(panelWidth, 300),
            panelHeight,
            0x222222,
            0.9
        ).setOrigin(0.5).setStrokeStyle(2, 0xffffff);

        this.infoBox.setDepth(100);
        this.infoText.setDepth(101);
    }



    hideTalentInfo() {
        if (this.infoBox) this.infoBox.destroy();
        if (this.infoText) this.infoText.destroy();
    }

    tryUnlockTalent(talent) {
        if (this.unlockedTalents.includes(talent.id)) {
            console.log('Déjà débloqué');
            return;
        }

        // Check si parent débloqué
        if (talent.parent && !this.unlockedTalents.includes(talent.parent)) {
            console.log('Parent non débloqué');
            return;
        }

        // Check si assez de shards
        if (talent.cost > this.memoryShards) {
            console.log('Pas assez de Memory Shards');
            return;
        }

        // Débloquer talent
        this.memoryShards -= talent.cost;
        this.unlockedTalents.push(talent.id);

        // Créer un cercle temporaire qui pulse
        const highlight = this.add.circle(
            talent.x + this.treeOffset.x,
            talent.y + this.treeOffset.y,
            35,
            0x00ff00,
            0.4
        ).setOrigin(0.5).setDepth(50);

        this.tweens.add({
            targets: highlight,
            alpha: 0,
            scale: 2,
            duration: 500,
            ease: 'Cubic.easeOut',
            onComplete: () => highlight.destroy()
        });

        // Sauvegarder
        localStorage.setItem('memoryShards', this.memoryShards.toString());
        localStorage.setItem('unlockedTalents', JSON.stringify(this.unlockedTalents));

        // Petit feedback visuel ?
        this.add.text(talent.x + this.treeOffset.x, talent.y + this.treeOffset.y - 40, '✔️', {
            fontSize: '24px',
            fill: '#00ff00',
            fontFamily: 'monospace'
        }).setOrigin(0.5).setDepth(999).setAlpha(0.8);

        // Refresh interface
        this.scene.restart();
    }
}

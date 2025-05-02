class Vision {
    constructor(scene, tileSize, gridWidth, gridHeight, tiles) {
        this.scene = scene;
        this.tileSize = tileSize;
        this.gridWidth = gridWidth;
        this.gridHeight = gridHeight;
        this.tiles = tiles;

        this.pos = { x: 0, y: 0 }; // coin supérieur gauche
        this.patternIndex = 0; // index de la forme (rotation)

        this.visionPatterns = [
            [ { x: 0, y: 0 }, { x: 1, y: 0 }, { x: 0, y: 1 } ], // ┌
            [ { x: 0, y: 0 }, { x: 0, y: 1 }, { x: -1, y: 0 } ], // ┐
            [ { x: 0, y: 0 }, { x: -1, y: 0 }, { x: 0, y: -1 } ], // ┘
            [ { x: 0, y: 0 }, { x: 0, y: -1 }, { x: 1, y: 0 } ]  // └
        ];


        this.rects = this.visionPatterns[0].map(() => scene.add.rectangle(0, 0, tileSize, tileSize, 0xffff00, 0.15)
            .setStrokeStyle(2, 0xffff00)
            .setOrigin(0)
            .setDepth(10));

        this.level = 0;
        this.updatePatternForLevel()

        this.updatePosition();
        this.bindControls();
    }

    getUpgradeCost(currentLevel) {
        const costs = [20, 50, 70]; // niveau 0 → 1 coûte 10, etc.
        return costs[currentLevel] || 9999;
    }

    tryUpgradeVision() {
        const cost = this.getUpgradeCost(this.level);
        if (this.scene.resources['compute_units'] >= cost && this.level < 4) {
            this.scene.resources['compute_units'] -= cost;
            this.level++;
            this.scene.hud.updateHUD(this.scene.resources, this.scene.units, this.scene.unitCapMap);
            this.patternIndex = 0
            this.updatePatternForLevel();
            this.updatePosition();
        } else {
            console.log("Pas assez de ressources ou niveau max atteint");
        }
    }

    updatePatternForLevel() {
        const rotatePattern = (pattern, times = 1) => {
            let rotated = pattern.map(p => ({ ...p }));
            for (let t = 0; t < times; t++) {
                rotated = rotated.map(({ x, y }) => ({ x: -y, y: x }));
            }
            return rotated;
        };

        const basePatterns = [
            // Niveau 0 : en L (avec rotations)
            [0, 1, 2, 3].map(r => rotatePattern([
                { x: 0, y: 0 }, { x: 1, y: 0 }, { x: 0, y: 1 }
            ], r)),

            // Niveau 1 : carré (rotation visuellement identique mais techniquement présente)
            [0, 1, 2, 3].map(r => rotatePattern([
                { x: 0, y: 0 }, { x: 1, y: 0 }, { x: 0, y: 1 }, { x: 1, y: 1 }
            ], r)),

            // Niveau 2 : carré + tuile, rotation utile
            [0, 1, 2, 3].map(r => rotatePattern([
                { x: 0, y: 0 }, { x: 1, y: 0 }, { x: 0, y: 1 }, { x: 1, y: 1 }, { x: 2, y: 1 }
            ], r)),

            // Niveau 3 : rectangle 2x3 avec rotations
            [0, 1, 2, 3].map(r => rotatePattern([
                { x: 0, y: 0 }, { x: 1, y: 0 },
                { x: 0, y: 1 }, { x: 1, y: 1 },
                { x: 0, y: 2 }, { x: 1, y: 2 }
            ], r))
        ];

        this.visionPatterns = basePatterns[this.level] || basePatterns[0];
        this.patternIndex = 0;

        // Nettoyage et recréation des rectangles visuels
        this.rects.forEach(r => r.destroy());
        const maxTiles = Math.max(...this.visionPatterns.map(p => p.length));
        this.rects = Array.from({ length: maxTiles }, () =>
            this.scene.add.rectangle(0, 0, this.tileSize, this.tileSize, 0xffff00, 0.15)
                .setStrokeStyle(2, 0xffff00)
                .setOrigin(0)
                .setDepth(10)
        );
    }



    updatePosition() {
        const pattern = this.visionPatterns[this.patternIndex];

        // Reset all tiles
        this.tiles.forEach(t => {
            t.isActive = false;
            t.rect.setFillStyle(t.building ? t.building.fillColor : 0x333333);
        });

        pattern.forEach((offset, i) => {
            const tx = this.pos.x + offset.x;
            const ty = this.pos.y + offset.y;

            if (tx >= 0 && ty >= 0 && tx < this.gridWidth && ty < this.gridHeight) {
                const index = ty * this.gridWidth + tx;
                const tile = this.tiles[index];
                tile.isActive = true;
                if (!tile.building) {
                    tile.rect.setFillStyle(0x666666);
                }
                this.rects[i].setPosition(tile.rect.x, tile.rect.y).setVisible(true);
            } else {
                this.rects[i].setVisible(false);
            }
        });
    }

    bindControls() {
        this.keys = this.scene.input.keyboard.addKeys({
            up: 'Z',
            down: 'S',
            left: 'Q',
            right: 'D',
            rotate: 'E'
        });

        this.scene.input.keyboard.on('keydown', (event) => {
            let newX = this.pos.x;
            let newY = this.pos.y;

            if (event.key === 'z') {
                newY--;
            } else if (event.key === 's') {
                newY++;
            } else if (event.key === 'q') {
                newX--;
            } else if (event.key === 'd') {
                newX++;
            } else if (event.key === 'e') {
                this.patternIndex = (this.patternIndex + 1) % this.visionPatterns.length;
                this.updatePosition(); // rotation autorisée sans vérif
                return;
            }

            const pattern = this.visionPatterns[this.patternIndex];
            const inBounds = pattern.every(offset => {
                const tx = newX + offset.x;
                const ty = newY + offset.y;
                return tx >= 0 && ty >= 0 && tx < this.gridWidth && ty < this.gridHeight;
            });

            if (inBounds) {
                this.pos.x = newX;
                this.pos.y = newY;
                this.updatePosition();
            }
        });

    }
}

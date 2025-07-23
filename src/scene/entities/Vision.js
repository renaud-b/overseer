class Vision {
    constructor(scene, tileSizeX, tileSizeY, gridWidth, gridHeight, tiles, offsetX, offsetY) {
        this.scene = scene;
        this.tileSizeX = tileSizeX;
        this.tileSizeY = tileSizeY;
        this.gridWidth = gridWidth;
        this.gridHeight = gridHeight;
        this.tiles = tiles;
        this.offsetX = offsetX || 0;
        this.offsetY = offsetY || 0;

        // Position logique : CENTRE de la vision
        this.pos = { x: 1, y: 1 };
        this.patternIndex = 0;
        this.level = 0;

        this.createPatterns();

        // Sprite visuel
        this.sprite = scene.add.image(0, 0, 'vision_0')
            .setDisplaySize(this.tileSizeX * 2, this.tileSizeY * 2)
            .setOrigin(0.5, 0.5) // ✅ Pivot au centre
            .setDepth(101);

        this.updatePosition();
        this.bindControls();
    }

    createPatterns() {
        const rotatePattern = (pattern, times = 1) => {
            let rotated = pattern.map(p => ({ ...p }));
            for (let t = 0; t < times; t++) {
                rotated = rotated.map(({ x, y }) => ({ x: -y, y: x }));
            }
            return rotated;
        };

        const basePatterns = [
            // Niveau 0 : en L (centré)
            [ { x: 0, y: 0 }, { x: 1, y: 0 }, { x: 0, y: 1 } ],
            // Niveau 1 : carré 2x2
            [ { x: 0, y: 0 }, { x: 1, y: 0 }, { x: 0, y: 1 }, { x: 1, y: 1 } ],
            // Niveau 2 : carré + 1 tuile
            [ { x: 0, y: 0 }, { x: 1, y: 0 }, { x: 0, y: 1 }, { x: 1, y: 1 }, { x: 2, y: 1 } ],
            // Niveau 3 : rectangle 2x3
            [ { x: 0, y: 0 }, { x: 1, y: 0 }, { x: 0, y: 1 }, { x: 1, y: 1 }, { x: 0, y: 2 }, { x: 1, y: 2 } ]
        ];

        // 🔍 Décalage pour centrer le pattern autour (0,0)
        const centerPattern = (pattern) => {
            const minX = Math.min(...pattern.map(p => p.x));
            const maxX = Math.max(...pattern.map(p => p.x));
            const minY = Math.min(...pattern.map(p => p.y));
            const maxY = Math.max(...pattern.map(p => p.y));
            const centerX = (minX + maxX) / 2;
            const centerY = (minY + maxY) / 2;
            return pattern.map(p => ({ x: p.x - centerX, y: p.y - centerY }));
        };

        this.levelPatterns = basePatterns.map(base =>
            [0, 1, 2, 3].map(r => centerPattern(rotatePattern(base, r)))
        );

        this.updatePatternForLevel();
    }

    updatePatternForLevel() {
        this.visionPatterns = this.levelPatterns[this.level] || this.levelPatterns[0];
        this.patternIndex = 0;
    }

    updatePosition() {
        const tile = this.tiles[this.pos.y * this.gridWidth + this.pos.x];
        if (!tile) return;

        // Place la vision au centre de la tuile (pas besoin de patternWidth maintenant)
        this.sprite.setPosition(
            tile.rect.x + this.tileSizeX / 2 + (this.tileSizeX / 2),
            tile.rect.y + this.tileSizeY / 2 + (this.tileSizeY / 2)
        );
        this.sprite.setAngle(this.patternIndex * 90);

        this.setActiveTiles();
    }

    setActiveTiles() {
        this.tiles.forEach(tile => {
            tile.isActive = false;
            if (tile.debugRect) {
                tile.debugRect.destroy();
                tile.debugRect = null;
            }
        });

        const pattern = this.visionPatterns[this.patternIndex];
        for (let offset of pattern) {
            const tx = Math.round(this.pos.x + offset.x);
            const ty = Math.round(this.pos.y + offset.y);

            if (tx >= 0 && ty >= 0 && tx < this.gridWidth && ty < this.gridHeight) {
                const tile = this.tiles[ty * this.gridWidth + tx];
                tile.isActive = true;

                tile.debugRect = this.scene.add.rectangle(
                    tile.rect.x + this.tileSizeX / 2,
                    tile.rect.y + this.tileSizeY / 2,
                    this.tileSizeX,
                    this.tileSizeY,
                    0xff0000,
                    0.3
                ).setDepth(200);
            }
        }
    }



    getUpgradeCost(currentLevel) {
        const costs = [20, 50, 70];
        return costs[currentLevel] || 9999;
    }

    tryUpgradeVision() {
        const cost = this.getUpgradeCost(this.level);
        if (this.scene.resources['compute_units'] >= cost && this.level < 3) {
            this.scene.resources['compute_units'] -= cost;
            this.level++;
            this.scene.hud.updateHUD(this.scene.resources, this.scene.units, this.scene.unitCapMap);
            this.updatePatternForLevel();
            this.updatePosition();
        }
    }

    bindControls() {
        const isAzerty = window.keyboardLayout === 'azerty';
        const keys = {
            up: isAzerty ? 'Z' : 'W',
            down: 'S',
            left: isAzerty ? 'Q' : 'A',
            right: 'D',
            rotate: 'E'
        };

        this.keys = this.scene.input.keyboard.addKeys(keys);

        this.scene.input.keyboard.on('keydown', (event) => {
            const key = event.key.toLowerCase();
            let newX = this.pos.x;
            let newY = this.pos.y;

            if (key === keys.up.toLowerCase()) newY--;
            else if (key === keys.down.toLowerCase()) newY++;
            else if (key === keys.left.toLowerCase()) newX--;
            else if (key === keys.right.toLowerCase()) newX++;
            else if (key === keys.rotate.toLowerCase()) {
                const newIndex = (this.patternIndex + 1) % this.visionPatterns.length;
                const newPattern = this.visionPatterns[newIndex];

                const inBounds = newPattern.every(offset => {
                    const tx = this.pos.x + offset.x;
                    const ty = this.pos.y + offset.y;
                    return tx >= 0 && ty >= 0 && tx < this.gridWidth && ty < this.gridHeight;
                });

                if (inBounds) {
                    this.patternIndex = newIndex;
                    this.updatePosition();
                }
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

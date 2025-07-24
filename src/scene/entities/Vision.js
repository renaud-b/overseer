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

        // Position logique dans la grille
        this.pos = { x: 1, y: 1 };
        this.patternIndex = 0;
        this.level = 0;

        this.debugRects = []; // stocke les rectangles affichés
        this.createPatterns();
        this.bindControls();
        this.updatePosition();
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
            // Niveau 0 : L
            [ { x: 0, y: 0 }, { x: 1, y: 0 }, { x: 0, y: 1 } ],
            // Niveau 1 : carré 2x2
            [ { x: 0, y: 0 }, { x: 1, y: 0 }, { x: 0, y: 1 }, { x: 1, y: 1 } ],
            // Niveau 2 : carré + extension
            [ { x: 0, y: 0 }, { x: 1, y: 0 }, { x: 0, y: 1 }, { x: 1, y: 1 }, { x: 2, y: 1 } ],
            // Niveau 3 : rectangle 2x3
            [ { x: 0, y: 0 }, { x: 1, y: 0 }, { x: 0, y: 1 }, { x: 1, y: 1 }, { x: 0, y: 2 }, { x: 1, y: 2 } ]
        ];


        this.levelPatterns = basePatterns.map(base =>
            [0, 1, 2, 3].map(r => rotatePattern(base, r))
        );

        this.updatePatternForLevel();
    }

    updatePatternForLevel() {
        this.visionPatterns = this.levelPatterns[this.level] || this.levelPatterns[0];
        this.patternIndex = 0;
    }


    updatePosition() {
        this.debugRects.forEach(r => r.destroy());
        this.debugRects = [];

        this.tiles.forEach(tile => tile.isActive = false);

        const pattern = this.visionPatterns[this.patternIndex];
        const activeCoords = [];

        for (let offset of pattern) {
            const tx = this.pos.x + offset.x;
            const ty = this.pos.y + offset.y;

            if (tx >= 0 && ty >= 0 && tx < this.gridWidth && ty < this.gridHeight) {
                const tile = this.tiles[ty * this.gridWidth + tx];
                tile.isActive = true;
                activeCoords.push({ x: tx, y: ty });
            }
        }

        // Dessine toutes les bordures optimisées
        activeCoords.forEach(coord => {
            this.drawTileOutline(coord, activeCoords);
        });
    }


    drawTileOutline(coord, activeCoords) {
        const { x, y } = coord;
        const tile = this.tiles[y * this.gridWidth + x];
        const startX = tile.rect.x;
        const startY = tile.rect.y;

        const graphics = this.scene.add.graphics().setDepth(200).lineStyle(3, 0x00ffff, 1);

        const hasNeighbor = (dx, dy) =>
            activeCoords.some(c => c.x === x + dx && c.y === y + dy);

        // Haut
        if (!hasNeighbor(0, -1)) {
            graphics.beginPath();
            graphics.moveTo(startX, startY);
            graphics.lineTo(startX + this.tileSizeX, startY);
            graphics.strokePath();
        }

        // Bas
        if (!hasNeighbor(0, 1)) {
            graphics.beginPath();
            graphics.moveTo(startX, startY + this.tileSizeY);
            graphics.lineTo(startX + this.tileSizeX, startY + this.tileSizeY);
            graphics.strokePath();
        }

        // Gauche
        if (!hasNeighbor(-1, 0)) {
            graphics.beginPath();
            graphics.moveTo(startX, startY);
            graphics.lineTo(startX, startY + this.tileSizeY);
            graphics.strokePath();
        }

        // Droite
        if (!hasNeighbor(1, 0)) {
            graphics.beginPath();
            graphics.moveTo(startX + this.tileSizeX, startY);
            graphics.lineTo(startX + this.tileSizeX, startY + this.tileSizeY);
            graphics.strokePath();
        }

        this.debugRects.push(graphics);
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
}

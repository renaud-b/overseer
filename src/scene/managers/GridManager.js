class GridManager {
    constructor(scene, width, height, tileSizeX, tileSizeY, offsetX = 60, offsetY = 95) {
        this.scene = scene;
        this.width = width;
        this.height = height;
        this.tileSizeX = tileSizeX;
        this.tileSizeY = tileSizeY;
        this.offsetX = offsetX;
        this.offsetY = offsetY;

        this.tiles = [];


        this.scene.add.sprite(offsetX-40, offsetY-40, 'city_board')
            .setDisplaySize(this.tileSizeX*width+(46+52), this.tileSizeY*height+(42+36))
            .setOrigin(0)

        this.createGrid();

    }

    createGrid() {
        // Dessiner la grille avec Phaser Graphics
        const graphics = this.scene.add.graphics();
        graphics.lineStyle(2, 0x555555, 0.8); // couleur gris clair

        const gridWidthPx = this.width * this.tileSizeX;
        const gridHeightPx = this.height * this.tileSizeY;

        // Lignes verticales
        for (let x = 0; x <= this.width; x++) {
            graphics.moveTo(this.offsetX + x * this.tileSizeX, this.offsetY);
            graphics.lineTo(this.offsetX + x * this.tileSizeX, this.offsetY + gridHeightPx);
        }

        // Lignes horizontales
        for (let y = 0; y <= this.height; y++) {
            graphics.moveTo(this.offsetX, this.offsetY + y * this.tileSizeY);
            graphics.lineTo(this.offsetX + gridWidthPx, this.offsetY + y * this.tileSizeY);
        }

        graphics.strokePath();

        // Crée les tuiles interactives
        let index = 0;
        for (let y = 0; y < this.height; y++) {
            for (let x = 0; x < this.width; x++) {
                const tileX = this.offsetX + x * this.tileSizeX;
                const tileY = this.offsetY + y * this.tileSizeY;
                const tile = new Tile(this.scene, tileX, tileY, this.tileSizeX, this.tileSizeY, index);
                this.tiles.push(tile);
                index++;
            }
        }
    }


    getTileByCoord(x, y) {
        if (x < 0 || y < 0 || x >= this.width || y >= this.height) return null;
        return this.tiles[y * this.width + x];
    }

    getAllTiles() {
        return this.tiles;
    }

}

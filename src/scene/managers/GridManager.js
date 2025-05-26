class GridManager {
    constructor(scene, width, height, tileSize, offsetX = 32, offsetY = 100) {
        this.scene = scene;
        this.width = width;
        this.height = height;
        this.tileSize = tileSize;
        this.offsetX = offsetX;
        this.offsetY = offsetY;

        this.tiles = [];

        this.createGrid();
    }

    createGrid() {
        let index = 0;
        for (let y = 0; y < this.height; y++) {
            for (let x = 0; x < this.width; x++) {
                const tileX = this.offsetX + x * this.tileSize;
                const tileY = this.offsetY + y * this.tileSize;
                const tile = new Tile(this.scene, tileX, tileY, this.tileSize, index);
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

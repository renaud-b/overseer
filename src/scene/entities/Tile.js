class Tile {
    constructor(scene, x, y, sizeX, sizeY, index) {
        this.scene = scene;
        this.x = x;
        this.y = y;
        this.sizeX = sizeX;
        this.sizeY = sizeY;
        this.building = null;
        this.isActive = false;

        this.rect = scene.add.rectangle(x, y, sizeX, sizeY, 0x333333, 0.0)
            .setOrigin(0)
            .setInteractive();

        this.rect.input.dropZone = true;
        this.rect.setData('index', index);
        this.rect.setData('tileRef', this); // pour y accéder côté scène si besoin
    }
}

class Tile {
    constructor(scene, x, y, size, index) {
        this.scene = scene;
        this.x = x;
        this.y = y;
        this.building = null;
        this.isActive = false;

        this.rect = scene.add.rectangle(x, y, size - 2, size - 2, 0x333333)
            .setStrokeStyle(1, 0x555555)
            .setOrigin(0)
            .setInteractive();

        this.rect.input.dropZone = true;
        this.rect.setData('index', index);
        this.rect.setData('tileRef', this); // pour y accéder côté scène si besoin
    }
}
